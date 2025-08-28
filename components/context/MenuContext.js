"use client";

import { updateMenuConfig, fetchGetMenuByOwnerEmail } from "@/lib/api/fetchApi";
import { useSkipInitialEffect } from "@/lib/hooks/useSkipInitialEffect";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import toast from "react-hot-toast";

const { createContext, useContext, useState } = require("react");

const MenuContext = createContext();
export const MenuContextProvider = ({ children, data: menuData }) => {
  const { data: session } = useSession();
  const [dataLoaded, setDataLoaded] = useState(!!menuData);

  const [menuConfig, setMenuConfig] = useState(
    (menuData && menuData.config) || {},
  );

  const [menuContent, setMenuContent] = useState(
    (menuData && menuData.menuContent) || [],
  );
  const [isFirstLoadClientSide, setIsFirstLoadClientSide] = useState(false);

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
  useSkipInitialEffect(() => {
    const fetchMenuData = async () => {
      if (!dataLoaded && session?.user?.ownerEmail) {
        try {
          setIsFirstLoadClientSide(true);
          console.log("Fetching menu data client-side...");
          const data = await fetchGetMenuByOwnerEmail(session.user.ownerEmail);

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
        }
      }
    };

    fetchMenuData();
  }, [session?.user?.ownerEmail, dataLoaded]);

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
    // Show toast message when saving the menu
    console.log("menuConfig changed run here");
    // skip the first load client side from the toast
    if (isFirstLoadClientSide) {
      setIsFirstLoadClientSide(false);
      return;
    }
    console.log("menuConfig changed run here 2");
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
