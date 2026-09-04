import { commandsToBase64 } from "../starprnt/starPrntBytes.js";

const ESC_INIT = [0x1b, 0x40];
/** ESC p m t1 t2 — ~50ms on, ~500ms off. m=0 pin 2, m=1 pin 5 (cover both wirings). */
const DRAWER_KICK_PIN2 = [0x1b, 0x70, 0x00, 0x19, 0xfa];
const DRAWER_KICK_PIN5 = [0x1b, 0x70, 0x01, 0x19, 0xfa];

/** ESC/POS cash drawer kick as base64 TCP payload. */
export function formatCashDrawerKickEscPos() {
  return commandsToBase64([
    ...ESC_INIT,
    ...DRAWER_KICK_PIN2,
    ...DRAWER_KICK_PIN5,
  ]);
}
