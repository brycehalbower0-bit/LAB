// User settings, persisted as JSON in Documents.
//
// No storage dependency: this is a handful of scalars written on change
// and read once at startup, which a file does fine. Reads are sync so
// the first render already has the real values (a flash of default
// opacity would be visible on the game screen).

import { File } from "expo-file-system";
import { useCallback, useEffect, useState } from "react";
import { documentsRoot } from "./paths";

export type VideoFilter = "sharp" | "smooth";

export interface Settings {
  /** Opacity of the on-screen controls when they overlay the game. */
  controlOpacity: number;
  /**
   * Draw the emulated screens full-bleed with the controls floating on
   * top, rather than stacked above a separate control area.
   */
  overlayControls: boolean;
  /**
   * "sharp" is nearest-neighbour: exact pixels, but at a non-integer
   * scale some source pixels are duplicated more than others, which
   * reads as uneven edges. "smooth" is linear: even, slightly soft.
   */
  videoFilter: VideoFilter;
  /**
   * Guest CPU clock as a percent of real hardware. Below 100 buys frame
   * rate by giving the interpreter less to emulate; games that depend on
   * CPU timing can stutter, run their logic slowly, or misbehave.
   */
  cpuClock: number;
}

export const DEFAULTS: Settings = {
  controlOpacity: 0.55,
  overlayControls: true,
  videoFilter: "smooth",
  cpuClock: 100,
};

const file = new File(documentsRoot, "settings.json");

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Coerce whatever is on disk into a valid Settings. */
function sanitize(raw: unknown): Settings {
  const o = (raw ?? {}) as Partial<Settings>;
  return {
    controlOpacity:
      typeof o.controlOpacity === "number" && Number.isFinite(o.controlOpacity)
        ? clamp(o.controlOpacity, 0.1, 1)
        : DEFAULTS.controlOpacity,
    overlayControls:
      typeof o.overlayControls === "boolean"
        ? o.overlayControls
        : DEFAULTS.overlayControls,
    videoFilter:
      o.videoFilter === "sharp" || o.videoFilter === "smooth"
        ? o.videoFilter
        : DEFAULTS.videoFilter,
    cpuClock:
      typeof o.cpuClock === "number" && Number.isFinite(o.cpuClock)
        ? clamp(Math.round(o.cpuClock), 25, 200)
        : DEFAULTS.cpuClock,
  };
}

export function loadSettings(): Settings {
  try {
    if (!file.exists) return { ...DEFAULTS };
    return sanitize(JSON.parse(file.textSync()));
  } catch {
    // A corrupt file must not brick the app; defaults are always valid.
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    if (!file.exists) file.create();
    file.write(JSON.stringify(s));
  } catch {
    // Non-fatal: the session keeps the in-memory value.
  }
}

// Settings change from one screen and are read by another, so keep a
// module-level copy and notify listeners rather than threading props.
let current: Settings | null = null;
const listeners = new Set<(s: Settings) => void>();

export function getSettings(): Settings {
  if (!current) current = loadSettings();
  return current;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = sanitize({ ...getSettings(), ...patch });
  current = next;
  saveSettings(next);
  for (const fn of listeners) fn(next);
  return next;
}

export function useSettings(): [Settings, (p: Partial<Settings>) => void] {
  const [value, setValue] = useState<Settings>(getSettings);
  useEffect(() => {
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  const update = useCallback((p: Partial<Settings>) => {
    updateSettings(p);
  }, []);
  return [value, update];
}
