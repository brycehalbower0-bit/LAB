# Plan: GBA / NDS / 3DS Emulator for iOS

Status: draft / planning document only. No implementation exists yet.

## 1. Goal and scope

Build a single native iOS application that emulates three Nintendo handheld
systems — **Game Boy Advance (GBA)**, **Nintendo DS (NDS)**, and **Nintendo
3DS** — sharing one app shell, one game library, one controller/input layer,
and one save-state UI, over **three separate emulation cores** selected
automatically by ROM type.

Per-system v1 scope:
- **GBA:** full commercial + homebrew compatibility target. Lowest technical
  risk of the three (§6.1) — this should be the first system to ship.
- **NDS:** as previously scoped — commercial + homebrew, touch/stylus input,
  save states, controller support. Core: **melonDS**, per direction below.
  DSi-exclusive features and GBA slot-2 pass-through are non-goals for v1.
- **3DS:** commercial + homebrew, **contingent on a dedicated feasibility
  study** (§6.3, §11). This is a fundamentally harder and riskier system
  than the other two on iOS specifically — see §2 and §6.3 before assuming
  it ships alongside GBA/NDS on the same timeline.

Cross-system non-goals for v1: any online play (GBA link cable via
internet, NDS WFC, 3DS online services), local wireless multiplayer between
devices, cloud save sync, and any DSiWare/eShop-only content.

The plan does **not** cover acquiring or distributing copyrighted
BIOS/firmware/OTP images or ROMs for any of the three systems. The app must
require the user to supply their own dumps from hardware they own; none may
be bundled, linked, or fetched by the app, for any system.

## 2. Legal and App Store reality (read first — this shapes every other decision)

- **Apple's policy (since April 2024, Guideline 4.7)** explicitly permits
  "retro game console emulator apps" on the App Store. Precedent: **Delta**
  (GBA/GBC/NES/SNES/N64/DS) is live on the US App Store today. There is
  **no comparable precedent for a 3DS emulator on the App Store** — none has
  shipped there as of this writing. Treat 3DS App Store approval as an open
  question, not an assumption.
- No system's copyrighted BIOS/firmware/key material or any ROM may ship
  with the app. Each system needs the user to supply their own dumps:
  - GBA: a BIOS dump (some games run BIOS-less with a high-level emulated
    BIOS, à la mGBA/VBA, which sidesteps this requirement for most titles).
  - NDS: BIOS (ARM7+ARM9) + firmware dump, or a from-scratch HLE BIOS
    (melonDS supports both native and a partial HLE BIOS path).
  - 3DS: **substantially more involved** — needs `boot9.bin`/`boot11.bin`
    and a keys file (either extracted via a one-time process on the user's
    own console using existing community homebrew, or in newer
    firmware-independent forms). The app must not perform or facilitate key
    extraction itself; it only accepts user-supplied files, same as the
    other two systems, but the barrier to a user actually having these
    files is materially higher than a GBA/NDS BIOS dump.
- **No JIT.** Apple does not grant the `dynamic-codesigning`/JIT
  entitlement to ordinary App Store apps. This rules out classic
  dynarec-with-`mmap(PROT_EXEC)` on all three systems. Impact differs a lot
  by system:
  - GBA (single ARM7TDMI @ 16.78 MHz): a plain optimized interpreter is
    known to be fast enough without JIT — this is well proven (mGBA's
    interpreter core, WASM ports, etc.).
  - NDS (ARM9 @ 66 MHz + ARM7 @ 33 MHz): interpreter-only is plausible but
    needs validation (§11) — this was the original plan's core risk.
  - **3DS (dual-core ARM11 @ 268 MHz + ARM9 @ 133 MHz, plus a
    shader-capable PICA200 GPU):** every existing 3DS emulator (Citra and
    its forks — Lime3DS, Azahar — and the independent Panda3DS project)
    relies heavily on a JIT/dynarec for the CPU cores to reach anything
    close to full speed; their interpreter-only fallback paths are
    documented as dramatically slower and not considered playable for most
    commercial titles. **A no-JIT 3DS core may simply not be fast enough on
    current iOS hardware for most commercial games.** This is the single
    biggest open question in the whole plan and must be answered by a
    dedicated spike (§11) before any real investment in 3DS work.
