import React, { useRef } from 'react';
import type { BimModel, Point, WallElement } from '../domain/types';
import { roomArea, roomBoundary } from '../domain/derived';
import { openingCentre, stairRect } from './engine';
import type { Ghost, HouseGeom } from './model';

/**
 * The play surface: a plan of one level with big snap dots, the ghost target
 * and the house as it grows. The level below shows faintly (Revit's Underlay).
 * Everything is in millimetres; taps are reported in plan mm.
 */

interface Props {
  geom: HouseGeom;
  activeLevel: string;
  model: BimModel;
  ghosts: Ghost[];
  showDots: boolean;
  chainStart: Point | null;
  /** Sketch lines waiting for Finish Edit Mode (magenta, as in Revit). */
  sketch?: Point[] | null;
  demo: Point | null;
  onTap: (p: Point) => void;
}

const MARGIN = 2000;

/**
 * Room area as Revit reports it: measured to the inner faces of the walls.
 * Rooms here are rectangles between wall centre lines, so take half a wall off each side.
 */
function innerArea(room: Extract<BimModel['elements'][number], { type: 'room' }>, model: BimModel): number {
  const b = roomBoundary(room, model);
  if (b.open || b.rects.length !== 1) return roomArea(room, model);
  const [x0, z0, x1, z1] = b.rects[0];
  const t = 200;
  return (Math.max(0, Math.abs(x1 - x0) - t) * Math.max(0, Math.abs(z1 - z0) - t)) / 1_000_000;
}

