"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPosResumeOrders } from "@/lib/api/fetchApi";
import { useMenuContext } from "@/components/context/MenuContext";
import { printKitchenOrder } from "@/lib/helper/printKitchenOrder";
import { registerPrintToastHandler } from "@/lib/print/printToastBridge";
import DismissibleToast, {
  useDismissibleToast,
} from "@/components/orderManager/DismissibleToast";

export default function PrintToastHost() {
  const { storeProfile, itemGroups, menuConfig } = useMenuContext();
  const posEnabled = Boolean(menuConfig?.posEnabled);
  const { toast, showToast, hideToast } = useDismissibleToast();
  const [isRetrying, setIsRetrying] = useState(false);

  const showPrintToast = useCallback(
    (message, type = "error", retry = null) => {
      showToast(message, type, retry);
    },
    [showToast],
  );

  useEffect(() => {
    registerPrintToastHandler(showPrintToast, { enabled: posEnabled });
    return () => registerPrintToastHandler(null, { enabled: false });
  }, [posEnabled, showPrintToast]);

  const handleDismiss = useCallback(() => {
    hideToast();
    setIsRetrying(false);
  }, [hideToast]);

  const handleRetry = useCallback(async () => {
    const retry = toast.retry;
    if (!retry?.order || isRetrying) return;

    setIsRetrying(true);

    try {
      const orderId = String(retry.order._id);
      const result = await fetchPosResumeOrders([orderId]);
      const freshOrder = result?.orders?.[0] || retry.order;

      const printResult = await printKitchenOrder(freshOrder, {
        storeProfile,
        itemGroups,
        menuConfig,
        selectedPrinters: retry.failedPrinters?.length
          ? retry.failedPrinters
          : null,
        source: "retry",
      });

      if (printResult?.success && (printResult.failedPrints ?? 0) === 0) {
        handleDismiss();
      }
    } catch (error) {
      console.error("Print toast retry failed:", error);
    } finally {
      setIsRetrying(false);
    }
  }, [
    handleDismiss,
    isRetrying,
    itemGroups,
    menuConfig,
    storeProfile,
    toast.retry,
  ]);

  if (!posEnabled) return null;

  return (
    <DismissibleToast
      toast={toast}
      onDismiss={handleDismiss}
      onRetry={handleRetry}
      isRetrying={isRetrying}
      className="right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))]"
    />
  );
}
