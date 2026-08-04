# GBA / NDS / 3DS Emulator for iOS

Status: **planning only** — no code yet.

One iOS app targeting three Nintendo handheld systems — Game Boy Advance,
Nintendo DS, and Nintendo 3DS — sharing a single app shell, library, and
controller/UI layer over three separate emulation cores.

This directory is intentionally independent of Project Chronos (the rest of
this repo). It does not share Chronos's package boundaries, roadmap, or
phase gating; it exists here only because this repository is being used as
a general multi-project workspace. Nothing in this directory participates
in `pnpm check`, the Chronos turbo pipeline, or the Chronos roadmap process.

See [PLAN.md](PLAN.md) for the full technical plan.
