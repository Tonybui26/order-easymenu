"use client";
import { useState } from "react";
import {
  Printer,
  Wifi,
  Usb,
  CheckCircle,
  Eye,
  X,
} from "lucide-react";
import PrinterSetupModal from "./PrinterSetupModal";
import { createTestPrintJob } from "@/lib/api/fetchApi";
import { useMenuContext } from "@/components/context/MenuContext";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import { printTest, resetTcpPlugin } from "@/lib/helper/printerUtils";
import { PRINTER_ROUTING_GROUPS } from "@/lib/constants/itemGroups";
import {
  printTestNew,
  aggressiveTestNew,
  aggressiveTestThrottled,
  printOrderQueued,
  aggressiveTestNewQueued,
  setQueueLogCallback,
  aggressiveTestQueuedParallel, // ✅ Import the new function
} from "@/lib/helper/printerUtilsNew";
import { isStarPrntPrinter, isTsplPrinter } from "@/lib/constants/printerLanguages";
import { printTsplTestLabel } from "@/lib/printers/printTsplTestLabel";
import { printTaxInvoiceReceiptTest } from "@/lib/printers/printTaxInvoiceReceiptTest";
import { printBillReceiptTest } from "@/lib/printers/printBillReceiptTest";
import { printPrinterFontTest } from "@/lib/printers/printPrinterFontTest";
import { isUsbPrinter } from "@/lib/printers/transport/isUsbPrinter";
import { getPrinterEndpointLabel } from "@/lib/printers/transport/isPrinterReady";

/** Card enable toggle is on if any print role is still active. */
function isPrinterCardEnabled(printer) {
  return Boolean(
    printer?.forTakeaway || printer?.forDineIn || printer?.forReceipt,
  );
}

