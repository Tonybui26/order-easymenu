/**
 * Android Implementation of PrinterTcpSocket Plugin
 * 
 * This is where the real magic happens! This Java code runs on Android
 * and handles actual TCP socket connections to printers.
 * 
 * Key features:
 * 1. Proper timeout handling (no hanging connections)
 * 2. Automatic cleanup of failed connections
 * 3. Thread-safe connection management
 * 4. Guaranteed state reset functionality
 */

package com.yourapp.printertcpsocket;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.util.Base64;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.UUID;

/**
 * Main plugin class
 * @CapacitorPlugin tells Capacitor this is a plugin named "PrinterTcpSocket"
 */
@CapacitorPlugin(name = "PrinterTcpSocket")
public class PrinterTcpSocketPlugin extends Plugin {
    
    /**
     * Thread-safe map to store active connections
     * Key: connectionId (String), Value: Socket object
     * 
     * ConcurrentHashMap ensures multiple threads can safely access this
     * without causing crashes or data corruption
     */
    private final ConcurrentHashMap<String, Socket> activeConnections = new ConcurrentHashMap<>();
    
    /**
     * Thread pool for handling network operations
     * Network operations should never run on the main UI thread
     * ExecutorService manages a pool of background threads for us
     */
    private final ExecutorService executor = Executors.newCachedThreadPool();
    
    /**
     * Connect to a printer
     * @PluginMethod tells Capacitor this method can be called from JavaScript
     */
    @PluginMethod
    public void connect(PluginCall call) {
        // Extract parameters from JavaScript call
        String ipAddress = call.getString("ipAddress");
        Integer port = call.getInt("port");
        Integer timeoutMs = call.getInt("timeoutMs", 5000); // Default 5 seconds
        
        // Validate required parameters
        if (ipAddress == null || port == null) {
            call.reject("IP address and port are required");
            return;
        }
        
        // Run network operation in background thread
        // This prevents blocking the UI thread
        executor.execute(() -> {
            String connectionId = UUID.randomUUID().toString(); // Generate unique ID
            Socket socket = null;
            
            try {
                // Create socket with proper configuration
                socket = new Socket();
                
                // Set socket timeout for read operations
                socket.setSoTimeout(timeoutMs);
                
                // Disable keep-alive (important for printer connections)
                // Printers often don't handle keep-alive well
                socket.setKeepAlive(false);
                
                // CRITICAL: Configure socket for proper closure to avoid printer socket exhaustion
                socket.setSoLinger(true, 0); // Force immediate close without TIME_WAIT
                socket.setReuseAddress(true); // Allow port reuse to prevent exhaustion
                socket.setTcpNoDelay(true); // Send data immediately (good for printers)
                
                // Attempt connection with timeout
                // This is the key improvement - proper timeout handling!
                socket.connect(new InetSocketAddress(ipAddress, port), timeoutMs);
                
                // Connection successful - store it
                activeConnections.put(connectionId, socket);
                
                // Prepare success response for JavaScript
                JSObject result = new JSObject();
                result.put("connectionId", connectionId);
                result.put("success", true);
                
                // Send success back to JavaScript
                call.resolve(result);
                
            } catch (SocketTimeoutException e) {
                // Timeout occurred - this is the critical fix!
                // Clean up the socket immediately, don't let it hang
                if (socket != null) {
                    try {
                        socket.close();
                    } catch (IOException ignored) {
                        // Ignore cleanup errors - we're already handling a timeout
                    }
                }
                
                // Send clear error message back to JavaScript
                call.reject("Connection timeout after " + timeoutMs + "ms to " + ipAddress + ":" + port);
                
            } catch (IOException e) {
                // Other connection errors (host unreachable, connection refused, etc.)
                // Clean up any resources
                if (socket != null) {
                    try {
                        socket.close();
                    } catch (IOException ignored) {}
                }
                
                call.reject("Connection failed to " + ipAddress + ":" + port + " - " + e.getMessage());
            }
        });
    }
    
