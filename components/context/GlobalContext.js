"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { fetchGetUser } from "@/lib/api/fetchApi";
import { useSession } from "next-auth/react";

const GlobalAppContext = createContext();

export const GlobalAppContextProvider = ({ children }) => {
  // App-wide general state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userData, setUserData] = useState(null);
  const [isUserDataLoading, setIsUserDataLoading] = useState(false);
  const [userDataError, setUserDataError] = useState(null);

  const { data: session, status } = useSession();

  // Fetch user data when session is available
  useEffect(() => {
    if (!session?.user?.email || userData) return;

    const getUserData = async () => {
      try {
        setIsUserDataLoading(true);
        setUserDataError(null);

        const user = await fetchGetUser(session.user.email);
        setUserData(user);
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUserDataError(error.message);
      } finally {
        setIsUserDataLoading(false);
      }
    };

    getUserData();
  }, [session, userData]);

  // Function to refresh user data (for when user profile is updated)
  const refreshUserData = async () => {
    if (!session?.user?.email) return;

    try {
      setIsUserDataLoading(true);
      setUserDataError(null);

      const user = await fetchGetUser(session.user.email);
      setUserData(user);
    } catch (error) {
      console.error("Error refreshing user data:", error);
      setUserDataError(error.message);
    } finally {
      setIsUserDataLoading(false);
    }
  };

  return (
    <GlobalAppContext.Provider
      value={{
        // Mobile menu state
        isMobileMenuOpen,
        setIsMobileMenuOpen,

        // User data (available app-wide)
        userData,
        setUserData,
        isUserDataLoading,
        userDataError,
        refreshUserData,
      }}
    >
      {children}
    </GlobalAppContext.Provider>
  );
};

export const useGlobalAppContext = () => useContext(GlobalAppContext);
