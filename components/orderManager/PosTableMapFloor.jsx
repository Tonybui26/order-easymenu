"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/helper";
import { findPosHeldOrderForTable } from "@/lib/pos/posTableMapHeld";
import {
  getPosTableMapStatusFill,
  POS_TABLE_MAP_STATUS,
  POS_TABLE_MAP_STATUS_LABEL,
  resolvePosTableMapStatus,
} from "@/lib/pos/posTableMapStatus";
import {
  TABLE_MAP_DEFAULT_FONT_COLOR,
  TABLE_MAP_DEFAULT_FONT_SIZE,
  TABLE_MAP_FLOOR_COLOR,
  getTableMapBackgroundColor,
  getTableMapCanvasSize,
  getTableMapFloorStyle,
  getTableMapTableName,
  getTableMapViewportLayout,
  isTableMapPartition,
  isTableMapTable,
} from "@/lib/pos/posTableMaps";
import { TableMapElementGraphic } from "./posTableMapIcons";

export default function PosTableMapFloor({
  tableMap,
  heldOrders = [],
  trackFoodServedOnTableMap = false,
  onTableSelect,
}) {
  const containerRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const canvasSize = getTableMapCanvasSize(tableMap);
  const layout = getTableMapViewportLayout(canvasSize, viewportSize);
  const objects = Array.isArray(tableMap?.objects) ? tableMap.objects : [];

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    function updateViewportSize() {
      setViewportSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    }

    updateViewportSize();
    const observer = new ResizeObserver(updateViewportSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: TABLE_MAP_FLOOR_COLOR }}
    >
      {layout.width > 0 && layout.height > 0 ? (
        <div
          className="relative shrink-0 overflow-hidden"
          style={{ width: layout.width, height: layout.height }}
        >
          <div
            className="relative origin-top-left"
            style={{
              width: layout.canvasWidth,
              height: layout.canvasHeight,
              transform: `scale(${layout.scale})`,
              ...getTableMapFloorStyle(),
            }}
          >
            {objects.map((object) => {
              const isTable = isTableMapTable(object);
              const tableName = getTableMapTableName(object);
              const isInteractive = isTable && Boolean(tableName);
              const heldOrder = isInteractive
                ? findPosHeldOrderForTable(heldOrders, tableName)
                : null;
              const status = resolvePosTableMapStatus(heldOrder, {
                trackFoodServedOnTableMap,
              });
              const statusFill = getPosTableMapStatusFill(status);
              const fillColor =
                statusFill || getTableMapBackgroundColor(object);
              const statusLabel =
                status !== POS_TABLE_MAP_STATUS.available
                  ? POS_TABLE_MAP_STATUS_LABEL[status]
                  : null;

              return (
                <div
                  key={object.id}
                  className="absolute"
                  style={{
                    left: object.x,
                    top: object.y,
                    width: object.width,
                    height: object.height,
                    transform: `rotate(${object.rotation || 0}deg)`,
                  }}
                >
                  <button
                    type="button"
                    disabled={!isInteractive}
                    onClick={() => {
                      if (!isInteractive) return;
                      onTableSelect?.(object);
                    }}
                    className={cn(
                      "relative h-full w-full overflow-visible border-0 bg-transparent p-0",
                      isInteractive
                        ? "cursor-pointer touch-manipulation"
                        : "cursor-default",
                    )}
                    aria-label={
                      isInteractive
                        ? `Table ${tableName}${statusLabel ? `, ${statusLabel}` : ""}`
                        : undefined
                    }
                  >
                    <TableMapElementGraphic
                      type={object.type}
                      fillColor={fillColor}
                    />
                    {shouldShowObjectLabel(object) ? (
                      <ObjectLabel object={object} />
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function shouldShowObjectLabel(object) {
  if (!object?.name?.trim()) return false;
  return isTableMapTable(object) || isTableMapPartition(object);
}

function ObjectLabel({ object }) {
  const isVerticalPartition = object.type === "partition-v";

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible px-1">
      <span
        className="whitespace-nowrap text-center font-semibold leading-none"
        style={{
          color: object.fontColor || TABLE_MAP_DEFAULT_FONT_COLOR,
          fontSize: object.fontSize || TABLE_MAP_DEFAULT_FONT_SIZE,
          transform: isVerticalPartition ? "rotate(-90deg)" : undefined,
        }}
      >
        {object.name.trim()}
      </span>
    </div>
  );
}
