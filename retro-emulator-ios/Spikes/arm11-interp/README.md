# ARM11 no-JIT interpreter spike

The Phase 0 spike from PLAN.md §10.3: measure whether a block-cached,
no-JIT interpreter can plausibly reach real-time 3DS ARM11 speed on the
floor device (iPhone 15 / A16). No runtime code generation anywhere —
everything here is App Store-legal by construction.

## What it is

- `arm_interp.{h,cpp}` — an ARM-state (32-bit) ARMv6-subset interpreter
  with three backends over one decoder:
  - **naive** — fetch/decode/execute every instruction, every time;
  - **block-cached** — decode basic blocks once into cached micro-op
    (handler-pointer + operands) sequences, re-execute the cached form,
    fronted by a direct-mapped block map (the shape a production backend
    takes);
  - **threaded** — block-cached plus zero-per-op-check execution for ops
    that decode proved unconditional and straight-line (`OPF_FAST`), with
    per-block instruction accounting.
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

Worst possible host for this workload: unknown/virtualized clock (run-to-
run variance is large — compare within a run, not across runs), and none
of the ARM64 structural advantages apply. Representative run:

| kernel      | naive | block-cached | threaded | best vs 1:1 bar |
|-------------|------:|-------------:|---------:|----------------:|
| alu_mix     | 122.6 |        274.5 |    303.5 |           1.13× |
| mem_stream  | 109.4 |        255.8 |    295.9 |           1.10× |
| call_heavy  | 127.0 |        204.1 |    195.0 |           0.76× |

(guest MIPS; bar = 268)

Dual-core interleave (two guest CPUs, one host thread, threaded backend):
switching every 64 instructions costs ~10% versus every 512+; at 512+ the
combined throughput matches the solo number, i.e. the interleave itself is
nearly free at coarse quanta. The production design pins each ARM11 to its
own host P-core and syncs at timing boundaries, so this is an upper bound
on scheduling tax.

Takeaways:

1. **Block caching alone buys ~2–3×.** Decode elimination is the single
   largest lever, exactly as predicted in PLAN.md §6.3.
2. **Threaded dispatch clears the 1:1 bar on straight-line and memory
   workloads — on a shared x86 VM core**, before a single ARM64-specific
   optimization exists. The remaining big levers are all ARM64-only:
   - guest register file pinned in host registers (impossible on x86,
     natural on ARM64's 31 GPRs);
   - guest NZCV mapped to host NZCV instead of four bools;
   - NEON for the memory/vector paths.
3. **Branchy code is the weak spot, and it's understood.** On `call_heavy`
   (blocks of 1–4 instructions), threaded dispatch gains nothing — block
   *transition* cost dominates, not per-op cost. The known fix is block
   linking/chaining (each block caches its successor, skipping the map
   lookup), deliberately out of spike scope; it goes in the production
   backend.
4. Nothing here yet approximates MMIO cost or timing/scheduling against
   peripherals — the production backend carries those; the spike's job was
   to establish that the *dispatch engine* isn't hopeless without a JIT.
   It isn't.

**Next measurement step:** run this exact harness on a physical iPhone 15
(macOS first for the toolchain, then an iOS target — no UI needed). That
number goes in the §10.3 ADR and decides release sequencing.
