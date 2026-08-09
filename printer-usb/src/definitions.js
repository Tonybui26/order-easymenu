/**
 * PrinterUsb Capacitor plugin — Android USB host transport for raw ESC/POS bytes.
 *
 * Default connect() auto-picks the plugged-in printer (POS flow). Optional
 * vendorId/productId still supported for advanced targeting.
 */

export const PrinterUsbPlugin = {
  /**
   * List attached USB devices (printer class preferred; also returns other devices).
   * @returns {Promise<{ devices: Array<{
   *   vendorId: number,
   *   productId: number,
   *   deviceName: string,
   *   productName?: string,
   *   manufacturerName?: string,
   *   serialNumber?: string,
   *   hasPermission: boolean,
   *   isPrinterClass: boolean
   * }> }>}
   */
  listDevices: () => Promise.resolve(),

  /**
   * Open USB device and claim bulk OUT endpoint.
   * @param {{ vendorId: number, productId: number, serialNumber?: string }} options
   * @returns {Promise<{ connectionId: string, success: boolean }>}
   */
  connect: (options) => Promise.resolve(),

  /**
   * Write raw bytes to the open USB connection.
   * @param {{ connectionId: string, data: string, encoding?: 'base64'|'utf8' }} options
   */
  send: (options) => Promise.resolve(),

  /**
   * Release interface and close connection.
   * @param {{ connectionId: string }} options
   */
  disconnect: (options) => Promise.resolve(),

  /**
   * Force-close all open USB printer connections.
   */
  resetAll: () => Promise.resolve(),

  getStatus: () => Promise.resolve(),
};
