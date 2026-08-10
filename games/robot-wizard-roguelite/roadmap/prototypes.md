# Prototypes

Each prototype answers one question. If a prototype's question is answered "no", stop and fix
that before building the next one.

---

## The Immediate Prototype (go / no-go)

**Build this before anything else in this document set is implemented.**

### Setup

**Character.** Placeholder robot wizard in a simple top-down arena.

**Input.**

```txt
SPACE → slash()
```

**Spell.**

```txt
slash():

    if enemy range() <= 3
        deal 1 to 2 damage
```

**Enemy.** A stationary dummy with enough health to survive several attacks.

### Part 1 — the number

After a short interaction the player receives:

```txt
8
```

Open the Spell Matrix. It displays:

```txt
if enemy range() <= [3]
    deal [1] to [2] damage
```

Inventory:

```txt
[8]
```

Drag `8` onto `2`:

```txt
if enemy range() <= 3
    deal 1 to 8 damage
```

Compile. Return to the arena. Press Space. Observe the changed damage.

### Part 2 — the control

Add:

```txt
W → move up
```

Give the player:

```txt
mouse
toward
```

Let them transform W into cursor-relative movement:

```txt
W → move toward mouse
```

Hold W. The wizard walks toward the cursor.

### The gate

> **If those two interactions are compelling, proceed with the rest of the project.**

If they are not — if the number swap feels like a menu and the movement rewrite feels like a
gimmick — no amount of the remaining design saves it. Stop and reconsider.

---

## Prototype 0 — Number replacement

**Question:** Does replacing a number in a spell immediately make sense and feel satisfying?

Build: `SPACE → slash()`, an `8` token, a single editable socket, a dummy.

Watch for: whether the player understands _without being told_ that the `8` is a reusable piece
of language rather than a one-time consumable.

## Prototype 1 — Token inventory

**Question:** Does the drag-and-drop editor read as an inventory rather than a settings menu?

Add: inventory panel, drag/drop, compatible-socket highlighting, undo. Test with `2`, `5` and
`8` so the player must **choose** rather than accept.

## Prototype 2 — Movement editing

**The critical prototype.**

**Question:** Is changing what W means fun enough to build a game around?

Build `W → move up`. Add `mouse` and `toward`. Allow construction of cursor-relative movement.

If the answer is no, the project's core premise is wrong and the correct response is to redesign
around whatever _did_ feel good in Prototype 0 — not to proceed and hope.

## Prototype 3 — Multiple bindings

Add W/A/S/D, Space, LMB. Allow function reassignment between them.

**Question:** Do players voluntarily rebind, or do they leave the defaults alone? If they leave
them alone, find out whether it is fear, friction, or lack of reason.

## Prototype 4 — Conditions

Add `if`, `<`, `<=`, and a simple range query. Allow a context-sensitive spell.

**Question:** Do players understand that one button can now do two things?

## Prototype 5 — Combat run

Add chaser, turret, charger, rewards, 10 rooms, death/restart.

**Question:** Does language accumulation create satisfying run progression, or does it feel like
collecting parts for a machine that never gets built?

## Prototype 6 — Function editing

Allow statement replacement, statement insertion, and moving function calls.

**Question:** Is structural editing legible, or does the code stop feeling like a spell once it
gets longer than three lines?

## Prototype 7 — Custom function

Implement the Blank Function Core. Let an advanced playtester create `rush()` from owned tokens.

**Question:** Can someone who is not a programmer author a function without a tutorial?

## Prototype 8 — `repeat`

**Build bounded repetition before unbounded repetition.**

```txt
repeat 3
    bolt toward mouse
```

This exposes scheduling issues, action-queue issues and cycle balancing in a construct that
cannot loop forever. Every bug found here is a bug not found inside a `while`.

## Prototype 9 — `while`

Implement bounded real-time loop execution. **Developer-granted initially** — not in the loot
pool.

Stress-test exploits before it drops for anyone:

- nested loops,
- loops calling functions containing loops,
- loops full of cooldown-blocked actions,
- `while true`,
- conditions that never change,
- loops that emit movement every iteration.

Assert the hard bounds in
[doc 06 §7.3](../docs/06-runtime-and-execution.md#73-hard-bounds) hold in every case, and that
the frame rate never notices.

Only then add it to rare loot.
