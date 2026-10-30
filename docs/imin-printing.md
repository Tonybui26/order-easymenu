# iMin built-in printing (Android Order Manager)

Transport for the 80mm printer built into an iMin terminal such as the Swan 2 (Android 13). It is not a USB device. Network and USB printers keep their existing paths.

## Design

```
format ESC/POS bytes  →  same payload as today
         ↓
if printer.connectionType === "imin"
         → if the payload ends with 1D 56 41 03, rewrite that suffix to 1D 56 01
         → sendRawViaImin() → PrinterImin (IminPrinterLibrary V2 sendRAWData)
else if printer.connectionType === "usb"
         → existing USB path
else
         → existing PrinterTcpSocket TCP path
```

The shared cut constant stays `1D 56 41 03`. Only the iMin send path rewrites a trailing Epson feed-and-cut into the partial cut Swan 2 documents (`1D 56 01`).

Cash drawer kick is skipped for this connection. A built-in receipt printer is left out of the kick, and network or USB receipt printers are still kicked.

## What was added

| Area | Location |
|------|----------|
| Schema | easymenu `models/printer.js`: `connectionType` includes `imin` |
| API validation | easymenu `app/api/printers/route.js` — iMin requires ESC/POS only, no IP |
| JS helpers | `lib/printers/transport/isIminPrinter.js`, `sendRawViaImin.js` |
| Native plugin | `printer-imin/` Capacitor plugin (`PrinterImin`) |
| UI | Printer Management → Connection: Built-in (iMin) |

## Setup

The plugin is inside the Android app. Deploying the website is not enough; rebuild the Order Manager APK after pulling this change.

```bash
cd order-easymenu
npm install
npx cap sync android
# then rebuild the Android app in Android Studio / CI
```

Confirm `android/capacitor.settings.gradle` and `android/app/capacitor.build.gradle` include `:printer-imin`.

1. Open **Printer Management** → Add/Edit printer.
2. Set **Connection** to **Built-in (iMin)** and save (no IP).
3. Run **Print Test** on the Swan 2.

## Scope

- Android Order Manager on an iMin terminal with SDK 2.0 (Swan 2)
- ESC/POS only (not StarPRNT, not TSPL)
- Same kitchen / receipt payloads as network, with the cut suffix rewritten on send
- Cash drawer kick is skipped for this printer
