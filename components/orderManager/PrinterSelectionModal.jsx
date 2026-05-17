"use client";

import { Printer, X } from "lucide-react";

export const PRINTER_SELECTION_MODAL_CLOSED = {
  order: null,
  show: false,
};

function getPrinterOrderType(order) {
  const canonical = String(order?.orderType ?? "").trim();
  const isDineIn =
    canonical === "dine-in" || (order?.table && order.table !== "takeaway");
  return isDineIn ? "dinein" : "takeaway";
}

export default function PrinterSelectionModal({
  isOpen,
  order,
  availablePrinters = [],
  isLoadingPrinters = false,
  onClose,
  onSelectPrinter,
}) {
  const orderType = order ? getPrinterOrderType(order) : "takeaway";

  return (
    <dialog className={`modal ${isOpen && order ? "modal-open" : ""}`}>
      {order ? (
        <div className="modal-box w-96 max-w-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Select Printer
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-circle btn-ghost btn-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-4 text-sm text-gray-600">
            Choose which printer to print order #
            {order._id.slice(-6).toUpperCase()} to
          </p>

          {isLoadingPrinters ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-gray-500">Loading printers...</p>
            </div>
          ) : availablePrinters.length === 0 ? (
            <div className="rounded-lg bg-yellow-50 p-4 text-center">
              <p className="text-sm text-yellow-800">
                No printers available for {orderType} orders
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {availablePrinters.map((printer) => (
                <button
                  key={printer._id}
                  type="button"
                  onClick={() => onSelectPrinter(printer)}
                  className="btn btn-outline h-auto w-full justify-start gap-3 p-4 text-left"
                >
                  <Printer className="h-5 w-5 flex-shrink-0 text-gray-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{printer.name}</p>
                    <p className="text-xs text-gray-500">
                      {printer.localIp}:{printer.port}
                      {printer.isActive ? (
                        <span className="ml-2 text-green-600">● Active</span>
                      ) : (
                        <span className="ml-2 text-gray-400">● Inactive</span>
                      )}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
      <form method="dialog" className="modal-backdrop" onClick={onClose}>
        <button type="button">close</button>
      </form>
    </dialog>
  );
}
