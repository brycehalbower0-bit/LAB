# Plan: Nintendo DS Emulator for iOS

Status: draft / planning document only. No implementation exists yet.

## 1. Goal

Build a native iOS application that emulates the Nintendo DS (NDS) well enough
to run commercial and homebrew DS software at full speed on modern iPhones
and iPads, with a UI appropriate for touch: virtual buttons overlaid on the
lower (touch) screen, MFi/Bluetooth controller support, save states,
per-game settings, and optional Bluetooth link-cable-style local multiplayer.

Non-goals for v1: DSi-exclusive features (DSiWare, camera, extra RAM), GBA
slot-in compatibility (slot-2 GBA games), online Nintendo WFC emulation,
and Wi-Fi local multiplayer between physical/emulated devices. These are
plausible later phases, not v1 scope.

The plan does **not** cover acquiring or distributing copyrighted BIOS/firmware
images or ROMs. The app must require the user to supply their own dumps from
hardware they own; none may be bundled, linked, or fetched by the app.

## 2. Legal and App Store reality (read first — this shapes every other decision)

- **Apple's policy (since April 2024, Guideline 4.7)** explicitly permits
  "retro game console emulator apps" on the App Store, including in regions
  where App Store distribution now allows alternative marketplaces. This is
  the reason a from-scratch NDS emulator is viable to ship in 2026 in a way
  it wasn't a few years ago (see Delta, a GBA/NES/SNES/N64/DS emulator, on
  the US App Store as precedent).
- The app must **not** ship copyrighted BIOS/firmware or any ROM. It must
  offer a "import your own files" flow only (Files app / document picker),
  plus clear in-app text pointing out this requirement. Do not build any
  in-app browser, search, or download feature aimed at ROMs — that crosses
  from "emulator" to "piracy tool" in both App Store review and general legal
  exposure.
- **No JIT.** Apple does not grant the `dynamic-codesigning` / JIT
  entitlement to normal App Store apps (it's reserved for a handful of
  first-party and special-cased browser cases). This rules out a classic
  dynarec-with-`mmap(PROT_EXEC)` approach like desktop melonDS or DraStic use.
  The core CPU emulation must be a (heavily optimized) **interpreter**, or a
  **static/ahead-of-time recompiler** that emits ordinary compiled code
  ahead of time rather than at runtime. This is the single biggest technical
  constraint on the project and is discussed in §6.1.
