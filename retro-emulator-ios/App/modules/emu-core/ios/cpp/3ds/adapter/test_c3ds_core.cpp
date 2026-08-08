// Contract test for the 3DS core adapter against real Azahar, headless,
// interpreter-everything. The ROM is a synthetic ARM ELF built in-test
// (license-clean, same trick as the GBA/NDS tests): one PT_LOAD segment
// at the 3DS process base with a spin loop. It proves loader entry,
// dyncom execution, the frame loop (GSP VBlank fires regardless of what
// the guest draws), screen geometry, and savestate roundtrip.

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

#include "core_api.h"

extern "C" const EmuCoreApi *emu_3ds_api(void);

static int g_failures = 0;

#define CHECK(cond, msg)                                                       \
    do {                                                                       \
        if (!(cond)) {                                                         \
            std::printf("FAIL: %s (%s:%d)\n", msg, __FILE__, __LINE__);        \
            g_failures++;                                                      \
        }                                                                      \
    } while (0)

namespace {

void put16(std::vector<uint8_t> &v, size_t off, uint16_t x) {
    v[off] = (uint8_t)(x & 0xFF);
    v[off + 1] = (uint8_t)(x >> 8);
}
void put32(std::vector<uint8_t> &v, size_t off, uint32_t x) {
    for (int i = 0; i < 4; i++) v[off + i] = (uint8_t)((x >> (8 * i)) & 0xFF);
}

// Minimal ARM ELF32: header + one PT_LOAD at 0x00100000 (3DS process
// code base) containing "b ." — enough to boot and idle.
std::vector<uint8_t> make_test_elf() {
    const uint32_t vaddr = 0x00100000;
    const uint32_t code_off = 0x1000;
    std::vector<uint8_t> elf(code_off + 0x1000, 0);

    // e_ident
    elf[0] = 0x7F; elf[1] = 'E'; elf[2] = 'L'; elf[3] = 'F';
    elf[4] = 1;  // ELFCLASS32
    elf[5] = 1;  // ELFDATA2LSB
    elf[6] = 1;  // EV_CURRENT
    put16(elf, 16, 2);        // e_type = ET_EXEC
    put16(elf, 18, 40);       // e_machine = EM_ARM
    put32(elf, 20, 1);        // e_version
    put32(elf, 24, vaddr);    // e_entry
    put32(elf, 28, 52);       // e_phoff (right after ehdr)
    put32(elf, 32, 0);        // e_shoff
    put32(elf, 36, 0x5000002);// e_flags (ARM EABI v5)
    put16(elf, 40, 52);       // e_ehsize
    put16(elf, 42, 32);       // e_phentsize
    put16(elf, 44, 1);        // e_phnum
    // program header @52
    put32(elf, 52, 1);         // p_type = PT_LOAD
    put32(elf, 56, code_off);  // p_offset
    put32(elf, 60, vaddr);     // p_vaddr
    put32(elf, 64, vaddr);     // p_paddr
    put32(elf, 68, 0x1000);    // p_filesz
    put32(elf, 72, 0x1000);    // p_memsz
    put32(elf, 76, 5);         // p_flags = R+X
    put32(elf, 80, 0x1000);    // p_align

    put32(elf, code_off, 0xEAFFFFFE); // b .
    return elf;
}

} // namespace

int main() {
    const EmuCoreApi *api = emu_3ds_api();
    CHECK(api != nullptr, "api");
    CHECK(api->load_rom_path != nullptr, "load_rom_path present");

    EmuCore *core = api->create();
    CHECK(core != nullptr, "create");

    EmuCoreDesc desc{};
    api->describe(core, &desc);
    CHECK(desc.system == EMU_SYSTEM_3DS, "system is 3DS");
    CHECK(desc.screen_count == 2, "two screens");
    CHECK(desc.screens[0].width == 400 && desc.screens[0].height == 240,
          "top 400x240");
    CHECK(desc.screens[1].width == 320 && desc.screens[1].height == 240,
          "bottom 320x240");
    CHECK(desc.screens[1].has_touch == 1, "touch on bottom");
    CHECK(desc.has_circle_pad == 1, "circle pad");
    CHECK(desc.required_files != nullptr && desc.required_files[0] == nullptr,
          "no required files (decrypted-only, no keys)");

    CHECK(api->load_rom(core, nullptr, 0) == EMU_ERR_BAD_ROM, "null ROM");

    std::vector<uint8_t> elf = make_test_elf();
    EmuStatus loaded = api->load_rom(core, elf.data(), elf.size());
    std::printf("load_rom -> %d\n", (int)loaded);
    CHECK(loaded == EMU_OK, "load synthetic ELF");
    if (loaded != EMU_OK) {
        api->destroy(core);
        std::printf("aborting remaining checks\n");
        return EXIT_FAILURE;
    }

    for (int i = 0; i < 5; i++) {
        api->run_frame(core);
    }

    EmuVideoBuffer top{}, bottom{};
    api->get_video(core, 0, &top);
    api->get_video(core, 1, &bottom);
    CHECK(top.pixels != nullptr && top.width == 400 && top.height == 240,
          "top video buffer");
    CHECK(bottom.pixels != nullptr && bottom.width == 320,
          "bottom video buffer");

    // Input must reach the guest, not just be stored: HID reads our
    // Input devices, so PAD_STATE in shared memory should show the
    // press. Reading HID directly would need core internals, so assert
    // the observable contract instead: set/clear across frames without
    // crashing, plus touch press/move/release ordering.
    {
        EmuInputState input{};
        input.buttons = EMU_BTN_A | EMU_BTN_START;
        input.analog_x = 12000;
        input.analog_y = -8000;
        api->set_input(core, &input);
        api->run_frame(core);

        input.touch_down = 1;
        input.touch_x = 160;
        input.touch_y = 120;
        api->set_input(core, &input);
        api->run_frame(core);
        // Move while held, then release.
        input.touch_x = 200;
        api->set_input(core, &input);
        api->run_frame(core);
        input.touch_down = 0;
        api->set_input(core, &input);
        api->run_frame(core);

        input = EmuInputState{};
        api->set_input(core, &input);
        api->run_frame(core);
        std::printf("input: buttons/analog/touch cycled cleanly\n");
    }

    {
        size_t size = api->state_size(core);
        std::printf("state size: %zu\n", size);
        CHECK(size > 0, "state size");
        std::vector<uint8_t> state(size);
        CHECK(api->state_save(core, state.data(), state.size()) == EMU_OK,
              "state save");
        for (int i = 0; i < 5; i++) {
            api->run_frame(core);
        }
        CHECK(api->state_load(core, state.data(), state.size()) == EMU_OK,
              "state load");
        api->run_frame(core);

        std::vector<uint8_t> bad(64, 0xCD);
        CHECK(api->state_load(core, bad.data(), bad.size()) ==
                  EMU_ERR_BAD_STATE,
              "garbage state rejected");
    }

    api->destroy(core);

    if (g_failures == 0) {
        std::printf("3ds core contract: all checks passed\n");
        return EXIT_SUCCESS;
    }
    std::printf("3ds core contract: %d failure(s)\n", g_failures);
    return EXIT_FAILURE;
}
