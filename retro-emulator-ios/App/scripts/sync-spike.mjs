// Copies the ARM11 spike sources into the SpikeBench native module.
//
// The canonical sources live in ../Spikes/arm11-interp (edit THERE, never
// here); this vendored copy exists because EAS Build uploads only the app
// directory, and CocoaPods can't reference files outside the podspec's
// folder. Run after any spike change:  npm run sync-spike

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const spikeDir = join(here, "..", "..", "Spikes", "arm11-interp");
const destDir = join(here, "..", "modules", "spike-bench", "ios", "cpp");

const files = ["arm_interp.h", "arm_interp.cpp", "asm_helpers.h", "kernels.h"];

mkdirSync(destDir, { recursive: true });
const banner =
  "// VENDORED COPY — synced from Spikes/arm11-interp by scripts/sync-spike.mjs.\n" +
  "// Edit the original and re-run `npm run sync-spike`; do not edit here.\n\n";
for (const file of files) {
  const source = readFileSync(join(spikeDir, file), "utf8");
  writeFileSync(join(destDir, file), banner + source);
  console.log(`synced ${file}`);
}
