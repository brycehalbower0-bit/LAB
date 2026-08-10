# 08 — Run Structure & World

**Status:** Normative for structure; biome content is _exploratory_.

---

## 1. Procedural generation posture

**Do not begin with complex procedural levels.** Start with handcrafted arena chunks selected
and sequenced procedurally. GameMaker implementation is far simpler and combat readability is
much better. Full procedural layout generation, if ever, comes after the vertical slice.

Run content is generated from a **seed** ([doc 06 §10](06-runtime-and-execution.md#10-determinism)).

## 2. Run map

Branching structure with previewed reward categories:

```txt
        Combat
       /      \
Syntax          Shop
   \           /
      Elite
        |
      Boss
```

Room previews show the **reward category**, never the exact token. The player routes toward the
kind of language they need without knowing what they will get:

```txt
123   Numeric
ABC   Word
<>    Operator
{}    Structure
()    Function
⚙     Hardware
```

This is the map's whole job. A player desperately hunting a `7` intentionally routing into a
Number Vault is the routing decision the game wants to produce — and it sounds silly, which is
good.

## 3. Room types

| Room                 | Guarantees                                                                      |
| -------------------- | ------------------------------------------------------------------------------- |
| **Combat**           | Standard fight; standard drops                                                  |
| **Syntax Room**      | A word, operator or structure reward                                            |
| **Number Vault**     | Several digit choices                                                           |
| **Function Library** | A new spell template, a decompile opportunity, a function copy, or a blank core |
| **Compiler Forge**   | Memory upgrades, cycle upgrades, edit-permission upgrades                       |
| **Rune Shop**        | General token purchasing                                                        |
| **Healing Room**     | Recovery — traditional roguelite pacing valve                                   |
| **Elite**            | Hard fight; operators, references, structural syntax, permissions               |
| **Challenge Room**   | Guaranteed rarity band at a cost                                                |
| **Secret Room**      | Punctuation, rare digits, Decompiler, elevated mythic chance                    |
| **Boss**             | Blank Function Core, powerful function, major syntax, hardware                  |

## 4. Shops

### 4.1 Categories

```txt
TOKEN · FUNCTION · MEMORY · CYCLE · HEAL · REROLL · DECOMPILE
```

### 4.2 The Rune Merchant

A strange machine-wizard NPC who sells language.

```txt
[ 7 ]         12 Fragments
[ mouse ]     30 Fragments
[ >= ]        42 Fragments
[ blink() ]   65 Fragments
```

Pricing scales with rarity, and with **contextual value** — a token that fits nothing the
player owns is cheaper. That is a small touch that makes the merchant feel like it is reading
your code, which is thematically perfect.

### 4.3 Currency

Working name: **Fragments**. Sources: enemy drops, duplicate token conversion, selling unwanted
tokens, room clear bonuses.

## 5. Biomes

Four biomes, each introducing a layer of the language.

### 5.1 Biome 1 — The Archive

**Theme:** ancient machine library.

Teaches numbers, basic words, and the act of editing itself. This is where the tutorial lives
and where a new player learns that loot is language.

- **Enemies:** chasers, turrets, simple constructs.
- **Boss:** [The Firewall](07-combat-enemies-and-bosses.md#71-the-firewall--biome-1-first-boss).

### 5.2 Biome 2 — The Foundry

**Theme:** industrial magical forge.

Introduces stronger movement options, operators, meaningful spell costs, and function
expansion. This is where memory becomes visible.

### 5.3 Biome 3 — The Network

**Theme:** connected magical circuitry.

Introduces mouse and input references, entity references, and more conditional logic. The
cursor-movement aha moment is guaranteed to be _possible_ by here if it has not already
happened.

### 5.4 Biome 4 — The Kernel

**Theme:** reality's low-level magical machinery.

Introduces function creation, advanced structure, and the highest mythic syntax chances. Cycles
become visible. This is where authorship lives.

## 6. Narrative arc

The robot wizard begins with mostly immutable firmware. As they descend they gain language,
learn to decompile themselves, rewrite their own control systems, and eventually author new
magic.

**The story mirrors the mechanical progression from user to programmer.** That is the whole
narrative design; nothing else is required, and anything that interrupts experimentation to
deliver plot is working against it.

### 6.1 Death

The robot wizard crashes.

- Magical code spills out.
- The screen briefly shows `RUNTIME ERROR`.
- The body collapses into parts and runes.

Use sparingly so the theme stays charming rather than becoming a meme.

### 6.2 Run reset, narratively

- Volatile language memory is lost.
- Core firmware persists.
- The discovered codex remains.

This explains the roguelite reset in the game's own vocabulary, which is worth more than any
amount of framing story.

## 7. NPCs

Candidates: the Rune Merchant, a retired compiler mage, a broken familiar, an archivist
machine, a rival wizard.

NPCs explain the **world**, not the programming. There are no tutorial lectures about
conditionals delivered by a character. Lore is flavour; the language teaches itself through
sockets, tooltips and errors.
