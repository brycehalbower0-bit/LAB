// EmuSession — owns the active core and everything with a lifecycle:
// the emulation thread (CADisplayLink-paced), the audio engine, the
// latest-frame buffers the Metal view pulls from, and save/state file
// I/O. One session, one active game (PLAN.md §8 threading model).
//
// Locking model (keep this simple and documented):
//  - coreLock serializes every core call EXCEPT read_audio, which the
//    ABI defines as wait-free and callable from the realtime audio
//    thread concurrently with run_frame.
//  - frameLock guards the completed-frame pixel buffers shared with the
//    Metal view's draw loop.
//  - inputLock guards the pending button mask written by JS at event
//    rate and applied at tick start (honoring the ABI's rule that
//    set_input runs on the emulation thread).
// Stop order is always: display link -> audio -> join thread -> (unload
// only) destroy core.

import ExpoModulesCore
import QuartzCore
import UIKit

struct EmuError: LocalizedError {
  let message: String
  var errorDescription: String? { message }
}

final class EmuSession: NSObject {
  static let shared = EmuSession()

  struct ScreenFrame {
    var width = 0
    var height = 0
    var pixels: [UInt32] = []
  }

  private var api: UnsafePointer<EmuCoreApi>?
  private var core: OpaquePointer?
  private let coreLock = NSLock()

  private var desc = EmuCoreDesc()
  private var savePath: String?

  private var thread: Thread?
  private var threadRunLoop: CFRunLoop?
  private let threadExited = DispatchSemaphore(value: 0)
  private var paused = false
  private(set) var running = false

  let frameLock = NSLock()
  private(set) var frames: [ScreenFrame] = []

  private let inputLock = NSLock()
  private var pendingButtons: UInt32 = 0
  private var controllerButtons: UInt32 = 0
  private var touchDown = false
  private var touchX: UInt16 = 0
  private var touchY: UInt16 = 0
  private var analogX: Int16 = 0
  private var analogY: Int16 = 0

  // Frame pacing: guest time follows wall time so the 59.7275 Hz GBA
  // doesn't drift against the 60 Hz display link (the surplus otherwise
  // slowly overfills the audio ring). fastForward multiplies the rate.
  private var paceStart: CFTimeInterval = 0
  private var paceFramesRun: Double = 0
  var fastForward: Double = 1.0 {
    didSet { resetPacing() }
  }

  private func resetPacing() {
    paceStart = 0
    paceFramesRun = 0
  }

  private let audio = EmuAudio()

  // Diagnostics. framesRun/measuredFps are written on the emu thread and
  // read from getDiagnostics; single-writer aligned words, tolerable for
  // a diagnostic readout.
  private var framesRun: UInt64 = 0
  private var fpsWindowStart: CFTimeInterval = 0
  private var fpsWindowFrames = 0
  private var measuredFps: Double = 0
  private var lastError: String?

  override private init() {
    super.init()
    let nc = NotificationCenter.default
    nc.addObserver(self, selector: #selector(appWillResignActive),
                   name: UIApplication.willResignActiveNotification, object: nil)
    nc.addObserver(self, selector: #selector(appDidBecomeActive),
                   name: UIApplication.didBecomeActiveNotification, object: nil)
    // Physical controller support (GameController framework): deferred
    // by project direction; controllerButtons stays 0 until then.
  }

  func reportError(_ message: String) {
    lastError = message
  }

  // MARK: - Loading

  func loadNullCore() throws -> [String: Any] {
    // The null core wants any non-empty "ROM"; 4 arbitrary bytes will do.
    return try load(api: emu_null_api(), romData: Data([0x01, 0x02, 0x03, 0x04]), savePath: nil)
  }

  func loadRom(romPath: String, savePath: String?) throws -> [String: Any] {
    let romData = try Data(contentsOf: URL(fileURLWithPath: romPath))
    let ext = (romPath as NSString).pathExtension.lowercased()
    let api: UnsafePointer<EmuCoreApi>?
    switch ext {
    case "gba": api = emu_gba_api()
    case "nds": api = emu_nds_api()
    default: api = emu_null_api()
    }
    return try load(api: api, romData: romData, savePath: savePath)
  }

