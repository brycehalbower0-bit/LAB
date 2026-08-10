# 03 — Tokens & Loot

**Status:** Normative. Rarity assignments and drop weights are _tunable_ and expected to move
during balance; the model around them is not.

---

## 1. Tokens are items

Every piece of the language is an item with a definition:

```txt
id                     stable internal identifier
display_text           what the player sees: "8", "mouse", "<="
token_type             DIGIT | WORD | REFERENCE | OPERATOR | STRUCTURE |
                       PUNCTUATION | FUNCTION | SPECIAL
semantic_type          NUMBER | ENTITY | POSITION | DIRECTION | BOOLEAN | ELEMENT | ACTION | …
rarity                 COMMON | UNCOMMON | RARE | ARCANE | MYTHIC
allowed_socket_types   which sockets will light up
drop_weight            relative weight within its rarity band
unlock_requirements    meta-unlocks or biome gates that put it in the pool at all
stack_behavior         KNOWLEDGE (default) | CHARGE (consumed)
description            gameplay text — must be true (doc 02 §11)
flavor                 optional lore line
```

Two examples:

```txt
Token:
    id: "digit_8"
    text: "8"
    type: DIGIT
    semantic_type: NUMBER
    rarity: UNCOMMON
```

```txt
Token:
    id: "struct_while"
    text: "while"
    type: STRUCTURE
    semantic_type: CONTROL_FLOW
    rarity: MYTHIC
```

The shipping catalog lives in [`data/tokens.json`](../data/tokens.json).

## 2. The Code Inventory

Collected fragments live in a categorised pouch:

```txt
DIGITS
[ 2 ] [ 5 ] [ 8 ]

WORDS
[ move ] [ toward ] [ damage ] [ range ]

REFERENCES
[ enemy ] [ mouse ]

OPERATORS
[ + ] [ <= ]

STRUCTURE
[ if ]

FUNCTIONS
[ slash() ] [ blink() ]
```

Sorting: `ALL · DIGITS · WORDS · REFERENCES · OPERATORS · STRUCTURE · PUNCTUATION · FUNCTIONS`.
Search becomes necessary once vocabulary passes roughly 25 tokens; ship it before the vertical
slice.

**Do not cap inventory size early.** Collecting language should feel unambiguously good. The
inventory is organisational, not a constraint. Constraint lives in memory and cycles, on the
function side.

## 3. The ownership rule

> **The player cannot use language they do not possess.**

