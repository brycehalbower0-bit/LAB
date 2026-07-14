import { GENERATIONS, type Difficulty, type Generation } from '../../shared/types';
import { resetSettings, useSettings } from '../lib/settings';

export function SettingsPage() {
  const [settings, update] = useSettings();

  const toggleGeneration = (generation: Generation) => {
    const has = settings.generations.includes(generation);
    const next = has
      ? settings.generations.filter((value) => value !== generation)
      : [...settings.generations, generation].sort((a, b) => a - b);
    if (next.length === 0) return; // at least one generation must stay on
    update({ generations: next });
  };

  return (
    <div className="card settings-grid">
      <h1>Game settings</h1>
      <p style={{ color: 'var(--text-muted)' }}>
        Settings apply to new games. They are validated again on the server.
      </p>

      <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
        <legend>
          <strong>Included generations</strong>
        </legend>
        <div className="gen-grid" role="group" aria-label="Included generations">
          {GENERATIONS.map((generation) => (
            <button
              key={generation}
              type="button"
              className="gen-toggle"
              aria-pressed={settings.generations.includes(generation)}
              onClick={() => toggleGeneration(generation)}
            >
              {generation}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        {(
          [
            ['includeLegendary', 'Include Legendary Pokémon'],
            ['includeMythical', 'Include Mythical Pokémon'],
            ['includeBaby', 'Include baby Pokémon'],
            ['includeForms', 'Include alternate forms (not yet available)'],
            ['hintsEnabled', 'Enable hints (You Guess mode)'],
            ['showSpritesOnWin', 'Show sprite after a correct guess'],
          ] as const
        ).map(([key, label]) => (
          <div className="field-row" key={key}>
            <label htmlFor={`setting-${key}`}>{label}</label>
            <input
              id={`setting-${key}`}
              type="checkbox"
              checked={settings[key]}
              disabled={key === 'includeForms'}
              onChange={(event) => update({ [key]: event.target.checked })}
            />
          </div>
        ))}

        <div className="field-row">
          <label htmlFor="setting-difficulty">Difficulty (direct guesses allowed: easy 5 / normal 3 / hard 2)</label>
          <select
            id="setting-difficulty"
            value={settings.difficulty}
            onChange={(event) => update({ difficulty: event.target.value as Difficulty })}
          >
            <option value="easy">Easy</option>
            <option value="normal">Normal</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div className="field-row">
          <label htmlFor="setting-max-questions">Maximum questions per game</label>
          <input
            id="setting-max-questions"
            type="number"
            min={5}
            max={40}
            value={settings.maxQuestions}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isInteger(value) && value >= 5 && value <= 40) {
                update({ maxQuestions: value });
              }
            }}
          />
        </div>
      </div>

      <div>
        <button type="button" className="btn" onClick={() => resetSettings()}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
