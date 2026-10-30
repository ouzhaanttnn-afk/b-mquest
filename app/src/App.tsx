import { useCallback, useEffect, useState } from 'react';
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
import { calculateTotalPlayerXp } from './domain/pedagogy';
import { playSound } from './ui/sound';
import { Dashboard } from './ui/Dashboard';
import { TitleScreen } from './ui/TitleScreen';
import { Workspace } from './ui/Workspace';

const THEME_STORAGE_KEY = 'bimquest.theme.v1';
const TITLE_SEEN_KEY = 'bimquest.titleSeen.v1';

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
  const [openInfoOnDashboard, setOpenInfoOnDashboard] = useState(false);
  const [meta, setMeta] = useState<GameMeta>(() => loadMeta());
  const [toast, setToast] = useState<Achievement | null>(null);

  const leaveTitle = useCallback((withInfo: boolean) => {
    try {
      window.sessionStorage.setItem(TITLE_SEEN_KEY, '1');
    } catch {
      // Ignore storage errors
    }
    setOpenInfoOnDashboard(withInfo);
    setShowTitle(false);
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
          hasProgress={Object.keys(save.completed).length > 0}
          level={calculateTotalPlayerXp(save.completed).level}
          rankTitle={calculateTotalPlayerXp(save.completed).rankTitle}
          streak={visibleStreak(meta, dayKey(new Date()))}
          onPlay={() => leaveTitle(false)}
          onHowToPlay={() => leaveTitle(true)}
        />
      ) : !activeSession ? (
        <Dashboard
          streak={visibleStreak(meta, dayKey(new Date()))}
          meta={meta}
          initialInfoOpen={openInfoOnDashboard}
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
      ) : (
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
      )}
    </div>
  );
}

export default App;
