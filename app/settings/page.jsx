"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import PosChromeHeader from "@/components/orderManager/PosChromeHeader";
import LocalDeviceSettings from "@/components/orderManager/settings/LocalDeviceSettings";
import PrinterManagement from "@/components/orderManager/settings/PrinterManagement";
import SystemSettings from "@/components/orderManager/settings/SystemSettings";
import SettingsSaveBar from "@/components/orderManager/settings/SettingsSaveBar";
import { usePosOpenCashDrawer } from "@/components/orderManager/usePosOpenCashDrawer";
import { useMenuContext } from "@/components/context/MenuContext";
import { fetchGetMenuByOwnerEmail } from "@/lib/api/fetchApi";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";
import { resolvePosConfig } from "@/lib/pos/posConfig";
import { posConfigDraftEquals } from "@/lib/pos/posConfigDraft";

const SETTINGS_SECTIONS = [
  { id: "configuration", label: "Configuration" },
  { id: "local-device", label: "Local device settings" },
  { id: "printers", label: "Printers" },
];

function isSettingsSection(id) {
  return SETTINGS_SECTIONS.some((section) => section.id === id);
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get("section");
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { userData } = useGlobalAppContext();
  const { menuConfig, saveMenuConfigExplicit, dataLoaded } = useMenuContext();
  const savedPosConfig = useMemo(
    () => resolvePosConfig(menuConfig),
    [menuConfig],
  );
  const savedSkipKitchenDocketGroupHeaders = Boolean(
    menuConfig?.skipKitchenDocketGroupHeaders,
  );
  const savedKitchenPrintingEnabled =
    menuConfig?.kitchenPrintingEnabled !== false;
  const savedStaffPinLockEnabled = Boolean(menuConfig?.staffPinLockEnabled);
  const [draftPosConfig, setDraftPosConfig] = useState(savedPosConfig);
  const [draftSkipKitchenDocketGroupHeaders, setDraftSkipKitchenDocketGroupHeaders] =
    useState(savedSkipKitchenDocketGroupHeaders);
  const [draftKitchenPrintingEnabled, setDraftKitchenPrintingEnabled] =
    useState(savedKitchenPrintingEnabled);
  const [draftStaffPinLockEnabled, setDraftStaffPinLockEnabled] = useState(
    savedStaffPinLockEnabled,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(() =>
    isSettingsSection(sectionParam) ? sectionParam : "configuration",
  );

  useEffect(() => {
    if (isSettingsSection(sectionParam)) setActiveSection(sectionParam);
  }, [sectionParam]);

  function selectSection(id) {
    setActiveSection(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id === "configuration") params.delete("section");
    else params.set("section", id);
    const query = params.toString();
    router.replace(query ? `/settings?${query}` : "/settings", {
      scroll: false,
    });
  }

  const isDirty = useMemo(
    () =>
      !posConfigDraftEquals(draftPosConfig, savedPosConfig) ||
      draftSkipKitchenDocketGroupHeaders !==
        savedSkipKitchenDocketGroupHeaders ||
      draftKitchenPrintingEnabled !== savedKitchenPrintingEnabled ||
      draftStaffPinLockEnabled !== savedStaffPinLockEnabled,
    [
      draftPosConfig,
      savedPosConfig,
      draftSkipKitchenDocketGroupHeaders,
      savedSkipKitchenDocketGroupHeaders,
      draftKitchenPrintingEnabled,
      savedKitchenPrintingEnabled,
      draftStaffPinLockEnabled,
      savedStaffPinLockEnabled,
    ],
  );

  useEffect(() => {
    if (!isDirty) {
      setDraftPosConfig(savedPosConfig);
      setDraftSkipKitchenDocketGroupHeaders(
        savedSkipKitchenDocketGroupHeaders,
      );
      setDraftKitchenPrintingEnabled(savedKitchenPrintingEnabled);
      setDraftStaffPinLockEnabled(savedStaffPinLockEnabled);
    }
  }, [
    savedPosConfig,
    savedSkipKitchenDocketGroupHeaders,
    savedKitchenPrintingEnabled,
    savedStaffPinLockEnabled,
    isDirty,
  ]);

  async function handleSaveSettings() {
    if (!isDirty || isSaving || !userData?.ownerEmail) return;

    setIsSaving(true);
    try {
      const latestData = await fetchGetMenuByOwnerEmail(userData.ownerEmail);
      const freshConfig = latestData?.config || {};
      const configToSave = {
        ...freshConfig,
        kitchenPrintingEnabled: draftKitchenPrintingEnabled,
        skipKitchenDocketGroupHeaders: draftSkipKitchenDocketGroupHeaders,
        staffPinLockEnabled: draftStaffPinLockEnabled,
        pos: {
          ...resolvePosConfig(freshConfig),
          ...draftPosConfig,
        },
      };

      const result = await saveMenuConfigExplicit(configToSave);
      if (result?.success) {
        toast.success("Settings saved");
      } else {
        toast.error("Failed to save settings");
      }
    } catch (error) {
      toast.error(error?.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-44 shrink-0 flex-col border-r border-gray-200 bg-[#f3f3f3] sm:w-56">
          <p className="px-4 pb-2 pt-4 text-xs font-medium text-gray-500">
            Settings
          </p>
          <nav aria-label="Settings">
            {SETTINGS_SECTIONS.map((section) => {
              const isActive = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => selectSection(section.id)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm ${
                    isActive
                      ? "bg-[#f6d2c4] font-semibold text-neutral-900"
                      : "text-neutral-700 hover:bg-black/[0.04]"
                  }`}
                >
                  {section.label}
                  {isActive ? (
                    <ChevronRight className="size-4 shrink-0" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <div
          className={`min-w-0 flex-1 overflow-y-auto bg-gray-50 ${
            isDirty ? "pb-24" : "pb-[env(safe-area-inset-bottom)]"
          }`}
        >
          <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
            {activeSection === "printers" ? (
              <PrinterManagement
                draftKitchenPrintingEnabled={draftKitchenPrintingEnabled}
                onDraftKitchenPrintingEnabledChange={
                  setDraftKitchenPrintingEnabled
                }
                draftSkipKitchenDocketGroupHeaders={
                  draftSkipKitchenDocketGroupHeaders
                }
                onDraftSkipKitchenDocketGroupHeadersChange={
                  setDraftSkipKitchenDocketGroupHeaders
                }
              />
            ) : !dataLoaded ? (
              <>
                <div>
                  <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">
                    {activeSection === "local-device"
                      ? "Local device settings"
                      : "Settings"}
                  </h1>
                  <p className="mt-0.5 text-sm text-neutral-500">
                    {activeSection === "local-device"
                      ? "Applies only on this device"
                      : "App preferences and configuration"}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
                  Loading settings…
                </div>
              </>
            ) : activeSection === "local-device" ? (
              <>
                <div>
                  <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">
                    Local device settings
                  </h1>
                  <p className="mt-0.5 text-sm text-neutral-500">
                    Applies only on this device
                  </p>
                </div>
                <LocalDeviceSettings
                  kitchenPrintingOn={draftKitchenPrintingEnabled}
                />
              </>
            ) : (
              <>
                <div>
                  <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">
                    Settings
                  </h1>
                  <p className="mt-0.5 text-sm text-neutral-500">
                    App preferences and configuration
                  </p>
                </div>
                <SystemSettings
                  draftPosConfig={draftPosConfig}
                  onDraftPosChange={setDraftPosConfig}
                  draftStaffPinLockEnabled={draftStaffPinLockEnabled}
                  onDraftStaffPinLockEnabledChange={setDraftStaffPinLockEnabled}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <SettingsSaveBar
        isVisible={isDirty}
        isSaving={isSaving}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
