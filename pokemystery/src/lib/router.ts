/** Minimal hash router: '#/', '#/play/ai', '#/play/guess', '#/settings', '#/about'. */

import { useCallback, useSyncExternalStore } from 'react';

export type Route = 'home' | 'play-ai' | 'play-guess' | 'settings' | 'about';

function parse(hash: string): Route {
  switch (hash.replace(/^#\/?/, '').replace(/\/$/, '')) {
    case 'play/ai':
      return 'play-ai';
    case 'play/guess':
      return 'play-guess';
    case 'settings':
      return 'settings';
    case 'about':
      return 'about';
    default:
      return 'home';
  }
}

export function navigate(route: Route): void {
  const hash =
    route === 'home'
      ? '#/'
      : route === 'play-ai'
        ? '#/play/ai'
        : route === 'play-guess'
          ? '#/play/guess'
          : `#/${route}`;
  window.location.hash = hash;
}

export function useRoute(): Route {
  return useSyncExternalStore(
    useCallback((onChange: () => void) => {
      window.addEventListener('hashchange', onChange);
      return () => window.removeEventListener('hashchange', onChange);
    }, []),
    () => parse(window.location.hash),
  );
}
