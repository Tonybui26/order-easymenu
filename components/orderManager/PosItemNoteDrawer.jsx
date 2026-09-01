"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/helper";
import SideDrawer from "./SideDrawer";

/** Placeholder presets until store-configured notes list exists. */
const NOTE_PRESETS = [
  "No onion",
  "Extra spicy",
  "Well done",
  "No sauce",
  "Allergy — please check",
];

/**
 * Left-side POS drawer to add / edit a note on a cart line.
 */
export default function PosItemNoteDrawer({
  isOpen,
  onClose,
  onSave,
  itemTitle = "",
  initialNote = "",
  initialIsTakeaway = false,
}) {
  const [note, setNote] = useState("");
  const [isTakeaway, setIsTakeaway] = useState(false);
  const [isNotesListOpen, setIsNotesListOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNote(String(initialNote || ""));
    setIsTakeaway(Boolean(initialIsTakeaway));
    setIsNotesListOpen(false);
  }, [isOpen, initialNote, initialIsTakeaway]);

  function handleDismiss() {
    setIsNotesListOpen(false);
    onClose?.();
  }

  function handleDone() {
    onSave?.({
      note: note.trim(),
      isTakeaway,
    });
    setIsNotesListOpen(false);
    onClose?.();
  }

  function handleClear() {
    setNote("");
  }

  function handleSelectPreset(preset) {
    setNote((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return preset;
      if (trimmed.includes(preset)) return trimmed;
      return `${trimmed}. ${preset}`;
    });
    setIsNotesListOpen(false);
  }

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={handleDismiss}
      title="Add Note"
      subtitle={itemTitle || undefined}
      side="left"
      widthClassName="w-[min(100%,28rem)]"
      contentKey="pos-item-note"
      bodyClassName="p-4"
      ariaLabel="Add note"
      footer={
        <button
          type="button"
          onClick={handleDone}
          className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-[#984B28] text-sm font-semibold text-white transition-colors hover:bg-[#7f3f22] active:bg-[#6e361d]"
        >
          Done
        </button>
      }
    >
      <div className="relative overflow-hidden rounded-lg border border-neutral-300 bg-[#e8e8e8]">
        <label className="sr-only" htmlFor="pos-item-note-input">
          Note
        </label>
        <textarea
          id="pos-item-note-input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onFocus={() => setIsNotesListOpen(false)}
          rows={3}
          placeholder="Type a note for this item…"
          className="max-h-[5.5rem] w-full resize-none overflow-y-auto bg-transparent px-4 py-3 text-base leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-400"
        />

        {isNotesListOpen ? (
          <div className="absolute inset-x-0 bottom-12 z-10 max-h-56 overflow-y-auto border-t border-neutral-300 bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
            {NOTE_PRESETS.length === 0 ? (
              <p className="px-4 py-3 text-sm text-neutral-500">
                No saved notes yet
              </p>
            ) : (
              <ul className="py-1">
                {NOTE_PRESETS.map((preset) => (
                  <li key={preset}>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="flex w-full px-4 py-3 text-left text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100 active:bg-neutral-200"
                    >
                      {preset}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="flex shrink-0 border-t border-neutral-300">
          <button
            type="button"
            aria-expanded={isNotesListOpen}
            aria-haspopup="listbox"
            onClick={() => setIsNotesListOpen((open) => !open)}
            className={cn(
              "flex min-h-[3rem] flex-1 items-center justify-between gap-2 bg-[#d9d9d9] px-4 text-sm font-semibold text-neutral-800 transition-colors hover:bg-[#cfcfcf] active:bg-[#c4c4c4]",
              isNotesListOpen && "bg-[#cfcfcf]",
            )}
          >
            <span>Notes List</span>
            <ChevronDown
              size={16}
              strokeWidth={2.5}
              className={cn(
                "shrink-0 transition-transform",
                isNotesListOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>
          <div className="w-px shrink-0 bg-neutral-400/70" aria-hidden />
          <button
            type="button"
            onClick={handleClear}
            className="min-h-[3rem] shrink-0 bg-[#ececec] px-5 text-sm font-bold uppercase tracking-wide text-neutral-800 transition-colors hover:bg-[#e2e2e2] active:bg-[#d8d8d8]"
          >
            Clear note
          </button>
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-neutral-300 bg-white px-4 py-3">
        <span className="text-base font-semibold uppercase tracking-wide text-neutral-900">
          Mark for Takeaway
        </span>
        <input
          type="checkbox"
          className="toggle toggle-primary toggle-lg shrink-0"
          checked={isTakeaway}
          onChange={(event) => setIsTakeaway(event.target.checked)}
          aria-label="Mark item for takeaway"
        />
      </label>
    </SideDrawer>
  );
}
