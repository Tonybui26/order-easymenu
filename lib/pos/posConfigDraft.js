import { resolvePosConfig } from "@/lib/pos/posConfig";

export function posConfigDraftEquals(a, b) {
  const left = resolvePosConfig({ pos: a });
  const right = resolvePosConfig({ pos: b });
  return (
    left.markAllTicketsDeliveredOnPayment ===
      right.markAllTicketsDeliveredOnPayment &&
    left.trainingModeEnabled === right.trainingModeEnabled
  );
}
