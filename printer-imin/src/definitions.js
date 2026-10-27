/**
 * PrinterImin Capacitor plugin — iMin built-in printer transport for raw ESC/POS bytes.
 * Android only (Swan 2 and other SDK 2.0 terminals).
 */

export const PrinterIminPlugin = {
  /**
   * Bind the iMin print service once and return a connection id.
   * Later connects reuse the same service.
   * @returns {Promise<{ connectionId: string, success: boolean, productName?: string }>}
   */
  connect: () => Promise.resolve(),

  /**
   * Write raw bytes to the built-in printer.
   * @param {{ connectionId: string, data: string, encoding?: 'base64'|'utf8' }} options
   */
  send: (options) => Promise.resolve(),

  /**
   * Drop the connection id. Does not unbind the print service.
   * @param {{ connectionId: string }} options
   */
  disconnect: (options) => Promise.resolve(),
};
