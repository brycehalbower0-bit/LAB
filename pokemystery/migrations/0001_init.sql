-- Migration number: 0001    2026-07-14
-- PokéMystery initial schema.
--
-- Conventions:
--  * snake_case column names; TEXT ISO-8601 timestamps (UTC).
--  * Booleans are INTEGER 0/1 with CHECK constraints.
--  * JSON-valued columns are TEXT with a _json suffix.
--  * Species are the unit of play; the schema still supports specific forms
--    later via pokemon.species_id + pokemon.form_name (a future form row is a
--    new pokemon row sharing species_id).

PRAGMA defer_foreign_keys = true;

-- ---------------------------------------------------------------------------
-- Canonical Pokémon records (normalized from PokéAPI).
-- ---------------------------------------------------------------------------
CREATE TABLE pokemon (
  id INTEGER PRIMARY KEY,                 -- national dex number for default forms
  name TEXT NOT NULL UNIQUE,              -- api slug, e.g. "mr-mime"
  display_name TEXT NOT NULL,             -- human name, e.g. "Mr. Mime"
  generation INTEGER NOT NULL CHECK (generation BETWEEN 1 AND 9),
  species_id INTEGER NOT NULL,            -- pokemon-species id (== id for default forms)
  default_form_name TEXT,                 -- non-null when this row is a specific form
  primary_type TEXT NOT NULL,
  secondary_type TEXT,
  types_json TEXT NOT NULL,               -- JSON array, ordered
  height_decimeters INTEGER NOT NULL,
  weight_hectograms INTEGER NOT NULL,
  base_experience INTEGER,
  base_stat_total INTEGER NOT NULL,
  abilities_json TEXT NOT NULL,           -- JSON array of ability slugs
  egg_groups_json TEXT NOT NULL,          -- JSON array of egg-group slugs
  color TEXT,                             -- pokeapi color slug (red, blue, ...)
  shape TEXT,                             -- pokeapi shape slug (quadruped, wings, ...)
  habitat TEXT,                           -- pokeapi habitat slug (nullable, gen1-3 mostly)
  growth_rate TEXT,
  gender_rate INTEGER,                    -- -1 genderless, else eighths female (0..8)
  is_baby INTEGER NOT NULL DEFAULT 0 CHECK (is_baby IN (0, 1)),
  is_legendary INTEGER NOT NULL DEFAULT 0 CHECK (is_legendary IN (0, 1)),
  is_mythical INTEGER NOT NULL DEFAULT 0 CHECK (is_mythical IN (0, 1)),
  is_starter INTEGER NOT NULL DEFAULT 0 CHECK (is_starter IN (0, 1)),
  has_pre_evolution INTEGER NOT NULL DEFAULT 0 CHECK (has_pre_evolution IN (0, 1)),
  can_evolve INTEGER NOT NULL DEFAULT 0 CHECK (can_evolve IN (0, 1)),
  evolution_stage INTEGER NOT NULL DEFAULT 1,
  maximum_evolution_stage INTEGER NOT NULL DEFAULT 1,
  evolution_line_id INTEGER,              -- FK to evolution_lines (nullable)
  has_branching_evolution INTEGER NOT NULL DEFAULT 0 CHECK (has_branching_evolution IN (0, 1)),
  sprite_url TEXT,
  official_artwork_url TEXT,
  imported_at TEXT NOT NULL,
  FOREIGN KEY (evolution_line_id) REFERENCES evolution_lines (id)
);

CREATE INDEX idx_pokemon_generation ON pokemon (generation);
CREATE INDEX idx_pokemon_species ON pokemon (species_id);
CREATE INDEX idx_pokemon_primary_type ON pokemon (primary_type);
CREATE INDEX idx_pokemon_evolution_line ON pokemon (evolution_line_id);

