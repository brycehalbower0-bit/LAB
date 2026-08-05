/*
 * gba_core.c — GBA core behind the shared ABI (core_api.h), adapting
 * mGBA's mCore interface (vendored snapshot in ./mgba, see README.md).
 * The call sequences mirror mGBA's own libretro port, the reference
 * adapter shape for "core only, no platform" embedding.
 *
 * Threading: everything here runs on the emulation thread except
 * read_audio, which the ABI defines as wait-free and callable from the
 * realtime audio thread. The audio handoff is a single-producer/
 * single-consumer ring with C11 atomic acquire/release counters:
 * run_frame produces, read_audio consumes, neither ever locks.
 */

#include <stdatomic.h>
#include <stdlib.h>
#include <string.h>

#include <mgba/core/blip_buf.h>
#include <mgba/core/core.h>
#include <mgba/gba/core.h>
#include <mgba/internal/gba/gba.h>
#include <mgba/internal/gba/memory.h>
#include <mgba/internal/gba/savedata.h>
#include <mgba-util/vfs.h>

#include "core_api.h"

#define GBA_WIDTH 240
#define GBA_HEIGHT 160
#define SAMPLE_RATE 32768u

/* Power-of-two stereo frames; ~0.5s at 32768 Hz. */
#define RING_FRAMES 16384u

struct EmuCore {
    struct mCore *mcore;

    void *rom_copy; /* mGBA VFile wraps this; freed on destroy */
    size_t rom_size;

    uint32_t *video; /* GBA_WIDTH * GBA_HEIGHT, RGBA8888 */

    uint8_t *save_buffer; /* SIZE_CART_FLASH1M, attached via loadSave */

    int16_t *drain; /* temp interleaved buffer for per-frame blip drain */
    size_t drain_frames;

    int16_t ring[RING_FRAMES * 2];
    _Atomic uint64_t ring_write; /* in frames, monotonic */
    _Atomic uint64_t ring_read;  /* in frames, monotonic */

    int loaded;
};

/* EMU_BTN_* -> GBA keypad bits (A0 B1 SELECT2 START3 RIGHT4 LEFT5 UP6
 * DOWN7 R8 L9). */
static uint32_t map_keys(uint32_t buttons) {
    uint32_t keys = 0;
    if (buttons & EMU_BTN_A) keys |= 1u << 0;
    if (buttons & EMU_BTN_B) keys |= 1u << 1;
    if (buttons & EMU_BTN_SELECT) keys |= 1u << 2;
    if (buttons & EMU_BTN_START) keys |= 1u << 3;
    if (buttons & EMU_BTN_RIGHT) keys |= 1u << 4;
    if (buttons & EMU_BTN_LEFT) keys |= 1u << 5;
    if (buttons & EMU_BTN_UP) keys |= 1u << 6;
    if (buttons & EMU_BTN_DOWN) keys |= 1u << 7;
    if (buttons & EMU_BTN_R) keys |= 1u << 8;
    if (buttons & EMU_BTN_L) keys |= 1u << 9;
    return keys;
}

static EmuCore *gba_create(void) {
    struct EmuCore *core = calloc(1, sizeof(*core));
    if (!core) {
        return NULL;
    }
    core->video = calloc(GBA_WIDTH * GBA_HEIGHT, sizeof(uint32_t));
    core->save_buffer = malloc(SIZE_CART_FLASH1M);
    if (!core->video || !core->save_buffer) {
        free(core->video);
        free(core->save_buffer);
        free(core);
        return NULL;
    }
    /* Flash erase state, matching the libretro port. */
    memset(core->save_buffer, 0xFF, SIZE_CART_FLASH1M);
    return core;
}

static void gba_destroy(EmuCore *core) {
    if (!core) {
        return;
    }
    if (core->mcore) {
        core->mcore->deinit(core->mcore);
    }
    free(core->drain);
    free(core->rom_copy);
    free(core->save_buffer);
    free(core->video);
    free(core);
}

static void gba_describe(const EmuCore *core, EmuCoreDesc *out_desc) {
    (void)core;
    static const char *const no_files[] = { NULL };
    memset(out_desc, 0, sizeof(*out_desc));
    out_desc->system = EMU_SYSTEM_GBA;
    out_desc->name = "gba-mgba";
    out_desc->version = "0.10.5";
    out_desc->screen_count = 1;
    out_desc->screens[0].width = GBA_WIDTH;
    out_desc->screens[0].height = GBA_HEIGHT;
    out_desc->screens[0].has_touch = 0;
    /* 16.777216 MHz / 280896 cycles per frame. */
    out_desc->native_fps = 59.7275;
    out_desc->audio_sample_rate = SAMPLE_RATE;
    out_desc->buttons_used = EMU_BTN_A | EMU_BTN_B | EMU_BTN_L | EMU_BTN_R |
                             EMU_BTN_START | EMU_BTN_SELECT | EMU_BTN_UP |
                             EMU_BTN_DOWN | EMU_BTN_LEFT | EMU_BTN_RIGHT;
    out_desc->has_circle_pad = 0;
    out_desc->required_files = no_files;
}

