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
];

for (const [src, dest] of files) {
  const destPath = join(destRoot, dest);
  mkdirSync(dirname(destPath), { recursive: true });
  const body = readFileSync(join(repoRoot, src), "utf8");
  writeFileSync(destPath, banner + body);
  console.log(`synced ${src} -> ${dest}`);
}
