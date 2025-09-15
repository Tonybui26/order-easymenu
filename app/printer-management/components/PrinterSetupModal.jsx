"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "react-hot-toast";
import PrinterScanner from "./PrinterScanner";
import { isNativeApp } from "../../../lib/helper/platformDetection";

export default function PrinterSetupModal({
  isOpen,
  onClose,
  onSave,
  mode = "add",
  printer = null,
}) {
  const [formData, setFormData] = useState({
    name: "",
    localIp: "",
    port: "9100",
    forTakeaway: false,
    forDineIn: false,
  });

  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  // Initialize form data when editing
  useEffect(() => {
    if (mode === "edit" && printer) {
      setFormData({
        name: printer.name || "",
        localIp: printer.localIp || "",
        port: printer.port || "9100",
        forTakeaway: printer.forTakeaway || false,
        forDineIn: printer.forDineIn || false,
      });
      setShowManualForm(true); // Show form directly for editing
    } else {
      // Show manual form directly if not on mobile (no network scanning available)
      setShowManualForm(!isNativeApp());
    }
  }, [mode, printer, isOpen]);

  // Validation functions
  const validateIpAddress = (ip) => {
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  };

  const validateForm = () => {
    const newErrors = {};

    // Printer name validation
    if (!formData.name.trim()) {
      newErrors.name = "Printer name is required";
    } else if (formData.name.length < 3) {
      newErrors.name = "Printer name must be at least 3 characters";
    } else if (formData.name.length > 50) {
      newErrors.name = "Printer name must be less than 50 characters";
    }

    // Local IP validation
    if (!formData.localIp.trim()) {
      newErrors.localIp = "Local IP address is required";
    } else if (!validateIpAddress(formData.localIp)) {
      newErrors.localIp = "Please enter a valid IP address";
    }

    // Port validation
    const port = parseInt(formData.port);
    if (!formData.port || formData.port === "") {
      newErrors.port = "Port number is required";
    } else if (isNaN(port) || port < 1 || port > 65535) {
      newErrors.port = "Port must be between 1 and 65535";
    }

    // At least one order type must be selected
    // if (!formData.forTakeaway && !formData.forDineIn) {
    //   newErrors.orderTypes = "Please select at least one order type";
    // }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Please fix form errors before saving");
      return;
    }

    setIsSaving(true);
    try {
      const printerData = {
        ...formData,
        status: "unknown", // Default status for simple management
      };

      onSave(printerData);
      handleClose();
    } catch (error) {
      toast.error("Failed to save printer configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrinterSelect = (printerData) => {
    setFormData(printerData);
    setShowManualForm(true);
  };

  const handleShowManualForm = () => {
    setShowManualForm(true);
  };

  const handleClose = () => {
    // Reset all states when modal closes
    setShowManualForm(!isNativeApp()); // Reset based on platform
    setFormData({
      name: "",
      localIp: "",
      port: "9100",
      forTakeaway: false,
      forDineIn: false,
    });
    setErrors({});
    setIsSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="modal modal-open">
      <div className="modal-box max-h-[90vh] max-w-lg overflow-y-auto">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {mode === "add"
              ? showManualForm
                ? isNativeApp()
                  ? "Add Manually"
                  : "Add Printer"
                : "Add Printer"
              : "Edit Printer"}
          </h2>
          <button
            onClick={handleClose}
            className="btn btn-circle btn-ghost btn-sm"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        {mode === "add" && !showManualForm ? (
          <PrinterScanner
            onPrinterSelect={handlePrinterSelect}
            onShowManualForm={handleShowManualForm}
          />
        ) : (
          <div className="space-y-4">
            {/* Printer Name */}
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

            {/* Network Configuration */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">IP Address *</span>
                </label>
                <input
                  type="text"
                  value={formData.localIp}
                  onChange={(e) => handleInputChange("localIp", e.target.value)}
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

              <div className="form-control hidden">
                <label className="label">
                  <span className="label-text">Port *</span>
                </label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => handleInputChange("port", e.target.value)}
                  className={`input input-bordered w-full ${
                    errors.port ? "input-error" : ""
                  }`}
                  placeholder="9100"
                  min="1"
                  max="65535"
                />
                {errors.port && (
                  <label className="label">
                    <span className="label-text-alt text-error">
                      {errors.port}
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* Order Type Settings */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-base-content">
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

            {/* Footer */}
            <div className="modal-action">
              <button onClick={handleClose} className="btn btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary btn"
              >
                {isSaving
                  ? "Saving..."
                  : mode === "add"
                    ? "Add Printer"
                    : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={handleClose}></div>
    </div>
  );

  // Use portal to render modal at document body level
  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