  private func load(api newApi: UnsafePointer<EmuCoreApi>?, romData: Data, savePath: String?) throws -> [String: Any] {
    unload()

    coreLock.lock()
    defer { coreLock.unlock() }

    guard let newApi else { throw EmuError(message: "core api unavailable") }
    guard let newCore = newApi.pointee.create() else {
      throw EmuError(message: "core create failed")
    }

    var d = EmuCoreDesc()
    newApi.pointee.describe(newCore, &d)

    let status = romData.withUnsafeBytes { raw -> EmuStatus in
      let bytes = raw.bindMemory(to: UInt8.self)
      return newApi.pointee.load_rom(newCore, bytes.baseAddress, bytes.count)
    }
    guard status == EMU_OK else {
      newApi.pointee.destroy(newCore)
      throw EmuError(message: "load_rom failed: \(Self.describe(status: status))")
    }

    // Battery save from disk, if the caller has one (best effort — a
    // missing file just means a fresh game).
    if let savePath, let saveData = try? Data(contentsOf: URL(fileURLWithPath: savePath)) {
      _ = saveData.withUnsafeBytes { raw -> EmuStatus in
        let bytes = raw.bindMemory(to: UInt8.self)
        return newApi.pointee.save_data_write(newCore, bytes.baseAddress, bytes.count)
      }
    }

    newApi.pointee.reset(newCore)

    api = newApi
    core = newCore
    desc = d
    self.savePath = savePath
    lastError = nil
    framesRun = 0
    measuredFps = 0

    return [
      "name": d.name.map { String(cString: $0) } ?? "unknown",
      "screenCount": Int(d.screen_count),
      "width": Int(d.screens.0.width),
      "height": Int(d.screens.0.height),
      "fps": d.native_fps,
      "sampleRate": Int(d.audio_sample_rate),
    ]
  }

  // MARK: - Run control

  func start() throws {
    coreLock.lock()
    let hasCore = core != nil
    coreLock.unlock()
    guard hasCore else { throw EmuError(message: "no core loaded") }
    guard !running else { return }

    guard let api, let core else { throw EmuError(message: "no core loaded") }
    // Direct vtable calls auto-unwrap, but a let-bound copy of a C fn
    // pointer is a plain optional — unwrap once here.
    guard let readAudio = api.pointee.read_audio else {
      throw EmuError(message: "core has no read_audio")
    }
    try audio.start(sampleRate: Double(desc.audio_sample_rate)) { buffer, maxFrames in
      readAudio(core, buffer, maxFrames) // wait-free per ABI; audio-thread safe
    }

    paused = false
    running = true
    let t = Thread { [weak self] in self?.emuThreadMain() }
    t.name = "emu-core"
    t.qualityOfService = .userInteractive
    thread = t
    t.start()
  }

  func stop() {
    guard running else { return }
    running = false
    if let rl = threadRunLoop {
      CFRunLoopStop(rl)
    }
    _ = threadExited.wait(timeout: .now() + 2)
    thread = nil
    threadRunLoop = nil
    audio.stop()
    try? flushSave()
  }

  func unload() {
    stop()
    coreLock.lock()
    if let api, let core {
      api.pointee.destroy(core)
    }
    core = nil
    api = nil
    coreLock.unlock()
    frameLock.lock()
    frames = []
    frameLock.unlock()
  }

  func setButtons(_ mask: UInt32) {
    inputLock.lock()
    pendingButtons = mask
    inputLock.unlock()
  }

  /// Circle pad / analog stick, each axis -1.0...1.0 (3DS; ABI carries
  /// it as -32768...32767).
  func setAnalog(x: Double, y: Double) {
    let clampedX = max(-1.0, min(1.0, x))
    let clampedY = max(-1.0, min(1.0, y))
    inputLock.lock()
    analogX = Int16(clampedX * 32767.0)
    analogY = Int16(clampedY * 32767.0)
    inputLock.unlock()
  }

  /// Guest-pixel coordinates on the touch screen; down=false releases.
  func setTouch(x: Int, y: Int, down: Bool) {
    inputLock.lock()
    touchDown = down
    touchX = UInt16(clamping: x)
    touchY = UInt16(clamping: y)
    inputLock.unlock()
  }

  // MARK: - Emulation thread

  private func emuThreadMain() {
    threadRunLoop = CFRunLoopGetCurrent()
    let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
    link.preferredFramesPerSecond = 60
    link.add(to: .current, forMode: .default)
    CFRunLoopRun()
    link.invalidate()
    threadExited.signal()
  }

