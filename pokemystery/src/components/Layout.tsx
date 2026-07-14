import type { ReactNode } from 'react';
import { useTheme } from '../lib/theme';
import { navigate } from '../lib/router';

const THEME_LABELS = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' } as const;
const THEME_ICONS = { system: '◐', light: '☀', dark: '☾' } as const;

export function Layout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useTheme();
  const nextTheme = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system';

  return (
    <>
      <header className="site-header">
        <a
          className="brand"
          href="#/"
          onClick={(event) => {
            event.preventDefault();
            navigate('home');
          }}
        >
          PokéMystery
        </a>
        <nav aria-label="Main">
          <a className="btn btn-ghost" href="#/settings">
            Settings
          </a>
          <a className="btn btn-ghost" href="#/about">
            About
          </a>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setTheme(nextTheme)}
            aria-label={`Switch theme (current: ${THEME_LABELS[theme]})`}
            title={THEME_LABELS[theme]}
          >
            <span aria-hidden="true">{THEME_ICONS[theme]}</span>
          </button>
        </nav>
      </header>
      <main className="page">{children}</main>
      <footer className="site-footer">
        <p>
          PokéMystery is an unofficial fan project and is not affiliated with, endorsed by, or
          sponsored by Nintendo, Game Freak, Creatures, or The Pokémon Company. Pokémon names are
          trademarks of their respective owners.
        </p>
        <p>
          Data from <a href="https://pokeapi.co/">PokéAPI</a> — see <a href="#/about">attribution</a>.
        </p>
      </footer>
    </>
  );
}
