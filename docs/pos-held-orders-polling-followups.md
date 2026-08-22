# Follow-up: Held Orders polling (table map + Held page)

**Status:** deferred — keep 10s polling for now.  
**Goal later:** cut unnecessary API traffic for single-device / POS-only restaurants without making table colors or Held cards stale.

## Current behaviour (as of Aug 2026)

| Screen | File | Poll | Endpoint |
|--------|------|------|----------|
| Table map | `components/orderManager/PosTableMap.jsx` | every **10s** + mount + after print bill | `fetchPosHeldOrders` → `GET /api/pos/orders/held` |
| Held Orders | `components/orderManager/PosHeldOrders.jsx` | every **10s** + mount | same |

These intervals are **page-scoped** (unmount clears them). They do **not** run together with Live Orders polling unless those routes are somehow both mounted (they are not today).

Held list payloads are **summaries** (no line items). Full ticket content still loads via resume only when needed (e.g. print bill, open POS).

Register open/closed is **not** on this timer — see `PosRegisterSessionContext` (mount + focus / resume).

## Why continuous polling exists

Keeps table-map status colors and Held cards fresh when something **outside this screen** changes the check:

- Second Order Manager device
- QR / online / self-order tickets
- Live Orders / kitchen actions updating ticket status
- Payment or bill print from another place

## When 10s polling is mostly redundant

Single tablet + no QR/online + staff only mutate on that device:

- Returning to table map / Held → **mount fetch** is enough
- Print bill from drawer → **already** refetches after mark printed
- Leaving POS after send/pay → mount fetch on next map/Held visit is enough

Idle 10s polling then mostly burns requests.

## Proposed later design

### Default (lean)

1. Fetch held on **page mount**
2. Refetch after **local mutations** (print bill — done; add others if needed)
3. Refetch on **window focus / Capacitor app resume** (same pattern as register session)
4. **Remove** the 10s `setInterval` (or gate it — see below)

### Optional: keep polling only when multi-source is likely

Gate continuous poll with store config, e.g.:

- `menu.config.pos.heldOrdersPollEnabled`, or
- auto-on when online ordering / QR / multi-terminal is enabled

Single-device POS-only → mount + focus only. Multi-source → keep ~10s poll.

### Do not do

- Bundle line items into the 10s held poll (too heavy)
- Poll held from root layout for every route
- Rely only on optimistic local cache with no focus refetch (stale after background)

## Implementation checklist (when picking this up)

1. [ ] Confirm product rule: always lean refresh, or config-gated poll
2. [ ] `PosTableMap.jsx` — drop or gate `setInterval`; keep mount + post-print; add focus/resume
3. [ ] `PosHeldOrders.jsx` — same
4. [ ] Share a tiny helper/hook if both pages duplicate focus + in-flight dedupe (optional)
5. [ ] If gated: add flag in easymenu `menu.config.pos.*` + Order Manager settings copy
6. [ ] Manual test matrix:
   - Single device: send → back to map → colors update without waiting 10s
   - Print bill → status updates immediately
   - Background app → resume → map refreshes
   - (If multi-device / QR still supported) second source still updates within acceptable lag
7. [ ] Update this doc status + `docs/pos-held-orders-flow.md` in easymenu if behaviour ships

## Related

- easymenu: `docs/pos-held-orders-flow.md` (Held lifecycle / grouping)
- Register cache (no timer): `components/context/PosRegisterSessionContext.js`
- Live Orders polling is separate (`LiveOrderTerminal.jsx`) — out of scope unless consolidating all OM polls later
