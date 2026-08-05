# ADR 0002 — ARM11 no-JIT interpreter: first on-device measurement

Status: accepted (2026-08-05)

The measurement ADR promised by [0001](0001-foundations.md) D6. It records
the first run of the PLAN.md §10.3 ARM11 interpreter spike on real Apple
silicon, via the EmuLab dev client (`App/`, `modules/spike-bench`) built on
EAS.

**This is not yet the binding measurement.** See "Device caveat" below.

## Run metadata

| | |
|---|---|
| Device | iPhone 17 Pro (`iPhone18,1`) |
| iOS version | not recorded by the harness (see "Follow-ups") |
| Date | 2026-08-05 |
| Build | `development` profile, EAS cloud build, dev client |
| Spike build flags | `-O3` in all configurations (`SpikeBench.podspec`) |
| Bar | 268 MIPS = 1:1 with one ARM11 core @ 268 MHz |

## Raw JSON (verbatim)

```json
{"host":"arm64","bar_mips":268.0,"results":[{"kernel":"alu_mix","backend":"naive","mips":232.0,"ns_per_instr":4.31,"vs_bar":0.866,"ok":true},{"kernel":"alu_mix","backend":"block-cached","mips":561.2,"ns_per_instr":1.78,"vs_bar":2.094,"ok":true},{"kernel":"alu_mix","backend":"threaded","mips":620.7,"ns_per_instr":1.61,"vs_bar":2.316,"ok":true},{"kernel":"mem_stream","backend":"naive","mips":240.4,"ns_per_instr":4.16,"vs_bar":0.897,"ok":true},{"kernel":"mem_stream","backend":"block-cached","mips":574.0,"ns_per_instr":1.74,"vs_bar":2.142,"ok":true},{"kernel":"mem_stream","backend":"threaded","mips":610.1,"ns_per_instr":1.64,"vs_bar":2.276,"ok":true},{"kernel":"call_heavy","backend":"naive","mips":249.6,"ns_per_instr":4.01,"vs_bar":0.931,"ok":true},{"kernel":"call_heavy","backend":"block-cached","mips":476.9,"ns_per_instr":2.10,"vs_bar":1.779,"ok":true},{"kernel":"call_heavy","backend":"threaded","mips":502.4,"ns_per_instr":1.99,"vs_bar":1.875,"ok":true}],"dual":[{"slice":64,"combined_mips":570.6,"per_core_pct":47.5},{"slice":512,"combined_mips":587.7,"per_core_pct":49.0},{"slice":4096,"combined_mips":597.7,"per_core_pct":49.8}]}
```

## Reading the result

### Throughput vs the 268-MIPS 1:1 bar

| kernel | naive | block-cached | threaded |
|---|---|---|---|
| alu_mix | 0.87× | 2.09× | **2.32×** |
| mem_stream | 0.90× | 2.14× | **2.28×** |
| call_heavy | 0.93× | 1.78× | **1.88×** |

**The threaded backend clears the bar on every kernel, worst case 1.88×.**
Per ADR 0001 D6's framing, `vs_bar >= 1.0` on the threaded backend means
the no-JIT interpreter sustains real time for one fully busy ARM11 core.
It does so here with 1.9–2.3× of headroom.

Three things worth noting:

- **Naive dispatch fails on every kernel** (0.87–0.93×). The block cache is
  not an optimization, it is the whole feasibility argument — same ISA,
  same hardware, 2.0–2.4× the throughput.
- **`call_heavy` is the floor.** Branch-dense code costs ~19% against
  `alu_mix` on the threaded backend, because branches end blocks and force
  cache lookups. This is the shape to optimize against, and the kernel to
  watch when the real core lands.
- **Threaded beats block-cached by 5–11%.** Skipping per-op condition and
  halt checks for `OPF_FAST` ops is worth real throughput, and it stays
  zero-code-generation — no runtime JIT, so §6.4's App Store path is intact.

