# GBA core: vendored mGBA (see README.md) behind the shared ABI.
#
# EXCLUDE_FROM_ALL flips mGBA into LIBMGBA_ONLY mode: frontends and
# optional third-party deps disabled, static library only. That is why
# the snapshot can be pruned to the core sources (README.md lists what
# was removed).

set(M_CORE_GBA ON CACHE BOOL "" FORCE)
set(M_CORE_GB ON CACHE BOOL "" FORCE)
set(USE_DEBUGGERS OFF CACHE BOOL "" FORCE)
add_subdirectory(mgba EXCLUDE_FROM_ALL)

add_library(gba_core STATIC gba_core.c)
target_include_directories(gba_core
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/../Shared/include)
target_link_libraries(gba_core PRIVATE mgba)
set_target_properties(gba_core PROPERTIES C_STANDARD 11)
