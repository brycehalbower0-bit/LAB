/** Mode 2: the player guesses the secret Pokémon. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiRequestError } from '../lib/api';
import { useSettings } from '../lib/settings';
import { navigate } from '../lib/router';
import type { EngineAnswer } from '../../shared/types';
import type { PokemonPublic } from '../../shared/api';
import { PokemonReveal } from '../components/PokemonReveal';
import { ReportDialog } from '../components/ReportDialog';

const ANSWER_TEXT: Record<EngineAnswer, string> = {
  yes: 'Yes',
  no: 'No',
  probably: 'Probably',
  'probably-not': 'Probably not',
  sometimes: 'Sometimes',
  unknown: 'Unknown',
  rephrase: 'Please rephrase',
};

const EXAMPLE_QUESTIONS = [
  'Is it a Water type?',
  'Was it introduced in Sinnoh?',
  'Can it evolve?',
  'Does it have wings?',
  'Is it taller than 1 meter?',
  'Is it legendary?',
];

interface LogEntry {
  id: number;
  text: string;
  kind: 'question' | 'guess' | 'hint' | 'info';
  answer?: string;
  interpreted?: string;
}

type Outcome =
  | { name: 'playing' }
  | { name: 'won'; pokemon: PokemonPublic }
  | { name: 'lost'; pokemon: PokemonPublic };

export function GuessGame() {
  const [settings] = useSettings();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [outcome, setOutcome] = useState<Outcome>({ name: 'playing' });
  const [questionCount, setQuestionCount] = useState(0);
  const [maxQuestions, setMaxQuestions] = useState(settings.maxQuestions);
  const [remainingGuesses, setRemainingGuesses] = useState(0);
  const [candidateCount, setCandidateCount] = useState(0);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const startedRef = useRef(false);
  const nextEntryId = useRef(1);
  const logEndRef = useRef<HTMLDivElement>(null);

  const pushLog = (entry: Omit<LogEntry, 'id'>) => {
    setLog((existing) => [...existing, { ...entry, id: nextEntryId.current++ }]);
  };

  const startGame = useCallback(async () => {
    setLog([]);
    setOutcome({ name: 'playing' });
    setQuestionCount(0);
    setError(null);
    try {
      const created = await api.createGame('player-guesses', settings);
      setSessionId(created.sessionId);
      setCandidateCount(created.candidateCount);
      setMaxQuestions(created.maxQuestions);
      setRemainingGuesses(created.remainingGuesses ?? 0);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to start');
    }
  }, [settings]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startGame();
  }, [startGame]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [log]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed === '' || busy || sessionId === null || outcome.name !== 'playing') return;
    setBusy(true);
    setError(null);
    setInput('');
    api
      .ask(sessionId, trimmed)
      .then((result) => {
        setQuestionCount(result.questionCount);
        setRemainingGuesses(result.remainingGuesses);
        if (result.kind === 'guess-result' && result.guess !== undefined) {
          const { guess } = result;
          pushLog({
            text: trimmed,
            kind: 'guess',
            answer: guess.correct ? 'yes' : 'no',
            interpreted: guess.correct
              ? `${guess.guessedName} is correct!`
              : `Not ${guess.guessedName}.`,
          });
          setAnnouncement(guess.correct ? `Correct! It was ${guess.guessedName}.` : `No, it is not ${guess.guessedName}.`);
          if (guess.gameOver && guess.pokemon !== undefined) {
            setOutcome(guess.correct ? { name: 'won', pokemon: guess.pokemon } : { name: 'lost', pokemon: guess.pokemon });
          }
        } else if (result.kind === 'rephrase') {
          pushLog({ text: trimmed, kind: 'question', answer: 'rephrase' });
          setAnnouncement('I did not understand that question — please rephrase.');
        } else {
          pushLog({
            text: trimmed,
            kind: 'question',
            ...(result.answer !== undefined ? { answer: result.answer } : {}),
            ...(result.interpreted !== undefined ? { interpreted: result.interpreted } : {}),
          });
          setAnnouncement(`${trimmed} — ${result.answer !== undefined ? ANSWER_TEXT[result.answer] : ''}`);
        }
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof ApiRequestError) {
          setError(requestError.message);
        } else {
          setError('Request failed — try again.');
        }
      })
      .finally(() => setBusy(false));
  };

  const requestHint = () => {
    if (busy || sessionId === null || outcome.name !== 'playing') return;
    setBusy(true);
    api
      .hint(sessionId)
      .then((result) => {
        pushLog({ text: `Hint ${result.hintNumber}`, kind: 'hint', interpreted: result.hint });
        setAnnouncement(result.hint);
      })
      .catch((hintError: unknown) => {
        setError(hintError instanceof ApiRequestError ? hintError.message : 'No hint available.');
      })
      .finally(() => setBusy(false));
  };

  const giveUp = () => {
    if (busy || sessionId === null || outcome.name !== 'playing') return;
    setBusy(true);
    api
      .giveUp(sessionId)
      .then((result) => {
        setOutcome({ name: 'lost', pokemon: result.pokemon });
        setAnnouncement(`It was ${result.pokemon.displayName}.`);
      })
      .catch(() => setError('Could not give up — try again.'))
      .finally(() => setBusy(false));
  };

  const playAgain = () => {
    startedRef.current = false;
    void startGame();
  };

  return (
    <>
      <div className="game-top">
        <h1 style={{ fontSize: '1.3rem', margin: 0 }}>You Guess the Pokémon</h1>
        <span className="progress">
          Questions {questionCount} / {maxQuestions} · Guesses left {remainingGuesses} ·{' '}
          {candidateCount} Pokémon in play
        </span>
      </div>

      <p aria-live="polite" className="visually-hidden">
        {announcement}
      </p>

      {outcome.name === 'playing' ? (
        <div className="card">
          <p>
            I've picked a secret Pokémon. Ask me questions in plain English, or make a direct guess
            like <em>“Is it Dragonair?”</em>
          </p>

          <ul className="chat-log" aria-label="Question history">
            {log.map((entry) => (
              <li key={entry.id} className="chat-entry">
                <span className="q">{entry.text}</span>
                <span className="meta-line">
                  {entry.answer !== undefined ? (
                    <span className={`pill answer-${entry.answer}`}>
                      {ANSWER_TEXT[entry.answer as EngineAnswer] ?? entry.answer}
                    </span>
                  ) : null}
                  {entry.interpreted !== undefined ? <span>{entry.interpreted}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <div ref={logEndRef} />

          <form
            className="ask-form"
            onSubmit={(event) => {
              event.preventDefault();
              submit(input);
            }}
          >
            <input
              type="text"
              value={input}
              maxLength={200}
              placeholder="Ask a yes/no question or guess a Pokémon…"
              aria-label="Your question"
              disabled={busy}
              onChange={(event) => setInput(event.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={busy || input.trim() === ''}>
              Send
            </button>
          </form>
          {error !== null ? <p className="error-text">{error}</p> : null}

          <div className="suggestion-row" aria-label="Example questions">
            {EXAMPLE_QUESTIONS.map((example) => (
              <button
                key={example}
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => submit(example)}
              >
                {example}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            {settings.hintsEnabled ? (
              <button type="button" className="btn" disabled={busy} onClick={requestHint}>
                💡 Hint
              </button>
            ) : null}
            <button type="button" className="btn btn-danger" disabled={busy} onClick={giveUp}>
              Give up
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <PokemonReveal
            pokemon={outcome.pokemon}
            showSprite={settings.showSpritesOnWin}
            title={outcome.name === 'won' ? 'You got it! 🎉' : 'It was…'}
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={playAgain}>
              Play again
            </button>
            <button type="button" className="btn" onClick={() => navigate('home')}>
              Home
            </button>
            <ReportDialog sessionId={sessionId ?? undefined} pokemonId={outcome.pokemon.id} />
          </div>
        </div>
      )}
    </>
  );
}
