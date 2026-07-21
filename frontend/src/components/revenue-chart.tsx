"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatPrice } from "@/lib/pricing";

export type ChartType = "bar" | "line" | "area";

export const CHART_TYPES: { label: string; value: ChartType }[] = [
  { label: "Bar", value: "bar" },
  { label: "Line", value: "line" },
  { label: "Area", value: "area" },
];

export interface ChartPoint {
  /** Stable React key. */
  key: string;
  /** Pre-formatted axis label ("Jul 21") — the caller owns date formatting. */
  label: string;
  value: number;
  /** Optional second tooltip line, e.g. "3 orders". */
  note?: string;
  /** Emphasised bucket — today, or the current week/month. */
  current?: boolean;
}

const H = 192; // plot height
const PAD_TOP = 12; // headroom so the peak marker and its ring aren't clipped
const GAP = 8; // gutter between columns at comfortable widths
const MIN_BAR = 3; // a zero bucket still reads as a column, not a gap
const MAX_STAGGER = 600; // cap the entrance sweep on long windows

/** Rounded only at the data end, square where it meets the baseline. */
function barPath(x: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  const y = H - h;
  return (
    `M${x},${H} L${x},${y + r} Q${x},${y} ${x + r},${y} ` +
    `L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${H} Z`
  );
}

/**
 * Revenue over a window, drawn as bars, a line, or an area.
 *
 * All three share one geometry model and one SVG so the marks, the hover
 * targets and the axis labels stay aligned when the type changes — the columns
 * don't shift under you, only the mark does.
 *
 * One series, so there is no legend: the section heading names the measure.
 */
