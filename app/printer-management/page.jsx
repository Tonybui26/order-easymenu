import { redirect } from "next/navigation";

export default function PrinterManagementPage() {
  redirect("/settings?section=printers");
}
