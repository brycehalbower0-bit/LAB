// Typed surface over the EmuCore native module (modules/emu-core).
// JS owns navigation/UI only; everything past this boundary is native
// (PLAN.md ADR 0001-D7).

import { requireNativeModule, requireNativeViewManager } from "expo-modules-core";
import type { ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export interface CoreDesc {
  name: string;
  screenCount: number;
  width: number;
  height: number;
  fps: number;
  sampleRate: number;
}

export interface Diagnostics {
  coreLoaded: boolean;
  running: boolean;
  paused: boolean;
  framesRun: number;
  fps: number;
  audioShortfalls: number;
  lastError: string | null;
}

interface EmuCoreModule {
  loadTestCore(): Promise<CoreDesc>;
  loadRom(romPath: string, savePath: string | null): Promise<CoreDesc>;
  start(): Promise<void>;
  stop(): Promise<void>;
  unload(): Promise<void>;
  setInput(mask: number): void;
  setFastForward(multiplier: number): void;
  setTouch(x: number, y: number, down: boolean): void;
  /** Circle pad axes, each -1..1 (3DS). */
  setAnalog(x: number, y: number): void;
  saveState(path: string): Promise<void>;
  loadState(path: string): Promise<void>;
  flushSave(): Promise<void>;
  getDiagnostics(): Promise<Diagnostics>;
}

export const EmuCore = requireNativeModule<EmuCoreModule>("EmuCore");

export interface EmuSurfaceProps {
  screenIndex?: number;
  style?: StyleProp<ViewStyle>;
}

export const EmuSurfaceView: ComponentType<EmuSurfaceProps> =
  requireNativeViewManager("EmuCore");

// Mirrors the EMU_BTN_* bits in core_api.h.
export const Buttons = {
  A: 1 << 0,
  B: 1 << 1,
  X: 1 << 2,
  Y: 1 << 3,
  L: 1 << 4,
  R: 1 << 5,
  ZL: 1 << 6,
  ZR: 1 << 7,
  START: 1 << 8,
  SELECT: 1 << 9,
  UP: 1 << 10,
  DOWN: 1 << 11,
  LEFT: 1 << 12,
  RIGHT: 1 << 13,
} as const;
