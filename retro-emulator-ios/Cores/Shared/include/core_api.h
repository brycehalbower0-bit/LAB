/*
 * core_api.h — the shared C ABI every emulation core implements (PLAN.md §5.1).
 *
 * The app shell (EmulatorKit) talks to whichever core is active exclusively
 * through this interface. Cores are portable C/C++ with no Apple API
 * references; this header must stay includable from C, C++, and via Swift's
 * C interop, and buildable on macOS/Linux for headless testing.
 *
 * Per-system differences (screen count, touch, analog input, required system
 * files) are expressed as data via EmuCoreDesc — never as system-specific
 * branches in the shell.
 */

#ifndef RETRO_EMU_CORE_API_H
#define RETRO_EMU_CORE_API_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum EmuSystem {
    EMU_SYSTEM_GBA = 0,
    EMU_SYSTEM_NDS = 1,
    EMU_SYSTEM_3DS = 2,
} EmuSystem;

typedef enum EmuStatus {
    EMU_OK = 0,
    EMU_ERR_INVALID_ARG = -1,
    EMU_ERR_BAD_ROM = -2,
    EMU_ERR_MISSING_SYSTEM_FILE = -3,
    EMU_ERR_BAD_STATE = -4,          /* save state corrupt or wrong version */
    EMU_ERR_UNSUPPORTED = -5,
    EMU_ERR_INTERNAL = -6,
    /*
     * Returned when content appears to be encrypted. By design (PLAN.md §2.1)
     * cores contain no key handling and no decryption paths; encrypted
     * content is rejected, never decrypted.
     */
    EMU_ERR_ENCRYPTED_CONTENT = -7,
} EmuStatus;

/* Button bits, superset across systems; core_describe() reports which are used. */
enum {
    EMU_BTN_A      = 1u << 0,
    EMU_BTN_B      = 1u << 1,
    EMU_BTN_X      = 1u << 2,
    EMU_BTN_Y      = 1u << 3,
    EMU_BTN_L      = 1u << 4,
    EMU_BTN_R      = 1u << 5,
    EMU_BTN_ZL     = 1u << 6,   /* New 3DS only */
    EMU_BTN_ZR     = 1u << 7,   /* New 3DS only */
    EMU_BTN_START  = 1u << 8,
    EMU_BTN_SELECT = 1u << 9,
    EMU_BTN_UP     = 1u << 10,
    EMU_BTN_DOWN   = 1u << 11,
    EMU_BTN_LEFT   = 1u << 12,
    EMU_BTN_RIGHT  = 1u << 13,
};

typedef struct EmuScreenDesc {
    uint32_t width;
    uint32_t height;
    int32_t  has_touch;          /* 1 if this screen is a touch surface */
} EmuScreenDesc;

#define EMU_MAX_SCREENS 2

typedef struct EmuCoreDesc {
    EmuSystem   system;
    const char *name;            /* e.g. "melonDS-core" */
    const char *version;
    uint32_t    screen_count;    /* 1 (GBA) or 2 (NDS, 3DS) */
    EmuScreenDesc screens[EMU_MAX_SCREENS];
    double      native_fps;      /* e.g. 59.7275 (GBA), 59.8261 (NDS) */
    uint32_t    audio_sample_rate; /* native output rate before resampling */
    uint32_t    buttons_used;    /* mask of EMU_BTN_* this system has */
    int32_t     has_circle_pad;  /* 1 for 3DS analog input */
    /*
     * NULL-terminated list of required user-supplied system file names
     * (e.g. "bios7.bin"). Drives the import UI. Empty list means the core
     * can run with no system files (HLE BIOS path).
     */
    const char *const *required_files;
} EmuCoreDesc;

typedef struct EmuInputState {
    uint32_t buttons;            /* mask of EMU_BTN_* currently held */
    int32_t  touch_down;
    uint16_t touch_x;            /* in touch-screen native pixels */
    uint16_t touch_y;
    int16_t  analog_x;           /* circle pad, -32768..32767; 0 when absent */
    int16_t  analog_y;
} EmuInputState;

