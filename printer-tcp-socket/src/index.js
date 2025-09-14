/**
 * PrinterTcpSocket Plugin Main File
 *
 * This file is the main entry point for our plugin. It handles:
 * 1. Registering the plugin with Capacitor
 * 2. Routing method calls to the correct platform implementation
 * 3. Providing a unified interface for both native and web platforms
 */

import { registerPlugin } from '@capacitor/core';

/**
 * Register our plugin with Capacitor
 *
 * This tells Capacitor:
 * - The plugin name is 'PrinterTcpSocket'
 * - Use web implementation as fallback when no native implementation is available
 * - Look for platform-specific implementations in android/ios folders
 */
const PrinterTcpSocket = registerPlugin('PrinterTcpSocket', {
  // Web implementation (fallback for testing in browser)
  web: () => import('./web').then(m => new m.PrinterTcpSocketWeb()),
});

export * from './definitions.js';
export { PrinterTcpSocket };
