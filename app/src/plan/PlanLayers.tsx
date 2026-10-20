import React from 'react';
import { roomBoundary, wallLengthMm } from '../domain/derived';
import type {
  BimModel,
  FloorElement,
  GridElement,
  Point,
  RoofElement,
  RoomElement,
  StairElement,
  WallElement,
  WindowElement,
} from '../domain/types';
import { getWallDirection } from './geometry';

interface LayerProps {
  model: BimModel;
  selectedId: string | null;
  failedElementIds: Set<string>;
  showLabels: boolean;
  isDark: boolean;
  onSelect: (id: string | null) => void;
  /** false while a drawing tool is active: taps fall through to the plan. */
  interactive?: boolean;
  onOpeningPointerDown?: (id: string) => void;
}

const SEL = '#38BDF8';
const ERR = '#EF4444';

const pts = (poly: Point[]) => poly.map(([x, z]) => `${x},${z}`).join(' ');

const centroid = (poly: Point[]): Point => {
  const n = poly.length || 1;
  return [
    poly.reduce((s, p) => s + p[0], 0) / n,
    poly.reduce((s, p) => s + p[1], 0) / n,
  ];
};

const bounds = (poly: Point[]) => ({
  minX: Math.min(...poly.map((p) => p[0])),
  maxX: Math.max(...poly.map((p) => p[0])),
  minZ: Math.min(...poly.map((p) => p[1])),
  maxZ: Math.max(...poly.map((p) => p[1])),
});

const Label: React.FC<{
  x: number;
  y: number;
  lines: string[];
  fill: string;
  color: string;
  stroke: string;
}> = ({ x, y, lines, fill, color, stroke }) => {
  const w = Math.max(...lines.map((l) => l.length)) * 78 + 160;
  const h = lines.length * 150 + 60;
  return (
    <g transform={`translate(${x}, ${y})`} pointerEvents="none">
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={50} fill={fill} stroke={stroke} strokeWidth={16} />
      {lines.map((l, i) => (
        <text
          key={i}
          x={0}
          y={-h / 2 + 60 + 110 + i * 150 - 40}
          textAnchor="middle"
          fill={color}
          fontSize={i === 0 ? 125 : 110}
          fontWeight={i === 0 ? 800 : 600}
        >
          {l}
        </text>
      ))}
    </g>
  );
};

