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
  # The mGBA defines mirror the Linux CI build's compile manifest (the
  # workflow's "Dump mGBA compile manifest" step is ground truth); all
  # HAVE_* functions exist on Darwin. GCC_PREPROCESSOR_DEFINITIONS is
  # C-family only, so Swift is unaffected.
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'GCC_C_LANGUAGE_STANDARD' => 'c11',
    'GCC_OPTIMIZATION_LEVEL' => '3',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/cpp/include" "$(PODS_TARGET_SRCROOT)/cpp/gba/mgba/include" "$(PODS_TARGET_SRCROOT)/cpp/gba/mgba/src"',
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) BUILD_STATIC M_CORE_GBA M_CORE_GB NDEBUG USE_PTHREADS HAVE_FREELOCALE HAVE_FUTIMENS HAVE_FUTIMES HAVE_LOCALE HAVE_LOCALTIME_R HAVE_NEWLOCALE HAVE_PTHREAD_CREATE HAVE_PTHREAD_SETNAME_NP HAVE_SETLOCALE HAVE_STRDUP HAVE_STRLCPY HAVE_STRNDUP HAVE_USELOCALE HAVE_VASPRINTF'
  }

  s.source_files = '**/*.{h,c,m,mm,swift,cpp}'
  # Swift sees only the pure-C ABI: the bridge header plus core_api.h
  # itself (already C-clean by design — see core_api.h's header comment).
  s.public_header_files = ['EmuCoreBridge.h', 'cpp/include/core_api.h']
end
