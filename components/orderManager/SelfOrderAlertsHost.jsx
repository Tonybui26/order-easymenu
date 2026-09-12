"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";
import { useMenuContext } from "@/components/context/MenuContext";
import { usePosNavigate } from "@/components/context/PosNavigateContext";
import { isSelfOrderAlertsEnabled } from "@/lib/pos/selfOrderAlertsConfig";
import { POS_HELD_ORDERS_TAB_SELF_ORDERING } from "./PosHeldOrders";
import SelfOrderAlertStack from "./SelfOrderAlertStack";
import {
  SELF_ORDER_BATCH_ALERT_ID,
  useSelfOrderAlerts,
} from "./useSelfOrderAlerts";

const DISABLED_PATHS = new Set([
  "/", // Live Order Terminal owns its own alerts + auto-print
  "/customer-display",
  "/signin",
  "/signup",
]);

function SelfOrderAlertsHostActive() {
  const { navigate } = usePosNavigate();
  const {
    alerts,
    dismissSelfOrderAlert,
    prepareSelfOrderAlert,
  } = useSelfOrderAlerts();

  const handleSend = useCallback(
    (alertId) => {
      if (alertId === SELF_ORDER_BATCH_ALERT_ID) {
        navigate(`/pos/held?tab=${POS_HELD_ORDERS_TAB_SELF_ORDERING}`);
        return;
      }
      void prepareSelfOrderAlert(alertId);
    },
    [navigate, prepareSelfOrderAlert],
  );

  return (
    <SelfOrderAlertStack
      alerts={alerts}
      onDismiss={dismissSelfOrderAlert}
      onSend={handleSend}
    />
  );
}

/**
 * Single app-wide self-order alert + auto-print host.
 * Mounted outside RequireActiveOperator so the lock screen still receives
 * new QR order alerts and kitchen auto-print. Skips Live Orders (own poller),
 * public/rear-display routes, non-master devices, and stores with
 * menu.config.selfOrderAlertsEnabled off.
 */
export default function SelfOrderAlertsHost() {
  const pathname = usePathname();
  const { status } = useSession();
  const { masterDeviceEnabled } = useGlobalAppContext();
  const { menuConfig } = useMenuContext();
  const enabled =
    status === "authenticated" &&
    Boolean(masterDeviceEnabled) &&
    isSelfOrderAlertsEnabled(menuConfig) &&
    !DISABLED_PATHS.has(pathname || "");

  if (!enabled) return null;

  return <SelfOrderAlertsHostActive />;
}
