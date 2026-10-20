import React from 'react';
import { elementIcon, elementMetaTr } from './elementLabels';
import type { MissionSessionState } from '../../domain/commands';
import type { LearningConceptInfo } from '../../domain/pedagogy';
import type { BimElement, EditableField } from '../../domain/types';
import { getWallLengthMm } from '../../plan/geometry';

export interface GameDockProps {
  selectedElement: BimElement | null;
  isFieldEditable: (field: EditableField) => boolean;
  commitSingleField: (field: EditableField, rawValue: unknown) => void;
  canDeleteSelected: boolean;
  setMobileDrawerTab: React.Dispatch<React.SetStateAction<"brief" | "inspector" | "check">>;
  setMobileSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRightCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  handleSelectElement: (id: string | null) => void;
  liveProgress: { passed: number; total: number; pct: number; allPass: boolean; };
  learningGuide: LearningConceptInfo;
  session: MissionSessionState;
  parMoves: 1 | 2;
}

export const GameDock: React.FC<GameDockProps> = ({
  selectedElement,
  isFieldEditable,
  commitSingleField,
  canDeleteSelected,
  setMobileDrawerTab,
  setMobileSheetOpen,
  setRightCollapsed,
  handleSelectElement,
  liveProgress,
  learningGuide,
  session,
  parMoves,
}) => (
  <>
          <div className="bq-game-dock" data-testid="game-dock">
            {selectedElement ? (
              <div className="bq-quick-hud" data-testid="quick-action-hud">
                <div className="bq-quick-hud-info">
                  <span className="bq-quick-hud-badge">
                    {elementIcon(selectedElement)}{' '}
                    {selectedElement.id}
                  </span>
                  <strong className="bq-quick-hud-name">
                    {selectedElement.name}
                  </strong>
                  <span className="bq-quick-hud-meta">
                    {selectedElement.type === 'wall'
                      ? `U:${getWallLengthMm(selectedElement)} · ${elementMetaTr(selectedElement)}`
                      : elementMetaTr(selectedElement)}
                  </span>
                </div>

                <div className="bq-quick-hud-actions">
                  {selectedElement.type === 'wall' &&
                    isFieldEditable('height') && (
                      <>
                        
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
  </>
);
