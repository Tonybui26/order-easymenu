/**
 * @typedef {'idle' | 'cart'} CustomerDisplayMode
 */

/**
 * @typedef {Object} CustomerDisplayCartLine
 * @property {string} id
 * @property {string} name
 * @property {number} quantity
 * @property {number} unitPrice
 * @property {number} lineTotal
 * @property {string[]} [options]
 */

/**
 * @typedef {Object} CustomerDisplayCartPayload
 * @property {CustomerDisplayMode} mode
 * @property {CustomerDisplayCartLine[]} [lines]
 * @property {number} [subtotal]
 * @property {number} [discountAmount]
 * @property {number} [total]
 */

/**
 * @typedef {Object} CustomerDisplayAvailableResult
 * @property {boolean} available
 */

/**
 * @typedef {Object} CustomerDisplayOpenOptions
 * @property {string} url - Absolute URL for the rear WebView (e.g. origin + /customer-display).
 * @property {boolean} [forceReload] - Reload even when the same URL is already showing.
 */

/**
 * @typedef {Object} CustomerDisplayPlugin
 * @property {() => Promise<CustomerDisplayAvailableResult>} isAvailable
 * @property {(options: CustomerDisplayOpenOptions) => Promise<void>} open
 * @property {(payload: CustomerDisplayCartPayload) => Promise<void>} updateCart
 * @property {() => Promise<void>} close
 */

export {};
