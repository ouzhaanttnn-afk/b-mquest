import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDoorCommand,
  createWallCommand,
  deleteElementCommand,
  moveWallCommand,
  redoCommand,
  resetMissionSession,
  revealNextHintCommand,
  undoCommand,
  updateElementProperty,
  type MissionSessionState,
} from '../domain/commands';
import { evaluate } from '../domain/evaluator';
import {
  calculateMissionXp,
  explainCriterionFailureTr,
  getMissionLearningGuide,
  getPedagogicalFlowSteps,
} from '../domain/pedagogy';
import type {
  BadgeType,
  CriterionEvidence,
  DoorElement,
  EditableField,
  MissionTask,
  SubmittedEvaluation,
  WallElement,
} from '../domain/types';
import {
  PlanViewport,
  type DoorDraftPreview,
  type WallDraftPreview,
} from '../plan/PlanViewport';
import { getWallLengthMm } from '../plan/geometry';
import { SceneViewport } from '../scene/SceneViewport';
import { isSoundMuted, playSound, setSoundMuted } from './sound';
import { startMission1Tutorial } from './tutorial';

export interface WorkspaceProps {
  session: MissionSessionState;
  allMissions: MissionTask[];
  completedMap: Record<string, { bestScore: number }>;
  reducedMotion: boolean;
  theme?: 'light' | 'dark';
  storageWarning: string | null;
  onToggleTheme?: () => void;
  onSessionChange: (
    next: MissionSessionState,
    passingEvaluation?: SubmittedEvaluation
  ) => void;
  onResetDraftConfirmed: (resetSession: MissionSessionState) => void;
  onBackToDashboard: () => void;
  onGoToNextMission: (nextMissionId: string) => void;
  onExportSave: () => void;
}

const WALL_QUICK_PRESETS: Array<{
  label: string;
  name: string;
  startX: string;
  startZ: string;
  endX: string;
  endZ: string;
}> = [
  {
    label: 'Güney (0,0 → 6000,0)',
    name: 'w_south',
    startX: '0',
    startZ: '0',
    endX: '6000',
    endZ: '0',
  },
  {
    label: 'Doğu (6000,0 → 6000,4000)',
    name: 'w_east',
    startX: '6000',
    startZ: '0',
    endX: '6000',
    endZ: '4000',
  },
  {
    label: 'Kuzey (6000,4000 → 0,4000)',
    name: 'w_north',
    startX: '6000',
    startZ: '4000',
    endX: '0',
    endZ: '4000',
  },
  {
    label: 'Batı (0,4000 → 0,0)',
    name: 'w_west',
    startX: '0',
    startZ: '4000',
    endX: '0',
    endZ: '0',
  },
];

function badgeLabelTr(badge: BadgeType): string {
  if (badge === 'gold') return 'Altın Rozet';
  if (badge === 'silver') return 'Gümüş Rozet';
  if (badge === 'bronze') return 'Bronz Rozet';
  return 'Yok';
}

function formatCriterionEvidenceTr(c: CriterionEvidence): string {
  if (typeof c.expected === 'number') {
    const actualStr =
      c.actual === null || c.actual === undefined
        ? 'Eksik (yok)'
        : `${c.actual}${c.id.startsWith('c_count') || c.id.startsWith('c_doors') ? ' adet' : ' mm'}`;
    const expectedStr = `${c.expected}${
      c.id.startsWith('c_count') || c.id.startsWith('c_doors') ? ' adet' : ' mm'
    }`;
    const tolStr = c.tolerance > 0 ? ` (±${c.tolerance} mm)` : '';
    return `Gerçek: ${actualStr} · Hedef: ${expectedStr}${tolStr}`;
  }
  if (typeof c.expected === 'string') {
    const actualStr =
      c.actual === null || c.actual === undefined ? 'Eksik (yok)' : String(c.actual);
    return `Gerçek: "${actualStr}" · Hedef: "${c.expected}"`;
  }
  if (c.expected && typeof c.expected === 'object') {
    const exp = c.expected as {
      origin: [number, number];
      width: number;
      depth: number;
      wallHeight: number;
      thickness: number;
    };
    return `Durum: ${
      c.actual ? 'Kapalı dikdörtgen eşleşti' : 'Kapalı dikdörtgen eşleşmedi'
    } · Hedef: ${exp.width}×${exp.depth} mm, Y:${exp.wallHeight} mm, K:${exp.thickness} mm (±${c.tolerance} mm)`;
  }
  return '';
}

