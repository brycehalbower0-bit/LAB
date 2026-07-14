/** Game settings persisted locally (they are re-validated server-side). */

import { useCallback, useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, type GameSettings } from '../../shared/types';
import { gameSettingsSchema } from '../../shared/schemas';

const STORAGE_KEY = 'pokemystery.settings';
const listeners = new Set<() => void>();
let current: GameSettings = load();

function load(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = gameSettingsSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    }
  } catch {
    // corrupted or unavailable storage — fall through to defaults
  }
  return DEFAULT_SETTINGS;
}

export function getSettings(): GameSettings {
  return current;
}

export function updateSettings(patch: Partial<GameSettings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // private mode etc. — settings just won't persist
  }
  for (const listener of listeners) listener();
}

export function resetSettings(): void {
  current = DEFAULT_SETTINGS;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  for (const listener of listeners) listener();
}

export function useSettings(): [GameSettings, (patch: Partial<GameSettings>) => void] {
  const settings = useSyncExternalStore(
    useCallback((onChange: () => void) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    }, []),
    getSettings,
  );
  return [settings, updateSettings];
}
