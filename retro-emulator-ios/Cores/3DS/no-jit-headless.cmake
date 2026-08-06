# Initial-cache file (cmake -C) for the headless no-JIT configure of the
# vendored Azahar snapshot. Azahar stays the ROOT project — its CMake
# uses CMAKE_SOURCE_DIR in ~37 places, so wrapping it in a parent
# project breaks path resolution (learned from the cryptopp-cmake
# "sources does not exist" failure).
#
#   cmake -S Cores/3DS/azahar -B <build> -C Cores/3DS/no-jit-headless.cmake
#
# Flag rationale:
#   ENABLE_DYNARMIC OFF        — zero runtime codegen (ADR 0001-D3);
#                                dyncom is the interpreter until the
#                                production backend (ADR 0002) lands.
#   ENABLE_BUILTIN_KEYBLOB OFF — no key material (PLAN §2.1, D5).
#   GL/Vulkan OFF              — software rasterizer is the correctness
#                                reference until Phase 3d.
#   Frontends/network/audio-backends OFF — the shell owns those.

set(ENABLE_DYNARMIC OFF CACHE BOOL "" FORCE)
set(ENABLE_QT OFF CACHE BOOL "" FORCE)
set(ENABLE_SDL2 OFF CACHE BOOL "" FORCE)
set(ENABLE_TESTS OFF CACHE BOOL "" FORCE)
set(ENABLE_WEB_SERVICE OFF CACHE BOOL "" FORCE)
set(ENABLE_SCRIPTING OFF CACHE BOOL "" FORCE)
set(ENABLE_CUBEB OFF CACHE BOOL "" FORCE)
set(ENABLE_OPENAL OFF CACHE BOOL "" FORCE)
set(ENABLE_LIBUSB OFF CACHE BOOL "" FORCE)
set(ENABLE_OPENGL OFF CACHE BOOL "" FORCE)
set(ENABLE_VULKAN OFF CACHE BOOL "" FORCE)
set(ENABLE_ROOM OFF CACHE BOOL "" FORCE)
set(ENABLE_ROOM_STANDALONE OFF CACHE BOOL "" FORCE)
set(ENABLE_BUILTIN_KEYBLOB OFF CACHE BOOL "" FORCE)
set(USE_DISCORD_PRESENCE OFF CACHE BOOL "" FORCE)
set(CITRA_USE_PRECOMPILED_HEADERS OFF CACHE BOOL "" FORCE)
set(CITRA_WARNINGS_AS_ERRORS OFF CACHE BOOL "" FORCE)
set(ENABLE_LTO OFF CACHE BOOL "" FORCE)
set(ENABLE_SHADER_JIT OFF CACHE BOOL "" FORCE)
