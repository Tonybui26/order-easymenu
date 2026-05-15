"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  getNotificationSoundId,
  setNotificationSoundId as persistNotificationSoundId,
} from "@/lib/utils/notificationSound";

const GlobalAppContext = createContext();

export const GlobalAppContextProvider = ({ children, userData }) => {
  const { data: session, status } = useSession(); // Keep this for status only
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationSoundId, setNotificationSoundIdState] = useState("sound1");

  useEffect(() => {
    setNotificationSoundIdState(getNotificationSoundId());

    function onSoundChanged(event) {
      const id = event?.detail?.soundId;
      if (id) setNotificationSoundIdState(id);
      else setNotificationSoundIdState(getNotificationSoundId());
    }

    window.addEventListener(
      "order-manager-notification-sound-changed",
      onSoundChanged,
    );
    return () => {
      window.removeEventListener(
        "order-manager-notification-sound-changed",
        onSoundChanged,
      );
    };
  }, []);

  const setNotificationSoundId = useCallback((soundId) => {
    persistNotificationSoundId(soundId);
    setNotificationSoundIdState(getNotificationSoundId());
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
