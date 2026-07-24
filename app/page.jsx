import LiveOrderTerminal from "@/components/orderManager/LiveOrderTerminal";
import PosEntryButton from "@/components/orderManager/PosEntryButton";

export default function Home() {
  return (
    <div>
      <LiveOrderTerminal />
      <PosEntryButton />
    </div>
  );
}
