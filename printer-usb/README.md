# printer-usb

Capacitor plugin for **Android USB host** printing of raw ESC/POS bytes.

Used by Order Manager when a printer has `connectionType: "usb"`. See [docs/usb-printing.md](../docs/usb-printing.md).

## JS API

```js
import { registerPlugin } from "@capacitor/core";
const PrinterUsb = registerPlugin("PrinterUsb");

// Auto-pick plugged-in printer (may show Android USB permission dialog)
await PrinterUsb.connect({ timeoutMs: 10000 });

// Optional: target a specific device
await PrinterUsb.connect({ vendorId, productId });

await PrinterUsb.send({ connectionId, data: base64, encoding: "base64" });
await PrinterUsb.disconnect({ connectionId });
```

Web/iOS: methods reject — USB is Android-only.
