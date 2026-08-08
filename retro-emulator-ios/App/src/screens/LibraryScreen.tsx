// Library — ROM import and selection. Slice 1 ships import + listing;
// tapping a ROM starts working when the GBA core lands (Slice 2).
// Long-press the title for diagnostic screens (null-core test and the
// ARM11 benchmark, still needed for the ADR 0002 floor-device run).

import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { unzipSync } from "fflate";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ensureDirs, romsDir } from "../paths";

const ROM_RE = /\.(gba|nds|3ds|cci|cxi|3dsx|app|elf)$/i;

interface RomEntry {
  name: string;
  uri: string;
}

export default function LibraryScreen({
  onOpenDiagnostics,
  onOpenRom,
}: {
  onOpenDiagnostics: () => void;
  onOpenRom: (rom: RomEntry) => void;
}) {
  const [roms, setRoms] = useState<RomEntry[]>([]);

  const refresh = useCallback(() => {
    ensureDirs();
    const entries = romsDir
      .list()
      .filter((e): e is File => e instanceof File)
      .filter((f) => ROM_RE.test(f.name))
      .map((f) => ({ name: f.name, uri: f.uri }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setRoms(entries);
  }, []);

  useEffect(refresh, [refresh]);

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

        if (asset.name.toLowerCase().endsWith(".zip")) {
          // Unzipping needs the whole archive in memory; fine for GBA/DS,
          // impossible for a multi-GB 3DS dump.
          if ((asset.size ?? 0) > 600 * 1048576) {
            notes.push(
              `${asset.name} (${sizeMB} MB) is too large to unzip on ` +
                `device — unzip it first, then import the ROM itself.`,
            );
            continue;
          }
          const zipped = unzipSync(new Uint8Array(await source.arrayBuffer()));
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
          if (found === 0) {
            notes.push(`${asset.name}: no supported ROM inside the zip.`);
          }
        } else if (!ROM_RE.test(asset.name)) {
          notes.push(
            `${asset.name}: unsupported type. Use .gba, .nds, or ` +
              `.3ds/.cci/.cxi/.3dsx.`,
          );
        } else {
          const dest = new File(romsDir, asset.name);
          if (dest.exists) dest.delete();
          source.copy(dest);
          if (!dest.exists) {
            notes.push(`${asset.name}: copy failed (${sizeMB} MB).`);
          } else {
            imported.push(asset.name);
          }
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
        Alert.alert(
          "Nothing imported",
          (notes.length ? notes.join(NL + NL) : "No supported ROM found.") +
            NL +
            NL +
            "3DS dumps must already be decrypted: this app never handles " +
            "console keys.",
        );
      }
    } catch (e) {
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

      <Pressable style={styles.importButton} onPress={importRom}>
        <Text style={styles.buttonText}>Import ROM</Text>
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
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  list: { marginTop: 16 },
  romRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1f2937",
  },
  romName: { color: "#e5e7eb", fontSize: 16 },
});
