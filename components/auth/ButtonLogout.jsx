"use client";
import { cn } from "@/libs/utils";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export const ButtonLogout = ({ className, ...props }) => {
  return (
    <button
      onClick={() => {
        signOut();
      }}
      className={cn("btn", className)}
      {...props}
    >
      <LogOut className="size-4" /> Logout
    </button>
  );
};
