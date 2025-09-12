"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";

const GlobalAppContext = createContext();

export const GlobalAppContextProvider = ({ children, userData }) => {
  const { data: session, status } = useSession(); // Keep this for status only
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  return (
    <GlobalAppContext.Provider
      value={{
        // Mobile menu state
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        // Sound
        soundEnabled,
        setSoundEnabled,
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
