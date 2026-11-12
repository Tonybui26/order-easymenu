"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "#D76228",
  "#f4b392",
  "#64748b",
  "#0f766e",
  "#b45309",
  "#7c3aed",
  "#2563eb",
  "#be123c",
];

const TOP_SLICE_COUNT = 7;

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

/**
 * Build pie slices from product summary rows (by revenue).
 * Top products stay named; the rest roll into Other.
 */
export function buildProductSummaryPieData(rows = []) {
  const sorted = [...(rows || [])]
    .filter((row) => Number(row?.revenue) > 0)
    .sort((a, b) => Number(b.revenue) - Number(a.revenue));

  if (sorted.length === 0) return [];

  const top = sorted.slice(0, TOP_SLICE_COUNT);
  const rest = sorted.slice(TOP_SLICE_COUNT);
  const data = top.map((row) => ({
    name: String(row.productName || "Item"),
    value: Number(row.revenue) || 0,
    quantitySold: Number(row.quantitySold) || 0,
  }));

  if (rest.length > 0) {
    data.push({
      name: "Other",
      value: rest.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0),
      quantitySold: rest.reduce(
        (sum, row) => sum + (Number(row.quantitySold) || 0),
        0,
      ),
    });
  }

  return data;
}

export default function ProductSummaryChart({ data = [] }) {
  const slices = buildProductSummaryPieData(data);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (slices.length === 0) {
    return (
      <div className="border-b border-gray-200 px-4 py-10 text-center text-sm text-gray-500 sm:px-6">
        No product revenue to chart in this range.
      </div>
    );
  }

  return (
    <div className="border-b border-gray-200 px-4 py-5 sm:px-6">
      <p className="mb-3 text-xs font-medium text-gray-500">
        Revenue by product
      </p>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="h-[240px] w-full max-w-[280px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={slices.length > 1 ? 2 : 0}
                stroke="#fff"
                strokeWidth={2}
              >
                {slices.map((slice, index) => (
                  <Cell
                    key={`${slice.name}-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name, item) => {
                  const qty = item?.payload?.quantitySold;
                  const pct =
                    total > 0
                      ? ((Number(value) / total) * 100).toFixed(0)
                      : "0";
                  return [
                    `${formatCurrency(value)} · ${pct}%${
                      qty != null ? ` · qty ${qty}` : ""
                    }`,
                    name,
                  ];
                }}
                contentStyle={{
                  backgroundColor: "#161616",
                  border: "1px solid #2a2a2a",
                  borderRadius: "14px",
                }}
                itemStyle={{ color: "#f5f5f5" }}
                labelStyle={{ color: "#d4d4d8" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="grid w-full grid-cols-1 gap-2 text-xs text-gray-600 sm:grid-cols-2">
          {slices.map((slice, index) => {
            const pct =
              total > 0 ? ((slice.value / total) * 100).toFixed(0) : "0";
            return (
              <li
                key={`${slice.name}-${index}`}
                className="flex items-center gap-2"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="min-w-0 truncate font-medium text-gray-800">
                  {slice.name}
                </span>
                <span className="ml-auto shrink-0 tabular-nums text-gray-500">
                  {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
