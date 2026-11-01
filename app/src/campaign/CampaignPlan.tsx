import React, { useRef } from 'react';
import type { BimModel, Point, WallElement } from '../domain/types';
import { roomArea, roomBoundary } from '../domain/derived';
import type { Ghost } from './house1';

/**
 * The play surface: a plan with big snap dots, the ghost target and the house
 * as it grows. Everything is in millimetres; taps are reported in plan mm.
 */

interface Props {
  model: BimModel;
  ghosts: Ghost[];
  showDots: boolean;
  chainStart: Point | null;
  demo: Point | null;
  onTap: (p: Point) => void;
}

const VB = { x: -2000, y: -2000, w: 14000, h: 11000 };

export const CampaignPlan: React.FC<Props> = ({ model, ghosts, showDots, chainStart, demo, onTap }) => {
  const ref = useRef<SVGSVGElement | null>(null);
  const toPlan = (e: React.PointerEvent): Point | null => {
    const svg = ref.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [Math.round(pt.x), Math.round(pt.y)];
  };
  const walls = model.elements.filter((e): e is WallElement => e.type === 'wall');
  const wallPoint = (hostId: string, offset: number, width: number): [Point, Point] | null => {
    const w = walls.find((x) => x.id === hostId);
    if (!w) return null;
    const len = Math.abs(w.end[0] - w.start[0]) + Math.abs(w.end[1] - w.start[1]);
    const at = (d: number): Point => [w.start[0] + ((w.end[0] - w.start[0]) * d) / len, w.start[1] + ((w.end[1] - w.start[1]) * d) / len];
    return [at(offset), at(offset + width)];
  };
  const dots: Point[] = [];
  if (showDots) for (let x = -1000; x <= 11000; x += 1000) for (let z = -1000; z <= 8000; z += 1000) dots.push([x, z]);

  return (
    <svg
      ref={ref}
      className="bq-cmp-plan"
      viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Plan: evin üstten görünüşü"
      data-testid="cmp-plan"
      onPointerUp={(e) => {
        const p = toPlan(e);
        if (p) onTap(p);
      }}
    >
      {dots.map(([x, z]) => (
        <circle key={`${x}:${z}`} cx={x} cy={z} r={70} className="bq-cmp-dot" />
      ))}

      {model.elements.map((e) =>
        e.type === 'roof' ? (
          <rect
            key={e.id}
            className="bq-cmp-roof"
            x={Math.min(...e.footprint.map((p) => p[0])) - e.overhang}
            y={Math.min(...e.footprint.map((p) => p[1])) - e.overhang}
            width={Math.max(...e.footprint.map((p) => p[0])) - Math.min(...e.footprint.map((p) => p[0])) + 2 * e.overhang}
            height={Math.max(...e.footprint.map((p) => p[1])) - Math.min(...e.footprint.map((p) => p[1])) + 2 * e.overhang}
          />
        ) : e.type === 'floor' ? (
          <polygon key={e.id} className="bq-cmp-floor" points={e.boundary.map(([x, z]) => `${x},${z}`).join(' ')} />
        ) : null
      )}

      {model.elements.map((e) =>
        e.type === 'room' && !roomBoundary(e, model).open ? (
          <g key={e.id} className="bq-cmp-room">
            <text x={e.seedPoint[0]} y={e.seedPoint[1] - 120} textAnchor="middle" className="bq-cmp-room-name">
              {e.name}
            </text>
            <text x={e.seedPoint[0]} y={e.seedPoint[1] + 360} textAnchor="middle" className="bq-cmp-room-area">
              {roomArea(e, model).toFixed(1)} m²
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
        const seg = wallPoint(e.hostWallId, e.offset, e.width);
        if (!seg) return null;
        return (
          <line
            key={e.id}
            className={e.type === 'door' ? 'bq-cmp-door' : 'bq-cmp-window'}
            x1={seg[0][0]}
            y1={seg[0][1]}
            x2={seg[1][0]}
            y2={seg[1][1]}
          />
        );
      })}

      {model.elements.map((e) => {
        if (e.type !== 'tag') return null;
        const room = model.elements.find((r) => r.id === e.targetId);
        if (!room || room.type !== 'room') return null;
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

      {chainStart && <circle className="bq-cmp-chain" cx={chainStart[0]} cy={chainStart[1]} r={260} />}

      {demo && (
        <g className="bq-cmp-finger" style={{ transform: `translate(${demo[0]}px, ${demo[1]}px)` }} aria-hidden="true">
          <circle r={420} />
          <circle r={160} className="bq-cmp-finger-core" />
        </g>
      )}
    </svg>
  );
};
