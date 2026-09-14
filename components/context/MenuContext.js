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
import { consumeCatalogForceSync } from "@/lib/localDb/catalogForceSync";
import { readMenuSnapshot } from "@/lib/localDb/menuSnapshot";
import {
  readPrintersSnapshot,
  setMemoryPrinters,
} from "@/lib/localDb/printersSnapshot";

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

function emailsMatch(a, b) {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

const MenuContext = createContext();
export const MenuContextProvider = ({ children, data: menuData }) => {
  const { userData } = useGlobalAppContext();
  // Native: wait for catalog bootstrap (SQLite vs network). Web: SSR is enough.
  const [dataLoaded, setDataLoaded] = useState(() => {
    if (typeof window !== "undefined" && isLocalDbSupported()) return false;
    return !!menuData;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isInitialLoadRef = useRef(false);
  /** ownerEmail we already bootstrapped. Login screen has none — do not lock that in. */
  const bootstrappedOwnerRef = useRef(null);

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
  const [itemGroups, setItemGroups] = useState(
    (menuData && menuData.itemGroups) || [],
  );
  const [posLayouts, setPosLayouts] = useState(
    (menuData && menuData.posLayouts) || [],
  );
  const [posTableMaps, setPosTableMaps] = useState(
    (menuData && menuData.posTableMaps) || [],
  );
  const [storeProfile, setStoreProfile] = useState(buildStoreProfile(menuData));
  const [menuId, setMenuId] = useState(menuData?._id || null);

  const availabilityRefreshIdRef = useRef(0);

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
      setMenuId(data._id || null);

      setLocalCatalogCacheGate({
        enabled: isStoreTesting(nextConfig) && isLocalDbSupported(),
        ownerEmail: data.ownerEmail || userData?.ownerEmail || null,
      });
    },
    [userData?.ownerEmail],
  );

  /** Network menu applied → write menu_snapshot + force-refresh printers. */
  const persistCatalogFromNetworkMenu = useCallback(async (data) => {
    if (!isStoreTesting(data?.config) || !isLocalDbSupported()) return;
    await persistCatalogAfterNetworkMenu(data, { refreshPrintersCache });
  }, []);

  /**
   * Pull live menu from the server, apply to context, and (testing + native)
   * overwrite SQLite. Does not depend on the current (possibly empty) config —
   * sign-in can call this before MenuContext has a store.
   * @param {{ ownerEmail?: string }} [opts]
   */
  const syncCatalogFromServer = useCallback(
    async (opts = {}) => {
      const ownerEmail = opts.ownerEmail || userData?.ownerEmail;
      if (!ownerEmail) {
        return { success: false, error: "Missing owner email" };
      }

      try {
        const data = await fetchGetMenuByOwnerEmail(ownerEmail);
        if (!data) return { success: false, error: "Menu not found" };

        isInitialLoadRef.current = true;
        applyMenuDocument(data);
        setDataLoaded(true);
        if (isStoreTesting(data.config) && isLocalDbSupported()) {
          await persistCatalogFromNetworkMenu(data);
        }
        // Sign-in sets this flag; consume it so the next cold start stays cache-first.
        await consumeCatalogForceSync();
        bootstrappedOwnerRef.current = ownerEmail;
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 100);
        return { success: true, menu: data };
      } catch (error) {
        console.error("syncCatalogFromServer:", error);
        return { success: false, error };
      }
    },
    [applyMenuDocument, persistCatalogFromNetworkMenu, userData?.ownerEmail],
  );

  /**
   * Catalog bootstrap:
   * - Skip until we have an owner (login screen). Do not consume the force-sync flag then.
   * - Re-run when ownerEmail appears after client-side sign-in.
   * - Cache-first when SQLite snapshot matches and force-sync is not set.
   * - Network + SQLite overwrite on primary login / Sync (force flag) or empty cache.
   */
  useEffect(() => {
    const ownerEmail = userData?.ownerEmail || null;
    if (!ownerEmail) return;
    if (bootstrappedOwnerRef.current === ownerEmail) return;
    bootstrappedOwnerRef.current = ownerEmail;

    let cancelled = false;

    async function bootstrapCatalog() {
      isInitialLoadRef.current = true;

      try {
        if (!isLocalDbSupported()) {
          if (
            menuData &&
            emailsMatch(menuData.ownerEmail, ownerEmail)
          ) {
            applyMenuDocument(menuData);
            setDataLoaded(true);
          } else {
            const data = await fetchGetMenuByOwnerEmail(ownerEmail);
            if (cancelled) return;
            if (data) applyMenuDocument(data);
            setDataLoaded(true);
          }
          return;
        }

        const forceSync = await consumeCatalogForceSync();
        const snapshot = await readMenuSnapshot();
        const snapshotMenu = snapshot?.payload;
        const snapshotOk =
          snapshotMenu &&
          isStoreTesting(snapshotMenu.config) &&
          emailsMatch(snapshotMenu.ownerEmail, ownerEmail);

        if (!forceSync && snapshotOk) {
          if (cancelled) return;
          applyMenuDocument(snapshotMenu);
          const printersSnap = await readPrintersSnapshot();
          if (printersSnap?.payload) {
            setMemoryPrinters(printersSnap.payload);
          }
          setDataLoaded(true);
          console.log("📦 Catalog hydrated from SQLite (cache-first)");
          return;
        }

        let data =
          menuData && emailsMatch(menuData.ownerEmail, ownerEmail)
            ? menuData
            : null;
        if (!data) {
          data = await fetchGetMenuByOwnerEmail(ownerEmail);
        }
        if (cancelled) return;

        if (data) {
          applyMenuDocument(data);
          setDataLoaded(true);
          if (isStoreTesting(data.config)) {
            await persistCatalogFromNetworkMenu(data);
            console.log("🌐 Catalog synced from server → SQLite");
          }
        } else {
          setDataLoaded(true);
        }
      } catch (error) {
        console.error("bootstrapCatalog:", error);
        if (!cancelled) setDataLoaded(true);
      } finally {
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 100);
      }
    }

    void bootstrapCatalog();
    return () => {
      cancelled = true;
    };
  }, [
    applyMenuDocument,
    menuData,
    persistCatalogFromNetworkMenu,
    userData?.ownerEmail,
  ]);

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

  /** Explicit soft sync (also used by refresh with toast) — overwrites SQLite. */
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

  const saveMenuConfigExplicit = useCallback(
    async (configToSave) => {
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
    },
    [userData?.ownerEmail],
  );

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
