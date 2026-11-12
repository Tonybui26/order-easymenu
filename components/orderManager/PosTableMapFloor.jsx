"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { cn } from "@/lib/helper";
import { findHeldOrderForTableMap } from "@/lib/pos/posTableMapHeld";
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
  POS_TABLE_MAP_NAVIGATING_FILL,
  POS_TABLE_MAP_NAVIGATING_STROKE,
  POS_TABLE_MAP_NAVIGATING_STROKE_WIDTH,
  POS_TABLE_MAP_NAVIGATING_TEXT,
} from "@/lib/pos/posTableMapMerge";
import { TableMapElementGraphic } from "./posTableMapIcons";

/** Portrait phones: give the floor a landscape stage so wide maps scale larger. */
const PORTRAIT_LANDSCAPE_MAX_WIDTH = 768;

function shouldUsePortraitLandscapeStage(hostSize) {
  const width = Number(hostSize?.width) || 0;
  const height = Number(hostSize?.height) || 0;
  return width > 0 && height > width && width < PORTRAIT_LANDSCAPE_MAX_WIDTH;
}

export default function PosTableMapFloor({
  tableMap,
  heldOrders = [],
  selfOrderTableKeys = null,
  unpaidQrPaymentTableKeys = null,
  bookingsByTableKey = null,
  floorColor = TABLE_MAP_FLOOR_COLOR,
  solidFloor = false,
  selectedTableNames = [],
  navigatingTableNames = [],
  disableInteraction = false,
  mergeColorByTableName = null,
  manualOpenTableKeys = null,
  onTableSelect,
}) {
  const containerRef = useRef(null);
  const [hostSize, setHostSize] = useState({ width: 0, height: 0 });
  const useLandscapeStage = shouldUsePortraitLandscapeStage(hostSize);
  const viewportSize = useLandscapeStage
    ? { width: hostSize.height, height: hostSize.width }
    : hostSize;
  const canvasSize = getTableMapCanvasSize(tableMap);
  const layout = getTableMapViewportLayout(canvasSize, viewportSize);
  const objects = Array.isArray(tableMap?.objects) ? tableMap.objects : [];
  const floorStyle = solidFloor
    ? { backgroundColor: floorColor }
    : getTableMapFloorStyle(floorColor);
  const selectedKeys = new Set(
    (selectedTableNames || []).map((name) => normalizeTableMapTableName(name)),
  );
  const navigatingKeys = new Set(
    (navigatingTableNames || []).map((name) =>
      normalizeTableMapTableName(name),
    ),
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    function updateHostSize() {
      setHostSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    }

    updateHostSize();
    const observer = new ResizeObserver(updateHostSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 overflow-hidden",
        disableInteraction && "pointer-events-none",
      )}
      style={{ backgroundColor: floorColor }}
    >
      <div
        className={cn(
          "flex items-center justify-center",
          useLandscapeStage
            ? "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90"
            : "h-full w-full",
        )}
        style={
          useLandscapeStage
            ? { width: hostSize.height, height: hostSize.width }
            : undefined
        }
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
                ? findHeldOrderForTableMap(heldOrders, tableName)
                : null;
              const tableKey = normalizeTableMapTableName(tableName);
              let status = resolvePosTableMapStatus(heldOrder);
              if (
                tableKey &&
                manualOpenTableKeys?.has(tableKey) &&
                status === POS_TABLE_MAP_STATUS.available
              ) {
                status = POS_TABLE_MAP_STATUS.occupied;
              }
              const statusFill = getPosTableMapStatusFill(status);
              const isSelected = tableKey ? selectedKeys.has(tableKey) : false;
              const isNavigating = tableKey ? navigatingKeys.has(tableKey) : false;
              const hasSelfOrderDot =
                Boolean(tableKey) && Boolean(selfOrderTableKeys?.has(tableKey));
              const hasUnpaidQrPaymentDot =
                Boolean(tableKey) &&
                Boolean(unpaidQrPaymentTableKeys?.has(tableKey));
              const tableBookings = tableKey
                ? bookingsByTableKey?.get(tableKey) || []
                : [];
              const mergeStroke =
                (tableKey && mergeColorByTableName?.get(tableKey)) || null;
              const fillColor = isSelected
                ? POS_TABLE_MAP_MERGE_SELECT_FILL
                : isNavigating
                  ? POS_TABLE_MAP_NAVIGATING_FILL
                  : statusFill || getTableMapBackgroundColor(object);
              const statusLabel =
                status !== POS_TABLE_MAP_STATUS.available
                  ? POS_TABLE_MAP_STATUS_LABEL[status]
                  : null;
              const labelColor = isSelected
                ? POS_TABLE_MAP_MERGE_SELECT_TEXT
                : isNavigating
                  ? POS_TABLE_MAP_NAVIGATING_TEXT
                  : statusFill && getPosTableMapStatusTextColor(status)
                    ? getPosTableMapStatusTextColor(status)
                    : object.fontColor || TABLE_MAP_DEFAULT_FONT_COLOR;
              const tableStrokeColor = isNavigating
                ? POS_TABLE_MAP_NAVIGATING_STROKE
                : mergeStroke || undefined;
              const tableStrokeWidth = isNavigating
                ? POS_TABLE_MAP_NAVIGATING_STROKE_WIDTH
                : mergeStroke
                  ? POS_TABLE_MAP_MERGED_STROKE_WIDTH
                  : undefined;
              const indicatorHints = [
                tableBookings.length
                  ? `booked ${tableBookings.map((booking) => booking.timeLabel).join(", ")}`
                  : null,
                hasSelfOrderDot ? "QR self-order" : null,
                hasUnpaidQrPaymentDot ? "payment due" : null,
              ]
                .filter(Boolean)
                .join(", ");
              const objectRotation = Number(object.rotation) || 0;
              // Keep table HUD readable on the portrait landscape stage; partitions stay as-is.
              const tableHudUprightTransform =
                useLandscapeStage && isTable
                  ? `rotate(${-objectRotation - 90}deg)`
                  : undefined;

              return (
                <div
                  key={object.id}
                  className={cn(
                    "absolute transition-transform duration-150",
                    isNavigating && "z-10 scale-[1.04]",
                  )}
                  style={{
                    left: object.x,
                    top: object.y,
                    width: object.width,
                    height: object.height,
                    transform: `rotate(${objectRotation}deg)`,
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
                      "relative h-full w-full overflow-visible border-0 bg-transparent p-0 transition-transform duration-100",
                      isInteractive
                        ? "cursor-pointer touch-manipulation active:scale-[0.97]"
                        : "cursor-default",
                    )}
                    aria-label={
                      isInteractive
                        ? `Table ${tableName}${statusLabel ? `, ${statusLabel}` : ""}${indicatorHints ? `, ${indicatorHints}` : ""}`
                        : undefined
                    }
                  >
                    <TableMapElementGraphic
                      type={object.type}
                      fillColor={fillColor}
                      strokeColor={tableStrokeColor}
                      strokeWidth={tableStrokeWidth}
                    />
                    {hasSelfOrderDot || hasUnpaidQrPaymentDot ? (
                      <span
                        className="pointer-events-none absolute right-1 top-1 z-10 flex items-center gap-0.5"
                        style={{ transform: tableHudUprightTransform }}
                        aria-hidden
                      >
                        {hasSelfOrderDot ? (
                          <span className="size-2.5 rounded-full bg-violet-600 shadow-sm ring-2 ring-white" />
                        ) : null}
                        {hasUnpaidQrPaymentDot ? (
                          <span className="size-2.5 rounded-full bg-red-600 shadow-sm ring-2 ring-white" />
                        ) : null}
                      </span>
                    ) : null}
                    {shouldShowObjectLabel(object) ? (
                      <ObjectLabel
                        object={object}
                        color={labelColor}
                        bookings={tableBookings}
                        keepScreenUpright={Boolean(tableHudUprightTransform)}
                      />
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}

function shouldShowObjectLabel(object) {
  if (!object?.name?.trim()) return false;
  return isTableMapTable(object) || isTableMapPartition(object);
}

function ObjectLabel({
  object,
  color,
  bookings = [],
  keepScreenUpright = false,
}) {
  const isVerticalPartition = object.type === "partition-v";
  const labelColor = color || object.fontColor || TABLE_MAP_DEFAULT_FONT_COLOR;
  const nameSize = object.fontSize || TABLE_MAP_DEFAULT_FONT_SIZE;
  const showBookings = !isVerticalPartition && bookings.length > 0;
  const objectRotation = Number(object.rotation) || 0;
  const labelTransform = keepScreenUpright
    ? `rotate(${-objectRotation - 90}deg)`
    : isVerticalPartition
      ? "rotate(-90deg)"
      : undefined;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible px-1">
      <div
        className="flex max-w-full flex-col items-center"
        style={{
          transform: labelTransform,
        }}
      >
        <span
          className="whitespace-nowrap text-center font-semibold leading-none"
          style={{
            color: labelColor,
            fontSize: nameSize,
          }}
        >
          {object.name.trim()}
        </span>
        {showBookings ? (
          <span className="mt-1 flex max-w-full flex-col items-center gap-0.5">
            {bookings.map((booking) => (
              <span
                key={booking.id}
                className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-brand_accent px-1 py-px leading-none text-white shadow-sm"
                style={{ fontSize: 9 }}
              >
                <CalendarCheck
                  aria-hidden
                  className="shrink-0"
                  size={9}
                  strokeWidth={2.5}
                />
                <span className="truncate font-semibold">{booking.timeLabel}</span>
              </span>
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );
}
