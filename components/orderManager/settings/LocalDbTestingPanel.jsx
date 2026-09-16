"use client";

import { useState } from "react";
import { useMenuContext } from "@/components/context/MenuContext";
import { isNativeApp, getPlatform } from "@/lib/helper/platformDetection";
import { isStoreOffline } from "@/lib/store/isOffline";
import { isStoreLocalDatabase } from "@/lib/store/isLocalDatabase";
import { probeLocalDb } from "@/lib/localDb/sqliteClient";
import { readMenuSnapshot } from "@/lib/localDb/menuSnapshot";
import { readPrintersSnapshot } from "@/lib/localDb/printersSnapshot";
import { readPosLiveSnapshotMeta } from "@/lib/localDb/posLiveSnapshot";
import {
  listLocalSendRecords,
  listPendingOfflinePayments,
} from "@/lib/localDb/offlineSendStore";

/**
 * Dev-only surface when menu.config.isTesting is on.
 * Probe SQLite + catalog snapshot ages (cache-first vs sync moments).
 */
export default function LocalDbTestingPanel() {
  const { menuConfig } = useMenuContext();
  const offlineModeOn = isStoreOffline(menuConfig);
  const localDatabaseOn = isStoreLocalDatabase(menuConfig);
  const [status, setStatus] = useState(null);
  const [isProbing, setIsProbing] = useState(false);

  async function handleProbe() {
    if (isProbing) return;
    setIsProbing(true);
    try {
      const db = await probeLocalDb();
      const menu = await readMenuSnapshot();
      const printers = await readPrintersSnapshot();
      const posLive = await readPosLiveSnapshotMeta();
      const localOrders = await listLocalSendRecords();
      const pendingPayments = await listPendingOfflinePayments();

      setStatus({
        database: db,
        localDatabaseOnly: localDatabaseOn,
        offlineMode: offlineModeOn,
        pendingLocalOrders: localOrders.filter((row) => row.status !== "synced")
          .length,
        pendingPayments: pendingPayments.length,
        localOrdersSample: localOrders.slice(0, 5).map((row) => ({
          localId: row.localId,
          serverOrderId: row.serverOrderId || null,
          status: row.status,
          posCheckId: row.posCheckId,
        })),
        menuSnapshot: menu
          ? {
              updatedAt: menu.updatedAt,
              updatedAtIso: new Date(menu.updatedAt).toISOString(),
              approxChars: JSON.stringify(menu.payload).length,
              hasConfig: Boolean(menu.payload?.config),
              sectionCount: Array.isArray(menu.payload?.menuContent)
                ? menu.payload.menuContent.length
                : 0,
            }
          : null,
        printersSnapshot: printers
          ? {
              updatedAt: printers.updatedAt,
              updatedAtIso: new Date(printers.updatedAt).toISOString(),
              printerCount: printers.payload?.printers?.length ?? 0,
            }
          : null,
        posLive,
      });
    } finally {
      setIsProbing(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-sky-200 bg-sky-50 shadow-sm">
      <div className="border-b border-sky-100 px-6 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          Local Mode foundation (testing)
        </h2>
        <p className="mt-0.5 text-xs text-neutral-600">
          Menu stays live unless Offline mode is on. Local database keeps
          Send/Pay on device with no auto-sync. Held occupancy still paints
          first on testing stores. Live Orders stay always live.
        </p>
      </div>
      <div className="space-y-3 px-6 py-4">
        <p className="text-sm text-neutral-700">
          Platform: <span className="font-medium">{getPlatform()}</span>
          {isNativeApp() ? " (native)" : " (web — SQLite probe needs the app)"}
        </p>
        <p className="text-sm text-neutral-700">
          Offline mode:{" "}
          <span className="font-medium">{offlineModeOn ? "on" : "off"}</span>
          <span className="text-neutral-500">
            {" "}
            — on uses the saved menu instead of a live fetch.
          </span>
        </p>
        <p className="text-sm text-neutral-700">
          Local database:{" "}
          <span className="font-medium">{localDatabaseOn ? "on" : "off"}</span>
          <span className="text-neutral-500">
            {" "}
            — on saves Send/Pay locally and skips auto-sync. Sync after changing
            it in power admin.
          </span>
        </p>
        <button
          type="button"
          onClick={handleProbe}
          disabled={isProbing}
          className="rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isProbing ? "Probing…" : "Probe local SQLite + snapshots"}
        </button>
        {status ? (
          <pre className="overflow-x-auto rounded-md bg-white/80 p-3 text-xs text-neutral-800">
            {JSON.stringify(status, null, 2)}
          </pre>
        ) : null}
      </div>
    </section>
  );
}
