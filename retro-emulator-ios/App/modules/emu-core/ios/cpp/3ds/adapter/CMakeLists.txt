# Shared-ABI adapter + contract test for the 3DS core. Included from
# the azahar root CMakeLists (patched: EMU_SHARED_ABI_ADAPTER) so it
# builds inside azahar's project — azahar must stay the root project
# (its CMake resolves CMAKE_SOURCE_DIR in ~37 places).

add_library(c3ds_core STATIC c3ds_core.cpp)
target_include_directories(c3ds_core
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/../../Shared/include
    PRIVATE ${CMAKE_SOURCE_DIR}/src)
target_link_libraries(c3ds_core PRIVATE citra_core citra_common video_core audio_core)
# settings.h requires at least one renderer define; match the headless
# configure (software renderer only).
target_compile_definitions(c3ds_core PRIVATE ENABLE_SOFTWARE_RENDERER)
set_target_properties(c3ds_core PROPERTIES CXX_STANDARD 20 CXX_STANDARD_REQUIRED ON)

add_executable(c3ds_core_tests test_c3ds_core.cpp)
target_link_libraries(c3ds_core_tests PRIVATE c3ds_core)
set_target_properties(c3ds_core_tests PROPERTIES CXX_STANDARD 20)