-- Many-to-many type rows for indexed querying of either slot.
CREATE TABLE pokemon_types (
  pokemon_id INTEGER NOT NULL REFERENCES pokemon (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK (slot IN (1, 2)),
  PRIMARY KEY (pokemon_id, type)
);

CREATE INDEX idx_pokemon_types_type ON pokemon_types (type);

-- ---------------------------------------------------------------------------
-- Evolution structure.
-- ---------------------------------------------------------------------------
CREATE TABLE evolution_lines (
  id INTEGER PRIMARY KEY,                 -- pokeapi evolution-chain id
  root_species_id INTEGER NOT NULL,
  max_stage INTEGER NOT NULL,
  is_branching INTEGER NOT NULL DEFAULT 0 CHECK (is_branching IN (0, 1)),
  species_count INTEGER NOT NULL,
  imported_at TEXT NOT NULL
);

CREATE TABLE evolution_edges (
  line_id INTEGER NOT NULL REFERENCES evolution_lines (id) ON DELETE CASCADE,
  from_species_id INTEGER NOT NULL,
  to_species_id INTEGER NOT NULL,
  trigger TEXT,                           -- level-up, use-item, trade, ...
  detail_json TEXT,                       -- raw evolution_details for future use
  PRIMARY KEY (from_species_id, to_species_id)
);

CREATE INDEX idx_evolution_edges_line ON evolution_edges (line_id);
CREATE INDEX idx_evolution_edges_to ON evolution_edges (to_species_id);

-- ---------------------------------------------------------------------------
-- Curated / derived traits.
-- ---------------------------------------------------------------------------
CREATE TABLE traits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,               -- e.g. "four-legged", "cute"
  label TEXT NOT NULL,                    -- human-readable
  kind TEXT NOT NULL CHECK (kind IN ('objective', 'subjective')),
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE pokemon_traits (
  pokemon_id INTEGER NOT NULL REFERENCES pokemon (id) ON DELETE CASCADE,
  trait_id INTEGER NOT NULL REFERENCES traits (id) ON DELETE CASCADE,
  confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  source TEXT NOT NULL,                   -- 'derived:shape', 'derived:color', 'curated', ...
  evidence_count INTEGER NOT NULL DEFAULT 1,
  review_status TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (review_status IN ('unreviewed', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (pokemon_id, trait_id)
);

CREATE INDEX idx_pokemon_traits_trait ON pokemon_traits (trait_id);

-- ---------------------------------------------------------------------------
-- Question bank for the AI guessing engine (Mode 1).
-- ---------------------------------------------------------------------------
CREATE TABLE questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,               -- stable machine key, e.g. "type-eq-fire"
  text TEXT NOT NULL,                     -- player-facing question
  category TEXT NOT NULL,                 -- 'type', 'generation', 'evolution', ...
  property TEXT NOT NULL,                 -- evaluated property, e.g. 'type', 'height'
  operator TEXT NOT NULL,                 -- 'eq', 'gte', 'lte', 'has', ...
  comparison_value TEXT NOT NULL,         -- JSON-encoded comparison value
  reliability REAL NOT NULL DEFAULT 1.0 CHECK (reliability > 0.0 AND reliability <= 1.0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  priority REAL NOT NULL DEFAULT 0.0,     -- additive score tweak / tie-breaker
  source TEXT NOT NULL DEFAULT 'generated',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_questions_enabled ON questions (enabled, category);

-- Optional precomputed question->pokemon match probabilities. When a row is
-- absent the engine evaluates the question deterministically at runtime.
CREATE TABLE question_matches (
  question_id INTEGER NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  pokemon_id INTEGER NOT NULL REFERENCES pokemon (id) ON DELETE CASCADE,
  match_probability REAL NOT NULL CHECK (match_probability >= 0.0 AND match_probability <= 1.0),
  PRIMARY KEY (question_id, pokemon_id)
);

-- ---------------------------------------------------------------------------
-- Server-owned game sessions.
-- ---------------------------------------------------------------------------
CREATE TABLE game_sessions (
  id TEXT PRIMARY KEY,                    -- opaque cryptographically random token
  mode TEXT NOT NULL CHECK (mode IN ('ai-guesses', 'player-guesses')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'won', 'lost', 'abandoned')),
  settings_json TEXT NOT NULL,            -- validated GameSettings snapshot
  -- Mode 2 only: the secret pokemon. Never serialized to clients.
  secret_pokemon_id INTEGER REFERENCES pokemon (id),
  -- Mode 1 only: serialized engine state (candidate log-probabilities, asked
  -- question ids, answer history for undo).
  engine_state_json TEXT,
  question_count INTEGER NOT NULL DEFAULT 0,
  guess_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_game_sessions_expires ON game_sessions (expires_at);

-- Every question asked and its response, in order.
CREATE TABLE game_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES game_sessions (id) ON DELETE CASCADE,
  turn INTEGER NOT NULL,                  -- 1-based turn number within the session
  -- Mode 1: the engine's question. Mode 2: the player's raw question text.
  question_id INTEGER REFERENCES questions (id),
  question_text TEXT NOT NULL,
  -- Mode 1: yes/probably-yes/unknown/probably-no/no (player's answer).
  -- Mode 2: yes/no/probably/sometimes/unknown/rephrase (engine's answer).
  answer TEXT NOT NULL,
  undone INTEGER NOT NULL DEFAULT 0 CHECK (undone IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (session_id, turn)
);

CREATE INDEX idx_game_answers_session ON game_answers (session_id);

-- Guesses made by either side.
CREATE TABLE game_guesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES game_sessions (id) ON DELETE CASCADE,
  guesser TEXT NOT NULL CHECK (guesser IN ('system', 'player')),
  pokemon_id INTEGER REFERENCES pokemon (id),
  guess_text TEXT NOT NULL,               -- what was shown/typed
  correct INTEGER NOT NULL CHECK (correct IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_game_guesses_session ON game_guesses (session_id);

-- ---------------------------------------------------------------------------
-- Diagnostics & feedback.
-- ---------------------------------------------------------------------------
CREATE TABLE question_parse_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES game_sessions (id) ON DELETE SET NULL,
  raw_text TEXT NOT NULL,
  parser TEXT NOT NULL CHECK (parser IN ('deterministic', 'ai', 'failed')),
  parsed_query_json TEXT,                 -- structured query when parsing succeeded
  answer TEXT,                            -- resulting answer, when evaluated
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_question_parse_logs_parser ON question_parse_logs (parser);

CREATE TABLE correction_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES game_sessions (id) ON DELETE SET NULL,
  pokemon_id INTEGER REFERENCES pokemon (id),
  category TEXT NOT NULL CHECK (
    category IN ('accidental-answer', 'unclear-question', 'inaccurate-data',
                 'missing-pokemon', 'other')
  ),
  detail TEXT,
  context_json TEXT,                      -- e.g. contradictory answers shown to player
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- PokéAPI synchronization bookkeeping.
-- ---------------------------------------------------------------------------
CREATE TABLE import_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,                   -- 'pokeapi' | 'pokeapi-github-mirror'
  source_version TEXT,                    -- e.g. api-data commit sha, when known
  range_start INTEGER,
  range_end INTEGER,
  record_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'complete', 'failed')),
  error TEXT,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at TEXT
);
