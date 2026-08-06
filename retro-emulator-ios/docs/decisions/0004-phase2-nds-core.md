# ADR 0004 — Phase 2 complete: NDS core (melonDS) + on-device measurement

Status: accepted (2026-08-06)

## Verification

On a physical iPhone 17 Pro, Pokémon Platinum (user-supplied dump)
boots via melonDS's FreeBIOS direct boot and **sustains 480 fps — the
8× fast-forward clamp — reliably**. Per D4 the figure is directional
(non-floor device), but against §1.1's committed NDS fast-forward
target of ≥2.5× it carries a 3.2× margin, and at native speed the
interpreter uses roughly an eighth of the frame budget. §10.2's
feasibility question — can the no-JIT ARM9+ARM7 interpreter plus
software 3D rasterizer hold real time on target hardware — is answered
directionally with room to spare.

## What shipped

- **`Cores/NDS`** — melonDS 1.1 vendored (GPLv3; provenance/prune list
  in its README), built `ENABLE_JIT=OFF` and constructed with
  `NDSArgs.JIT = std::nullopt`: interpreter-only per D3. FreeBIOS +
  generated firmware defaults mean zero user system files and zero key
  material (D5). `nds_core.cpp` adapts the class-based mCore-less API
  to the shared ABI; `nds_platform.cpp` is the minimal `Platform::`
  implementation melonDS requires (files/threads/time real; network,
  camera, mic, AAC, addons inert — v1 non-goals).
- **Dual screens + touch through the existing ABI** — no ABI changes
  needed: `EmuCoreDesc.screen_count=2` drives the shell's second
  surface, and `EmuInputState`'s touch fields (dormant since Slice 1)
  now carry stylus input (`setTouch` in guest pixels → melonDS
  `TouchScreen/ReleaseScreen`). The null core's two-screen design paid
  off exactly as intended.
- **Contract test with a synthetic direct-boot ROM** — hand-assembled
  header + ARM9/ARM7 programs pin boot, dual-screen video, channel
  order, audio rate (~548/frame at 32768 Hz), and state determinism.

## Facts future cores will want (learned the expensive way)

1. **melonDS emits ARGB-in-u32; mGBA emits RGBA.** The adapter swizzles
   R/B. This is precisely why every core's contract test asserts channel
   order with a known-color pixel — assumption would have shipped blue
   Pokémon.
2. `NDS::Start()` must follow Reset/SetupDirectBoot or RunFrame idles.
   Savestates use `Finish()` + `Length()` (`BufferLength()` is
   capacity). The SPU only pushes output while SOUNDCNT bit 15 is set.
   Cart offsets 0x4000–0x7FFF are the secure area — melonDS overwrites
   them with `0xE7FFDEFF` guards on failed decryption.
3. Pod-build traps, all now guarded in the sync script/podspec:
   `compile_commands.json` lists *configured* targets, not built ones
   (the teakra_c trap); bare `#include "Platform.h"` resolves to
   ExpoModulesCore's framework header (path-qualify vendored includes);
   CMake-generated files (`version.h`) must be materialized by the sync
   script; Expo forces C++20 pod-wide and a trailing `-std=gnu++17` in
   `OTHER_CPLUSPLUSFLAGS` wins it back; CI's static-lib lazy linking can
   hide missing symbols the pod's full link demands (Addon_MotionQuery).

## Deferred

- Microphone input (blow-to-play mechanics) — `Mic_ReadInput` returns
  silence; needs an AVAudioSession record path and a permission string.
- GBA slot-2 in NDS mode, local wireless, DSi mode — v1 non-goals per
  PLAN §1.
- Screen-gap/layout options (side-by-side, book mode) — shell polish.
- Floor-device verification — standing caveat, all systems.

## Consequence

Two of three systems ship-shape behind one ABI and one shell. Phase 3
(3DS) is next per §11: the hard one, where §6.4's swappable CPU backend
and ADR 0002's measured interpreter floor stop being preparation and
start being the product.