typedef struct EmuVideoBuffer {
    const uint32_t *pixels;      /* RGBA8888, tightly packed rows unless stride set */
    uint32_t width;
    uint32_t height;
    uint32_t stride_pixels;      /* row stride in pixels (>= width) */
} EmuVideoBuffer;

/* Opaque per-instance core state. */
typedef struct EmuCore EmuCore;

/*
 * The full core interface as a table of function pointers. Each core exposes
 * exactly one public symbol returning its table:
 *
 *   const EmuCoreApi *emu_gba_api(void);
 *   const EmuCoreApi *emu_nds_api(void);
 *   const EmuCoreApi *emu_3ds_api(void);
 *
 * All functions are called from the emulation thread only, except where noted.
 */
typedef struct EmuCoreApi {
    EmuCore  *(*create)(void);
    void      (*destroy)(EmuCore *core);

    /* Callable before load_rom; fills a caller-owned desc. Thread-safe. */
    void      (*describe)(const EmuCore *core, EmuCoreDesc *out_desc);

    /*
     * System files (BIOS etc.) are pushed in by name before load_rom.
     * The core copies what it needs; the caller owns `data`.
     */
    EmuStatus (*load_system_file)(EmuCore *core, const char *name,
                                  const uint8_t *data, size_t size);

    EmuStatus (*load_rom)(EmuCore *core, const uint8_t *data, size_t size);
    void      (*reset)(EmuCore *core);

    /* Runs exactly one guest video frame. */
    void      (*run_frame)(EmuCore *core);

    /*
     * Valid until the next run_frame call. `screen` indexes EmuCoreDesc.screens.
     */
    void      (*get_video)(const EmuCore *core, uint32_t screen,
                           EmuVideoBuffer *out);

    /*
     * Drains up to max_frames stereo frames (2 interleaved s16 per frame)
     * produced since the last call; returns frames written. Wait-free:
     * callable from the realtime audio thread.
     */
    uint32_t  (*read_audio)(EmuCore *core, int16_t *out, uint32_t max_frames);

    void      (*set_input)(EmuCore *core, const EmuInputState *input);

    /*
     * Save states serialize architectural state only — never backend-internal
     * caches — so states are portable across CPU backends (PLAN.md §6.4) and
     * across app builds.
     */
    size_t    (*state_size)(const EmuCore *core);
    EmuStatus (*state_save)(const EmuCore *core, uint8_t *out, size_t size);
    EmuStatus (*state_load)(EmuCore *core, const uint8_t *data, size_t size);

    /* Cartridge/game-card backup memory (battery saves), distinct from states. */
    size_t    (*save_data_size)(const EmuCore *core);
    EmuStatus (*save_data_read)(const EmuCore *core, uint8_t *out, size_t size);
    EmuStatus (*save_data_write)(EmuCore *core, const uint8_t *data, size_t size);

    /*
     * OPTIONAL (may be NULL; added after the v1 vtable — cores using
     * positional initializers without it get NULL here, which is valid).
     * Path-based ROM loading for cores whose loaders are file-backed and
     * whose content is too large to double-buffer in memory (3DS: up to
     * 4 GB). The shell prefers this over load_rom when non-NULL.
     */
    EmuStatus (*load_rom_path)(EmuCore *core, const char *path);

    /*
     * OPTIONAL (may be NULL). Human-readable core-internal state, for
     * on-device triage: without it, "core silently not executing" and
     * "core running fine" look identical from the shell -- both just
     * report a frame rate. Returns a NUL-terminated string owned by the
     * core, valid until the next call. Not thread-safe; call from the
     * emulation thread or while stopped.
     */
    const char *(*diagnostics)(EmuCore *core);
} EmuCoreApi;

#ifdef __cplusplus
} /* extern "C" */
#endif

#endif /* RETRO_EMU_CORE_API_H */
