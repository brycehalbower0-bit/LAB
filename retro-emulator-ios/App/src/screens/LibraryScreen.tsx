// Library — ROM import and selection. Slice 1 ships import + listing;
// tapping a ROM starts working when the GBA core lands (Slice 2).
// Long-press the title for diagnostic screens (null-core test and the
// ARM11 benchmark, still needed for the ADR 0002 floor-device run).

import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { unzipSync } from "fflate";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppState,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { copyLarge, extractRomArchive, isArchive, readAll } from "../archive";
import { documentsRoot, ensureDirs, romsDir } from "../paths";

const ROM_RE = /\.(gba|nds|3ds|cci|cxi|3dsx|app|elf)$/i;

interface RomEntry {
  name: string;
  uri: string;
}

export default function LibraryScreen({
  onOpenDiagnostics,
  onOpenSettings,
  onOpenRom,
}: {
  onOpenDiagnostics: () => void;
  onOpenSettings: () => void;
  onOpenRom: (rom: RomEntry) => void;
}) {
  const [roms, setRoms] = useState<RomEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    ensureDirs();
    // Files dropped in via Finder/the Files app land in Documents/
    // (UIFileSharingEnabled). Adopt them into roms/ — this is the only
    // practical route for multi-GB 3DS dumps, since it involves no
    // picker, no cache copy, and no in-memory unzip.
    try {
      for (const entry of documentsRoot.list()) {
        if (entry instanceof File && ROM_RE.test(entry.name)) {
          const dest = new File(romsDir, entry.name);
          if (!dest.exists) {
            entry.move(dest);
          }
        }
      }
    } catch {
      // Non-fatal: the picker path still works.
    }
    const entries = romsDir
      .list()
      .filter((e): e is File => e instanceof File)
      .filter((f) => ROM_RE.test(f.name))
      .map((f) => ({ name: f.name, uri: f.uri }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setRoms(entries);
  }, []);

  useEffect(refresh, [refresh]);

  // Dropping a multi-GB dump into the EmuLab folder in Files is the only
  // import path that costs nothing (a move inside the sandbox volume is
  // a rename). Rescan on foreground so coming back from Files is enough.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  async function importRom() {
    // copyToCacheDirectory duplicates the file before we even see it —
    // fatal for multi-GB 3DS dumps. Read straight from the picked URL.
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: false,
    });
    if (result.canceled || !result.assets?.length) return;

    const notes: string[] = [];
    const imported: string[] = [];
    try {
      ensureDirs();
      for (const asset of result.assets) {
        const source = new File(asset.uri);
        const sizeMB = ((asset.size ?? 0) / 1048576).toFixed(0);

        // Per-asset, so one bad file reports itself instead of aborting
        // the batch with a bare "Import failed" and no clue which one.
        try {
        if (isArchive(asset.name)) {
          // tar/gzip archives stream: no size limit, bounded memory.
          const names = await extractRomArchive(source, romsDir, (p) => {
            const pct = p.totalBytes
              ? Math.round((p.readBytes / p.totalBytes) * 100)
              : 0;
            setBusy(
              `Extracting ${asset.name} — ${pct}%` +
                (p.current ? ` (${p.current})` : ""),
            );
          });
          setBusy(null);
          if (names.length === 0) {
            notes.push(`${asset.name}: no supported ROM inside the archive.`);
          } else {
            imported.push(...names);
          }
        } else if (asset.name.toLowerCase().endsWith(".zip")) {
          // Unzipping needs the whole archive in memory; fine for GBA/DS,
          // impossible for a multi-GB 3DS dump.
          if ((asset.size ?? 0) > 600 * 1048576) {
            notes.push(
              `${asset.name} (${sizeMB} MB) is too large to unzip on ` +
                `device — unzip it first, then import the ROM itself.`,
            );
            continue;
          }
          // Read by stream, not source.arrayBuffer(): the picker hands
          // back a URL still outside the sandbox (copyToCacheDirectory is
          // off so multi-GB dumps aren't duplicated), and reading one of
          // those in a single shot is what fails.
          setBusy(`Reading ${asset.name}…`);
          const zipped = unzipSync(await readAll(source));
          let found = 0;
          for (const [entryName, bytes] of Object.entries(zipped)) {
            const clean = entryName.split("/").pop() ?? entryName;
            if (!ROM_RE.test(clean) || bytes.length === 0) continue;
            const dest = new File(romsDir, clean);
            if (dest.exists) dest.delete();
            dest.write(bytes);
            imported.push(clean);
            found++;
          }
          setBusy(null);
          if (found === 0) {
            const inside = Object.keys(zipped);
            notes.push(
              `${asset.name}: no supported ROM inside the zip. ` +
                `It contains: ${inside.slice(0, 5).join(", ") || "(nothing)"}`,
            );
          }
        } else if (/\.(7z|rar)$/i.test(asset.name)) {
          // LZMA (7z) and RAR need heavyweight decoders; on-device they
          // would take far longer than extracting on a computer.
          notes.push(
            `${asset.name} is a ${asset.name.split(".").pop()!.toUpperCase()} ` +
              `archive, which this app can't open. Extract it on a ` +
              `computer (7-Zip / The Unarchiver), then bring over the ` +
              `.3ds file itself.`,
          );
        } else if (!ROM_RE.test(asset.name)) {
          notes.push(
            `${asset.name}: unsupported type. Use .gba, .nds, or ` +
              `.3ds/.cci/.cxi/.3dsx (zip and tar/gz archives also work).`,
          );
        } else {
          // Importing duplicates the file into the sandbox, so a 2 GB 3DS
          // dump needs 2 GB free on top of the copy already in Files.
          // Check first and say so, rather than failing after minutes.
          const need = asset.size ?? 0;
          const free = Paths.availableDiskSpace;
          if (need > 0 && free > 0 && free < need + 200 * 1048576) {
            notes.push(
              `${asset.name} (${sizeMB} MB) needs ${sizeMB} MB free but ` +
                `only ${(free / 1048576).toFixed(0)} MB is available. ` +
                `Move it into the EmuLab folder in Files instead — that ` +
                `costs no extra space.`,
            );
            continue;
          }
          const dest = new File(romsDir, asset.name);
          try {
            await copyLarge(source, dest, (p) => {
              const pct = p.totalBytes
                ? Math.round((p.readBytes / p.totalBytes) * 100)
                : 0;
              setBusy(`Copying ${asset.name} — ${pct}%`);
            });
          } catch (e) {
            setBusy(null);
            notes.push(
              `${asset.name} (${sizeMB} MB) could not be copied: ${e}. ` +
                `Move it into the EmuLab folder in Files instead.`,
            );
            continue;
          }
          setBusy(null);
          imported.push(asset.name);
        }
        } catch (e) {
          setBusy(null);
          notes.push(`${asset.name}: ${e}`);
        }
      }
      refresh();

      // Always say something: silence was indistinguishable from a
      // filtered-out file, a failed copy, or an out-of-memory unzip.
      const NL = String.fromCharCode(10);
      if (imported.length > 0) {
        Alert.alert(
          "Imported",
          imported.join(NL) +
            (notes.length ? NL + NL + notes.join(NL) : ""),
        );
      } else {
        // No decryption boilerplate here: import never inspects contents,
        // so appending it made every failure read as an encryption verdict.
        // That guidance belongs where a load actually fails.
        Alert.alert(
          "Nothing imported",
          notes.length ? notes.join(NL + NL) : "No supported ROM found.",
        );
      }
    } catch (e) {
      setBusy(null);
      Alert.alert("Import failed", String(e));
    }
  }

  return (
    <View style={styles.container}>
      <Pressable onLongPress={onOpenDiagnostics} delayLongPress={600}>
        <Text style={styles.title}>EmuLab</Text>
      </Pressable>
      <Text style={styles.subtitle}>
        {roms.length === 0
          ? "No games yet — import a ROM you own."
          : `${roms.length} game${roms.length === 1 ? "" : "s"}`}
      </Text>

      <Pressable
        style={[styles.importButton, busy !== null && styles.importBusy]}
        onPress={importRom}
        disabled={busy !== null}
      >
        <Text style={styles.buttonText}>{busy ?? "Import ROM"}</Text>
      </Pressable>

      <FlatList
        style={styles.list}
        data={roms}
        keyExtractor={(item) => item.uri}
        renderItem={({ item }) => (
          <Pressable style={styles.romRow} onPress={() => onOpenRom(item)}>
            <Text style={styles.romName}>{item.name}</Text>
          </Pressable>
        )}
      />

      <Pressable style={styles.settingsButton} onPress={onOpenSettings}>
        <Text style={styles.settingsIcon}>⚙</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0b0f", padding: 20, paddingTop: 70 },
  title: { color: "#fff", fontSize: 28, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginTop: 4 },
  importButton: {
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  importBusy: { backgroundColor: "#374151" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  list: { marginTop: 16 },
  romRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1f2937",
  },
  romName: { color: "#e5e7eb", fontSize: 16 },
  settingsButton: {
    position: "absolute",
    right: 20,
    bottom: 40,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsIcon: { color: "#9ca3af", fontSize: 24 },
});
