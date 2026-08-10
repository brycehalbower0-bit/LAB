# 10 — Art, Audio & Presentation

**Status:** Exploratory except where marked. Final palette, scale and font are settled by
prototype, not by document.

---

## 1. Art direction

**Arcane machinery in a ruined magical-industrial world.**

Motifs: brass, dark iron, violet and blue magical energy, stone ruins, cables, floating runes,
CRT-like spell interfaces, stars and constellations, magical circuit boards.

The palette is established through concept art **and gameplay readability testing** together.
A palette that looks beautiful in a mockup and makes a projectile invisible against a floor tile
is a failed palette.

## 2. Character scale

Candidates: 24×24, 32×32, 48×48.

**Recommendation: prototype at a ~32×32 character footprint, rendered at integer scale.** That
gives enough room for a wizard hat, a robot face, a staff and readable casting frames, without
making every enemy an expensive asset.

## 3. Resolution strategy

**This is the one presentation decision that can break the game, so it is normative.**

Code text needs far more detail than sprite art does. A single internal resolution that makes
the world look right will make the Spell Matrix illegible, and vice versa.

Candidate internal resolutions: `320×180`, `480×270`, `640×360`.

**Approach: render the pixel-art world at a low internal resolution, and render the UI on a
separate higher-resolution layer that retains the pixel aesthetic.** GameMaker handles this with
separate surfaces and cameras. Prototype both a single-resolution and a hybrid build before
committing — but assume the hybrid wins, because the alternative is choosing between chunky
sprites and readable code.

### 3.1 The font

The highest-legibility requirement in the game. A candidate pixel font must keep these
distinguishable at final render scale:

```txt
<   <=   >   >=
1   7   I   l
0   O
```

A font that fails is disqualified, regardless of aesthetics. A player who misreads `<=` as `<`
builds a spell that does not do what they believe it does and blames the game — correctly.

## 4. Token visuals

Tokens communicate their category by **shape**, with colour as reinforcement only. This is both
an accessibility requirement
([doc 09 §7.2](09-inputs-bindings-accessibility.md#72-always-available)) and a legibility one at
small sizes.

| Category        | Rune shape         |
| --------------- | ------------------ |
| **DIGIT**       | square rune        |
| **WORD**        | rectangular rune   |
| **OPERATOR**    | diamond rune       |
| **STRUCTURE**   | ornate rune        |
| **FUNCTION**    | circular seal      |
| **REFERENCE**   | eye / target motif |
| **PUNCTUATION** | small notched rune |

Rarity is expressed as a border treatment, escalating to an animated mythic frame.

## 5. The mascot silhouette

The robot wizard must be marketable as a recognisable mascot at 32 px and at poster size.
Candidate hooks:

- floppy pointed hat,
- a single glowing face display,
- a staff shaped like an antenna,
- a cloak with code-rune lining,
- a tiny floating spell terminal that follows them.

Keep the silhouette simple enough to survive pixel art. Test it as a black shape: if the
silhouette does not read as "wizard, but machine" with no interior detail, it is not done.

## 6. Animation set

Minimum player animations:

```txt
idle · move · cast · slash · hurt · dash · death · pickup
```

Directional variants as the art style demands.

## 7. Spell visuals

**Code modifications must sometimes be visible in combat.** This is what makes programming feel
like magic rather than menu configuration.

| Code change     | Visual consequence                      |
| --------------- | --------------------------------------- |
| Range increase  | longer slash arc                        |
| Damage increase | stronger impact particles               |
| `repeat`        | multiple pulses                         |
| Mouse targeting | a cursor-linked rune line               |
| `while`         | a looping rune circle around the caster |
| Element swap    | recoloured effect and new impact VFX    |

A player who raised their damage ceiling to 8 should be able to **see** it, not just read it in
a tooltip.

## 8. Token drop presentation

When a token drops in combat:

1. the rune pops out of the enemy,
2. floats briefly,
3. snaps into the wizard,
4. the word or digit appears above them.

Rare structural syntax gets escalated presentation. The `while` sequence is specified in
[doc 03 §9.1](03-tokens-and-loot.md#91-drop-presentation).

## 9. Audio direction

**Robot + wizard, blended.** Mechanical clicks, magical chimes, low synth, spell crackle, rune
pickup tones, and compilation sounds.

Rare syntax gets distinctive audio. A player should be able to identify a mythic drop with their
eyes closed — and so should a stream viewer with the video minimised.

### 9.1 The compile sound

`SPELL COMPILED` is a reward moment and its sound carries a disproportionate share of how good
the editor feels. Budget real time for it. It should sit somewhere between a mechanical latch
closing and a chord resolving.

## 10. Music

Pixel/electronic fantasy.

| Context      | Treatment                                          |
| ------------ | -------------------------------------------------- |
| Combat       | energetic                                          |
| Spell Matrix | stripped-down ambient variation of the biome theme |
| Boss         | layered mechanical/arcane motifs                   |

The Spell Matrix being a quieter version of the room the player just left keeps the edit window
feeling like part of the run rather than a menu.
