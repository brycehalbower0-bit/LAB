# 11 — GameMaker Architecture

**Status:** Normative for the safety rules ([§5](#5-never-execute-strings)); the rest is
_recommended_ and expected to evolve during prototyping.

---

## 1. Project structure

```txt
objects/
    player/
    enemies/
    managers/
    ui/
    pickups/

scripts/
    language/       token definitions, type system, socket rules
    interpreter/     AST execution, fibers, cycle accounting
    actions/         the action registry and its implementations
    sensors/         reference and property resolution
    rewards/         drop tables, weighting, reward generation
    utilities/

sprites/
    player/  enemies/  ui/  tokens/  effects/

rooms/
    combat/  test/  ui/
```

## 2. Managers

```txt
obj_game              boot, global state, scene transitions
obj_run_manager       seed, room sequence, run state, death/restart
obj_input_manager     logical input slots → bound functions
obj_spell_manager     function definitions, compile, validation
obj_token_inventory   owned tokens, categories, ownership queries
obj_interpreter       execution fibers, cycle budget, action emission
obj_reward_manager    drop tables, contextual weighting, reward screens
obj_room_manager      room population, clear conditions, transitions
obj_save_manager      serialization, versioning, migration
obj_ui_spell_matrix   the editor
```

## 3. Core data structures

### 3.1 Token

```txt
{
    id            : "digit_8",
    text          : "8",
    category      : TOKEN_DIGIT,
    value_type    : VALUE_NUMBER,
    rarity        : RARITY_UNCOMMON,
    sockets       : [ SOCKET_NUMBER ],
    drop_weight   : 40,
}
```

### 3.2 AST node

```txt
{
    node_type : NODE_LITERAL,
    value     : 8,
    children  : [],
    embedded  : false,
}
```

```txt
{
    node_type   : NODE_CALL,
    function_id : "slash",
    args        : [],
}
```

```txt
{
    node_type : NODE_ACTION,
    action_id : ACTION_DEAL_DAMAGE,
    operands  : [ <literal 1>, <literal 8>, <element physical> ],
    socket_ids: [ "damage_min", "damage_max", "element" ],
}
```

Nodes are GML structs. Children are arrays of structs. Nothing is a string that later gets
looked up by name.

## 4. Language scripts

```txt
token_create(def)
token_is_compatible(token, socket)
token_is_owned(token_id)

ast_create_node(type, params)
ast_validate(root, context)          → { ok, error_code, error_node, message }
ast_calculate_memory(root)           → int
ast_calculate_cycles(root)           → int
ast_serialize(root)                  → JSON-safe struct
ast_deserialize(data, language_version) → root

spell_compile(function_id)           → { ok, diagnostics }
spell_execute(function_id, context)  → fiber handle
spell_get_cost(function_id)          → { mana, cycles, memory, windup, cooldown }
```

## 5. Never execute strings

**This is the one absolute rule in this document.**

The interpreter walks validated AST nodes and dispatches on **enum ids** via explicit switch
statements. It never calls a script by string name, never uses `asset_get_index` on
player-influenced data, and never evaluates anything.

```txt
switch (node.action_id)
{
    case ACTION_MOVE:
        ...
    case ACTION_DEAL_DAMAGE:
        ...
    case ACTION_BLINK:
        ...
    default:
        // unknown action id — refuse, log, do not guess
        return EXEC_ERROR_UNKNOWN_ACTION;
}
```

Rationale beyond safety: an explicit registry means an unknown id from a corrupted or
out-of-date save is a clean, diagnosable failure rather than an arbitrary crash, and it means
the set of things the language can do is enumerable and auditable at any time.

The same rule applies to references, properties, operators and structures — every registry in
[doc 02 §6](02-language-specification.md#6-registries).

### 5.1 Custom function names

Player-authored names never enter code paths. The engine generates `custom_func_001` internally;
the display name is a string field hanging off that record. There is no parser and therefore no
parser risk.

## 6. Data-driven content

Token and function definitions must be data-driven enough that **adding a new digit or operator
requires no editor-logic changes**. If adding `%` means touching the drag-and-drop code, the
architecture is wrong.

### 6.1 Staging

**Prototype token definitions directly in GML structs first.** Move to external JSON only once
the schema stabilises. Building a content pipeline before knowing what content looks like is the
classic way to spend a month on nothing.

Once stable:

```txt
tokens.json · functions.json · enemies.json · rewards.json · relics.json
```

GameMaker parses JSON into structs at boot. Seed content for the first two lives in
[`data/`](../data/README.md).

### 6.2 Enums stay in code

Semantic types, node kinds, action ids, reference ids and operator ids are **code-level enums**.
Data files reference them by name and are validated at load. Data adds content; it never adds
capabilities.

## 7. Mouse world position

One canonical function, used by every `mouse` reference:

```txt
mouse_world_position()   → { x, y }
```

It accounts for camera transform, view scaling and window scaling. No object computes this for
itself. See [doc 06 §9](06-runtime-and-execution.md#9-mouse-world-position) for why this is
load-bearing.

## 8. Serialization

### 8.1 What is saved

**Permanent save:**

```txt
settings · discovered-token codex · meta unlocks · achievements · saved templates
```

**Run save:**

```txt
owned tokens · function definitions (ASTs) · bindings · room position
health · mana · currency · seed · edit permissions · hardware upgrades
```

### 8.2 Rules

- ASTs serialize to JSON-safe structs, arrays and primitives. **Never save executable code.**
- Every save carries `save_version` and `language_version`.
- Loading a save with an older `language_version` runs a migration. If migration is impossible,
  the run is retired with an explicit message — never silently reinterpreted into different
  behaviour.
- Round-trip test: `ast_deserialize(ast_serialize(x))` must be structurally identical to `x` for
  every function in the content set. This belongs in the automated test suite from the moment
  serialization exists.

## 9. Determinism

Seeded RNG for room generation, reward rolls and enemy composition, enabling daily runs and
reproducible bug reports.

Use **separate RNG streams** for content and combat. Content rolls must not be perturbed by how
the player fights, or a bug report's seed will not reproduce, and daily runs will not be
comparable between players.

## 10. Testing

GameMaker's testing story is weak, so put the testable parts where they can be tested:

- **Pure logic first.** Validation, memory/cycle/mana calculation, serialization round-trips and
  type compatibility are pure functions of data. Drive them from a headless test room with
  fixture ASTs and assert on results.
- **A fixture corpus.** Keep a set of ASTs covering every node kind, every known-bad case
  (recursion, divide-by-zero, over-memory, over-cap numbers) and every historical bug. Run the
  full validator over it on every build.
- **Stress tests for the interpreter.** Before `while` ships to loot, run it against adversarial
  spells: nested loops, loops calling loops, loops full of cooldown-blocked actions, loops with
  conditions that never change. Assert the hard bounds in
  [doc 06 §7.3](06-runtime-and-execution.md#73-hard-bounds) hold in every case.

## 11. Platform

**Primary: Windows PC.** GameMaker enables later exports; Linux/Steam Deck, macOS and consoles
are possible follow-ons subject to GameMaker's current export support.

The architectural obligations that keep those doors open are: the logical input layer
([doc 09 §6](09-inputs-bindings-accessibility.md#6-the-logical-input-layer)), a pointer
abstraction rather than hard-coded mouse reads, and a socket editor that can be driven
directionally. Everything else can be dealt with later.

## 12. Out of scope

- **Multiplayer.** Programmable functions plus real-time synchronisation is a very large
  problem. Build an excellent single-player game first.
- **Modding.** The content is data-driven, so mods adding tokens, functions, enemies and spell
  actions are plausible — but exposing a _safe_ mod API is post-launch territory, and the "never
  execute strings" rule applies to mod content exactly as it applies to player content.
