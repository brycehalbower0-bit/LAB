# 3DS core

Core selection: **Azahar** (Citra lineage) — see ADR 0005 for the
decision record superseding §6.3's provisional Panda3DS preference
(no interpreter exists there; Azahar ships dyncom + dynarmic behind
`ARM_Interface`, exactly §6.4's shape).

## Vendored snapshot

`azahar/` is a snapshot of **Azahar 2125.1.3** (tag `2125.1.3`,
https://github.com/azahar-emu/azahar, GPL-2.0), vendored as a plain
copy. **Status: base tree only — `externals/` submodule contents are
not yet fetched** (boost, cryptopp, fmt, teakra, nihstro, xxHash, zstd,
soundtouch, faad2 and friends are empty stubs pending the build-graph
pass below).

## Integration route (decided during vendoring, refines ADR 0005)

Upstream ships an **official libretro core built for iOS arm64**
(`azahar-libretro-ios-arm64-*.zip` release asset; source in
`src/citra_libretro`). Consequences:

1. The iOS-compilable subset of the dependency graph is already proven
   by upstream CI — mine their libretro/iOS build (`.github/workflows`,
   `src/citra_libretro/CMakeLists.txt`) for the exact source set,
   flags, and which externals the core truly needs (Qt/SDL/network/
   discord/etc. fall away).
2. Our `c3ds_core.cpp` adapts the **libretro API surface**
   (`retro_load_game/retro_run/...`) or `Core::System` directly —
   whichever the libretro frontend proves is the smaller seam; our
   shared ABI was modeled on the libretro pattern (PLAN §5.1), so the
   mapping is near 1:1.
3. **We do NOT use the prebuilt binary**: it contains dynarmic. The
   App Store build compiles from source with the JIT excluded and
   dyncom selected (ADR 0001-D3), and with key/decryption machinery
   stripped per §2.1 (acceptance criterion: zero key handling compiled
   in; encrypted content answers `EMU_ERR_ENCRYPTED_CONTENT`).

## Next steps (Phase 3a, in order)

1. Fetch the needed `externals/` submodule trees at the tag's pinned
   commits (`git ls-tree` on the tag gives the SHAs; fetch each from
   its upstream repo, prune tests/docs per our usual pattern).
2. Headless CMake target: build the core + citra_libretro statically
   on Linux CI, `ENABLE_QT=OFF`-style flags per upstream's libretro
   build, dynarmic OFF/dyncom ON.
3. Strip crypto (cryptopp key paths) — expect iteration; CI gates.
4. Contract test: boot a license-clean ELF/3DSX, assert execution,
   two screens (400×240 / 320×240), state roundtrip.

To upgrade: replace wholesale at a newer tag, re-run the submodule
fetch, update versions here and in the adapter's `describe()`.
