// Settings — display and control options.
//
// Stepper rows rather than sliders: no gesture dependency, and the
// values worth setting here are coarse.

import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSettings, type VideoFilter } from "../settings";

const OPACITY_STEPS = [0.15, 0.3, 0.45, 0.55, 0.7, 0.85, 1];

export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [settings, update] = useSettings();

  function cycleOpacity() {
    const i = OPACITY_STEPS.findIndex((v) => v >= settings.controlOpacity - 1e-6);
    const next = OPACITY_STEPS[(i + 1) % OPACITY_STEPS.length];
    update({ controlOpacity: next });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.section}>Display</Text>

      <Row
        label="Screen layout"
        value={settings.overlayControls ? "Full screen" : "Stacked"}
        hint={
          settings.overlayControls
            ? "Game fills the display; controls float on top."
            : "Game above, controls in their own area below."
        }
        onPress={() => update({ overlayControls: !settings.overlayControls })}
      />

      <Row
        label="Scaling"
        value={settings.videoFilter === "sharp" ? "Sharp" : "Smooth"}
        hint={
          settings.videoFilter === "sharp"
            ? "Exact pixels. The screens don't divide evenly into the display, so some pixels come out wider than others."
            : "Even edges, slightly soft. Avoids the uneven-pixel look."
        }
        onPress={() =>
          update({
            videoFilter: (settings.videoFilter === "sharp"
              ? "smooth"
              : "sharp") as VideoFilter,
          })
        }
      />

      <Text style={styles.section}>Controls</Text>

      <Row
        label="Button opacity"
        value={`${Math.round(settings.controlOpacity * 100)}%`}
        hint="How visible the on-screen buttons are over the game."
        onPress={cycleOpacity}
      />

      <View style={styles.previewRow}>
        <View style={[styles.previewButton, { opacity: settings.controlOpacity }]}>
          <Text style={styles.previewText}>A</Text>
        </View>
        <View style={[styles.previewPad, { opacity: settings.controlOpacity }]}>
          <Text style={styles.previewText}>▲</Text>
        </View>
        <Text style={styles.previewHint}>preview</Text>
      </View>

      <Pressable style={styles.back} onPress={onBack}>
        <Text style={styles.backText}>Back to library</Text>
      </Pressable>
    </View>
  );
}

function Row({
  label,
  value,
  hint,
  onPress,
}: {
  label: string;
  value: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowHead}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      <Text style={styles.rowHint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0b0f", padding: 20, paddingTop: 70 },
  title: { color: "#fff", fontSize: 28, fontWeight: "700" },
  section: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 24,
    marginBottom: 8,
  },
  row: {
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  rowHead: { flexDirection: "row", justifyContent: "space-between" },
  rowLabel: { color: "#e5e7eb", fontSize: 16, fontWeight: "600" },
  rowValue: { color: "#818cf8", fontSize: 16, fontWeight: "600" },
  rowHint: { color: "#9ca3af", fontSize: 12, marginTop: 6, lineHeight: 17 },
  previewRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  previewButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
  },
  previewPad: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  previewText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  previewHint: { color: "#4b5563", fontSize: 12, marginLeft: 12 },
  back: { marginTop: "auto", alignItems: "center", paddingVertical: 16 },
  backText: { color: "#818cf8", fontSize: 15 },
});