static EmuStatus gba_load_system_file(EmuCore *core, const char *name,
                                      const uint8_t *data, size_t size) {
    (void)core;
    (void)data;
    (void)size;
    if (!name) {
        return EMU_ERR_INVALID_ARG;
    }
    /* HLE BIOS path: no system files needed or accepted. */
    return EMU_ERR_UNSUPPORTED;
}

static EmuStatus gba_load_rom(EmuCore *core, const uint8_t *data, size_t size) {
    if (!data || size == 0) {
        return EMU_ERR_BAD_ROM;
    }
    if (core->loaded) {
        return EMU_ERR_INTERNAL; /* one ROM per instance */
    }

    core->rom_copy = malloc(size);
    if (!core->rom_copy) {
        return EMU_ERR_INTERNAL;
    }
    memcpy(core->rom_copy, data, size);
    core->rom_size = size;

    struct VFile *rom = VFileFromMemory(core->rom_copy, size);
    if (!rom) {
        return EMU_ERR_INTERNAL;
    }

    struct mCore *m = GBACoreCreate();
    if (!m) {
        rom->close(rom);
        return EMU_ERR_INTERNAL;
    }
    mCoreInitConfig(m, NULL);
    if (!m->init(m)) {
        rom->close(rom);
        m->deinit(m);
        return EMU_ERR_INTERNAL;
    }

    m->setVideoBuffer(m, core->video, GBA_WIDTH);

    /* Nominal samples per frame at the output rate, doubled for wriggle
     * room, capped at blip's hard limit (mirrors libretro.c). */
    size_t samples_per_frame =
        (size_t)((double)SAMPLE_RATE * (double)m->frameCycles(m) /
                 (double)m->frequency(m));
    size_t internal_buffer = samples_per_frame * 2;
    if (internal_buffer > 0x4000) {
        internal_buffer = 0x4000;
    }
    m->setAudioBufferSize(m, internal_buffer);
    blip_set_rates(m->getAudioChannel(m, 0), m->frequency(m), SAMPLE_RATE);
    blip_set_rates(m->getAudioChannel(m, 1), m->frequency(m), SAMPLE_RATE);

    core->drain_frames = internal_buffer;
    core->drain = malloc(core->drain_frames * 2 * sizeof(int16_t));
    if (!core->drain) {
        rom->close(rom);
        m->deinit(m);
        return EMU_ERR_INTERNAL;
    }

    if (!m->loadROM(m, rom)) {
        /* loadROM takes ownership on success only. */
        rom->close(rom);
        m->deinit(m);
        return EMU_ERR_BAD_ROM;
    }

    /* Battery save lives in a fixed adapter-owned buffer; mGBA detects
     * the save type from game behavior (libretro.c's approach). */
    struct VFile *save = VFileFromMemory(core->save_buffer, SIZE_CART_FLASH1M);
    if (save && !m->loadSave(m, save)) {
        save->close(save);
    }

    m->reset(m);

    core->mcore = m;
    core->loaded = 1;
    return EMU_OK;
}

static void gba_reset(EmuCore *core) {
    if (core->mcore) {
        core->mcore->reset(core->mcore);
    }
}

static void gba_run_frame(EmuCore *core) {
    struct mCore *m = core->mcore;
    if (!m) {
        return;
    }
    m->runFrame(m);

    /* Drain this frame's audio into the ring. blip's "interleaved" flag
     * writes every other sample; left at even, right at odd indices. */
    blip_t *left = m->getAudioChannel(m, 0);
    blip_t *right = m->getAudioChannel(m, 1);
    int avail = blip_samples_avail(left);
    if (avail <= 0) {
        return;
    }
    if ((size_t)avail > core->drain_frames) {
        avail = (int)core->drain_frames;
    }
    int produced = blip_read_samples(left, core->drain, avail, 1);
    blip_read_samples(right, core->drain + 1, avail, 1);
    if (produced <= 0) {
        return;
    }

    uint64_t wr = atomic_load_explicit(&core->ring_write, memory_order_relaxed);
    uint64_t rd = atomic_load_explicit(&core->ring_read, memory_order_acquire);
    uint64_t space = RING_FRAMES - (wr - rd);
    uint64_t to_write = (uint64_t)produced;
    if (to_write > space) {
        to_write = space; /* ring full: drop the tail, keep cadence */
    }
    for (uint64_t i = 0; i < to_write; i++) {
        size_t slot = (size_t)((wr + i) % RING_FRAMES);
        core->ring[slot * 2] = core->drain[i * 2];
        core->ring[slot * 2 + 1] = core->drain[i * 2 + 1];
    }
    atomic_store_explicit(&core->ring_write, wr + to_write,
                          memory_order_release);
}

