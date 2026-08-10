# 09 — Inputs, Bindings & Accessibility

**Status:** Normative

This document covers the game's most distinctive system and its most serious accessibility
obligation. Controls are a **game mechanic** here, which means the usual accessibility answers
do not apply unmodified.

---

## 1. Physical controls

The robot wizard has programmable physical input bindings. Starter set:

```txt
W  A  S  D
SPACE
LMB
```

Expanded later through **Open Port** drops:

```txt
Q · E · RMB · SHIFT · MOUSE WHEEL · MOUSE MOVE
```

### 1.1 Starting bindings

```txt
W     → move up
A     → move left
S     → move down
D     → move right
SPACE → slash()
LMB   → spark()
```

Movement is **one `move` routine with a direction socket**, not four separate `step_up()` /
`step_left()` functions. This matters: the unified form is what lets two tokens (`toward`,
`mouse`) transform movement, instead of requiring four separate rewrites. It is also cleaner
code and less UI.

### 1.2 Input capacity as progression

Starting with six programmable inputs and earning more is a real power axis. An **Open Port: Q**
drop gives the player another physical spell slot — which is meaningfully exciting in a way that
`+10% damage` is not.

## 2. Firmware

Basic controls are **firmware**: always functional, initially partially locked, gradually
becoming editable. Firmware is the narrative explanation for code the player does not own
([doc 01 §6](01-core-loop-and-progression.md#6-embedded-tokens-vs-owned-tokens)).

Progression on a single binding:

```txt
Early      W → move up
Mid        W → [move] [up]          both sockets open
Late       W → <entire binding editable>
```

The player never has a moment where they cannot move. They simply gain authority over how they
move.

## 3. Binding editing

Once permission is earned, functions can be reassigned freely:

```txt
SPACE → slash()        becomes        SPACE → blink()
W     → move up        becomes        W     → slash()
```

**Nothing says W must mean movement.** The game should permit:

```txt
W     → slash()
S     → heal()
SPACE → move toward mouse
LMB   → blink()
```

If it compiles and the player can survive with it, it is valid. Weirdness is a feature, and the
[Emergency Controls](05-spell-matrix-ux.md#6-undo-and-safety) safety net is what makes it safe
to offer.

Bindings store stable function ids, never copies
([doc 04 §2.1](04-functions-and-editing.md#21-definitions-vs-bindings)).

## 4. Mouse awareness

**A key does not automatically know where the mouse is.** The ability to reference cursor
information comes from language, and this is one of the game's most important progression
discoveries.

### 4.1 The `mouse` reference

Acquiring `mouse` makes the cursor a referenceable object wherever compatible code allows.
Available queries (each may require its own property token):

```txt
mouse position()
mouse range()
mouse direction()
```

### 4.2 The transformation

```txt
W → move up
```

plus `mouse` and `toward` becomes:

```txt
W → move toward mouse
```

Holding W now pulls the wizard toward the cursor. This is
[aha moment 2](00-vision-and-pillars.md#61-the-four-aha-moments-in-order) and the single most
important interaction in the game.

With `away`:

```txt
S → move away mouse
```

W pulls toward the cursor; S pushes away from it. The player has invented a control scheme.

### 4.3 Follow vs destination

Two distinct concepts; both eventually exist and the game must distinguish them clearly.

| Behaviour                  | Meaning                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| **Follow cursor**          | While the input is held, direction continuously updates toward the mouse  |
| **Move to captured point** | The press captures a position; movement continues toward that destination |

```txt
move toward mouse           follow
move to mouse position()    destination
```

The distinction is teachable through the tooltip and immediately obvious in the Test Chamber.
`click position()` — remembering where LMB was last clicked — extends the destination form and
is a good late reference token.

### 4.4 Mouse-driven builds

```txt
SPACE → dash toward mouse       a cursor dash, invented by the player
LMB   → slash toward mouse      directional melee
LMB   → bolt toward mouse       aimed ranged attack
```

## 5. Input awareness

Late enough, one binding can reference another input's state:

```txt
if shift held()
    ...
```

`shift`, `held`, `pressed`, `released` are themselves language fragments. Not automatically
available; earning them turns modifier keys into a build.

### 5.1 Player agency rule

> **Functions execute because the player activates a bound input.**

This is non-negotiable. Even a very smart Space binding still requires pressing Space. The game
must never become autonomous — that is the failure mode this entire design is steering around.

**Passive execution**, if ever introduced, is exceptionally rare: a relic (working name
_Familiar Thread_) allowing **one tiny** automatically-evaluated function. Not MVP, and possibly
never.

## 6. The logical input layer

Physical keys must never be referenced directly by gameplay code. Define **logical input slots**
and resolve physical devices into them:

```txt
INPUT_SLOT_W
INPUT_SLOT_A
INPUT_SLOT_S
INPUT_SLOT_D
INPUT_SLOT_SPACE
INPUT_SLOT_PRIMARY     (LMB)
INPUT_SLOT_SECONDARY   (RMB)
INPUT_SLOT_POINTER
```

The input manager detects key pressed / held / released, mouse pressed / held / released, mouse
movement and wheel, then invokes the function currently bound to the corresponding slot.

Binding data:

```txt
bindings = {
    INPUT_SLOT_W:       <function_ref>,
    INPUT_SLOT_A:       <function_ref>,
    INPUT_SLOT_SPACE:   <function_ref: slash>,
    INPUT_SLOT_PRIMARY: <function_ref: spark>,
}
```

This layer exists from day one, before it is needed, because retrofitting it later touches every
system that reads input.

## 7. Accessibility

Because controls are a mechanic, accessibility needs unusual care. **Accessibility settings must
never require loot, and must never be entangled with the in-game binding mechanic.**

### 7.1 The two-layer separation

This is the key idea and it must be built in from the start:

| Layer                     | Question it answers                                                  | Owned by                |
| ------------------------- | -------------------------------------------------------------------- | ----------------------- |
| **Accessibility mapping** | Which physical device input corresponds to which logical input slot? | The player, in settings |
| **Magical binding**       | Which function does that logical input slot invoke?                  | The game's progression  |

A player who remaps `W` to a foot pedal has changed the accessibility layer. The magical binding
layer is untouched — the pedal now does whatever `INPUT_SLOT_W` does. A player who rebinds
`INPUT_SLOT_W` to `slash()` has changed the magical layer, and their key remapping still holds.

Conflating these would force disabled players into a mechanic they did not choose, which is
unacceptable.

### 7.2 Always available

- Full physical key remapping.
- Full controller remapping.
- Toggle-instead-of-hold for every held input.
- Font scaling and UI scaling — non-negotiable, given how much code text the game shows.
- Reduced screen shake.
- High-contrast cursor. The cursor is a gameplay object here, not just a pointer.
- Colour-blind-safe token shapes
  ([doc 10 §4](10-art-audio-and-presentation.md#4-token-visuals)) — categories are communicated
  by silhouette, with colour as reinforcement only.
- Adjustable editor text size independent of world scale.

### 7.3 Difficulty and assist

Emergency Controls ([doc 05 §6](05-spell-matrix-ux.md#6-undo-and-safety)) are an accessibility
feature as much as a safety net. The Test Chamber is one too — it removes the penalty for not
being able to predict what code will do.

## 8. Controller

Architecture must not make controller support impossible, even though it is not an MVP
priority.

Logical actions map cleanly:

```txt
MOVE_UP · MOVE_LEFT · MOVE_DOWN · MOVE_RIGHT
ACTION_1 · ACTION_2 · ACTION_3
POINTER
```

### 8.1 The pointer problem

If mouse-based language is central on PC, controller needs an equivalent pointer reference.
Candidates:

- right-stick world direction,
- a virtual cursor,
- an aim point at a fixed distance from the player.

`mouse` would resolve against whichever the platform provides. The token stays the same; the
device beneath it changes. Decide this before, not after, the language ships.

### 8.2 Steam Deck

Eventually important. The blocking issue is that **drag-and-drop code editing must work without
a mouse**. A node/socket editor with directional selection — select socket, open compatible-token
list, confirm — solves it and should be designed alongside the mouse editor rather than bolted
on. Prototype it during the vertical slice even if it does not ship then.
