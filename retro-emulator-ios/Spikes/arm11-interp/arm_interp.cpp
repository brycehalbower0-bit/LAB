#include "arm_interp.h"

namespace arm {

bool cond_passed(const Cpu &cpu, u8 cond) {
    switch (cond) {
    case 0:  return cpu.z;                       // EQ
    case 1:  return !cpu.z;                      // NE
    case 2:  return cpu.c;                       // CS/HS
    case 3:  return !cpu.c;                      // CC/LO
    case 4:  return cpu.n;                       // MI
    case 5:  return !cpu.n;                      // PL
    case 6:  return cpu.v;                       // VS
    case 7:  return !cpu.v;                      // VC
    case 8:  return cpu.c && !cpu.z;             // HI
    case 9:  return !cpu.c || cpu.z;             // LS
    case 10: return cpu.n == cpu.v;              // GE
    case 11: return cpu.n != cpu.v;              // LT
    case 12: return !cpu.z && cpu.n == cpu.v;    // GT
    case 13: return cpu.z || cpu.n != cpu.v;     // LE
    default: return true;                        // AL
    }
}

static inline u32 ror32(u32 value, u32 amount) {
    amount &= 31;
    return amount ? (value >> amount) | (value << (32 - amount)) : value;
}

// Immediate-amount barrel shift with ARM's special zero-amount encodings:
// LSL #0 passes through (carry unchanged), LSR #0 means LSR #32,
// ASR #0 means ASR #32, ROR #0 means RRX.
static inline u32 shift_imm(u32 value, u8 type, u8 amount, bool carry_in,
                            bool &carry_out) {
    switch (type) {
    case 0: // LSL
        if (amount == 0) { carry_out = carry_in; return value; }
        carry_out = (value >> (32 - amount)) & 1;
        return value << amount;
    case 1: // LSR
        if (amount == 0) { carry_out = value >> 31; return 0; }
        carry_out = (value >> (amount - 1)) & 1;
        return value >> amount;
    case 2: // ASR
        if (amount == 0) {
            carry_out = value >> 31;
            return (u32)((s32)value >> 31);
        }
        carry_out = ((u32)((s32)value >> (amount - 1))) & 1;
        return (u32)((s32)value >> amount);
    default: // ROR / RRX
        if (amount == 0) {
            carry_out = value & 1;
            return (value >> 1) | ((u32)carry_in << 31);
        }
        carry_out = (value >> (amount - 1)) & 1;
        return ror32(value, amount);
    }
}

enum AluOpc {
    OPC_AND = 0, OPC_EOR, OPC_SUB, OPC_RSB, OPC_ADD, OPC_ADC, OPC_SBC,
    OPC_RSC, OPC_TST, OPC_TEQ, OPC_CMP, OPC_CMN, OPC_ORR, OPC_MOV,
    OPC_BIC, OPC_MVN,
};

template <int OPC, bool S, bool IMM>
static void alu(Cpu &cpu, const DecodedOp &d) {
    const u32 op1 = cpu.reg_read(d.rn);
    bool sc = cpu.c; // shifter carry-out; defaults to current C
    u32 op2;
    if (IMM) {
        op2 = d.imm;
        if (d.shift_amount) sc = op2 >> 31; // rotation applied => carry from bit 31
    } else {
        op2 = shift_imm(cpu.reg_read(d.rm), d.shift_type, d.shift_amount,
                        cpu.c, sc);
    }

    u32 res = 0;
    bool carry = cpu.c;
    bool ovf = cpu.v;
    const bool cin = cpu.c;

    switch (OPC) {
    case OPC_AND: case OPC_TST: res = op1 & op2; carry = sc; break;
    case OPC_EOR: case OPC_TEQ: res = op1 ^ op2; carry = sc; break;
    case OPC_ORR:               res = op1 | op2; carry = sc; break;
    case OPC_BIC:               res = op1 & ~op2; carry = sc; break;
    case OPC_MOV:               res = op2; carry = sc; break;
    case OPC_MVN:               res = ~op2; carry = sc; break;
    case OPC_SUB: case OPC_CMP:
        res = op1 - op2;
        carry = op1 >= op2;
        ovf = (((op1 ^ op2) & (op1 ^ res)) >> 31) != 0;
        break;
    case OPC_RSB:
        res = op2 - op1;
        carry = op2 >= op1;
        ovf = (((op2 ^ op1) & (op2 ^ res)) >> 31) != 0;
        break;
    case OPC_ADD: case OPC_CMN:
        res = op1 + op2;
        carry = res < op1;
        ovf = ((~(op1 ^ op2) & (op1 ^ res)) >> 31) != 0;
        break;
    case OPC_ADC: {
        const u64 wide = (u64)op1 + op2 + (cin ? 1 : 0);
        res = (u32)wide;
        carry = (wide >> 32) != 0;
        ovf = ((~(op1 ^ op2) & (op1 ^ res)) >> 31) != 0;
        break;
    }
    case OPC_SBC: {
        const u64 sub = (u64)op2 + (cin ? 0 : 1);
        res = (u32)(op1 - sub);
        carry = (u64)op1 >= sub;
        ovf = (((op1 ^ op2) & (op1 ^ res)) >> 31) != 0;
        break;
    }
    case OPC_RSC: {
        const u64 sub = (u64)op1 + (cin ? 0 : 1);
        res = (u32)(op2 - sub);
        carry = (u64)op2 >= sub;
        ovf = (((op2 ^ op1) & (op2 ^ res)) >> 31) != 0;
        break;
    }
    }

    constexpr bool kIsTest =
        OPC == OPC_TST || OPC == OPC_TEQ || OPC == OPC_CMP || OPC == OPC_CMN;
    if (!kIsTest) {
        if (d.rd == 15) {
            cpu.r[15] = res & ~3u;
            cpu.branched = true;
        } else {
            cpu.r[d.rd] = res;
        }
    }
    if (S) {
        cpu.n = res >> 31;
        cpu.z = res == 0;
        cpu.c = carry;
        constexpr bool kIsArith =
            OPC == OPC_SUB || OPC == OPC_RSB || OPC == OPC_ADD ||
            OPC == OPC_ADC || OPC == OPC_SBC || OPC == OPC_RSC ||
            OPC == OPC_CMP || OPC == OPC_CMN;
        if (kIsArith) cpu.v = ovf;
    }
}

template <bool LINK>
static void branch(Cpu &cpu, const DecodedOp &d) {
    if (LINK) cpu.r[14] = cpu.r[15] + 4;
    cpu.r[15] = d.imm; // absolute target, precomputed at decode
    cpu.branched = true;
}

static void bx_handler(Cpu &cpu, const DecodedOp &d) {
    const u32 target = cpu.reg_read(d.rm);
    if (target & 1) { // Thumb interworking is out of the spike's scope
        cpu.error = true;
        cpu.halted = true;
        return;
    }
    cpu.r[15] = target & ~3u;
    cpu.branched = true;
}

template <bool ACC, bool S>
static void mul_handler(Cpu &cpu, const DecodedOp &d) {
    u32 res = cpu.r[d.rm] * cpu.r[d.rs];
    if (ACC) res += cpu.r[d.rn];
    cpu.r[d.rd] = res;
    if (S) {
        cpu.n = res >> 31;
        cpu.z = res == 0;
    }
}

template <bool LOAD, bool BYTE>
static void ldst(Cpu &cpu, const DecodedOp &d) {
    const u32 base = cpu.reg_read(d.rn);
    const u32 indexed = (d.flags & OPF_UP) ? base + d.imm : base - d.imm;
    const u32 addr = (d.flags & OPF_PRE) ? indexed : base;
    const bool writeback = !(d.flags & OPF_PRE) || (d.flags & OPF_WB);

    if (LOAD) {
        const u32 value = BYTE ? cpu.read8(addr) : cpu.read32(addr);
        if (writeback && d.rn != d.rd) cpu.r[d.rn] = indexed;
        if (d.rd == 15) {
            cpu.r[15] = value & ~3u;
            cpu.branched = true;
        } else {
            cpu.r[d.rd] = value;
        }
    } else {
        const u32 value = cpu.reg_read(d.rd);
        if (BYTE) cpu.write8(addr, (u8)value);
        else cpu.write32(addr, value);
        if (writeback) cpu.r[d.rn] = indexed;
    }
}

static void swi_halt(Cpu &cpu, const DecodedOp &) { cpu.halted = true; }

static void undef_handler(Cpu &cpu, const DecodedOp &d) {
    cpu.error = true;
    cpu.error_instr = d.imm;
    cpu.halted = true;
}

// ---- handler tables ------------------------------------------------------

using H = Handler;

#define ALU_ROW(OPC)                                                          \
    { { &alu<OPC, false, false>, &alu<OPC, false, true> },                    \
      { &alu<OPC, true, false>, &alu<OPC, true, true> } }

// [opcode][S][IMM]
static const H g_alu_tab[16][2][2] = {
    ALU_ROW(OPC_AND), ALU_ROW(OPC_EOR), ALU_ROW(OPC_SUB), ALU_ROW(OPC_RSB),
    ALU_ROW(OPC_ADD), ALU_ROW(OPC_ADC), ALU_ROW(OPC_SBC), ALU_ROW(OPC_RSC),
    ALU_ROW(OPC_TST), ALU_ROW(OPC_TEQ), ALU_ROW(OPC_CMP), ALU_ROW(OPC_CMN),
    ALU_ROW(OPC_ORR), ALU_ROW(OPC_MOV), ALU_ROW(OPC_BIC), ALU_ROW(OPC_MVN),
};
#undef ALU_ROW

// [ACC][S]
static const H g_mul_tab[2][2] = {
    { &mul_handler<false, false>, &mul_handler<false, true> },
    { &mul_handler<true, false>, &mul_handler<true, true> },
};

// [LOAD][BYTE]
static const H g_ldst_tab[2][2] = {
    { &ldst<false, false>, &ldst<false, true> },
    { &ldst<true, false>, &ldst<true, true> },
};

// ---- decode --------------------------------------------------------------

static DecodedOp make_undef(u32 instr) {
    DecodedOp d;
    d.fn = &undef_handler;
    d.imm = instr;
    d.flags = OPF_END;
    return d;
}

DecodedOp decode_one(u32 instr, u32 addr) {
    DecodedOp d;
    d.cond = instr >> 28;
    if (d.cond == 15) return make_undef(instr); // NV space unsupported

    // SWI — the spike's halt instruction.
    if ((instr & 0x0F000000u) == 0x0F000000u) {
        d.fn = &swi_halt;
        d.flags = OPF_END;
        return d;
    }

    const u32 top = (instr >> 25) & 7;

    // B / BL
    if (top == 5) {
        const bool link = (instr & (1u << 24)) != 0;
        const s32 offset = ((s32)(instr << 8)) >> 6; // imm24 << 2, sign-extended
        d.imm = addr + 8 + (u32)offset;
        d.fn = link ? &branch<true> : &branch<false>;
        d.flags = OPF_END;
        return d;
    }

    // BX
    if ((instr & 0x0FFFFFF0u) == 0x012FFF10u) {
        d.rm = instr & 15;
        d.fn = &bx_handler;
        d.flags = OPF_END;
        return d;
    }

    // MUL / MLA
    if ((instr & 0x0FC000F0u) == 0x00000090u) {
        const bool acc = (instr & (1u << 21)) != 0;
        const bool s = (instr & (1u << 20)) != 0;
        d.rd = (instr >> 16) & 15;
        d.rn = (instr >> 12) & 15;
        d.rs = (instr >> 8) & 15;
        d.rm = instr & 15;
        d.fn = g_mul_tab[acc][s];
        return d;
    }

    // Data processing
    if (top == 0 || top == 1) {
        // Remaining bit7&bit4 patterns in the register form are the
        // multiplies/halfword-transfer/MSR spaces — out of spike scope.
        if (top == 0 && (instr & 0x90u) == 0x90u) return make_undef(instr);

        const u32 opc = (instr >> 21) & 15;
        const bool s = (instr & (1u << 20)) != 0;
        const bool is_test = opc >= OPC_TST && opc <= OPC_CMN;
        if (is_test && !s) return make_undef(instr); // MRS/MSR space

        d.rn = (instr >> 16) & 15;
        d.rd = (instr >> 12) & 15;
        if (top == 1) {
            const u32 imm8 = instr & 0xFFu;
            const u32 rot = ((instr >> 8) & 15) * 2;
            d.imm = ror32(imm8, rot);
            d.shift_amount = rot ? 1 : 0; // marks "carry comes from bit 31"
            d.fn = g_alu_tab[opc][s][1];
        } else {
            if (instr & (1u << 4)) return make_undef(instr); // shift-by-register: out of scope
            d.rm = instr & 15;
            d.shift_type = (instr >> 5) & 3;
            d.shift_amount = (instr >> 7) & 31;
            d.fn = g_alu_tab[opc][s][0];
        }
        if (!is_test && d.rd == 15) d.flags = OPF_END;
        return d;
    }

    // LDR/STR word/byte, immediate offset
    if (top == 2) {
        d.rn = (instr >> 16) & 15;
        d.rd = (instr >> 12) & 15;
        d.imm = instr & 0xFFFu;
        if (instr & (1u << 24)) d.flags |= OPF_PRE;
        if (instr & (1u << 23)) d.flags |= OPF_UP;
        if (instr & (1u << 21)) d.flags |= OPF_WB;
        const bool load = (instr & (1u << 20)) != 0;
        const bool byte = (instr & (1u << 22)) != 0;
        if (load) d.flags |= OPF_LOAD;
        if (byte) d.flags |= OPF_BYTE;
        d.fn = g_ldst_tab[load][byte];
        if (load && d.rd == 15) d.flags |= OPF_END;
        return d;
    }

    return make_undef(instr);
}

// ---- naive driver: fetch/decode/execute every instruction ----------------

u64 NaiveInterp::run(Cpu &cpu, u64 max_instrs) {
    u64 executed = 0;
    while (!cpu.halted && executed < max_instrs) {
        const u32 instr = cpu.read32(cpu.r[15]);
        const DecodedOp d = decode_one(instr, cpu.r[15]);
        ++executed;
        if (cond_passed(cpu, d.cond)) {
            d.fn(cpu, d);
            if (cpu.branched) {
                cpu.branched = false;
                continue;
            }
        }
        cpu.r[15] += 4;
    }
    return executed;
}

// ---- cached driver: decode blocks once, re-execute the decoded form ------

const std::vector<DecodedOp> &CachedInterp::get_block(const Cpu &cpu,
                                                      u32 addr) {
    MapEntry &entry = map_[(addr >> 2) & (kMapSize - 1)];
    if (entry.tag == addr) return *entry.block;

    auto it = blocks_.find(addr);
    if (it == blocks_.end()) {
        std::vector<DecodedOp> block;
        u32 a = addr;
        for (size_t i = 0; i < kMaxBlockLen; ++i) {
            DecodedOp d = decode_one(cpu.read32(a), a);
            const bool end = (d.flags & OPF_END) != 0;
            block.push_back(d);
            a += 4;
            if (end) break;
        }
        it = blocks_.emplace(addr, std::move(block)).first;
    }
    entry.tag = addr;
    entry.block = &it->second;
    return it->second;
}

u64 CachedInterp::run(Cpu &cpu, u64 max_instrs) {
    u64 executed = 0;
    while (!cpu.halted && executed < max_instrs) {
        const std::vector<DecodedOp> &block = get_block(cpu, cpu.r[15]);
        for (const DecodedOp &d : block) {
            ++executed;
            if (cond_passed(cpu, d.cond)) {
                d.fn(cpu, d);
                if (cpu.branched) {
                    cpu.branched = false;
                    break;
                }
                if (cpu.halted) break;
            }
            cpu.r[15] += 4;
        }
    }
    return executed;
}

} // namespace arm
