/*
 * SpikeBenchBridge.h — pure-C surface between Swift and the C++ spike.
 * This is the only header exported to the Swift module; keep it C.
 */

#ifndef SPIKE_BENCH_BRIDGE_H
#define SPIKE_BENCH_BRIDGE_H

#ifdef __cplusplus
extern "C" {
#endif

/*
 * Runs the full spike benchmark (three kernels x three backends, plus the
 * dual-core interleave sweep) and returns a JSON document. The pointer is
 * valid until the next call. Takes several seconds; call off the main
 * thread.
 */
const char *spike_bench_run_json(void);

#ifdef __cplusplus
}
#endif

#endif /* SPIKE_BENCH_BRIDGE_H */
