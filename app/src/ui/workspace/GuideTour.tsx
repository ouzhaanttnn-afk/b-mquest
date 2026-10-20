import React from 'react';
import type { MissionTask, SubmittedEvaluation } from '../../domain/types';
import type { MissionSessionState } from '../../domain/commands';
import type { LearningConceptInfo } from '../../domain/pedagogy';
import { revealNextHintCommand } from '../../domain/commands';

export interface GuideTourProps {
  revealedHints: string[];
  task: MissionTask;
  onSessionChange: (next: MissionSessionState, passingEvaluation?: SubmittedEvaluation) => void;
  session: MissionSessionState;
  learningGuide: LearningConceptInfo;
  showStepByStepGuide: boolean;
  setShowStepByStepGuide: React.Dispatch<React.SetStateAction<boolean>>;
}

export const GuideTour: React.FC<GuideTourProps> = ({
  revealedHints,
  task,
  onSessionChange,
  session,
  learningGuide,
  showStepByStepGuide,
  setShowStepByStepGuide,
}) => (
  <>
              <div className="bq-hints-section" data-testid="hints-section">
                <div className="bq-hints-header">
                  <h3>Rehber & İpuçları ({revealedHints.length} / 3)</h3>
                  <span className="bq-hint-cost-note">
                    −5 puan / ipucu · Adım adım rehber: en fazla 2 yıldız
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
  </>
);
