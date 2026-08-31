"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPosResumeOrders } from "@/lib/api/fetchApi";
import { useMenuContext } from "@/components/context/MenuContext";
import { printKitchenOrder } from "@/lib/helper/printKitchenOrder";
import { registerPrintToastHandler } from "@/lib/print/printToastBridge";
import { DismissibleToastStack, useDismissibleToastQueue } from "@/components/orderManager/DismissibleToast";

export default function PrintToastHost() {
  const { storeProfile, itemGroups, menuConfig } = useMenuContext();
  const posEnabled = Boolean(menuConfig?.posEnabled);
  const { toasts, showToast, dismissToast } = useDismissibleToastQueue();
  const [retryingToastId, setRetryingToastId] = useState(null);

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

  const handleDismiss = useCallback(
    (toastId) => {
      dismissToast(toastId);
      setRetryingToastId((current) => (current === toastId ? null : current));
    },
    [dismissToast],
  );

  const handleRetry = useCallback(
    async (toastId) => {
      const entry = toasts.find((toast) => toast.id === toastId);
      const retry = entry?.retry;
      if (!retry?.order || retryingToastId) return;

      setRetryingToastId(toastId);

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
          handleDismiss(toastId);
        }
      } catch (error) {
        console.error("Print toast retry failed:", error);
      } finally {
        setRetryingToastId((current) => (current === toastId ? null : current));
      }
    },
    [
      handleDismiss,
      itemGroups,
      menuConfig,
      retryingToastId,
      storeProfile,
      toasts,
    ],
  );

  if (!posEnabled) return null;

  return (
    <DismissibleToastStack
      toasts={toasts}
      onDismiss={handleDismiss}
      onRetry={handleRetry}
      retryingToastId={retryingToastId}
      className="right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))]"
    />
  );
}
