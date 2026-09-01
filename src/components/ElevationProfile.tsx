"use client";

import { useId, useState } from "react";
import type { ElevationProfileData } from "@/lib/elevation";

const VIEW_W = 400;
const VIEW_H = 64;
const PAD_TOP = 6;
const PAD_BOTTOM = 4;

// Compact elevation-vs-distance chart for a trip's route. Hovering (mouse or
// touch) reports the nearest sample index via onHoverIndex so the caller can
// mirror it as a marker on the map -- this component only draws the chart,
// it has no idea a map exists.
export function ElevationProfile({
  data,
  color,
  glowColor,
  onHoverIndex,
  className,
}: {
  data: ElevationProfileData;
  color: string;
  glowColor: string;
  onHoverIndex: (index: number | null) => void;
  className?: string;
}) {
  const gradientId = useId();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { elevations, cumulativeKm } = data;
  const totalKm = cumulativeKm[cumulativeKm.length - 1] || 1;
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const range = Math.max(max - min, 1);

  const points = elevations.map((e, i) => {
    const x = (cumulativeKm[i] / totalKm) * VIEW_W;
    const y = VIEW_H - PAD_BOTTOM - ((e - min) / range) * (VIEW_H - PAD_TOP - PAD_BOTTOM);
    return [x, y] as const;
  });
  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${VIEW_H} L${points[0][0].toFixed(1)},${VIEW_H} Z`;

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const targetKm = ratio * totalKm;
    // cumulativeKm is monotonically increasing and short (<=120 samples) --
    // a linear scan is plenty fast and simpler than a binary search here.
    let idx = 0;
    for (let i = 1; i < cumulativeKm.length; i++) {
      if (cumulativeKm[i] > targetKm) break;
      idx = i;
    }
    setHoverIdx(idx);
    onHoverIndex(idx);
  }

  function handlePointerLeave() {
    setHoverIdx(null);
    onHoverIndex(null);
  }

  const hoverPoint = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div className={`glass rounded-2xl p-3 flex flex-col gap-1.5 ${className ?? ""}`}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-on-surface-variant font-semibold">
          <span className="material-symbols-outlined text-sm" style={{ color }}>
            terrain
          </span>
          Độ cao
        </div>
        {hoverPoint && hoverIdx !== null ? (
          <span className="font-mono font-semibold" style={{ color }}>
            {Math.round(elevations[hoverIdx])}m · {cumulativeKm[hoverIdx].toFixed(1)}km
          </span>
        ) : (
          <span className="font-mono text-on-surface-variant">
            {Math.round(min)}–{Math.round(max)}m
            <span className="mx-1.5 opacity-40">·</span>
            <span style={{ color }}>+{Math.round(data.gainM)}m</span>
            <span className="mx-1"> </span>
            <span className="opacity-70">-{Math.round(data.lossM)}m</span>
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="w-full h-14 touch-none cursor-crosshair"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {hoverPoint && (
          <g>
            <line
              x1={hoverPoint[0]}
              y1={PAD_TOP}
              x2={hoverPoint[0]}
              y2={VIEW_H}
              stroke={color}
              strokeWidth="1"
              strokeOpacity="0.4"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={hoverPoint[0]} cy={hoverPoint[1]} r="3" fill={color} stroke={glowColor} strokeWidth="4" />
          </g>
        )}
      </svg>
    </div>
  );
}
