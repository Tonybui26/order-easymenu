import {
  getPreferredPrintName,
  shouldSkipPrintGroupHeader,
} from "../../helper/printNameAlias.js";
import {
  getDocketOrderTypeHeader,
  needsBracketExtractionForMenuLink,
  removeVietnameseDiacritics,
  resolvePrintName,
  wrapText,
} from "../../helper/printerUtils.js";
import { STAR_PRNT, commandsToBase64 } from "./starPrntBytes.js";

/**
 * Creates StarPRNT commands for a simple test message (same role as createEscPosCommands).
 * @param {string} text
 * @returns {string} Base64-encoded StarPRNT command stream
 */
export function createStarPrntCommands(text) {
  const commands = [];

  const addBytes = (bytes) => {
    commands.push(...bytes);
  };

  const addText = (value) => {
    commands.push(...new TextEncoder().encode(value));
  };

  addBytes(STAR_PRNT.INIT);
  addBytes(STAR_PRNT.ALIGN_CENTER);
  addBytes(STAR_PRNT.DOUBLE_ON);
  addText("\n");
  addText(text);
  addText("\n\n");
  addBytes(STAR_PRNT.DOUBLE_OFF);
  addText("\n");
  addText("------------------------------------------\n");
  addBytes(STAR_PRNT.BOLD_ON);
  addText("\npowered by goeasy.menu\n");
  addBytes(STAR_PRNT.BOLD_OFF);
  addText("\n\n\n");
  addBytes(STAR_PRNT.CUT_FULL);

  return commandsToBase64(commands);
}

/**
 * Formats an order receipt using StarPRNT (mC-Print3, mC-Print2, etc.).
 * Layout mirrors formatOrderForPrintingWithESC_POS; only command bytes differ.
 */
export function formatOrderForPrintingWithStarPrnt(
  order,
  orderId,
  menuLink = null,
) {
  const commands = [];
  const needsBracketExtraction = needsBracketExtractionForMenuLink(menuLink);

  const addBytes = (bytes) => {
    if (Array.isArray(bytes)) {
      commands.push(...bytes);
    } else {
      commands.push(bytes);
    }
  };

  const addText = (text) => {
    commands.push(...new TextEncoder().encode(text));
  };

  addBytes(STAR_PRNT.INIT);

  addBytes(STAR_PRNT.ALIGN_CENTER);
  addBytes(STAR_PRNT.DOUBLE_ON);
  addText("\n");
  addText(`#${orderId}\n`);

  addBytes(STAR_PRNT.BOLD_ON);
  const orderType = order.orderType || "";
  addText(getDocketOrderTypeHeader(order));
  addBytes(STAR_PRNT.BOLD_OFF);
  addBytes(STAR_PRNT.DOUBLE_OFF);

  if (orderType === "dine-in") {
    addText(`${new Date(order.createdAt).toLocaleString()}\n`);
    addText("\n------------------------------------------\n\n");
  } else {
    addText(`${new Date(order.createdAt).toLocaleString()}\n`);
    addBytes(STAR_PRNT.ALIGN_LEFT);
    addText(`   For: ${order.customerName} | ${order.customerPhone}\n`);
    addText(`   ${order.customerEmail}\n`);
    addText(`   Time: ${order.pickupTime}\n`);
    if (orderType === "delivery") {
      addText(`   Address: ${order.deliveryAddress}\n`);
    }
    addBytes(STAR_PRNT.ALIGN_CENTER);
    addText("\n------------------------------------------\n\n");
  }

  order.items.forEach((item) => {
    addBytes(STAR_PRNT.BOLD_ON);
    addBytes(STAR_PRNT.DOUBLE_ON);
    addBytes(STAR_PRNT.ALIGN_LEFT);

    const itemName = removeVietnameseDiacritics(
      getPreferredPrintName(item.name),
    );
    const wrappedItemName = wrapText(`${item.quantity} x ${itemName}`, 22);
    wrappedItemName.forEach((line, index) => {
      addText(`${index === 0 ? "" : " "}${line}\n`);
    });
    addBytes(STAR_PRNT.BOLD_OFF);

    if (item.selectedVariants) {
      addBytes(STAR_PRNT.DOUBLE_ON);

      const variantGroups = {};
      item.selectedVariants.forEach((variant) => {
        const rawGroupName = variant.groupName;
        if (!variantGroups[rawGroupName]) {
          variantGroups[rawGroupName] = [];
        }
        const optionName = resolvePrintName(
          variant.optionName,
          needsBracketExtraction,
        );
        variantGroups[rawGroupName].push(optionName);
      });

      Object.entries(variantGroups).forEach(([rawGroupName, options]) => {
        if (!shouldSkipPrintGroupHeader(rawGroupName)) {
          const printGroupName = resolvePrintName(
            rawGroupName,
            needsBracketExtraction,
          );
          addText(` >${printGroupName}:\n`);
        }
        options.forEach((option) => {
          const wrappedOption = wrapText(option, 20);
          wrappedOption.forEach((line, index) => {
            addText(`${index === 0 ? "  -" : "    "}${line}\n`);
          });
        });
      });
    }

    if (item.selectedModifiers) {
      addBytes(STAR_PRNT.DOUBLE_ON);

      const modifierGroups = {};
      item.selectedModifiers.forEach((modifier) => {
        const rawGroupName = modifier.groupName;
        if (!modifierGroups[rawGroupName]) {
          modifierGroups[rawGroupName] = [];
        }
        const optionName = resolvePrintName(
          modifier.optionName,
          needsBracketExtraction,
        );
        modifierGroups[rawGroupName].push(optionName);
      });

      Object.entries(modifierGroups).forEach(([rawGroupName, options]) => {
        if (!shouldSkipPrintGroupHeader(rawGroupName)) {
          const printGroupName = resolvePrintName(
            rawGroupName,
            needsBracketExtraction,
          );
          addText(` >${printGroupName}:\n`);
        }
        options.forEach((option) => {
          const wrappedOption = wrapText(option, 20);
          wrappedOption.forEach((line, index) => {
            addText(`${index === 0 ? "  -" : "    "}${line}\n`);
          });
        });
      });
    }

    addBytes(STAR_PRNT.DOUBLE_OFF);
    addText("\n");
    addBytes(STAR_PRNT.ALIGN_CENTER);
    addText("------------------------------------------\n");
  });

  addBytes(STAR_PRNT.BOLD_ON);
  addText("\npowered by goeasy.menu\n");
  addBytes(STAR_PRNT.BOLD_OFF);
  addText("\n\n\n");
  addBytes(STAR_PRNT.CUT_FULL);

  return commandsToBase64(commands);
}
