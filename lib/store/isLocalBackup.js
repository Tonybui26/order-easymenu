/**
 * Power-admin store gate for live-first local backup snapshots.
 * When true (and native), Order Manager mirrors successful live menu / printers /
 * held / resume into SQLite. Does not enable offline outbox by itself.
 *
 * @param {object} [menuConfig]
 * @returns {boolean}
 */
export function isStoreLocalBackup(menuConfig) {
  return menuConfig?.enableLocalBackup === true;
}

/**
 * Write SQLite mirrors after live success (testing pilots or local-backup stores).
 * @param {object} [menuConfig]
 * @returns {boolean}
 */
export function isLocalSnapshotMirrorEnabled(menuConfig) {
  return (
    isStoreLocalBackup(menuConfig) ||
    menuConfig?.isTesting === true
  );
}
