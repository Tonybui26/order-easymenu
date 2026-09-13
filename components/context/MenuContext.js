"use client";

import {
  updateMenuConfig,
  fetchGetMenuByOwnerEmail,
  updateMenuItemSoldOut,
  updateModifierOptionAvailability,
  refreshPrintersCache,
} from "@/lib/api/fetchApi";
import { useSkipInitialEffect } from "@/lib/hooks/useSkipInitialEffect";
import {
  useEffect,
  useState,
  createContext,
  useContext,
  useRef,
  useCallback,
} from "react";
import toast from "react-hot-toast";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";
import { isStoreTesting } from "@/lib/store/isTesting";
import { isLocalDbSupported } from "@/lib/localDb/sqliteClient";
import { setLocalCatalogCacheGate } from "@/lib/localDb/localCacheGate";
import { persistCatalogAfterNetworkMenu } from "@/lib/localDb/syncLocalCatalog";

function buildStoreProfile(data) {
  return {
    storeName: (data && data.storeName) || "",
    storeLogo: (data && data.storeProfileImage) || "",
    menuLink: (data && data.menuLink) || "",
    storeAddress: (data && data.storeAddress) || "",
    storeABN: (data && data.storeABN) || "",
    timezone: data?.timezone || "Australia/Melbourne",
    taxPercentage: data?.taxPercentage ?? 10,
    stripeConfig: (data && data.stripeConfig) || {},
    paymentMethods: (data && data.paymentMethods) || {
      stripe: { enabled: false, isDefault: false },
      cash: { enabled: false, isDefault: false },
    },
  };
}

