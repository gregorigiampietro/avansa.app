"use client";

export interface ChartSlice {
  condition: string;
  label: string;
  quantity: number;
  color: string;
}

interface InventoryChartProps {
  data: ChartSlice[];
  activeCondition: string | null;
  onSliceClick: (condition: string | null) => void;
}

const RADIUS = 80;
const STROKE_WIDTH = 32;
const CENTER = RADIUS + STROKE_WIDTH / 2 + 4;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SVG_SIZE = CENTER * 2;

export function InventoryChart({
  data,
  activeCondition,
  onSliceClick,
}: InventoryChartProps) {
  const total = data.reduce((sum, d) => sum + d.quantity, 0);

  if (total === 0) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Sem dados de estoque
        </p>
      </div>
    );
  }

  // Filter out zero-quantity slices
  const slices = data.filter((d) => d.quantity > 0);

  // Calculate offsets for each slice
  let cumulativeOffset = 0;
  const arcs = slices.map((slice) => {
    const ratio = slice.quantity / total;
    const dashLength = ratio * CIRCUMFERENCE;
    const offset = cumulativeOffset;
    cumulativeOffset += dashLength;
    return { ...slice, dashLength, offset, ratio };
  });

  // Active slice info for center text
  const activeSlice = activeCondition
    ? slices.find((s) => s.condition === activeCondition)
    : null;

  const centerValue = activeSlice
    ? activeSlice.quantity.toLocaleString("pt-BR")
    : total.toLocaleString("pt-BR");

  const centerLabel = activeSlice ? activeSlice.label : "Total";

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 text-sm font-medium text-foreground">
        Estoque por Condição
      </h3>

      {/* Donut chart */}
      <div className="flex justify-center">
        <svg
          width={SVG_SIZE}
          height={SVG_SIZE}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          className="cursor-pointer"
        >
          {/* Background circle */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            className="text-muted/20"
          />

          {/* Slices — rendered in reverse so first slice is on top visually */}
          {arcs.map((arc) => {
            const isActive = activeCondition === arc.condition;
            const isDimmed = activeCondition !== null && !isActive;

            return (
              <circle
                key={arc.condition}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={arc.color}
                strokeWidth={isActive ? STROKE_WIDTH + 6 : STROKE_WIDTH}
                strokeDasharray={`${arc.dashLength} ${CIRCUMFERENCE - arc.dashLength}`}
                strokeDashoffset={-arc.offset}
                opacity={isDimmed ? 0.3 : 1}
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
                className="transition-all duration-200"
                style={{ cursor: "pointer" }}
                onClick={() =>
                  onSliceClick(isActive ? null : arc.condition)
                }
              />
            );
          })}

          {/* Center text */}
          <text
            x={CENTER}
            y={CENTER - 8}
            textAnchor="middle"
            className="fill-foreground text-2xl font-light"
            style={{ fontSize: "24px" }}
          >
            {centerValue}
          </text>
          <text
            x={CENTER}
            y={CENTER + 14}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: "11px" }}
          >
            {centerLabel}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {slices.map((slice) => {
          const isActive = activeCondition === slice.condition;
          const isDimmed = activeCondition !== null && !isActive;

          return (
            <button
              key={slice.condition}
              onClick={() =>
                onSliceClick(isActive ? null : slice.condition)
              }
              className={`flex items-center gap-2 rounded px-2 py-1 text-left transition-all ${
                isActive
                  ? "bg-muted/50"
                  : isDimmed
                    ? "opacity-40"
                    : "hover:bg-muted/30"
              }`}
            >
              <span
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-xs text-muted-foreground">
                {slice.label}
              </span>
              <span className="ml-auto text-xs font-medium text-foreground">
                {slice.quantity.toLocaleString("pt-BR")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
