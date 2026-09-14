# Local Mode foundation (testing)

Pilot scaffolding for on-device cache. Catalog (menu + printers) plus the
last held-orders list and resume payloads. This is **not** full offline POS —
Live Orders polling stays always live, and Send / pay / register stay network.

## Store gate

| Field | Where | Who sets it |
|-------|--------|-------------|
| `menu.config.isTesting` | easymenu Menu document | Power admin → Stores drawer → **Testing store** |
| `menu.config.isOffline` | easymenu Menu document | Power admin → Stores drawer → **Offline mode** |

`isOffline` is the backup mode. When it is off, menu and settings still come from the live fetch. When it is on, a matching SQLite catalog can hydrate without that fetch. Held occupancy and resume payloads still paint first, then refresh, whenever `isTesting` is on.

When `true` (and native Order Manager), Settings shows **Local Mode foundation
(testing)** with a probe for SQLite + snapshot ages.

## Sync model (cache-first)

| Moment | Behaviour |
|--------|-----------|
| **App open, isOffline off** | Fetch the live menu and apply it. Testing stores also overwrite SQLite. Held and resume may still paint from the last snapshot, then refresh. |
| **App open, isOffline on** | If SQLite has a menu snapshot for this store → hydrate React + printers from disk. **No** catalog network required. |
| **Primary account sign-in** | Fetches live menu, applies it to `MenuContext` immediately (POS / PIN), and overwrites SQLite when `isTesting`. Does not wait for a later reload. |
| **Manual Sync** (POS header **Sync**) | Sets force-sync flag + `location.reload()` → same as sign-in network path. **This is the staff rule to avoid stale catalog.** Live Order Terminal menus stay unchanged. |
| **PIN unlock** | Does **not** sync catalog — only unlocks the operator. |
| **Empty SQLite / first install** | Must network, then write snapshots. |
| **Printer CRUD** | `refreshPrintersCache()` after add/update/delete. |
| **Table map / Held Orders** | If a held snapshot exists, paint it, then refresh from the API and overwrite. Missing snapshot fetches first, then saves. Refresh failure keeps the last copy. |
| **Open table / resume a check** | Same for the resume payload keyed by order ids. Cart paints from local, then re-applies the live fetch. Live fetch failure after a local paint keeps the cart. |
| **Held drawer preview** | Memory first, then SQLite, then network. A memory hit still revalidates in the background. |
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
- Offline Send / sync outbox
- Optimistic status / discount writes
- Staff product toggle beyond `isTesting`
