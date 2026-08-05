// Null-core diagnostic screen — Slice 1's verification harness. Proves
// the entire native pipeline (module, emulation thread, Metal surface,
// audio, input, save states) against the contract-tested null core
// before any real core exists. Kept permanently as a diagnostic.

import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Buttons, EmuCore, EmuSurfaceView, type Diagnostics } from "../emu";
import { ensureDirs, statesDir, toPosixPath } from "../paths";

const statePath = () => toPosixPath(`${statesDir.uri}/nulltest.state`);

export default function NullTestScreen({ onBack }: { onBack: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("idle");
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const mask = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      EmuCore.getDiagnostics().then(setDiag).catch(() => {});
    }, 1000);
    return () => {
      clearInterval(timer);
      EmuCore.unload().catch(() => {});
    };
  }, []);

  const act = useCallback((label: string, fn: () => Promise<unknown>) => {
    fn()
      .then(() => setStatus(`${label}: ok`))
      .catch((e) => setStatus(`${label}: ${String(e)}`));
  }, []);

  const press = (bit: number, down: boolean) => {
    mask.current = down ? mask.current | bit : mask.current & ~bit;
    EmuCore.setInput(mask.current);
  };

  const overlayButton = (label: string, bit: number) => (
    <Pressable
      key={label}
      style={({ pressed }) => [styles.padButton, pressed && styles.padPressed]}
      onPressIn={() => press(bit, true)}
      onPressOut={() => press(bit, false)}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Null core test</Text>
        <Text style={styles.subtitle}>
          Verifies the native pipeline: video, audio, input, save states.
        </Text>

        <View style={styles.surfaceBox}>
          <EmuSurfaceView screenIndex={0} style={styles.surface} />
        </View>

        <View style={styles.row}>
          <Pressable
            style={styles.button}
            onPress={() =>
              act("load", async () => {
                ensureDirs();
                await EmuCore.loadTestCore();
                setLoaded(true);
              })
            }
          >
            <Text style={styles.buttonText}>Load</Text>
          </Pressable>
          <Pressable
            style={[styles.button, !loaded && styles.disabled]}
            disabled={!loaded}
            onPress={() =>
              act(running ? "stop" : "start", async () => {
                if (running) {
                  await EmuCore.stop();
                  setRunning(false);
                } else {
                  await EmuCore.start();
                  setRunning(true);
                }
              })
            }
          >
            <Text style={styles.buttonText}>{running ? "Stop" : "Start"}</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Pressable
            style={[styles.button, !loaded && styles.disabled]}
            disabled={!loaded}
            onPress={() => act("save state", () => EmuCore.saveState(statePath()))}
          >
            <Text style={styles.buttonText}>Save state</Text>
          </Pressable>
          <Pressable
            style={[styles.button, !loaded && styles.disabled]}
            disabled={!loaded}
            onPress={() => act("load state", () => EmuCore.loadState(statePath()))}
          >
            <Text style={styles.buttonText}>Load state</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Input (hold to change the pattern)</Text>
        <View style={styles.row}>
          {overlayButton("↑", Buttons.UP)}
          {overlayButton("↓", Buttons.DOWN)}
          {overlayButton("A", Buttons.A)}
          {overlayButton("B", Buttons.B)}
        </View>

        <Text style={styles.status}>{status}</Text>

        {diag && (
          <View style={styles.diagBox}>
            <Text style={styles.diagLine}>core loaded: {String(diag.coreLoaded)}</Text>
            <Text style={styles.diagLine}>running: {String(diag.running)}</Text>
            <Text style={styles.diagLine}>frames run: {diag.framesRun}</Text>
            <Text style={styles.diagLine}>fps: {diag.fps.toFixed(1)}</Text>
            <Text style={styles.diagLine}>audio shortfalls: {diag.audioShortfalls}</Text>
            <Text style={styles.diagLine}>last error: {diag.lastError ?? "none"}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0b0f" },
  scroll: { padding: 20, paddingTop: 70, paddingBottom: 60 },
  back: { color: "#818cf8", fontSize: 16, marginBottom: 10 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 13, marginTop: 4 },
  surfaceBox: {
    marginTop: 16,
    backgroundColor: "#000",
    borderRadius: 8,
    overflow: "hidden",
  },
  surface: { width: "100%", aspectRatio: 256 / 192 },
  row: { flexDirection: "row", gap: 10, marginTop: 12 },
  button: {
    flex: 1,
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  disabled: { opacity: 0.4 },
  padButton: {
    flex: 1,
    backgroundColor: "#374151",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  padPressed: { backgroundColor: "#6b7280" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  sectionTitle: { color: "#e5e7eb", fontSize: 15, fontWeight: "600", marginTop: 20 },
  status: { color: "#fbbf24", marginTop: 14, fontSize: 13 },
  diagBox: {
    marginTop: 14,
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 12,
  },
  diagLine: { color: "#d1d5db", fontSize: 13, fontVariant: ["tabular-nums"] },
});
