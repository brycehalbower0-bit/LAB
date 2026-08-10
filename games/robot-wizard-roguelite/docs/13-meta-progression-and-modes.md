# 13 — Meta, Modes & Onboarding

**Status:** Normative for the tutorial; the rest is _recommended_.

---

## 1. Tutorial

**Teach through manipulation, not lectures.** No character explains what a conditional is. The
player drags a rune onto another rune and the world changes.

### Lesson 1 — The rune replaces a number

```txt
SPACE → slash()
```

Fight a weak enemy. Receive:

```txt
8
```

Prompt:

> This rune can replace a number in an editable spell.

Open `slash()`. Drag `8` onto `2`. Done.

This is the entire game in one interaction, and it must land within the first two minutes.

### Lesson 2 — Consequence

```txt
deal 1 to 2 damage   →   deal 1 to 8 damage
```

The mana and cooldown indicators change. The player fights again and feels the difference — both
the bigger hit and the higher cost. Loot is language, and language has a price.

### Lesson 3 — Code changes controls, not just stats

Give `mouse` and the necessary supporting token. The player modifies a movement function to
reference the cursor:

```txt
W → move up        becomes        W → move toward mouse
```

Now they understand the real scope of the mechanic. **This is the lesson that sells the game**;
everything before it could be mistaken for a stat screen.

### Lesson 4 — An operator or condition

Introduce a comparison swap or a condition replacement. Small, concrete, immediately testable.

**Do not teach custom function creation in the first tutorial.** It stays aspirational — the
player should see a Blank Function Core described somewhere long before they hold one.

## 2. First run

The first run's rewards are **partially curated** to guarantee the player experiences, in order:

1. number replacement,
2. word replacement,
3. mouse-aware control,
4. function rebinding,
5. conditional editing.

After that, normal randomness opens. A curated first run is worth the loss of purity: a player
whose first run rolls three operators and no references never sees why the game is interesting.

## 3. Codex

Every discovered token is permanently documented, across runs.

```txt
WHILE

Category: Control Flow
Rarity:   Mythic

Repeats a code block while its condition remains true,
until the function's cycle budget is exhausted.

First discovered:
Run 37
```

Undiscovered tokens may appear as silhouettes, giving completionists a target and making the
scale of the language visible without spoiling it.

The codex is what turns a rare drop into a **permanent trophy**, which is the only permanent
reward for finding `while` that does not violate
[doc 01 §9](01-core-loop-and-progression.md#9-meta-progression).

## 4. Sandbox

Unlocked after sufficient progression. In sandbox:

- all discovered tokens are available,
- functions can be built freely,
- enemies can be spawned,
- code can be tested with the full debug overlay.

Sandbox lets players explore the language's ceiling **without undermining run scarcity**. It is
also where the community's build ideas get authored before anyone gets the loot to try them in a
run — which is good for the game's conversation.

Sandbox designs can be saved as templates. Inside a run, a saved template can only be
instantiated if the required language is owned.

## 5. Challenge runs

| Mode                 | Rule                                                     |
| -------------------- | -------------------------------------------------------- |
| **No Digits**        | Numeric replacements cannot be collected                 |
| **Mouse Only**       | Only mouse-related logical inputs                        |
| **No Conditions**    | Structural conditions disabled                           |
| **Compiler Lottery** | Rare syntax drop rates greatly increased                 |
| **Primitive**        | No custom functions                                      |
| **Single Copy**      | Token-copies ownership model (one owned = one installed) |
| **No Safety Net**    | Emergency Controls disabled                              |

**Compiler Lottery** is the release valve for `while` curiosity: it lets players experiment with
mythic syntax freely without changing its rarity in normal runs. Sandbox does the same job
without the run structure.

## 6. Daily run

Everyone receives the same seed: room sequence, token reward pool, boss order.

The interesting part is not the leaderboard. It is **seeing how differently players use the same
language fragments** — the same three tokens producing five architectures. Daily runs are the
single best format for this game's community, and the seeded RNG requirement in
[doc 11 §9](11-gamemaker-architecture.md#9-determinism) exists largely to enable them.

## 7. The hub

Working name: **The Workshop** (or The Archive). Contains:

- the codex,
- the sandbox,
- starter spell selection,
- cosmetic customisation,
- the challenge terminal.

## 8. Starter spell selection

Meta progression unlocks alternate starter functions:

```txt
slash()   spark()   push()   needle()
```

Each still begins constrained — a different starting sentence, not a stronger one.

## 9. Chassis

Future alternate characters. A chassis changes:

- base firmware,
- mana,
- movement,
- initial editable sockets.

Candidates: **Duelist Unit**, **Artillery Unit**, **Compiler Unit**. Keep the robot-wizard
identity across all of them — they are different wizard robots, not different genres.

## 10. Achievements

Achievements should describe **linguistic accomplishments**, because that is the vocabulary the
game wants players to think in.

| Achievement          | Condition                                          |
| -------------------- | -------------------------------------------------- |
| **First Rewrite**    | Replace your first token                           |
| **Eightfold**        | Use `8` in three different functions               |
| **Author**           | Create a custom function                           |
| **Control Flow**     | Find `while`                                       |
| **Mouse Mage**       | Win with cursor-relative movement                  |
| **Firmware Heretic** | Win after replacing every editable starter binding |
| **Minimalist**       | Win with four or fewer active inputs               |
| **Decompiler**       | Extract an embedded token and use it elsewhere     |
| **Impractical**      | Compile a spell you cannot afford to cast          |

Note that none of them are "deal 500 damage".
