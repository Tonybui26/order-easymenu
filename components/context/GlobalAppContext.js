"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  getNotificationSoundId,
  setNotificationSoundId as persistNotificationSoundId,
} from "@/lib/utils/notificationSound";
import {
  getNewOrderAlertsMuted,
  setNewOrderAlertsMuted as persistNewOrderAlertsMuted,
  NEW_ORDER_ALERTS_MUTED_CHANGED_EVENT,
} from "@/lib/utils/newOrderAlerts";

const GlobalAppContext = createContext();

export const GlobalAppContextProvider = ({ children, userData }) => {
  const { data: session, status } = useSession(); // Keep this for status only
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationSoundId, setNotificationSoundIdState] = useState("sound1");
  const [newOrderAlertsMuted, setNewOrderAlertsMutedState] = useState(false);

  useEffect(() => {
    setNotificationSoundIdState(getNotificationSoundId());
    setNewOrderAlertsMutedState(getNewOrderAlertsMuted());

    function onSoundChanged(event) {
      const id = event?.detail?.soundId;
      if (id) setNotificationSoundIdState(id);
      else setNotificationSoundIdState(getNotificationSoundId());
    }

    function onNewOrderAlertsMutedChanged(event) {
      if (typeof event?.detail?.muted === "boolean") {
        setNewOrderAlertsMutedState(event.detail.muted);
      } else {
        setNewOrderAlertsMutedState(getNewOrderAlertsMuted());
      }
    }

    window.addEventListener(
      "order-manager-notification-sound-changed",
      onSoundChanged,
    );
    window.addEventListener(
      NEW_ORDER_ALERTS_MUTED_CHANGED_EVENT,
      onNewOrderAlertsMutedChanged,
    );
    return () => {
      window.removeEventListener(
        "order-manager-notification-sound-changed",
        onSoundChanged,
      );
      window.removeEventListener(
        NEW_ORDER_ALERTS_MUTED_CHANGED_EVENT,
        onNewOrderAlertsMutedChanged,
      );
    };
  }, []);

  const setNotificationSoundId = useCallback((soundId) => {
    persistNotificationSoundId(soundId);
    setNotificationSoundIdState(getNotificationSoundId());
  }, []);

  const setNewOrderAlertsMuted = useCallback((muted) => {
    persistNewOrderAlertsMuted(muted);
    setNewOrderAlertsMutedState(getNewOrderAlertsMuted());
  }, []);

  return (
    <GlobalAppContext.Provider
      value={{
        // Mobile menu state
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        // Sound
        soundEnabled,
        setSoundEnabled,
        notificationSoundId,
        setNotificationSoundId,
        newOrderAlertsMuted,
        setNewOrderAlertsMuted,
        // User data (from server-side verification)
        userData,
        // Session status (for loading states)
        sessionStatus: status,
        isAuthenticated: status === "authenticated",
      }}
    >
      {children}
    </GlobalAppContext.Provider>
  );
};

export const useGlobalAppContext = () => useContext(GlobalAppContext);
