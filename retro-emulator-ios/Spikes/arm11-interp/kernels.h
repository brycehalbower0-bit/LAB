/*
 * kernels.h — the spike's benchmark programs.
 *
 * Three workloads chosen to stress the three costs that dominate an
 * interpreter: ALU/dispatch throughput, memory access, and control flow.
 * Each kernel carries an independent C++ mirror of its own semantics, so
 * correctness is checked against a second implementation rather than
 * against the interpreter itself.
 */

#ifndef ARM11_SPIKE_KERNELS_H
#define ARM11_SPIKE_KERNELS_H

#include <functional>
#include <string>
#include <vector>

#include "arm_interp.h"
#include "asm_helpers.h"

namespace kernels {

using arm::s32;
using arm::u32;
using namespace armasm;

struct Kernel {
    std::string name;
    std::string description;
    std::vector<u32> code;                       // assembled at guest 0x0
    std::function<void(arm::Cpu &, u32)> setup;  // registers + data for n iterations
    std::function<u32(u32)> expected_r0;         // independent mirror
    double instrs_per_iter;
};

inline u32 mem_pattern(u32 i) { return (i + 1) * 2654435761u; }

constexpr u32 kSrcAddr = 0x10000;
constexpr u32 kDstAddr = 0x20000;

inline Kernel make_alu_mix() {
    Kernel k;
    k.name = "alu_mix";
    k.description = "shifted-operand ALU + multiply + flag-setting loop";
    // loop:
    //   add r2, r0, r1
    //   eor r3, r2, r1, lsl #3
    //   add r0, r0, r3, lsr #1
    //   orr r2, r3, #0xFF
    //   and r3, r2, r0, asr #2
    //   mul r4, r3, r1
    //   add r0, r0, r4, lsr #4
    //   subs r1, r1, #1
    //   bne loop
    //   swi
    k.code = {
        add_reg(R2, R0, R1),
        eor_reg(R3, R2, R1, LSL, 3),
        add_reg(R0, R0, R3, LSR, 1),
        orr_imm(R2, R3, 0xFF),
        and_reg(R3, R2, R0, ASR, 2),
        mul(R4, R3, R1),
        add_reg(R0, R0, R4, LSR, 4),
        subs_imm(R1, R1, 1),
        b(8 * 4, 0 * 4, NE),
        swi(),
    };
    k.instrs_per_iter = 9.0;
    k.setup = [](arm::Cpu &cpu, u32 n) {
        cpu.r[0] = 0;
        cpu.r[1] = n;
    };
    k.expected_r0 = [](u32 n) {
        u32 r0 = 0;
        for (u32 r1 = n; r1 != 0; --r1) {
            const u32 r2a = r0 + r1;
            u32 r3 = r2a ^ (r1 << 3);
            r0 += r3 >> 1;
            const u32 r2b = r3 | 0xFF;
            r3 = r2b & (u32)((s32)r0 >> 2);
            const u32 r4 = r3 * r1;
            r0 += r4 >> 4;
        }
        return r0;
    };
    return k;
}

inline Kernel make_mem_stream() {
    Kernel k;
    k.name = "mem_stream";
    k.description = "post-indexed load/store copy with running checksum";
    // loop:
    //   ldr r4, [r1], #4
    //   add r0, r0, r4
    //   eor r0, r0, r0, lsr #7
    //   str r4, [r2], #4
    //   subs r3, r3, #1
    //   bne loop
    //   swi
    k.code = {
        ldr_post(R4, R1, 4),
        add_reg(R0, R0, R4),
        eor_reg(R0, R0, R0, LSR, 7),
        str_post(R4, R2, 4),
        subs_imm(R3, R3, 1),
        b(5 * 4, 0 * 4, NE),
        swi(),
    };
    k.instrs_per_iter = 6.0;
    k.setup = [](arm::Cpu &cpu, u32 n) {
        cpu.r[0] = 0;
        cpu.r[1] = kSrcAddr;
        cpu.r[2] = kDstAddr;
        cpu.r[3] = n;
        for (u32 i = 0; i < n; ++i)
            cpu.write32(kSrcAddr + i * 4, mem_pattern(i));
    };
    k.expected_r0 = [](u32 n) {
        u32 r0 = 0;
        for (u32 i = 0; i < n; ++i) {
            r0 += mem_pattern(i);
            r0 ^= r0 >> 7;
        }
        return r0;
    };
    return k;
}

inline Kernel make_call_heavy() {
    Kernel k;
    k.name = "call_heavy";
    k.description = "bl/bx function-call loop (block-transition stress)";
    // 0x00 loop: bl func        (func at 0x14)
    // 0x04   subs r5, r5, #1
    // 0x08   bne loop
    // 0x0C   swi
    // 0x10   swi                (pad)
    // 0x14 func: add r0, r0, #1
    // 0x18   eor r0, r0, r0, lsl #2
    // 0x1C   sub r0, r0, r5, lsr #3
    // 0x20   bx lr
    k.code = {
        bl(0x00, 0x14),
        subs_imm(R5, R5, 1),
        b(0x08, 0x00, NE),
        swi(),
        swi(),
        add_imm(R0, R0, 1),
        eor_reg(R0, R0, R0, LSL, 2),
        dp_reg(SUB, false, R0, R0, R5, LSR, 3),
        bx(LR),
    };
    k.instrs_per_iter = 7.0;
    k.setup = [](arm::Cpu &cpu, u32 n) {
        cpu.r[0] = 0;
        cpu.r[5] = n;
    };
    k.expected_r0 = [](u32 n) {
        u32 r0 = 0;
        for (u32 r5 = n; r5 != 0; --r5) {
            r0 = r0 + 1;
            r0 = r0 ^ (r0 << 2);
            r0 = r0 - (r5 >> 3);
        }
        return r0;
    };
    return k;
}

inline std::vector<Kernel> all() {
    return {make_alu_mix(), make_mem_stream(), make_call_heavy()};
}

// Loads a kernel's code into guest RAM at 0 and prepares the CPU for n
// iterations. RAM must already be attached to the Cpu.
inline void load(const Kernel &k, arm::Cpu &cpu, u32 iterations) {
    for (int i = 0; i < 16; ++i) cpu.r[i] = 0;
    cpu.n = cpu.z = cpu.c = cpu.v = false;
    cpu.halted = cpu.error = cpu.branched = false;
    for (size_t i = 0; i < k.code.size(); ++i)
        cpu.write32((u32)(i * 4), k.code[i]);
    k.setup(cpu, iterations);
    cpu.r[15] = 0;
}

} // namespace kernels

#endif // ARM11_SPIKE_KERNELS_H
