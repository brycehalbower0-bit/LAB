/*
 * arm_interp.h — ARM11 (ARMv6-subset) interpreter spike (PLAN.md §10.3).
 *
 * Purpose: measure the achievable throughput of a no-JIT interpreter for the
 * 3DS's ARM11 application cores, comparing a naive per-instruction
 * fetch/decode/execute loop against a block-cached (predecoded micro-op)
 * design — the technique the App Store build depends on.
 *
 * Deliberately a spike, not a core: ARM-state 32-bit instructions only
 * (no Thumb, no coprocessor, no MMU), flat RAM, no interrupts. Enough ISA
 * coverage to run real register/memory/control-flow workloads so the
 * dispatch-cost measurement is honest. The block cache is never invalidated
 * (no self-modifying code here); a production backend invalidates on writes
 * to code pages per cpu_backend.h.
 */

#ifndef ARM11_INTERP_SPIKE_H
#define ARM11_INTERP_SPIKE_H

#include <cstdint>
#include <cstring>
#include <memory>
#include <unordered_map>
#include <vector>

namespace arm {

using u8 = uint8_t;
using u16 = uint16_t;
using u32 = uint32_t;
using u64 = uint64_t;
using s32 = int32_t;
using s64 = int64_t;

struct Cpu {
    u32 r[16] = {};          // r15 = address of the CURRENT instruction
    bool n = false, z = false, c = false, v = false;

    u8 *ram = nullptr;       // flat guest RAM, power-of-two size
    u32 ram_mask = 0;

    bool halted = false;     // set by SWI (the spike's exit instruction)
    bool error = false;      // set on undefined/unsupported encodings
    u32 error_instr = 0;
    bool branched = false;   // set by any handler that writes r15

    u32 pc() const { return r[15]; }

    // r15 reads as current instruction + 8 (ARM pipeline semantics).
    u32 reg_read(int i) const { return i == 15 ? r[15] + 8 : r[i]; }

    u32 read32(u32 addr) const {
        u32 v_;
        std::memcpy(&v_, ram + (addr & ram_mask & ~3u), 4);
        return v_;
    }
    u8 read8(u32 addr) const { return ram[addr & ram_mask]; }
    void write32(u32 addr, u32 value) {
        std::memcpy(ram + (addr & ram_mask & ~3u), &value, 4);
    }
    void write8(u32 addr, u8 value) { ram[addr & ram_mask] = value; }
};

struct DecodedOp;
using Handler = void (*)(Cpu &, const DecodedOp &);

// Flags in DecodedOp::flags
enum : u8 {
    OPF_LOAD = 1 << 0,   // load/store: this is a load
    OPF_BYTE = 1 << 1,   // load/store: byte-sized
    OPF_PRE = 1 << 2,    // load/store: pre-indexed
    OPF_UP = 1 << 3,     // load/store: offset added (else subtracted)
    OPF_WB = 1 << 4,     // load/store: writeback
    OPF_END = 1 << 5,    // decode marked this the end of a basic block
    // Unconditional and provably straight-line (cannot write r15, halt, or
    // fault): the threaded driver executes these with zero per-op checks.
    OPF_FAST = 1 << 6,
};

struct DecodedOp {
    Handler fn = nullptr;
    u8 cond = 14;        // condition field (14 = AL)
    u8 rd = 0, rn = 0, rm = 0, rs = 0;
    u8 shift_type = 0;   // 0 LSL, 1 LSR, 2 ASR, 3 ROR
    u8 shift_amount = 0; // imm5; for ALU immediates: 1 iff rotation != 0
    u8 flags = 0;
    u32 imm = 0;         // rotated ALU immediate / ldr-str offset / branch target
};

// Decodes one ARM instruction at `addr` (instruction word `instr`).
// On unsupported encodings, returns an op whose handler flags cpu.error.
DecodedOp decode_one(u32 instr, u32 addr);

bool cond_passed(const Cpu &cpu, u8 cond);

// Backend 1: fetch/decode/execute every instruction, every time.
struct NaiveInterp {
    // Runs until halt/error or max_instrs; returns instructions executed.
    u64 run(Cpu &cpu, u64 max_instrs);
};

// Decoded-block store shared by the cached backends: direct-mapped fast
// lookup keyed by block start address (the shape a production block cache
// takes), backed by an unordered_map (node-based, so value addresses are
// stable across rehash).
class BlockCache {
  public:
    static constexpr size_t kMaxBlockLen = 64;

    const std::vector<DecodedOp> &get_block(const Cpu &cpu, u32 addr);
    void clear() {
        blocks_.clear();
        map_.assign(map_.size(), MapEntry{});
    }

  private:
    struct MapEntry {
        u32 tag = 0xFFFFFFFFu;
        const std::vector<DecodedOp> *block = nullptr;
    };
    static constexpr size_t kMapSize = 4096;
    std::vector<MapEntry> map_ = std::vector<MapEntry>(kMapSize);
    std::unordered_map<u32, std::vector<DecodedOp>> blocks_;
};

// Backend 2: decode basic blocks once, cache the micro-op sequences,
// re-execute the cached form. No machine code is ever generated.
struct CachedInterp {
    u64 run(Cpu &cpu, u64 max_instrs);
    void clear() { cache_.clear(); }

  private:
    BlockCache cache_;
};

// Backend 3: block-cached plus threaded-style dispatch — ops that decode
// proved unconditional and straight-line (OPF_FAST) execute with no per-op
// condition/branch/halt checks, and instruction accounting is batched per
// block instead of per op. Still zero runtime code generation.
struct ThreadedInterp {
    u64 run(Cpu &cpu, u64 max_instrs);
    void clear() { cache_.clear(); }

  private:
    BlockCache cache_;
};

} // namespace arm

#endif // ARM11_INTERP_SPIKE_H
