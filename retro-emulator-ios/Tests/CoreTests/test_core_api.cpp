// test_core_api.cpp — exercises the full EmuCoreApi contract against the
// null core, from C++ (the bridge layer's language), while the core itself
// is compiled as plain C. Together they pin the ABI from both sides.

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

#include "core_api.h"

extern "C" const EmuCoreApi *emu_null_api(void);

static int g_failures = 0;

#define CHECK(cond, msg)                                                      \
    do {                                                                      \
        if (!(cond)) {                                                        \
            std::printf("FAIL %s:%d: %s\n", __FILE__, __LINE__, msg);         \
            ++g_failures;                                                     \
        }                                                                     \
    } while (0)

int main() {
    const EmuCoreApi *api = emu_null_api();
    EmuCore *core = api->create();
    CHECK(core != nullptr, "create");

    // describe() before any load — drives the import UI.
    EmuCoreDesc desc;
    api->describe(core, &desc);
    CHECK(desc.screen_count == 2, "screen count");
    CHECK(desc.screens[1].has_touch == 1, "bottom screen touch");
    CHECK(desc.required_files != nullptr && desc.required_files[0] == nullptr,
          "required-files list is present and empty");

    // ROM loading: rejections first.
    CHECK(api->load_rom(core, nullptr, 0) == EMU_ERR_BAD_ROM, "null rom");
    const uint8_t encrypted[4] = {0xEE, 1, 2, 3};
    CHECK(api->load_rom(core, encrypted, 4) == EMU_ERR_ENCRYPTED_CONTENT,
          "encrypted content must be rejected, never decrypted");

    const uint8_t rom[8] = {1, 2, 3, 4, 5, 6, 7, 8};
    CHECK(api->load_rom(core, rom, 8) == EMU_OK, "load rom");
    api->reset(core);

    // Run frames; video must change frame-to-frame and audio must accrue.
    api->run_frame(core);
    EmuVideoBuffer frame1;
    api->get_video(core, 0, &frame1);
    std::vector<uint32_t> pixels1(frame1.pixels,
                                  frame1.pixels + frame1.width * frame1.height);

    api->run_frame(core);
    EmuVideoBuffer frame2;
    api->get_video(core, 0, &frame2);
    CHECK(std::memcmp(pixels1.data(), frame2.pixels,
                      pixels1.size() * sizeof(uint32_t)) != 0,
          "video changes between frames");

    std::vector<int16_t> audio(4096 * 2);
    const uint32_t drained = api->read_audio(core, audio.data(), 4096);
    CHECK(drained == 1024, "two frames -> 1024 audio frames");
    CHECK(api->read_audio(core, audio.data(), 4096) == 0,
          "audio drains to empty");

    // Input affects output.
    EmuInputState input = {};
    input.buttons = EMU_BTN_A | EMU_BTN_UP;
    api->set_input(core, &input);
    api->run_frame(core);
    EmuVideoBuffer frame3;
    api->get_video(core, 0, &frame3);

    // Save-state roundtrip: capture, advance, restore, compare pixels.
    const size_t state_size = api->state_size(core);
    CHECK(state_size > 0, "state size");
    std::vector<uint8_t> state(state_size);
    CHECK(api->state_save(core, state.data(), state.size()) == EMU_OK,
          "state save");
    std::vector<uint32_t> pixels_at_save(
        frame3.pixels, frame3.pixels + frame3.width * frame3.height);

    for (int i = 0; i < 10; ++i) api->run_frame(core);
    EmuVideoBuffer diverged;
    api->get_video(core, 0, &diverged);
    CHECK(std::memcmp(pixels_at_save.data(), diverged.pixels,
                      pixels_at_save.size() * sizeof(uint32_t)) != 0,
          "state diverged after more frames");

    CHECK(api->state_load(core, state.data(), state.size()) == EMU_OK,
          "state load");
    EmuVideoBuffer restored;
    api->get_video(core, 0, &restored);
    CHECK(std::memcmp(pixels_at_save.data(), restored.pixels,
                      pixels_at_save.size() * sizeof(uint32_t)) == 0,
          "restored state reproduces exact pixels");

    // Corrupt state must be rejected.
    std::vector<uint8_t> bad(state);
    bad[0] ^= 0xFF;
    CHECK(api->state_load(core, bad.data(), bad.size()) == EMU_ERR_BAD_STATE,
          "corrupt state rejected");

    // Battery-save roundtrip.
    const size_t save_size = api->save_data_size(core);
    CHECK(save_size == 128, "save data size");
    std::vector<uint8_t> save_in(save_size);
    for (size_t i = 0; i < save_size; ++i) save_in[i] = (uint8_t)(i * 3);
    CHECK(api->save_data_write(core, save_in.data(), save_in.size()) == EMU_OK,
          "save data write");
    std::vector<uint8_t> save_out(save_size);
    CHECK(api->save_data_read(core, save_out.data(), save_out.size()) ==
              EMU_OK,
          "save data read");
    CHECK(save_in == save_out, "save data roundtrip");

    api->destroy(core);

    if (g_failures == 0) {
        std::printf("all core-api tests passed\n");
        return EXIT_SUCCESS;
    }
    std::printf("%d core-api test(s) FAILED\n", g_failures);
    return EXIT_FAILURE;
}
