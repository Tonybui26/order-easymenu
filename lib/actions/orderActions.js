"use server";

import { getServerSession } from "next-auth";
import { NextAuthOptions } from "@/lib/auth/nextAuthOptions";
import { createTokenFromSession } from "@/lib/auth/tokenUtils";

const MAIN_APP_URL_API =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : process.env.NEXT_PUBLIC_MAIN_APP_URL || "http://localhost:3000";

export async function fetchOrdersAction() {
  const session = await getServerSession(NextAuthOptions);

  try {
    if (!session) {
      throw new Error("Not authenticated");
    }

    // Create JWT token for API authentication (server-side only)
    const jwtToken = createTokenFromSession(session);

    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    const response = await fetch(
      `${MAIN_APP_URL_API}/api/orders?t=${timestamp}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching orders:", error);
    throw error;
  }
}

export async function fetchCompletedOrdersAction(
  startDate = null,
  endDate = null,
  limit = 50,
) {
  const session = await getServerSession(NextAuthOptions);
  if (!session) {
    throw new Error("Not authenticated");
  }

  const jwtToken = createTokenFromSession(session);
  const baseUrl = MAIN_APP_URL_API;
  const params = new URLSearchParams();

  // Send start date (UTC ISO string) for precise range filtering
  if (startDate) {
    params.append("startDate", startDate);
  }

  // Send end date (UTC ISO string) for precise range filtering
  if (endDate) {
    params.append("endDate", endDate);
  }

  if (limit) {
    params.append("limit", limit.toString());
  }
  const response = await fetch(
    `${baseUrl}/api/orders/completed?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const errorDetails = await response.json();
    throw new Error(`${errorDetails.message || response.statusText}`);
  }
  return await response.json();
}

export async function fetchGetMenuByOwnerEmailAction(ownerEmail) {
  const baseUrl = MAIN_APP_URL_API;
  const queryParams = new URLSearchParams({ ownerEmail }).toString();
  const res = await fetch(`${baseUrl}/api/menu/get-menu?${queryParams}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  console.log("fetchGetMenuByOwnerEmail", res);

  if (!res.ok) {
    const errorDetails = await res.json();
    if (res.status === 404) {
      return null;
    }
    throw new Error(`${errorDetails.message || res.statusText}`);
  }
  const { menu } = await res.json();
  return menu;
}

export async function updateOrderStatusAction(orderId, status) {
  const session = await getServerSession(NextAuthOptions);
  try {
    if (!session) {
      throw new Error("Not authenticated");
    }

    // Create JWT token for API authentication (server-side only)
    const jwtToken = createTokenFromSession(session);

    const baseUrl = MAIN_APP_URL_API;
    const response = await fetch(`${baseUrl}/api/orders/${orderId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || errorData.error || "Failed to update order",
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating order:", error);
    throw error;
  }
}

export async function updateMenuConfigAction(menuConfig) {
  const session = await getServerSession(NextAuthOptions);
  try {
    if (!session) {
      throw new Error("Not authenticated");
    }

    // Create JWT token for API authentication (server-side only)
    const jwtToken = createTokenFromSession(session);

    const baseUrl = MAIN_APP_URL_API;
    const response = await fetch(
      `${baseUrl}/api/order-app/update-menu-config`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(menuConfig),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || errorData.error || "Failed to update menu config",
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating menu config:", error);
    throw error;
  }
}

export async function updateOrderPaymentStatusAction(
  orderId,
  paymentStatus,
  paymentMethod,
) {
  const session = await getServerSession(NextAuthOptions);

  try {
    if (!session) {
      throw new Error("Not authenticated");
    }

    // Create JWT token for API authentication (server-side only)
    const jwtToken = createTokenFromSession(session);

    const baseUrl = MAIN_APP_URL_API;
    const requestBody = { orderId, paymentStatus };

    // Include payment method if provided
    if (paymentMethod) {
      requestBody.paymentMethod = paymentMethod;
    }

    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message ||
          errorData.error ||
          "Failed to update payment status",
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating payment status:", error);
    throw error;
  }
}

export async function deletePrinterAction(printerId) {
  const session = await getServerSession(NextAuthOptions);
  try {
    if (!session) {
      throw new Error("Not authenticated");
    }

    // Create JWT token for API authentication (server-side only)
    const jwtToken = createTokenFromSession(session);

    const baseUrl = MAIN_APP_URL_API;
    const response = await fetch(`${baseUrl}/api/printers?id=${printerId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to delete printer");
    }

    return await response.json();
  } catch (error) {
    console.error("Error deleting printer:", error);
    throw error;
  }
}

export async function addPrinterAction(printerData) {
  const session = await getServerSession(NextAuthOptions);
  try {
    if (!session) {
      throw new Error("Not authenticated");
    }

    // Create JWT token for API authentication (server-side only)
    const jwtToken = createTokenFromSession(session);
    const baseUrl = MAIN_APP_URL_API;
    const response = await fetch(`${baseUrl}/api/printers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(printerData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to create printer");
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating printer:", error);
    throw error;
  }
}

export async function updatePrinterAction(printerId, printerData) {
  const session = await getServerSession(NextAuthOptions);
  try {
    if (!session) {
      throw new Error("Not authenticated");
    }

    // Create JWT token for API authentication (server-side only)
    const jwtToken = createTokenFromSession(session);
    const baseUrl = MAIN_APP_URL_API;
    const response = await fetch(`${baseUrl}/api/printers`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({ id: printerId, ...printerData }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to update printer");
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating printer:", error);
    throw error;
  }
}

export async function createPrintJobsForOrderAction(
  order,
  menuLink,
  ownerEmail,
  storeId,
  printers = null,
) {
  const session = await getServerSession(NextAuthOptions);
  try {
    if (!session) {
      throw new Error("Not authenticated");
    }

    // Create JWT token for API authentication (server-side only)
    const jwtToken = createTokenFromSession(session);
    const baseUrl = MAIN_APP_URL_API;

    let applicablePrinters = printers;

    // If printers not provided, fetch them
    // if (!applicablePrinters) {
    //   const printersResponse = await fetch(`${baseUrl}/api/printers`, {
    //     method: "GET",
    //     headers: {
    //       "Content-Type": "application/json",
    //     },
    //   });

    //   if (!printersResponse.ok) {
    //     throw new Error("Failed to fetch printers");
    //   }

    //   const printersData = await printersResponse.json();
    //   const allPrinters = printersData.printers || [];

    //   if (allPrinters.length === 0) {
    //     console.log("No printers configured for this store");
    //     return { success: true, message: "No printers configured" };
    //   }

    //   // Determine order type
    //   const isTakeaway = order.table === "takeaway";
    //   const orderType = isTakeaway ? "takeaway" : "dinein";

    //   // Filter printers based on order type
    //   applicablePrinters = allPrinters.filter((printer) => {
    //     if (orderType === "takeaway") {
    //       return printer.forTakeaway === true;
    //     } else {
    //       return printer.forDineIn === true;
    //     }
    //   });
    // }

    if (applicablePrinters.length === 0) {
      console.log("No applicable printers found for this order type");
      return { success: true, message: "No applicable printers found" };
    }

    // Get printer IDs for the print job
    const printerIds = applicablePrinters.map((printer) => printer._id);

    // Create print job data
    const printJobData = {
      orderData: order,
      printerId: printerIds,
      menuLink: menuLink,
      ownerEmail: ownerEmail,
      storeId: storeId, // Add storeId to the print job data
    };

    // Create the print job
    const response = await fetch(`${baseUrl}/api/printers/print`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(printJobData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to create print job");
    }

    const result = await response.json();
    console.log("Print jobs created successfully:", result);
    return result;
  } catch (error) {
    console.error("Error creating print jobs for order:", error);
    // Don't throw error - we don't want to block order preparation if printing fails
    return { success: false, message: error.message };
  }
}

export async function fetchPrintersAction() {
  const session = await getServerSession(NextAuthOptions);
  try {
    if (!session) {
      throw new Error("Not authenticated");
    }

    // Create JWT token for API authentication (server-side only)
    const jwtToken = createTokenFromSession(session);
    const baseUrl = MAIN_APP_URL_API;
    const response = await fetch(`${baseUrl}/api/printers`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch printers");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching printers:", error);
    throw error;
  }
}
export async function checkPrinterAvailabilityAction(orderType) {
  const session = await getServerSession(NextAuthOptions);
  try {
    if (!session) {
      throw new Error("Not authenticated");
    }

    // Create JWT token for API authentication (server-side only)
    const jwtToken = createTokenFromSession(session);
    const baseUrl = MAIN_APP_URL_API;

    // Fetch all printers for this store
    const printersResponse = await fetch(`${baseUrl}/api/printers`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
    });

    if (!printersResponse.ok) {
      throw new Error("Failed to fetch printers");
    }

    const printersData = await printersResponse.json();
    const printers = printersData.printers || [];

    if (printers.length === 0) {
      return {
        available: false,
        count: 0,
        message: "No printers configured for this store",
      };
    }

    // Filter printers based on order type
    const applicablePrinters = printers.filter((printer) => {
      if (orderType === "takeaway") {
        return printer.forTakeaway === true;
      } else if (orderType === "dinein") {
        return printer.forDineIn === true;
      }
      return false;
    });

    if (applicablePrinters.length === 0) {
      return {
        available: false,
        count: 0,
        message: `No printers configured for ${orderType} orders`,
      };
    }

    return {
      available: true,
      count: applicablePrinters.length,
      message: `${applicablePrinters.length} printer(s) available for ${orderType} orders`,
      printers: applicablePrinters,
    };
  } catch (error) {
    console.error("Error checking printer availability:", error);
    return {
      available: false,
      count: 0,
      message: "Error checking printer availability",
    };
  }
}
