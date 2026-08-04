import ExpoModulesCore

public class SpikeBenchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SpikeBench")

    // Runs for several seconds; Expo async functions execute off the main
    // thread, and the JS side shows progress state meanwhile.
    AsyncFunction("runBenchmark") { () -> String in
      guard let cString = spike_bench_run_json() else {
        return "{\"error\":\"bench returned null\"}"
      }
      return String(cString: cString)
    }
  }
}
