"use client";

import { useState } from "react";
import { isNativeApp, getPlatform } from "@/lib/helper/platformDetection";
import { probeLocalDb } from "@/lib/localDb/sqliteClient";

/**
 * Dev-only surface shown when menu.config.isTesting is on.
 * Confirms the native SQLite plugin is reachable without rebuilding for JS changes.
 */
export default function LocalDbTestingPanel() {
  const [status, setStatus] = useState(null);
  const [isProbing, setIsProbing] = useState(false);

  async function handleProbe() {
    if (isProbing) return;
    setIsProbing(true);
    try {
      const result = await probeLocalDb();
      setStatus(result);
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
          This store has <code className="text-[11px]">config.isTesting</code>{" "}
          enabled. Use this panel to verify on-device SQLite after the native
          rebuild that includes the plugin. Later Local Mode work can ship as
          remote JS without rebuilding again.
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
          {isProbing ? "Probing…" : "Probe local SQLite"}
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
