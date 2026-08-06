// c3ds_core.cpp — 3DS core behind the shared ABI (core_api.h), adapting
// Azahar's Core::System (vendored snapshot in ../azahar, ADR 0005).
// Call shapes mirror upstream's own libretro frontend
// (src/citra_libretro), the reference for headless embedding.
//
// App Store constraints baked in at this layer:
//  - use_cpu_jit = false (dyncom interpreter; dynarmic is compiled out
//    entirely via the ENABLE_DYNARMIC patch — ADR 0001-D3)
//  - graphics_api = Software (shader JIT compiled out via
//    ENABLE_SHADER_JIT patch; PICA shader interpreter)
//  - zero key material (ENABLE_BUILTIN_KEYBLOB off); Azahar natively
//    rejects encrypted content, mapped to EMU_ERR_ENCRYPTED_CONTENT
//    (PLAN §2.1, ADR 0001-D5)
//
// Known Phase-3a scope cuts, wired in later slices: audio uses the null
// sink (read_audio returns 0), set_input stores state but isn't yet fed
// into HID.

#include <cstdio>
#include <cstring>
#include <filesystem>
#include <memory>
#include <string>
#include <vector>

#include "audio_core/sink_details.h"
#include "common/settings.h"
#include "core/core.h"
#include "core/frontend/applets/default_applets.h"
#include "core/frontend/emu_window.h"
#include "video_core/gpu.h"
#include "video_core/renderer_software/renderer_software.h"

#include "core_api.h"

namespace {

constexpr uint32_t kTopW = 400, kTopH = 240;
constexpr uint32_t kBotW = 320, kBotH = 240;

// Minimal headless window: the software renderer needs no GL context;
// PollEvents fires at VBlank right after the screen pixel buffers are
// filled (see upstream's libretro_window.cpp note), which makes it the
// frame boundary marker.
class HeadlessWindow : public Frontend::EmuWindow {
public:
    HeadlessWindow() {
        window_info.type = Frontend::WindowSystemType::Headless;
        UpdateCurrentFramebufferLayout(kTopW, kTopH + kBotH);
    }
    void PollEvents() override {
        frame_done = true;
    }
    bool frame_done = false;
};

} // namespace

struct EmuCore {
    std::unique_ptr<HeadlessWindow> window;
    bool loaded = false;
    std::string temp_rom_path; // when load_rom (bytes) spilled to disk
    // Landscape RGBA copies for get_video (ScreenInfo is column-major
    // portrait; see upstream blitter comment).
    std::vector<uint32_t> video_top;
    std::vector<uint32_t> video_bottom;
    EmuInputState input{};
};

