"use client";
import { useEffect, useState } from "react";
import { Printer, Plus, Settings, MoveLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  addPrinter,
  deletePrinter,
  fetchPrinters,
  updatePrinter,
} from "@/lib/api/fetchApi";
import PrinterCard from "./components/PrinterCard";
import PrinterSetupModal from "./components/PrinterSetupModal";
import { toast } from "react-hot-toast";

export default function PrinterManagementPage() {
  const router = useRouter();
  const [autoPrintingEnabled, setAutoPrintingEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [printers, setPrinters] = useState([]);
  // Fetch printers on component mount
  useEffect(() => {
    fetchPrintersData();
  }, []);

  const fetchPrintersData = async () => {
    try {
      setLoading(true);
      const data = await fetchPrinters();
      console.log("data", data);

      setPrinters(data.printers || []);
    } catch (error) {
      console.error("Error fetching printers:", error);
      toast.error("Failed to fetch printers");
    } finally {
      setLoading(false);
    }
  };

  const [showAddPrinterModal, setShowAddPrinterModal] = useState(false);

  const handleDeletePrinter = async (printerId) => {
    try {
      await deletePrinter(printerId);
      setPrinters(printers.filter((printer) => printer._id !== printerId));
      toast.success("Printer deleted successfully");
    } catch (error) {
      console.error("Error deleting printer:", error);
      toast.error("Failed to delete printer");
    }
  };

  const handleUpdatePrinter = async (printerId, updatedData) => {
    try {
      const data = await updatePrinter(printerId, updatedData);
      setPrinters(
        printers.map((printer) =>
          printer._id === printerId ? data.printer : printer,
        ),
      );
      toast.success("Printer updated successfully");
    } catch (error) {
      console.error("Error updating printer:", error);
      toast.error("Failed to update printer");
    }
  };

  const handleAddPrinter = async (printerData) => {
    console.log("printerData", printerData);
    try {
      const data = await addPrinter(printerData);
      setPrinters([...printers, data.printer]);
      setShowAddPrinterModal(false);
      toast.success("Printer added successfully");
    } catch (error) {
      console.error("Error adding printer:", error);
      toast.error("Failed to add printer");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900 lg:text-3xl">
              Printer Management
            </h1>
            <p className="text-gray-600">
              Manage your printers and printing configurations
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="btn btn-ghost"
            title="Go back"
          >
            <MoveLeft className="mr-1 size-5" />
            Back
          </button>
        </div>

        {/* Printer Setup Section */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-orange-100 p-2">
                  <Printer className="h-5 w-5 text-brand_accent" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Printers
                </h2>
              </div>
              <button
                onClick={() => setShowAddPrinterModal(true)}
                className="btn-primary btn btn-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Printer
              </button>
            </div>
          </div>

          {/* Receipt Printers */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <span className="loading loading-spinner loading-lg text-brand_accent"></span>
                <span className="ml-3 text-gray-600">Loading printers...</span>
              </div>
            ) : printers.length === 0 ? (
              <div className="py-8 text-center">
                <Printer className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <p className="text-gray-500">No printers configured yet</p>
                <p className="text-sm text-gray-400">
                  Add your first printer to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {printers.map((printer) => (
                  <PrinterCard
                    key={printer._id}
                    printer={printer}
                    onDelete={handleDeletePrinter}
                    onUpdate={handleUpdatePrinter}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* General Printing Settings */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2">
                <Settings className="h-5 w-5 text-brand_accent" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                Configuration
              </h2>
            </div>
          </div>

          <div className="space-y-6 p-6">
            {/* Auto Printing Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="mb-1 font-medium text-gray-900">
                  Auto Printing
                </h3>
                <p className="text-sm text-gray-600">
                  Automatically print order dockets when new orders are received
                </p>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-success"
                checked={autoPrintingEnabled}
                onChange={(e) => setAutoPrintingEnabled(e.target.checked)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Add Printer Modal */}
      <PrinterSetupModal
        isOpen={showAddPrinterModal}
        onClose={() => setShowAddPrinterModal(false)}
        onSave={handleAddPrinter}
        mode="add"
      />
    </div>
  );
}