const MenuContext = createContext();
export const MenuContextProvider = ({ children, data: menuData }) => {
  const { userData } = useGlobalAppContext();
  const [dataLoaded, setDataLoaded] = useState(!!menuData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Ref to track if we're loading initial data to prevent save toast
  const isInitialLoadRef = useRef(false);
  // Avoid double catalog persist when React Strict Mode remounts in dev
  const didPersistInitialCatalogRef = useRef(false);

  const [menuConfig, setMenuConfig] = useState(
    (menuData && menuData.config) || {},
  );

  const [menuContent, setMenuContent] = useState(
    (menuData && menuData.menuContent) || [],
  );
  const [globalModifiers, setGlobalModifiers] = useState(
    (menuData && menuData.globalModifiers) || {},
  );
  const [globalVariants, setGlobalVariants] = useState(
    (menuData && menuData.globalVariants) || {},
  );
  // Read-only here — the order-manager app only consumes itemGroups for
  // per-printer routing. Edits happen in the admin app (/admin/menu/groups).
  const [itemGroups, setItemGroups] = useState(
    (menuData && menuData.itemGroups) || [],
  );
  // POS menu layouts — read-only here; edited in easymenu admin Menu layout.
  const [posLayouts, setPosLayouts] = useState(
    (menuData && menuData.posLayouts) || [],
  );
  const [posTableMaps, setPosTableMaps] = useState(
    (menuData && menuData.posTableMaps) || [],
  );
  const [storeProfile, setStoreProfile] = useState(buildStoreProfile(menuData));

  // Get menu ID from menuData
  const menuId = menuData?._id || null;
  // Ignore a stale availability refetch if the user saved sold-out while it was in flight.
  const availabilityRefreshIdRef = useRef(0);

  /**
   * Apply a network menu document into React state and open/close the local
   * catalog cache gate from menu.config.isTesting.
   */
  const applyMenuDocument = useCallback(
    (data) => {
      if (!data) return;
      const nextConfig = data.config || {};
      setMenuConfig(nextConfig);
      setMenuContent(data.menuContent || []);
      setGlobalModifiers(data.globalModifiers || {});
      setGlobalVariants(data.globalVariants || {});
      setItemGroups(data.itemGroups || []);
      setPosLayouts(data.posLayouts || []);
      setPosTableMaps(data.posTableMaps || []);
      setStoreProfile(buildStoreProfile(data));

      // Gate: fetchApi printers cache only when testing + native.
      setLocalCatalogCacheGate({
        enabled: isStoreTesting(nextConfig) && isLocalDbSupported(),
        ownerEmail: data.ownerEmail || userData?.ownerEmail || null,
      });
    },
    [userData?.ownerEmail],
  );

  /**
   * After network menu is applied: write menu_snapshot + force-refresh printers.
   * Sync moments: first auth load / Reload (SSR), soft refresh, PIN unlock.
   */
  const persistCatalogFromNetworkMenu = useCallback(async (data) => {
    if (!isStoreTesting(data?.config) || !isLocalDbSupported()) return;
    await persistCatalogAfterNetworkMenu(data, { refreshPrintersCache });
  }, []);

  // First authenticated load / Reload: SSR already fetched menu — persist once.
  useEffect(() => {
    if (!menuData || didPersistInitialCatalogRef.current) return;
    didPersistInitialCatalogRef.current = true;

    setLocalCatalogCacheGate({
      enabled: isStoreTesting(menuData.config) && isLocalDbSupported(),
      ownerEmail: menuData.ownerEmail || userData?.ownerEmail || null,
    });

    void persistCatalogFromNetworkMenu(menuData);
  }, [menuData, persistCatalogFromNetworkMenu, userData?.ownerEmail]);

  // Fetch menu data client-side if not loaded from server
  useEffect(() => {
    console.log("effect run");
    const fetchMenuData = async () => {
      try {
        isInitialLoadRef.current = true;
        console.log("Fetching menu data client-side...");
        const data = await fetchGetMenuByOwnerEmail(userData.ownerEmail);

        if (data) {
          applyMenuDocument(data);
          setDataLoaded(true);
          void persistCatalogFromNetworkMenu(data);
        }
      } catch (error) {
        console.error("Error fetching menu data:", error);
        setDataLoaded(true);
      } finally {
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 100);
      }
    };
    if (!dataLoaded && userData?.ownerEmail) {
      fetchMenuData();
    }
  }, [
    applyMenuDocument,
    dataLoaded,
    persistCatalogFromNetworkMenu,
    userData?.ownerEmail,
  ]);

  // Reusable function to update config fields with fresh server data
  const updateMenuConfigField = async (fieldPath, newValue) => {
    try {
      console.log("🔄 Fetching latest menu config...");
      const latestData = await fetchGetMenuByOwnerEmail(userData.ownerEmail);

      if (latestData) {
        const freshConfig = latestData.config || {};

        const updatedConfig = {
          ...freshConfig,
          [fieldPath]:
            typeof newValue === "object" && newValue !== null
              ? {
                  ...freshConfig[fieldPath],
                  ...newValue,
                }
              : newValue,
        };

        setMenuConfig(updatedConfig);
        setLocalCatalogCacheGate({
          enabled: isStoreTesting(updatedConfig) && isLocalDbSupported(),
          ownerEmail: latestData.ownerEmail || userData?.ownerEmail || null,
        });
        console.log("✅ Config updated with fresh data + user change");
        return { success: true };
      }
    } catch (error) {
      console.error("❌ Error updating config field:", error);
      return { success: false, error };
    }
  };

  // Function to refresh all menu data from server (+ persist catalog when testing)
  const refreshMenuData = async () => {
    try {
      console.log("🔄 Refreshing menu data from server...");
      const data = await fetchGetMenuByOwnerEmail(userData.ownerEmail);

      if (data) {
        applyMenuDocument(data);
        await persistCatalogFromNetworkMenu(data);
        console.log("✅ Menu data refreshed successfully 11");
        return { success: true };
      }
    } catch (error) {
      console.error("❌ Error refreshing menu data:", error);
      return { success: false, error };
    }
  };

  /**
   * PIN unlock sync: pull latest menu + printers from server and overwrite SQLite.
   * Unlock still succeeds if this fails (caller should not block on errors).
   */
  const syncCatalogFromServer = useCallback(async () => {
    if (!userData?.ownerEmail) {
      return { success: false, error: "Missing owner email" };
    }
    if (!isStoreTesting(menuConfig) || !isLocalDbSupported()) {
      return { success: true, skipped: true };
    }

    try {
      const data = await fetchGetMenuByOwnerEmail(userData.ownerEmail);
      if (!data) return { success: false, error: "Menu not found" };

      isInitialLoadRef.current = true;
      applyMenuDocument(data);
      await persistCatalogFromNetworkMenu(data);
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 100);
      return { success: true };
    } catch (error) {
      console.error("syncCatalogFromServer:", error);
      return { success: false, error };
    }
  }, [
    applyMenuDocument,
    menuConfig,
    persistCatalogFromNetworkMenu,
    userData?.ownerEmail,
  ]);

  // Wrapper function for refresh with toast
  const refreshMenuDataWithToast = async () => {
    try {
      console.log("Set is refreshing true");
      setIsRefreshing(true);
      const result = await refreshMenuData();
      if (result.success) {
        toast.success("Menu data refreshed!");
      } else {
        toast.error("Failed to refresh menu data");
      }
      setTimeout(() => {
        console.log("Set is refreshing false");
        setIsRefreshing(false);
      }, 1000);
      return result;
    } catch (error) {
      toast.error("Failed to refresh menu data");
      setIsRefreshing(false);
      return { success: false, error };
    }
  };

  const refreshMenuAvailability = useCallback(async () => {
    if (!userData?.ownerEmail) {
      return { success: false, error: "Missing owner email" };
    }

    const requestId = ++availabilityRefreshIdRef.current;
    try {
      const data = await fetchGetMenuByOwnerEmail(userData.ownerEmail);
      if (requestId !== availabilityRefreshIdRef.current) {
        return { success: true, skipped: true };
      }
      if (!data) {
        return { success: false, error: "Menu not found" };
      }

      // Availability UI must stay live — do not rewrite full SQLite catalog here.
      setMenuContent(data.menuContent || []);
      setGlobalModifiers(data.globalModifiers || {});
      setGlobalVariants(data.globalVariants || {});
      return { success: true };
    } catch (error) {
      console.error("refreshMenuAvailability:", error);
      return { success: false, error };
    }
  }, [userData?.ownerEmail]);

  const patchModifierOptionAvailable = useCallback(
    async (sourceType, groupKey, optionId, available, restockTomorrow) => {
      try {
        const result = await updateModifierOptionAvailability(
          sourceType,
          groupKey,
          optionId,
          available,
          restockTomorrow,
        );
        availabilityRefreshIdRef.current += 1;
        const soldOutRestockOn =
          available === false ? result?.soldOutRestockOn || null : null;

        if (sourceType === "variant") {
          setGlobalVariants((prev) => {
            const group = prev?.[groupKey];
            if (!group) return prev;
            return {
              ...(prev || {}),
              [groupKey]: {
                ...group,
                options: (group.options || []).map((option) =>
                  option.id === optionId
                    ? { ...option, available: !!available, soldOutRestockOn }
                    : option,
                ),
              },
            };
          });
        } else {
          setGlobalModifiers((prev) => {
            const group = prev?.[groupKey];
            if (!group) return prev;
            return {
              ...(prev || {}),
              [groupKey]: {
                ...group,
                options: (group.options || []).map((option) =>
                  option.id === optionId
                    ? { ...option, available: !!available, soldOutRestockOn }
                    : option,
                ),
              },
            };
          });
        }

        return { success: true };
      } catch (error) {
        console.error("patchModifierOptionAvailable:", error);
        return { success: false, error };
      }
    },
    [],
  );

  const patchItemSoldOut = useCallback(
    async (menuItemId, soldOut, restockTomorrow) => {
      try {
        const result = await updateMenuItemSoldOut(
          menuItemId,
          soldOut,
          restockTomorrow,
        );
        availabilityRefreshIdRef.current += 1;
        const soldOutRestockOn = soldOut
          ? result?.soldOutRestockOn || null
          : null;
        setMenuContent((prev) =>
          (prev || []).map((section) => ({
            ...section,
            items: (section.items || []).map((item) =>
              item.id === menuItemId
                ? { ...item, soldOut, soldOutRestockOn }
                : item,
            ),
          })),
        );
        return { success: true };
      } catch (error) {
        console.error("patchItemSoldOut:", error);
        return { success: false, error };
      }
    },
    [],
  );

  const saveMenuConfig = async () => {
    try {
      await updateMenuConfig(menuConfig);
    } catch (error) {
      console.error(error);
    }
  };

  /** Persist config to server without triggering the auto-save effect (Settings page). */
  const saveMenuConfigExplicit = useCallback(async (configToSave) => {
    isInitialLoadRef.current = true;
    try {
      await updateMenuConfig(configToSave);
      setMenuConfig(configToSave);
      setLocalCatalogCacheGate({
        enabled: isStoreTesting(configToSave) && isLocalDbSupported(),
        ownerEmail: userData?.ownerEmail || null,
      });
      return { success: true };
    } catch (error) {
      console.error("saveMenuConfigExplicit error:", error);
      return { success: false, error };
    } finally {
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 100);
    }
  }, [userData?.ownerEmail]);

  useSkipInitialEffect(() => {
    if (isRefreshing || isInitialLoadRef.current) {
      console.log("⏸️ Skipping save - currently refreshing/loading menu data");
      return;
    }

    console.log("useSkipInitialEffect run");
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
        updateMenuConfigField,
        saveMenuConfigExplicit,
        refreshMenuDataWithToast,
        syncCatalogFromServer,
        menuContent,
        setMenuContent,
        globalModifiers,
        globalVariants,
        patchItemSoldOut,
        patchModifierOptionAvailable,
        refreshMenuAvailability,
        itemGroups,
        posLayouts,
        posTableMaps,
        menuId,
        storeProfile,
        setStoreProfile,
        dataLoaded,
      }}
    >
      {children}
    </MenuContext.Provider>
  );
};

export const useMenuContext = () => useContext(MenuContext);