export function RevenueChart({
  points,
  type,
  color = "var(--pos-button)",
  currentColor,
}: {
  points: ChartPoint[];
  type: ChartType;
  /** Mark colour. Defaults to the themeable brand accent. */
  color?: string;
  /** Colour for `current` buckets; falls back to `color`. */
  currentColor?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gradientId = useId();
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [grown, setGrown] = useState(false);

  // The SVG is drawn at real pixel size rather than scaled from a fixed
  // viewBox — scaling would stretch stroke widths and turn markers into
  // ellipses.
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Bars sweep up from the baseline on first paint.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const n = points.length;
  const max = useMemo(
    () => Math.max(1, ...points.map((p) => p.value)),
    [points],
  );

  const geo = useMemo(() => {
    // The gutter shrinks on crowded windows (a year is 200+ columns), so the
    // columns keep fitting the container instead of overflowing it.
    const gap = n > 1 ? Math.min(GAP, (width / n) * 0.35) : 0;
    const colW = n > 0 ? Math.max(1, (width - gap * (n - 1)) / n) : 0;
    return {
      gap,
      colW,
      cx: (i: number) => i * (colW + gap) + colW / 2,
      y: (v: number) => H - (v / max) * (H - PAD_TOP),
    };
  }, [width, n, max]);

  // Only label every k-th bucket once the window gets long, otherwise the axis
  // turns into an unreadable smear.
  const labelStep = Math.ceil(n / 12);
  const showValues = n <= 14;
  const showMarkers = n <= 14;
  const stagger = n > 0 ? Math.min(70, MAX_STAGGER / n) : 0;

  const linePath = points
    .map((p, i) => `${i ? "L" : "M"}${geo.cx(i)},${geo.y(p.value)}`)
    .join(" ");
  const areaPath =
    n > 0 ? `${linePath} L${geo.cx(n - 1)},${H} L${geo.cx(0)},${H} Z` : "";

  const active = hover !== null ? points[hover] : null;
  const colorFor = (p: ChartPoint) =>
    p.current && currentColor ? currentColor : color;

  return (
    <div>
      <div ref={wrapRef} className="relative" style={{ height: H }}>
        {width > 0 && (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`Revenue across ${n} buckets, peak ${formatPrice(max)}`}
            className="overflow-visible"
          >
            {/* Recessive gridlines — reference, not decoration. */}
            {[0, 0.5, 1].map((t) => (
              <line
                key={t}
                x1={0}
                x2={width}
                y1={geo.y(max * t)}
                y2={geo.y(max * t)}
                className="stroke-stone-200 dark:stroke-stone-700"
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : "3 3"}
              />
            ))}

            {type === "area" && (
              <>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.03" />
                  </linearGradient>
                </defs>
                <path d={areaPath} fill={`url(#${gradientId})`} />
              </>
            )}

            {type === "bar"
              ? points.map((p, i) => {
                  const h = Math.max(MIN_BAR, H - geo.y(p.value));
                  return (
                    <path
                      key={p.key}
                      d={barPath(geo.cx(i) - geo.colW / 2, geo.colW, h)}
                      fill={colorFor(p)}
                      opacity={hover === null || hover === i ? 1 : 0.45}
                      style={{
                        transformBox: "fill-box",
                        transformOrigin: "bottom",
                        transform: `scaleY(${grown ? 1 : 0})`,
                        transition:
                          "transform 700ms cubic-bezier(0.22,1,0.36,1), opacity 200ms",
                        transitionDelay: `${i * stagger}ms`,
                      }}
                    />
                  );
                })
              : null}

            {(type === "line" || type === "area") && (
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Markers: always for the hovered and current buckets, otherwise
                only when the window is short enough that they don't merge. */}
            {(type === "line" || type === "area") &&
              points.map((p, i) =>
                showMarkers || hover === i || p.current ? (
                  <circle
                    key={p.key}
                    cx={geo.cx(i)}
                    cy={geo.y(p.value)}
                    r={hover === i ? 5 : 4}
                    fill={colorFor(p)}
                    strokeWidth={2}
                    className="stroke-white dark:stroke-stone-900"
                  />
                ) : null,
              )}

            {/* Crosshair for the hovered column. */}
            {active && (
              <line
                x1={geo.cx(hover!)}
                x2={geo.cx(hover!)}
                y1={0}
                y2={H}
                className="stroke-stone-300 dark:stroke-stone-600"
                strokeWidth={1}
              />
            )}

            {/* Full-height hit targets — bigger than the marks, no dead zones. */}
            {points.map((p, i) => (
              <rect
                key={p.key}
                x={geo.cx(i) - (geo.colW + geo.gap) / 2}
                y={0}
                width={geo.colW + geo.gap}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </svg>
        )}

        {active && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg dark:bg-stone-100 dark:text-stone-900"
            style={{
              // Clamped so the tooltip never hangs off either edge.
              left: Math.min(
                Math.max(geo.cx(hover!), 60),
                Math.max(width - 60, 60),
              ),
              top: geo.y(active.value) - 10,
            }}
          >
            <span className="font-semibold">{formatPrice(active.value)}</span>
            {active.note && <span className="opacity-70"> · {active.note}</span>}
            <span className="block opacity-60">{active.label}</span>
          </div>
        )}
      </div>

      {/* Axis — same column model as the plot, so ticks sit under their mark. */}
      <div className="relative mt-2" style={{ height: showValues ? 32 : 18 }}>
        {width > 0 &&
          points.map((p, i) =>
            i % labelStep === 0 || hover === i || p.current ? (
              <div
                key={p.key}
                className="absolute -translate-x-1/2 text-center leading-tight"
                style={{ left: geo.cx(i) }}
              >
                <p
                  className={`text-xs whitespace-nowrap ${
                    hover === i
                      ? "font-semibold text-stone-900 dark:text-stone-100"
                      : "font-medium text-stone-600 dark:text-stone-400"
                  }`}
                >
                  {p.label}
                </p>
                {showValues && (
                  <p className="text-[11px] whitespace-nowrap text-stone-400 dark:text-stone-500">
                    {formatPrice(p.value)}
                  </p>
                )}
              </div>
            ) : null,
          )}
      </div>
    </div>
  );
}