- Licensing: if any GPL/GPLv3-licensed code (e.g. melonDS, DeSmuME) is reused
  or ported, the resulting app is bound by that license — notably GPLv3's
  anti-tivoization and full-source-availability terms interact awkwardly
  with App Store distribution (Apple's DRM). Projects that ship GPL cores on
  iOS (e.g. Delta's DeSmuME-derived DS core) handle this by distributing
  source and treating the App Store binary as a compiled distribution of
  GPL code — legal precedent exists but it requires deliberate compliance
  (offer source, preserve license/copyright notices, no additional
  restrictions). Recommendation: decide up front (§4) whether to write an
  original clean-room core (more work, no GPL obligations) or adapt an
  existing GPL core (much less work, inherits GPL obligations). Either is
  viable; pick one deliberately rather than drifting into it.
- Regional distribution: if App Store review rejects the app in some
  storefronts, TestFlight and (in the EU, under DMA) alternative
  marketplaces / notarized sideloading are fallback distribution channels.
  Plan for this from day one rather than treating App Store approval as
  binary pass/fail.

## 3. Prior art worth studying before writing code

- **melonDS** (C++, GPLv3) — the current reference-quality open-source NDS
  emulator; strong 3D GPU accuracy, actively maintained, has an existing
  libretro core (useful reference for a clean core/frontend split).
- **DeSmuME** (C++, GPLv2) — older, more portable codebase, historically the
  one most emulator-frontend apps (including iOS ports) have adapted.
- **DraStic** (closed-source, Android/iOS-adjacent) — proof that
  interpreter-plus-heavy-optimization NDS emulation is fast enough on ARM
  mobile SoCs; no source available, but useful as a performance bar.
- **Delta** (open source, App Store-shipped) — the most directly relevant
  prior art: a multi-system iOS emulator (GBA/GBC/NES/SNES/N64/DS) already
  live on the App Store, DS core derived from DeSmuME. Worth reading its
  public repo for: how it structures a Swift app around a C/C++ core, how it
  handles the App Store JIT restriction for N64 (dynarec-less interpreter),
  its controller/skin system, and its save-state UI. This is the closest
  existing template for exactly this project.
- **libretro / RetroArch cores** generally — useful for the core/frontend
  separation pattern (a core exposing a small C ABI: init, load ROM, run
  frame, get framebuffer, audio callback, save state) even though this
  project will not use the actual libretro runtime.

## 4. Core emulation strategy: adapt vs. write from scratch

Two real options; recommend evaluating both before committing:

**Option A — Adapt an existing open-source core (melonDS or DeSmuME).**
- Pros: NDS emulation correctness is extremely hard to get right (undocumented
  hardware quirks, timing-sensitive games, the 3D GPU's exact rasterization
  behavior). Reusing a mature core skips years of compatibility debugging.
- Cons: inherits GPL obligations (§2); requires stripping/replacing any
  platform code (desktop windowing, OpenGL desktop paths, x86-specific JIT)
  and replacing with an iOS-appropriate interpreter + Metal backend; still
  substantial porting work (build system, threading model, memory model
  differences on iOS).
- Recommended if the goal is a shippable, compatible app in a reasonable
  timeframe.

**Option B — Clean-room implementation from public hardware documentation**
(GBATEK, martin's NDS notes, hardware test ROMs).
- Pros: full control, no GPL entanglement, best learning value if that's a
  project goal.
- Cons: multi-year effort for a small team to reach commercial-game
  compatibility comparable to melonDS; 3D GPU and timing edge cases are
  brutal. Realistically a solo/small-team clean-room core will take a long
  time to run even moderately demanding commercial titles correctly.

**Recommendation:** start with Option A (adapt melonDS's core, since it's
the more actively maintained and accurate of the two, with DeSmuME's iOS
porting history as a reference), scoped down to an interpreter-only CPU
core, and explicitly account for GPLv3 compliance in the release process.
Revisit Option B only if licensing becomes a hard blocker.

## 5. High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│  iOS App (Swift, SwiftUI + UIKit where needed)                │
│  ┌───────────────┐ ┌────────────────┐ ┌────────────────────┐ │
│  │ Library / ROM │ │ In-game overlay │ │ Settings / controller│
│  │ import screen │ │ (touch controls, │ │ mapping / save mgmt │ │
│  │ (Files picker)│ │ menus)           │ │                     │ │
│  └───────┬───────┘ └────────┬─────────┘ └──────────┬─────────┘ │
│          │                  │                       │           │
│  ┌───────▼──────────────────▼───────────────────────▼────────┐ │
│  │        EmulatorKit (Swift package, thin ObjC++/Swift        │ │
│  │        bridge layer — owns the emulation thread, frame       │ │
│  │        pacing, audio ring buffer, input state, save state    │ │
│  │        serialization, ROM/BIOS/save file I/O)                │ │
│  └───────────────────────────┬──────────────────────────────┘ │
│                               │ C ABI                            │
│  ┌────────────────────────────▼─────────────────────────────┐ │
│  │        Core (C++17, platform-agnostic, adapted from         │ │
│  │        melonDS): ARM9 interpreter, ARM7 interpreter,         │ │
│  │        2D PPU x2, 3D GPU (software or Metal-backed),         │ │
│  │        memory bus, DMA, timers, IRQ, RTC, cartridge/SPI,     │ │
│  │        APU (audio mixing)                                    │ │
│  └────────────────────────────┬──────────────────────────────┘ │
│                               │                                  │
│  ┌────────────────────────────▼─────────────────────────────┐ │
│  │  Rendering: Metal (MTKView), two 256×192 screens composited  │ │
│  │  Audio: AVAudioEngine / CoreAudio ring buffer at 32.768 kHz  │ │
│  │  Input: GameController framework + on-screen touch overlay   │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

Key design decision: **strict separation between the core and the iOS
shell.** The core is portable C++ with zero iOS/Apple API references, built
as a static library, exposing a small C ABI (mirroring the libretro
core pattern: `core_init`, `core_load_rom`, `core_load_bios`, `core_run_frame`,
`core_get_framebuffer`, `core_audio_callback`, `core_save_state`,
`core_load_state`, `core_set_input`). This keeps the door open to reusing
the same core for a macOS/Catalyst build, or CI-running the core headless
on Linux for automated compatibility testing (§10), without touching iOS
frameworks at all.

## 6. Component-by-component plan

### 6.1 CPU emulation (ARM9 @ 66 MHz, ARM7 @ 33 MHz) — the hard constraint

No JIT is available (§2). Plan:
1. Start with a **straightforward interpreter** (fetch-decode-execute per
   instruction) for both ARM9 (ARMv5TE) and ARM7 (ARMv4T), instruction
   tables generated/validated against GBATEK and existing core references.
2. Optimize the interpreter aggressively before considering anything fancier:
   computed-goto or function-pointer-table dispatch, instruction decode
   caching (decode once per code page, not per execution), branch prediction
   for the interpreter's own hot loop, ARM64 NEON for pixel/audio paths.
3. If pure-interpreter performance is insufficient on target hardware after
   optimization (measure early, §9), evaluate a **static recompiler**: at
   ROM-load time, walk reachable code, translate ARM/THUMB blocks to
   pre-generated C++ / ARM64 blocks, and compile that translation unit with
   the normal Xcode toolchain as part of a "prepare game" step — i.e.
   compilation happens on-device via the standard (non-JIT) compiler
   toolchain is not available either, so in practice this means: precompute
   a translation to a **threaded-interpreter / block-cached form** (cache
   decoded micro-op sequences per basic block, not raw machine code) rather
   than true AOT machine code generation. This gets most of the win of a
   dynarec (removing decode overhead, enabling per-block optimization)
   without needing runtime code generation or an entitlement.
4. Budget for this being the single largest engineering risk in the whole
   project. Validate performance with a throwaway prototype (a minimal
   ARM7/ARM9 interpreter running a known-cost synthetic loop, or an early
   port of melonDS's interpreter core alone with a stub PPU) before
   committing to the rest of the architecture. See Phase 0 in §10.

### 6.2 Graphics: 2D PPU (×2) and 3D GPU
- Two independent 2D PPU engines (main + sub screen), each with backgrounds
  (text/affine/extended), sprites (OBJ), and blending — emulate in software
  into a framebuffer, matching melonDS's approach, then upload to a Metal
  texture.
- 3D GPU (only main-screen-capable): geometry engine (vertex/matrix
  pipeline) + rendering engine (rasterizer, texture mapping, fog, edge
  marking, anti-aliasing, shadow polygons). Two implementation paths:
  - **Software rasterizer** (matches melonDS's default, most accurate,
    correct for edge cases games rely on) — CPU-bound, needs NEON
    optimization to hit full speed on mobile.
  - **Hardware-accelerated rasterizer via Metal** (matches melonDS's OpenGL
    renderer option) — much faster, some accuracy trade-offs (a minority of
    games have visual bugs vs. software rendering, per melonDS's own
    documentation).
  - Plan: ship the software rasterizer first for correctness, add a Metal
    path later as a performance/accuracy toggle once the interpreter's own
    performance is understood (no point optimizing the GPU before knowing
    if the CPU is the bottleneck).
- Compositing both 256×192 screens into a single iOS view: vertical stack
  (matches physical device) as default layout, with landscape/side-by-side
  and single-screen-fullscreen-with-overlay as user-selectable layouts.

### 6.3 Audio
- APU: 16 hardware channels, PCM8/PCM16/ADPCM/PSG/noise, plus the ARM7-side
  mixer. Emulate at native rate, resample to 44.1/48 kHz for output.
- Output via `AVAudioEngine` with a lock-free ring buffer bridging the
  emulation thread (producer) and the audio render callback (consumer,
  realtime thread — must not allocate, lock, or call Swift/ObjC runtime
  methods that can block).

### 6.4 Memory, DMA, timers, IRQ, RTC, cartridge/SPI
- Direct ports from the reference core; these are comparatively
  well-understood and lower-risk than CPU/GPU.
- Cartridge backup save types (EEPROM 4k/64k/512k, FLASH 256k/512k/1M/8M,
  FRAM) auto-detected the same way melonDS/DeSmuME do (database of known
  game IDs + heuristics), persisted as `.sav` files alongside imported ROMs
  in app sandbox storage (or user-chosen Files location via security-scoped
  bookmarks).

### 6.5 Save states
- Full core memory + register snapshot serialization (core-side, versioned
  format so old states degrade gracefully across core updates), independent
  of cartridge-backup saves. Multiple slots per game, thumbnail capture from
  the framebuffer at save time.

### 6.6 Input
- On-screen touch overlay: D-pad, A/B/X/Y, L/R, Start/Select, plus a
  touch-passthrough region mapped 1:1 onto the emulated touchscreen (lower
  screen) with configurable opacity/layout, since DS games frequently
  require stylus input (menus, minigames, some full games like *Trauma
  Center*, *Elite Beat Agents*).
- `GameController` framework for MFi/Bluetooth controllers, with the touch
  screen still available via direct finger touch for stylus-dependent games.
- Configurable button mapping and haptic feedback (`CoreHaptics`) for
  touch-button presses.

### 6.7 Microphone (used by some games) and RTC
- Optional: route device microphone input through `AVAudioSession` into the
  emulated mic input for games that use it (e.g. blowing into the mic).
  Treat as a nice-to-have, gated behind a permission prompt, not required
  for v1.
- RTC: seed from device clock; games that check it (e.g. day/night cycles)
  just work.

## 7. iOS platform specifics

- **Language/toolchain:** Swift + SwiftUI for the app shell, Objective-C++
  (`.mm`) as the bridge layer between Swift and the C++ core, C++17 for the
  core itself. Xcode-managed project (SwiftPM for the app-side modules,
  the core as a vendored/submoduled static library target).
- **Rendering:** `MTKView` + a minimal Metal pipeline (two textured quads,
  nearest/bilinear/integer-scaling filter options, optional CRT/LCD-grid
  shader as a later nice-to-have).
- **Threading model:** one dedicated emulation thread running at the NDS's
  native 59.8 Hz frame rate (driven by a `CADisplayLink`-synced pacing
  scheme, decoupled so audio doesn't stutter if a frame is dropped), a
  render callback consuming the latest completed framebuffer, and the
  realtime audio thread consuming from the ring buffer independently.
- **File access:** `UIDocumentPickerViewController` for ROM/BIOS import,
  security-scoped bookmarks for persistent access, app sandbox storage for
  save files and save states, `Files` app integration (custom UTI for ROM
  extensions) so users can also import via drag-and-drop from Files.
- **Background/lifecycle:** pause emulation and flush save data on
  `applicationWillResignActive`/backgrounding; NDS games save frequently
  enough that "flush on backgrounding" plus periodic autosave is sufficient
  — don't rely on background execution time for emulation itself.
- **Performance/thermal:** profile with Instruments (Time Profiler, Metal
  System Trace) from the first working prototype; watch for thermal
  throttling on sustained full-speed emulation and expose a
  frame-skip/dynamic-resolution fallback if needed on older supported
  devices.
- **Minimum supported devices:** decide a floor (e.g. iPhone with A13+ /
  iOS 16+) based on early performance measurements in Phase 0 rather than
  guessing up front.

## 8. Repository / project structure (if built inside this monorepo's
`/nds-emulator-ios` directory)

```
/nds-emulator-ios
  PLAN.md                 (this document)
  README.md
  Core/                   C++17 emulation core (portable, no Apple APIs)
    cpu/                  ARM9 + ARM7 interpreters
    gpu/                  2D PPU, 3D GPU (software rasterizer first)
    apu/                  Audio channel mixing
    mem/                  Bus, DMA, timers, IRQ
    cart/                 Cartridge/save backup emulation
    include/core_api.h    C ABI surface used by the Swift bridge
  App/                    iOS app (Xcode project / SwiftPM)
    EmulatorKit/          Swift package: bridge + emulation thread mgmt
    UI/                   SwiftUI screens (library, in-game overlay, settings)
    Bridge/               Objective-C++ glue (.mm) calling into Core/
  Tests/
    CoreTests/            Headless core tests (run on macOS/Linux CI, no iOS needed)
    CompatTests/          Homebrew/test-ROM based regression tests
  docs/
    hardware-notes.md     Team's own notes distilled from GBATEK etc.
    decisions/            ADRs for core-vs-adapt, JIT strategy, etc.
```

Keep `Core/` buildable and testable on macOS/Linux in CI without any iOS
dependency — this is what makes fast CPU/GPU-accuracy iteration possible
without an iOS simulator/device in the loop for every change (§10).

## 9. Performance validation gate (do this before deep investment)

Before building out UI, save states, controller support, etc., build a
minimal throwaway harness:
1. Get *just* the ARM9+ARM7 interpreter and memory bus running a known
   homebrew test ROM (e.g. a public-domain "hello world" or a CPU test
   suite) headless on macOS, measure achievable MIPS.
2. Port that harness to an iOS command-line-style target (or a bare-bones
   SwiftUI shell with no rendering) running on a real device (not just
   simulator — simulator perf is not representative), measure MIPS there.
3. Extrapolate against known NDS CPU utilization for a representative
   commercial game (a few million instructions/frame at 59.8 fps) to decide
   if the plain-interpreter path (§6.1 step 1-2) is viable or whether the
   block-cached threaded-interpreter step is required before writing any
   more code.

This gate exists because §6.1 is the project's central technical risk;
everything else in this plan is comparatively conventional iOS app
engineering.

## 10. Phased roadmap

**Phase 0 — Feasibility spike (no shippable artifact)**
- Stand up `Core/` skeleton, adapt or write ARM9/ARM7 interpreters + memory
  bus only (no GPU/APU yet).
- Run the performance validation gate (§9) on real target hardware.
- Decide, in writing (an ADR in `docs/decisions/`): adapt-vs-clean-room
  (§4), plain-interpreter-vs-block-cached (§6.1), minimum supported device.
- Exit criteria: a homebrew test ROM boots and produces correct CPU-visible
  results (register/memory state matches a reference emulator at defined
  checkpoints) at or above real-time equivalent speed on target hardware.

**Phase 1 — Core bring-up**
- Add 2D PPU (software), get a static test ROM's framebuffer rendering
  correctly, pixel-compared against melonDS/DeSmuME reference screenshots.
- Add timers, DMA, IRQ, minimal cartridge header parsing.
- Exit criteria: a simple homebrew game is playable end-to-end headless
  (framebuffer dumped to disk per frame), no audio yet, no iOS shell yet.

**Phase 2 — iOS shell v0**
- Metal rendering of the two-screen framebuffer, `CADisplayLink` pacing,
  basic on-screen D-pad/buttons, ROM import via document picker.
- Exit criteria: the Phase 1 homebrew game is playable on a physical
  iPhone/iPad with touch controls, no crashes, stable frame pacing.

**Phase 3 — Audio + 3D GPU**
- APU channel mixing + `AVAudioEngine` output.
- 3D GPU geometry + software rasterizer.
- Exit criteria: a simple commercial 3D game (pick a low-complexity title
  for bring-up) runs with audio and 3D graphics recognizably correct.

**Phase 4 — Save data + save states + controller support**
- Cartridge backup save emulation + persistence, save state save/load with
  thumbnails, `GameController` MFi/Bluetooth mapping, haptics.
- Exit criteria: can play a commercial game across multiple sessions with
  saves and save states surviving app relaunch.

**Phase 5 — Compatibility hardening**
- Build the automated compatibility suite (§11), work through a target
  list of commercial titles, fix per-game issues, add a per-game
  compatibility/settings database (frame-skip, renderer choice, etc. as
  needed per known-problematic titles).
- Exit criteria: defined compatibility bar met (e.g. "N of the top 50
  best-selling DS titles boot and are playable") — pick N deliberately as
  a team decision, not guessed here.

**Phase 6 — Polish and store readiness**
- Library UI (box art via user-provided files or generated placeholders —
  no scraping copyrighted art without rights), settings, skins/layouts,
  accessibility pass, App Store metadata, GPL compliance packaging (source
  offer, licenses screen) per §2.
- Exit criteria: TestFlight build ready for external testers.

**Phase 7 — Beta, App Store submission, iteration**
- TestFlight beta, crash/telemetry triage (crash reporting only — no
  gameplay analytics beyond what's needed for stability), App Store
  submission, respond to review feedback, GA release.

**Later / explicitly deferred:** DSi feature set, GBA slot-in compatibility,
local wireless multiplayer, cloud save sync, per-game shaders/CRT filters,
performance-tier device scaling (dynamic resolution), Mac (Catalyst/native)
build reusing the same `Core/`.

## 11. Testing strategy

- **Core unit tests** (Phase 0+): instruction-level correctness against a
  reference (either melonDS's own test coverage if adapting it, or an
  independent ARM instruction test suite) — run on macOS/Linux CI, not
  requiring any iOS device.
- **Homebrew test ROMs:** the NDS homebrew community has purpose-built test
  ROMs (CPU instruction tests, timing tests, PPU/GPU feature tests,
  audio tests) — integrate these as an automated pass/fail regression
  suite before touching commercial-game compatibility work.
- **Framebuffer diffing:** for PPU/GPU work, compare rendered frames
  against a reference emulator's output at defined frames/checkpoints
  rather than eyeballing — catches regressions automated CI can flag.
- **Manual compatibility matrix:** a spreadsheet/doc tracking a target list
  of commercial titles, boot/playable/complete status, known issues —
  updated through Phase 5.
- **Device matrix:** test on the actual minimum-supported device class, not
  only the newest hardware, since thermal/performance headroom is the
  project's core risk (§9).
- Never commit copyrighted ROM/BIOS files to the repository or CI fixtures,
  even for testing — use only public-domain/homebrew test ROMs in the repo
  itself, and keep any internal commercial-game testing corpus outside
  version control per §2.

## 12. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| No-JIT performance ceiling too low for full-speed commercial games | Project-critical | Phase 0 feasibility gate (§9) before further investment; fallback to block-cached interpreter |
| 3D GPU accuracy/perf trade-offs (software vs. hardware rasterizer) | High | Ship software renderer first for correctness; add Metal-accelerated path once bottleneck is understood |
| GPL licensing obligations if adapting melonDS/DeSmuME | Medium, legal | Explicit ADR decision (§4) plus a written compliance checklist (source offer, notices) before Phase 6 |
| App Store review rejects the app despite 2024 policy change | Medium | Follow Apple's emulator guidelines precisely (no bundled ROMs/BIOS, no piracy-adjacent features); have TestFlight/EU-marketplace fallback ready |
| Save data corruption/loss | High (user trust) | Atomic writes, autosave + manual save state redundancy, format versioning from day one |
| Small team, large scope (full console emulator) | Project-critical | Adapt existing core (§4 Option A) rather than clean-room; scope v1 tightly (§1 non-goals); use Phase exit criteria to prevent scope creep |
| Thermal throttling during extended play | Medium | Device matrix testing (§11), frame-skip/dynamic-resolution fallback, profile early and often |

## 13. Team and skills needed

- 1+ engineer strong in **C++ and low-level CPU/hardware emulation** (the
  Phase 0-1 critical path).
- 1+ engineer strong in **Metal/graphics programming** (Phase 2-3).
- 1 **iOS/Swift** engineer for the app shell, UI, and platform integration
  (can overlap with the above if the team is small).
- Access to a **range of physical test devices** spanning the intended
  minimum-to-current device support window (simulator is not representative
  for performance work).
- Someone tracking **App Store policy and licensing compliance** as an
  ongoing responsibility, not a one-time checklist (§2, §12).

A single strong generalist engineer can realistically drive Phases 0-2 solo
if adapting an existing core; Phases 3-7 benefit substantially from a
second engineer given the parallel graphics/audio and compatibility-hardening
workload.

## 14. Immediate next steps

1. Write the Phase 0 ADR: adapt (melonDS) vs. clean-room (§4) — recommend
   adapt, but make it a deliberate written decision.
2. Stand up `Core/` skeleton and get *a* CPU interpreter (even an
   unoptimized one) executing a trivial homebrew test ROM headless on
   macOS — smallest possible "hello world" for this project.
3. Run the Phase 0 performance validation gate (§9) on a real iPhone before
   writing a single line of UI code.
