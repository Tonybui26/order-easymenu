"use client";
import { useState } from "react";
import { useMenuContext } from "@/components/context/MenuContext";
import { X, Minus, Plus } from "lucide-react";

export default function PrepTimeControlButton() {
  const [showModal, setShowModal] = useState(false);
  const { menuConfig, setMenuConfig, updateMenuConfigField } = useMenuContext();
  const [localPrepTime, setLocalPrepTime] = useState(
    menuConfig?.prepTime || 30,
  );

  // Update local state when modal opens
  const handleOpenModal = () => {
    setLocalPrepTime(menuConfig?.prepTime || 30);
    setShowModal(true);
    console.log("menuConfig", menuConfig);
  };

  const handleSaveChanges = async () => {
    // Use the reusable function to update config with fresh server data
    await updateMenuConfigField("prepTime", localPrepTime);
    setShowModal(false);
  };

  const incrementTime = () => {
    if (localPrepTime < 120) {
      setLocalPrepTime(localPrepTime + 5);
    }
  };

  const decrementTime = () => {
    if (localPrepTime > 5) {
      setLocalPrepTime(localPrepTime - 5);
    }
  };

  const handleCancel = () => {
    // Reset local state to original value
    setLocalPrepTime(menuConfig?.prepTime || 30);
    setShowModal(false);
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="flex h-auto flex-col items-start gap-0 rounded-xl bg-neutral-700 px-4 py-1 text-left shadow-lg transition-all duration-200 hover:bg-neutral-600"
      >
        <span className="text-xs font-bold text-brand_accent">PREP TIME</span>
        <span className="text-lg font-semibold text-white">
          {menuConfig?.prepTime || 30} mins
        </span>
      </button>

      {/* Modal for Prep Time Control */}
      <dialog className={`modal ${showModal ? "modal-open" : ""}`}>
        <div className="modal-box max-w-md">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">
              Update preparation time
            </h3>
            <button
              onClick={handleCancel}
              className="btn btn-circle btn-ghost btn-sm"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Description */}
          <p className="mb-6 text-sm text-gray-600">
            This helps your customers know how long to expect before their order
            is ready for pickup.
          </p>

          {/* Time Adjustment Section */}
          <div className="mb-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-center gap-4">
              {/* Decrement Button */}
              <button
                onClick={decrementTime}
                disabled={localPrepTime <= 5}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-brand_accent text-white transition-colors hover:bg-brand_accent/90 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Minus className="h-5 w-5" />
              </button>

              {/* Current Time Display */}
              <div className="text-center">
                <span className="text-4xl font-bold text-gray-900">
                  {localPrepTime}
                </span>
                <span className="ml-2 text-lg text-gray-600">minutes</span>
              </div>

              {/* Increment Button */}
              <button
                onClick={incrementTime}
                disabled={localPrepTime >= 120}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-brand_accent text-white transition-colors hover:bg-brand_accent/90 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              This setting only affects new orders. Orders you&apos;ve already
              accepted will keep their current preparation time.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="modal-action">
            <button
              className="btn-primary btn bg-brand_accent hover:bg-brand_accent/90"
              onClick={handleSaveChanges}
            >
              Update
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop" onClick={handleCancel}>
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}
