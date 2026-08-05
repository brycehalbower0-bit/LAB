// GameScreen — the playing surface: EmuSurfaceView on top, touch
// overlay below. The overlay is JS calling the sync setInput() on touch
// transitions only (event rate, not frame rate); a native fast path and
// GameController support are recorded Slice 4 work.

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Buttons, EmuCore, EmuSurfaceView, type Diagnostics } from "../emu";
import { savePathFor, statePathFor, toPosixPath } from "../paths";

interface Rom {
  name: string;
  uri: string;
}

export default function GameScreen({
  rom,
  onExit,
}: {
  rom: Rom;
  onExit: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "running" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const mask = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      EmuCore.getDiagnostics().then(setDiag).catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await EmuCore.loadRom(toPosixPath(rom.uri), savePathFor(rom.name));
        await EmuCore.start();
        if (!cancelled) setStatus("running");
      } catch (e) {
        if (!cancelled) {
          setError(String(e));
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      (async () => {
        try {
          await EmuCore.flushSave();
        } finally {
          await EmuCore.unload().catch(() => {});
        }
      })();
    };
  }, [rom.uri, rom.name]);

  const press = (bit: number, down: boolean) => {
    mask.current = down ? mask.current | bit : mask.current & ~bit;
    EmuCore.setInput(mask.current);
  };

  const pad = (
    label: string,
    bit: number,
    style?: StyleProp<ViewStyle>,
    textStyle?: object,
  ) => (
    <Pressable
      style={({ pressed }) => [styles.control, style, pressed && styles.pressed]}
      onPressIn={() => press(bit, true)}
      onPressOut={() => press(bit, false)}
    >
      <Text style={[styles.controlText, textStyle]}>{label}</Text>
    </Pressable>
  );

  async function stateAction(slot: number, save: boolean) {
    const path = statePathFor(rom.name, slot);
    try {
      if (save) {
        await EmuCore.saveState(path);
      } else {
        await EmuCore.loadState(path);
      }
    } catch (e) {
      Alert.alert(save ? "Save failed" : "Load failed", String(e));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.screenArea}>
        <EmuSurfaceView screenIndex={0} style={styles.surface} />
        {status === "loading" && <Text style={styles.overlayMsg}>Loading…</Text>}
        {status === "error" && (
          <Text style={styles.overlayError}>{error ?? "failed"}</Text>
        )}
        {diag && status === "running" && (
          <Text style={styles.fpsBadge}>
            {diag.fps.toFixed(1)} fps · {diag.audioShortfalls} drops
          </Text>
        )}
      </View>

      {/* shoulder row */}
      <View style={styles.shoulderRow}>
        {pad("L", Buttons.L, styles.shoulder)}
        <Pressable style={styles.menuButton} onPress={onExit}>
          <Text style={styles.menuText}>Exit</Text>
        </Pressable>
        {pad("R", Buttons.R, styles.shoulder)}
      </View>

      <View style={styles.mainControls}>
        {/* D-pad */}
        <View style={styles.dpad}>
          <View style={styles.dpadRow}>{pad("▲", Buttons.UP, styles.dpadKey)}</View>
          <View style={styles.dpadRow}>
            {pad("◀", Buttons.LEFT, styles.dpadKey)}
            <View style={styles.dpadCenter} />
            {pad("▶", Buttons.RIGHT, styles.dpadKey)}
          </View>
          <View style={styles.dpadRow}>{pad("▼", Buttons.DOWN, styles.dpadKey)}</View>
        </View>

        {/* A/B */}
        <View style={styles.faceButtons}>
          {pad("A", Buttons.A, styles.faceButton)}
          {pad("B", Buttons.B, [styles.faceButton, styles.faceButtonB])}
        </View>
      </View>

      {/* start/select */}
      <View style={styles.metaRow}>
        {pad("SELECT", Buttons.SELECT, styles.metaButton, styles.metaText)}
        {pad("START", Buttons.START, styles.metaButton, styles.metaText)}
      </View>

      {/* save states */}
      <View style={styles.stateRow}>
        {[0, 1, 2].map((slot) => (
          <View key={slot} style={styles.stateSlot}>
            <Pressable
              style={styles.stateButton}
              onPress={() => stateAction(slot, true)}
            >
              <Text style={styles.stateText}>Save {slot + 1}</Text>
            </Pressable>
            <Pressable
              style={styles.stateButton}
              onPress={() => stateAction(slot, false)}
            >
              <Text style={styles.stateText}>Load {slot + 1}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  screenArea: { width: "100%", aspectRatio: 240 / 160, marginTop: 50 },
  surface: { width: "100%", height: "100%" },
  overlayMsg: {
    position: "absolute",
    alignSelf: "center",
    top: "45%",
    color: "#9ca3af",
    fontSize: 16,
  },
  overlayError: {
    position: "absolute",
    alignSelf: "center",
    top: "40%",
    color: "#f87171",
    fontSize: 13,
    paddingHorizontal: 24,
  },
  fpsBadge: {
    position: "absolute",
    top: 4,
    right: 8,
    color: "#34d399",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    backgroundColor: "#000000aa",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  control: {
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: "#4b5563" },
  controlText: { color: "#e5e7eb", fontSize: 18, fontWeight: "700" },
  shoulderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 10,
  },
  shoulder: { width: 90, height: 36, borderRadius: 8 },
  menuButton: { padding: 8 },
  menuText: { color: "#818cf8", fontSize: 15 },
  mainControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 14,
  },
  dpad: { alignItems: "center" },
  dpadRow: { flexDirection: "row" },
  dpadKey: { width: 52, height: 52, borderRadius: 8, margin: 1 },
  dpadCenter: { width: 52, height: 52 },
  faceButtons: { alignItems: "center" },
  faceButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#4f46e5",
  },
  faceButtonB: { backgroundColor: "#374151", marginTop: 10, marginRight: 40 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginTop: 14,
  },
  metaButton: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 14 },
  metaText: { fontSize: 12, fontWeight: "600" },
  stateRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: "auto",
    marginBottom: 24,
  },
  stateSlot: { alignItems: "center", gap: 6 },
  stateButton: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  stateText: { color: "#9ca3af", fontSize: 12 },
});
