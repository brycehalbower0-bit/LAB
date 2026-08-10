# Glossary

Binding vocabulary. Documents, code identifiers and UI text use these terms with exactly these
meanings.

| Term                      | Meaning                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Token**                 | One lootable piece of the language: a digit, word, reference, operator, structure, punctuation mark or function name.                                        |
| **Fragment**              | (1) Colloquially, a token. (2) The run currency. Where ambiguity matters, say "token" or "Fragments (currency)".                                             |
| **Code Inventory**        | The player's pouch of owned tokens, categorised and filterable.                                                                                              |
| **Owned token**           | A token in the Code Inventory. Usable in any compatible socket, any number of times, for the rest of the run.                                                |
| **Embedded token**        | A token present inside a function's definition that the player does not own. Executes normally; cannot be reused elsewhere.                                  |
| **Decompile**             | Extract an embedded token from a function into the Code Inventory, making it generally usable.                                                               |
| **Socket**                | A typed hole in a function where a token may be placed. Declared by the function template, never inferred.                                                   |
| **Semantic type**         | A value's kind: `NUMBER`, `ENTITY`, `POSITION`, `DIRECTION`, `BOOLEAN`, `ELEMENT`, `ACTION`, `CALL`, `STATEMENT`, `BLOCK`, `FUNCTION`.                       |
| **Semantic field**        | What a `NUMBER` socket means in the world: `range`, `damage`, `count`, `distance`, `duration`, `angle`. Drives cost curves and caps.                         |
| **Function**              | A spell. A named, editable AST bound to zero or more inputs.                                                                                                 |
| **Definition**            | The single editable body of a function. Shared by every binding that points at it.                                                                           |
| **Binding**               | A logical input slot pointing at a function definition by stable id.                                                                                         |
| **Firmware**              | Starter code that always works, is initially partially locked, and becomes editable over time.                                                               |
| **Logical input slot**    | A device-independent input identity (`INPUT_SLOT_W`, `INPUT_SLOT_PRIMARY`). Physical keys resolve into slots; bindings attach to slots.                      |
| **Accessibility mapping** | Which physical device input maps to which logical input slot. A settings concern, never a game mechanic.                                                     |
| **Magical binding**       | Which function a logical input slot invokes. A game mechanic, never a settings concern.                                                                      |
| **Spell Matrix**          | The editing screen: inputs, function code, and the Code Inventory.                                                                                           |
| **Test Chamber**          | The safe simulation room for verifying a build before combat.                                                                                                |
| **Edit permission**       | A tier of editing authority over a function: `EDIT_VALUE`, `EDIT_TOKEN`, `EDIT_STATEMENT_INS`, `EDIT_STATEMENT_MOVE`, `EDIT_STATEMENT_DEL`, `EDIT_FUNCTION`. |
| **Blank Function Core**   | The rare item granting creation of one custom function.                                                                                                      |
| **Spell skeleton**        | A partially-built function template with unfilled sockets, filled in by the player.                                                                          |
| **Memory**                | How much code a function may contain. A compile-time budget.                                                                                                 |
| **Cycles**                | How much work a function may perform per invocation. A runtime budget.                                                                                       |
| **Mana**                  | The magical cost of casting, derived from the AST and its socket values.                                                                                     |
| **Fiber**                 | One live execution instance of a function: program counter, node stack, remaining cycles, wait state.                                                        |
| **Action request**        | What a fiber emits. The character's action system executes requests according to windup, duration and cooldown.                                              |
| **Cycle exhaustion**      | A fiber stopping because its budget ran out. A normal, designed outcome — never an error.                                                                    |
| **Cost curve**            | The per-action data table mapping a socket's value to its mana, windup and cooldown contribution.                                                            |
| **Rarity**                | `COMMON`, `UNCOMMON`, `RARE`, `ARCANE`, `MYTHIC`. Reflects expressive power, not numeric magnitude.                                                          |
| **Contextual weighting**  | Biasing reward generation toward tokens that would fit the player's current code, without guaranteeing combos.                                               |
| **Reward preview**        | The hover display listing every socket in the player's current code that a token could occupy.                                                               |
| **Build card**            | The end-of-run summary artefact: bindings, custom functions, rarest token, counts.                                                                           |
| **Codex**                 | The permanent, cross-run record of every token ever discovered.                                                                                              |
| **Chassis**               | An alternate robot wizard with different base firmware, stats and initial sockets.                                                                           |
| **Run**                   | One attempt, from starter vocabulary to death or victory. Language is lost at its end; the codex is not.                                                     |
| **Biome**                 | One of four themed regions, each introducing a layer of the language.                                                                                        |
