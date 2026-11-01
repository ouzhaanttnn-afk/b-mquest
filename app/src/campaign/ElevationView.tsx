import React, { useRef } from 'react';
import type { BimModel, Point } from '../domain/types';
import type { Ghost } from './house1';

/**
 * Side view for placing Levels, the way Revit does it: levels are drawn in an
 * elevation or section view. Taps report [0, elevation in mm].
 */

interface Props {
  model: BimModel;
  ghosts: Ghost[];
  demo: Point | null;
  onTap: (p: Point) => void;
}

const fmt = (mm: number) => `${mm === 0 ? '±' : '+'}${(mm / 1000).toFixed(2).replace('.', ',')}`;

export const ElevationView: React.FC<Props> = ({ model, ghosts, demo, onTap }) => {
  const ref = useRef<SVGSVGElement | null>(null);
  const ticks: number[] = [];
  for (let e = 0; e <= 6000; e += 500) ticks.push(e);
  return (
    <svg
      ref={ref}
      className="bq-cmp-plan bq-cmp-elev"
      viewBox="-2600 -7000 15200 8200"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Görünüş: katlar yan taraftan"
      data-testid="cmp-elevation"
      onPointerUp={(e) => {
        const m = ref.current?.getScreenCTM();
        if (!m) return;
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
        onTap([0, Math.round(-pt.y)]);
      }}
    >
      <rect x={-2600} y={0} width={15200} height={1200} className="bq-cmp-ground" />
      {ticks.map((t) => (
        <g key={t} className="bq-cmp-tick">
          <line x1={-1800} y1={-t} x2={-1400} y2={-t} />
        </g>
      ))}
      {ghosts.map((g, i) =>
        g.kind === 'elevation' ? (
          <g key={i} className="bq-cmp-ghost">
            <line x1={-1200} y1={-g.at} x2={12000} y2={-g.at} />
            {g.label && <text x={12200} y={-g.at + 130}>{g.label}</text>}
          </g>
        ) : null
      )}
      {model.levels.map((l) => (
        <g key={l.id} className="bq-cmp-level">
          <line x1={-1200} y1={-l.elevation} x2={11200} y2={-l.elevation} />
          <circle cx={11600} cy={-l.elevation} r={330} />
          <text x={-1200} y={-l.elevation - 200}>{l.name} {fmt(l.elevation)}</text>
        </g>
      ))}
      {demo && (
        <g className="bq-cmp-finger" style={{ transform: `translate(5000px, ${-demo[1]}px)` }} aria-hidden="true">
          <circle r={420} />
          <circle r={160} className="bq-cmp-finger-core" />
        </g>
      )}
    </svg>
  );
};
