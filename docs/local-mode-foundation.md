# Local Mode foundation (testing)

Pilot scaffolding for on-device catalog cache (menu + printers). This is **not**
full offline POS — Live Orders polling stays always live.

## Store gate

| Field | Where | Who sets it |
|-------|--------|-------------|
| `menu.config.isTesting` | easymenu Menu document | Power admin → Stores drawer → **Testing store** |

When `true` (and native Order Manager), Settings shows **Local Mode foundation
(testing)** with a probe for SQLite + snapshot ages.

Use `isStoreTesting(menuConfig)` / `isLocalCatalogCacheEnabled()` before
experimental catalog-cache behaviour.

## Sync model (v1)

| Moment | Behaviour |
|--------|-----------|
| First authenticated load / Header Reload | SSR still fetches menu (`app/layout.jsx`). `MenuContext` writes `menu_snapshot` and **force-refreshes** printers into SQLite. |
| PIN unlock | `syncCatalogFromServer()` pulls menu + printers from the server and overwrites snapshots. Unlock still succeeds if sync fails. |
| Long unlock (no re-lock) | Menu stays in React state. Printers: memory → SQLite → network. Stale menu vs admin edits is OK until unlock/Reload. |
| Empty SQLite | Must network (no cache to read). |
| Printer CRUD | `refreshPrintersCache()` after add/update/delete so the local list matches the server. |
| Live Orders | Untouched — always polls the API for orders. |

Lock screen still gets `menuConfig` from SSR (needed to know if PIN lock is on)
before unlock — no SQLite hydrate on `/lock` in v1.

## Native plugins (one rebuild)

| Plugin | Purpose |
|--------|---------|
| `@capacitor-community/sqlite` | On-device SQLite (`easymenu_local`) |
| `@capacitor/preferences` | Device-local prefs (future) |
| `@capacitor/network` | Already present |

```bash
cd order-easymenu
npm install
npx cap sync android   # and/or ios
# Rebuild the native app once
```

## Code map

| Area | Path |
|------|------|
| Gate (fetchApi-friendly) | `lib/localDb/localCacheGate.js` |
| Open / probe DB | `lib/localDb/sqliteClient.js` |
| Schema (v2: `printers_snapshot`) | `lib/localDb/schema.js` |
| Menu / printers snapshots | `lib/localDb/menuSnapshot.js`, `printersSnapshot.js` |
| Persist after network menu | `lib/localDb/syncLocalCatalog.js` |
| Printers cache-first API | `lib/api/fetchApi.js` (`fetchPrinters`, `checkPrinterAvailability`, `refreshPrintersCache`) |
| Apply menu + unlock sync | `components/context/MenuContext.js`, `ActiveOperatorContext.js` |
| Settings probe UI | `components/orderManager/settings/LocalDbTestingPanel.jsx` |

## How to test

1. Power admin → enable **Testing store** on a pilot menu.
2. Native Order Manager (SQLite plugins rebuilt in).
3. Sign-in / cold load → Settings → **Probe local SQLite + snapshots** → menu + printers `updatedAt` set.
4. Print twice while unlocked → second call should not need a new printers GET (memory/SQLite).
5. Lock → unlock → snapshot timestamps move (fresh sync).
6. Add/edit/delete a printer → list and cache update without full app Reload.
7. Turn `isTesting` off → no cache writes; printers always network.

## Out of scope (next)

- Skipping SSR menu fetch / true offline cold start from SQLite only
- Bundled POS shell with no `server.url`
- Local sales / sync outbox
- Staff-facing Local Mode product toggle (beyond `isTesting`)
