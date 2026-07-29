import toast from "react-hot-toast";
import { checkPrinterAvailability, logPrintError } from "@/lib/api/fetchApi";
import { printOrderQueued } from "@/lib/helper/printerUtilsNew";
import {
  planPrintJobsByGroup,
  planPrintJobsWithRouting,
  buildUnroutedPrintMessage,
  buildBackupPrintMessage,
} from "@/lib/helper/printerGroupRouting";
import { getPlatform } from "@/lib/helper/platformDetection";

const PRINT_RETRY_DELAY_MS = 3000;
const PRINT_MAX_RETRIES = 2;

function getPrinterJobErrorMessage(result) {
  const specificError = Array.isArray(result?.failedPrinterErrors)
    ? result.failedPrinterErrors[0]?.error
    : null;

  if (specificError) return specificError;

  return result?.message || "Unknown error";
}

export function buildPrintErrorMessage(result) {
  let errorMessage = result?.message || "Print failed";
  if (result?.failedPrinterErrors && result.failedPrinterErrors.length > 0) {
    const errorDetails = result.failedPrinterErrors
      .map((err) => `${err.printerName}: ${err.error}`)
      .join("; ");
    errorMessage += ` - ${errorDetails}`;
  } else if (result?.error) {
    errorMessage += ` - ${result.error}`;
  }
  return errorMessage;
}

function getOrderShortId(order) {
  const orderId = order?._id ? String(order._id) : "";
  return orderId.slice(-6).toUpperCase();
}

/** Short staff-facing print error (detailed context stays in server logs). */
export function buildSimpleUserPrintErrorToast(
  order,
  printerLabel = "Printer",
  suffix = "",
) {
  const base = `${printerLabel}: print failed for order #${getOrderShortId(order)}`;
  return suffix ? `${base}, ${suffix}` : base;
}

function buildEmptyPrintPlanUserToast(order, printers) {
  return buildSimpleUserPrintErrorToast(
    order,
    getPrinterLabelFromList(printers),
    "can not find routed printers",
  );
}

function buildUnroutedItemsUserToast(order, unroutedItems) {
  const itemNames = unroutedItems
    .map((item) => item?.name || "Unknown item")
    .join(", ");
  const routingSuffix =
    unroutedItems.length === 1
      ? `${itemNames} can not find its routed printer`
      : `${itemNames} can not find their routed printers`;

  return buildSimpleUserPrintErrorToast(order, "Printer", routingSuffix);
}

function getFailedPrinterLabelFromResult(result) {
  if (
    Array.isArray(result?.failedPrinterErrors) &&
    result.failedPrinterErrors.length > 0
  ) {
    const names = result.failedPrinterErrors
      .map((err) => err?.printerName || err?.name)
      .filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }

  if (result?.failedPrinterNames) {
    const names = result.failedPrinterNames
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }

  return "Printer";
}

function getPrinterLabelFromList(printers) {
  if (!Array.isArray(printers) || printers.length === 0) return "Printer";
  const names = printers.map((printer) => printer?.name).filter(Boolean);
  return names.length > 0 ? names.join(", ") : "Printer";
}

/** Context for staff-initiated toast retry (TCP failures only). */
export function buildPrintRetryContext(order, result, printersToUse, source) {
  const failedNames = new Set();

  if (Array.isArray(result?.failedPrinterErrors)) {
    for (const err of result.failedPrinterErrors) {
      const name = err?.printerName || err?.name;
      if (name && name !== "routing") failedNames.add(name);
    }
  }

  if (failedNames.size === 0 && result?.failedPrinterNames) {
    result.failedPrinterNames
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((name) => failedNames.add(name));
  }

  if (failedNames.size === 0 || !Array.isArray(printersToUse)) {
    return null;
  }

  const failedPrinters = printersToUse.filter((printer) =>
    failedNames.has(printer.name),
  );

  if (failedPrinters.length === 0) return null;

  return {
    order,
    failedPrinters,
    source,
  };
}

function showPrintErrorToast(showCustomToast, message, retryContext) {
  if (typeof showCustomToast !== "function") return;
  showCustomToast(message, "error", retryContext ?? null);
}

function buildEarlyPrintFailureResult(message) {
  return {
    success: false,
    message,
    failedPrints: 1,
    successfulPrints: 0,
    totalPrinters: 0,
    failedPrinterErrors: [],
  };
}

function buildPrintSuccessMessage(
  successfulPrints,
  totalPrinters,
  afterAutoRetryRound = 0,
) {
  const base = `Order printed successfully to ${successfulPrints}/${totalPrinters} printer(s)`;
  if (afterAutoRetryRound > 0) {
    return `${base} after retry ${afterAutoRetryRound}!`;
  }
  return `${base}!`;
}

