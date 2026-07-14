/**
 * Game endpoints for both modes. Sessions are server-owned; the client only
 * ever holds an opaque token. In player-guesses mode the secret Pokémon is
 * never present in any response until the game is over.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { loadDataset, toPublic, type Dataset } from '../db';
import {
  createSession,
  listAnswers,
  loadSession,
  logParse,
  markAnswerUndone,
  recordAnswer,
  recordGuess,
  saveSession,
  countRecentParses,
  type EngineSessionState,
  type GameSession,
} from '../sessions';
import {
  answerRequestSchema,
  askRequestSchema,
  createGameSchema,
  directGuessRequestSchema,
  guessResponseRequestSchema,
  revealRequestSchema,
  sessionIdSchema,
} from '../../shared/schemas';
import {
  DEFAULT_ENGINE_CONFIG,
} from '../../shared/engine/config';
import {
  applyAnswer,
  applyGuessRejected,
  chooseAction,
  findContradictions,
  initGuesser,
  undoLastAnswer,
  type GuesserAction,
  type GuesserContext,
} from '../../shared/engine/guesser';
import { answerQuestion, type EvaluationContext } from '../../shared/engine/evaluate';
import { TRAIT_KINDS } from '../../shared/traits';
import { matchesSettings, DIRECT_GUESS_ALLOWANCE, type GameSettings } from '../../shared/types';
import { parsePlayerQuestion, lookupPokemonName } from '../../shared/parser/parse';
import { aiParseQuestion } from '../ai-parser';
import type {
  AnswerResponse,
  AskResponse,
  CreateGameResponse,
  DirectGuessResult,
  EngineAction,
  GameStateResponse,
  GiveUpResponse,
  GuessResponseResponse,
  HintResponse,
  RevealResponse,
  UndoResponse,
} from '../../shared/api';
import type { z } from 'zod';
import type { Context } from 'hono';

export const games = new Hono<AppEnv>();

const ASK_RATE_LIMIT = 20; // parses per session per window
const ASK_RATE_WINDOW_SECONDS = 60;
const MAX_HINTS = 3;

function evaluationContext(dataset: Dataset): EvaluationContext {
  return {
    traitKinds: TRAIT_KINDS,
    evolutionLineOf: (pokemonId) => dataset.byId.get(pokemonId)?.record.evolutionLineId ?? null,
  };
}

function guesserContext(dataset: Dataset, candidateIds: number[]): GuesserContext {
  const candidates = candidateIds.map((id) => {
    const candidate = dataset.byId.get(id);
    if (candidate === undefined) throw new Error(`candidate ${id} missing from dataset`);
    return candidate;
  });
  return {
    candidates,
    questionsById: dataset.questionsById,
    evaluation: evaluationContext(dataset),
    config: DEFAULT_ENGINE_CONFIG,
  };
}

async function parseJson<T extends z.ZodTypeAny>(
  c: Context<AppEnv>,
  schema: T,
): Promise<{ ok: true; data: z.output<T> } | { ok: false; response: Response }> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return { ok: false, response: c.json({ error: 'invalid-json' }, 400) };
  }
  const parsed = schema.safeParse(body) as z.SafeParseReturnType<unknown, z.output<T>>;
  if (!parsed.success) {
    return {
      ok: false,
      response: c.json({ error: 'invalid-request', detail: parsed.error.issues[0]?.message }, 400),
    };
  }
  return { ok: true, data: parsed.data };
}

async function requireSession(
  c: Context<AppEnv>,
  mode: 'ai-guesses' | 'player-guesses',
): Promise<{ ok: true; session: GameSession } | { ok: false; response: Response }> {
  const idResult = sessionIdSchema.safeParse(c.req.param('id'));
  if (!idResult.success) {
    return { ok: false, response: c.json({ error: 'invalid-session-id' }, 400) };
  }
  const session = await loadSession(c.env.DB, idResult.data);
  if (session === null) {
    return { ok: false, response: c.json({ error: 'session-not-found' }, 404) };
  }
  if (session.mode !== mode) {
    return { ok: false, response: c.json({ error: 'wrong-mode' }, 409) };
  }
  if (session.status !== 'active') {
    return { ok: false, response: c.json({ error: 'game-over' }, 409) };
  }
  return { ok: true, session };
}

function toEngineAction(action: GuesserAction, dataset: Dataset, state: EngineSessionState): EngineAction {
  if (action.type === 'question') {
    const question = dataset.questionsById.get(action.questionId);
    if (question === undefined) throw new Error(`question ${action.questionId} missing`);
    return {
      type: 'question',
      question: { id: question.id, text: question.text },
      questionNumber: state.guesser.history.length + 1,
    };
  }
  if (action.type === 'guess') {
    const pokemon = dataset.byId.get(action.pokemonId);
    if (pokemon === undefined) throw new Error(`pokemon ${action.pokemonId} missing`);
    return {
      type: 'guess',
      pokemon: toPublic(pokemon.record),
      guessNumber: state.guesser.guessedPokemonIds.length + 1,
    };
  }
  return { type: 'defeated' };
}

/** Advance the mode 1 engine and persist the resulting session state. */
function advanceEngine(
  dataset: Dataset,
  state: EngineSessionState,
): { action: GuesserAction; engineAction: EngineAction } {
  const ctx = guesserContext(dataset, state.guesser.candidateIds);
  const action = chooseAction(state.guesser, ctx);
  if (action.type === 'question') {
    state.guesser.currentQuestionId = action.questionId;
    state.pendingGuessPokemonId = null;
  } else if (action.type === 'guess') {
    state.guesser.currentQuestionId = null;
    state.pendingGuessPokemonId = action.pokemonId;
  }
  return { action, engineAction: toEngineAction(action, dataset, state) };
}

