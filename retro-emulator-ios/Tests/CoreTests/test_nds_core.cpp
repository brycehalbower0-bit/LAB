// Contract test for the NDS core (Cores/NDS/nds_core.cpp) against real
// melonDS with FreeBIOS + generated firmware, using a synthetic ROM
// built in-test (license-clean, no fixtures): a minimal NDS header
// whose ARM9 writes a red pixel into VRAM in framebuffer mode and
// spins; ARM7 just spins. Pins direct boot, dual-screen video, RGBA
// channel order, audio accrual, and save-state determinism.

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

#include "core_api.h"

extern "C" const EmuCoreApi *emu_nds_api(void);

static int g_failures = 0;

#define CHECK(cond, msg)                                                       \
    do {                                                                       \
        if (!(cond)) {                                                         \
            std::printf("FAIL: %s (%s:%d)\n", msg, __FILE__, __LINE__);        \
            g_failures++;                                                      \
        }                                                                      \
    } while (0)

namespace {

void put32(std::vector<uint8_t> &v, size_t off, uint32_t x) {
    v[off] = (uint8_t)(x & 0xFF);
    v[off + 1] = (uint8_t)((x >> 8) & 0xFF);
    v[off + 2] = (uint8_t)((x >> 16) & 0xFF);
    v[off + 3] = (uint8_t)((x >> 24) & 0xFF);
}

// Minimal direct-bootable NDS ROM. Header fields that matter to
// melonDS's direct boot: ARM9/ARM7 rom offset, entry, load address,
// size; header size. Everything else stays zero.
std::vector<uint8_t> make_test_rom() {
    // Keep binaries clear of 0x4000-0x7FFF: that's the cart secure area,
    // which melonDS Key1-decrypts and overwrites with 0xE7FFDEFF guard
    // words when the plaintext doesn't decrypt (exactly what happens to
    // a hand-built ROM).
    const uint32_t arm9_off = 0x8000;
    const uint32_t arm9_load = 0x02000000;
    const uint32_t arm7_off = 0xA000;
    const uint32_t arm7_load = 0x037F8000; // shared WRAM region for ARM7
    std::vector<uint8_t> rom(0x10000, 0);

    std::memcpy(rom.data(), "EMULABTEST\0\0", 12); // title
    std::memcpy(rom.data() + 12, "####", 4);       // gamecode (homebrew)

    put32(rom, 0x20, arm9_off);  // ARM9 rom offset
    put32(rom, 0x24, arm9_load); // ARM9 entry
    put32(rom, 0x28, arm9_load); // ARM9 load address
    put32(rom, 0x2C, 0x100);     // ARM9 size
    put32(rom, 0x30, arm7_off);  // ARM7 rom offset
    put32(rom, 0x34, arm7_load); // ARM7 entry
    put32(rom, 0x38, arm7_load); // ARM7 load address
    put32(rom, 0x3C, 0x100);     // ARM7 size
    put32(rom, 0x84, 0x200);     // header size

    // ARM9 program:
    //   POWCNT1    = 0x8003      (both LCDs + 2D engine A, A on top)
    //   DISPCNT(A) = 0x00020000  (display mode 2: framebuffer, VRAM A)
    //   VRAMCNT_A  = 0x80        (VRAM A -> LCDC)
    //   VRAM[0]    = 0x801F801F  (two red pixels, ABGR1555)
    //   spin
    const uint32_t arm9_prog[] = {
        0xE3A00404, // mov r0, #0x04000000
        0xE3A05C80, // mov r5, #0x8000
        0xE3855003, // orr r5, r5, #3
        0xE5805304, // str r5, [r0, #0x304]  (POWCNT1)
        0xE3A01802, // mov r1, #0x00020000  (display mode 2, bits 16-17)
        0xE5801000, // str r1, [r0]          (DISPCNT A)
        0xE3A02080, // mov r2, #0x80
        0xE5C02240, // strb r2, [r0, #0x240] (VRAMCNT_A = enable, LCDC)
        0xE3A03406, // mov r3, #0x06000000
        0xE3833480, // orr r3, r3, #0x00800000 (LCDC window: 0x06800000)
        0xE59F4004, // ldr r4, [pc, #4]      (literal below)
        0xE5834000, // str r4, [r3]
        0xEAFFFFFE, // b .
        0x801F801F, // literal: two ABGR1555 red pixels, alpha set
    };
    std::memcpy(rom.data() + arm9_off, arm9_prog, sizeof(arm9_prog));

    // ARM7 program: SOUNDCNT master enable (the SPU only pushes output
    // samples when bit 15 is set), then spin.
    const uint32_t arm7_prog[] = {
        0xE3A00404, // mov r0, #0x04000000
        0xE3A01C80, // mov r1, #0x8000
        0xE5801500, // str r1, [r0, #0x500]  (SOUNDCNT)
        0xEAFFFFFE, // b .
    };
    std::memcpy(rom.data() + arm7_off, arm7_prog, sizeof(arm7_prog));

    return rom;
}

} // namespace

