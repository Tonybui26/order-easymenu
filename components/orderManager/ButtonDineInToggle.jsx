"use client";
import { useState } from "react";
import { useMenuContext } from "@/components/context/MenuContext";
import {
  buildDineInOnlineOrderPauseUpdate,
  formatPauseResumeTime,
  isDineInOnlineOrderAvailable,
} from "@/lib/helper/onlineOrderPause";

export default function ButtonDineInToggle() {
  const { menuConfig, setMenuConfig } = useMenuContext();
  const [isUpdating, setIsUpdating] = useState(false);

  const isOnline = isDineInOnlineOrderAvailable(menuConfig);
  const resumeTime = formatPauseResumeTime(menuConfig?.dineInOnlinePausedUntil);

  const handleToggle = async () => {
    setIsUpdating(true);
    setMenuConfig(buildDineInOnlineOrderPauseUpdate(menuConfig, isOnline));
    setIsUpdating(false);
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-100 px-4 py-3">
      <div className="flex items-center gap-3">
        <div>
          <h3 className="text-lg font-medium">Dine-in</h3>
          {!isOnline ? (
            <p className="text-sm font-semibold text-red-600">
              {resumeTime
                ? `Paused for 30 min (opens ${resumeTime})`
                : "Paused for 30 minutes"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`text-sm font-medium ${isOnline ? "text-green-600" : "text-red-600"}`}
        >
          {isOnline ? "Available" : "Paused"}
        </span>
        <input
          type="checkbox"
          className={`toggle ${isOnline ? "toggle-success" : "toggle-error"}`}
          checked={isOnline}
          onChange={handleToggle}
          disabled={isUpdating}
        />
      </div>
    </div>
  );
}
