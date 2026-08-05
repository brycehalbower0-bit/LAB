// On-device file layout. Paths are built here in JS; all byte I/O
// happens natively (bytes never cross the JS bridge).
//
//   Documents/roms/<name>.gba
//   Documents/saves/<name>.sav
//   Documents/states/<name>.slot{0-2}.state

import { Directory, Paths } from "expo-file-system";

export const romsDir = new Directory(Paths.document, "roms");
export const savesDir = new Directory(Paths.document, "saves");
export const statesDir = new Directory(Paths.document, "states");

export function ensureDirs(): void {
  for (const dir of [romsDir, savesDir, statesDir]) {
    dir.create({ intermediates: true, idempotent: true });
  }
}

/** file:// URI -> POSIX path for the native module. */
export function toPosixPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ""));
}

/** "Game.gba" -> "Game" */
export function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

export function savePathFor(romFileName: string): string {
  return toPosixPath(`${savesDir.uri}/${encodeURIComponent(baseName(romFileName))}.sav`);
}

export function statePathFor(romFileName: string, slot: number): string {
  return toPosixPath(
    `${statesDir.uri}/${encodeURIComponent(baseName(romFileName))}.slot${slot}.state`,
  );
}