int main() {
    const EmuCoreApi *api = emu_nds_api();
    CHECK(api != nullptr, "api");

    EmuCore *core = api->create();
    CHECK(core != nullptr, "create");

    EmuCoreDesc desc{};
    api->describe(core, &desc);
    CHECK(desc.system == EMU_SYSTEM_NDS, "system is NDS");
    CHECK(desc.screen_count == 2, "two screens");
    CHECK(desc.screens[0].width == 256 && desc.screens[0].height == 192,
          "256x192");
    CHECK(desc.screens[0].has_touch == 0 && desc.screens[1].has_touch == 1,
          "touch on bottom screen only");
    CHECK(desc.native_fps > 59.8 && desc.native_fps < 59.9, "fps ~59.83");
    CHECK(desc.audio_sample_rate == 32768, "32768 Hz");
    CHECK(desc.required_files != nullptr && desc.required_files[0] == nullptr,
          "no required files (FreeBIOS)");

    CHECK(api->load_rom(core, nullptr, 0) == EMU_ERR_BAD_ROM, "null ROM");

    std::vector<uint8_t> rom = make_test_rom();
    EmuStatus loaded = api->load_rom(core, rom.data(), rom.size());
    CHECK(loaded == EMU_OK, "load ROM (direct boot)");
    if (loaded != EMU_OK) {
        std::printf("load_rom returned %d — aborting remaining checks\n",
                    (int)loaded);
        api->destroy(core);
        return EXIT_FAILURE;
    }

    // Direct boot hand-off plus a few frames of margin.
    for (int i = 0; i < 30; i++) {
        api->run_frame(core);
    }

    EmuVideoBuffer top{}, bottom{};
    api->get_video(core, 0, &top);
    api->get_video(core, 1, &bottom);
    CHECK(top.pixels != nullptr && bottom.pixels != nullptr, "both screens");
    CHECK(top.width == 256 && top.height == 192, "top dimensions");

    {
        uint32_t px = top.pixels[0];
        uint8_t r = (uint8_t)(px & 0xFF);
        uint8_t g = (uint8_t)((px >> 8) & 0xFF);
        uint8_t b = (uint8_t)((px >> 16) & 0xFF);
        std::printf("top(0,0) = %08X (r=%u g=%u b=%u), bottom(0,0) = %08X\n",
                    px, r, g, b, bottom.pixels[0]);
        // Diagnostic: where did the red pixel land, if anywhere?
        for (int s = 0; s < 2; s++) {
            const EmuVideoBuffer &v = s == 0 ? top : bottom;
            for (uint32_t i = 0; i < v.width * v.height; i++) {
                uint32_t p = v.pixels[i] & 0x00FFFFFF;
                if (p != (top.pixels[0] & 0x00FFFFFF) && p != 0) {
                    std::printf("screen %d first differing pixel at %u: %08X\n",
                                s, i, v.pixels[i]);
                    break;
                }
            }
        }
        CHECK(r > 200, "red high — boot reached ARM9 code, RGBA order");
        CHECK(g < 50 && b < 50, "green/blue low — no swizzle");
    }

    {
        std::vector<int16_t> audio(4096 * 2);
        while (api->read_audio(core, audio.data(), 4096) != 0) {
        }
        uint32_t total = 0;
        for (int i = 0; i < 10; i++) {
            api->run_frame(core);
            total += api->read_audio(core, audio.data(), 4096);
        }
        std::printf("audio frames over 10 video frames: %u\n", total);
        // 32768 / 59.8261 ≈ 548 per frame.
        CHECK(total > 4000 && total < 7000, "~5480 audio frames expected");
    }

    {
        EmuInputState input{};
        input.buttons = EMU_BTN_A | EMU_BTN_X;
        input.touch_down = 1;
        input.touch_x = 128;
        input.touch_y = 96;
        api->set_input(core, &input);
        api->run_frame(core);
        input.buttons = 0;
        input.touch_down = 0;
        api->set_input(core, &input);
        api->run_frame(core);
    }

    {
        size_t size = api->state_size(core);
        std::printf("state size: %zu\n", size);
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
        CHECK(after.pixels != nullptr && (after.pixels[0] & 0xFF) > 200,
              "video consistent after state load");

        std::vector<uint8_t> bad(32, 0xAB);
        CHECK(api->state_load(core, bad.data(), bad.size()) ==
                  EMU_ERR_BAD_STATE,
              "garbage state rejected");
    }

    api->destroy(core);

    if (g_failures == 0) {
        std::printf("nds core contract: all checks passed\n");
        return EXIT_SUCCESS;
    }
    std::printf("nds core contract: %d failure(s)\n", g_failures);
    return EXIT_FAILURE;
}
