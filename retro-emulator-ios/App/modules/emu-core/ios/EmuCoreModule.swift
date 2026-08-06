// EmuCoreModule — the Expo module surface. Definition only; all logic
// lives in EmuSession. JS owns navigation and UI; this surface is the
// boundary where the native side takes over (PLAN.md ADR 0001-D7).

import ExpoModulesCore

public class EmuCoreModule: Module {
  public func definition() -> ModuleDefinition {
    Name("EmuCore")

    // Loads the null diagnostic core (no ROM file needed).
    AsyncFunction("loadTestCore") { () -> [String: Any] in
      try EmuSession.shared.loadNullCore()
    }

    // Loads a ROM from disk. savePath, if given, is read for an existing
    // battery save and written back by flushSave/autosave.
    AsyncFunction("loadRom") { (romPath: String, savePath: String?) -> [String: Any] in
      try EmuSession.shared.loadRom(romPath: romPath, savePath: savePath)
    }

    AsyncFunction("start") {
      try EmuSession.shared.start()
    }

    AsyncFunction("stop") {
      EmuSession.shared.stop()
    }

    AsyncFunction("unload") {
      EmuSession.shared.unload()
    }

    // Sync on purpose: called on touch transitions (event rate), one
    // lock-protected store. The emulation thread applies it at tick
    // start per the ABI's threading rule.
    Function("setInput") { (mask: Int) in
      EmuSession.shared.setButtons(UInt32(truncatingIfNeeded: mask))
    }

    // 1.0 = native speed; clamped to PLAN §1.1's GBA fast-forward range.
    Function("setFastForward") { (multiplier: Double) in
      EmuSession.shared.fastForward = max(1.0, min(8.0, multiplier))
    }

    // Touch-screen input in guest pixels (NDS bottom screen). Sync for
    // the same reason as setInput: event-rate, one lock-protected store.
    Function("setTouch") { (x: Int, y: Int, down: Bool) in
      EmuSession.shared.setTouch(x: x, y: y, down: down)
    }

    AsyncFunction("saveState") { (path: String) in
      try EmuSession.shared.saveState(path: path)
    }

    AsyncFunction("loadState") { (path: String) in
      try EmuSession.shared.loadState(path: path)
    }

    AsyncFunction("flushSave") {
      try EmuSession.shared.flushSave()
    }

    AsyncFunction("getDiagnostics") { () -> [String: Any] in
      EmuSession.shared.diagnostics()
    }

    View(EmuSurfaceView.self) {
      Prop("screenIndex") { (view: EmuSurfaceView, index: Int) in
        view.screenIndex = index
      }
    }
  }
}
