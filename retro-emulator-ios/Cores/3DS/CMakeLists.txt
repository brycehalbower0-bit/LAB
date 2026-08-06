# 3DS core: headless no-JIT configure of the vendored Azahar snapshot
# (Phase 3a). Standalone project on purpose — iterated by the
# experimental CI job without gating the GBA/NDS foundations build.
#
# Flag rationale:
#   ENABLE_DYNARMIC OFF   — zero runtime codegen (ADR 0001-D3); dyncom
#                           is the interpreter until the production
#                           backend from ADR 0002's spike lands.
#   ENABLE_BUILTIN_KEYBLOB OFF — no key material, hard constraint
#                           (PLAN §2.1, ADR 0001-D5). More stripping
#                           follows; this is the build-system part.
#   GL/Vulkan OFF         — software rasterizer is the correctness
#                           reference until Phase 3d.
#   Everything frontend/network/audio-backend: OFF — the shell owns it.

cmake_minimum_required(VERSION 3.22)
project(retro_emulator_3ds C CXX)

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

add_subdirectory(azahar EXCLUDE_FROM_ALL)
