/**
 * API response types shared between the Worker and the frontend.
 * Responses never contain the secret Pokémon in player-guesses mode.
 */

import type { EngineAnswer, PlayerAnswer } from './types';

/** Public projection of a Pokémon — used only when a reveal is intended. */
export interface PokemonPublic {
  id: number;
  name: string;
  displayName: string;
  generation: number;
  types: string[];
  spriteUrl: string | null;
  officialArtworkUrl: string | null;
}

export interface QuestionPublic {
  id: number;
  text: string;
}

/** Mode 1: what the engine wants to do next. */
export type EngineAction =
  | { type: 'question'; question: QuestionPublic; questionNumber: number }
  | { type: 'guess'; pokemon: PokemonPublic; guessNumber: number }
  | { type: 'defeated' };

export interface CreateGameResponse {
  sessionId: string;
  mode: 'ai-guesses' | 'player-guesses';
  candidateCount: number;
  maxQuestions: number;
  /** Mode 1 only: the first question. */
  action?: EngineAction;
  /** Mode 2 only. */
  remainingGuesses?: number;
}

export interface AnswerResponse {
  action: EngineAction;
  questionCount: number;
}

export interface GuessResponseResponse {
  result: 'won' | 'continue' | 'defeated';
  action?: EngineAction;
  questionCount: number;
}

export interface UndoResponse {
  action: EngineAction;
  questionCount: number;
  undoneQuestion: string | null;
}

export interface ContradictionItem {
  questionText: string;
  playerAnswer: PlayerAnswer;
  expectedAnswer: 'yes' | 'no';
}

export interface RevealResponse {
  pokemon: PokemonPublic;
  contradictions: ContradictionItem[];
}

/** Mode 2: response to a natural-language question. */
export interface AskResponse {
  kind: 'answered' | 'rephrase' | 'guess-result';
  answer?: EngineAnswer;
  /** Human-readable restatement of what was understood. */
  interpreted?: string;
  parser?: 'deterministic' | 'ai';
  questionCount: number;
  remainingGuesses: number;
  /** Present when kind = 'guess-result'. */
  guess?: DirectGuessResult;
}

export interface DirectGuessResult {
  correct: boolean;
  guessedName: string;
  /** Revealed only when the guess is correct or the game ends. */
  pokemon?: PokemonPublic;
  gameOver: boolean;
}

export interface HintResponse {
  hint: string;
  hintNumber: number;
  hintsRemaining: number;
}

export interface GiveUpResponse {
  pokemon: PokemonPublic;
}

export interface GameStateResponse {
  sessionId: string;
  mode: 'ai-guesses' | 'player-guesses';
  status: 'active' | 'won' | 'lost' | 'abandoned';
  questionCount: number;
  maxQuestions: number;
  remainingGuesses?: number;
  history: { turn: number; questionText: string; answer: string }[];
}

export interface PokemonNameSuggestion {
  id: number;
  displayName: string;
}

export interface MetaResponse {
  appName: string;
  pokemonCount: number;
  generations: { generation: number; count: number }[];
  datasetImportedAt: string | null;
  aiParserEnabled: boolean;
}

export interface ApiError {
  error: string;
  detail?: string;
}
