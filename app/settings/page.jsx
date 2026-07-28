"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import PosChromeHeader from "@/components/orderManager/PosChromeHeader";
import SystemSettings from "@/components/orderManager/settings/SystemSettings";
import SettingsSaveBar from "@/components/orderManager/settings/SettingsSaveBar";
import { usePosOpenCashDrawer } from "@/components/orderManager/usePosOpenCashDrawer";
import { useMenuContext } from "@/components/context/MenuContext";
import { fetchGetMenuByOwnerEmail } from "@/lib/api/fetchApi";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";
import { resolvePosConfig } from "@/lib/pos/posConfig";
import { posConfigDraftEquals } from "@/lib/pos/posConfigDraft";

export default function SettingsPage() {
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { userData } = useGlobalAppContext();
  const { menuConfig, saveMenuConfigExplicit, dataLoaded } = useMenuContext();
  const savedPosConfig = useMemo(
    () => resolvePosConfig(menuConfig),
    [menuConfig],
  );
  const [draftPosConfig, setDraftPosConfig] = useState(savedPosConfig);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = useMemo(
    () => !posConfigDraftEquals(draftPosConfig, savedPosConfig),
    [draftPosConfig, savedPosConfig],
  );

  useEffect(() => {
    if (!isDirty) {
      setDraftPosConfig(savedPosConfig);
    }
  }, [savedPosConfig, isDirty]);

  async function handleSaveSettings() {
    if (!isDirty || isSaving || !userData?.ownerEmail) return;

    setIsSaving(true);
    try {
      const latestData = await fetchGetMenuByOwnerEmail(userData.ownerEmail);
      const freshConfig = latestData?.config || {};
      const configToSave = {
        ...freshConfig,
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
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

      <div
        className={`min-h-0 flex-1 overflow-y-auto bg-gray-50 ${
          isDirty ? "pb-24" : "pb-[env(safe-area-inset-bottom)]"
        }`}
      >
        <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
          <div>
            <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">
              Settings
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              App preferences and configuration
            </p>
          </div>

          {dataLoaded ? (
            <SystemSettings
              draftPosConfig={draftPosConfig}
              onDraftChange={setDraftPosConfig}
            />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
              Loading settings…
            </div>
          )}
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
