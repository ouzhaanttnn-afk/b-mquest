import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDoorCommand,
  createWallCommand,
  deleteElementCommand,
  moveWallCommand,
  redoCommand,
  undoCommand,
  setCropRectCommand,
  updateElementProperty,
  type CommandResult,
  type MissionSessionState,
} from '../domain/commands';
import { capBadgeForWalkthrough, evaluate } from '../domain/evaluator';
import {
  getMissionLearningGuide,
  getPedagogicalFlowSteps,
} from '../domain/pedagogy';
import type {
  EditableField,
  MissionTask,
  SubmittedEvaluation,
  ViewElement,
  WallElement,
} from '../domain/types';
import type { DoorDraftPreview, WallDraftPreview } from '../plan/PlanViewport';
import { StageViewports } from './workspace/StageViewports';
import { isSoundMuted, playSound } from './sound';
import { buildDraftsForElement } from './workspace/drafts';
import { TopBar } from './workspace/TopBar';
import { LevelsSheet } from './workspace/LevelsSheet';
import { ProjectBrowser, SheetEditor } from './workspace/DocumentationPanels';
import { ProjectDelivery } from './workspace/ProjectDelivery';
import { MissionCard } from './workspace/MissionCard';
import { CoachBar, coachStep } from './workspace/CoachBar';
import { WarningsSheet } from './workspace/WarningsSheet';
import { checkModel, checkOptionsFor } from '../domain/modelCheck';
import { getChapterForMissionId } from '../content/curriculum';
import { ToolOptionsBar, type ToolOptions } from './workspace/ToolOptionsBar';
import {
  EMPTY_CHAIN,
  canMoveOpening,
  dimensionTap,
  elevationFor,
  floorFromWalls,
  gridTap,
  sectionTap,
  tagTap,
  placeOpening,
  placeRoomAt,
  roofFromWalls,
  stairAt,
  wallChainTap,
  type ChainState,
  type ToolId,
} from './workspace/toolActions';
import { MissionPanel } from './workspace/MissionPanel';
import { GameDock } from './workspace/GameDock';
import { PropertyInspector } from './workspace/PropertyInspector';
import { CheckFeedback } from './workspace/CheckFeedback';
import { MobileTabBar } from './workspace/MobileTabBar';
import { ResetDialog } from './workspace/ResetDialog';
import { RecapModal } from './workspace/RecapModal';
import { InfoModal } from './workspace/InfoModal';

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

