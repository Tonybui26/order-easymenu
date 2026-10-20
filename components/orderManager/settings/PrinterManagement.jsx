"use client";

import { useEffect, useState } from "react";
import { Plus, Printer } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  addPrinter,
  deletePrinter,
  fetchPrinters,
  refreshPrintersCache,
  updatePrinter,
} from "@/lib/api/fetchApi";
import PrinterCard from "@/app/printer-management/components/PrinterCard";
import PrinterSetupModal from "@/app/printer-management/components/PrinterSetupModal";
import SettingsToggleRow from "./SettingsToggleRow";

export default function PrinterManagement({
  draftKitchenPrintingEnabled = true,
  onDraftKitchenPrintingEnabledChange,
  draftSkipKitchenDocketGroupHeaders = false,
  onDraftSkipKitchenDocketGroupHeadersChange,
}) {
  const [loading, setLoading] = useState(true);
  const [printers, setPrinters] = useState([]);
  const [showAddPrinterModal, setShowAddPrinterModal] = useState(false);
  const kitchenPrintingOn = Boolean(draftKitchenPrintingEnabled);

  useEffect(() => {
    fetchPrintersData();
  }, []);

  async function fetchPrintersData() {
    try {
      setLoading(true);
      const data = await fetchPrinters();
      setPrinters(data.printers || []);
    } catch (error) {
      console.error("Error fetching printers:", error);
      toast.error("Failed to fetch printers");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePrinter(printerId) {
    try {
      await deletePrinter(printerId);
      const data = await refreshPrintersCache();
      setPrinters(data.printers || []);
      toast.success("Printer deleted successfully");
    } catch (error) {
      console.error("Error deleting printer:", error);
      toast.error("Failed to delete printer");
    }
  }

  async function handleUpdatePrinter(printerId, updatedData) {
    try {
      await updatePrinter(printerId, updatedData);
      const data = await refreshPrintersCache();
      setPrinters(data.printers || []);
      toast.success("Printer updated successfully");
    } catch (error) {
      console.error("Error updating printer:", error);
      toast.error("Failed to update printer");
    }
  }

  async function handleAddPrinter(printerData) {
    try {
      await addPrinter(printerData);
      const data = await refreshPrintersCache();
      setPrinters(data.printers || []);
      setShowAddPrinterModal(false);
      toast.success("Printer added successfully");
    } catch (error) {
      console.error("Error adding printer:", error);
      toast.error("Failed to add printer");
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">
            Printers
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Receipt and kitchen printer setup
          </p>
        </div>
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

      <section className="mt-8 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            Kitchen printing
          </h2>
        </div>
        <div className="divide-y divide-gray-100/80">
          <SettingsToggleRow
            title="Enable kitchen printing"
            description="When on, kitchen dockets print on Send, Prepare, and auto-print, and Reprint Order is available. Turn off for stores that run without kitchen docket printers."
            checked={kitchenPrintingOn}
            onChange={(checked) =>
              onDraftKitchenPrintingEnabledChange?.(checked)
            }
          />
          <SettingsToggleRow
            title="Hide group names on kitchen dockets"
            description="When on, kitchen tickets print variant and modifier options without group headers (for example Size / Extras). You can still hide a single group with ((__)) in the group name. Leave off to keep current docket layout."
            checked={Boolean(draftSkipKitchenDocketGroupHeaders)}
            onChange={(checked) =>
              onDraftSkipKitchenDocketGroupHeadersChange?.(checked)
            }
            disabled={!kitchenPrintingOn}
          />
        </div>
      </section>

      <PrinterSetupModal
        isOpen={showAddPrinterModal}
        onClose={() => setShowAddPrinterModal(false)}
        onSave={handleAddPrinter}
        mode="add"
      />
    </div>
  );
}
