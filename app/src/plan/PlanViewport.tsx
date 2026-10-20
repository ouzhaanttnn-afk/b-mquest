import React, { useMemo, useRef, useState } from 'react';
import type {
  BimModel,
  DoorElement,
  MissionTask,
  WindowElement,
  WallElement,
} from '../domain/types';
import { PlanAnnotations, PlanBelowLayers, PlanWindows } from './PlanLayers';
import { lockAxis, projectOnWall, snapPoint, type SnapKind } from './snap';
import type { ToolId } from '../ui/workspace/toolActions';
import { roomBoundary } from '../domain/derived';
import {
  computeWallPlanSegments,
  getWallDirection,
  getWallLengthMm,
} from './geometry';

export interface WallDraftPreview {
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  thickness: number;
}

export interface DoorDraftPreview {
  hostWallId: string;
  offset: number;
  width: number;
}

export interface PlanViewportProps {
  task: MissionTask;
  model: BimModel;
  selectedId: string | null;
  failedElementIds: Set<string>;
  activeTool: ToolId;
  theme?: 'light' | 'dark';
  canDragWallEndpoints?: boolean;
  wallPreview?: WallDraftPreview | null;
  doorPreview?: DoorDraftPreview | null;
  onSelect: (id: string | null) => void;
  /** Any tap while a drawing tool is active (already snapped, mm). */
  onToolPoint?: (pt: [number, number], hit?: { wallId: string; along: number }) => void;
  /** Press-drag-release with a line tool (Wall, Grid, Section). */
  onToolDrag?: (start: [number, number], end: [number, number]) => void;
  /** Where the running wall chain / grid line starts. */
  chainStart?: [number, number] | null;
  /** Walls picked for Floor / Roof (Pick Walls). */
  pickedWallIds?: Set<string>;
  /** Red marker where a Room boundary is open. */
  roomGap?: [number, number] | null;
  /** View whose crop region / cut plane the plan shows. */
  activeViewId?: string | null;
  cropEditable?: boolean;
  onCropRect?: (rect: { minX: number; maxX: number; minZ: number; maxZ: number }) => void;
  canDragOpenings?: boolean;
  canMoveOpening?: (id: string, offset: number) => boolean;
  onMoveOpening?: (id: string, offset: number) => void;
  onDragWallEndpoint?: (
    wallId: string,
    which: 'start' | 'end',
    newCoord: [number, number]
  ) => void;
}

export type PlanToolProps = Pick<
  PlanViewportProps,
  | 'onToolPoint'
  | 'onToolDrag'
  | 'chainStart'
  | 'pickedWallIds'
  | 'roomGap'
  | 'activeViewId'
  | 'cropEditable'
  | 'onCropRect'
  | 'canDragOpenings'
  | 'canMoveOpening'
  | 'onMoveOpening'
>;

const DEFAULT_VIEWBOX = {
  minX: -850,
  minZ: -800,
  width: 7700,
  height: 5600,
};

/**
 * Closed region enclosed by the walls around the centre of their bounding box.
 * Shown as a gentle hint until the player places a real Room.
 */
function detectEnclosedRegion(
  model: BimModel
): { areaM2: string; volumeM3: string; avgHeightMm: number; cx: number; cz: number } | null {
  const walls = model.elements.filter((e): e is WallElement => e.type === 'wall');
  if (walls.length < 4 || model.elements.some((e) => e.type === 'room')) return null;
  const xs = walls.flatMap((w) => [w.start[0], w.end[0]]);
  const zs = walls.flatMap((w) => [w.start[1], w.end[1]]);
  const cx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
  const cz = Math.round((Math.min(...zs) + Math.max(...zs)) / 2);
  const level = model.levels[0]?.id ?? 'l0';
  const probe = roomBoundary(
    { id: 'probe', type: 'room', name: '', number: '', levelId: level, seedPoint: [cx, cz] },
    model
  );
  if (probe.open || probe.area <= 0) return null;
  const inLevel = walls.filter((w) => w.baseLevelId === level);
  const avgHeightMm = Math.round(
    inLevel.reduce((sum, w) => sum + w.height, 0) / Math.max(1, inLevel.length)
  );
  const area = probe.area / 1_000_000;
  return {
    areaM2: area.toFixed(1),
    volumeM3: (area * (avgHeightMm / 1000)).toFixed(1),
    avgHeightMm,
    cx,
    cz,
  };
}

