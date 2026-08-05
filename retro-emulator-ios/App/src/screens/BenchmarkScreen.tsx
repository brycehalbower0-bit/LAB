// ARM11 interpreter spike benchmark (PLAN.md §10.3). Still needed: the
// binding floor-device measurement (iPhone 15 non-Pro) is ADR 0002's #1
// follow-up. Reachable via long-press on the library title.

import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Device from "expo-device";
import { requireNativeModule } from "expo-modules-core";

const SpikeBench = requireNativeModule<{
  runBenchmark(): Promise<string>;
}>("SpikeBench");

interface BenchRow {
  kernel: string;
  backend: string;
  mips: number;
  ns_per_instr: number;
  vs_bar: number;
  ok: boolean;
}

interface DualRow {
  slice: number;
  combined_mips: number;
  per_core_pct: number;
}

interface BenchReport {
  host: string;
  bar_mips: number;
  results: BenchRow[];
  dual: DualRow[];
}

export default function BenchmarkScreen({ onBack }: { onBack: () => void }) {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<BenchReport | null>(null);
  const [rawJson, setRawJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deviceLabel = `${Device.modelName ?? "unknown device"} (${
    Device.modelId ?? "?"
  })`;
  const isFloorDevice = /iPhone 15(?! Pro)/.test(Device.modelName ?? "");

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const json = await SpikeBench.runBenchmark();
      setRawJson(json);
      setReport(JSON.parse(json) as BenchReport);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  async function share() {
    if (!rawJson) return;
    await Share.share({
      message: `ARM11 spike on ${deviceLabel}, iOS ${Device.osVersion ?? "?"}:\n${rawJson}`,
    });
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>ARM11 interpreter spike</Text>
        <Text style={styles.subtitle}>{deviceLabel}</Text>
        <Text style={isFloorDevice ? styles.floorYes : styles.floorNo}>
          {isFloorDevice
            ? "This is the floor device — these numbers are binding."
            : "Not the floor device (iPhone 15 non-Pro) — numbers are directional."}
        </Text>

        <Pressable
          style={[styles.button, running && styles.buttonDisabled]}
          onPress={run}
          disabled={running}
        >
          {running ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {report ? "Run again" : "Run benchmark (~10s)"}
            </Text>
          )}
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        {report && (
          <>
            <Text style={styles.sectionTitle}>
              Throughput (bar: {report.bar_mips} MIPS = 1:1 ARM11)
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.cellWide]}>kernel/backend</Text>
              <Text style={styles.cell}>MIPS</Text>
              <Text style={styles.cell}>vs 1:1</Text>
            </View>
            {report.results.map((row) => (
              <View
                key={`${row.kernel}-${row.backend}`}
                style={styles.tableRow}
              >
                <Text style={[styles.cell, styles.cellWide]}>
                  {row.kernel} · {row.backend}
                </Text>
                <Text style={styles.cell}>{row.mips.toFixed(1)}</Text>
                <Text
                  style={[
                    styles.cell,
                    row.vs_bar >= 1 ? styles.pass : styles.fail,
                  ]}
                >
                  {row.vs_bar.toFixed(2)}×
                </Text>
              </View>
            ))}

            <Text style={styles.sectionTitle}>
              Dual-core interleave (threaded, one thread)
            </Text>
            {report.dual.map((row) => (
              <View key={row.slice} style={styles.tableRow}>
                <Text style={[styles.cell, styles.cellWide]}>
                  slice {row.slice}
                </Text>
                <Text style={styles.cell}>
                  {row.combined_mips.toFixed(1)}
                </Text>
                <Text style={styles.cell}>{row.per_core_pct.toFixed(0)}%</Text>
              </View>
            ))}

            <Pressable style={styles.shareButton} onPress={share}>
              <Text style={styles.buttonText}>Share raw JSON</Text>
            </Pressable>
          </>
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
  subtitle: { color: "#9ca3af", fontSize: 15, marginTop: 4 },
  floorYes: { color: "#34d399", marginTop: 8, fontSize: 13 },
  floorNo: { color: "#fbbf24", marginTop: 8, fontSize: 13 },
  button: {
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  shareButton: {
    backgroundColor: "#374151",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 24,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#f87171", marginTop: 16 },
  sectionTitle: {
    color: "#e5e7eb",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 28,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    paddingBottom: 6,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1f2937",
  },
  cell: { color: "#d1d5db", flex: 1, fontSize: 13, textAlign: "right" },
  cellWide: { flex: 3, textAlign: "left" },
  pass: { color: "#34d399" },
  fail: { color: "#fbbf24" },
});
