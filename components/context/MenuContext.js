"use client";

import { updateMenuConfig, fetchGetMenuByOwnerEmail } from "@/lib/api/fetchApi";
import { useSkipInitialEffect } from "@/lib/hooks/useSkipInitialEffect";
import { useEffect, useState, createContext, useContext, useRef } from "react";
import toast from "react-hot-toast";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";

const MenuContext = createContext();
export const MenuContextProvider = ({ children, data: menuData }) => {
  // const { data: session } = useSession();
  const { userData } = useGlobalAppContext();
  const [dataLoaded, setDataLoaded] = useState(!!menuData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Ref to track if we're loading initial data to prevent save toast
  const isInitialLoadRef = useRef(false);

  const [menuConfig, setMenuConfig] = useState(
    (menuData && menuData.config) || {},
  );

  const [menuContent, setMenuContent] = useState(
    (menuData && menuData.menuContent) || [],
  );
  const [storeProfile, setStoreProfile] = useState({
    storeName: (menuData && menuData.storeName) || "",
    storeLogo: (menuData && menuData.storeProfileImage) || "",
    menuLink: (menuData && menuData.menuLink) || "",
    storeAddress: (menuData && menuData.storeAddress) || "",
    stripeConfig: (menuData && menuData.stripeConfig) || {},
    paymentMethods: (menuData && menuData.paymentMethods) || {
      stripe: { enabled: false, isDefault: false },
      cash: { enabled: false, isDefault: false },
    },
  });

  // Get menu ID from menuData
  const menuId = menuData?._id || null;

  // Fetch menu data client-side if not loaded from server
  useEffect(() => {
    console.log("effect run");
    const fetchMenuData = async () => {
      // Only fetch if we don't have data AND we have a session

      try {
        isInitialLoadRef.current = true; // Set flag before fetching to prevent save toast
        console.log("Fetching menu data client-side...");
        const data = await fetchGetMenuByOwnerEmail(userData.ownerEmail);

        if (data) {
          setMenuConfig(data.config || {});
          setMenuContent(data.menuContent || []);
          setStoreProfile({
            storeName: data.storeName || "",
            storeLogo: data.storeProfileImage || "",
            menuLink: data.menuLink || "",
            storeAddress: data.storeAddress || "",
            stripeConfig: data.stripeConfig || {},
            paymentMethods: data.paymentMethods || {
              stripe: { enabled: false, isDefault: false },
              cash: { enabled: false, isDefault: false },
            },
          });
          setDataLoaded(true);
        }
      } catch (error) {
        console.error("Error fetching menu data:", error);
        setDataLoaded(true); // Mark as loaded even on error to prevent infinite retries
      } finally {
        // Reset flag after a short delay to allow state updates to complete
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 100);
      }
    };
    if (!dataLoaded && userData?.ownerEmail) {
      fetchMenuData();
    }
  }, [userData?.ownerEmail, dataLoaded]);

  // Reusable function to update config fields with fresh server data
  const updateMenuConfigField = async (fieldPath, newValue) => {
    try {
      // Step 1: Fetch latest menu config from server
      console.log("🔄 Fetching latest menu config...");
      const latestData = await fetchGetMenuByOwnerEmail(userData.ownerEmail);

      if (latestData) {
        // Step 2: Update local state with fresh server data + user's change
        const freshConfig = latestData.config || {};

        // Step 3: Apply user's change using deep spread
        const updatedConfig = {
          ...freshConfig,
          [fieldPath]:
            typeof newValue === "object" && newValue !== null
              ? {
                  ...freshConfig[fieldPath],
                  ...newValue,
                }
              : newValue, // For primitive values (numbers, strings, booleans)
        };

        setMenuConfig(updatedConfig);
        console.log("✅ Config updated with fresh data + user change");
        return { success: true };
      }
    } catch (error) {
      console.error("❌ Error updating config field:", error);
      return { success: false, error };
    }
  };

  // Function to refresh all menu data from server
  const refreshMenuData = async () => {
    try {
      console.log("🔄 Refreshing menu data from server...");
      const data = await fetchGetMenuByOwnerEmail(userData.ownerEmail);

      if (data) {
        // Update all menu-related state with fresh data
        setMenuConfig(data.config || {});
        setMenuContent(data.menuContent || []);
        setStoreProfile({
          storeName: data.storeName || "",
          storeLogo: data.storeProfileImage || "",
          menuLink: data.menuLink || "",
          storeAddress: data.storeAddress || "",
          stripeConfig: data.stripeConfig || {},
          paymentMethods: data.paymentMethods || {
            stripe: { enabled: false, isDefault: false },
            cash: { enabled: false, isDefault: false },
          },
        });

        console.log("✅ Menu data refreshed successfully 11");
        return { success: true };
      }
    } catch (error) {
      console.error("❌ Error refreshing menu data:", error);
      return { success: false, error };
    }
  };

  // Wrapper function for refresh with toast
  const refreshMenuDataWithToast = async () => {
    try {
      console.log("Set is refreshing true");
      setIsRefreshing(true); // Set flag to prevent useSkipInitialEffect
      const result = await refreshMenuData();
      if (result.success) {
        toast.success("Menu data refreshed!");
      } else {
        toast.error("Failed to refresh menu data");
      }
      // timeout 1 second
      setTimeout(() => {
        console.log("Set is refreshing false");
        setIsRefreshing(false); // Reset flag
      }, 1000);
      return result;
    } catch (error) {
      toast.error("Failed to refresh menu data");
      setIsRefreshing(false); // Reset flag
      return { success: false, error };
    }
  };

  // Create the saveMenuUpdate function
  const saveMenuConfig = async () => {
    try {
      // update menu config
      await updateMenuConfig(menuConfig);
    } catch (error) {
      console.error(error);
    }
  };

  // Use the effect for database update when menu config changes
  useSkipInitialEffect(() => {
    // Skip if we're currently refreshing or loading initial data to prevent double toast
    if (isRefreshing || isInitialLoadRef.current) {
      console.log("⏸️ Skipping save - currently refreshing/loading menu data");
      return;
    }

    console.log("useSkipInitialEffect run");
    // Show toast message when saving the menu
    console.log("menuConfig changed run here");
    toast.promise(saveMenuConfig(), {
      loading: "Saving...",
      success: "Changes saved successfully!",
      error: "Something went wrong! Can't save changes",
    });
  }, [menuConfig]);

  return (
    <MenuContext.Provider
      value={{
        menuConfig,
        setMenuConfig,
        updateMenuConfigField, // Add reusable config update function
        refreshMenuDataWithToast, // Add refresh function with toast
        menuContent,
        setMenuContent,
        menuId,
        storeProfile,
        setStoreProfile,
        dataLoaded, // Add this so components can check if data is ready
      }}
    >
      {children}
    </MenuContext.Provider>
  );
};

export const useMenuContext = () => useContext(MenuContext);
