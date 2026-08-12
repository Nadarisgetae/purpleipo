'use client';

import React, { useMemo } from 'react';

interface DataPoint {
  stage: number;
  composite: number;
  rhp: number;
  independent: number;
  news: number;
}

interface ScoreHistoryChartProps {
  data: DataPoint[];
  height?: number;
}

const STAGE_LABELS: Record<number, string> = {
  1: 'Ideation', 2: 'DRHP Filed', 3: 'SEBI Review', 4: 'SEBI Approved',
  5: 'DRHP Public', 6: 'RHP Filed', 7: 'Anchor Allot', 8: 'Bidding',
  9: 'Allotment', 10: 'Listing', 11: 'Post-Listing', 12: 'Tracked',
};

const LINES = [
  { key: 'composite', label: 'Composite', color: '#a855f7', width: 2.5, dash: '' },
  { key: 'rhp', label: 'RHP (L1)', color: '#6366f1', width: 1.5, dash: '4,3' },
  { key: 'independent', label: 'Signals (L2)', color: '#38bdf8', width: 1.5, dash: '4,3' },
  { key: 'news', label: 'Sentiment (L3)', color: '#34d399', width: 1.5, dash: '4,3' },
] as const;

export default function ScoreHistoryChart({ data, height = 200 }: ScoreHistoryChartProps) {
  const padLeft = 36;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 48;

  const chartW = 600;
  const chartH = height;
  const innerW = chartW - padLeft - padRight;
  const innerH = chartH - padTop - padBottom;

  const points = useMemo(() => {
    if (data.length === 0) return {};
    const minX = Math.min(...data.map(d => d.stage));
    const maxX = Math.max(...data.map(d => d.stage));
    const xRange = Math.max(maxX - minX, 1);

    const toSvg = (stage: number, score: number) => ({
      x: padLeft + ((stage - minX) / xRange) * innerW,
      y: padTop + (1 - score / 100) * innerH,
    });

    const result: Record<string, { x: number; y: number; stage: number; score: number }[]> = {};
    for (const line of LINES) {
      result[line.key] = data.map(d => ({
        ...toSvg(d.stage, d[line.key]),
        stage: d.stage,
        score: d[line.key],
      }));
    }
    return result;
  }, [data, innerW, innerH, padLeft, padTop]);

  const toPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  };

  // Y-axis grid lines at 0, 25, 50, 75, 100
  const yGridLines = [0, 25, 50, 75, 100];

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-xl border border-dashed border-slate-700 text-xs text-slate-500">
        No score history yet. Run any scoring engine to record a snapshot.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="w-full"
        style={{ minWidth: '320px' }}
        aria-label="Score history chart"
      >
        {/* Background */}
        <rect x="0" y="0" width={chartW} height={chartH} fill="transparent" />

        {/* Y-axis grid + labels */}
        {yGridLines.map(val => {
          const y = padTop + (1 - val / 100) * innerH;
          return (
            <g key={val}>
              <line
                x1={padLeft} y1={y} x2={padLeft + innerW} y2={y}
                stroke={val === 50 ? '#475569' : '#1e293b'}
                strokeWidth={val === 50 ? 1 : 0.75}
                strokeDasharray={val === 50 ? '' : '3,3'}
              />
              <text x={padLeft - 6} y={y + 4} fontSize="9" fill="#64748b" textAnchor="end">
                {val}
              </text>
            </g>
          );
        })}

        {/* "Buy Zone" shading (65–80) */}
        <rect
          x={padLeft} y={padTop + (1 - 80 / 100) * innerH}
          width={innerW} height={(80 - 65) / 100 * innerH}
          fill="#6366f1" opacity="0.04"
        />
        <text
          x={padLeft + innerW - 4} y={padTop + (1 - 72.5 / 100) * innerH + 3}
          fontSize="8" fill="#6366f1" opacity="0.5" textAnchor="end"
        >
          Buy Zone
        </text>

        {/* Area fill for composite */}
        {(points['composite']?.length ?? 0) > 0 && (() => {
          const pts = points['composite'];
          const areaPath = `${toPath(pts)} L ${pts[pts.length - 1].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`;
          return (
            <path d={areaPath} fill="#a855f7" opacity="0.06" />
          );
        })()}

        {/* Data lines */}
        {LINES.map(line => {
          const pts = points[line.key] ?? [];
          if (pts.length === 0) return null;
          return (
            <path
              key={line.key}
              d={toPath(pts)}
              fill="none"
              stroke={line.color}
              strokeWidth={line.width}
              strokeDasharray={line.dash}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={line.key === 'composite' ? 1 : 0.7}
            />
          );
        })}

        {/* Data dots + tooltips (composite only) */}
        {(points['composite'] ?? []).map((pt, i) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r={5} fill="#1e1b4b" stroke="#a855f7" strokeWidth={2} />
            <circle cx={pt.x} cy={pt.y} r={2.5} fill="#a855f7" />
            {/* Stage label below x-axis */}
            <text
              x={pt.x} y={padTop + innerH + 14}
              fontSize="8" fill="#64748b" textAnchor="middle"
              transform={`rotate(-30, ${pt.x}, ${padTop + innerH + 14})`}
            >
              {STAGE_LABELS[pt.stage] ?? `S${pt.stage}`}
            </text>
            {/* Score value above dot */}
            <text x={pt.x} y={pt.y - 8} fontSize="9" fill="#a855f7" textAnchor="middle" fontWeight="bold">
              {pt.score.toFixed(0)}
            </text>
          </g>
        ))}

        {/* Legend */}
        {LINES.map((line, i) => (
          <g key={line.key} transform={`translate(${padLeft + i * 130}, ${chartH - 10})`}>
            <line x1={0} y1={0} x2={18} y2={0} stroke={line.color} strokeWidth={line.key === 'composite' ? 2.5 : 1.5} strokeDasharray={line.dash} />
            <text x={22} y={3} fontSize="9" fill="#94a3b8">{line.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
