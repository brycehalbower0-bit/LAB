#!/bin/bash
# Builds the vendored Azahar 3DS core as static libraries for iOS.
#
# Why a script instead of the podspec's source glob (which carries GBA
# and NDS): 1369 compiled sources across targets with *different*
# define sets, plus CMake-generated files (scm_rev.cpp, version.h). A
# single glob can't express that; CMake already does.
#
# Flags mirror Cores/3DS/no-jit-headless.cmake (one definition shared
# with CI) plus the iOS toolchain flags upstream's own libretro CI
# proves: src/citra_libretro is released for ios-arm64.
#
# Usage: build-3ds.sh <source-dir> <build-dir> <output-lib-dir>
set -euo pipefail

SRC="${1:?source dir}"
BUILD="${2:?build dir}"
OUT="${3:?output dir}"
# no-jit-ios.cmake = the CI cache plus -O3 and thin LTO (see the file
# for why CI and device diverge).
CACHE="$(cd "$(dirname "$0")" && pwd)/cpp/3ds/no-jit-ios.cmake"

GENERATOR=""
command -v ninja >/dev/null && GENERATOR="Ninja"

if ! command -v cmake >/dev/null; then
  echo "error: cmake not found (EAS images ship it; install locally with brew)" >&2
  exit 1
fi

# Device-only arm64. The simulator would need a second slice; the
# development profile targets a physical device (eas.json).
cmake -S "$SRC" -B "$BUILD" -C "$CACHE" \
  -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DEMU_SHARED_ABI_ADAPTER=ON \
  -DIOS=ON \
  -DCMAKE_SYSTEM_NAME=iOS \
  -DCMAKE_OSX_ARCHITECTURES=arm64 \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=15.1 \
  -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
  -DCITRA_USE_PRECOMPILED_HEADERS=OFF \
  -DENABLE_OPT=OFF \
  -DCMAKE_C_FLAGS=-DIOS \
  -DCMAKE_CXX_FLAGS=-DIOS

cmake --build "$BUILD" --target c3ds_core --parallel

# Collect every static lib the link needs. Names come from CI's own
# build (see ADR 0006); a missing one shows up as an undefined symbol
# at app link, not silently.
mkdir -p "$OUT"
rm -f "$OUT"/*.a
find "$BUILD" -name "*.a" -exec cp {} "$OUT/" \;

# Combine every dependency into ONE archive so the app's link line
# doesn't have to enumerate library names. Enumerating them by hand
# already missed the C libraries (zstd, faad2) once; the set also
# changes with build flags. c3ds_core stays separate because it needs
# -force_load (nothing references emu_3ds_api until Swift asks).
cd "$OUT"
mv libc3ds_core.a c3ds_core.keep
libtool -static -o libazahar_deps.a *.a 2>/dev/null
rm -f $(ls *.a | grep -v '^libazahar_deps.a$')
mv c3ds_core.keep libc3ds_core.a
echo "3ds: staged libc3ds_core.a + libazahar_deps.a ($(du -h libazahar_deps.a | cut -f1))"
