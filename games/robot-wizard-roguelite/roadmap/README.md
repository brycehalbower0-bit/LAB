# Roadmap

**Status:** Normative for ordering; estimates are absent on purpose until the go/no-go
prototype is done.

---

## The ordering principle

> **Do not build the mythic language first.**

The first prototype only needs to answer one question:

> Is replacing pieces of a spell and then using the modified control fun?

Everything in this roadmap is sequenced so that the riskiest, cheapest-to-test assumptions are
tested first, and the expensive machinery (`while`, fibers, custom functions) is built only
after the core is proven. See [prototypes.md](prototypes.md) for the go/no-go gate.

## Phases

### Phase 1 — Feel

Make robot wizard movement and combat fun **with no programming at all**.

Movement · camera · cursor · slash · damage · dummy · particles · hit feedback.

If this is not fun on its own, the programming layer will not save it.

### Phase 2 — Editable number

Slash as an AST · damage range sockets · the `8` token · drag/drop replacement · compile ·
observable combat result.

**This is the first real proof.** See
[Prototype 0](prototypes.md#prototype-0--number-replacement).

### Phase 3 — Token inventory

Categories · ownership · drag state · compatibility highlighting · tooltips · undo.

### Phase 4 — Movement language

`move` · direction constants · the `mouse` reference · `toward` · binding editing.

**Prove W → cursor movement.** This is the critical prototype
([Prototype 2](prototypes.md#prototype-2--movement-editing)); if it does not land, the project
premise is wrong.

### Phase 5 — Conditions

`if` node · comparison operators · range queries · branch execution.

### Phase 6 — Multiple spells

`bolt` · `blink` · `shield` · `push`. Each must expose **different** editable values, or the
spell roster is just reskins.

### Phase 7 — Combat content

Chaser · turret · charger · swarm · elite.

### Phase 8 — Roguelite rewards

Room rewards · three-choice token offers · contextual weighting · currency · shop.

### Phase 9 — Spell editing depth

Statement sockets · moving calls · extraction/decompile · function memory.

### Phase 10 — Custom functions

Blank Function Core · function naming · custom function AST creation · binding custom functions ·
function-call nodes · recursion detection.

Ships **before** loops: sequencing alone gives custom functions most of their value
([doc 04 §8.1](../docs/04-functions-and-editing.md#81-sequencing-is-free-power)).

### Phase 11 — Advanced execution

`repeat` · cycle budget · queued actions · execution instances.

`repeat` is where all the scheduling and action-queue bugs get found, in a construct that cannot
loop forever.

### Phase 12 — `while`

Bounded loop · execution state · cycle exhaustion · validation · stress tests · loop debug
highlighting.

Developer-granted at first. Only after it survives adversarial testing does it enter the loot
pool.

### Phase 13 — Boss

Build The Firewall around the mechanics that now exist — not around mechanics you wish existed.

### Phase 14 — Art pass

Robot wizard sprites · enemy sprites · tiles · spell effects · token art · UI art.

### Phase 15 — Audio

Spell SFX · token pickup · compile · error · boss · music.

### Phase 16 — Tutorial

The curated first run.

### Phase 17 — Meta systems

Codex · unlock pools · hub · sandbox.

### Phase 18 — Content expansion

More biomes · functions · enemies · bosses · tokens.

### Phase 19 — Polish

Readability · performance · bugs · save safety · controller · accessibility.

### Phase 20 — Release preparation

Steam integration · achievements · settings · crash testing · localization framework · trailer
assets · demo.

---

## MVP

The minimum viable game supports:

- robot wizard, placeholder pixel-art visuals,
- top-down movement, mouse,
- one attack, one dash,
- 3 enemy types,
- starter functions,
- digit tokens, word tokens, operator tokens,
- drag/drop editing,
- key binding,
- mouse-aware movement,
- simple `if`,
- a 10–15 room run,
- one boss.

**No custom functions** if necessary. **No `while`.**

## Vertical slice

- polished robot wizard,
- one biome,
- 6 enemies,
- one boss,
- ~40 token types,
- ~8 functions,
- the editor, complete with reward preview and Test Chamber,
- reward system,
- shop,
- function editing,
- one rare custom-function opportunity,
- polished audio and UI,
- a 20-minute run.

## Full game target

- 4 biomes,
- 20–30 enemies,
- 4–6 bosses,
- 100+ language fragments,
- 20+ base functions,
- multiple rare structures,
- custom functions,
- daily seeds,
- sandbox,
- codex,
- challenge modes.

**Do not commit to any of these counts** until the vertical slice proves what content the game
actually needs. They are a shape, not a contract.
