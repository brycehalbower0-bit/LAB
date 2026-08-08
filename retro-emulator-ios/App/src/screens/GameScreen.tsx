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
import { File } from "expo-file-system";
import CirclePad from "../components/CirclePad";
import {
  Buttons,
  EmuCore,
  EmuSurfaceView,
  type CoreDesc,
  type Diagnostics,
} from "../emu";
import {
  autoStatePathFor,
  savePathFor,
  statePathFor,
  toPosixPath,
} from "../paths";

const FF_STEPS = [1, 2, 4, 8];

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
  const [desc, setDesc] = useState<CoreDesc | null>(null);
  const mask = useRef(0);
  const touchLayout = useRef({ w: 1, h: 1 });

  useEffect(() => {
    const timer = setInterval(() => {
      EmuCore.getDiagnostics().then(setDiag).catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Read fresh rather than using the polled copy: the interesting cases
  // (a wedged guest, a failed load) are exactly the ones where the last
  // poll may be stale or missing.
  async function showDiagnostics() {
    try {
      const d = await EmuCore.getDiagnostics();
      const head =
        `${d.fps.toFixed(1)} fps · ${d.framesRun} frames · ` +
        `${d.audioShortfalls} drops` +
        (d.lastError ? `\nlastError: ${d.lastError}` : "");
      Alert.alert(
        "Diagnostics",
        head + (d.core ? `\n\n${d.core}` : "\n\n(core reports none)"),
      );
    } catch (e) {
      Alert.alert("Diagnostics", `failed: ${e}`);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await EmuCore.loadRom(toPosixPath(rom.uri), savePathFor(rom.name));
        await EmuCore.start();
        if (cancelled) return;
        setDesc(d);
        setStatus("running");
        // Auto-resume: offer the snapshot taken when the game was last
        // left. The in-game save (battery) is untouched either way.
        const autoPath = autoStatePathFor(rom.name);
        if (new File(`file://${autoPath}`).exists) {
          Alert.alert("Continue?", "Pick up where you left off last time?", [
            { text: "Start fresh", style: "cancel" },
            {
              text: "Resume",
              onPress: () => {
                EmuCore.loadState(autoPath).catch(() => {});
              },
            },
          ]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(String(e));
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      EmuCore.setFastForward(1);
      (async () => {
        try {
          await EmuCore.saveState(autoStatePathFor(rom.name));
        } catch {}
        try {
          await EmuCore.flushSave();
        } finally {
          await EmuCore.unload().catch(() => {});
        }
      })();
    };
  }, [rom.uri, rom.name]);

  const [ffIndex, setFfIndex] = useState(0);
  const cycleFastForward = () => {
    const next = (ffIndex + 1) % FF_STEPS.length;
    setFfIndex(next);
    EmuCore.setFastForward(FF_STEPS[next]);
  };

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

  const isDual = (desc?.screenCount ?? 1) === 2;
  // 3DS: two screens, top wider than bottom (400x240 vs 320x240).
  const is3ds = isDual && (desc?.width ?? 0) > 256;

  // NDS bottom screen: touches map to guest pixels via setTouch.
  const touchEvent = (e: { nativeEvent: { locationX: number; locationY: number } }, down: boolean) => {
    const { w, h } = touchLayout.current;
    const bw = is3ds ? 320 : 256;
    const bh = is3ds ? 240 : 192;
    const gx = Math.round((e.nativeEvent.locationX / w) * bw);
    const gy = Math.round((e.nativeEvent.locationY / h) * bh);
    EmuCore.setTouch(
      Math.max(0, Math.min(bw - 1, gx)),
      Math.max(0, Math.min(bh - 1, gy)),
      down,
    );
  };

  return (
    <View style={styles.container}>
      <View style={[isDual ? styles.screenAreaDualTop : styles.screenArea, is3ds && styles.top3ds]}>
        <EmuSurfaceView screenIndex={0} style={styles.surface} />
        {status === "loading" && <Text style={styles.overlayMsg}>Loading…</Text>}
        {status === "error" && (
          <Text style={styles.overlayError}>{error ?? "failed"}</Text>
        )}
        {diag && status === "running" && (
          // Long-press for the core's own report: a frame rate alone can't
          // tell "emulating" from "spinning without executing anything".
          <Pressable
            onLongPress={() =>
              Alert.alert(
                "Core diagnostics",
                typeof diag.core === "string"
                  ? diag.core
                  : "this core reports no diagnostics",
              )
            }
            delayLongPress={500}
            style={styles.fpsBadgeHit}
          >
            <Text style={styles.fpsBadge}>
              {diag.fps.toFixed(1)} fps · {diag.audioShortfalls} drops
            </Text>
          </Pressable>
        )}
      </View>
      {isDual && (
        <View
          style={[styles.screenAreaDual, is3ds && styles.bottom3ds]}
          onLayout={(e) => {
            touchLayout.current = {
              w: e.nativeEvent.layout.width,
              h: e.nativeEvent.layout.height,
            };
          }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => touchEvent(e, true)}
          onResponderMove={(e) => touchEvent(e, true)}
          onResponderRelease={(e) => touchEvent(e, false)}
          onResponderTerminate={(e) => touchEvent(e, false)}
        >
          <EmuSurfaceView screenIndex={1} style={styles.surface} />
        </View>
      )}

      {/* shoulder row */}
      <View style={styles.shoulderRow}>
        {pad("L", Buttons.L, styles.shoulder)}
        <Pressable style={styles.menuButton} onPress={onExit}>
          <Text style={styles.menuText}>Exit</Text>
        </Pressable>
        <Pressable style={styles.menuButton} onPress={cycleFastForward}>
          <Text style={[styles.menuText, ffIndex > 0 && styles.ffActive]}>
            {FF_STEPS[ffIndex]}×
          </Text>
        </Pressable>
        {/* Plain tap, not a long-press on the fps badge: that badge sits
            over a native Metal view and re-renders on every diagnostics
            poll, so the press never survived long enough to fire. */}
        <Pressable style={styles.menuButton} onPress={showDiagnostics}>
          <Text style={styles.menuText}>?</Text>
        </Pressable>
        {pad("R", Buttons.R, styles.shoulder)}
      </View>

      <View style={styles.mainControls}>
        {is3ds && <CirclePad />}
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

        {/* face buttons: A/B always; X/Y for dual-screen (NDS) */}
        <View style={styles.faceButtons}>
          {isDual && pad("X", Buttons.X, [styles.faceButton, styles.faceSmall])}
          <View style={styles.faceRow}>
            {isDual && pad("Y", Buttons.Y, [styles.faceButton, styles.faceSmall])}
            {pad("A", Buttons.A, styles.faceButton)}
          </View>
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
  screenAreaDual: { width: "100%", aspectRatio: 256 / 192 },
  screenAreaDualTop: { width: "100%", aspectRatio: 256 / 192, marginTop: 40 },
  top3ds: { aspectRatio: 400 / 240 },
  bottom3ds: { aspectRatio: 320 / 240, width: "80%", alignSelf: "center" },
  faceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  faceSmall: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#374151" },
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
  fpsBadgeHit: {
    position: "absolute",
    top: 4,
    right: 8,
    backgroundColor: "#000000aa",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fpsBadge: {
    color: "#34d399",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
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
  ffActive: { color: "#34d399", fontWeight: "700" },
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
