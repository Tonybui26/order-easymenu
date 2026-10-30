# printer-imin

Capacitor plugin for the **iMin built-in** 80mm printer (Swan 2, Android 13, SDK 2.0).

Used by Order Manager when a printer has `connectionType: "imin"`. See [docs/imin-printing.md](../docs/imin-printing.md).

## JS API

```js
import { registerPlugin } from "@capacitor/core";
const PrinterImin = registerPlugin("PrinterImin");

await PrinterImin.connect();
await PrinterImin.send({ connectionId, data: base64, encoding: "base64" });
await PrinterImin.disconnect({ connectionId });
```

`disconnect` drops the id only. The print service stays bound for the next ticket.

Web/iOS: methods reject — this printer exists only on the Android iMin terminal.
