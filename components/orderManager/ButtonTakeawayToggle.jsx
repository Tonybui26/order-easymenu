"use client";
import { useState, useEffect } from "react";
import { useMenuContext } from "@/components/context/MenuContext";

export default function ButtonTakeawayToggle() {
  const { menuConfig, setMenuConfig } = useMenuContext();
  const [isOnline, setIsOnline] = useState(
    menuConfig?.takeawayOnlineOrderEnabled ?? false,
  );
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setIsOnline(menuConfig?.takeawayOnlineOrderEnabled ?? false);
  }, [menuConfig?.takeawayOnlineOrderEnabled]);

  const handleToggle = async () => {
    setIsUpdating(true);
    setMenuConfig({
      ...menuConfig,
      takeawayOnlineOrderEnabled: !isOnline,
    });
    setIsUpdating(false);
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-100 px-4 py-3">
      <div className="flex items-center gap-3">
        <div>
          <h3 className="text-lg font-medium">Online Orders</h3>
          <p
            className={`text-sm ${isOnline ? "text-gray-600" : "font-semibold text-red-600"}`}
          >
            {isOnline
              ? "Online orders are available based on schedule"
              : "Online orders are manually paused"}
          </p>
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
