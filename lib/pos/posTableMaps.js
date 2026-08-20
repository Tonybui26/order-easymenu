export const TABLE_MAP_CANVAS_WIDTH = 1024;
export const TABLE_MAP_CANVAS_HEIGHT = 600;
export const TABLE_MAP_TABLE_TYPES = ["square-table", "round-table"];
export const TABLE_MAP_PARTITION_TYPES = ["partition-h", "partition-v"];
export const TABLE_MAP_DEFAULT_FONT_COLOR = "#111827";
export const TABLE_MAP_DEFAULT_FONT_SIZE = 14;
export const TABLE_MAP_DEFAULT_TABLE_BACKGROUND = "#ffffff";
export const TABLE_MAP_DEFAULT_PARTITION_BACKGROUND = "#C8C8C8";
export const TABLE_MAP_FLOOR_COLOR = "#402e22";
export const TABLE_MAP_FLOOR_PATTERN_SIZE = { width: 72, height: 24 };

const HERRINGBONE_STRIPS = [
  "-36,-12 0,-48 12,-36 -24,0",
  "-36,12 0,-24 12,-12 -24,24",
  "-36,36 0,0 12,12 -24,48",
  "-36,60 0,24 12,36 -24,72",
  "36,-12 72,-48 84,-36 48,0",
  "0,-24 36,12 48,0 12,-36",
  "36,12 72,-24 84,-12 48,24",
  "0,0 36,36 48,24 12,-12",
  "36,36 72,0 84,12 48,48",
  "0,24 36,60 48,48 12,12",
  "36,60 72,24 84,36 48,72",
  "72,-24 108,12 120,0 84,-36",
  "72,0 108,36 120,24 84,-12",
  "72,24 108,60 120,48 84,12",
];

const HERRINGBONE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="72" height="24" viewBox="0 0 72 24" fill="none">
  ${HERRINGBONE_STRIPS.map(
    (points) =>
      `<polygon points="${points}" fill="none" stroke="rgba(0,0,0,0.28)" stroke-width="1"/>`,
  ).join("")}
</svg>
`.replace(/\s+/g, " ").trim();

export function getTableMapFloorStyle(backgroundColor = TABLE_MAP_FLOOR_COLOR) {
  return {
    backgroundColor,
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(HERRINGBONE_SVG)}")`,
    backgroundRepeat: "repeat",
    backgroundSize: `${TABLE_MAP_FLOOR_PATTERN_SIZE.width}px ${TABLE_MAP_FLOOR_PATTERN_SIZE.height}px`,
  };
}

export function isTableMapTable(object) {
  if (!object) return false;
  if (object.isTable === true) return true;
  return TABLE_MAP_TABLE_TYPES.includes(object.type);
}

export function isTableMapPartition(object) {
  return TABLE_MAP_PARTITION_TYPES.includes(object?.type);
}

export function getTableMapBackgroundColor(object) {
  if (object?.backgroundColor) return object.backgroundColor;
  if (isTableMapPartition(object)) return TABLE_MAP_DEFAULT_PARTITION_BACKGROUND;
  if (isTableMapTable(object)) return TABLE_MAP_DEFAULT_TABLE_BACKGROUND;
  return null;
}

export function getTableMapCanvasSize(tableMap) {
  return {
    width: Number(tableMap?.canvasWidth) || TABLE_MAP_CANVAS_WIDTH,
    height: Number(tableMap?.canvasHeight) || TABLE_MAP_CANVAS_HEIGHT,
  };
}

export function getTableMapTableName(object) {
  if (!isTableMapTable(object)) return "";
  return String(object.name || "").trim();
}

export function normalizeTableMapTableName(value) {
  return String(value || "").trim().toLowerCase();
}

/** Uniform scale so the full design canvas fits inside the viewport (contain). */
export function getTableMapViewportLayout(canvasSize, viewportSize) {
  const canvasWidth = Number(canvasSize?.width) || TABLE_MAP_CANVAS_WIDTH;
  const canvasHeight = Number(canvasSize?.height) || TABLE_MAP_CANVAS_HEIGHT;
  const viewportWidth = Number(viewportSize?.width) || 0;
  const viewportHeight = Number(viewportSize?.height) || 0;

  if (!viewportWidth || !viewportHeight) {
    return {
      scale: 1,
      width: canvasWidth,
      height: canvasHeight,
      canvasWidth,
      canvasHeight,
    };
  }

  const scale = Math.min(
    viewportWidth / canvasWidth,
    viewportHeight / canvasHeight,
  );

  return {
    scale,
    width: canvasWidth * scale,
    height: canvasHeight * scale,
    canvasWidth,
    canvasHeight,
  };
}
