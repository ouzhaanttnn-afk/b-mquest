import React, { useMemo, useState } from 'react';
import { buildGlossary, searchGlossary, shortcutList } from '../content/glossary';
import { playSound } from './sound';

/** Help button plus sheet: Revit glossary search and the keyboard shortcut card. */
export const HelpSheet: React.FC<{
  className?: string;
  /** Controlled use (e.g. opened from a menu): no trigger button is rendered. */
  open?: boolean;
  onClose?: () => void;
}> = ({ className = 'bq-icon-pill-btn', open: controlledOpen, onClose }) => {
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : ownOpen;
  const setOpen = (v: boolean) => {
    if (controlled) {
      if (!v) onClose?.();
    } else {
      setOwnOpen(v);
    }
  };
  const [tab, setTab] = useState<'glossary' | 'keys'>('glossary');
  const [query, setQuery] = useState('');
  const entries = useMemo(() => buildGlossary(), []);
  const shortcuts = useMemo(() => shortcutList(), []);
  const hits = useMemo(() => searchGlossary(entries, query), [entries, query]);

  return (
    <>
      {!controlled && (
      <button
        type="button"
        className={className}
        data-testid="help-btn"
        aria-label="Yardım ve Revit sözlüğü"
        title="Yardım ve Revit sözlüğü"
        onClick={() => {
          playSound('click');
          setOpen(true);
        }}
      >
        <span>📖</span>
      </button>
      )}
      {open && (
        <div
          className="bq-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Yardım"
          data-testid="help-sheet"
          onClick={() => setOpen(false)}
        >
          <div className="bq-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="bq-form-title-row">
              <h2>Yardım</h2>
              <button type="button" className="bq-chip-btn" onClick={() => setOpen(false)}>
                ✕ Kapat
              </button>
            </div>
            <div className="bq-chapter-pill-bar" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'glossary'}
                data-testid="help-tab-glossary"
                className={`bq-chip-btn ${tab === 'glossary' ? 'active' : ''}`}
                onClick={() => setTab('glossary')}
              >
                Revit sözlüğü
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'keys'}
                data-testid="help-tab-keys"
                className={`bq-chip-btn ${tab === 'keys' ? 'active' : ''}`}
                onClick={() => setTab('keys')}
              >
                Kısayollar
              </button>
            </div>

            {tab === 'glossary' ? (
              <>
                <input
                  type="search"
                  className="bq-help-search"
                  data-testid="help-search"
                  placeholder="Kavram ara: Level, host, tip, kesit…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Kavram ara"
                />
                <p className="bq-sched-note" data-testid="help-count">
                  {hits.length} sonuç
                </p>
                <ul className="bq-help-list">
                  {hits.map((h) => (
                    <li key={h.id} data-testid={`help-entry-${h.id}`}>
                      <strong>{h.concept}</strong>
                      <span className="bq-help-mission">
                        {h.missionId ? `${h.missionId.toUpperCase()} · ${h.title}` : `Kavram · Kaynak: ${h.source ?? ''}`}
                      </span>
                      <p>{h.explanation}</p>
                      {h.revitPath && <code>{h.revitPath}</code>}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="bq-sched-note">
                  Gerçek Revit’te iki harfi art arda yaz (ör. W sonra A). Oyunda da aynı çalışır; görev o aracı serbest bırakmışsa.
                </p>
                <table className="bq-sched-table" data-testid="help-shortcuts">
                  <thead>
                    <tr><th>Kısayol</th><th>Araç</th><th>Sekme</th></tr>
                  </thead>
                  <tbody>
                    {shortcuts.map((s) => (
                      <tr key={s.keys}>
                        <td><kbd className="bq-kbd">{s.keys}</kbd></td>
                        <td>{s.label}</td>
                        <td>{s.group}</td>
                      </tr>
                    ))}
                    <tr><td><kbd className="bq-kbd">Esc</kbd></td><td>Seç (aracı bırak)</td><td>Genel</td></tr>
                    <tr><td><kbd className="bq-kbd">Ctrl+Z</kbd></td><td>Geri al</td><td>Genel</td></tr>
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
