"use client";

import { useMenuContext } from "@/components/context/MenuContext";
import SettingsToggleRow from "./SettingsToggleRow";

/**
 * Order Manager system settings (POS and future sections).
 * Draft values are saved from the Settings page save bar.
 */
export default function SystemSettings({ draftPosConfig, onDraftChange }) {
  const { menuConfig } = useMenuContext();
  const posEnabled = Boolean(menuConfig?.posEnabled);

  function updatePosDraft(patch) {
    onDraftChange?.({ ...draftPosConfig, ...patch });
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {!posEnabled ? (
          <p className="px-6 py-4 text-sm text-neutral-500">
            POS is not enabled for this store. Enable POS in the admin
            backoffice to configure these options.
          </p>
        ) : (
          <div className="divide-y divide-gray-100/80">
            <SettingsToggleRow
              title="Enable training / testing mode"
              description={
                <>
                  Turn on for staff to practise on the POS without affecting
                  live sales.{" "}
                  <strong>Strictly for training and testing purposes.</strong>
                </>
              }
              checked={Boolean(draftPosConfig?.trainingModeEnabled)}
              onChange={(checked) =>
                updatePosDraft({ trainingModeEnabled: checked })
              }
            />
            <SettingsToggleRow
              title="Mark all dockets served when paid"
              description="For pay-at-counter stores: when the customer pays, every kitchen docket on the check is marked delivered. Leave off for pay-first stores where food is served after payment."
              checked={Boolean(
                draftPosConfig?.markAllTicketsDeliveredOnPayment,
              )}
              onChange={(checked) =>
                updatePosDraft({ markAllTicketsDeliveredOnPayment: checked })
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}
