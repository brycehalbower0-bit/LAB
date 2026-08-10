# Content Data

Seed content for the language. These files are **design artefacts**, not shipping assets — they
exist so that balance conversations happen against concrete numbers rather than adjectives.

Per [doc 11 §6.1](../docs/11-gamemaker-architecture.md#61-staging), the first implementation
should define this content **directly in GML structs**. Move to external JSON only once the
schema has stopped changing. These files are the schema's target shape, ready when that happens.

| File                               | Contents                               |
| ---------------------------------- | -------------------------------------- |
| [`tokens.json`](tokens.json)       | The lootable token catalog             |
| [`functions.json`](functions.json) | Starter and template spell definitions |

Planned later: `enemies.json`, `rewards.json`, `relics.json`.

---

## Rule: data adds content, never capabilities

Semantic types, node kinds, action ids, reference ids and operator ids are **code-level enums**.
Data files reference them by name and are validated at load. A JSON file can add a new token that
uses `ACTION_BLINK`; it can never add a new action. This is what keeps
[the never-execute-strings rule](../docs/11-gamemaker-architecture.md#5-never-execute-strings)
true even under modding.

---

## `tokens.json`

```txt
id              stable internal identifier
text            what the player sees
category        DIGIT | WORD | REFERENCE | OPERATOR | STRUCTURE | PUNCTUATION | FUNCTION | SPECIAL
semantic_type   the value kind this token produces (doc 02 §3)
rarity          COMMON | UNCOMMON | RARE | ARCANE | MYTHIC
sockets         socket types that will light up when this token is dragged
drop_weight     relative weight WITHIN its rarity band — never across bands
status          starter | planned | post_mvp
description     gameplay text; must be true (doc 02 §11)
flavor          optional lore line; never the only text
requires        optional token id that must be owned for this one to be useful
pairs_with      optional token id that must enter the drop pool at the same time
drop_sources    optional restriction on which pools can yield this token
```

### Reading the rarity assignments

Rarity reflects **expressive power**, not numeric magnitude
([doc 03 §4](../docs/03-tokens-and-loot.md#4-rarity-philosophy)). Some assignments that look
surprising and are deliberate:

- **`0` is UNCOMMON, not COMMON.** Zero delay, zero range and zero mana modifiers are powerful
  and occasionally dangerous.
- **`enemy` is RARE while `player` is COMMON.** Self-reference is convenient; hostile-targeting
  reference is the basis of every reactive condition in the game.
- **`mouse` is only UNCOMMON.** It must be reachable in most runs, because the
  [cursor-movement moment](../docs/00-vision-and-pillars.md#61-the-four-aha-moments-in-order) is
  the game's best experience and gating it behind a rare roll would waste it. `toward` is its
  partner and is weighted similarly.
- **`not` is ARCANE despite being one glyph.** It doubles what every condition the player already
  owns can express.
- **`nearest` and `farthest` ship together** (`pairs_with`). `nearest` alone would be a drop that
  restates the default behaviour — a bad reward.
- **`repeat` is RARE, `while` is MYTHIC.** Bounded repetition is predictable and balanceable;
  unbounded repetition changes what the run can express.
- **`while` has `drop_weight: 100`** because it is weighted within the mythic band, which is
  itself rolled at roughly 0.5% or lower from elite, boss, chest and secret pools only. The
  target is that a regular player **remembers** the run where it dropped.

### Known imbalance: the RARE band is overpopulated

Current distribution is roughly `17 COMMON · 15 UNCOMMON · 41 RARE · 11 ARCANE · 2 MYTHIC`.
Forty-one tokens sharing one band means any _specific_ rare token is very unlikely in any given
run, which is fine for flavour tokens and bad for the ones a build depends on — `enemy`, `if` and
`<=` in particular.

This is a tuning input, not a schema problem, and it should be resolved during
[Phase 8](../roadmap/README.md#phase-8--roguelite-rewards) by some combination of:

- splitting RARE into two bands,
- promoting the load-bearing tokens (`enemy`, `if`, `<=`) toward UNCOMMON,
- or leaning harder on [contextual weighting](../docs/03-tokens-and-loot.md#72-weighted-contextual-randomness),
  which already exists to solve exactly this.

Do not solve it by making the band smaller through deletion. The breadth is the point; the
distribution is the bug.

---

## `functions.json`

```txt
id               stable internal identifier
display_name     player-facing name
status           starter | firmware | planned
base_mana        the action's floor cost before socket curves
windup_frames    frames before the effect resolves
cooldown_frames  frames before the action can fire again — loops cannot bypass this
memory           computed memory cost of the default body (doc 06 §4)
sockets          typed holes; see below
cost_curves      per-socket arrays mapping value → additional mana (doc 06 §6)
body             the AST
```

### Socket shape

```txt
id           socket identifier, referenced by nodes in the body
accepts      semantic type this socket will take
field        semantic field for a NUMBER socket: range | damage | count | distance | duration | angle
default      the firmware value
min / max    clamp, in addition to the global field caps (doc 02 §9)
edit_level   permission tier required to touch it (doc 04 §4)
label        player-facing name, used in the reward preview
```

### AST node shapes

```json
{ "node": "IF", "condition": {}, "then": [], "else": null }
{ "node": "WHILE", "condition": {}, "body": [] }
{ "node": "REPEAT", "count": {}, "body": [] }
{ "node": "CALL", "function_id": "slash" }
{ "node": "ACTION", "action": "ACTION_DEAL_DAMAGE", "operands": [] }
{ "node": "LITERAL", "value": 8, "socket": "damage_max" }
{ "node": "REFERENCE", "reference": "REF_ENEMY" }
{ "node": "QUERY", "reference": "REF_ENEMY", "property": "PROP_RANGE" }
{ "node": "BINARY_OP", "op": "OP_LTE", "left": {}, "right": {} }
{ "node": "DIRECTION", "kind": "TOWARD", "target": {} }
{ "node": "DIRECTION", "kind": "FIXED", "value": "up" }
{ "node": "EMPTY", "socket": "body_statement" }
```

A node carrying a `socket` field is the thing currently occupying that socket. `EMPTY` is a
**valid saved state** — a function with empty sockets displays, saves and compiles with a
warning, because players routinely open a slot before they own anything to fill it with.

### Worked cost example

`slash()` with its firmware values, against the curves in the file:

```txt
base_mana 2  +  range_threshold[3] = 0  +  damage_max[2] = 0   →   2 mana
```

Drop an `8` on `damage_max`:

```txt
base_mana 2  +  range_threshold[3] = 0  +  damage_max[8] = 4   →   6 mana
```

Which is the `MANA 2 → 6` shown in the editor preview
([doc 05 §5](../docs/05-spell-matrix-ux.md#5-beforeafter-preview)). Put the same `8` on
`range_threshold` instead:

```txt
base_mana 2  +  range_threshold[8] = 3  +  damage_max[2] = 0   →   5 mana
```

One token, two builds, two different costs. That is the whole game in three lines of arithmetic.

Curve arrays are indexed by value, so `cost_curves.damage_max[8]` is the mana added when the
ceiling is 8. Values beyond the array's length clamp to its last entry, and are additionally
subject to the global field caps.
