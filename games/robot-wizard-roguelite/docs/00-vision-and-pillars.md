# 00 — Vision & Pillars

**Status:** Normative

---

## 1. Pitch

> A pixel-art action roguelite about a robot wizard who loots individual pieces of a
> programming language and uses them to rewrite the spells bound to their keyboard and mouse.

## 2. North star

Every major system must reinforce this fantasy:

> **I did not find a stronger spell. I found pieces of language and rewrote my magic into
> something stronger, stranger, or more useful.**

The test for whether the game is working: a player, unprompted, describes their build as a
sequence of **linguistic discoveries** rather than stat increases.

## 3. Core identity

The game **is**:

- a roguelite,
- a real-time action game,
- a programming-expression game,
- a spell-building game,
- an input-remapping game,
- a loot / inventory game,
- a pixel-art robot-wizard fantasy.

The game **is not**:

- an idle programming game,
- an autonomous-bot simulator,
- a traditional IDE with enemies attached,
- a game where the player types arbitrary GML,
- a game where upgrades are mostly "+10% damage",
- a game where every programming keyword is available from the beginning.

## 4. The player character

### 4.1 The robot wizard

A small mechanical wizard. Visual traits:

- mechanical body,
- expressive glowing eyes or visor,
- oversized wizard hat or hood,
- robe/cloak integrated with machinery,
- staff/wand/focus device,
- visible magical circuitry,
- code-rune particles,
- compact, readable pixel-art silhouette.

The silhouette must communicate both halves of the concept instantly: **machine + wizard**.
See [doc 10 §5](10-art-audio-and-presentation.md#5-the-mascot-silhouette) for the mascot
requirements.

### 4.2 Narrative frame

The robot wizard does not cast magic through incantation. Magic is **executable**. Spells are
**functions**. The robot's control architecture maps physical commands to those functions.

The world contains broken fragments of the ancient magical language that governs these
systems. The player recovers those fragments. A fragment may literally be `8`, or `enemy`, or
`<=`, or — extremely rarely — `while`.

These are not abstract skill points. They are pieces of the language.

### 4.3 Personality

Silent, curious, expressive through animation. Error chirps. Hat reactions. Avoid dialogue
that interrupts experimentation. The character reacts to _compilation_ the way another game's
character reacts to a level-up.

## 5. The starting state

The robot wizard begins with `SPACE` bound to `slash()`. The underlying function is:

```txt
slash():

    if enemy range() <= 3
        deal 1 to 2 damage
```

This is already valid code. **The beginner is never asked to write it.** The game hands them a
working spell and marks a few pieces as editable:

```txt
slash():

    if enemy range() <= [3]
        deal [1] to [2] damage
```

Brackets are **sockets** — the positions the player can currently modify. Everything else is
locked firmware for now, and becomes editable as the player earns permission.
See [doc 04 §3](04-functions-and-editing.md#3-edit-states) for the full permission ladder.

## 6. The emotional progression

The whole design is a ladder from **user** to **programmer**. The player should climb it once
per campaign and, in compressed form, once per run.

| Stage               | The player's internal sentence                        |
| ------------------- | ----------------------------------------------------- |
| **Recognition**     | "I understand what this spell does."                  |
| **Modification**    | "I can change that number."                           |
| **Experimentation** | "Can I put `mouse` here?"                             |
| **Discovery**       | "Holy shit, W follows my cursor now."                 |
| **Composition**     | "What if this spell calls `slash()` after `blink()`?" |
| **Authorship**      | "I made this function."                               |
| **Mastery**         | "I know exactly what language pieces I want."         |
| **Chaos**           | "`while` dropped."                                    |

### 6.1 The four aha moments, in order

1. **Number replacement.** Drag `8` onto `2`. Damage changes. Loot is language.
2. **Cursor movement.** `W: move up` becomes `W: move toward mouse`. Holding W now walks the
   wizard toward the cursor. _The game has proven that language changes the meaning of the
   player's hands._ This is the single most important moment in the game.
3. **Authorship.** A Blank Function Core drops. The player writes `panic()` and binds it to
   RMB.
4. **`while`.** A mythic loop drops and the run becomes something the run could not previously
   express.

Moment 2 is the one the marketing is built on. See [doc 14 §1](14-marketing-and-community.md#1-the-hook).

## 7. The ending fantasy

A well-developed run should be able to reach something like:

```txt
panic():

    if enemy range() <= 3
        while enemy range() <= 3
            slash()
    else
        blink toward mouse
```

```txt
SPACE → panic()
```

Every part of that was acquired during the run. Nothing there was a purchased upgrade tier.

## 8. Definition of success

The core system succeeds when playtesters **independently invent useful behaviours that were
never offered as predefined upgrades**. Concretely:

- W follows the cursor; S retreats from it.
- Space attacks near enemies and blinks otherwise.
- Two players use the same `8` — one for range, one for damage — and both are right.
- A player builds a two-spell combo function nobody suggested.
- A player uses `while` in a way the designers did not anticipate but the rules permit.

Failure signs are tracked in [doc 12 §6](12-balance-and-design-rules.md#6-failure-signs).

## 9. The 30 core rules

These are binding. A change to any of them is a change to the game's identity and requires an
explicit amendment to this document.

1. The player is a robot wizard.
2. The game is a real-time action roguelite.
3. It is built in GameMaker.
4. Visual presentation is pixel art.
5. Physical inputs invoke functions/spells.
6. Starter functions already work.
7. The player begins by editing existing functions.
8. Language pieces are loot.
9. Digits are individual loot.
10. Words are individual loot.
11. Operators are individual loot.
12. Structural syntax is loot.
13. Tokens behave like an inventory of learned language.
14. Players drag tokens into compatible code positions.
15. A token such as `8` can replace a digit such as `2`.
16. Numbers are not automatically linear upgrades.
17. Mouse references must be gained before code can use mouse information.
18. A key can eventually be programmed to move toward the mouse.
19. Bindings themselves become editable.
20. Functions can call other functions later.
21. Creating custom functions is late-game progression.
22. `while` is extremely rare late-game syntax.
23. `while` is bounded by execution limits.
24. The language must never execute arbitrary GML.
25. Internally, spells are validated ASTs.
26. Programming should expand direct play, not replace it.
27. Simple builds remain viable.
28. Rare syntax is never required to win.
29. The game should reward experimentation.
30. The best moments are things the player invents themselves.

## 10. The development north star

Before implementing any new feature, ask:

> **Does this give the player a meaningful new piece of language, a meaningful new place to use
> language, or a meaningful new reason to rewrite their controls?**

If the answer is no, the feature is secondary. See
[doc 12 §7](12-balance-and-design-rules.md#7-scope-discipline) for the syntax-admission test
that follows from this.
