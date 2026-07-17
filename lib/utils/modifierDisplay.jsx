/**
 * Shared order-line modifier display: group by `groupName`, list options with optional extra price.
 */

import { getCustomerDisplayName } from "@/lib/helper/printNameAlias";

export function formatModifierPriceSuffix(modifier) {
  const raw =
    modifier?.priceModifier ?? modifier?.price ?? modifier?.extraPrice ?? 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "";
  return ` (+$${n.toFixed(2)})`;
}

/** @returns {Array<[string, Array<Record<string, unknown>>]>} */
export function groupSelectedModifiersByGroupName(selectedModifiers) {
  if (!selectedModifiers?.length) return [];
  const map = new Map();
  for (const m of selectedModifiers) {
    const name = String(m.groupName ?? "Options").trim() || "Options";
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(m);
  }
  return Array.from(map.entries());
}

export function ModifierChoicesGrouped({ modifiers, className }) {
  if (!modifiers?.length) return null;
  const groups = groupSelectedModifiersByGroupName(modifiers);
  return (
    <div className={className ?? "text-sm text-gray-600"}>
      {groups.map(([groupName, options]) => (
        <div key={groupName} className="mt-1 first:mt-0">
          <p className="font-medium">{groupName}:</p>
          <ul className="ml-0 list-none space-y-0.5 pl-0">
            {options.map((mod, i) => (
              <li key={`${String(mod.optionId)}-${i}`}>
                - {getCustomerDisplayName(mod.optionName)}
                {formatModifierPriceSuffix(mod)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
