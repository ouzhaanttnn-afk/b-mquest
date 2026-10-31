import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SceneExtras } from './SceneExtras';
import { Canvas } from '@react-three/fiber';
import { Edges, Grid, Html, Line, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type {
  BimModel,
  DoorElement,
  MissionTask,
  WallElement,
} from '../domain/types';
import {
  buildWallBoxes3D,
  getWallDirection,
  getWallLengthMm,
} from '../plan/geometry';

const MM_TO_M = 0.001;

declare global {
  interface Window {
    __BIMQUEST_FORCE_NO_WEBGL2__?: boolean;
    __BIMQUEST_TRIGGER_CONTEXT_LOSS__?: () => void;
  }
}

export interface SceneViewportProps {
  task: MissionTask;
  model: BimModel;
  selectedId: string | null;
  failedElementIds: Set<string>;
  reducedMotion: boolean;
  isVisible: boolean;
  theme?: 'light' | 'dark';
  onSelect: (id: string | null) => void;
}

function detectWebGL2Support(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__BIMQUEST_FORCE_NO_WEBGL2__) return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    return Boolean(gl);
  } catch {
    return false;
  }
}

interface BuildingSceneContentProps {
  task: MissionTask;
  model: BimModel;
  selectedId: string | null;
  failedElementIds: Set<string>;
  theme: 'light' | 'dark';
  xrayMode: boolean;
  show3dLabels: boolean;
  onSelect: (id: string | null) => void;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

const BuildingSceneContent: React.FC<BuildingSceneContentProps> = ({
  task,
  model,
  selectedId,
  failedElementIds,
  theme,
  xrayMode,
  show3dLabels,
  onSelect,
  controlsRef,
}) => {
  const isDark = theme === 'dark';
  const walls = useMemo(
    () => model.elements.filter((e): e is WallElement => e.type === 'wall'),
    [model.elements]
  );
  const doors = useMemo(
    () => model.elements.filter((e): e is DoorElement => e.type === 'door'),
    [model.elements]
  );

  const targetRoomTopLoop = useMemo(
    (): [number, number, number][] => [
      [0, 3, 0],
      [6, 3, 0],
      [6, 3, 4],
      [0, 3, 4],
      [0, 3, 0],
    ],
    []
  );

  const targetRoomBottomLoop = useMemo(
    (): [number, number, number][] => [
      [0, 0.01, 0],
      [6, 0.01, 0],
      [6, 0.01, 4],
      [0, 0.01, 4],
      [0, 0.01, 0],
    ],
    []
  );

  const targetDoorLoop = useMemo(
    (): [number, number, number][] => [
      [2.55, 0.01, -0.12],
      [3.45, 0.01, -0.12],
      [3.45, 2.1, -0.12],
      [2.55, 2.1, -0.12],
      [2.55, 0.01, -0.12],
    ],
    []
  );

  return (
    <>
      <color attach="background" args={[isDark ? '#0D1B2A' : '#E8F1F8']} />
      <ambientLight intensity={isDark ? 0.78 : 0.85} />
      <directionalLight
        position={[9, 14, 10]}
        intensity={1.18}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-6, 8, -6]} intensity={0.48} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[3, 1.25, 2]}
        minDistance={1.2}
        maxDistance={24}
        maxPolarAngle={Math.PI / 2 - 0.02}
        enableDamping={false}
      />

      {/* Base Studio Ground Plane & Architectural Grid */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[3, -0.08, 2]}
        receiveShadow
      >
        <planeGeometry args={[18, 16]} />
        <meshStandardMaterial
          color={isDark ? '#091320' : '#DCE6F2'}
          roughness={0.95}
        />
      </mesh>

      {/* 3D Architectural Foundation Slab (6.6m x 4.6m) */}
      <mesh position={[3, -0.04, 2]} receiveShadow castShadow>
        <boxGeometry args={[6.6, 0.08, 4.6]} />
        <meshStandardMaterial
          color={isDark ? '#1E293B' : '#CBD5E1'}
          roughness={0.85}
        />
        <Edges scale={1.001} threshold={15} color={isDark ? '#475569' : '#64748B'} />
      </mesh>

      {/* Interior Room Floor Surface (6.0m x 4.0m) */}
      <mesh position={[3, 0.004, 2]} receiveShadow>
        <boxGeometry args={[5.96, 0.01, 3.96]} />
        <meshStandardMaterial
          color={isDark ? '#243B55' : '#F8FAFC'}
          roughness={0.7}
        />
      </mesh>

      <Grid
        position={[3, 0.012, 2]}
        args={[16, 14]}
        cellSize={0.5}
        cellThickness={0.7}
        cellColor={isDark ? '#1E3A5F' : '#CBD5E1'}
        sectionSize={1}
        sectionThickness={1.4}
        sectionColor={isDark ? '#38BDF8' : '#64748B'}
        fadeDistance={24}
        infiniteGrid={false}
      />

      {/* Coordinate Axis Indicators at (0,0,0) */}
      <Line
        points={[
          [0, 0.02, 0],
          [1.2, 0.02, 0],
        ]}
        color="#38BDF8"
        lineWidth={3}
      />
      <Line
        points={[
          [0, 0.02, 0],
          [0, 1.2, 0],
        ]}
        color="#F97316"
        lineWidth={3}
      />
      <Line
        points={[
          [0, 0.02, 0],
          [0, 0.02, 1.2],
        ]}
        color="#10B981"
        lineWidth={3}
      />

      {/* Dashed Cyan Target Ghosts (first missions only) */}
      {['m01', 'm02', 'm03'].includes(task.id) && (
      <Line
        points={targetRoomBottomLoop}
        color="#38BDF8"
        lineWidth={2.5}
        dashed
        dashSize={0.2}
        gapSize={0.12}
      />
      )}
      {['m01', 'm02', 'm03'].includes(task.id) && (
      <Line
        points={targetRoomTopLoop}
        color="#38BDF8"
        lineWidth={2.5}
        dashed
        dashSize={0.2}
        gapSize={0.12}
      />
      )}
      {task.id === 'm03' && (
        <Line
          points={targetDoorLoop}
          color="#38BDF8"
          lineWidth={2.5}
          dashed
          dashSize={0.12}
          gapSize={0.08}
        />
      )}

      {/* Walls with Deterministic Cut Openings */}
      {walls.map((wall) => {
        const isSelected = selectedId === wall.id;
        const isFailed = failedElementIds.has(wall.id);
        const boxes = buildWallBoxes3D(wall, model);
        const level = model.levels.find((l) => l.id === wall.baseLevelId);
        const baseElev = level ? level.elevation : 0;
        const midX = ((wall.start[0] + wall.end[0]) * 0.5) * MM_TO_M;
        const midZ = ((wall.start[1] + wall.end[1]) * 0.5) * MM_TO_M;
        const topY = (baseElev + wall.height + 260) * MM_TO_M;
        const isLowWall = task.id === 'm01' && wall.height !== 3000;

        const wallColor = isSelected
          ? '#38BDF8'
          : isFailed || isLowWall
          ? '#EF4444'
          : xrayMode
          ? '#38BDF8'
          : isDark
          ? '#E2E8F0'
          : '#FFFFFF';
        const edgeColor = isSelected
          ? '#E0F2FE'
          : isFailed || isLowWall
          ? '#FCA5A5'
          : xrayMode
          ? '#38BDF8'
          : isDark
          ? '#0F172A'
          : '#334155';

        return (
          <group
            key={wall.id}
            userData={{ elementId: wall.id, elementType: 'wall' }}
          >
            {boxes.map((box) => (
              <mesh
                key={box.key}
                position={[
                  box.centerMm[0] * MM_TO_M,
                  box.centerMm[1] * MM_TO_M,
                  box.centerMm[2] * MM_TO_M,
                ]}
                castShadow={!xrayMode}
                receiveShadow
                userData={{ elementId: wall.id }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(wall.id);
                }}
                onPointerUp={(e) => {
                  if (e.delta <= 12) {
                    e.stopPropagation();
                    onSelect(wall.id);
                  }
                }}
              >
                <boxGeometry
                  args={[
                    box.sizeMm[0] * MM_TO_M,
                    box.sizeMm[1] * MM_TO_M,
                    box.sizeMm[2] * MM_TO_M,
                  ]}
                />
                <meshStandardMaterial
                  color={wallColor}
                  roughness={0.6}
                  metalness={0.08}
                  transparent={xrayMode}
                  opacity={xrayMode ? (isSelected ? 0.68 : 0.34) : 1}
                />
                <Edges scale={1.001} threshold={15} color={edgeColor} />
              </mesh>
            ))}

            {show3dLabels && (
              <Html
                position={[midX, topY, midZ]}
                center
                zIndexRange={[10, 0]}
              >
                <button
                  type="button"
                  className={`bq-3d-tag ${isSelected ? 'selected' : ''} ${
                    isFailed || isLowWall ? 'failed' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(wall.id);
                  }}
                >
                  {isFailed || isLowWall ? '! ' : isSelected ? '✓ ' : ''}
                  {wall.id} · {(wall.height / 1000).toFixed(1)}m
                </button>
              </Html>
            )}
          </group>
        );
      })}

      {/* Doors */}
      {doors.map((door) => {
        const host = walls.find((w) => w.id === door.hostWallId);
        if (!host) return null;
        const hostLen = getWallLengthMm(host);
        if (hostLen <= 0) return null;

        const level = model.levels.find((l) => l.id === host.baseLevelId);
        const baseElev = level ? level.elevation : 0;
        const [dx, dz] = getWallDirection(host);
        const angleY = Math.atan2(-dz, dx);

        const midOffset = door.offset + door.width / 2;
        const cx = (host.start[0] + dx * midOffset) * MM_TO_M;
        const cz = (host.start[1] + dz * midOffset) * MM_TO_M;
        const cy = (baseElev + door.sill + door.height / 2) * MM_TO_M;

        const wM = door.width * MM_TO_M;
        const hM = door.height * MM_TO_M;
        const tM = (host.thickness + 16) * MM_TO_M;
        const frameT = 0.045;

        const isSelected = selectedId === door.id;
        const isFailed = failedElementIds.has(door.id);
        const frameColor = isSelected
          ? '#38BDF8'
          : isFailed
          ? '#EF4444'
          : '#0F172A';
        const leafColor = isSelected
          ? '#38BDF8'
          : isFailed
          ? '#F87171'
          : '#F97316';

        return (
          <group
            key={door.id}
            position={[cx, cy, cz]}
            rotation={[0, angleY, 0]}
            userData={{ elementId: door.id, elementType: 'door' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(door.id);
            }}
            onPointerUp={(e) => {
              if (e.delta <= 12) {
                e.stopPropagation();
                onSelect(door.id);
              }
            }}
          >
            <mesh position={[-wM / 2 + frameT / 2, 0, 0]} castShadow>
              <boxGeometry args={[frameT, hM, tM]} />
              <meshStandardMaterial color={frameColor} />
            </mesh>
            <mesh position={[wM / 2 - frameT / 2, 0, 0]} castShadow>
              <boxGeometry args={[frameT, hM, tM]} />
              <meshStandardMaterial color={frameColor} />
            </mesh>
            <mesh position={[0, hM / 2 - frameT / 2, 0]} castShadow>
              <boxGeometry args={[wM, frameT, tM]} />
              <meshStandardMaterial color={frameColor} />
            </mesh>
            <group position={[-wM / 2 + frameT, 0, 0]} rotation={[0, 0.72, 0]}>
              <mesh position={[(wM - frameT * 2) / 2, 0, 0]} castShadow>
                <boxGeometry args={[wM - frameT * 2, hM - frameT, 0.04]} />
                <meshStandardMaterial
                  color={leafColor}
                  roughness={0.4}
                  transparent
                  opacity={0.92}
                />
                <Edges color="#0F172A" />
              </mesh>
            </group>
            {show3dLabels && (
              <Html position={[0, hM / 2 + 0.25, 0]} center zIndexRange={[10, 0]}>
                <button
                  type="button"
                  className={`bq-3d-tag door ${isSelected ? 'selected' : ''} ${
                    isFailed ? 'failed' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(door.id);
                  }}
                >
                  🚪 {door.id} · {door.width}mm
                </button>
              </Html>
            )}
          </group>
        );
      })}

      <SceneExtras
        model={model}
        selectedId={selectedId}
        failedElementIds={failedElementIds}
        xrayMode={xrayMode}
        isDark={isDark}
        onSelect={onSelect}
      />
    </>
  );
};

