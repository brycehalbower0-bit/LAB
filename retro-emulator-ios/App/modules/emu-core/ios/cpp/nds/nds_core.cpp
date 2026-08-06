// VENDORED COPY — synced by scripts/sync-emu-core.mjs.
// Edit the original and re-run `npm run sync-emu-core`; do not edit here.

// nds_core.cpp — NDS core behind the shared ABI (core_api.h), adapting
// melonDS 1.1's class-based embedding API (vendored snapshot in
// ./melonds, see README.md).
//
// App Store rules shape the construction: NDSArgs.JIT = std::nullopt
// and the vendored build compiles with ENABLE_JIT=OFF — interpreter
// only, zero runtime code generation (ADR 0001-D3). BIOS/firmware are
// melonDS's built-in FreeBIOS + generated firmware (no user files, no
// key material — D5); DSi mode is out of scope.
//
// Threading matches the ABI: everything on the emulation thread except
// read_audio, which pulls straight from melonDS's SPU output ring — the
// same producer/consumer split melonDS's own SDL audio callback uses.

#include <cstring>
#include <memory>
#include <string>

#include "NDS.h"
#include "NDSCart.h"
#include "Savestate.h"
#include "SPU.h"
#include "GPU.h"

#include "core_api.h"

using namespace melonDS;

#define NDS_W 256
#define NDS_H 192
#define NDS_SAMPLE_RATE 32768u

struct EmuCore {
    std::unique_ptr<melonDS::NDS> nds;
    std::unique_ptr<u8[]> rom_copy;
    u32 rom_size = 0;
    bool save_dirty = false;
    // melonDS emits ARGB-in-u32 (Qt Format_RGB32; R in bits 16-23);
    // the ABI wants RGBA bytes — get_video swizzles into these.
    std::unique_ptr<uint32_t[]> video[2];
};

// Called by nds_platform.cpp's WriteNDSSave hook (userdata is EmuCore*).
void emu_nds_mark_save_dirty(void* userdata) {
    if (userdata) {
        static_cast<EmuCore*>(userdata)->save_dirty = true;
    }
}