function reportPrintEvent(
  order,
  result,
  { type = "print_error", attempt = "final", source = "manual" } = {},
) {
  if (order?.isTraining) return;

  const orderId = order?._id ? String(order._id) : "";
  if (!orderId) return;

  const failedPrinters = Array.isArray(result?.failedPrinterErrors)
    ? result.failedPrinterErrors.map((err) => ({
        name: err?.printerName || err?.name || "",
        error: err?.error || "",
      }))
    : [];

  logPrintError({
    type,
    orderId,
    orderShortId: orderId.slice(-6),
    message:
      result?.message ||
      result?.error ||
      (type === "print_success" ? "Print succeeded" : "Print failed"),
    failedPrinters,
    successfulPrints: result?.successfulPrints ?? 0,
    failedPrints: result?.failedPrints ?? failedPrinters.length,
    totalPrinters: result?.totalPrinters ?? 0,
    attempt,
    source,
    platform: getPlatform(),
  }).catch(() => {});
}

function reportPrintFailure(
  order,
  result,
  attempt = "final",
  source = "manual",
) {
  reportPrintEvent(order, result, { type: "print_error", attempt, source });
}

function reportPrintSuccess(order, result, source = "manual") {
  reportPrintEvent(order, result, {
    type: "print_success",
    attempt: "final",
    source,
  });
}

function applyPrintFailureFeedback(
  order,
  result,
  {
    showCustomToast,
    attempt = "final",
    notify = true,
    source = "manual",
    printerLabel,
    userToastMessage,
    printersToUse = null,
    allowRetry = false,
    retryContext = undefined,
  } = {},
) {
  if (notify && typeof showCustomToast === "function") {
    const label = printerLabel ?? getFailedPrinterLabelFromResult(result);
    const retry =
      retryContext !== undefined
        ? retryContext
        : allowRetry
          ? buildPrintRetryContext(order, result, printersToUse, source)
          : null;
    showPrintErrorToast(
      showCustomToast,
      userToastMessage ?? buildSimpleUserPrintErrorToast(order, label),
      retry,
    );
  }
  reportPrintFailure(order, result, attempt, source);
}

function inferPrinterOrderType(order) {
  const canonical = String(order?.orderType ?? "").trim();
  const isDineIn =
    canonical === "dine-in" || (order.table && order.table !== "takeaway");
  return isDineIn ? "dinein" : "takeaway";
}

/**
 * Route and print a kitchen order to configured printers (group routing, retries).
 * Used by Live Orders and POS Send — independent of menuConfig.autoPrinting.
 */
