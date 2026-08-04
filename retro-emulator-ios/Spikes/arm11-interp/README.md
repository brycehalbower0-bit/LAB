# ARM11 no-JIT interpreter spike

The Phase 0 spike from PLAN.md §10.3: measure whether a block-cached,
no-JIT interpreter can plausibly reach real-time 3DS ARM11 speed on the
floor device (iPhone 15 / A16). No runtime code generation anywhere —
everything here is App Store-legal by construction.

## What it is

- `arm_interp.{h,cpp}` — an ARM-state (32-bit) ARMv6-subset interpreter
  with two backends over one decoder:
  - **naive** — fetch/decode/execute every instruction, every time;
  - **block-cached** — decode basic blocks once into cached micro-op
    (handler-pointer + operands) sequences, re-execute the cached form,
    fronted by a direct-mapped block map (the shape a production backend
    takes).
- `asm_helpers.h` — instruction encoders so tests/benchmarks are written
  as assembled guest programs.
- `kernels.h` — three workloads stressing the three interpreter cost
  centers: ALU/dispatch (`alu_mix`), memory (`mem_stream`), control flow
  (`call_heavy`). Each carries an independent C++ mirror of its own
  semantics.
- `tests.cpp` — flag/carry semantics, shift special cases (LSR/ASR #32,
  RRX), addressing modes, and every kernel checked against its mirror and
  cross-checked naive-vs-cached for identical final state.
- `bench.cpp` — reports guest MIPS and ns/guest-instruction per backend
  per kernel.

Deliberate non-goals (spike, not core): Thumb, shift-by-register,
halfword/multiple transfers, coprocessor/MMU, interrupts, cache
invalidation (no self-modifying code here; production backends invalidate
per `cpu_backend.h`).

## Build and run

```bash
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build
./build/arm11_tests   # must print: all tests passed
./build/arm11_bench
```

## Reading the numbers

A fully busy 3DS ARM11 core at a worst-case 1 instruction/cycle needs
**~268 guest MIPS**; the 3DS has two, scheduled onto two host P-cores, so
268 MIPS *per host core* is the 1:1 bar. Real games idle and stall, so
playable thresholds are lower — but 268 ends the argument.

**Only measurements on a physical iPhone 15 count as results** (PLAN.md
§1.1). Everything else is directional.

## Directional results — Linux container, shared x86_64 server core

Worst possible host for this workload: unknown/virtualized clock, and none
of the ARM64 structural advantages apply. Even so:

| kernel      | naive MIPS | block-cached MIPS | speedup | cached vs 1:1 bar |
|-------------|-----------:|------------------:|--------:|------------------:|
| alu_mix     |       80.4 |             242.9 |   3.02× |             0.91× |
| mem_stream  |       81.1 |             221.3 |   2.73× |             0.83× |
| call_heavy  |       88.2 |             204.7 |   2.32× |             0.76× |

Takeaways:

1. **Block caching alone buys ~2.3–3×.** Decode elimination is the single
   largest lever, exactly as predicted in PLAN.md §6.3.
2. **Already ~0.8–0.9× of the 1:1 bar on a shared x86 VM core**, before a
   single ARM64-specific optimization exists. The A16 P-core is faster
   than this host per-clock and per-core, and every remaining big lever is
   ARM64-only:
   - guest register file pinned in host registers (impossible on x86,
     natural on ARM64's 31 GPRs);
   - guest NZCV mapped to host NZCV instead of four bools;
   - computed-goto / threaded dispatch tuned for the host branch predictor;
   - NEON for the memory/vector paths.
3. Nothing here yet approximates MMIO cost, timing/scheduling overhead, or
   dual-core interleave — the production backend carries those; the spike's
   job was to establish that the *dispatch engine* isn't hopeless without a
   JIT. It isn't.

**Next measurement step:** run this exact harness on a physical iPhone 15
(macOS first for the toolchain, then an iOS target — no UI needed). That
number goes in the §10.3 ADR and decides release sequencing.
