"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import PosChromeHeader from "@/components/orderManager/PosChromeHeader";
import { usePosOpenCashDrawer } from "@/components/orderManager/usePosOpenCashDrawer";
import {
  TYRO_PAIRING_IFRAME_URL,
  TYRO_SIMULATOR_AMOUNT_PRESETS,
  TYRO_SIMULATOR_DEFAULT_AMOUNT_CENTS,
  TYRO_SIMULATOR_PURCHASE_DOCS_URL,
  buildTyroPurchaseParams,
  clearStoredTyroPairing,
  createTyroIClientWithUI,
  getTyroLocalStorageHint,
  hasTyroTransactionCredentials,
  isTyroIClientLoaded,
  loadStoredTyroPairing,
  loadTyroIClientScript,
  saveStoredTyroPairing,
} from "@/lib/tyro/iclient";

const DEFAULT_MID = "2187";
const DEFAULT_TID = "1";

function appendLog(setLogs, label, payload) {
  const entry = {
    at: new Date().toISOString(),
    label,
    payload,
  };
  setLogs((prev) => [entry, ...prev]);
}

export default function TyroTestPage() {
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const iclientRef = useRef(null);

  const [scriptStatus, setScriptStatus] = useState("loading");
  const [scriptError, setScriptError] = useState("");
  const [mid, setMid] = useState(DEFAULT_MID);
  const [tid, setTid] = useState(DEFAULT_TID);
  const [amountCents, setAmountCents] = useState(
    TYRO_SIMULATOR_DEFAULT_AMOUNT_CENTS,
  );
  const [integrationKey, setIntegrationKey] = useState("");
  const [pairingStatus, setPairingStatus] = useState("");
  const [pairingMessage, setPairingMessage] = useState("");
  const [isPairing, setIsPairing] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [storageHint, setStorageHint] = useState(() =>
    getTyroLocalStorageHint(),
  );

  const refreshStorageHint = useCallback(() => {
    setStorageHint(getTyroLocalStorageHint());
  }, []);

  const getClient = useCallback(async () => {
    if (iclientRef.current) return iclientRef.current;
    const client = await createTyroIClientWithUI();
    iclientRef.current = client;
    return client;
  }, []);

  useEffect(() => {
    const stored = loadStoredTyroPairing();
    if (stored) {
      setMid(stored.mid);
      setTid(stored.tid);
      setIntegrationKey(stored.integrationKey);
      setPairingStatus("success");
      setPairingMessage("Loaded saved pairing from this browser session.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadTyroIClientScript()
      .then(async () => {
        if (cancelled) return;
        await getClient();
        if (cancelled) return;
        setScriptStatus("ready");
        refreshStorageHint();
      })
      .catch((error) => {
        if (cancelled) return;
        setScriptStatus("error");
        setScriptError(error?.message || "Failed to load Tyro iClient");
      });

    return () => {
      cancelled = true;
    };
  }, [getClient, refreshStorageHint]);

  async function handleHeadlessPair() {
    setIsPairing(true);
    setPairingStatus("inProgress");
    setPairingMessage("Starting pairing…");
    appendLog(setLogs, "pairTerminal:start", { mid, tid });

    try {
      const iclient = await getClient();
      iclient.pairTerminal(mid, tid, (response) => {
        const status = response?.status || "";
        setPairingStatus(status);
        setPairingMessage(response?.message || "");
        if (response?.integrationKey) {
          setIntegrationKey(response.integrationKey);
          saveStoredTyroPairing({
            mid,
            tid,
            integrationKey: response.integrationKey,
          });
        }
        appendLog(setLogs, "pairTerminal:callback", response);
        refreshStorageHint();
        if (status === "success" || status === "failure") {
          setIsPairing(false);
        }
      });
    } catch (error) {
      setIsPairing(false);
      setPairingStatus("failure");
      setPairingMessage(error?.message || "Pairing failed to start");
      appendLog(setLogs, "pairTerminal:error", {
        message: error?.message || String(error),
      });
    }
  }

  function handleClearPairing() {
    clearStoredTyroPairing();
    setIntegrationKey("");
    setPairingStatus("");
    setPairingMessage("");
    appendLog(setLogs, "pairing:cleared", null);
    refreshStorageHint();
  }

  async function handlePurchase() {
    const credentials = { mid, tid, integrationKey };
    if (!hasTyroTransactionCredentials(credentials)) {
      appendLog(setLogs, "purchase:error", {
        message:
          "Missing MID, TID, or integration key. Use headless Pair terminal first — iframe pairing on localhost does not share credentials with this page.",
      });
      return;
    }

    const requestParams = buildTyroPurchaseParams({
      amount: amountCents,
      ...credentials,
    });

    if (!requestParams) {
      appendLog(setLogs, "purchase:error", {
        message: "Amount must be a non-negative integer in cents",
      });
      return;
    }

    setIsPurchasing(true);
    setLastResult(null);
    appendLog(setLogs, "initiatePurchase:start", requestParams);

    try {
      const iclient = await getClient();
      iclient.initiatePurchase(requestParams, {
        receiptCallback: (receipt) => {
          appendLog(setLogs, "receiptCallback", receipt);
        },
        transactionCompleteCallback: (result) => {
          setLastResult(result);
          setIsPurchasing(false);
          appendLog(setLogs, "transactionCompleteCallback", result);
          refreshStorageHint();
        },
      });
    } catch (error) {
      setIsPurchasing(false);
      appendLog(setLogs, "initiatePurchase:error", {
        message: error?.message || String(error),
      });
    }
  }

  const tyroLoaded = isTyroIClientLoaded();
  const hasCredentials = hasTyroTransactionCredentials({
    mid,
    tid,
    integrationKey,
  });
  const storageEmpty =
    storageHint.blocked ||
    (storageHint.keyCount === 0 && storageHint.tyroLikeKeys.length === 0);
  const lastResultCode = lastResult?.result || "";

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
          <div>
            <p className="text-sm text-neutral-500">
              <Link href="/settings" className="text-brand_accent hover:underline">
                Settings
              </Link>
              <span className="mx-1.5">/</span>
              Tyro EFTPOS
            </p>
            <h1 className="mt-1 text-xl font-bold text-neutral-900 sm:text-2xl">
              Tyro iClient spike
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              Simulator pairing and purchase only. Does not mark orders paid.
            </p>
          </div>

          <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Localhost / simulator amounts</p>
            <p className="mt-1">
              The integration simulator only accepts specific{" "}
              <strong>magic amounts</strong> (in cents), not arbitrary values.
              Using <code className="rounded bg-amber-100 px-1">1000</code> will
              return HTTP 400. Start with{" "}
              <code className="rounded bg-amber-100 px-1">10000</code> for an
              APPROVED test ($100.00). See{" "}
              <a
                href={TYRO_SIMULATOR_PURCHASE_DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                simulator purchase docs
              </a>
              .
            </p>
            <p className="mt-2">
              For purchases from this page, use{" "}
              <strong>headless Pair terminal</strong> so MID/TID/integration key
              are sent with the request. Iframe pairing alone does not share
              credentials with localhost.
            </p>
          </section>

          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                Diagnostics
              </h2>
            </div>
            <dl className="grid gap-3 px-6 py-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-neutral-500">iClient script</dt>
                <dd className="font-medium text-neutral-900">
                  {scriptStatus}
                  {scriptError ? ` — ${scriptError}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">window.TYRO</dt>
                <dd className="font-medium text-neutral-900">
                  {tyroLoaded ? "loaded" : "not loaded"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Transaction credentials</dt>
                <dd className="font-medium text-neutral-900">
                  {hasCredentials
                    ? "ready (MID + TID + integration key)"
                    : "missing — pair first"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">localhost localStorage</dt>
                <dd className="font-medium text-neutral-900">
                  {storageHint.blocked
                    ? "blocked"
                    : storageEmpty
                      ? "empty (expected on localhost)"
                      : `${storageHint.keyCount} keys`}
                </dd>
              </div>
            </dl>
          </section>

          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                Headless pairing (use this on localhost)
              </h2>
              <p className="mt-0.5 text-sm text-neutral-500">
                MID 2187 or 2188, TID any (default 1). Simulator pairing does
                not need a physical terminal.
              </p>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-neutral-700">MID</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={mid}
                    onChange={(event) => setMid(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-neutral-900"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-neutral-700">TID</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tid}
                    onChange={(event) => setTid(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-neutral-900"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleHeadlessPair}
                  disabled={scriptStatus !== "ready" || isPairing}
                  className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPairing ? "Pairing…" : "Pair terminal"}
                </button>
                <button
                  type="button"
                  onClick={handleClearPairing}
                  disabled={!integrationKey}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear saved pairing
                </button>
              </div>
              <p className="text-sm text-neutral-600">
                Status: {pairingStatus || "—"}
                {pairingMessage ? ` — ${pairingMessage}` : ""}
              </p>
              <p className="break-all text-sm text-neutral-600">
                Integration key: {integrationKey || "—"}
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                Purchase
              </h2>
              <p className="mt-0.5 text-sm text-neutral-500">
                Use a simulator magic amount in cents. Default{" "}
                <code className="rounded bg-neutral-100 px-1">10000</code> =
                APPROVED ($100.00). After APPROVED, Tyro may ask{" "}
                <strong>Print customer copy?</strong> — click YES or NO; that is
                part of the Headful UI, not our page.
              </p>
            </div>
            <div className="space-y-4 px-6 py-4">
              <label className="block max-w-md text-sm">
                <span className="font-medium text-neutral-700">
                  Amount (cents)
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountCents}
                  onChange={(event) => setAmountCents(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-neutral-900"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {TYRO_SIMULATOR_AMOUNT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setAmountCents(preset.cents)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                      amountCents === preset.cents
                        ? "border-brand_accent bg-brand_accent/10 text-brand_accent"
                        : "border-gray-300 text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handlePurchase}
                disabled={
                  scriptStatus !== "ready" || isPurchasing || !hasCredentials
                }
                className="rounded-md bg-brand_accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPurchasing ? "Waiting for simulator…" : "Initiate purchase"}
              </button>
              {!hasCredentials ? (
                <p className="text-sm text-amber-800">
                  Pair first — purchase stays disabled until an integration key is
                  set.
                </p>
              ) : null}
              {lastResultCode ? (
                <p className="text-sm font-medium text-neutral-900">
                  Last result: {lastResultCode}
                </p>
              ) : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                Headful pairing iframe (reference only)
              </h2>
              <p className="mt-0.5 text-sm text-neutral-500">
                Useful to inspect Tyro&apos;s config UI. On localhost it does
                not provide credentials to purchases on this page.
              </p>
            </div>
            <div className="p-4">
              {isPurchasing ? (
                <p className="rounded-md border border-dashed border-gray-300 bg-neutral-50 px-3 py-8 text-center text-sm text-neutral-500">
                  Pairing iframe hidden while a purchase is in progress, so it
                  cannot sit over Tyro&apos;s YES/NO buttons.
                </p>
              ) : (
                <iframe
                  title="Tyro pairing"
                  src={TYRO_PAIRING_IFRAME_URL}
                  className="h-[420px] w-full rounded-md border border-gray-200 bg-white"
                />
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                Result log
              </h2>
              <button
                type="button"
                onClick={() => setLogs([])}
                className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
              >
                Clear
              </button>
            </div>
            <pre className="max-h-[480px] overflow-auto px-6 py-4 text-xs leading-5 text-neutral-800">
              {logs.length === 0
                ? "No callbacks yet."
                : JSON.stringify(logs, null, 2)}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}
