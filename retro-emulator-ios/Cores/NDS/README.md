# NDS core

`nds_core.cpp` implements the shared ABI (`Cores/Shared/include/core_api.h`)
over melonDS 1.1's class-based embedding API; `nds_platform.cpp` is the
minimal `Platform::` implementation melonDS requires of embedders (stdio
files, std::thread primitives, inert networking/camera/mic — all v1
non-goals).

Key construction decisions:
- `NDSArgs.JIT = std::nullopt` **and** `ENABLE_JIT=OFF` at build time —
  interpreter only, zero runtime code generation (ADR 0001-D3).
- Default FreeBIOS + generated firmware: no user BIOS/firmware files and
  no key material (ADR 0001-D5). DSi mode is out of scope.
- `OutputSampleRate = 32768` — melonDS's SPU resamples internally; the
  shell's audio path consumes it like every other core.

## Vendored melonDS snapshot

`melonds/` is a snapshot of **melonDS 1.1** (tag `1.1`,
https://github.com/melonDS-emu/melonDS, GPLv3), vendored as a plain
copy — same rationale as `Cores/GBA/mgba` (hermetic builds, visible
patches). Pruned: `src/frontend/`, `res/`, `tools/`, `flatpak/`,
`src/ARMJIT_A64/`, `src/ARMJIT_x64/`, packaging metadata. No source file
modified. `LICENSE` retained.

GPLv3 note (ADR 0001-D2): melonDS makes the combined work's
source-offer obligations GPL-driven; the unified compliance pass
(source offer + notices screen) is committed before any store
submission.

To upgrade: clone the new tag, apply the same prune list, replace
wholesale, update versions here and in `nds_core.cpp`'s `describe()`,
re-run `npm run sync-emu-core` from `App/`.
