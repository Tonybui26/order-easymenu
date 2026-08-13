"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { verifyStaffPinAction } from "@/lib/actions/authActions";
import {
  clearActiveOperator,
  isTerminalLocked,
  operatorFromSessionUser,
  readActiveOperator,
  writeActiveOperator,
} from "@/lib/staff/activeOperatorStorage";
import { useMenuContext } from "@/components/context/MenuContext";
import { isStaffPinLockEnabled } from "@/lib/staff/staffRoles";

const ActiveOperatorContext = createContext(null);

export function ActiveOperatorProvider({ children }) {
  const { data: session, status } = useSession();
  const { menuConfig, dataLoaded } = useMenuContext();
  const pinLockEnabled = isStaffPinLockEnabled(menuConfig);
  const router = useRouter();
  const pathname = usePathname();
  const [activeOperator, setActiveOperator] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    if (status !== "authenticated") {
      clearActiveOperator();
      setActiveOperator(null);
      setHydrated(true);
      return;
    }

    if (!dataLoaded) return;

    const stored = readActiveOperator();
    if (stored) {
      setActiveOperator(stored);
      setHydrated(true);
      return;
    }

    if (!pinLockEnabled || !isTerminalLocked()) {
      const seeded = operatorFromSessionUser(session?.user);
      if (seeded) {
        writeActiveOperator(seeded);
        setActiveOperator(seeded);
      }
    }

    setHydrated(true);
  }, [dataLoaded, pinLockEnabled, session?.user, status]);

  const lock = useCallback(() => {
    if (!pinLockEnabled) return;
    clearActiveOperator({ locked: true });
    setActiveOperator(null);
    if (pathname !== "/lock") router.push("/lock");
  }, [pathname, pinLockEnabled, router]);

  const unlock = useCallback(async (pinCode) => {
    const result = await verifyStaffPinAction(pinCode);
    if (!result.ok) return result;

    writeActiveOperator(result.operator);
    setActiveOperator(result.operator);
    return result;
  }, []);

  const storeLogout = useCallback(async () => {
    clearActiveOperator();
    setActiveOperator(null);
    await signOut({ redirect: false });
    window.location.href = `${window.location.origin}/signin`;
  }, []);

  const value = useMemo(
    () => ({
      activeOperator,
      hydrated,
      isLocked: status === "authenticated" && hydrated && !activeOperator,
      lock,
      unlock,
      storeLogout,
    }),
    [activeOperator, hydrated, lock, status, storeLogout, unlock],
  );

  return (
    <ActiveOperatorContext.Provider value={value}>
      {children}
    </ActiveOperatorContext.Provider>
  );
}

export function useActiveOperator() {
  const context = useContext(ActiveOperatorContext);
  if (!context) {
    throw new Error(
      "useActiveOperator must be used within ActiveOperatorProvider",
    );
  }
  return context;
}
