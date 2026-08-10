"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import SideDrawer from "@/components/orderManager/SideDrawer";
import PrinterScanner from "./PrinterScanner";
import { isNativeApp } from "../../../lib/helper/platformDetection";
import { PRINTER_ROUTING_GROUPS } from "@/lib/constants/itemGroups";
import {
  PRINTER_COMMAND_LANGUAGES,
  DEFAULT_PRINTER_COMMAND_LANGUAGE,
} from "@/lib/constants/printerLanguages";

const EMPTY_FORM = {
  name: "",
  connectionType: "network",
  localIp: "",
  port: "",
  forTakeaway: false,
  forDineIn: false,
  forReceipt: false,
  // Item group routing. Empty array = no group filter → printer prints
  // every item it receives (default + backwards compatible). When any box
  // is ticked we only print items that belong to one of the selected groups;
  // items without a group (or in a different group) are dropped at print time.
  groupIds: [],
  commandLanguage: DEFAULT_PRINTER_COMMAND_LANGUAGE,
};

const DEFAULT_PRINTER_PORT = 9100;

/**
 * Add / edit printer drawer (uses shared SideDrawer shell).
 */
export default function PrinterSetupModal({
  isOpen,
  onClose,
  onSave,
  mode = "add",
  printer = null,
}) {
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && printer) {
      setFormData({
        name: printer.name || "",
        connectionType: printer.connectionType || "network",
        localIp: printer.localIp || "",
        port: printer.port ? String(printer.port) : "",
        forTakeaway: printer.forTakeaway || false,
        forDineIn: printer.forDineIn || false,
        forReceipt: printer.forReceipt || false,
        groupIds: Array.isArray(printer.groupIds) ? printer.groupIds : [],
        commandLanguage:
          printer.commandLanguage || DEFAULT_PRINTER_COMMAND_LANGUAGE,
      });
      setShowManualForm(true);
    } else {
      setFormData({ ...EMPTY_FORM });
      setShowManualForm(!isNativeApp());
    }
    setErrors({});
    setIsSaving(false);
  }, [mode, printer, isOpen]);

  const validateIpAddress = (ip) => {
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  };

  const validateForm = () => {
    const newErrors = {};
    const isUsb = formData.connectionType === "usb";

    if (!formData.name.trim()) {
      newErrors.name = "Printer name is required";
    } else if (formData.name.length < 3) {
      newErrors.name = "Printer name must be at least 3 characters";
    } else if (formData.name.length > 50) {
      newErrors.name = "Printer name must be less than 50 characters";
    }

    if (isUsb) {
      if (formData.commandLanguage !== PRINTER_COMMAND_LANGUAGES.ESCPOS) {
        newErrors.commandLanguage = "USB supports ESC/POS only";
      }
    } else {
      if (!formData.localIp.trim()) {
        newErrors.localIp = "Local IP address is required";
      } else if (!validateIpAddress(formData.localIp)) {
        newErrors.localIp = "Please enter a valid IP address";
      }

      const portStr = String(formData.port ?? "").trim();
      if (portStr !== "") {
        const port = parseInt(portStr, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          newErrors.port = "Port must be between 1 and 65535";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (
        field === "commandLanguage" &&
        value === PRINTER_COMMAND_LANGUAGES.TSPL
      ) {
        next.forReceipt = false;
      }
      if (field === "connectionType" && value === "usb") {
        next.commandLanguage = PRINTER_COMMAND_LANGUAGES.ESCPOS;
      }
      return next;
    });
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    setShowManualForm(!isNativeApp());
    setFormData({ ...EMPTY_FORM });
    setErrors({});
    onClose();
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Please fix form errors before saving");
      return;
    }

    setIsSaving(true);
    try {
      const isUsb = formData.connectionType === "usb";
      const portStr = String(formData.port ?? "").trim();
      const port =
        portStr === "" ? DEFAULT_PRINTER_PORT : parseInt(portStr, 10);

      const printerData = {
        ...formData,
        connectionType: isUsb ? "usb" : "network",
        port: isUsb ? DEFAULT_PRINTER_PORT : port,
        localIp: isUsb ? formData.localIp || "usb" : formData.localIp,
        commandLanguage: isUsb
          ? PRINTER_COMMAND_LANGUAGES.ESCPOS
          : formData.commandLanguage,
        status: "unknown",
      };

      onSave(printerData);
      setShowManualForm(!isNativeApp());
      setFormData({ ...EMPTY_FORM });
      setErrors({});
      setIsSaving(false);
      onClose();
    } catch (error) {
      toast.error("Failed to save printer configuration");
      setIsSaving(false);
    }
  };

  const handlePrinterSelect = (printerData) => {
    setFormData({
      ...EMPTY_FORM,
      ...printerData,
      connectionType: "network",
    });
    setShowManualForm(true);
  };

  const handleShowManualForm = () => {
    setShowManualForm(true);
  };

  const handleToggleGroup = (groupId) => {
    setFormData((prev) => {
      const current = new Set(prev.groupIds || []);
      if (current.has(groupId)) current.delete(groupId);
      else current.add(groupId);
      return { ...prev, groupIds: Array.from(current) };
    });
  };

  const title =
    mode === "add"
      ? showManualForm
        ? isNativeApp()
          ? "Add Manually"
          : "Add Printer"
        : "Add Printer"
      : "Edit Printer";

  const showFormActions = !(mode === "add" && !showManualForm);

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle={
        mode === "edit"
          ? "Update this printer's connection and routing."
          : "Configure how this printer connects and what it prints."
      }
      closeDisabled={isSaving}
      contentKey="printer-setup-drawer"
      footer={
        showFormActions ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 rounded-xl bg-brand_accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand_accent/90 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isSaving
                ? "Saving..."
                : mode === "add"
                  ? "Add Printer"
                  : "Save Changes"}
            </button>
          </div>
        ) : null
      }
    >
      {mode === "add" && !showManualForm ? (
              <PrinterScanner
                onPrinterSelect={handlePrinterSelect}
                onShowManualForm={handleShowManualForm}
              />
            ) : (
              <div className="space-y-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Name *</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className={`input input-bordered w-full ${
                      errors.name ? "input-error" : ""
                    }`}
                    placeholder="Kitchen Printer"
                  />
                  {errors.name && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.name}
                      </span>
                    </label>
                  )}
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Connection</span>
                  </label>
                  <select
                    value={formData.connectionType}
                    onChange={(e) =>
                      handleInputChange("connectionType", e.target.value)
                    }
                    className="select select-bordered w-full"
                  >
                    <option value="network">Network</option>
                    <option value="usb">USB</option>
                  </select>
                  <label className="label">
                    <span className="label-text-alt text-gray-500">
                      {formData.connectionType === "usb"
                        ? "USB auto-detects the printer plugged into this tablet. On first print Android may ask for USB permission. Printing only works in the Android app."
                        : "Network sends raw ESC/POS over TCP (usually port 9100)."}
                    </span>
                  </label>
                </div>

                {formData.connectionType === "usb" ? null : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">IP Address *</span>
                      </label>
                      <input
                        type="text"
                        value={formData.localIp}
                        onChange={(e) =>
                          handleInputChange("localIp", e.target.value)
                        }
                        className={`input input-bordered w-full ${
                          errors.localIp ? "input-error" : ""
                        }`}
                        placeholder="192.168.1.100"
                      />
                      {errors.localIp && (
                        <label className="label">
                          <span className="label-text-alt text-error">
                            {errors.localIp}
                          </span>
                        </label>
                      )}
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Port</span>
                      </label>
                      <input
                        type="number"
                        value={formData.port}
                        onChange={(e) =>
                          handleInputChange("port", e.target.value)
                        }
                        className={`input input-bordered w-full ${
                          errors.port ? "input-error" : ""
                        }`}
                        placeholder={`${DEFAULT_PRINTER_PORT} (default)`}
                        min="1"
                        max="65535"
                      />
                      {errors.port ? (
                        <label className="label">
                          <span className="label-text-alt text-error">
                            {errors.port}
                          </span>
                        </label>
                      ) : (
                        <label className="label">
                          <span className="label-text-alt text-gray-500">
                            Leave blank for default port {DEFAULT_PRINTER_PORT}
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Printer type</span>
                  </label>
                  <select
                    value={formData.commandLanguage}
                    onChange={(e) =>
                      handleInputChange("commandLanguage", e.target.value)
                    }
                    className="select select-bordered w-full"
                    disabled={formData.connectionType === "usb"}
                  >
                    <option value={PRINTER_COMMAND_LANGUAGES.ESCPOS}>
                      Receipt (ESC/POS)
                    </option>
                    <option value={PRINTER_COMMAND_LANGUAGES.STARPRNT}>
                      Receipt (StarPRNT)
                    </option>
                    <option value={PRINTER_COMMAND_LANGUAGES.TSPL}>
                      Label (TSPL)
                    </option>
                  </select>
                  {errors.commandLanguage && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.commandLanguage}
                      </span>
                    </label>
                  )}
                  {formData.commandLanguage ===
                    PRINTER_COMMAND_LANGUAGES.STARPRNT && (
                    <label className="label">
                      <span className="label-text-alt text-gray-500">
                        For Star mC-Print3 and other StarPRNT receipt printers.
                        Use ESC/POS for Epson and most generic thermal printers.
                      </span>
                    </label>
                  )}
                  {formData.commandLanguage ===
                    PRINTER_COMMAND_LANGUAGES.TSPL && (
                    <label className="label">
                      <span className="label-text-alt text-gray-500">
                        Prints one label per item (e.g. one per cup). Assign
                        order types and item groups (e.g. Drink) so only the
                        right items go to this printer.
                      </span>
                    </label>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-neutral-800">
                    Order Types *
                  </h3>
                  <div className="space-y-3">
                    <div className="form-control">
                      <label className="label cursor-pointer justify-between">
                        <span className="label-text">Takeaway Orders</span>
                        <input
                          type="checkbox"
                          checked={formData.forTakeaway}
                          onChange={(e) =>
                            handleInputChange("forTakeaway", e.target.checked)
                          }
                          className="toggle toggle-primary"
                        />
                      </label>
                    </div>
                    <div className="form-control">
                      <label className="label cursor-pointer justify-between">
                        <span className="label-text">Dine-in Orders</span>
                        <input
                          type="checkbox"
                          checked={formData.forDineIn}
                          onChange={(e) =>
                            handleInputChange("forDineIn", e.target.checked)
                          }
                          className="toggle toggle-primary"
                        />
                      </label>
                    </div>
                  </div>
                  {errors.orderTypes && (
                    <div className="text-sm text-error">{errors.orderTypes}</div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-neutral-800">
                    Receipt printer
                  </h3>
                  <p className="text-xs text-gray-500">
                    Also use this printer for customer receipts and the cash
                    drawer. Kitchen routing still uses Takeaway / Dine-in and
                    item groups above.
                  </p>
                  <div className="form-control">
                    <label className="label cursor-pointer justify-between">
                      <span className="label-text">
                        This is a receipt printer
                      </span>
                      <input
                        type="checkbox"
                        checked={formData.forReceipt}
                        disabled={
                          formData.commandLanguage ===
                          PRINTER_COMMAND_LANGUAGES.TSPL
                        }
                        onChange={(e) =>
                          handleInputChange("forReceipt", e.target.checked)
                        }
                        className="toggle toggle-primary"
                      />
                    </label>
                  </div>
                  {formData.commandLanguage ===
                  PRINTER_COMMAND_LANGUAGES.TSPL ? (
                    <p className="text-xs text-amber-700">
                      Label (TSPL) printers cannot be receipt printers.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-neutral-800">
                    Item groups
                  </h3>
                  <p className="text-xs text-gray-500">
                    Tick the groups this printer should print. Leave everything
                    unticked to print every item (default catch-all). Food /
                    Drink / Misc route matching menu items. Backup prints
                    leftover items only (no menu group, or no printer for that
                    group).
                  </p>
                  <div className="space-y-2">
                    {PRINTER_ROUTING_GROUPS.map((group) => {
                      const checked = (formData.groupIds || []).includes(
                        group.id,
                      );
                      const isBackup = group.id === "backup";
                      return (
                        <div key={group.id} className="form-control">
                          <label className="label cursor-pointer justify-between">
                            <span className="label-text">{group.name}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleGroup(group.id)}
                              className="toggle toggle-primary"
                            />
                          </label>
                          {isBackup && checked && (
                            <p className="px-1 text-xs text-gray-500">
                              Prints items with no menu group or no matching
                              Food/Drink/Misc printer. You will get an alert
                              when this happens.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
    </SideDrawer>
  );
}