// ---------------------------------------------------------------------------
// Session creation (both modes)
// ---------------------------------------------------------------------------

games.post('/', async (c) => {
  const body = await parseJson(c, createGameSchema);
  if (!body.ok) return body.response;
  const { mode, settings } = body.data;

  const dataset = await loadDataset(c.env.DB);
  const pool = dataset.candidates.filter((candidate) => matchesSettings(candidate.record, settings));
  if (pool.length < 2) {
    return c.json({ error: 'no-candidates', detail: 'Settings leave too few Pokémon in play.' }, 400);
  }

  if (mode === 'ai-guesses') {
    const state: EngineSessionState = {
      guesser: initGuesser(
        pool.map((candidate) => candidate.record.id),
        settings.maxQuestions,
      ),
      pendingGuessPokemonId: null,
    };
    const { engineAction } = advanceEngine(dataset, state);
    const sessionId = await createSession(c.env.DB, mode, settings, null, state);
    const response: CreateGameResponse = {
      sessionId,
      mode,
      candidateCount: pool.length,
      maxQuestions: settings.maxQuestions,
      action: engineAction,
    };
    return c.json(response);
  }

  // player-guesses: pick the secret uniformly with unbiased rejection sampling.
  const secret = pool[secureRandomIndex(pool.length)];
  if (secret === undefined) {
    return c.json({ error: 'no-candidates' }, 400);
  }
  const sessionId = await createSession(c.env.DB, mode, settings, secret.record.id, null);
  const response: CreateGameResponse = {
    sessionId,
    mode,
    candidateCount: pool.length,
    maxQuestions: settings.maxQuestions,
    remainingGuesses: DIRECT_GUESS_ALLOWANCE[settings.difficulty],
  };
  return c.json(response);
});

function secureRandomIndex(length: number): number {
  const range = 0x100000000;
  const limit = range - (range % length);
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0];
    if (value !== undefined && value < limit) return value % length;
  }
}

// ---------------------------------------------------------------------------
// Mode 1: AI guesses the player's Pokémon
// ---------------------------------------------------------------------------

games.post('/:id/answer', async (c) => {
  const found = await requireSession(c, 'ai-guesses');
  if (!found.ok) return found.response;
  const { session } = found;
  const body = await parseJson(c, answerRequestSchema);
  if (!body.ok) return body.response;

  const state = session.engineState;
  if (state === null || state.guesser.currentQuestionId === null) {
    return c.json({ error: 'no-question-pending' }, 409);
  }

  const dataset = await loadDataset(c.env.DB);
  const ctx = guesserContext(dataset, state.guesser.candidateIds);
  const questionId = state.guesser.currentQuestionId;
  const question = dataset.questionsById.get(questionId);
  if (question === undefined) return c.json({ error: 'question-missing' }, 500);

  state.guesser = applyAnswer(state.guesser, questionId, body.data.answer, ctx);
  await recordAnswer(
    c.env.DB,
    session.id,
    state.guesser.history.length,
    questionId,
    question.text,
    body.data.answer,
  );

  const { engineAction } = advanceEngine(dataset, state);
  session.questionCount = state.guesser.history.length;
  session.engineState = state;
  await saveSession(c.env.DB, session);

  const response: AnswerResponse = { action: engineAction, questionCount: session.questionCount };
  return c.json(response);
});