The player has a keyboard in real life. That does not mean the robot wizard knows every word.
No `mouse` token, no `mouse` in code. No `8`, no changing a value to `8`. The editor is
constrained by inventory, not by the player's typing ability. This is why the early editor is
drag-and-drop and never a text box — see
[doc 05 §2](05-spell-matrix-ux.md#2-drag-and-drop-first).

Formal rules in [doc 02 §8.1](02-language-specification.md#81-ownership-validation).

## 4. Rarity philosophy

Rarity reflects **expressive power**, not numeric magnitude. The ranking inputs are:

1. expressive power — how many new sentences does this make sayable?
2. flexibility — how many different sockets accept it?
3. synergy potential — how much does it multiply tokens the player already has?
4. numerical impact,
5. ease of exploitation.

`8` is not rarer than `2` because it is bigger. It is slightly rarer because high digits push
more sockets toward their interesting range. `while` is mythic because it changes what kinds of
sentences exist, not because it deals more damage.

### 4.1 Tiers

```txt
COMMON · UNCOMMON · RARE · ARCANE · MYTHIC
```

| Tier         | Character                                                       | Examples                                                                 |
| ------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **COMMON**   | Fills sockets you already have                                  | `1` `2` `3` `4` `5`, `move`, `damage`, `range`                           |
| **UNCOMMON** | Changes the value of a socket meaningfully, or adds a direction | `6`–`9`, `mouse`, `toward`, `away`, `+`, `-`                             |
| **RARE**     | Adds a new kind of sentence                                     | `enemy`, `else`, `<=`, `>=`, `*`, `/`, `held`, `position`, `repeat`      |
| **ARCANE**   | Multiplies everything already owned                             | `and`, `or`, `not`, `random`, Blank Function Core, Decompiler, Open Port |
| **MYTHIC**   | Changes what the run can express at all                         | `while`, and later `break`, `return`                                     |

### 4.2 Rarity is not power

An `8` may be worth more than a rare operator in a given run. `mouse` may transform a build.
`<=` may unlock a condition the player has been trying to build for three rooms. The reward
screen should make contextual value legible ([§10](#10-reward-preview)) rather than pretending
rarity is a power ladder.

**A clever low-rarity combination should sometimes outperform a pile of rare tokens.** That is
the entire point of a compositional system.

## 5. Number construction

Single digits are the base case. Two later unlocks deepen the digit economy:

| Unlock             | Grants                                       | Example             | Rarity   |
| ------------------ | -------------------------------------------- | ------------------- | -------- |
| **Number Joining** | Adjacent owned digits combine into one value | `2` `8` → `28`      | RARE     |
| `.` (decimal)      | Fractional values                            | `2` `.` `8` → `2.8` | ARCANE   |
| `-` (negation)     | Negative values, plus arithmetic subtraction | `move x -2`         | UNCOMMON |

Number Joining converts a shallow digit inventory into a deep one and should not exist at the
start of a run — early digits must matter individually first. Decimal is arcane because
precision expands every numeric socket's usable space at once.

## 6. Drop sources

| Source          | Typical yield                                                              |
| --------------- | -------------------------------------------------------------------------- |
| Normal enemies  | Digits, common words, Fragments, minor memory                              |
| Elites          | Operators, references, structural syntax, edit permissions                 |
| Chests          | Anything; wider rarity spread than enemies                                 |
| Rune shrines    | Guaranteed category, random member                                         |
| Shops           | Player-chosen, priced by rarity                                            |
| Bosses          | Blank Function Core, a powerful function, major syntax, hardware expansion |
| Events          | Trades, gambles, sacrifice-for-syntax                                      |
| Secret rooms    | Punctuation, rare digits, Decompiler, elevated mythic chance               |
| Challenge rooms | Guaranteed rarity band, at a cost                                          |

## 7. Reward generation

### 7.1 Choice, not grants

After important rooms, present **three** language rewards:

```txt
[ 8 ]        [ toward ]        [ <= ]
```

The player immediately starts thinking about where each one could go. This is categorically
more interesting than `+10% damage / +10% speed / +10% health`, and it is the reason the game
avoids percentage upgrades almost entirely.

### 7.2 Weighted contextual randomness

Pure randomness produces runs where nothing combines. Guaranteed synergy produces runs that
feel authored. The generator therefore fills three slots from different intents:

| Slot | Intent       | Rule                                                                            |
| ---- | ------------ | ------------------------------------------------------------------------------- |
| 1    | **Synergy**  | Weighted toward tokens that unlock a socket the player's current code could use |
| 2    | **Novelty**  | Weighted toward categories the player is thin on                                |
| 3    | **Wildcard** | Straight weighted roll from the biome's pool                                    |

Owning `mouse` raises the weight of `toward`, `position`, `away`, `range`. It never guarantees
them. Discovery must stay real: if the generator always completes the combo, the player is
being handed a build rather than finding one.

### 7.3 Rerolls

Limited rerolls of shop and reward offers. Rerolls prevent dead runs without making runs
deterministic. Charges are themselves loot, and are scarce.

## 8. Duplicates and currency

Ownership is knowledge-based ([doc 01 §7](01-core-loop-and-progression.md#7-ownership-model)),
so duplicates are not stock. A duplicate drop converts to:

- **Fragments** (currency), or
- a reroll charge, or
- memory dust toward a Compiler Forge upgrade.

Working currency name: **Fragments**. Alternatives considered: Bits, Shards, Cores, Sigils,
Bytes.

## 9. The `while` drop

`while` is the run-defining mythic drop and its presentation is a designed set piece.

- **Base chance: ~0.5% or lower**, from elite / boss / chest pools only. This number is a
  starting point for playtesting, not a balance decision.
- The real target: **a regular player should remember the run where `while` dropped.** If
  players see it often, it stops being a story.
- **No pity system** for mythic syntax in normal runs. Rare language stays rare. Guaranteed
  mythic syntax belongs in sandbox and challenge modes
  ([doc 13 §5](13-meta-progression-and-modes.md#5-challenge-runs)), where it cannot dilute the
  normal-run experience.

### 9.1 Drop presentation

1. Combat pauses for ~0.3 s.
2. A distinctive deep chime.
3. An ornate rune spins into place.
4. `WHILE` resolves, with a mythic border.
5. The player picks it up.

Exciting, ~2 seconds, not obnoxious, and **readable on a stream at 720p** — a viewer should
know what dropped without the streamer saying it. See
[doc 14 §5](14-marketing-and-community.md#5-streaming).

## 10. Reward preview

Hovering a token highlights every place it could go **in the player's actual current code**:

```txt
8
DIGIT

Can replace compatible numeric digits.
May be combined into larger values once Number Joining is available.

Compatible sockets:
  slash()  damage ceiling
  slash()  range
  blink()  distance
```

This is what makes a `2` legible as a strategic object instead of a shrug. It is required
before the vertical slice, not a polish item.

## 11. The dead-drop problem

Some tokens will occasionally have nowhere to go. That is acceptable, and must not be solved by
guaranteeing utility. It is mitigated by:

- reward preview (the player sees the dead end before choosing),
- contextual weighting,
- selling duplicates and unusable tokens for Fragments,
- keeping the token for later — a `while` with nothing to loop is still a `while`,
- the Decompiler, which can supply the missing partner token,
- rerolls.

Do not guarantee immediate utility for every drop. A token that is useless now and decisive
three rooms later is a good token.

## 12. Token tooltips

Tooltips carry gameplay truth first, flavour second, and never only flavour.

```txt
while
MYTHIC CONTROL FLOW

Repeats a block while its condition remains true.
Execution ends when the condition becomes false
or the function exhausts its cycle budget.
```

```txt
8
DIGIT · UNCOMMON

Can replace compatible numeric digits.
May be combined into larger values once Number Joining is available.

"A closed loop stacked upon another.
 The Archive considers it excessive."
```

## 13. Element tokens

Elements are the clearest demonstration of the token model beyond numbers, and are a strong
post-MVP expansion.

Starter damage reads:

```txt
deal 1 to 2 physical damage
```

Find `fire`. Replace `physical`. Slash becomes flaming magic:

```txt
deal 1 to 2 fire damage
```

Element pool: `physical` `fire` `ice` `shock` `void`. Status words (`burn`, `freeze`, `slow`,
`stun`) extend the same axis as action/effect tokens.

This is exactly the interaction the game wants, applied to a non-numeric field, and it scales
the catalog without adding a single new mechanic.