### Dual-core interleave

Both ARM11 cores driven from a **single** host thread:

| slice | combined MIPS | per-core % of solo |
|---|---|---|
| 64 | 570.6 | 47.5% |
| 512 | 587.7 | 49.0% |
| 4096 | 597.7 | 49.8% |

Two fully busy ARM11 cores need 2 × 268 = **536 MIPS**. The best interleave
figure (597.7) is **1.11× that** — so even the pessimistic single-thread
layout clears real time on this device, though only just.

Interleaving costs little: 597.7 combined vs 620.7 solo retains **96%** of
throughput, and the near-flat slice sweep (47.5% → 49.8% across a 64× range)
says there is no pathological switch cost even at fine granularity. Slice
size is a latency/accuracy knob here, not a throughput one.

This matters mostly as a fallback datapoint. PLAN.md §1.1's intended layout
gives each ARM11 its own P-core, where the governing number is the per-core
1.88–2.32× above, not this 1.11×.

### Against the prior directional result

ADR 0001 D6 recorded block-cached dispatch at 0.76–0.91× of the bar on a
shared x86_64 Linux container with zero ARM64 tuning. On real Apple silicon
the same backend reaches 1.78–2.14× — roughly **2.3× better**, and across
the line from "under the bar" to "over it." D6's "serious engineering
candidate, not a hail-mary" reads, on this hardware, as confirmed.

## Device caveat — these numbers are directional, not binding

The run happened on an **iPhone 17 Pro**, not the iPhone 15 non-Pro that
ADR 0001 D4 and PLAN.md §1.1 designate as the floor. PLAN.md is explicit:

> if a title holds 60 fps on an iPhone 17 Pro but not on an iPhone 15, it
> has not met the bar.

So this ADR does **not** close the §10.3 gate. What it establishes is that
the approach works on modern Apple silicon with substantial margin, which
is a meaningfully stronger position than D6's container result — but the
A16 measurement is still the one that decides release sequencing.

The per-core margin (1.88× worst case) is wide enough that a floor-device
shortfall would be a surprise. The single-thread dual-core margin (1.11×)
is not — that one plausibly drops below 1.0 on an A16, which is a further
reason the one-ARM11-per-P-core layout is the design to carry forward.

## Limits of what was measured

The spike is deliberately not a core, and reading it as a speed prediction
would overstate it. It omits Thumb, the MMU/TLB, coprocessor access,
interrupts, and any block-cache invalidation, and it runs against flat RAM.
A production ARM11 core pays for all of those. **Treat these figures as an
optimistic ceiling on dispatch throughput, not as expected in-game speed.**

Also unmeasured: **thermals**. The benchmark runs ~5–8 seconds. PLAN.md
§1.1 requires performance in minute 45, not minute 2, and sustained-load
throttle testing on the floor device remains a separate, still-outstanding
obligation.

## Decision

- The no-JIT, zero-code-generation interpreter path is confirmed viable on
  modern Apple silicon, with the block cache as the load-bearing technique
  and threaded dispatch as the best of the three backends.
- No change to PLAN.md targets or to release sequencing is made on this
  ADR's evidence. Sequencing waits on the floor-device run.
- ADR 0001 D6 stands as written; this ADR supplements it rather than
  superseding it.

## Follow-ups

1. **Run this same harness on a physical iPhone 15 (non-Pro).** That is the
   binding measurement and the actual §10.3 gate. The app self-reports
   whether the device qualifies. An iPhone 15 Pro run would tighten the
   estimate but remains directional — the non-Pro A16 is the floor.
2. **Record the iOS version.** The share payload carries `Device.modelName`
   and `modelId` but not `Device.osVersion`; it should. One-line fix in
   `App/App.tsx`'s `share()`.
3. **Add a sustained-load mode** to the harness (minutes, not seconds) so
   the §1.1 thermal requirement gets a number instead of an assumption.
