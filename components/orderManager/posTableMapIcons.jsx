import { cn } from "@/lib/helper";

const STROKE = "#9A9A9A";
const TABLE_CANVAS_STROKE_WIDTH = 3;

function SvgShell({ children, className }) {
  return (
    <svg
      viewBox="0 0 64 64"
      preserveAspectRatio="none"
      className={cn("block h-full w-full overflow-visible", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function SquareTableIcon({ className, fillColor, strokeColor, strokeWidth }) {
  return (
    <SvgShell className={className}>
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        fill={fillColor || "#ffffff"}
        stroke={strokeColor || STROKE}
        strokeWidth={strokeWidth || TABLE_CANVAS_STROKE_WIDTH}
        vectorEffect="non-scaling-stroke"
      />
    </SvgShell>
  );
}

function RoundTableIcon({ className, fillColor, strokeColor, strokeWidth }) {
  return (
    <SvgShell className={className}>
      <ellipse
        cx="32"
        cy="32"
        rx="30"
        ry="30"
        fill={fillColor || "#ffffff"}
        stroke={strokeColor || STROKE}
        strokeWidth={strokeWidth || TABLE_CANVAS_STROKE_WIDTH}
        vectorEffect="non-scaling-stroke"
      />
    </SvgShell>
  );
}

function TreeIcon({ className }) {
  return (
    <SvgShell className={className}>
      <path
        fill="#5FA84A"
        d="M32 6l5.2 11.8 12.8-2.6-6.2 11.4 11.8 5.4-11.8 5.4 6.2 11.4-12.8-2.6L32 58l-5.2-11.8-12.8 2.6 6.2-11.4L8.4 32l11.8-5.4-6.2-11.4 12.8 2.6L32 6z"
      />
    </SvgShell>
  );
}

function StairsIcon({ className }) {
  const lines = [16, 22, 28, 34, 40, 46];
  return (
    <SvgShell className={className}>
      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        stroke={STROKE}
        strokeWidth="1.75"
        vectorEffect="non-scaling-stroke"
      />
      {lines.map((y) => (
        <line
          key={y}
          x1="4"
          y1={y}
          x2="60"
          y2={y}
          stroke={STROKE}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </SvgShell>
  );
}

function DoorLeftIcon({ className }) {
  return (
    <SvgShell className={className}>
      <line
        x1="14"
        y1="12"
        x2="14"
        y2="52"
        stroke={STROKE}
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M14 12 A40 40 0 0 1 54 52"
        stroke={STROKE}
        strokeWidth="1.75"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </SvgShell>
  );
}

function DoorRightIcon({ className }) {
  return (
    <SvgShell className={className}>
      <line
        x1="50"
        y1="12"
        x2="50"
        y2="52"
        stroke={STROKE}
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M50 12 A40 40 0 0 0 10 52"
        stroke={STROKE}
        strokeWidth="1.75"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </SvgShell>
  );
}

function PartitionHIcon({ className, fillColor }) {
  return (
    <SvgShell className={className}>
      <rect x="0" y="0" width="64" height="64" fill={fillColor || "#C8C8C8"} />
    </SvgShell>
  );
}

function PartitionVIcon({ className, fillColor }) {
  return (
    <SvgShell className={className}>
      <rect x="0" y="0" width="64" height="64" fill={fillColor || "#C8C8C8"} />
    </SvgShell>
  );
}

const ICONS = {
  "square-table": SquareTableIcon,
  "round-table": RoundTableIcon,
  tree: TreeIcon,
  stairs: StairsIcon,
  "door-left": DoorLeftIcon,
  "door-right": DoorRightIcon,
  "partition-h": PartitionHIcon,
  "partition-v": PartitionVIcon,
};

export function TableMapElementGraphic({
  type,
  className = "block h-full w-full",
  fillColor,
  strokeColor,
  strokeWidth,
}) {
  const Icon = ICONS[type];
  if (!Icon) return null;
  return (
    <Icon
      className={className}
      fillColor={fillColor}
      strokeColor={strokeColor}
      strokeWidth={strokeWidth}
    />
  );
}
