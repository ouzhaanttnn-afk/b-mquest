import React from 'react';
import type { LearningConceptInfo } from '../../domain/pedagogy';
import type { MissionTask } from '../../domain/types';

export interface InfoModalProps {
  infoModalOpen: boolean;
  setInfoModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  task: MissionTask;
  learningGuide: LearningConceptInfo;
  liveProgress: { passed: number; total: number; pct: number; allPass: boolean; };
}

export const InfoModal: React.FC<InfoModalProps> = ({
  infoModalOpen,
  setInfoModalOpen,
  task,
  learningGuide,
  liveProgress,
}) => (
  <>
      {/* ⓘ MISSION INFO & INTERACTIVE BIM GUIDE MODAL */}
      {infoModalOpen && (
        <div
          className="bq-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ws-info-dialog-title"
          data-testid="ws-info-modal"
          onClick={() => setInfoModalOpen(false)}
        >
          <div
            className="bq-modal-card bq-recap-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bq-recap-header">
              <span className="bq-recap-kicker">
                ⓘ MİMARİ BIM KILAVUZU · {task.id.toUpperCase()}
              </span>
              <h2 id="ws-info-dialog-title">{task.title}</h2>
            </div>

            <div className="bq-info-modal-grid">
              <div className="bq-info-step-card">
                <strong>1. Bu İşlem Nedir?</strong>
                <p>{learningGuide.whatIsIt}</p>
              </div>
              <div className="bq-info-step-card">
                <strong>2. Neden Kullanılır?</strong>
                <p>{learningGuide.whyUsed}</p>
              </div>
              <div className="bq-info-step-card">
                <strong>3. Nasıl Uygulanır?</strong>
                <p>{learningGuide.actionSummary}</p>
              </div>
            </div>

            <div className="bq-target-box" style={{ marginTop: '0.85rem' }}>
              <h3>
                Anlık Görev Durumu ({liveProgress.passed}/{liveProgress.total}{' '}
                Kural Tamamlandı — %{liveProgress.pct})
              </h3>
              <ul className="bq-criteria-preview-list">
                {task.criteria.map((c) => (
                  <li key={c.id}>
                    <code>{c.id}</code>: {c.message}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bq-modal-actions" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="bq-btn bq-btn-primary"
                data-testid="close-ws-info-modal-btn"
                onClick={() => setInfoModalOpen(false)}
              >
                Anladım, Modele Dön
              </button>
            </div>
          </div>
        </div>
      )}
  </>
);