games.post('/:id/guess-response', async (c) => {
  const found = await requireSession(c, 'ai-guesses');
  if (!found.ok) return found.response;
  const { session } = found;
  const body = await parseJson(c, guessResponseRequestSchema);
  if (!body.ok) return body.response;

  const state = session.engineState;
  if (state === null || state.pendingGuessPokemonId === null) {
    return c.json({ error: 'no-guess-pending' }, 409);
  }

  const dataset = await loadDataset(c.env.DB);
  const guessedId = state.pendingGuessPokemonId;
  const guessed = dataset.byId.get(guessedId);
  await recordGuess(
    c.env.DB,
    session.id,
    'system',
    guessedId,
    guessed?.record.displayName ?? String(guessedId),
    body.data.correct,
  );
  session.guessCount += 1;

  if (body.data.correct) {
    session.status = 'won';
    state.pendingGuessPokemonId = null;
    session.engineState = state;
    await saveSession(c.env.DB, session);
    const response: GuessResponseResponse = { result: 'won', questionCount: session.questionCount };
    return c.json(response);
  }

  const ctx = guesserContext(dataset, state.guesser.candidateIds);
  state.guesser = applyGuessRejected(state.guesser, guessedId, ctx);
  state.pendingGuessPokemonId = null;

  const { action, engineAction } = advanceEngine(dataset, state);
  session.engineState = state;
  await saveSession(c.env.DB, session);

  const response: GuessResponseResponse = {
    result: action.type === 'defeated' ? 'defeated' : 'continue',
    action: engineAction,
    questionCount: session.questionCount,
  };
  return c.json(response);
});

games.post('/:id/undo', async (c) => {
  const found = await requireSession(c, 'ai-guesses');
  if (!found.ok) return found.response;
  const { session } = found;

  const state = session.engineState;
  if (state === null) return c.json({ error: 'no-engine-state' }, 500);
  if (state.pendingGuessPokemonId !== null) {
    return c.json({ error: 'guess-pending', detail: 'Respond to the guess first.' }, 409);
  }
  const lastTurn = state.guesser.history.length;
  if (lastTurn === 0) return c.json({ error: 'nothing-to-undo' }, 409);

  const dataset = await loadDataset(c.env.DB);
  const ctx = guesserContext(dataset, state.guesser.candidateIds);
  const undoneQuestionId = state.guesser.history[lastTurn - 1]?.questionId ?? null;
  const undoneText =
    undoneQuestionId !== null ? (dataset.questionsById.get(undoneQuestionId)?.text ?? null) : null;

  state.guesser = undoLastAnswer(state.guesser, ctx);
  await markAnswerUndone(c.env.DB, session.id, lastTurn);

  const { engineAction } = advanceEngine(dataset, state);
  session.questionCount = state.guesser.history.length;
  session.engineState = state;
  await saveSession(c.env.DB, session);

  const response: UndoResponse = {
    action: engineAction,
    questionCount: session.questionCount,
    undoneQuestion: undoneText,
  };
  return c.json(response);
});

games.post('/:id/reveal', async (c) => {
  const found = await requireSession(c, 'ai-guesses');
  if (!found.ok) return found.response;
  const { session } = found;
  const body = await parseJson(c, revealRequestSchema);
  if (!body.ok) return body.response;

  const dataset = await loadDataset(c.env.DB);
  const revealed = dataset.byId.get(body.data.pokemonId);
  if (revealed === undefined) return c.json({ error: 'unknown-pokemon' }, 404);

  const state = session.engineState;
  if (state === null) return c.json({ error: 'no-engine-state' }, 500);

  const ctx = guesserContext(dataset, state.guesser.candidateIds);
  const contradictions = findContradictions(state.guesser, revealed, ctx);

  session.status = 'lost'; // the engine failed to guess it
  await saveSession(c.env.DB, session);
  await recordGuess(c.env.DB, session.id, 'player', revealed.record.id, revealed.record.displayName, true);

  const response: RevealResponse = {
    pokemon: toPublic(revealed.record),
    contradictions: contradictions.map((item) => ({
      questionText: item.questionText,
      playerAnswer: item.playerAnswer,
      expectedAnswer: item.expectedAnswer,
    })),
  };
  return c.json(response);
});

