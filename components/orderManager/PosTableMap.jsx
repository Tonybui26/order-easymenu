"use client";

import { useEffect, useMemo, useState } from "react";
import { Map } from "lucide-react";
import { useMenuContext } from "@/components/context/MenuContext";
import { TABLE_MAP_FLOOR_COLOR } from "@/lib/pos/posTableMaps";
import PosChromeHeader from "./PosChromeHeader";
import PosTableMapFloor from "./PosTableMapFloor";
import { usePosOpenCashDrawer } from "./usePosOpenCashDrawer";

export default function PosTableMap() {
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { posTableMaps } = useMenuContext();
  const tableMaps = useMemo(() => {
    return [...(posTableMaps || [])].sort((a, b) => {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });
  }, [posTableMaps]);
  const [selectedMapId, setSelectedMapId] = useState(null);

  useEffect(() => {
    if (!tableMaps.length) {
      setSelectedMapId(null);
      return;
    }
    if (!tableMaps.some((map) => map.id === selectedMapId)) {
      setSelectedMapId(tableMaps[0].id);
    }
  }, [tableMaps, selectedMapId]);
  const selectedMap =
    tableMaps.find((map) => map.id === selectedMapId) || tableMaps[0] || null;

  return (
    <div
      className="flex h-[100dvh] w-full flex-col overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      style={{ backgroundColor: TABLE_MAP_FLOOR_COLOR }}
    >
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

      {selectedMap ? (
        <div className="relative min-h-0 flex-1 overflow-hidden pb-[env(safe-area-inset-bottom)]">
          {tableMaps.length > 1 ? (
            <div className="absolute right-4 top-2 z-20">
              <div className="flex shrink-0 space-x-1 rounded-xl bg-[#402e22] p-1 shadow-sm">
                {tableMaps.map((map) => {
                  const isActive = map.id === selectedMap.id;
                  return (
                    <button
                      key={map.id}
                      type="button"
                      onClick={() => setSelectedMapId(map.id)}
                      className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 xl:text-base ${
                        isActive
                          ? "bg-brand_accent text-white shadow-sm"
                          : "text-white hover:bg-gray-50 hover:text-gray-800"
                      }`}
                    >
                      {map.name?.trim() || "Untitled map"}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <PosTableMapFloor tableMap={selectedMap} />
        </div>
      ) : (
        <div
          className="flex min-h-0 flex-1 items-center justify-center px-6 pb-[env(safe-area-inset-bottom)]"
          style={{ backgroundColor: TABLE_MAP_FLOOR_COLOR }}
        >
          <div className="flex max-w-md flex-col items-center text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-lg border border-gray-200 bg-white">
              <Map className="size-5 text-gray-400" aria-hidden />
            </div>
            <h1 className="text-xl font-bold text-neutral-900">Table Map</h1>
            <p className="mt-2 text-sm text-neutral-500">
              No floor plan yet. Create one in admin under POS → Table map.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
