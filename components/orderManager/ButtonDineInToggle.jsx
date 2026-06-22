"use client";
import { useState, useEffect } from "react";
import { useMenuContext } from "@/components/context/MenuContext";

export default function ButtonDineInToggle() {
  const { menuConfig, setMenuConfig } = useMenuContext();
  const [isOnline, setIsOnline] = useState(
    menuConfig?.dineInOnlineOrderEnabled ?? true,
  );
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setIsOnline(menuConfig?.dineInOnlineOrderEnabled ?? true);
  }, [menuConfig?.dineInOnlineOrderEnabled]);

  const handleToggle = async () => {
    setIsUpdating(true);
    setMenuConfig({
      ...menuConfig,
      dineInOnlineOrderEnabled: !isOnline,
    });
    setIsUpdating(false);
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-100 px-4 py-3">
      <div className="flex items-center gap-3">
        <div>
          <h3 className="text-lg font-medium">Dine-in Orders</h3>
          <p
            className={`text-sm ${isOnline ? "text-gray-600" : "font-semibold text-red-600"}`}
          >
            {isOnline
              ? "Dine-in orders are available based on schedule"
              : "Dine-in orders are manually paused"}
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
