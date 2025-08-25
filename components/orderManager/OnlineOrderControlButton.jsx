"use client";
import { useState, useEffect } from "react";
import { useMenuContext } from "@/components/context/MenuContext";
import ButtonTakeawayToggle from "./ButtonTakeawayToggle";

// Client-side only time component to avoid hydration issues
function TimeDisplay() {
  const [time, setTime] = useState("00:00");

  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      );
    };

    updateTime(); // Set initial time
    const interval = setInterval(updateTime, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  return <span>{time}</span>;
}

export default function OnlineOrderControlButton() {
  const [showModal, setShowModal] = useState(false);
  const { menuConfig } = useMenuContext();
  const isOnline = menuConfig?.takeawayOnlineOrderEnabled ?? false;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`btn flex h-auto flex-col items-start gap-0 rounded-xl px-4 py-1 text-left transition-colors ${
          isOnline
            ? "bg-gray-100 hover:bg-gray-200"
            : "bg-red-50 hover:bg-red-100"
        }`}
      >
        <span
          className={`text-xs font-bold ${isOnline ? "text-green-400" : "text-red-400"}`}
        >
          {isOnline ? "OPEN" : "PAUSED"}
        </span>
        <span className="text-lg font-semibold text-gray-800">
          <TimeDisplay />
        </span>
      </button>

      {/* Modal for Online Order Control */}
      <dialog className={`modal ${showModal ? "modal-open" : ""}`}>
        <div className="modal-box">
          <h3 className="text-lg font-bold">Online Order Control</h3>
          <div className="py-4">
            <ButtonTakeawayToggle />
          </div>
          <div className="modal-action">
            <button className="btn" onClick={() => setShowModal(false)}>
              Close
            </button>
          </div>
        </div>
        <form
          method="dialog"
          className="modal-backdrop"
          onClick={() => setShowModal(false)}
        >
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}
