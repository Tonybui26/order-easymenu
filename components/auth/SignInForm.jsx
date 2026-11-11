"use client";
import { getSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { getPostSignInUrl } from "@/lib/constants/auth";
import {
  clearActiveOperator,
  operatorFromSessionUser,
  writeActiveOperator,
} from "@/lib/staff/activeOperatorStorage";
import { useMenuContext } from "@/components/context/MenuContext";
import { resolvePosConfig } from "@/lib/pos/posConfig";
import { isStaffPinLockEnabled } from "@/lib/staff/staffRoles";
import { requestCatalogForceSync } from "@/lib/localDb/catalogForceSync";
import { preflightOrderManagerLoginAction } from "@/lib/actions/authActions";
import { getOrderManagerDeviceLabel } from "@/lib/helper/platformDetection";

function displayDeviceLabel(label) {
  const raw = String(label || "").toLowerCase();
  if (!raw || raw === "web" || raw === "unknown device") {
    return "Unknown device";
  }
  if (raw === "ios phone" || raw.includes("iphone")) return "iOS phone";
  if (raw === "ios tablet" || raw.includes("ipad") || raw === "ios") {
    return "iOS tablet";
  }
  if (raw === "android phone") return "Android phone";
  if (raw === "android tablet" || raw === "android") return "Android tablet";
  if (raw.includes("mozilla") || raw.includes("chrome")) return "Unknown device";
  return label;
}

function formatSignedInDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function SignInFormInner() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [menuLink, setMenuLink] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [deviceConflict, setDeviceConflict] = useState(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const revokedReason = searchParams.get("reason") === "session_revoked";
  const { syncCatalogFromServer } = useMenuContext();

  const devicesToRevoke = deviceConflict?.devicesToRevoke || 1;
  const canContinueConflict = useMemo(() => {
    if (!deviceConflict) return false;
    return selectedSessionIds.length >= devicesToRevoke;
  }, [deviceConflict, devicesToRevoke, selectedSessionIds.length]);

  function toggleSession(sessionId) {
    setSelectedSessionIds((prev) => {
      if (prev.includes(sessionId)) {
        return prev.filter((id) => id !== sessionId);
      }
      if (devicesToRevoke === 1) {
        return [sessionId];
      }
      return [...prev, sessionId];
    });
  }

  async function completeSignIn({ force = false, revokeSessionIds = [] } = {}) {
    const result = await signIn("credentials", {
      redirect: false,
      username,
      password,
      menuLink,
      deviceLabel: getOrderManagerDeviceLabel(),
      force: force ? "true" : "false",
      revokeSessionIds: JSON.stringify(revokeSessionIds),
    });

    if (result?.error) {
      setError("Invalid username or password");
      return false;
    }
    if (!result?.ok) {
      setError("Something went wrong. Please try again.");
      return false;
    }

    const session = await getSession();

    try {
      await requestCatalogForceSync();
    } catch (flagError) {
      console.error("sign-in catalog force sync flag:", flagError);
    }

    const ownerEmail = session?.user?.ownerEmail;
    const synced = ownerEmail
      ? await syncCatalogFromServer({ ownerEmail })
      : { success: false, error: "Missing store account" };
    if (!synced.success || !synced.menu) {
      setError(
        "Signed in, but the store menu could not be loaded. Try again.",
      );
      return false;
    }

    const menuConfig = synced.menu.config || {};
    const posEnabled = Boolean(menuConfig.posEnabled);
    const restaurantModeEnabled = Boolean(
      resolvePosConfig(menuConfig).restaurantModeEnabled,
    );

    const pinLockEnabled = isStaffPinLockEnabled(menuConfig);
    if (pinLockEnabled) {
      clearActiveOperator({ locked: true });
    } else {
      const operator = operatorFromSessionUser(session?.user);
      if (operator) writeActiveOperator(operator);
    }

    router.push(
      getPostSignInUrl(
        callbackUrl,
        posEnabled,
        restaurantModeEnabled,
        pinLockEnabled,
      ),
    );
    router.refresh();
    return true;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setDeviceConflict(null);
    setSelectedSessionIds([]);

    try {
      const preflight = await preflightOrderManagerLoginAction({
        menuLink,
        username,
        password,
      });

      if (!preflight.ok && !preflight.conflict) {
        setError(preflight.message || "Invalid username or password");
        return;
      }

      if (preflight.conflict) {
        setDeviceConflict(preflight);
        const devices = preflight.devices || [];
        if (devices.length === 1) {
          setSelectedSessionIds([devices[0].sessionId]);
        }
        return;
      }

      await completeSignIn();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueWithRevoke = async () => {
    if (!canContinueConflict) return;
    setIsLoading(true);
    setError("");
    try {
      const ok = await completeSignIn({
        force: true,
        revokeSessionIds: selectedSessionIds,
      });
      if (ok) {
        setDeviceConflict(null);
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {(error || revokedReason) && (
        <div className="mt-4 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle
                className="h-5 w-5 text-red-400"
                aria-hidden="true"
              />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {error ||
                  "This device was signed out because the store signed in on another device."}
              </h3>
            </div>
          </div>
        </div>
      )}

      {deviceConflict ? (
        <div className="mt-6 space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Device limit reached. Choose a device to revoke to continue.
          </p>

          <div className="space-y-2">
            {(deviceConflict.devices || []).map((device) => {
              const checked = selectedSessionIds.includes(device.sessionId);
              const signedInDate = formatSignedInDate(device.createdAt);
              const details = [
                device.staffUsername
                  ? `Signed in as ${device.staffUsername}`
                  : null,
                signedInDate ? `on ${signedInDate}` : null,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <label
                  key={device.sessionId}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-white p-3 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm mt-0.5"
                    checked={checked}
                    onChange={() => toggleSession(device.sessionId)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-900">
                      {displayDeviceLabel(device.deviceLabel)}
                    </span>
                    {details ? (
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {details}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={isLoading || !canContinueConflict}
              onClick={handleContinueWithRevoke}
              className="flex w-full justify-center rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/80 disabled:opacity-70"
            >
              {isLoading ? "Signing in…" : "Continue"}
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setDeviceConflict(null);
                setSelectedSessionIds([]);
              }}
              className="flex w-full justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-70"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-10 space-y-4">
          <div>
            <label
              htmlFor="menuLink"
              className="block text-sm font-medium text-gray-700"
            >
              Store Link
            </label>
            <input
              id="menuLink"
              name="menuLink"
              type="text"
              autoComplete="menuLink"
              required
              value={menuLink}
              onChange={(e) => setMenuLink(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
            />
          </div>
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center bg-transparent pr-3 text-gray-400 hover:text-gray-500"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-70"
            >
              {isLoading ? (
                <svg
                  className="h-5 w-5 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                "Sign in"
              )}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

export default function SignInForm() {
  return (
    <Suspense fallback={null}>
      <SignInFormInner />
    </Suspense>
  );
}
