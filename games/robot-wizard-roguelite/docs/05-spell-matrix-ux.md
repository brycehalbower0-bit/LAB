# 05 — The Spell Matrix

**Status:** Normative

The main editing screen. Working name: **Spell Matrix**. Alternatives on the table: Rune
Compiler, Grimoire Core, Spell Forge, Arcane Runtime, Command Grimoire, Syntax Crucible.

It must feel like a **magical machine**, not an IDE. If it reads as a code editor,
non-programmers bounce off it and the game loses most of its audience.

---

## 1. Layout

```txt
╔══════════════════ SPELL MATRIX ══════════════════╗

 INPUTS                 FUNCTION

 [W] [A] [S] [D]        slash()
 [SPACE]                ─────────────────────
 [LMB] [RMB]            if enemy range() <= [3]
                            deal [1] to [2] damage

                        MEMORY  ████░░ 4/6

 CODE INVENTORY
 ──────────────────────────────────────────────────
 DIGITS       [2] [5] [8]
 WORDS        [mouse] [toward]
 OPERATORS    [+]
 STRUCTURE    [...]
 FUNCTIONS    [slash()]
╚═══════════════════════════════════════════════════╝
```

Three regions, always visible:

1. **Inputs** — every programmable control and what it currently invokes. Selecting one loads
   its function into the centre.
2. **Function** — the code, rendered from the AST, with sockets marked.
3. **Code Inventory** — the pouch, categorised and filterable.

The inputs panel doubles as the binding editor: drag a function from the spellbook onto an
input to rebind it.

## 2. Drag-and-drop first

The primary editor is **inventory-driven, never text-entry-driven**.

```txt
1. open spell
2. see editable code
3. open rune pouch
4. grab a token
5. drag it over a compatible token or socket
6. see a preview
7. drop it
8. function recompiles
```

**The beginner editor must never show an empty text box.** A text box destroys the inventory
fantasy — it says "type anything", when the entire premise is "you may only say what you have
found". Late game may permit keyboard-assisted editing as a speed affordance, but only ever
offering owned tokens, and only as an alternative to dragging, never a replacement.

## 3. Drag feedback

While dragging `8`:

- **Compatible sockets glow.** They pulse gently; the glow colour matches the token's category.
- **Incompatible sockets stay dark.** No red, no error state — the socket simply does not
  respond. Rejection should feel like a magnet not catching, not like a failure.
- **Hovering a compatible socket shows a live preview** of the resulting code and its stat
  consequences.

