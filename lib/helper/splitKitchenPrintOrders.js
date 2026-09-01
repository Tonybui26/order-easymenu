/**
 * Split a kitchen print order when some lines are marked for takeaway.
 * Regular lines keep the check order type; marked lines print as pick-up dockets.
 */

function isActiveKitchenItem(item) {
  return String(item?.kitchenStatus || "").trim() !== "cancelled";
}

function isMarkedTakeawayItem(item) {
  return item?.isTakeaway === true;
}

/**
 * @returns {object[]} One or more order payloads to print (each with its own items + orderType).
 */
export function splitKitchenPrintOrders(order) {
  if (!order) return [order];

  const activeItems = (order.items || []).filter(isActiveKitchenItem);
  if (activeItems.length === 0) {
    return [{ ...order, items: [] }];
  }

  const takeawayItems = activeItems.filter(isMarkedTakeawayItem);
  if (takeawayItems.length === 0) {
    return [{ ...order, items: activeItems }];
  }

  const regularItems = activeItems.filter((item) => !isMarkedTakeawayItem(item));
  const slices = [];

  if (regularItems.length > 0) {
    slices.push({ ...order, items: regularItems });
  }

  slices.push({
    ...order,
    items: takeawayItems,
    orderType: "pick-up",
  });

  return slices;
}

export function mergeKitchenPrintResults(previous, next) {
  if (!previous) return next || null;
  if (!next) return previous;

  const successfulPrints =
    Number(previous.successfulPrints || 0) + Number(next.successfulPrints || 0);
  const failedPrints =
    Number(previous.failedPrints || 0) + Number(next.failedPrints || 0);
  const totalPrinters =
    Number(previous.totalPrinters || 0) + Number(next.totalPrinters || 0);
  const success = successfulPrints > 0;

  const failedPrinterNames = [previous.failedPrinterNames, next.failedPrinterNames]
    .flatMap((value) =>
      String(value || "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    )
    .filter((name, index, list) => list.indexOf(name) === index)
    .join(", ");

  const successfulPrinterNames = [
    previous.successfulPrinterNames,
    next.successfulPrinterNames,
  ]
    .flatMap((value) =>
      String(value || "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    )
    .filter((name, index, list) => list.indexOf(name) === index)
    .join(", ");

  const failedPrinterErrors = [
    ...(previous.failedPrinterErrors || []),
    ...(next.failedPrinterErrors || []),
  ];

  const unroutedItems = [
    ...(previous.unroutedItems || []),
    ...(next.unroutedItems || []),
  ];
  const backupPrintedItems = [
    ...(previous.backupPrintedItems || []),
    ...(next.backupPrintedItems || []),
  ];

  let message;
  if (success && failedPrints === 0) {
    message =
      totalPrinters > 0
        ? `Order printed successfully to ${successfulPrints}/${totalPrinters} printer(s)!`
        : next.message || previous.message;
  } else if (success) {
    message = `Order printed to ${successfulPrints}/${totalPrinters} printer(s) — ${failedPrinterNames || "some printers"} failed`;
  } else {
    message = next.message || previous.message || "Print failed";
  }

  return {
    success,
    successfulPrints,
    failedPrints,
    totalPrinters,
    successfulPrinterNames,
    failedPrinterNames,
    failedPrinterErrors,
    unroutedItems,
    backupPrintedItems,
    routingPartialFailure:
      Boolean(previous.routingPartialFailure) || Boolean(next.routingPartialFailure),
    backupPartialFailure:
      Boolean(previous.backupPartialFailure) || Boolean(next.backupPartialFailure),
    message,
    afterAutoRetryRound: Math.max(
      Number(previous.afterAutoRetryRound || 0),
      Number(next.afterAutoRetryRound || 0),
    ),
  };
}
