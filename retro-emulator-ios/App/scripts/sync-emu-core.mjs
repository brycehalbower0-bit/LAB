// Copies the shared core ABI and core sources into the EmuCore native
// module.
//
// The canonical sources live outside App/ (edit THERE, never here); this
// vendored copy exists because EAS Build uploads only the app directory,
// and CocoaPods can't reference files outside the podspec's folder.
//
// Usage: npm run sync-emu-core

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const destRoot = join(here, "..", "modules", "emu-core", "ios", "cpp");

const banner =
  "// VENDORED COPY — synced by scripts/sync-emu-core.mjs.\n" +
  "// Edit the original and re-run `npm run sync-emu-core`; do not edit here.\n\n";

// [canonical path relative to retro-emulator-ios/, vendored path relative
// to modules/emu-core/ios/cpp/]
const files = [
  ["Cores/Shared/include/core_api.h", "include/core_api.h"],
  ["Tests/CoreTests/null_core.c", "null_core.c"],
  ["Cores/GBA/gba_core.c", "gba/gba_core.c"],
  ["Cores/NDS/nds_core.cpp", "nds/nds_core.cpp"],
  ["Cores/NDS/nds_platform.cpp", "nds/nds_platform.cpp"],
];

for (const [src, dest] of files) {
  const destPath = join(destRoot, dest);
  mkdirSync(dirname(destPath), { recursive: true });
  const body = readFileSync(join(repoRoot, src), "utf8");
  writeFileSync(destPath, banner + body);
  console.log(`synced ${src} -> ${dest}`);
}

// The mGBA snapshot is copied verbatim (no banner — MPL-2.0 files stay
// byte-identical to upstream; the snapshot is already the vendoring
// layer, Cores/GBA/README.md records provenance). Only the directories
// the LIBMGBA_ONLY build compiles are copied; CI's "Dump mGBA compile
// manifest" step is the ground truth if this list needs revisiting.
import { cpSync, rmSync } from "node:fs";

const mgbaSrc = join(repoRoot, "Cores", "GBA", "mgba");
const mgbaDest = join(destRoot, "gba", "mgba");
rmSync(mgbaDest, { recursive: true, force: true });
const mgbaDirs = [
  "include",
  "src/arm",
  "src/core",
  "src/feature",
  "src/gb",
  "src/gba",
  "src/sm83",
  "src/util",
  "src/platform/posix",
  "src/third-party/blip_buf",
  "src/third-party/inih",
];
for (const dir of mgbaDirs) {
  cpSync(join(mgbaSrc, dir), join(mgbaDest, dir), { recursive: true });
}
cpSync(join(mgbaSrc, "LICENSE"), join(mgbaDest, "LICENSE"));

