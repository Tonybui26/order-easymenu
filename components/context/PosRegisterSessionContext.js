"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { App } from "@capacitor/app";
import { fetchPosRegisterSession } from "@/lib/api/fetchApi";
import { isNativeApp } from "@/lib/helper/platformDetection";
import {
  clearLocalRegisterFinalise,
  loadLocalRegisterFinalise,
  mergeLocalRegisterFinalise,
} from "@/lib/localDb/registerFinaliseStore";
import { useMenuContext } from "@/components/context/MenuContext";

const PosRegisterSessionContext = createContext(null);

async function applyFetchResult(result) {
  if (!result.success) {
    return { ok: false, error: result.error };
  }
  const remote = result.session ?? null;
  if (!remote) {
    await clearLocalRegisterFinalise();
    return { ok: true, isOpen: false, session: null };
  }

  const local = await loadLocalRegisterFinalise();
  if (local && String(local.sessionId) !== String(remote.id)) {
    await clearLocalRegisterFinalise();
    return { ok: true, isOpen: true, session: remote };
  }

  const session = mergeLocalRegisterFinalise(remote, local);
  return {
    ok: true,
    isOpen: true,
    session,
  };
}

export function PosRegisterSessionProvider({ children }) {
  const { status } = useSession();
  const { menuConfig, dataLoaded } = useMenuContext();
  const posEnabled = Boolean(menuConfig?.posEnabled);
  /** null = unknown; true/false = cached gate state */
  const [isOpen, setIsOpen] = useState(null);
  const [session, setSession] = useState(null);
  const revalidateInFlightRef = useRef(null);

  const clearRegisterSession = useCallback(() => {
    setIsOpen(null);
    setSession(null);
  }, []);

  const setRegisterOpen = useCallback((nextSession) => {
    setIsOpen(true);
    setSession(nextSession ?? null);
  }, []);

  const setRegisterClosed = useCallback(() => {
    setIsOpen(false);
    setSession(null);
    void clearLocalRegisterFinalise();
  }, []);

  const refreshRegisterSession = useCallback(async () => {
    if (revalidateInFlightRef.current) {
      return revalidateInFlightRef.current;
    }

    const promise = (async () => {
      const result = await fetchPosRegisterSession();
      const parsed = await applyFetchResult(result);
      if (parsed.ok) {
        setIsOpen(parsed.isOpen);
        setSession(parsed.session);
      }
      return parsed;
    })().finally(() => {
      revalidateInFlightRef.current = null;
    });

    revalidateInFlightRef.current = promise;
    return promise;
  }, []);

  const revalidateRegisterSession = useCallback(async () => {
    return refreshRegisterSession();
  }, [refreshRegisterSession]);

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") {
      clearRegisterSession();
    }
  }, [clearRegisterSession, status]);

  useEffect(() => {
    if (!dataLoaded || !posEnabled) {
      clearRegisterSession();
    }
  }, [clearRegisterSession, dataLoaded, posEnabled]);

  useEffect(() => {
    if (status !== "authenticated" || !dataLoaded || !posEnabled) return;

    const isNative = isNativeApp();
    let appStateListener = null;

    function handleFocus() {
      revalidateRegisterSession();
    }

    function handleVisibilityChange() {
      if (!document.hidden) handleFocus();
    }

    if (isNative) {
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) handleFocus();
      }).then((handle) => {
        appStateListener = handle;
      });
    } else {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", handleFocus);
    }

    return () => {
      appStateListener?.remove?.();
      if (!isNative) {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, [dataLoaded, posEnabled, revalidateRegisterSession, status]);

  const value = useMemo(
    () => ({
      isOpen,
      session,
      setRegisterOpen,
      setRegisterClosed,
      refreshRegisterSession,
      revalidateRegisterSession,
      clearRegisterSession,
    }),
    [
      clearRegisterSession,
      isOpen,
      refreshRegisterSession,
      revalidateRegisterSession,
      session,
      setRegisterClosed,
      setRegisterOpen,
    ],
  );

  return (
    <PosRegisterSessionContext.Provider value={value}>
      {children}
    </PosRegisterSessionContext.Provider>
  );
}

export function usePosRegisterSession() {
  const context = useContext(PosRegisterSessionContext);
  if (!context) {
    throw new Error(
      "usePosRegisterSession must be used within PosRegisterSessionProvider",
    );
  }
  return context;
}
