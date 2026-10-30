# cashbox-imin

Capacitor plugin for the **iMin terminal RJ12 cash drawer**.

This uses `IminSDKManager.opencashBox` from IminDeviceLibrary. It does not use the built-in printer service, so it works on iMin desktops with or without a printer.

Order Manager calls it when Settings → Printers → Cash drawer → **Use terminal cash drawer** is on.
