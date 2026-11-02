import { cn } from "@/lib/helper";
import { getHeldOrderChannel, getHeldOrderChannelLabel } from "@/lib/pos/posHeldOrder";

const CHANNEL_TONE = {
  pos: "bg-neutral-200 text-neutral-700",
  qr: "bg-violet-100 text-violet-800",
  online: "bg-sky-100 text-sky-800",
};

/** Small channel label shown under the hold timer on Held cards. */
export default function HeldOrderChannelBadge({ order, className }) {
  const channel = getHeldOrderChannel(order);

  return (
    <span
      className={cn(
        "inline-flex w-fit rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        CHANNEL_TONE[channel] || CHANNEL_TONE.qr,
        className,
      )}
    >
      {getHeldOrderChannelLabel(order)}
    </span>
  );
}
