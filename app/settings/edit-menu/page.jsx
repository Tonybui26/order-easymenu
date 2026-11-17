"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import PosChromeHeader from "@/components/orderManager/PosChromeHeader";
import PosMenuLayoutView from "@/components/orderManager/posMenuLayout/PosMenuLayoutView";
import { usePosOpenCashDrawer } from "@/components/orderManager/usePosOpenCashDrawer";
import { useMenuContext } from "@/components/context/MenuContext";
import { useActiveOperator } from "@/components/context/ActiveOperatorContext";
import { usePosNavigate } from "@/components/context/PosNavigateContext";
import { canEditPosMenu } from "@/lib/staff/staffRoles";

export default function EditMenuPage() {
  const router = useRouter();
  const { navigate, setNavigationGuard } = usePosNavigate();
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { menuConfig, dataLoaded } = useMenuContext();
  const { activeOperator, hydrated: operatorHydrated } = useActiveOperator();
  const [isDirty, setIsDirty] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isSavingAndLeaving, setIsSavingAndLeaving] = useState(false);
  const leaveResolverRef = useRef(null);
  const saveRef = useRef(null);
  const canEditMenu =
    dataLoaded &&
    operatorHydrated &&
    canEditPosMenu(menuConfig, activeOperator);

  useEffect(() => {
    if (!dataLoaded || !operatorHydrated) return;
    if (!canEditMenu) router.replace("/settings");
  }, [canEditMenu, dataLoaded, operatorHydrated, router]);

  useEffect(() => {
    if (!isDirty) return;
    const clearGuard = setNavigationGuard(
      () =>
        new Promise((resolve) => {
          leaveResolverRef.current = resolve;
          setShowLeaveConfirm(true);
        }),
    );
    return () => {
      clearGuard();
      if (leaveResolverRef.current) {
        leaveResolverRef.current(false);
        leaveResolverRef.current = null;
        setShowLeaveConfirm(false);
      }
    };
  }, [isDirty, setNavigationGuard]);

  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function resolveLeave(shouldLeave) {
    setShowLeaveConfirm(false);
    setIsSavingAndLeaving(false);
    const resolve = leaveResolverRef.current;
    leaveResolverRef.current = null;
    resolve?.(shouldLeave);
  }

  async function handleSaveAndLeave() {
    if (isSavingAndLeaving) return;
    setIsSavingAndLeaving(true);
    // Take ownership so dirty-state cleanup cannot cancel leave after a successful save.
    const resolve = leaveResolverRef.current;
    leaveResolverRef.current = null;
    try {
      const saved = await saveRef.current?.();
      if (!saved) {
        leaveResolverRef.current = resolve;
        setIsSavingAndLeaving(false);
        return;
      }
      setShowLeaveConfirm(false);
      setIsSavingAndLeaving(false);
      resolve?.(true);
    } catch {
      leaveResolverRef.current = resolve;
      setIsSavingAndLeaving(false);
    }
  }

  if (!dataLoaded || !operatorHydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
      </div>
    );
  }

  if (!canEditMenu) return null;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />
      <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="btn btn-ghost btn-sm gap-1"
        >
          <ChevronLeft className="size-4" />
          Settings
        </button>
        <h1 className="text-lg font-semibold text-neutral-900">Edit Menu</h1>
      </div>
      <div className="min-h-0 flex-1">
        <PosMenuLayoutView onDirtyChange={setIsDirty} saveRef={saveRef} />
      </div>

      <dialog
        className={`modal ${showLeaveConfirm ? "modal-open" : ""}`}
        aria-labelledby="leave-edit-menu-title"
      >
        <div className="modal-box max-w-md">
          <h3
            id="leave-edit-menu-title"
            className="text-lg font-bold text-neutral-900"
          >
            Unsaved changes
          </h3>
          <p className="mt-2 text-sm text-neutral-600">
            You have unsaved menu changes. Save them before leaving, or discard
            them.
          </p>
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={isSavingAndLeaving}
              onClick={() => resolveLeave(true)}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSavingAndLeaving}
              onClick={handleSaveAndLeave}
            >
              {isSavingAndLeaving ? "Saving..." : "Save and leave"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button
            type="button"
            disabled={isSavingAndLeaving}
            onClick={() => resolveLeave(false)}
          >
            close
          </button>
        </form>
      </dialog>
    </div>
  );
}