export async function printKitchenOrder(
  order,
  {
    storeProfile,
    itemGroups = [],
    selectedPrinters = null,
    retryCount = 0,
    source = "manual",
    notify = true,
    notifySuccess = notify,
    showCustomToast = null,
    silentNoPrinters = false,
  } = {},
) {
  try {
    const orderType = inferPrinterOrderType(order);

    let printersToUse = selectedPrinters;
    const isIntentionalPrinterSelection =
      Array.isArray(selectedPrinters) && selectedPrinters.length > 0;

    if (!printersToUse || printersToUse.length === 0) {
      const printersAvailability = await checkPrinterAvailability(orderType);

      if (!printersAvailability.available) {
        const earlyResult = buildEarlyPrintFailureResult(
          "No printers available",
        );
        if (!silentNoPrinters) {
          applyPrintFailureFeedback(order, earlyResult, {
            showCustomToast,
            attempt: "early_return",
            notify,
            source,
            printersToUse,
          });
        }
        return earlyResult;
      }

      printersToUse = printersAvailability.printers;
    }

    if (printersToUse && printersToUse.length > 0) {
      const {
        plan: printPlan,
        unroutedItems,
        backupPrintedItems,
        routingActive,
        itemToGroups,
      } = planPrintJobsWithRouting(order, printersToUse, itemGroups);
      const orderId = order._id.slice(-6).toUpperCase();
      const menuLink = storeProfile?.menuLink || null;

      if (
        !isIntentionalPrinterSelection &&
        routingActive &&
        backupPrintedItems.length > 0
      ) {
        console.warn(
          "[printerGroupRouting] Backup-printed items:",
          backupPrintedItems.map((item) => item?.name),
        );
      }
      if (
        !isIntentionalPrinterSelection &&
        routingActive &&
        unroutedItems.length > 0
      ) {
        console.warn(
          "[printerGroupRouting] Unrouted items:",
          unroutedItems.map((item) => item?.name),
        );
      }

      if (printPlan.length === 0) {
        const earlyMessage = isIntentionalPrinterSelection
          ? "No items for the selected printer (group filters)"
          : "No printers want any item from this order (group filters)";
        const earlyResult = buildEarlyPrintFailureResult(earlyMessage);
        applyPrintFailureFeedback(order, earlyResult, {
          showCustomToast,
          attempt: "early_return",
          notify,
          source,
          userToastMessage: buildEmptyPrintPlanUserToast(order, printersToUse),
          printersToUse,
        });
        return earlyResult;
      }

      const perPrinterResults = [];
      for (const { printer, items } of printPlan) {
        const printData = {
          order: { ...order, items },
          orderId,
          printers: [printer],
          menuLink,
        };
        const result = await printOrderQueued(printData, {
          delayAfterDisconnect: 300,
        });
        perPrinterResults.push({ printer, result });
      }

      const successfulPrinterNames = [];
      const failedPrinterNames = [];
      const failedPrinterErrors = [];
      for (const { printer, result } of perPrinterResults) {
        if (result.success && (result.failedPrints || 0) === 0) {
          successfulPrinterNames.push(printer.name);
        } else {
          failedPrinterNames.push(printer.name);
          failedPrinterErrors.push({
            printerName: printer.name,
            error: getPrinterJobErrorMessage(result),
          });
        }
      }

      const totalPrinters = perPrinterResults.length;
      const successfulPrints = successfulPrinterNames.length;
      const failedPrints = totalPrinters - successfulPrints;
      const printResult = {
        success: successfulPrints > 0,
        successfulPrints,
        failedPrints,
        totalPrinters,
        successfulPrinterNames: successfulPrinterNames.join(", "),
        failedPrinterNames: failedPrinterNames.join(", "),
        failedPrinterErrors,
        routingPartialFailure:
          !isIntentionalPrinterSelection &&
          routingActive &&
          unroutedItems.length > 0,
        unroutedItems:
          !isIntentionalPrinterSelection && routingActive ? unroutedItems : [],
        backupPartialFailure:
          !isIntentionalPrinterSelection &&
          routingActive &&
          backupPrintedItems.length > 0,
        backupPrintedItems:
          !isIntentionalPrinterSelection && routingActive
            ? backupPrintedItems
            : [],
        message:
          successfulPrints === totalPrinters
            ? buildPrintSuccessMessage(successfulPrints, totalPrinters, 0)
            : successfulPrints > 0
              ? `Order printed to ${successfulPrints}/${totalPrinters} printer(s) — ${failedPrinterNames.join(", ")} failed`
              : `Print failed — Could not print to any of the printers`,
        afterAutoRetryRound: 0,
      };

      let finalResult = printResult;
      if (retryCount === 0) {
        for (
          let retryRound = 1;
          retryRound <= PRINT_MAX_RETRIES &&
          (finalResult.failedPrints > 0 || !finalResult.success);
          retryRound++
        ) {
          const failedPrinterNamesSet = new Set();
          if (finalResult.failedPrinterErrors) {
            finalResult.failedPrinterErrors.forEach((err) => {
              failedPrinterNamesSet.add(err.printerName);
            });
          } else if (finalResult.failedPrinterNames) {
            finalResult.failedPrinterNames
              .split(",")
              .map((name) => name.trim())
              .forEach((name) => failedPrinterNamesSet.add(name));
          }

          const failedPrinters = printersToUse.filter((printer) =>
            failedPrinterNamesSet.has(printer.name),
          );
          if (failedPrinters.length === 0) break;

          await new Promise((resolve) =>
            setTimeout(resolve, PRINT_RETRY_DELAY_MS),
          );

          const retryPlan = planPrintJobsByGroup(
            order,
            failedPrinters,
            itemGroups,
          );

          const retryPerPrinterResults = [];
          for (const { printer, items } of retryPlan) {
            const retryPrintData = {
              order: { ...order, items },
              orderId,
              printers: [printer],
              menuLink,
            };
            const r = await printOrderQueued(retryPrintData, {
              delayAfterDisconnect: 300,
            });
            retryPerPrinterResults.push({ printer, result: r });
          }

          const retrySuccessNamesArr = [];
          const retryFailedNamesArr = [];
          const retryFailedErrors = [];
          for (const { printer, result: r } of retryPerPrinterResults) {
            if (r.success && (r.failedPrints || 0) === 0) {
              retrySuccessNamesArr.push(printer.name);
            } else {
              retryFailedNamesArr.push(printer.name);
              retryFailedErrors.push({
                printerName: printer.name,
                error: getPrinterJobErrorMessage(r),
              });
            }
          }

          const priorSuccessNames = finalResult.successfulPrinterNames
            ? finalResult.successfulPrinterNames.split(", ").filter(Boolean)
            : [];
          const allSuccessNames = [
            ...priorSuccessNames,
            ...retrySuccessNamesArr,
          ];
          const totalPrintersCount =
            finalResult.totalPrinters || printPlan.length;
          const totalSuccessful = allSuccessNames.length;
          const totalFailed = totalPrintersCount - totalSuccessful;
          const fullSuccess = totalFailed === 0 && totalSuccessful > 0;
          const afterAutoRetryRound = fullSuccess ? retryRound : 0;

          finalResult = {
            success: totalSuccessful > 0,
            successfulPrints: totalSuccessful,
            failedPrints: totalFailed,
            totalPrinters: totalPrintersCount,
            failedPrinterNames: retryFailedNamesArr.join(", "),
            failedPrinterErrors: retryFailedErrors,
            successfulPrinterNames: allSuccessNames.join(", "),
            routingPartialFailure: printResult.routingPartialFailure,
            unroutedItems: printResult.unroutedItems,
            backupPartialFailure: printResult.backupPartialFailure,
            backupPrintedItems: printResult.backupPrintedItems,
            afterAutoRetryRound,
            message: fullSuccess
              ? buildPrintSuccessMessage(
                  totalSuccessful,
                  totalPrintersCount,
                  afterAutoRetryRound,
                )
              : totalSuccessful > 0
                ? `Order printed to ${totalSuccessful}/${totalPrintersCount} printer(s) — ${retryFailedNamesArr.join(", ")} failed`
                : printResult.message,
          };
        }
      }

      if (finalResult.success) {
        if (notifySuccess) {
          toast.success(finalResult.message);
        }
        if (finalResult.failedPrints > 0) {
          if (notify && typeof showCustomToast === "function") {
            showPrintErrorToast(
              showCustomToast,
              buildSimpleUserPrintErrorToast(
                order,
                getFailedPrinterLabelFromResult(finalResult),
              ),
              buildPrintRetryContext(order, finalResult, printersToUse, source),
            );
          }
          reportPrintFailure(order, finalResult, "final", source);
        } else if (finalResult.successfulPrints > 0) {
          reportPrintSuccess(order, finalResult, source);
        }
      } else {
        applyPrintFailureFeedback(order, finalResult, {
          showCustomToast,
          attempt: "final",
          notify,
          source,
          printersToUse,
          allowRetry: true,
        });
      }

      if (notify) {
        if (
          !isIntentionalPrinterSelection &&
          routingActive &&
          backupPrintedItems.length > 0 &&
          typeof showCustomToast === "function"
        ) {
          showCustomToast(
            buildBackupPrintMessage(
              backupPrintedItems,
              itemToGroups,
              itemGroups,
            ),
            "error",
          );
        }

        if (
          !isIntentionalPrinterSelection &&
          routingActive &&
          unroutedItems.length > 0 &&
          typeof showCustomToast === "function"
        ) {
          showPrintErrorToast(
            showCustomToast,
            buildUnroutedItemsUserToast(order, unroutedItems),
            null,
          );
        }
      }

      if (
        !isIntentionalPrinterSelection &&
        routingActive &&
        unroutedItems.length > 0
      ) {
        reportPrintFailure(
          order,
          {
            success: false,
            message: buildUnroutedPrintMessage(
              unroutedItems,
              itemToGroups,
              itemGroups,
            ),
            failedPrints: unroutedItems.length,
            successfulPrints: finalResult.successfulPrints ?? 0,
            totalPrinters: finalResult.totalPrinters ?? printPlan.length,
            failedPrinterErrors: unroutedItems.map((item) => ({
              printerName: "routing",
              error: item?.name || "Unrouted item",
            })),
          },
          "final",
          source,
        );
      }

      return finalResult;
    }

    const earlyResult = buildEarlyPrintFailureResult("No printers available");
    if (!silentNoPrinters) {
      applyPrintFailureFeedback(order, earlyResult, {
        showCustomToast,
        attempt: "early_return",
        notify,
        source,
        printersToUse,
      });
    }
    return earlyResult;
  } catch (error) {
    console.error("Error printing order:", error);

    if (retryCount < PRINT_MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, PRINT_RETRY_DELAY_MS));
      return printKitchenOrder(order, {
        storeProfile,
        itemGroups,
        selectedPrinters,
        retryCount: retryCount + 1,
        source,
        notify,
        notifySuccess,
        showCustomToast,
        silentNoPrinters,
      });
    }

    const errorMessage = `Print failed: ${error.message || "Unknown error"}`;
    applyPrintFailureFeedback(
      order,
      {
        success: false,
        message: errorMessage,
        error: error.message,
        failedPrints: 1,
        successfulPrints: 0,
        totalPrinters: 0,
        failedPrinterErrors: [],
      },
      {
        showCustomToast,
        attempt: "exception",
        notify,
        source,
        allowRetry: true,
        retryContext: {
          order,
          failedPrinters:
            Array.isArray(selectedPrinters) && selectedPrinters.length > 0
              ? selectedPrinters
              : null,
          source,
        },
      },
    );
    return { success: false, error: error.message };
  }
}
