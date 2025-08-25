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
      className={`relative flex min-w-24 flex-col items-center justify-start gap-1 rounded-xl border-2 px-1 py-1 transition-all duration-200 ${
        isActive
          ? "border-brand_accent bg-brand_accent/5 text-brand_accent shadow-lg"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 hover:shadow-md"
      }`}
    >
      <Icon
        className={`absolute bottom-1 left-1 hidden size-[16px] ${isActive ? "text-brand_accent" : "text-gray-500"}`}
      />
      <span className="text-sm font-medium">{label}</span>
      <span
        className={`flex size-7 items-center justify-center rounded-full px-2 py-1 text-sm font-bold ${
          isActive ? "bg-brand_accent text-white" : "bg-gray-100 text-gray-600"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
