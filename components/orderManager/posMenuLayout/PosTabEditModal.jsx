"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useMenuContext } from "@/components/context/MenuContext";
import SideDrawer from "@/components/orderManager/SideDrawer";
import { foodGroupOptions } from "@/lib/pos/foodGroups";
import { cn } from "@/lib/helper";

export const POS_TAB_BACKGROUND_COLORS = [
  "#E8C547",
  "#FFFFFF",
  "#A8D4F0",
  "#7DDB8C",
  "#F2555A",
  "#F5D03A",
  "#9B7ED9",
  "#F5B8C8",
  "#A8E6C3",
  "#FF9F43",
  "#54A0FF",
  "#5F27CD",
  "#01A3A4",
  "#FF6B6B",
  "#48DBFB",
  "#F368E0",
  "#10AC84",
  "#FECA57",
  "#EE5A24",
  "#C8D6E5",
  "#B4F26E",
  "#FF8F70",
];

export function normalizeHexColor(value, fallback = POS_TAB_BACKGROUND_COLORS[0]) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.slice(1).toUpperCase()}`;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

export function isPresetBackgroundColor(value) {
  const normalized = normalizeHexColor(value, "");
  if (!normalized) return false;
  return POS_TAB_BACKGROUND_COLORS.some(
    (color) => normalizeHexColor(color) === normalized,
  );
}

export default function PosTabEditModal({
  isOpen,
  onClose,
  tab = null,
  hasProducts = false,
  onCreate,
  onSave,
  onDelete,
}) {
  const { itemGroups } = useMenuContext();
  const groupOptions = useMemo(
    () => foodGroupOptions(itemGroups),
    [itemGroups],
  );
  const defaultGroupId = groupOptions[0]?.id || "food";
  const isEditMode = Boolean(tab?.id);
  const [name, setName] = useState("");
  const [backgroundColor, setBackgroundColor] = useState(
    POS_TAB_BACKGROUND_COLORS[0],
  );
  const [openItem, setOpenItem] = useState(false);
  const [itemGroupId, setItemGroupId] = useState(defaultGroupId);

  useEffect(() => {
    if (!isOpen) return;
    const nextGroupId = groupOptions.some((group) => group.id === tab?.itemGroupId)
      ? tab.itemGroupId
      : defaultGroupId;
    if (tab) {
      setName(tab.name || "");
      setBackgroundColor(
        normalizeHexColor(tab.backgroundColor || POS_TAB_BACKGROUND_COLORS[0]),
      );
      setOpenItem(tab.openItem === true && !hasProducts);
      setItemGroupId(nextGroupId);
      return;
    }
    setName("");
    setBackgroundColor(POS_TAB_BACKGROUND_COLORS[0]);
    setOpenItem(false);
    setItemGroupId(defaultGroupId);
  }, [isOpen, tab, hasProducts, defaultGroupId, groupOptions]);

  const trimmedName = name.trim();
  const openItemEnabled = openItem && !hasProducts;
  const resolvedGroupId = groupOptions.some((group) => group.id === itemGroupId)
    ? itemGroupId
    : defaultGroupId;
  const canSubmit =
    trimmedName.length > 0 && (!openItemEnabled || Boolean(resolvedGroupId));

  function handleSubmit() {
    if (!canSubmit) return;
    const payload = {
      name: trimmedName,
      backgroundColor,
      openItem: openItemEnabled,
      itemGroupId: openItemEnabled ? resolvedGroupId : "",
    };
    if (isEditMode) onSave?.({ ...payload, id: tab.id });
    else onCreate?.(payload);
    onClose?.();
  }

  function handleDelete() {
    if (!isEditMode) return;
    onDelete?.(tab.id);
    onClose?.();
  }

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? "Edit tab" : "New tab"}
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {isEditMode ? "Save tab" : "Create tab"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {isEditMode ? (
            <button
              type="button"
              onClick={handleDelete}
              className="btn btn-ghost ml-auto text-red-600"
              aria-label="Delete tab"
            >
              <Trash2 className="size-5" />
            </button>
          ) : null}
        </div>
      }
    >
        <label className="block text-sm font-medium text-neutral-800" htmlFor="pos-tab-name">
          Tab name
          <input
            id="pos-tab-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Sides"
            className="input input-bordered mt-1.5 w-full text-base"
          />
        </label>

        {hasProducts ? null : (
          <div className="mt-6 space-y-4">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-medium text-neutral-900">
                  Open item
                </span>
                <span className="mt-0.5 block text-sm text-neutral-500">
                  Staff enter a custom item name and price on the POS.
                </span>
              </span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={openItem}
                onChange={(event) => {
                  const next = event.target.checked;
                  setOpenItem(next);
                  if (next && !resolvedGroupId) setItemGroupId(defaultGroupId);
                }}
              />
            </label>
            {openItem ? (
              <label className="block text-sm font-medium text-neutral-900" htmlFor="pos-tab-item-group">
                Food group
                <select
                  id="pos-tab-item-group"
                  className="select select-bordered mt-1.5 w-full"
                  value={resolvedGroupId}
                  onChange={(event) => setItemGroupId(event.target.value)}
                >
                  {groupOptions.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <span className="mt-1.5 block text-sm font-normal text-neutral-500">
                  Kitchen printers for this group receive the custom item.
                </span>
              </label>
            ) : null}
          </div>
        )}

        <div className="mt-6">
          <p className="text-sm font-medium text-neutral-900">Background</p>
          <div className="mt-2 flex flex-wrap">
            {POS_TAB_BACKGROUND_COLORS.map((color) => {
              const isSelected =
                normalizeHexColor(backgroundColor) === normalizeHexColor(color);
              return (
                <button
                  key={color}
                  type="button"
                  aria-label={`Select color ${color}`}
                  aria-pressed={isSelected}
                  onClick={() => setBackgroundColor(normalizeHexColor(color))}
                  className={cn(
                    "size-12 shrink-0 border border-black/10",
                    isSelected && "relative z-10 ring-2 ring-inset ring-black",
                  )}
                  style={{ backgroundColor: color }}
                />
              );
            })}
            <label
              className={cn(
                "relative size-12 shrink-0 cursor-pointer border border-black/10",
                !isPresetBackgroundColor(backgroundColor) &&
                  "relative z-10 ring-2 ring-inset ring-black",
              )}
              aria-label="Custom background color"
              title="Custom color"
            >
              <input
                type="color"
                value={normalizeHexColor(backgroundColor)}
                onChange={(event) =>
                  setBackgroundColor(normalizeHexColor(event.target.value))
                }
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: isPresetBackgroundColor(backgroundColor)
                    ? "conic-gradient(#F2555A, #F5D03A, #7DDB8C, #54A0FF, #9B7ED9, #F368E0, #F2555A)"
                    : undefined,
                  backgroundColor: isPresetBackgroundColor(backgroundColor)
                    ? undefined
                    : normalizeHexColor(backgroundColor),
                }}
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[9px] font-semibold uppercase leading-none text-white">
                Custom
              </span>
            </label>
          </div>
        </div>
    </SideDrawer>
  );
}
