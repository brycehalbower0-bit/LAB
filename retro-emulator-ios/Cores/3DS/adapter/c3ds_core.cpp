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
// Input (buttons, circle pad, touch) and audio are wired through;
// save_data_* remains unimplemented (3DS saves are archive-based).

#include <atomic>
#include <chrono>
#include <cstdio>
#include <thread>
#include <exception>
#include <typeinfo>
#include <cstring>
#include <filesystem>
#include <memory>
#include <string>
#include <vector>

#include "audio_core/dsp_interface.h"
#include "audio_core/sink_details.h"
#include "common/common_paths.h"
#include "common/file_util.h"
#include "common/logging/backend.h"
#include "common/logging/filter.h"
#include "common/settings.h"
#include "core/arm/arm_interface.h"
#include "core/core.h"
#include "core/core_timing.h"
#include "core/frontend/applets/default_applets.h"
#include "core/frontend/emu_window.h"
#include "core/frontend/input.h"
#include "core/hle/kernel/kernel.h"
#include "core/hle/kernel/process.h"
#include "core/hle/service/service.h"
#include "video_core/gpu.h"
#include "video_core/pica/pica_core.h"
#include "video_core/renderer_software/renderer_software.h"

#include "core_api.h"
#include "fb_map.h"

// Profiling counters defined inside the vendored software renderer (see
// sw_rasterizer.cpp / renderer_software.cpp). Declared here rather than
// shared through a header so the vendored tree needs no extra include
// path.
namespace SwRenderer {
extern std::atomic<uint64_t> g_profile_raster_ns;
extern std::atomic<uint64_t> g_profile_triangles;
extern std::atomic<uint64_t> g_profile_swap_ns;
extern std::atomic<bool> g_skip_rasterization;
} // namespace SwRenderer

