import { HelpSheet } from '../HelpSheet';
import React from 'react';
import { TOOL_DEFS, type ToolId } from './toolActions';
import type { MissionSessionState } from '../../domain/commands';
import type { SubmittedEvaluation, MissionTask } from '../../domain/types';
import { undoCommand, redoCommand } from '../../domain/commands';
import { startMission1Tutorial } from '../tutorial';
import { playSound, setSoundMuted } from '../sound';

export interface TopBarProps {
  onBackToDashboard: () => void;
  task: MissionTask;
  liveProgress: { passed: number; total: number; pct: number; allPass: boolean; };
  activeTool: ToolId;
  setActiveTool: React.Dispatch<React.SetStateAction<ToolId>>;
  onOpenLevels: () => void;
  onOpenSchedules: () => void;
  onOpenModify: () => void;
  onOpenVisibility: () => void;
  hiddenCount: number;
  showModify: boolean;
  showSchedules: boolean;
  showLevels: boolean;
  /** null = hide the button. */
  warningCount: number | null;
  showViews: boolean;
  onOpenViews: () => void;
  onOpenWarnings: () => void;
  setFieldError: React.Dispatch<React.SetStateAction<string | null>>;
  setMobileDrawerTab: React.Dispatch<React.SetStateAction<"brief" | "inspector" | "check">>;
  session: MissionSessionState;
  onSessionChange: (next: MissionSessionState, passingEvaluation?: SubmittedEvaluation) => void;
  resetTriggerBtnRef: React.RefObject<HTMLButtonElement | null>;
  setResetModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setInfoModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  soundMuted: boolean;
  setSoundMutedState: React.Dispatch<React.SetStateAction<boolean>>;
  onToggleTheme?: () => void;
  theme?: "light" | "dark";
}

export const TopBar: React.FC<TopBarProps> = ({
  onBackToDashboard,
  task,
  liveProgress,
  activeTool,
  setActiveTool,
  onOpenLevels,
  onOpenSchedules,
  onOpenModify,
  onOpenVisibility,
  hiddenCount,
  showModify,
  showSchedules,
  showLevels,
  warningCount,
  onOpenWarnings,
  showViews,
  onOpenViews,
  setFieldError,
  setMobileDrawerTab,
  session,
  onSessionChange,
  resetTriggerBtnRef,
  setResetModalOpen,
  setInfoModalOpen,
  soundMuted,
  setSoundMutedState,
  onToggleTheme,
  theme,
}) => (
  <>
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

          {TOOL_DEFS.filter((t) =>
            task.permissions.creatableTypes.includes(
              (t.id === 'section' || t.id === 'elevation' ? 'view' : t.id) as never
            )
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              className={`bq-tool-btn ${activeTool === t.id ? 'active' : ''}`}
              data-testid={`tool-${t.id}-btn`}
              onClick={() => {
                setActiveTool((cur) => (cur === t.id ? 'select' : t.id));
                setMobileDrawerTab('inspector');
                setFieldError(null);
              }}
              aria-pressed={activeTool === t.id}
              title={t.keys ? `${t.group} · Revit kısayolu: ${t.keys}` : t.group}
            >
              {t.id === 'wall' || t.id === 'door' ? (
                <svg width="18" height="18" aria-hidden="true">
                  <use href={`./assets/ui/icons.svg#${t.id}`} />
                </svg>
              ) : null}
              <span>{t.label}</span>
              {t.keys && <kbd className="bq-kbd" aria-hidden="true">{t.keys}</kbd>}
            </button>
          ))}

          {showViews && (
            <button
              type="button"
              className="bq-tool-btn"
              data-testid="project-browser-btn"
              onClick={onOpenViews}
              title="Proje Tarayıcısı: görünümler ve paftalar"
            >
              <span>Görünümler</span>
            </button>
          )}

          {warningCount !== null && (
            <button
              type="button"
              className="bq-tool-btn"
              data-testid="warnings-btn"
              onClick={onOpenWarnings}
              title="Model uyarıları"
            >
              <span>Uyarılar ({warningCount})</span>
            </button>
          )}

          <button
            type="button"
            className="bq-tool-btn"
            data-testid="visibility-btn"
            onClick={onOpenVisibility}
            title="Görünürlük: kategorileri aç/kapat"
          >
            <span>Görünürlük{hiddenCount > 0 ? ` (${hiddenCount})` : ''}</span>
          </button>

          {showModify && (
            <button
              type="button"
              className="bq-tool-btn"
              data-testid="modify-btn"
              onClick={onOpenModify}
              title="Modify: Kopyala, Aynala, Öteleme, Hizala"
            >
              <span>Değiştir</span>
            </button>
          )}

          {showSchedules && (
            <button
              type="button"
              className="bq-tool-btn"
              data-testid="schedules-btn"
              onClick={onOpenSchedules}
              title="Proje Tarayıcısı · Çizelgeler"
            >
              <span>Çizelgeler</span>
            </button>
          )}

          {showLevels && (
            <button
              type="button"
              className="bq-tool-btn"
              data-testid="levels-btn"
              onClick={onOpenLevels}
              title="Referans · Katlar"
            >
              <span>Katlar</span>
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

          <HelpSheet className="bq-tool-btn" />

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
  </>
);
