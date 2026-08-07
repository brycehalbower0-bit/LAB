# 3DS core

Core selection: **Azahar** (Citra lineage) — see ADR 0005 for the
decision record superseding §6.3's provisional Panda3DS preference
(no interpreter exists there; Azahar ships dyncom + dynarmic behind
`ARM_Interface`, exactly §6.4's shape).

## Vendored snapshot

`azahar/` is a snapshot of **Azahar 2125.1.3** (tag `2125.1.3`,
https://github.com/azahar-emu/azahar, GPL-2.0), vendored as a plain
copy. 18 `externals/` submodule trees are fetched at the tag's exact
gitlink pins and pruned of tests/docs; deliberately excluded:
dynarmic/oaknut/xbyak (JIT — D3), Qt/SDL/discord/openal/cubeb, web
stack, GL/Vulkan stacks (Phase 3d), catch2, libadrenotools.

### Local patches (visible, greppable: "retro-emulator-ios patch")

1. `ENABLE_DYNARMIC` CMake option (root CMakeLists, externals/
   CMakeLists, src/core/CMakeLists, src/core/core.cpp,
   src/core/arm/exclusive_monitor.cpp): dynarmic fully excluded from
   no-JIT builds — sources uncompiled, submodule unreferenced,
   instantiation sites behind `CITRA_ENABLE_DYNARMIC`. Runtime falls
   back to dyncom exactly as upstream's own non-x86/arm64 branch does.

`Cores/3DS/CMakeLists.txt` is a standalone headless configure of the
snapshot (dyncom, software renderer, no keyblob) driven by the
**non-gating** `core-3ds-experimental` CI job while bring-up iterates.

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

## iOS build route (Phase 3b) — scoped, not yet built

Numbers that decide the approach: **1369 compiled sources** (521 core +
848 externals) versus 188 for GBA+NDS combined, plus CMake-generated
files (`scm_rev.cpp` from `scm_rev.cpp.in`, `version.h`) and per-target
define sets that differ between `citra_common`, `citra_core`, and
`video_core`.

The podspec-glob pattern that carried mGBA and melonDS does not scale
here: a single glob can't express per-target defines, and generating
`scm_rev.cpp` by hand duplicates upstream's git-derived logic. Route to
take instead:

**`prepare_command` in the podspec runs CMake** (the same
`no-jit-headless.cmake` cache file CI uses, plus the iOS toolchain flags
upstream's `libretro.yml` proves work: `-DIOS=ON
-DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_ARCHITECTURES=arm64
-DCITRA_USE_PRECOMPILED_HEADERS=OFF -DENABLE_OPT=OFF`), producing static
libs the pod then links via `vendored_libraries`. Keeps one build
definition for CI and device, and keeps the CI compile-manifest job
meaningful.

Open question for that slice: EAS build-machine time. 1369 sources at
`-O2` is minutes of compile on every build, and the pod's
`prepare_command` runs before the Xcode build proper.

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