export const Workspace: React.FC<WorkspaceProps> = ({
  session,
  allMissions,
  completedMap,
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
  const [activeTool, setActiveTool] = useState<ToolId>('select');
  // Center viewport layout: 'split' | 'plan' | '3d'
  // Phones start with the plan only: one clear picture instead of two cramped ones.
  const [viewMode, setViewMode] = useState<'split' | 'plan' | '3d'>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches
      ? 'plan'
      : 'split'
  );
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
    return { passed, total, pct, allPass: res.pass, criteria: res.criteria };
  }, [task, model, revealedHints.length]);

  // Local text drafts for selected element editing (synced synchronously on selection/revision change)
  const selectedElement = useMemo(
    () => model.elements.find((e) => e.id === selectedId) ?? null,
    [model.elements, selectedId]
  );

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
  // Tap-to-model tool state (Faz 2)
  const [chain, setChain] = useState<ChainState>(EMPTY_CHAIN);
  const [gridStart, setGridStart] = useState<[number, number] | null>(null);
  const [pickedWalls, setPickedWalls] = useState<Set<string>>(new Set());
  const [roomGap, setRoomGap] = useState<[number, number] | null>(null);
  const [activeLevelIdRaw, setActiveLevelId] = useState<string>(
    session.model.levels[0]?.id ?? 'l0'
  );
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [dimFirst, setDimFirst] = useState<string | null>(null);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [toolOpts, setToolOpts] = useState<ToolOptions>({
    winWidth: '1200',
    winHeight: '1200',
    winSill: '900',
    doorWidth: '900',
    doorHeight: '2100',
    doorSill: '0',
    wallHeight: '3000',
    wallThickness: '200',
    slope: '25',
    overhang: '500',
    risers: '17',
    riserHeight: '175',
    direction: 'x+',
    topLevelId: session.model.levels[session.model.levels.length - 1]?.id ?? 'l0',
  });

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
  const hideDiagnostics =
    Number(getChapterForMissionId(task.id)?.id.slice(2) ?? 0) >= 6;
  const failedElementIds = useMemo(() => {
    const set = new Set<string>();
    if (!lastEvaluation || lastEvaluation.stale) return set;
    for (const c of lastEvaluation.criteria) {
      if (!c.pass) {
        const taskCrit = task.criteria.find((tc) => tc.id === c.id);
        if (taskCrit && taskCrit.type === 'property') {
          set.add(taskCrit.elementId);
        }
        // Chapters 1-5 may point at the offending elements; 6-7 must find them.
        if (taskCrit && taskCrit.type === 'modelClean' && !hideDiagnostics) {
          for (const issue of checkModel(model, checkOptionsFor(task.criteria))) {
            if (!taskCrit.codes || taskCrit.codes.includes(issue.code)) {
              issue.elementIds.forEach((id) => set.add(id));
            }
          }
        }
      }
    }
    return set;
  }, [lastEvaluation, task.criteria, model, hideDiagnostics]);

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
    const original = buildDraftsForElement(selectedElement);
    setEditDrafts((prev) => ({ ...prev, [fieldKey]: original[fieldKey] ?? '' }));
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

  // Model checks (Faz 3): chapters 6-7 hide the detailed list.
  const modelIssues = useMemo(
    () => checkModel(model, checkOptionsFor(task.criteria)),
    [model, task.criteria]
  );
  const advancedChapter = hideDiagnostics;
  // Views (Faz 4): a section/elevation replaces the plan pane; a plan view adds crop/cut plane.
  const activeView = useMemo(
    () =>
      model.elements.find(
        (e): e is ViewElement => e.type === 'view' && e.id === activeViewId
      ) ?? null,
    [model.elements, activeViewId]
  );
  const drawingView = activeView && activeView.kind !== 'plan' ? activeView : null;
  const activePlanView = activeView && activeView.kind === 'plan' ? activeView : null;
  const coach = coachStep({
    task,
    criteria: liveProgress.criteria,
    selectedId,
    activeTool,
    allPass: liveProgress.allPass,
  });
  const hasViews = model.elements.some((e) => e.type === 'view' || e.type === 'sheet');
  const hasModelCheckGoal = task.criteria.some((c) => c.type === 'modelClean');
  const pedagogicalSteps = useMemo(
    () => getPedagogicalFlowSteps(session.revision, lastEvaluation),
    [session.revision, lastEvaluation]
  );

  // Run deterministic evaluation ("Kontrol et")
  const handleRunCheck = () => {
    setFieldError(null);
    const frozenModel = JSON.parse(JSON.stringify(model));
    const evalRes = capBadgeForWalkthrough(
      evaluate(task, frozenModel, revealedHints.length),
      showStepByStepGuide
    );
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

  const activeLevelId = model.levels.some((l) => l.id === activeLevelIdRaw)
    ? activeLevelIdRaw
    : model.levels[0].id;

  const resetToolState = () => {
    setChain(EMPTY_CHAIN);
    setGridStart(null);
    setPickedWalls(new Set());
    setRoomGap(null);
    setDimFirst(null);
  };

  useEffect(() => {
    resetToolState();
  }, [activeTool, task.id]);

  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const handleToolPoint = (
    pt: [number, number],
    hit?: { wallId: string; along: number }
  ) => {
    setRoomGap(null);
    if (activeTool === 'wall') {
      const o = wallChainTap(session, chain, pt, {
        baseLevelId: activeLevelId,
        height: num(toolOpts.wallHeight, 3000),
        thickness: num(toolOpts.wallThickness, 200),
      });
      setChain(o.next);
      if (o.result) applyResult(o.result);
      if (o.toast) setStatusToast(o.toast);
    } else if (activeTool === 'door' || activeTool === 'window') {
      const wall = wallsInModel.find((w) => w.id === hit?.wallId);
      if (!hit || !wall) {
        setStatusToast('Bir duvara dokun: ' + (activeTool === 'door' ? 'kapı' : 'pencere') + ' duvarın üzerine yerleşir.');
        return;
      }
      const win = activeTool === 'window';
      applyResult(
        placeOpening(session, activeTool, wall, hit.along, {
          width: num(win ? toolOpts.winWidth : toolOpts.doorWidth, 900),
          height: num(win ? toolOpts.winHeight : toolOpts.doorHeight, 2100),
          sill: num(win ? toolOpts.winSill : toolOpts.doorSill, 0),
          mark: doorForm.mark,
          fireRating: doorForm.fireRating,
        })
      );
    } else if (activeTool === 'floor' || activeTool === 'roof') {
      if (!hit) return;
      setPickedWalls((prev) => {
        const next = new Set(prev);
        if (next.has(hit.wallId)) next.delete(hit.wallId);
        else next.add(hit.wallId);
        return next;
      });
    } else if (activeTool === 'room') {
      const r = placeRoomAt(session, activeLevelId, pt);
      if (r.result) {
        applyResult(r.result);
      } else {
        setRoomGap(r.gapAt ?? pt);
        setStatusToast('Alan kapalı değil: kırmızı işaretli boşluğu duvarla kapat.');
        playSound('error');
      }
    } else if (activeTool === 'section') {
      const o = sectionTap(session, gridStart, pt);
      setGridStart(o.next);
      if (o.result) applyResult(o.result);
      if (o.toast) setStatusToast(o.toast);
    } else if (activeTool === 'dimension') {
      if (!hit) {
        setStatusToast('Bir duvara dokun: ölçü iki paralel duvar arasındadır.');
        return;
      }
      const o = dimensionTap(session, dimFirst, hit.wallId);
      setDimFirst(o.next);
      if (o.result) applyResult(o.result);
      if (o.toast) setStatusToast(o.toast);
    } else if (activeTool === 'tag') {
      const t = tagTap(session, pt);
      if (t.result) applyResult(t.result);
      if (t.toast) setStatusToast(t.toast);
    } else if (activeTool === 'grid') {
      const o = gridTap(session, gridStart, pt);
      setGridStart(o.next);
      if (o.result) applyResult(o.result);
      if (o.toast) setStatusToast(o.toast);
    } else if (activeTool === 'stair') {
      applyResult(
        stairAt(session, pt, {
          baseLevelId: activeLevelId,
          topLevelId: toolOpts.topLevelId,
          direction: toolOpts.direction,
          risers: num(toolOpts.risers, 17),
          riserHeight: num(toolOpts.riserHeight, 175),
        })
      );
    }
  };

  // Press-drag-release: one wall / grid / section per gesture.
  const handleToolDrag = (start: [number, number], end: [number, number]) => {
    setRoomGap(null);
    if (activeTool === 'wall') {
      const o = wallChainTap(session, { start, origin: start }, end, {
        baseLevelId: activeLevelId,
        height: num(toolOpts.wallHeight, 3000),
        thickness: num(toolOpts.wallThickness, 200),
      });
      setChain(EMPTY_CHAIN);
      if (o.result) applyResult(o.result);
    } else if (activeTool === 'grid') {
      const o = gridTap(session, start, end);
      setGridStart(null);
      if (o.result) applyResult(o.result);
    } else if (activeTool === 'section') {
      const o = sectionTap(session, start, end);
      setGridStart(null);
      if (o.result) applyResult(o.result);
    }
  };

  const handleCreateFloorTool = () => {
    applyResult(floorFromWalls(session, activeLevelId, [...pickedWalls]));
    setPickedWalls(new Set());
  };

  const handleCreateRoofTool = () => {
    applyResult(
      roofFromWalls(
        session,
        activeLevelId,
        [...pickedWalls],
        num(toolOpts.slope, 25),
        num(toolOpts.overhang, 500)
      )
    );
    setPickedWalls(new Set());
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

  const applyResult = (res: CommandResult) => {
    if (!res.ok) {
      playSound('error');
      setFieldError(res.error.message);
      return;
    }
    setFieldError(null);
    if (res.state !== session) {
      playSound('snap');
      onSessionChange(res.state);
    }
  };

  const numericProp = (field: string): number => {
    const v = (selectedElement as unknown as Record<string, unknown> | null)?.[
      field
    ];
    return typeof v === 'number' ? v : 0;
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
        <TopBar
          onBackToDashboard={onBackToDashboard}
          task={task}
          liveProgress={liveProgress}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          onOpenLevels={() => setLevelsOpen(true)}
          warningCount={
            hasModelCheckGoal || modelIssues.length > 0 ? modelIssues.length : null
          }
          onOpenWarnings={() => setWarningsOpen(true)}
          showViews={
            hasViews ||
            ['view', 'sheet'].some((t) =>
              task.permissions.creatableTypes.includes(t as never)
            )
          }
          onOpenViews={() => setProjectOpen(true)}
          showLevels={
            model.levels.length > 1 ||
            task.permissions.editableFields.includes('elevation')
          }
          setFieldError={setFieldError}
          setMobileDrawerTab={setMobileDrawerTab}
          session={session}
          onSessionChange={onSessionChange}
          resetTriggerBtnRef={resetTriggerBtnRef}
          setResetModalOpen={setResetModalOpen}
          setInfoModalOpen={setInfoModalOpen}
          soundMuted={soundMuted}
          setSoundMutedState={setSoundMutedState}
          onToggleTheme={onToggleTheme}
          theme={theme}
        />

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
        <MissionPanel
          leftCollapsed={leftCollapsed}
          mobileDrawerTab={mobileDrawerTab}
          mobileSheetOpen={mobileSheetOpen}
          setMobileSheetOpen={setMobileSheetOpen}
          setLeftCollapsed={setLeftCollapsed}
          task={task}
          showLearnDetail={showLearnDetail}
          setShowLearnDetail={setShowLearnDetail}
          showRulesDetail={showRulesDetail}
          setShowRulesDetail={setShowRulesDetail}
          liveProgress={liveProgress}
          setInfoModalOpen={setInfoModalOpen}
          learningGuide={learningGuide}
          setShowMoreLearn={setShowMoreLearn}
          showMoreLearn={showMoreLearn}
          revealedHints={revealedHints}
          onSessionChange={onSessionChange}
          session={session}
          showStepByStepGuide={showStepByStepGuide}
          setShowStepByStepGuide={setShowStepByStepGuide}
        />

        {/* CENTER PANEL: Synchronized 2D Plan & 3D Scene */}
        <main
          className="bq-center-stage"
          data-tour="viewport-area"
          aria-label="Model Görünüm Alanı"
        >
        <CoachBar
          task={task}
          step={coach}
          onOpenInspector={() => {
            setMobileDrawerTab('inspector');
            setMobileSheetOpen(true);
            setRightCollapsed(false);
          }}
        />
        <MissionCard objective={task.objective} criteria={liveProgress.criteria} />
        {fieldError && (
          <div className="bq-tool-error bq-mobile-only" role="alert" data-testid="tool-error-banner">
            ⚠️ {fieldError}
          </div>
        )}
        <ToolOptionsBar
          activeTool={activeTool}
          model={model}
          activeLevelId={activeLevelId}
          setActiveLevelId={setActiveLevelId}
          opts={toolOpts}
          setOpts={setToolOpts}
          drawing={Boolean(chain.start) || Boolean(gridStart) || Boolean(dimFirst)}
          pickedCount={pickedWalls.size}
          onFinish={resetToolState}
          onCreateFloor={handleCreateFloorTool}
          onCreateRoof={handleCreateRoofTool}
          onElevation={(dir) => applyResult(elevationFor(session, dir))}
        />
        <StageViewports
          viewMode={viewMode}
          setViewMode={setViewMode}
          task={task}
          model={model}
          selectedId={selectedId}
          failedElementIds={failedElementIds}
          activeTool={activeTool}
          wallPreview={wallPreview}
          doorPreview={doorPreview}
          theme={theme}
          isFieldEditable={isFieldEditable}
          handleSelectElement={handleSelectElement}
          drawingView={drawingView}
          onBackToPlan={() => setActiveViewId(null)}
          planTools={{
            onToolPoint: handleToolPoint,
            onToolDrag: handleToolDrag,
            coachIds: new Set(coach.planTargets),
            chainStart: activeTool === 'grid' || activeTool === 'section' ? gridStart : chain.start,
            pickedWallIds: dimFirst ? new Set([dimFirst]) : pickedWalls,
            activeViewId: activePlanView?.id ?? null,
            cropEditable:
              Boolean(activePlanView) &&
              task.permissions.editableFields.includes('cropMinX'),
            onCropRect: (rect) =>
              activePlanView && applyResult(setCropRectCommand(session, activePlanView.id, rect)),
            roomGap,
            canDragOpenings:
              activeTool === 'select' &&
              (selectedElement?.type === 'door' || selectedElement?.type === 'window') &&
              isFieldEditable('offset'),
            canMoveOpening: (id, offset) => canMoveOpening(session, id, offset),
            onMoveOpening: (id, offset) =>
              applyResult(updateElementProperty(session, id, 'offset', offset)),
          }}
          session={session}
          onSessionChange={onSessionChange}
          setStatusToast={setStatusToast}
          reducedMotion={reducedMotion}
        />
          {/* COMPACT GAME DOCK: Floating Quick-Action HUD & Chief Architect Live Guide */}
        <GameDock
          selectedElement={selectedElement}
          isFieldEditable={isFieldEditable}
          commitSingleField={commitSingleField}
          canDeleteSelected={canDeleteSelected}
          setMobileDrawerTab={setMobileDrawerTab}
          setMobileSheetOpen={setMobileSheetOpen}
          setRightCollapsed={setRightCollapsed}
          handleSelectElement={handleSelectElement}
          liveProgress={liveProgress}
          learningGuide={learningGuide}
          session={session}
          parMoves={parMoves}
        />
        </main>

        {/* RIGHT PANEL: Object List, Property Editor & Guided Creation Forms */}
        <PropertyInspector
          session={session}
          applyResult={applyResult}
          onOpenSheet={setSheetId}
          rightCollapsed={rightCollapsed}
          mobileDrawerTab={mobileDrawerTab}
          mobileSheetOpen={mobileSheetOpen}
          selectedElement={selectedElement}
          setMobileSheetOpen={setMobileSheetOpen}
          setRightCollapsed={setRightCollapsed}
          fieldError={fieldError}
          activeTool={activeTool}
          task={task}
          handleCreateWallSubmit={handleCreateWallSubmit}
          setActiveTool={setActiveTool}
          setWallForm={setWallForm}
          wallForm={wallForm}
          model={model}
          handleCreateDoorSubmit={handleCreateDoorSubmit}
          doorForm={doorForm}
          setDoorForm={setDoorForm}
          wallsInModel={wallsInModel}
          selectedId={selectedId}
          handleSelectElement={handleSelectElement}
          failedElementIds={failedElementIds}
          canDeleteSelected={canDeleteSelected}
          handleDeleteSelected={handleDeleteSelected}
          learningGuide={learningGuide}
          isFieldEditable={isFieldEditable}
          editDrafts={editDrafts}
          setEditDrafts={setEditDrafts}
          commitSingleField={commitSingleField}
          numericProp={numericProp}
          handleFieldKeyDown={handleFieldKeyDown}
          commitCoordPair={commitCoordPair}
          handleMoveSelectedWall={handleMoveSelectedWall}
          moveDelta={moveDelta}
          setMoveDelta={setMoveDelta}
        />
      </div>

      {/* BOTTOM CHECK & FEEDBACK BAR */}
        <CheckFeedback
          mobileDrawerTab={mobileDrawerTab}
          mobileSheetOpen={mobileSheetOpen}
          handleRunCheck={handleRunCheck}
          setMobileSheetOpen={setMobileSheetOpen}
          lastEvaluation={lastEvaluation}
          statusToast={statusToast}
          setRecapModalOpen={setRecapModalOpen}
          handleCriterionClick={handleCriterionClick}
          task={task}
          revealedHintCount={revealedHints.length}
          model={model}
        />

      {/* Mobile Bottom Navigation Bar (iPhone / Narrow Screen Ergonomics) */}
        <MobileTabBar
          mobileDrawerTab={mobileDrawerTab}
          mobileSheetOpen={mobileSheetOpen}
          setMobileSheetOpen={setMobileSheetOpen}
          setMobileDrawerTab={setMobileDrawerTab}
          model={model}
          selectedId={selectedId}
        />

        <ResetDialog
          resetModalOpen={resetModalOpen}
          resetCancelBtnRef={resetCancelBtnRef}
          setResetModalOpen={setResetModalOpen}
          resetTriggerBtnRef={resetTriggerBtnRef}
          session={session}
          onResetDraftConfirmed={onResetDraftConfirmed}
          setStatusToast={setStatusToast}
        />

        {task.id === 'm50' && (
          <ProjectDelivery
            open={recapModalOpen}
            evaluation={lastEvaluation}
            task={task}
            model={model}
            completedMap={completedMap}
            onClose={() => setRecapModalOpen(false)}
            onBackToDashboard={onBackToDashboard}
          />
        )}
        <RecapModal
          recapModalOpen={recapModalOpen && task.id !== 'm50'}
          lastEvaluation={lastEvaluation}
          reducedMotion={reducedMotion}
          task={task}
          session={session}
          parMoves={parMoves}
          revealedHints={revealedHints}
          learningGuide={learningGuide}
          setRecapModalOpen={setRecapModalOpen}
          onResetDraftConfirmed={onResetDraftConfirmed}
          onBackToDashboard={onBackToDashboard}
          nextMission={nextMission}
          onGoToNextMission={onGoToNextMission}
        />

        <ProjectBrowser
        open={projectOpen}
        session={session}
        applyResult={applyResult}
        activeViewId={activeViewId}
        setActiveViewId={setActiveViewId}
        onOpenSheet={setSheetId}
        onClose={() => setProjectOpen(false)}
      />
      <SheetEditor
        session={session}
        applyResult={applyResult}
        sheetId={sheetId}
        setSheetId={setSheetId}
      />
      <WarningsSheet
        open={warningsOpen}
        issues={modelIssues}
        advanced={advancedChapter}
        evaluated={lastEvaluation !== null}
        onFocus={(id) => handleSelectElement(id)}
        onClose={() => setWarningsOpen(false)}
      />
      <LevelsSheet
        open={levelsOpen}
        session={session}
        activeLevelId={activeLevelId}
        setActiveLevelId={setActiveLevelId}
        applyResult={applyResult}
        onClose={() => setLevelsOpen(false)}
      />
      <InfoModal
          infoModalOpen={infoModalOpen}
          setInfoModalOpen={setInfoModalOpen}
          task={task}
          learningGuide={learningGuide}
          liveProgress={liveProgress}
        />
    </div>
  );
};
