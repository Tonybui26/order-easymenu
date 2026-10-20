"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatAxisCurrency(value) {
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  return `$${value}`;
}

const SERIES = [
  { key: "cash", label: "Cash", color: "#f4b392" },
  { key: "card", label: "Card", color: "#D76228" },
  { key: "other", label: "Other", color: "#64748b" },
];

export default function SalesSummaryChart({ data = [] }) {
  return (
    <div className="border-b border-gray-200 px-4 py-5 sm:px-6">
      <div className="mb-4 flex items-center gap-4 text-xs text-gray-500">
        {SERIES.map((series) => (
          <div key={series.key} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: series.color }}
            />
            <span>{series.label}</span>
          </div>
        ))}
      </div>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="salesCashFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f4b392" stopOpacity={0.55} />
                <stop offset="95%" stopColor="#f4b392" stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="salesCardFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D76228" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#D76228" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="salesOtherFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#64748b" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#64748b" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#b0afae", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: "#b0afae", fontSize: 11 }}
              tickFormatter={formatAxisCurrency}
              tickLine={false}
              axisLine={false}
              width={46}
            />
            <Tooltip
              formatter={(value, name) => [
                formatCurrency(value),
                SERIES.find((series) => series.key === name)?.label || name,
              ]}
              labelFormatter={(label, payload) =>
                payload?.[0]?.payload?.fullLabel || label
              }
              contentStyle={{
                backgroundColor: "#161616",
                border: "1px solid #2a2a2a",
                borderRadius: "14px",
              }}
              itemStyle={{ color: "#f5f5f5" }}
              labelStyle={{ color: "#d4d4d8" }}
              cursor={{ stroke: "#5b5b5b", strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="cash"
              stackId="sales"
              stroke="#f4b392"
              strokeWidth={2}
              fill="url(#salesCashFill)"
              dot={{ r: 3, fill: "#f4b392", stroke: "#fff" }}
              activeDot={{ r: 5, fill: "#f4b392", stroke: "#0f172a" }}
            />
            <Area
              type="monotone"
              dataKey="card"
              stackId="sales"
              stroke="#D76228"
              strokeWidth={2}
              fill="url(#salesCardFill)"
              dot={{ r: 3, fill: "#D76228", stroke: "#fff" }}
              activeDot={{ r: 5, fill: "#D76228", stroke: "#0f172a" }}
            />
            <Area
              type="monotone"
              dataKey="other"
              stackId="sales"
              stroke="#64748b"
              strokeWidth={2}
              fill="url(#salesOtherFill)"
              dot={{ r: 3, fill: "#64748b", stroke: "#fff" }}
              activeDot={{ r: 5, fill: "#64748b", stroke: "#0f172a" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
