# Getting to a playable 3DS — the engineering plan

Status: working plan (2026-08-06). Companion to PLAN.md §6.3/§10.3 and
ADRs 0002 (ARM11 measurement), 0005 (Azahar), 0006 (headless boot).

"Playable" here means PLAN.md §1.1's commitment: **locked 60 fps in
60 fps titles, sustained, on an iPhone 15 (A16), with no runtime code
generation.** Everything below exists to close that gap.

## Where the time actually goes

A 3DS frame on our stack costs four things, and only the first is
measured so far:

| Subsystem | Guest budget | Today | Gap |
|---|---|---|---|
| 2× ARM11 CPU | 536 MIPS combined | dyncom (unoptimized fallback) | the big one |
| PICA200 GPU | ~60 fps of 3D | software rasterizer (correctness ref) | large for 3D titles |
| ARM9 + DSP audio | 134 MHz + DSP | HLE DSP available | small |
| Frame pacing/thermal | minute 45, not minute 2 | unmeasured | unknown |

ADR 0002 measured **dispatch only**, on a subset ISA, on a 17 Pro:
1.88–2.32× the 268-MIPS bar. Treat that as an optimistic ceiling — the
production core adds Thumb, MMU/TLB, coprocessor, interrupts, and cache
invalidation, each of which costs throughput.

## Stage A — get it on the device and measure (Phase 3b)

Nothing below can be prioritized without a real profile. Ship the slow
version first: dyncom + software rasterizer, on-device, with the fps
badge. Deliverable: **a number** for each of the four rows above on
real hardware, and a frame profile from Instruments.

## Stage B — swap in our own CPU backend, correctness first

Grow `Spikes/arm11-interp` into a full `cpu_backend.h` implementation
(ARMv6K + Thumb + VFPv2 + CP15/MMU + interrupts + invalidation) and
wire it behind Azahar's `ARM_Interface` so it is selectable against
dyncom at runtime.

**Co-simulation is the correctness harness**: run both backends in
lockstep on the same bus, compare architectural state per block, and
fail the test at the exact diverging instruction. Runs in CI, no device
needed. This also audits dyncom, which nobody has optimized *or*
seriously stress-tested.

Gate: bit-identical to dyncom across the homebrew corpus before any
optimization work starts.

## Stage C — the optimization levers, in expected-value order

All of these produce **data**, never machine code — the App Store
constraint holds throughout (see ADR 0001-D3).

1. **Fastmem.** Map the guest address space with the host MMU so guest
   loads/stores become single host instructions instead of function
   calls through a bus object. Usually the single largest interpreter
   win in emulators; needs `mach_vm` mapping and a signal-handler
   fallback for the unmapped tail.
2. **Dead-flag elimination.** Most ARM instructions with the S-bit set
   NZCV that nothing ever reads. Analyze at block-build time and skip
   the computation. Cheap to implement, large constant-factor win.
3. **Register pinning + native flags.** Keep the guest register file in
   host callee-saved registers and map guest NZCV onto host NZCV. Free
   on ARM64, impossible on x86 — the structural reason this project is
   worth attempting at all.
4. **Tail-call threading.** Compile handlers so each jumps directly to
   the next (`[[clang::musttail]]`) instead of returning to a dispatch
   loop. Removes most remaining per-instruction overhead.
5. **Block linking.** Cache the edge between blocks that always follow
   one another; skip the lookup. The spike's known weakness was
   branch-dense code (`call_heavy`, 1.88× vs 2.32×) — this is its fix.
6. **Superinstructions.** Pre-compile handlers for recurring sequences
   (compare+branch, load+add+store) so one dispatch does several
   instructions' work.

Ratchet each against the 268-MIPS bar on the floor device; keep the
co-sim green after every change.

## Stage D — GPU, once the CPU picture is known

The software rasterizer will not hold 60 fps for 3D titles. Two routes,
decided by measurement, not preference:

- **Azahar's Vulkan renderer via MoltenVK** — App Store-legal, and
  upstream already builds it for iOS arm64.
- **Direct PICA200 → Metal** — more work, less indirection.

Keep the software rasterizer as the correctness reference for
framebuffer diffing in CI (PLAN.md §12).

Fallbacks §8 already anticipates and that 3DS will likely need:
frame-skip and dynamic resolution scaling.

## Stage E — the parts that make it feel finished

Audio via HLE DSP (Teakra LLE is a non-goal), frame pacing against the
59.83 Hz guest rate (the wall-clock pacer from ADR 0003 generalizes),
sustained-load thermal runs (§1.1's "minute 45"), and save states +
battery saves through the 3DS's archive-based storage.

## What the Mac changes

Owning a Mac with Xcode removes the project's slowest loop. Concretely:

- **Iteration goes from ~20 minutes (EAS) to ~1 minute** for native
  changes. Stage C is dozens of measure-change-measure cycles; this is
  the difference between weeks and days.
- **Instruments becomes available** — Time Profiler and Metal System
  Trace on a real device. Stages C and D are *profiling* problems;
  optimizing without a profiler is guesswork.
- **Local device debugging** — attach lldb to the running emulator
  instead of inferring from logs.
- **A JIT build becomes testable.** With a debugger attached, iOS
  permits JIT. That gives a same-hardware dynarmic baseline to measure
  the interpreter against — the honest denominator for "how close are
  we", and impossible to obtain on the App Store path alone.
- EAS stays useful for reproducible release builds; it stops being the
  development loop.

## Honest risk register

- **The interpreter may not reach 60 fps on the floor device.** PLAN.md
  §10.3 pre-committed three outcomes, and the swappable backend means a
  shortfall changes *which channel ships first*, not whether anything
  ships. GBA and NDS already carry the App Store listing.
- **Dyncom correctness is unproven** at the scale we need; co-sim may
  surface upstream bugs that cost time to fix.
- **App Store approval for 3DS is untested.** No 3DS emulator has been
  reviewed. The zero-key-material design (now CI-enforced, ADR 0006)
  makes it defensible, not guaranteed.
- **Thermals** may bind before raw throughput does, especially with the
  CPU pinned near capacity for long sessions.

## Sequencing

A → B → C, with D starting as soon as A's profile shows how much of the
frame the GPU actually costs. E throughout. Every stage ends in a
measured number recorded as an ADR — the project's existing habit and
the reason its claims are checkable.
