Pod::Spec.new do |s|
  s.name           = 'EmuCore'
  s.version        = '0.1.0'
  s.summary        = 'Emulation core host: shared-ABI cores, emulation thread, Metal surface, audio'
  s.description    = 'Hosts cores implementing Cores/Shared/include/core_api.h behind an Expo module: emulation thread with CADisplayLink pacing, MTKView video surface, AVAudioEngine audio pull. JS never sits on the frame or audio hot path (PLAN.md ADR 0001-D7).'
  s.author         = 'retro-emulator-ios'
  s.homepage       = 'https://github.com/brycehalbower0-bit/LAB'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Metal', 'MetalKit', 'AVFoundation', 'QuartzCore'

  # O3 in every configuration: dev-client builds are Debug, and cores at
  # -O0 are unusably slow (same rule as SpikeBench.podspec).
  # The mGBA include paths and defines mirror the Linux CI compile
  # manifest (the workflow's "Dump mGBA compile manifest" step is ground
  # truth); all HAVE_* functions exist on Darwin. They live in
  # OTHER_CFLAGS — NOT HEADER_SEARCH_PATHS / GCC_PREPROCESSOR_DEFINITIONS
  # — because those leak into the clang-module build for the pod's Swift
  # side, and mGBA's tree in the module search path breaks the Darwin
  # system modules (cyclic _DarwinFoundation errors). OTHER_CFLAGS only
  # reaches C-family compilation of the sources themselves.
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'GCC_C_LANGUAGE_STANDARD' => 'c11',
    'GCC_OPTIMIZATION_LEVEL' => '3',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/cpp/include"',
    'OTHER_CFLAGS' => '$(inherited) -I"$(PODS_TARGET_SRCROOT)/cpp/gba/mgba/include" -I"$(PODS_TARGET_SRCROOT)/cpp/gba/mgba/src" -I"$(PODS_TARGET_SRCROOT)/cpp/nds/melonds/src" -I"$(PODS_TARGET_SRCROOT)/cpp/nds/melonds/src/teakra/include" -DBUILD_STATIC -DM_CORE_GBA -DM_CORE_GB -DNDEBUG -DUSE_PTHREADS -DHAVE_FREELOCALE -DHAVE_FUTIMENS -DHAVE_FUTIMES -DHAVE_LOCALE -DHAVE_LOCALTIME_R -DHAVE_NEWLOCALE -DHAVE_PTHREAD_CREATE -DHAVE_PTHREAD_SETNAME_NP -DHAVE_SETLOCALE -DHAVE_STRDUP -DHAVE_STRLCPY -DHAVE_STRNDUP -DHAVE_USELOCALE -DHAVE_VASPRINTF',
    # C++ compiles (melonDS/adapter) need the same include/define flags.
    # The trailing -std wins over the project-wide c++20 Expo forces:
    # melonDS targets C++17 (path::u8string() returns char8_t strings
    # under c++20, breaking FATStorage).
    'OTHER_CPLUSPLUSFLAGS' => '$(inherited) $(OTHER_CFLAGS) -std=gnu++17',
    'LIBRARY_SEARCH_PATHS' => '$(inherited) "$(PODS_TARGET_SRCROOT)/cpp/3ds/lib"',
    'OTHER_LDFLAGS' => '$(inherited) -force_load "$(PODS_TARGET_SRCROOT)/cpp/3ds/lib/libc3ds_core.a" '       '-lcitra_core -lcitra_common -lvideo_core -laudio_core -lnetwork '       '-lteakra -lcryptopp -lfmt -lSoundTouch -llodepng '       '-lboost_serialization -lboost_iostreams'
  }

  # mGBA HEADERS deliberately stay out of source_files: CocoaPods maps
  # every listed header into its flattened Headers/Private farm, where
  # mgba-util/math.h (etc.) shadows the system <math.h> and corrupts the
  # Darwin module graph. The .c files still find them on disk through
  # OTHER_CFLAGS' -I paths.
  s.source_files = [
    'EmuCoreBridge.h',
    '*.swift',
    'cpp/include/core_api.h',
    'cpp/null_core.c',
    'cpp/gba/gba_core.c',
    'cpp/gba/mgba/src/**/*.c',
    'cpp/nds/nds_core.cpp',
    'cpp/nds/nds_platform.cpp',
    'cpp/nds/melonds/src/**/*.{c,cpp}'
  ]
  # Swift sees only the pure-C ABI: the bridge header plus core_api.h
  # itself (already C-clean by design — see core_api.h's header comment).
  s.public_header_files = ['EmuCoreBridge.h', 'cpp/include/core_api.h']

  # --- 3DS core (Azahar) ---
  # Built by its own CMake rather than the source glob above: 1369
  # sources across targets with different define sets, plus generated
  # files (scm_rev.cpp, version.h). See docs/playable-3ds-plan.md.
  # The script phase runs before compilation and stages static libs;
  # OTHER_LDFLAGS links them. Order matters (dependents first).
  s.script_phase = {
    :name => 'Build 3DS core (Azahar, no-JIT)',
    :script => '"${PODS_TARGET_SRCROOT}/build-3ds.sh" '                '"${PODS_TARGET_SRCROOT}/cpp/3ds/azahar" '                '"${DERIVED_FILE_DIR}/azahar-build" '                '"${PODS_TARGET_SRCROOT}/cpp/3ds/lib"',
    :execution_position => :before_compile,
    :output_files => ['${PODS_TARGET_SRCROOT}/cpp/3ds/lib/libc3ds_core.a']
  }

end
