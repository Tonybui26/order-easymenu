"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useMenuContext } from "@/components/context/MenuContext";
import SideDrawer from "@/components/orderManager/SideDrawer";
import { DEFAULT_ITEM_GROUPS } from "@/lib/constants/itemGroups";
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
];

function foodGroupOptions(itemGroups) {
  const byId = new Map((itemGroups || []).map((group) => [group.id, group]));
  return DEFAULT_ITEM_GROUPS.map((group) => {
    const savedName =
      typeof byId.get(group.id)?.name === "string"
        ? byId.get(group.id).name.trim()
        : "";
    return { id: group.id, name: savedName || group.name };
  });
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
      setBackgroundColor(tab.backgroundColor || POS_TAB_BACKGROUND_COLORS[0]);
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
              const isSelected = backgroundColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  aria-label={`Select color ${color}`}
                  aria-pressed={isSelected}
                  onClick={() => setBackgroundColor(color)}
                  className={cn(
                    "size-12 shrink-0 border border-black/10",
                    isSelected && "relative z-10 ring-2 ring-inset ring-black",
                  )}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
        </div>
    </SideDrawer>
  );
}
