/*
 * asm_helpers.h — tiny ARM-instruction encoders for the spike's test and
 * benchmark programs. Each function returns one encoded ARM-state
 * instruction word. Only the encodings the spike's decoder supports.
 */

#ifndef ARM11_SPIKE_ASM_HELPERS_H
#define ARM11_SPIKE_ASM_HELPERS_H

#include "arm_interp.h"

namespace armasm {

using arm::u32;

enum Reg {
    R0 = 0, R1, R2, R3, R4, R5, R6, R7,
    R8, R9, R10, R11, R12, SP = 13, LR = 14, PC = 15,
};

enum Cond : u32 {
    EQ = 0, NE, CS, CC, MI, PL, VS, VC, HI, LS, GE, LT, GT, LE, AL,
};

enum Shift : u32 { LSL = 0, LSR = 1, ASR = 2, ROR = 3 };

enum AluOpc : u32 {
    AND = 0, EOR, SUB, RSB, ADD, ADC, SBC, RSC,
    TST, TEQ, CMP, CMN, ORR, MOV, BIC, MVN,
};

// Data processing, register operand with optional immediate shift.
inline u32 dp_reg(AluOpc opc, bool s, Reg rd, Reg rn, Reg rm,
                  Shift shift = LSL, u32 amount = 0, Cond cond = AL) {
    return (cond << 28) | (opc << 21) | ((u32)s << 20) | ((u32)rn << 16) |
           ((u32)rd << 12) | ((amount & 31) << 7) | (shift << 5) | (u32)rm;
}

// Data processing, rotated-immediate operand (value = imm8 ROR (rot*2)).
inline u32 dp_imm(AluOpc opc, bool s, Reg rd, Reg rn, u32 imm8, u32 rot = 0,
                  Cond cond = AL) {
    return (cond << 28) | (1u << 25) | (opc << 21) | ((u32)s << 20) |
           ((u32)rn << 16) | ((u32)rd << 12) | ((rot & 15) << 8) |
           (imm8 & 0xFF);
}

inline u32 mov_imm(Reg rd, u32 imm8, u32 rot = 0) {
    return dp_imm(MOV, false, rd, R0, imm8, rot);
}
inline u32 movs_imm(Reg rd, u32 imm8) { return dp_imm(MOV, true, rd, R0, imm8); }
inline u32 mov_reg(Reg rd, Reg rm, Shift sh = LSL, u32 amount = 0) {
    return dp_reg(MOV, false, rd, R0, rm, sh, amount);
}
inline u32 add_imm(Reg rd, Reg rn, u32 imm8, u32 rot = 0) {
    return dp_imm(ADD, false, rd, rn, imm8, rot);
}
inline u32 sub_imm(Reg rd, Reg rn, u32 imm8) {
    return dp_imm(SUB, false, rd, rn, imm8);
}
inline u32 subs_imm(Reg rd, Reg rn, u32 imm8) {
    return dp_imm(SUB, true, rd, rn, imm8);
}
inline u32 cmp_imm(Reg rn, u32 imm8) { return dp_imm(CMP, true, R0, rn, imm8); }
inline u32 cmp_reg(Reg rn, Reg rm) { return dp_reg(CMP, true, R0, rn, rm); }
inline u32 add_reg(Reg rd, Reg rn, Reg rm, Shift sh = LSL, u32 amount = 0) {
    return dp_reg(ADD, false, rd, rn, rm, sh, amount);
}
inline u32 adc_reg(Reg rd, Reg rn, Reg rm) { return dp_reg(ADC, false, rd, rn, rm); }
inline u32 adds_reg(Reg rd, Reg rn, Reg rm) { return dp_reg(ADD, true, rd, rn, rm); }
inline u32 eor_reg(Reg rd, Reg rn, Reg rm, Shift sh = LSL, u32 amount = 0) {
    return dp_reg(EOR, false, rd, rn, rm, sh, amount);
}
inline u32 orr_imm(Reg rd, Reg rn, u32 imm8) { return dp_imm(ORR, false, rd, rn, imm8); }
inline u32 and_reg(Reg rd, Reg rn, Reg rm, Shift sh = LSL, u32 amount = 0) {
    return dp_reg(AND, false, rd, rn, rm, sh, amount);
}

// MUL rd, rm, rs  /  MLA rd, rm, rs, rn
inline u32 mul(Reg rd, Reg rm, Reg rs, Cond cond = AL) {
    return (cond << 28) | ((u32)rd << 16) | ((u32)rs << 8) | (9u << 4) | (u32)rm;
}
inline u32 mla(Reg rd, Reg rm, Reg rs, Reg rn, Cond cond = AL) {
    return (cond << 28) | (1u << 21) | ((u32)rd << 16) | ((u32)rn << 12) |
           ((u32)rs << 8) | (9u << 4) | (u32)rm;
}

// Branches take the *address of the branch itself* and the absolute target.
inline u32 b(u32 from, u32 to, Cond cond = AL) {
    const arm::s32 offset = ((arm::s32)(to - (from + 8))) >> 2;
    return (cond << 28) | (5u << 25) | ((u32)offset & 0x00FFFFFFu);
}
inline u32 bl(u32 from, u32 to, Cond cond = AL) {
    const arm::s32 offset = ((arm::s32)(to - (from + 8))) >> 2;
    return (cond << 28) | (5u << 25) | (1u << 24) | ((u32)offset & 0x00FFFFFFu);
}
inline u32 bx(Reg rm, Cond cond = AL) {
    return (cond << 28) | 0x012FFF10u | (u32)rm;
}

// LDR/STR word/byte with immediate offset.
inline u32 ldst(bool load, bool byte, Reg rd, Reg rn, u32 offset, bool pre,
                bool up, bool writeback, Cond cond = AL) {
    return (cond << 28) | (1u << 26) | ((u32)pre << 24) | ((u32)up << 23) |
           ((u32)byte << 22) | ((u32)writeback << 21) | ((u32)load << 20) |
           ((u32)rn << 16) | ((u32)rd << 12) | (offset & 0xFFFu);
}
inline u32 ldr(Reg rd, Reg rn, u32 offset = 0) {
    return ldst(true, false, rd, rn, offset, true, true, false);
}
inline u32 str(Reg rd, Reg rn, u32 offset = 0) {
    return ldst(false, false, rd, rn, offset, true, true, false);
}
inline u32 ldrb(Reg rd, Reg rn, u32 offset = 0) {
    return ldst(true, true, rd, rn, offset, true, true, false);
}
inline u32 strb(Reg rd, Reg rn, u32 offset = 0) {
    return ldst(false, true, rd, rn, offset, true, true, false);
}
// Post-indexed: transfer at [rn], then rn += offset.
inline u32 ldr_post(Reg rd, Reg rn, u32 offset) {
    return ldst(true, false, rd, rn, offset, false, true, false);
}
inline u32 str_post(Reg rd, Reg rn, u32 offset) {
    return ldst(false, false, rd, rn, offset, false, true, false);
}
// Pre-indexed with writeback: rn += offset, transfer at [rn].
inline u32 ldr_pre_wb(Reg rd, Reg rn, u32 offset) {
    return ldst(true, false, rd, rn, offset, true, true, true);
}

inline u32 swi() { return 0xEF000000u; }

} // namespace armasm

#endif // ARM11_SPIKE_ASM_HELPERS_H