// ---------------------------------------------------------------------------
// Mode 2: player guesses the secret Pokémon
// ---------------------------------------------------------------------------

interface SecretLookup {
  secret: NonNullable<ReturnType<Dataset['byId']['get']>>;
}

function requireSecret(
  c: Context<AppEnv>,
  session: GameSession,
  dataset: Dataset,
): { ok: true; value: SecretLookup } | { ok: false; response: Response } {
  const secret = session.secretPokemonId !== null ? dataset.byId.get(session.secretPokemonId) : undefined;
  if (secret === undefined) {
    return { ok: false, response: c.json({ error: 'corrupt-session' }, 500) };
  }
  return { ok: true, value: { secret } };
}

async function resolveDirectGuess(
  c: Context<AppEnv>,
  session: GameSession,
  dataset: Dataset,
  guessedId: number,
  guessText: string,
): Promise<Response> {
  const allowance = DIRECT_GUESS_ALLOWANCE[session.settings.difficulty];
  if (session.guessCount >= allowance) {
    return c.json({ error: 'no-guesses-left' }, 409);
  }
  const secretCheck = requireSecret(c, session, dataset);
  if (!secretCheck.ok) return secretCheck.response;
  const { secret } = secretCheck.value;

  const guessed = dataset.byId.get(guessedId);
  const correct = guessedId === secret.record.id;
  session.guessCount += 1;
  await recordGuess(
    c.env.DB,
    session.id,
    'player',
    guessed?.record.id ?? null,
    guessText,
    correct,
  );

  const remaining = allowance - session.guessCount;
  const gameOver = correct || remaining <= 0;
  if (correct) session.status = 'won';
  else if (gameOver) session.status = 'lost';
  await saveSession(c.env.DB, session);

  const guessResult: DirectGuessResult = {
    correct,
    guessedName: guessed?.record.displayName ?? guessText,
    gameOver,
    // The secret is revealed ONLY when the game has ended.
    ...(gameOver ? { pokemon: toPublic(secret.record) } : {}),
  };
  const response: AskResponse = {
    kind: 'guess-result',
    questionCount: session.questionCount,
    remainingGuesses: remaining,
    guess: guessResult,
  };
  return c.json(response);
}

games.post('/:id/ask', async (c) => {
  const found = await requireSession(c, 'player-guesses');
  if (!found.ok) return found.response;
  const { session } = found;
  const body = await parseJson(c, askRequestSchema);
  if (!body.ok) return body.response;

  const recentParses = await countRecentParses(c.env.DB, session.id, ASK_RATE_WINDOW_SECONDS);
  if (recentParses >= ASK_RATE_LIMIT) {
    return c.json({ error: 'rate-limited', detail: 'Too many questions — slow down a little.' }, 429);
  }

  const dataset = await loadDataset(c.env.DB);
  const allowance = DIRECT_GUESS_ALLOWANCE[session.settings.difficulty];
  const startedAt = Date.now();

  let parser: 'deterministic' | 'ai' = 'deterministic';
  let parsed = parsePlayerQuestion(body.data.text, { nameToId: dataset.nameToId });
  const ai = c.env.AI;
  if (parsed === null && c.env.AI_PARSER_ENABLED === 'true' && ai !== undefined) {
    parser = 'ai';
    parsed = await aiParseQuestion(ai, c.env.AI_PARSER_MODEL, body.data.text);
  }

  if (parsed === null) {
    await logParse(c.env.DB, session.id, body.data.text, 'failed', null, null, Date.now() - startedAt);
    const response: AskResponse = {
      kind: 'rephrase',
      questionCount: session.questionCount,
      remainingGuesses: allowance - session.guessCount,
    };
    return c.json(response);
  }

  // Direct name guesses consume a guess, not a question.
  if (parsed.question.query.kind === 'name-guess' && !parsed.question.negated) {
    await logParse(
      c.env.DB,
      session.id,
      body.data.text,
      parser,
      JSON.stringify(parsed.question),
      'guess',
      Date.now() - startedAt,
    );
    return resolveDirectGuess(c, session, dataset, parsed.question.query.pokemonId, body.data.text);
  }

  if (session.questionCount >= session.settings.maxQuestions) {
    return c.json(
      { error: 'question-limit', detail: 'Question limit reached — make your guess!' },
      409,
    );
  }

  const secretCheck = requireSecret(c, session, dataset);
  if (!secretCheck.ok) return secretCheck.response;
  const answer = answerQuestion(parsed.question, secretCheck.value.secret, evaluationContext(dataset));

  session.questionCount += 1;
  await recordAnswer(c.env.DB, session.id, session.questionCount, null, body.data.text, answer);
  await logParse(
    c.env.DB,
    session.id,
    body.data.text,
    parser,
    JSON.stringify(parsed.question),
    answer,
    Date.now() - startedAt,
  );
  await saveSession(c.env.DB, session);

  const response: AskResponse = {
    kind: 'answered',
    answer,
    interpreted: parsed.interpreted,
    parser,
    questionCount: session.questionCount,
    remainingGuesses: allowance - session.guessCount,
  };
  return c.json(response);
});