    /**
     * Send data to printer
     */
    @PluginMethod
    public void send(PluginCall call) {
        String connectionId = call.getString("connectionId");
        String data = call.getString("data");
        String encoding = call.getString("encoding", "base64");
        
        // Validate parameters
        if (connectionId == null || data == null) {
            call.reject("Connection ID and data are required");
            return;
        }
        
        // Find the connection
        Socket socket = activeConnections.get(connectionId);
        if (socket == null || socket.isClosed()) {
            call.reject("Connection not found or already closed: " + connectionId);
            return;
        }
        
        // Send data in background thread
        executor.execute(() -> {
            try {
                // Convert data based on encoding
                byte[] bytes;
                if ("base64".equals(encoding)) {
                    // Decode base64 data (most common for ESC/POS commands)
                    bytes = Base64.getDecoder().decode(data);
                } else {
                    // Treat as UTF-8 text
                    bytes = data.getBytes("UTF-8");
                }
                
                // Send data to printer
                OutputStream outputStream = socket.getOutputStream();
                outputStream.write(bytes);
                outputStream.flush(); // Ensure data is sent immediately
                
                // Success!
                call.resolve();
                
            } catch (IOException e) {
                // Send failed - connection is probably broken
                // Auto-cleanup the failed connection
                activeConnections.remove(connectionId);
                try {
                    socket.close();
                } catch (IOException ignored) {}
                
                call.reject("Send failed: " + e.getMessage());
            }
        });
    }
    
    /**
     * Disconnect from printer
     * This ensures clean disconnection and resource cleanup
     */
    @PluginMethod
    public void disconnect(PluginCall call) {
        String connectionId = call.getString("connectionId");
        
        if (connectionId == null) {
            call.reject("Connection ID is required");
            return;
        }
        
        // Remove and close the connection
        Socket socket = activeConnections.remove(connectionId);
        if (socket != null) {
            try {
                // CRITICAL: Proper socket shutdown sequence to avoid printer socket exhaustion
                if (!socket.isClosed()) {
                    // First, shutdown output stream (tell printer we're done sending)
                    try {
                        socket.shutdownOutput();
                    } catch (IOException ignored) {}
                    
                    // Then shutdown input stream
                    try {
                        socket.shutdownInput();
                    } catch (IOException ignored) {}
                    
                    // Finally close the socket
                    socket.close();
                }
            } catch (IOException e) {
                // Log but don't fail - connection is being removed anyway
                System.out.println("Warning during disconnect: " + e.getMessage());
            }
        }
        
        call.resolve();
    }
    
    /**
     * Reset all connections - this is our "nuclear option"
     * This solves the state corruption issue by forcibly clearing everything
     */
    @PluginMethod
    public void resetAll(PluginCall call) {
        int connectionsCleared = activeConnections.size();
        
        // Force close all connections with proper shutdown sequence
        for (Socket socket : activeConnections.values()) {
            try {
                if (!socket.isClosed()) {
                    // Proper shutdown sequence to avoid printer socket exhaustion
                    try { socket.shutdownOutput(); } catch (IOException ignored) {}
                    try { socket.shutdownInput(); } catch (IOException ignored) {}
                    socket.close();
                }
            } catch (IOException ignored) {
                // Ignore errors during forced cleanup
            }
        }
        
        // Clear the connection map
        activeConnections.clear();
        
        // Force Java garbage collection to clean up any lingering resources
        // This helps ensure complete cleanup
        System.gc();
        
        // Return statistics
        JSObject result = new JSObject();
        result.put("connectionsCleared", connectionsCleared);
        result.put("message", "All connections cleared successfully");
        
        call.resolve(result);
    }
    
    /**
     * Get current connection status
     * Useful for debugging and monitoring
     */
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("activeConnections", activeConnections.size());
        result.put("connectionIds", activeConnections.keySet().toArray());
        result.put("platform", "android");
        
        call.resolve(result);
    }
}
