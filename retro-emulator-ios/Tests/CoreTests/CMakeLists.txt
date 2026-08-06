add_library(null_core STATIC null_core.c)
target_include_directories(null_core PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/../../Cores/Shared/include)
set_target_properties(null_core PROPERTIES C_STANDARD 99 C_STANDARD_REQUIRED ON)

add_executable(core_api_tests test_core_api.cpp)
target_link_libraries(core_api_tests PRIVATE null_core)

add_test(NAME core_api_contract COMMAND core_api_tests)

add_executable(gba_core_tests test_gba_core.cpp)
target_link_libraries(gba_core_tests PRIVATE gba_core)

add_test(NAME gba_core_contract COMMAND gba_core_tests)

add_executable(nds_core_tests test_nds_core.cpp)
target_link_libraries(nds_core_tests PRIVATE nds_core)

add_test(NAME nds_core_contract COMMAND nds_core_tests)
