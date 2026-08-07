# ADR 0006 — Phase 3a: 3DS boots headless, zero code generation

Status: accepted (2026-08-06)

The 3DS core (Azahar, ADR 0005) now boots and runs behind the shared
ABI in a build containing **no runtime code generation of any kind**,
verified by CI:

```
load_rom -> 0
state size: 26470
3ds core contract: all checks passed
no embedded keyblob symbols
```

`Cores/3DS/adapter/test_c3ds_core.cpp` loads a synthetic ARM ELF built
in-test (license-clean), runs frames on the **dyncom interpreter**,
reads both screens at 400×240 / 320×240, feeds buttons + touch +
circle pad, and round-trips a save state — rejecting a corrupted one.

## What "zero code generation" required

Azahar carries **two** codegen paths, not one. Both are now optional
and off (greppable marker: `retro-emulator-ios patch`):

1. **`ENABLE_DYNARMIC`** — the ARM11→host CPU JIT. Off removes its
   sources, its submodule, and its instantiation sites; dyncom takes
   over through upstream's own fallback branch.
2. **`ENABLE_SHADER_JIT`** — the PICA shader-bytecode JIT (xbyak /
   oaknut). Missed on the first pass and caught as a build error; the
   PICA shader *interpreter* remains.

Plus `ENABLE_BUILTIN_KEYBLOB=OFF`, with CI asserting no `default_keys`
symbols survive into the linked binary — PLAN §2.1's "zero key
material" is now a failing test, not a promise (D5).

OpenSSL left the graph entirely on the way (httplib SSL and http:C's
X509/EVP paths behind `CPPHTTPLIB_OPENSSL_SUPPORT`; `RAND_bytes` →
CryptoPP `AutoSeededRandomPool`), which suits v1's offline scope.

## Embedding facts worth keeping

- **`Settings::values.lle_modules` must be populated before `Load`** —
  `Service::AttemptLLE` does `.at(name)` for all 41 service modules on
  an empty map. All `false` = HLE everywhere, which is required anyway
  since LLE needs dumped system titles we don't accept. Found by gdb
  backtrace after `what()` (`"unordered_map::at"`) proved useless;
  installing gdb paid for itself immediately.
- **`FileUtil::SetUserPath` must run first** — `g_paths` starts empty.
  Never guard it with `GetUserPath`, which throws on the empty map.
- **`GIT-COMMIT` / `GIT-TAG` are required in a vendored snapshot.**
  Save states hex-*decode* `g_scm_rev` into the header and hex-*encode*
  it back on load; with no `.git` the revision was `UNKNOWN` and every
  load failed the revision check. Upstream supports these files for
  source-tarball builds.
- **Vendored trees must carry no `.gitignore` files.** 32 upstream ones
  silently excluded real sources from our commits (`*.P*` matched
  `soundtouch.pc.in`; `[Bb]uild*/` matched zstd's entire `build/cmake`
  tree). Ancestor `dist/` and `build/` rules needed scoped negations.
- CI's compile manifest lists *configured* targets, not built ones
  (the `teakra_c` trap): verify against the link, not the manifest.
- `cancel-in-progress` had to go: the ~20-minute 3DS build was being
  discarded by any push landing during it.

## Scope cuts still open (documented in the adapter)

Null audio sink (`read_audio` returns 0); input stored but not yet fed
into HID; `save_data_*` unimplemented (3DS saves are archive-based).
These land with the device slice.

## Next: Phase 3b, and its measured shape

The iOS build is **1369 compiled sources** (521 core + 848 externals)
against 188 for GBA+NDS combined, plus CMake-generated files and
per-target defines. The podspec-glob pattern that carried the first two
cores cannot express that; the route is a podspec `prepare_command`
running CMake with this same cache file plus the iOS flags upstream's
own libretro CI proves (`-DIOS=ON -DCMAKE_SYSTEM_NAME=iOS
-DCMAKE_OSX_ARCHITECTURES=arm64 -DCITRA_USE_PRECOMPILED_HEADERS=OFF`),
linking the resulting static libs. Open risk: EAS build-machine time.

Expectation to set honestly: the first device build will be **slow** —
dyncom is a correctness fallback nobody optimized, and the software
rasterizer is the reference path, not a fast one. That is the baseline
the production ARM11 backend (ADR 0002's spike, slice 3c) exists to
beat, and the gap it must close is the project's headline number.
