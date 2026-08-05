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

#ifdef __cplusplus
}
#endif

#endif /* EMU_CORE_BRIDGE_H */