games.post('/:id/guess', async (c) => {
  const found = await requireSession(c, 'player-guesses');
  if (!found.ok) return found.response;
  const { session } = found;
  const body = await parseJson(c, directGuessRequestSchema);
  if (!body.ok) return body.response;

  const dataset = await loadDataset(c.env.DB);
  const named = lookupPokemonName(body.data.name, { nameToId: dataset.nameToId });
  if (named === null) {
    return c.json({ error: 'unknown-pokemon', detail: `No Pokémon called "${body.data.name}" found.` }, 404);
  }
  return resolveDirectGuess(c, session, dataset, named.id, body.data.name);
});

games.post('/:id/hint', async (c) => {
  const found = await requireSession(c, 'player-guesses');
  if (!found.ok) return found.response;
  const { session } = found;
  if (!session.settings.hintsEnabled) return c.json({ error: 'hints-disabled' }, 409);
  if (session.hintCount >= MAX_HINTS) return c.json({ error: 'no-hints-left' }, 409);

  const dataset = await loadDataset(c.env.DB);
  const secretCheck = requireSecret(c, session, dataset);
  if (!secretCheck.ok) return secretCheck.response;
  const { record } = secretCheck.value.secret;

  const hints = [
    `It was introduced in Generation ${record.generation}.`,
    `Its primary type is ${record.primaryType}.`,
    `Its name starts with "${record.displayName.charAt(0)}".`,
  ];
  const hint = hints[session.hintCount];
  if (hint === undefined) return c.json({ error: 'no-hints-left' }, 409);

  session.hintCount += 1;
  await saveSession(c.env.DB, session);

  const response: HintResponse = {
    hint,
    hintNumber: session.hintCount,
    hintsRemaining: MAX_HINTS - session.hintCount,
  };
  return c.json(response);
});

games.post('/:id/giveup', async (c) => {
  const found = await requireSession(c, 'player-guesses');
  if (!found.ok) return found.response;
  const { session } = found;

  const dataset = await loadDataset(c.env.DB);
  const secretCheck = requireSecret(c, session, dataset);
  if (!secretCheck.ok) return secretCheck.response;

  session.status = 'lost';
  await saveSession(c.env.DB, session);

  const response: GiveUpResponse = { pokemon: toPublic(secretCheck.value.secret.record) };
  return c.json(response);
});

// ---------------------------------------------------------------------------
// Shared: state summary (no secrets, works for both modes, any status)
// ---------------------------------------------------------------------------

games.get('/:id', async (c) => {
  const idResult = sessionIdSchema.safeParse(c.req.param('id'));
  if (!idResult.success) return c.json({ error: 'invalid-session-id' }, 400);
  const session = await loadSession(c.env.DB, idResult.data);
  if (session === null) return c.json({ error: 'session-not-found' }, 404);

  const history = await listAnswers(c.env.DB, session.id);
  const response: GameStateResponse = {
    sessionId: session.id,
    mode: session.mode,
    status: session.status,
    questionCount: session.questionCount,
    maxQuestions: session.settings.maxQuestions,
    history,
    ...(session.mode === 'player-guesses'
      ? { remainingGuesses: DIRECT_GUESS_ALLOWANCE[session.settings.difficulty] - session.guessCount }
      : {}),
  };
  return c.json(response);
});

export type { GameSettings };