Compatibility is a pure type check against the socket's `accepts` field
([doc 02 §7](02-language-specification.md#7-sockets)); the UI never encodes rules of its own.

## 4. Compile feedback

On success:

```txt
SPELL COMPILED
```

with a short mechanical/arcane animation — rune seams lighting in sequence, a satisfying
mechanical clunk. This is a **reward moment** and should be tuned like one.

On failure:

```txt
INVALID SPELL
```

plus the exact reason, in the player's language.

### 4.1 Errors must teach

Never surface parser jargon. Compare:

| Bad                                  | Good                                              |
| ------------------------------------ | ------------------------------------------------- |
| `Type mismatch: ENTITY != DIRECTION` | `MOVE needs a direction.`<br>`ENEMY is a target.` |
| `Unresolved identifier 'toward'`     | `Requires token: [toward]`                        |
| `Cyclic call graph detected`         | `Recursive function calls are not supported.`     |
| `Literal 0 in divisor position`      | `This expression can divide by zero.`             |

Technical detail belongs in an optional secondary panel for players who want it. The primary
message explains **what the pieces are**, which is also how the player learns the type system
without ever being taught it.

### 4.2 Locked language feedback

When the player attempts something that needs a fragment they do not have:

```txt
Requires token:
[toward]
```

This is one of the most valuable messages in the game: it converts a failure into a **shopping
list**, and it makes future loot legible. A player who has seen this message once will
recognise `toward` on a reward screen instantly.

## 5. Before/after preview

Dragging `8` over `2` shows the delta before the drop:

```txt
DAMAGE
1–2 → 1–8

MANA
2 → 6
```

And the function's full derived properties, always visible while editing:

```txt
slash()

Mana:             6
Cycles:           4
Memory:           5
Estimated Range:  3
Damage:           1–8
```

Show only properties that make sense for the function. A movement function has no damage line.

This panel is what makes [the consequence rule](01-core-loop-and-progression.md#31-replacement-must-have-consequences)
fair rather than punishing: the mana cost of a big number is never a surprise discovered
mid-boss.

## 6. Undo and safety

**Mandatory, all of it.** Editing must be low-risk or players stop experimenting.

- **Undo / redo**, unlimited within an editing session.
- **Revert function** to its last compiled state.
- **Restore firmware** — return a function to its original definition.
- **Restore Emergency Controls** — a pause-menu option that rebuilds basic WASD movement and a
  basic attack, regardless of what the player has done to their bindings.

The player must **never** be able to permanently soft-lock themselves out of playing. A build
that cannot move or cannot attack is a valid experiment, and there must always be a way back.
Emergency Controls may be disabled in challenge modes, and only there.

## 7. Editing windows

Editing happens **between rooms**, not during combat
([doc 01 §2](01-core-loop-and-progression.md#2-where-editing-happens)). The Spell Matrix is
therefore a destination, not an overlay, and it can afford to be a full-screen, unhurried,
tactile screen.

If playtests show players spending too long in it, the fix is fewer simultaneous choices and
better previews — not a timer.

## 8. Test Chamber

After editing, the player can enter a tiny safe simulation. It contains:

- a target dummy (with configurable health and a damage-number readout),
- a movement marker at a known distance, for verifying range and dash values,
- a projectile emitter, for testing `projectile`-reactive code,
- a reset button.

The player can hold W, move the cursor, and confirm that their cursor movement works before
walking into a room where being wrong is fatal.

**The Test Chamber is what makes fear of breaking your build go away.** Together with undo, it
is the difference between a player who experiments and a player who saves their `8` forever
because they are afraid to use it. It is required for the vertical slice.

## 9. Debug visualisation

An optional overlay that narrates execution:

```txt
SPACE
→ slash()
→ if TRUE
→ damage 6
```

In the Test Chamber, highlight the currently executing line:

```txt
while enemy range() <= 3
  > slash()
```

This turns debugging into a **visual feature** rather than a developer tool. It is how a player
learns why their `while` stopped after four iterations, and it is how they learn that cycles
are real. Ship it with [Phase 12](../roadmap/README.md#phase-12--while).

### 9.1 Death replay

Later feature: replay the final seconds with code execution visible.

> Space triggered `blink()` because the condition was false.

Useful, shareable, and a strong teaching tool. Post-vertical-slice.

## 10. Run summary

At death or victory:

- final bindings,
- custom functions, in full,
- rarest token,
- most-used function,
- tokens collected,
- final spell architecture.

### 10.1 Build card

```txt
RUN 8F31

RAREST TOKEN:
WHILE

SPACE → panic()
W     → cursor_move()
LMB   → burst()

CUSTOM FUNCTIONS: 2
TOKENS LEARNED:  31
```

Exportable as an image later. The build card is the artefact players post, and it is written in
the vocabulary the community will use to talk about the game — see
[doc 14 §6](14-marketing-and-community.md#6-community-vocabulary).

## 11. Pixel-art UI requirements

- Dark stone/metal panel; brass or copper mechanical borders.
- Glowing magical runes; tiny animated circuit lines.
- Chunky, highly readable pixel font.
- Inventory tokens as rune tiles; spell sockets as etched sockets in the panel.
- Category communicated by **shape as well as colour**
  ([doc 10 §4](10-art-audio-and-presentation.md#4-token-visuals)).

### 11.1 The font test

Code text is the highest-legibility requirement in the game. Any candidate font must keep these
visually distinct at final render scale:

```txt
<   <=   >   >=
1   7   I   l
0   O
```

If a font fails this test it is disqualified regardless of how good it looks, because a player
misreading `<=` as `<` will build a spell that does not do what they think it does — and will
blame the game, correctly.

Resolution strategy for UI legibility is in
[doc 10 §3](10-art-audio-and-presentation.md#3-resolution-strategy).
