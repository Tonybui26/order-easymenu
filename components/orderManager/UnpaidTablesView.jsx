"use client";

import { DollarSign } from "lucide-react";
import UnpaidTableCard from "./UnpaidTableCard";

export default function UnpaidTablesView({
  unpaidOrdersByTable,
  showPayMultipleTables = false,
  payLaterAtCounterEnabled = false,
  onPayMultipleTables,
  onMarkOrderPaid,
  onMarkAllPaid,
}) {
  const tableEntries = Object.entries(unpaidOrdersByTable ?? {});

  if (tableEntries.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:gap-6">
        <div className="col-span-full rounded-lg bg-transparent p-12 text-center">
          <DollarSign size={48} className="mx-auto mb-4 text-brand_accent" />
          <h3 className="mb-2 text-xl font-semibold text-white">
            No Unpaid Tables
          </h3>
          <p className="text-gray-400">All tables have been paid</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:gap-6">
      {tableEntries.map(([table, tableOrders]) => (
        <UnpaidTableCard
          key={table}
          table={table}
          tableOrders={tableOrders}
          showPayMultipleTables={showPayMultipleTables}
          payLaterAtCounterEnabled={payLaterAtCounterEnabled}
          onPayMultipleTables={() => onPayMultipleTables(table)}
          onMarkOrderPaid={onMarkOrderPaid}
          onMarkAllPaid={onMarkAllPaid}
        />
      ))}
    </div>
  );
}
