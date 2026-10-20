import React from 'react';
import type { SubmittedEvaluation, MissionTask, BimModel } from '../../domain/types';
import { calculateMissionXp, explainCriterionFailureTr } from '../../domain/pedagogy';
import { badgeLabelTr, formatCriterionEvidenceTr } from './format';

export interface CheckFeedbackProps {
  mobileDrawerTab: "brief" | "inspector" | "check";
  mobileSheetOpen: boolean;
  handleRunCheck: () => void;
  setMobileSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  lastEvaluation: SubmittedEvaluation | null;
  statusToast: string | null;
  setRecapModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleCriterionClick: (criterionId: string) => void;
  task: MissionTask;
  model: BimModel;
}

export const CheckFeedback: React.FC<CheckFeedbackProps> = ({
  mobileDrawerTab,
  mobileSheetOpen,
  handleRunCheck,
  setMobileSheetOpen,
  lastEvaluation,
  statusToast,
  setRecapModalOpen,
  handleCriterionClick,
  task,
  model,
}) => (
  <>
      <footer
        className={`bq-ws-bottombar ${
          mobileDrawerTab === 'check' ? 'mobile-active' : ''
        } ${mobileDrawerTab === 'check' && mobileSheetOpen ? 'sheet-open' : ''}`}
        aria-label="Kontrol ve Geri Bildirim Paneli"
      >
        <div className="bq-check-row">
          <button
            type="button"
            className="bq-btn bq-btn-primary bq-btn-check"
            data-testid="check-btn"
            onClick={() => {
              handleRunCheck();
              setMobileSheetOpen(true);
            }}
          >
            <svg width="20" height="20" aria-hidden="true">
              <use href="./assets/ui/icons.svg#check" />
            </svg>
            <span>Kontrol et</span>
          </button>

          <div
            className="bq-check-status"
            aria-live="polite"
            data-testid="evaluation-summary"
          >
            {!lastEvaluation ? (
              <span>
                Değişiklikleri tamamladığınızda <strong>Kontrol et</strong>{' '}
                düğmesine basın.{statusToast ? ` (${statusToast})` : ''}
              </span>
            ) : lastEvaluation.stale ? (
              <span
                className="bq-stale-warning"
                data-testid="stale-result-banner"
              >
                ⚠️ Model değişti; yeniden kontrol et.
              </span>
            ) : lastEvaluation.pass ? (
              <span className="bq-pass-summary" data-testid="pass-summary-text">
                ✓ Başarılı! Puan: <strong>{lastEvaluation.score}</strong> ·{' '}
                <strong>+{calculateMissionXp(lastEvaluation.score)} XP</strong> ·{' '}
                <strong>{badgeLabelTr(lastEvaluation.badge)}</strong> (
                {lastEvaluation.criteria.filter((c) => c.pass).length}/
                {lastEvaluation.criteria.length} kural geçti)
              </span>
            ) : (
              <span className="bq-fail-summary" data-testid="fail-summary-text">
                ✕ Kontrol tamamlanmadı: Puan {lastEvaluation.score} (
                {lastEvaluation.criteria.filter((c) => c.pass).length}/
                {lastEvaluation.criteria.length} kural geçti). Aşağıdaki tanılayıcı
                geri bildirimleri inceleyip düzeltin.
              </span>
            )}
          </div>

          {lastEvaluation && lastEvaluation.pass && !lastEvaluation.stale && (
            <button
              type="button"
              className="bq-btn bq-btn-secondary bq-btn-compact"
              data-testid="open-recap-btn"
              onClick={() => setRecapModalOpen(true)}
            >
              Sonuç Özeti & Sonraki Görev →
            </button>
          )}
          <button
            type="button"
            className="bq-btn bq-btn-secondary bq-btn-compact bq-mobile-close-sheet-btn"
            onClick={() => setMobileSheetOpen(false)}
          >
            ✕ Sahneyi Gör
          </button>
        </div>

        {/* Detailed Criterion Results List with Actionable Remediation */}
        {lastEvaluation && (
          <div
            className="bq-criteria-results"
            data-testid="criteria-results-list"
          >
            {lastEvaluation.errors.length > 0 && (
              <div className="bq-integrity-errors" role="alert">
                <strong>Model Bütünlük / İzin Hataları:</strong>{' '}
                {lastEvaluation.errors.join(', ')}
              </div>
            )}

            <ul className="bq-criteria-items">
              {lastEvaluation.criteria.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`bq-criterion-row ${c.pass ? 'pass' : 'fail'}`}
                    data-testid={`criterion-row-${c.id}`}
                    onClick={() => handleCriterionClick(c.id)}
                  >
                    <span className="bq-crit-badge">
                      {c.pass ? '✓ Geçti' : '✕ Hata'}
                    </span>
                    <span className="bq-crit-id">{c.id}</span>
                    <span className="bq-crit-msg">{c.message}</span>
                    <span className="bq-crit-evidence">
                      {formatCriterionEvidenceTr(c)}
                    </span>
                    {!c.pass && (
                      <span
                        className="bq-crit-remediation"
                        data-testid={`criterion-remediation-${c.id}`}
                      >
                        💡 {explainCriterionFailureTr(task, model, c)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </footer>
  </>
);
