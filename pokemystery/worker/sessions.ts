/**
 * Server-owned game sessions in D1. Clients hold only an opaque
 * cryptographically random token; all state (including Mode 2's secret
 * Pokémon) lives here.
 */

import type { GameSettings } from '../shared/types';
import type { GuesserState } from '../shared/engine/guesser';
import { gameSettingsSchema } from '../shared/schemas';

export type GameMode = 'ai-guesses' | 'player-guesses';
export type GameStatus = 'active' | 'won' | 'lost' | 'abandoned';

/** Mode 1 engine state plus request-flow bookkeeping. */
export interface EngineSessionState {
  guesser: GuesserState;
  /** Set while a system guess is awaiting the player's confirmation. */
  pendingGuessPokemonId: number | null;
}

export interface GameSession {
  id: string;
  mode: GameMode;
  status: GameStatus;
  settings: GameSettings;
  secretPokemonId: number | null;
  engineState: EngineSessionState | null;
  questionCount: number;
  guessCount: number;
  hintCount: number;
}

const SESSION_TTL_HOURS = 24;

export function newSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

interface SessionRow {
  id: string;
  mode: string;
  status: string;
  settings_json: string;
  secret_pokemon_id: number | null;
  engine_state_json: string | null;
  question_count: number;
  guess_count: number;
}

/** hintCount is derived from engine_state_json for mode 2 (stored inline). */
interface Mode2State {
  hintCount: number;
}

export async function createSession(
  db: D1Database,
  mode: GameMode,
  settings: GameSettings,
  secretPokemonId: number | null,
  engineState: EngineSessionState | null,
): Promise<string> {
  const id = newSessionId();
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  await db
    .prepare(
      `INSERT INTO game_sessions
        (id, mode, status, settings_json, secret_pokemon_id, engine_state_json, expires_at)
       VALUES (?1, ?2, 'active', ?3, ?4, ?5, ?6)`,
    )
    .bind(
      id,
      mode,
      JSON.stringify(settings),
      secretPokemonId,
      engineState !== null ? JSON.stringify(engineState) : JSON.stringify({ hintCount: 0 }),
      expires,
    )
    .run();
  return id;
}

export async function loadSession(db: D1Database, id: string): Promise<GameSession | null> {
  const row = await db
    .prepare(
      `SELECT id, mode, status, settings_json, secret_pokemon_id, engine_state_json,
              question_count, guess_count
       FROM game_sessions WHERE id = ?1 AND expires_at > ?2`,
    )
    .bind(id, new Date().toISOString())
    .first<SessionRow>();
  if (row === null) return null;

  const settings = gameSettingsSchema.safeParse(JSON.parse(row.settings_json));
  if (!settings.success) return null;

  const mode = row.mode as GameMode;
  let engineState: EngineSessionState | null = null;
  let hintCount = 0;
  if (row.engine_state_json !== null) {
    const state = JSON.parse(row.engine_state_json) as EngineSessionState | Mode2State;
    if (mode === 'ai-guesses' && 'guesser' in state) {
      engineState = state;
    } else if ('hintCount' in state) {
      hintCount = state.hintCount;
    }
  }

  return {
    id: row.id,
    mode,
    status: row.status as GameStatus,
    settings: settings.data,
    secretPokemonId: row.secret_pokemon_id,
    engineState,
    questionCount: row.question_count,
    guessCount: row.guess_count,
    hintCount,
  };
}

export async function saveSession(db: D1Database, session: GameSession): Promise<void> {
  const stateJson =
    session.mode === 'ai-guesses'
      ? JSON.stringify(session.engineState)
      : JSON.stringify({ hintCount: session.hintCount });
  await db
    .prepare(
      `UPDATE game_sessions
       SET status = ?2, engine_state_json = ?3, question_count = ?4, guess_count = ?5,
           updated_at = ?6
       WHERE id = ?1`,
    )
    .bind(
      session.id,
      session.status,
      stateJson,
      session.questionCount,
      session.guessCount,
      new Date().toISOString(),
    )
    .run();
}

export async function recordAnswer(
  db: D1Database,
  sessionId: string,
  turn: number,
  questionId: number | null,
  questionText: string,
  answer: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO game_answers (session_id, turn, question_id, question_text, answer)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    )
    .bind(sessionId, turn, questionId, questionText, answer)
    .run();
}

export async function markAnswerUndone(db: D1Database, sessionId: string, turn: number): Promise<void> {
  await db
    .prepare('UPDATE game_answers SET undone = 1 WHERE session_id = ?1 AND turn = ?2')
    .bind(sessionId, turn)
    .run();
}

export async function recordGuess(
  db: D1Database,
  sessionId: string,
  guesser: 'system' | 'player',
  pokemonId: number | null,
  guessText: string,
  correct: boolean,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO game_guesses (session_id, guesser, pokemon_id, guess_text, correct)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    )
    .bind(sessionId, guesser, pokemonId, guessText, correct ? 1 : 0)
    .run();
}

export async function listAnswers(
  db: D1Database,
  sessionId: string,
): Promise<{ turn: number; questionText: string; answer: string }[]> {
  const result = await db
    .prepare(
      `SELECT turn, question_text, answer FROM game_answers
       WHERE session_id = ?1 AND undone = 0 ORDER BY turn`,
    )
    .bind(sessionId)
    .all<{ turn: number; question_text: string; answer: string }>();
  return result.results.map((row) => ({
    turn: row.turn,
    questionText: row.question_text,
    answer: row.answer,
  }));
}

export async function logParse(
  db: D1Database,
  sessionId: string | null,
  rawText: string,
  parser: 'deterministic' | 'ai' | 'failed',
  parsedQueryJson: string | null,
  answer: string | null,
  durationMs: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO question_parse_logs (session_id, raw_text, parser, parsed_query_json, answer, duration_ms)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(sessionId, rawText, parser, parsedQueryJson, answer, durationMs)
    .run();
}

/** Sliding-window rate limit backed by the parse log. */
export async function countRecentParses(
  db: D1Database,
  sessionId: string,
  windowSeconds: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const row = await db
    .prepare(
      'SELECT COUNT(*) AS n FROM question_parse_logs WHERE session_id = ?1 AND created_at > ?2',
    )
    .bind(sessionId, cutoff)
    .first<{ n: number }>();
  return row?.n ?? 0;
}
