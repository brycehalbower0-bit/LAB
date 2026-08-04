# GBA / NDS / 3DS Emulator for iOS

Status: **planning only** — no code yet.

One iOS app targeting three Nintendo handheld systems — Game Boy Advance,
Nintendo DS, and Nintendo 3DS — sharing a single app shell, library, and
controller/UI layer over three separate emulation cores.

The goal is to be the **first 3DS emulator on the App Store**. The obstacle
is specific and solvable: Apple doesn't grant JIT entitlements, and every
existing 3DS emulator depends on a JIT — not because a fast interpreter was
attempted and failed, but because they all target desktop x86, where a JIT
is simply the obvious answer. Emulating ARM11 on Apple silicon is a
materially better-shaped problem than emulating it on x86, and the plan is
built around exploiting that advantage.

**Device floor:** iPhone 15 (A16) and newer. On that floor the bar is
locked native frame rate with headroom, sustained under thermal load —
"more than reasonable speed" on the floor device, not just on the newest
Pro. See PLAN.md §1.1 for the per-system performance targets.

This directory is intentionally independent of Project Chronos (the rest of
this repo). It does not share Chronos's package boundaries, roadmap, or
phase gating; it exists here only because this repository is being used as
a general multi-project workspace. Nothing in this directory participates
in `pnpm check`, the Chronos turbo pipeline, or the Chronos roadmap process.

See [PLAN.md](PLAN.md) for the full technical plan.
