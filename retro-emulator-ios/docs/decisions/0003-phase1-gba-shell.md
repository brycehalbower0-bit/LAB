# ADR 0003 — Phase 1 complete: GBA core + app shell v0

Status: accepted (2026-08-05)

PLAN.md §11 Phase 1 exit criterion — *"a commercial GBA game is playable
on a physical device with audio, save data, and save states working"* —
verified on a physical iPhone 17 Pro with Pokémon Emerald (user-supplied
dump): clean audio, responsive controls, save states working including
across relaunch, in-game battery save surviving force-quit, and 60 fps
sustained **with Low Power Mode enabled**. Device caveat per D4: not the
floor device, so performance figures are directional — but GBA's ~200:1
host:guest ratio makes a floor-device shortfall implausible, which is
exactly why §10.1 rated this gate low-priority.

## What shipped (and the decisions inside it)

- **`App/modules/emu-core`** — local Expo module hosting cores behind
  the frozen ABI. Swift consumes `core_api.h` directly (it is pure C by
  design); there is no wrapper layer. One session, one emulation thread
  (CADisplayLink on a dedicated thread), documented lock model, audio
  via `AVAudioSourceNode` pulling the ABI's wait-free `read_audio`,
  Metal surface with a runtime-compiled shader so failures surface in
  `getDiagnostics()` rather than a black screen. The null core
  (Tests/CoreTests) shipped first and proved the entire pipeline before
  mGBA entered — that sequencing caught every platform bug at the
  cheapest possible point.
- **`Cores/GBA`** — mGBA 0.10.5 vendored as a pruned snapshot (MPL-2.0;
  provenance and prune list in its README), built under `LIBMGBA_ONLY`.
  `gba_core.c` adapts `mCore` to the shared ABI, mirroring upstream's
  libretro port: memory-VFile ROM load, blip_buf drained per frame into
  a C11-atomic SPSC ring, fixed FLASH1M battery buffer, raw-buffer save
  states (architectural-only, backend-portable per §6.4). RGBA channel
  order verified by CI — no swizzle.
- **Frame pacing** — guest frames follow wall clock at `native_fps`
  (59.7275), not the 60 Hz display tick; fast-forward is a rate
  multiplier (1–8×, §1.1's GBA commitment). Stalls re-anchor rather
  than sprint.
- **Shell v0 (JS)** — library with unzip-on-import, game screen with
  touch overlay (input crosses the bridge on touch transitions only),
  3 save-state slots, auto-resume snapshot with a Resume/Start-fresh
  prompt, fps/audio-drop diagnostics badge. Null-core test and the ARM11
  benchmark remain reachable (long-press the library title).
- **Workflow that made it cheap** — every C/C++ change compiles and
  contract-tests on Linux CI (~40 s) before any EAS build (~20 min);
  vendored copies are drift-checked; the mGBA source list and defines in
  the podspec are pinned to CI's dumped compile manifest, not guesses.

## Hard-won build rules (recorded so they aren't re-learned)

1. Never put a C library's include tree in `HEADER_SEARCH_PATHS`, and
   never let its headers match `source_files`: both leak into the
   clang-module build for the pod's Swift side, where mGBA's `math.h` /
   `string.h` shadow the system headers and corrupt the Darwin module
   graph. mGBA's paths and defines live in `OTHER_CFLAGS` only, and
   sources are enumerated explicitly.
2. Swift auto-unwraps direct vtable calls on imported C function
   pointers, but a `let`-bound copy is a plain optional — unwrap at
   bind time.
3. The mGBA snapshot must keep `src/platform/{cmake,test,posix}` —
   configure references the first two unconditionally and the third
   provides `anonymousMemoryMap`.

## Deferred (deliberate, not forgotten)

- **GameController support** — deferred by project direction.
- **Native touch-overlay fast path** (§8) — JS event-rate input is the
  interim; revisit if measured latency warrants.
- **Save-state thumbnails** (§7) — needs a frame-grab ABI addition.
- **Sustained-load thermal run** (§1.1: minute 45, not minute 2) — the
  GBA thermal footprint is negligible by design, but the standing
  obligation transfers to NDS/3DS bring-up.
- **Floor-device verification** — all Phase 1 numbers are directional
  until run on an iPhone 15 non-Pro (ADR 0002 carries the same caveat
  for the ARM11 measurement).

## Consequence

Phase 2 (NDS / melonDS behind the same ABI and shell) can begin. The
multi-core architecture is no longer theoretical: the shell, ABI,
save/state machinery, pacing, and build/CI pipeline are all validated
against a real core on real hardware.
