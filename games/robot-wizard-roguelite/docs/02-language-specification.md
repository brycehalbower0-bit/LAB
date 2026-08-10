# 02 — Language Specification

**Status:** Normative. This is the kernel every other document depends on.

The language has no official name yet; candidates in
[doc 14 §4](14-marketing-and-community.md#4-naming-the-language). Internally it is referred to
as **the language**.

---

## 1. Design constraints

The language is not designed to be a good general-purpose programming language. It is designed
to satisfy five constraints, in priority order:

1. **Every visible piece must be lootable.** If the player can point at something in the code,
   it must be possible for that thing to be a token they found. Syntax where one hidden parser
   construct represents many invisible concepts is forbidden.
2. **Type compatibility must be obvious at a glance.** A player must be able to predict whether
   a drag will be accepted before they try it.
3. **It must read like a spell, not like Python.** Flavour beats convention wherever the two
   conflict and the meaning is preserved.
4. **It must be bounded.** No construct may freeze, crash, or produce unbounded work.
5. **It must never be text.** Spells are ASTs. Displayed syntax is a rendering.

## 2. The parenthesis rule

There is exactly one punctuation rule the player must learn, and it is taught by example:

> **Parentheses mean invocation.** Something with `()` computes or does something.
> Everything else is a plain word.

Consequently:

| Form                 | Meaning                               |
| -------------------- | ------------------------------------- |
| `slash()`            | call the function `slash`             |
| `enemy range()`      | query the `range` property of `enemy` |
| `toward mouse`       | a direction, built from a reference   |
| `deal 1 to 2 damage` | an action with two numeric sockets    |

This resolves the grammar ambiguity left open in early drafts: **queries and calls take
parentheses; direction and target chains do not.** `move toward mouse` is the normative form,
not `move(toward(mouse position()))`. The parenthesised form is more familiar to programmers
and less readable to everyone else, and readability wins (constraint 3).

## 3. Semantic types

Every token, expression and socket carries a semantic type. Sockets accept a type; drag-and-drop
compatibility is a type check and nothing more.

| Type        | Meaning                                 | Produced by                                      |
| ----------- | --------------------------------------- | ------------------------------------------------ |
| `NUMBER`    | A scalar value                          | digit literals, arithmetic, numeric queries      |
| `ENTITY`    | A resolvable actor in the world         | `enemy`, `player`, `boss`, `projectile`          |
| `POSITION`  | A world point                           | `mouse`, `X position()`, `click position()`      |
| `DIRECTION` | A normalised heading                    | `up`/`down`/`left`/`right`, `toward X`, `away X` |
| `BOOLEAN`   | A truth value                           | comparisons, `and`/`or`/`not`, `X held()`        |
| `ELEMENT`   | A damage flavour                        | `physical`, `fire`, `ice`, `shock`, `void`       |
| `ACTION`    | A world-affecting statement             | `deal`, `move`, `dash`, `heal`, `push`, `shield` |
| `CALL`      | An invocation of a function             | `slash()`, `rush()`                              |
| `STATEMENT` | `ACTION` \| `CALL` \| control structure | —                                                |
| `BLOCK`     | An ordered list of statements           | function bodies, branch bodies                   |
| `FUNCTION`  | A callable spell, as a bindable object  | the spellbook                                    |

`NUMBER` additionally carries a **semantic field** when it sits in a socket (`range`,
`damage`, `count`, `distance`, `duration`, `angle`). The field does not affect type
compatibility — every `NUMBER` fits every `NUMBER` socket — but it drives cost curves and
caps. See [§9](#9-numeric-caps-and-safety).

### 3.1 Coercion

Exactly **one** implicit coercion exists:

```txt
ENTITY → POSITION      (an entity resolves to its current position)
```

This is what makes `toward enemy` work without a `position()` query, and it is the only
implicit conversion in the language. Everything else is explicit.

`POSITION → DIRECTION` is deliberately **not** implicit. It requires `toward` or `away`. This
is load-bearing: it is the reason finding `toward` is an event
([doc 00 §6.1](00-vision-and-pillars.md#61-the-four-aha-moments-in-order)) rather than a
formality. If `move mouse` worked, the second aha moment would not exist.

### 3.2 Type display

Tokens are shaped by category, not only coloured, so the type system survives colour-blindness
and small pixel sizes. See [doc 10 §4](10-art-audio-and-presentation.md#4-token-visuals).

## 4. Grammar

Normative display grammar. Indentation denotes blocks; there are no braces and no semicolons.

```ebnf
function     ::= name "()" ":" NEWLINE block

block        ::= INDENT statement+ DEDENT

statement    ::= action | call | if_stmt | repeat_stmt | while_stmt | break_stmt

if_stmt      ::= "if" condition NEWLINE block [ "else" NEWLINE block ]
repeat_stmt  ::= "repeat" expr NEWLINE block
while_stmt   ::= "while" condition NEWLINE block
break_stmt   ::= "break"

call         ::= name "()"

action       ::= verb operand*
operand      ::= expr | direction | target | element | keyword

condition    ::= comparison
               | condition ("and" | "or") condition
               | "not" condition
               | predicate

comparison   ::= expr ("<" | "<=" | ">" | ">=" | "==") expr
predicate    ::= reference property "()"          (* BOOLEAN-typed query *)

expr         ::= number | query | expr ("+" | "-" | "*" | "/" | "%") expr
number       ::= digit+ [ "." digit+ ]
query        ::= reference property "()"          (* NUMBER-typed query *)

direction    ::= "up" | "down" | "left" | "right"
               | ("toward" | "away") target
target       ::= reference | query
reference    ::= "enemy" | "player" | "mouse" | "boss" | "projectile" | "exit" | "pickup" | "wall"
element      ::= "physical" | "fire" | "ice" | "shock" | "void"
```

Every terminal in that grammar is a **token the player can hold in their hands**. That is the
point of writing it this way.

### 4.1 Canonical example

```txt
slash():

    if enemy range() <= 3
        deal 1 to 2 damage
```

This is the reference style for all documents, mockups and marketing.

### 4.2 More examples

```txt
W:
    move toward mouse
```

```txt
rush():

    dash toward mouse
    slash()
```

```txt
panic():

    if enemy range() <= 3
        while enemy range() <= 3
            slash()
    else
        blink toward mouse
```

```txt
burst():

    repeat 3
        bolt toward mouse
```

### 4.3 Selectors

`enemy` alone means **the nearest enemy** — that is the default resolution and it is stated in
the tooltip. `nearest` and `farthest` are separate tokens that make the selection explicit and
enable the non-default choice:

```txt
if farthest enemy range() >= 8
```

Making `nearest` a token the player can find, when its behaviour was already the default,
would be a bad drop. So `nearest` is only interesting **paired with** `farthest` entering the
pool at the same rarity. They ship together or not at all.

## 5. Node registry

The AST node kinds. Every one maps to a switch case in the interpreter; nothing is dispatched
by string name. See [doc 11 §5](11-gamemaker-architecture.md#5-never-execute-strings).

```txt
NODE_BLOCK          ordered statement list
NODE_IF             condition, then-block, optional else-block
NODE_WHILE          condition, body
NODE_REPEAT         count expression, body
NODE_BREAK          —
NODE_CALL           function_id
NODE_ACTION         action_id, operand list
NODE_LITERAL        number value
NODE_REFERENCE      reference_id
NODE_QUERY          reference_id, property_id
NODE_BINARY_OP      operator_id, left, right
NODE_UNARY_OP       operator_id, operand
NODE_DIRECTION      direction_id | (toward|away, target)
NODE_ELEMENT        element_id
NODE_EMPTY          an unfilled socket (valid to hold, invalid to execute)
```

`NODE_EMPTY` is important: a function containing an empty socket must still **save, display and
compile-with-warning**, because the player will frequently open a statement slot before they
own anything to put in it.

### 5.1 Node shape

```txt
{
    node_type   : NODE_ACTION,
    action_id   : ACTION_DEAL_DAMAGE,
    operands    : [ <node>, <node>, <node> ],
    socket_ids  : [ "damage_min", "damage_max", "element" ],
    embedded    : true            // came with the function; not owned by the player
}
```

## 6. Registries

All identifiers are enum-like constants. Content is data-driven
([doc 11 §6](11-gamemaker-architecture.md#6-data-driven-content)), but the registries below are
code-level enums so the interpreter can switch on them.

### 6.1 Actions

```txt
ACTION_DEAL_DAMAGE      deal <NUMBER> to <NUMBER> [<ELEMENT>] damage
ACTION_MOVE             move <DIRECTION>
ACTION_DASH             dash <DIRECTION>
ACTION_BLINK            blink <DIRECTION>
ACTION_BOLT             bolt <DIRECTION>
ACTION_SPARK            spark <DIRECTION>
ACTION_PUSH             push <ENTITY> <NUMBER>
ACTION_PULL             pull <ENTITY> <NUMBER>
ACTION_HEAL             heal <ENTITY> <NUMBER>
ACTION_SHIELD           shield <NUMBER>
ACTION_WAIT             wait <NUMBER>
```

### 6.2 References

```txt
REF_PLAYER              the caster
REF_ENEMY               nearest hostile (default resolution)
REF_BOSS                the room's boss, if any
REF_MOUSE               the world cursor
REF_PROJECTILE          nearest hostile projectile
REF_EXIT                the room exit
REF_PICKUP              nearest pickup
REF_WALL                nearest wall surface
```

### 6.3 Properties

Properties are queried as `reference property()`. The returned type depends on the property,
not the reference.

```txt
PROP_RANGE       → NUMBER      distance from the caster
PROP_POSITION    → POSITION
PROP_DIRECTION   → DIRECTION
PROP_HEALTH      → NUMBER
PROP_MANA        → NUMBER
PROP_SPEED       → NUMBER
PROP_COUNT       → NUMBER      how many of this reference exist in the room
PROP_HELD        → BOOLEAN     (input references only)
```

Not every property is valid on every reference. `mouse health()` does not typecheck and the
socket will not light up. The validity matrix lives in `data/references.json`.

### 6.4 Operators

```txt
OP_LT  <     OP_LTE <=    OP_GT  >     OP_GTE >=    OP_EQ ==
OP_ADD +     OP_SUB -     OP_MUL *     OP_DIV /     OP_MOD %
OP_AND and   OP_OR  or    OP_NOT not
```

### 6.5 Structures

```txt
NODE_IF · NODE_ELSE · NODE_REPEAT · NODE_WHILE · NODE_BREAK
```

`else` is not a node kind of its own; it is the optional second block of `NODE_IF`. It is
nonetheless a **separate loot token**, because losing that would make the `else` drop
unrepresentable in the inventory. Owning `else` grants permission to attach an else-block to an
`if` the player can already edit.

## 7. Sockets

A socket is a typed hole in a function definition. Sockets are declared by the function
template, not inferred.

```txt
{
    id             : "damage_max",
    accepts        : NUMBER,
    field          : FIELD_DAMAGE,
    default        : 2,
    min            : 0,
    max            : 999,
    edit_level     : EDIT_VALUE,
    label          : "damage ceiling"
}
```

`edit_level` is the permission tier required to touch it, from
[doc 04 §4](04-functions-and-editing.md#4-edit-permissions-as-loot):

```txt
EDIT_VALUE          replace a literal with an owned literal
EDIT_TOKEN          replace any compatible token
EDIT_STATEMENT_INS  insert a statement here
EDIT_STATEMENT_MOVE reorder statements
EDIT_STATEMENT_DEL  delete a statement
EDIT_FUNCTION       full structural editing
```

## 8. Validation pipeline

Runs on **every** AST mutation, before the change is committed to the live function. Stages run
in order; the first failing stage produces the error message and the drag is rejected.

```txt
AST changed
    ↓
1. Grammar validation      — is this a well-formed tree for its node kind?
    ↓
2. Type validation         — does every operand satisfy its socket's accepted type?
    ↓
3. Ownership validation    — may the player legally place this token here?
    ↓
4. Recursion validation    — does the call graph contain a cycle?
    ↓
5. Memory validation       — does the function fit its memory budget?
    ↓
6. Safety validation       — provable divide-by-zero, unbounded loops, cap violations
    ↓
7. Cost calculation        — mana, cycles, windup, cooldown (never fails; only reports)
    ↓
COMPILE
```

Stages 1–6 can reject. Stage 7 **never rejects** — a spell that costs more mana than the player
has is a valid spell that cannot currently be cast. See
[doc 12 §3](12-balance-and-design-rules.md#3-invalid-vs-impractical).

### 8.1 Ownership validation

A node is legal in a function if **any** of:

- it is **embedded** — it came with the function definition and has not been moved;
- the player **owns** the corresponding token in the Code Inventory;
- the function **intrinsically grants** it (e.g. a template that ships with its own `if`).

This three-way rule is what allows starter functions to contain vocabulary the player has never
seen. It is the single most important rule in the validator.

### 8.2 Recursion validation

Direct and indirect recursion are rejected:

```txt
doom():
    doom()
```

```txt
Recursive function calls are not supported.
```

The check is a cycle detection over the call graph, run on every call-node insertion. Mutual
recursion (`a → b → a`) must be caught, not just self-reference.

## 9. Numeric caps and safety

Every semantic field has a hard clamp. Players edit numbers directly, so the interpreter can
never assume a sane value.

| Field      | Range | Notes                                    |
| ---------- | ----- | ---------------------------------------- |
| `range`    | 0–20  | 0 is legal and means "touching"          |
| `damage`   | 0–999 |                                          |
| `count`    | 0–20  | projectile counts, repeat counts         |
| `distance` | 0–30  | dash/blink distance                      |
| `duration` | 0–5 s | waits, shield durations                  |
| `angle`    | 0–360 |                                          |
| `repeat`   | 0–20  | additionally bounded by the cycle budget |

Rules:

- **Clamp on compile, not on execute.** The player sees the clamped value in the editor with a
  "capped" marker, so the cap is never a hidden surprise mid-fight.
- **Division by zero.** If the denominator is a literal `0`, compile fails with
  `This expression can divide by zero.` If it is a runtime value, the operation yields `0` and
  logs to the debug overlay. It never crashes and never produces infinity or NaN.
- **Overflow.** All arithmetic is clamped to the field cap after every operation, not only at
  the end. `9 * 9 * 9` in a `range` socket is `20`, not `729`.
- **Zero is not an error.** Zero range, zero delay, zero damage are all legal and occasionally
  useful. Do not protect the player from them.

## 10. Weird-but-valid code

The compiler prevents crashes, not bad decisions. If types permit it, it compiles:

```txt
heal enemy 8
```

That is legal (`heal` takes `ENTITY` and `NUMBER`; `enemy` is an `ENTITY`). It is usually a
terrible idea and occasionally brilliant. Ship it.

Permitted and unprotected:

- attacks that miss,
- movement in bad directions,
- healing enemies,
- expensive useless spells,
- functions that cannot afford to cast.

Forbidden absolutely:

- crashes, hangs, NaN, infinite loops,
- arbitrary GML execution,
- silently different behaviour from what the code displays.

## 11. Tooltips are truth

If a tooltip says `toward` converts a target or position into a direction, then `toward` works
**everywhere a direction is accepted**, with no exceptions and no hidden special cases. The
system's strength is consistency; emergence must come from composition, not from undocumented
recipes.

Avoid special-case interactions. If a combination needs a bespoke rule to work, that is
evidence the type system is wrong, not that the combination needs a patch.

## 12. Versioning

Serialized ASTs carry `save_version` and `language_version`. A language change that alters node
semantics bumps `language_version` and ships a migration. Saved runs from an older language
version are migrated on load or, if migration is impossible, retired with an explicit message —
never silently reinterpreted. See
[doc 11 §8](11-gamemaker-architecture.md#8-serialization).

## 13. Deliberately excluded

Every proposed feature must answer: **what new combat or control behaviour does this let
players invent?** These do not answer it:

| Feature                     | Verdict  | Reason                                                                                     |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| Classes / objects           | Excluded | No combat behaviour it enables that composition doesn't                                    |
| Pointers / references-to    | Excluded | No.                                                                                        |
| Exceptions                  | Excluded | Failure is already modelled as "action skipped, cycle spent"                               |
| Arrays / lists              | Deferred | Only if target groups or projectile sets become central                                    |
| Custom parameters           | Deferred | Deep endgame / sandbox only — see [doc 04 §7.4](04-functions-and-editing.md#74-parameters) |
| Persistent variables        | Deferred | Enormous complexity; revisit only after `while` ships                                      |
| Parallel execution (`with`) | Deferred | No demonstrated need                                                                       |

`while` **does** pass the test — it enables sustained attack behaviour, repeated movement,
repeated sequences and conditional persistence. That is why it is in the language despite the
implementation cost.
