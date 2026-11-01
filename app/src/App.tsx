import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import './App.css';
import { loadValidatedCatalog } from './content/content';
import {
  cloneModel,
  createInitialSession,
  type MissionSessionState,
} from './domain/commands';
import {
  createDefaultSaveEnvelope,
  isMissionUnlocked,
  loadFromBrowserStorage,
  parseAndValidateSaveJson,
  carryOverDraft,
  recordPassingScore,
  SAVE_STORAGE_KEY,
  writeToBrowserStorage,
} from './domain/persistence';
import type { SaveEnvelopeV1, SubmittedEvaluation } from './domain/types';
import {
  dayKey,
  loadMeta,
  markAnnounced,
  newAchievements,
  recordAttempt,
  registerPlayDay,
  saveMeta,
  visibleStreak,
  type Achievement,
  type GameMeta,
} from './domain/gameMeta';
import { playSound } from './ui/sound';
import { disableDailyReminder, enableDailyReminder, setHapticsEnabled } from './native/native';
import { Dashboard } from './ui/Dashboard';
import { TitleScreen } from './ui/TitleScreen';
import {
  buildWorkshopTask,
  clearWorkshopModel,
  isWorkshop,
  loadWorkshopModel,
  saveWorkshopModel,
} from './content/workshop';
import { FirstRunTour } from './ui/FirstRunTour';
import './campaign/campaign.css';
import { HomeScreen } from './campaign/HomeScreen';
import { HOUSES } from './campaign/houses';
import { clearProgress, loadProgress, saveProgress, totalStars, type CampaignProgress } from './campaign/progress';
const CampaignScreen = lazy(() =>
  import('./campaign/CampaignScreen').then((m) => ({ default: m.CampaignScreen }))
);
const Workspace = lazy(() =>
  import('./ui/Workspace').then((m) => ({ default: m.Workspace }))
);

const THEME_STORAGE_KEY = 'bimquest.theme.v1';
const TITLE_SEEN_KEY = 'bimquest.titleSeen.v1';
/** Which home screen the player was on, so a reload returns there. */
const SCREEN_KEY = 'bimquest.screen.v1';

