import { commandsToBase64 } from "../starprnt/starPrntBytes.js";

const ESC_INIT = [0x1b, 0x40];
/** ESC p m t1 t2 — drawer 1, ~50ms on, ~500ms off */
const DRAWER_KICK = [0x1b, 0x70, 0x00, 0x19, 0xfa];

/** ESC/POS cash drawer kick as base64 TCP payload. */
export function formatCashDrawerKickEscPos() {
  return commandsToBase64([...ESC_INIT, ...DRAWER_KICK]);
}
