# ROBOT WIZARD PROGRAMMING ROGUELITE

**Working title: not locked.** See [docs/14 — Marketing & Community](docs/14-marketing-and-community.md#31-candidate-titles).

> A pixel-art action roguelite about a robot wizard who loots individual pieces of a
> programming language and uses them to rewrite the spells bound to their keyboard and mouse.

---

## The North Star

Every system in this game exists to serve one sentence:

> **I did not find a stronger spell. I found pieces of language and rewrote my magic into
> something stronger, stranger, or more useful.**

A player should be able to explain a powerful build by describing a programming discovery:

- "I found an `8` and replaced my slash's damage ceiling."
- "I found `mouse` and made W move toward my cursor."
- "I got `else`, so Space became context-sensitive."
- "I somehow rolled `while`, so this run became completely ridiculous."

## What this is

A real-time action roguelite (GameMaker, pixel art, top-down) where the player **directly
plays** the robot wizard. Keyboard and mouse inputs invoke spells. Spells are functions.
During a run, the player loots **literal pieces of the game's language** — digits, words,
operators, references, punctuation, and eventually structural syntax — and drags them into
compatible sockets inside those functions.

The programming language _is_ the build.

## What this is not

Not an idle programming game. Not an autonomous-bot simulator. Not an IDE with enemies
attached. The player never types arbitrary GML. The game never plays itself.

---

## How to read this document set

Documents are **normative** unless marked _exploratory_. Read 00 → 02 first; those two fix
the fantasy and the language kernel that everything else is built on.

| #   | Document                                                                     | Contents                                                                                                                      |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 00  | [Vision & Pillars](docs/00-vision-and-pillars.md)                            | Pitch, north star, core identity, the character, narrative frame, emotional progression, the 30 core rules                    |
| 01  | [Core Loop & Progression](docs/01-core-loop-and-progression.md)              | The run loop, the first loot lesson, the seven stages of authorship, run reset, meta progression                              |
| 02  | [Language Specification](docs/02-language-specification.md)                  | **Normative kernel.** Semantic types, grammar, display syntax, node/action/reference/operator registries, validation pipeline |
| 03  | [Tokens & Loot](docs/03-tokens-and-loot.md)                                  | Token model, ownership rules, rarity philosophy and tiers, the catalog, drop sources, reward generation                       |
| 04  | [Functions & Editing](docs/04-functions-and-editing.md)                      | Functions as spells, sockets, edit permission tiers, decompiling, composition, custom functions                               |
| 05  | [The Spell Matrix](docs/05-spell-matrix-ux.md)                               | The editor: layout, drag-and-drop, previews, compile feedback, errors that teach, undo, test chamber                          |
| 06  | [Runtime & Execution](docs/06-runtime-and-execution.md)                      | AST, interpreter, execution fibers, memory/cycles/mana, `while` semantics, action queue, safety                               |
| 07  | [Combat, Enemies & Bosses](docs/07-combat-enemies-and-bosses.md)             | Combat feel, perspective, the enemy roster and what language each one sells, boss philosophy                                  |
| 08  | [Run Structure & World](docs/08-run-structure-and-world.md)                  | Rooms, run map, room types, shops and currency, the four biomes, narrative arc                                                |
| 09  | [Inputs, Bindings & Accessibility](docs/09-inputs-bindings-accessibility.md) | Physical controls, firmware, binding editing, the logical input layer, controller, accessibility                              |
| 10  | [Art, Audio & Presentation](docs/10-art-audio-and-presentation.md)           | Art direction, pixel scale, resolution strategy, animation set, spell VFX, audio, music                                       |
| 11  | [GameMaker Architecture](docs/11-gamemaker-architecture.md)                  | Project layout, managers, GML data structures, data-driven content, serialization, determinism                                |
| 12  | [Balance & Design Rules](docs/12-balance-and-design-rules.md)                | Balance principles, numeric caps and safety, success metrics, failure signs, scope discipline                                 |
| 13  | [Meta, Modes & Onboarding](docs/13-meta-progression-and-modes.md)            | Tutorial, first run, codex, sandbox, daily runs, challenges, achievements, hub, chassis, relics                               |
| 14  | [Marketing & Community](docs/14-marketing-and-community.md)                  | Marketing hook, trailer beat sheet, store copy, streaming, naming, modding/multiplayer posture                                |
| —   | [Glossary](docs/GLOSSARY.md)                                                 | Binding vocabulary used across all documents and code                                                                         |

### Plan of record

| Document                                    | Contents                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| [Roadmap](roadmap/README.md)                | 20 development phases, MVP definition, vertical slice target, full game target |
| [Prototypes](roadmap/prototypes.md)         | Prototype 0–9 specs, including the go/no-go Immediate Prototype                |
| [Task Checklist](roadmap/task-checklist.md) | The first 150 concrete tasks, in order                                         |
| [Playtest Plan](roadmap/playtest-plan.md)   | What to observe, success metrics, failure signs                                |
| [Content Data](data/README.md)              | `tokens.json` / `functions.json` seed content and their schemas                |

---

## The one interaction that decides the project

Before anything else is built, [Prototype 0](roadmap/prototypes.md#prototype-0--number-replacement)
must exist and must feel good:

```txt
SPACE → slash()

slash():

    if enemy range() <= 3
        deal 1 to 2 damage
```

Kill a dummy. Receive an `8`. Open the Spell Matrix. Drag the `8` onto the `2`.

```txt
    deal 1 to 8 damage
```

Compile. Press Space. Watch the number change.

Then give the player `mouse` and `toward`, and let them turn `W: move up` into
`W: move toward mouse`.

**If those two interactions are compelling, proceed with the rest of the project.**
If they are not, no amount of the rest of this document saves it.

---

## Development north star

Before implementing any feature, ask:

> **Does this give the player a meaningful new piece of language, a meaningful new place to
> use language, or a meaningful new reason to rewrite their controls?**

If not, it is secondary. The game is not about having the largest programming language
possible. It is about making every tiny piece of language feel like treasure.
