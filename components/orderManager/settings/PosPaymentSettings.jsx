"use client";

import { useMenuContext } from "@/components/context/MenuContext";
import { resolvePosConfig } from "@/lib/pos/posConfig";

export default function PosPaymentSettings() {
  const { menuConfig, updateMenuConfigField } = useMenuContext();
  const posConfig = resolvePosConfig(menuConfig);
  const posEnabled = Boolean(menuConfig?.posEnabled);

  if (!posEnabled) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Point of Sale</h2>
        <p className="mt-2 text-sm text-neutral-500">
          POS is not enabled for this store. Enable POS in the admin backoffice
          to configure counter settings here.
        </p>
      </div>
    );
  }

  async function handleMarkDeliveredOnPaymentChange(checked) {
    await updateMenuConfigField("pos", {
      ...posConfig,
      markAllTicketsDeliveredOnPayment: checked,
    });
  }

  async function handleTrainingModeChange(checked) {
    await updateMenuConfigField("pos", {
      ...posConfig,
      trainingModeEnabled: checked,
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="divide-y divide-gray-100">
        <label className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4">
          <span className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold uppercase text-gray-600">
              Enable training / testing mode
            </h2>
            <span className="mt-1 block text-base text-neutral-500">
              Turn on for staff to practise on the POS without affecting live
              sales.
            </span>
          </span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-lg shrink-0"
            checked={Boolean(posConfig.trainingModeEnabled)}
            onChange={(event) => handleTrainingModeChange(event.target.checked)}
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4">
          <span className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold uppercase text-gray-600">
              Mark all dockets served when paid
            </h2>
            <span className="mt-1 block text-base text-neutral-500">
              For pay-at-counter stores: when the customer pays, every kitchen
              docket on the check is marked delivered. Leave off for pay-first
              stores where food is served after payment.
            </span>
          </span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-lg shrink-0"
            checked={Boolean(posConfig.markAllTicketsDeliveredOnPayment)}
            onChange={(event) =>
              handleMarkDeliveredOnPaymentChange(event.target.checked)
            }
          />
        </label>
      </div>
    </div>
  );
}
