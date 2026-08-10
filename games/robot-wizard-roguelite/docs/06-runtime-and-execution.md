# 06 — Runtime & Execution

**Status:** Normative. Cost numbers are _tunable_; the execution model is not.

---

## 1. Spells are ASTs

Internally, a spell is an **Abstract Syntax Tree**, never text, and never evaluated as GML.

```txt
slash()
└── If
    ├── Condition: <=
    │   ├── EnemyRange
    │   └── Number(3)
    └── DealDamage
        ├── Number(1)
        └── Number(2)
```

The UI renders this as code. The player edits the tree, not a string.

### 1.1 Why the AST is non-negotiable

It is what makes all of the following possible at once:

- safe execution (no `eval`, no string dispatch),
- drag-and-drop editing with live type checking,
- token sockets,
- memory and cycle calculation,
- save/load,
- the visual editor,
- a later text-like representation,
- and, most importantly, **no arbitrary GML execution ever**.

Any proposal that requires evaluating player-authored strings is rejected on sight.

## 2. Execution model

### 2.1 The problem

Does a function execute instantly, or over time? Neither answer alone works. Instant execution
makes `repeat 3 / slash()` produce three slashes in one frame, which is nonsense. Purely
time-sliced execution makes a simple `slash()` feel laggy.

### 2.2 The answer: fibers emitting actions

A function invocation creates an **execution instance** (a fiber). Fibers advance every game
step and emit **action requests** into the caster's action system, which executes them
according to animation and cooldown timing.

```txt
{
    function_id       : "slash",
    program_counter   : <node cursor>,
    node_stack        : [...],
    cycles_remaining  : 8,
    waiting_for       : ACTION_NONE | <action handle>,
    local_state       : {},
    context           : <execution context>
}
```

Each step, a fiber runs until one of:

- **completion** — the body finished; the fiber is discarded;
- **cycle exhaustion** — `cycles_remaining` hits 0; the fiber stops and logs it;
- **yield** — it emitted an action that occupies the caster, and must wait for it.

This separates **code semantics** from **animation timing**, which is what makes both simple
spells snappy and loops safe.

### 2.3 Action queue

Fibers emit requests; the character action system owns timing:

```txt
[ MOVE, SLASH, SLASH ]
```

The action system executes them according to windup, duration and cooldown rules. Two `slash()`
statements do not produce two simultaneous slashes; they produce two slashes in sequence, at the
weapon's rhythm.

### 2.4 One fiber per input

Each programmable input owns at most one live fiber. Re-pressing an input whose fiber is still
running **restarts** it by default. Per-function override: `restart | ignore | queue`. Restart
is the default because it is the most responsive and the least surprising — mashing a button
should feel like mashing a button.

### 2.5 MVP simplification

**Do not build the fiber model first.** For MVP:

- no `while`,
- functions execute immediately into action requests,
- the action system handles all timing.

