import {
  CapacitorSQLite,
  SQLiteConnection,
} from "@capacitor-community/sqlite";
import { isNativeApp } from "@/lib/helper/platformDetection";
import { LOCAL_DB_NAME, LOCAL_DB_VERSION } from "@/lib/localDb/constants";
import { LOCAL_DB_SCHEMA_SQL } from "@/lib/localDb/schema";

let sqliteConnection = null;
let db = null;
let openPromise = null;

/**
 * Native Order Manager only. Remote WebView JS can use the plugin after one
 * Android rebuild that includes @capacitor-community/sqlite.
 */
export function isLocalDbSupported() {
  return isNativeApp();
}

function getSqliteConnection() {
  if (!sqliteConnection) {
    sqliteConnection = new SQLiteConnection(CapacitorSQLite);
  }
  return sqliteConnection;
}

/**
 * Open (or reuse) the Local Mode database and ensure bootstrap tables exist.
 * @returns {Promise<import('@capacitor-community/sqlite').SQLiteDBConnection>}
 */
export async function openLocalDb() {
  if (!isLocalDbSupported()) {
    throw new Error("Local DB requires the Android/iOS Order Manager app");
  }

  if (db) return db;
  if (openPromise) return openPromise;

  openPromise = (async () => {
    const connection = getSqliteConnection();

    const consistency = await connection.checkConnectionsConsistency();
    const isConn = (await connection.isConnection(LOCAL_DB_NAME, false)).result;

    if (consistency.result && isConn) {
      db = await connection.retrieveConnection(LOCAL_DB_NAME, false);
    } else {
      db = await connection.createConnection(
        LOCAL_DB_NAME,
        false,
        "no-encryption",
        LOCAL_DB_VERSION,
        false,
      );
    }

    await db.open();
    await db.execute(LOCAL_DB_SCHEMA_SQL);
    await db.run(
      "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
      ["schema_version", String(LOCAL_DB_VERSION)],
    );

    return db;
  })();

  try {
    return await openPromise;
  } catch (error) {
    db = null;
    throw error;
  } finally {
    openPromise = null;
  }
}

/**
 * @returns {Promise<{ ok: boolean, supported: boolean, database?: string, schemaVersion?: number, error?: string }>}
 */
export async function probeLocalDb() {
  if (!isLocalDbSupported()) {
    return {
      ok: false,
      supported: false,
      error: "SQLite plugin only runs in the native Order Manager app",
    };
  }

  try {
    const connection = await openLocalDb();
    const ping = await connection.query("SELECT 1 AS ok");
    const versionRows = await connection.query(
      "SELECT value FROM meta WHERE key = ?",
      ["schema_version"],
    );
    const rawVersion = versionRows?.values?.[0];
    const schemaVersion = Number(
      (rawVersion && typeof rawVersion === "object"
        ? rawVersion.value
        : rawVersion) ?? LOCAL_DB_VERSION,
    );

    const ok = Array.isArray(ping?.values) && ping.values.length > 0;
    return {
      ok,
      supported: true,
      database: LOCAL_DB_NAME,
      schemaVersion,
      error: ok ? undefined : "Unexpected empty probe result",
    };
  } catch (error) {
    return {
      ok: false,
      supported: true,
      error: error?.message || "Failed to open local SQLite database",
    };
  }
}
