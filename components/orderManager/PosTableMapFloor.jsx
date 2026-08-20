"use client";

import {
  TABLE_MAP_DEFAULT_FONT_COLOR,
  TABLE_MAP_DEFAULT_FONT_SIZE,
  getTableMapBackgroundColor,
  getTableMapCanvasSize,
  getTableMapFloorStyle,
  isTableMapPartition,
  isTableMapTable,
} from "@/lib/pos/posTableMaps";
import { TableMapElementGraphic } from "./posTableMapIcons";

export default function PosTableMapFloor({ tableMap }) {
  const { width, height } = getTableMapCanvasSize(tableMap);
  const objects = Array.isArray(tableMap?.objects) ? tableMap.objects : [];

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={getTableMapFloorStyle()}
    >
      <div className="relative z-[1] h-full w-full [container-type:size]">
        {objects.map((object) => (
          <div
            key={object.id}
            className="absolute"
            style={{
              left: `${(Number(object.x) / width) * 100}%`,
              top: `${(Number(object.y) / height) * 100}%`,
              width: `${(Number(object.width) / width) * 100}%`,
              height: `${(Number(object.height) / height) * 100}%`,
              transform: `rotate(${object.rotation || 0}deg)`,
            }}
          >
            <div className="relative h-full w-full overflow-visible">
              <TableMapElementGraphic
                type={object.type}
                fillColor={getTableMapBackgroundColor(object)}
              />
              {shouldShowObjectLabel(object) ? (
                <ObjectLabel object={object} canvasWidth={width} />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function shouldShowObjectLabel(object) {
  if (!object?.name?.trim()) return false;
  return isTableMapTable(object) || isTableMapPartition(object);
}

function ObjectLabel({ object, canvasWidth }) {
  const isVerticalPartition = object.type === "partition-v";
  const fontSize = Number(object.fontSize) || TABLE_MAP_DEFAULT_FONT_SIZE;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible px-1">
      <span
        className="whitespace-nowrap text-center font-semibold leading-none"
        style={{
          color: object.fontColor || TABLE_MAP_DEFAULT_FONT_COLOR,
          fontSize: `calc(${fontSize} * 100cqw / ${canvasWidth})`,
          transform: isVerticalPartition ? "rotate(-90deg)" : undefined,
        }}
      >
        {object.name.trim()}
      </span>
    </div>
  );
}
