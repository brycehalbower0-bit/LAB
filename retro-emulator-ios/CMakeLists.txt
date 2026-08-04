# Headless build of everything that runs off-Apple-hardware: the shared-ABI
# contract tests and the Phase 0 spikes. The iOS app itself is an Xcode
# project (App/) and is not built from here.
cmake_minimum_required(VERSION 3.16)
project(retro_emulator_foundations C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

enable_testing()
add_subdirectory(Spikes/arm11-interp)
add_subdirectory(Tests/CoreTests)
