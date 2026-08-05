// EmuAudio — AVAudioEngine + AVAudioSourceNode pulling from the core's
// read_audio (the ABI's wait-free ring interface). The render closure
// runs on the realtime audio thread: it calls the reader, zero-fills any
// shortfall, and touches nothing that can lock or allocate. The
// shortfall counter is a raw pointer so the render path never retains a
// Swift object.

import AVFoundation

final class EmuAudio {
  private let engine = AVAudioEngine()
  private var sourceNode: AVAudioSourceNode?
  private let shortfalls = UnsafeMutablePointer<UInt32>.allocate(capacity: 1)
  private(set) var lastError: String?

  var shortfallCount: UInt32 { shortfalls.pointee }

  init() {
    shortfalls.initialize(to: 0)
  }

  deinit {
    shortfalls.deallocate()
  }

  func start(sampleRate: Double, read: @escaping (UnsafeMutablePointer<Int16>, UInt32) -> UInt32) throws {
    stop()
    shortfalls.pointee = 0
    lastError = nil

    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playback, mode: .default)
    try session.setActive(true)

    guard let format = AVAudioFormat(commonFormat: .pcmFormatInt16,
                                     sampleRate: sampleRate,
                                     channels: 2,
                                     interleaved: true) else {
      throw EmuError(message: "audio format init failed (\(sampleRate) Hz)")
    }

    let counter = shortfalls
    let node = AVAudioSourceNode(format: format) { _, _, frameCount, audioBufferList -> OSStatus in
      let buffers = UnsafeMutableAudioBufferListPointer(audioBufferList)
      guard let mData = buffers[0].mData else { return noErr }
      let samples = mData.assumingMemoryBound(to: Int16.self)
      let got = read(samples, frameCount)
      if got < frameCount {
        // 2 channels * 2 bytes per sample.
        memset(samples + Int(got) * 2, 0, Int(frameCount - got) * 4)
        counter.pointee &+= 1
      }
      return noErr
    }

    engine.attach(node)
    engine.connect(node, to: engine.mainMixerNode, format: format)
    sourceNode = node

    do {
      try engine.start()
    } catch {
      lastError = "audio engine start failed: \(error.localizedDescription)"
      throw error
    }
  }

  func pause() {
    engine.pause()
  }

  func resume() {
    guard sourceNode != nil else { return }
    do {
      try engine.start()
    } catch {
      lastError = "audio engine resume failed: \(error.localizedDescription)"
    }
  }

  func stop() {
    engine.stop()
    if let node = sourceNode {
      engine.detach(node)
      sourceNode = nil
    }
  }
}
