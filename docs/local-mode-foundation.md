# Local Mode foundation (testing)

Pilot scaffolding for on-device cache. Catalog (menu + printers) plus the
last held-orders list and resume payloads. This is **not** full offline POS —
Live Orders polling stays always live, and Send / pay / register stay network.

## Store gate

| Field | Where | Who sets it |
|-------|--------|-------------|
| `menu.config.isTesting` | easymenu Menu document | Power admin → Stores drawer → **Testing store** |
| `menu.config.enableAutoOfflineBackup` | easymenu Menu document | Power admin → Stores drawer → **Auto Offline backup** |
| `menu.config.isOffline` | easymenu Menu document | Power admin → Stores drawer → **Offline mode** |
| `menu.config.localDatabase` | easymenu Menu document | Power admin → Stores drawer → **Local database** |
| `menu.config.secondTest` | easymenu Menu document | Power admin → Stores drawer → **Second test** |

`enableAutoOfflineBackup` is for selected stores only (default off). Today it turns on **live-first snapshots**: after a successful live menu / printers / held / resume fetch, Order Manager writes SQLite. Send and Pay stay live. Later the same flag will also enable automatic offline capability. Stores with it off stay unchanged.

`isOffline` is the backup mode. When it is off, menu and settings still come from the live fetch. When it is on, a matching SQLite catalog can hydrate without that fetch. Held occupancy and resume payloads still paint first, then refresh, whenever Auto Offline backup or testing is on.

`localDatabase` is testing-only. When on (with Testing store + native), Send and Pay write to the on-device outbox and **do not** auto-sync. Turn it off (then Sync / open POS) to let queued rows upload. Offline mode can still auto-sync when `localDatabase` is off.

`secondTest` is a debug lane with the same local Send/Pay + no auto-sync behaviour as `localDatabase`, but **does not** require Testing store. Default off.

When testing, Auto Offline backup, or Second test is on (and native Order Manager), Settings shows **Local Mode foundation
(testing)** with a probe for SQLite + snapshot ages.

## Sync model (cache-first)

| Moment | Behaviour |
|--------|-----------|
| **App open, isOffline off** | Fetch the live menu and apply it. Stores with `enableAutoOfflineBackup` or `isTesting` also overwrite SQLite. Held and resume may still paint from the last snapshot, then refresh. |
| **App open, isOffline on** | If SQLite has a menu snapshot for this store → hydrate React + printers from disk. **No** catalog network required. |
| **Primary account sign-in** | Fetches live menu, applies it to `MenuContext` immediately (POS / PIN), and overwrites SQLite when Auto Offline backup or testing is on. Does not wait for a later reload. |
| **Manual Sync** (POS header **Sync**) | Sets force-sync flag + `location.reload()` → same as sign-in network path. **This is the staff rule to avoid stale catalog.** Live Order Terminal menus stay unchanged. |
| **PIN unlock** | Does **not** sync catalog — only unlocks the operator. |
| **Empty SQLite / first install** | Must network, then write snapshots. |
| **Printer CRUD** | `refreshPrintersCache()` after add/update/delete. |
| **Table map / Held Orders** | If a held snapshot exists, paint it, then refresh from the API and overwrite. Missing snapshot fetches first, then saves. Refresh failure keeps the last copy. Unsynced local Send/Pay rows (`localDatabase` or offline outbox) are merged into the painted list so this device still shows occupied tables. |
| **Open table / resume a check** | Same for the resume payload keyed by order ids. Cart paints from local, then re-applies the live fetch. Live fetch failure after a local paint keeps the cart. |
| **Held drawer preview** | Memory first, then SQLite, then network. A memory hit still revalidates in the background. |
| **Send, isOffline off** | Always the live create-order API (unless `localDatabase` is on). |
| **Send, isOffline on** | Save on this device first (`localId`, empty server id), print from that row, then sync in the background to `POST /api/pos/orders/send-offline`. A retry with the same `localId` returns the existing Mongo order. Pay first or pay later also saves the tender locally (`localPaymentId`) and syncs it to `POST /api/pos/orders/complete-offline` after those tickets have server ids. |
| **Send / Pay, localDatabase on** | Same local save as offline Send, but the outbox does not flush or retry until `localDatabase` is turned off. |
| **Send / Pay, secondTest on** | Same as `localDatabase` (local save, no auto-sync) without requiring Testing store. |
| **Live Orders** | Untouched — always polls the API. |

SSR in `app/layout.jsx` may still fetch the menu on full loads; when cache-first applies, `MenuContext` **ignores** that SSR payload and applies SQLite instead (unless force-sync).

## Native plugins

| Plugin | Purpose |
|--------|---------|
| `@capacitor-community/sqlite` | On-device SQLite (`easymenu_local`) |
| `@capacitor/preferences` | Force-sync flag + future prefs |
| `@capacitor/network` | Already present |

## Code map

| Area | Path |
|------|------|
| Force-sync flag + reload helper | `lib/localDb/catalogForceSync.js` |
| Gate | `lib/localDb/localCacheGate.js` |
| Snapshots | `lib/localDb/menuSnapshot.js`, `printersSnapshot.js`, `posLiveSnapshot.js` |
| Persist after network menu | `lib/localDb/syncLocalCatalog.js` |
| Bootstrap (cache-first vs network) | `components/context/MenuContext.js` |
| Printers cache-first API | `lib/api/fetchApi.js` |
| Sign-in force sync | `components/auth/SignInForm.jsx` |
| Settings probe | `components/orderManager/settings/LocalDbTestingPanel.jsx` |

## How to test

1. `isTesting` store + native app with SQLite plugins.
2. Sign in → probe shows fresh menu + printers `updatedAt`.
3. Kill/reopen with **Offline mode off** → menu fetches live; probe timestamps move. Held list can still paint before the network round trip.
4. Turn **Offline mode** on, Sync, change menu in admin, kill/reopen → POS stays on the snapshot until the next **Sync**.
5. Lock → unlock → catalog timestamps do **not** need to move.
6. `isTesting` off → no SQLite catalog or held/resume path.
7. Open table map or Held Orders twice (kill app between) → occupancy paints before the network round trip; probe shows `posLive.heldOrders`.

## Out of scope (next)

- Skipping SSR menu fetch entirely when SQLite exists
- Unsynced Send does not show on **other** tablets until background sync finishes; on **this** device the table map and Held Orders merge local pending rows so occupancy still shows while `localDatabase` is on
- Drawer preview / Open / Pay for unsynced local ids load from SQLite (never send those ids to Mongo). Cancel / All Served / Complete soft-update local rows and keep the outbox; after Send sync, cancelled/delivered is applied on the server. Turning `localDatabase` off flushes the outbox so queued Send/Pay upload normally
- Optimistic status writes
- Staff product toggle beyond `isTesting`
