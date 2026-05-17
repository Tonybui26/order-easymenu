"use client";
import { useState, useEffect, useRef } from "react";
import {
  Menu,
  Printer,
  CheckCheck,
  X,
  LogOut,
  Bell,
  ChefHat,
  Check,
  Banknote,
  Radio,
  Volume2,
  BellOff,
  BellRing,
  CalendarClock,
  RefreshCw,
  Package2,
  Settings,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { isNativeApp, getPlatform } from "../../lib/helper/platformDetection";
import { useRouter } from "next/navigation";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";
import {
  NOTIFICATION_SOUND_OPTIONS,
  NOTIFICATION_SOUND_REPLAY_INTERVAL_MS,
  getNotificationSoundUrl,
} from "@/lib/utils/notificationSound";

export default function MoreMenuButton({
  setViewMode,
  viewMode,
  newOrdersCount,
  scheduledCount = 0,
  hasPreorderEnabled = false,
  preparingCount,
  readyCount,
  allActiveCount,
  unpaidTablesBadgeCount,
  storeProfile,
}) {
  const [showModal, setShowModal] = useState(false);
  const [showSoundSettingsModal, setShowSoundSettingsModal] = useState(false);
  const [draftSoundId, setDraftSoundId] = useState("sound1");
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isTestingSound, setIsTestingSound] = useState(false);
  const router = useRouter();
  const {
    notificationSoundId,
    setNotificationSoundId,
    newOrderAlertsMuted,
    setNewOrderAlertsMuted,
  } = useGlobalAppContext();

  // Track audio instances + scheduled replay so the 2s test can be torn down cleanly
  const testAudioInstancesRef = useRef(new Set());
  const testReplayTimeoutRef = useRef(null);
  const testStopTimeoutRef = useRef(null);

  const stopTestNotificationSound = () => {
    if (testReplayTimeoutRef.current) {
      clearTimeout(testReplayTimeoutRef.current);
      testReplayTimeoutRef.current = null;
    }
    if (testStopTimeoutRef.current) {
      clearTimeout(testStopTimeoutRef.current);
      testStopTimeoutRef.current = null;
    }
    testAudioInstancesRef.current.forEach((audio) => {
      try {
        if (audio && typeof audio.pause === "function") {
          audio.pause();
          audio.currentTime = 0;
        }
      } catch (error) {
        console.error("Error stopping test audio:", error);
      }
    });
    testAudioInstancesRef.current.clear();
    setIsTestingSound(false);
  };

  const handleTestNotificationSound = async () => {
    if (isTestingSound) return;
    setIsTestingSound(true);

    const TEST_DURATION_MS = 4000;
    const startedAt = Date.now();

    const playOnce = async () => {
      try {
        const audio = new Audio(getNotificationSoundUrl(notificationSoundId));
        audio.volume = 1;
        testAudioInstancesRef.current.add(audio);

        const cleanup = () => testAudioInstancesRef.current.delete(audio);
        audio.addEventListener("ended", cleanup, { once: true });
        audio.addEventListener("error", cleanup, { once: true });

        await audio.play();

        if (
          Date.now() - startedAt + NOTIFICATION_SOUND_REPLAY_INTERVAL_MS <
          TEST_DURATION_MS
        ) {
          testReplayTimeoutRef.current = setTimeout(
            playOnce,
            NOTIFICATION_SOUND_REPLAY_INTERVAL_MS,
          );
        }
      } catch (error) {
        console.error("Failed to play test notification sound:", error);
      }
    };

    testStopTimeoutRef.current = setTimeout(
      stopTestNotificationSound,
      TEST_DURATION_MS,
    );

    playOnce();
  };

  useEffect(() => {
    return () => {
      stopTestNotificationSound();
    };
  }, []);

  // Check screen size on mount and resize
  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 768); // sm breakpoint
    };

    // Check on mount
    checkScreenSize();

    // Add event listener for resize
    window.addEventListener("resize", checkScreenSize);

    // Cleanup
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const handlePrinterManagement = async () => {
    const platform = getPlatform();
    const isNative = isNativeApp();

    if (isNative) {
      // Navigate to printer management page
      router.push("/printer-management");
    } else {
      // Show web alert - printer management only available on mobile apps
      // alert(
      //   "Printer Management is currently only available for Android or iOS app. Please download our mobile app to configure your printers.",
      // );
      router.push("/printer-management");
    }

    setShowModal(false);
  };

  const moreFeatures = [
    // View Mode Tabs for Small Screens Only
    ...(isSmallScreen
      ? [
          {
            icon: Bell,
            title: "New Orders",
            description: `${newOrdersCount} new orders`,
            action: () => {
              setViewMode("new");
              setShowModal(false);
            },
            isActive: viewMode === "new",
          },
          ...(hasPreorderEnabled
            ? [
                {
                  icon: CalendarClock,
                  title: "Scheduled",
                  description: `${scheduledCount} scheduled pre-orders`,
                  action: () => {
                    setViewMode("scheduled");
                    setShowModal(false);
                  },
                  isActive: viewMode === "scheduled",
                },
              ]
            : []),
          {
            icon: ChefHat,
            title: "Preparing",
            description: `${preparingCount} orders being prepared`,
            action: () => {
              setViewMode("preparing");
              setShowModal(false);
            },
            isActive: viewMode === "preparing",
          },
          {
            icon: Check,
            title: "Ready",
            description: `${readyCount} orders ready`,
            action: () => {
              setViewMode("ready");
              setShowModal(false);
            },
            isActive: viewMode === "ready",
          },
          // Only show Unpaid tab if Pay at Counter payment method is enabled
          ...(storeProfile?.paymentMethods?.cash?.enabled
            ? [
                {
                  icon: Banknote,
                  title: "Unpaid",
                  description: `${unpaidTablesBadgeCount} tables with unpaid orders`,
                  action: () => {
                    setViewMode("unpaid");
                    setShowModal(false);
                  },
                  isActive: viewMode === "unpaid",
                },
              ]
            : []),
          {
            icon: Radio,
            title: "Active",
            description: `${allActiveCount} active orders`,
            action: () => {
              setViewMode("all");
              setShowModal(false);
            },
            isActive: viewMode === "all",
          },
          // Divider
          { type: "divider" },
        ]
      : []),
    // Existing Features (always shown)
    {
      icon: CheckCheck,
      title: "Completed Orders",
      // description: "View and manage all completed orders",
      action: () => {
        setViewMode("completed");
        setShowModal(false);
      },
    },
    {
      icon: Package2,
      title: "Product availability",
      // description: "Mark items sold out while keeping them on the menu",
      action: () => {
        setViewMode("productAvailability");
        setShowModal(false);
      },
      isActive: viewMode === "productAvailability",
    },
    {
      icon: Printer,
      title: "Printer Management",
      // description: "Set up and manage your receipt printers",
      action: handlePrinterManagement,
    },
    {
      id: "mute-new-order-alerts",
      icon: newOrderAlertsMuted ? BellOff : BellRing,
      title: "New order alerts",
      description: newOrderAlertsMuted
        ? "Muted on this device — tap to turn on"
        : "Banner and sound on — tap to mute",
      action: () => setNewOrderAlertsMuted(!newOrderAlertsMuted),
      keepModalOpen: true,
      isActive: newOrderAlertsMuted,
    },
    {
      id: "test-notification-sound",
      icon: Volume2,
      title: "Test Notification Sound",
      description: isTestingSound ? "Playing..." : "",
      action: handleTestNotificationSound,
      keepModalOpen: true,
    },
    {
      icon: RefreshCw,
      title: "Reload App",
      description: "Reload to apply latest changes",
      action: () => window.location.reload(),
    },
    // {
    //   icon: BarChart3,
    //   title: "Analytics & Reports",
    //   description: "View order statistics and business insights",
    //   action: () => console.log("Analytics clicked"),
    // },
  ];

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex flex-col items-center justify-center gap-1 rounded-xl bg-transparent p-2 pt-1 text-brand_accent transition-all duration-200 hover:bg-neutral-600 hover:text-white hover:shadow-md"
      >
        <Menu className="size-7 text-brand_accent" />
        <span className="hidden text-xs font-medium text-white md:block">
          More
        </span>
      </button>

      {/* More Features Modal */}
      <dialog className={`modal ${showModal ? "modal-open" : ""}`}>
        <div className="modal-box max-w-2xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">More Features</h3>
            <button
              onClick={() => setShowModal(false)}
              className="btn btn-circle btn-ghost btn-sm"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 gap-2">
            {moreFeatures.map((feature, index) => {
              // Handle divider
              if (feature.type === "divider") {
                return (
                  <div
                    key={`divider-${index}`}
                    className="my-2 border-t border-gray-200"
                  />
                );
              }

              if (feature.id === "test-notification-sound") {
                return (
                  <div
                    key={index}
                    className="flex items-stretch gap-2 rounded-lg border border-gray-200 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        feature.action();
                        if (!feature.keepModalOpen) setShowModal(false);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left transition-all duration-200 hover:border-brand_accent hover:shadow-md"
                    >
                      <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                        <feature.icon className="size-6 text-gray-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-gray-900">
                          {feature.title}
                        </h4>
                        <p className="mt-1 text-sm text-gray-600">
                          {feature.description ||
                            NOTIFICATION_SOUND_OPTIONS.find(
                              (o) => o.id === notificationSoundId,
                            )?.label}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label="Notification sound settings"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDraftSoundId(notificationSoundId);
                        setShowSoundSettingsModal(true);
                      }}
                      className="btn btn-ghost btn-sm my-2 mr-2 shrink-0 self-center rounded-lg border border-gray-200"
                    >
                      <Settings className="size-5 text-gray-600" />
                    </button>
                  </div>
                );
              }

              return (
                <button
                  key={index}
                  onClick={() => {
                    feature.action();
                    if (!feature.keepModalOpen) setShowModal(false);
                  }}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all duration-200 ${
                    feature.isActive
                      ? "border-brand_accent bg-brand_accent/5 text-brand_accent shadow-md"
                      : "border-gray-200 bg-white hover:border-brand_accent hover:shadow-md"
                  }`}
                >
                  <div
                    className={`flex size-8 flex-shrink-0 items-center justify-center rounded-lg ${
                      feature.isActive ? "bg-brand_accent/10" : "bg-gray-100"
                    }`}
                  >
                    <feature.icon
                      className={`size-6 ${
                        feature.isActive ? "text-brand_accent" : "text-gray-600"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4
                      className={`font-medium ${
                        feature.isActive ? "text-brand_accent" : "text-gray-900"
                      }`}
                    >
                      {feature.title}
                    </h4>
                    {feature.description && (
                      <p
                        className={`mt-1 text-sm ${
                          feature.isActive
                            ? "text-brand_accent/70"
                            : "text-gray-600"
                        }`}
                      >
                        {feature.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-end">
            {/* Logout Button - moved to bottom right */}
            <button
              onClick={async () => {
                console.log("Logging out", window.location.origin);
                setShowModal(false);
                await signOut({ redirect: false });
                window.location.href = `${window.location.origin}/signin`;
              }}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <LogOut className="size-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
        <form
          method="dialog"
          className="modal-backdrop"
          onClick={() => setShowModal(false)}
        >
          <button>close</button>
        </form>
      </dialog>

      {/* Notification sound picker (gear on Test Notification Sound row) */}
      <dialog className={`modal ${showSoundSettingsModal ? "modal-open" : ""}`}>
        <div className="modal-box max-w-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">
              Notification sound
            </h3>
            <button
              type="button"
              onClick={() => setShowSoundSettingsModal(false)}
              className="btn btn-circle btn-ghost btn-sm"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mb-3 text-sm text-gray-600">
            Choose the alert played for new orders. Saved on this device.
          </p>
          <label className="block text-sm font-medium text-gray-700">
            Sound
            <select
              className="select select-bordered mt-2 w-full"
              value={draftSoundId}
              onChange={(e) => setDraftSoundId(e.target.value)}
            >
              {NOTIFICATION_SOUND_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowSoundSettingsModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary btn btn-sm"
              onClick={() => {
                setNotificationSoundId(draftSoundId);
                setShowSoundSettingsModal(false);
              }}
            >
              Save
            </button>
          </div>
        </div>
        <form
          method="dialog"
          className="modal-backdrop"
          onClick={() => setShowSoundSettingsModal(false)}
        >
          <button type="submit">close</button>
        </form>
      </dialog>
    </>
  );
}
