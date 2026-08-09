# USB printing (Android Order Manager)

Backup transport for ESC/POS receipt printers when network (TCP `:9100`) is not available. The tablet connects to the printer over USB OTG.

## Design (keep network path safe)

```
format ESC/POS bytes  →  same payload as today
         ↓
if printer.connectionType === "usb"
         → sendRawViaUsb() → PrinterUsb.connect() auto-picks device
         → Android may ask USB permission on first use
         → send bytes → disconnect
else
         → existing PrinterTcpSocket TCP code (unchanged)
```

Network printers never enter USB code. Existing TCP connect/send/disconnect blocks stay as they were.

## What was added

| Area | Location |
|------|----------|
| Schema | easymenu `models/printer.js`: `connectionType` (`network` \| `usb`) — no stored VID/PID |
| API validation | easymenu `app/api/printers/route.js` — USB requires ESC/POS only |
| JS helpers | `lib/printers/transport/isUsbPrinter.js`, `isPrinterReady.js`, `sendRawViaUsb.js` |
| Native plugin | `printer-usb/` Capacitor plugin (`PrinterUsb`) — auto-detects plugged-in printer |
| UI | Printer Management → Connection: Network \| USB (Android) |

## Setup on Android tablet / emulator

**Important:** The Android app loads JS from `server.url` in `capacitor.config.ts`
(currently `https://order.goeasy.menu`). That means:

- Production builds only show USB UI **after** this code is deployed to that host.
- For local testing, point `server.url` at your machine (e.g. `http://10.0.2.2:3001`
  for the Android emulator → host localhost) with `cleartext: true`, run
  `npm run dev`, then `npx cap sync android` and rebuild.

1. Plug the ESC/POS printer into the tablet with a USB-OTG cable/adapter (emulator: use USB passthrough if available).
2. Open **Printer Management** → Add/Edit printer.
3. Set **Connection** to **USB (Android tablet)** and save (no IP, no scan).
4. Run **Print Test** / **Print Test (no logo)**.
5. On first use, Android may show **Allow USB access?** — tap Allow. The app waits until you answer (no short timeout). Only **Deny/Cancel** shows a permission-denied error.

## How auto-detect works

On each USB print, `PrinterUsb.connect()` (with no VID/PID):

1. Lists attached USB devices
2. Prefers USB **printer class** devices with a bulk OUT endpoint
3. Otherwise uses the first device that has a bulk OUT endpoint
4. Requests permission if not already granted
5. Opens the device and returns a `connectionId`

Best when **only the receipt printer** is plugged into the tablet.

## Scope (v1)

- Android native Order Manager only
- ESC/POS only (not StarPRNT, not TSPL)
- Same kitchen / receipt / cash-drawer / font-test payloads as network

## Rebuild checklist

```bash
cd order-easymenu
npm install
npx cap sync android
# then rebuild the Android app in Android Studio / CI
```

Confirm `android/capacitor.settings.gradle` and `android/app/capacitor.build.gradle` include `:printer-usb`.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| “USB printing requires Android Order Manager” | Running in browser / iOS |
| “USB permission denied” | Deny on system dialog — print again and Allow |
| “No USB printer found” | Cable/OTG, power, or printer not attached |
| “No USB bulk OUT endpoint” | Device is not a raw printer interface |
| Wrong device prints | Another USB gadget plugged in — unplug extras |

## Related plugins

- **Network:** `printer-tcp-socket` → `PrinterTcpSocket`
- **USB:** `printer-usb` → `PrinterUsb`
