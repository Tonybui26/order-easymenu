/**
 * Web Implementation of PrinterTcpSocket
 *
 * This provides a fallback implementation when running in a web browser.
 * Since browsers can't make direct TCP connections, this mainly serves
 * for testing and development purposes.
 *
 * In a real app, you'd only use the native Android/iOS implementations.
 */

import { WebPlugin } from '@capacitor/core';

export class PrinterTcpSocketWeb extends WebPlugin {
  /**
   * Web implementation of connect
   * Since browsers can't make TCP connections, we simulate the interface
   */
  async connect(options) {
    console.log(
      'PrinterTcpSocket.connect() called in web browser with:',
      options,
    );

    // Simulate connection failure since TCP isn't available in browsers
    throw new Error(
      'TCP sockets not supported in web browser. Use Android/iOS app for actual printing.',
    );
  }

  /**
   * Web implementation of send
   */
  async send(options) {
    console.log('PrinterTcpSocket.send() called in web browser with:', options);
    throw new Error('TCP sockets not supported in web browser.');
  }

  /**
   * Web implementation of disconnect
   */
  async disconnect(options) {
    console.log(
      'PrinterTcpSocket.disconnect() called in web browser with:',
      options,
    );
    // No-op in web since there are no real connections
    return;
  }

  /**
   * Web implementation of resetAll
   */
  async resetAll() {
    console.log('PrinterTcpSocket.resetAll() called in web browser');
    return {
      connectionsCleared: 0,
      message: 'No connections to clear in web browser',
    };
  }

  /**
   * Web implementation of getStatus
   */
  async getStatus() {
    console.log('PrinterTcpSocket.getStatus() called in web browser');
    return {
      activeConnections: 0,
      connectionIds: [],
      platform: 'web',
    };
  }
}
