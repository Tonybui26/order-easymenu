# Local Mode foundation (testing)

Pilot scaffolding for on-device sales when the cloud is slow or unreachable.
This is **not** full Local Mode yet — only the store gate + native plugins +
SQLite probe so later work can ship as remote JS without rebuilding the app.

## Store gate

| Field | Where | Who sets it |
|-------|--------|-------------|
| `menu.config.isTesting` | easymenu Menu document | Power admin → Stores drawer → **Testing store** |

When `true`, Order Manager Settings shows **Local Mode foundation (testing)**
with a **Probe local SQLite** button.

Use `isStoreTesting(menuConfig)` from `lib/store/isTesting.js` before any
experimental Local Mode behaviour.

## Native plugins (one rebuild)

Installed in **order-easymenu** and synced into Android:

| Plugin | Purpose |
|--------|---------|
| `@capacitor-community/sqlite` | On-device SQLite (`easymenu_local`) |
| `@capacitor/preferences` | Device-local prefs (sync cursors, flags) |
| `@capacitor/network` | Already present — connectivity hints |

`capacitor.config.ts` sets `CapacitorSQLite.androidIsEncryption: false` for
unencrypted pilot DBs.

### Rebuild checklist (do once after pulling this)

```bash
cd order-easymenu
npm install
npx cap sync android
# Rebuild the Android app in Android Studio / CI
```

Confirm `android/capacitor.settings.gradle` includes
`:capacitor-community-sqlite` and `:capacitor-preferences`.

After that rebuild, JS under `lib/localDb/` and Settings can change via
`server.url` (LAN or production) without another native rebuild — unless you
add **new** Capacitor plugins.

## Code map

| Area | Path |
|------|------|
| Open / probe DB | `lib/localDb/sqliteClient.js` |
| Bootstrap schema | `lib/localDb/schema.js` |
| Preferences helper | `lib/localDb/preferences.js` |
| Settings probe UI | `components/orderManager/settings/LocalDbTestingPanel.jsx` |

Bootstrap tables: `meta`, `menu_snapshot`, `local_orders`, `sync_outbox`.

## How to test

1. Power admin → enable **Testing store** on a pilot menu.
2. Open Order Manager for that store (native Android build with plugins).
3. Settings → **Probe local SQLite** → expect `{ ok: true, database: "easymenu_local", ... }`.
4. Browser / web-only: probe reports unsupported (expected until a bundled web
   jeep-sqlite path exists).

## Out of scope (next)

- Bundled POS shell that works with no `server.url`
- Writing sales into `local_orders` / `sync_outbox`
- Sync API on easymenu
- Staff-facing Local Mode toggle
