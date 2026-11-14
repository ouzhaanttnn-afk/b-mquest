import React, { useRef } from 'react';
import type { BimModel, Point } from '../domain/types';
import type { Ghost } from './model';

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
  // Tall buildings are drawn compressed (k mm per drawing unit) so the view always fits.
  const highest = Math.max(
    6000,
    ...model.levels.map((l) => l.elevation),
    ...ghosts.map((g) => (g.kind === 'elevation' ? g.at : 0))
  );
  const k = Math.max(1, (highest + 600) / 6600);
  const Y = (mm: number) => -mm / k;
  const tickStep = k > 3 ? 5000 : 500;
  const ticks: number[] = [];
  for (let e = 0; e <= highest; e += tickStep) ticks.push(e);
  const sorted = [...model.levels].sort((a, b) => a.elevation - b.elevation);
  // With many levels only every fifth label (and the top) is written out.
  const crowded = sorted.length > 8;
  const labelled = (i: number) => !crowded || i % 5 === 0 || i === sorted.length - 1;
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
        // A second finger (pinch, two-finger tap) never draws.
        if (!e.isPrimary) return;
        const m = ref.current?.getScreenCTM();
        if (!m) return;
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
        onTap([0, Math.round(-pt.y * k)]);
      }}
    >
      <rect x={-2600} y={0} width={15200} height={1200} className="bq-cmp-ground" />
      {ticks.map((t) => (
        <g key={t} className="bq-cmp-tick">
          <line x1={-1800} y1={Y(t)} x2={-1400} y2={Y(t)} />
        </g>
      ))}
      {ghosts.map((g, i) =>
        g.kind === 'elevation' ? (
          <g key={i} className="bq-cmp-ghost">
            <line x1={-1200} y1={Y(g.at)} x2={12000} y2={Y(g.at)} />
            {g.label && <text x={12200} y={Y(g.at) + 130}>{g.label}</text>}
          </g>
        ) : null
      )}
      {sorted.map((l, i) => (
        <g key={l.id} className="bq-cmp-level">
          <line x1={-1200} y1={Y(l.elevation)} x2={11200} y2={Y(l.elevation)} />
          {labelled(i) && <circle cx={11600} cy={Y(l.elevation)} r={crowded ? 160 : 330} />}
          {labelled(i) && (
            <text x={-1200} y={Y(l.elevation) - 120}>
              {l.name} {fmt(l.elevation)}
            </text>
          )}
        </g>
      ))}
      {demo && (
        <g className="bq-cmp-finger" style={{ transform: `translate(5000px, ${Y(demo[1])}px)` }} aria-hidden="true">
          <circle r={420} />
          <circle r={160} className="bq-cmp-finger-core" />
        </g>
      )}
    </svg>
  );
};
