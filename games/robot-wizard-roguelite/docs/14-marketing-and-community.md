# 14 — Marketing & Community

**Status:** Exploratory. Nothing here is locked, including the titles.

---

## 1. The hook

The marketing demonstrates **one simple transformation**. No explanation required.

```txt
1.  Space uses slash.
2.  Open the spell.
3.  Drag 8 onto 2.
4.  Slash becomes stronger.
5.  Find mouse.
6.  Reprogram W.
7.  W now follows the cursor.
8.  Find while.
9.  Chaos.
```

Steps 5–7 are the sale. Anyone who watches a key stop meaning "walk up" and start meaning
"chase my cursor" understands the entire game instantly, without a single word of copy.

## 2. Trailer beat sheet

| Time      | Beat                         |
| --------- | ---------------------------- |
| 0:00–0:05 | Robot wizard fighting        |
| 0:05–0:10 | **"YOUR SPELLS ARE CODE."**  |
| 0:10–0:18 | Drag `8` into `slash()`      |
| 0:18–0:25 | Reprogram W toward the mouse |
| 0:25–0:35 | Build a custom function      |
| 0:35–0:40 | **MYTHIC `WHILE` DROP**      |
| 0:40–0:50 | The absurd resulting combat  |

The trailer never explains a programming concept. It shows a drag and then shows a consequence.

## 3. Store description

Core language:

> Every key is a spell slot. Every spell is a function. Every number, word, and operator you
> find can change what your magic does.

**Do not market this as "learn programming."** It is a game about expressive systems. The
education is a side effect ([doc 12 §11](12-balance-and-design-rules.md#11-programming-education-posture)),
and leading with it attracts an audience expecting a course and repels an audience expecting a
roguelite.

### 3.1 Candidate titles

Nothing is locked.

```txt
Syntax Wizard · Rune Runtime · Spellbound.exe · Arcane Runtime · Hexcode
Spell Compiler · Wizardware · RuneLoop · Runtime Mage · Codecaster
Hex//Loop · Arcane Firmware · Compile & Conjure · Kernel Wizard
```

## 4. Naming the language

The in-fiction language needs a name eventually, for tooltips, the codex and lore.

```txt
Rune · Hex · Arc · Sigil · Spellcode · Glyph · Arcanum · Script · Machina
```

Decide after the grammar has settled through playtesting, not before.

## 5. Streaming

The game is highly streamable **if viewers can read the code**. That is a design constraint on
the UI, not a marketing afterthought.

- Optional overlay showing current bindings:

  ```txt
  W      cursor_move()
  SPACE  slash()
  LMB    bolt()
  RMB    panic()
  ```

- Rare loot must be readable at streaming bitrates. When `while` drops, viewers should know
  before the streamer says anything — hence the distinctive rune, border and chime in
  [doc 03 §9.1](03-tokens-and-loot.md#91-drop-presentation).

- Chat should be able to backseat in the game's own vocabulary: "put the 8 on range".

## 6. Community vocabulary

The language inventory creates a natural shared vocabulary. Players will say:

- "I got `mouse` in room 2."
- "I used my `8` on range instead of damage."
- "I found a function core before I had anything useful to put in it."
- "I got `while` and broke the run."

This is excellent for word of mouth, because every one of those sentences is **a story with a
decision in it**, which "+10% crit" never is. The [build card](05-spell-matrix-ux.md#101-build-card)
exists to make those stories postable.

## 7. Emergent build names

The game must **not** define classes like "Mouse Build", "Loop Build" or "Slash Build".

The game supplies pieces. Players discover architectures and name them. Naming them in the game
would collapse the space of things players believe are possible — the moment the UI says "Mouse
Build", cursor movement stops being an invention and becomes a checkbox.

## 8. Build diversity as a marketing asset

Different runs produce visibly different constraints, which is what keeps the game's clips
varied:

| Run | Constraint                                    |
| --- | --------------------------------------------- |
| A   | Many digits, few structural tokens            |
| B   | `mouse` and `toward` early                    |
| C   | Great operators, weak spell functions         |
| D   | Early Blank Function Core, limited vocabulary |
| E   | An absurd `while` drop                        |

Run D is a particularly good story: **authorship with nothing to say.**

## 9. Speedrunning

Categories will likely emerge on their own — any%, no mouse, default firmware, no custom
functions, fixed seed. Do not design for speedrunning initially; just do not make it impossible.
Seeded runs ([doc 11 §9](11-gamemaker-architecture.md#9-determinism)) are all the support it
needs at first.

## 10. Modding and multiplayer posture

- **Modding:** plausible post-launch, because content is data-driven. A safe mod API is real
  work and the "never execute strings" rule
  ([doc 11 §5](11-gamemaker-architecture.md#5-never-execute-strings)) applies to mod content
  exactly as it applies to player content.
- **Multiplayer:** not in initial scope. Programmable functions plus real-time synchronisation
  is a very large problem. Build an excellent single-player game first.