namespace {

Core::System& sys() {
    return Core::System::GetInstance();
}

EmuCore *c3ds_create(void) {
    return new (std::nothrow) EmuCore();
}

void c3ds_destroy(EmuCore *core) {
    if (!core) {
        return;
    }
    if (core->loaded && sys().IsPoweredOn()) {
        sys().Shutdown();
    }
    if (!core->temp_rom_path.empty()) {
        std::error_code ec;
        std::filesystem::remove(core->temp_rom_path, ec);
    }
    delete core;
}

void c3ds_describe(const EmuCore *core, EmuCoreDesc *out_desc) {
    (void)core;
    static const char *const no_files[] = { nullptr };
    std::memset(out_desc, 0, sizeof(*out_desc));
    out_desc->system = EMU_SYSTEM_3DS;
    out_desc->name = "3ds-azahar";
    out_desc->version = "2125.1.3";
    out_desc->screen_count = 2;
    out_desc->screens[0].width = kTopW;
    out_desc->screens[0].height = kTopH;
    out_desc->screens[0].has_touch = 0;
    out_desc->screens[1].width = kBotW;
    out_desc->screens[1].height = kBotH;
    out_desc->screens[1].has_touch = 1;
    out_desc->native_fps = 59.8337;
    out_desc->audio_sample_rate = 32768;
    out_desc->buttons_used = EMU_BTN_A | EMU_BTN_B | EMU_BTN_X | EMU_BTN_Y |
                             EMU_BTN_L | EMU_BTN_R | EMU_BTN_START |
                             EMU_BTN_SELECT | EMU_BTN_UP | EMU_BTN_DOWN |
                             EMU_BTN_LEFT | EMU_BTN_RIGHT;
    out_desc->has_circle_pad = 1;
    out_desc->required_files = no_files; // decrypted dumps only; no BIOS/keys
}

EmuStatus c3ds_load_system_file(EmuCore *core, const char *name,
                                const uint8_t *data, size_t size) {
    (void)core;
    (void)data;
    (void)size;
    if (!name) {
        return EMU_ERR_INVALID_ARG;
    }
    // No key material by design (PLAN §2.1); system archives are a
    // later, non-key concern.
    return EMU_ERR_UNSUPPORTED;
}

EmuStatus map_load_result(Core::System::ResultStatus r) {
    using RS = Core::System::ResultStatus;
    switch (r) {
    case RS::Success:
        return EMU_OK;
    case RS::ErrorLoader_ErrorEncrypted:
        return EMU_ERR_ENCRYPTED_CONTENT; // rejected, never decrypted
    case RS::ErrorLoader_ErrorInvalidFormat:
    case RS::ErrorGetLoader:
        return EMU_ERR_BAD_ROM;
    case RS::ErrorSystemFiles:
        return EMU_ERR_MISSING_SYSTEM_FILE;
    default:
        return EMU_ERR_INTERNAL;
    }
}

EmuStatus c3ds_load_rom_path(EmuCore *core, const char *path) {
    if (!path || !core || core->loaded) {
        return EMU_ERR_INVALID_ARG;
    }

    // Interpreter-everything, headless, no key material (see header).
    Settings::values.use_cpu_jit = false;
    Settings::values.graphics_api = Settings::GraphicsAPI::Software;
    Settings::values.output_type = AudioCore::SinkType::Null;

    core->window = std::make_unique<HeadlessWindow>();
    Frontend::RegisterDefaultApplets(sys());

    const auto result = sys().Load(*core->window, path);
    if (result != Core::System::ResultStatus::Success) {
        return map_load_result(result);
    }
    core->loaded = true;
    return EMU_OK;
}

EmuStatus c3ds_load_rom(EmuCore *core, const uint8_t *data, size_t size) {
    if (!data || size == 0) {
        return EMU_ERR_BAD_ROM;
    }
    // File-backed loader: spill bytes to a temp file. The shell prefers
    // load_rom_path; this path exists for the ABI contract (and tests).
    auto tmp = std::filesystem::temp_directory_path() /
               ("c3ds_rom_" + std::to_string(reinterpret_cast<uintptr_t>(core)));
    {
        std::FILE *f = std::fopen(tmp.string().c_str(), "wb");
        if (!f) {
            return EMU_ERR_INTERNAL;
        }
        const size_t written = std::fwrite(data, 1, size, f);
        std::fclose(f);
        if (written != size) {
            return EMU_ERR_INTERNAL;
        }
    }
    core->temp_rom_path = tmp.string();
    return c3ds_load_rom_path(core, core->temp_rom_path.c_str());
}

void c3ds_reset(EmuCore *core) {
    if (core->loaded) {
        sys().Reset();
    }
}

void c3ds_run_frame(EmuCore *core) {
    if (!core->loaded) {
        return;
    }
    core->window->frame_done = false;
    // Safety cap: a wedged guest must not hang the caller (CI included).
    for (int i = 0; i < 100000 && !core->window->frame_done; i++) {
        const auto result = sys().RunLoop();
        if (result != Core::System::ResultStatus::Success) {
            break;
        }
    }
}

void c3ds_get_video(const EmuCore *core_c, uint32_t screen,
                    EmuVideoBuffer *out) {
    std::memset(out, 0, sizeof(*out));
    EmuCore *core = const_cast<EmuCore *>(core_c);
    if (!core->loaded || screen > 1) {
        return;
    }
    const auto &renderer =
        static_cast<SwRenderer::RendererSoftware &>(sys().GPU().Renderer());
    const auto id = screen == 0 ? VideoCore::ScreenId::TopLeft
                                : VideoCore::ScreenId::Bottom;
    const auto &info = renderer.Screen(id);

    const uint32_t w = screen == 0 ? kTopW : kBotW;
    const uint32_t h = screen == 0 ? kTopH : kBotH;
    auto &dst = screen == 0 ? core->video_top : core->video_bottom;
    dst.assign((size_t)w * h, 0xFF000000u);

    if (!info.pixels.empty()) {
        // ScreenInfo is column-major portrait RGBA; landscape (x, y)
        // reads portrait (row = x, col = y): src = (x * info.height + y).
        // (Upstream blitter: native landscape w = info.height.)
        const uint32_t native_w = info.height; // landscape width
        const uint32_t native_h = info.width;  // landscape height
        for (uint32_t y = 0; y < h && y < native_h; y++) {
            for (uint32_t x = 0; x < w && x < native_w; x++) {
                const size_t src_off = ((size_t)x * info.height + y) * 4;
                if (src_off + 3 < info.pixels.size()) {
                    uint32_t px;
                    std::memcpy(&px, info.pixels.data() + src_off, 4);
                    dst[(size_t)y * w + x] = px | 0xFF000000u;
                }
            }
        }
    }

    out->pixels = dst.data();
    out->width = w;
    out->height = h;
    out->stride_pixels = w;
}

uint32_t c3ds_read_audio(EmuCore *core, int16_t *out, uint32_t max_frames) {
    // Null sink for Phase 3a; a pull sink lands with the device slice.
    (void)core;
    (void)out;
    (void)max_frames;
    return 0;
}

void c3ds_set_input(EmuCore *core, const EmuInputState *input) {
    core->input = *input; // stored; HID wiring is a later slice
}

size_t c3ds_state_size(const EmuCore *core) {
    if (!core->loaded) {
        return 0;
    }
    return sys().SaveStateBuffer().size();
}

EmuStatus c3ds_state_save(const EmuCore *core, uint8_t *out, size_t size) {
    if (!core->loaded) {
        return EMU_ERR_INVALID_ARG;
    }
    const auto buffer = sys().SaveStateBuffer();
    if (buffer.empty()) {
        return EMU_ERR_INTERNAL;
    }
    if (size < buffer.size()) {
        return EMU_ERR_INVALID_ARG;
    }
    std::memcpy(out, buffer.data(), buffer.size());
    return EMU_OK;
}

EmuStatus c3ds_state_load(EmuCore *core, const uint8_t *data, size_t size) {
    if (!core->loaded) {
        return EMU_ERR_INVALID_ARG;
    }
    if (!data || size < 16) {
        return EMU_ERR_BAD_STATE;
    }
    std::vector<uint8_t> buffer(data, data + size);
    if (!sys().LoadStateBuffer(std::move(buffer))) {
        return EMU_ERR_BAD_STATE;
    }
    return EMU_OK;
}

size_t c3ds_save_data_size(const EmuCore *core) {
    (void)core;
    return 0; // 3DS saves are archive-based; handled by the core's own
              // virtual SD/savedata storage in the device slice.
}

EmuStatus c3ds_save_data_read(const EmuCore *core, uint8_t *out, size_t size) {
    (void)core;
    (void)out;
    (void)size;
    return EMU_ERR_UNSUPPORTED;
}

EmuStatus c3ds_save_data_write(EmuCore *core, const uint8_t *data,
                               size_t size) {
    (void)core;
    (void)data;
    (void)size;
    return EMU_ERR_UNSUPPORTED;
}

const EmuCoreApi g_c3ds_api = {
    c3ds_create,
    c3ds_destroy,
    c3ds_describe,
    c3ds_load_system_file,
    c3ds_load_rom,
    c3ds_reset,
    c3ds_run_frame,
    c3ds_get_video,
    c3ds_read_audio,
    c3ds_set_input,
    c3ds_state_size,
    c3ds_state_save,
    c3ds_state_load,
    c3ds_save_data_size,
    c3ds_save_data_read,
    c3ds_save_data_write,
    c3ds_load_rom_path,
};

} // namespace

extern "C" const EmuCoreApi *emu_3ds_api(void) {
    return &g_c3ds_api;
}
