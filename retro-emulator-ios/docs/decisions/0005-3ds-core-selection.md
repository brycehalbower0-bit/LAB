# ADR 0005 — 3DS core selection: Azahar

Status: accepted (2026-08-06)

ADR 0001-D2 deferred the 3DS core's final call to integration time with
a license re-check; PLAN.md §6.3 provisionally preferred Panda3DS with
Lime3DS/Azahar as fallback. Verified against the live repositories at
selection time:

| | Panda3DS | Azahar (Citra lineage) |
|---|---|---|
| License today | **GPL-3.0** (§6.3's "more permissive licensing" note is outdated) | GPL-2.0 |
| CPU backends | `cpu_dynarmic.cpp` only — **no interpreter exists** | **dyncom interpreter (ARM + Thumb) and dynarmic JIT**, both behind `ARM_Interface` |
| Rendering | OpenGL, PICA shader interpreter | OpenGL + Vulkan + **software rasterizer** (correctness reference) |
| Maturity | younger project | Citra-lineage compatibility, active |

## Decision

**Azahar**, because the two facts §6.3 based its preference on inverted
under verification:

1. The "cleaner CPU separation" credited to Panda3DS turns out to be a
   single backend — and it's a JIT. An App Store build of Panda3DS
   cannot execute one guest instruction until our custom backend exists.
   Azahar ships exactly the two-backend architecture §6.4 mandates,
   already wired: the App Store channel boots real games from day one on
   dyncom (slow — it's a correctness fallback, which is fine for the
   bring-up baseline), while the optimized no-JIT backend grown from the
   ARM11 spike (ADR 0002) replaces it behind the same seam.
2. The licensing advantage evaporated: both candidates are GPL. §2's
   combined compliance plan (source offer, notices screen) covers either
   identically.

Azahar's software rasterizer additionally gives Phase 3 the same
correctness-first GPU path that worked for NDS bring-up, deferring the
PICA200→Metal/MoltenVK decision until the CPU picture is known — the
sequencing §6.3 requires.

Costs accepted with this choice: the heaviest dependency graph of any
vendored core (Boost subset, cryptopp, etc. — vendoring will take
iteration), and Citra-lineage key/decryption machinery that MUST be
stripped, not disabled, per §2.1's hard constraint. "Builds and boots
with zero key material handling compiled in" is a Phase 3 acceptance
criterion (§6.3), and dyncom's correctness gets audited for free by the
co-simulation harness planned for the production backend.

Pinned snapshot: latest stable release tag at vendoring time, recorded
in `Cores/3DS/README.md`.
