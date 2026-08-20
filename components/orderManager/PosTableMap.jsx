"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Map } from "lucide-react";
import toast from "react-hot-toast";
import { useMenuContext } from "@/components/context/MenuContext";
import {
  fetchPosHeldOrders,
  fetchPosResumeOrders,
} from "@/lib/api/fetchApi";
import { findPosHeldOrderForTable } from "@/lib/pos/posTableMapHeld";
import { printBillForHeldCheck } from "@/lib/pos/posHeldOrderPrint";
import {
  TABLE_MAP_FLOOR_COLOR,
  getTableMapTableName,
} from "@/lib/pos/posTableMaps";
import PosChromeHeader from "./PosChromeHeader";
import PosTableMapFloor from "./PosTableMapFloor";
import PosTableMapTableDrawer from "./PosTableMapTableDrawer";
import DismissibleToast, {
  useDismissibleToast,
} from "@/components/orderManager/DismissibleToast";
import { usePosOpenCashDrawer } from "./usePosOpenCashDrawer";

const HELD_ORDERS_POLL_MS = 10000;

export default function PosTableMap() {
  const router = useRouter();
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { posTableMaps, storeProfile } = useMenuContext();
  const {
    toast: dismissibleToast,
    showToast: showDismissibleToast,
    hideToast: hideDismissibleToast,
  } = useDismissibleToast();
  const tableMaps = useMemo(() => {
    return [...(posTableMaps || [])].sort((a, b) => {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });
  }, [posTableMaps]);
  const [selectedMapId, setSelectedMapId] = useState(null);
  const [heldOrders, setHeldOrders] = useState([]);
  const [drawerTableName, setDrawerTableName] = useState(null);
  const [drawerHeldOrder, setDrawerHeldOrder] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!tableMaps.length) {
      setSelectedMapId(null);
      return;
    }
    if (!tableMaps.some((map) => map.id === selectedMapId)) {
      setSelectedMapId(tableMaps[0].id);
    }
  }, [tableMaps, selectedMapId]);

  const loadHeldOrders = useCallback(async () => {
    try {
      const result = await fetchPosHeldOrders();
      if (!result?.success) return;
      setHeldOrders(result.heldOrders || []);
    } catch {
      // Silent refresh; table map still works for new orders.
    }
  }, []);

  useEffect(() => {
    loadHeldOrders();
    const id = setInterval(loadHeldOrders, HELD_ORDERS_POLL_MS);
    return () => clearInterval(id);
  }, [loadHeldOrders]);

  const selectedMap =
    tableMaps.find((map) => map.id === selectedMapId) || tableMaps[0] || null;

  function handleCloseDrawer() {
    if (isProcessing) return;
    setDrawerTableName(null);
    setDrawerHeldOrder(null);
  }

  function handleTableSelect(object) {
    const tableName = getTableMapTableName(object);
    if (!tableName) {
      showDismissibleToast("This table has no name configured");
      return;
    }

    const heldOrder = findPosHeldOrderForTable(heldOrders, tableName);
    if (!heldOrder) {
      const params = new URLSearchParams({
        table: tableName,
        orderType: "dine-in",
      });
      router.push(`/pos?${params.toString()}`);
      return;
    }

    setDrawerTableName(tableName);
    setDrawerHeldOrder(heldOrder);
  }

  function handleLoadOrder() {
    if (!drawerHeldOrder?.orderIds?.length) return;
    router.push(
      `/pos?resume=${encodeURIComponent(drawerHeldOrder.orderIds.join(","))}`,
    );
  }

  async function handlePrintBill() {
    if (!drawerHeldOrder?.orderIds?.length || isProcessing) return;

    setIsProcessing(true);
    try {
      const result = await fetchPosResumeOrders(drawerHeldOrder.orderIds);
      if (!result?.success || !result.orders?.length) {
        showDismissibleToast(result?.error || "Could not load check");
        return;
      }

      const printResult = await printBillForHeldCheck(result.orders, {
        storeProfile,
        heldEntry: drawerHeldOrder,
      });

      if (printResult.success) {
        toast.success(printResult.message || "Bill printed");
        handleCloseDrawer();
      } else {
        showDismissibleToast(printResult.message || "Failed to print bill");
      }
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to print bill");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <>
      <DismissibleToast toast={dismissibleToast} onDismiss={hideDismissibleToast} />

      <div
        className="flex h-[100dvh] w-full flex-col overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
        style={{ backgroundColor: TABLE_MAP_FLOOR_COLOR }}
      >
        <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

        {selectedMap ? (
          <div className="relative min-h-0 flex-1 overflow-hidden pb-[env(safe-area-inset-bottom)]">
            {tableMaps.length > 1 ? (
              <div className="absolute right-4 top-2 z-20">
                <div className="flex shrink-0 space-x-1 rounded-xl bg-[#402e22] p-1 shadow-sm">
                  {tableMaps.map((map) => {
                    const isActive = map.id === selectedMap.id;
                    return (
                      <button
                        key={map.id}
                        type="button"
                        onClick={() => setSelectedMapId(map.id)}
                        className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 xl:text-base ${
                          isActive
                            ? "bg-brand_accent text-white shadow-sm"
                            : "text-white hover:bg-gray-50 hover:text-gray-800"
                        }`}
                      >
                        {map.name?.trim() || "Untitled map"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <PosTableMapFloor
              tableMap={selectedMap}
              heldOrders={heldOrders}
              onTableSelect={handleTableSelect}
            />
          </div>
        ) : (
          <div
            className="flex min-h-0 flex-1 items-center justify-center px-6 pb-[env(safe-area-inset-bottom)]"
            style={{ backgroundColor: TABLE_MAP_FLOOR_COLOR }}
          >
            <div className="flex max-w-md flex-col items-center text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-lg border border-gray-200 bg-white">
                <Map className="size-5 text-gray-400" aria-hidden />
              </div>
              <h1 className="text-xl font-bold text-neutral-900">Table Map</h1>
              <p className="mt-2 text-sm text-neutral-500">
                No floor plan yet. Create one in admin under POS → Table map.
              </p>
            </div>
          </div>
        )}
      </div>

      <PosTableMapTableDrawer
        isOpen={Boolean(drawerTableName)}
        onClose={handleCloseDrawer}
        tableName={drawerTableName}
        heldOrder={drawerHeldOrder}
        onLoadOrder={handleLoadOrder}
        onPrintBill={handlePrintBill}
        isProcessing={isProcessing}
      />
    </>
  );
}
