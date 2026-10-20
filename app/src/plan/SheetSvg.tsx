import React, { useRef, useState } from 'react';
import { SHEET_H, SHEET_W, viewPaperSize } from '../domain/documentation';
import type { BimModel, SheetElement, ViewElement } from '../domain/types';
import { buildViewDrawing } from '../domain/viewDrawing';
import { DrawingPrims } from './DrawingSvg';

interface SheetSvgProps {
  model: BimModel;
  sheet: SheetElement;
  projectName?: string;
  /** Drag a placed view; called once on release. */
  onMovePlacement?: (viewId: string, x: number, z: number) => void;
}

/** A3 sheet (420 × 297 mm paper units) with border, title block and views. */
export const SheetSvg: React.FC<SheetSvgProps> = ({
  model,
  sheet,
  projectName = 'BIM QUEST · Tek Katlı Konut',
  onMovePlacement,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dz: number; x: number; z: number } | null>(null);

  const toPaper = (cx: number, cy: number): [number, number] | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const scale = Math.min(r.width / SHEET_W, r.height / SHEET_H);
    const ox = (r.width - SHEET_W * scale) / 2;
    const oy = (r.height - SHEET_H * scale) / 2;
    return [(cx - r.left - ox) / scale, (cy - r.top - oy) / scale];
  };

  return (
    <svg
      ref={svgRef}
      className="bq-sheet-svg"
      viewBox={`0 0 ${SHEET_W} ${SHEET_H}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid={`sheet-svg-${sheet.id}`}
      role="img"
      aria-label={`${sheet.number} ${sheet.name}`}
      onPointerMove={(e) => {
        if (!drag) return;
        const p = toPaper(e.clientX, e.clientY);
        if (p) setDrag({ ...drag, x: p[0] - drag.dx, z: p[1] - drag.dz });
      }}
      onPointerUp={() => {
        if (drag) {
          onMovePlacement?.(drag.id, Math.round(drag.x), Math.round(drag.z));
          setDrag(null);
        }
      }}
    >
      <rect x={0} y={0} width={SHEET_W} height={SHEET_H} fill="#FFFFFF" />
      <rect x={10} y={10} width={SHEET_W - 20} height={SHEET_H - 20} fill="none" stroke="#0F172A" strokeWidth={1} />

      {sheet.placements.map((pl) => {
        const view = model.elements.find((e): e is ViewElement => e.id === pl.viewId && e.type === 'view');
        if (!view) return null;
        const d = buildViewDrawing(model, view);
        const size = viewPaperSize(view, model);
        const x = drag?.id === pl.viewId ? drag.x : pl.x;
        const z = drag?.id === pl.viewId ? drag.z : pl.z;
        const k = 1 / view.scale;
        return (
          <g
            key={pl.viewId}
            data-testid={`sheet-view-${pl.viewId}`}
            style={{ cursor: onMovePlacement ? 'grab' : 'default' }}
            onPointerDown={(e) => {
              if (!onMovePlacement) return;
              const p = toPaper(e.clientX, e.clientY);
              if (p) setDrag({ id: pl.viewId, dx: p[0] - pl.x, dz: p[1] - pl.z, x: pl.x, z: pl.z });
            }}
          >
            <rect x={x} y={z} width={size.w} height={size.h} fill="#FFFFFF" stroke="#94A3B8" strokeWidth={0.3} strokeDasharray="2 2" />
            <g transform={`translate(${x} ${z}) scale(${k}) translate(${-d.minX} ${-d.minY})`}>
              <DrawingPrims drawing={d} isDark={false} />
            </g>
            <text x={x} y={z + size.h + 5} fontSize={3.6} fontWeight={700} fill="#0F172A">
              {view.name} · 1:{view.scale}
            </text>
          </g>
        );
      })}

      {/* Title block */}
      <g data-testid="sheet-title-block">
        <rect x={SHEET_W - 130} y={SHEET_H - 50} width={120} height={40} fill="#FFFFFF" stroke="#0F172A" strokeWidth={0.6} />
        <line x1={SHEET_W - 130} y1={SHEET_H - 36} x2={SHEET_W - 10} y2={SHEET_H - 36} stroke="#0F172A" strokeWidth={0.3} />
        <line x1={SHEET_W - 40} y1={SHEET_H - 36} x2={SHEET_W - 40} y2={SHEET_H - 10} stroke="#0F172A" strokeWidth={0.3} />
        <text x={SHEET_W - 126} y={SHEET_H - 40} fontSize={4} fontWeight={700} fill="#0F172A">
          {projectName}
        </text>
        <text x={SHEET_W - 126} y={SHEET_H - 26} fontSize={5} fontWeight={800} fill="#0F172A" data-testid="sheet-title-name">
          {sheet.name}
        </text>
        <text x={SHEET_W - 126} y={SHEET_H - 16} fontSize={3.4} fill="#475569">
          {sheet.size} · {sheet.placements.length} görünüm
        </text>
        <text x={SHEET_W - 36} y={SHEET_H - 24} fontSize={8} fontWeight={800} fill="#0F172A" data-testid="sheet-title-number">
          {sheet.number}
        </text>
      </g>
    </svg>
  );
};

/** Renders an SVG element to a PNG download (the player's first sheet). */
export async function downloadSvgAsPng(svg: SVGSVGElement, fileName: string): Promise<void> {
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('image'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = SHEET_W * 4;
    canvas.height = SHEET_H * 4;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!png) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(png);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
