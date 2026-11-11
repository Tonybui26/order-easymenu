"use client";
import { cn } from "@/libs/utils";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { releaseOrderManagerSessionAction } from "@/lib/actions/authActions";

export const ButtonLogout = ({ className, ...props }) => {
  return (
    <button
      onClick={async () => {
        try {
          await releaseOrderManagerSessionAction();
        } catch (error) {
          console.error("release OM session on logout:", error);
        }
        signOut();
      }}
      className={cn("btn", className)}
      {...props}
    >
      <LogOut className="size-4" /> Logout
    </button>
  );
};
