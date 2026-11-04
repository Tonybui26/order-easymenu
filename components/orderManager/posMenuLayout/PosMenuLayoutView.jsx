"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Pencil, Plus, X } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import toast from "react-hot-toast";

import { useMenuContext } from "@/components/context/MenuContext";
import SettingsSaveBar from "@/components/orderManager/settings/SettingsSaveBar";
import { createPosProduct, updatePosLayouts, updatePosProduct } from "@/lib/api/fetchApi";
import { cn } from "@/lib/helper";
import { foodGroupIdForItem } from "@/lib/pos/foodGroups";
import {
  clonePosLayouts,
  serializePosLayouts,
  updateDefaultPosLayoutTabs,
} from "@/lib/pos/posLayouts";
import PosTabEditModal from "./PosTabEditModal";
import PosTabItemsModal from "./PosTabItemsModal";
import PosCreateProductModal from "./PosCreateProductModal";

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}`;
}

function createEmptyRow() {
  return { id: createId("row"), itemIds: [] };
}

function tabHasProducts(tab) {
  return (tab?.rows || []).some(
    (row) => Array.isArray(row.itemIds) && row.itemIds.length > 0,
  );
}

function useAllMenuItems(menuContent) {
  return useMemo(() => {
    const list = [];
    const seen = new Map();
    (menuContent || []).forEach((section) => {
      (section.items || []).forEach((item) => {
        if (!item?.id || item?.isDraft) return;
        if (!seen.has(item.id)) {
          seen.set(item.id, list.length);
          list.push({
            ...item,
            __sectionTitles: [section.sectionTitle].filter(Boolean),
          });
        } else {
          const idx = seen.get(item.id);
          if (section.sectionTitle) {
            list[idx].__sectionTitles.push(section.sectionTitle);
          }
        }
      });
    });
    return list;
  }, [menuContent]);
}

function getTabItemIds(tab) {
  if (!tab) return [];
  if (Array.isArray(tab.rows)) {
    return tab.rows.flatMap((row) => row.itemIds || []);
  }
  return tab.itemIds || [];
}

function AddRowButton({ onClick }) {
  return (
    <button
      type="button"
      aria-label="Add row"
      onClick={onClick}
      className="group relative flex h-10 w-full items-center justify-center bg-[#ececec] transition-colors hover:bg-[#e4e4e4]"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-1/2 border-t border-dashed border-neutral-300"
      />
      <span className="relative z-10 flex size-6 items-center justify-center rounded-full bg-[#ececec] text-neutral-500 group-hover:bg-[#e4e4e4] group-hover:text-neutral-700">
        <Plus size={16} strokeWidth={2.25} />
      </span>
    </button>
  );
}

function SortablePosTab({ tab, isSelected, onSelect, onEdit }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: tab.backgroundColor,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex w-full shrink-0 cursor-grab select-none flex-col items-start justify-center gap-1.5 px-4 py-7 text-left active:cursor-grabbing",
        isSelected ? "ring-2 ring-inset ring-neutral-900" : "hover:opacity-90",
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(tab.id)}
    >
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onEdit?.(tab.id);
        }}
        className="absolute right-1.5 top-1.5 rounded-md bg-black/10 p-1 text-neutral-700 transition-colors hover:bg-black/20"
        aria-label={`Edit ${tab.name}`}
      >
        <Pencil className="size-3.5" />
      </button>
      <span className="line-clamp-2 pr-5 text-xl font-semibold text-neutral-900">
        {tab.name}
      </span>
    </div>
  );
}

function SortablePosItem({ item, onRemove, onEdit }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex aspect-square w-full cursor-grab select-none flex-col overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_#1a1a1a0f] active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
      onClick={() => onEdit?.(item)}
    >
      <div className="relative min-h-0 flex-1 bg-neutral-100">
        {item.PhotoSrc ? (
          <Image
            src={item.PhotoSrc}
            alt={item.title || "Product"}
            fill
            sizes="160px"
            className="pointer-events-none object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-neutral-400">
            No img
          </div>
        )}
      </div>
      <div className="shrink-0 px-2.5 py-2">
        <p className="truncate text-sm font-semibold text-neutral-800">
          {item.title || "Untitled product"}
        </p>
        {item.posOnly === true ? (
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            POS only
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onRemove(item.id);
        }}
        className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1 text-neutral-500 shadow-sm hover:bg-red-50 hover:text-red-600"
        aria-label={`Remove ${item.title} from row`}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export default function PosMenuLayoutView() {
  const { menuContent, setMenuContent, posLayouts, itemGroups, syncCatalogFromServer } =
    useMenuContext();
  const allItems = useAllMenuItems(menuContent);
  const itemsById = useMemo(() => {
    const map = new Map();
    allItems.forEach((item) => map.set(item.id, item));
    return map;
  }, [allItems]);
  const categories = useMemo(
    () => (menuContent || []).filter((section) => section?.id && !section.isDraft),
    [menuContent],
  );

  const [draftLayouts, setDraftLayouts] = useState(() =>
    clonePosLayouts(posLayouts),
  );
  const [selectedTabId, setSelectedTabId] = useState(null);
  const [isTabModalOpen, setIsTabModalOpen] = useState(false);
  const [editingTabId, setEditingTabId] = useState(null);
  const [itemsDrawerRowId, setItemsDrawerRowId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const draftRef = useRef(draftLayouts);
  draftRef.current = draftLayouts;
  const baselineRef = useRef(serializePosLayouts(posLayouts));

  useEffect(() => {
    const incoming = serializePosLayouts(posLayouts);
    if (incoming === baselineRef.current) return;
    const userHasEdits = serializePosLayouts(draftRef.current) !== baselineRef.current;
    baselineRef.current = incoming;
    if (!userHasEdits) {
      setDraftLayouts(clonePosLayouts(posLayouts));
    }
  }, [posLayouts]);

  const tabs = useMemo(() => draftLayouts?.[0]?.tabs || [], [draftLayouts]);
  function setTabs(tabsOrUpdater) {
    setDraftLayouts((prev) => updateDefaultPosLayoutTabs(prev, tabsOrUpdater));
  }

  const isDirty = useMemo(
    () => serializePosLayouts(draftLayouts) !== serializePosLayouts(posLayouts),
    [draftLayouts, posLayouts],
  );

  const [draggingTabId, setDraggingTabId] = useState(null);
  const [draggingItemId, setDraggingItemId] = useState(null);

  // A swipe scrolls. A finger that stays still for a moment, then moves, reorders.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 600, tolerance: 8 },
    }),
  );

  useEffect(() => {
    if (tabs.length === 0) {
      if (selectedTabId) setSelectedTabId(null);
      return;
    }
    const stillExists = tabs.some((tab) => tab.id === selectedTabId);
    if (!stillExists) setSelectedTabId(tabs[0].id);
  }, [tabs, selectedTabId]);

  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) ?? null;
  const selectedTabRows = selectedTab?.rows || [];
  const selectedTabItemIds = useMemo(
    () => getTabItemIds(selectedTab),
    [selectedTab],
  );
  const tabIds = useMemo(() => tabs.map((tab) => tab.id), [tabs]);

  async function handleSaveChanges() {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      const result = await updatePosLayouts(draftLayouts);
      const saved = Array.isArray(result?.posLayouts)
        ? result.posLayouts
        : draftLayouts;
      baselineRef.current = serializePosLayouts(saved);
      setDraftLayouts(clonePosLayouts(saved));
      const synced = await syncCatalogFromServer();
      if (!synced?.success) {
        toast.error("Saved, but the menu did not refresh");
      } else {
        toast.success("Menu layout saved");
      }
    } catch (error) {
      toast.error(error?.message || "Could not save the menu layout");
    } finally {
      setIsSaving(false);
    }
  }

  function updateSelectedTab(mutate) {
    if (!selectedTabId) return;
    setTabs((prev) =>
      prev.map((tab) => (tab.id === selectedTabId ? mutate(tab) : tab)),
    );
  }

  function handleTabDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTabs((items) => {
      const oldIndex = items.findIndex((tab) => tab.id === active.id);
      const newIndex = items.findIndex((tab) => tab.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  function handleCreateTab({ name, backgroundColor, openItem, itemGroupId }) {
    const newTab = {
      id: createId("tab"),
      name,
      backgroundColor,
      openItem: openItem === true,
      itemGroupId: openItem === true ? itemGroupId || "" : "",
      rows: [createEmptyRow()],
    };
    setTabs((prev) => [...prev, newTab]);
    setSelectedTabId(newTab.id);
  }

  function handleSaveTab({ id, name, backgroundColor, openItem, itemGroupId }) {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== id) return tab;
        const nextOpenItem = openItem === true && !tabHasProducts(tab);
        return {
          ...tab,
          name,
          backgroundColor,
          openItem: nextOpenItem,
          itemGroupId: nextOpenItem ? itemGroupId || "" : "",
        };
      }),
    );
  }

  function handleDeleteTab(tabId) {
    setTabs((prev) => prev.filter((tab) => tab.id !== tabId));
    if (selectedTabId === tabId) setSelectedTabId(null);
  }

  function openCreateTabModal() {
    setEditingTabId(null);
    setIsTabModalOpen(true);
  }

  function openEditTabModal(tabId) {
    setEditingTabId(tabId);
    setIsTabModalOpen(true);
  }

  function closeTabModal() {
    setIsTabModalOpen(false);
    setEditingTabId(null);
  }

  function handleAddRowAfter(rowIndex) {
    updateSelectedTab((tab) => {
      const rows = [...(tab.rows || [])];
      rows.splice(rowIndex + 1, 0, createEmptyRow());
      return { ...tab, rows };
    });
  }

  function handleAddItemsToRow(itemIdsToAdd) {
    if (
      !selectedTabId ||
      !itemsDrawerRowId ||
      !Array.isArray(itemIdsToAdd) ||
      itemIdsToAdd.length === 0
    ) {
      return;
    }
    const rowId = itemsDrawerRowId;
    updateSelectedTab((tab) => ({
      ...tab,
      rows: (tab.rows || []).map((row) => {
        if (row.id !== rowId) return row;
        const existing = new Set(row.itemIds || []);
        itemIdsToAdd.forEach((id) => existing.add(id));
        return { ...row, itemIds: Array.from(existing) };
      }),
    }));
    setItemsDrawerRowId(null);
    setIsCreateOpen(false);
  }

  async function handleCreateProduct(payload) {
    const result = await createPosProduct(payload);
    const itemId = result?.item?.id;
    if (!itemId) throw new Error("Product was not created");
    if (Array.isArray(result.menuContent)) {
      setMenuContent(result.menuContent);
    }
    handleAddItemsToRow([itemId]);
    await syncCatalogFromServer();
    toast.success("Product created. Save changes to show it on the POS.");
  }

  function openProductEditor(item) {
    const categoryId =
      (menuContent || []).find((section) =>
        (section.items || []).some((entry) => entry.id === item.id),
      )?.id || "";
    setEditingProduct({
      ...item,
      categoryId,
      itemGroupId: foodGroupIdForItem(itemGroups, item.id) || "food",
    });
  }

  async function handleSaveProduct(payload) {
    const result = await updatePosProduct(payload);
    if (Array.isArray(result?.menuContent)) {
      setMenuContent(result.menuContent);
    }
    await syncCatalogFromServer();
    toast.success("Product updated");
  }

  function handleRemoveItemFromRow(rowId, itemId) {
    updateSelectedTab((tab) => ({
      ...tab,
      rows: (tab.rows || []).map((row) => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          itemIds: (row.itemIds || []).filter((id) => id !== itemId),
        };
      }),
    }));
  }

  function handleRowItemDragEnd(rowId, event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    updateSelectedTab((tab) => ({
      ...tab,
      rows: (tab.rows || []).map((row) => {
        if (row.id !== rowId) return row;
        const itemIds = row.itemIds || [];
        const oldIndex = itemIds.findIndex((id) => id === active.id);
        const newIndex = itemIds.findIndex((id) => id === over.id);
        if (oldIndex === -1 || newIndex === -1) return row;
        return { ...row, itemIds: arrayMove(itemIds, oldIndex, newIndex) };
      }),
    }));
  }

  const draggingTab = tabs.find((tab) => tab.id === draggingTabId) ?? null;
  const draggingItem = draggingItemId ? itemsById.get(draggingItemId) : null;

  const editingTab =
    editingTabId != null
      ? tabs.find((tab) => tab.id === editingTabId) ?? null
      : null;

  return (
    <>
      <div className={cn("relative flex h-full min-h-0 w-full", isDirty && "pb-20")}>
        <aside className="flex w-[88px] shrink-0 flex-col overflow-y-auto bg-[#e8e8e8] sm:w-[200px]">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={(event) => setDraggingTabId(event.active.id)}
            onDragCancel={() => setDraggingTabId(null)}
            onDragEnd={(event) => {
              setDraggingTabId(null);
              handleTabDragEnd(event);
            }}
          >
            <SortableContext items={tabIds} strategy={verticalListSortingStrategy}>
              {tabs.map((tab) => (
                <SortablePosTab
                  key={tab.id}
                  tab={tab}
                  isSelected={tab.id === selectedTabId}
                  onSelect={setSelectedTabId}
                  onEdit={openEditTabModal}
                />
              ))}
            </SortableContext>
            <DragOverlay zIndex={50}>
              {draggingTab ? (
                <div
                  className="flex w-[200px] items-center px-4 py-7 text-left text-xl font-semibold text-neutral-900 shadow-lg"
                  style={{ backgroundColor: draggingTab.backgroundColor }}
                >
                  {draggingTab.name}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <button
            type="button"
            aria-label="Add tab"
            onClick={openCreateTabModal}
            className="flex w-full shrink-0 items-center justify-center bg-[#d9d9d9] py-7 text-neutral-900 transition-colors hover:bg-[#cfcfcf]"
          >
            <Plus size={28} strokeWidth={2.25} />
          </button>
        </aside>

        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[#f4f5f5]">
          {selectedTab ? (
            selectedTab.openItem ? (
              <div className="flex h-full min-h-[240px] items-center justify-center px-8 text-center text-sm text-neutral-500">
                This tab adds a custom item on the POS. Staff enter the name and
                price there.
              </div>
            ) : selectedTabRows.length === 0 ? (
              <div className="p-4">
                <button
                  type="button"
                  onClick={() => handleAddRowAfter(-1)}
                  className="btn btn-ghost"
                >
                  Add row
                </button>
              </div>
            ) : (
              <div className="flex flex-col">
                {selectedTabRows.map((row, rowIndex) => {
                  const rowItems = (row.itemIds || [])
                    .map((id) => itemsById.get(id))
                    .filter(Boolean);
                  const rowItemIds = rowItems.map((item) => item.id);

                  return (
                    <div key={row.id}>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={(event) => setDraggingItemId(event.active.id)}
                        onDragCancel={() => setDraggingItemId(null)}
                        onDragEnd={(event) => {
                          setDraggingItemId(null);
                          handleRowItemDragEnd(row.id, event);
                        }}
                      >
                        <SortableContext
                          items={rowItemIds}
                          strategy={rectSortingStrategy}
                        >
                          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                            {rowItems.map((item) => (
                              <SortablePosItem
                                key={item.id}
                                item={item}
                                onEdit={openProductEditor}
                                onRemove={(itemId) =>
                                  handleRemoveItemFromRow(row.id, itemId)
                                }
                              />
                            ))}
                            <button
                              type="button"
                              aria-label="Add products to row"
                              onClick={() => setItemsDrawerRowId(row.id)}
                              className="flex aspect-square w-full items-center justify-center rounded-lg bg-[#d9d9d9] text-neutral-900 transition-colors hover:bg-[#cfcfcf]"
                            >
                              <Plus size={36} strokeWidth={2} />
                            </button>
                          </div>
                        </SortableContext>
                        <DragOverlay zIndex={50}>
                          {draggingItem &&
                          rowItems.some((item) => item.id === draggingItem.id) ? (
                            <div className="flex w-36 items-center rounded-lg bg-white px-3 py-4 text-sm font-semibold text-neutral-900 shadow-lg ring-1 ring-black/10">
                              <span className="truncate">
                                {draggingItem.title || "Untitled product"}
                              </span>
                            </div>
                          ) : null}
                        </DragOverlay>
                      </DndContext>
                      <AddRowButton onClick={() => handleAddRowAfter(rowIndex)} />
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="flex h-full min-h-[240px] items-center justify-center px-8 text-center text-sm text-neutral-500">
              Add a tab to start the POS menu.
            </div>
          )}
        </section>
      </div>

      <SettingsSaveBar
        isVisible={isDirty}
        isSaving={isSaving}
        onSave={handleSaveChanges}
      />

      <PosTabEditModal
        isOpen={isTabModalOpen}
        onClose={closeTabModal}
        tab={editingTab}
        hasProducts={tabHasProducts(editingTab)}
        onCreate={handleCreateTab}
        onSave={handleSaveTab}
        onDelete={handleDeleteTab}
      />

      <PosTabItemsModal
        isOpen={Boolean(itemsDrawerRowId) && !isCreateOpen}
        onClose={() => setItemsDrawerRowId(null)}
        tab={selectedTab}
        allItems={allItems}
        tabItemIds={selectedTabItemIds}
        onAddItems={handleAddItemsToRow}
        onCreateProduct={() => setIsCreateOpen(true)}
      />

      <PosCreateProductModal
        isOpen={isCreateOpen}
        sections={categories}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateProduct}
      />

      <PosCreateProductModal
        isOpen={Boolean(editingProduct)}
        product={editingProduct}
        sections={categories}
        onClose={() => setEditingProduct(null)}
        onSave={handleSaveProduct}
      />
    </>
  );
}
