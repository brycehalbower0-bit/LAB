/*
 * null_core.c — a deliberately trivial core implementing the full
 * EmuCoreApi contract (core_api.h), in plain C.
 *
 * Purpose: prove the shared ABI end-to-end before any real core exists —
 * C compilability, the create/describe/load/run/video/audio/input flow,
 * save-state determinism (same state in, same pixels out), save-data
 * roundtrip, and the decrypted-only rejection contract. This is what the
 * app shell and the real cores are both written against.
 *
 * The "system" is: two 256x192 screens whose pixels are a pure function of
 * the frame counter, a 512-frames-per-video-frame audio ramp, input echoed
 * into the framebuffer hash, and a 128-byte battery save.
 */

#include <stdlib.h>
#include <string.h>

#include "core_api.h"

enum {
    kWidth = 256,
    kHeight = 192,
    kAudioFramesPerVideoFrame = 512,
    kAudioRingFrames = 8192,
    kSaveDataSize = 128,
    kStateMagic = 0x4E554C43u, /* "NULC" */
};

struct EmuCore {
    uint32_t frame_counter;
    EmuInputState input;
    uint32_t rom_hash;
    int rom_loaded;

    uint32_t video[2][kWidth * kHeight];
    int16_t audio_ring[kAudioRingFrames * 2];
    uint32_t audio_write; /* frames ever written */
    uint32_t audio_read;  /* frames ever read */

    uint8_t save_data[kSaveDataSize];
};

/* Serialized architectural state — everything needed to reproduce output. */
typedef struct NullState {
    uint32_t magic;
    uint32_t frame_counter;
    uint32_t rom_hash;
    EmuInputState input;
    uint8_t save_data[kSaveDataSize];
} NullState;

static uint32_t mix(uint32_t x) {
    x ^= x >> 16;
    x *= 2654435761u;
    x ^= x >> 13;
    return x;
}

static EmuCore *null_create(void) {
    return (EmuCore *)calloc(1, sizeof(EmuCore));
}

static void null_destroy(EmuCore *core) { free(core); }

static void null_describe(const EmuCore *core, EmuCoreDesc *out) {
    static const char *const no_files[] = {NULL};
    (void)core;
    memset(out, 0, sizeof(*out));
    out->system = EMU_SYSTEM_NDS;
    out->name = "null-core";
    out->version = "0.1";
    out->screen_count = 2;
    out->screens[0].width = kWidth;
    out->screens[0].height = kHeight;
    out->screens[0].has_touch = 0;
    out->screens[1].width = kWidth;
    out->screens[1].height = kHeight;
    out->screens[1].has_touch = 1;
    out->native_fps = 60.0;
    out->audio_sample_rate = 32768;
    out->buttons_used = EMU_BTN_A | EMU_BTN_B | EMU_BTN_START |
                        EMU_BTN_SELECT | EMU_BTN_UP | EMU_BTN_DOWN |
                        EMU_BTN_LEFT | EMU_BTN_RIGHT;
    out->has_circle_pad = 0;
    out->required_files = no_files;
}

static EmuStatus null_load_system_file(EmuCore *core, const char *name,
                                       const uint8_t *data, size_t size) {
    (void)core;
    (void)data;
    (void)size;
    if (!name) return EMU_ERR_INVALID_ARG;
    return EMU_ERR_UNSUPPORTED; /* null core needs no system files */
}

static EmuStatus null_load_rom(EmuCore *core, const uint8_t *data,
                               size_t size) {
    size_t i;
    uint32_t hash = 0x811C9DC5u;
    if (!data || size == 0) return EMU_ERR_BAD_ROM;
    /*
     * The decrypted-only contract (PLAN.md §2.1): content that looks
     * encrypted is REJECTED, never decrypted. The null core's stand-in
     * marker for "encrypted" is a 0xEE first byte.
     */
    if (data[0] == 0xEE) return EMU_ERR_ENCRYPTED_CONTENT;
    for (i = 0; i < size; ++i) hash = (hash ^ data[i]) * 16777619u;
    core->rom_hash = hash;
    core->rom_loaded = 1;
    core->frame_counter = 0;
    return EMU_OK;
}

static void null_reset(EmuCore *core) {
    core->frame_counter = 0;
    core->audio_read = 0;
    core->audio_write = 0;
    memset(&core->input, 0, sizeof(core->input));
}

