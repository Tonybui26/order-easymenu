import { LucideIcon } from "lucide-react";

export default function ViewModeTab({
  icon: Icon,
  label,
  count,
  isActive,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex min-w-24 flex-col items-center justify-start gap-1 rounded-xl px-1 py-1 pb-2 transition-all duration-200 ${
        isActive
          ? "bg-neutral-700 text-brand_accent shadow-lg"
          : "bg-transparent text-gray-600 hover:border-gray-300 hover:bg-neutral-700 hover:text-gray-700 hover:shadow-md"
      }`}
    >
      <Icon
        className={`absolute bottom-1 left-1 hidden size-[16px] ${isActive ? "text-brand_accent" : "text-gray-500"}`}
      />
      <span
        className={`text-sm font-medium ${
          isActive ? "text-white" : "text-gray-600"
        }`}
      >
        {label}
      </span>
      <span
        className={`flex size-7 items-center justify-center rounded-full px-2 py-1 text-sm font-bold ${
          isActive
            ? "bg-brand_accent text-white"
            : "bg-transparent text-gray-600"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