export const PlanViewport: React.FC<PlanViewportProps> = ({
  task,
  model,
  selectedId,
  failedElementIds,
  activeTool,
  theme = 'dark',
  canDragWallEndpoints = false,
  wallPreview,
  doorPreview,
  onSelect,
  onToolPoint,
  onToolDrag,
  chainStart = null,
  pickedWallIds,
  roomGap = null,
  activeViewId = null,
  cropEditable = false,
  onCropRect,
  canDragOpenings = false,
  canMoveOpening,
  onMoveOpening,
  onDragWallEndpoint,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const lastKindRef = useRef<SnapKind>('grid');
  const suppressClick = useRef(false);
  const [drawDrag, setDrawDrag] = useState<{ start: [number, number]; end: [number, number] } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; z: number }>({ x: 0, z: 0 });
  const [hoverSnap, setHoverSnap] = useState<[number, number] | null>(null);
  const [hoverKind, setHoverKind] = useState<SnapKind>('grid');
  const [cropDrag, setCropDrag] = useState<{ corner: 'min' | 'max'; rect: { minX: number; maxX: number; minZ: number; maxZ: number } } | null>(null);
  const [dragOpening, setDragOpening] = useState<{ id: string; offset: number; valid: boolean } | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<{
    wallId: string;
    which: 'start' | 'end';
  } | null>(null);

  const isDark = theme === 'dark';
  const bgFill = isDark ? '#071426' : '#F0F7FF';
  const gridMajorColor = isDark ? '#1E3A5F' : '#BFDBFE';
  const gridMinorColor = isDark ? '#0F2544' : '#DBEAFE';
  const wallDefaultFill = isDark ? '#475569' : '#94A3B8';
  const wallDefaultStroke = isDark ? '#E2E8F0' : '#0F172A';
  const labelBgDefault = isDark ? '#0F172A' : '#FFFFFF';
  const labelTextDefault = isDark ? '#F8FAFC' : '#0F172A';

  const walls = useMemo(
    () => model.elements.filter((e): e is WallElement => e.type === 'wall'),
    [model.elements]
  );
  const openings = useMemo(
    () => model.elements.filter((e): e is DoorElement | WindowElement => e.type === 'door' || e.type === 'window'),
    [model.elements]
  );
  const doors = useMemo(
    () => model.elements.filter((e): e is DoorElement => e.type === 'door'),
    [model.elements]
  );

  const roomStats = useMemo(() => detectEnclosedRegion(model), [model]);

  const viewBoxStr = useMemo(() => {
    const w = DEFAULT_VIEWBOX.width / zoom;
    const h = DEFAULT_VIEWBOX.height / zoom;
    const cx = DEFAULT_VIEWBOX.minX + DEFAULT_VIEWBOX.width / 2 + pan.x;
    const cz = DEFAULT_VIEWBOX.minZ + DEFAULT_VIEWBOX.height / 2 + pan.z;
    return `${Math.round(cx - w / 2)} ${Math.round(cz - h / 2)} ${Math.round(w)} ${Math.round(h)}`;
  }, [zoom, pan]);

  const clientToPlanMm = (
    clientX: number,
    clientY: number
  ): [number, number] | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const vbParts = viewBoxStr.split(' ').map(Number);
    const [vbMinX, vbMinZ, vbW, vbH] = vbParts;

    const scaleX = rect.width / vbW;
    const scaleY = rect.height / vbH;
    const scale = Math.min(scaleX, scaleY);
    const renderedW = vbW * scale;
    const renderedH = vbH * scale;
    const offsetX = (rect.width - renderedW) / 2;
    const offsetY = (rect.height - renderedH) / 2;

    const rawX = vbMinX + (clientX - rect.left - offsetX) / scale;
    const rawZ = vbMinZ + (clientY - rect.top - offsetY) / scale;

    const snapped = snapPoint([rawX, rawZ], model, {
      tolerance: Math.max(150, Math.round(28 / scale)),
    });
    lastKindRef.current = snapped.kind;
    return [
      Math.max(-100000, Math.min(100000, snapped.point[0])),
      Math.max(-100000, Math.min(100000, snapped.point[1])),
    ];
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingHandle && onDragWallEndpoint) {
      const pt = clientToPlanMm(e.clientX, e.clientY);
      const w = walls.find((el) => el.id === draggingHandle.wallId);
      if (pt && w) {
        const anchor = draggingHandle.which === 'start' ? w.end : w.start;
        // Keep axis alignment (lock to X or Z axis relative to the opposite endpoint)
        const dx = Math.abs(pt[0] - anchor[0]);
        const dz = Math.abs(pt[1] - anchor[1]);
        const alignedCoord: [number, number] =
          dx >= dz ? [pt[0], anchor[1]] : [anchor[0], pt[1]];
        if (alignedCoord[0] !== anchor[0] || alignedCoord[1] !== anchor[1]) {
          onDragWallEndpoint(w.id, draggingHandle.which, alignedCoord);
        }
      }
      return;
    }

    if (drawDrag) {
      const pt = clientToPlanMm(e.clientX, e.clientY);
      if (pt) {
        setDrawDrag({ ...drawDrag, end: pt });
        setHoverSnap(pt);
        setHoverKind(lastKindRef.current);
      }
      return;
    }

    if (cropDrag) {
      const pt = clientToPlanMm(e.clientX, e.clientY);
      if (pt) {
        const r = { ...cropDrag.rect };
        if (cropDrag.corner === 'min') {
          r.minX = Math.min(pt[0], r.maxX - 500);
          r.minZ = Math.min(pt[1], r.maxZ - 500);
        } else {
          r.maxX = Math.max(pt[0], r.minX + 500);
          r.maxZ = Math.max(pt[1], r.minZ + 500);
        }
        setCropDrag({ ...cropDrag, rect: r });
      }
      return;
    }

    if (dragOpening) {
      const pt = clientToPlanMm(e.clientX, e.clientY);
      const op = model.elements.find((el) => el.id === dragOpening.id);
      const host =
        op && (op.type === 'door' || op.type === 'window')
          ? walls.find((w) => w.id === op.hostWallId)
          : undefined;
      if (pt && op && host && (op.type === 'door' || op.type === 'window')) {
        const along = projectOnWall(host, pt);
        const offset = Math.round((along - op.width / 2) / 50) * 50;
        setDragOpening({
          id: op.id,
          offset,
          valid: canMoveOpening ? canMoveOpening(op.id, offset) : true,
        });
      }
      return;
    }

    if (activeTool !== 'select') {
      const pt = clientToPlanMm(e.clientX, e.clientY);
      setHoverSnap(pt);
      setHoverKind(lastKindRef.current);
    } else if (hoverSnap) {
      setHoverSnap(null);
    }
  };

  const handleSvgPointerUp = () => {
    if (draggingHandle) {
      setDraggingHandle(null);
    }
    if (drawDrag) {
      const dist = Math.hypot(drawDrag.end[0] - drawDrag.start[0], drawDrag.end[1] - drawDrag.start[1]);
      if (dist >= 400) {
        onToolDrag?.(drawDrag.start, drawDrag.end);
        // The click that follows the release must not start a second tap-line.
        suppressClick.current = true;
        setTimeout(() => {
          suppressClick.current = false;
        }, 0);
      }
      setDrawDrag(null);
    }
    if (cropDrag) {
      onCropRect?.(cropDrag.rect);
      setCropDrag(null);
    }
    if (dragOpening) {
      const op = model.elements.find((el) => el.id === dragOpening.id);
      if (
        dragOpening.valid &&
        op &&
        (op.type === 'door' || op.type === 'window') &&
        op.offset !== dragOpening.offset
      ) {
        onMoveOpening?.(dragOpening.id, dragOpening.offset);
      }
      setDragOpening(null);
    }
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Touch has no hover: show the crosshair as soon as the finger lands.
    if (activeTool !== 'select') {
      const pt = clientToPlanMm(e.clientX, e.clientY);
      setHoverSnap(pt);
      setHoverKind(lastKindRef.current);
      if (pt && ['wall', 'grid', 'section'].includes(activeTool) && onToolDrag) {
        setDrawDrag({ start: pt, end: pt });
        svgRef.current?.setPointerCapture?.(e.pointerId);
      }
    }
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (suppressClick.current) return;
    if (
      e.target === svgRef.current ||
      (e.target as Element).getAttribute('data-bg') === 'true'
    ) {
      if (activeTool !== 'select' && onToolPoint) {
        const pt = clientToPlanMm(e.clientX, e.clientY);
        if (pt) onToolPoint(pt);
        return;
      }
      onSelect(null);
    }
  };

  const handleWallClick = (e: React.MouseEvent, wall: WallElement) => {
    e.stopPropagation();
    if (suppressClick.current) return;
    if (activeTool !== 'select' && onToolPoint) {
      const pt = clientToPlanMm(e.clientX, e.clientY);
      if (!pt) return;
      if (['door', 'window', 'floor', 'roof', 'dimension'].includes(activeTool)) {
        onToolPoint(pt, { wallId: wall.id, along: projectOnWall(wall, pt) });
      } else {
        onToolPoint(pt);
      }
      return;
    }
    onSelect(wall.id);
  };

  const resetPlanCamera = () => {
    setZoom(1);
    setPan({ x: 0, z: 0 });
  };

  const gridLines = useMemo(() => {
    if (!showGrid) return null;
    const lines: React.ReactNode[] = [];
    for (let x = -1000; x <= 7000; x += 500) {
      const isMajor = x % 1000 === 0;
      lines.push(
        <line
          key={`gx-${x}`}
          x1={x}
          y1={-1000}
          x2={x}
          y2={5000}
          stroke={isMajor ? gridMajorColor : gridMinorColor}
          strokeWidth={isMajor ? 14 : 8}
          data-bg="true"
        />
      );
    }
    for (let z = -1000; z <= 5000; z += 500) {
      const isMajor = z % 1000 === 0;
      lines.push(
        <line
          key={`gz-${z}`}
          x1={-1000}
          y1={z}
          x2={7000}
          y2={z}
          stroke={isMajor ? gridMajorColor : gridMinorColor}
          strokeWidth={isMajor ? 14 : 8}
          data-bg="true"
        />
      );
    }
    return lines;
  }, [showGrid, gridMajorColor, gridMinorColor]);

  return (
    <div className="bq-plan-container" data-testid="plan-viewport">
      <div
        className="bq-viewport-toolbar bq-toolbar-2d"
        role="toolbar"
        aria-label="2B Plan Araçları"
      >
        <span className="bq-viewport-badge bq-badge-2d bq-hide-mobile">
          📐 2B MİMARİ KAT PLANI (ÜSTTEN GÖRÜNÜŞ · mm)
        </span>
        <div className="bq-viewport-controls">
          <button
            type="button"
            className={`bq-chip-btn bq-hide-mobile ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid((v) => !v)}
            aria-pressed={showGrid}
            title="100/1000 mm Izgarayı Aç/Kapat"
          >
            Izgara
          </button>
          <button
            type="button"
            className={`bq-chip-btn bq-hide-mobile ${showLabels ? 'active' : ''}`}
            onClick={() => setShowLabels((v) => !v)}
            aria-pressed={showLabels}
            title="Ölçü ve Kimlik Etiketlerini Aç/Kapat"
          >
            Ölçüler
          </button>
          <button
            type="button"
            className="bq-chip-btn"
            onClick={() =>
              setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))
            }
            aria-label="Plana Yakınlaş"
          >
            +
          </button>
          <button
            type="button"
            className="bq-chip-btn"
            onClick={() =>
              setZoom((z) => Math.max(0.6, Number((z - 0.25).toFixed(2))))
            }
            aria-label="Plandan Uzaklaş"
          >
            −
          </button>
          <button
            type="button"
            className="bq-chip-btn bq-hide-mobile"
            onClick={resetPlanCamera}
            aria-label="Plan Görünümünü Merkezle"
          >
            Merkezle
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        className="bq-plan-svg"
        viewBox={viewBoxStr}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${task.title} 2B Ortografik Plan Görünümü`}
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        onClick={handleSvgClick}
      >
        <defs>
          <pattern
            id="bq-error-hatch"
            width="120"
            height="120"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="120"
              stroke="#EF4444"
              strokeWidth="36"
            />
          </pattern>
        </defs>

        {/* Background clickable surface */}
        <rect
          x={-10000}
          y={-10000}
          width={28000}
          height={24000}
          fill={bgFill}
          data-bg="true"
        />

        {/* Grid */}
        {gridLines}

        {/* Enclosed-region hint (real geometry) until a Room element exists */}
        {roomStats && (
          <g data-testid="plan-room-stamp" pointerEvents="none">
            <rect
              x={roomStats.cx - 1150}
              y={roomStats.cz - 300}
              width={2300}
              height={600}
              rx={90}
              fill={isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.95)'}
              stroke="#38BDF8"
              strokeWidth={24}
            />
            <text
              x={roomStats.cx}
              y={roomStats.cz - 40}
              textAnchor="middle"
              fill="#38BDF8"
              fontSize={145}
              fontWeight="800"
            >
              KAPALI ALAN · {roomStats.areaM2} m²
            </text>
            <text
              x={roomStats.cx}
              y={roomStats.cz + 170}
              textAnchor="middle"
              fill={isDark ? '#E2E8F0' : '#475569'}
              fontSize={120}
              fontWeight="600"
            >
              Hacim: {roomStats.volumeM3} m³ (Y: {roomStats.avgHeightMm} mm)
            </text>
          </g>
        )}

        {/* Origin & Axis markers (+X right, +Z down) + North Compass */}
        <g aria-hidden="true" data-bg="true">
          <line x1={0} y1={0} x2={700} y2={0} stroke="#38BDF8" strokeWidth={24} />
          <polygon points="700,-55 840,0 700,55" fill="#38BDF8" />
          <text x={870} y={40} fill="#38BDF8" fontSize={140} fontWeight="700">
            +X
          </text>
          <line x1={0} y1={0} x2={0} y2={700} stroke="#38BDF8" strokeWidth={24} />
          <polygon points="-55,700 0,840 55,700" fill="#38BDF8" />
          <text x={-110} y={1020} fill="#38BDF8" fontSize={140} fontWeight="700">
            +Z
          </text>
          {/* Architectural North Compass */}
          <g transform="translate(6420, -240)">
            <circle cx={0} cy={0} r={190} fill={labelBgDefault} stroke="#38BDF8" strokeWidth={18} />
            <polygon points="0,-135 -48,60 0,25 48,60" fill="#38BDF8" />
            <text x={0} y={310} textAnchor="middle" fill="#38BDF8" fontSize={110} fontWeight="800">
              K
            </text>
          </g>
        </g>

        {/* Target Ghosts & Architectural Dimension Lines */}
        <g
          data-testid="plan-ghost-targets"
          data-bg="true"
          display={['m01', 'm02', 'm03'].includes(task.id) ? undefined : 'none'}
        >
          <rect
            x={0}
            y={0}
            width={6000}
            height={4000}
            fill="none"
            stroke="#00B8C4"
            strokeWidth={30}
            strokeDasharray="120 90"
            opacity={0.9}
            data-bg="true"
          />
          {showLabels && (
            <>
              {/* Top Horizontal Architectural Dimension Line (6000 mm) */}
              <line x1={0} y1={-420} x2={6000} y2={-420} stroke="#38BDF8" strokeWidth={16} />
              <line x1={0} y1={-520} x2={0} y2={-320} stroke="#38BDF8" strokeWidth={20} />
              <line x1={6000} y1={-520} x2={6000} y2={-320} stroke="#38BDF8" strokeWidth={20} />
              <rect x={2100} y={-555} width={1800} height={240} rx={40} fill={labelBgDefault} stroke="#38BDF8" strokeWidth={14} />
              <text
                x={3000}
                y={-390}
                textAnchor="middle"
                fill={labelTextDefault}
                fontSize={135}
                fontWeight="800"
              >
                6000 mm (6.0 m)
              </text>

              {/* Bottom Horizontal Label */}
              <text x={-150} y={-150} fill="#38BDF8" fontSize={130} fontWeight="700">
                (0, 0)
              </text>
              <text x={5550} y={-150} fill="#38BDF8" fontSize={130} fontWeight="700">
                (6000, 0)
              </text>
              <text x={5450} y={4340} fill="#38BDF8" fontSize={130} fontWeight="700">
                (6000, 4000)
              </text>
              <text x={-220} y={4340} fill="#38BDF8" fontSize={130} fontWeight="700">
                (0, 4000)
              </text>
            </>
          )}

          {/* Mission 3 Target Door Ghost at offset 2550, width 900 on south wall */}
          {task.id === 'm03' && (
            <g data-bg="true">
              <rect
                x={2550}
                y={-130}
                width={900}
                height={260}
                fill="rgba(56, 189, 248, 0.16)"
                stroke="#38BDF8"
                strokeWidth={26}
                strokeDasharray="70 50"
              />
              {showLabels && (
                <text
                  x={3000}
                  y={-210}
                  textAnchor="middle"
                  fill="#38BDF8"
                  fontSize={130}
                  fontWeight="700"
                >
                  Hedef d1: Ofset 2550 · G:900 mm
                </text>
              )}
            </g>
          )}
        </g>

        <PlanBelowLayers
          model={model}
          selectedId={selectedId}
          failedElementIds={failedElementIds}
          showLabels={showLabels}
          isDark={isDark}
          interactive={activeTool === 'select'}
          onSelect={onSelect}
        />

        {/* Walls */}
        {walls.map((wall) => {
          const isSelected = selectedId === wall.id;
          const isFailed = failedElementIds.has(wall.id);
          const hostedDoors = openings.filter((d) => d.hostWallId === wall.id);
          const segments = computeWallPlanSegments(wall, hostedDoors);
          const [dx, dz] = getWallDirection(wall);
          const nx = -dz;
          const nz = dx;
          const halfT = wall.thickness / 2;
          const len = getWallLengthMm(wall);
          const midX = (wall.start[0] + wall.end[0]) / 2;
          const midZ = (wall.start[1] + wall.end[1]) / 2;

          const strokeColor = isSelected
            ? '#38BDF8'
            : isFailed
            ? '#EF4444'
            : wallDefaultStroke;
          const fillColor = isSelected
            ? isDark
              ? '#0369A1'
              : '#CCFBF1'
            : isFailed
            ? 'url(#bq-error-hatch)'
            : wallDefaultFill;

          return (
            <g
              key={wall.id}
              data-testid={`plan-wall-${wall.id}`}
              className="bq-plan-element"
              onClick={(e) => handleWallClick(e, wall)}
              style={{ cursor: 'pointer' }}
            >
              {/* Invisible fat hit target for easy touch selection on iPhone/iPad */}
              <line
                x1={wall.start[0]}
                y1={wall.start[1]}
                x2={wall.end[0]}
                y2={wall.end[1]}
                stroke="transparent"
                strokeWidth={Math.max(wall.thickness + 460, 660)}
              />

              {/* Solid wall segments around door openings */}
              {segments.map((seg, idx) => {
                const sx = wall.start[0] + dx * seg.fromOffset;
                const sz = wall.start[1] + dz * seg.fromOffset;
                const ex = wall.start[0] + dx * seg.toOffset;
                const ez = wall.start[1] + dz * seg.toOffset;
                const pts = [
                  `${sx + nx * halfT},${sz + nz * halfT}`,
                  `${ex + nx * halfT},${ez + nz * halfT}`,
                  `${ex - nx * halfT},${ez - nz * halfT}`,
                  `${sx - nx * halfT},${sz - nz * halfT}`,
                ].join(' ');
                return (
                  <polygon
                    key={`${wall.id}-seg-${idx}`}
                    points={pts}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? 36 : isFailed ? 32 : 20}
                  />
                );
              })}

              {/* Selection / Error outer halo */}
              {(isSelected || isFailed) && (
                <line
                  x1={wall.start[0]}
                  y1={wall.start[1]}
                  x2={wall.end[0]}
                  y2={wall.end[1]}
                  stroke={isSelected ? '#38BDF8' : '#EF4444'}
                  strokeWidth={wall.thickness + 90}
                  strokeDasharray={isSelected ? '90 50' : '45 45'}
                  opacity={0.75}
                  pointerEvents="none"
                />
              )}

              {/* Wall centreline */}
              <line
                x1={wall.start[0]}
                y1={wall.start[1]}
                x2={wall.end[0]}
                y2={wall.end[1]}
                stroke="#38BDF8"
                strokeWidth={14}
                strokeDasharray="60 40"
                pointerEvents="none"
              />

              {/* Interactive Endpoint Drag Handles when selected & editable */}
              {isSelected && canDragWallEndpoints && activeTool === 'select' && (
                <>
                  <circle
                    cx={wall.start[0]}
                    cy={wall.start[1]}
                    r={130}
                    fill="#F97316"
                    stroke="#FFFFFF"
                    strokeWidth={28}
                    data-testid={`drag-handle-${wall.id}-start`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDraggingHandle({ wallId: wall.id, which: 'start' });
                    }}
                  />
                  <circle
                    cx={wall.end[0]}
                    cy={wall.end[1]}
                    r={130}
                    fill="#F97316"
                    stroke="#FFFFFF"
                    strokeWidth={28}
                    data-testid={`drag-handle-${wall.id}-end`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDraggingHandle({ wallId: wall.id, which: 'end' });
                    }}
                  />
                </>
              )}

              {/* Wall label badge (tappable on mobile & desktop!) */}
              {showLabels && (
                <g
                  transform={`translate(${midX + nx * 260}, ${midZ + nz * 260})`}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={-520}
                    y={-125}
                    width={1040}
                    height={230}
                    rx={45}
                    fill={
                      isSelected
                        ? '#0284C7'
                        : isFailed
                        ? '#DC2626'
                        : labelBgDefault
                    }
                    stroke={strokeColor}
                    strokeWidth={16}
                  />
                  <text
                    x={0}
                    y={38}
                    textAnchor="middle"
                    fill={
                      isSelected || isFailed ? '#FFFFFF' : labelTextDefault
                    }
                    fontSize={122}
                    fontWeight="700"
                  >
                    {isFailed ? '! ' : isSelected ? '✓ ' : ''}
                    {wall.id} · L:{len} · Y:{wall.height}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Doors */}
        {doors.map((door) => {
          const host = walls.find((w) => w.id === door.hostWallId);
          if (!host) return null;
          const isSelected = selectedId === door.id;
          const isFailed = failedElementIds.has(door.id);
          const [dx, dz] = getWallDirection(host);
          const nx = -dz;
          const nz = dx;

          const startX = host.start[0] + dx * door.offset;
          const startZ = host.start[1] + dz * door.offset;
          const endX = host.start[0] + dx * (door.offset + door.width);
          const endZ = host.start[1] + dz * (door.offset + door.width);
          const side = door.flip ? -1 : 1;
          const swingTipX = startX + nx * door.width * side;
          const swingTipZ = startZ + nz * door.width * side;
          const midX = (startX + endX) / 2;
          const midZ = (startZ + endZ) / 2;

          const strokeColor = isSelected
            ? '#38BDF8'
            : isFailed
            ? '#EF4444'
            : '#F97316';

          return (
            <g
              key={door.id}
              data-testid={`plan-door-${door.id}`}
              pointerEvents={activeTool === 'select' ? undefined : 'none'}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(door.id);
              }}
              onPointerDown={() => {
                if (canDragOpenings && selectedId === door.id) {
                  setDragOpening({ id: door.id, offset: door.offset, valid: true });
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={midX + nx * (door.width * 0.35)}
                cy={midZ + nz * (door.width * 0.35)}
                r={Math.max(door.width * 0.65, 420)}
                fill="transparent"
              />

              <line
                x1={startX}
                y1={startZ}
                x2={endX}
                y2={endZ}
                stroke={strokeColor}
                strokeWidth={44}
              />

              <line
                x1={startX}
                y1={startZ}
                x2={swingTipX}
                y2={swingTipZ}
                stroke={isFailed ? '#EF4444' : '#F97316'}
                strokeWidth={36}
              />

              <path
                d={`M ${endX} ${endZ} Q ${swingTipX + dx * (door.width * 0.45)} ${
                  swingTipZ + dz * (door.width * 0.45)
                } ${swingTipX} ${swingTipZ}`}
                fill="rgba(249, 115, 22, 0.18)"
                stroke={strokeColor}
                strokeWidth={24}
                strokeDasharray="55 40"
              />

              {showLabels && (
                <g
                  transform={`translate(${midX + nx * (door.width + 210)}, ${
                    midZ + nz * (door.width + 210)
                  })`}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={-540}
                    y={-125}
                    width={1080}
                    height={230}
                    rx={45}
                    fill={
                      isSelected ? '#0284C7' : isFailed ? '#DC2626' : '#F97316'
                    }
                    stroke="#0F172A"
                    strokeWidth={16}
                  />
                  <text
                    x={0}
                    y={38}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize={120}
                    fontWeight="700"
                  >
                    {door.id} ({door.mark}) · {door.width}×{door.height}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        <PlanAnnotations
          model={
            cropDrag && activeViewId
              ? {
                  ...model,
                  elements: model.elements.map((el) =>
                    el.id === activeViewId && el.type === 'view'
                      ? {
                          ...el,
                          cropMinX: cropDrag.rect.minX,
                          cropMaxX: cropDrag.rect.maxX,
                          cropMinZ: cropDrag.rect.minZ,
                          cropMaxZ: cropDrag.rect.maxZ,
                        }
                      : el
                  ),
                }
              : model
          }
          selectedId={selectedId}
          failedElementIds={failedElementIds}
          showLabels={showLabels}
          isDark={isDark}
          interactive={activeTool === 'select'}
          onSelect={onSelect}
          activeViewId={activeViewId}
          onCropHandleDown={
            cropEditable
              ? (corner) => {
                  const v = model.elements.find((el) => el.id === activeViewId && el.type === 'view');
                  if (
                    v &&
                    v.type === 'view' &&
                    v.cropMinX !== undefined &&
                    v.cropMaxX !== undefined &&
                    v.cropMinZ !== undefined &&
                    v.cropMaxZ !== undefined
                  ) {
                    setCropDrag({
                      corner,
                      rect: { minX: v.cropMinX, maxX: v.cropMaxX, minZ: v.cropMinZ, maxZ: v.cropMaxZ },
                    });
                  }
                }
              : undefined
          }
        />

        <PlanWindows
          model={model}
          cutPlane={(() => {
            const v = model.elements.find((el) => el.id === activeViewId && el.type === 'view');
            if (!v || v.type !== 'view' || v.kind !== 'plan') return null;
            return (model.levels.find((l) => l.id === v.levelId)?.elevation ?? 0) + (v.cutHeight ?? 1200);
          })()}
          selectedId={selectedId}
          failedElementIds={failedElementIds}
          showLabels={showLabels}
          isDark={isDark}
          interactive={activeTool === 'select'}
          onSelect={onSelect}
          onOpeningPointerDown={
            canDragOpenings
              ? (id) => {
                  const op = model.elements.find((el) => el.id === id);
                  if (op && (op.type === 'window' || op.type === 'door')) {
                    setDragOpening({ id, offset: op.offset, valid: true });
                  }
                }
              : undefined
          }
        />

        {/* Live Wall Creation Preview */}
        {activeTool === 'wall' && wallPreview && (
          <g pointerEvents="none" data-testid="plan-wall-preview">
            <line
              x1={wallPreview.startX}
              y1={wallPreview.startZ}
              x2={wallPreview.endX}
              y2={wallPreview.endZ}
              stroke="#F97316"
              strokeWidth={wallPreview.thickness || 200}
              strokeDasharray="100 60"
              opacity={0.75}
            />
            <circle
              cx={wallPreview.startX}
              cy={wallPreview.startZ}
              r={95}
              fill="#38BDF8"
              stroke="#FFFFFF"
              strokeWidth={24}
            />
            <circle
              cx={wallPreview.endX}
              cy={wallPreview.endZ}
              r={95}
              fill="#F97316"
              stroke="#FFFFFF"
              strokeWidth={24}
            />
          </g>
        )}

        {/* Live Door Creation Preview */}
        {activeTool === 'door' &&
          doorPreview &&
          (() => {
            const host = walls.find((w) => w.id === doorPreview.hostWallId);
            if (!host) return null;
            const [dx, dz] = getWallDirection(host);
            const sx = host.start[0] + dx * doorPreview.offset;
            const sz = host.start[1] + dz * doorPreview.offset;
            const ex =
              host.start[0] + dx * (doorPreview.offset + doorPreview.width);
            const ez =
              host.start[1] + dz * (doorPreview.offset + doorPreview.width);
            return (
              <g pointerEvents="none" data-testid="plan-door-preview">
                <line
                  x1={sx}
                  y1={sz}
                  x2={ex}
                  y2={ez}
                  stroke="#F97316"
                  strokeWidth={host.thickness + 80}
                  strokeDasharray="70 40"
                />
              </g>
            );
          })()}

        {/* Walls picked for Floor / Roof */}
        {pickedWallIds &&
          walls
            .filter((w) => pickedWallIds.has(w.id))
            .map((w) => (
              <line
                key={`picked-${w.id}`}
                data-testid={`plan-picked-${w.id}`}
                x1={w.start[0]}
                y1={w.start[1]}
                x2={w.end[0]}
                y2={w.end[1]}
                stroke="#22C55E"
                strokeWidth={w.thickness + 120}
                opacity={0.55}
                pointerEvents="none"
              />
            ))}

        {/* Press-drag-release preview */}
        {drawDrag &&
          Math.hypot(drawDrag.end[0] - drawDrag.start[0], drawDrag.end[1] - drawDrag.start[1]) > 100 &&
          (() => {
            const end = lockAxis(drawDrag.start, drawDrag.end);
            const len = Math.abs(end[0] - drawDrag.start[0]) + Math.abs(end[1] - drawDrag.start[1]);
            return (
              <g pointerEvents="none" data-testid="plan-draw-drag">
                <line
                  x1={drawDrag.start[0]}
                  y1={drawDrag.start[1]}
                  x2={end[0]}
                  y2={end[1]}
                  stroke="#F97316"
                  strokeWidth={activeTool === 'wall' ? 200 : 40}
                  strokeLinecap="round"
                  opacity={0.7}
                />
                <circle cx={drawDrag.start[0]} cy={drawDrag.start[1]} r={110} fill="#22C55E" stroke="#FFFFFF" strokeWidth={26} />
                <circle cx={end[0]} cy={end[1]} r={110} fill="#F97316" stroke="#FFFFFF" strokeWidth={26} />
                <text x={(drawDrag.start[0] + end[0]) / 2 + 160} y={(drawDrag.start[1] + end[1]) / 2 - 160} fill={labelTextDefault} fontSize={170} fontWeight={800}>
                  {len} mm
                </text>
              </g>
            );
          })()}

        {/* Running chain / grid rubber band */}
        {chainStart && (
          <g pointerEvents="none" data-testid="plan-chain-start">
            <circle cx={chainStart[0]} cy={chainStart[1]} r={110} fill="#22C55E" stroke="#FFFFFF" strokeWidth={26} />
            {hoverSnap && (
              <line
                x1={chainStart[0]}
                y1={chainStart[1]}
                x2={lockAxis(chainStart, hoverSnap)[0]}
                y2={lockAxis(chainStart, hoverSnap)[1]}
                stroke="#22C55E"
                strokeWidth={60}
                strokeDasharray="120 70"
                opacity={0.8}
              />
            )}
          </g>
        )}

        {/* Open Room boundary marker */}
        {roomGap && (
          <g pointerEvents="none" data-testid="plan-room-gap-marker">
            <circle cx={roomGap[0]} cy={roomGap[1]} r={240} fill="rgba(239,68,68,0.25)" stroke="#EF4444" strokeWidth={36} strokeDasharray="70 45" />
            <text x={roomGap[0] + 300} y={roomGap[1] - 160} fill="#EF4444" fontSize={140} fontWeight="800">
              Alan kapalı değil
            </text>
          </g>
        )}

        {/* Opening drag preview (red when illegal) */}
        {dragOpening &&
          (() => {
            const op = model.elements.find((el) => el.id === dragOpening.id);
            if (!op || (op.type !== 'door' && op.type !== 'window')) return null;
            const host = walls.find((w) => w.id === op.hostWallId);
            if (!host) return null;
            const [dx, dz] = getWallDirection(host);
            const sx = host.start[0] + dx * dragOpening.offset;
            const sz = host.start[1] + dz * dragOpening.offset;
            const ex = host.start[0] + dx * (dragOpening.offset + op.width);
            const ez = host.start[1] + dz * (dragOpening.offset + op.width);
            return (
              <line
                data-testid="plan-opening-drag-preview"
                x1={sx}
                y1={sz}
                x2={ex}
                y2={ez}
                stroke={dragOpening.valid ? '#38BDF8' : '#EF4444'}
                strokeWidth={host.thickness + 140}
                strokeDasharray="90 50"
                opacity={0.8}
                pointerEvents="none"
              />
            );
          })()}

        {/* Snap crosshair for every drawing tool */}
        {activeTool !== 'select' && hoverSnap && (
          <g pointerEvents="none">
            <line x1={hoverSnap[0] - 700} y1={hoverSnap[1]} x2={hoverSnap[0] + 700} y2={hoverSnap[1]} stroke="#38BDF8" strokeWidth={10} opacity={0.7} />
            <line x1={hoverSnap[0]} y1={hoverSnap[1] - 700} x2={hoverSnap[0]} y2={hoverSnap[1] + 700} stroke="#38BDF8" strokeWidth={10} opacity={0.7} />
            <circle
              cx={hoverSnap[0]}
              cy={hoverSnap[1]}
              r={hoverKind === 'endpoint' ? 130 : 85}
              fill={hoverKind === 'endpoint' ? 'rgba(34,197,94,0.35)' : 'rgba(56, 189, 248, 0.35)'}
              stroke={hoverKind === 'endpoint' ? '#22C55E' : '#38BDF8'}
              strokeWidth={22}
            />
            <text
              x={hoverSnap[0] + 190}
              y={hoverSnap[1] - 190}
              fill={labelTextDefault}
              fontSize={140}
              fontWeight="700"
              data-testid="plan-snap-label"
            >
              ({hoverSnap[0]}, {hoverSnap[1]})
              {hoverKind === 'endpoint' ? ' · uç nokta' : hoverKind === 'gridline' ? ' · aks' : ''}
            </text>
          </g>
        )}
      </svg>

      <div className="bq-plan-footer">
        <div className="bq-viewport-quick-select">
          <span className="bq-quick-label">Hızlı Seç:</span>
          {model.elements.map((el) => (
            <button
              key={el.id}
              type="button"
              className={`bq-chip-btn ${selectedId === el.id ? 'active' : ''}`}
              data-testid={`plan-quick-select-${el.id}`}
              onClick={() => onSelect(el.id)}
            >
              {el.id}
            </button>
          ))}
        </div>
        <span>1000 mm = 1 m</span>
      </div>
    </div>
  );
};
