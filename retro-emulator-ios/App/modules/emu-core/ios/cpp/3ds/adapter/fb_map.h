// Mapping between the software renderer's screen buffer and the
// landscape RGBA frame the shell draws.
//
// This lives in its own header because getting it wrong is silent: the
// contract test asserts the video buffer's pointer and dimensions, not
// its contents, so a transposed read shipped to a device and looked
// like emulator noise rather than an adapter bug.
//
// Upstream (RendererSoftware::LoadFBToScreenInfo) writes one RGBA8 pixel
// per framebuffer coordinate at:
//
//     (fb_x * info.height + fb_y) * 4,  fb_x < info.width,
//                                       fb_y < info.height
//
// Read linearly, fb_y varies fastest over info.height, so the buffer is
// already landscape: rows of info.height pixels, info.width rows tall.
// A landscape pixel (x, y) therefore lives at (y * info.height + x).

#ifndef C3DS_FB_MAP_H
#define C3DS_FB_MAP_H

#include <stddef.h>
#include <stdint.h>

/** Landscape frame width, in pixels, for a given ScreenInfo. */
static inline uint32_t c3ds_fb_width(uint32_t info_w, uint32_t info_h) {
    (void)info_w;
    return info_h;
}

/** Landscape frame height, in pixels, for a given ScreenInfo. */
static inline uint32_t c3ds_fb_height(uint32_t info_w, uint32_t info_h) {
    (void)info_h;
    return info_w;
}

/** Index (in pixels, not bytes) of landscape (x, y) in ScreenInfo::pixels. */
static inline size_t c3ds_fb_index(uint32_t x, uint32_t y, uint32_t info_w,
                                   uint32_t info_h) {
    (void)info_w;
    return (size_t)y * info_h + x;
}

/**
 * Where upstream writes framebuffer coordinate (fb_x, fb_y). The test
 * asserts c3ds_fb_index agrees with this for every pixel; if upstream's
 * formula ever changes, that assertion is what catches it.
 */
static inline size_t c3ds_fb_upstream_index(uint32_t fb_x, uint32_t fb_y,
                                            uint32_t info_w, uint32_t info_h) {
    (void)info_w;
    return (size_t)fb_x * info_h + fb_y;
}

#endif /* C3DS_FB_MAP_H */
