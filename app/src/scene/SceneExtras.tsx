import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Edges, Line } from '@react-three/drei';
import { roomBoundary } from '../domain/derived';
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
import { getWallDirection, getWallLengthMm } from '../plan/geometry';

const MM = 0.001;

interface ExtrasProps {
  model: BimModel;
  selectedId: string | null;
  failedElementIds: Set<string>;
  xrayMode: boolean;
  isDark: boolean;
  onSelect: (id: string | null) => void;
}

const pick = (
  onSelect: (id: string | null) => void,
  id: string
): Pick<
  React.ComponentProps<'mesh'>,
  'onClick' | 'onPointerUp'
> => ({
  onClick: (e) => {
    e.stopPropagation();
    onSelect(id);
  },
  onPointerUp: (e) => {
    if ((e as unknown as { delta: number }).delta <= 12) {
      e.stopPropagation();
      onSelect(id);
    }
  },
});

const elev = (model: BimModel, levelId: string) =>
  model.levels.find((l) => l.id === levelId)?.elevation ?? 0;

const tint = (
  id: string,
  base: string,
  selectedId: string | null,
  failed: Set<string>
) => (selectedId === id ? '#38BDF8' : failed.has(id) ? '#EF4444' : base);

const FloorMesh: React.FC<{
  floor: FloorElement;
  y: number;
  color: string;
  opacity: number;
  onSelect: (id: string | null) => void;
}> = ({ floor, y, color, opacity, onSelect }) => {
  const geo = useMemo(() => {
    const shape = new THREE.Shape(
      floor.boundary.map(([x, z]) => new THREE.Vector2(x * MM, -z * MM))
    );
    return new THREE.ExtrudeGeometry(shape, {
      depth: floor.thickness * MM,
      bevelEnabled: false,
    });
  }, [floor.boundary, floor.thickness]);
  return (
    <mesh
      geometry={geo}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, y, 0]}
      receiveShadow
      castShadow
      userData={{ elementId: floor.id, elementType: 'floor' }}
      {...pick(onSelect, floor.id)}
    >
      <meshStandardMaterial color={color} roughness={0.85} transparent={opacity < 1} opacity={opacity} />
      <Edges color="#475569" />
    </mesh>
  );
};

