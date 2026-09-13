/** On-device SQLite database for Local Mode pilots. */
export const LOCAL_DB_NAME = "easymenu_local";

/**
 * Bump when schema changes.
 * v1: meta, menu_snapshot, local_orders, sync_outbox
 * v2: printers_snapshot
 */
export const LOCAL_DB_VERSION = 2;
