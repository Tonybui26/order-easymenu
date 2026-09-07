"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useMenuContext } from "@/components/context/MenuContext";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";
import { resolvePosPaymentsConfig } from "@/lib/pos/posPaymentsConfig";
import SettingsToggleRow from "./SettingsToggleRow";
import SettingsOnOffBadge from "./SettingsOnOffBadge";

/**
 * Order Manager system settings (printing, POS, and future sections).
 * Draft values are saved from the Settings page save bar.
 * Local device settings apply immediately on this device only.
 */
export default function SystemSettings({
  draftPosConfig,
  onDraftPosChange,
  draftSkipKitchenDocketGroupHeaders = false,
  onDraftSkipKitchenDocketGroupHeadersChange,
  draftStaffPinLockEnabled = false,
  onDraftStaffPinLockEnabledChange,
}) {
  const { menuConfig } = useMenuContext();
  const { autoPrintingEnabled, setAutoPrintingEnabled } = useGlobalAppContext();
  const posEnabled = Boolean(menuConfig?.posEnabled);
  const tyroEnabled = Boolean(
    resolvePosPaymentsConfig(menuConfig).tyro.enabled,
  );

  function updatePosDraft(patch) {
    onDraftPosChange?.({ ...draftPosConfig, ...patch });
  }

  return (
    <div className="space-y-6">
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
            title="Auto printing"
            description="When on, this device automatically prints kitchen dockets for new paid QR and online orders and moves them to Preparing. Turn on only on the station next to the printers so other devices do not print the same order."
            checked={Boolean(autoPrintingEnabled)}
            onChange={(checked) => setAutoPrintingEnabled(checked)}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            Kitchen printing
          </h2>
        </div>
        <div className="divide-y divide-gray-100/80">
          <SettingsToggleRow
            title="Hide group names on kitchen dockets"
            description="When on, kitchen tickets print variant and modifier options without group headers (for example Size / Extras). You can still hide a single group with ((__)) in the group name. Leave off to keep current docket layout."
            checked={Boolean(draftSkipKitchenDocketGroupHeaders)}
            onChange={(checked) =>
              onDraftSkipKitchenDocketGroupHeadersChange?.(checked)
            }
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            Staff access
          </h2>
        </div>
        <div className="divide-y divide-gray-100/80">
          <SettingsToggleRow
            title="PIN lock screen"
            description="After sign-in, staff switch users with a PIN. Header Logout returns to the lock screen; only Store managers can fully log out of the app. Requires PIN codes on staff accounts in Admin."
            checked={Boolean(draftStaffPinLockEnabled)}
            onChange={(checked) =>
              onDraftStaffPinLockEnabledChange?.(checked)
            }
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">POS</h2>
        </div>
        {!posEnabled ? (
          <p className="px-6 py-4 text-sm text-neutral-500">
            POS is not enabled for this store. Enable POS in the admin
            backoffice to configure these options.
          </p>
        ) : (
          <div className="divide-y divide-gray-100/80">
            <SettingsToggleRow
              title="Restaurant mode"
              description="When on, the table map is the POS home. Staff land on the floor plan after unlock, the logo returns there, and Table Map appears in the header menu. Open a table from the map to take orders."
              checked={Boolean(draftPosConfig?.restaurantModeEnabled)}
              onChange={(checked) =>
                updatePosDraft({ restaurantModeEnabled: checked })
              }
            />
            <SettingsToggleRow
              title="Pay first mode"
              description="When on, this store runs pay-first: customers pay before kitchen/service. Leave off for pay-later (order and serve first, settle at the end). Other POS options still apply separately."
              checked={Boolean(draftPosConfig?.payFirstModeEnabled)}
              onChange={(checked) =>
                updatePosDraft({ payFirstModeEnabled: checked })
              }
            />
            <SettingsToggleRow
              title="Track food served on table map"
              description="When on, tables show Waiting to serve while kitchen food is outstanding (instead of Order sent), and stay colored after payment until all tickets are served. Aimed at pay-first; also usable on pay-later if you want serve visibility. Best with Mark all dockets served when paid off. When off, paid tables go Available immediately."
              checked={Boolean(draftPosConfig?.trackFoodServedOnTableMap)}
              onChange={(checked) =>
                updatePosDraft({ trackFoodServedOnTableMap: checked })
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
              title="Show kitchen print names on POS"
              description="When on, product and option labels on the POS use the ((kitchen alias)) from the menu title, like kitchen dockets. Group headings still hide the alias markers. When off, the POS shows the full original names. Bills and dockets are unchanged."
              checked={Boolean(draftPosConfig?.showKitchenPrintAliasesOnPos)}
              onChange={(checked) =>
                updatePosDraft({ showKitchenPrintAliasesOnPos: checked })
              }
            />
          </div>
        )}
      </section>

      {posEnabled ? (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-3">
            <h2 className="text-sm font-semibold text-neutral-900">Payments</h2>
          </div>
          <Link
            href="/settings/payments/tyro"
            className="flex items-center justify-between gap-4 px-6 py-4 transition-colors duration-200 hover:bg-brand_accent/[0.1]"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold uppercase tracking-wide text-neutral-900">
                  Tyro EFTPOS
                </h3>
                <SettingsOnOffBadge checked={tyroEnabled} variant="payment" />
              </span>
              <span className="mt-1 block text-base text-neutral-600">
                Authorise your in-store terminal with MID and TID from the
                EFTPOS machine.
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-neutral-400" />
          </Link>
        </section>
      ) : null}

      {posEnabled ? (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-3">
            <h2 className="text-sm font-semibold text-neutral-900">
              Tyro EFTPOS (dev)
            </h2>
          </div>
          <Link
            href="/tyro-test"
            className="flex items-center justify-between gap-4 px-6 py-4 transition-colors duration-200 hover:bg-brand_accent/[0.1]"
          >
            <span className="min-w-0 flex-1">
              <h3 className="text-base font-semibold uppercase tracking-wide text-neutral-900">
                Simulator pairing / purchase test
              </h3>
              <span className="mt-1 block text-base text-neutral-600">
                Isolated Tyro iClient spike. Does not mark orders paid or
                change the live Card flow.
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-neutral-400" />
          </Link>
        </section>
      ) : null}
    </div>
  );
}
