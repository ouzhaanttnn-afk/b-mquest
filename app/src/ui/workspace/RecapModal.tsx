import React from 'react';
import type { MissionSessionState } from '../../domain/commands';
import type { LearningConceptInfo } from '../../domain/pedagogy';
import type { SubmittedEvaluation, MissionTask } from '../../domain/types';
import { calculateMissionXp } from '../../domain/pedagogy';
import { badgeLabelTr } from './format';
import { resetMissionSession } from '../../domain/commands';

export interface RecapModalProps {
  recapModalOpen: boolean;
  lastEvaluation: SubmittedEvaluation | null;
  reducedMotion: boolean;
  task: MissionTask;
  session: MissionSessionState;
  parMoves: 1 | 2;
  revealedHints: string[];
  learningGuide: LearningConceptInfo;
  setRecapModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onResetDraftConfirmed: (resetSession: MissionSessionState) => void;
  onBackToDashboard: () => void;
  nextMission: MissionTask | null;
  onGoToNextMission: (nextMissionId: string) => void;
}

export const RecapModal: React.FC<RecapModalProps> = ({
  recapModalOpen,
  lastEvaluation,
  reducedMotion,
  task,
  session,
  parMoves,
  revealedHints,
  learningGuide,
  setRecapModalOpen,
  onResetDraftConfirmed,
  onBackToDashboard,
  nextMission,
  onGoToNextMission,
}) => (
  <>
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
  </>
);
