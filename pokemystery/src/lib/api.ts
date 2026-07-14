/** Typed API client. All game state lives server-side; we only hold tokens. */

import type {
  AnswerResponse,
  ApiError,
  AskResponse,
  CreateGameResponse,
  GameStateResponse,
  GiveUpResponse,
  GuessResponseResponse,
  HintResponse,
  MetaResponse,
  PokemonNameSuggestion,
  RevealResponse,
  UndoResponse,
} from '../../shared/api';
import type { GameSettings, PlayerAnswer } from '../../shared/types';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, body: ApiError) {
    super(body.detail ?? body.error);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = body.error;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body: unknown = await response.json().catch(() => ({ error: 'bad-response' }));
  if (!response.ok) {
    throw new ApiRequestError(response.status, body as ApiError);
  }
  return body as T;
}

const post = <T>(path: string, data?: unknown): Promise<T> =>
  request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) });

export const api = {
  meta: () => request<MetaResponse>('/api/meta'),
  createGame: (mode: 'ai-guesses' | 'player-guesses', settings: GameSettings) =>
    post<CreateGameResponse>('/api/games', { mode, settings }),
  answer: (sessionId: string, answer: PlayerAnswer) =>
    post<AnswerResponse>(`/api/games/${sessionId}/answer`, { answer }),
  guessResponse: (sessionId: string, correct: boolean) =>
    post<GuessResponseResponse>(`/api/games/${sessionId}/guess-response`, { correct }),
  undo: (sessionId: string) => post<UndoResponse>(`/api/games/${sessionId}/undo`),
  reveal: (sessionId: string, pokemonId: number) =>
    post<RevealResponse>(`/api/games/${sessionId}/reveal`, { pokemonId }),
  ask: (sessionId: string, text: string) => post<AskResponse>(`/api/games/${sessionId}/ask`, { text }),
  guess: (sessionId: string, name: string) =>
    post<AskResponse>(`/api/games/${sessionId}/guess`, { name }),
  hint: (sessionId: string) => post<HintResponse>(`/api/games/${sessionId}/hint`),
  giveUp: (sessionId: string) => post<GiveUpResponse>(`/api/games/${sessionId}/giveup`),
  gameState: (sessionId: string) => request<GameStateResponse>(`/api/games/${sessionId}`),
  suggestNames: (query: string) =>
    request<{ suggestions: PokemonNameSuggestion[] }>(
      `/api/pokemon/names?q=${encodeURIComponent(query)}`,
    ),
  report: (report: {
    sessionId?: string;
    pokemonId?: number;
    category: string;
    detail?: string;
  }) => post<{ ok: boolean }>('/api/reports', report),
};