namespace {

constexpr uint32_t kTopW = 400, kTopH = 240;
constexpr uint32_t kBotW = 320, kBotH = 240;

// Gate between the realtime audio thread and teardown.
//
// audio_open is the permission to touch Core::System; audio_readers
// counts callbacks currently inside. Closing the gate and then waiting
// for the count to reach zero is what makes shutdown safe, and it costs
// the audio thread two relaxed atomics -- no lock, no allocation, so it
// stays callable from a realtime context.
std::atomic<bool> g_audio_open{false};
std::atomic<int> g_audio_readers{0};

struct AudioGate {
    bool entered = false;
    AudioGate() {
        g_audio_readers.fetch_add(1, std::memory_order_acquire);
        if (g_audio_open.load(std::memory_order_acquire)) {
            entered = true;
        } else {
            g_audio_readers.fetch_sub(1, std::memory_order_release);
        }
    }
    ~AudioGate() {
        if (entered) {
            g_audio_readers.fetch_sub(1, std::memory_order_release);
        }
    }
};

// Close the gate and wait for in-flight callbacks. Called before any
// teardown that can invalidate what the audio thread reads.
void close_audio_gate() {
    g_audio_open.store(false, std::memory_order_release);
    for (int spins = 0;
         g_audio_readers.load(std::memory_order_acquire) > 0 && spins < 10000;
         spins++) {
        std::this_thread::sleep_for(std::chrono::microseconds(100));
    }
}

uint64_t now_ns() {
    return (uint64_t)std::chrono::duration_cast<std::chrono::nanoseconds>(
               std::chrono::steady_clock::now().time_since_epoch())
        .count();
}

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

// Live input state, written by set_input and read by the Input devices
// HID polls. Atomic because the shell writes from its own thread.
namespace c3ds_input {
std::atomic<uint32_t> buttons{0};
std::atomic<int32_t> analog_x{0};
std::atomic<int32_t> analog_y{0};
} // namespace c3ds_input

namespace {

// EMU_BTN_* bit for each 3DS NativeButton index, in enum order:
// A B X Y Up Down Left Right L R Start Select Debug GPIO14 ZL ZR
constexpr uint32_t kNativeButtonBits[] = {
    EMU_BTN_A,     EMU_BTN_B,    EMU_BTN_X,     EMU_BTN_Y,
    EMU_BTN_UP,    EMU_BTN_DOWN, EMU_BTN_LEFT,  EMU_BTN_RIGHT,
    EMU_BTN_L,     EMU_BTN_R,    EMU_BTN_START, EMU_BTN_SELECT,
    0,             0,            EMU_BTN_ZL,    EMU_BTN_ZR,
};

class AbiButton final : public Input::ButtonDevice {
public:
    explicit AbiButton(uint32_t bit) : bit_(bit) {}
    bool GetStatus() const override {
        return bit_ != 0 && (c3ds_input::buttons.load(std::memory_order_relaxed) & bit_) != 0;
    }

private:
    uint32_t bit_;
};

class AbiButtonFactory final : public Input::Factory<Input::ButtonDevice> {
public:
    std::unique_ptr<Input::ButtonDevice> Create(
        const Common::ParamPackage& params) override {
        const int index = params.Get("button", -1);
        const uint32_t bit =
            (index >= 0 && index < (int)(sizeof(kNativeButtonBits) / sizeof(uint32_t)))
                ? kNativeButtonBits[index]
                : 0u;
        return std::make_unique<AbiButton>(bit);
    }
};

// The circle pad. ABI carries -32768..32767; Citra wants -1..1.
class AbiAnalog final : public Input::AnalogDevice {
public:
    std::tuple<float, float> GetStatus() const override {
        return {c3ds_input::analog_x.load(std::memory_order_relaxed) / 32767.0f,
                c3ds_input::analog_y.load(std::memory_order_relaxed) / 32767.0f};
    }
};

class AbiAnalogFactory final : public Input::Factory<Input::AnalogDevice> {
public:
    std::unique_ptr<Input::AnalogDevice> Create(
        const Common::ParamPackage&) override {
        return std::make_unique<AbiAnalog>();
    }
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
    bool touching = false;
    // Execution telemetry for diagnostics(). A core that loads but never
    // executes still reports a frame rate, so the shell cannot tell the
    // difference without these.
    uint64_t frames_run = 0;
    uint64_t frames_without_vblank = 0;
    uint64_t last_loop_iters = 0;
    int last_run_status = 0;
    uint32_t last_pc = 0;
    uint64_t last_ticks = 0;
    uint64_t ticks_last_frame = 0;
    std::string diag;
    std::string log_path;
    std::string last_state_error;
    std::vector<uint8_t> state_cache;
    // Rasterize 1 of every (frame_skip + 1) frames; logic runs on all.
    int32_t frame_skip = 0;
    // Rolling profile over the last kProfileWindow frames. A per-frame
    // reading is too noisy to act on; a window is what tells us whether
    // the CPU interpreter or the software rasterizer owns the frame.
    static constexpr uint32_t kProfileWindow = 60;
    uint32_t profile_frames = 0;
    uint64_t win_wall_ns = 0;
    uint64_t win_raster_ns = 0;
    uint64_t win_swap_ns = 0;
    uint64_t win_video_ns = 0;
    uint64_t win_triangles = 0;
    // Last completed window, held for diagnostics().
    uint64_t prof_wall_ns = 0;
    uint64_t prof_raster_ns = 0;
    uint64_t prof_swap_ns = 0;
    uint64_t prof_video_ns = 0;
    uint64_t prof_triangles = 0;
    uint32_t prof_frames = 0;
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
    close_audio_gate();
    core->loaded = false;
    if (sys().IsPoweredOn()) {
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

    // Speed settings. None of these change what a game does; they remove
    // work we never consume.
    //
    // No stereoscopy: nothing reads the right-eye screen, and rendering
    // it is a second full decode of the same framebuffer.
    Settings::values.factor_3d = 0;
    Settings::values.disable_right_eye_render = true;
    Settings::values.resolution_factor = 1; // native; no supersampling
    // The shell paces against wall clock (ADR 0003), so the core's own
    // limiter is pure overhead -- and at 30% of full speed it would
    // never engage anyway.
    Settings::values.frame_limit = 0;
    // Time-stretching resamples to hide speed variation. We are far from
    // full speed, so it would run constantly, and it costs real CPU on
    // the audio thread for a title that is already behind.
    Settings::values.enable_audio_stretching = false;

    // Citra's user-path table is empty until a frontend sets it; any
    // .at() on it throws (upstream frontends all call this at init).
    // The shell passes a writable sandbox dir in the device slice; for
    // headless runs a temp dir keeps state out of the source tree.
    {
        const auto user_dir =
            std::filesystem::temp_directory_path() / "emulab-3ds";
        std::error_code ec;
        std::filesystem::create_directories(user_dir, ec);
        FileUtil::SetUserPath(user_dir.string());
    }

    // Citra's own logs are the cheapest map of how far Load gets when
    // something throws. diagnostics() reads the tail of this file back,
    // which is the only way to see the core's account of a failed boot
    // on a device with no attached console.
    core->log_path =
        FileUtil::GetUserPath(FileUtil::UserPath::LogDir) + LOG_FILE;
    static bool logging_ready = false;
    if (!logging_ready) {
        Common::Log::Initialize();
        Common::Log::Start();
        // Warning and above: Debug floods the file (and only Error-level
        // entries force a flush, so the spam mostly costs us the tail).
        Common::Log::SetGlobalFilter(
            Common::Log::Filter(Common::Log::Level::Warning));
        logging_ready = true;
    }

    // Every service module must have an LLE entry: Service::AttemptLLE
    // does lle_modules.at(name) unconditionally and throws on an empty
    // map. All false = HLE everywhere, which is what we want (LLE needs
    // dumped system titles, i.e. exactly the content we don't accept).
    // Mirrors upstream's libretro frontend.
    for (const auto& service_module : Service::service_module_map) {
        Settings::values.lle_modules.emplace(service_module.name, false);
    }

    // Register our ABI-backed input devices and point the profile at
    // them, so HID polls EmuInputState (mirrors what every frontend
    // does with its own engine name).
    static bool input_ready = false;
    if (!input_ready) {
        Input::RegisterFactory<Input::ButtonDevice>(
            "emuabi", std::make_shared<AbiButtonFactory>());
        Input::RegisterFactory<Input::AnalogDevice>(
            "emuabi", std::make_shared<AbiAnalogFactory>());
        input_ready = true;
    }
    for (int i = 0; i < Settings::NativeButton::NumButtons; i++) {
        Settings::values.current_input_profile.buttons[i] =
            "engine:emuabi,button:" + std::to_string(i);
    }
    // analogs[0] is the circle pad; analogs[1] (C-stick) stays unmapped.
    Settings::values.current_input_profile.analogs[0] = "engine:emuabi";
    Settings::values.current_input_profile.analogs[1] = "";

    core->window = std::make_unique<HeadlessWindow>();
    Frontend::RegisterDefaultApplets(sys());

    Core::System::ResultStatus result;
    try {
        result = sys().Load(*core->window, path);
    } catch (const std::exception& e) {
        std::fprintf(stderr, "c3ds: Load threw %s: %s\n", typeid(e).name(),
                     e.what());
        return EMU_ERR_INTERNAL;
    }
    if (result != Core::System::ResultStatus::Success) {
        return map_load_result(result);
    }
    core->loaded = true;
    g_audio_open.store(true, std::memory_order_release);
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

// Integer tuning knobs by name (see core_api.h). Applying settings live
// is safe here: Azahar reads cpu_clock_percentage when it reschedules,
// so the change takes effect on the next timeslice.
EmuStatus c3ds_set_option(EmuCore *core, const char *key, int32_t value) {
    if (!key) {
        return EMU_ERR_INVALID_ARG;
    }
    if (std::strcmp(key, "frame_skip") == 0) {
        if (value < 0 || value > 4) {
            return EMU_ERR_INVALID_ARG;
        }
        core->frame_skip = value;
        return EMU_OK;
    }
    if (std::strcmp(key, "cpu_clock") == 0) {
        if (value < 5 || value > 400) {
            return EMU_ERR_INVALID_ARG;
        }
        Settings::values.cpu_clock_percentage = value;
        return EMU_OK;
    }
    return EMU_ERR_UNSUPPORTED;
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
    SwRenderer::g_skip_rasterization.store(
        core->frame_skip > 0 &&
            (core->frames_run % (uint64_t)(core->frame_skip + 1)) != 0,
        std::memory_order_relaxed);
    const uint64_t ticks_before = sys().CoreTiming().GetGlobalTicks();
    const uint64_t wall_before = now_ns();
    const uint64_t raster_before =
        SwRenderer::g_profile_raster_ns.load(std::memory_order_relaxed);
    const uint64_t swap_before =
        SwRenderer::g_profile_swap_ns.load(std::memory_order_relaxed);
    const uint64_t tris_before =
        SwRenderer::g_profile_triangles.load(std::memory_order_relaxed);
    uint64_t iters = 0;
    int status = 0;
    // Safety cap: a wedged guest must not hang the caller (CI included).
    for (int i = 0; i < 100000 && !core->window->frame_done; i++) {
        iters++;
        const auto result = sys().RunLoop();
        if (result != Core::System::ResultStatus::Success) {
            status = static_cast<int>(result);
            break;
        }
    }
    core->frames_run++;
    core->last_loop_iters = iters;
    core->last_run_status = status;
    if (!core->window->frame_done) {
        core->frames_without_vblank++;
    }
    const uint64_t ticks_after = sys().CoreTiming().GetGlobalTicks();
    core->ticks_last_frame = ticks_after - ticks_before;
    core->last_ticks = ticks_after;
    core->last_pc = sys().GetRunningCore().GetPC();

    core->win_wall_ns += now_ns() - wall_before;
    core->win_raster_ns +=
        SwRenderer::g_profile_raster_ns.load(std::memory_order_relaxed) -
        raster_before;
    core->win_swap_ns +=
        SwRenderer::g_profile_swap_ns.load(std::memory_order_relaxed) -
        swap_before;
    core->win_triangles +=
        SwRenderer::g_profile_triangles.load(std::memory_order_relaxed) -
        tris_before;
    if (++core->profile_frames >= EmuCore::kProfileWindow) {
        core->prof_wall_ns = core->win_wall_ns;
        core->prof_raster_ns = core->win_raster_ns;
        core->prof_swap_ns = core->win_swap_ns;
        core->prof_video_ns = core->win_video_ns;
        core->prof_triangles = core->win_triangles;
        core->prof_frames = core->profile_frames;
        core->profile_frames = 0;
        core->win_wall_ns = core->win_raster_ns = core->win_swap_ns = 0;
        core->win_video_ns = core->win_triangles = 0;
    }
}

// Last `want` lines of a file. The log backend only force-flushes at
// Error level, so this shows everything up to the most recent error --
// which is exactly the part worth seeing.
std::string tail_lines(const std::string &path, size_t want) {
    if (path.empty()) {
        return {};
    }
    std::FILE *f = std::fopen(path.c_str(), "rb");
    if (!f) {
        return {};
    }
    std::fseek(f, 0, SEEK_END);
    const long size = std::ftell(f);
    const long window = size < 65536 ? size : 65536;
    std::fseek(f, size - window, SEEK_SET);
    std::string buf((size_t)window, '\0');
    const size_t got = std::fread(buf.data(), 1, (size_t)window, f);
    std::fclose(f);
    buf.resize(got);

    size_t cut = buf.size();
    for (size_t n = 0; n < want && cut > 0; n++) {
        const size_t nl = buf.rfind('\n', cut - 1);
        if (nl == std::string::npos) {
            cut = 0;
            break;
        }
        cut = nl;
    }
    return buf.substr(cut == 0 ? 0 : cut + 1);
}

// Core-internal state as text. Exists because a 3DS title that loads but
// never executes is indistinguishable from one that runs, when all the
// shell can see is a frame rate.
const char *c3ds_diagnostics(EmuCore *core) {
    char buf[1024];
    if (!core->loaded) {
        // A failed Load is exactly when the log matters most, so fall
        // through to it rather than returning bare "not loaded".
        core->diag = "3ds: no ROM loaded";
        const std::string tail = tail_lines(core->log_path, 14);
        if (!tail.empty()) {
            core->diag += "\n--- azahar log ---\n";
            core->diag += tail;
        }
        return core->diag.c_str();
    }

    // A 3DS frame is ~268M cycles/sec / 60 = ~4.5M ticks. Orders of
    // magnitude below that means the guest is idle or wedged, not slow.
    const auto &fb = sys().GPU().PicaCore().regs.framebuffer_config[0];
    const auto &top =
        static_cast<SwRenderer::RendererSoftware &>(sys().GPU().Renderer())
            .Screen(VideoCore::ScreenId::TopLeft);

    std::string proc = "(none)";
    if (auto p = sys().Kernel().GetCurrentProcess()) {
        proc = p->codeset ? p->codeset->name : "(no codeset)";
    }

    std::snprintf(
        buf, sizeof(buf),
        "3ds core\n"
        "frames=%llu novblank=%llu iters/frame=%llu status=%d\n"
        "ticks/frame=%llu (60fps guest ~= 4.5M)\n"
        "pc=0x%08X cores=%u process=%s\n"
        "fb0: addr=0x%08X fmt=%d stride=%u %ux%u active=%u\n"
        "screen0: %ux%u pixels=%zu",
        (unsigned long long)core->frames_run,
        (unsigned long long)core->frames_without_vblank,
        (unsigned long long)core->last_loop_iters, core->last_run_status,
        (unsigned long long)core->ticks_last_frame, core->last_pc,
        sys().GetNumCores(), proc.c_str(),
        (unsigned)(fb.active_fb == 0 ? fb.address_left1 : fb.address_left2),
        (int)fb.color_format.Value(), (unsigned)fb.stride,
        (unsigned)fb.width.Value(), (unsigned)fb.height.Value(),
        (unsigned)fb.active_fb,
        (unsigned)top.width, (unsigned)top.height, top.pixels.size());
    core->diag = buf;

    // The profile. This is the number that decides what to optimize:
    // "cpu" is whatever RunLoop spent that was not rasterizing or
    // blitting, i.e. the dyncom interpreter plus HLE services.
    if (core->prof_frames > 0 && core->prof_wall_ns > 0) {
        const double total = (double)core->prof_wall_ns;
        const double raster = (double)core->prof_raster_ns;
        const double swap = (double)core->prof_swap_ns;
        const double video = (double)core->prof_video_ns;
        const double cpu = total - raster - swap - video;
        char pbuf[512];
        std::snprintf(
            pbuf, sizeof(pbuf),
            "\nprofile over %u frames (%.1f ms/frame):\n"
            "  cpu+hle   %5.1f%%\n"
            "  raster    %5.1f%%  (%llu tris/frame)\n"
            "  fb blit   %5.1f%%\n"
            "  to shell  %5.1f%%",
            core->prof_frames, total / core->prof_frames / 1e6,
            100.0 * cpu / total, 100.0 * raster / total,
            (unsigned long long)(core->prof_triangles / core->prof_frames),
            100.0 * swap / total, 100.0 * video / total);
        core->diag += pbuf;
    }

    if (!core->last_state_error.empty()) {
        core->diag += "\nsavestate: " + core->last_state_error;
    }

    const std::string tail = tail_lines(core->log_path, 14);
    if (!tail.empty()) {
        core->diag += "\n--- azahar log ---\n";
        core->diag += tail;
    }
    return core->diag.c_str();
}

void c3ds_get_video(const EmuCore *core_c, uint32_t screen,
                    EmuVideoBuffer *out) {
    std::memset(out, 0, sizeof(*out));
    EmuCore *core = const_cast<EmuCore *>(core_c);
    if (!core->loaded || screen > 1) {
        return;
    }
    const uint64_t video_start = now_ns();
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
        // See fb_map.h for the mapping. Both sides are contiguous along
        // x -- source index is y * native_w + x, destination is y * w + x
        // -- so this is a row copy, not a per-pixel one. The old version
        // did a bounds check and a 4-byte memcpy per pixel, 172800 times
        // a frame across both screens.
        const uint32_t native_w = c3ds_fb_width(info.width, info.height);
        const uint32_t native_h = c3ds_fb_height(info.width, info.height);
        const uint32_t rows = h < native_h ? h : native_h;
        const uint32_t cols = w < native_w ? w : native_w;
        const size_t have = info.pixels.size() / 4;
        for (uint32_t y = 0; y < rows; y++) {
            const size_t src_index = c3ds_fb_index(0, y, info.width, info.height);
            if (src_index + cols > have) {
                break; // truncated frame: leave the rest at opaque black
            }
            std::memcpy(&dst[(size_t)y * w], info.pixels.data() + src_index * 4,
                        (size_t)cols * 4);
        }
        // Citra decodes every framebuffer format to alpha=255, so the
        // per-pixel OR the old loop did was redundant. Assert it rather
        // than assume it: a format that ever decoded alpha=0 would show
        // as a fully transparent screen, which is worth catching loudly.
        if (rows > 0 && cols > 0 && (dst[0] & 0xFF000000u) != 0xFF000000u) {
            for (size_t i = 0, n = (size_t)w * h; i < n; i++) {
                dst[i] |= 0xFF000000u;
            }
        }
    }

    out->pixels = dst.data();
    out->width = w;
    out->height = h;
    out->stride_pixels = w;
    core->win_video_ns += now_ns() - video_start;
}

uint32_t c3ds_read_audio(EmuCore *core, int16_t *out, uint32_t max_frames) {
    (void)core;
    if (max_frames == 0) {
        return 0;
    }
    // Runs on the realtime audio thread, which outlives nothing and
    // waits for nothing -- it kept calling into Core::System while the
    // main thread tore it down, and dereferenced a destroyed DSP
    // (SIGSEGV at 0x8 inside DspInterface::OutputCallback).
    //
    // `loaded` alone is not enough: it is a plain bool on another
    // thread, and clearing it does not wait for a callback already
    // inside. Take a reader slot, re-check under it, and have shutdown
    // close the gate then drain.
    AudioGate gate;
    if (!gate.entered) {
        std::memset(out, 0, (size_t)max_frames * 2 * sizeof(int16_t));
        return max_frames; // silence, not underrun
    }
    // The ABI pulls audio; Citra's sinks push. OutputCallback is the
    // entry point a Sink would call (time-stretch + mix), so we call it
    // directly and keep SinkType::Null installed so nothing competes
    // for the DSP output.
    sys().DSP().OutputCallback(out, max_frames);
    return max_frames;
}

void c3ds_set_input(EmuCore *core, const EmuInputState *input) {
    core->input = *input;
    c3ds_input::buttons.store(input->buttons, std::memory_order_relaxed);
    c3ds_input::analog_x.store(input->analog_x, std::memory_order_relaxed);
    c3ds_input::analog_y.store(input->analog_y, std::memory_order_relaxed);

    // Touch goes through the window, in framebuffer coordinates: the
    // layout stacks top (400x240) over bottom (320x240), and the bottom
    // screen is centered in the 400-wide frame.
    if (!core->window) {
        return;
    }
    if (input->touch_down) {
        const unsigned x = (kTopW - kBotW) / 2 +
                           (input->touch_x < kBotW ? input->touch_x : kBotW - 1);
        const unsigned y = kTopH +
                           (input->touch_y < kBotH ? input->touch_y : kBotH - 1);
        if (core->touching) {
            core->window->TouchMoved(x, y);
        } else {
            core->window->TouchPressed(x, y);
            core->touching = true;
        }
    } else if (core->touching) {
        core->window->TouchReleased();
        core->touching = false;
    }
}

// Serialization throws (Boost.Serialization signals an unregistered
// polymorphic class that way). Letting it cross this C ABI is an
// uncaught exception, i.e. abort() -- the whole app dies rather than one
// operation failing. Catch here, keep the message for diagnostics, and
// report a status the shell can act on.
std::vector<uint8_t> serialize_state(EmuCore *core) {
    try {
        core->last_state_error.clear();
        return sys().SaveStateBuffer();
    } catch (const std::exception &e) {
        core->last_state_error = e.what();
        std::fprintf(stderr, "c3ds: save state failed: %s\n", e.what());
    } catch (...) {
        core->last_state_error = "unknown exception";
    }
    return {};
}

size_t c3ds_state_size(const EmuCore *core_c) {
    EmuCore *core = const_cast<EmuCore *>(core_c);
    if (!core->loaded) {
        return 0;
    }
    // Cache it: serializing a 3DS system is expensive, and state_save is
    // always called straight after with the size we just reported.
    core->state_cache = serialize_state(core);
    return core->state_cache.size();
}

EmuStatus c3ds_state_save(const EmuCore *core_c, uint8_t *out, size_t size) {
    EmuCore *core = const_cast<EmuCore *>(core_c);
    if (!core->loaded) {
        return EMU_ERR_INVALID_ARG;
    }
    if (core->state_cache.empty()) {
        core->state_cache = serialize_state(core);
    }
    const auto buffer = std::move(core->state_cache);
    core->state_cache.clear();
    if (buffer.empty()) {
        return EMU_ERR_UNSUPPORTED;
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
    try {
        core->last_state_error.clear();
        if (!sys().LoadStateBuffer(std::move(buffer))) {
            return EMU_ERR_BAD_STATE;
        }
    } catch (const std::exception &e) {
        core->last_state_error = e.what();
        std::fprintf(stderr, "c3ds: load state failed: %s\n", e.what());
        return EMU_ERR_BAD_STATE;
    } catch (...) {
        core->last_state_error = "unknown exception";
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
    c3ds_diagnostics,
    c3ds_set_option,
};

} // namespace

extern "C" const EmuCoreApi *emu_3ds_api(void) {
    return &g_c3ds_api;
}
