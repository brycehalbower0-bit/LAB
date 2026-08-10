# 12 — Balance & Design Rules

**Status:** Normative

The rules a balance decision must not violate, and the signals that tell you whether the game is
working.

---

## 1. No required mythics

`while` must **never** be required for a successful run. It is a rare expressive toy and a power
spike, not a win condition. A skilled player wins with ordinary language.

The moment a community wiki says "you need `while` for the final boss", the game has failed —
because most runs will not have it, and most runs must still be winnable and interesting.

Test: every boss is beaten in internal playtests by a player using only starter firmware plus
common-tier tokens. If that is impossible, the boss is wrong, not the player.

## 2. Manual skill remains valuable

A player with:

```txt
WASD · slash() · bolt() · dash()
```

must remain capable of winning through good play. **Programming expands options; it does not
replace action skill.**

This is the guardrail against the game playing itself. Every proposed feature that reduces the
number of decisions the player makes per second is suspect.

## 3. Invalid vs impractical

Two different things, handled differently:

| Category                | Meaning                               | Response                                |
| ----------------------- | ------------------------------------- | --------------------------------------- |
| **Invalid**             | Grammar or type error                 | Reject, explain in plain language       |
| **Valid but expensive** | Compiles; high mana/memory/cycle cost | Accept, show the cost, let them keep it |

Never reject a creative build for being inefficient. `deal 8 to 88 damage` at 120 mana is a
legitimate object for a player to own and aspire to cast.

### 3.1 Player-caused mistakes are allowed

The compiler prevents crashes, not bad decisions. Permit:

- attacks that miss,
- movement in bad directions,
- healing enemies if the types permit it,
- expensive useless spells.

A player discovering their own spell is bad is a **good experience** — as long as undo, reset
and the Test Chamber mean the discovery is cheap.

## 4. Cleverness beats rarity

A clever low-rarity combination should **sometimes** outperform a pile of rare tokens. That is
the entire justification for a compositional system; if rarity strictly dominates, the game is a
loot ladder wearing a programming costume.

Concretely: two `1`s, a `+` and an `if` should be able to produce something a run with three
arcane tokens and no plan cannot.

## 5. Complexity has a cost, simplicity stays viable

**Simple code is viable.** A function as short as:

```txt
dash toward mouse
```

can remain excellent in the late game. Do not force every player into twenty-line functions.
Complexity is an **option**, not bureaucracy.

**Complexity has a cost.** Complex functions require memory, cycles, mana and rare edit
permissions. Those costs are what keep simple builds relevant without needing to nerf anything.

The two rules together produce the desired outcome: a player who wants to write an elaborate
`panic()` can, and a player who wants three sharp one-liners is not behind.

## 6. Failure signs

Red flags, in roughly increasing severity. Any of these appearing in playtests is a design
emergency, not a tuning issue.

- Everyone makes identical builds.
- Players only chase the largest numbers.
- Editing feels like a menu chore.
- Programming overwhelms the action.
- Players ignore control rebinding.
- Tokens feel like disguised stat upgrades.
- Rare syntax is required to win.
- One auto-combat function dominates.
- **The game plays itself.**
- Custom functions have no practical benefit.

The last three are existential. The others are recoverable.

## 7. Scope discipline

The language exists to create interesting controls and spells. Do not implement programming
concepts merely because real languages have them.

**Every syntax feature must answer:**

> What new combat or control behaviour does this let players invent?

| Feature    | Answer                                                                            | Verdict             |
| ---------- | --------------------------------------------------------------------------------- | ------------------- |
| `while`    | Sustained attacks, repeated movement, repeated sequences, conditional persistence | **Passes**          |
| `repeat`   | Bounded bursts; safer and easier to balance than `while`                          | **Passes**          |
| `else`     | One button, two behaviours chosen by the world                                    | **Passes**          |
| `random`   | Chaotic spell behaviour; ranges already exist in `deal 2 to 8`                    | **Probably passes** |
| `wait`     | Controllable sequences; useful before loops exist                                 | **Passes** (rare)   |
| `chance`   | Needs unambiguous percentage semantics first                                      | **Not MVP**         |
| Classes    | Nothing composition does not already give                                         | **Fails**           |
| Pointers   | No.                                                                               | **Fails**           |
| Exceptions | Failure is already "action skipped, cycle spent"                                  | **Fails**           |
| Arrays     | Only if target groups or projectile sets become central                           | **Deferred**        |

## 8. System count discipline

At launch, do **not** have tokens, sockets, edit permissions, memory, cycles, mana, hardware,
relics and ten currencies all competing for the player's attention simultaneously.

Introduce gradually — see
[doc 01 §10](01-core-loop-and-progression.md#10-economy-introduction-order):

```txt
Early   tokens · mana · health
Mid     + memory
Late    + cycles · edit permissions
```

## 9. Relics interact with code

If relics exist, tie them to language. Examples:

| Relic             | Effect                                                           |
| ----------------- | ---------------------------------------------------------------- |
| **Overflow Core** | Functions may exceed memory by 2, but cost extra mana            |
| **Hot Cache**     | The first function call after entering a room costs fewer cycles |
| **Mirror Rune**   | The first numeric replacement affects two compatible sockets     |
| **Open Port**     | Adds an additional programmable input                            |

Minimise generic `+10% damage` / `+5% movement speed` relics. They are permitted only where the
roguelite genuinely needs a basic power valve, and they should never be the interesting choice
on a reward screen.

## 10. Success metrics

The core system succeeds when playtesters **independently invent useful behaviours that were
never offered as predefined upgrades**:

- W follows the cursor.
- S retreats from the cursor.
- Space attacks near enemies and blinks otherwise.
- One player uses `8` for range while another uses it for damage — and both are right.
- A player creates a custom two-spell combo nobody suggested.
- A player uses `while` in an unexpected but valid way.

Detailed observation protocol in the [playtest plan](../roadmap/playtest-plan.md).

## 11. Programming education posture

The game may incidentally teach conditions, values, operators, functions, loops and abstraction.

It must **never feel like homework**. No terminology quizzes. No "well done, you have learned
about boolean logic!" No marketing it as "learn programming" — see
[doc 14 §3](14-marketing-and-community.md#3-store-description).

It is a game about expressive systems first. The education is a side effect, and it stays a side
effect.
