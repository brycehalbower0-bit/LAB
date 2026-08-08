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
CACHE="$(cd "$(dirname "$0")" && pwd)/cpp/3ds/no-jit-headless.cmake"

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
find "$BUILD" -name "*.a" -exec cp {} "$OUT/" \;
echo "3ds: staged $(ls "$OUT" | wc -l | tr -d ' ') static libs in $OUT"
