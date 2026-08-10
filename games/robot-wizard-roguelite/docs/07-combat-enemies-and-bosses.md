# 07 — Combat, Enemies & Bosses

**Status:** Normative for principles; rosters are _exploratory_ until the vertical slice.

---

## 1. Combat feel

Combat must be fast, readable, responsive, dodgeable, skill-based, and **compatible with weird
controls**.

That last one is the hard constraint and it is unusual. A player may arrive at a boss with W
bound to a cursor-chase, S bound to a retreat, and Space bound to a conditional. The encounter
must be beatable with that, and with conventional WASD, and with something nobody predicted.
This rules out:

- attacks that require precise 8-directional inputs,
- mechanics that assume a dash exists,
- anything that assumes movement is grid- or direction-based.

The player should have time to **appreciate their code** without combat becoming a slow puzzle.

## 2. Perspective: top-down 2D

Chosen because:

- mouse world position is intuitive and meaningful,
- pixel art is manageable at this scope,
- GameMaker excels at it,
- projectiles are readable,
- direction and distance have obvious visual meaning — which matters enormously when `range()`
  is a number the player edits,
- cursor-relative movement is legible,
- programmable movement is easy to perceive.

### 2.1 Camera

Modest follow smoothing. Enough visible space around the wizard to see where the cursor is
pointing. No aggressive zoom. Cursor-based movement requires visible surrounding space, so the
camera errs toward showing more.

### 2.2 Arena size

Large enough that range values matter, cursor movement matters, dashes have room, and
projectiles are readable. Small enough that walking is never tedious. Tune against the
`range 3 → 8` decision specifically: if 8 range trivialises every arena, arenas are too small.

## 3. Room structure

Room-based combat. Advantages: controlled testing, clean reward moments, clear edit windows,
easy procedural sequencing, manageable GameMaker scope.

Editing happens between rooms
([doc 01 §2](01-core-loop-and-progression.md#2-where-editing-happens)).

## 4. Enemy design principle

> **Enemies should challenge control architectures, not just DPS.**

Every enemy should make some language fragment more attractive. An enemy that is only a
health bar teaches the player nothing about their own code. When designing an enemy, name the
token it sells.

## 5. Enemy roster

| Enemy               | Behaviour                                      | Language it sells                                                         |
| ------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| **Chaser**          | Moves directly toward the player               | slash range edits, retreat movement, `away`, close-range conditions       |
| **Turret**          | Stationary, ranged                             | `dash`, cursor positioning, `projectile`, movement rewrites               |
| **Charger**         | Telegraphed high-speed attack                  | responsive dodge bindings, `range` conditions, directional movement       |
| **Swarm**           | Many weak enemies                              | repeated attacks, area effects, higher range, eventually `repeat`/`while` |
| **Shield Enemy**    | Vulnerable only from certain angles or windows | movement experimentation, cursor positioning, conditional attacks         |
| **Syntax Thief**    | Temporarily locks one loose token              | redundancy, fallback bindings                                             |
| **Compiler Jammer** | Creates a zone of reduced cycle budget         | simple fallback controls, composition discipline                          |

### 5.1 Syntax Thief — handle with care

Temporarily locking a token is a strong idea and a dangerous one. Rules:

- **Telegraph it extremely clearly.** The player must see which token is at risk, before it
  happens.
- **Never permanently delete player language.** Locked, not destroyed. Returns on room clear or
  on killing the thief.
- Never lock a token the player is currently depending on for movement or their only attack.

If playtesters describe this enemy as "unfair" rather than "tense", cut it. There is no version
of this game where the player feeling robbed of their vocabulary is good.

### 5.2 Compiler Jammer

Reduces cycle budget in a zone. This makes **simple fallback controls valuable**, which is the
only enemy in the roster that directly rewards not over-engineering. That makes it worth
keeping even though it is fiddly.

## 6. Boss philosophy

Bosses test the player's **constructed language**, not their reflexes alone. A boss can apply
pressure to:

- movement,
- targeting,
- range,
- conditional logic,
- cycle limits,
- fallback controls.

A good boss makes the player go back to the Spell Matrix. A great boss makes them realise which
token they should have picked three rooms ago.

## 7. Boss roster

### 7.1 The Firewall — Biome 1, first boss

Massive armoured arcane machine.

- Projectile walls sweeping the arena.
- Close-range punish.
- Alternating vulnerable zones.

**Tests:** movement control, mouse-aware positioning, attack range, dash use.

This is the boss the vertical slice is built around, and it is designed so that a player with
_only_ starter firmware and a couple of digit edits can beat it with good play. See
[doc 12 §1](12-balance-and-design-rules.md#1-no-required-mythics).

### 7.2 The Garbage Collector — later biome

Periodically marks one temporary modification for deletion unless the player completes a
mechanic. Thematically excellent; carries real risk of feeling like theft. Same caution applies
as to the Syntax Thief: the marked thing must be visible, the counter-mechanic must be fair, and
the loss must be recoverable.

### 7.3 The Watchdog — later biome

Punishes repeated identical inputs, forcing the player to use multiple bindings. Directly
attacks the "one god button" failure mode
([doc 12 §6](12-balance-and-design-rules.md#6-failure-signs)).

### 7.4 Deadlock — later biome

Paired hazards requiring alternating movement and attack decisions. Interacts strongly with
conditional functions — a well-built `if/else` on one button is a genuine answer to it.

## 8. Player stats

Keep traditional stats minimal. Power comes from language.

```txt
Health
Mana
Move Speed
Memory
Cycles
```

### 8.1 Mana regeneration

Candidate sources — prototype to find the right combat rhythm:

- over time,
- on enemy kill,
- through basic attacks,
- through specific functions.

The choice materially changes how expensive a spell can be before it stops being fun, so settle
it before tuning any cost curve.

### 8.2 Stat loot

Avoid filling rewards with `+5% damage` / `+3% crit`. Some hardware upgrades are fine — memory,
cycles, health, mana capacity — but **language must dominate the reward stream**. If a player
can describe their build without mentioning a single token, the reward table is broken.

Health upgrades exist as occasional survival rewards and must **compete with** exciting
language, never be bundled alongside it as a free extra.
