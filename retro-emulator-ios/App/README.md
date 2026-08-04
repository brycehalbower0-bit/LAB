# EmuLab — interim Expo shell

The app shell for retro-emulator-ios, currently built with **Expo/React
Native** so iOS builds run on EAS's cloud Macs — no local Xcode required.
The emulation cores are and remain native C/C++ behind the shared ABI
(`Cores/Shared/include/core_api.h`); the shell language is swappable by
design, and per ADR 0001-D7 the JS layer never sits on the frame or audio
hot path. What's native vs JS:

- **Native (Expo Modules, C++/Swift):** emulation cores, benchmark spike,
  and later the Metal render view, audio engine, and touch-overlay input
  fast path.
- **JS/RN:** library UI, settings, navigation, on-screen layout editing.

## What the app does today

One screen: runs the PLAN.md §10.3 **ARM11 interpreter spike** on-device
and reports guest MIPS per backend against the 268-MIPS 1:1 bar, plus the
dual-core interleave sweep. Run it on a **physical iPhone 15 (non-Pro)**
and the screen will tell you the numbers are binding; on anything else
they're directional. Share/export gives raw JSON for the ADR.

## Getting it onto a phone (no Mac needed)

One-time setup:

```bash
cd retro-emulator-ios/App
npm install
npx eas-cli login                # Expo account (free tier is fine)
npx eas-cli device:create        # register your iPhone's UDID (ad-hoc)
```

Build and install (EAS free tier queues can take a while):

```bash
npx eas-cli build --profile development --platform ios
# when it finishes, open the build URL on the phone and install
```

Requires an Apple Developer account for code signing — EAS walks through
credentials setup on first build. Then:

```bash
npx expo start   # dev server; open the installed dev client, run benchmark
```

The benchmark itself needs no dev server — it's compiled into the binary
(`modules/spike-bench`), so a `preview` build also works standalone.

## Repo mechanics

- `modules/spike-bench/` — local Expo native module wrapping the spike.
  The C++ under `modules/spike-bench/ios/cpp/` is a **vendored copy** of
  `../Spikes/arm11-interp` (EAS uploads only this app directory, and
  CocoaPods can't reference sources outside the pod). Canonical sources
  live in `Spikes/`; after editing them run `npm run sync-spike`.
- The pod builds the spike at `-O3` in every configuration — a `-O0`
  interpreter benchmark measures nothing.
- `npm run typecheck` — TypeScript check, runs on Linux CI fine.
