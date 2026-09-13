/**
 * Bootstrap schema for Local Mode. Keep additive — bump LOCAL_DB_VERSION
 * and add migrations when changing existing tables later.
 */
export const LOCAL_DB_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

CREATE TABLE IF NOT EXISTS menu_snapshot (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS local_orders (
  local_id TEXT PRIMARY KEY NOT NULL,
  server_order_id TEXT,
  pos_check_id TEXT,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  synced_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_pending
  ON sync_outbox (synced_at, created_at);

CREATE INDEX IF NOT EXISTS idx_local_orders_pos_check
  ON local_orders (pos_check_id);
`;