static void gba_get_video(const EmuCore *core, uint32_t screen,
                          EmuVideoBuffer *out) {
    memset(out, 0, sizeof(*out));
    if (screen != 0) {
        return;
    }
    out->pixels = core->video;
    out->width = GBA_WIDTH;
    out->height = GBA_HEIGHT;
    out->stride_pixels = GBA_WIDTH;
}

static uint32_t gba_read_audio(EmuCore *core, int16_t *out,
                               uint32_t max_frames) {
    uint64_t rd = atomic_load_explicit(&core->ring_read, memory_order_relaxed);
    uint64_t wr = atomic_load_explicit(&core->ring_write, memory_order_acquire);
    uint64_t have = wr - rd;
    uint64_t n = max_frames < have ? max_frames : have;
    for (uint64_t i = 0; i < n; i++) {
        size_t slot = (size_t)((rd + i) % RING_FRAMES);
        out[i * 2] = core->ring[slot * 2];
        out[i * 2 + 1] = core->ring[slot * 2 + 1];
    }
    atomic_store_explicit(&core->ring_read, rd + n, memory_order_release);
    return (uint32_t)n;
}

static void gba_set_input(EmuCore *core, const EmuInputState *input) {
    if (core->mcore) {
        core->mcore->setKeys(core->mcore, map_keys(input->buttons));
    }
}

static size_t gba_state_size(const EmuCore *core) {
    if (!core->mcore) {
        return 0;
    }
    return core->mcore->stateSize(core->mcore);
}

static EmuStatus gba_state_save(const EmuCore *core, uint8_t *out,
                                size_t size) {
    if (!core->mcore) {
        return EMU_ERR_INVALID_ARG;
    }
    if (size < core->mcore->stateSize(core->mcore)) {
        return EMU_ERR_INVALID_ARG;
    }
    if (!core->mcore->saveState(core->mcore, out)) {
        return EMU_ERR_INTERNAL;
    }
    return EMU_OK;
}

static EmuStatus gba_state_load(EmuCore *core, const uint8_t *data,
                                size_t size) {
    if (!core->mcore) {
        return EMU_ERR_INVALID_ARG;
    }
    if (size < core->mcore->stateSize(core->mcore)) {
        return EMU_ERR_BAD_STATE;
    }
    if (!core->mcore->loadState(core->mcore, data)) {
        return EMU_ERR_BAD_STATE;
    }
    return EMU_OK;
}

static size_t gba_save_data_size(const EmuCore *core) {
    if (!core->mcore) {
        return 0;
    }
    const struct GBA *gba = core->mcore->board;
    return GBASavedataSize(&gba->memory.savedata);
}

static EmuStatus gba_save_data_read(const EmuCore *core, uint8_t *out,
                                    size_t size) {
    size_t want = gba_save_data_size(core);
    if (want == 0) {
        return EMU_ERR_UNSUPPORTED;
    }
    if (size < want) {
        return EMU_ERR_INVALID_ARG;
    }
    memcpy(out, core->save_buffer, want);
    return EMU_OK;
}

static EmuStatus gba_save_data_write(EmuCore *core, const uint8_t *data,
                                     size_t size) {
    if (!data || size == 0 || size > SIZE_CART_FLASH1M) {
        return EMU_ERR_INVALID_ARG;
    }
    memcpy(core->save_buffer, data, size);
    return EMU_OK;
}

static const EmuCoreApi g_gba_api = {
    gba_create,
    gba_destroy,
    gba_describe,
    gba_load_system_file,
    gba_load_rom,
    gba_reset,
    gba_run_frame,
    gba_get_video,
    gba_read_audio,
    gba_set_input,
    gba_state_size,
    gba_state_save,
    gba_state_load,
    gba_save_data_size,
    gba_save_data_read,
    gba_save_data_write,
};

const EmuCoreApi *emu_gba_api(void) {
    return &g_gba_api;
}
