// Copyright 2015 Citra Emulator Project
// Licensed under GPLv2 or any later version
// Refer to the license.txt file included.

#include "common/arch.h"
#include "video_core/shader/shader_interpreter.h"
// retro-emulator-ios patch: shader JIT optional (ADR 0001-D3)
#if (CITRA_ARCH(x86_64) || CITRA_ARCH(arm64)) && defined(CITRA_ENABLE_SHADER_JIT)
#include "video_core/shader/shader_jit.h"
#endif
#include "video_core/shader/shader.h"

namespace Pica {

std::unique_ptr<ShaderEngine> CreateEngine(bool use_jit) {
// retro-emulator-ios patch: shader JIT optional (ADR 0001-D3)
#if (CITRA_ARCH(x86_64) || CITRA_ARCH(arm64)) && defined(CITRA_ENABLE_SHADER_JIT)
    if (use_jit) {
        return std::make_unique<Shader::JitEngine>();
    }
#endif

    return std::make_unique<Shader::InterpreterEngine>();
}

} // namespace Pica
