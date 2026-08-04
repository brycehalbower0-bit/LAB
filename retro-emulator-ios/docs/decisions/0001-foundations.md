# ADR 0001 — Founding decisions

Status: accepted (2026-08-04)

Decisions made during planning, recorded so they are argued with by
amending this file rather than re-litigated ad hoc. Full reasoning lives
in PLAN.md; this is the ledger.

## D1. Three systems, one app, three cores

GBA + NDS + 3DS behind one app shell, one shared C ABI
(`Cores/Shared/include/core_api.h`). Per-system differences are expressed
as `core_describe()` data, not shell branches. (PLAN.md §5)

## D2. Adapt existing cores; NDS core is melonDS

- GBA: mGBA (MPL-2.0)
- NDS: **melonDS** (GPLv3) — set by project direction
- 3DS: Panda3DS preferred, Citra-lineage forks as fallback; final call at
  integration time with a license re-check. (PLAN.md §4, §6.3)

Combined GPL/MPL compliance is handled once, as one plan (source offer
covering all cores, unified notices screen), before store submission.

## D3. Swappable CPU backends; interpreter is the App Store path

Every core's CPU sits behind `Cores/Shared/include/cpu_backend.h` with
interpreter and (where available) JIT implementations selected at build
time. App Store builds are interpreter-only — no runtime code generation.
Sideload/EU-marketplace builds may enable JITs. Save states serialize
architectural state only, so they are portable across backends.
(PLAN.md §6.4)

## D4. Device floor: iPhone 15 / A16, one floor for the whole app

Performance targets in PLAN.md §1.1 are commitments measured on a physical
iPhone 15 (non-Pro). Numbers measured elsewhere are directional only.

## D5. Decrypted-only content; zero key handling

Cores contain no key material handling and no decryption paths — encrypted
content is rejected (`EMU_ERR_ENCRYPTED_CONTENT`), never decrypted, and
key-handling code inherited from upstream cores is stripped, not left
dormant. This removes the DMCA §1201 theory that ended Yuzu. (PLAN.md §2.1)

## D7. Interim app shell: Expo/React Native, with a native hot path

The shell (`App/`) is Expo/React Native for the time being, because EAS
Build provides cloud-Mac iOS builds — device builds (including the §10.3
floor-device benchmark) without local Apple hardware. Constraints that
keep this reversible and safe: cores stay native C/C++ behind the shared
ABI; JS never sits on the frame/audio hot path (Metal rendering, audio,
and touch-overlay input are native modules); a later SwiftUI rewrite
would carry the native modules and cores over unchanged. (PLAN.md §8)

## D6. The ARM11 spike's directional result stands

First measurement (Linux container, shared x86_64 core, zero ARM64
optimizations): block-cached dispatch is 2.3–3.0× naive and reaches
0.76–0.91× of the 268-MIPS 1:1 bar. Conclusion: the no-JIT path is a
serious engineering candidate, not a hail-mary. The binding measurement —
this harness on a physical iPhone 15 — is the next gate and will be
recorded as its own ADR. (Spikes/arm11-interp/)