- Licensing:
  - **NDS: melonDS is confirmed as the core to adapt** (direction from
    project owner). melonDS is **GPLv3**. The resulting app is bound by
    GPLv3's terms — source must be made available, license/copyright
    notices preserved, no additional restrictions layered on top. This is
    a known, navigable pattern (Delta does the equivalent for its
    DeSmuME-derived DS core) but requires deliberate compliance work before
    Phase 6/store submission, not an afterthought.
  - GBA: **mGBA** is MPL-2.0 (weak copyleft, file-level — friendlier to mix
    with proprietary app-shell code than GPL, still requires source
    availability for MPL-covered files themselves).
  - 3DS: Citra's original codebase was GPLv2; community forks (Lime3DS,
    Azahar) continue under GPL variants; Panda3DS is a from-scratch project
    with its own (more permissive) licensing — worth re-verifying current
    license terms for whichever project is chosen at the time §6.3's spike
    happens, since forks and relicensing have moved around since Citra's
    2024 shutdown (see next bullet).
  - Because the app will combine a GPLv3 core (melonDS) with an MPL-2.0
    core (mGBA) and possibly a GPLv2/GPLv3 3DS core in one binary, get a
    single combined compliance plan (source offer covering all three,
    consistent notices/about screen) rather than three separate ad hoc
    treatments — do this once, early, as part of Phase 0's ADR.
- **3DS-specific legal signal worth weighing explicitly:** in March 2024,
  Nintendo sent the Citra project (Citra's team/org, via its corporate
  sponsor at the time) a cease-and-desist, and the original Citra team
  halted development and took down official builds/source at the time.
  Community forks (Lime3DS, Azahar) and the independent Panda3DS project
  have continued since. Emulation itself (the clean-room reverse
  engineering of hardware behavior) is broadly understood to be legal in
  the US and many jurisdictions, and Nintendo's action was reportedly tied
  to specific circumstances (monetization, branding, and a settlement) more
  than a blanket "emulating the 3DS is illegal" claim — but it demonstrates
  Nintendo is willing and able to act against 3DS emulation projects in a
  way it has not against GBA/NDS emulation. Factor this into risk appetite
  and timeline expectations for the 3DS portion specifically (§12).
- Regional distribution: if App Store review rejects the app (whole app or
  the 3DS capability specifically) in some storefronts, TestFlight and, in
  the EU under the DMA, alternative marketplaces / notarized sideloading
  are fallback channels. A pragmatic fallback worth planning for: ship
  GBA+NDS on the App Store first, and treat 3DS support as a
  build-time-optional capability that can be distributed separately
  (TestFlight / side-loaded / EU marketplace) if App Store review or the
  feasibility spike rules out shipping it in the main listing.

## 3. Prior art worth studying before writing code

- **GBA:**
  - **mGBA** (C, MPL-2.0) — the current reference-quality open-source GBA
    emulator: excellent accuracy, mature, actively maintained, proven fast
    interpreter-only, existing libretro core.
  - **VBA-M** (C++, GPLv2) — older alternative, less actively state-of-the-art
    than mGBA today.
