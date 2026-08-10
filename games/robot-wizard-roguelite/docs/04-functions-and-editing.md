# 04 — Functions & Editing

**Status:** Normative

---

## 1. Functions are spells

A spell is a function. A function has:

```txt
id                 stable internal identifier (never player-authored)
display_name       "slash", "PANIC BONK"
parameters         none, initially
body               a BLOCK of statements (the AST)
sockets            typed holes declared by the template
memory_cost        derived from the body
cycle_cost         derived from the body
mana_behavior      derived from the body's actions and socket values
animation          which cast animation plays
effects            VFX/SFX hooks
edit_permissions   which edit levels are unlocked on this function
```

Base spell roster:

```txt
slash()   spark()   bolt()    blink()   dash()
shield()  push()    pull()    heal()    burst()   step()
```

Definitions ship in [`data/functions.json`](../data/functions.json).

## 2. Functions are inventory objects

Known functions appear in a spellbook, and are draggable onto input bindings:

```txt
SPELL FUNCTIONS

slash()   step()   blink()   spark()
```

### 2.1 Definitions vs bindings

**This distinction is load-bearing.**

| Concept        | Meaning                                             |
| -------------- | --------------------------------------------------- |
| **Definition** | The underlying editable spell. One per function id. |
| **Binding**    | A control that points at a definition.              |

If `SPACE` and `RMB` both point at `slash()`, editing `slash()` changes both. That is correct,
intuitive programming behaviour and the game should not hide it — the Spell Matrix shows every
binding that references the function currently being edited.

Bindings store **stable ids**, never copies of the code.

### 2.2 Cloning

A later unlock, **Function Copy Core**, produces an independent copy:

```txt
slash()  →  slash_2()
```

Now they can diverge — a short cheap slash on Space, a long expensive one on RMB. This is the
mechanism by which a player specialises, and it is deliberately a mid-late unlock so that the
shared-definition rule is learned first.

## 3. Edit states

Every token position inside a function has an edit state. Progression through these states is
what turns a fixed spell into a program.

