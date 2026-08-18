"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
} from "lucide-react";
import PosChromeHeader from "@/components/orderManager/PosChromeHeader";
import { usePosOpenCashDrawer } from "@/components/orderManager/usePosOpenCashDrawer";
import { useMenuContext } from "@/components/context/MenuContext";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";
import { fetchGetMenuByOwnerEmail } from "@/lib/api/fetchApi";
import {
  buildMenuConfigWithTyroPairing,
  isTyroPosPaymentPaired,
  resolvePosPaymentsConfig,
} from "@/lib/pos/posPaymentsConfig";
import {
  createTyroIClientWithUI,
  hasTyroTransactionCredentials,
  loadTyroIClientScript,
} from "@/lib/tyro/iclient";

const DEFAULT_MID = "2187";
const DEFAULT_TID = "1";

function formatPairedAt(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function StatusValue({ variant = "neutral", children }) {
  const styles = {
    success: "text-emerald-700",
    error: "text-red-700",
    pending: "text-neutral-600",
    neutral: "text-neutral-500",
  };

  const icons = {
    success: CheckCircle2,
    error: XCircle,
    pending: Loader2,
    neutral: Circle,
  };

  const Icon = icons[variant] || Circle;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium ${styles[variant] || styles.neutral}`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${variant === "pending" ? "animate-spin" : ""}`}
        aria-hidden
      />
      {children}
    </span>
  );
}