- **NDS:**
  - **melonDS** (C++, GPLv3) — confirmed core to adapt. Reference-quality
    accuracy, especially 3D GPU; actively maintained; existing libretro core.
  - **DeSmuME** (C++, GPLv2) — useful secondary reference, especially for
    prior iOS porting experience (Delta's DS core lineage).
  - **DraStic** (closed-source) — no source, but a useful real-world
    performance bar for interpreter-plus-optimization NDS emulation on ARM
    mobile SoCs.
- **3DS:**
  - **Citra** (archived after March 2024 C&D) — the original reference
    implementation; still valuable to study historically even though the
    upstream project is inactive.
  - **Lime3DS** and **Azahar** — active community continuations of the
    Citra codebase; check current license/governance status before basing
    a decision on either, since both emerged post-shutdown and details may
    have moved since this document was written.
  - **Panda3DS** — an independent, from-scratch 3DS emulator (not a Citra
    fork), notable for a cleaner/more modern codebase and reportedly a
    JIT-optional design in places — worth evaluating specifically *because*
    of the no-JIT constraint on iOS, more so than the Citra-derived forks
    which were designed around dynarec being available.
- **Delta** (open source, App Store-shipped) — the most directly relevant
  overall template: a multi-system iOS emulator (GBA/GBC/NES/SNES/N64/DS)
  already live on the App Store. Study its repo for: how it structures a
  Swift app shell around multiple independent C/C++ cores (directly
  analogous to what this plan proposes for GBA+NDS+3DS), how it handles the
  App Store JIT restriction for N64 (a system that, like 3DS, traditionally
  leans on dynarec), its per-core plugin boundary, controller/skin system,
  and save-state UI.
- **libretro / RetroArch cores** — useful for the core/frontend separation
  pattern (small C ABI: init, load ROM, run frame, get framebuffer, audio
  callback, save state) that this plan's multi-core architecture (§5)
  mirrors, even though the project won't use the actual libretro runtime.

## 4. Core emulation strategy, per system

| System | Approach | Core | License | Confidence this ships in v1 |
|---|---|---|---|---|
| GBA | Adapt existing core | mGBA | MPL-2.0 | High — low technical risk |
| NDS | Adapt existing core | **melonDS** (confirmed) | GPLv3 | High, contingent on §11's interpreter-perf gate (was already the plan) |
| 3DS | Adapt existing core, **exact project TBD by spike** | Panda3DS or Lime3DS/Azahar (decide in §11's spike) | GPL variant or Panda3DS's own license (verify at spike time) | **Open** — contingent on a no-JIT performance feasibility spike; may end up out of v1 scope or shipped outside the App Store if infeasible |

Rationale for "adapt, don't write from scratch" across all three: this was
already the right call for NDS alone given multi-year effort to reach
commercial compatibility from a clean-room implementation; it's an even
easier call for GBA (mGBA is extremely mature) and an essentially forced
call for 3DS (a clean-room 3DS core is out of reach for a small team in any
reasonable timeframe — PICA200 GPU and ARM11 timing behavior alone
represent years of the existing 3DS emulation community's accumulated
reverse-engineering work).

## 5. High-level architecture

```
┌───────────────────────────────────────────────────────────────────┐
│  iOS App (Swift, SwiftUI + UIKit where needed)                      │
│  ┌───────────────┐ ┌────────────────┐ ┌────────────────────────┐   │
│  │ Library screen │ │ In-game overlay │ │ Settings / controller   │   │
│  │ (ROM import,   │ │ (touch controls, │ │ mapping / save mgmt /   │   │
│  │  auto-detect    │ │  menus)          │ │  per-system options)   │   │
│  │  system by ROM) │ │                  │ │                        │   │
│  └───────┬────────┘ └────────┬─────────┘ └───────────┬────────────┘   │
│          │                   │                        │                │
│  ┌───────▼───────────────────▼────────────────────────▼─────────┐    │
│  │  EmulatorKit (Swift package): owns the active-core lifecycle,   │    │
│  │  emulation thread, frame pacing, audio ring buffer, input       │    │
│  │  state, save-state serialization, ROM/BIOS/save file I/O — all   │    │
│  │  system-agnostic, talking to whichever core is active through   │    │
│  │  one shared `EmuCore` protocol / C ABI                          │    │
│  └───────────────────────────┬───────────────────────────────────┘    │
│                               │ shared C ABI (per §5.1)                 │
│      ┌────────────────────────┼────────────────────────┐               │
│  ┌───▼────────┐        ┌──────▼──────┐          ┌───────▼───────┐      │
│  │ GBA Core    │        │ NDS Core     │          │ 3DS Core        │      │
│  │ (mGBA-      │        │ (melonDS-    │          │ (TBD by §11     │      │
│  │  derived,   │        │  derived,    │          │  spike;         │      │
│  │  C, MPL-2.0)│        │  C++, GPLv3) │          │  interpreter-    │      │
│  │             │        │              │          │  first CPU core) │      │
│  └────────────┘        └─────────────┘          └────────────────┘      │
│                               │                                          │
│  ┌────────────────────────────▼─────────────────────────────────┐      │
│  │  Rendering: Metal (MTKView) — per-system screen layout          │      │
│  │  Audio: AVAudioEngine / CoreAudio ring buffer, per-system rate  │      │
│  │  Input: GameController framework + per-system touch overlay     │      │
│  └───────────────────────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────────────────┘
```

### 5.1 Shared core ABI

All three cores expose the same minimal C ABI (mirrors the libretro core
pattern), so `EmulatorKit` and the UI never need system-specific branches
except where gameplay genuinely differs (screen count/layout, stylus vs.
no-stylus, 3D face-buttons vs. GBA's smaller button set):

```
core_init / core_deinit
core_load_bios(path)         // system-specific required files, user-supplied
core_load_rom(path)
core_run_frame()
core_get_video_buffers()     // 1 buffer for GBA, 2 for NDS, 2 for 3DS (top+bottom)
core_get_audio_samples()
core_set_input(button_mask, touch_x, touch_y)   // touch ignored where n/a
core_save_state(slot) / core_load_state(slot)
core_get_save_data() / core_set_save_data()
core_describe()               // system id, screen geometry, native audio rate,
                               // required BIOS/firmware file list — drives UI
```

Each system's differences (GBA: one screen, no touch; NDS: two screens,
touch on the lower screen; 3DS: two screens including a stereoscopic-3D-
capable top screen we'll render in 2D-only for v1, touch on the bottom
screen, an additional analog circle pad) are described via `core_describe()`
metadata rather than hardcoded per-system UI branches, so the library/
settings/overlay UI is written once and adapts.

Keep every core buildable and testable headless on macOS/Linux with zero
iOS dependency (§9) — this is what makes fast per-core iteration possible
without a device/simulator in the loop for every change, and it's what
lets the 3DS core's feasibility spike (§11) run without an app shell
existing yet.

## 6. Per-system emulation notes

### 6.1 GBA — lowest risk, ship first

- CPU: single ARM7TDMI (ARMv4T), interpreter-only, no JIT needed — mGBA's
  own interpreter is already fast enough on mobile-class ARM64 without
  dynarec; port/adapt it largely as-is.
  Audio: 4 legacy Game Boy channels + 2 PCM (DirectSound) channels.
  Video: tile/sprite 2D PPU, 4 background modes, no 3D.
  Save types: SRAM/Flash/EEPROM, auto-detected via mGBA's existing
  database/heuristics.
- This is the system to bring up first (Phase 1 in §12): it validates the
  whole multi-core app shell and shared UI (§5) against the lowest-risk
  core, before NDS/3DS complexity is layered in.

### 6.2 NDS — as previously scoped, melonDS confirmed

(Carried over from the original single-system plan; unchanged except that
the "adapt vs. clean-room" decision is now settled — adapt melonDS.)

- **CPU (ARM9 @ 66 MHz, ARM7 @ 33 MHz):** interpreter-only per §2's no-JIT
  constraint. Start with a straightforward fetch-decode-execute
  interpreter for both ARM9 (ARMv5TE) and ARM7 (ARMv4T); optimize via
  computed-goto/function-pointer dispatch, per-page decode caching, NEON
  for pixel/audio paths, before considering a block-cached
  threaded-interpreter form if plain interpretation isn't fast enough
  (validate via §11, this was the original plan's central risk and still
  is for NDS specifically).
- **2D PPU ×2 + 3D GPU:** software rasterizer first (matches melonDS
  default, most accurate), Metal-accelerated rasterizer as a later
  perf/accuracy toggle once the CPU bottleneck is understood.
- **Audio:** 16-channel APU (PCM8/PCM16/ADPCM/PSG/noise) + ARM7 mixer,
  resampled to 44.1/48 kHz via `AVAudioEngine` + lock-free ring buffer.
- **Save states / cartridge saves / input / mic / RTC:** as in the
  original plan — see the archived detail in git history if needed;
  behaviorally unchanged by the multi-system expansion, just now
  implemented behind the shared ABI (§5.1) instead of a bespoke app.

### 6.3 3DS — highest risk, requires a dedicated feasibility spike before commitment

This is new relative to the original plan and is the least certain part of
this document. Do not schedule 3DS work on the same timeline confidence as
GBA/NDS until §11's spike answers the CPU performance question.

- **CPU:** dual-core ARM11 (MPE, @ 268 MHz combined) application cores plus
  an ARM9 for legacy/DS-compatibility-mode paths. Every mature 3DS emulator
  leans on a JIT (Citra's `dynarmic`) to hit playable speed; no iOS-legal
  no-JIT ARM11 interpreter of adequate speed is currently known to exist.
  Two paths to investigate in the spike:
  1. A heavily hand-optimized threaded/block-cached interpreter (same
     technique considered as NDS's fallback in §6.2, but starting from a
     much higher CPU clock and instruction throughput requirement) —
     unknown whether this closes the gap enough.
  2. Evaluate whether Panda3DS's architecture (§3) offers a more
     interpreter-friendly starting point than the Citra-lineage forks,
     which were built assuming dynarec.
  If neither closes the gap to real-time for a representative commercial
  3DS title on target hardware, **3DS is not viable in v1 as currently
  scoped** — the honest fallback is homebrew/lightweight-title-only support,
  or deferring 3DS indefinitely and shipping GBA+NDS as the product.
- **GPU (PICA200):** a shader-pipeline GPU, meaningfully more complex than
  the NDS's fixed-function 3D GPU — requires translating PICA200 shader
  bytecode to something Metal can execute (analogous to what Citra/Lime3DS
  do for desktop GPU backends). This is a substantial, separate body of
  work from the CPU question and should not start until the CPU feasibility
  question is answered, since a fast CPU core with no viable GPU path (or
  vice versa) both mean "not shippable."
- **Screens:** top screen (larger, natively stereoscopic-3D-capable — plan
  to render 2D-only for v1, no autostereoscopic/parallax-barrier
  reproduction) + bottom touch screen, plus a physical circle pad/second
  analog input the on-screen overlay and `GameController` mapping both need
  to account for (most MFi/Bluetooth controllers have a second stick,
  simplifying that half of the problem versus the touch overlay case).
- **Firmware/keys:** see §2 — materially higher barrier for users than
  GBA/NDS BIOS files; UI copy needs to set expectations accordingly
  (pointing at general instructions for how console owners typically
  obtain their own key files, without the app performing extraction
  itself).

## 7. Shared subsystem notes (apply across GBA/NDS/3DS, implemented once behind §5.1's ABI)

- **Save states:** full core memory + register snapshot, versioned format
  per core, independent of cartridge/game-card saves, multiple slots with
  framebuffer thumbnails — same design for all three systems, per-core
  serialization logic behind a shared save-state manager in `EmulatorKit`.
- **Input:** on-screen overlay driven by each core's `core_describe()`
  button/touch geometry (§5.1), `GameController` framework for MFi/
  Bluetooth controllers with a shared default mapping plus per-system
  overrides (e.g. 3DS's second stick maps to the circle pad; NDS/3DS touch
  screens still need direct finger/stylus touch since most controllers
  have no touchpad equivalent), `CoreHaptics` for on-screen button presses.
- **Audio:** per-core native sample generation feeding a shared
  `AVAudioEngine` output path and lock-free ring buffer pattern (realtime
  audio thread must not allocate/lock/call into Swift or ObjC runtime that
  can block) — the mixing/resampling logic is per-core, the output plumbing
  is shared.
- **Rendering:** shared `MTKView`-based pipeline (textured quad(s) per
  screen, nearest/bilinear/integer-scale filters), with per-system screen
  count/aspect driven by `core_describe()`; 3DS's GPU-side shader
  translation (§6.3) is the one place where "shared rendering pipeline"
  breaks down into system-specific work.
- **File access:** `UIDocumentPickerViewController` for ROM/BIOS/firmware/
  key-file import, security-scoped bookmarks, app sandbox storage for
  saves/save-states, custom UTIs per ROM extension (`.gba`, `.nds`,
  `.3ds`/`.cia`/`.cci` etc.) for Files-app drag-and-drop import.

## 8. iOS platform specifics

- **Language/toolchain:** Swift + SwiftUI app shell, Objective-C++ (`.mm`)
  bridge layer, C/C++ per-core libraries built as separate static library
  targets (mGBA is C, melonDS and the eventual 3DS core are C++). SwiftPM
  for app-side modules; cores vendored/submoduled.
  - **Threading model:** one emulation thread per active core (only one
    core active at a time — you're playing one game), `CADisplayLink`-
    synced pacing decoupled from audio so a dropped frame doesn't stutter
    sound, realtime audio thread consuming from the ring buffer
    independently.
- **Background/lifecycle:** pause emulation and flush save data on
  `applicationWillResignActive`; periodic autosave; don't rely on
  background execution time for emulation itself, for any system.
- **Performance/thermal:** profile with Instruments (Time Profiler, Metal
  System Trace) from each system's first working prototype; 3DS in
  particular should expect meaningfully more thermal pressure than
  GBA/NDS given the CPU/GPU workload difference — a frame-skip/dynamic-
  resolution fallback is more likely to be *necessary* (not just a nice
  safety net) for 3DS.
- **Minimum supported devices:** likely to differ per system — GBA/NDS can
  probably support a lower floor than 3DS; decide each independently based
  on the respective feasibility spikes (§11) rather than picking one
  device floor for the whole app up front.

## 9. Repository / project structure

```
/retro-emulator-ios
  PLAN.md                     (this document)
  README.md
  Cores/
    GBA/                      C core, adapted from mGBA (MPL-2.0)
    NDS/                      C++ core, adapted from melonDS (GPLv3)
    ThreeDS/                  C++ core, TBD by §11 spike — may not exist
                               yet as real code until feasibility is proven
    Shared/include/core_api.h Shared C ABI (§5.1) all three cores implement
  App/                        iOS app (Xcode project / SwiftPM)
    EmulatorKit/              Swift package: core-agnostic bridge + thread mgmt
    UI/                       SwiftUI screens (library, in-game overlay, settings)
    Bridge/                   Objective-C++ glue (.mm) per core
  Tests/
    CoreTests/                Headless per-core tests (macOS/Linux CI, no iOS)
    CompatTests/              Homebrew/test-ROM based regression tests, per system
  docs/
    hardware-notes/           Per-system notes (gba.md, nds.md, 3ds.md)
    decisions/                ADRs: per-core adapt decisions, JIT strategy per
                               system, 3DS go/no-go decision once §11 resolves
```

Keep every `Cores/*` buildable and testable on macOS/Linux in CI with zero
iOS dependency — critical for fast iteration and for running the 3DS
feasibility spike (§11) before any app shell work exists.

## 10. Performance validation gates (do this before deep investment — one gate per system, in priority order)

1. **GBA:** low priority to formally gate — mGBA's interpreter-only
   performance on ARM64 mobile hardware is already well established in the
   wider community. A brief sanity check (run a representative commercial
   title's interpreter loop headless, confirm real-time-equivalent MIPS on
   target hardware) is still worth doing before Phase 1, but this is not
   expected to block anything.
2. **NDS:** as originally planned — get the ARM9+ARM7 interpreter and
   memory bus running a homebrew test ROM headless on macOS, measure
   achievable MIPS, port the same harness to a real iOS device (not
   simulator), extrapolate against a representative commercial game's
   per-frame instruction budget at 59.8 fps to decide plain-interpreter vs.
   block-cached-interpreter (§6.2).
3. **3DS — the critical one:** before writing any 3DS core integration
   code, spike a minimal dual-core ARM11 interpreter (even against a
   trivial homebrew test binary, not a full commercial game) and measure
   achievable throughput on target iOS hardware, then compare against the
   known instruction/cycle budget existing 3DS emulators require for
   playable speed on desktop with JIT enabled. If the gap looks
   unclosable with interpreter-side optimization (NEON, block caching,
   etc.), **stop and make an explicit go/no-go decision** (documented as an
   ADR) before any further 3DS engineering investment — including GPU/
   PICA200 work, which is wasted effort if the CPU side can't keep up
   regardless.

## 11. Phased roadmap

**Phase 0 — Feasibility spikes (no shippable artifact)**
- Stand up the shared core ABI (§5.1) skeleton.
- Run the GBA sanity check and NDS feasibility gate (§10.1-2).
- Run the **3DS feasibility spike** (§10.3) — this is the phase's most
  important deliverable. Produce a written go/no-go ADR for 3DS before
  Phase 1 begins for that system specifically (GBA/NDS can proceed
  regardless of the 3DS outcome).
- Exit criteria: GBA and NDS interpreter paths validated at real-time-
  equivalent speed on target hardware; 3DS go/no-go decision documented.

**Phase 1 — GBA core bring-up + iOS shell v0**
- Adapt mGBA's core behind the shared ABI; bring up the app shell
  (library, ROM import, Metal rendering, on-screen controls,
  `GameController` support) against GBA first, since it's the lowest-risk
  system and validates the whole multi-core architecture end-to-end fastest.
- Exit criteria: a commercial GBA game is playable on a physical device
  with audio, save data, and save states working.

**Phase 2 — NDS core bring-up**
- Adapt melonDS behind the same shared ABI and app shell built in Phase 1;
  add the second-screen/touch-overlay UI concerns specific to NDS.
- Exit criteria: a commercial NDS game (including a 3D title) is playable
  end-to-end, reusing the Phase 1 shell largely unchanged.

**Phase 3 — 3DS core bring-up (only if Phase 0's go/no-go was "go")**
- Integrate the chosen 3DS core (Panda3DS or a Citra-lineage fork per
  §6.3/§11's spike outcome) behind the shared ABI; PICA200-to-Metal
  translation work; circle-pad/second-screen UI concerns.
- Exit criteria: a homebrew or low-complexity commercial 3DS title runs at
  acceptable speed on the chosen minimum-supported device tier.

**Phase 4 — Compatibility hardening (per system)**
- Automated compatibility suites (§12) per system, work through target
  title lists, per-game settings database for known-problematic titles.
- Exit criteria: a deliberately chosen compatibility bar per system (e.g.
  "N of the top-selling titles for each system boot and are playable") —
  pick N per system as a team decision.

**Phase 5 — Polish and store readiness**
- Unified library UI across all active systems, settings, skins/layouts,
  accessibility pass, App Store metadata, combined GPL/MPL compliance
  packaging (source offer covering all cores, licenses/about screen) per §2.
- Decide at this point whether 3DS ships in the same App Store listing as
  GBA/NDS or is distributed separately (§2's fallback plan) based on how
  Phase 3/4 and any review feedback went.

**Phase 6 — Beta, submission, iteration**
- TestFlight beta, crash-reporting triage (no gameplay analytics beyond
  stability needs), App Store submission, respond to review feedback, GA.

**Later / explicitly deferred:** DSi features, GBA slot-2 pass-through,
local wireless multiplayer, cloud save sync, per-game shaders/CRT filters,
3DS stereoscopic rendering, Mac (Catalyst/native) build reusing the same
`Cores/`.

## 12. Testing strategy

- **Per-core unit tests** (from Phase 0/1 onward): instruction-level
  correctness against each upstream project's own test coverage where
  available, run on macOS/Linux CI, no iOS device required.
- **Homebrew test ROMs per system:** each community (GBA, NDS, 3DS) has
  purpose-built test ROMs/homebrew (CPU instruction tests, timing tests,
  PPU/GPU feature tests, audio tests) — integrate as automated pass/fail
  regression suites before commercial-game compatibility work per system.
- **Framebuffer diffing:** compare rendered frames against each reference
  emulator's output at defined checkpoints, catching regressions in CI
  rather than relying on eyeballing.
- **Manual compatibility matrices:** one per system, tracking a target
  title list, boot/playable/complete status, known issues.
- **Device matrix:** test each system on its own minimum-supported device
  tier (§8) — do not assume GBA's low hardware floor generalizes to 3DS.
- Never commit copyrighted ROM/BIOS/firmware/key files to the repository or
  CI fixtures for any system — public-domain/homebrew test ROMs only in
  the repo itself; keep any internal commercial-game testing corpus outside
  version control.

## 13. Risks and mitigations

| Risk | System | Impact | Mitigation |
|---|---|---|---|
| No-JIT ARM11 performance may be inadequate for playable 3DS speed | 3DS | Project-critical for 3DS specifically | Phase 0 feasibility spike (§10.3) with an explicit go/no-go ADR before further 3DS investment |
| PICA200 shader-to-Metal translation complexity | 3DS | High | Don't start until CPU feasibility is confirmed; budget as its own substantial workstream, not a rendering afterthought |
| Nintendo legal action precedent (Citra C&D, 2024) | 3DS | Medium-high, business/legal | Treat as a known risk factor in timeline/appetite discussions; keep 3DS distributable outside the App Store as a fallback (§2) |
| No comparable App Store precedent for 3DS emulators | 3DS | Medium | Plan TestFlight/EU-marketplace fallback distribution from the start rather than assuming App Store approval |
| NDS interpreter-only performance ceiling | NDS | High (was project-critical in the original single-system plan) | Phase 0 feasibility gate (§10.2); fallback to block-cached interpreter |
| GPL(v3)/MPL(2.0) combined licensing obligations across 3 cores in one binary | All | Medium, legal | Single combined compliance plan (source offer, notices) decided in Phase 0's ADR, not per-core ad hoc |
| App Store review rejects GBA/NDS portion despite 2024 policy change | GBA/NDS | Low-medium | Follow Apple's emulator guidelines precisely; TestFlight fallback |
| Save data corruption/loss | All | High (user trust) | Atomic writes, autosave + manual save-state redundancy, versioned formats from day one |
| Scope creep from combining 3 systems into 1 app | All | Project-critical | Shared-ABI architecture (§5) to avoid 3x the app-shell work; strict phase exit criteria (§11); 3DS explicitly gated behind its own go/no-go |
| Thermal throttling, especially for 3DS | 3DS mainly | Medium-high | Per-system device matrix testing (§12), frame-skip/dynamic-resolution fallback, profile early per system |

## 14. Team and skills needed

- 1+ engineer strong in **C/C++ and low-level CPU/hardware emulation** —
  the critical path across all three cores, especially the 3DS spike.
- 1+ engineer strong in **Metal/graphics programming**, ideally with some
  shader-translation experience for the 3DS's PICA200 work specifically.
- 1 **iOS/Swift** engineer for the shared app shell/UI/platform integration
  (can overlap with the above on a small team).
- Access to a **range of physical test devices** spanning each system's
  intended minimum-to-current device support window — simulator
  performance is not representative for any of this.
- Someone tracking **App Store policy and licensing compliance** on an
  ongoing basis, not a one-time checklist — more load-bearing here than in
  a single-system plan given three licenses and an open legal question on
  3DS specifically.

Given the added 3DS scope, a single generalist can still drive Phase 0-1
(GBA) largely solo, but Phase 3 (3DS) realistically wants a second engineer
with graphics/shader background in parallel with the emulation specialist —
treat 3DS as needing more dedicated headcount than GBA+NDS did alone.

## 15. Immediate next steps

1. Stand up the shared core ABI skeleton (§5.1) and the repo layout (§9).
2. Adapt mGBA behind it first (lowest risk) — get *a* GBA homebrew ROM
   booting headless on macOS as the project's smallest possible "hello
   world."
3. Run the NDS feasibility gate (§10.2) on real iPhone hardware, as
   originally planned.
4. Run the **3DS feasibility spike (§10.3) in parallel** with 1-3, since
   its outcome materially changes the rest of the roadmap (§11 Phase 3
   onward) and is the one result the team can't safely assume — start
   gathering the answer as early as possible rather than discovering it
   after GBA/NDS are already shipped.
5. Write the combined licensing ADR (§2, §13) before any Phase 5/store-
   readiness work, so it isn't a late surprise.