// The podspec compiles the vendored tree by glob, so the tree must hold
// exactly the sources the LIBMGBA_ONLY build compiles. This manifest is
// CI ground truth (the "Dump mGBA compile manifest" step); .c files not
// listed are deleted after the copy. Headers are always kept.
const compiledSources = new Set([
  "src/arm/arm.c", "src/arm/decoder-arm.c", "src/arm/decoder-thumb.c",
  "src/arm/decoder.c", "src/arm/isa-arm.c", "src/arm/isa-thumb.c",
  "src/core/bitmap-cache.c", "src/core/cache-set.c", "src/core/cheats.c",
  "src/core/config.c", "src/core/core.c", "src/core/directories.c",
  "src/core/input.c", "src/core/interface.c", "src/core/library.c",
  "src/core/lockstep.c", "src/core/log.c", "src/core/map-cache.c",
  "src/core/mem-search.c", "src/core/rewind.c", "src/core/serialize.c",
  "src/core/sync.c", "src/core/thread.c", "src/core/tile-cache.c",
  "src/core/timing.c", "src/core/version.c",
  "src/feature/commandline.c", "src/feature/thread-proxy.c",
  "src/feature/updater.c", "src/feature/video-logger.c",
  "src/gb/audio.c", "src/gb/cheats.c", "src/gb/core.c",
  "src/gb/extra/proxy.c", "src/gb/gb.c", "src/gb/input.c", "src/gb/io.c",
  "src/gb/mbc.c", "src/gb/memory.c", "src/gb/overrides.c",
  "src/gb/renderers/cache-set.c", "src/gb/renderers/software.c",
  "src/gb/serialize.c", "src/gb/sio.c", "src/gb/sio/lockstep.c",
  "src/gb/sio/printer.c", "src/gb/timer.c", "src/gb/video.c",
  "src/gba/audio.c", "src/gba/bios.c", "src/gba/cart/ereader.c",
  "src/gba/cart/gpio.c", "src/gba/cart/matrix.c", "src/gba/cart/vfame.c",
  "src/gba/cheats.c", "src/gba/cheats/codebreaker.c",
  "src/gba/cheats/gameshark.c", "src/gba/cheats/parv3.c",
  "src/gba/core.c", "src/gba/dma.c", "src/gba/extra/audio-mixer.c",
  "src/gba/extra/battlechip.c", "src/gba/extra/proxy.c", "src/gba/gba.c",
  "src/gba/hle-bios.c", "src/gba/input.c", "src/gba/io.c",
  "src/gba/memory.c", "src/gba/overrides.c",
  "src/gba/renderers/cache-set.c", "src/gba/renderers/common.c",
  "src/gba/renderers/gl.c", "src/gba/renderers/software-bg.c",
  "src/gba/renderers/software-mode0.c", "src/gba/renderers/software-obj.c",
  "src/gba/renderers/video-software.c", "src/gba/savedata.c",
  "src/gba/serialize.c", "src/gba/sharkport.c", "src/gba/sio.c",
  "src/gba/sio/dolphin.c", "src/gba/sio/gbp.c", "src/gba/sio/joybus.c",
  "src/gba/sio/lockstep.c", "src/gba/timer.c", "src/gba/video.c",
  "src/platform/posix/memory.c",
  "src/sm83/decoder.c", "src/sm83/isa-sm83.c", "src/sm83/sm83.c",
  "src/third-party/blip_buf/blip_buf.c", "src/third-party/inih/ini.c",
  "src/util/circle-buffer.c", "src/util/configuration.c",
  "src/util/convolve.c", "src/util/crc32.c", "src/util/elf-read.c",
  "src/util/export.c", "src/util/formatting.c", "src/util/gbk-table.c",
  "src/util/hash.c", "src/util/patch-fast.c", "src/util/patch-ips.c",
  "src/util/patch-ups.c", "src/util/patch.c", "src/util/png-io.c",
  "src/util/ring-fifo.c", "src/util/string.c", "src/util/table.c",
  "src/util/text-codec.c", "src/util/vfs.c", "src/util/vfs/vfs-dirent.c",
  "src/util/vfs/vfs-fd.c", "src/util/vfs/vfs-fifo.c",
  "src/util/vfs/vfs-mem.c",
]);

import { readdirSync, statSync, unlinkSync } from "node:fs";

function pruneUncompiled(dir, rel) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const relPath = rel ? `${rel}/${entry}` : entry;
    if (statSync(abs).isDirectory()) {
      pruneUncompiled(abs, relPath);
    } else if (
      (entry.endsWith(".c") || entry.endsWith(".c.in")) &&
      !compiledSources.has(relPath)
    ) {
      unlinkSync(abs);
    }
  }
}
pruneUncompiled(mgbaDest, "");
console.log(`synced Cores/GBA/mgba (manifest-pruned) -> gba/mgba`);

// --- melonDS (NDS core) — same pattern: verbatim copy, then prune .c/
// .cpp files not in CI's compile manifest so the podspec's glob
// compiles exactly what CI proved. Headers are always kept.
const melondsSrc = join(repoRoot, "Cores", "NDS", "melonds");
const melondsDest = join(destRoot, "nds", "melonds");
rmSync(melondsDest, { recursive: true, force: true });
cpSync(join(melondsSrc, "src"), join(melondsDest, "src"), { recursive: true });
cpSync(join(melondsSrc, "LICENSE"), join(melondsDest, "LICENSE"));