namespace {

// EMU_BTN_* -> melonDS SetKeyMask bit positions
// (A0 B1 SELECT2 START3 RIGHT4 LEFT5 UP6 DOWN7 R8 L9 X10 Y11),
// active-low per KEYINPUT semantics.
uint32_t map_keys(uint32_t buttons) {
    uint32_t pressed = 0;
    if (buttons & EMU_BTN_A) pressed |= 1u << 0;
    if (buttons & EMU_BTN_B) pressed |= 1u << 1;
    if (buttons & EMU_BTN_SELECT) pressed |= 1u << 2;
    if (buttons & EMU_BTN_START) pressed |= 1u << 3;
    if (buttons & EMU_BTN_RIGHT) pressed |= 1u << 4;
    if (buttons & EMU_BTN_LEFT) pressed |= 1u << 5;
    if (buttons & EMU_BTN_UP) pressed |= 1u << 6;
    if (buttons & EMU_BTN_DOWN) pressed |= 1u << 7;
    if (buttons & EMU_BTN_R) pressed |= 1u << 8;
    if (buttons & EMU_BTN_L) pressed |= 1u << 9;
    if (buttons & EMU_BTN_X) pressed |= 1u << 10;
    if (buttons & EMU_BTN_Y) pressed |= 1u << 11;
    return 0xFFFu & ~pressed;
}

EmuCore *nds_create(void) {
    return new (std::nothrow) EmuCore();
}

void nds_destroy(EmuCore *core) {
    delete core;
}

void nds_describe(const EmuCore *core, EmuCoreDesc *out_desc) {
    (void)core;
    static const char *const no_files[] = { nullptr };
    std::memset(out_desc, 0, sizeof(*out_desc));
    out_desc->system = EMU_SYSTEM_NDS;
    out_desc->name = "nds-melonds";
    out_desc->version = "1.1";
    out_desc->screen_count = 2;
    out_desc->screens[0].width = NDS_W;
    out_desc->screens[0].height = NDS_H;
    out_desc->screens[0].has_touch = 0;
    out_desc->screens[1].width = NDS_W;
    out_desc->screens[1].height = NDS_H;
    out_desc->screens[1].has_touch = 1;
    out_desc->native_fps = 59.8261;
    out_desc->audio_sample_rate = NDS_SAMPLE_RATE;
    out_desc->buttons_used = EMU_BTN_A | EMU_BTN_B | EMU_BTN_X | EMU_BTN_Y |
                             EMU_BTN_L | EMU_BTN_R | EMU_BTN_START |
                             EMU_BTN_SELECT | EMU_BTN_UP | EMU_BTN_DOWN |
                             EMU_BTN_LEFT | EMU_BTN_RIGHT;
    out_desc->has_circle_pad = 0;
    out_desc->required_files = no_files;
}

EmuStatus nds_load_system_file(EmuCore *core, const char *name,
                               const uint8_t *data, size_t size) {
    (void)core;
    (void)data;
    (void)size;
    if (!name) {
        return EMU_ERR_INVALID_ARG;
    }
    // FreeBIOS + generated firmware: nothing to load, by design.
    return EMU_ERR_UNSUPPORTED;
}

EmuStatus nds_load_rom(EmuCore *core, const uint8_t *data, size_t size) {
    if (!data || size == 0) {
        return EMU_ERR_BAD_ROM;
    }
    if (core->nds) {
        return EMU_ERR_INTERNAL; // one ROM per instance
    }

    core->rom_copy = std::make_unique<u8[]>(size);
    std::memcpy(core->rom_copy.get(), data, size);
    core->rom_size = (u32)size;

    auto cart = NDSCart::ParseROM(core->rom_copy.get(), core->rom_size);
    if (!cart) {
        return EMU_ERR_BAD_ROM;
    }

    NDSArgs args {};
    args.JIT = std::nullopt; // interpreter only (ADR 0001-D3)
    args.OutputSampleRate = (double)NDS_SAMPLE_RATE;

    auto nds = std::make_unique<melonDS::NDS>(std::move(args),
                                              static_cast<void *>(core));
    nds->SetNDSCart(std::move(cart));
    nds->Reset();
    if (nds->NeedsDirectBoot()) {
        nds->SetupDirectBoot("rom.nds");
    }
    nds->Start(); // sets Running; RunFrame idles without it

    core->nds = std::move(nds);
    return EMU_OK;
}

void nds_reset(EmuCore *core) {
    if (!core->nds) {
        return;
    }
    core->nds->Reset();
    if (core->nds->NeedsDirectBoot()) {
        core->nds->SetupDirectBoot("rom.nds");
    }
    core->nds->Start();
}

void nds_run_frame(EmuCore *core) {
    if (core->nds) {
        core->nds->RunFrame();
    }
}

void nds_get_video(const EmuCore *core_c, uint32_t screen,
                   EmuVideoBuffer *out) {
    std::memset(out, 0, sizeof(*out));
    EmuCore *core = const_cast<EmuCore *>(core_c);
    if (!core->nds || screen > 1) {
        return;
    }
    const auto &gpu = core->nds->GPU;
    const u32 *fb = gpu.Framebuffer[gpu.FrontBuffer][screen].get();
    if (!fb) {
        return;
    }
    if (!core->video[screen]) {
        core->video[screen] = std::make_unique<uint32_t[]>(NDS_W * NDS_H);
    }
    uint32_t *dst = core->video[screen].get();
    for (size_t i = 0; i < (size_t)NDS_W * NDS_H; i++) {
        uint32_t px = fb[i];
        dst[i] = 0xFF000000u | ((px >> 16) & 0xFFu) | (px & 0x0000FF00u) |
                 ((px & 0xFFu) << 16);
    }
    out->pixels = dst;
    out->width = NDS_W;
    out->height = NDS_H;
    out->stride_pixels = NDS_W;
}

uint32_t nds_read_audio(EmuCore *core, int16_t *out, uint32_t max_frames) {
    if (!core->nds) {
        return 0;
    }
    int got = core->nds->SPU.ReadOutput(out, (int)max_frames);
    return got > 0 ? (uint32_t)got : 0;
}

void nds_set_input(EmuCore *core, const EmuInputState *input) {
    if (!core->nds) {
        return;
    }
    core->nds->SetKeyMask(map_keys(input->buttons));
    if (input->touch_down) {
        u16 x = input->touch_x < NDS_W ? input->touch_x : NDS_W - 1;
        u16 y = input->touch_y < NDS_H ? input->touch_y : NDS_H - 1;
        core->nds->TouchScreen(x, y);
    } else {
        core->nds->ReleaseScreen();
    }
}

// BufferLength() is capacity; Length() is bytes used, valid after
// Finish() writes the length header.
size_t nds_state_size(const EmuCore *core) {
    if (!core->nds) {
        return 0;
    }
    Savestate state;
    if (!const_cast<melonDS::NDS *>(core->nds.get())->DoSavestate(&state) ||
        state.Error) {
        return 0;
    }
    state.Finish();
    return state.Length();
}

EmuStatus nds_state_save(const EmuCore *core, uint8_t *out, size_t size) {
    if (!core->nds) {
        return EMU_ERR_INVALID_ARG;
    }
    Savestate state;
    if (!const_cast<melonDS::NDS *>(core->nds.get())->DoSavestate(&state) ||
        state.Error) {
        return EMU_ERR_INTERNAL;
    }
    state.Finish();
    if (size < state.Length()) {
        return EMU_ERR_INVALID_ARG;
    }
    std::memcpy(out, state.Buffer(), state.Length());
    return EMU_OK;
}

EmuStatus nds_state_load(EmuCore *core, const uint8_t *data, size_t size) {
    if (!core->nds) {
        return EMU_ERR_INVALID_ARG;
    }
    if (!data || size < 16) {
        return EMU_ERR_BAD_STATE;
    }
    Savestate state(const_cast<uint8_t *>(data), (u32)size, false);
    if (state.Error || !core->nds->DoSavestate(&state) || state.Error) {
        return EMU_ERR_BAD_STATE;
    }
    return EMU_OK;
}

size_t nds_save_data_size(const EmuCore *core) {
    if (!core->nds) {
        return 0;
    }
    return core->nds->GetNDSSaveLength();
}

EmuStatus nds_save_data_read(const EmuCore *core, uint8_t *out, size_t size) {
    if (!core->nds) {
        return EMU_ERR_INVALID_ARG;
    }
    const u8 *save = core->nds->GetNDSSave();
    u32 len = core->nds->GetNDSSaveLength();
    if (!save || len == 0) {
        return EMU_ERR_UNSUPPORTED;
    }
    if (size < len) {
        return EMU_ERR_INVALID_ARG;
    }
    std::memcpy(out, save, len);
    const_cast<EmuCore *>(core)->save_dirty = false;
    return EMU_OK;
}

EmuStatus nds_save_data_write(EmuCore *core, const uint8_t *data, size_t size) {
    if (!core->nds || !data || size == 0) {
        return EMU_ERR_INVALID_ARG;
    }
    core->nds->NDSCartSlot.SetSaveMemory(data, (u32)size);
    return EMU_OK;
}

const EmuCoreApi g_nds_api = {
    nds_create,
    nds_destroy,
    nds_describe,
    nds_load_system_file,
    nds_load_rom,
    nds_reset,
    nds_run_frame,
    nds_get_video,
    nds_read_audio,
    nds_set_input,
    nds_state_size,
    nds_state_save,
    nds_state_load,
    nds_save_data_size,
    nds_save_data_read,
    nds_save_data_write,
};

} // namespace

extern "C" const EmuCoreApi *emu_nds_api(void) {
    return &g_nds_api;
}
