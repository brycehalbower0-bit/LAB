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
- **3DS:** commercial + homebrew. **Committed scope, and the project's
  differentiator** — no 3DS emulator has shipped on the App Store, and
  being first is an explicit goal. It is also by far the hardest of the
  three on iOS specifically (§6.3): the CPU performance problem is
  genuinely unsolved by anyone, because every existing 3DS emulator was
  built for desktop where a JIT is simply available. §6.4 describes the
  architecture that makes solving it tractable. 3DS ships last of the
  three, not because it's optional, but because GBA and NDS validate the
  shared shell cheaply while the hard core work proceeds in parallel.

**Device floor and performance bar (decided):** the app supports
**iPhone 15 and newer** — i.e. A16 Bionic as the minimum SoC — and on that
floor the bar is not "runs" but **comfortably fast**: locked native frame
rate with headroom, fast-forward where the system allows it, and no
thermal collapse over a long play session. Concrete per-system targets
live in §1.1. This is a deliberate trade: giving up older devices buys a
very high guaranteed single-thread baseline, which is precisely the
resource interpreter-based (no-JIT) emulation depends on, and it lets
every optimization decision target one narrow, modern hardware window
(A16 and up, all ARMv8.6+ with identical NEON capabilities) instead of a
compatibility spread.

### 1.1 Performance targets, per system, on the A16 floor

What the floor buys us: the A16's two performance cores run at ~3.46 GHz
with very wide out-of-order execution; A17 Pro and later are faster still.
For emulation, the ratio of host clock to guest clock is the crude but
honest yardstick:

| System | Guest CPU | Host-to-guest clock ratio (A16 P-core) | v1 target on iPhone 15 |
|---|---|---|---|
| GBA | ARM7TDMI @ 16.78 MHz | ~200:1 | Locked 60 fps using a small fraction of one core; fast-forward ≥ 8×; effectively zero thermal footprint |
| NDS | ARM9 @ 66 MHz + ARM7 @ 33 MHz | ~35:1 vs. the ARM9 | Locked 60 fps (59.8 Hz native) with the software 3D rasterizer, interpreter-only, sustained — plus fast-forward ≥ 2× |
| 3DS | 2× ARM11 @ 268 MHz (+ ARM9 @ 134 MHz) | ~13:1 vs. one ARM11 core | **Full speed (60 fps in 60 fps titles) on the JIT build; full speed as the goal on the interpreter build**, with the measured gap (if any) tracked as the project's headline engineering number (§10.3) |

The 3DS row is the demanding one, and the floor is what makes it credible:
a ~13:1 clock ratio means the interpreter budget is roughly 13 host cycles
per guest cycle *per emulated core* — tight but not absurd for a
block-cached interpreter with the guest register file pinned in host
registers (§6.3), and the second P-core carries the second ARM11 plus the
audio/ARM9 load. On A17 Pro and later the ratio improves further. **These
targets are commitments for the floor device, not aspirations for the
newest one:** if a title holds 60 fps on an iPhone 17 Pro but not on an
iPhone 15, it has not met the bar.

Two engineering consequences follow directly:
- **Thermals are part of the target, not a footnote.** "Fast" means fast
  in minute 45, not minute 2. Sustained-load throttle testing on the
  physical floor device is a standing part of the perf workflow (§12), and
  efficiency work (fewer cycles per guest instruction) is preferred over
  boost-dependent throughput.
- **ProMotion is a bonus, not a dependency.** All three systems are ~60 Hz
  natively; the baseline iPhone 15 has a 60 Hz display. Frame pacing must
  be clean at 60 Hz first; 120 Hz devices get smoother fast-forward and
  lower input latency as a free upgrade, never as a requirement.

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
  - 3DS: **the constrained case, by deliberate design.** Rather than
    accepting key material (`boot9.bin`/`boot11.bin`, `aes_keys.txt`) and
    decrypting retail content the way desktop 3DS emulators do, the app
    accepts **only already-decrypted dumps** the user produced on their own
    console, and handles no key material at all where the core can be made
    to run without it. See §2.1 for why this is a hard constraint rather
    than a preference: it sidesteps the exact DMCA §1201 theory Nintendo
    used against Yuzu. The cost is real setup friction for users, and the
    UI needs to set that expectation clearly; the benefit is removing the
    project's principal legal exposure. Where the chosen core has key
    handling built in, **strip it** rather than leaving it dormant.
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
### 2.1 What actually happened to Citra, and what it does and doesn't mean

