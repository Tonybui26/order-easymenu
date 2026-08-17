export const TYRO_SIMULATOR_BASE_URL = "https://iclientsimulator.test.tyro.com";
export const TYRO_SIMULATOR_PURCHASE_DOCS_URL =
  "https://integrationsimulator.test.tyro.com/docs/purchase";

/** Simulator-approved purchase amount in cents ($100.00, APPROVED). */
export const TYRO_SIMULATOR_DEFAULT_AMOUNT_CENTS = "10000";

export const TYRO_SIMULATOR_AMOUNT_PRESETS = [
  {
    id: "approved-100",
    label: "10000 — APPROVED ($100.00)",
    cents: "10000",
  },
  {
    id: "declined-100",
    label: "10001 — DECLINED ($100.01)",
    cents: "10001",
  },
  {
    id: "express-35",
    label: "3500 — APPROVED express ($35.00)",
    cents: "3500",
  },
  {
    id: "surcharge-102",
    label: "10250 — APPROVED + surcharge ($102.50)",
    cents: "10250",
  },
  {
    id: "error-400",
    label: "400 — HTTP 400 test ($4.00)",
    cents: "400",
  },
];
export const TYRO_ICLIENT_SCRIPT_URL = `${TYRO_SIMULATOR_BASE_URL}/iclient-with-ui-v1.js`;
export const TYRO_PAIRING_IFRAME_URL = `${TYRO_SIMULATOR_BASE_URL}/configuration.html`;
export const TYRO_SPIKE_PAIRING_STORAGE_KEY = "tyro-test-pairing-v1";

export const TYRO_POS_PRODUCT_DATA = {
  posProductVendor: "EasyMenu",
  posProductName: "EasyMenu POS",
  posProductVersion: "0.1.0",
};

const TEST_API_KEY = "test-api-key";

let loadPromise = null;

export function isTyroIClientLoaded() {
  return Boolean(typeof window !== "undefined" && window.TYRO?.IClientWithUI);
}

export function loadStoredTyroPairing() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(TYRO_SPIKE_PAIRING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.mid || !parsed?.tid || !parsed?.integrationKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredTyroPairing({ mid, tid, integrationKey }) {
  if (typeof window === "undefined") return;
  if (!mid || !tid || !integrationKey) return;

  try {
    window.sessionStorage.setItem(
      TYRO_SPIKE_PAIRING_STORAGE_KEY,
      JSON.stringify({ mid, tid, integrationKey }),
    );
  } catch {
    // Ignore storage failures in the spike UI.
  }
}

export function clearStoredTyroPairing() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(TYRO_SPIKE_PAIRING_STORAGE_KEY);
  } catch {
    // Ignore storage failures in the spike UI.
  }
}

export function buildTyroPurchaseParams({
  amount,
  mid,
  tid,
  integrationKey,
  integratedReceipt = false,
  enableSurcharge = true,
  includeCashout = false,
}) {
  const amountParam = centsToAmountParam(amount);
  if (!amountParam) return null;

  const requestParams = {
    amount: amountParam,
    integratedReceipt,
    enableSurcharge,
  };

  if (includeCashout) {
    requestParams.cashout = "0";
  }

  const midNumber = parseInt(String(mid ?? "").trim(), 10);
  const tidNumber = parseInt(String(tid ?? "").trim(), 10);
  const key = String(integrationKey ?? "").trim();

  if (Number.isFinite(midNumber)) requestParams.mid = midNumber;
  if (Number.isFinite(tidNumber)) requestParams.tid = tidNumber;
  if (key) requestParams.integrationKey = key;

  return requestParams;
}

export function hasTyroTransactionCredentials({ mid, tid, integrationKey }) {
  const midNumber = parseInt(String(mid ?? "").trim(), 10);
  const tidNumber = parseInt(String(tid ?? "").trim(), 10);
  const key = String(integrationKey ?? "").trim();
  return (
    Number.isFinite(midNumber) && Number.isFinite(tidNumber) && Boolean(key)
  );
}

export function loadTyroIClientScript() {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Tyro iClient can only load in the browser"),
    );
  }

  if (window.TYRO?.IClientWithUI) {
    return Promise.resolve(window.TYRO);
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    function finishLoad() {
      if (window.TYRO?.IClientWithUI) {
        resolve(window.TYRO);
        return;
      }
      loadPromise = null;
      reject(
        new Error("Tyro iClient loaded but TYRO.IClientWithUI is missing"),
      );
    }

    function failLoad() {
      loadPromise = null;
      reject(new Error("Failed to load Tyro iClient script"));
    }

    const existing = document.querySelector(
      `script[src="${TYRO_ICLIENT_SCRIPT_URL}"]`,
    );
    if (existing) {
      if (window.TYRO?.IClientWithUI) {
        resolve(window.TYRO);
        return;
      }
      existing.addEventListener("load", finishLoad);
      existing.addEventListener("error", failLoad);
      return;
    }

    const script = document.createElement("script");
    script.src = TYRO_ICLIENT_SCRIPT_URL;
    script.async = true;
    script.onload = finishLoad;
    script.onerror = failLoad;
    document.head.appendChild(script);
  });

  return loadPromise;
}

export async function createTyroIClientWithUI() {
  const TYRO = await loadTyroIClientScript();
  return new TYRO.IClientWithUI(TEST_API_KEY, TYRO_POS_PRODUCT_DATA);
}

export function centsToAmountParam(raw) {
  const cents = parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(cents) || cents < 0) return null;
  return String(cents);
}

export function getTyroLocalStorageHint() {
  if (typeof window === "undefined") {
    return { keyCount: 0, tyroLikeKeys: [], blocked: false };
  }

  try {
    const tyroLikeKeys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && /tyro|iclient|integration/i.test(key)) {
        tyroLikeKeys.push(key);
      }
    }
    return {
      keyCount: window.localStorage.length,
      tyroLikeKeys,
      blocked: false,
    };
  } catch {
    return { keyCount: 0, tyroLikeKeys: [], blocked: true };
  }
}
