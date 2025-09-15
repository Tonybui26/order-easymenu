"use client";
import { useState } from "react";
import {
  Printer,
  Wifi,
  Settings,
  Edit2,
  Trash2,
  CheckCircle,
  MoreVertical,
  RotateCcw,
  Eye, // ✅ Add Eye icon for logs
  X, // ✅ Add X icon for close
} from "lucide-react";
import PrinterSetupModal from "./PrinterSetupModal";
import { createTestPrintJob } from "@/lib/api/fetchApi";
import { useMenuContext } from "@/components/context/MenuContext";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import { printTest, resetTcpPlugin } from "@/lib/helper/printerUtils";
import {
  printTestNew,
  aggressiveTestNew,
  aggressiveTestThrottled,
  printOrderNewQueued,
  aggressiveTestNewQueued,
  setQueueLogCallback,
  aggressiveTestNewQueuedParallel, // ✅ Import the new function
} from "@/lib/helper/printerUtilsNew";

export default function PrinterCard({ printer, onDelete, onUpdate }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [aggressiveTestingPrinter, setAggressiveTestingPrinter] =
    useState(false);
  const [resettingPrinter, setResettingPrinter] = useState(false);

  // ✅ Add logging modal state
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [testLogs, setTestLogs] = useState([]);
  const [currentTestType, setCurrentTestType] = useState("");

  // ✅ Logging helper function
  const addLog = (message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp,
      message,
      type, // "info", "success", "error", "warning"
    };

    setTestLogs((prev) => [...prev, logEntry]);
    console.log(`[${timestamp}] ${message}`); // Also log to console
  };

  // ✅ Clear logs function
  const clearLogs = () => {
    setTestLogs([]);
  };

  // ✅ Set up queue logging when component mounts or logs modal opens
  const setupQueueLogging = () => {
    setQueueLogCallback(addLog);
  };

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this printer?")) {
      onDelete(printer._id);
    }
  };

  const handleTestPrinter = async () => {
    try {
      setTestingPrinter(true);
      setCurrentTestType("Connection Test");
      clearLogs();
      setShowLogsModal(true);

      // ✅ Set up queue logging
      setupQueueLogging();

      addLog(
        `Starting connection test for ${printer.name} (${printer.localIp}:${printer.port})`,
        "info",
      );

      const printData = {
        printers: [printer],
      };
      const result = await printOrderNewQueued(printData, {
        delayAfterDisconnect: 300,
        testing: true,
      });

      if (result.success) {
        addLog(`✅ Connection successful!`, "success");
        addLog(`Duration: ${result.duration || "N/A"}ms`, "info");
        toast.success(result.message);
      } else {
        addLog(`❌ Connection failed: ${result.message}`, "error");
        toast.error(result.message);
      }
    } catch (error) {
      addLog(`💥 Unexpected error: ${error.message}`, "error");
      console.error("Error testing printer:", error);
      toast.error("Failed to test printer: " + error.message);
    } finally {
      setTestingPrinter(false);
    }
  };

  const handleAggressiveTestPrinter = async () => {
    try {
      setAggressiveTestingPrinter(true);
      setCurrentTestType("Aggressive Test");
      clearLogs();
      setShowLogsModal(true);

      // ✅ Set up queue logging
      setupQueueLogging();

      addLog(`Starting aggressive test for ${printer.name}`, "info");
      addLog(`Target: 20 test cycles`, "info");

      const result = await aggressiveTestNewQueuedParallel(printer, 5);

      addLog(`🏁 Test completed!`, "success");
      addLog(
        `Results: ${result.successfulTests}/${result.totalTests} successful`,
        "success",
      );
      addLog(`Total duration: ${result.totalDuration}ms`, "info");

      toast.success(
        `Simple aggressive test: ${result.successfulTests}/${result.totalTests} successful! in ${result.totalDuration}ms`,
      );
    } catch (error) {
      addLog(`💥 Aggressive test failed: ${error.message}`, "error");
      toast.error("Failed to throttled test printer: " + error.message);
    } finally {
      setAggressiveTestingPrinter(false);
    }
  };

  const handleResetPrinter = async () => {
    try {
      setResettingPrinter(true);
      setCurrentTestType("TCP Plugin Reset");
      clearLogs();
      setShowLogsModal(true);

      addLog(`Starting TCP plugin reset...`, "info");

      await toast.promise(resetTcpPlugin(), {
        loading: "Resetting TCP plugin...",
        success: "TCP plugin reset successfully!",
        error: (err) =>
          `Failed to reset TCP plugin: ${err?.message || "Unknown error"}`,
      });

      addLog(`✅ TCP plugin reset completed successfully!`, "success");
    } catch (error) {
      addLog(`❌ Reset failed: ${error.message}`, "error");
      console.error("Reset error:", error);
    } finally {
      setResettingPrinter(false);
    }
  };

  // ✅ Get log type styling
  const getLogTypeStyle = (type) => {
    switch (type) {
      case "success":
        return "text-green-600 bg-green-50 border-green-200";
      case "error":
        return "text-red-600 bg-red-50 border-red-200";
      case "warning":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Main Printer Info */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg">
              <Printer className="size-6" />
            </div>

            <div className="flex-1">
              <div className="mb-1">
                <h4 className="font-medium text-gray-900">{printer.name}</h4>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Wifi className="h-3 w-3" />
                  <span>{printer.localIp}</span>
                </div>
              </div>

              {/* Order Type Indicators */}
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                {printer.forTakeaway && (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-green-700">
                    <CheckCircle className="h-3 w-3" />
                    Takeaway
                  </span>
                )}
                {printer.forDineIn && (
                  <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-blue-700">
                    <CheckCircle className="h-3 w-3" />
                    Dine-in
                  </span>
                )}
                {!printer.forTakeaway && !printer.forDineIn && (
                  <span className="text-gray-400">No order types assigned</span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-sm">
              <MoreVertical className="h-4 w-4" />
            </div>
            <ul
              tabIndex={0}
              className="menu dropdown-content z-[1] w-52 rounded-box bg-base-100 p-2 shadow"
            >
              <li>
                <button
                  onClick={handleAggressiveTestPrinter}
                  disabled={aggressiveTestingPrinter}
                  className="flex items-center gap-2"
                >
                  {aggressiveTestingPrinter ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border border-red-300 border-t-red-600"></div>
                      Aggressive Testing...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4" />
                      Aggressive Testing
                    </>
                  )}
                </button>
              </li>
              <li>
                <button
                  onClick={handleResetPrinter}
                  disabled={resettingPrinter}
                  className="flex items-center gap-2"
                >
                  {resettingPrinter ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border border-red-300 border-t-red-600"></div>
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4" />
                      Reset TCP Plugin
                    </>
                  )}
                </button>
              </li>
              <li>
                <button
                  onClick={handleTestPrinter}
                  disabled={testingPrinter}
                  className="flex items-center gap-2"
                >
                  {testingPrinter ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border border-blue-300 border-t-blue-600"></div>
                      Testing...
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4" />
                      Test Printer
                    </>
                  )}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setShowLogsModal(true)}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View Logs
                </button>
              </li>
              <li>
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit Printer
                </button>
              </li>
              <li>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 text-error"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Printer
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ✅ Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 max-h-[80vh] w-full max-w-2xl rounded-lg bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Test Logs - {currentTestType}
                </h3>
                <p className="text-sm text-gray-600">
                  {printer.name} ({printer.localIp}:{printer.port})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearLogs}
                  className="btn btn-outline btn-sm"
                  disabled={testLogs.length === 0}
                >
                  Clear Logs
                </button>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="btn btn-ghost btn-sm"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Body - Logs */}
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {testLogs.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <Eye className="mx-auto mb-2 h-12 w-12 opacity-50" />
                  <p>No logs yet. Run a test to see the process.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {testLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`rounded-lg border p-3 text-sm ${getLogTypeStyle(log.type)}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-mono text-xs opacity-70">
                          {log.timestamp}
                        </span>
                        <span className="text-xs font-medium uppercase">
                          {log.type}
                        </span>
                      </div>
                      <p className="mt-1">{log.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Total logs: {testLogs.length}</span>
                <span>
                  {testLogs.length > 0 && (
                    <>
                      Last updated: {testLogs[testLogs.length - 1]?.timestamp}
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <PrinterSetupModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={(updatedPrinter) => {
          onUpdate(printer._id, updatedPrinter);
          setShowEditModal(false);
        }}
        mode="edit"
        printer={printer}
      />
    </>
  );
}
