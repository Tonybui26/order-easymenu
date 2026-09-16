/**
 * Power-admin store gate for Auto Offline backup (selected stores only).
 * Today: live-first SQLite snapshots after successful fetches.
 * Later: the same flag will also enable automatic offline capability.
 * Default false — stores without it stay unchanged.
 *
 * @param {object} [menuConfig]
 * @returns {boolean}
 */
export function isStoreAutoOfflineBackup(menuConfig) {
  return (
    menuConfig?.enableAutoOfflineBackup === true ||
    // Temporary: stores toggled before the rename still match.
    menuConfig?.enableLocalBackup === true
  );
}

/**
 * Write SQLite mirrors after live success (testing pilots or Auto Offline backup).
 * @param {object} [menuConfig]
 * @returns {boolean}
 */
export function isLocalSnapshotMirrorEnabled(menuConfig) {
  return (
    isStoreAutoOfflineBackup(menuConfig) ||
    menuConfig?.isTesting === true ||
    menuConfig?.secondTest === true
  );
}