static void render(EmuCore *core) {
    uint32_t s, i;
    const uint32_t seed =
        mix(core->frame_counter ^ core->rom_hash ^ core->input.buttons);
    for (s = 0; s < 2; ++s)
        for (i = 0; i < kWidth * kHeight; ++i)
            core->video[s][i] = mix(seed ^ (s << 30) ^ i);
}

static void null_run_frame(EmuCore *core) {
    uint32_t i;
    core->frame_counter++;
    render(core);
    for (i = 0; i < kAudioFramesPerVideoFrame; ++i) {
        const uint32_t slot = (core->audio_write + i) % kAudioRingFrames;
        const int16_t sample =
            (int16_t)((core->frame_counter * 31 + i * 7) & 0x3FFF);
        core->audio_ring[slot * 2] = sample;
        core->audio_ring[slot * 2 + 1] = (int16_t)-sample;
    }
    core->audio_write += kAudioFramesPerVideoFrame;
}

static void null_get_video(const EmuCore *core, uint32_t screen,
                           EmuVideoBuffer *out) {
    out->pixels = core->video[screen < 2 ? screen : 0];
    out->width = kWidth;
    out->height = kHeight;
    out->stride_pixels = kWidth;
}

static uint32_t null_read_audio(EmuCore *core, int16_t *out,
                                uint32_t max_frames) {
    uint32_t available = core->audio_write - core->audio_read;
    uint32_t n, i;
    if (available > kAudioRingFrames) { /* overrun: drop to newest window */
        core->audio_read = core->audio_write - kAudioRingFrames;
        available = kAudioRingFrames;
    }
    n = available < max_frames ? available : max_frames;
    for (i = 0; i < n; ++i) {
        const uint32_t slot = (core->audio_read + i) % kAudioRingFrames;
        out[i * 2] = core->audio_ring[slot * 2];
        out[i * 2 + 1] = core->audio_ring[slot * 2 + 1];
    }
    core->audio_read += n;
    return n;
}

static void null_set_input(EmuCore *core, const EmuInputState *input) {
    core->input = *input;
}

static size_t null_state_size(const EmuCore *core) {
    (void)core;
    return sizeof(NullState);
}

static EmuStatus null_state_save(const EmuCore *core, uint8_t *out,
                                 size_t size) {
    NullState st;
    if (size < sizeof(NullState)) return EMU_ERR_INVALID_ARG;
    memset(&st, 0, sizeof(st));
    st.magic = kStateMagic;
    st.frame_counter = core->frame_counter;
    st.rom_hash = core->rom_hash;
    st.input = core->input;
    memcpy(st.save_data, core->save_data, kSaveDataSize);
    memcpy(out, &st, sizeof(st));
    return EMU_OK;
}

static EmuStatus null_state_load(EmuCore *core, const uint8_t *data,
                                 size_t size) {
    NullState st;
    if (size < sizeof(NullState)) return EMU_ERR_BAD_STATE;
    memcpy(&st, data, sizeof(st));
    if (st.magic != kStateMagic) return EMU_ERR_BAD_STATE;
    core->frame_counter = st.frame_counter;
    core->rom_hash = st.rom_hash;
    core->input = st.input;
    memcpy(core->save_data, st.save_data, kSaveDataSize);
    render(core); /* video is a pure function of state — regenerate it */
    return EMU_OK;
}

static size_t null_save_data_size(const EmuCore *core) {
    (void)core;
    return kSaveDataSize;
}

static EmuStatus null_save_data_read(const EmuCore *core, uint8_t *out,
                                     size_t size) {
    if (size < kSaveDataSize) return EMU_ERR_INVALID_ARG;
    memcpy(out, core->save_data, kSaveDataSize);
    return EMU_OK;
}

static EmuStatus null_save_data_write(EmuCore *core, const uint8_t *data,
                                      size_t size) {
    if (size != kSaveDataSize) return EMU_ERR_INVALID_ARG;
    memcpy(core->save_data, data, kSaveDataSize);
    return EMU_OK;
}

const EmuCoreApi *emu_null_api(void) {
    static const EmuCoreApi api = {
        null_create,
        null_destroy,
        null_describe,
        null_load_system_file,
        null_load_rom,
        null_reset,
        null_run_frame,
        null_get_video,
        null_read_audio,
        null_set_input,
        null_state_size,
        null_state_save,
        null_state_load,
        null_save_data_size,
        null_save_data_read,
        null_save_data_write,
    };
    return &api;
}
