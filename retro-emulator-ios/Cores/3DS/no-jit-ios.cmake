# Device build: the CI cache plus speed flags.
#
# The base cache keeps -O2 -g -fno-omit-frame-pointer because CI's gdb
# throw-catchpoint needs readable backtraces. On device those flags cost
# real frame rate, and the interpreter is the product:
#
#   -O3          over -O2: measurable on dyncom's giant dispatch loop.
#   -flto=thin   cross-TU inlining -- Memory::Read/Write into the
#                interpreter loop is the case LTO exists for. Thin, not
#                full, so ld64's final link stays parallel and sane.
#                (Upstream defaults LTO ON for release; the base cache
#                turned it off for CI build time.)
#
# MICROPROFILE_ENABLED=0 lives in the BASE cache, not here: it must
# compile-gate in CI, and its per-triangle/per-block timers are overhead
# everywhere.
#
# Include order matters: later set(... FORCE) wins, so the overrides sit
# below the include.

include(${CMAKE_CURRENT_LIST_DIR}/no-jit-headless.cmake)

set(CMAKE_CXX_FLAGS_RELEASE "-O3 -g -flto=thin -DMICROPROFILE_ENABLED=0" CACHE STRING "" FORCE)
set(CMAKE_C_FLAGS_RELEASE "-O3 -g -flto=thin -DMICROPROFILE_ENABLED=0" CACHE STRING "" FORCE)
