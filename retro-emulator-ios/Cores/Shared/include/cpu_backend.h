/*
 * cpu_backend.h — the swappable CPU backend interface (PLAN.md §6.4).
 *
 * Every core's CPU emulation sits behind this interface, with at least two
 * implementations selected at build time:
 *
 *   - an interpreter backend (no runtime code generation; App Store legal)
 *   - where upstream provides one, a JIT backend (sideload / EU-marketplace
 *     / TestFlight-with-debugger builds)
 *
 * Rules that keep the two builds interchangeable:
 *
 *   1. serialize/deserialize handle ARCHITECTURAL state only (registers,
 *      status/mode state, pending interrupts). Never backend-internal caches.
 *      A state saved under the interpreter must load under the JIT and vice
 *      versa.
 *   2. Backends own no guest memory. All access goes through CpuBus, provided
 *      by the core; block caches and fastmem-style optimizations live behind
 *      the backend boundary and must honor invalidate().
 *   3. One backend instance emulates one guest CPU. Multi-CPU systems (NDS:
 *      ARM9+ARM7, 3DS: 2x ARM11 + ARM9) create one instance per guest core
 *      and interleave scheduling in the core's own loop.
 */

#ifndef RETRO_EMU_CPU_BACKEND_H
#define RETRO_EMU_CPU_BACKEND_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum CpuArch {
    CPU_ARCH_ARM7TDMI = 0,   /* ARMv4T  — GBA, NDS ARM7 */
    CPU_ARCH_ARM946ES = 1,   /* ARMv5TE — NDS ARM9, 3DS ARM9 */
    CPU_ARCH_ARM11MPCORE = 2,/* ARMv6K  — 3DS application cores */
} CpuArch;

/*
 * Guest memory access, provided by the core. Backends may additionally
 * request flat page mappings via map_page for fast paths; a core that cannot
 * provide one for a region returns NULL and the backend falls back to the
 * callbacks (MMIO, unmapped regions).
 */
typedef struct CpuBus {
    void *ctx;
    uint8_t  (*read8)(void *ctx, uint32_t addr);
    uint16_t (*read16)(void *ctx, uint32_t addr);
    uint32_t (*read32)(void *ctx, uint32_t addr);
    void     (*write8)(void *ctx, uint32_t addr, uint8_t value);
    void     (*write16)(void *ctx, uint32_t addr, uint16_t value);
    void     (*write32)(void *ctx, uint32_t addr, uint32_t value);
    /*
     * Optional (may be NULL): return a host pointer covering the aligned
     * page containing addr if it is plain RAM/ROM, else NULL.
     * page_size_log2 is set by the core (e.g. 12 for 4 KiB).
     */
    void    *(*map_page)(void *ctx, uint32_t addr, int write);
    uint32_t  page_size_log2;
} CpuBus;

typedef struct CpuBackend CpuBackend;

typedef struct CpuBackendApi {
    const char *name;        /* e.g. "interp-blockcached", "jit-dynarmic" */
    int         is_jit;      /* 1 if this backend generates code at runtime */

    CpuBackend *(*create)(CpuArch arch, const CpuBus *bus);
    void        (*destroy)(CpuBackend *cpu);

    void        (*reset)(CpuBackend *cpu, uint32_t entry_pc);

    /*
     * Run for approximately `cycles` guest cycles; returns cycles actually
     * consumed (may overshoot by one instruction/block). The core's scheduler
     * uses the return value to keep multiple guest CPUs and peripherals in
     * relative sync.
     */
    int64_t     (*run)(CpuBackend *cpu, int64_t cycles);

    /* Asserts/clears the IRQ/FIQ input lines. */
    void        (*set_irq)(CpuBackend *cpu, int asserted);
    void        (*set_fiq)(CpuBackend *cpu, int asserted);

    /* Architectural register access (r0-r15 = 0-15; CPSR = 16). */
    uint32_t    (*get_reg)(const CpuBackend *cpu, int index);
    void        (*set_reg)(CpuBackend *cpu, int index, uint32_t value);

    /*
     * Invalidate any cached translations/decodings overlapping
     * [addr, addr+size). Cores call this on writes to code regions and on
     * DMA into RAM. A backend with no caches may make this a no-op.
     */
    void        (*invalidate)(CpuBackend *cpu, uint32_t addr, uint32_t size);

    /* Architectural state only — see rule 1 above. */
    size_t      (*state_size)(const CpuBackend *cpu);
    void        (*state_save)(const CpuBackend *cpu, uint8_t *out);
    void        (*state_load)(CpuBackend *cpu, const uint8_t *data);
} CpuBackendApi;

#ifdef __cplusplus
} /* extern "C" */
#endif

#endif /* RETRO_EMU_CPU_BACKEND_H */
