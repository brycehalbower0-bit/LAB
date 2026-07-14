/** Mode 1: the AI guesses the player's Pokémon. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiRequestError } from '../lib/api';
import { useSettings } from '../lib/settings';
import { navigate } from '../lib/router';
import { PLAYER_ANSWERS, type PlayerAnswer } from '../../shared/types';
import type { EngineAction, PokemonPublic, RevealResponse } from '../../shared/api';
import { PokemonReveal } from '../components/PokemonReveal';
import { ReportDialog } from '../components/ReportDialog';

const ANSWER_LABELS: Record<PlayerAnswer, string> = {
  yes: 'Yes',
  'probably-yes': 'Probably yes',
  unknown: "I don't know",
  'probably-no': 'Probably no',
  no: 'No',
};

type Phase =
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'question'; action: Extract<EngineAction, { type: 'question' }> }
  | { name: 'guess'; action: Extract<EngineAction, { type: 'guess' }> }
  | { name: 'won'; pokemon: PokemonPublic }
  | { name: 'defeated' }
  | { name: 'revealed'; reveal: RevealResponse };

export function AiGame() {
  const [settings] = useSettings();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [questionCount, setQuestionCount] = useState(0);
  const [maxQuestions, setMaxQuestions] = useState(settings.maxQuestions);
  const [candidateCount, setCandidateCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const startedRef = useRef(false);

  const applyAction = useCallback((action: EngineAction | undefined) => {
    if (action === undefined) return;
    if (action.type === 'question') {
      setPhase({ name: 'question', action });
      setAnnouncement(`Question ${action.questionNumber}: ${action.question.text}`);
    } else if (action.type === 'guess') {
      setPhase({ name: 'guess', action });
      setAnnouncement(`The AI guesses: ${action.pokemon.displayName}!`);
    } else {
      setPhase({ name: 'defeated' });
      setAnnouncement('The AI gives up!');
    }
  }, []);

  const startGame = useCallback(async () => {
    setPhase({ name: 'loading' });
    setQuestionCount(0);
    try {
      const created = await api.createGame('ai-guesses', settings);
      setSessionId(created.sessionId);
      setCandidateCount(created.candidateCount);
      setMaxQuestions(created.maxQuestions);
      applyAction(created.action);
    } catch (error) {
      setPhase({ name: 'error', message: error instanceof Error ? error.message : 'Failed to start' });
    }
  }, [settings, applyAction]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startGame();
  }, [startGame]);

  const guarded = (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    void task()
      .catch((error: unknown) => {
        if (error instanceof ApiRequestError && error.status === 409) return; // stale click
        setPhase({ name: 'error', message: error instanceof Error ? error.message : 'Request failed' });
      })
      .finally(() => setBusy(false));
  };

  const answer = (value: PlayerAnswer) =>
    guarded(async () => {
      if (sessionId === null) return;
      const result = await api.answer(sessionId, value);
      setQuestionCount(result.questionCount);
      applyAction(result.action);
    });

  const respondToGuess = (correct: boolean, pokemon: PokemonPublic) =>
    guarded(async () => {
      if (sessionId === null) return;
      const result = await api.guessResponse(sessionId, correct);
      setQuestionCount(result.questionCount);
      if (result.result === 'won') {
        setPhase({ name: 'won', pokemon });
        setAnnouncement(`The AI guessed it: ${pokemon.displayName}!`);
      } else {
        applyAction(result.action);
      }
    });

  const undo = () =>
    guarded(async () => {
      if (sessionId === null) return;
      const result = await api.undo(sessionId);
      setQuestionCount(result.questionCount);
      applyAction(result.action);
    });

  return (
    <>
      <div className="game-top">
        <h1 style={{ fontSize: '1.3rem', margin: 0 }}>AI Guesses Your Pokémon</h1>
        <span className="progress">
          Question {Math.min(questionCount + 1, maxQuestions)} / {maxQuestions} · {candidateCount}{' '}
          Pokémon in play
        </span>
      </div>

      <p aria-live="polite" className="visually-hidden">
        {announcement}
      </p>

      {phase.name === 'loading' ? <div className="card question-card">Starting game…</div> : null}

      {phase.name === 'error' ? (
        <div className="card question-card">
          <p className="error-text">{phase.message}</p>
          <button type="button" className="btn btn-primary" onClick={() => void startGame()}>
            Try again
          </button>
        </div>
      ) : null}

      {phase.name === 'question' ? (
        <div className="card question-card">
          <div className="question-text">{phase.action.question.text}</div>
          <div className="answer-grid">
            {PLAYER_ANSWERS.map((value) => (
              <button
                key={value}
                type="button"
                className={`btn ${value === 'yes' || value === 'no' ? 'btn-primary' : ''}`}
                disabled={busy}
                onClick={() => answer(value)}
              >
                {ANSWER_LABELS[value]}
              </button>
            ))}
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || questionCount === 0}
              onClick={undo}
            >
              ↩ Undo previous answer
            </button>
          </div>
        </div>
      ) : null}

      {phase.name === 'guess' ? (
        <div className="card question-card">
          <div className="question-text">
            Is it… <strong>{phase.action.pokemon.displayName}</strong>?
          </div>
          <div className="answer-grid">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => respondToGuess(true, phase.action.pokemon)}
            >
              Yes, that's it!
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => respondToGuess(false, phase.action.pokemon)}
            >
              No, keep asking
            </button>
          </div>
        </div>
      ) : null}

      {phase.name === 'won' ? (
        <div className="card">
          <PokemonReveal
            pokemon={phase.pokemon}
            showSprite={settings.showSpritesOnWin}
            title="Got it! 🎉"
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={() => { startedRef.current = false; void startGame(); }}>
              Play again
            </button>
            <button type="button" className="btn" onClick={() => navigate('home')}>
              Home
            </button>
            <ReportDialog sessionId={sessionId ?? undefined} pokemonId={phase.pokemon.id} />
          </div>
        </div>
      ) : null}

      {phase.name === 'defeated' && sessionId !== null ? (
        <DefeatedPanel
          sessionId={sessionId}
          onRevealed={(reveal) => setPhase({ name: 'revealed', reveal })}
        />
      ) : null}

      {phase.name === 'revealed' ? (
        <div className="card">
          <PokemonReveal
            pokemon={phase.reveal.pokemon}
            showSprite={settings.showSpritesOnWin}
            title="You win! It was:"
          />
          {phase.reveal.contradictions.length > 0 ? (
            <div className="notice">
              <strong>Some answers may have thrown the AI off:</strong>
              <ul>
                {phase.reveal.contradictions.map((item) => (
                  <li key={item.questionText}>
                    “{item.questionText}” — you said <em>{item.playerAnswer.replace('-', ' ')}</em>,
                    the Pokédex says <em>{item.expectedAnswer}</em>.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={() => { startedRef.current = false; void startGame(); }}>
              Play again
            </button>
            <button type="button" className="btn" onClick={() => navigate('home')}>
              Home
            </button>
            <ReportDialog sessionId={sessionId ?? undefined} pokemonId={phase.reveal.pokemon.id} />
          </div>
        </div>
      ) : null}
    </>
  );
}

/** After defeat, the player tells us who it was (with autocomplete). */
function DefeatedPanel({
  sessionId,
  onRevealed,
}: {
  sessionId: string;
  onRevealed: (reveal: RevealResponse) => void;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ id: number; displayName: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      api
        .suggestNames(trimmed)
        .then((result) => setSuggestions(result.suggestions))
        .catch(() => setSuggestions([]));
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const reveal = (pokemonId: number) => {
    api
      .reveal(sessionId, pokemonId)
      .then(onRevealed)
      .catch(() => setError('Could not look that Pokémon up — try another spelling.'));
  };

  return (
    <div className="card question-card">
      <div className="question-text">I give up! 🏳️ Which Pokémon was it?</div>
      <div className="ask-form">
        <input
          type="text"
          value={query}
          placeholder="Type its name…"
          aria-label="Which Pokémon were you thinking of?"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {error !== null ? <p className="error-text">{error}</p> : null}
      <div className="suggestion-row" role="list">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            role="listitem"
            type="button"
            className="btn"
            onClick={() => reveal(suggestion.id)}
          >
            {suggestion.displayName}
          </button>
        ))}
      </div>
    </div>
  );
}
