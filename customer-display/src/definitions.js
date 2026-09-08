/**
 * @typedef {Object} CustomerDisplayAvailableResult
 * @property {boolean} available - True when Android reports a secondary/presentation display.
 */

/**
 * @typedef {Object} CustomerDisplayPlugin
 * @property {() => Promise<CustomerDisplayAvailableResult>} isAvailable
 * @property {() => Promise<void>} open - Show idle Welcome UI on the secondary display (no-op if none).
 * @property {() => Promise<void>} close - Dismiss the secondary Presentation if open.
 */

export {};
