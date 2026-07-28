import { STAR_PRNT, commandsToBase64 } from "../starprnt/starPrntBytes.js";

/** StarPRNT BEL — open cash drawer on mC-Print and compatible Star receipt printers. */
const STAR_DRAWER_KICK = [0x1b, 0x07];

/** StarPRNT cash drawer kick as base64 TCP payload. */
export function formatCashDrawerKickStarPrnt() {
  return commandsToBase64([...STAR_PRNT.INIT, ...STAR_DRAWER_KICK]);
}
