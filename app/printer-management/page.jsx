"use client";
import { useEffect, useState } from "react";
import { Printer, Plus } from "lucide-react";
import {
  addPrinter,
  deletePrinter,
  fetchPrinters,
  updatePrinter,
} from "@/lib/api/fetchApi";
import PrinterCard from "./components/PrinterCard";
import PrinterSetupModal from "./components/PrinterSetupModal";
import { toast } from "react-hot-toast";
import PosChromeHeader from "@/components/orderManager/PosChromeHeader";
import { usePosOpenCashDrawer } from "@/components/orderManager/usePosOpenCashDrawer";

export default function PrinterManagementPage() {
  const [loading, setLoading] = useState(true);
  const [printers, setPrinters] = useState([]);
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
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
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-7xl p-4 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">
              Printer Management
            </h1>
            <button
              type="button"
              onClick={() => setShowAddPrinterModal(true)}
              className="btn-primary btn btn-sm w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add New Printer
            </button>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-gray-500">
                <span className="loading loading-spinner loading-md text-brand_accent" />
                <p className="mt-3">Loading printers…</p>
              </div>
            ) : printers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center">
                <Printer className="mx-auto h-12 w-12 text-gray-400" />
                <p className="text-gray-500">No printers configured yet</p>
                <button
                  type="button"
                  onClick={() => setShowAddPrinterModal(true)}
                  className="flex items-center gap-2 rounded-lg bg-brand_accent px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-brand_accent/90"
                >
                  <Plus className="h-4 w-4" />
                  Add Your First Printer
                </button>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-x-3 gap-y-10 pt-6 sm:grid-cols-2 xl:grid-cols-3">
                {printers.map((printer) => (
                  <li key={printer._id} className="min-w-0">
                    <PrinterCard
                      printer={printer}
                      onDelete={handleDeletePrinter}
                      onUpdate={handleUpdatePrinter}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <PrinterSetupModal
        isOpen={showAddPrinterModal}
        onClose={() => setShowAddPrinterModal(false)}
        onSave={handleAddPrinter}
        mode="add"
      />
    </div>
  );
}