| State              | The player can…                                              | Displayed as           |
| ------------------ | ------------------------------------------------------------ | ---------------------- |
| **Fixed**          | nothing                                                      | plain text, no socket  |
| **Replaceable**    | swap in a compatible owned token                             | `[3]` — etched socket  |
| **Movable**        | reorder within its statement / block                         | socket with grip marks |
| **Extractable**    | remove it into the Code Inventory (see [§6](#6-decompiling)) | socket with a seam     |
| **Fully editable** | insert, delete, restructure                                  | open bracket region    |

A starter `slash()` presents:

```txt
slash()

[LOCKED] if enemy range() <= [3]
             deal [1] to [2] damage
```

Three replaceable numeric sockets; everything else fixed. That is the entire early game surface
area, and it is enough for hours.

## 4. Edit permissions as loot

Permissions are a **second progression axis** alongside vocabulary. A player can be rich in
language and poor in permission, or the reverse, and those are different runs.

```txt
EDIT_VALUE           replace a literal with an owned literal
EDIT_TOKEN           replace any compatible token
EDIT_STATEMENT_INS   insert a statement
EDIT_STATEMENT_MOVE  reorder statements
EDIT_STATEMENT_DEL   delete a statement
EDIT_FUNCTION        full structural editing
```

Corresponding drops:

| Drop                        | Effect                                                 | Rarity   |
| --------------------------- | ------------------------------------------------------ | -------- |
| **Loose Socket**            | Unlock one additional editable value in a chosen spell | UNCOMMON |
| **Blank Statement Slot**    | Add one empty statement slot to a chosen function      | RARE     |
| **Statement Wrench**        | Move one statement                                     | RARE     |
| **Editable Condition Slot** | Open a condition for assembly                          | RARE     |
| **Decompiler**              | Learn one embedded token from a chosen function        | ARCANE   |
| **Function Copy Core**      | Clone a function                                       | ARCANE   |
| **Blank Function Core**     | Create one custom function                             | ARCANE   |

### 4.1 Function expansion

Prefer thematic capacity growth over generic "+2 code capacity". Functions gain:

- memory,
- statement slots,
- condition slots,
- parameter slots (deep endgame).

**Blank Statement Slot**, before and after:

```txt
slash():
    deal 1 to 2 damage
```

```txt
slash():
    deal 1 to 2 damage
    [____________]
```

**Editable Condition Slot**:

```txt
if [________________]
    slash()
```

The player assembles the condition from owned tokens. An empty slot is a **valid save state**
and compiles with a warning, not an error — the player will often open a slot before they own
anything to fill it with.

## 5. Function templates as loot

Runs offer prebuilt functions: `blink()`, `shield()`, `fireball()`, `push()`. Acquiring one is
like finding a new spell — but its internals are still subject to the edit-permission ladder.

A **rare** function is not simply a bigger-numbers function. It is distinguished by:

- more editable sockets,
- lower memory cost,
- a unique action word not otherwise obtainable,
- more parameters,
- unusual structure.

### 5.1 Spell skeletons

Partially-built functions bridge template editing and authorship:

```txt
???

if [TARGET] range() <= [NUMBER]
    [ACTION]
```

The player fills it using owned language and names it. This is the best on-ramp to custom
functions that exists, and it should appear well before Blank Function Cores do.

## 6. Decompiling

Late-game mechanic. Extract one embedded token from a function into general vocabulary.

> **Decompile**
> Learn one embedded token from a selected function.

Starter `slash()` embeds `enemy`. Decompile it, and `enemy` becomes usable everywhere.

A found `blink()`:

```txt
blink():
    move player 5 toward mouse
```

can yield `toward`, or `mouse`, or `player`.

Decompiling makes **spell loot useful even when the player does not want the spell**, which
removes an entire category of dead drop. It also lets a player who never rolled `mouse` route
toward a spell that contains one. It is one of the strongest ideas in the design and should be
prototyped in [Phase 9](../roadmap/README.md#phase-9--spell-editing-depth).

### 6.1 Never destroy vocabulary

- Removing a token from a function returns it to where it came from (inventory if owned,
  nothing if embedded).
- A function can always be **reset to its original form**.
- A custom function can always be reset to blank.
- The player can restore any previous token they own or that is the function's firmware
  default.

Editing must be low-risk or players will not experiment, and experimentation is the game.

## 7. Custom functions

Authorship is the late-game milestone. For most of a run, the player edits what exists.

### 7.1 Blank Function Core

> **Blank Function Core**
> Create one custom spell function using language fragments you possess.

The player names it and builds its contents from owned tokens:

```txt
rush():

    move toward mouse
    slash()
```

`rush()` becomes a function token, bindable like any other:

```txt
SPACE → rush()
```

### 7.2 Why authorship is late

Custom functions dramatically increase reuse, abstraction, code density, control complexity and
combination potential. The player should understand **modification** before receiving
**authorship**. The emotional sequence is:

> "I'm changing spells." → "I'm rebuilding spells." → "I just wrote my own spell."

Skipping to the third breaks the first two.

### 7.3 Naming

Player-chosen display names, freely:

```txt
panic()   bonk()   mouse_dash()   kill_that()   NOPE()
```

Names carry **zero semantics**. Internally the engine generates a safe id (`custom_func_001`)
and the display name is a string attached to it, so there is no parser risk from arbitrary
names and no way for a name to collide with a keyword. Profanity filtering applies only to
shared build cards, never to the player's own run.

### 7.4 Parameters

**Not in the first implementation.** Start with `rush()`. A later unlock could allow
`rush(target)`, which is significantly more complex and belongs in sandbox/endgame territory.

### 7.5 No recursion

A custom function calling itself, directly or transitively, fails validation
([doc 02 §8.2](02-language-specification.md#82-recursion-validation)). An absurd late-game
relic could someday change this; it is not necessary and it is not planned.

## 8. Composition

Function names are themselves tokens. Owning or extracting `slash()` lets the player place it
inside another editable function:

```txt
blinkslash():

    blink()
    slash()
```

```txt
panic():

    shield()
    blink()
    slash()
```

```txt
RMB → panic()
```

Composition is the most important late-game combinatorial system, because it produces
complexity without producing visual clutter. A three-line `panic()` can contain thirty lines of
behaviour.

### 8.1 Sequencing is free power

Statements execute in order. `blink()` then `slash()` is a blink-strike the player invented
from two things they already had. Before any loop or condition exists, **ordering alone** gives
custom functions most of their value — which is why [Phase 10](../roadmap/README.md#phase-10--custom-functions)
ships before [Phase 11](../roadmap/README.md#phase-11--advanced-execution).

## 9. Function reset and history

- **Reset** — every found or template function returns to its original form. Always available,
  always free.
- **Undo / redo** — mandatory in the editor. See
  [doc 05 §6](05-spell-matrix-ux.md#6-undo-and-safety).
- **Version history** — storing the last few spell versions is a nice-to-have. Undo is
  sufficient for MVP; revisit only if playtesters ask.
- **Templates** — outside runs, the sandbox can save custom spell designs. Inside a run, a
  saved template can only be instantiated if the required language is owned. Good long-term
  feature, not MVP.
