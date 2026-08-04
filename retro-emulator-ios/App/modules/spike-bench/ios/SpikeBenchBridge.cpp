// SpikeBenchBridge.cpp — runs the ARM11 interpreter spike on-device and
// reports JSON. Mirrors Spikes/arm11-interp/bench.cpp with a shorter
// per-measurement budget so the whole run stays interactive (~5-8s).

#include "SpikeBenchBridge.h"

#include <chrono>
#include <cstdarg>
#include <cstdio>
#include <string>
#include <vector>

#include "cpp/kernels.h"

namespace {

using namespace arm;

constexpr u32 kRamSize = 1u << 20;
constexpr double kTargetSeconds = 0.35;
constexpr double kArm11Mips = 268.0;

struct Result {
    double mips = 0;
    double ns_per_instr = 0;
    bool ok = false;
};

template <typename Backend>
Result measure(const kernels::Kernel &kernel) {
    std::vector<u8> ram(kRamSize, 0);
    u32 iterations = 1u << 15;
    double seconds = 0;
    u64 executed = 0;
    for (;;) {
        Cpu cpu;
        cpu.ram = ram.data();
        cpu.ram_mask = kRamSize - 1;
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

        if (cpu.error) return {};
        if (seconds >= kTargetSeconds || n != iterations) break;
        iterations *= 2;
    }
    Result r;
    r.mips = (double)executed / seconds / 1e6;
    r.ns_per_instr = seconds * 1e9 / (double)executed;
    r.ok = true;
    return r;
}

Result measure_dual(const kernels::Kernel &kernel, u64 slice) {
    std::vector<u8> ram_a(kRamSize, 0), ram_b(kRamSize, 0);
    Cpu cpu_a, cpu_b;
    cpu_a.ram = ram_a.data();
    cpu_a.ram_mask = kRamSize - 1;
    cpu_b.ram = ram_b.data();
    cpu_b.ram_mask = kRamSize - 1;
    kernels::load(kernel, cpu_a, 0x7FFFFFFF);
    kernels::load(kernel, cpu_b, 0x7FFFFFFF);

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
    r.ok = true;
    return r;
}

void append(std::string &out, const char *fmt, ...) {
    char buf[256];
    va_list args;
    va_start(args, fmt);
    vsnprintf(buf, sizeof(buf), fmt, args);
    va_end(args);
    out += buf;
}

std::string g_json;

} // namespace

extern "C" const char *spike_bench_run_json(void) {
    std::string out = "{";
#if defined(__aarch64__)
    append(out, "\"host\":\"arm64\",");
#else
    append(out, "\"host\":\"other\",");
#endif
    append(out, "\"bar_mips\":%.1f,\"results\":[", kArm11Mips);

    bool first = true;
    for (const kernels::Kernel &kernel : kernels::all()) {
        struct {
            const char *name;
            Result r;
        } rows[] = {
            {"naive", measure<NaiveInterp>(kernel)},
            {"block-cached", measure<CachedInterp>(kernel)},
            {"threaded", measure<ThreadedInterp>(kernel)},
        };
        for (const auto &row : rows) {
            if (!first) out += ",";
            first = false;
            append(out,
                   "{\"kernel\":\"%s\",\"backend\":\"%s\",\"mips\":%.1f,"
                   "\"ns_per_instr\":%.2f,\"vs_bar\":%.3f,\"ok\":%s}",
                   kernel.name.c_str(), row.name, row.r.mips,
                   row.r.ns_per_instr, row.r.mips / kArm11Mips,
                   row.r.ok ? "true" : "false");
        }
    }
    out += "],\"dual\":[";

    const kernels::Kernel alu = kernels::make_alu_mix();
    const Result solo = measure<ThreadedInterp>(alu);
    bool first_dual = true;
    for (const u64 slice : {64ull, 512ull, 4096ull}) {
        const Result dual = measure_dual(alu, slice);
        if (!first_dual) out += ",";
        first_dual = false;
        append(out,
               "{\"slice\":%llu,\"combined_mips\":%.1f,\"per_core_pct\":%.1f}",
               (unsigned long long)slice, dual.mips,
               solo.ok && solo.mips > 0 ? 100.0 * (dual.mips / 2.0) / solo.mips
                                        : 0.0);
    }
    out += "]}";

    g_json = std::move(out);
    return g_json.c_str();
}
