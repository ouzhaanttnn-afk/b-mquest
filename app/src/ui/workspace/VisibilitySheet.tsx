import React from 'react';
import { VG_CATEGORIES } from '../../domain/viewFilter';
import type { BimModel } from '../../domain/types';

interface VisibilitySheetProps {
  open: boolean;
  model: BimModel;
  hidden: ReadonlySet<string>;
  onToggle: (category: string) => void;
  onShowAll: () => void;
  onClose: () => void;
}

/** Visibility/Graphics: switch whole categories on or off in the views. */
export const VisibilitySheet: React.FC<VisibilitySheetProps> = ({
  open,
  model,
  hidden,
  onToggle,
  onShowAll,
  onClose,
}) => {
  if (!open) return null;
  const present = VG_CATEGORIES.filter((c) => model.elements.some((e) => e.type === c.id));
  return (
    <div
      className="bq-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Görünürlük"
      data-testid="visibility-sheet"
      onClick={onClose}
    >
      <div className="bq-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="bq-form-title-row">
          <h2>Görünürlük (Visibility/Graphics)</h2>
          <button type="button" className="bq-chip-btn" onClick={onClose}>
            ✕ Kapat
          </button>
        </div>
        <p className="bq-sched-note">
          Kategoriyi kapatmak yalnızca görünümü etkiler; model ve kontrol aynı kalır. Duvarlar kapanınca kapı ve pencereler de gizlenir.
        </p>
        <ul className="bq-object-items">
          {present.map((c) => (
            <li key={c.id}>
              <label className="bq-modify-wall">
                <input
                  type="checkbox"
                  data-testid={`vg-${c.id}`}
                  checked={!hidden.has(c.id)}
                  onChange={() => onToggle(c.id)}
                />{' '}
                {c.label}
              </label>
            </li>
          ))}
        </ul>
        <div className="bq-modal-actions">
          <button type="button" className="bq-btn bq-btn-secondary" data-testid="vg-show-all" onClick={onShowAll}>
            Hepsini göster
          </button>
        </div>
      </div>
    </div>
  );
};
