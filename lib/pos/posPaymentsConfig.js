/** Client-side defaults for menu.config.posPayments (mirrors easymenu). */

export const DEFAULT_TYRO_POS_PAYMENT_CONFIG = {
  enabled: false,
  mid: "",
  tid: "",
  integrationKey: "",
  pairedAt: null,
  integratedReceipt: false,
  enableSurcharge: true,
  printMerchantCopy: false,
};

/**
 * Linkly Cloud — mirrors easymenu/lib/pos/posPaymentsConfig.js
 * REVIEW: `secret` may be present on menuConfig loaded into OM for status checks.
 * Do not display it in the UI. Prefer server-side pair/transaction APIs.
 */
export const DEFAULT_LINKLY_POS_PAYMENT_CONFIG = {
  enabled: false,
  username: "",
  secret: "",
  pairedAt: null,
  environment: "",
};

export const DEFAULT_POS_PAYMENTS_CONFIG = {
  tyro: { ...DEFAULT_TYRO_POS_PAYMENT_CONFIG },
  linkly: { ...DEFAULT_LINKLY_POS_PAYMENT_CONFIG },
};

/**
 * @param {object} [menuConfig]
 * @returns {typeof DEFAULT_POS_PAYMENTS_CONFIG}
 */
export function resolvePosPaymentsConfig(menuConfig) {
  const stored =
    menuConfig?.posPayments && typeof menuConfig.posPayments === "object"
      ? menuConfig.posPayments
      : {};

  return {
    tyro: {
      ...DEFAULT_TYRO_POS_PAYMENT_CONFIG,
      ...(stored.tyro && typeof stored.tyro === "object" ? stored.tyro : {}),
    },
    linkly: {
      ...DEFAULT_LINKLY_POS_PAYMENT_CONFIG,
      ...(stored.linkly && typeof stored.linkly === "object"
        ? stored.linkly
        : {}),
    },
  };
}

/**
 * Merge Tyro headless pairing result into a full menu config for PATCH.
 * @param {object} menuConfig
 * @param {{ mid: string, tid: string, integrationKey: string }} pairing
 */
export function buildMenuConfigWithTyroPairing(menuConfig, pairing) {
  const posPayments = resolvePosPaymentsConfig(menuConfig);

  return {
    ...menuConfig,
    posPayments: {
      ...posPayments,
      tyro: {
        ...posPayments.tyro,
        mid: String(pairing.mid ?? "").trim(),
        tid: String(pairing.tid ?? "").trim(),
        integrationKey: String(pairing.integrationKey ?? "").trim(),
        pairedAt: new Date().toISOString(),
      },
    },
  };
}

/** Merge Tyro transaction/receipt toggles into a full menu config for PATCH. */
export function buildMenuConfigWithTyroSettings(menuConfig, tyroPatch) {
  const posPayments = resolvePosPaymentsConfig(menuConfig);

  return {
    ...menuConfig,
    posPayments: {
      ...posPayments,
      tyro: {
        ...posPayments.tyro,
        ...(tyroPatch && typeof tyroPatch === "object" ? tyroPatch : {}),
      },
    },
  };
}

export function tyroSettingsDraftEquals(a, b) {
  return (
    Boolean(a?.integratedReceipt) === Boolean(b?.integratedReceipt) &&
    Boolean(a?.enableSurcharge) === Boolean(b?.enableSurcharge) &&
    Boolean(a?.printMerchantCopy) === Boolean(b?.printMerchantCopy)
  );
}

export function pickTyroSettingsDraft(tyroConfig) {
  return {
    integratedReceipt: Boolean(tyroConfig?.integratedReceipt),
    enableSurcharge: tyroConfig?.enableSurcharge !== false,
    printMerchantCopy: Boolean(tyroConfig?.printMerchantCopy),
  };
}

export function isTyroPosPaymentPaired(tyroConfig) {
  const mid = String(tyroConfig?.mid ?? "").trim();
  const tid = String(tyroConfig?.tid ?? "").trim();
  const integrationKey = String(tyroConfig?.integrationKey ?? "").trim();
  return Boolean(mid && tid && integrationKey);
}

/** Store uses Tyro for POS card and a terminal has been authorised. */
export function isTyroPosCardReady(menuConfig) {
  const tyro = resolvePosPaymentsConfig(menuConfig).tyro;
  return Boolean(tyro.enabled) && isTyroPosPaymentPaired(tyro);
}

export function isLinklyPosPaymentPaired(linklyConfig) {
  return Boolean(String(linklyConfig?.secret ?? "").trim());
}

/** Store uses Linkly Cloud for POS card and a terminal has been paired. */
export function isLinklyPosCardReady(menuConfig) {
  const linkly = resolvePosPaymentsConfig(menuConfig).linkly;
  return Boolean(linkly.enabled) && isLinklyPosPaymentPaired(linkly);
}

/**
 * Clear Linkly pairing from a full menu config (keeps enabled + username).
 * Used by Order Manager "Unpair" — secrets are cleared via update-menu-config.
 * @param {object} menuConfig
 */
export function buildMenuConfigWithLinklyUnpair(menuConfig) {
  const posPayments = resolvePosPaymentsConfig(menuConfig);

  return {
    ...menuConfig,
    posPayments: {
      ...posPayments,
      linkly: {
        ...posPayments.linkly,
        secret: "",
        pairedAt: null,
        environment: "",
      },
    },
  };
}
