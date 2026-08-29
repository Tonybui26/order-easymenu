import { removeVietnameseDiacritics } from "@/lib/helper/printerUtils";

/** Trimmed item note for print payloads, or null when empty. */
export function getItemPrintNote(item) {
  const note = typeof item?.notes === "string" ? item.notes.trim() : "";
  return note || null;
}

/**
 * Kitchen docket note block — matches variant/modifier indentation.
 * @param {{ addText: (text: string) => void, wrapText: (text: string, width: number) => string[], item: object }} ctx
 */
export function appendKitchenDocketItemNote({ addText, wrapText, item }) {
  const note = getItemPrintNote(item);
  if (!note) return;

  const noteText = removeVietnameseDiacritics(note);
  addText(" >Note:\n");
  const wrappedNote = wrapText(noteText, 20);
  wrappedNote.forEach((line, index) => {
    addText(`${index === 0 ? "  -" : "    "}${line}\n`);
  });
}
