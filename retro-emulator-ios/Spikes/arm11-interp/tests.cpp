// tests.cpp — correctness tests for the ARM11 interpreter spike.
//
// Strategy: every kernel runs on BOTH backends; results must match an
// independent C++ mirror of the kernel's semantics AND each other
// (registers, flags, and touched memory). Plus targeted tests for flag
// semantics and load/store addressing modes.

#include <cstdio>
#include <cstdlib>
#include <vector>

#include "arm_interp.h"
#include "asm_helpers.h"
#include "kernels.h"

using namespace arm;
using namespace armasm;

static int g_failures = 0;

#define CHECK(cond, ...)                                                      \
    do {                                                                      \
        if (!(cond)) {                                                        \
            std::printf("FAIL %s:%d: ", __FILE__, __LINE__);                  \
            std::printf(__VA_ARGS__);                                         \
            std::printf("\n");                                                \
            ++g_failures;                                                     \
        }                                                                     \
    } while (0)

namespace {

constexpr u32 kRamSize = 1u << 20;

struct GuestRam {
    std::vector<u8> data;
    GuestRam() : data(kRamSize, 0) {}
    void attach(Cpu &cpu) {
        cpu.ram = data.data();
        cpu.ram_mask = kRamSize - 1;
    }
};

// Assembles `code` at 0, runs to halt on the given backend, returns the CPU.
template <typename Backend>
Cpu run_program(GuestRam &ram, const std::vector<u32> &code,
                void (*pre)(Cpu &) = nullptr) {
    Cpu cpu;
    ram.attach(cpu);
    for (size_t i = 0; i < code.size(); ++i)
        cpu.write32((u32)(i * 4), code[i]);
    if (pre) pre(cpu);
    cpu.r[15] = 0;
    Backend backend;
    backend.run(cpu, 100000000ull);
    CHECK(cpu.halted, "program did not halt");
    CHECK(!cpu.error, "program hit undefined instruction 0x%08X",
          cpu.error_instr);
    return cpu;
}

void expect_same_state(const Cpu &a, const Cpu &b, const char *what) {
    for (int i = 0; i < 15; ++i)
        CHECK(a.r[i] == b.r[i], "%s: r%d differs: 0x%08X vs 0x%08X", what, i,
              a.r[i], b.r[i]);
    CHECK(a.n == b.n && a.z == b.z && a.c == b.c && a.v == b.v,
          "%s: flags differ (NZCV %d%d%d%d vs %d%d%d%d)", what, a.n, a.z, a.c,
          a.v, b.n, b.z, b.c, b.v);
}

void test_flags_and_carry() {
    // Multi-word add: 0xFFFFFFFF + 1 with carry chained into a second word.
    //   movs r0, #0            (clears NZCV via S-bit MOV of 0? sets Z only)
    //   mvn r1, #0             ; r1 = 0xFFFFFFFF
    //   mov r2, #1
    //   adds r3, r1, r2        ; r3 = 0, C=1, Z=1
    //   mov r4, #0
    //   adc r4, r4, r4         ; r4 = 0 + 0 + C = 1
    //   swi
    const std::vector<u32> code = {
        dp_imm(MVN, false, R1, R0, 0),
        mov_imm(R2, 1),
        dp_reg(ADD, true, R3, R1, R2),
        mov_imm(R4, 0),
        adc_reg(R4, R4, R4),
        swi(),
    };
    GuestRam ram;
    const Cpu naive = run_program<NaiveInterp>(ram, code);
    const Cpu cached = run_program<CachedInterp>(ram, code);
    expect_same_state(naive, cached, "flags_and_carry");
    CHECK(naive.r[3] == 0, "adds result: got 0x%08X", naive.r[3]);
    CHECK(naive.r[4] == 1, "adc did not pick up carry: got 0x%08X",
          naive.r[4]);
}

void test_sub_borrow_and_conditions() {
    //   mov r0, #5
    //   subs r1, r0, #10       ; r1 = -5, C=0 (borrow), N=1
    //   mov r2, #0
    //   addcc r2, r2, #1       ; taken (C clear)
    //   addcs r2, r2, #2       ; not taken
    //   addmi r2, r2, #4       ; taken (N set)
    //   subs r3, r0, #5        ; r3 = 0, Z=1, C=1
    //   addeq r2, r2, #8       ; taken
    //   swi
    const std::vector<u32> code = {
        mov_imm(R0, 5),
        dp_imm(SUB, true, R1, R0, 10),
        mov_imm(R2, 0),
        dp_imm(ADD, false, R2, R2, 1, 0, CC),
        dp_imm(ADD, false, R2, R2, 2, 0, CS),
        dp_imm(ADD, false, R2, R2, 4, 0, MI),
        dp_imm(SUB, true, R3, R0, 5),
        dp_imm(ADD, false, R2, R2, 8, 0, EQ),
        swi(),
    };
    GuestRam ram;
    const Cpu naive = run_program<NaiveInterp>(ram, code);
    const Cpu cached = run_program<CachedInterp>(ram, code);
    expect_same_state(naive, cached, "sub_borrow");
    CHECK(naive.r[1] == 0xFFFFFFFBu, "subs result: got 0x%08X", naive.r[1]);
    CHECK(naive.r[2] == (1 + 4 + 8), "conditional mask wrong: got %u",
          naive.r[2]);
}

void test_shift_special_cases() {
    //   mvn r0, #0             ; r0 = 0xFFFFFFFF
    //   mov r1, r0, lsr #32-encoded-as-0  => 0, carry = bit31
    //   mov r2, r0, asr #32-encoded-as-0  => 0xFFFFFFFF
    //   mov r3, #2
    //   movs r4, r3, lsr #1    ; r4 = 1, C = 0
    //   swi
    const std::vector<u32> code = {
        dp_imm(MVN, false, R0, R0, 0),
        mov_reg(R1, R0, LSR, 0), // LSR #32
        mov_reg(R2, R0, ASR, 0), // ASR #32
        mov_imm(R3, 2),
        dp_reg(MOV, true, R4, R0, R3, LSR, 1),
        swi(),
    };
    GuestRam ram;
    const Cpu naive = run_program<NaiveInterp>(ram, code);
    const Cpu cached = run_program<CachedInterp>(ram, code);
    expect_same_state(naive, cached, "shift_special");
    CHECK(naive.r[1] == 0, "LSR #32: got 0x%08X", naive.r[1]);
    CHECK(naive.r[2] == 0xFFFFFFFFu, "ASR #32: got 0x%08X", naive.r[2]);
    CHECK(naive.r[4] == 1 && naive.c == false,
          "LSR #1 of 2: got 0x%08X C=%d", naive.r[4], naive.c);
}

void test_addressing_modes() {
    //   mov r0, #0x100         ; base
    //   mov r1, #0xAB
    //   strb r1, [r0, #1]      ; byte store, offset
    //   mov r2, #0x11
    //   str r2, [r0, #8]       ; word store, offset
    //   ldr r3, [r0, #8]       ; word load back
    //   ldrb r4, [r0, #1]      ; byte load back
    //   mov r5, r0
    //   mov r6, #7
    //   str r6, [r5], #4       ; post-index: store at 0x100, r5 -> 0x104
    //   ldr r7, [r5, #-4]      ; load from 0x100 via down-offset
    //   swi
    const std::vector<u32> code = {
        mov_imm(R0, 1, 12),                              // 0x100
        mov_imm(R1, 0xAB),
        strb(R1, R0, 1),
        mov_imm(R2, 0x11),
        str(R2, R0, 8),
        ldr(R3, R0, 8),
        ldrb(R4, R0, 1),
        mov_reg(R5, R0),
        mov_imm(R6, 7),
        str_post(R6, R5, 4),
        ldst(true, false, R7, R5, 4, true, false, false), // ldr r7, [r5, #-4]
        swi(),
    };
    GuestRam ram;
    const Cpu naive = run_program<NaiveInterp>(ram, code);
    const Cpu cached = run_program<CachedInterp>(ram, code);
    expect_same_state(naive, cached, "addressing_modes");
    CHECK(naive.r[3] == 0x11, "word roundtrip: got 0x%08X", naive.r[3]);
    CHECK(naive.r[4] == 0xAB, "byte roundtrip: got 0x%08X", naive.r[4]);
    CHECK(naive.r[5] == 0x104, "post-index writeback: got 0x%08X",
          naive.r[5]);
    CHECK(naive.r[7] == 7, "down-offset load: got 0x%08X", naive.r[7]);
}

void test_kernels() {
    for (const kernels::Kernel &k : kernels::all()) {
        const u32 n = 1000;
        GuestRam ram_a, ram_b;

        Cpu cpu_naive;
        ram_a.attach(cpu_naive);
        kernels::load(k, cpu_naive, n);
        NaiveInterp naive;
        const u64 executed_naive = naive.run(cpu_naive, 1ull << 32);

        Cpu cpu_cached;
        ram_b.attach(cpu_cached);
        kernels::load(k, cpu_cached, n);
        CachedInterp cached;
        const u64 executed_cached = cached.run(cpu_cached, 1ull << 32);

        CHECK(cpu_naive.halted && !cpu_naive.error, "%s naive errored",
              k.name.c_str());
        CHECK(cpu_cached.halted && !cpu_cached.error, "%s cached errored",
              k.name.c_str());
        CHECK(executed_naive == executed_cached,
              "%s executed-count mismatch: %llu vs %llu", k.name.c_str(),
              (unsigned long long)executed_naive,
              (unsigned long long)executed_cached);
        expect_same_state(cpu_naive, cpu_cached, k.name.c_str());

        const u32 want = k.expected_r0(n);
        CHECK(cpu_naive.r[0] == want, "%s r0: got 0x%08X want 0x%08X",
              k.name.c_str(), cpu_naive.r[0], want);

        if (k.name == "mem_stream") {
            for (u32 i = 0; i < n; ++i) {
                const u32 got = cpu_naive.read32(kernels::kDstAddr + i * 4);
                if (got != kernels::mem_pattern(i)) {
                    CHECK(false, "mem_stream dst[%u]: got 0x%08X", i, got);
                    break;
                }
            }
        }
    }
}

} // namespace

int main() {
    test_flags_and_carry();
    test_sub_borrow_and_conditions();
    test_shift_special_cases();
    test_addressing_modes();
    test_kernels();

    if (g_failures == 0) {
        std::printf("all tests passed\n");
        return EXIT_SUCCESS;
    }
    std::printf("%d test(s) FAILED\n", g_failures);
    return EXIT_FAILURE;
}
