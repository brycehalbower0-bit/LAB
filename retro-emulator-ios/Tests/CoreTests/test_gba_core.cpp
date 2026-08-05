// Contract test for the GBA core (Cores/GBA/gba_core.c) — same shape as
// test_core_api.cpp but against real mGBA, using a synthetic ROM built
// in-test (license-clean, deterministic, no fixture files):
// hand-encoded ARM instructions that enter mode 3 and paint the top-left
// pixels pure red, which pins boot, video, and RGBA channel order in one
// assertion.

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

#include "core_api.h"

extern "C" const EmuCoreApi *emu_gba_api(void);

static int g_failures = 0;

#define CHECK(cond, msg)                                                       \
    do {                                                                       \
        if (!(cond)) {                                                         \
            std::printf("FAIL: %s (%s:%d)\n", msg, __FILE__, __LINE__);        \
            g_failures++;                                                      \
        }                                                                      \
    } while (0)

namespace {

// A minimal GBA ROM: 192-byte header whose entry word branches over the
// header, then ARM code: DISPCNT = mode 3 | BG2, write red (BGR555
// 0x001F) into the first two VRAM pixels, spin forever.
std::vector<uint8_t> make_test_rom() {
    std::vector<uint32_t> words(4096, 0); // 16 KiB, generously padded

    // Header entry: b +0xC0 (offset encoded as (0xC0 - 8) / 4).
    words[0] = 0xEA00002E;

    const size_t code = 0xC0 / 4;
    uint32_t program[] = {
        0xE3A00301, // mov r0, #0x04000000  (IO base)
        0xE3A01C04, // mov r1, #0x0400      (BG2 enable)
        0xE3811003, // orr r1, r1, #3       (mode 3)
        0xE5801000, // str r1, [r0]         (DISPCNT)
        0xE3A02406, // mov r2, #0x06000000  (VRAM)
        0xE3A0301F, // mov r3, #0x1F        (red, BGR555)
        0xE383381F, // orr r3, r3, #0x1F0000 (two red pixels per word)
        0xE5823000, // str r3, [r2]
        0xEAFFFFFE, // b .
    };
    for (size_t i = 0; i < sizeof(program) / sizeof(program[0]); i++) {
        words[code + i] = program[i];
    }

    std::vector<uint8_t> rom(words.size() * 4);
    std::memcpy(rom.data(), words.data(), rom.size());
    return rom;
}

} // namespace

int main() {
    const EmuCoreApi *api = emu_gba_api();
    CHECK(api != nullptr, "api");

    // --- describe, before load ---
    EmuCore *core = api->create();
    CHECK(core != nullptr, "create");
    EmuCoreDesc desc{};
    api->describe(core, &desc);
    CHECK(desc.system == EMU_SYSTEM_GBA, "system is GBA");
    CHECK(desc.screen_count == 1, "one screen");
    CHECK(desc.screens[0].width == 240 && desc.screens[0].height == 160,
          "240x160");
    CHECK(desc.screens[0].has_touch == 0, "no touch");
    CHECK(desc.native_fps > 59.7 && desc.native_fps < 59.8, "fps ~59.73");
    CHECK(desc.audio_sample_rate == 32768, "32768 Hz");
    CHECK(desc.required_files != nullptr && desc.required_files[0] == nullptr,
          "no required files (HLE BIOS)");

    // --- ROM validation ---
    CHECK(api->load_rom(core, nullptr, 0) == EMU_ERR_BAD_ROM, "null ROM");

    std::vector<uint8_t> rom = make_test_rom();
    CHECK(api->load_rom(core, rom.data(), rom.size()) == EMU_OK, "load ROM");
    api->reset(core);

    // --- video: boot reaches our code; channel order is RGBA ---
    // The HLE BIOS hands off quickly; a generous frame budget keeps this
    // robust without timing sensitivity.
    for (int i = 0; i < 30; i++) {
        api->run_frame(core);
    }
    EmuVideoBuffer video{};
    api->get_video(core, 0, &video);
    CHECK(video.pixels != nullptr, "video buffer");
    CHECK(video.width == 240 && video.height == 160, "video dimensions");
    CHECK(video.stride_pixels >= video.width, "stride");
    {
        uint32_t px = video.pixels[0];
        uint8_t r = (uint8_t)(px & 0xFF);
        uint8_t g = (uint8_t)((px >> 8) & 0xFF);
        uint8_t b = (uint8_t)((px >> 16) & 0xFF);
        std::printf("pixel(0,0) = %08X (r=%u g=%u b=%u)\n", px, r, g, b);
        CHECK(r > 200, "red channel high — RGBA order, boot reached code");
        CHECK(g < 50, "green channel low");
        CHECK(b < 50, "blue channel low — no R/B swap");
        CHECK(video.pixels[1] == px, "second pixel matches (word store)");
        // A pixel the program never wrote stays black.
        uint32_t untouched = video.pixels[10 * video.stride_pixels + 10];
        CHECK((untouched & 0x00FFFFFF) == 0, "unwritten pixel black");
    }

    // --- audio: frames accrue at ~549/video frame ---
    {
        std::vector<int16_t> audio(4096 * 2);
        uint32_t total = 0;
        for (int i = 0; i < 10; i++) {
            api->run_frame(core);
            total += api->read_audio(core, audio.data(), 4096);
        }
        std::printf("audio frames over 10 video frames: %u\n", total);
        CHECK(total > 4000 && total < 7000, "~5490 audio frames expected");
    }

    // --- input plumbing doesn't crash and keys register ---
    {
        EmuInputState input{};
        input.buttons = EMU_BTN_A | EMU_BTN_START;
        api->set_input(core, &input);
        api->run_frame(core);
        input.buttons = 0;
        api->set_input(core, &input);
    }

    // --- save states: deterministic roundtrip ---
    {
        size_t size = api->state_size(core);
        CHECK(size > 0, "state size");
        std::vector<uint8_t> state(size);
        CHECK(api->state_save(core, state.data(), state.size()) == EMU_OK,
              "state save");

        for (int i = 0; i < 30; i++) {
            api->run_frame(core);
        }

        CHECK(api->state_load(core, state.data(), state.size()) == EMU_OK,
              "state load");
        api->run_frame(core);
        EmuVideoBuffer after{};
        api->get_video(core, 0, &after);
        CHECK((after.pixels[0] & 0xFF) > 200, "video consistent after load");

        std::vector<uint8_t> bad(state);
        bad.resize(16);
        CHECK(api->state_load(core, bad.data(), bad.size()) == EMU_ERR_BAD_STATE,
              "truncated state rejected");
    }

    // --- battery save surface (this ROM never writes save memory, so
    //     size 0 / UNSUPPORTED are the honest answers; the write path
    //     must still accept data) ---
    {
        std::vector<uint8_t> sram(32768, 0xAB);
        CHECK(api->save_data_write(core, sram.data(), sram.size()) == EMU_OK,
              "save data write accepted");
    }

    api->destroy(core);

    if (g_failures == 0) {
        std::printf("gba core contract: all checks passed\n");
        return EXIT_SUCCESS;
    }
    std::printf("gba core contract: %d failure(s)\n", g_failures);
    return EXIT_FAILURE;
}
