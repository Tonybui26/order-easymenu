"use client";

import { useMenuContext } from "@/components/context/MenuContext";
import { textMatchesAvailabilityQuery } from "@/lib/helper/availabilitySearchHelpers";
import {
  filterModifierAvailabilityRows,
  flattenModifierAvailabilityRows,
  modifierRowMatchesQuery,
} from "@/lib/helper/modifierAvailabilityHelpers";
import { useMemo, useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import toast from "react-hot-toast";

const MODIFIERS_SECTION_ID = "__modifiers__";
const SOLD_OUT_SECTION_ID = "__sold_out__";

function sectionHasVisibleItems(section) {
  return (section.items || []).some((item) => item.available !== false);
}

function itemMatchesQuery(item, q) {
  return textMatchesAvailabilityQuery(item.title, q);
}

export default function PanelProductAvailability() {
  const {
    menuContent,
    globalModifiers,
    globalVariants,
    dataLoaded,
    patchItemSoldOut,
    patchModifierOptionAvailable,
  } = useMenuContext();
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalItem, setModalItem] = useState(null);
  const [modalModifier, setModalModifier] = useState(null);
  const [draftSoldOut, setDraftSoldOut] = useState(false);
  const [saving, setSaving] = useState(false);

  const sections = useMemo(
    () => (menuContent || []).filter(sectionHasVisibleItems),
    [menuContent],
  );

  const modifierRows = useMemo(
    () => flattenModifierAvailabilityRows(globalVariants, globalModifiers),
    [globalVariants, globalModifiers],
  );

  const isModifiersSelected = selectedSectionId === MODIFIERS_SECTION_ID;
  const isSoldOutSelected = selectedSectionId === SOLD_OUT_SECTION_ID;

  const soldOutProducts = useMemo(() => {
    const rows = [];
    const seenItemIds = new Set();
    for (const section of menuContent || []) {
      for (const item of section.items || []) {
        if (item.available === false || item.soldOut !== true) continue;
        if (seenItemIds.has(item.id)) continue;
        seenItemIds.add(item.id);
        rows.push({ section, item });
      }
    }
    return rows;
  }, [menuContent]);

  const soldOutModifiers = useMemo(
    () => modifierRows.filter((row) => row.available === false),
    [modifierRows],
  );

  const soldOutCount = soldOutProducts.length + soldOutModifiers.length;

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === selectedSectionId) || null,
    [sections, selectedSectionId],
  );

  const trimmedSearch = searchQuery.trim();
  const isSearchActive = trimmedSearch.length > 0;

  const searchResults = useMemo(() => {
    if (!isSearchActive) return [];
    const rows = [];
    for (const section of sections) {
      for (const item of section.items || []) {
        if (item.available === false) continue;
        if (!itemMatchesQuery(item, trimmedSearch)) continue;
        rows.push({ section, item });
      }
    }
    return rows;
  }, [sections, trimmedSearch, isSearchActive]);

  const modifierSearchResults = useMemo(() => {
    if (!isSearchActive) return [];
    return modifierRows.filter((row) =>
      modifierRowMatchesQuery(row, trimmedSearch),
    );
  }, [modifierRows, trimmedSearch, isSearchActive]);

  const visibleSoldOutProducts = useMemo(() => {
    if (!isSoldOutSelected) return soldOutProducts;
    if (!trimmedSearch) return soldOutProducts;
    return soldOutProducts.filter(({ item }) =>
      itemMatchesQuery(item, trimmedSearch),
    );
  }, [isSoldOutSelected, soldOutProducts, trimmedSearch]);

  const visibleSoldOutModifiers = useMemo(() => {
    if (!isSoldOutSelected) return soldOutModifiers;
    if (!trimmedSearch) return soldOutModifiers;
    return soldOutModifiers.filter((row) =>
      modifierRowMatchesQuery(row, trimmedSearch),
    );
  }, [isSoldOutSelected, soldOutModifiers, trimmedSearch]);

  const visibleItems = useMemo(() => {
    if (!selectedSection) return [];
    return (selectedSection.items || []).filter(
      (item) => item.available !== false,
    );
  }, [selectedSection]);

  const visibleModifiers = useMemo(() => {
    if (!isModifiersSelected) return [];
    return filterModifierAvailabilityRows(modifierRows, trimmedSearch);
  }, [isModifiersSelected, modifierRows, trimmedSearch]);

  const openProductModal = useCallback((item) => {
    setModalModifier(null);
    setModalItem(item);
    setDraftSoldOut(item.soldOut === true);
  }, []);

  const openModifierModal = useCallback((row) => {
    setModalItem(null);
    setModalModifier(row);
    setDraftSoldOut(row.available === false);
  }, []);

  const closeModal = useCallback(() => {
    setModalItem(null);
    setModalModifier(null);
    setDraftSoldOut(false);
  }, []);

  const isProductDirty =
    modalItem != null && draftSoldOut !== (modalItem.soldOut === true);
  const isModifierDirty =
    modalModifier != null &&
    draftSoldOut !== (modalModifier.available === false);
  const isDirty = isProductDirty || isModifierDirty;

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);

    let result;
    if (modalItem) {
      result = await patchItemSoldOut(modalItem.id, draftSoldOut);
    } else if (modalModifier) {
      result = await patchModifierOptionAvailable(
        modalModifier.sourceType,
        modalModifier.groupKey,
        modalModifier.optionId,
        !draftSoldOut,
      );
    } else {
      setSaving(false);
      return;
    }

    setSaving(false);
    if (!result.success) {
      toast.error(
        result.error?.message ||
          (typeof result.error === "string" ? result.error : null) ||
          "Could not save. Check your connection.",
      );
      return;
    }
    toast.success("Saved");
    closeModal();
  };

  function renderSoldOutContent() {
    const hasProducts = visibleSoldOutProducts.length > 0;
    const hasModifiers = visibleSoldOutModifiers.length > 0;

    if (!hasProducts && !hasModifiers) {
      return (
        <p className="text-sm text-neutral-500">
          {soldOutCount === 0
            ? "Nothing is marked sold out right now."
            : "No sold out items match your search."}
        </p>
      );
    }

    return (
      <div className="space-y-6">
        {hasProducts ? (
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Products
            </h4>
            {renderItemGrid(
              visibleSoldOutProducts,
              (entry) => `${entry.section.id}-${entry.item.id}`,
            )}
          </div>
        ) : null}
        {hasModifiers ? (
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Modifiers
            </h4>
            {renderModifierGrid(visibleSoldOutModifiers)}
          </div>
        ) : null}
      </div>
    );
  }

  function renderItemGrid(items, getKey) {
    if (items.length === 0) return null;
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((entry) => {
          const item = "item" in entry ? entry.item : entry;
          const soldOut = item.soldOut === true;
          return (
            <button
              key={getKey(entry, item)}
              type="button"
              onClick={() => openProductModal(item)}
              className="group flex flex-col overflow-hidden rounded-2xl bg-neutral-900 text-left transition"
            >
              <div className="relative aspect-square w-full bg-neutral-800">
                {item.PhotoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.PhotoSrc}
                    alt=""
                    className={`h-full w-full object-cover ${soldOut ? "opacity-40 grayscale" : ""}`}
                  />
                ) : (
                  <div
                    className={`flex h-full w-full items-center justify-center text-xs text-neutral-500 ${soldOut ? "opacity-50" : ""}`}
                  >
                    No image
                  </div>
                )}
                {soldOut ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <span className="rounded-full bg-black/40 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-red-500 sm:text-base">
                      Out of stock
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="border-t border-neutral-800 bg-neutral-900 px-2 py-2.5">
                <p className="line-clamp-2 text-center text-sm font-medium text-white sm:text-lg">
                  {item.title}
                </p>
                {"item" in entry && "section" in entry ? (
                  <p className="mt-1 line-clamp-1 text-center text-xs text-neutral-500">
                    {entry.section.sectionTitle}
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  function renderModifierGrid(rows) {
    if (rows.length === 0) return null;
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {rows.map((row) => {
          const soldOut = row.available === false;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => openModifierModal(row)}
              className="group flex flex-col overflow-hidden rounded-2xl bg-neutral-900 text-left transition"
            >
              <div className="relative flex aspect-square w-full items-center justify-center bg-neutral-800 px-3">
                <div
                  className={`text-center ${soldOut ? "opacity-40 grayscale" : ""}`}
                >
                  <p className="line-clamp-3 text-sm font-semibold text-white sm:text-base">
                    {row.optionName}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                    {row.typeLabel} · {row.groupName}
                  </p>
                </div>
                {soldOut ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <span className="rounded-full bg-black/40 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-red-500 sm:text-sm">
                      Out of stock
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="border-t border-neutral-800 bg-neutral-900 px-2 py-2.5">
                <p className="line-clamp-2 text-center text-sm font-medium text-white">
                  {row.optionName}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  if (!dataLoaded) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900/40 p-8">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-brand_accent" />
          <p className="mt-3 text-sm text-neutral-400">Loading menu…</p>
        </div>
      </div>
    );
  }

  const modalOpen = modalItem != null || modalModifier != null;
  const modalTitle = modalItem?.title || modalModifier?.optionName || "";
  const modalSubtitle = modalModifier
    ? `${modalModifier.typeLabel} · ${modalModifier.groupName}`
    : null;

  return (
    <div className="flex min-h-[min(70vh,560px)] flex-col overflow-hidden rounded-xl bg-black/40 md:flex-row">
      <aside className="flex max-h-[40vh] shrink-0 flex-col border-b border-transparent bg-neutral-700 md:max-h-none md:w-56 md:border-b-0 md:border-r lg:w-64">
        <div className="shrink-0 border-b border-neutral-600/80 p-2">
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-neutral-400" />
            <input
              type="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products & modifiers…"
              autoComplete="off"
              className="input input-md w-full rounded-lg border-2 border-neutral-600 bg-neutral-800 pl-9 pr-8 text-base text-white placeholder:text-neutral-500 focus:border-brand_accent/70 focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-1.5 rounded-md p-1 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          <button
            type="button"
            onClick={() => {
              setSelectedSectionId(SOLD_OUT_SECTION_ID);
              setSearchQuery("");
            }}
            className={`flex items-center justify-between gap-2 rounded-lg px-3 py-4 text-left text-base font-semibold transition-colors sm:text-lg ${
              isSoldOutSelected && !isSearchActive
                ? "bg-neutral-800 text-red-400"
                : "text-red-400 hover:bg-neutral-800"
            }`}
          >
            <span className="truncate">Sold Out Items</span>
            {soldOutCount > 0 ? (
              <span className="badge badge-sm shrink-0 border-none bg-red-500 text-white">
                {soldOutCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedSectionId(MODIFIERS_SECTION_ID);
              setSearchQuery("");
            }}
            className={`truncate whitespace-nowrap rounded-lg px-3 py-4 text-left text-base font-semibold transition-colors sm:text-lg ${
              isModifiersSelected && !isSearchActive
                ? "bg-brand_accent/20 text-brand_accent"
                : "text-neutral-200 hover:bg-neutral-800"
            }`}
          >
            Modifiers
          </button>
          {sections.length === 0 ? (
            <p className="px-2 py-4 text-sm text-neutral-500">
              No menu sections with visible items.
            </p>
          ) : (
            sections.map((section) => {
              const active = section.id === selectedSectionId;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setSelectedSectionId(section.id);
                    setSearchQuery("");
                  }}
                  className={`truncate whitespace-nowrap rounded-lg px-3 py-4 text-left text-base font-semibold transition-colors sm:text-lg ${
                    active && !isSearchActive
                      ? "bg-brand_accent/20 text-brand_accent"
                      : "text-neutral-200 hover:bg-neutral-800"
                  }`}
                >
                  {section.sectionTitle}
                </button>
              );
            })
          )}
        </nav>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col bg-neutral-950/50">
        {isSearchActive ? (
          <div className="flex flex-1 flex-col overflow-hidden p-4 md:p-6">
            <h3 className="mb-1 shrink-0 text-base font-semibold text-white md:text-lg">
              Search results
            </h3>
            <p className="mb-4 shrink-0 text-sm text-neutral-500">
              {searchResults.length === 0 && modifierSearchResults.length === 0
                ? `No items match “${trimmedSearch}”.`
                : [
                    searchResults.length > 0
                      ? `${searchResults.length} product${searchResults.length === 1 ? "" : "s"}`
                      : null,
                    modifierSearchResults.length > 0
                      ? `${modifierSearchResults.length} modifier${modifierSearchResults.length === 1 ? "" : "s"}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}{" "}
              matching “{trimmedSearch}”.
            </p>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
              {searchResults.length > 0 ? (
                <div>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
                    Products
                  </h4>
                  {renderItemGrid(
                    searchResults,
                    (entry) => `${entry.section.id}-${entry.item.id}`,
                  )}
                </div>
              ) : null}
              {modifierSearchResults.length > 0 ? (
                <div>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
                    Modifiers
                  </h4>
                  {renderModifierGrid(modifierSearchResults)}
                </div>
              ) : null}
            </div>
          </div>
        ) : !selectedSectionId ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <p className="text-lg font-medium text-neutral-200">
                Select a category
              </p>
              <p className="mt-2 max-w-sm text-sm text-neutral-500">
                Choose Sold Out Items, Modifiers, or a category on the left, or use
                search above to find a product or modifier option.
              </p>
            </div>
          </div>
        ) : isSoldOutSelected ? (
          <div className="flex flex-1 flex-col overflow-hidden p-4 md:p-6">
            <div className="mb-4 shrink-0">
              <h3 className="text-base font-semibold text-white md:text-lg">
                Sold Out Items
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                {soldOutCount === 0
                  ? "All products and modifiers are available."
                  : `${soldOutCount} item${soldOutCount === 1 ? "" : "s"} currently marked sold out.`}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {renderSoldOutContent()}
            </div>
          </div>
        ) : isModifiersSelected ? (
          <div className="flex flex-1 flex-col overflow-hidden p-4 md:p-6">
            <h3 className="mb-4 shrink-0 text-base font-semibold text-white md:text-lg">
              Modifiers
            </h3>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {visibleModifiers.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  {modifierRows.length === 0
                    ? "No modifier or variant options yet."
                    : "No options match your search."}
                </p>
              ) : (
                renderModifierGrid(visibleModifiers)
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden p-4 md:p-6">
            <h3 className="mb-4 shrink-0 text-base font-semibold text-white md:text-lg">
              {selectedSection?.sectionTitle}
            </h3>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {visibleItems.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No visible items in this category.
                </p>
              ) : (
                renderItemGrid(visibleItems, (_entry, item) => item.id)
              )}
            </div>
          </div>
        )}
      </div>

      <dialog className={`modal ${modalOpen ? "modal-open" : ""}`}>
        <div className="modal-box max-w-md border border-neutral-200 bg-white text-gray-900">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold leading-snug">{modalTitle}</h3>
              {modalSubtitle ? (
                <p className="mt-1 text-sm text-gray-500">{modalSubtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="btn btn-circle btn-ghost btn-sm shrink-0"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-5">
            <span className="text-base font-semibold">Sold out</span>
            <input
              type="checkbox"
              className="toggle toggle-error"
              checked={draftSoldOut}
              onChange={(e) => setDraftSoldOut(e.target.checked)}
            />
          </label>

          <div className="modal-action mt-6">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeModal}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary btn border-none"
              onClick={handleSave}
              disabled={!isDirty || saving}
            >
              {saving ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop" onClick={closeModal}>
          <button type="button">close</button>
        </form>
      </dialog>
    </div>
  );
}
