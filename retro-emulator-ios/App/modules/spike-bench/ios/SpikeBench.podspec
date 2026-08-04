Pod::Spec.new do |s|
  s.name           = 'SpikeBench'
  s.version        = '0.1.0'
  s.summary        = 'ARM11 no-JIT interpreter spike benchmark (PLAN.md 10.3)'
  s.description    = 'Runs the block-cached interpreter throughput spike on-device. The number that matters is the one from a physical iPhone 15.'
  s.author         = 'retro-emulator-ios'
  s.homepage       = 'https://github.com/brycehalbower0-bit/LAB'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # O3 in every configuration: dev-client builds are Debug, and a -O0
  # interpreter benchmark measures nothing.
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'GCC_OPTIMIZATION_LEVEL' => '3',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift,cpp}'
  # Only the pure-C bridge header enters the umbrella header; the C++
  # spike headers must stay out of the Swift-visible module.
  s.public_header_files = 'SpikeBenchBridge.h'
end