const ndsCompiled = new Set([
  "src/ARCodeFile.cpp", "src/ARDatabaseDAT.cpp", "src/AREngine.cpp",
  "src/ARM.cpp", "src/ARMInterpreter.cpp", "src/ARMInterpreter_ALU.cpp",
  "src/ARMInterpreter_Branch.cpp", "src/ARMInterpreter_LoadStore.cpp",
  "src/CP15.cpp", "src/CRC32.cpp", "src/DMA.cpp", "src/DMA_Timings.cpp",
  "src/DSP_HLE/AACUcode.cpp", "src/DSP_HLE/G711Ucode.cpp",
  "src/DSP_HLE/GraphicsUcode.cpp", "src/DSP_HLE/UcodeBase.cpp",
  "src/DSi.cpp", "src/DSi_AES.cpp", "src/DSi_Camera.cpp",
  "src/DSi_DSP.cpp", "src/DSi_I2C.cpp", "src/DSi_I2S.cpp",
  "src/DSi_NAND.cpp", "src/DSi_NDMA.cpp", "src/DSi_NWifi.cpp",
  "src/DSi_SD.cpp", "src/DSi_SPI_TSC.cpp", "src/FATIO.cpp",
  "src/FATStorage.cpp", "src/FreeBIOS.cpp", "src/GBACart.cpp",
  "src/GBACartMotionPak.cpp", "src/GPU.cpp", "src/GPU2D.cpp",
  "src/GPU2D_Soft.cpp", "src/GPU3D.cpp", "src/GPU3D_Soft.cpp",
  "src/GPU3D_Texcache.cpp", "src/Mic.cpp", "src/NDS.cpp",
  "src/NDSCart.cpp", "src/NDSCartR4.cpp", "src/ROMList.cpp",
  "src/RTC.cpp", "src/SPI.cpp", "src/SPI_Firmware.cpp", "src/SPU.cpp",
  "src/Savestate.cpp", "src/Utils.cpp", "src/Wifi.cpp", "src/WifiAP.cpp",
  "src/blip-buf/blip_buf.c", "src/fatfs/ff.c", "src/fatfs/ffsystem.c",
  "src/fatfs/ffunicode.c", "src/sha1/sha1.c",
  // NOTE: teakra_c.cpp / disassembler_c.cpp are a separate CMake target
  // melonDS never links (they appear in compile_commands.json because it
  // lists configured targets, not built ones — and they don't compile
  // against this teakra fork). Excluded deliberately.
  "src/teakra/src/ahbm.cpp", "src/teakra/src/apbp.cpp",
  "src/teakra/src/btdmp.cpp", "src/teakra/src/disassembler.cpp",
  "src/teakra/src/dma.cpp",
  "src/teakra/src/memory_interface.cpp", "src/teakra/src/mmio.cpp",
  "src/teakra/src/parser.cpp", "src/teakra/src/processor.cpp",
  "src/teakra/src/teakra.cpp",
  "src/teakra/src/timer.cpp", "src/tiny-AES-c/aes.c",
  "src/xxhash/xxhash.c",
]);

function pruneNds(dir, rel) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const relPath = rel ? `${rel}/${entry}` : entry;
    if (statSync(abs).isDirectory()) {
      pruneNds(abs, relPath);
    } else if (
      (entry.endsWith(".c") || entry.endsWith(".cpp")) &&
      !ndsCompiled.has(relPath)
    ) {
      unlinkSync(abs);
    }
  }
}
pruneNds(melondsDest, "");
console.log("synced Cores/NDS/melonds (manifest-pruned) -> nds/melonds");

// version.c is CMake-generated upstream; generate it here from the
// pinned tag (Cores/GBA/README.md).
const versionTemplate = readFileSync(
  join(mgbaSrc, "src", "core", "version.c.in"),
  "utf8",
);
const versionValues = {
  GIT_COMMIT: "vendored-0.10.5",
  GIT_COMMIT_SHORT: "0.10.5",
  GIT_BRANCH: "vendored",
  GIT_REV: "-1",
  BINARY_NAME: "mgba",
  PROJECT_NAME: "mGBA",
  VERSION_STRING: "0.10.5",
};
const versionBody = versionTemplate.replace(
  /\$\{([A-Z_]+)\}/g,
  (_, key) => versionValues[key] ?? "",
);
writeFileSync(join(mgbaDest, "src", "core", "version.c"), versionBody);
console.log("generated gba/mgba/src/core/version.c (0.10.5)");
