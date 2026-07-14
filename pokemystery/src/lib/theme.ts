/** Light/dark theme with system default; applied via [data-theme] on <html>. */

import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'pokemystery.theme';
const listeners = new Set<() => void>();

function stored(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

let current: Theme = stored();

function apply(theme: Theme): void {
  if (theme === 'system') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

export function setTheme(theme: Theme): void {
  current = theme;
  try {
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
  apply(theme);
  for (const listener of listeners) listener();
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(
    useCallback((onChange: () => void) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    }, []),
    () => current,
  );
  return [theme, setTheme];
}
