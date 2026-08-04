// bench.cpp — throughput measurement for the ARM11 interpreter spike.
//
// Reports guest MIPS and ns/guest-instruction for the naive and
// block-cached backends on each kernel.
//
// Context for reading the numbers (PLAN.md §1.1): a fully busy 3DS ARM11
// core at a worst-case 1 instruction/cycle needs ~268 guest MIPS; the 3DS
// has two, scheduled onto two host performance cores, so ~268 MIPS *per
// host core* is the 1:1 bar. Real games spend cycles idle or stalled, so
// playable-speed thresholds are lower — but 268 is the number that ends
// the argument. ONLY MEASUREMENTS ON THE FLOOR DEVICE (iPhone 15 / A16)
// COUNT AS RESULTS; anywhere else, the output is directional only.

#include <chrono>
#include <cstdio>
#include <vector>

#include "arm_interp.h"
#include "kernels.h"

using namespace arm;

namespace {

constexpr u32 kRamSize = 1u << 20;
constexpr double kTargetSeconds = 1.0;
constexpr double kArm11Mips = 268.0;

struct Result {
    double mips = 0;
    double ns_per_instr = 0;
};

template <typename Backend>
Result measure(const kernels::Kernel &kernel) {
    std::vector<u8> ram(kRamSize, 0);

    // Pick an iteration count that runs ~kTargetSeconds, by doubling.
    u32 iterations = 1u << 16;
    double seconds = 0;
    u64 executed = 0;
    for (;;) {
        Cpu cpu;
        cpu.ram = ram.data();
        cpu.ram_mask = kRamSize - 1;
        // mem_stream setup writes `iterations` words from kSrcAddr; keep it
        // inside RAM by capping where the kernel's data would outgrow it.
        u32 n = iterations;
        if (kernel.name == "mem_stream") {
            const u32 max_words = (kRamSize - kernels::kSrcAddr) / 8;
            if (n > max_words) n = max_words;
        }
        kernels::load(kernel, cpu, n);

        Backend backend;
        const auto start = std::chrono::steady_clock::now();
        executed = backend.run(cpu, ~0ull);
        const auto stop = std::chrono::steady_clock::now();
        seconds = std::chrono::duration<double>(stop - start).count();

        if (cpu.error) {
            std::printf("  ERROR: undefined instruction in %s\n",
                        kernel.name.c_str());
            return {};
        }
        if (seconds >= kTargetSeconds || n != iterations) break;
        iterations *= 2;
    }

    Result r;
    r.mips = (double)executed / seconds / 1e6;
    r.ns_per_instr = seconds * 1e9 / (double)executed;
    return r;
}

} // namespace

// Two guest CPUs (the 3DS's ARM11 pair) interleaved on ONE host thread,
// switching every `slice` instructions — an upper bound on the scheduling
// tax, since the production design pins each guest core to its own host
// P-core and only synchronizes at timing boundaries.
Result measure_dual(const kernels::Kernel &kernel, u64 slice) {
    std::vector<u8> ram_a(kRamSize, 0), ram_b(kRamSize, 0);
    Cpu cpu_a, cpu_b;
    cpu_a.ram = ram_a.data();
    cpu_a.ram_mask = kRamSize - 1;
    cpu_b.ram = ram_b.data();
    cpu_b.ram_mask = kRamSize - 1;

    const u32 huge = 0x7FFFFFFF;
    kernels::load(kernel, cpu_a, huge);
    kernels::load(kernel, cpu_b, huge);

    ThreadedInterp interp_a, interp_b;
    u64 executed = 0;
    const auto start = std::chrono::steady_clock::now();
    double seconds = 0;
    do {
        executed += interp_a.run(cpu_a, slice);
        executed += interp_b.run(cpu_b, slice);
        seconds = std::chrono::duration<double>(
                      std::chrono::steady_clock::now() - start)
                      .count();
    } while (seconds < kTargetSeconds && !cpu_a.halted && !cpu_b.halted);

    Result r;
    r.mips = (double)executed / seconds / 1e6;
    r.ns_per_instr = seconds * 1e9 / (double)executed;
    return r;
}

int main() {
    std::printf("ARM11 no-JIT interpreter spike — throughput\n");
    std::printf("host: %s\n",
#if defined(__aarch64__)
                "arm64"
#elif defined(__x86_64__)
                "x86_64 (directional only — floor-device numbers are the "
                "real ones)"
#else
                "unknown"
#endif
    );
    std::printf("bar: %.0f guest MIPS per host core = 1:1 with a fully busy "
                "3DS ARM11 core\n\n",
                kArm11Mips);

    std::printf("%-12s %-22s %10s %10s %8s\n", "kernel", "backend", "MIPS",
                "ns/instr", "vs 1:1");
    for (const kernels::Kernel &kernel : kernels::all()) {
        const Result naive = measure<NaiveInterp>(kernel);
        const Result cached = measure<CachedInterp>(kernel);
        const Result threaded = measure<ThreadedInterp>(kernel);
        std::printf("%-12s %-22s %10.1f %10.2f %7.2fx\n",
                    kernel.name.c_str(), "naive", naive.mips,
                    naive.ns_per_instr, naive.mips / kArm11Mips);
        std::printf("%-12s %-22s %10.1f %10.2f %7.2fx\n", "",
                    "block-cached", cached.mips, cached.ns_per_instr,
                    cached.mips / kArm11Mips);
        std::printf("%-12s %-22s %10.1f %10.2f %7.2fx\n", "",
                    "threaded", threaded.mips, threaded.ns_per_instr,
                    threaded.mips / kArm11Mips);
        if (naive.mips > 0)
            std::printf("%-12s %-22s %9.2fx over naive\n", "",
                        "best speedup", threaded.mips / naive.mips);
        std::printf("\n");
    }

    std::printf("dual-core interleave (2x alu_mix, one host thread, "
                "threaded backend):\n");
    std::printf("%-18s %14s %14s\n", "slice (instrs)", "combined MIPS",
                "per-guest-core");
    const kernels::Kernel alu = kernels::make_alu_mix();
    const Result solo = measure<ThreadedInterp>(alu);
    for (const u64 slice : {64ull, 512ull, 4096ull}) {
        const Result dual = measure_dual(alu, slice);
        std::printf("%-18llu %14.1f %13.1f%%\n", (unsigned long long)slice,
                    dual.mips, 100.0 * (dual.mips / 2.0) / solo.mips);
    }
    std::printf("(per-guest-core %% = each guest core's speed relative to "
                "running alone on this thread)\n\n");

    std::printf("vs 1:1 >= 1.00x means this host core emulates one fully "
                "busy ARM11 core in real time.\n");
    return 0;
}
