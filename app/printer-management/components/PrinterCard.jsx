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
  RotateCcw, // ✅ Correct icon name
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
} from "@/lib/helper/printerUtilsNew";

export default function PrinterCard({ printer, onDelete, onUpdate }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [aggressiveTestingPrinter, setAggressiveTestingPrinter] =
    useState(false);
  const [resettingPrinter, setResettingPrinter] = useState(false); // ✅ Add this state

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
      const result = await printTestNew(null, printer);

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error testing printer:", error);
      toast.error("Failed to test printer: " + error.message);
    } finally {
      setTestingPrinter(false);
    }
  };

  const handleAggressiveTestPrinter = async () => {
    try {
      setAggressiveTestingPrinter(true);
      const result = await aggressiveTestNew(printer, null, 10);
      toast.success(
        `Simple aggressive test: ${result.successfulTests}/${result.totalTests} successful! in ${result.totalDuration}ms`,
      );
    } catch (error) {
      toast.error("Failed to throttled test printer: " + error.message);
    } finally {
      setAggressiveTestingPrinter(false);
    }
  };

  const handleResetPrinter = async () => {
    try {
      setResettingPrinter(true); // ✅ Set loading state

      await toast.promise(resetTcpPlugin(), {
        loading: "Resetting TCP plugin...",
        success: "TCP plugin reset successfully!",
        error: (err) =>
          `Failed to reset TCP plugin: ${err?.message || "Unknown error"}`,
      });
    } catch (error) {
      // toast.promise handles the error display
      console.error("Reset error:", error);
    } finally {
      setResettingPrinter(false); // ✅ Clear loading state
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
                  disabled={aggressiveTestingPrinter} // ✅ Disable during reset
                  className="flex items-center gap-2"
                >
                  {aggressiveTestingPrinter ? ( // ✅ Show loading state
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border border-red-300 border-t-red-600"></div>
                      Aggressive Testing...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4" /> {/* ✅ Correct icon */}
                      Aggressive Testing
                    </>
                  )}
                </button>
              </li>
              <li>
                <button
                  onClick={handleResetPrinter}
                  disabled={resettingPrinter} // ✅ Disable during reset
                  className="flex items-center gap-2"
                >
                  {resettingPrinter ? ( // ✅ Show loading state
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border border-red-300 border-t-red-600"></div>
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4" /> {/* ✅ Correct icon */}
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
