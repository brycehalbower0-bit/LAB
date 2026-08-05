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
      .filter((f) => f.name.toLowerCase().endsWith(".gba"))
      .map((f) => ({ name: f.name, uri: f.uri }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setRoms(entries);
  }, []);

  useEffect(refresh, [refresh]);

  async function importRom() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    try {
      ensureDirs();
      const imported: string[] = [];
      for (const asset of result.assets) {
        const source = new File(asset.uri);
        if (asset.name.toLowerCase().endsWith(".zip")) {
          // ROMs usually arrive zipped; extract .gba entries here so the
          // library only ever holds raw ROMs.
          const zipped = unzipSync(new Uint8Array(await source.arrayBuffer()));
          for (const [entryName, bytes] of Object.entries(zipped)) {
            const clean = entryName.split("/").pop() ?? entryName;
            if (!clean.toLowerCase().endsWith(".gba") || bytes.length === 0) continue;
            const dest = new File(romsDir, clean);
            if (dest.exists) dest.delete();
            dest.write(bytes);
            imported.push(clean);
          }
        } else {
          const dest = new File(romsDir, asset.name);
          if (dest.exists) dest.delete();
          source.copy(dest);
          imported.push(asset.name);
        }
      }
      refresh();
      if (imported.length === 0) {
        Alert.alert(
          "Nothing imported",
          "No .gba file found. Import a Game Boy Advance ROM (.gba), zipped or not.",
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
