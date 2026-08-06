# NDS core: vendored melonDS (see README.md) behind the shared ABI.
#
# App Store constraint drives the flags: ENABLE_JIT=OFF (interpreter
# only, ADR 0001-D3). No OpenGL, no GDB stub, no Qt frontend — just the
# `core` static library plus our adapter and Platform implementation.

set(ENABLE_JIT OFF CACHE BOOL "" FORCE)
set(ENABLE_JIT_PROFILING OFF CACHE BOOL "" FORCE)
set(ENABLE_OGLRENDERER OFF CACHE BOOL "" FORCE)
set(ENABLE_GDBSTUB OFF CACHE BOOL "" FORCE)
set(BUILD_QT_SDL OFF CACHE BOOL "" FORCE)
add_subdirectory(melonds EXCLUDE_FROM_ALL)

add_library(nds_core STATIC nds_core.cpp nds_platform.cpp)
target_include_directories(nds_core
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/../Shared/include
    PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/melonds/src)
target_link_libraries(nds_core PRIVATE core)
set_target_properties(nds_core PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
