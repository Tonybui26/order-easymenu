/**
 * iOS Implementation of PrinterTcpSocket Plugin
 *
 * This Swift code runs on iOS and handles actual TCP socket connections to printers.
 *
 * Key features:
 * 1. Proper timeout handling (no hanging connections)
 * 2. Automatic cleanup of failed connections
 * 3. Thread-safe connection management using GCD
 * 4. Guaranteed state reset functionality
 */

import Foundation
import Capacitor
import Network

/**
 * Main plugin class
 * Conforms to CAPBridgedPlugin to register with Capacitor's runtime.
 * identifier = class name in packageClassList
 * jsName = plugin name used in JavaScript registerPlugin()
 */
@objc(PrinterTcpSocket)
public class PrinterTcpSocket: CAPPlugin, CAPBridgedPlugin {
    
    // MARK: - CAPBridgedPlugin conformance (REQUIRED for Capacitor to discover the plugin)
    public let identifier = "PrinterTcpSocket"
    public let jsName = "PrinterTcpSocket"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resetAll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise)
    ]
    
    // MARK: - Properties
    
    /**
     * Thread-safe dictionary to store active connections
     * Key: connectionId (String), Value: NWConnection object
     *
     * We use a concurrent queue with barriers to ensure thread-safe access to this dictionary
     */
    private var activeConnections: [String: NWConnection] = [:]
    private var timeoutTimers: [String: DispatchWorkItem] = [:]
    private let connectionQueue = DispatchQueue(label: "com.printertcpsocket.connections", attributes: .concurrent)
    
    /**
     * Connect to a printer
     * @objc tells Capacitor this method can be called from JavaScript
     */
    @objc func connect(_ call: CAPPluginCall) {
        // Extract parameters from JavaScript call
        guard let ipAddress = call.getString("ipAddress"),
              let port = call.getInt("port") else {
            call.reject("IP address and port are required")
            return
        }
        
        let timeoutMs = call.getInt("timeoutMs") ?? 5000 // Default 5 seconds
        
        // Generate unique connection ID
        let connectionId = UUID().uuidString
        
        // Create network endpoint
        let host = NWEndpoint.Host(ipAddress)
        let portEndpoint = NWEndpoint.Port(integerLiteral: UInt16(port))
        let endpoint = NWEndpoint.hostPort(host: host, port: portEndpoint)
        
        // Create TCP connection parameters with optimized settings for printers
        let tcpOptions = NWProtocolTCP.Options()
        tcpOptions.noDelay = true               // Disable Nagle's algorithm - send data immediately
        tcpOptions.connectionDropTime = 1       // Drop stale connections quickly (seconds)
        tcpOptions.connectionTimeout = max(timeoutMs / 1000, 1) // TCP-level timeout
        let parameters = NWParameters(tls: nil, tcp: tcpOptions)
        
        // Create connection
        let connection = NWConnection(to: endpoint, using: parameters)
        
        // Create timeout work item
        let timeoutWorkItem = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            
            // Check if connection is still pending
            var shouldTimeout = false
            self.connectionQueue.sync {
                if self.activeConnections[connectionId] != nil {
                    // Connection still exists and hasn't succeeded
                    shouldTimeout = true
                }
            }
            
            if shouldTimeout {
                // Timeout occurred - force cancel connection immediately
                self.connectionQueue.async(flags: .barrier) {
                    self.activeConnections.removeValue(forKey: connectionId)
                    self.timeoutTimers.removeValue(forKey: connectionId)
                }
                connection.stateUpdateHandler = nil
                connection.forceCancel()
                call.reject("Connection timeout after \(timeoutMs)ms to \(ipAddress):\(port)")
            }
        }
        
        // Store connection and timeout in thread-safe manner
        connectionQueue.async(flags: .barrier) {
            self.activeConnections[connectionId] = connection
            self.timeoutTimers[connectionId] = timeoutWorkItem
        }
        
        // Set up state handler
        connection.stateUpdateHandler = { [weak self] state in
            guard let self = self else { return }
            
            switch state {
            case .ready:
                // Connection successful - cancel timeout and resolve
                self.connectionQueue.async(flags: .barrier) {
                    self.timeoutTimers.removeValue(forKey: connectionId)?.cancel()
                }
                
                var result = JSObject()
                result["connectionId"] = connectionId
                result["success"] = true
                call.resolve(result)
                
            case .failed(let error):
                // Connection failed - clean up immediately
                self.connectionQueue.async(flags: .barrier) {
                    self.activeConnections.removeValue(forKey: connectionId)
                    self.timeoutTimers.removeValue(forKey: connectionId)?.cancel()
                }
                connection.stateUpdateHandler = nil
                connection.forceCancel()
                call.reject("Connection failed to \(ipAddress):\(port) - \(error.localizedDescription)")
                
            case .cancelled:
                // Connection was cancelled - clean up
                // Note: This might be called after resolve/reject, so we just clean up
                self.connectionQueue.async(flags: .barrier) {
                    self.activeConnections.removeValue(forKey: connectionId)
                    self.timeoutTimers.removeValue(forKey: connectionId)?.cancel()
                }
                // Don't reject here - cancellation might happen after success/failure
                
            default:
                // Other states (waiting, preparing, etc.) - just wait
                break
            }
        }
        
        // Start connection
        connection.start(queue: DispatchQueue.global(qos: .userInitiated))
        
        // Schedule timeout
        DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + .milliseconds(timeoutMs), execute: timeoutWorkItem)
    }
    
    /**
     * Send data to printer
     */
    @objc func send(_ call: CAPPluginCall) {
        guard let connectionId = call.getString("connectionId"),
              let data = call.getString("data") else {
            call.reject("Connection ID and data are required")
            return
        }
        
        let encoding = call.getString("encoding") ?? "base64"
        
        // Find the connection
        var connection: NWConnection?
        connectionQueue.sync {
            connection = activeConnections[connectionId]
        }
        
        guard let conn = connection else {
            call.reject("Connection not found: \(connectionId)")
            return
        }
        
        // Check if connection is ready
        if case .ready = conn.state {
            // Connection is ready, proceed with sending
        } else {
            call.reject("Connection not ready: \(connectionId)")
            return
        }
        
        // Convert data based on encoding
        let dataToSend: Data
        if encoding == "base64" {
            guard let decoded = Data(base64Encoded: data) else {
                call.reject("Invalid base64 data")
                return
            }
            dataToSend = decoded
        } else {
            guard let utf8Data = data.data(using: .utf8) else {
                call.reject("Invalid UTF-8 data")
                return
            }
            dataToSend = utf8Data
        }
        
        // Send data - NWConnection.send() is already asynchronous
        conn.send(content: dataToSend, completion: .contentProcessed { error in
            if let error = error {
                // Send failed - connection is probably broken
                // Auto-cleanup the failed connection
                self.connectionQueue.async(flags: .barrier) {
                    self.activeConnections.removeValue(forKey: connectionId)
                }
                conn.stateUpdateHandler = nil
                conn.forceCancel()
                call.reject("Send failed: \(error.localizedDescription)")
            } else {
                // Success!
                call.resolve()
            }
        })
    }
    
    /**
     * Disconnect from printer
     * This ensures clean disconnection and resource cleanup
     *
     * CRITICAL FIX: Uses sync barrier instead of async to ensure the connection
     * is actually removed and cancelled before resolving. The previous async version
     * caused a race condition where conn.cancel() was never called, leaving stale
     * TCP connections that blocked the printer for ~60 seconds.
     */
    @objc func disconnect(_ call: CAPPluginCall) {
        guard let connectionId = call.getString("connectionId") else {
            call.reject("Connection ID is required")
            return
        }
        
        // Remove and close the connection
        var connection: NWConnection?
        var timeoutWorkItem: DispatchWorkItem?
        
        // FIXED: sync barrier ensures we get the connection BEFORE proceeding
        connectionQueue.sync(flags: .barrier) {
            connection = self.activeConnections.removeValue(forKey: connectionId)
            timeoutWorkItem = self.timeoutTimers.removeValue(forKey: connectionId)
        }
        
        // Cancel timeout if it exists
        timeoutWorkItem?.cancel()
        
        // Cancel connection if it exists
        if let conn = connection {
            // Clear state handler to prevent callbacks after cancel
            conn.stateUpdateHandler = nil
            // forceCancel sends TCP RST for immediate close (vs cancel which does graceful FIN)
            // This instantly frees the printer's connection slot
            conn.forceCancel()
        }
        
        call.resolve()
    }
    
    /**
     * Reset all connections - this is our "nuclear option"
     * This solves the state corruption issue by forcibly clearing everything
     *
     * CRITICAL FIX: Uses sync barrier (same fix as disconnect)
     */
    @objc func resetAll(_ call: CAPPluginCall) {
        var connectionsCleared = 0
        
        // FIXED: sync barrier ensures cleanup happens before we read connectionsCleared
        connectionQueue.sync(flags: .barrier) {
            connectionsCleared = self.activeConnections.count
            
            // Cancel all timeouts
            for (_, timeoutWorkItem) in self.timeoutTimers {
                timeoutWorkItem.cancel()
            }
            
            // Force close all connections with TCP RST
            for (_, connection) in self.activeConnections {
                connection.stateUpdateHandler = nil
                connection.forceCancel()
            }
            
            // Clear both dictionaries
            self.activeConnections.removeAll()
            self.timeoutTimers.removeAll()
        }
        
        // Return statistics
        var result = JSObject()
        result["connectionsCleared"] = connectionsCleared
        result["message"] = "All connections cleared successfully"
        
        call.resolve(result)
    }
    
    /**
     * Get current connection status
     * Useful for debugging and monitoring
     */
    @objc func getStatus(_ call: CAPPluginCall) {
        var connectionIds: [String] = []
        var activeCount = 0
        
        connectionQueue.sync {
            activeCount = activeConnections.count
            connectionIds = Array(activeConnections.keys)
        }
        
        var result = JSObject()
        result["activeConnections"] = activeCount
        result["connectionIds"] = connectionIds
        result["platform"] = "ios"
        
        call.resolve(result)
    }
}

