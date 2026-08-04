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
        std::printf("%-12s %-22s %10.1f %10.2f %7.2fx\n",
                    kernel.name.c_str(), "naive", naive.mips,
                    naive.ns_per_instr, naive.mips / kArm11Mips);
        std::printf("%-12s %-22s %10.1f %10.2f %7.2fx\n", "",
                    "block-cached", cached.mips, cached.ns_per_instr,
                    cached.mips / kArm11Mips);
        if (naive.mips > 0)
            std::printf("%-12s %-22s %9.2fx\n", "", "cached speedup",
                        cached.mips / naive.mips);
        std::printf("\n");
    }
    std::printf("vs 1:1 >= 1.00x means this host core emulates one fully "
                "busy ARM11 core in real time.\n");
    return 0;
}
