import React from 'react';
import { roomBoundary, wallLengthMm } from '../domain/derived';
import { dimensionValue, tagLabel } from '../domain/documentation';
import type {
  BimModel,
  DimensionElement,
  FloorElement,
  GridElement,
  Point,
  RoofElement,
  RoomElement,
  StairElement,
  TagElement,
  ViewElement,
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
  /** Plan view cut plane (absolute mm); windows outside it are drawn faint. */
  cutPlane?: number | null;
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
  cutPlane = null,
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
        const baseElev = model.levels.find((l) => l.id === host.baseLevelId)?.elevation ?? 0;
        const cut =
          cutPlane === null ||
          (cutPlane >= baseElev + w.sill && cutPlane <= baseElev + w.sill + w.height);
        const col = selectedId === w.id ? SEL : failedElementIds.has(w.id) ? ERR : cut ? '#38BDF8' : '#64748B';
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
            <g opacity={cut ? 1 : 0.55} data-cut={cut ? 'yes' : 'no'}>
              {line(1, 24)}
              {line(-1, 24)}
              {cut && line(0, 14)}
            </g>
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

// ---------------------------------------------------------------------------
// Faz 4 — annotations: dimensions, tags, section / elevation marks, crop
// ---------------------------------------------------------------------------

interface AnnotationProps extends LayerProps {
  activeViewId: string | null;
  /** Crop corner dragging (only when the crop is editable). */
  onCropHandleDown?: (corner: 'min' | 'max') => void;
}

const COMPASS_POS = (
  b: { minX: number; maxX: number; minZ: number; maxZ: number },
  d: 'N' | 'S' | 'E' | 'W'
): { x: number; z: number; pts: string } => {
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const g = 1300;
  if (d === 'N') return { x: cx, z: b.minZ - g, pts: `${cx - 200},${b.minZ - g - 220} ${cx + 200},${b.minZ - g - 220} ${cx},${b.minZ - g + 120}` };
  if (d === 'S') return { x: cx, z: b.maxZ + g, pts: `${cx - 200},${b.maxZ + g + 220} ${cx + 200},${b.maxZ + g + 220} ${cx},${b.maxZ + g - 120}` };
  if (d === 'E') return { x: b.maxX + g, z: cz, pts: `${b.maxX + g + 220},${cz - 200} ${b.maxX + g + 220},${cz + 200} ${b.maxX + g - 120},${cz}` };
  return { x: b.minX - g, z: cz, pts: `${b.minX - g - 220},${cz - 200} ${b.minX - g - 220},${cz + 200} ${b.minX - g + 120},${cz}` };
};

export const PlanAnnotations: React.FC<AnnotationProps> = ({
  model,
  selectedId,
  failedElementIds,
  showLabels,
  isDark,
  onSelect,
  interactive = true,
  activeViewId,
  onCropHandleDown,
}) => {
  const walls = model.elements.filter((e): e is WallElement => e.type === 'wall');
  const labelBg = isDark ? 'rgba(15,23,42,0.94)' : 'rgba(255,255,255,0.95)';
  const labelFg = isDark ? '#E2E8F0' : '#0F172A';
  const col = (id: string, base: string) =>
    selectedId === id ? SEL : failedElementIds.has(id) ? ERR : base;

  const xs = walls.flatMap((w) => [w.start[0], w.end[0]]);
  const zs = walls.flatMap((w) => [w.start[1], w.end[1]]);
  const bounds = walls.length
    ? { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
    : null;

  const activeView = model.elements.find(
    (e): e is ViewElement => e.id === activeViewId && e.type === 'view'
  );
  const crop =
    activeView &&
    activeView.cropMinX !== undefined &&
    activeView.cropMaxX !== undefined &&
    activeView.cropMinZ !== undefined &&
    activeView.cropMaxZ !== undefined
      ? { minX: activeView.cropMinX, maxX: activeView.cropMaxX, minZ: activeView.cropMinZ, maxZ: activeView.cropMaxZ }
      : null;

  return (
    <g data-testid="plan-annotations" pointerEvents={interactive ? undefined : 'none'}>
      {/* Dimensions */}
      {model.elements
        .filter((e): e is DimensionElement => e.type === 'dimension')
        .map((d) => {
          const a = walls.find((w) => w.id === d.wallA);
          const b = walls.find((w) => w.id === d.wallB);
          const v = a && b ? dimensionValue(d, model) : null;
          if (!a || !b || v === null) return null;
          const horiz = a.start[1] === a.end[1];
          const color = col(d.id, '#38BDF8');
          const mid = horiz
            ? [(Math.min(a.start[0], a.end[0]) + Math.max(a.start[0], a.end[0])) / 2 + 600, (a.start[1] + b.start[1]) / 2]
            : [(a.start[0] + b.start[0]) / 2, (Math.min(a.start[1], a.end[1]) + Math.max(a.start[1], a.end[1])) / 2 + 600];
          const p1 = horiz ? [mid[0], a.start[1]] : [a.start[0], mid[1]];
          const p2 = horiz ? [mid[0], b.start[1]] : [b.start[0], mid[1]];
          return (
            <g
              key={d.id}
              data-testid={`plan-dimension-${d.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(d.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="transparent" strokeWidth={360} />
              <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={color} strokeWidth={selectedId === d.id ? 26 : 16} />
              {[p1, p2].map((p, i) => (
                <line
                  key={i}
                  x1={p[0] - (horiz ? 160 : 0)}
                  y1={p[1] - (horiz ? 0 : 160)}
                  x2={p[0] + (horiz ? 160 : 0)}
                  y2={p[1] + (horiz ? 0 : 160)}
                  stroke={color}
                  strokeWidth={22}
                />
              ))}
              <g transform={`translate(${mid[0] + (horiz ? 330 : 0)}, ${mid[1] + (horiz ? 0 : -170)})`}>
                <rect x={-250} y={-110} width={500} height={200} rx={40} fill={labelBg} stroke={color} strokeWidth={12} />
                <text x={0} y={40} textAnchor="middle" fill={labelFg} fontSize={125} fontWeight={800} data-testid={`plan-dimension-value-${d.id}`}>
                  {v}
                </text>
              </g>
            </g>
          );
        })}

      {/* Tags */}
      {model.elements
        .filter((e): e is TagElement => e.type === 'tag')
        .map((t) => {
          const target = model.elements.find((e) => e.id === t.targetId);
          if (!target) return null;
          let at: Point = [0, 0];
          if (target.type === 'door' || target.type === 'window') {
            const host = walls.find((w) => w.id === target.hostWallId);
            if (!host) return null;
            const [dx, dz] = getWallDirection(host);
            const m = target.offset + target.width / 2;
            at = [host.start[0] + dx * m - dz * 520, host.start[1] + dz * m + dx * 520];
          } else if (target.type === 'room') {
            at = [target.seedPoint[0], target.seedPoint[1] - 520];
          } else {
            return null;
          }
          const text = tagLabel(t, model);
          const color = col(t.id, '#F97316');
          return (
            <g
              key={t.id}
              data-testid={`plan-tag-${t.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(t.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              <rect x={at[0] - text.length * 52 - 70} y={at[1] - 120} width={text.length * 104 + 140} height={220} rx={110} fill={labelBg} stroke={color} strokeWidth={14} />
              <text x={at[0]} y={at[1] + 38} textAnchor="middle" fill={color} fontSize={120} fontWeight={800}>
                {text}
              </text>
            </g>
          );
        })}

      {/* Section marks */}
      {model.elements
        .filter((e): e is ViewElement => e.type === 'view' && e.kind === 'section' && Boolean(e.cutLine))
        .map((v) => {
          const [p, q] = v.cutLine as [Point, Point];
          const color = col(v.id, '#EF4444');
          const mx = (p[0] + q[0]) / 2;
          const mz = (p[1] + q[1]) / 2;
          const [lx, lz] = v.lookDir === 'x+' ? [1, 0] : v.lookDir === 'x-' ? [-1, 0] : v.lookDir === 'z+' ? [0, 1] : [0, -1];
          return (
            <g
              key={v.id}
              data-testid={`plan-section-${v.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(v.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="transparent" strokeWidth={420} />
              <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={color} strokeWidth={selectedId === v.id ? 34 : 22} strokeDasharray="400 100 60 100" />
              <polygon
                points={`${mx + lx * 360},${mz + lz * 360} ${mx - lz * 160},${mz + lx * 160} ${mx + lz * 160},${mz - lx * 160}`}
                fill={color}
              />
              {[p, q].map((pt, i) => (
                <g key={i}>
                  <circle cx={pt[0]} cy={pt[1]} r={190} fill={labelBg} stroke={color} strokeWidth={20} />
                  <text x={pt[0]} y={pt[1] + 55} textAnchor="middle" fill={color} fontSize={150} fontWeight={800}>
                    {v.name.replace('Kesit ', '')}
                  </text>
                </g>
              ))}
              {showLabels && (
                <text x={mx + 250} y={mz - 220} fill={color} fontSize={125} fontWeight={800}>
                  {v.name}
                </text>
              )}
            </g>
          );
        })}

      {/* Elevation markers */}
      {bounds &&
        model.elements
          .filter((e): e is ViewElement => e.type === 'view' && e.kind === 'elevation' && Boolean(e.direction))
          .map((v) => {
            const pos = COMPASS_POS(bounds, v.direction as 'N' | 'S' | 'E' | 'W');
            const color = col(v.id, '#A78BFA');
            return (
              <g
                key={v.id}
                data-testid={`plan-elevation-${v.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(v.id);
                }}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={pos.x} cy={pos.z} r={330} fill="transparent" />
                <polygon points={pos.pts} fill={color} />
                <text x={pos.x} y={pos.z + 55} textAnchor="middle" fill={labelFg} fontSize={150} fontWeight={800}>
                  {v.direction}
                </text>
              </g>
            );
          })}

      {/* Crop region of the active plan view */}
      {crop && (
        <g data-testid="plan-crop-region">
          <path
            d={`M -20000 -20000 H 40000 V 40000 H -20000 Z M ${crop.minX} ${crop.minZ} V ${crop.maxZ} H ${crop.maxX} V ${crop.minZ} Z`}
            fill={isDark ? 'rgba(2,6,23,0.55)' : 'rgba(148,163,184,0.45)'}
            fillRule="evenodd"
            pointerEvents="none"
          />
          <rect x={crop.minX} y={crop.minZ} width={crop.maxX - crop.minX} height={crop.maxZ - crop.minZ} fill="none" stroke="#22C55E" strokeWidth={26} strokeDasharray="200 90" pointerEvents="none" />
          {onCropHandleDown && (
            <>
              <circle cx={crop.minX} cy={crop.minZ} r={150} fill="#22C55E" stroke="#FFFFFF" strokeWidth={26} data-testid="crop-handle-min" onPointerDown={(e) => { e.stopPropagation(); onCropHandleDown('min'); }} />
              <circle cx={crop.maxX} cy={crop.maxZ} r={150} fill="#22C55E" stroke="#FFFFFF" strokeWidth={26} data-testid="crop-handle-max" onPointerDown={(e) => { e.stopPropagation(); onCropHandleDown('max'); }} />
            </>
          )}
        </g>
      )}
    </g>
  );
};
