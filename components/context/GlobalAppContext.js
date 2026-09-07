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
import {
  getAutoPrintingEnabled,
  setAutoPrintingEnabled as persistAutoPrintingEnabled,
  AUTO_PRINTING_ENABLED_CHANGED_EVENT,
} from "@/lib/utils/autoPrinting";

const GlobalAppContext = createContext();

export const GlobalAppContextProvider = ({ children, userData }) => {
  const { data: session, status } = useSession(); // Keep this for status only
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationSoundId, setNotificationSoundIdState] = useState("sound1");
  const [newOrderAlertsMuted, setNewOrderAlertsMutedState] = useState(false);
  const [autoPrintingEnabled, setAutoPrintingEnabledState] = useState(false);

  useEffect(() => {
    setNotificationSoundIdState(getNotificationSoundId());
    setNewOrderAlertsMutedState(getNewOrderAlertsMuted());
    setAutoPrintingEnabledState(getAutoPrintingEnabled());

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

    function onAutoPrintingEnabledChanged(event) {
      if (typeof event?.detail?.enabled === "boolean") {
        setAutoPrintingEnabledState(event.detail.enabled);
      } else {
        setAutoPrintingEnabledState(getAutoPrintingEnabled());
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
    window.addEventListener(
      AUTO_PRINTING_ENABLED_CHANGED_EVENT,
      onAutoPrintingEnabledChanged,
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
      window.removeEventListener(
        AUTO_PRINTING_ENABLED_CHANGED_EVENT,
        onAutoPrintingEnabledChanged,
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

  const setAutoPrintingEnabled = useCallback((enabled) => {
    persistAutoPrintingEnabled(enabled);
    setAutoPrintingEnabledState(getAutoPrintingEnabled());
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
        // Device-local auto-print (not store-wide)
        autoPrintingEnabled,
        setAutoPrintingEnabled,
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