function titleAlreadySeen(): boolean {
  try {
    return window.sessionStorage.getItem(TITLE_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

const catalogResult = loadValidatedCatalog();
const catalog = catalogResult.ok
  ? catalogResult.catalog
  : { contentVersion: '1.0.0', missions: [], missionsById: {} };

export function App() {
  const [save, setSave] = useState<SaveEnvelopeV1>(() =>
    createDefaultSaveEnvelope()
  );
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // Ignore storage errors
    }
    return 'dark';
  });

  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [recoveryIssue, setRecoveryIssue] = useState<{
    reason: string;
    message: string;
    rawText: string;
  } | null>(null);

  const [activeSession, setActiveSession] =
    useState<MissionSessionState | null>(null);

  const [showTitle, setShowTitle] = useState(() => !titleAlreadySeen());
  /** Home shows the houses; 'missions' is the mission list. */
  const [screen, setScreenState] = useState<'home' | 'missions'>(() => {
    try {
      return window.sessionStorage.getItem(SCREEN_KEY) === 'missions' ? 'missions' : 'home';
    } catch {
      return 'home';
    }
  });
  const setScreen = useCallback((next: 'home' | 'missions') => {
    setScreenState(next);
    try {
      window.sessionStorage.setItem(SCREEN_KEY, next);
    } catch {
      // Ignore storage errors
    }
  }, []);
  const [house, setHouse] = useState<number | null>(null);
  const [progress, setProgress] = useState<CampaignProgress>(() => loadProgress());
  // Every screen opens at its top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen, house, activeSession, showTitle]);

  const updateProgress = useCallback((p: CampaignProgress) => {
    setProgress(p);
    saveProgress(p);
  }, []);
  const [openInfoOnDashboard, setOpenInfoOnDashboard] = useState(false);
  const [meta, setMeta] = useState<GameMeta>(() => loadMeta());
  const [toast, setToast] = useState<Achievement | null>(null);
  const [today] = useState(() => dayKey(new Date()));

  const leaveTitle = useCallback((withInfo: boolean) => {
    try {
      window.sessionStorage.setItem(TITLE_SEEN_KEY, '1');
    } catch {
      // Ignore storage errors
    }
    setOpenInfoOnDashboard(withInfo);
    setShowTitle(false);
  }, []);

  useEffect(() => {
    setHapticsEnabled(!meta.hapticsOff);
  }, [meta.hapticsOff]);

  // Re-arm the daily reminder after an app update or a reinstall of the schedule.
  useEffect(() => {
    if (meta.reminderHour !== null) void enableDailyReminder(meta.reminderHour);
    // Only on first load: toggling is handled in handleSetReminder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMeta = useCallback((next: GameMeta) => {
    setMeta(next);
    saveMeta(next);
  }, []);

  // A play day counts when a mission is opened.
  const touchPlayDay = useCallback(() => {
    updateMeta(registerPlayDay(meta, dayKey(new Date())));
  }, [meta, updateMeta]);

  // Announce achievements the player has not been told about yet, one by one.
  useEffect(() => {
    if (toast) return;
    const pending = newAchievements(save.completed, meta);
    if (pending.length === 0) return;
    // Progress that existed before this feature is marked as seen silently.
    if (meta.announced.length === 0 && Object.keys(save.completed).length > 1 && meta.lastPlayDay === null) {
      updateMeta(markAnnounced(meta, pending.map((a) => a.id)));
      return;
    }
    setToast(pending[0]);
    updateMeta(markAnnounced(meta, [pending[0].id]));
    playSound('success');
  }, [save.completed, meta, toast, updateMeta]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Sync theme attribute to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Initial load from localStorage
  useEffect(() => {
    const outcome = loadFromBrowserStorage(catalog.missionsById);
    setSave(outcome.save);
    setStorageWarning(outcome.storageWarning);
    setRecoveryIssue(outcome.recoveryIssue);
  }, []);

  const persistSave = useCallback(
    (nextSave: SaveEnvelopeV1, allowWriteWhenRecoveryPending = false) => {
      setSave(nextSave);
      if (recoveryIssue && !allowWriteWhenRecoveryPending) {
        return;
      }
      const res = writeToBrowserStorage(nextSave);
      if (!res.ok) {
        setStorageWarning(res.warning);
      } else {
        setStorageWarning(null);
      }
    },
    [recoveryIssue]
  );

  const handleStartWorkshop = useCallback(() => {
    const saved = loadWorkshopModel();
    const task = buildWorkshopTask(saved ?? undefined);
    setActiveSession(
      createInitialSession(task, saved ? { model: saved, revealedHints: [] } : undefined)
    );
    touchPlayDay();
  }, [touchPlayDay]);

  const handleStartMission = useCallback(
    (missionId: string, resumeDraft: boolean) => {
      const task = catalog.missionsById[missionId];
      if (!task) return;
      const unlockInfo = isMissionUnlocked(task, save.completed);
      if (!unlockInfo.unlocked) return;

      const existingDraft = resumeDraft ? save.drafts[missionId] : undefined;
      let nextSave = save;
      if (!resumeDraft && save.drafts[missionId]) {
        const nextDrafts = { ...save.drafts };
        delete nextDrafts[missionId];
        nextSave = { ...save, drafts: nextDrafts };
        persistSave(nextSave);
      }

      const session = createInitialSession(
        task,
        existingDraft ?? carryOverDraft(task, save)
      );
      setActiveSession(session);
      touchPlayDay();
    },
    [persistSave, save, touchPlayDay]
  );

  const handleSessionChange = useCallback(
    (
      nextSession: MissionSessionState,
      passingEvaluation?: SubmittedEvaluation
    ) => {
      if (isWorkshop(nextSession.task.id)) {
        // The sandbox never touches the mission save file.
        setActiveSession(nextSession);
        saveWorkshopModel(nextSession.model);
        return;
      }
      const prevEval = activeSession?.lastEvaluation ?? null;
      const evalNow = nextSession.lastEvaluation;
      setActiveSession(nextSession);

      const missionId = nextSession.task.id;
      if (evalNow && evalNow !== prevEval && !evalNow.stale) {
        updateMeta(
          recordAttempt(meta, missionId, evalNow.pass, nextSession.revealedHints.length)
        );
      }
      let nextSave: SaveEnvelopeV1 = {
        ...save,
        drafts: {
          ...save.drafts,
          [missionId]: {
            model: cloneModel(nextSession.model),
            revealedHints: [...nextSession.revealedHints],
          },
        },
      };

      if (passingEvaluation && passingEvaluation.pass) {
        nextSave = recordPassingScore(
          nextSave,
          missionId,
          passingEvaluation.score,
          nextSession.model
        );
      }

      persistSave(nextSave);
    },
    [persistSave, save, activeSession, meta, updateMeta]
  );

  const handleResetDraftConfirmed = useCallback(
    (resetState: MissionSessionState) => {
      const missionId = resetState.task.id;
      if (isWorkshop(missionId)) {
        clearWorkshopModel();
        setActiveSession(createInitialSession(buildWorkshopTask()));
        return;
      }
      const carried = carryOverDraft(resetState.task, save);
      setActiveSession(
        carried ? createInitialSession(resetState.task, carried) : resetState
      );
      const nextDrafts = { ...save.drafts };
      delete nextDrafts[missionId];
      const nextSave: SaveEnvelopeV1 = {
        ...save,
        drafts: nextDrafts,
      };
      persistSave(nextSave);
    },
    [persistSave, save]
  );

  const handleExportSave = useCallback(() => {
    const jsonText = JSON.stringify(save, null, 2);
    const blob = new Blob([jsonText], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bimquest-save-v1.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [save]);

  const handleImportSaveText = useCallback(
    (rawText: string): { ok: boolean; message: string } => {
      const validated = parseAndValidateSaveJson(rawText, catalog.missionsById);
      if (!validated.ok) {
        return { ok: false, message: validated.message };
      }
      setRecoveryIssue(null);
      persistSave(validated.save, true);
      return {
        ok: true,
        message: 'Kayıt dosyası başarıyla doğrulandı ve yüklendi.',
      };
    },
    [persistSave]
  );

  const handleUpdateSettings = useCallback(
    (partial: Partial<SaveEnvelopeV1['settings']>) => {
      const nextSave: SaveEnvelopeV1 = {
        ...save,
        settings: {
          ...save.settings,
          ...partial,
        },
      };
      persistSave(nextSave);
    },
    [persistSave, save]
  );

  const handleClearAllData = useCallback(() => {
    const fresh = createDefaultSaveEnvelope();
    setRecoveryIssue(null);
    setActiveSession(null);
    try {
      window.localStorage.removeItem(SAVE_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    persistSave(fresh, true);
  }, [persistSave]);

  const handleDismissRecoveryIssue = useCallback(() => {
    const fresh = createDefaultSaveEnvelope();
    setRecoveryIssue(null);
    persistSave(fresh, true);
  }, [persistSave]);

  const handleGoToNextMission = useCallback(
    (nextMissionId: string) => {
      const task = catalog.missionsById[nextMissionId];
      if (!task) {
        setActiveSession(null);
        return;
      }
      const existingDraft = save.drafts[nextMissionId];
      setActiveSession(
        createInitialSession(task, existingDraft ?? carryOverDraft(task, save))
      );
    },
    [save]
  );

  return (
    <div
      data-theme={theme}
      className={`bq-app-root ${
        save.settings.reducedMotion ? 'reduced-motion' : ''
      }`}
    >
      {toast && (
        <div className="bq-ach-toast" role="status" data-testid="achievement-toast">
          <span className="bq-ach-toast-icon" aria-hidden="true">{toast.icon}</span>
          <span>
            <strong>Başarım: {toast.title}</strong>
            <small>{toast.description}</small>
          </span>
        </div>
      )}
      {showTitle && !activeSession ? (
        <TitleScreen
          hasProgress={totalStars(progress) > 0 || Object.keys(save.completed).length > 0}
          stars={totalStars(progress)}
          onPlay={() => leaveTitle(false)}
          onHowToPlay={() => leaveTitle(true)}
        />
      ) : house !== null && !activeSession ? (
        <Suspense fallback={<div className="bq-scene-loading" role="status">Yükleniyor…</div>}>
          <CampaignScreen
            house={HOUSES[house]}
            progress={progress}
            onProgress={updateProgress}
            theme={theme}
            reducedMotion={save.settings.reducedMotion}
            onExit={() => setHouse(null)}
          />
        </Suspense>
      ) : screen === 'home' && !activeSession ? (
        <HomeScreen
          progress={progress}
          missions={{
            done: catalog.missions.filter((m) => m.id in save.completed).length,
            total: catalog.missions.length,
            next: catalog.missions.find((m) => !(m.id in save.completed))?.title ?? null,
          }}
          settings={{
            theme,
            reducedMotion: save.settings.reducedMotion,
            hapticsOff: meta.hapticsOff,
            reminderOn: meta.reminderHour !== null,
          }}
          initialHowTo={openInfoOnDashboard}
          onOpenHouse={(i) => {
            setHouse(i);
            touchPlayDay();
          }}
          onOpenMissions={() => {
            setOpenInfoOnDashboard(false);
            setScreen('missions');
          }}
          onToggleTheme={handleToggleTheme}
          onReducedMotion={(on) => handleUpdateSettings({ reducedMotion: on })}
          onHaptics={(on) => updateMeta({ ...meta, hapticsOff: !on })}
          onReminder={async (on) => {
            if (!on) {
              await disableDailyReminder();
              updateMeta({ ...meta, reminderHour: null });
              return { ok: true };
            }
            const res = await enableDailyReminder(19);
            if (res.ok) updateMeta({ ...meta, reminderHour: 19 });
            return res;
          }}
          onResetProgress={() => {
            clearProgress();
            setProgress({ stars: {} });
          }}
          onBackToTitle={() => setShowTitle(true)}
        />
      ) : !activeSession ? (
        <>
        <Dashboard
          onBackToHome={() => setScreen('home')}
          streak={visibleStreak(meta, today)}
          meta={meta}
          onStartWorkshop={handleStartWorkshop}
          onSetPlayerName={(name) => updateMeta({ ...meta, playerName: name })}
          onSetHaptics={(on) => updateMeta({ ...meta, hapticsOff: !on })}
          onSetReminder={async (on) => {
            if (!on) {
              await disableDailyReminder();
              updateMeta({ ...meta, reminderHour: null });
              return { ok: true };
            }
            const res = await enableDailyReminder(19);
            if (res.ok) updateMeta({ ...meta, reminderHour: 19 });
            return res;
          }}
          initialInfoOpen={false}
          onBackToTitle={() => setShowTitle(true)}
          missions={catalog.missions}
          save={save}
          theme={theme}
          storageWarning={storageWarning}
          recoveryIssue={recoveryIssue}
          onToggleTheme={handleToggleTheme}
          onStartMission={handleStartMission}
          onExportSave={handleExportSave}
          onImportSaveText={handleImportSaveText}
          onUpdateSettings={handleUpdateSettings}
          onClearAllData={handleClearAllData}
          onDismissRecoveryIssue={handleDismissRecoveryIssue}
        />
        {!meta.introDone && Object.keys(save.completed).length === 0 && (
          <FirstRunTour onDone={() => updateMeta({ ...meta, introDone: true })} />
        )}
        </>
      ) : (
        <Suspense fallback={<div className="bq-scene-loading" role="status">Görev yükleniyor…</div>}>
        <Workspace
          session={activeSession}
          allMissions={catalog.missions}
          completedMap={save.completed}
          theme={theme}
          reducedMotion={save.settings.reducedMotion}
          storageWarning={storageWarning}
          onToggleTheme={handleToggleTheme}
          onSessionChange={handleSessionChange}
          onResetDraftConfirmed={handleResetDraftConfirmed}
          onBackToDashboard={() => setActiveSession(null)}
          onGoToNextMission={handleGoToNextMission}
          onExportSave={handleExportSave}
        />
        </Suspense>
      )}
    </div>
  );
}

export default App;
