"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { useMenuContext } from "@/components/context/MenuContext";
import { isCashDrawerDevicePortEnabled } from "@/lib/pos/cashDrawerConfig";
import { openCashDrawer } from "@/lib/printers/openCashDrawer";

/**
 * Shared POS header cash drawer action.
 * @param {(message: string) => void} [onError] - defaults to toast.error
 */
export function usePosOpenCashDrawer(onError) {
  const { menuConfig } = useMenuContext();
  const useDevicePort = isCashDrawerDevicePortEnabled(menuConfig);
  const [isOpeningDrawer, setIsOpeningDrawer] = useState(false);
  const showError = onError || toast.error;

  const handleOpenCashDrawer = useCallback(async () => {
    if (isOpeningDrawer) return;

    setIsOpeningDrawer(true);
    try {
      const result = await openCashDrawer({ useDevicePort });
      if (result.success) {
        toast.success(result.message);
      } else {
        showError(result.message || "Failed to open cash drawer");
      }
    } catch (error) {
      showError(error?.message || "Failed to open cash drawer");
    } finally {
      setIsOpeningDrawer(false);
    }
  }, [isOpeningDrawer, showError, useDevicePort]);

  return { handleOpenCashDrawer, isOpeningDrawer };
}
