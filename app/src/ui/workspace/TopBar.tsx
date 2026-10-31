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
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const levelsPrimary = showLevels && task.permissions.editableFields.includes('elevation');
  const pick = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };
  return (
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

          {showModify && (
            <button
              type="button"
              className="bq-tool-btn"
              data-testid="modify-btn"
              onClick={onOpenModify}
              title="Modify: Kopyala, Aynala, Öteleme, Hizala, Kata kopyala"
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

          {levelsPrimary && (
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
            aria-label="Geri Al"
          >
            <svg width="18" height="18" aria-hidden="true">
              <use href="./assets/ui/icons.svg#undo" />
            </svg>
            <span className="bq-tool-label">Geri Al</span>
          </button>

          <button
            type="button"
            className="bq-tool-btn"
            data-testid="redo-btn"
            disabled={session.future.length === 0}
            onClick={() => onSessionChange(redoCommand(session))}
            title="İleri Al (Ctrl+Shift+Z)"
            aria-label="İleri Al"
          >
            <svg width="18" height="18" aria-hidden="true">
              <use href="./assets/ui/icons.svg#redo" />
            </svg>
            <span className="bq-tool-label">İleri Al</span>
          </button>

          <button
            type="button"
            className="bq-tool-btn bq-more-btn"
            data-testid="more-menu-btn"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-label="Diğer seçenekler"
            title="Diğer seçenekler"
            onClick={() => {
              playSound('click');
              setMenuOpen(true);
            }}
          >
            <span aria-hidden="true">⋯</span>
            {hiddenCount > 0 && <span className="bq-more-dot" aria-hidden="true" />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div
          className="bq-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Diğer seçenekler"
          data-testid="more-menu"
          onClick={() => setMenuOpen(false)}
        >
          <div className="bq-modal-card bq-menu-card" onClick={(e) => e.stopPropagation()}>
            <div className="bq-form-title-row">
              <h2>Seçenekler</h2>
              <button type="button" className="bq-chip-btn" onClick={() => setMenuOpen(false)}>
                ✕ Kapat
              </button>
            </div>
            <div className="bq-menu-group">
              <span className="bq-menu-group-title">Görev</span>
              <button type="button" className="bq-menu-item" data-testid="ws-info-btn" onClick={() => pick(() => setInfoModalOpen(true))}>
                <span aria-hidden="true">ⓘ</span> Görev rehberi ve kurallar
              </button>
              <button type="button" className="bq-menu-item" data-testid="help-btn" onClick={() => pick(() => setHelpOpen(true))}>
                <span aria-hidden="true">📖</span> Revit sözlüğü ve kısayollar
              </button>
              {task.id === 'm01' && (
                <button type="button" className="bq-menu-item" data-testid="start-tour-btn" onClick={() => pick(() => void startMission1Tutorial())}>
                  <span aria-hidden="true">🧭</span> Rehber turu
                </button>
              )}
              <button
                type="button"
                ref={resetTriggerBtnRef}
                className="bq-menu-item bq-menu-danger"
                data-testid="reset-mission-btn"
                onClick={() => pick(() => setResetModalOpen(true))}
              >
                <span aria-hidden="true">↺</span> Görevi sıfırla
              </button>
            </div>
            <div className="bq-menu-group">
              <span className="bq-menu-group-title">Görünüm</span>
              <button type="button" className="bq-menu-item" data-testid="visibility-btn" onClick={() => pick(onOpenVisibility)}>
                <span aria-hidden="true">👁</span> Görünürlük{hiddenCount > 0 ? ` (${hiddenCount})` : ''}
              </button>
              {showLevels && !levelsPrimary && (
                <button type="button" className="bq-menu-item" data-testid="levels-btn" onClick={() => pick(onOpenLevels)}>
                  <span aria-hidden="true">🏢</span> Katlar
                </button>
              )}
            </div>
            <div className="bq-menu-group">
              <span className="bq-menu-group-title">Ayarlar</span>
              <button
                type="button"
                className="bq-menu-item"
                data-testid="sound-toggle-btn"
                onClick={() => {
                  const next = !soundMuted;
                  setSoundMuted(next);
                  setSoundMutedState(next);
                  if (!next) playSound('click');
                }}
              >
                <span aria-hidden="true">{soundMuted ? '🔇' : '🔊'}</span> Ses: {soundMuted ? 'kapalı' : 'açık'}
              </button>
              {onToggleTheme && (
                <button type="button" className="bq-menu-item" data-testid="ws-theme-toggle-btn" onClick={onToggleTheme}>
                  <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span> {theme === 'dark' ? 'Açık tema' : 'Koyu tema'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
  </>
);
};
