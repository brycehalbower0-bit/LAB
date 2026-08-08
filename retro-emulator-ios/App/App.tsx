// EmuLab — app shell for retro-emulator-ios.
//
// Hand-rolled screen switching on purpose: two primary screens plus
// diagnostics doesn't justify a router dependency. JS owns navigation
// and UI only; emulation is native (PLAN.md ADR 0001-D7).

import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import LibraryScreen from "./src/screens/LibraryScreen";
import NullTestScreen from "./src/screens/NullTestScreen";
import BenchmarkScreen from "./src/screens/BenchmarkScreen";
import GameScreen from "./src/screens/GameScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

type Screen =
  | { name: "library" }
  | { name: "game"; rom: { name: string; uri: string } }
  | { name: "settings" }
  | { name: "diagnostics" }
  | { name: "nulltest" }
  | { name: "benchmark" };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "library" });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {screen.name === "library" && (
        <LibraryScreen
          onOpenDiagnostics={() => setScreen({ name: "diagnostics" })}
          onOpenSettings={() => setScreen({ name: "settings" })}
          onOpenRom={(rom) => setScreen({ name: "game", rom })}
        />
      )}
      {screen.name === "settings" && (
        <SettingsScreen onBack={() => setScreen({ name: "library" })} />
      )}
      {screen.name === "game" && (
        <GameScreen
          rom={screen.rom}
          onExit={() => setScreen({ name: "library" })}
        />
      )}
      {screen.name === "diagnostics" && (
        <View style={styles.diagMenu}>
          <Text style={styles.diagTitle}>Diagnostics</Text>
          <Pressable
            style={styles.diagButton}
            onPress={() => setScreen({ name: "nulltest" })}
          >
            <Text style={styles.diagButtonText}>Null core test</Text>
          </Pressable>
          <Pressable
            style={styles.diagButton}
            onPress={() => setScreen({ name: "benchmark" })}
          >
            <Text style={styles.diagButtonText}>ARM11 benchmark</Text>
          </Pressable>
          <Pressable
            style={styles.diagBack}
            onPress={() => setScreen({ name: "library" })}
          >
            <Text style={styles.diagBackText}>Back to library</Text>
          </Pressable>
        </View>
      )}
      {screen.name === "nulltest" && (
        <NullTestScreen onBack={() => setScreen({ name: "diagnostics" })} />
      )}
      {screen.name === "benchmark" && (
        <BenchmarkScreen onBack={() => setScreen({ name: "diagnostics" })} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0b0f" },
  diagMenu: { flex: 1, padding: 20, paddingTop: 90 },
  diagTitle: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 20 },
  diagButton: {
    backgroundColor: "#1f2937",
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  diagButtonText: { color: "#e5e7eb", fontSize: 16, fontWeight: "600" },
  diagBack: { marginTop: 16, alignItems: "center" },
  diagBackText: { color: "#818cf8", fontSize: 15 },
});
