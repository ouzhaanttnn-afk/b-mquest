import React from 'react';
import { summarizeIssues, type ModelIssue } from '../../domain/modelCheck';

interface WarningsSheetProps {
  open: boolean;
  issues: ModelIssue[];
  /** Chapters 6–7: the list stays hidden, only count + category show up. */
  advanced: boolean;
  /** The player has pressed "Kontrol et" at least once. */
  evaluated: boolean;
  onFocus: (elementId: string) => void;
  onClose: () => void;
}

/** Revit-style warnings list as a single bottom sheet. */
export const WarningsSheet: React.FC<WarningsSheetProps> = ({
  open,
  issues,
  advanced,
  evaluated,
  onFocus,
  onClose,
}) => {
  if (!open) return null;
  const sum = summarizeIssues(issues);
  return (
    <div
      className="bq-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Uyarılar"
      data-testid="warnings-sheet"
      onClick={onClose}
    >
      <div className="bq-modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Uyarılar (Warnings)</h2>

        {advanced && !evaluated && (
          <p className="bq-muted-note" data-testid="warnings-hidden">
            Bu bölümde teşhis listesi gizli. "Kontrol et"e bastığında yalnızca
            sorun sayısı ve kategorileri görünür; sorunları kendin bulmalısın.
          </p>
        )}

        {advanced && evaluated && (
          <p data-testid="warnings-count">
            {sum.count === 0
              ? 'Model temiz: sorun bulunmadı.'
              : `${sum.count} sorun · ${sum.categories.join(', ')}`}
          </p>
        )}

        {!advanced && (
          <>
            <p data-testid="warnings-count">
              {sum.count === 0 ? 'Model temiz: sorun bulunmadı.' : `${sum.count} sorun bulundu.`}
            </p>
            <ul className="bq-object-items">
              {issues.map((i, idx) => (
                <li key={`${i.code}-${idx}`}>
                  <button
                    type="button"
                    className={`bq-object-row ${i.severity === 'error' ? 'failed' : ''}`}
                    data-testid={`warning-row-${i.code}`}
                    onClick={() => {
                      if (i.elementIds[0]) onFocus(i.elementIds[0]);
                      onClose();
                    }}
                  >
                    <span className="bq-obj-id">{i.code}</span>
                    <span className="bq-obj-type">{i.message}</span>
                    <span className="bq-obj-meta">{i.revitHint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="bq-modal-actions">
          <button
            type="button"
            className="bq-btn bq-btn-primary"
            data-testid="close-warnings-btn"
            onClick={onClose}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
