"use client";
import { useState } from "react";
import { Menu, Printer, CheckCheck, X, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { isNativeApp, getPlatform } from "../../lib/helper/platformDetection";
import { useRouter } from "next/navigation";

export default function MoreMenuButton({ setViewMode }) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

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
      icon: Printer,
      title: "Printer Management",
      // description: "Set up and manage your receipt printers",
      action: handlePrinterManagement,
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
        className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-gray-200 bg-white p-2 text-gray-600 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 hover:shadow-md"
      >
        <Menu className="size-7 text-gray-500" />
        <span className="text-xs font-medium">More</span>
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
          <div className="grid grid-cols-1 gap-4">
            {moreFeatures.map((feature, index) => (
              <button
                key={index}
                onClick={() => {
                  feature.action();
                  setShowModal(false);
                }}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left transition-all duration-200 hover:border-brand_accent hover:shadow-md"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <feature.icon className="size-6 text-gray-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-gray-900">{feature.title}</h4>
                  <p className="mt-1 text-sm text-gray-600">
                    {feature.description}
                  </p>
                </div>
              </button>
            ))}
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
    </>
  );
}