export const Workspace: React.FC<WorkspaceProps> = ({
  session,
  allMissions,
  reducedMotion,
  theme = 'dark',
  storageWarning,
  onToggleTheme,
  onSessionChange,
  onResetDraftConfirmed,
  onBackToDashboard,
  onGoToNextMission,
  onExportSave,
}) => {
  const { task, model, selectedId, lastEvaluation, revealedHints } = session;

  // Tool mode: 'select' | 'wall' | 'door'
  const [activeTool, setActiveTool] = useState<'select' | 'wall' | 'door'>('select');
  // Center viewport layout: 'split' | 'plan' | '3d'
  const [viewMode, setViewMode] = useState<'split' | 'plan' | '3d'>('split');
  // Mobile/Tablet active drawer tab: 'brief' | 'inspector' | 'check'
  const [mobileDrawerTab, setMobileDrawerTab] = useState<'brief' | 'inspector' | 'check'>('inspector');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  // Collapsible side panels for 1024x768 & 200% zoom
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Compact ⓘ Info Cards in Left Panel
  const [showLearnDetail, setShowLearnDetail] = useState(true);
  const [showMoreLearn, setShowMoreLearn] = useState(false);
  const [showRulesDetail, setShowRulesDetail] = useState(false);
  const [showStepByStepGuide, setShowStepByStepGuide] = useState(false);

  // Field-level validation / command feedback
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Modals & Audio
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [recapModalOpen, setRecapModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [soundMuted, setSoundMutedState] = useState<boolean>(() => isSoundMuted());
  const resetCancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const resetTriggerBtnRef = useRef<HTMLButtonElement | null>(null);
  const parMoves = task.id === 'm03' ? 2 : 1;

  // Live mission completion progress for the game HUD bar
  const liveProgress = useMemo(() => {
    const res = evaluate(task, model, revealedHints.length);
    const passed = res.criteria.filter((c) => c.pass).length;
    const total = res.criteria.length;
    const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
    return { passed, total, pct, allPass: res.pass };
  }, [task, model, revealedHints.length]);

  // Local text drafts for selected element editing (synced synchronously on selection/revision change)
  const selectedElement = useMemo(
    () => model.elements.find((e) => e.id === selectedId) ?? null,
    [model.elements, selectedId]
  );

  const buildDraftsForElement = (el: typeof selectedElement): Record<string, string> => {
    if (!el) return {};
    if (el.type === 'wall') {
      return {
        name: el.name,
        height: String(el.height),
        thickness: String(el.thickness),
        startX: String(el.start[0]),
        startZ: String(el.start[1]),
        endX: String(el.end[0]),
        endZ: String(el.end[1]),
        baseLevelId: el.baseLevelId,
      };
    }
    return {
      name: el.name,
      hostWallId: el.hostWallId,
      offset: String(el.offset),
      width: String(el.width),
      height: String(el.height),
      sill: String(el.sill),
      mark: el.mark,
      fireRating: el.fireRating,
    };
  };

  const syncKey = `${task.id}:${selectedElement?.id ?? 'none'}:${session.revision}`;
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey);
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>(() =>
    buildDraftsForElement(selectedElement)
  );

  if (prevSyncKey !== syncKey) {
    setPrevSyncKey(syncKey);
    setEditDrafts(buildDraftsForElement(selectedElement));
  }

  // Wall Creation Form State
  const [wallForm, setWallForm] = useState({
    name: 'Duvar 1',
    baseLevelId: task.initialModel.levels[0]?.id ?? 'l0',
    startX: '0',
    startZ: '0',
    endX: '6000',
    endZ: '0',
    height: '3000',
    thickness: '200',
  });
  const [wallPickStep, setWallPickStep] = useState<'start' | 'end'>('start');

  // Door Creation Form State
  const wallsInModel = useMemo(
    () => model.elements.filter((e): e is WallElement => e.type === 'wall'),
    [model.elements]
  );

  const [doorForm, setDoorForm] = useState({
    name: 'Giriş Kapısı',
    hostWallId:
      wallsInModel.find((w) => w.id === 'w_south')?.id ??
      wallsInModel[0]?.id ??
      'w_south',
    offset: '2550',
    width: '900',
    height: '2100',
    sill: '0',
    mark: 'D-01',
    fireRating: 'none',
  });

  // Update default hostWallId when mission changes or walls change
  useEffect(() => {
    setActiveTool('select');
    setFieldError(null);
    setRecapModalOpen(false);
    setMobileSheetOpen(false);
    const defaultHost =
      model.elements.find((e) => e.id === 'w_south')?.id ??
      model.elements.find((e) => e.type === 'wall')?.id ??
      'w_south';
    setDoorForm((prev) => ({
      ...prev,
      hostWallId: defaultHost,
    }));
  }, [task.id]);

  // Focus trap inside reset dialog
  useEffect(() => {
    if (resetModalOpen) {
      resetCancelBtnRef.current?.focus();
    }
  }, [resetModalOpen]);

  // Keyboard shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (resetModalOpen) {
          e.preventDefault();
          setResetModalOpen(false);
          resetTriggerBtnRef.current?.focus();
          return;
        }
        if (recapModalOpen) {
          e.preventDefault();
          setRecapModalOpen(false);
          return;
        }
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'select' && activeTag !== 'textarea') {
          if (activeTool !== 'select') {
            e.preventDefault();
            setActiveTool('select');
            setFieldError(null);
          }
        }
        return;
      }

      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'select' || activeTag === 'textarea') {
        // Native text undo stays local while typing
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (session.future.length > 0) {
            onSessionChange(redoCommand(session));
          }
        } else {
          if (session.past.length > 0) {
            onSessionChange(undoCommand(session));
          }
        }
      } else if (isMod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (session.future.length > 0) {
          onSessionChange(redoCommand(session));
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTool, onSessionChange, recapModalOpen, resetModalOpen, session]);

  // Determine which element IDs have failed criteria in the last evaluation
  const failedElementIds = useMemo(() => {
    const set = new Set<string>();
    if (!lastEvaluation || lastEvaluation.stale) return set;
    for (const c of lastEvaluation.criteria) {
      if (!c.pass) {
        const taskCrit = task.criteria.find((tc) => tc.id === c.id);
        if (taskCrit && taskCrit.type === 'property') {
          set.add(taskCrit.elementId);
        }
      }
    }
    return set;
  }, [lastEvaluation, task.criteria]);

  const handleSelectElement = useCallback(
    (id: string | null) => {
      setFieldError(null);
      if (id) {
        playSound('select');
      }
      onSessionChange({
        ...session,
        selectedId: id,
      });
      if (id) {
        setMobileDrawerTab('inspector');
        setMobileSheetOpen(true);
      }
      if (id && activeTool === 'door') {
        const clickedWall = model.elements.find(
          (e) => e.id === id && e.type === 'wall'
        );
        if (clickedWall) {
          setDoorForm((prev) => ({ ...prev, hostWallId: clickedWall.id }));
        }
      }
    },
    [activeTool, model.elements, onSessionChange, session]
  );

  // Commit a single property field (called on Enter or Blur)
  const commitSingleField = (field: EditableField, rawValue: unknown) => {
    if (!selectedElement) return;
    const res = updateElementProperty(
      session,
      selectedElement.id,
      field,
      rawValue
    );
    if (!res.ok) {
      playSound('error');
      setFieldError(res.error.message);
      return;
    }
    setFieldError(null);
    if (res.state !== session) {
      playSound('snap');
      onSessionChange(res.state);
      setStatusToast(`${selectedElement.id}: ${field} güncellendi.`);
    }
  };

  const commitCoordPair = (which: 'start' | 'end') => {
    if (!selectedElement || selectedElement.type !== 'wall') return;
    const rawX = which === 'start' ? editDrafts.startX : editDrafts.endX;
    const rawZ = which === 'start' ? editDrafts.startZ : editDrafts.endZ;
    commitSingleField(which, [rawX, rawZ]);
  };

  const restoreDraftField = (fieldKey: string) => {
    if (!selectedElement) return;
    setFieldError(null);
    if (selectedElement.type === 'wall') {
      const map: Record<string, string> = {
        name: selectedElement.name,
        height: String(selectedElement.height),
        thickness: String(selectedElement.thickness),
        startX: String(selectedElement.start[0]),
        startZ: String(selectedElement.start[1]),
        endX: String(selectedElement.end[0]),
        endZ: String(selectedElement.end[1]),
        baseLevelId: selectedElement.baseLevelId,
      };
      setEditDrafts((prev) => ({ ...prev, [fieldKey]: map[fieldKey] ?? '' }));
    } else {
      const map: Record<string, string> = {
        name: selectedElement.name,
        hostWallId: selectedElement.hostWallId,
        offset: String(selectedElement.offset),
        width: String(selectedElement.width),
        height: String(selectedElement.height),
        sill: String(selectedElement.sill),
        mark: selectedElement.mark,
        fireRating: selectedElement.fireRating,
      };
      setEditDrafts((prev) => ({ ...prev, [fieldKey]: map[fieldKey] ?? '' }));
    }
  };

  const handleFieldKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    fieldKey: string,
    onCommit: () => void
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      restoreDraftField(fieldKey);
    }
  };

  // Wall Creation submit
  const handleCreateWallSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createWallCommand(session, {
      name: wallForm.name,
      baseLevelId: wallForm.baseLevelId,
      startX: wallForm.startX,
      startZ: wallForm.startZ,
      endX: wallForm.endX,
      endZ: wallForm.endZ,
      height: wallForm.height,
      thickness: wallForm.thickness,
    });
    if (!res.ok) {
      playSound('error');
      setFieldError(res.error.message);
      return;
    }
    playSound('build');
    setFieldError(null);
    onSessionChange(res.state);
    const nextCount =
      res.state.model.elements.filter((el) => el.type === 'wall').length + 1;
    setWallForm((prev) => ({
      ...prev,
      name: `Duvar ${nextCount}`,
      startX: prev.endX,
      startZ: prev.endZ,
    }));
    setStatusToast(`${res.createdId} duvarı oluşturuldu.`);
  };

  // Door Creation submit
  const handleCreateDoorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createDoorCommand(session, {
      name: doorForm.name,
      hostWallId: doorForm.hostWallId,
      offset: doorForm.offset,
      width: doorForm.width,
      height: doorForm.height,
      sill: doorForm.sill,
      mark: doorForm.mark,
      fireRating: doorForm.fireRating,
    });
    if (!res.ok) {
      playSound('error');
      setFieldError(res.error.message);
      return;
    }
    playSound('build');
    setFieldError(null);
    onSessionChange(res.state);
    setActiveTool('select');
    setStatusToast(`${res.createdId} kapısı oluşturuldu.`);
  };

  // Delete selected element
  const handleDeleteSelected = () => {
    if (!selectedId) return;
    const res = deleteElementCommand(session, selectedId);
    if (!res.ok) {
      playSound('error');
      setFieldError(res.error.message);
      return;
    }
    playSound('click');
    setFieldError(null);
    onSessionChange(res.state);
    setStatusToast(`${selectedId} silindi.`);
  };

  // Wall translation (move) state & handler
  const [moveDelta, setMoveDelta] = useState({ dx: '500', dz: '0' });

  const handleMoveSelectedWall = (dxRaw: string | number, dzRaw: string | number) => {
    if (!selectedId) return;
    const res = moveWallCommand(session, selectedId, dxRaw, dzRaw);
    if (!res.ok) {
      playSound('error');
      setFieldError(res.error.message);
      return;
    }
    playSound('snap');
    setFieldError(null);
    onSessionChange(res.state);
    setStatusToast(`${selectedId} duvarı taşındı (ΔX:${dxRaw}, ΔZ:${dzRaw} mm).`);
  };

  const learningGuide = useMemo(() => getMissionLearningGuide(task), [task]);
  const pedagogicalSteps = useMemo(
    () => getPedagogicalFlowSteps(session.revision, lastEvaluation),
    [session.revision, lastEvaluation]
  );

  // Run deterministic evaluation ("Kontrol et")
  const handleRunCheck = () => {
    setFieldError(null);
    const frozenModel = JSON.parse(JSON.stringify(model));
    const evalRes = evaluate(task, frozenModel, revealedHints.length);
    const submitted: SubmittedEvaluation = {
      ...evalRes,
      evaluatedRevision: session.revision,
      stale: false,
    };
    const nextSession: MissionSessionState = {
      ...session,
      lastEvaluation: submitted,
    };
    onSessionChange(nextSession, evalRes.pass ? submitted : undefined);
    setMobileDrawerTab('check');
    if (evalRes.pass) {
      playSound('success');
      setRecapModalOpen(true);
    } else {
      playSound('error');
    }
  };

  // Live previews for 2D plan
  const wallPreview = useMemo((): WallDraftPreview | null => {
    if (activeTool !== 'wall') return null;
    const sx = Number(wallForm.startX);
    const sz = Number(wallForm.startZ);
    const ex = Number(wallForm.endX);
    const ez = Number(wallForm.endZ);
    const th = Number(wallForm.thickness);
    if ([sx, sz, ex, ez].some((n) => !Number.isFinite(n))) return null;
    return {
      startX: sx,
      startZ: sz,
      endX: ex,
      endZ: ez,
      thickness: Number.isFinite(th) && th > 0 ? th : 200,
    };
  }, [activeTool, wallForm]);

  const doorPreview = useMemo((): DoorDraftPreview | null => {
    if (activeTool !== 'door') return null;
    const off = Number(doorForm.offset);
    const w = Number(doorForm.width);
    if (!doorForm.hostWallId || !Number.isFinite(off) || !Number.isFinite(w)) {
      return null;
    }
    return {
      hostWallId: doorForm.hostWallId,
      offset: off,
      width: w,
    };
  }, [activeTool, doorForm]);

  const handlePlanPickWallCoord = (x: number, z: number) => {
    if (wallPickStep === 'start') {
      setWallForm((prev) => ({
        ...prev,
        startX: String(x),
        startZ: String(z),
      }));
      setWallPickStep('end');
    } else {
      setWallForm((prev) => ({
        ...prev,
        endX: String(x),
        endZ: String(z),
      }));
      setWallPickStep('start');
    }
  };

  const handlePlanPickDoorOffset = (hostWallId: string, offsetMm: number) => {
    setDoorForm((prev) => ({
      ...prev,
      hostWallId,
      offset: String(offsetMm),
    }));
  };

  const isFieldEditable = (field: EditableField): boolean => {
    if (!selectedElement) return false;
    const isSeed = task.initialModel.elements.some(
      (e) => e.id === selectedElement.id
    );
    if (isSeed && !task.permissions.editableSeedIds.includes(selectedElement.id)) {
      return false;
    }
    return task.permissions.editableFields.includes(field);
  };

  const canDeleteSelected = useMemo(() => {
    if (!selectedElement) return false;
    const isSeed = task.initialModel.elements.some(
      (e) => e.id === selectedElement.id
    );
    return !isSeed && task.permissions.deletableCreated;
  }, [selectedElement, task]);

  const nextMission = useMemo(() => {
    const idx = allMissions.findIndex((m) => m.id === task.id);
    if (idx >= 0 && idx + 1 < allMissions.length) {
      return allMissions[idx + 1];
    }
    return null;
  }, [allMissions, task.id]);

  // Focus target element when clicking a failed criterion row
  const handleCriterionClick = (criterionId: string) => {
    const tc = task.criteria.find((c) => c.id === criterionId);
    if (tc && tc.type === 'property') {
      handleSelectElement(tc.elementId);
      setMobileDrawerTab('inspector');
    } else if (model.elements.length > 0) {
      handleSelectElement(model.elements[0].id);
      setMobileDrawerTab('inspector');
    }
  };

  return (
    <div className="bq-workspace" data-testid="workspace-screen">
      {/* Top Mission & Tool Bar */}
      <header className="bq-ws-topbar">
        <div className="bq-ws-title-group">
          <button
            type="button"
            className="bq-btn bq-btn-secondary bq-btn-compact"
            data-testid="back-dashboard-btn"
            onClick={onBackToDashboard}
          >
            ← Görevler
          </button>
          <div className="bq-ws-heading">
            <span className="bq-ws-id">{task.id.toUpperCase()}</span>
            <h1>{task.title}</h1>
          </div>
          {/* Live Game Progress Pill */}
          <div
            className="bq-live-progress-pill"
            data-testid="live-progress-pill"
            title={`Hedef İlerlemesi: ${liveProgress.passed}/${liveProgress.total} kural tamamlandı`}
          >
            <span className="bq-live-progress-txt">
              🎯 %{liveProgress.pct} ({liveProgress.passed}/{liveProgress.total})
            </span>
            <span className="bq-live-progress-bar">
              <span
                className="bq-live-progress-fill"
                style={{ width: `${liveProgress.pct}%` }}
              />
            </span>
          </div>
        </div>

        {/* Main Modeling & History Toolbar */}
        <div className="bq-ws-tools" role="toolbar" aria-label="Modelleme Araçları">
          <button
            type="button"
            className={`bq-tool-btn ${activeTool === 'select' ? 'active' : ''}`}
            data-testid="tool-select-btn"
            onClick={() => {
              setActiveTool('select');
              setFieldError(null);
            }}
            aria-pressed={activeTool === 'select'}
          >
            <svg width="18" height="18" aria-hidden="true">
              <use href="./assets/ui/icons.svg#select" />
            </svg>
            <span>Seç</span>
          </button>

          {task.permissions.creatableTypes.includes('wall') && (
            <button
              type="button"
              className={`bq-tool-btn ${activeTool === 'wall' ? 'active' : ''}`}
              data-testid="tool-wall-btn"
              onClick={() => {
                setActiveTool((t) => (t === 'wall' ? 'select' : 'wall'));
                setMobileDrawerTab('inspector');
                setMobileSheetOpen(true);
                setFieldError(null);
              }}
              aria-pressed={activeTool === 'wall'}
            >
              <svg width="18" height="18" aria-hidden="true">
                <use href="./assets/ui/icons.svg#wall" />
              </svg>
              <span>Duvar Oluştur</span>
            </button>
          )}

          {task.permissions.creatableTypes.includes('door') && (
            <button
              type="button"
              className={`bq-tool-btn ${activeTool === 'door' ? 'active' : ''}`}
              data-testid="tool-door-btn"
              onClick={() => {
                setActiveTool((t) => (t === 'door' ? 'select' : 'door'));
                setMobileDrawerTab('inspector');
                setMobileSheetOpen(true);
                setFieldError(null);
              }}
              aria-pressed={activeTool === 'door'}
            >
              <svg width="18" height="18" aria-hidden="true">
                <use href="./assets/ui/icons.svg#door" />
              </svg>
              <span>Kapı Oluştur</span>
            </button>
          )}

          <button
            type="button"
            className="bq-tool-btn"
            data-testid="undo-btn"
            disabled={session.past.length === 0}
            onClick={() => onSessionChange(undoCommand(session))}
            title="Geri Al (Ctrl+Z)"
          >
            <svg width="18" height="18" aria-hidden="true">
              <use href="./assets/ui/icons.svg#undo" />
            </svg>
            <span>Geri Al</span>
          </button>

          <button
            type="button"
            className="bq-tool-btn"
            data-testid="redo-btn"
            disabled={session.future.length === 0}
            onClick={() => onSessionChange(redoCommand(session))}
            title="İleri Al (Ctrl+Shift+Z)"
          >
            <svg width="18" height="18" aria-hidden="true">
              <use href="./assets/ui/icons.svg#redo" />
            </svg>
            <span>İleri Al</span>
          </button>

          <button
            type="button"
            ref={resetTriggerBtnRef}
            className="bq-tool-btn bq-tool-danger"
            data-testid="reset-mission-btn"
            onClick={() => setResetModalOpen(true)}
            title="Görevi Başlangıç Durumuna Sıfırla"
          >
            <svg width="18" height="18" aria-hidden="true">
              <use href="./assets/ui/icons.svg#reset" />
            </svg>
            <span>Sıfırla</span>
          </button>

          {task.id === 'm01' && (
            <button
              type="button"
              className="bq-tool-btn"
              data-testid="start-tour-btn"
              onClick={startMission1Tutorial}
              title="Adım Adım Rehber Turunu Başlat"
            >
              <span>Rehber Turu</span>
            </button>
          )}

          <button
            type="button"
            className="bq-info-btn"
            data-testid="ws-info-btn"
            onClick={() => {
              playSound('click');
              setInfoModalOpen(true);
            }}
            title="Görev Rehberi ve BIM Kuralları (ⓘ)"
            aria-label="Görev Rehberi ve BIM Kuralları"
          >
            i
          </button>

          <button
            type="button"
            className="bq-tool-btn"
            data-testid="sound-toggle-btn"
            onClick={() => {
              const next = !soundMuted;
              setSoundMuted(next);
              setSoundMutedState(next);
              if (!next) playSound('click');
            }}
            title={soundMuted ? 'Oyun Seslerini Aç' : 'Oyun Seslerini Kapat'}
            aria-label={soundMuted ? 'Oyun Seslerini Aç' : 'Oyun Seslerini Kapat'}
          >
            <span>{soundMuted ? '🔇' : '🔊'}</span>
          </button>

          {onToggleTheme && (
            <button
              type="button"
              className="bq-tool-btn"
              data-testid="ws-theme-toggle-btn"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Açık Temaya Geç' : 'Koyu Temaya Geç'}
            >
              <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
            </button>
          )}
        </div>
      </header>

      {/* 5-Step Pedagogical Learning Loop Bar */}
      <nav
        className="bq-pedagogy-bar"
        aria-label="5 Adımlı Öğrenme Akışı"
        data-testid="pedagogical-stepper"
      >
        {pedagogicalSteps.map((st) => (
          <div
            key={st.stepNumber}
            className={`bq-pedagogy-step status-${st.status}`}
            data-testid={`pedagogy-step-${st.stepNumber}`}
            title={st.description}
          >
            <span className="bq-step-dot">
              {st.status === 'completed' ? '✓' : st.stepNumber}
            </span>
            <span className="bq-step-label">{st.label}</span>
          </div>
        ))}
      </nav>

      {/* Storage warning if localStorage is blocked/full */}
      {storageWarning && (
        <div
          className="bq-banner bq-banner-warning"
          role="alert"
          data-testid="ws-storage-warning"
        >
          <span>{storageWarning}</span>
          <button
            type="button"
            className="bq-btn bq-btn-secondary bq-btn-compact"
            onClick={onExportSave}
          >
            JSON Dışa Aktar
          </button>
        </div>
      )}

      {/* Main 3-Column / Responsive Body */}
      <div className="bq-ws-body">
        {/* LEFT PANEL: Mission Brief, Compact ⓘ Info Pills & Progressive Hints */}
        <aside
          className={`bq-panel bq-panel-left ${
            leftCollapsed ? 'collapsed' : ''
          } ${mobileDrawerTab === 'brief' ? 'mobile-active' : ''} ${
            mobileDrawerTab === 'brief' && mobileSheetOpen ? 'sheet-open' : ''
          }`}
          data-tour="mission-brief"
          aria-label="Görev Özeti ve İpuçları"
        >
          <div className="bq-panel-header">
            <h2>Görev & Rehber</h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="bq-chip-btn bq-mobile-close-sheet-btn"
                onClick={() => setMobileSheetOpen(false)}
              >
                ✕ Sahneyi Gör
              </button>
              <button
                type="button"
                className="bq-chip-btn bq-desktop-collapse-btn"
                onClick={() => setLeftCollapsed((v) => !v)}
                aria-expanded={!leftCollapsed}
                data-testid="toggle-left-panel-btn"
              >
                {leftCollapsed ? 'Göster »' : '« Daralt'}
              </button>
            </div>
          </div>

          {!leftCollapsed && (
            <div className="bq-panel-scroll">
              <p className="bq-objective-box" data-testid="mission-objective-text">
                {task.objective}
              </p>

              {/* Compact ⓘ Info Toggle Row so explanations don't crowd the screen */}
              <div className="bq-compact-info-pills" role="group" aria-label="Bilgi Kartları">
                <button
                  type="button"
                  className={`bq-chip-btn ${showLearnDetail ? 'active' : ''}`}
                  data-testid="toggle-learn-info-btn"
                  onClick={() => setShowLearnDetail((v) => !v)}
                >
                  ⓘ 1. Öğren {showLearnDetail ? '▾' : '▸'}
                </button>
                <button
                  type="button"
                  className={`bq-chip-btn ${showRulesDetail ? 'active' : ''}`}
                  data-testid="toggle-rules-info-btn"
                  onClick={() => setShowRulesDetail((v) => !v)}
                >
                  ⓘ Kurallar ({liveProgress.passed}/{liveProgress.total}){' '}
                  {showRulesDetail ? '▾' : '▸'}
                </button>
                <button
                  type="button"
                  className="bq-chip-btn"
                  onClick={() => setInfoModalOpen(true)}
                >
                  ⓘ Tam Rehber
                </button>
              </div>

              {/* 1. ÖĞREN: Compact Revit Concept + Real Revit UI Path + Expandable Detail */}
              <div
                className="bq-learning-concept-box"
                data-testid="learning-concept-box"
                style={{ display: showLearnDetail ? 'block' : 'none' }}
              >
                <div className="bq-learn-top-row">
                  <h3>1. Öğren — {learningGuide.learningConcept}</h3>
                  <span className={`bq-phase-pill phase-${learningGuide.difficultyPhase}`}>
                    {learningGuide.difficultyPhase === 'beginner'
                      ? '%70 Öğretim'
                      : learningGuide.difficultyPhase === 'intermediate'
                      ? '%50 Uygulama'
                      : learningGuide.difficultyPhase === 'advanced'
                      ? '%80 Problem Çözme'
                      : 'Final Proje'}
                  </span>
                </div>
                <p className="bq-learn-short-text">{learningGuide.whatIsIt}</p>
                <div className="bq-revit-path-badge" data-testid="revit-ui-path">
                  <span className="bq-revit-tag">Revit</span>
                  <code>{learningGuide.revitPath.replace(/^Revit:\s*/i, '')}</code>
                </div>
                <button
                  type="button"
                  className="bq-more-learn-btn"
                  data-testid="more-learn-toggle-btn"
                  onClick={() => setShowMoreLearn((v) => !v)}
                >
                  {showMoreLearn
                    ? 'Daha Az Göster (Bu İşlem Nedir?) ▴'
                    : 'Daha Fazla Öğren (Bu İşlem Nedir?) ▾'}
                </button>
                {showMoreLearn && (
                  <p className="bq-learn-expanded-text">
                    <strong>Neden Önemlidir?</strong> {learningGuide.whyUsed}
                  </p>
                )}
              </div>

              {/* Explicit Target Dimensions Card (toggled via ⓘ Kurallar button) */}
              {showRulesDetail && (
                <div className="bq-target-box" data-testid="target-rules-box">
                  <h3>Hedef Kurallar ({task.criteria.length} Kural)</h3>
                  <ul className="bq-criteria-preview-list">
                    {task.criteria.map((c) => (
                      <li key={c.id}>
                        <code>{c.id}</code>: {c.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Progressive 4-Level Hints & Rehber Turu (h1: Alan -> h2: Nesne -> h3: Property -> Step 4: Adım Adım Rehber) */}
              <div className="bq-hints-section" data-testid="hints-section">
                <div className="bq-hints-header">
                  <h3>Rehber & İpuçları ({revealedHints.length} / 3)</h3>
                  <span className="bq-hint-cost-note">
                    −5 puan / ipucu
                  </span>
                </div>

                <div className="bq-hints-list">
                  {task.hints.map((hint, idx) => {
                    const isRevealed = revealedHints.includes(hint.id);
                    const prevRevealed =
                      idx === 0 ||
                      revealedHints.includes(task.hints[idx - 1].id);
                    const levelTitles = [
                      'İpucu 1 · Alan Tespiti',
                      'İpucu 2 · Nesne Türü',
                      'İpucu 3 · İlgili Property',
                    ];

                    return (
                      <div
                        key={hint.id}
                        className={`bq-hint-card ${
                          isRevealed ? 'revealed' : 'locked'
                        }`}
                        data-testid={`hint-card-${hint.id}`}
                      >
                        <div className="bq-hint-row">
                          <strong>
                            {levelTitles[idx] ?? `İpucu ${idx + 1}`} ({hint.id})
                          </strong>
                          <button
                            type="button"
                            className="bq-chip-btn"
                            data-testid={`reveal-hint-${hint.id}`}
                            disabled={!prevRevealed}
                            onClick={() =>
                              onSessionChange(
                                revealNextHintCommand(session, hint.id)
                              )
                            }
                          >
                            {isRevealed
                              ? 'Açıldı (0 ek maliyet)'
                              : prevRevealed
                              ? 'İpucunu Aç (−5 Puan)'
                              : 'Önceki İpucunu Açın'}
                          </button>
                        </div>
                        {isRevealed && (
                          <p
                            className="bq-hint-text"
                            data-testid={`hint-text-${hint.id}`}
                          >
                            {learningGuide.hintLevels[idx] ?? hint.text}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* Level 4: Step-by-Step Guided Walkthrough */}
                  <div
                    className={`bq-hint-card ${
                      showStepByStepGuide ? 'revealed' : 'locked'
                    }`}
                    data-testid="hint-card-step4"
                  >
                    <div className="bq-hint-row">
                      <strong>Son Rehber · Adım Adım Çözüm</strong>
                      <button
                        type="button"
                        className="bq-chip-btn"
                        data-testid="reveal-step4-guide-btn"
                        onClick={() => setShowStepByStepGuide((v) => !v)}
                      >
                        {showStepByStepGuide ? 'Rehberi Gizle' : 'Adım Adım Rehberi Aç'}
                      </button>
                    </div>
                    {showStepByStepGuide && (
                      <p className="bq-hint-text" data-testid="hint-text-step4">
                        {learningGuide.hintLevels[3]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* CENTER PANEL: Synchronized 2D Plan & 3D Scene */}
        <main
          className="bq-center-stage"
          data-tour="viewport-area"
          aria-label="Model Görünüm Alanı"
        >
          <div className="bq-stage-switcher" role="tablist" aria-label="Görünüm Modu Seçimi">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'split'}
              className={`bq-tab-btn ${viewMode === 'split' ? 'active' : ''}`}
              data-testid="view-mode-split"
              onClick={() => setViewMode('split')}
            >
              Plan + 3B Bölünmüş
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'plan'}
              className={`bq-tab-btn ${viewMode === 'plan' ? 'active' : ''}`}
              data-testid="view-mode-plan"
              onClick={() => setViewMode('plan')}
            >
              Yalnız 2B Plan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === '3d'}
              className={`bq-tab-btn ${viewMode === '3d' ? 'active' : ''}`}
              data-testid="view-mode-3d"
              onClick={() => setViewMode('3d')}
            >
              Yalnız 3B Sahne
            </button>
          </div>

          <div className={`bq-viewports-grid mode-${viewMode}`}>
            {(viewMode === 'split' || viewMode === 'plan') && (
              <div className="bq-viewport-pane">
                <PlanViewport
                  task={task}
                  model={model}
                  selectedId={selectedId}
                  failedElementIds={failedElementIds}
                  activeTool={activeTool}
                  wallPreview={wallPreview}
                  doorPreview={doorPreview}
                  theme={theme}
                  canDragWallEndpoints={
                    isFieldEditable('start') && isFieldEditable('end')
                  }
                  onSelect={handleSelectElement}
                  onPickWallCoord={handlePlanPickWallCoord}
                  onPickDoorOffset={handlePlanPickDoorOffset}
                  onDragWallEndpoint={(wallId, which, coord) => {
                    const res = updateElementProperty(
                      session,
                      wallId,
                      which,
                      coord
                    );
                    if (res.ok) {
                      onSessionChange(res.state);
                      setStatusToast(
                        `${wallId} ${which === 'start' ? 'başlangıç' : 'bitiş'} ucu (${coord[0]}, ${coord[1]}) mm konumuna taşındı.`
                      );
                    }
                  }}
                />
              </div>
            )}

            {(viewMode === 'split' || viewMode === '3d') && (
              <div className="bq-viewport-pane">
                <SceneViewport
                  task={task}
                  model={model}
                  selectedId={selectedId}
                  failedElementIds={failedElementIds}
                  reducedMotion={reducedMotion}
                  isVisible={viewMode === 'split' || viewMode === '3d'}
                  theme={theme}
                  onSelect={handleSelectElement}
                />
              </div>
            )}
          </div>

          {/* COMPACT GAME DOCK: Floating Quick-Action HUD & Chief Architect Live Guide */}
          <div className="bq-game-dock" data-testid="game-dock">
            {selectedElement ? (
              <div className="bq-quick-hud" data-testid="quick-action-hud">
                <div className="bq-quick-hud-info">
                  <span className="bq-quick-hud-badge">
                    {selectedElement.type === 'wall' ? '🧱' : '🚪'}{' '}
                    {selectedElement.id}
                  </span>
                  <strong className="bq-quick-hud-name">
                    {selectedElement.name}
                  </strong>
                  <span className="bq-quick-hud-meta">
                    {selectedElement.type === 'wall'
                      ? `U:${getWallLengthMm(selectedElement)} · Y:${selectedElement.height} · K:${selectedElement.thickness} mm`
                      : `Duvar:${selectedElement.hostWallId} · Ofset:${selectedElement.offset} · ${selectedElement.width}×${selectedElement.height} mm`}
                  </span>
                </div>

                <div className="bq-quick-hud-actions">
                  {selectedElement.type === 'wall' &&
                    isFieldEditable('height') && (
                      <>
                        {selectedElement.height !== 3000 && (
                          <button
                            type="button"
                            className="bq-chip-btn bq-chip-accent"
                            data-testid="hud-quick-height-3000"
                            onClick={() => commitSingleField('height', 3000)}
                          >
                            ⚡ Y: 3000 mm Yap
                          </button>
                        )}
                        <button
                          type="button"
                          className="bq-chip-btn"
                          onClick={() =>
                            commitSingleField(
                              'height',
                              Math.max(500, selectedElement.height - 100)
                            )
                          }
                        >
                          −100 mm
                        </button>
                        <button
                          type="button"
                          className="bq-chip-btn"
                          onClick={() =>
                            commitSingleField(
                              'height',
                              selectedElement.height + 100
                            )
                          }
                        >
                          +100 mm
                        </button>
                      </>
                    )}

                  {selectedElement.type === 'door' && (
                    <>
                      {isFieldEditable('offset') && (
                        <>
                          {selectedElement.offset !== 2550 && (
                            <button
                              type="button"
                              className="bq-chip-btn bq-chip-accent"
                              data-testid="hud-quick-door-center"
                              onClick={() => commitSingleField('offset', 2550)}
                            >
                              🎯 Ortala (2550 mm)
                            </button>
                          )}
                          <button
                            type="button"
                            className="bq-chip-btn"
                            onClick={() =>
                              commitSingleField(
                                'offset',
                                Math.max(0, selectedElement.offset - 50)
                              )
                            }
                          >
                            ◀ −50
                          </button>
                          <button
                            type="button"
                            className="bq-chip-btn"
                            onClick={() =>
                              commitSingleField(
                                'offset',
                                selectedElement.offset + 50
                              )
                            }
                          >
                            +50 ▶
                          </button>
                        </>
                      )}
                      {isFieldEditable('width') &&
                        selectedElement.width !== 900 && (
                          <button
                            type="button"
                            className="bq-chip-btn bq-chip-accent"
                            onClick={() => commitSingleField('width', 900)}
                          >
                            ⚡ G: 900 mm Yap
                          </button>
                        )}
                    </>
                  )}

                  {!isFieldEditable('height') &&
                    !isFieldEditable('offset') &&
                    !canDeleteSelected && (
                      <span className="bq-quick-readonly-tag">
                        🔒 Referans Eleman (Salt Okunur)
                      </span>
                    )}

                  <button
                    type="button"
                    className="bq-chip-btn"
                    onClick={() => {
                      setMobileDrawerTab('inspector');
                      setMobileSheetOpen(true);
                      setRightCollapsed(false);
                    }}
                  >
                    ⚙️ Detaylar
                  </button>
                  <button
                    type="button"
                    className="bq-chip-btn"
                    onClick={() => handleSelectElement(null)}
                    title="Seçimi Kaldır"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="bq-chief-bar"
                data-testid="chief-architect-bar"
              >
                <span className="bq-chief-avatar" aria-hidden="true">
                  👷‍♂️ Baş Mimar:
                </span>
                <span className="bq-chief-text">
                  {liveProgress.allPass
                    ? 'Harika iş! Tüm mimari kurallar tamam (%100). Şimdi alttaki "Kontrol et" butonuna basarak yıldızlarını topla!'
                    : `${learningGuide.learningConcept} · ${learningGuide.revitPath}`}
                </span>
                <span className="bq-par-pill" title="Hamle Sayısı / İdeal Hedef Hamle">
                  ⚡ Hamle: {session.revision} / Hedef: {parMoves}
                </span>
              </div>
            )}
          </div>
        </main>

        {/* RIGHT PANEL: Object List, Property Editor & Guided Creation Forms */}
        <aside
          className={`bq-panel bq-panel-right ${
            rightCollapsed ? 'collapsed' : ''
          } ${mobileDrawerTab === 'inspector' ? 'mobile-active' : ''} ${
            mobileDrawerTab === 'inspector' && mobileSheetOpen ? 'sheet-open' : ''
          }`}
          data-testid="right-inspector-panel"
          aria-label="Nesne Listesi ve Özellik Düzenleyici"
        >
          <div className="bq-panel-header">
            <h2>
              Nesneler & Özellikler
              {selectedElement ? ` · ${selectedElement.id}` : ''}
            </h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="bq-chip-btn bq-mobile-close-sheet-btn"
                data-testid="close-mobile-sheet-btn"
                onClick={() => setMobileSheetOpen(false)}
              >
                ✕ Sahneyi Gör
              </button>
              <button
                type="button"
                className="bq-chip-btn bq-desktop-collapse-btn"
                onClick={() => setRightCollapsed((v) => !v)}
                aria-expanded={!rightCollapsed}
                data-testid="toggle-right-panel-btn"
              >
                {rightCollapsed ? '« Göster' : 'Daralt »'}
              </button>
            </div>
          </div>

          {!rightCollapsed && (
            <div className="bq-panel-scroll">
              {/* Field / Command Validation Error Banner */}
              {fieldError && (
                <div
                  className="bq-field-error"
                  role="alert"
                  data-testid="field-error-alert"
                >
                  <strong>Hata:</strong> {fieldError}
                </div>
              )}

              {/* CREATE WALL FORM (when activeTool === 'wall') */}
              {activeTool === 'wall' &&
                task.permissions.creatableTypes.includes('wall') && (
                  <form
                    className="bq-tool-form"
                    data-testid="create-wall-form"
                    onSubmit={handleCreateWallSubmit}
                  >
                    <div className="bq-form-title-row">
                      <h3>Yeni Duvar Oluştur (mm)</h3>
                      <button
                        type="button"
                        className="bq-chip-btn"
                        onClick={() => setActiveTool('select')}
                      >
                        Kapat (Esc)
                      </button>
                    </div>

                    {/* Quick Room Edge Presets for Touch / Fast Testing */}
                    <div className="bq-presets-box">
                      <span className="bq-presets-label">
                        Hızlı Kenar Şablonları (veya aşağıdan elle girin):
                      </span>
                      <div className="bq-presets-grid">
                        {WALL_QUICK_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            className="bq-chip-btn"
                            data-testid={`preset-${preset.name}`}
                            onClick={() =>
                              setWallForm((prev) => ({
                                ...prev,
                                name: preset.name,
                                startX: preset.startX,
                                startZ: preset.startZ,
                                endX: preset.endX,
                                endZ: preset.endZ,
                              }))
                            }
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bq-form-grid-2">
                      <label className="bq-field">
                        <span>Başlangıç X (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="wall-start-x"
                          value={wallForm.startX}
                          onChange={(e) =>
                            setWallForm({ ...wallForm, startX: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Başlangıç Z (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="wall-start-z"
                          value={wallForm.startZ}
                          onChange={(e) =>
                            setWallForm({ ...wallForm, startZ: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Bitiş X (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="wall-end-x"
                          value={wallForm.endX}
                          onChange={(e) =>
                            setWallForm({ ...wallForm, endX: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Bitiş Z (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="wall-end-z"
                          value={wallForm.endZ}
                          onChange={(e) =>
                            setWallForm({ ...wallForm, endZ: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Yükseklik (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="wall-height"
                          value={wallForm.height}
                          onChange={(e) =>
                            setWallForm({ ...wallForm, height: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Kalınlık (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="wall-thickness"
                          value={wallForm.thickness}
                          onChange={(e) =>
                            setWallForm({
                              ...wallForm,
                              thickness: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>

                    <div className="bq-form-grid-2">
                      <label className="bq-field">
                        <span>Kat Referansı</span>
                        <select
                          data-testid="wall-level"
                          value={wallForm.baseLevelId}
                          onChange={(e) =>
                            setWallForm({
                              ...wallForm,
                              baseLevelId: e.target.value,
                            })
                          }
                        >
                          {model.levels.map((lvl) => (
                            <option key={lvl.id} value={lvl.id}>
                              {lvl.name} ({lvl.id} · {lvl.elevation} mm)
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="bq-field">
                        <span>Duvar Adı</span>
                        <input
                          type="text"
                          data-testid="wall-name"
                          value={wallForm.name}
                          onChange={(e) =>
                            setWallForm({ ...wallForm, name: e.target.value })
                          }
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="bq-btn bq-btn-primary bq-btn-full"
                      data-testid="confirm-create-wall-btn"
                    >
                      Duvarı Onayla ve Oluştur
                    </button>
                  </form>
                )}

              {/* CREATE DOOR FORM (when activeTool === 'door') */}
              {activeTool === 'door' &&
                task.permissions.creatableTypes.includes('door') && (
                  <form
                    className="bq-tool-form"
                    data-testid="create-door-form"
                    onSubmit={handleCreateDoorSubmit}
                  >
                    <div className="bq-form-title-row">
                      <h3>Yeni Kapı Oluştur (Bağlı Açıklık)</h3>
                      <button
                        type="button"
                        className="bq-chip-btn"
                        onClick={() => setActiveTool('select')}
                      >
                        Kapat (Esc)
                      </button>
                    </div>

                    <label className="bq-field">
                      <span>Taşıyıcı Duvar (Host Wall)</span>
                      <select
                        data-testid="door-host-wall"
                        value={doorForm.hostWallId}
                        onChange={(e) =>
                          setDoorForm({
                            ...doorForm,
                            hostWallId: e.target.value,
                          })
                        }
                      >
                        {wallsInModel.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.id} ({w.name} · Uzunluk: {getWallLengthMm(w)} mm)
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="bq-form-grid-2">
                      <label className="bq-field">
                        <span>Başlangıçtan Ofset (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="door-offset"
                          value={doorForm.offset}
                          onChange={(e) =>
                            setDoorForm({ ...doorForm, offset: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Genişlik (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="door-width"
                          value={doorForm.width}
                          onChange={(e) =>
                            setDoorForm({ ...doorForm, width: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Yükseklik (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="door-height"
                          value={doorForm.height}
                          onChange={(e) =>
                            setDoorForm({ ...doorForm, height: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Eşik / Sill (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="door-sill"
                          value={doorForm.sill}
                          onChange={(e) =>
                            setDoorForm({ ...doorForm, sill: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Kapı İşareti (Mark)</span>
                        <input
                          type="text"
                          data-testid="door-mark"
                          value={doorForm.mark}
                          onChange={(e) =>
                            setDoorForm({ ...doorForm, mark: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Yangın Sınıfı (Fire Rating)</span>
                        <select
                          data-testid="door-fire-rating"
                          value={doorForm.fireRating}
                          onChange={(e) =>
                            setDoorForm({
                              ...doorForm,
                              fireRating: e.target.value,
                            })
                          }
                        >
                          <option value="none">none (Standart / Sınıf Yok)</option>
                          <option value="EI30">EI30</option>
                          <option value="EI60">EI60</option>
                        </select>
                      </label>
                    </div>

                    <label className="bq-field">
                      <span>Kapı Adı</span>
                      <input
                        type="text"
                        data-testid="door-name"
                        value={doorForm.name}
                        onChange={(e) =>
                          setDoorForm({ ...doorForm, name: e.target.value })
                        }
                      />
                    </label>

                    <button
                      type="submit"
                      className="bq-btn bq-btn-primary bq-btn-full"
                      data-testid="confirm-create-door-btn"
                    >
                      Kapıyı Onayla ve Oluştur
                    </button>
                  </form>
                )}

              {/* DOM OBJECT LIST (Keyboard-Operable Selection Alternative) */}
              <div
                className="bq-object-list-section"
                data-tour="object-list"
                data-testid="object-list"
              >
                <div className="bq-section-subheader">
                  <h3>Model Nesneleri ({model.elements.length})</h3>
                  {selectedId && (
                    <button
                      type="button"
                      className="bq-chip-btn"
                      onClick={() => handleSelectElement(null)}
                    >
                      Seçimi Temizle
                    </button>
                  )}
                </div>

                {model.elements.length === 0 ? (
                  <div className="bq-empty-list" data-testid="empty-object-list">
                    <img
                      src="./assets/illustrations/empty-state.svg"
                      alt=""
                      aria-hidden="true"
                      width={160}
                      height={94}
                    />
                    <p>Henüz modelde nesne yok.</p>
                    {task.permissions.creatableTypes.includes('wall') && (
                      <button
                        type="button"
                        className="bq-btn bq-btn-primary bq-btn-compact"
                        onClick={() => setActiveTool('wall')}
                      >
                        + İlk Duvarı Oluştur
                      </button>
                    )}
                  </div>
                ) : (
                  <ul className="bq-object-items" role="listbox" aria-label="Modeldeki Yapı Nesneleri">
                    {model.elements.map((el) => {
                      const isSel = el.id === selectedId;
                      const isFail = failedElementIds.has(el.id);
                      return (
                        <li key={el.id} role="option" aria-selected={isSel}>
                          <button
                            type="button"
                            className={`bq-object-row ${
                              isSel ? 'selected' : ''
                            } ${isFail ? 'failed' : ''}`}
                            data-testid={`object-row-${el.id}`}
                            onClick={() => handleSelectElement(el.id)}
                          >
                            <span className="bq-obj-id">
                              {isFail ? '! ' : isSel ? '✓ ' : ''}
                              {el.id}
                            </span>
                            <span className="bq-obj-type">
                              {el.type === 'wall' ? 'Duvar' : 'Kapı'}
                            </span>
                            <span className="bq-obj-meta">
                              {el.type === 'wall'
                                ? `Y:${el.height} · K:${el.thickness} mm`
                                : `Host:${el.hostWallId} · ${el.mark}`}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* SELECTED ELEMENT PROPERTY INSPECTOR */}
              <div
                className="bq-property-inspector"
                data-tour="property-editor"
                data-testid="property-inspector"
              >
                <div className="bq-section-subheader">
                  <h3>Seçili Nesne Özellikleri</h3>
                  {canDeleteSelected && (
                    <button
                      type="button"
                      className="bq-btn bq-btn-danger bq-btn-compact"
                      data-testid="delete-selected-btn"
                      onClick={handleDeleteSelected}
                    >
                      Nesneyi Sil ({selectedElement?.id})
                    </button>
                  )}
                </div>

                {!selectedElement ? (
                  <p className="bq-muted-note" data-testid="no-selection-note">
                    Özelliklerini incelemek veya düzenlemek için 2B Plandan, 3B
                    Sahneden ya da yukarıdaki Nesne Listesinden bir öğe seçin.
                  </p>
                ) : selectedElement.type === 'wall' ? (
                  <div
                    className="bq-prop-form"
                    data-testid={`prop-form-${selectedElement.id}`}
                  >
                    <div className="bq-revit-type-selector">
                      <span className="bq-revit-family-lbl">Basic Wall</span>
                      <strong>
                        Generic - {selectedElement.thickness}mm ·{' '}
                        <span data-testid="selected-element-id">
                          {selectedElement.id} (Duvar)
                        </span>
                      </strong>
                    </div>

                    {/* Base Constraint (Level) */}
                    <label
                      className={`bq-field ${
                        learningGuide.primaryFields.includes('baseLevelId')
                          ? 'bq-field-primary'
                          : ''
                      }`}
                    >
                      <span>
                        Base Constraint / Kat ({selectedElement.baseLevelId})
                        {learningGuide.primaryFields.includes('baseLevelId') && (
                          <em className="bq-primary-field-tag">★ Aktif Parametre</em>
                        )}
                      </span>
                      <select
                        data-testid="prop-input-baseLevelId"
                        disabled={!isFieldEditable('baseLevelId')}
                        value={
                          editDrafts.baseLevelId ?? selectedElement.baseLevelId
                        }
                        onChange={(e) => {
                          setEditDrafts({
                            ...editDrafts,
                            baseLevelId: e.target.value,
                          });
                          commitSingleField('baseLevelId', e.target.value);
                        }}
                      >
                        {model.levels.map((lvl) => (
                          <option key={lvl.id} value={lvl.id}>
                            {lvl.name} ({lvl.id} · +{lvl.elevation} mm)
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* Wall Height */}
                    <label
                      className={`bq-field ${
                        learningGuide.primaryFields.includes('height')
                          ? 'bq-field-primary'
                          : ''
                      }`}
                    >
                      <span>
                        Unconnected Height / Yükseklik (mm)
                        {learningGuide.primaryFields.includes('height') && (
                          <em className="bq-primary-field-tag">★ Aktif Parametre</em>
                        )}
                      </span>
                      <div className="bq-input-with-unit">
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="prop-input-height"
                          disabled={!isFieldEditable('height')}
                          value={editDrafts.height ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              height: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('height')) {
                              commitSingleField('height', editDrafts.height);
                            }
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'height', () =>
                              commitSingleField('height', editDrafts.height)
                            )
                          }
                        />
                        <span className="bq-unit-tag">mm</span>
                      </div>
                    </label>

                    {/* Wall Thickness */}
                    <label
                      className={`bq-field ${
                        learningGuide.primaryFields.includes('thickness')
                          ? 'bq-field-primary'
                          : ''
                      }`}
                    >
                      <span>
                        Structure Thickness / Kalınlık (mm)
                        {learningGuide.primaryFields.includes('thickness') && (
                          <em className="bq-primary-field-tag">★ Aktif Parametre</em>
                        )}
                      </span>
                      <div className="bq-input-with-unit">
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="prop-input-thickness"
                          disabled={!isFieldEditable('thickness')}
                          value={editDrafts.thickness ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              thickness: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('thickness')) {
                              commitSingleField(
                                'thickness',
                                editDrafts.thickness
                              );
                            }
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'thickness', () =>
                              commitSingleField(
                                'thickness',
                                editDrafts.thickness
                              )
                            )
                          }
                        />
                        <span className="bq-unit-tag">mm</span>
                      </div>
                    </label>

                    {/* Start X / Z */}
                    <div className="bq-form-grid-2">
                      <label className="bq-field">
                        <span>Başlangıç X (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="prop-input-start-x"
                          disabled={!isFieldEditable('start')}
                          value={editDrafts.startX ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              startX: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('start')) commitCoordPair('start');
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'startX', () =>
                              commitCoordPair('start')
                            )
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Başlangıç Z (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="prop-input-start-z"
                          disabled={!isFieldEditable('start')}
                          value={editDrafts.startZ ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              startZ: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('start')) commitCoordPair('start');
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'startZ', () =>
                              commitCoordPair('start')
                            )
                          }
                        />
                      </label>
                    </div>

                    {/* End X / Z */}
                    <div className="bq-form-grid-2">
                      <label className="bq-field">
                        <span>Bitiş X (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="prop-input-end-x"
                          disabled={!isFieldEditable('end')}
                          value={editDrafts.endX ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              endX: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('end')) commitCoordPair('end');
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'endX', () =>
                              commitCoordPair('end')
                            )
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Bitiş Z (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="prop-input-end-z"
                          disabled={!isFieldEditable('end')}
                          value={editDrafts.endZ ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              endZ: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('end')) commitCoordPair('end');
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'endZ', () =>
                              commitCoordPair('end')
                            )
                          }
                        />
                      </label>
                    </div>

                    {/* Wall Name */}
                    <label className="bq-field">
                      <span>Ad</span>
                      <input
                        type="text"
                        data-testid="prop-input-name"
                        disabled={!isFieldEditable('name')}
                        value={editDrafts.name ?? ''}
                        onChange={(e) =>
                          setEditDrafts({ ...editDrafts, name: e.target.value })
                        }
                        onBlur={() => {
                          if (isFieldEditable('name')) {
                            commitSingleField('name', editDrafts.name);
                          }
                        }}
                        onKeyDown={(e) =>
                          handleFieldKeyDown(e, 'name', () =>
                            commitSingleField('name', editDrafts.name)
                          )
                        }
                      />
                    </label>

                    {/* Wall Move / Translation Controls (when start & end are editable) */}
                    {isFieldEditable('start') && isFieldEditable('end') && (
                      <div
                        className="bq-wall-move-box"
                        data-testid="wall-move-controls"
                      >
                        <span className="bq-move-title">
                          Duvarı Taşı (ΔX / ΔZ mm)
                        </span>
                        <div className="bq-move-nudge-grid">
                          <button
                            type="button"
                            className="bq-chip-btn"
                            data-testid="nudge-wall-west"
                            onClick={() => handleMoveSelectedWall(-500, 0)}
                          >
                            ← Batı (−500 X)
                          </button>
                          <button
                            type="button"
                            className="bq-chip-btn"
                            data-testid="nudge-wall-east"
                            onClick={() => handleMoveSelectedWall(500, 0)}
                          >
                            Doğu (+500 X) →
                          </button>
                          <button
                            type="button"
                            className="bq-chip-btn"
                            data-testid="nudge-wall-south"
                            onClick={() => handleMoveSelectedWall(0, -500)}
                          >
                            ↓ Güney (−500 Z)
                          </button>
                          <button
                            type="button"
                            className="bq-chip-btn"
                            data-testid="nudge-wall-north"
                            onClick={() => handleMoveSelectedWall(0, 500)}
                          >
                            ↑ Kuzey (+500 Z)
                          </button>
                        </div>
                        <div className="bq-move-custom-row">
                          <label className="bq-field">
                            <span>ΔX (mm)</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              data-testid="move-delta-x"
                              value={moveDelta.dx}
                              onChange={(e) =>
                                setMoveDelta({ ...moveDelta, dx: e.target.value })
                              }
                            />
                          </label>
                          <label className="bq-field">
                            <span>ΔZ (mm)</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              data-testid="move-delta-z"
                              value={moveDelta.dz}
                              onChange={(e) =>
                                setMoveDelta({ ...moveDelta, dz: e.target.value })
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="bq-btn bq-btn-secondary bq-btn-compact"
                            data-testid="move-wall-btn"
                            onClick={() =>
                              handleMoveSelectedWall(moveDelta.dx, moveDelta.dz)
                            }
                          >
                            Taşı
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Door Property Inspector */
                  <div
                    className="bq-prop-form"
                    data-testid={`prop-form-${selectedElement.id}`}
                  >
                    <div className="bq-prop-readonly-row">
                      <span>Kimlik (ID):</span>
                      <strong data-testid="selected-element-id">
                        {selectedElement.id} (Kapı)
                      </strong>
                    </div>

                    <label className="bq-field">
                      <span>Taşıyıcı Duvar (hostWallId)</span>
                      <select
                        data-testid="prop-input-hostWallId"
                        disabled={!isFieldEditable('hostWallId')}
                        value={
                          editDrafts.hostWallId ?? selectedElement.hostWallId
                        }
                        onChange={(e) => {
                          setEditDrafts({
                            ...editDrafts,
                            hostWallId: e.target.value,
                          });
                          commitSingleField('hostWallId', e.target.value);
                        }}
                      >
                        {wallsInModel.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.id} ({w.name})
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="bq-form-grid-2">
                      <label className="bq-field">
                        <span>Ofset (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="prop-input-offset"
                          disabled={!isFieldEditable('offset')}
                          value={editDrafts.offset ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              offset: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('offset')) {
                              commitSingleField('offset', editDrafts.offset);
                            }
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'offset', () =>
                              commitSingleField('offset', editDrafts.offset)
                            )
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Genişlik (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="prop-input-width"
                          disabled={!isFieldEditable('width')}
                          value={editDrafts.width ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              width: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('width')) {
                              commitSingleField('width', editDrafts.width);
                            }
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'width', () =>
                              commitSingleField('width', editDrafts.width)
                            )
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Yükseklik (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="prop-input-height"
                          disabled={!isFieldEditable('height')}
                          value={editDrafts.height ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              height: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('height')) {
                              commitSingleField('height', editDrafts.height);
                            }
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'height', () =>
                              commitSingleField('height', editDrafts.height)
                            )
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Eşik / Sill (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="prop-input-sill"
                          disabled={!isFieldEditable('sill')}
                          value={editDrafts.sill ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              sill: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('sill')) {
                              commitSingleField('sill', editDrafts.sill);
                            }
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'sill', () =>
                              commitSingleField('sill', editDrafts.sill)
                            )
                          }
                        />
                      </label>
                    </div>

                    <div className="bq-form-grid-2">
                      <label className="bq-field">
                        <span>İşaret (Mark)</span>
                        <input
                          type="text"
                          data-testid="prop-input-mark"
                          disabled={!isFieldEditable('mark')}
                          value={editDrafts.mark ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              mark: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('mark')) {
                              commitSingleField('mark', editDrafts.mark);
                            }
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'mark', () =>
                              commitSingleField('mark', editDrafts.mark)
                            )
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Yangın Sınıfı</span>
                        <select
                          data-testid="prop-input-fireRating"
                          disabled={!isFieldEditable('fireRating')}
                          value={
                            editDrafts.fireRating ??
                            (selectedElement as DoorElement).fireRating
                          }
                          onChange={(e) => {
                            setEditDrafts({
                              ...editDrafts,
                              fireRating: e.target.value,
                            });
                            commitSingleField('fireRating', e.target.value);
                          }}
                        >
                          <option value="none">none</option>
                          <option value="EI30">EI30</option>
                          <option value="EI60">EI60</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* BOTTOM CHECK & FEEDBACK BAR */}
      <footer
        className={`bq-ws-bottombar ${
          mobileDrawerTab === 'check' ? 'mobile-active' : ''
        } ${mobileDrawerTab === 'check' && mobileSheetOpen ? 'sheet-open' : ''}`}
        aria-label="Kontrol ve Geri Bildirim Paneli"
      >
        <div className="bq-check-row">
          <button
            type="button"
            className="bq-btn bq-btn-primary bq-btn-check"
            data-testid="check-btn"
            onClick={() => {
              handleRunCheck();
              setMobileSheetOpen(true);
            }}
          >
            <svg width="20" height="20" aria-hidden="true">
              <use href="./assets/ui/icons.svg#check" />
            </svg>
            <span>Kontrol et</span>
          </button>

          <div
            className="bq-check-status"
            aria-live="polite"
            data-testid="evaluation-summary"
          >
            {!lastEvaluation ? (
              <span>
                Değişiklikleri tamamladığınızda <strong>Kontrol et</strong>{' '}
                düğmesine basın.{statusToast ? ` (${statusToast})` : ''}
              </span>
            ) : lastEvaluation.stale ? (
              <span
                className="bq-stale-warning"
                data-testid="stale-result-banner"
              >
                ⚠️ Model değişti; yeniden kontrol et.
              </span>
            ) : lastEvaluation.pass ? (
              <span className="bq-pass-summary" data-testid="pass-summary-text">
                ✓ Başarılı! Puan: <strong>{lastEvaluation.score}</strong> ·{' '}
                <strong>+{calculateMissionXp(lastEvaluation.score)} XP</strong> ·{' '}
                <strong>{badgeLabelTr(lastEvaluation.badge)}</strong> (
                {lastEvaluation.criteria.filter((c) => c.pass).length}/
                {lastEvaluation.criteria.length} kural geçti)
              </span>
            ) : (
              <span className="bq-fail-summary" data-testid="fail-summary-text">
                ✕ Kontrol tamamlanmadı: Puan {lastEvaluation.score} (
                {lastEvaluation.criteria.filter((c) => c.pass).length}/
                {lastEvaluation.criteria.length} kural geçti). Aşağıdaki tanılayıcı
                geri bildirimleri inceleyip düzeltin.
              </span>
            )}
          </div>

          {lastEvaluation && lastEvaluation.pass && !lastEvaluation.stale && (
            <button
              type="button"
              className="bq-btn bq-btn-secondary bq-btn-compact"
              data-testid="open-recap-btn"
              onClick={() => setRecapModalOpen(true)}
            >
              Sonuç Özeti & Sonraki Görev →
            </button>
          )}
          <button
            type="button"
            className="bq-btn bq-btn-secondary bq-btn-compact bq-mobile-close-sheet-btn"
            onClick={() => setMobileSheetOpen(false)}
          >
            ✕ Sahneyi Gör
          </button>
        </div>

        {/* Detailed Criterion Results List with Actionable Remediation */}
        {lastEvaluation && (
          <div
            className="bq-criteria-results"
            data-testid="criteria-results-list"
          >
            {lastEvaluation.errors.length > 0 && (
              <div className="bq-integrity-errors" role="alert">
                <strong>Model Bütünlük / İzin Hataları:</strong>{' '}
                {lastEvaluation.errors.join(', ')}
              </div>
            )}

            <ul className="bq-criteria-items">
              {lastEvaluation.criteria.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`bq-criterion-row ${c.pass ? 'pass' : 'fail'}`}
                    data-testid={`criterion-row-${c.id}`}
                    onClick={() => handleCriterionClick(c.id)}
                  >
                    <span className="bq-crit-badge">
                      {c.pass ? '✓ Geçti' : '✕ Hata'}
                    </span>
                    <span className="bq-crit-id">{c.id}</span>
                    <span className="bq-crit-msg">{c.message}</span>
                    <span className="bq-crit-evidence">
                      {formatCriterionEvidenceTr(c)}
                    </span>
                    {!c.pass && (
                      <span
                        className="bq-crit-remediation"
                        data-testid={`criterion-remediation-${c.id}`}
                      >
                        💡 {explainCriterionFailureTr(task, model, c)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </footer>

      {/* Mobile Bottom Navigation Bar (iPhone / Narrow Screen Ergonomics) */}
      <nav
        className="bq-mobile-tabbar"
        aria-label="Mobil Çalışma Alanı Sekmeleri"
      >
        <button
          type="button"
          data-testid="mobile-tab-brief"
          className={`bq-mobile-tab ${
            mobileDrawerTab === 'brief' && mobileSheetOpen ? 'active' : ''
          }`}
          onClick={() => {
            if (mobileDrawerTab === 'brief' && mobileSheetOpen) {
              setMobileSheetOpen(false);
            } else {
              setMobileDrawerTab('brief');
              setMobileSheetOpen(true);
            }
          }}
        >
          📋 Görev & İpucu
        </button>
        <button
          type="button"
          data-testid="mobile-tab-inspector"
          className={`bq-mobile-tab ${
            mobileDrawerTab === 'inspector' && mobileSheetOpen ? 'active' : ''
          }`}
          onClick={() => {
            if (mobileDrawerTab === 'inspector' && mobileSheetOpen) {
              setMobileSheetOpen(false);
            } else {
              setMobileDrawerTab('inspector');
              setMobileSheetOpen(true);
            }
          }}
        >
          🧱 Nesneler ({model.elements.length})
          {selectedId ? ` · ${selectedId}` : ''}
        </button>
        <button
          type="button"
          data-testid="mobile-tab-check"
          className={`bq-mobile-tab ${
            mobileDrawerTab === 'check' && mobileSheetOpen ? 'active' : ''
          }`}
          onClick={() => {
            if (mobileDrawerTab === 'check' && mobileSheetOpen) {
              setMobileSheetOpen(false);
            } else {
              setMobileDrawerTab('check');
              setMobileSheetOpen(true);
            }
          }}
        >
          ✓ Kontrol & Sonuç
        </button>
      </nav>

      {/* RESET CONFIRMATION DIALOG */}
      {resetModalOpen && (
        <div
          className="bq-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
          data-testid="reset-confirm-dialog"
        >
          <div className="bq-modal-card">
            <h2 id="reset-dialog-title">Mevcut Taslağı Sıfırla</h2>
            <p>
              Bu görevdeki mevcut model değişiklikleriniz, açılan ipuçları ve
              geri alma geçmişiniz başlangıç durumuna sıfırlanacak. Daha önce
              kazandığınız en yüksek puan korunur.
            </p>
            <div className="bq-modal-actions">
              <button
                type="button"
                ref={resetCancelBtnRef}
                className="bq-btn bq-btn-secondary"
                data-testid="cancel-reset-btn"
                onClick={() => {
                  setResetModalOpen(false);
                  resetTriggerBtnRef.current?.focus();
                }}
              >
                İptal
              </button>
              <button
                type="button"
                className="bq-btn bq-btn-danger"
                data-testid="confirm-reset-btn"
                onClick={() => {
                  const resetState = resetMissionSession(session);
                  onResetDraftConfirmed(resetState);
                  setResetModalOpen(false);
                  setStatusToast('Görev başlangıç durumuna sıfırlandı.');
                  resetTriggerBtnRef.current?.focus();
                }}
              >
                Evet, Sıfırla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS & LEARNING RECAP MODAL */}
      {recapModalOpen &&
        lastEvaluation &&
        lastEvaluation.pass &&
        !lastEvaluation.stale && (
          <div
            className="bq-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recap-dialog-title"
            data-testid="results-recap-modal"
          >
            {/* Celebratory Blueprint & Gold Confetti Burst */}
            {!reducedMotion && (
              <div className="bq-confetti-layer" aria-hidden="true">
                {Array.from({ length: 24 }).map((_, idx) => (
                  <span
                    key={idx}
                    className={`bq-confetti-piece piece-${idx % 4}`}
                    style={{
                      left: `${(idx * 4.1 + 3) % 96}%`,
                      animationDelay: `${(idx % 6) * 0.08}s`,
                    }}
                  />
                ))}
              </div>
            )}

            <div className="bq-modal-card bq-recap-card">
              <div className="bq-recap-header">
                <div className="bq-recap-top-row">
                  <span className="bq-recap-kicker">
                    5. DEĞERLENDİR — GÖREV TAMAMLANDI
                  </span>
                  <div
                    className="bq-star-rating-row"
                    data-testid="modal-star-rating"
                    aria-label="Kazanılan Yıldız Derecesi"
                  >
                    {[1, 2, 3].map((starIdx) => {
                      const starCount =
                        lastEvaluation.badge === 'gold'
                          ? 3
                          : lastEvaluation.badge === 'silver'
                          ? 2
                          : 1;
                      const earned = starIdx <= starCount;
                      return (
                        <span
                          key={starIdx}
                          className={`bq-star-icon ${earned ? 'earned' : 'empty'}`}
                        >
                          ★
                        </span>
                      );
                    })}
                  </div>
                </div>
                <h2 id="recap-dialog-title">{task.title} — Başarılı!</h2>
              </div>

              <div className="bq-recap-score-row">
                <div className="bq-recap-score-box">
                  <span className="bq-recap-score-val" data-testid="modal-score-value">
                    {lastEvaluation.score}
                  </span>
                  <span className="bq-recap-score-lbl">Puan</span>
                </div>
                <div className="bq-recap-score-box">
                  <span className="bq-recap-score-val" data-testid="modal-xp-value">
                    +{calculateMissionXp(lastEvaluation.score)} XP
                  </span>
                  <span className="bq-recap-score-lbl">Kazanılan Deneyim</span>
                </div>
                <div className="bq-recap-badge-box">
                  <span
                    className={`bq-badge bq-badge-${lastEvaluation.badge}`}
                    data-testid="modal-badge-value"
                  >
                    {badgeLabelTr(lastEvaluation.badge)}
                  </span>
                  <span className="bq-recap-hint-note">
                    ⚡ Hamle: {session.revision} (İdeal: {parMoves}) · İpucu:{' '}
                    {revealedHints.length} (−{revealedHints.length * 5} puan)
                  </span>
                </div>
              </div>

              <div className="bq-recap-reflection" data-testid="modal-recap-text">
                <h3>5. Değerlendir & Revit Özeti</h3>
                <div className="bq-recap-grid-4">
                  <div className="bq-recap-mini-card">
                    <strong>✓ Ne Yaptın?</strong>
                    <p>{learningGuide.completionExplanation.whatYouDid}</p>
                  </div>
                  <div className="bq-recap-mini-card">
                    <strong>💡 Neden Doğru?</strong>
                    <p>{learningGuide.completionExplanation.whyItIsRight}</p>
                  </div>
                  <div className="bq-recap-mini-card">
                    <strong>🖥️ Gerçek Revit Karşılığı</strong>
                    <p>
                      <code>
                        {learningGuide.completionExplanation.revitCounterpart}
                      </code>
                    </p>
                  </div>
                  <div className="bq-recap-mini-card">
                    <strong>🚀 Sonraki Kavram</strong>
                    <p>{learningGuide.completionExplanation.nextConcept}</p>
                  </div>
                </div>
              </div>

              <div className="bq-modal-actions">
                <button
                  type="button"
                  className="bq-btn bq-btn-secondary"
                  data-testid="close-recap-btn"
                  onClick={() => setRecapModalOpen(false)}
                >
                  Modeli İncelemeye Dön
                </button>
                <button
                  type="button"
                  className="bq-btn bq-btn-secondary"
                  data-testid="replay-mission-btn"
                  onClick={() => {
                    const resetState = resetMissionSession(session);
                    onResetDraftConfirmed(resetState);
                    setRecapModalOpen(false);
                  }}
                >
                  Baştan Tekrar Oyna
                </button>
                <button
                  type="button"
                  className="bq-btn bq-btn-secondary"
                  data-testid="finish-to-dashboard-btn"
                  onClick={() => {
                    setRecapModalOpen(false);
                    onBackToDashboard();
                  }}
                >
                  Öğrenme Yoluna Dön
                </button>
                {nextMission && (
                  <button
                    type="button"
                    className="bq-btn bq-btn-primary"
                    data-testid="next-mission-btn"
                    onClick={() => {
                      setRecapModalOpen(false);
                      onGoToNextMission(nextMission.id);
                    }}
                  >
                    Sonraki Görev: {nextMission.title} →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      {/* ⓘ MISSION INFO & INTERACTIVE BIM GUIDE MODAL */}
      {infoModalOpen && (
        <div
          className="bq-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ws-info-dialog-title"
          data-testid="ws-info-modal"
          onClick={() => setInfoModalOpen(false)}
        >
          <div
            className="bq-modal-card bq-recap-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bq-recap-header">
              <span className="bq-recap-kicker">
                ⓘ MİMARİ BIM KILAVUZU · {task.id.toUpperCase()}
              </span>
              <h2 id="ws-info-dialog-title">{task.title}</h2>
            </div>

            <div className="bq-info-modal-grid">
              <div className="bq-info-step-card">
                <strong>1. Bu İşlem Nedir?</strong>
                <p>{learningGuide.whatIsIt}</p>
              </div>
              <div className="bq-info-step-card">
                <strong>2. Neden Kullanılır?</strong>
                <p>{learningGuide.whyUsed}</p>
              </div>
              <div className="bq-info-step-card">
                <strong>3. Nasıl Uygulanır?</strong>
                <p>{learningGuide.actionSummary}</p>
              </div>
            </div>

            <div className="bq-target-box" style={{ marginTop: '0.85rem' }}>
              <h3>
                Anlık Görev Durumu ({liveProgress.passed}/{liveProgress.total}{' '}
                Kural Tamamlandı — %{liveProgress.pct})
              </h3>
              <ul className="bq-criteria-preview-list">
                {task.criteria.map((c) => (
                  <li key={c.id}>
                    <code>{c.id}</code>: {c.message}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bq-modal-actions" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="bq-btn bq-btn-primary"
                data-testid="close-ws-info-modal-btn"
                onClick={() => setInfoModalOpen(false)}
              >
                Anladım, Modele Dön
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
