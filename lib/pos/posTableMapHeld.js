import { isPosSourceHeldOrder } from "@/lib/pos/posHeldOrder";
import { normalizeTableMapTableName } from "@/lib/pos/posTableMaps";
import { heldEntryTableNames } from "@/lib/pos/posTableMapMerge";

export function findPosHeldOrderForTable(heldOrders, tableName) {
  const target = normalizeTableMapTableName(tableName);
  if (!target) return null;

  return (
    (heldOrders || []).find((order) => {
      if (!isPosSourceHeldOrder(order)) return false;
      return heldEntryTableNames(order).some(
        (name) => normalizeTableMapTableName(name) === target,
      );
    }) || null
  );
}
