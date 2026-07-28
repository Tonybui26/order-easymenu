"use client";

import { useMenuContext } from "@/components/context/MenuContext";

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
      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Point of Sale</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Counter terminal behaviour and staff practice mode
          </p>
        </div>

        {!posEnabled ? (
          <p className="px-6 py-4 text-sm text-neutral-500">
            POS is not enabled for this store. Enable POS in the admin backoffice
            to configure these options.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            <label className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4">
              <span className="min-w-0 flex-1">
                <h3 className="text-base font-semibold uppercase text-gray-600">
                  Enable training / testing mode
                </h3>
                <span className="mt-1 block text-base text-neutral-500">
                  Turn on for staff to practise on the POS without affecting
                  live sales.{" "}
                  <strong>Strictly for training and testing purposes.</strong>
                </span>
              </span>
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-lg shrink-0"
                checked={Boolean(draftPosConfig?.trainingModeEnabled)}
                onChange={(event) =>
                  updatePosDraft({ trainingModeEnabled: event.target.checked })
                }
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4">
              <span className="min-w-0 flex-1">
                <h3 className="text-base font-semibold uppercase text-gray-600">
                  Mark all dockets served when paid
                </h3>
                <span className="mt-1 block text-base text-neutral-500">
                  For pay-at-counter stores: when the customer pays, every
                  kitchen docket on the check is marked delivered. Leave off for
                  pay-first stores where food is served after payment.
                </span>
              </span>
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-lg shrink-0"
                checked={Boolean(
                  draftPosConfig?.markAllTicketsDeliveredOnPayment,
                )}
                onChange={(event) =>
                  updatePosDraft({
                    markAllTicketsDeliveredOnPayment: event.target.checked,
                  })
                }
              />
            </label>
          </div>
        )}
      </section>
    </div>
  );
}
