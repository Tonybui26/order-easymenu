"use client";

import { useGlobalAppContext } from "@/components/context/GlobalAppContext";
import SettingsToggleRow from "./SettingsToggleRow";

/**
 * Settings that apply only on this device. Changes take effect immediately.
 */
export default function LocalDeviceSettings({ kitchenPrintingOn = true }) {
  const {
    autoPrintingEnabled,
    setAutoPrintingEnabled,
    masterDeviceEnabled,
    setMasterDeviceEnabled,
  } = useGlobalAppContext();

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          Local device settings
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Applies only on this device. Other tablets or phones in the store
          keep their own settings.
        </p>
      </div>
      <div className="divide-y divide-gray-100/80">
        <SettingsToggleRow
          title="Master device"
          description="When on, this device shows self-order alert popups and runs QR auto-print from the shared alerts host (including on the lock screen). Turn off on secondary tablets so only one station alerts and auto-prints."
          checked={Boolean(masterDeviceEnabled)}
          onChange={(checked) => setMasterDeviceEnabled(checked)}
        />
        <SettingsToggleRow
          title="Auto printing"
          description="When on, this device automatically prints kitchen dockets for new paid QR and online orders and moves them to Preparing. Turn on only on the station next to the printers so other devices do not print the same order."
          checked={Boolean(autoPrintingEnabled)}
          onChange={(checked) => setAutoPrintingEnabled(checked)}
          disabled={!kitchenPrintingOn || !masterDeviceEnabled}
        />
      </div>
    </section>
  );
}
