# 01 — Core Loop & Progression

**Status:** Normative

---

## 1. The run loop

```txt
START RUN
    ↓
Receive starter spell functions
    ↓
Starter functions are bound to controls
    ↓
Enter combat room
    ↓
Fight manually
    ↓
Enemies / chests / events drop language fragments
    ↓
Collect fragments into the Code Inventory
    ↓
Open the Spell Matrix between encounters
    ↓
Drag fragments into editable function sockets
    ↓
Optionally alter key / mouse bindings
    ↓
Test altered controls in the Test Chamber
    ↓
Continue deeper
    ↓
Gain increasingly expressive language
    ↓
Potentially unlock custom function creation
    ↓
Build increasingly strange spell / control architecture
    ↓
Boss
    ↓
Run ends
```

The felt rhythm is:

```txt
BUILD → FIGHT → LOOT → REWRITE → FIGHT → LOOT → REWRITE → BOSS
```

## 2. Where editing happens

**Default: no unrestricted editing during active combat.** Between rooms, editing is
unrestricted. During combat, the player uses the build they committed to.

This is what keeps the game an action roguelite rather than a pause-menu programming game
every five seconds. A rare relic may later grant limited hot-swap or in-combat patching; that
is an exception the player earns, not the baseline.

After any edit, the player can enter the **Test Chamber** — a tiny safe simulation with a
target dummy, a movement marker, a projectile emitter and a reset button — to verify weird
bindings before walking into danger. See [doc 05 §8](05-spell-matrix-ux.md#8-test-chamber).

## 3. The first loot lesson

This is the tutorial moment that teaches the entire game, and it must happen within the first
two minutes.

The player defeats an enemy and receives:

```txt
8
```

The `8` enters the Code Inventory as a physical token. The player opens `slash()`:

```txt
if enemy range() <= [3]
    deal [1] to [2] damage
```

They drag the `8` over the existing `2`.

**Before**

```txt
deal 1 to 2 damage
```

**After**

```txt
deal 1 to 8 damage
```

That single interaction communicates the premise: **loot is language, and language changes
spells.**

### 3.1 Replacement must have consequences

Changing a number is never a free stat increase. Raising slash range from `3` to `8` may:

- increase mana cost,
- increase windup,
- increase cooldown,
- narrow the slash arc,
- increase function memory,
- require a stronger spell core.

The player is manipulating code, not bypassing balance. Cost curves are specified in
[doc 06 §6](06-runtime-and-execution.md#6-mana-derived-spell-cost) and the preview UI that
makes them legible in [doc 05 §5](05-spell-matrix-ux.md#5-beforeafter-preview).

### 3.2 The same token, two builds

`8` used on **damage max**:

```txt
if enemy range() <= 3
    deal 1 to 8 damage
```

`8` used on **range**:

```txt
if enemy range() <= 8
    deal 1 to 2 damage
```

One token, two entirely different weapons. This is why numbers are inventory and not stat
upgrades.

## 4. The seven stages of authorship

Progression is measured in **degrees of authorship**, not power level. A run advances the
player up this ladder; the ladder resets each run, but how far up it reaches varies wildly.

| Stage | Name                      | Capability                                        | Example                               |
| ----- | ------------------------- | ------------------------------------------------- | ------------------------------------- |
| 1     | **Numeric tinkering**     | Change values in sockets                          | `2` → `8`                             |
| 2     | **Token substitution**    | Replace compatible words / references / operators | `enemy` → `mouse`, `<=` → `<`         |
| 3     | **Expression editing**    | Rearrange and combine tokens inside an expression | `enemy range() + 2`                   |
| 4     | **Statement editing**     | Insert / remove whole actions or conditions       | add a second statement to `slash()`   |
| 5     | **Function editing**      | Restructure an existing function                  | wrap a body in `if`, add an `else`    |
| 6     | **Function creation**     | Author an entirely new function from a blank core | `rush(): dash toward mouse / slash()` |
| 7     | **Advanced control flow** | Rare structural syntax                            | `while`, `repeat`, `break`            |

Stages 1–2 are guaranteed within the first few rooms. Stage 6 is a genuine milestone. Stage 7
is a story a player tells afterwards.

Each stage is gated by a combination of **vocabulary** (do you own the token?) and
**permission** (is this function editable at that depth?). Permissions are themselves loot —
see [doc 04 §4](04-functions-and-editing.md#4-edit-permissions-as-loot).

## 5. Starter vocabulary

The starting run is intentionally tiny:

- functional starter spells,
- very limited loose vocabulary,
- perhaps one or two editable numeric sockets.

The first few rooms expand options rapidly. Starting rich would destroy the arc.

### 5.1 Starter functions

```txt
slash()
spark()
```

plus **movement firmware** (see [doc 09 §2](09-inputs-bindings-accessibility.md#2-firmware)).

### 5.2 Starter bindings

```txt
W     → move up
A     → move left
S     → move down
D     → move right
SPACE → slash()
LMB   → spark()
```

Movement is presented as a single `move` firmware routine with a direction socket, **not** as
four separate `step_up()` / `step_left()` functions. The unified form is what makes the
cursor-movement aha moment possible with two tokens instead of four rewrites.

## 6. Embedded tokens vs owned tokens

**Critical rule.** Starter functions contain tokens the player does not own as loose
inventory. `slash()` contains `if`, `enemy`, `range`, `<=`, `1`, `2` and `3` from the first
second of the game. The player owns **none** of them.

Without this rule, a new player would need half the language just to possess a functioning
spell.

The distinction:

| Concept            | Meaning                                                                               |
| ------------------ | ------------------------------------------------------------------------------------- |
| **Embedded token** | Present inside a function's definition. Executes fine. Cannot be reused elsewhere.    |
| **Owned token**    | In the Code Inventory. Can be placed into any compatible socket, any number of times. |

**Decompiling** is the bridge: a late-game mechanic that extracts an embedded token into
general vocabulary. See [doc 04 §6](04-functions-and-editing.md#6-decompiling).

Ownership validation is formalised in
[doc 02 §8](02-language-specification.md#8-validation-pipeline).

## 7. Ownership model

**Collecting a token means the robot wizard has learned that piece of language for the
remainder of the run.** The inventory tile represents knowledge, not a consumable.

Therefore:

- Tokens are **not consumed** when installed.
- Owning one `8` permits `8` in every compatible socket in every function simultaneously,
  subject to memory / mana / cycle costs.
- Duplicate drops convert to Fragments (currency) or reroll charges — see
  [doc 03 §8](03-tokens-and-loot.md#8-duplicates-and-currency).

A "token copies" model (one owned `8` = one installed `8`) was considered and rejected as the
default: it turns the game into inventory bookkeeping and punishes experimentation, which is
the behaviour the whole design is trying to produce. It remains available as a
[challenge modifier](13-meta-progression-and-modes.md#5-challenge-runs).

## 8. Run reset

On death or victory:

| Lost                               | Kept                                    |
| ---------------------------------- | --------------------------------------- |
| All looted language fragments      | Core firmware                           |
| Custom functions authored this run | Codex entries for everything discovered |
| Edit permissions earned this run   | Meta unlocks, achievements, settings    |
| Memory / cycle hardware upgrades   | Starter spell selection unlocked so far |

Narratively: **volatile language memory is lost; core firmware persists; the archive
remembers.**

This is what makes each run linguistically different, and it is the reason the roguelite frame
was chosen at all.

## 9. Meta progression

Permanent progression must **expand possibility space**, not permanently grant the language.

Acceptable permanent unlocks:

- new token families entering the drop pool,
- new starter spells to choose between,
- new robot chassis with different base firmware,
- new bosses, biomes, room types,
- new function templates that can appear as loot,
- new rare syntax entering the pool at all.

**Forbidden.** If the player permanently begins every run already owning
`if · else · while · mouse · enemy · + · - · * · / · 0–9`, the premise collapses. Runs need
constrained language. Meta progression widens the deck; it never stacks it.

Full meta systems are specified in
[doc 13](13-meta-progression-and-modes.md).

## 10. Economy introduction order

Do not introduce every resource at once. Three constraints exist —
`MEMORY` (code size), `CYCLES` (execution amount), `MANA` (magical effect power) — and the
tutorial must never show all three.

| Stage of the campaign | Resources visible           |
| --------------------- | --------------------------- |
| Early                 | Tokens, Mana, Health        |
| Mid                   | \+ Memory                   |
| Late                  | \+ Cycles, edit permissions |

See [doc 06 §4–§6](06-runtime-and-execution.md#4-memory) for their definitions.