export default function PrinterCard({ printer, onDelete, onUpdate }) {
  const { storeProfile } = useMenuContext();
  const [showEditModal, setShowEditModal] = useState(false);
  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [testingFonts, setTestingFonts] = useState(false);
  const [testingReceipt, setTestingReceipt] = useState(false);
  const [testingBill, setTestingBill] = useState(false);
  const [testingPrinterNoLogo, setTestingPrinterNoLogo] = useState(false);
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

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this printer?")) {
      onDelete(printer._id);
      setShowEditModal(false);
    }
  };

  const cardEnabled = isPrinterCardEnabled(printer);

  async function handleEnableToggle(nextEnabled) {
    if (isTogglingEnabled) return;

    const patch = nextEnabled
      ? {
          // Turn on kitchen roles; leave receipt as-is (edit drawer still controls it).
          forTakeaway: true,
          forDineIn: true,
        }
      : {
          forTakeaway: false,
          forDineIn: false,
          forReceipt: false,
        };

    setIsTogglingEnabled(true);
    try {
      await onUpdate(printer._id, {
        ...printer,
        ...patch,
      });
    } finally {
      setIsTogglingEnabled(false);
    }
  }

  const runPrintTest = async (includeLogo = true) => {
    const setLoading = includeLogo ? setTestingPrinter : setTestingPrinterNoLogo;

    try {
      setLoading(true);
      const isTspl = isTsplPrinter(printer);
      const isStarPrnt = isStarPrntPrinter(printer);
      setCurrentTestType(
        isTspl
          ? "TSPL Label Test"
          : isStarPrnt
            ? includeLogo
              ? "StarPRNT Receipt Test"
              : "StarPRNT Receipt Test (no logo)"
            : includeLogo
              ? "Connection Test"
              : "Connection Test (no logo)",
      );
      clearLogs();
      setShowLogsModal(true);

      if (!isTspl) {
        setupQueueLogging();
      }

      addLog(
        `Starting ${isTspl ? "TSPL label" : isStarPrnt ? "StarPRNT receipt" : "receipt"} test for ${printer.name} (${getPrinterEndpointLabel(printer)})${isUsbPrinter(printer) ? " via USB" : ""}`,
        "info",
      );
      if (!isTspl && includeLogo && storeProfile?.storeLogo) {
        addLog(
          `Loading store logo via proxy: ${storeProfile.storeLogo.slice(0, 80)}…`,
          "info",
        );
      } else if (!isTspl) {
        addLog("Printing test content without logo", "info");
      }

      let result;
      if (isTspl) {
        result = await printTsplTestLabel(printer, {
          delayAfterDisconnect: 300,
        });
      } else {
        const printData = {
          printers: [printer],
        };
        result = await printOrderQueued(printData, {
          delayAfterDisconnect: 300,
          testing: true,
          onlyConnectionTest: false,
          logoUrl: includeLogo ? storeProfile?.storeLogo || null : null,
          onLogoStatus: (status) => {
            if (status?.success) {
              addLog(
                `✅ Logo raster ready (${status.width}×${status.height}, ${status.bytes} bytes, ${status.blackPixels} black dots)`,
                "success",
              );
            } else if (status?.attempted) {
              addLog(`❌ Logo failed: ${status.error}`, "error");
            }
          },
        });
      }

      if (result.success) {
        addLog(`✅ Connection successful!`, "success");
        if (result.logoStatus?.attempted && !result.logoStatus.success) {
          addLog(
            `⚠️ Test printed without logo: ${result.logoStatus.error}`,
            "warning",
          );
        }
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
      setLoading(false);
    }
  };

  const handleTestPrinter = () => runPrintTest(true);

  const handleTestPrinterNoLogo = () => runPrintTest(false);

  const handleTestFonts = async () => {
    if (isTsplPrinter(printer)) {
      toast.error("Font test is for receipt/docket printers only.");
      return;
    }

    try {
      setTestingFonts(true);
      setCurrentTestType("Font Test Sheet");
      clearLogs();
      setShowLogsModal(true);

      addLog(
        `Starting font test for ${printer.name} (${getPrinterEndpointLabel(printer)})`,
        "info",
      );

      const result = await printPrinterFontTest(printer, {
        delayAfterDisconnect: 300,
      });

      if (result.success) {
        addLog("✅ Font test printed!", "success");
        addLog(`Duration: ${result.duration || "N/A"}ms`, "info");
        toast.success(result.message);
      } else {
        addLog(`❌ Font test failed: ${result.message}`, "error");
        toast.error(result.message);
      }
    } catch (error) {
      addLog(`💥 Unexpected error: ${error.message}`, "error");
      console.error("Error printing font test:", error);
      toast.error("Failed to print font test: " + error.message);
    } finally {
      setTestingFonts(false);
    }
  };

  const handleTestReceiptPrinter = async () => {
    try {
      setTestingReceipt(true);
      setCurrentTestType("TAX INVOICE Receipt Test");
      clearLogs();
      setShowLogsModal(true);

      addLog(
        `Starting TAX INVOICE receipt test for ${printer.name} (${getPrinterEndpointLabel(printer)})`,
        "info",
      );
      if (storeProfile?.storeLogo) {
        addLog(
          `Loading store logo via proxy: ${storeProfile.storeLogo.slice(0, 80)}…`,
          "info",
        );
      } else {
        addLog("No store logo set — printing receipt without logo", "warning");
      }

      const result = await printTaxInvoiceReceiptTest(printer, {
        storeProfile,
        delayAfterDisconnect: 300,
        onLogoStatus: (status) => {
          if (status?.success) {
            addLog(
              `✅ Logo raster ready (${status.width}×${status.height}, ${status.bytes} bytes, ${status.blackPixels} black dots)`,
              "success",
            );
          } else if (status?.attempted) {
            addLog(`❌ Logo failed: ${status.error}`, "error");
          }
        },
      });

      if (result.success) {
        addLog("✅ Receipt test successful!", "success");
        if (result.logoStatus?.attempted && !result.logoStatus.success) {
          addLog(
            `⚠️ Receipt printed without logo: ${result.logoStatus.error}`,
            "warning",
          );
        }
        addLog(`Duration: ${result.duration || "N/A"}ms`, "info");
        toast.success(result.message);
      } else {
        addLog(`❌ Receipt test failed: ${result.message}`, "error");
        toast.error(result.message);
      }
    } catch (error) {
      addLog(`💥 Unexpected error: ${error.message}`, "error");
      console.error("Error testing receipt printer:", error);
      toast.error("Failed to test receipt: " + error.message);
    } finally {
      setTestingReceipt(false);
    }
  };

  const handleTestBillPrinter = async () => {
    try {
      setTestingBill(true);
      setCurrentTestType("BILL Receipt Test");
      clearLogs();
      setShowLogsModal(true);

      addLog(
        `Starting BILL receipt test for ${printer.name} (${getPrinterEndpointLabel(printer)})`,
        "info",
      );
      if (storeProfile?.storeLogo) {
        addLog(
          `Loading store logo via proxy: ${storeProfile.storeLogo.slice(0, 80)}…`,
          "info",
        );
      } else {
        addLog("No store logo set — printing receipt without logo", "warning");
      }

      const result = await printBillReceiptTest(printer, {
        storeProfile,
        delayAfterDisconnect: 300,
        onLogoStatus: (status) => {
          if (status?.success) {
            addLog(
              `✅ Logo raster ready (${status.width}×${status.height}, ${status.bytes} bytes, ${status.blackPixels} black dots)`,
              "success",
            );
          } else if (status?.attempted) {
            addLog(`❌ Logo failed: ${status.error}`, "error");
          }
        },
      });

      if (result.success) {
        addLog("✅ Bill test successful!", "success");
        if (result.logoStatus?.attempted && !result.logoStatus.success) {
          addLog(
            `⚠️ Bill printed without logo: ${result.logoStatus.error}`,
            "warning",
          );
        }
        addLog(`Duration: ${result.duration || "N/A"}ms`, "info");
        toast.success(result.message);
      } else {
        addLog(`❌ Bill test failed: ${result.message}`, "error");
        toast.error(result.message);
      }
    } catch (error) {
      addLog(`💥 Unexpected error: ${error.message}`, "error");
      console.error("Error testing bill printer:", error);
      toast.error("Failed to test bill: " + error.message);
    } finally {
      setTestingBill(false);
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

      const result = await aggressiveTestQueuedParallel(printer, 5);

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
      <div
        role="button"
        tabIndex={0}
        onClick={() => setShowEditModal(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setShowEditModal(true);
          }
        }}
        className={`relative h-full cursor-pointer rounded-xl border border-gray-200 bg-white pt-10 shadow-sm transition-shadow hover:shadow-md ${
          cardEnabled ? "" : "opacity-60"
        }`}
      >
        {/* Overlapping printer icon */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-orange-50 text-brand_accent shadow-md">
          <Printer className="size-6" strokeWidth={1.75} />
        </div>

        {/* Enable toggle */}
        <div
          className="absolute right-3 top-3 z-20"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <label
            className="flex cursor-pointer items-center"
            title={
              cardEnabled
                ? "Disable this printer for all order types and receipts"
                : "Enable takeaway and dine-in printing"
            }
          >
            <span className="sr-only">
              {cardEnabled ? "Disable printer" : "Enable printer"}
            </span>
            <input
              type="checkbox"
              className="toggle toggle-success toggle-md"
              checked={cardEnabled}
              disabled={isTogglingEnabled}
              onChange={(event) => handleEnableToggle(event.target.checked)}
            />
          </label>
        </div>

        <div className="flex flex-col items-center px-4 pb-5 text-center">
          <h4 className="text-base font-semibold text-gray-900">
            {printer.name}
          </h4>

          <div className="mt-3 flex w-full flex-col items-center gap-2.5">
            <span
              className={`inline-flex size-9 items-center justify-center rounded-full ${
                isUsbPrinter(printer)
                  ? "bg-amber-100 text-amber-800"
                  : "bg-sky-100 text-sky-700"
              }`}
              title={isUsbPrinter(printer) ? "USB" : "Network"}
              aria-label={isUsbPrinter(printer) ? "USB connection" : "Network connection"}
            >
              {isUsbPrinter(printer) ? (
                <Usb className="size-4" strokeWidth={2} />
              ) : (
                <Wifi className="size-4" strokeWidth={2} />
              )}
            </span>

            <p className="text-sm text-gray-600">
              {getPrinterEndpointLabel(printer)}
            </p>

            {(printer.forReceipt ||
              (Array.isArray(printer.groupIds) &&
                printer.groupIds.length > 0)) && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {printer.forReceipt ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-800">
                    <CheckCircle className="h-3 w-3" />
                    Receipt
                  </span>
                ) : null}
                {(printer.groupIds || []).map((gid) => {
                  const meta = PRINTER_ROUTING_GROUPS.find((g) => g.id === gid);
                  const label = meta?.name || gid;
                  const isBackup = gid === "backup";
                  return (
                    <span
                      key={gid}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        isBackup
                          ? "bg-amber-100 text-amber-800"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            )}
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
        onPrintTest={handleTestPrinter}
        onPrintTestNoLogo={handleTestPrinterNoLogo}
        onTestFonts={handleTestFonts}
        onTestReceipt={handleTestReceiptPrinter}
        onTestBill={handleTestBillPrinter}
        onViewLogs={() => setShowLogsModal(true)}
        onDelete={handleDelete}
        actionStatus={{
          testingPrinter,
          testingPrinterNoLogo,
          testingFonts,
          testingReceipt,
          testingBill,
        }}
      />
    </>
  );
}
