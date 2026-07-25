"use client";

import { cn } from "@/lib/helper";
import {
  getEnabledModifierOptions,
  isVariantOptionInStock,
  modifierLimits,
} from "@/lib/pos/itemCustomization";

/**
 * Variant / modifier selection grid shown in the POS product panel.
 * Selected tiles use a thick black border + shadow (see design reference).
 */
export default function PosItemCustomizePanel({
  item,
  globalModifiers = {},
  globalVariants = {},
  selectedVariants = {},
  selectedModifiers = {},
  onSelectVariant,
  onToggleModifier,
}) {
  if (!item) return null;

  const variantGroups = (item.variants || []).filter(
    (group) => item.hasVariants && (group.options || []).length > 0,
  );

  const modifierGroups = (item.modifierGroups || []).filter((group) => {
    const globalGroup = globalModifiers[group.useGlobal];
    return getEnabledModifierOptions(group, globalGroup).length > 0;
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#f0f0f0] p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-neutral-900">
          {item.title || "Customize"}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Edit options, or tap a tab to go back
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {variantGroups.map((variant) => {
          const options = (variant.options || []).filter((opt) =>
            isVariantOptionInStock(opt.id, variant.groupId, globalVariants),
          );
          if (options.length === 0) return null;

          return (
            <section key={variant.groupId || variant.groupName}>
              <h3 className="mb-3 text-sm font-medium text-neutral-500">
                {variant.groupName}
              </h3>
              <div className="flex flex-wrap gap-3">
                {options.map((option) => {
                  const isSelected =
                    selectedVariants[variant.groupId] === option.id;
                  return (
                    <OptionTile
                      key={option.id}
                      label={option.name}
                      isSelected={isSelected}
                      onClick={() =>
                        onSelectVariant?.(variant.groupId, option.id)
                      }
                    />
                  );
                })}
              </div>
            </section>
          );
        })}

        {modifierGroups.map((modifierGroup) => {
          const globalGroup = globalModifiers[modifierGroup.useGlobal];
          const options = getEnabledModifierOptions(modifierGroup, globalGroup);
          if (options.length === 0) return null;

          const { maxSelection } = modifierLimits(globalGroup, modifierGroup);
          const selectedIds =
            selectedModifiers[modifierGroup.useGlobal] || [];

          return (
            <section key={modifierGroup.useGlobal || modifierGroup.groupName}>
              <h3 className="mb-3 text-sm font-medium text-neutral-500">
                {modifierGroup.groupName || globalGroup?.groupName}
              </h3>
              <div className="flex flex-wrap gap-3">
                {options.map((option) => {
                  const isSelected = selectedIds.includes(option.id);
                  return (
                    <OptionTile
                      key={option.id}
                      label={option.name}
                      isSelected={isSelected}
                      onClick={() =>
                        onToggleModifier?.(
                          modifierGroup.useGlobal,
                          option.id,
                          maxSelection,
                        )
                      }
                    />
                  );
                })}
              </div>
            </section>
          );
        })}

        {variantGroups.length === 0 && modifierGroups.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No options available for this item.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function OptionTile({ label, isSelected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex size-[6.5rem] items-center justify-center bg-white px-2 text-center text-sm font-semibold leading-snug text-neutral-900 transition-shadow sm:size-28 sm:text-base",
        isSelected
          ? "border-[3px] border-black shadow-[4px_4px_0_0_rgba(0,0,0,0.35)]"
          : "border-[3px] border-transparent shadow-none",
      )}
    >
      <span className="line-clamp-3">{label}</span>
    </button>
  );
}
