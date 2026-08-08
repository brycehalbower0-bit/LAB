# ADR 0007 — A commercial 3DS title runs on device

Status: accepted
Date: 2026-08-08

## Context

ADR 0006 recorded the 3DS core booting headless in CI with zero code
generation and zero key material. That proved the embedding worked; it
did not prove a real game would run, because the CI test boots a
synthetic ARM ELF that draws nothing.

## Decision / outcome

Pokémon X (USA), a decrypted `.3ds` cartridge dump, boots on an
iPhone 17 Pro and renders its language-select screen correctly on both
screens: 400x240 top, 320x240 bottom, correct colours and geometry.

**First measured rate: 11.6 fps at 1x, 0 audio drops.**

That is the correctness baseline PLAN.md §6.3 asks for — dyncom
interpreter plus software rasterizer, no JIT anywhere, no console keys
compiled in. It is 19% of the 60 fps bar. Everything in
`docs/playable-3ds-plan.md` is measured against this number.

## What actually blocked it

A transposed read of the software renderer's screen buffer, in our
adapter — not in Azahar.

`RendererSoftware::LoadFBToScreenInfo` writes RGBA8 at
`(fb_x * info.height + fb_y)`. Read linearly, `fb_y` varies fastest, so
the buffer is already landscape: rows of `info.height` pixels,
`info.width` rows tall. `c3ds_get_video` indexed it as
`(x * info.height + y)`, which both transposed the image and put
57600 of 172800 pixels past the end of the buffer.

The result on device was full-screen colour noise. It survived CI
because the contract test asserts the video buffer's pointer and
dimensions, never its contents, and the synthetic ELF renders nothing
for it to check. Fixed in `fb_map.h`, which is now asserted
exhaustively against upstream's write formula for both screens — a test
that needs no rendered image, and so works with the synthetic ROM.

## A wrong call worth recording

The noise came with the frame pacer pinned at its cap (240 fps under 4x
fast-forward). That was read as proof the guest was not executing at
all, since an interpreter plus a software rasterizer cannot run a
commercial title at that rate. Real cause: early boot genuinely does
very little work, and the pacer was reporting exactly that. Once the
title reached its first rendered screen the rate fell to 11.6 fps.

The lesson is not "look harder" — the reasoning about interpreter cost
was sound. It is that **frame rate alone cannot distinguish a stalled
guest from a cheap one**, which is why `diagnostics()` now reports
ticks/frame against the ~4.5M a 60 fps guest needs, plus RunLoop status,
frames ending without a vblank, guest PC, running process, LCD
framebuffer registers, and the tail of Azahar's own log. Had that
existed, the misread would have lasted one screenshot rather than a
build cycle.

## Consequences

- Phase 3's exit criterion is no longer blocked on "does it run" but on
  "how fast" — the optimization ladder in `docs/playable-3ds-plan.md`
  now has a real baseline to ratchet against.
- The 11.6 fps figure is from an iPhone 17 Pro, so it is directional,
  not binding. The floor device (iPhone 15) measurement is still owed,
  same standing obligation as ADR 0002.
- In-game rates (overworld, battle) are not yet measured; the
  language-select screen is close to a best case.

## Verification

On-device: title boots from a decrypted `.3ds`, both screens render,
fps badge reads 11.6 at 1x with 0 audio drops.
CI: 3DS core job green, including the new framebuffer mapping
assertions.
