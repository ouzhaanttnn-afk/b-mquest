import React from 'react';
import { GuideTour } from './GuideTour';
import type { MissionSessionState } from '../../domain/commands';
import type { LearningConceptInfo } from '../../domain/pedagogy';
import type { SubmittedEvaluation, MissionTask } from '../../domain/types';

export interface MissionPanelProps {
  leftCollapsed: boolean;
  mobileDrawerTab: "brief" | "inspector" | "check";
  mobileSheetOpen: boolean;
  setMobileSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLeftCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  task: MissionTask;
  showLearnDetail: boolean;
  setShowLearnDetail: React.Dispatch<React.SetStateAction<boolean>>;
  showRulesDetail: boolean;
  setShowRulesDetail: React.Dispatch<React.SetStateAction<boolean>>;
  liveProgress: { passed: number; total: number; pct: number; allPass: boolean; };
  setInfoModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  learningGuide: LearningConceptInfo;
  setShowMoreLearn: React.Dispatch<React.SetStateAction<boolean>>;
  showMoreLearn: boolean;
  revealedHints: string[];
  onSessionChange: (next: MissionSessionState, passingEvaluation?: SubmittedEvaluation) => void;
  session: MissionSessionState;
  showStepByStepGuide: boolean;
  setShowStepByStepGuide: React.Dispatch<React.SetStateAction<boolean>>;
}

export const MissionPanel: React.FC<MissionPanelProps> = ({
  leftCollapsed,
  mobileDrawerTab,
  mobileSheetOpen,
  setMobileSheetOpen,
  setLeftCollapsed,
  task,
  showLearnDetail,
  setShowLearnDetail,
  showRulesDetail,
  setShowRulesDetail,
  liveProgress,
  setInfoModalOpen,
  learningGuide,
  setShowMoreLearn,
  showMoreLearn,
  revealedHints,
  onSessionChange,
  session,
  showStepByStepGuide,
  setShowStepByStepGuide,
}) => (
  <>
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
        <GuideTour
          revealedHints={revealedHints}
          task={task}
          onSessionChange={onSessionChange}
          session={session}
          learningGuide={learningGuide}
          showStepByStepGuide={showStepByStepGuide}
          setShowStepByStepGuide={setShowStepByStepGuide}
        />
            </div>
          )}
        </aside>
  </>
);
