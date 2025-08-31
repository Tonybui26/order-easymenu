"use client";
import { useState, useEffect } from "react";
import {
  Search,
  Wifi,
  Settings,
  Plus,
  Monitor,
  WifiHigh,
  WifiIcon,
  Timer,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  discoverPrintersHybrid,
  printTest,
} from "../../../lib/helper/printerUtils";
import { isNativeApp } from "../../../lib/helper/platformDetection";

export default function PrinterScanner({ onPrinterSelect, onShowManualForm }) {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredPrinters, setDiscoveredPrinters] = useState([]);
  const [discoveryProgress, setDiscoveryProgress] = useState({
    current: 0,
    total: 0,
    found: 0,
  });
  const [discoveryOptions, setDiscoveryOptions] = useState({
    includeExtendedPorts: false,
    useHybridDiscovery: true, // Default to hybrid for better performance
  });
  const [scanStartTime, setScanStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [discoveryLogs, setDiscoveryLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(true);

  const hideAllLogs = false;

  // Check if network discovery is available (mobile app only)
  const canScanNetwork = isNativeApp();

  const handleDiscoverPrinters = async () => {
    setIsDiscovering(true);
    setDiscoveredPrinters([]);
    setDiscoveryProgress({ current: 0, total: 0, found: 0 });
    setScanStartTime(Date.now());
    setElapsedTime(0);
    setDiscoveryLogs([]);
    setShowLogs(true);

    // Add initial log
    const addLog = (message, type = "info") => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`🔍 addLog called: [${timestamp}] ${message} (${type})`);
      setDiscoveryLogs((prev) => {
        const newLogs = [...prev, { timestamp, message, type }];
        console.log(`🔍 Updated discoveryLogs:`, newLogs);
        return newLogs;
      });
    };

    addLog("🚀 Starting printer discovery...", "start");

    try {
      console.log("🔍 Calling discoverPrintersHybrid...");
      const result = await discoverPrintersHybrid({
        includeExtendedPorts: false,
        onProgress: (current, total, found) => {
          console.log(
            `🔍 onProgress called: ${current}/${total}, found: ${found}`,
          );
          setDiscoveryProgress({ current, total, found });

          // Log progress to UI - use actual total instead of hardcoded values
          if (discoveryOptions.useHybridDiscovery) {
            // Calculate HTTP ping phase based on actual IP count
            // The total includes both HTTP ping + socket test phases
            const httpPingPhase = Math.ceil(total * 0.8); // Estimate 80% for HTTP ping

            if (current <= httpPingPhase) {
              // HTTP ping phase
              addLog(
                `📡 HTTP ping: ${current}/${httpPingPhase} IPs tested`,
                "progress",
              );
            } else {
              // Socket test phase
              const socketTest = current - httpPingPhase;
              const socketTotal = total - httpPingPhase;
              addLog(
                `🔌 Socket test: ${socketTest}/${socketTotal} reachable devices tested`,
                "progress",
              );
            }
          } else {
            addLog(
              `🔌 Socket test: ${current}/${total} IPs tested`,
              "progress",
            );
          }
        },
        onLog: (message) => {
          console.log(`🔍 onLog callback received: ${message}`);
          // Add detailed ping logs to UI
          addLog(message, "info");
        },
      });

      console.log("🔍 discoverPrintersHybrid result:", result);

      if (result.success) {
        setDiscoveredPrinters(result.printers);
        addLog(`✅ Discovery completed: ${result.message}`, "success");
        toast.success(result.message);
      } else {
        addLog(`❌ Discovery failed: ${result.message}`, "error");
        toast.error(result.message);
      }
    } catch (error) {
      console.error("🔍 Discovery error:", error);
      addLog(`💥 Discovery error: ${error.message}`, "error");
      toast.error(`Discovery failed: ${error.message}`);
    } finally {
      setIsDiscovering(false);
      setScanStartTime(null);
      addLog("🏁 Discovery process finished", "info");
    }
  };

  const handleTestPrinter = async (printer) => {
    try {
      toast.loading("Testing printer...", { id: `test-${printer.ip}` });

      const result = await printTest(null, printer);

      if (result.success) {
        toast.success(`Test print successful!`, { id: `test-${printer.ip}` });
      } else {
        toast.error(`Test failed: ${result.message}`, {
          id: `test-${printer.ip}`,
        });
      }
    } catch (error) {
      toast.error(`Test error: ${error.message}`, { id: `test-${printer.ip}` });
    }
  };

  const handleSelectPrinter = (printer) => {
    const printerData = {
      name: "",
      localIp: printer.localIp,
      port: printer.port.toString(),
      forTakeaway: true,
      forDineIn: true,
    };
    onPrinterSelect(printerData);
  };

  const formatDiscoveryProgress = () => {
    if (!isDiscovering) return "";
    return "Scanning...";
  };

  // Update elapsed time during scanning
  useEffect(() => {
    let interval;
    if (isDiscovering && scanStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - scanStartTime);
      }, 100); // Update every 100ms for smooth timer
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isDiscovering, scanStartTime]);

  const formatTime = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const ms = Math.floor((milliseconds % 1000) / 100);
    return `${seconds}.${ms}s`;
  };

  // Show web-only message if not on mobile
  if (!canScanNetwork) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
          <Monitor className="h-8 w-8 text-warning" />
        </div>
        <h3 className="text-xl font-semibold">Network Discovery Unavailable</h3>
        <p className="text-base-content/60">
          Network discovery is only available in the mobile app due to browser
          security restrictions.
        </p>
        <button onClick={onShowManualForm} className="btn-primary btn w-full">
          <Plus className="h-5 w-5" />
          Add Manually
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scan Button */}
      <button
        onClick={handleDiscoverPrinters}
        disabled={isDiscovering}
        className="btn-primary btn w-full disabled:bg-brand_accent disabled:text-white"
      >
        {isDiscovering ? (
          <>
            <span className="loading loading-spinner loading-sm disabled:text-white"></span>
            {formatDiscoveryProgress()}
          </>
        ) : (
          <>
            <Search className="h-5 w-5" />
            Search for Printers
          </>
        )}
      </button>

      {/* Progress Bar */}
      {isDiscovering && (
        <div className="space-y-3 rounded-lg bg-base-200 p-4">
          <div className="flex justify-between text-sm">
            <span>
              {discoveryProgress.total > 0
                ? "Looking for printers..."
                : "Initializing scan..."}
            </span>
            <span className="flex items-center gap-1 font-mono">
              {" "}
              <Timer className="size-3" /> {formatTime(elapsedTime)}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-base-300">
            <div
              className={`h-2 rounded-full transition-all duration-300 ease-out ${
                discoveryProgress.total > 0
                  ? "bg-primary"
                  : "animate-pulse bg-primary/50"
              }`}
              style={{
                width:
                  discoveryProgress.total > 0
                    ? `${Math.round((discoveryProgress.current / discoveryProgress.total) * 100)}%`
                    : "0%",
              }}
            ></div>
          </div>
          {discoveryProgress.found > 0 && (
            <div className="text-center text-sm text-success">
              🖨️ {discoveryProgress.found} printer
              {discoveryProgress.found !== 1 ? "s" : ""} found
            </div>
          )}
        </div>
      )}

      {/* Discovery Logs */}
      {true && discoveryLogs.length > 0 && !hideAllLogs && (
        <div className="space-y-3 rounded-lg bg-base-200 p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">
              📋 Discovery Logs ({discoveryLogs.length})
            </h4>
            <div className="flex gap-2">
              <button
                onClick={() => setDiscoveryLogs([])}
                className="btn btn-ghost btn-xs"
                title="Clear all logs"
              >
                Clear
              </button>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="btn btn-ghost btn-xs"
              >
                {showLogs ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {showLogs && (
            <div className="space-y-3">
              {/* Debug Info for Development */}
              <div className="rounded-lg bg-base-100 p-3">
                <h5 className="mb-2 text-sm font-medium">🔍 Debug Info</h5>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>State: {isDiscovering ? "Scanning" : "Idle"}</div>
                  <div>Logs: {discoveryLogs.length}</div>
                  <div>
                    Progress: {discoveryProgress.current}/
                    {discoveryProgress.total}
                  </div>
                  <div>Found: {discoveredPrinters.length} printers</div>
                </div>
              </div>

              {/* Ping Results Summary */}
              {(() => {
                // Filter logs that are specifically from HTTP ping operations
                const pingLogs = discoveryLogs.filter(
                  (log) =>
                    log.message.includes("HTTP ping") ||
                    log.message.includes("Device reachable") ||
                    log.message.includes("Device not reachable") ||
                    (log.message.includes("Testing") &&
                      log.message.includes(":")),
                );

                if (pingLogs.length > 0) {
                  // Count successful pings (SUCCESS or reachable devices)
                  const successLogs = pingLogs.filter(
                    (log) =>
                      log.message.includes("SUCCESS") ||
                      log.message.includes("Device reachable") ||
                      log.message.includes("reachable (non-HTTP)"),
                  );

                  // Count failed pings (FAILED, ERROR, or not reachable)
                  const failedLogs = pingLogs.filter(
                    (log) =>
                      log.message.includes("FAILED") ||
                      log.message.includes("ERROR") ||
                      log.message.includes("Device not reachable") ||
                      (log.message.includes("failed") &&
                        !log.message.includes("reachable")),
                  );

                  // Debug: Log what we're counting
                  console.log("🔍 Ping Summary Debug:", {
                    totalPingLogs: pingLogs.length,
                    successLogs: successLogs.map((l) => l.message),
                    failedLogs: failedLogs.map((l) => l.message),
                  });

                  return (
                    <div className="rounded-lg bg-base-100 p-3">
                      <h5 className="mb-2 text-sm font-medium">
                        📊 Ping Results Summary
                      </h5>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-success">
                          ✅ Success: {successLogs.length}
                        </div>
                        <div className="text-error">
                          ❌ Failed: {failedLogs.length}
                        </div>
                      </div>
                      {successLogs.length > 0 && (
                        <div className="mt-2 text-xs text-success">
                          {successLogs.slice(0, 3).map((log, index) => (
                            <div key={index} className="font-mono">
                              {log.message}
                            </div>
                          ))}
                          {successLogs.length > 3 && (
                            <div className="text-base-content/60">
                              ... and {successLogs.length - 3} more
                            </div>
                          )}
                        </div>
                      )}
                      {failedLogs.length > 0 && (
                        <div className="mt-2 text-xs text-error">
                          <div className="font-medium">Failed Examples:</div>
                          {failedLogs.slice(0, 2).map((log, index) => (
                            <div key={index} className="font-mono">
                              {log.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              {/* Detailed Logs */}
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {discoveryLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`font-mono text-xs ${
                      log.type === "error"
                        ? "text-error"
                        : log.type === "success"
                          ? "font-semibold text-success"
                          : log.type === "start"
                            ? "font-semibold text-primary"
                            : log.type === "progress"
                              ? "text-info"
                              : "text-base-content/60"
                    }`}
                  >
                    <span className="text-base-content/50">
                      [{log.timestamp}]
                    </span>{" "}
                    {log.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Discovered Printers */}
      {discoveredPrinters.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium">Found ({discoveredPrinters.length})</h4>
          {discoveredPrinters.map((printer, index) => (
            <div
              key={`${printer.ip}-${index}`}
              className="flex items-center justify-between rounded-lg border border-base-300 bg-base-100 p-3"
            >
              <div className="flex-1">
                <div className="font-medium">Printer {index + 1}</div>
                <div className="flex items-start gap-1 text-sm text-base-content/60">
                  <WifiIcon className="mt-0.5 h-3 w-3" /> {printer.localIp}:
                  {printer.port}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleTestPrinter(printer)}
                  className="btn btn-ghost btn-sm"
                  title="Test"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleSelectPrinter(printer)}
                  className="btn-primary btn btn-sm"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Add Option */}
      <div className="divider">OR</div>

      <button onClick={onShowManualForm} className="btn btn-outline w-full">
        <Plus className="h-5 w-5" />
        Add Manually
      </button>
    </div>
  );
}