export const CampaignPlan: React.FC<Props> = ({ geom, activeLevel, model, ghosts, showDots, chainStart, sketch, demo, onTap }) => {
  const ref = useRef<SVGSVGElement | null>(null);
  const toPlan = (e: React.PointerEvent): Point | null => {
    const svg = ref.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [Math.round(pt.x), Math.round(pt.y)];
  };
  const here = model.levels.find((l) => l.id === activeLevel)?.elevation ?? 0;
  const below = [...model.levels].filter((l) => l.elevation < here).sort((a, b) => b.elevation - a.elevation)[0]?.id;
  const allWalls = model.elements.filter((e): e is WallElement => e.type === 'wall');
  const walls = allWalls.filter((w) => w.baseLevelId === activeLevel);
  const underlay = below ? allWalls.filter((w) => w.baseLevelId === below) : [];
  const wallSeg = (hostId: string, offset: number, width: number): [Point, Point] | null => {
    const w = walls.find((x) => x.id === hostId);
    if (!w) return null;
    const len = Math.abs(w.end[0] - w.start[0]) + Math.abs(w.end[1] - w.start[1]);
    const at = (d: number): Point => [w.start[0] + ((w.end[0] - w.start[0]) * d) / len, w.start[1] + ((w.end[1] - w.start[1]) * d) / len];
    return [at(offset), at(offset + width)];
  };
  const dots: Point[] = [];
  if (showDots) for (let x = -1000; x <= geom.w + 1000; x += 1000) for (let z = -1000; z <= geom.d + 1000; z += 1000) dots.push([x, z]);

  return (
    <svg
      ref={ref}
      className="bq-cmp-plan"
      viewBox={`${-MARGIN} ${-MARGIN} ${geom.w + 2 * MARGIN} ${geom.d + 2 * MARGIN}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Plan: evin üstten görünüşü"
      data-testid="cmp-plan"
      onPointerUp={(e) => {
        // A second finger (pinch, two-finger tap) never draws.
        if (!e.isPrimary) return;
        const p = toPlan(e);
        if (p) onTap(p);
      }}
    >
      {dots.map(([x, z]) => (
        <circle key={`${x}:${z}`} cx={x} cy={z} r={70} className="bq-cmp-dot" />
      ))}

      {model.elements.map((e) => {
        if (e.type === 'roof') {
          const xs = e.footprint.map((p) => p[0]);
          const zs = e.footprint.map((p) => p[1]);
          return (
            <rect
              key={e.id}
              className="bq-cmp-roof"
              x={Math.min(...xs) - e.overhang}
              y={Math.min(...zs) - e.overhang}
              width={Math.max(...xs) - Math.min(...xs) + 2 * e.overhang}
              height={Math.max(...zs) - Math.min(...zs) + 2 * e.overhang}
            />
          );
        }
        if (e.type === 'floor' && e.levelId === activeLevel) {
          return <polygon key={e.id} className="bq-cmp-floor" points={e.boundary.map(([x, z]) => `${x},${z}`).join(' ')} />;
        }
        return null;
      })}

      {underlay.map((w) => (
        <line key={w.id} className="bq-cmp-underlay" x1={w.start[0]} y1={w.start[1]} x2={w.end[0]} y2={w.end[1]} strokeWidth={w.thickness} />
      ))}

      {model.elements.map((e) => {
        if (e.type !== 'stair' || (e.baseLevelId !== activeLevel && e.topLevelId !== activeLevel)) return null;
        const [x0, z0, x1, z1] = stairRect(e);
        const along = e.direction.startsWith('x');
        const lines = [];
        for (let i = 1; i < e.risers - 1; i++) {
          const k = i * e.treadDepth;
          const sgn = e.direction.endsWith('+') ? 1 : -1;
          const base = along ? (sgn > 0 ? x0 : x1) : sgn > 0 ? z0 : z1;
          const v = base + sgn * k;
          lines.push(along ? <line key={i} x1={v} y1={z0} x2={v} y2={z1} /> : <line key={i} x1={x0} y1={v} x2={x1} y2={v} />);
        }
        const mid: Point = [(x0 + x1) / 2, (z0 + z1) / 2];
        const tip: Point = along ? [e.direction === 'x+' ? x1 - 200 : x0 + 200, mid[1]] : [mid[0], e.direction === 'z+' ? z1 - 200 : z0 + 200];
        const tail: Point = along ? [e.direction === 'x+' ? x0 + 200 : x1 - 200, mid[1]] : [mid[0], e.direction === 'z+' ? z0 + 200 : z1 - 200];
        return (
          <g key={e.id} className={`bq-cmp-stair ${e.baseLevelId === activeLevel ? '' : 'upper'}`} data-testid="cmp-stair">
            <rect x={x0} y={z0} width={x1 - x0} height={z1 - z0} />
            {lines}
            <line className="bq-cmp-stair-arrow" x1={tail[0]} y1={tail[1]} x2={tip[0]} y2={tip[1]} markerEnd="url(#bq-cmp-arrow)" />
          </g>
        );
      })}

      {model.elements.map((e) =>
        e.type === 'room' && e.levelId === activeLevel && !roomBoundary(e, model).open ? (
          <g key={e.id} className="bq-cmp-room">
            <text x={e.seedPoint[0]} y={e.seedPoint[1] - 120} textAnchor="middle" className="bq-cmp-room-name">
              {e.name}
            </text>
            <text x={e.seedPoint[0]} y={e.seedPoint[1] + 360} textAnchor="middle" className="bq-cmp-room-area">
              {innerArea(e, model).toFixed(1).replace('.', ',')} m²
            </text>
          </g>
        ) : null
      )}

      {model.elements.map((e) =>
        e.type === 'grid' ? (
          <g key={e.id} className="bq-cmp-grid">
            <line x1={e.start[0]} y1={e.start[1]} x2={e.end[0]} y2={e.end[1]} />
            <circle cx={e.start[0]} cy={e.start[1]} r={330} />
            <text x={e.start[0]} y={e.start[1] + 120} textAnchor="middle">{e.name}</text>
          </g>
        ) : null
      )}

      {ghosts.map((g, i) =>
        g.kind === 'line' ? (
          <g key={i} className="bq-cmp-ghost">
            <line x1={g.a[0]} y1={g.a[1]} x2={g.b[0]} y2={g.b[1]} />
            {g.label && <text x={g.a[0]} y={g.a[1] - 450} textAnchor="middle">{g.label}</text>}
          </g>
        ) : g.kind === 'opening' ? (
          <g key={i} className="bq-cmp-ghost bq-cmp-ghost-opening">
            <line x1={g.a[0]} y1={g.a[1]} x2={g.b[0]} y2={g.b[1]} />
          </g>
        ) : g.kind === 'area' ? (
          <g key={i} className="bq-cmp-ghost bq-cmp-ghost-area">
            <polygon points={g.points.map(([x, z]) => `${x},${z}`).join(' ')} />
            {g.label && (
              <text
                x={g.points.reduce((s, p) => s + p[0], 0) / g.points.length}
                y={g.points.reduce((s, p) => s + p[1], 0) / g.points.length - 1500}
                textAnchor="middle"
              >
                {g.label}
              </text>
            )}
          </g>
        ) : null
      )}

      {walls.map((w) => (
        <line key={w.id} className="bq-cmp-wall" x1={w.start[0]} y1={w.start[1]} x2={w.end[0]} y2={w.end[1]} strokeWidth={w.thickness} />
      ))}

      {model.elements.map((e) => {
        if (e.type !== 'door' && e.type !== 'window') return null;
        const seg = wallSeg(e.hostWallId, e.offset, e.width);
        if (!seg) return null;
        const opening = (
          <line
            key={e.id}
            className={e.type === 'door' ? 'bq-cmp-door' : 'bq-cmp-window'}
            x1={seg[0][0]}
            y1={seg[0][1]}
            x2={seg[1][0]}
            y2={seg[1][1]}
          />
        );
        if (e.type !== 'door') return opening;
        // Door symbol: leaf at 90° and its swing arc, opening into the house.
        const [h, t] = seg;
        const ux = (t[0] - h[0]) / e.width;
        const uz = (t[1] - h[1]) / e.width;
        let nx = -uz;
        let nz = ux;
        const cx = geom.w / 2 - h[0];
        const cz = geom.d / 2 - h[1];
        if (nx * cx + nz * cz < 0) {
          nx = -nx;
          nz = -nz;
        }
        const leaf: Point = [h[0] + nx * e.width, h[1] + nz * e.width];
        const sweep = nx * uz - nz * ux > 0 ? 0 : 1;
        return (
          <g key={e.id} className="bq-cmp-door-sym">
            {opening}
            <path d={`M ${h[0]} ${h[1]} L ${leaf[0]} ${leaf[1]} A ${e.width} ${e.width} 0 0 ${sweep} ${t[0]} ${t[1]}`} />
          </g>
        );
      })}

      {model.elements.map((e) => {
        if (e.type !== 'tag') return null;
        const room = model.elements.find((r) => r.id === e.targetId);
        if (!room || room.type !== 'room' || room.levelId !== activeLevel) return null;
        return (
          <rect
            key={e.id}
            className="bq-cmp-tag"
            x={room.seedPoint[0] - 1500}
            y={room.seedPoint[1] - 600}
            width={3000}
            height={1300}
            rx={150}
          />
        );
      })}

      {model.elements.map((e) =>
        e.type === 'view' && e.kind === 'section' && e.cutLine ? (
          <g key={e.id} className="bq-cmp-section" data-testid="cmp-section-line">
            <line x1={e.cutLine[0][0]} y1={e.cutLine[0][1]} x2={e.cutLine[1][0]} y2={e.cutLine[1][1]} />
            <circle cx={e.cutLine[0][0]} cy={e.cutLine[0][1]} r={300} />
            <text x={e.cutLine[0][0]} y={e.cutLine[0][1] + 110} textAnchor="middle">
              {e.name.replace(/\D+/g, '') || '1'}
            </text>
          </g>
        ) : null
      )}

      {model.elements.map((e) => {
        if (e.type !== 'dimension') return null;
        const a = walls.find((w) => w.id === e.wallA);
        const b = walls.find((w) => w.id === e.wallB);
        if (!a || !b) return null;
        const horizontal = a.start[1] === a.end[1];
        if (!horizontal) {
          const x0 = Math.min(a.start[0], b.start[0]);
          const x1 = Math.max(a.start[0], b.start[0]);
          const z = Math.min(a.start[1], a.end[1], b.start[1], b.end[1]) - 1100;
          return (
            <g key={e.id} className="bq-cmp-dim" data-testid="cmp-dimension">
              <line x1={x0} y1={z} x2={x1} y2={z} />
              <line x1={x0} y1={z - 200} x2={x0} y2={z + 200} />
              <line x1={x1} y1={z - 200} x2={x1} y2={z + 200} />
              <text x={(x0 + x1) / 2} y={z - 150} textAnchor="middle">{(x1 - x0).toLocaleString('tr-TR')}</text>
            </g>
          );
        }
        const z0 = Math.min(a.start[1], b.start[1]);
        const z1 = Math.max(a.start[1], b.start[1]);
        const x = Math.max(a.start[0], a.end[0], b.start[0], b.end[0]) + 1100;
        return (
          <g key={e.id} className="bq-cmp-dim" data-testid="cmp-dimension">
            <line x1={x} y1={z0} x2={x} y2={z1} />
            <line x1={x - 200} y1={z0} x2={x + 200} y2={z0} />
            <line x1={x - 200} y1={z1} x2={x + 200} y2={z1} />
            <text x={x + 250} y={(z0 + z1) / 2 + 120}>{(z1 - z0).toLocaleString('tr-TR')}</text>
          </g>
        );
      })}

      {model.elements.map((e) => {
        if (e.type !== 'tag') return null;
        const target = model.elements.find((o) => o.id === e.targetId);
        if (!target || (target.type !== 'door' && target.type !== 'window')) return null;
        if (!walls.some((w) => w.id === target.hostWallId)) return null;
        const c = openingCentre(model, target.id);
        if (!c) return null;
        const out = c[1] <= 0 ? -650 : c[1] >= geom.d ? 650 : 0;
        return (
          <g key={e.id} className="bq-cmp-otag">
            <rect x={c[0] - 520} y={c[1] + out - 260} width={1040} height={520} rx={120} />
            <text x={c[0]} y={c[1] + out + 120} textAnchor="middle">
              {target.mark || (target.type === 'door' ? 'D' : 'W')}
            </text>
          </g>
        );
      })}

      {model.elements.map((e) => {
        if (e.type !== 'view' || e.kind !== 'elevation' || !e.direction) return null;
        const { w, d } = geom;
        const at: Record<string, [number, number, number]> = {
          S: [w * 0.75, d + 1300, 0],
          N: [w * 0.75, -1300, 180],
          E: [w + 1300, d / 2, 270],
          W: [-1300, d / 2, 90],
        };
        const [x, z, rot] = at[e.direction];
        return (
          <g key={e.id} className="bq-cmp-elev-mark" transform={`translate(${x} ${z}) rotate(${rot})`} data-testid="cmp-elevation-mark">
            <circle r={380} />
            <path d="M -380 0 L 0 -620 L 380 0 Z" />
          </g>
        );
      })}

      {sketch && (
        <polygon className="bq-cmp-sketch" points={sketch.map(([x, z]) => `${x},${z}`).join(' ')} data-testid="cmp-sketch" />
      )}

      {chainStart && <circle className="bq-cmp-chain" cx={chainStart[0]} cy={chainStart[1]} r={260} />}

      {demo && (
        <g className="bq-cmp-finger" style={{ transform: `translate(${demo[0]}px, ${demo[1]}px)` }} aria-hidden="true">
          <circle r={420} />
          <circle r={160} className="bq-cmp-finger-core" />
        </g>
      )}

      {/* North is up in the campaign plans; the entrance faces north. */}
      <g className="bq-cmp-north" transform={`translate(${geom.w + MARGIN - 700} ${-MARGIN + 800})`} aria-hidden="true">
        <circle r={420} />
        <path d="M 0 -300 L 180 220 L 0 120 L -180 220 Z" />
        <text y={-480} textAnchor="middle">K</text>
      </g>

      <defs>
        <marker id="bq-cmp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="bq-cmp-arrow-head" />
        </marker>
      </defs>
    </svg>
  );
};
