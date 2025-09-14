/**
 * PrinterTcpSocket Plugin Definitions
 *
 * This file defines the interface for our custom TCP socket plugin.
 * It specifies what methods are available and what parameters they expect.
 *
 * Think of this as a "contract" - it tells TypeScript and developers
 * what functions they can call and what to expect back.
 */

/**
 * Main plugin interface
 * This defines all the methods our plugin will provide
 */
export const PrinterTcpSocketPlugin = {
  /**
   * Connect to a printer with proper timeout handling
   *
   * @param {Object} options - Connection parameters
   * @param {string} options.ipAddress - IP address of the printer (e.g., "192.168.1.100")
   * @param {number} options.port - Port number (usually 9100 for printers)
   * @param {number} [options.timeoutMs=5000] - Connection timeout in milliseconds
   * @returns {Promise<Object>} Promise that resolves to connection result
   */
  connect: options => Promise.resolve(),

  /**
   * Send data to the printer
   *
   * @param {Object} options - Send parameters
   * @param {string} options.connectionId - ID returned from connect()
   * @param {string} options.data - Data to send (usually base64 encoded ESC/POS commands)
   * @param {string} [options.encoding='base64'] - Data encoding ('base64' or 'utf8')
   * @returns {Promise<void>} Promise that resolves when data is sent
   */
  send: options => Promise.resolve(),

  /**
   * Disconnect from printer with guaranteed cleanup
   *
   * @param {Object} options - Disconnect parameters
   * @param {string} options.connectionId - ID returned from connect()
   * @returns {Promise<void>} Promise that resolves when disconnected
   */
  disconnect: options => Promise.resolve(),

  /**
   * Force reset all connections and clear internal state
   * This is our "nuclear option" to fix any corruption issues
   *
   * @returns {Promise<Object>} Promise with cleanup statistics
   */
  resetAll: () => Promise.resolve(),

  /**
   * Get current connection status for debugging
   *
   * @returns {Promise<Object>} Promise with status information
   */
  getStatus: () => Promise.resolve(),
};

/**
 * Connection options interface
 * This defines what parameters the connect() method expects
 */
export const ConnectOptions = {
  ipAddress: '', // Required: IP address string
  port: 0, // Required: Port number
  timeoutMs: 5000, // Optional: Timeout in milliseconds (default 5 seconds)
};

/**
 * Connection result interface
 * This defines what the connect() method returns
 */
export const ConnectResult = {
  connectionId: '', // Unique ID for this connection
  success: false, // Whether connection was successful
};

/**
 * Send options interface
 */
export const SendOptions = {
  connectionId: '', // Required: Connection ID from connect()
  data: '', // Required: Data to send
  encoding: 'base64', // Optional: Data encoding
};

/**
 * Disconnect options interface
 */
export const DisconnectOptions = {
  connectionId: '', // Required: Connection ID to disconnect
};

/**
 * Status result interface
 */
export const StatusResult = {
  activeConnections: 0, // Number of active connections
  connectionIds: [], // Array of active connection IDs
};