/** Layers drawn underneath the walls: floors, rooms, roofs, stairs, grids. */
export const PlanBelowLayers: React.FC<LayerProps> = ({
  model,
  selectedId,
  failedElementIds,
  showLabels,
  isDark,
  onSelect,
  interactive = true,
}) => {
  const labelBg = isDark ? 'rgba(15,23,42,0.94)' : 'rgba(255,255,255,0.95)';
  const labelFg = isDark ? '#E2E8F0' : '#0F172A';
  const stroke = (id: string, base: string) =>
    selectedId === id ? SEL : failedElementIds.has(id) ? ERR : base;

  const floors = model.elements.filter((e): e is FloorElement => e.type === 'floor');
  const rooms = model.elements.filter((e): e is RoomElement => e.type === 'room');
  const roofs = model.elements.filter((e): e is RoofElement => e.type === 'roof');
  const stairs = model.elements.filter((e): e is StairElement => e.type === 'stair');
  const grids = model.elements.filter((e): e is GridElement => e.type === 'grid');

  return (
    <g data-testid="plan-below-layers" pointerEvents={interactive ? undefined : 'none'}>
      {floors.map((f) => (
        <g
          key={f.id}
          data-testid={`plan-floor-${f.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(f.id);
          }}
          style={{ cursor: 'pointer' }}
        >
          <polygon
            points={pts(f.boundary)}
            fill={isDark ? 'rgba(148,163,184,0.16)' : 'rgba(100,116,139,0.14)'}
            stroke={stroke(f.id, '#94A3B8')}
            strokeWidth={selectedId === f.id ? 36 : 18}
            strokeDasharray="160 80"
          />
          {showLabels && (
            <Label
              x={centroid(f.boundary)[0]}
              y={bounds(f.boundary).minZ + 330}
              lines={[`${f.id} · Döşeme ${f.thickness}`]}
              fill={labelBg}
              color={labelFg}
              stroke={stroke(f.id, '#94A3B8')}
            />
          )}
        </g>
      ))}

      {rooms.map((r) => {
        const b = roomBoundary(r, model);
        const area = (b.area / 1_000_000).toFixed(1);
        const c: Point = b.rects.length
          ? [
              b.rects.reduce((s, q) => s + ((q[0] + q[2]) / 2) * (q[2] - q[0]) * (q[3] - q[1]), 0) / b.area,
              b.rects.reduce((s, q) => s + ((q[1] + q[3]) / 2) * (q[2] - q[0]) * (q[3] - q[1]), 0) / b.area,
            ]
          : r.seedPoint;
        const color = failedElementIds.has(r.id) || b.open ? ERR : SEL;
        return (
          <g
            key={r.id}
            data-testid={`plan-room-${r.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(r.id);
            }}
            style={{ cursor: 'pointer' }}
          >
            {b.rects.map((q, i) => (
              <rect
                key={i}
                x={q[0]}
                y={q[1]}
                width={q[2] - q[0]}
                height={q[3] - q[1]}
                fill={b.open ? 'rgba(239,68,68,0.10)' : 'rgba(56,189,248,0.12)'}
              />
            ))}
            <circle cx={r.seedPoint[0]} cy={r.seedPoint[1]} r={selectedId === r.id ? 120 : 70} fill={color} />
            {b.open && b.gapAt && (
              <g pointerEvents="none" data-testid={`plan-room-gap-${r.id}`}>
                <circle cx={b.gapAt[0]} cy={b.gapAt[1]} r={190} fill="rgba(239,68,68,0.25)" stroke={ERR} strokeWidth={30} strokeDasharray="60 40" />
                <text x={b.gapAt[0] + 240} y={b.gapAt[1] - 120} fill={ERR} fontSize={120} fontWeight={800}>
                  Sınır açık
                </text>
              </g>
            )}
            {showLabels && (
              <Label
                x={c[0]}
                y={c[1] + 120}
                lines={
                  b.open
                    ? [`${r.name}${r.number ? ' ' + r.number : ''}`, 'Sınır kapalı değil']
                    : [`${r.name}${r.number ? ' ' + r.number : ''}`, `${area} m²`]
                }
                fill={labelBg}
                color={labelFg}
                stroke={color}
              />
            )}
          </g>
        );
      })}

      {roofs.map((rf) => {
        const b = bounds(rf.footprint);
        const o = rf.overhang;
        return (
          <g
            key={rf.id}
            data-testid={`plan-roof-${rf.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(rf.id);
            }}
            style={{ cursor: 'pointer' }}
          >
            <polygon points={pts(rf.footprint)} fill="rgba(249,115,22,0.08)" stroke={stroke(rf.id, '#F97316')} strokeWidth={selectedId === rf.id ? 36 : 20} strokeDasharray="220 90" />
            {o > 0 && (
              <rect
                x={b.minX - o}
                y={b.minZ - o}
                width={b.maxX - b.minX + 2 * o}
                height={b.maxZ - b.minZ + 2 * o}
                fill="none"
                stroke={stroke(rf.id, '#F97316')}
                strokeWidth={12}
                strokeDasharray="40 60"
              />
            )}
            {showLabels && (
              <Label
                x={centroid(rf.footprint)[0]}
                y={b.maxZ - 330}
                lines={[`${rf.id} · Çatı ${rf.slope}° · çıkma ${o}`]}
                fill={labelBg}
                color={labelFg}
                stroke={stroke(rf.id, '#F97316')}
              />
            )}
          </g>
        );
      })}

      {stairs.map((s) => {
        const [dx, dz] = s.direction.startsWith('x')
          ? [s.direction === 'x+' ? 1 : -1, 0]
          : [0, s.direction === 'z+' ? 1 : -1];
        const run = Math.max(1, s.risers - 1) * s.treadDepth;
        // Width extends towards +Z for X runs and +X for Z runs.
        const corner = (a: number, w: number): Point => [
          s.start[0] + dx * a + (dz !== 0 ? w : 0),
          s.start[1] + dz * a + (dx !== 0 ? w : 0),
        ];
        const poly = [corner(0, 0), corner(run, 0), corner(run, s.width), corner(0, s.width)];
        const col = stroke(s.id, '#A78BFA');
        const mid = corner(run / 2, s.width / 2);
        return (
          <g
            key={s.id}
            data-testid={`plan-stair-${s.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(s.id);
            }}
            style={{ cursor: 'pointer' }}
          >
            <polygon points={pts(poly)} fill="rgba(167,139,250,0.14)" stroke={col} strokeWidth={selectedId === s.id ? 34 : 20} />
            {Array.from({ length: Math.max(0, s.risers - 2) }).map((_, i) => {
              const a = corner((i + 1) * s.treadDepth, 0);
              const b2 = corner((i + 1) * s.treadDepth, s.width);
              return <line key={i} x1={a[0]} y1={a[1]} x2={b2[0]} y2={b2[1]} stroke={col} strokeWidth={10} />;
            })}
            {(() => {
              const a = corner(120, s.width / 2);
              const b2 = corner(run - 120, s.width / 2);
              return <line x1={a[0]} y1={a[1]} x2={b2[0]} y2={b2[1]} stroke={col} strokeWidth={22} />;
            })()}
            {showLabels && (
              <Label
                x={mid[0]}
                y={mid[1]}
                lines={[`${s.id} · ${s.risers}×${s.riserHeight}`]}
                fill={labelBg}
                color={labelFg}
                stroke={col}
              />
            )}
          </g>
        );
      })}

      {grids.map((g) => {
        const len = Math.hypot(g.end[0] - g.start[0], g.end[1] - g.start[1]) || 1;
        const ux = (g.end[0] - g.start[0]) / len;
        const uz = (g.end[1] - g.start[1]) / len;
        const bx = g.start[0] - ux * 330;
        const bz = g.start[1] - uz * 330;
        const col = stroke(g.id, '#22D3EE');
        return (
          <g
            key={g.id}
            data-testid={`plan-grid-${g.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(g.id);
            }}
            style={{ cursor: 'pointer' }}
          >
            <line x1={g.start[0]} y1={g.start[1]} x2={g.end[0]} y2={g.end[1]} stroke="transparent" strokeWidth={420} />
            <line x1={g.start[0]} y1={g.start[1]} x2={g.end[0]} y2={g.end[1]} stroke={col} strokeWidth={selectedId === g.id ? 26 : 14} strokeDasharray="420 90 50 90" />
            <circle cx={bx} cy={bz} r={230} fill={labelBg} stroke={col} strokeWidth={22} />
            <text x={bx} y={bz + 60} textAnchor="middle" fill={col} fontSize={170} fontWeight={800}>
              {g.name}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/** Window symbols, drawn on top of the host wall. */
export const PlanWindows: React.FC<LayerProps> = ({
  model,
  selectedId,
  failedElementIds,
  showLabels,
  onSelect,
  interactive = true,
  onOpeningPointerDown,
}) => {
  const walls = model.elements.filter((e): e is WallElement => e.type === 'wall');
  const windows = model.elements.filter((e): e is WindowElement => e.type === 'window');
  return (
    <g data-testid="plan-windows" pointerEvents={interactive ? undefined : 'none'}>
      {windows.map((w) => {
        const host = walls.find((x) => x.id === w.hostWallId);
        if (!host || w.offset + w.width > wallLengthMm(host)) return null;
        const [dx, dz] = getWallDirection(host);
        const nx = -dz;
        const nz = dx;
        const t = host.thickness / 2;
        const sx = host.start[0] + dx * w.offset;
        const sz = host.start[1] + dz * w.offset;
        const ex = host.start[0] + dx * (w.offset + w.width);
        const ez = host.start[1] + dz * (w.offset + w.width);
        const col = selectedId === w.id ? SEL : failedElementIds.has(w.id) ? ERR : '#38BDF8';
        const line = (k: number, width: number) => (
          <line
            x1={sx + nx * t * k}
            y1={sz + nz * t * k}
            x2={ex + nx * t * k}
            y2={ez + nz * t * k}
            stroke={col}
            strokeWidth={width}
          />
        );
        return (
          <g
            key={w.id}
            data-testid={`plan-window-${w.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(w.id);
            }}
            onPointerDown={() => {
              if (selectedId === w.id) onOpeningPointerDown?.(w.id);
            }}
            style={{ cursor: 'pointer' }}
          >
            <line x1={sx} y1={sz} x2={ex} y2={ez} stroke="transparent" strokeWidth={Math.max(host.thickness + 420, 620)} />
            <line x1={sx} y1={sz} x2={ex} y2={ez} stroke="rgba(56,189,248,0.18)" strokeWidth={host.thickness} />
            {line(1, 24)}
            {line(-1, 24)}
            {line(0, 14)}
            {showLabels && (
              <text
                x={(sx + ex) / 2 + nx * (t + 190)}
                y={(sz + ez) / 2 + nz * (t + 190) + 40}
                textAnchor="middle"
                fill={col}
                fontSize={115}
                fontWeight={800}
              >
                {w.mark}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
};