/** Gable roof over the footprint's bounding box; ridge along the long side. */
const RoofMesh: React.FC<{
  roof: RoofElement;
  y: number;
  color: string;
  opacity: number;
  onSelect: (id: string | null) => void;
}> = ({ roof, y, color, opacity, onSelect }) => {
  const geo = useMemo(() => {
    const xs = roof.footprint.map((p) => p[0]);
    const zs = roof.footprint.map((p) => p[1]);
    const o = roof.overhang;
    const x0 = (Math.min(...xs) - o) * MM;
    const x1 = (Math.max(...xs) + o) * MM;
    const z0 = (Math.min(...zs) - o) * MM;
    const z1 = (Math.max(...zs) + o) * MM;
    const alongX = x1 - x0 >= z1 - z0;
    const half = (alongX ? z1 - z0 : x1 - x0) / 2;
    const rise = Math.tan((roof.slope * Math.PI) / 180) * half;
    const v: number[] = [];
    const tri = (...p: number[][]) => p.forEach((q) => v.push(...q));
    if (alongX) {
      const zm = (z0 + z1) / 2;
      const a = [x0, 0, z0], b = [x1, 0, z0], c = [x1, 0, z1], d = [x0, 0, z1];
      const r0 = [x0, rise, zm], r1 = [x1, rise, zm];
      tri(a, b, r1); tri(a, r1, r0);
      tri(d, r0, r1); tri(d, r1, c);
      tri(a, r0, d); tri(b, c, r1);
    } else {
      const xm = (x0 + x1) / 2;
      const a = [x0, 0, z0], b = [x1, 0, z0], c = [x1, 0, z1], d = [x0, 0, z1];
      const r0 = [xm, rise, z0], r1 = [xm, rise, z1];
      tri(a, r0, r1); tri(a, r1, d);
      tri(b, c, r1); tri(b, r1, r0);
      tri(a, b, r0); tri(d, r1, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }, [roof.footprint, roof.slope, roof.overhang]);
  return (
    <mesh
      geometry={geo}
      position={[0, y, 0]}
      castShadow
      userData={{ elementId: roof.id, elementType: 'roof' }}
      {...pick(onSelect, roof.id)}
    >
      <meshStandardMaterial color={color} roughness={0.7} side={THREE.DoubleSide} transparent={opacity < 1} opacity={opacity} />
      <Edges color="#7C2D12" />
    </mesh>
  );
};

const stairDir = (s: StairElement): [number, number] =>
  s.direction.startsWith('x')
    ? [s.direction === 'x+' ? 1 : -1, 0]
    : [0, s.direction === 'z+' ? 1 : -1];

/** Floors, roofs, stairs, windows (glass), rooms and grids. */
export const SceneExtras: React.FC<ExtrasProps> = ({
  model,
  selectedId,
  failedElementIds,
  xrayMode,
  isDark,
  onSelect,
}) => {
  const walls = model.elements.filter((e): e is WallElement => e.type === 'wall');
  const opacity = xrayMode ? 0.4 : 1;

  return (
    <group data-testid="scene-extras">
      {model.elements.map((el) => {
        if (el.type === 'floor') {
          return (
            <FloorMesh
              key={el.id}
              floor={el}
              y={elev(model, el.levelId) * MM - el.thickness * MM}
              color={tint(el.id, isDark ? '#334155' : '#CBD5E1', selectedId, failedElementIds)}
              opacity={opacity}
              onSelect={onSelect}
            />
          );
        }
        if (el.type === 'roof') {
          return (
            <RoofMesh
              key={el.id}
              roof={el}
              y={elev(model, el.baseLevelId) * MM}
              color={tint(el.id, '#F97316', selectedId, failedElementIds)}
              opacity={opacity}
              onSelect={onSelect}
            />
          );
        }
        if (el.type === 'stair') {
          const [dx, dz] = stairDir(el);
          const base = elev(model, el.baseLevelId) * MM;
          const color = tint(el.id, '#A78BFA', selectedId, failedElementIds);
          const along = Math.abs(dx) > 0;
          return (
            <group key={el.id} userData={{ elementId: el.id, elementType: 'stair' }}>
              {Array.from({ length: el.risers }).map((_, i) => {
                const h = (i + 1) * el.riserHeight * MM;
                const cx = el.start[0] * MM + dx * (i + 0.5) * el.treadDepth * MM + (along ? 0 : (el.width * MM) / 2);
                const cz = el.start[1] * MM + dz * (i + 0.5) * el.treadDepth * MM + (along ? (el.width * MM) / 2 : 0);
                const sx = along ? el.treadDepth * MM : el.width * MM;
                const sz = along ? el.width * MM : el.treadDepth * MM;
                return (
                  <mesh key={i} position={[cx, base + h / 2, cz]} castShadow receiveShadow {...pick(onSelect, el.id)}>
                    <boxGeometry args={[sx, h, sz]} />
                    <meshStandardMaterial color={color} roughness={0.6} transparent={opacity < 1} opacity={opacity} />
                    <Edges color="#312E81" />
                  </mesh>
                );
              })}
            </group>
          );
        }
        if (el.type === 'window') {
          const w: WindowElement = el;
          const host = walls.find((x) => x.id === w.hostWallId);
          if (!host || getWallLengthMm(host) <= 0) return null;
          const [dx, dz] = getWallDirection(host);
          const mid = w.offset + w.width / 2;
          const cx = (host.start[0] + dx * mid) * MM;
          const cz = (host.start[1] + dz * mid) * MM;
          const cy = (elev(model, host.baseLevelId) + w.sill + w.height / 2) * MM;
          const color = tint(w.id, '#7DD3FC', selectedId, failedElementIds);
          return (
            <group
              key={w.id}
              position={[cx, cy, cz]}
              rotation={[0, Math.atan2(-dz, dx), 0]}
              userData={{ elementId: w.id, elementType: 'window' }}
            >
              <mesh {...pick(onSelect, w.id)}>
                <boxGeometry args={[w.width * MM, w.height * MM, 0.02]} />
                <meshStandardMaterial color={color} transparent opacity={0.45} roughness={0.1} metalness={0.2} />
                <Edges color={selectedId === w.id ? '#E0F2FE' : '#0F172A'} />
              </mesh>
            </group>
          );
        }
        if (el.type === 'room') {
          const r: RoomElement = el;
          const b = roomBoundary(r, model);
          const y = elev(model, r.levelId) * MM + 0.012;
          const color = b.open || failedElementIds.has(r.id) ? '#EF4444' : '#38BDF8';
          return (
            <group key={r.id} userData={{ elementId: r.id, elementType: 'room' }}>
              {b.rects.map((q, i) => (
                <mesh
                  key={i}
                  position={[((q[0] + q[2]) / 2) * MM, y, ((q[1] + q[3]) / 2) * MM]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  {...pick(onSelect, r.id)}
                >
                  <planeGeometry args={[(q[2] - q[0]) * MM, (q[3] - q[1]) * MM]} />
                  <meshBasicMaterial color={selectedId === r.id ? '#38BDF8' : color} transparent opacity={0.22} />
                </mesh>
              ))}
              {b.open && b.gapAt && (
                <mesh position={[b.gapAt[0] * MM, y + 0.1, b.gapAt[1] * MM]}>
                  <sphereGeometry args={[0.18, 16, 16]} />
                  <meshBasicMaterial color="#EF4444" />
                </mesh>
              )}
            </group>
          );
        }
        if (el.type === 'grid') {
          const g: GridElement = el;
          const pts: Point[] = [g.start, g.end];
          return (
            <Line
              key={g.id}
              points={pts.map(([x, z]) => [x * MM, 0.03, z * MM] as [number, number, number])}
              color={tint(g.id, '#22D3EE', selectedId, failedElementIds)}
              lineWidth={selectedId === g.id ? 3 : 1.5}
              dashed
              dashSize={0.3}
              gapSize={0.1}
            />
          );
        }
        return null;
      })}
    </group>
  );
};
