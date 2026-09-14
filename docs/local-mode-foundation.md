# Local Mode foundation (testing)

Pilot scaffolding for on-device catalog cache (menu + printers). This is **not**
full offline POS — Live Orders polling stays always live.

## Store gate

| Field | Where | Who sets it |
|-------|--------|-------------|
| `menu.config.isTesting` | easymenu Menu document | Power admin → Stores drawer → **Testing store** |

When `true` (and native Order Manager), Settings shows **Local Mode foundation
(testing)** with a probe for SQLite + snapshot ages.

## Sync model (cache-first)

| Moment | Behaviour |
|--------|-----------|
| **App open (already signed in)** | If SQLite has a menu snapshot for this store → hydrate React + printers memory from disk. **No** catalog network required. |
| **Primary account sign-in / sign-up** | Sets force-sync flag → next bootstrap networks menu (SSR) + printers → overwrite SQLite. |
| **Manual Sync** (POS header **Sync**) | Sets force-sync flag + `location.reload()` → same as sign-in network path. **This is the staff rule to avoid stale catalog.** Live Order Terminal menus stay unchanged. |
| **PIN unlock** | Does **not** sync catalog — only unlocks the operator. |
| **Empty SQLite / first install** | Must network, then write snapshots. |
| **Printer CRUD** | `refreshPrintersCache()` after add/update/delete. |
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
| Snapshots | `lib/localDb/menuSnapshot.js`, `printersSnapshot.js` |
| Persist after network menu | `lib/localDb/syncLocalCatalog.js` |
| Bootstrap (cache-first vs network) | `components/context/MenuContext.js` |
| Printers cache-first API | `lib/api/fetchApi.js` |
| Sign-in force sync | `components/auth/SignInForm.jsx` |
| Settings probe | `components/orderManager/settings/LocalDbTestingPanel.jsx` |

## How to test

1. `isTesting` store + native app with SQLite plugins.
2. Sign in → probe shows fresh menu + printers `updatedAt`.
3. Kill/reopen app (session still valid) → probe ages unchanged; console may log cache-first hydrate; printers print without new GET.
4. Change menu in admin → POS stays stale until **Sync** → timestamps move.
5. Lock → unlock → catalog timestamps do **not** need to move.
6. `isTesting` off → no SQLite catalog path.

## Out of scope (next)

- Skipping SSR menu fetch entirely when SQLite exists
- Offline Send / sync outbox
- Staff product toggle beyond `isTesting`