Getting this right matters, because the popular summary ("Nintendo killed
Citra, so 3DS emulation is legally radioactive") is wrong in a way that
leads to bad design decisions.

**The facts.** In February 2024 Nintendo sued **Yuzu**, the Switch
emulator, in the District of Rhode Island. Tropic Haze LLC settled roughly
a week later for **$2.4 million** and agreed to stop work on anything
infringing Nintendo's copyrights. **Citra was made by the same team, was
never named in the court filings, and was taken down as collateral of that
settlement.** Nintendo has never litigated against 3DS emulation on its
own merits. Community continuations (Lime3DS, Azahar) and the independent
Panda3DS project carried on afterward.

**Nintendo's actual legal theory** was not "emulators are illegal." It was
that Yuzu required cryptographic keys extracted from a real console in
order to decrypt retail games — i.e. a **DMCA §1201 anti-circumvention**
claim, plus the argument that there was "no lawful way to use Yuzu." The
settlement produced no precedent, but the theory tells us exactly where
the danger is.

**What protects emulation.** *Sony v. Connectix* (9th Cir. 2000) and
*Sony v. Bleem* establish that reverse-engineering a console to build an
emulator is fair use. Emulators themselves are lawful on real, settled
precedent. That is a stronger foundation than any argument from the
console being discontinued.

**What does *not* protect it — do not build on this.** Discontinuation of
hardware confers no rights. There is no "abandonware" doctrine in US
copyright law; corporate works are protected for ~95 years. The 3DS being
discontinued in 2020 and the eShop closing in March 2023 have **zero**
legal effect on the copyright status of its firmware, keys, or games. The
narrow DMCA §1201 exemptions the Copyright Office grants for preservation
of obsolete software are limited to libraries, archives, and museums and
do not cover a general-distribution consumer app. Discontinuation is
relevant to Nintendo's *enforcement appetite* and to public optics — real
factors, but not a legal shield, and the plan must not treat them as one.

**Therefore, the load-bearing design decision (see §6.3, §7):** the app
must never contain, derive, extract, or assist in extracting console keys,
and must never decrypt encrypted retail content. **Accept only
already-decrypted dumps that the user produced themselves on hardware they
own.** This costs some setup friction for users and removes the single
legal theory Nintendo has actually prevailed on. Treat it as a hard
architectural constraint, not a preference.

Also worth avoiding, as they shaped the Yuzu outcome and the optics around
it: paid early access or Patreon-gated builds, any association with
pre-release/leaked titles, and housing multiple current-generation
emulation projects under one legal entity.

**This document is engineering planning, not legal advice.** Before any
public 3DS release, get the key-handling and decryption design reviewed by
a lawyer with DMCA §1201 experience.
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
  - **Citra** (taken offline March 2024 as collateral of the Yuzu
    settlement, not by any action against Citra itself — §2.1) — the
    original reference implementation; still valuable to study even though
    the upstream project is inactive.
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
| 3DS | Adapt existing core + **write an original no-JIT ARM11 backend** | Panda3DS preferred (see §6.3); Lime3DS/Azahar as fallback | Panda3DS's own license or GPL variant (verify at selection time) | Committed. The core adaptation is well-understood; the **CPU backend is original work** (§6.4) and is the project's hardest problem and its moat |

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

### 6.3 3DS — the hard problem, and the reason the project is worth doing

This is the part of the plan with the least prior art to lean on, which is
exactly why succeeding at it is worth something. Treat the CPU backend as
original engineering work, not as a port.

- **CPU:** dual-core ARM11 (MPCore, ~268 MHz) application cores plus an
  ARM9 for legacy/DS-compatibility paths. Every mature 3DS emulator leans
  on a JIT (Citra and its forks use `dynarmic`) to reach playable speed,
  and their interpreter fallbacks are documented as far too slow for
  commercial titles. No adequately fast no-JIT ARM11 interpreter is known
  to exist today.
  **The key insight is that this is not because the problem was attempted
  and failed — it's because nobody needed to attempt it.** Every existing
  3DS emulator targets desktop x86, where a JIT is freely available and
  therefore the obvious answer; the interpreter paths in those projects are
  correctness fallbacks that nobody spent optimization effort on. Emulating
  ARM11 on Apple's ARM64 is a structurally different and much more
  favorable problem than emulating ARM11 on x86, and that advantage is
  essentially unexploited:
  1. **Guest register file pinned in host registers.** ARM64 has 31
     general-purpose registers; the ARM11 guest needs ~16 plus CPSR. The
     entire guest register file can live permanently in host registers
     across the interpreter's dispatch loop — no memory round-trip per
     guest instruction. An x86-targeted interpreter structurally cannot do
     this, which is a large part of why interpreters have historically been
     considered hopeless for this class of workload.
  2. **Near-1:1 instruction and flag semantics.** ARM64 and ARM11 share
     condition-code semantics and much arithmetic behavior, so many guest
     instructions collapse to a small handful of host instructions —
     including the NZCV flag handling that is normally the single most
     expensive part of emulating ARM on a non-ARM host.
  3. **Block-cached threaded dispatch.** Decode each basic block once,
     cache the resulting micro-op/handler-pointer sequence, and re-execute
     the cached form — this removes decode cost, which typically dominates
     naive interpretation, without generating any machine code at runtime
     (so it needs no entitlement and is fully App Store legal).
  4. **NEON for the vectorizable paths** (the PICA200 vertex pipeline where
     it runs CPU-side, audio mixing, memory fills/copies).
  Combined, these are the difference between "an interpreter is obviously
  too slow" (true on x86) and "an interpreter is a real engineering
  question" (the actual situation on Apple silicon). §6.4 describes how to
  hedge this bet architecturally so that the answer never blocks shipping.
- **Selecting the upstream core:** prefer **Panda3DS** as the starting
  point over the Citra-lineage forks, specifically because it is a
  from-scratch, more modern codebase with a cleaner separation around the
  CPU backend, whereas Citra-derived code is built with the assumption that
  `dynarmic` is present. Verify current license terms at selection time
  (§2). Keep Lime3DS/Azahar as a fallback if Panda3DS's commercial-title
  compatibility proves too far behind.
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
- **Content handling — decrypted-only, no key material (§2, §2.1):** this
  is an architectural constraint on the core, not just a UI policy. The
  chosen upstream core will almost certainly ship key-loading and
  content-decryption paths (Citra-lineage cores certainly do); **remove
  them** rather than leaving them present-but-unused, and make "runs
  without any key material" an explicit acceptance criterion of the Phase 3
  integration. Where a core genuinely cannot boot without `boot9`-derived
  state, treat that as a design problem to solve in the core, not as a
  reason to accept keys. UI copy must set the setup-friction expectation
  honestly up front, since this is a meaningfully higher bar than
  importing a GBA or NDS BIOS.

### 6.4 The CPU backend must be swappable — this is the whole strategy

The single most important architectural decision in this plan: **every
core's CPU emulation sits behind an internal backend interface with at
least two implementations** — a JIT-less interpreter and (where one exists
upstream) a JIT — selected at build time.

Why this matters more than it sounds:

- **It decouples "ship first" from "run fast."** The App Store build uses
  the interpreter backend and is fully compliant with Apple's rules. A
  sideloaded / EU-alternative-marketplace / TestFlight-with-debugger build
  can enable the JIT backend and run at full speed today, with no separate
  codebase. Being first on the App Store and being fastest are then two
  build configurations of one project rather than a choice between them.
- **There is direct precedent for exactly this split.** UTM ships two
  products from one lineage: UTM SE on the App Store using a *threaded
  interpreter* precisely because JIT is unavailable there, and full UTM
  with JIT distributed outside the App Store. The pattern is proven, both
  technically and with respect to App Store review.
- **It de-risks the §6.3 bet without abandoning it.** If the no-JIT ARM11
  interpreter reaches, say, 70% of real-time on the target device rather
  than 100%, that is a shipping product on the sideload channel *and* a
  known, quantified gap to keep optimizing for the App Store build —
  instead of a binary project-killing result. The work is never wasted and
  the release train never blocks on the hardest research question.
- **It benefits GBA and NDS too**, at near-zero extra cost: the same
  interface lets the NDS core use melonDS's JIT on non-App-Store builds
  while the App Store build runs the interpreter path from §6.2.

Concretely: `Cores/Shared/include/cpu_backend.h` defines the interface
(reset, run-N-cycles, register access, memory-bus callbacks, state
serialize/restore); each core provides `cpu_interp.cpp` and, where
applicable, `cpu_jit.cpp`; a build flag selects one. **Save states must
serialize architectural state only** — never backend-internal caches — so
a state saved on the App Store build loads on the sideloaded build and vice
versa. Establish this interface in Phase 0, before any core integration
work; retrofitting it later means touching every core.

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
- **Minimum supported devices: iPhone 15 / A16 Bionic, one floor for the
  whole app (decided — §1.1).** One floor rather than per-system floors is
  deliberate: it keeps the product story simple ("works great on iPhone 15
  and up," no per-system asterisks), and the systems that could have
  supported older hardware (GBA, NDS) lose nothing by having headroom.
  A physical iPhone 15 — the floor device, deliberately not a Pro — is the
  reference benchmark unit; every performance number quoted in this
  project's docs and ADRs is a measurement on that device unless labeled
  otherwise.

## 9. Repository / project structure

```
/retro-emulator-ios
  PLAN.md                     (this document)
  README.md
  Cores/
    GBA/                      C core, adapted from mGBA (MPL-2.0)
    NDS/                      C++ core, adapted from melonDS (GPLv3)
    ThreeDS/                  C++ core, Panda3DS-derived (§6.3), plus the
                               original no-JIT ARM11 backend — the long pole
    Shared/include/core_api.h    Shared C ABI (§5.1) all three cores implement
    Shared/include/cpu_backend.h Swappable interpreter/JIT CPU interface (§6.4)
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
3. **3DS — the one that decides the shape of the product.** Before
   committing to a full core integration, build a minimal ARM11
   interpreter spike exercising the §6.3 techniques (pinned guest register
   file, block-cached dispatch, native flag mapping) against a homebrew
   test binary, and measure achievable throughput **on a physical
   iPhone 15 — the floor device (§1.1)** — against the per-frame
   instruction budget a representative commercial title needs at 60 fps.
   The §1.1 clock math says the budget is ~13 host cycles per guest cycle
   per emulated ARM11 core on that device; the spike's job is to find out
   how many the techniques above actually cost.

   This is **not** a go/no-go on whether to build 3DS support — that's
   settled. It answers *which product ships where*, and it has three
   possible outcomes, all of them shippable thanks to §6.4:
   - **At or above real-time:** 3DS ships in the App Store build. This is
     the outright goal, and nobody has done it.
   - **Meaningfully below real-time but playable** (roughly ≥60-70%): ship
     3DS on the sideload/EU-marketplace channel with the JIT backend
     immediately, keep the interpreter backend improving toward an App
     Store release, and be transparent in the UI about which build does
     what.
   - **Far below real-time:** 3DS ships JIT-only outside the App Store
     while interpreter work continues as an ongoing research track; GBA and
     NDS carry the App Store listing in the meantime.

   Run this spike **early and in parallel** with GBA/NDS work (§15), not
   after — the answer determines release sequencing, and it's the number
   the whole project's ambition rests on. Do the CPU spike before the
   PICA200/Metal work regardless, since GPU effort is only meaningful once
   the CPU throughput picture is known.

## 11. Phased roadmap

**Phase 0 — Foundations and spikes (no shippable artifact)**
- Stand up the shared core ABI (§5.1) and the swappable CPU backend
  interface (§6.4) — both must exist before any core integration, since
  retrofitting either means touching all three cores.
- Run the GBA sanity check and NDS feasibility gate (§10.1-2).
- Run the **3DS ARM11 interpreter spike** (§10.3) — the phase's most
  important deliverable. Its output is a measured throughput number and a
  release-sequencing decision (which channel 3DS ships on first), recorded
  as an ADR.
- Exit criteria: shared ABI + CPU backend interface defined; GBA and NDS
  interpreter paths validated at real-time-equivalent speed on target
  hardware; 3DS throughput measured and release sequencing decided.

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

**Phase 3 — 3DS core bring-up** (starts in parallel with Phases 1-2, not
after — it has the longest lead time and shares no critical-path resources
with the GBA/NDS shell work once §6.4's interface exists)
- Integrate the chosen 3DS core (§6.3) behind the shared ABI, with both
  CPU backends wired per §6.4.
- Build out the optimized no-JIT ARM11 interpreter from the Phase 0 spike
  into a production backend; this is the project's long pole and should be
  resourced accordingly.
- PICA200 shader-to-Metal translation; circle-pad/second-screen UI.
- Exit criteria: a commercial 3DS title runs at full speed on a physical
  iPhone 15 on at least one distribution channel (§1.1), with the
  interpreter-backend throughput gap (if any) quantified and tracked.

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
- **Device matrix:** the floor is one device class for the whole app —
  iPhone 15 / A16 (§1.1) — so the matrix is small: the physical floor
  device (where every performance commitment is measured, including
  sustained-load thermal runs of 45+ minutes, not just fresh-device
  benchmarks), one current-generation device, and one iPad. Do not let
  benchmarking drift to whatever newest phone is on the desk — a number
  measured on a Pro-class device is not a result, it's an anecdote.
- Never commit copyrighted ROM/BIOS/firmware/key files to the repository or
  CI fixtures for any system — public-domain/homebrew test ROMs only in
  the repo itself; keep any internal commercial-game testing corpus outside
  version control.

## 13. Risks and mitigations

| Risk | System | Impact | Mitigation |
|---|---|---|---|
| No-JIT ARM11 interpreter may not reach real-time | 3DS | High — but no longer project-critical | §6.4's swappable backend means a shortfall changes *which channel ships first*, not whether the product exists; §10.3 quantifies the gap early so it's a tracked number, not a surprise |
| PICA200 shader-to-Metal translation complexity | 3DS | High | Sequence after the CPU throughput spike; budget as its own substantial workstream, not a rendering afterthought |
| DMCA §1201 anti-circumvention exposure — the theory Nintendo actually used against Yuzu | 3DS | **Highest legal risk, and the most controllable** | Decrypted-dumps-only, zero key handling, strip decryption paths from the upstream core (§2.1, §6.3); lawyer review of the content-handling design before any public 3DS release |
| Nintendo enforcement appetite generally (Yuzu suit 2024; Citra taken down as collateral) | 3DS | Medium, business/legal | Emulation itself rests on solid precedent (*Connectix*, *Bleem* — §2.1); avoid the aggravating factors from the Yuzu case: no paid early access, no leaked-title association, don't house multiple current-gen emulators under one entity; keep 3DS distributable outside the App Store (§6.4) |
| Assuming discontinued hardware confers legal rights | 3DS | Medium — a planning risk, not a legal one | §2.1 states plainly that it does not; no abandonware doctrine exists. Ensure nobody on the team builds decisions on this premise |
| No App Store precedent for 3DS emulators | 3DS | Medium risk / **the opportunity** | Being first is the goal (§1). Follow Guideline 4.7 precisely, submit GBA+NDS first to establish a review track record, and have the sideload/EU channel ready so review timing never blocks the product |
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

1. Stand up the shared core ABI (§5.1), the **swappable CPU backend
   interface (§6.4)**, and the repo layout (§9). Both interfaces come
   first — everything else is built on top of them.
2. Adapt mGBA behind it (lowest risk) — get *a* GBA homebrew ROM booting
   headless on macOS as the project's smallest possible "hello world."
3. Run the NDS feasibility gate (§10.2) on real iPhone hardware.
4. Start the **3DS ARM11 interpreter spike (§10.3) immediately and in
   parallel** with 1-3. This is the number the entire ambition rests on,
   nobody else has measured it, and it determines release sequencing —
   get the answer early rather than discovering it after GBA/NDS ship.
   Even a rough measurement in week one is worth more than a precise one
   in month six.
5. Write the combined licensing ADR (§2, §13) before any Phase 5/store-
   readiness work, so it isn't a late surprise.
