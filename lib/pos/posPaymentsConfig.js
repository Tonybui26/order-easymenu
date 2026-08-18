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

export const DEFAULT_POS_PAYMENTS_CONFIG = {
  tyro: { ...DEFAULT_TYRO_POS_PAYMENT_CONFIG },
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
