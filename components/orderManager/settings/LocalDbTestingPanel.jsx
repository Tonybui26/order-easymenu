"use client";

import { useState } from "react";
import { isNativeApp, getPlatform } from "@/lib/helper/platformDetection";
import { probeLocalDb } from "@/lib/localDb/sqliteClient";
import { readMenuSnapshot } from "@/lib/localDb/menuSnapshot";
import { readPrintersSnapshot } from "@/lib/localDb/printersSnapshot";

/**
 * Dev-only surface shown when menu.config.isTesting is on.
 * Confirms SQLite + catalog snapshots after sync moments (sign-in / Reload / PIN unlock).
 */
export default function LocalDbTestingPanel() {
  const [status, setStatus] = useState(null);
  const [isProbing, setIsProbing] = useState(false);

  async function handleProbe() {
    if (isProbing) return;
    setIsProbing(true);
    try {
      const db = await probeLocalDb();
      const menu = await readMenuSnapshot();
      const printers = await readPrintersSnapshot();

      setStatus({
        database: db,
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
          Catalog cache is on for this store (
          <code className="text-[11px]">config.isTesting</code>). Sync moments
          write menu + printers to SQLite: first authenticated load / Reload
          (SSR), and PIN unlock. During a long unlock, printers prefer local
          cache. Live Orders polling stays always live.
        </p>
      </div>
      <div className="space-y-3 px-6 py-4">
        <p className="text-sm text-neutral-700">
          Platform: <span className="font-medium">{getPlatform()}</span>
          {isNativeApp() ? " (native)" : " (web — SQLite probe needs the app)"}
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
