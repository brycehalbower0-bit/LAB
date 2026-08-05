# GBA core

`gba_core.c` implements the shared ABI (`Cores/Shared/include/core_api.h`)
over mGBA's `mCore` interface. The adapter's call sequences mirror mGBA's
own libretro port — the upstream-maintained reference for "core only, no
platform" embedding.

## Vendored mGBA snapshot

`mgba/` is a snapshot of **mGBA 0.10.5** (tag `0.10.5`,
https://github.com/mgba-emu/mgba, MPL-2.0), vendored as a plain copy —
not a submodule — so EAS/CI builds are hermetic and local patches stay
visible as ordinary diffs (which is also what MPL-2.0's file-level
copyleft wants).

Pruned from the snapshot (not used by the LIBMGBA_ONLY static-library
build this project does): `cinema/`, `doc/`, `res/`, `tools/`, `opt/`,
`src/platform/`, `src/script/`, and the optional third-party bundles
`discord-rpc`, `libpng`, `lzma`, `sqlite3`, `zlib` (kept: `blip_buf`,
`inih`). No source file was modified.

To upgrade: clone the new tag, apply the same prune list, replace the
directory wholesale, update the version in this file and in
`gba_core.c`'s `describe()`, and re-run `npm run sync-emu-core` from
`App/`.

License compliance: mGBA is MPL-2.0; `LICENSE` is retained in the
snapshot. The combined-work notices screen (PLAN.md §2, ADR 0001-D2)
covers distribution obligations before any store submission.
