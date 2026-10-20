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
import { Dashboard } from './ui/Dashboard';
import { Workspace } from './ui/Workspace';

const THEME_STORAGE_KEY = 'bimquest.theme.v1';

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
    },
    [persistSave, save]
  );

  const handleSessionChange = useCallback(
    (
      nextSession: MissionSessionState,
      passingEvaluation?: SubmittedEvaluation
    ) => {
      setActiveSession(nextSession);

      const missionId = nextSession.task.id;
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
    [persistSave, save]
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
      {!activeSession ? (
        <Dashboard
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
