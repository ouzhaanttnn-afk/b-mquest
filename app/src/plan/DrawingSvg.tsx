import React from 'react';
import type { Drawing, FillKind, Prim } from '../domain/viewDrawing';

const FILL_LIGHT: Record<FillKind, string> = {
  cut: '#0F172A',
  beyond: '#E2E8F0',
  glass: '#BAE6FD',
  door: '#FDBA74',
  slab: '#94A3B8',
  roof: '#FDBA74',
  stair: '#C4B5FD',
  room: 'rgba(56,189,248,0.18)',
  none: 'none',
};
const FILL_DARK: Record<FillKind, string> = {
  cut: '#F1F5F9',
  beyond: '#334155',
  glass: '#0C4A6E',
  door: '#9A3412',
  slab: '#64748B',
  roof: '#9A3412',
  stair: '#5B21B6',
  room: 'rgba(56,189,248,0.2)',
  none: 'none',
};

const STROKE = (isDark: boolean) => (isDark ? '#CBD5E1' : '#0F172A');

const primEl = (p: Prim, i: number, isDark: boolean) => {
  const fills = isDark ? FILL_DARK : FILL_LIGHT;
  const stroke = STROKE(isDark);
  switch (p.t) {
    case 'rect':
      return (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          fill={fills[p.fill]}
          stroke={p.fill === 'room' ? 'none' : stroke}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          data-prim={p.id}
        />
      );
    case 'poly':
      return (
        <polygon
          key={i}
          points={p.pts.map(([x, y]) => `${x},${y}`).join(' ')}
          fill={fills[p.fill]}
          stroke={stroke}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      );
    case 'line': {
      const dash =
        p.style === 'level' ? '180 90' : p.style === 'swing' ? undefined : p.style === 'thin' ? '60 60' : undefined;
      const color =
        p.style === 'dim' ? '#38BDF8' : p.style === 'level' ? '#38BDF8' : p.style === 'swing' ? '#F97316' : stroke;
      return (
        <line
          key={i}
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          stroke={color}
          strokeWidth={p.style === 'ground' ? 2 : 1}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    case 'text':
      return (
        <text
          key={i}
          x={p.x}
          y={p.y}
          fontSize={p.size}
          textAnchor={p.anchor ?? 'start'}
          fill={p.tone === 'dim' ? '#38BDF8' : p.tone === 'tag' ? '#F97316' : stroke}
          fontWeight={600}
        >
          {p.s}
        </text>
      );
  }
};

export const DrawingPrims: React.FC<{ drawing: Drawing; isDark?: boolean }> = ({
  drawing,
  isDark = true,
}) => <>{drawing.prims.map((p, i) => primEl(p, i, isDark))}</>;

/** A section / elevation / plan drawing as a standalone SVG. */
export const DrawingSvg: React.FC<{
  drawing: Drawing;
  isDark?: boolean;
  testId?: string;
  title?: string;
}> = ({ drawing, isDark = true, testId, title }) => (
  <svg
    className="bq-drawing-svg"
    viewBox={`${drawing.minX} ${drawing.minY} ${drawing.width} ${drawing.height}`}
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label={title}
    data-testid={testId}
  >
    <rect
      x={drawing.minX}
      y={drawing.minY}
      width={drawing.width}
      height={drawing.height}
      fill={isDark ? '#071426' : '#F8FAFC'}
    />
    <DrawingPrims drawing={drawing} isDark={isDark} />
  </svg>
);
