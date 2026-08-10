# Playtest Plan

---

## 1. Do not ask "was it fun?"

That question produces politeness, not information. Observe behaviour, then ask about the
specific moments you saw.

## 2. What to observe

### Comprehension

- Did the player understand that `8` was a **reusable piece of language**, not a consumable?
- Did they immediately know where it could go?
- Did replacing the `2` feel meaningful, or like accepting a menu option?
- Did they understand that starter code could contain language they did not own?

### The pivotal moment

- Did modifying movement to reference the mouse create a visible **aha** moment?
- How long after acquiring `mouse` and `toward` did they try it?
- Did they discover it, or did they need to be told?

### Behaviour

- Did they experiment voluntarily?
- Did they **fear** breaking their build?
- Did undo and the Test Chamber resolve that fear?
- Did they spend too long editing?
- Did combat remain fun **without** editing?
- Did rare syntax feel exciting when it dropped?
- Did custom function creation feel understandable?

### The question that matters most

> **Did players create something the designers did not explicitly teach?**

Everything else is diagnostics. This one is the verdict.

## 3. Per-prototype focus

| Prototype                                                               | The one thing to watch                                           |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [0 — Number replacement](prototypes.md#prototype-0--number-replacement) | Whether the token reads as language or as a consumable           |
| [1 — Token inventory](prototypes.md#prototype-1--token-inventory)       | Whether choosing between `2`, `5` and `8` is a real decision     |
| [2 — Movement editing](prototypes.md#prototype-2--movement-editing)     | **The aha moment.** Time-to-discovery, and the reaction          |
| [3 — Multiple bindings](prototypes.md#prototype-3--multiple-bindings)   | Whether they rebind voluntarily; if not, why not                 |
| [4 — Conditions](prototypes.md#prototype-4--conditions)                 | Whether "one button, two behaviours" is understood               |
| [5 — Combat run](prototypes.md#prototype-5--combat-run)                 | Whether accumulation feels like progression                      |
| [6 — Function editing](prototypes.md#prototype-6--function-editing)     | Whether long code still reads as a spell                         |
| [7 — Custom function](prototypes.md#prototype-7--custom-function)       | Whether a non-programmer can author one unassisted               |
| [8 — `repeat`](prototypes.md#prototype-8--repeat)                       | Scheduling and action-queue correctness                          |
| [9 — `while`](prototypes.md#prototype-9--while)                         | Exploits, frame rate, and whether cycle exhaustion is understood |

## 4. Success signals

The core system is working when playtesters **independently invent useful behaviours that were
never offered as predefined upgrades**:

- W follows the cursor.
- S retreats from the cursor.
- Space attacks near enemies and blinks otherwise.
- One player uses `8` for range while another uses it for damage — and both are right.
- A player creates a custom two-spell combo nobody suggested.
- A player uses `while` in an unexpected but valid way.

Record these verbatim. They are also the game's marketing copy.

## 5. Failure signals

From [doc 12 §6](../docs/12-balance-and-design-rules.md#6-failure-signs). Watch for them
explicitly rather than hoping they do not appear:

- everyone makes identical builds,
- players only chase the largest numbers,
- editing feels like a menu chore,
- programming overwhelms the action,
- players ignore control rebinding,
- tokens feel like disguised stat upgrades,
- rare syntax is required to win,
- one auto-combat function dominates,
- **the game plays itself**,
- custom functions have no practical benefit.

## 6. Recruiting

Test with **both** groups, separately, and compare:

| Group               | What they reveal                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Non-programmers** | Whether the editor reads as magic. If they bounce, the framing is wrong.                 |
| **Programmers**     | Whether the language is expressive enough to be interesting, and where the exploits are. |

Programmers will find the exploits and will forgive bad framing. Non-programmers will find the
framing problems and will not find the exploits. Both findings are necessary, and neither group
substitutes for the other.

A non-programmer completing [Prototype 2](prototypes.md#prototype-2--movement-editing) unassisted
is the strongest signal available that this game works.
