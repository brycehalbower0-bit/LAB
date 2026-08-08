/*
 * EmuCoreBridge.h — the Swift-visible surface of the EmuCore pod.
 *
 * core_api.h is pure C by design, so Swift consumes the ABI directly and
 * calls vtable function pointers itself; this header only has to declare
 * the per-core factory symbols (core_api.h documents the convention but
 * each core's accessor lives with the core, not the shared header).
 */

#ifndef EMU_CORE_BRIDGE_H
#define EMU_CORE_BRIDGE_H

#include "core_api.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Test/diagnostic core (Tests/CoreTests/null_core.c, vendored). */
const EmuCoreApi *emu_null_api(void);

/* GBA core (Cores/GBA/gba_core.c over vendored mGBA, MPL-2.0). */
const EmuCoreApi *emu_gba_api(void);

/* NDS core (Cores/NDS/nds_core.cpp over vendored melonDS, GPLv3). */
const EmuCoreApi *emu_nds_api(void);

/* 3DS core (Cores/3DS/adapter over vendored Azahar, GPL-2.0). Built by
   the podspec's CMake script phase, not the source glob. */
const EmuCoreApi *emu_3ds_api(void);

#ifdef __cplusplus
}
#endif

#endif /* EMU_CORE_BRIDGE_H */
