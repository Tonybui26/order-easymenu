import {
  isPosDineInHeldOrder,
  isPosSourceHeldOrder,
} from "@/lib/pos/posHeldOrder";
import { normalizeTableMapTableName } from "@/lib/pos/posTableMaps";

export function findPosHeldOrderForTable(heldOrders, tableName) {
  const target = normalizeTableMapTableName(tableName);
  if (!target) return null;

  return (
    (heldOrders || []).find((order) => {
      if (!isPosSourceHeldOrder(order)) return false;
      if (!isPosDineInHeldOrder(order)) return false;
      return normalizeTableMapTableName(order.table) === target;
    }) || null
  );
}
