"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/helper";
import { findPosHeldOrderForTable } from "@/lib/pos/posTableMapHeld";
import {
  getPosTableMapStatusFill,
  getPosTableMapStatusTextColor,
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
  normalizeTableMapTableName,
} from "@/lib/pos/posTableMaps";
import {
  POS_TABLE_MAP_MERGE_SELECT_FILL,
  POS_TABLE_MAP_MERGE_SELECT_TEXT,
  POS_TABLE_MAP_MERGED_STROKE_WIDTH,
} from "@/lib/pos/posTableMapMerge";
import { TableMapElementGraphic } from "./posTableMapIcons";

export default function PosTableMapFloor({
  tableMap,
  heldOrders = [],
  selfOrderTableKeys = null,
  trackFoodServedOnTableMap = false,
  floorColor = TABLE_MAP_FLOOR_COLOR,
  solidFloor = false,
  selectedTableNames = [],
  mergeColorByTableName = null,
  onTableSelect,
}) {
  const containerRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const canvasSize = getTableMapCanvasSize(tableMap);
  const layout = getTableMapViewportLayout(canvasSize, viewportSize);
  const objects = Array.isArray(tableMap?.objects) ? tableMap.objects : [];
  const floorStyle = solidFloor
    ? { backgroundColor: floorColor }
    : getTableMapFloorStyle(floorColor);
  const selectedKeys = new Set(
    (selectedTableNames || []).map((name) => normalizeTableMapTableName(name)),
  );

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
      style={{ backgroundColor: floorColor }}
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
              ...floorStyle,
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
              const tableKey = normalizeTableMapTableName(tableName);
              const isSelected = tableKey ? selectedKeys.has(tableKey) : false;
              const hasSelfOrderDot =
                Boolean(tableKey) && Boolean(selfOrderTableKeys?.has(tableKey));
              const mergeStroke =
                (tableKey && mergeColorByTableName?.get(tableKey)) || null;
              const fillColor = isSelected
                ? POS_TABLE_MAP_MERGE_SELECT_FILL
                : statusFill || getTableMapBackgroundColor(object);
              const statusLabel =
                status !== POS_TABLE_MAP_STATUS.available
                  ? POS_TABLE_MAP_STATUS_LABEL[status]
                  : null;
              const labelColor = isSelected
                ? POS_TABLE_MAP_MERGE_SELECT_TEXT
                : statusFill && getPosTableMapStatusTextColor(status)
                  ? getPosTableMapStatusTextColor(status)
                  : object.fontColor || TABLE_MAP_DEFAULT_FONT_COLOR;

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
                        ? `Table ${tableName}${statusLabel ? `, ${statusLabel}` : ""}${hasSelfOrderDot ? ", QR self-order" : ""}`
                        : undefined
                    }
                  >
                    <TableMapElementGraphic
                      type={object.type}
                      fillColor={fillColor}
                      strokeColor={mergeStroke || undefined}
                      strokeWidth={
                        mergeStroke
                          ? POS_TABLE_MAP_MERGED_STROKE_WIDTH
                          : undefined
                      }
                    />
                    {hasSelfOrderDot ? (
                      <span
                        className="pointer-events-none absolute right-1 top-1 z-10 size-2.5 rounded-full bg-violet-600 shadow-sm ring-2 ring-white"
                        aria-hidden
                      />
                    ) : null}
                    {shouldShowObjectLabel(object) ? (
                      <ObjectLabel object={object} color={labelColor} />
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

function ObjectLabel({ object, color }) {
  const isVerticalPartition = object.type === "partition-v";

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible px-1">
      <span
        className="whitespace-nowrap text-center font-semibold leading-none"
        style={{
          color: color || object.fontColor || TABLE_MAP_DEFAULT_FONT_COLOR,
          fontSize: object.fontSize || TABLE_MAP_DEFAULT_FONT_SIZE,
          transform: isVerticalPartition ? "rotate(-90deg)" : undefined,
        }}
      >
        {object.name.trim()}
      </span>
    </div>
  );
}