export const SceneViewport: React.FC<SceneViewportProps> = ({
  task,
  model,
  selectedId,
  failedElementIds,
  isVisible,
  theme = 'dark',
  onSelect,
}) => {
  const [webglSupported] = useState<boolean>(() => detectWebGL2Support());
  const [contextLost, setContextLost] = useState(false);
  const [sceneMountKey, setSceneMountKey] = useState(0);
  const [xrayMode, setXrayMode] = useState(false);
  const [show3dLabels, setShow3dLabels] = useState(true);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Camera framing follows the model: a 9 × 8 m house needs a wider shot than the 6 × 4 m room.
  const modelRef = useRef(model);
  modelRef.current = model;
  const frame = useCallback(() => {
    const walls = modelRef.current.elements.filter((e) => e.type === 'wall');
    if (walls.length === 0) return { cx: 3, cz: 2, w: 6, d: 4 };
    const xs = walls.flatMap((w) => [w.start[0], w.end[0]]);
    const zs = walls.flatMap((w) => [w.start[1], w.end[1]]);
    const w = (Math.max(...xs) - Math.min(...xs)) / 1000;
    const d = (Math.max(...zs) - Math.min(...zs)) / 1000;
    return {
      cx: (Math.max(...xs) + Math.min(...xs)) / 2000,
      cz: (Math.max(...zs) + Math.min(...zs)) / 2000,
      w: Math.max(w, 4),
      d: Math.max(d, 3),
    };
  }, []);

  const resetCamera = useCallback(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const f = frame();
    const span = Math.max(f.w, f.d);
    ctrl.object.position.set(f.cx + span * 0.95, span * 0.75 + 1.7, f.cz + span * 1.1);
    ctrl.target.set(f.cx, 1.2, f.cz);
    ctrl.update();
  }, [frame]);

  const setInsideRoomCamera = useCallback(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const f = frame();
    ctrl.object.position.set(f.cx, 1.65, f.cz + f.d * 0.35);
    ctrl.target.set(f.cx, 1.4, f.cz - f.d / 2);
    ctrl.update();
  }, [frame]);

  useEffect(() => {
    // The controls mount a frame after the canvas: reframe once they exist.
    const id = requestAnimationFrame(() => resetCamera());
    return () => cancelAnimationFrame(id);
  }, [task.id, sceneMountKey, resetCamera]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'select' ||
        activeTag === 'textarea'
      ) {
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        resetCamera();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetCamera]);

  useEffect(() => {
    window.__BIMQUEST_TRIGGER_CONTEXT_LOSS__ = () => {
      setContextLost(true);
    };
    return () => {
      delete window.__BIMQUEST_TRIGGER_CONTEXT_LOSS__;
    };
  }, []);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleCreated = useCallback(
    ({
      gl,
      camera,
      size,
    }: {
      gl: { domElement: HTMLCanvasElement };
      camera: { position: { x: number; y: number; z: number } };
      size: { width: number; height: number };
    }) => {
      const canvas = gl.domElement;
      glCanvasRef.current = canvas;
      // A square or tall pane sees less sideways: back the camera off so the whole
      // building stays in view (the vertical field of view is fixed).
      const aspect = size.width / Math.max(1, size.height);
      if (aspect > 0 && aspect < 1.4) {
        const f = frame();
        const k = Math.min(2.8, Math.max(1, 1.25 / Math.max(0.4, aspect)));
        camera.position.x = f.cx + (camera.position.x - f.cx) * k;
        camera.position.z = f.cz + (camera.position.z - f.cz) * k;
        camera.position.y *= k;
      }
      const onLost = (e: Event) => {
        e.preventDefault();
        if (isMountedRef.current) {
          setContextLost(true);
        }
      };
      const onRestored = () => {
        if (isMountedRef.current) {
          setContextLost(false);
        }
      };
      canvas.addEventListener('webglcontextlost', onLost, false);
      canvas.addEventListener('webglcontextrestored', onRestored, false);
    },
    [frame]
  );

  if (!webglSupported) {
    return (
      <div
        className="bq-webgl-fallback"
        data-testid="webgl-fallback"
        role="region"
        aria-label="3B Görünüm Kullanılamıyor Bilgisi"
      >
        <div className="bq-fallback-card">
          <h3>3B Sahne (WebGL2) Kullanılamıyor</h3>
          <p>
            2B Ortografik Plan ve Özellik Düzenleyici tam kapasiteyle çalışmaya
            devam ediyor.
          </p>
        </div>
      </div>
    );
  }

  if (contextLost) {
    return (
      <div
        className="bq-webgl-fallback"
        data-testid="webgl-context-lost"
        role="alert"
      >
        <div className="bq-fallback-card">
          <h3>3B Grafik Bağlantısı Kesildi</h3>
          <button
            type="button"
            className="bq-btn bq-btn-primary"
            data-testid="recover-webgl-btn"
            onClick={() => {
              setContextLost(false);
              setSceneMountKey((k) => k + 1);
            }}
          >
            3B Sahneyi Yeniden Yükle
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bq-scene-container" data-testid="scene-viewport">
      <div
        className="bq-viewport-toolbar bq-toolbar-3d"
        role="toolbar"
        aria-label="3B Sahne Araçları"
      >
        <span className="bq-viewport-badge bq-badge-3d">
          🧊 3B CANLI MİMARİ SAHNE (PERSPEKTİF · m)
        </span>
        <div className="bq-viewport-controls">
          <button
            type="button"
            className={`bq-chip-btn ${xrayMode ? 'active' : ''}`}
            onClick={() => setXrayMode((v) => !v)}
            data-testid="xray-toggle-btn"
            aria-pressed={xrayMode}
            title="X-Ray (Yarı Saydam Duvar / Röntgen) Modu"
          >
            🔍 X-Ray
          </button>
          <button
            type="button"
            className={`bq-chip-btn ${show3dLabels ? 'active' : ''}`}
            onClick={() => setShow3dLabels((v) => !v)}
            data-testid="scene-labels-toggle-btn"
            aria-pressed={show3dLabels}
            title="3B Nesne Etiketlerini Aç/Kapat"
          >
            🏷️ Etiket
          </button>
          <button
            type="button"
            className="bq-chip-btn"
            onClick={setInsideRoomCamera}
            data-testid="inside-camera-btn"
            title="Odanın İçinden Göz Hizasında (1650 mm) Bak"
          >
            👁️ Oda İçi
          </button>
          <button
            type="button"
            className="bq-chip-btn"
            onClick={resetCamera}
            data-testid="reset-camera-btn"
            title="Kamerayı Başlangıç Açısına Sıfırla (Home)"
          >
            Dış Kamera (Home)
          </button>
        </div>
      </div>

      <div className="bq-canvas-wrapper">
        <Canvas
          key={sceneMountKey}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          dpr={1}
          shadows
          frameloop={isVisible ? 'always' : 'never'}
          camera={{
            position: (() => {
              const f = frame();
              const span = Math.max(f.w, f.d);
              return [f.cx + span * 0.95, span * 0.75 + 1.7, f.cz + span * 1.1] as [number, number, number];
            })(),
            fov: 42,
            near: 0.1,
            far: 120,
          }}
          onPointerMissed={() => onSelect(null)}
          onCreated={handleCreated}
        >
          <BuildingSceneContent
            task={task}
            model={model}
            selectedId={selectedId}
            failedElementIds={failedElementIds}
            theme={theme}
            xrayMode={xrayMode}
            show3dLabels={show3dLabels}
            onSelect={onSelect}
            controlsRef={controlsRef}
          />
        </Canvas>
      </div>

      <div className="bq-plan-footer">
        <div className="bq-viewport-quick-select">
          <span className="bq-quick-label">Hızlı Seç:</span>
          {model.elements.map((el) => (
            <button
              key={el.id}
              type="button"
              className={`bq-chip-btn ${selectedId === el.id ? 'active' : ''}`}
              data-testid={`scene-quick-select-${el.id}`}
              onClick={() => onSelect(el.id)}
            >
              {el.id}
            </button>
          ))}
        </div>
        <span>Sürükle: Döndür · Göz: 1.65 m</span>
      </div>
    </div>
  );
};
