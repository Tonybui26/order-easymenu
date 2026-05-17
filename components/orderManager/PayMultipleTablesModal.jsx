"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  getCollectAmountSummary,
  isPendingCounterOrderForCollection,
} from "@/lib/helper/orderCollectAmount";
import { getOrdersForTables } from "@/lib/helper/unpaidTableOrders";

export const PAY_MULTIPLE_TABLES_MODAL_CLOSED = {
  show: false,
  sourceTable: null,
};

export default function PayMultipleTablesModal({
  isOpen,
  sourceTable,
  unpaidByTable,
  onClose,
  onCollectPayment,
}) {
  const [selectedTables, setSelectedTables] = useState([]);

  const otherTableNames = Object.keys(unpaidByTable ?? {})
    .filter((table) => table !== sourceTable)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  useEffect(() => {
    if (isOpen) {
      setSelectedTables([]);
    }
  }, [isOpen, sourceTable]);

  function toggleTable(table) {
    setSelectedTables((prev) =>
      prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table],
    );
  }

  function handleCollectPayment() {
    if (!sourceTable || selectedTables.length === 0) return;

    const tableNames = [sourceTable, ...selectedTables];
    const tableOrders = getOrdersForTables(unpaidByTable, tableNames);
    onCollectPayment(tableOrders);
  }

  const previewTableNames = sourceTable
    ? [sourceTable, ...selectedTables]
    : selectedTables;
  const previewOrders = getOrdersForTables(unpaidByTable, previewTableNames);
  const collectSummary = getCollectAmountSummary(
    previewOrders,
    isPendingCounterOrderForCollection,
  );

  return (
    <dialog className={`modal ${isOpen ? "modal-open" : ""}`}>
      <div className="modal-box w-[400px] max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Pay multiple tables</h3>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-circle btn-ghost btn-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          Including Table {sourceTable}. Select other tables to collect payment
          together.
        </p>

        <div className="mb-4 max-h-64 space-y-2 overflow-y-auto">
          {otherTableNames.map((table) => {
            const tableOrders = unpaidByTable[table] ?? [];
            const tableSummary = getCollectAmountSummary(
              tableOrders,
              isPendingCounterOrderForCollection,
            );

            return (
              <label
                key={table}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm mt-1"
                  checked={selectedTables.includes(table)}
                  onChange={() => toggleTable(table)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-gray-900">
                    Table {table}
                  </span>
                  <span className="block text-sm text-gray-500">
                    {tableOrders.length} order
                    {tableOrders.length !== 1 ? "s" : ""} · $
                    {tableSummary.total.toFixed(2)} to collect
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {selectedTables.length > 0 && (
          <div className="mb-4 rounded-lg bg-gray-200 p-4 text-center">
            <p className="mb-1 text-sm font-medium text-gray-600">
              Total to collect ({collectSummary.orderCount} orders)
            </p>
            <div className="text-3xl font-bold text-gray-900">
              ${collectSummary.total.toFixed(2)}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCollectPayment}
            disabled={selectedTables.length === 0}
            className="btn-primary btn flex-1 border-none"
          >
            Collect payment
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}>
        <button type="button">close</button>
      </form>
    </dialog>
  );
}
