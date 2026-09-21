"use client";

/**
 * Linkly Cloud terminal pairing settings (Phase 2 — pairing only).
 *
 * Flow (sandbox accreditation):
 * 1. Enable Linkly for the store in easymenu Admin → POS → Payments.
 * 2. On Windows VPP: FUNC → 8880 → Enter → copy pair code.
 * 3. Enter Cloud username + password (from Linkly support) + pair code here.
 * 4. easymenu POSTs to Linkly Cloud pairing; stores `secret` on menu.config.
 *
 * REVIEW / next steps (not in this page yet):
 * - Token exchange + purchase/refund APIs
 * - Mark order paid from PosPaymentDrawer when Linkly is the active partner
 * - Accreditation spreadsheet runs after purchase path exists
 */

import { useEffect, useMemo, useState } from "react";
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
import {
  fetchGetMenuByOwnerEmail,
  pairLinklyTerminal,
} from "@/lib/api/fetchApi";
import {
  buildMenuConfigWithLinklyUnpair,
  isLinklyPosPaymentPaired,
  resolvePosPaymentsConfig,
} from "@/lib/pos/posPaymentsConfig";

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

export default function LinklyPaymentSettingsPage() {
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { userData } = useGlobalAppContext();
  const {
    menuConfig,
    saveMenuConfigExplicit,
    syncCatalogFromServer,
    dataLoaded,
  } = useMenuContext();

  const savedLinkly = useMemo(
    () => resolvePosPaymentsConfig(menuConfig).linkly,
    [menuConfig],
  );

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [isPairing, setIsPairing] = useState(false);
  const [isUnpairing, setIsUnpairing] = useState(false);
  const [pairStatus, setPairStatus] = useState("");
  const [pairMessage, setPairMessage] = useState("");
  const [hasSeededUsername, setHasSeededUsername] = useState(false);

  const isPaired = isLinklyPosPaymentPaired(savedLinkly);
  const pairedAtLabel = formatPairedAt(savedLinkly.pairedAt);

  useEffect(() => {
    if (!dataLoaded || hasSeededUsername) return;
    const storedUsername = String(savedLinkly.username ?? "").trim();
    if (storedUsername) setUsername(storedUsername);
    setHasSeededUsername(true);
  }, [dataLoaded, hasSeededUsername, savedLinkly.username]);

  async function handlePair() {
    const usernameTrimmed = String(username ?? "").trim();
    const passwordValue = String(password ?? "");
    const pairCodeTrimmed = String(pairCode ?? "").trim();

    if (!usernameTrimmed || !passwordValue || !pairCodeTrimmed) {
      toast.error("Enter username, password, and the pair code from the VPP");
      return;
    }

    setIsPairing(true);
    setPairStatus("inProgress");
    setPairMessage("Pairing with Linkly Cloud…");

    try {
      const result = await pairLinklyTerminal({
        username: usernameTrimmed,
        password: passwordValue,
        pairCode: pairCodeTrimmed,
      });

      if (!result?.success) {
        throw new Error(result?.error || "Pairing failed");
      }

      // Do not keep password / one-time pair code in React state after success.
      setPassword("");
      setPairCode("");
      setPairStatus("success");
      setPairMessage(
        result?.linkly?.paired
          ? "Terminal paired. Pairing secret stored for this store."
          : result?.message || "Terminal paired",
      );

      // Pairing already wrote menu.config on easymenu — pull fresh config into OM.
      await syncCatalogFromServer({ ownerEmail: userData?.ownerEmail });
      toast.success("Linkly terminal paired");
    } catch (error) {
      const message = error?.message || "Pairing failed";
      setPairStatus("failure");
      setPairMessage(message);
      toast.error(message);
    } finally {
      setIsPairing(false);
    }
  }

  async function handleUnpair() {
    if (!userData?.ownerEmail || isUnpairing) return;

    setIsUnpairing(true);
    try {
      const latestData = await fetchGetMenuByOwnerEmail(userData.ownerEmail);
      const freshConfig = latestData?.config || {};
      const configToSave = buildMenuConfigWithLinklyUnpair(freshConfig);
      const result = await saveMenuConfigExplicit(configToSave);

      if (!result?.success) {
        throw new Error(result?.error?.message || "Failed to clear pairing");
      }

      setPairStatus("");
      setPairMessage("");
      toast.success("Linkly pairing cleared");
    } catch (error) {
      toast.error(error?.message || "Failed to unpair");
    } finally {
      setIsUnpairing(false);
    }
  }

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
              Linkly Cloud EFTPOS
            </p>
            <h1 className="mt-1 text-xl font-bold text-neutral-900 sm:text-2xl">
              Linkly Cloud EFTPOS
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              Pair this store with a Linkly Cloud PIN pad or Virtual Pinpad.
              Purchase and refund come in the next integration step.
            </p>
          </div>

          {!dataLoaded ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
              Loading store settings…
            </div>
          ) : (
            <>
              {!savedLinkly.enabled ? (
                <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <p className="font-medium">
                    Linkly is not enabled for this store
                  </p>
                  <p className="mt-1">
                    You can still pair a terminal here during development. Card
                    payments will only use Linkly once it is enabled for this
                    menu in Admin → POS → Payments.
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
                        <StatusValue variant="success">Paired</StatusValue>
                      ) : (
                        <StatusValue variant="neutral">Not paired</StatusValue>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Last paired</dt>
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
                    <dt className="text-neutral-500">Cloud username</dt>
                    <dd className="font-medium text-neutral-900">
                      {savedLinkly.username || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Environment</dt>
                    <dd className="font-medium text-neutral-900">
                      {savedLinkly.environment || "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-neutral-500">Pairing secret</dt>
                    <dd>
                      {isPaired ? (
                        <StatusValue variant="success">
                          Stored on server (not shown)
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
                    Pair terminal
                  </h2>
                  <p className="mt-0.5 text-sm text-neutral-500">
                    On the Virtual Pinpad press <strong>FUNC</strong>, then{" "}
                    <strong>8880</strong>, then Enter to show a pair code. Use
                    your sandbox Cloud username and password from Linkly.
                  </p>
                </div>
                <div className="space-y-4 px-6 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm sm:col-span-2">
                      <span className="font-medium text-neutral-700">
                        Cloud username
                      </span>
                      <input
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        disabled={isPairing}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-50"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium text-neutral-700">
                        Cloud password
                      </span>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        disabled={isPairing}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-50"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium text-neutral-700">
                        Pair code
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={pairCode}
                        onChange={(event) => setPairCode(event.target.value)}
                        disabled={isPairing}
                        placeholder="From VPP / terminal"
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-50"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handlePair}
                      disabled={isPairing || isUnpairing}
                      className="rounded-md bg-brand_accent px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPairing
                        ? "Pairing…"
                        : isPaired
                          ? "Re-pair terminal"
                          : "Pair terminal"}
                    </button>

                    {isPaired ? (
                      <button
                        type="button"
                        onClick={handleUnpair}
                        disabled={isPairing || isUnpairing}
                        className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isUnpairing ? "Clearing…" : "Clear pairing"}
                      </button>
                    ) : null}
                  </div>

                  {pairStatus || pairMessage ? (
                    <div className="text-sm">
                      {pairStatus === "success" ? (
                        <StatusValue variant="success">
                          {pairMessage || "Terminal paired"}
                        </StatusValue>
                      ) : pairStatus === "failure" ? (
                        <StatusValue variant="error">
                          {pairMessage || "Pairing failed"}
                        </StatusValue>
                      ) : pairStatus === "inProgress" ? (
                        <StatusValue variant="pending">
                          {pairMessage || "Pairing…"}
                        </StatusValue>
                      ) : (
                        <p className="text-neutral-600">
                          {pairMessage || pairStatus}
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