export default function TyroPaymentSettingsPage() {
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { userData } = useGlobalAppContext();
  const { menuConfig, saveMenuConfigExplicit, dataLoaded } = useMenuContext();
  const iclientRef = useRef(null);

  const savedTyro = useMemo(
    () => resolvePosPaymentsConfig(menuConfig).tyro,
    [menuConfig],
  );

  const [scriptStatus, setScriptStatus] = useState("loading");
  const [scriptError, setScriptError] = useState("");
  const [mid, setMid] = useState(DEFAULT_MID);
  const [tid, setTid] = useState(DEFAULT_TID);
  const [isAuthorising, setIsAuthorising] = useState(false);
  const [authStatus, setAuthStatus] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const isPaired = isTyroPosPaymentPaired(savedTyro);
  const pairedAtLabel = formatPairedAt(savedTyro.pairedAt);

  const getClient = useCallback(async () => {
    if (iclientRef.current) return iclientRef.current;
    const client = await createTyroIClientWithUI();
    iclientRef.current = client;
    return client;
  }, []);

  useEffect(() => {
    if (!dataLoaded) return;

    const storedMid = String(savedTyro.mid ?? "").trim();
    const storedTid = String(savedTyro.tid ?? "").trim();
    setMid(storedMid || DEFAULT_MID);
    setTid(storedTid || DEFAULT_TID);
  }, [dataLoaded, savedTyro.mid, savedTyro.tid]);

  useEffect(() => {
    let cancelled = false;

    loadTyroIClientScript()
      .then(async () => {
        if (cancelled) return;
        await getClient();
        if (cancelled) return;
        setScriptStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setScriptStatus("error");
        setScriptError(error?.message || "Failed to load Tyro iClient");
      });

    return () => {
      cancelled = true;
    };
  }, [getClient]);

  async function persistPairing({ integrationKey }) {
    if (!userData?.ownerEmail) {
      throw new Error("Store account not loaded");
    }

    const latestData = await fetchGetMenuByOwnerEmail(userData.ownerEmail);
    const freshConfig = latestData?.config || {};
    const configToSave = buildMenuConfigWithTyroPairing(freshConfig, {
      mid,
      tid,
      integrationKey,
    });

    const result = await saveMenuConfigExplicit(configToSave);
    if (!result?.success) {
      throw new Error("Failed to save Tyro pairing to this store");
    }
  }

  async function handleAuthorise() {
    const midTrimmed = String(mid ?? "").trim();
    const tidTrimmed = String(tid ?? "").trim();

    if (!midTrimmed || !tidTrimmed) {
      toast.error("Enter MID and TID from your EFTPOS terminal");
      return;
    }

    setIsAuthorising(true);
    setAuthStatus("inProgress");
    setAuthMessage("Connecting to Tyro…");

    try {
      const iclient = await getClient();

      iclient.pairTerminal(midTrimmed, tidTrimmed, (response) => {
        const status = response?.status || "";
        setAuthStatus(status);
        setAuthMessage(response?.message || "");

        if (status === "inProgress") return;

        if (status === "success" && response?.integrationKey) {
          persistPairing({
            integrationKey: response.integrationKey,
          })
            .then(() => {
              toast.success("Tyro terminal authorised");
              setAuthMessage("Terminal authorised and saved for this store.");
            })
            .catch((error) => {
              const message =
                error?.message ||
                "Pairing succeeded but could not save to the store";
              setAuthStatus("failure");
              setAuthMessage(message);
              toast.error(message);
            })
            .finally(() => {
              setIsAuthorising(false);
            });
          return;
        }

        if (status === "failure" || status === "success") {
          setIsAuthorising(false);
          if (status === "failure") {
            toast.error(response?.message || "Authorisation failed");
          } else {
            toast.error("No integration key returned from Tyro");
          }
        }
      });
    } catch (error) {
      const message = error?.message || "Authorisation failed to start";
      setIsAuthorising(false);
      setAuthStatus("failure");
      setAuthMessage(message);
      toast.error(message);
    }
  }

  const credentialsReady = hasTyroTransactionCredentials({
    mid: savedTyro.mid,
    tid: savedTyro.tid,
    integrationKey: savedTyro.integrationKey,
  });

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
          <div>
            <p className="text-sm text-neutral-500">
              <Link
                href="/settings"
                className="text-brand_accent hover:underline"
              >
                Settings
              </Link>
              <span className="mx-1.5">/</span>
              Tyro EFTPOS
            </p>
            <h1 className="mt-1 text-xl font-bold text-neutral-900 sm:text-2xl">
              Tyro EFTPOS
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              Pair your in-store terminal so card payments can run through Tyro.
            </p>
          </div>

          {!dataLoaded ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
              Loading store settings…
            </div>
          ) : (
            <>
              {!savedTyro.enabled ? (
                <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <p className="font-medium">Tyro is not enabled for this store</p>
                  <p className="mt-1">
                    You can still authorise a terminal here during development.
                    Card payments will only use Tyro once{" "}
                    <code className="rounded bg-amber-100 px-1">
                      posPayments.tyro.enabled
                    </code>{" "}
                    is turned on for this menu.
                  </p>
                </section>
              ) : null}

              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-6 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-neutral-900">
                      Terminal status
                    </h2>
                    {isPaired ? (
                      <StatusValue variant="success">Ready</StatusValue>
                    ) : (
                      <StatusValue variant="neutral">Not paired</StatusValue>
                    )}
                  </div>
                </div>
                <dl className="grid gap-3 px-6 py-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-neutral-500">Pairing</dt>
                    <dd>
                      {isPaired ? (
                        <StatusValue variant="success">Authorised</StatusValue>
                      ) : (
                        <StatusValue variant="neutral">
                          Not authorised
                        </StatusValue>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Last authorised</dt>
                    <dd className="font-medium text-neutral-900">
                      {pairedAtLabel ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-emerald-600"
                            aria-hidden
                          />
                          {pairedAtLabel}
                        </span>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Saved MID / TID</dt>
                    <dd className="font-medium text-neutral-900">
                      {savedTyro.mid && savedTyro.tid ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-emerald-600"
                            aria-hidden
                          />
                          {savedTyro.mid} / {savedTyro.tid}
                        </span>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Integration key</dt>
                    <dd>
                      {credentialsReady ? (
                        <StatusValue variant="success">
                          Stored securely
                        </StatusValue>
                      ) : (
                        <StatusValue variant="neutral">Not stored</StatusValue>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-6 py-3">
                  <h2 className="text-sm font-semibold text-neutral-900">
                    Authorise terminal
                  </h2>
                  <p className="mt-0.5 text-sm text-neutral-500">
                    Enter the MID and TID shown on your EFTPOS machine, then
                    tap Authorise. During development use simulator MID{" "}
                    <strong>2187</strong> or <strong>2188</strong> and TID{" "}
                    <strong>1</strong>.
                  </p>
                </div>
                <div className="space-y-4 px-6 py-4">
                  {scriptStatus === "error" ? (
                    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                      {scriptError}
                    </p>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="font-medium text-neutral-700">MID</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={mid}
                        onChange={(event) => setMid(event.target.value)}
                        disabled={isAuthorising}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-50"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium text-neutral-700">TID</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={tid}
                        onChange={(event) => setTid(event.target.value)}
                        disabled={isAuthorising}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-50"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleAuthorise}
                    disabled={scriptStatus !== "ready" || isAuthorising}
                    className="rounded-md bg-brand_accent px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isAuthorising ? "Authorising…" : "Authorise"}
                  </button>

                  {authStatus || authMessage ? (
                    <div className="text-sm">
                      {authStatus === "success" ? (
                        <StatusValue variant="success">
                          {authMessage || "Terminal authorised"}
                        </StatusValue>
                      ) : authStatus === "failure" ? (
                        <StatusValue variant="error">
                          {authMessage || "Authorisation failed"}
                        </StatusValue>
                      ) : authStatus === "inProgress" ? (
                        <StatusValue variant="pending">
                          {authMessage || "Authorising…"}
                        </StatusValue>
                      ) : (
                        <p className="text-neutral-600">
                          {authMessage || authStatus}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
