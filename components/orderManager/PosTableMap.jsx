"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Map as MapIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useMenuContext } from "@/components/context/MenuContext";
import {
  fetchPosHeldOrders,
  fetchPosResumeOrders,
  markPosBillPrinted,
} from "@/lib/api/fetchApi";
import { findPosHeldOrderForTable } from "@/lib/pos/posTableMapHeld";
import { printBillForHeldCheck } from "@/lib/pos/posHeldOrderPrint";
import { buildCartLinesFromResumeOrders } from "@/lib/pos/posResumeOrder";
import { resolvePosConfig } from "@/lib/pos/posConfig";
import {
  getPosTableMapLegendStatuses,
  getPosTableMapStatusFill,
  POS_TABLE_MAP_STATUS,
  POS_TABLE_MAP_STATUS_LABEL,
} from "@/lib/pos/posTableMapStatus";
import {
  TABLE_MAP_DEFAULT_TABLE_BACKGROUND,
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

function orderIdsCacheKey(orderIds) {
  return (orderIds || []).map(String).join(",");
}

function previewLinesFromResumeOrders(orders) {
  return buildCartLinesFromResumeOrders(orders).filter(
    (line) => String(line.kitchenStatus || "").trim() !== "cancelled",
  );
}

export default function PosTableMap() {
  const router = useRouter();
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { posTableMaps, storeProfile, menuConfig } = useMenuContext();
  const trackFoodServedOnTableMap = Boolean(
    resolvePosConfig(menuConfig).trackFoodServedOnTableMap,
  );
  const legendStatuses = useMemo(
    () => getPosTableMapLegendStatuses(trackFoodServedOnTableMap),
    [trackFoodServedOnTableMap],
  );
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
  const [previewLines, setPreviewLines] = useState([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  /** @type {React.MutableRefObject<Map<string, object[]>>} */
  const resumeOrdersCacheRef = useRef(new Map());

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

  // Drop resume caches for checks that are no longer held (or whose ticket set changed).
  useEffect(() => {
    const validKeys = new Set(
      (heldOrders || [])
        .map((entry) => orderIdsCacheKey(entry?.orderIds))
        .filter(Boolean),
    );
    for (const key of [...resumeOrdersCacheRef.current.keys()]) {
      if (!validKeys.has(key)) resumeOrdersCacheRef.current.delete(key);
    }
  }, [heldOrders]);

  // Keep open drawer entry in sync when held poll refreshes this table.
  useEffect(() => {
    if (!drawerTableName) return;
    const latest = findPosHeldOrderForTable(heldOrders, drawerTableName);
    if (!latest) {
      if (!isProcessing) {
        setDrawerTableName(null);
        setDrawerHeldOrder(null);
      }
      return;
    }
    setDrawerHeldOrder((prev) => {
      if (
        prev &&
        orderIdsCacheKey(prev.orderIds) === orderIdsCacheKey(latest.orderIds) &&
        Number(prev.total) === Number(latest.total) &&
        Boolean(prev.allPaid) === Boolean(latest.allPaid)
      ) {
        return prev;
      }
      return latest;
    });
  }, [heldOrders, drawerTableName, isProcessing]);

  const drawerOrderIdsKey = orderIdsCacheKey(drawerHeldOrder?.orderIds);

  useEffect(() => {
    if (!drawerTableName || !drawerOrderIdsKey) {
      setPreviewLines([]);
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }

    const orderIds = drawerOrderIdsKey.split(",");
    const cached = resumeOrdersCacheRef.current.get(drawerOrderIdsKey);
    if (cached) {
      setPreviewLines(previewLinesFromResumeOrders(cached));
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setIsPreviewLoading(true);
    setPreviewError(null);

    (async () => {
      const result = await fetchPosResumeOrders(orderIds);
      if (cancelled) return;
      if (!result?.success || !result.orders?.length) {
        setPreviewLines([]);
        setPreviewError(result?.error || "Could not load items");
        setIsPreviewLoading(false);
        return;
      }
      resumeOrdersCacheRef.current.set(drawerOrderIdsKey, result.orders);
      setPreviewLines(previewLinesFromResumeOrders(result.orders));
      setIsPreviewLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [drawerTableName, drawerOrderIdsKey]);

  const selectedMap =
    tableMaps.find((map) => map.id === selectedMapId) || tableMaps[0] || null;

  function handleCloseDrawer() {
    if (isProcessing) return;
    setDrawerTableName(null);
    setDrawerHeldOrder(null);
    setPreviewLines([]);
    setPreviewError(null);
    setIsPreviewLoading(false);
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
    const cacheKey = orderIdsCacheKey(heldOrder.orderIds);
    const cached = resumeOrdersCacheRef.current.get(cacheKey);
    if (cached) {
      setPreviewLines(previewLinesFromResumeOrders(cached));
      setPreviewError(null);
      setIsPreviewLoading(false);
    } else {
      setPreviewLines([]);
      setPreviewError(null);
      setIsPreviewLoading(true);
    }
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
      const cacheKey = orderIdsCacheKey(drawerHeldOrder.orderIds);
      let orders = resumeOrdersCacheRef.current.get(cacheKey);
      if (!orders?.length) {
        const result = await fetchPosResumeOrders(drawerHeldOrder.orderIds);
        if (!result?.success || !result.orders?.length) {
          showDismissibleToast(result?.error || "Could not load check");
          return;
        }
        orders = result.orders;
        resumeOrdersCacheRef.current.set(cacheKey, orders);
        setPreviewLines(previewLinesFromResumeOrders(orders));
        setPreviewError(null);
      }

      const printResult = await printBillForHeldCheck(orders, {
        storeProfile,
        heldEntry: drawerHeldOrder,
      });

      if (printResult.success) {
        toast.success(printResult.message || "Bill printed");
        const markResult = await markPosBillPrinted(drawerHeldOrder.orderIds);
        if (!markResult?.success) {
          showDismissibleToast(
            markResult?.error || "Bill printed, but status was not updated",
          );
        } else {
          await loadHeldOrders();
        }
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
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
              <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-[#402e22]/95 px-3 py-2 shadow-sm ring-1 ring-white/10">
                {legendStatuses.map((status) => {
                  const fill =
                    status === POS_TABLE_MAP_STATUS.available
                      ? TABLE_MAP_DEFAULT_TABLE_BACKGROUND
                      : getPosTableMapStatusFill(status);
                  return (
                    <div
                      key={status}
                      className="flex items-center gap-1.5 text-xs font-medium text-white/90"
                    >
                      <span
                        className="size-3 shrink-0 rounded-sm ring-1 ring-black/20"
                        style={{ backgroundColor: fill }}
                        aria-hidden
                      />
                      <span>{POS_TABLE_MAP_STATUS_LABEL[status]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <PosTableMapFloor
              tableMap={selectedMap}
              heldOrders={heldOrders}
              trackFoodServedOnTableMap={trackFoodServedOnTableMap}
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
                <MapIcon className="size-5 text-gray-400" aria-hidden />
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
        previewLines={previewLines}
        isPreviewLoading={isPreviewLoading}
        previewError={previewError}
      />
    </>
  );
}