  @objc private func tick(_ link: CADisplayLink) {
    if paused {
      resetPacing()
      return
    }

    // Guest frames due by wall clock (native_fps × fastForward). A big
    // gap (stall, debugger, backgrounding) re-anchors instead of
    // sprinting to catch up.
    let now = CACurrentMediaTime()
    if paceStart == 0 {
      paceStart = now
      paceFramesRun = 0
    }
    let rate = desc.native_fps > 0 ? desc.native_fps * fastForward : 60.0
    let due = (now - paceStart) * rate
    var todo = Int(due - paceFramesRun)
    let cap = max(4, Int(fastForward) * 2)
    if todo > cap {
      paceStart = now
      paceFramesRun = 0
      todo = cap
    }
    if todo <= 0 { return }
    paceFramesRun += Double(todo)

    coreLock.lock()
    guard let api, let core else {
      coreLock.unlock()
      return
    }

    inputLock.lock()
    let buttons = pendingButtons | controllerButtons
    let tDown: Int32 = touchDown ? 1 : 0
    let tX = touchX
    let tY = touchY
    let aX = analogX
    let aY = analogY
    inputLock.unlock()
    var input = EmuInputState(buttons: buttons, touch_down: tDown, touch_x: tX,
                              touch_y: tY, analog_x: aX, analog_y: aY)
    api.pointee.set_input(core, &input)

    for _ in 0..<todo {
      api.pointee.run_frame(core)
    }

    let screenCount = Int(desc.screen_count)
    frameLock.lock()
    if frames.count != screenCount {
      frames = Array(repeating: ScreenFrame(), count: screenCount)
    }
    for screen in 0..<screenCount {
      var buf = EmuVideoBuffer()
      api.pointee.get_video(core, UInt32(screen), &buf)
      guard let px = buf.pixels else { continue }
      let w = Int(buf.width)
      let h = Int(buf.height)
      let stride = Int(buf.stride_pixels)
      if frames[screen].width != w || frames[screen].height != h {
        frames[screen] = ScreenFrame(width: w, height: h,
                                     pixels: [UInt32](repeating: 0, count: w * h))
      }
      frames[screen].pixels.withUnsafeMutableBufferPointer { dst in
        guard let base = dst.baseAddress else { return }
        if stride == w {
          memcpy(base, px, w * h * 4)
        } else {
          for row in 0..<h {
            memcpy(base + row * w, px + row * stride, w * 4)
          }
        }
      }
    }
    frameLock.unlock()
    coreLock.unlock()

    framesRun &+= UInt64(todo)
    if fpsWindowStart == 0 { fpsWindowStart = now }
    fpsWindowFrames += todo
    if now - fpsWindowStart >= 1.0 {
      measuredFps = Double(fpsWindowFrames) / (now - fpsWindowStart)
      fpsWindowStart = now
      fpsWindowFrames = 0
    }
  }

  // MARK: - Save states / battery save

  func saveState(path: String) throws {
    coreLock.lock()
    defer { coreLock.unlock() }
    guard let api, let core else { throw EmuError(message: "no core loaded") }
    let size = api.pointee.state_size(core)
    guard size > 0 else { throw EmuError(message: "state_size returned 0") }
    var data = Data(count: size)
    let status = data.withUnsafeMutableBytes { raw -> EmuStatus in
      let bytes = raw.bindMemory(to: UInt8.self)
      return api.pointee.state_save(core, bytes.baseAddress, bytes.count)
    }
    guard status == EMU_OK else {
      throw EmuError(message: "state_save failed: \(Self.describe(status: status))")
    }
    try data.write(to: URL(fileURLWithPath: path), options: .atomic)
  }

  func loadState(path: String) throws {
    let data = try Data(contentsOf: URL(fileURLWithPath: path))
    coreLock.lock()
    defer { coreLock.unlock() }
    guard let api, let core else { throw EmuError(message: "no core loaded") }
    let status = data.withUnsafeBytes { raw -> EmuStatus in
      let bytes = raw.bindMemory(to: UInt8.self)
      return api.pointee.state_load(core, bytes.baseAddress, bytes.count)
    }
    guard status == EMU_OK else {
      throw EmuError(message: "state_load failed: \(Self.describe(status: status))")
    }
  }

  func flushSave() throws {
    coreLock.lock()
    defer { coreLock.unlock() }
    guard let api, let core, let savePath else { return }
    let size = api.pointee.save_data_size(core)
    guard size > 0 else { return }
    var data = Data(count: size)
    let status = data.withUnsafeMutableBytes { raw -> EmuStatus in
      let bytes = raw.bindMemory(to: UInt8.self)
      return api.pointee.save_data_read(core, bytes.baseAddress, bytes.count)
    }
    guard status == EMU_OK else {
      throw EmuError(message: "save_data_read failed: \(Self.describe(status: status))")
    }
    try data.write(to: URL(fileURLWithPath: savePath), options: .atomic)
  }

  // MARK: - Diagnostics / lifecycle

  func diagnostics() -> [String: Any] {
    return [
      "coreLoaded": core != nil,
      "running": running,
      "paused": paused,
      "framesRun": Int(framesRun),
      "fps": measuredFps,
      "audioShortfalls": Int(audio.shortfallCount),
      "lastError": (lastError ?? audio.lastError) ?? NSNull(),
    ]
  }

  @objc private func appWillResignActive() {
    paused = true
    audio.pause()
    try? flushSave() // PLAN.md §8: flush save data on resign-active
  }

  @objc private func appDidBecomeActive() {
    if running {
      audio.resume()
    }
    paused = false
  }

  private static func describe(status: EmuStatus) -> String {
    switch status {
    case EMU_OK: return "ok"
    case EMU_ERR_INVALID_ARG: return "invalid argument"
    case EMU_ERR_BAD_ROM: return "bad ROM"
    case EMU_ERR_MISSING_SYSTEM_FILE: return "missing system file"
    case EMU_ERR_BAD_STATE: return "bad save state"
    case EMU_ERR_UNSUPPORTED: return "unsupported"
    case EMU_ERR_ENCRYPTED_CONTENT: return "encrypted content (rejected by design)"
    default: return "error \(status.rawValue)"
    }
  }
}