Add fibers in [Phase 11](../roadmap/README.md#phase-11--advanced-execution), when `repeat`
forces the issue. Building coroutine machinery before the core editing loop is proven fun is
the single most likely way to waste six months on this project.

## 3. Execution context

Every invocation receives:

```txt
caster            the robot wizard instance
input_source      which logical input fired this
mouse_world_x     canonical world cursor (see §9)
mouse_world_y
target            resolved default target, if any
cycles_remaining
local_values
room_state
```

References resolve **against the context at the moment they are evaluated**, not at invocation.
Inside a loop, `enemy range()` re-evaluates each iteration — which is precisely what makes
`while enemy range() <= 3` meaningful.

## 4. Memory

**Memory = how much code a function can contain.** It is a compile-time property.

Cost is a per-node data table, not a formula, so designers can tune individual constructs:

| Construct                                  | Memory                                     |
| ------------------------------------------ | ------------------------------------------ |
| Action (single-operand)                    | 1                                          |
| Action (multi-operand, e.g. `deal … to …`) | 2                                          |
| Function call                              | 1                                          |
| `if` (including condition)                 | 2                                          |
| `else` branch                              | 1                                          |
| `repeat`                                   | 2                                          |
| `while`                                    | 3                                          |
| Additional `and` / `or` clause             | 1                                          |
| Additional statement slot                  | 0 (the slot is free; its contents are not) |

Worked example — the starter slash:

```txt
if enemy range() <= 3        2
    deal 1 to 2 damage       2
                            ──
                             4
```

```txt
MEMORY  ████░░ 4/6
```

Base capacity is **6**, raised by Compiler Forge upgrades and the Overflow Core relic. Memory is
what stops the player from stuffing unlimited behaviour into every function, and it is why
composition ([doc 04 §8](04-functions-and-editing.md#8-composition)) is attractive: a call costs
1 memory but can contain 6 memory of behaviour.

## 5. Cycles

**Cycles = how much work a function may do when invoked.** It is a runtime budget, consumed as
the fiber executes.

| Evaluation                                          | Cycles                   |
| --------------------------------------------------- | ------------------------ |
| Condition evaluation                                | 1                        |
| Action dispatch                                     | 1                        |
| Action dispatch that fails (on cooldown, no target) | 1                        |
| Function call                                       | 1 + callee's consumption |
| Loop iteration overhead                             | 1                        |

Base budget is **8**, upgraded in `+4` steps, hard-capped at **32**.

```txt
CYCLES
```

is a robot-wizard stat like health or mana, and it is the natural balance lever for advanced
syntax. A `while` in an 8-cycle function loops perhaps three times. The same `while` in a
32-cycle function is a very different spell — which makes cycle upgrades feel like unlocking the
syntax a second time.

Cycle exhaustion is **not an error**. The fiber stops, the debug overlay says so, and play
continues. Running out of cycles is a normal, expected, designed outcome.

### 5.1 Why memory and cycles are separate

Memory limits how much you can _write_. Cycles limit how much it can _do_. Before loops exist
the distinction is nearly invisible; once `while` exists it is essential, because a three-line
function can perform thirty actions. Introduce memory in the midgame and cycles in the late
game ([doc 01 §10](01-core-loop-and-progression.md#10-economy-introduction-order)).

## 6. Mana (derived spell cost)

**Mana = magical effect power.** Cost is **derived from the AST**, never hard-coded per
combination — there are far too many combinations.

```txt
spell_mana =  Σ over actions (
                  base_cost
                + range_curve[range_value]
                + damage_curve[damage_max]
                + count_curve[count_value]
              )
              × targeting_multiplier
```

Curves are per-action data tables. For `slash`:

| `damage_max` | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   |
| ------------ | --- | --- | --- | --- | --- | --- | --- | --- |
| **+mana**    | 0   | 1   | 1   | 2   | 3   | 3   | 4   | 5   |

| `range`   | 3   | 4   | 5   | 6   | 7   | 8   |
| --------- | --- | --- | --- | --- | --- | --- |
| **+mana** | 0   | 1   | 1   | 2   | 2   | 3   |

Worked examples, with `slash` base cost 2:

```txt
deal 1 to 2 damage, range 3   →  2 + 0 + 0  =  2 mana     (starter)
deal 1 to 8 damage, range 3   →  2 + 4 + 0  =  6 mana     (the tutorial's 8)
deal 1 to 2 damage, range 8   →  2 + 0 + 3  =  5 mana     (the range build)
```

These reproduce the `MANA 2 → 6` shown in the editor preview
([doc 05 §5](05-spell-matrix-ux.md#5-beforeafter-preview)).

Non-mana costs move on the same curves: raising range also raises **windup** and **cooldown**
and **narrows the slash arc**, so the range build plays differently rather than just costing
more.

### 6.1 Unaffordable spells are legal

```txt
deal 8 to 88 damage
```

compiles. The editor shows:

```txt
MANA COST:    120
CURRENT MANA:  35
```

The player may keep it. It simply cannot be cast until affordable — perhaps after a mana
upgrade, perhaps never. Do not reject creative builds for being inefficient; see
[doc 12 §3](12-balance-and-design-rules.md#3-invalid-vs-impractical).

## 7. `while` semantics

`while` is the hardest thing in the runtime and the reason the fiber model exists.

### 7.1 What it is not

`while` must **never** spin the interpreter inside a single frame. That is a hang, and a hang in
a real-time action game is a crash with extra steps.

### 7.2 What it is

```txt
spin():

    while enemy range() <= 3
        slash()
```

Execution:

1. The fiber evaluates the condition (1 cycle).
2. If true, it executes the body, emitting a `SLASH` action request.
3. The body **yields** until the slash animation completes.
4. Next step, the fiber re-evaluates the condition against **current** world state.
5. Repeat until the condition is false, cycles are exhausted, or a hard bound trips.

The wizard visibly slashes repeatedly while enemies stay close, and stops when they don't. The
frame rate never notices.

### 7.3 Hard bounds

Belt and braces. Every one of these is enforced independently:

| Bound                          | Value                           |
| ------------------------------ | ------------------------------- |
| Cycles per invocation          | ≤ 32                            |
| Loop iterations per invocation | ≤ 32                            |
| Fiber lifetime                 | ≤ 4 seconds                     |
| Live fibers per caster         | ≤ number of programmable inputs |

```txt
while true
    slash()
```

is legal, compiles, and terminates on cycle exhaustion. It is a perfectly reasonable thing for a
player to build, and it does something useful — a burst of slashes until the budget runs out.

### 7.4 Interaction with cooldowns

If `blink()` is on cooldown inside a loop:

```txt
while enemy range() <= 3
    blink()
```

**Normative behaviour:** the failed action consumes **1 cycle** and the loop continues. It does
not block, does not retry, does not silently succeed. This is documented in the `while` tooltip
and in the codex, because it is exactly the kind of rule a player will build a spell around.

The consequence is desirable: cooldowns remain meaningful under loops. A player cannot bypass
`blink`'s cooldown by looping it; they can only waste cycles trying.

### 7.5 `break`

If `while` exists, `break` becomes an interesting rare fragment. A player may obtain `while`
without `break` — that is fine and even good. They must then design a condition that naturally
becomes false, or rely on cycle exhaustion. That constraint produces better spells than `break`
does.

### 7.6 `repeat` first

```txt
repeat 3
    bolt toward mouse
```

Bounded, predictable, and far easier to balance than `while` — so it is **rarer than common but
less rare than mythic**, and it ships first
([Phase 11](../roadmap/README.md#phase-11--advanced-execution)). `repeat` is where all the
scheduling and action-queue bugs get found, in a construct that cannot loop forever.

```txt
repeat  → RARE
while   → MYTHIC
```

## 8. Cooldowns

Some actions have cooldowns independent of code, and the interpreter always respects them.
`blink()` cannot be spammed just because a loop invokes it repeatedly. Cooldown is a property of
the **action**, not of the code path that requested it.

## 9. Mouse world position

GameMaker must convert device coordinates to world coordinates correctly, accounting for camera
transforms, view scaling and window scaling.

**There is exactly one canonical function** for retrieving the cursor's world position, and
every `mouse` reference in the language reads from it. Not `mouse_x`. Not a per-object
calculation. One function, one source of truth.

Getting this wrong produces a cursor that is subtly off at some resolutions, which would break
the game's single most important interaction on some players' machines and be nearly impossible
to diagnose from a bug report.

## 10. Determinism

Seeded RNG for room generation, reward rolls and enemy composition. This enables daily runs,
reproducible bug reports, and replay. Combat itself need not be frame-deterministic, but the
**run's content** must be reproducible from its seed.

Random damage ranges (`deal 1 to 8`) draw from the combat RNG stream, which is separate from the
content stream, so that fighting differently does not change what loot appears.
