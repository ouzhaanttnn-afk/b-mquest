import React, { useState } from 'react';
import {
  alignWallCommand,
  copyWallsToLevelCommand,
  copyWallsCommand,
  mirrorWallsCommand,
  offsetWallCommand,
  type CommandResult,
  type MissionSessionState,
} from '../../domain/commands';
import type { WallElement } from '../../domain/types';

interface ModifySheetProps {
  open: boolean;
  session: MissionSessionState;
  selectedId: string | null;
  applyResult: (res: CommandResult) => void;
  onClose: () => void;
}

type Tab = 'copy' | 'mirror' | 'offset' | 'align' | 'level';

const TABS: Array<{ id: Tab; label: string; hint: string }> = [
  { id: 'copy', label: 'Kopyala', hint: 'Seçili duvarları ve kapı/pencerelerini verilen mesafe kadar kopyala.' },
  { id: 'mirror', label: 'Aynala', hint: 'Seçili duvarları bir eksene göre yansıt; asıllar yerinde kalır.' },
  { id: 'offset', label: 'Öteleme', hint: 'Bir duvarın paralel kopyasını duvar yönünün soluna doğru verilen mesafede oluştur.' },
  { id: 'align', label: 'Hizala', hint: 'Duvarı referans duvarın çizgisine oturt. İkisi de yatay ya da ikisi de düşey olmalı.' },
  { id: 'level', label: 'Kata kopyala', hint: 'Seçili duvarları kapı ve pencereleriyle başka bir kata aynı konumda yapıştır (Paste Aligned to Selected Levels).' },
];

/** Modify tab: Copy, Mirror, Offset, Align on walls. */
export const ModifySheet: React.FC<ModifySheetProps> = ({
  open,
  session,
  selectedId,
  applyResult,
  onClose,
}) => {
  const [tab, setTab] = useState<Tab>('copy');
  const [picked, setPicked] = useState<string[]>([]);
  const [dx, setDx] = useState('0');
  const [dz, setDz] = useState('0');
  const [axis, setAxis] = useState<'x' | 'z'>('x');
  const [at, setAt] = useState('0');
  const [distance, setDistance] = useState('0');
  const [ref, setRef] = useState('');
  const [targetLevel, setTargetLevel] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  if (!open) return null;

  const walls = session.model.elements.filter((e): e is WallElement => e.type === 'wall');
  const effective =
    picked.length > 0 ? picked : selectedId && walls.some((w) => w.id === selectedId) ? [selectedId] : [];
  const single = effective[0] ?? '';
  const refId = ref || walls.find((w) => w.id !== single)?.id || '';

  const toggle = (id: string) => {
    setPicked(() => {
      const base = effective;
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
    setMessage(null);
  };

  const run = () => {
    let res: CommandResult;
    if (tab === 'copy') res = copyWallsCommand(session, effective, dx, dz);
    else if (tab === 'mirror') res = mirrorWallsCommand(session, effective, axis, at);
    else if (tab === 'offset') res = offsetWallCommand(session, single, distance);
    else if (tab === 'level') res = copyWallsToLevelCommand(session, effective, levelTarget);
    else res = alignWallCommand(session, single, refId);
    applyResult(res);
    setMessage(res.ok ? 'Uygulandı.' : res.error.message);
    if (res.ok) setPicked([]);
  };

  const multi = tab === 'copy' || tab === 'mirror' || tab === 'level';
  const levels = session.model.levels;
  const levelTarget = targetLevel || levels.find((l) => !walls.some((w) => effective.includes(w.id) && w.baseLevelId === l.id))?.id || levels[0]?.id || '';

  return (
    <div
      className="bq-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Değiştir"
      data-testid="modify-sheet"
      onClick={onClose}
    >
      <div className="bq-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="bq-form-title-row">
          <h2>Değiştir (Modify)</h2>
          <button type="button" className="bq-chip-btn" onClick={onClose}>
            ✕ Kapat
          </button>
        </div>
        <div className="bq-chapter-pill-bar" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              data-testid={`modify-tab-${t.id}`}
              className={`bq-chip-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => {
                setTab(t.id);
                setMessage(null);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="bq-sched-note">{TABS.find((t) => t.id === tab)?.hint}</p>

        <fieldset className="bq-modify-walls">
          <legend>{multi ? 'Duvarlar (birden fazla seçilebilir)' : 'Duvar'}</legend>
          {walls.map((w) => (
            <label key={w.id} className="bq-modify-wall">
              <input
                type={multi ? 'checkbox' : 'radio'}
                name="modify-wall"
                data-testid={`modify-wall-${w.id}`}
                checked={multi ? effective.includes(w.id) : single === w.id}
                onChange={() => (multi ? toggle(w.id) : setPicked([w.id]))}
              />{' '}
              {w.id} · {levels.length > 1 ? `${levels.find((l) => l.id === w.baseLevelId)?.name ?? w.baseLevelId} · ` : ''}({w.start[0]}, {w.start[1]}) → ({w.end[0]}, {w.end[1]})
            </label>
          ))}
        </fieldset>

        {tab === 'copy' && (
          <div className="bq-modify-row">
            <label className="bq-field"><span>dx (mm)</span>
              <input data-testid="modify-dx" inputMode="numeric" value={dx} onChange={(e) => setDx(e.target.value)} />
            </label>
            <label className="bq-field"><span>dz (mm)</span>
              <input data-testid="modify-dz" inputMode="numeric" value={dz} onChange={(e) => setDz(e.target.value)} />
            </label>
          </div>
        )}
        {tab === 'mirror' && (
          <div className="bq-modify-row">
            <label className="bq-field"><span>Eksen</span>
              <select data-testid="modify-axis" value={axis} onChange={(e) => setAxis(e.target.value as 'x' | 'z')}>
                <option value="x">Düşey çizgi (x = …)</option>
                <option value="z">Yatay çizgi (z = …)</option>
              </select>
            </label>
            <label className="bq-field"><span>Konum (mm)</span>
              <input data-testid="modify-at" inputMode="numeric" value={at} onChange={(e) => setAt(e.target.value)} />
            </label>
          </div>
        )}
        {tab === 'offset' && (
          <div className="bq-modify-row">
            <label className="bq-field"><span>Mesafe (mm)</span>
              <input data-testid="modify-distance" inputMode="numeric" value={distance} onChange={(e) => setDistance(e.target.value)} />
            </label>
          </div>
        )}
        {tab === 'align' && (
          <div className="bq-modify-row">
            <label className="bq-field"><span>Referans duvar</span>
              <select data-testid="modify-ref" value={refId} onChange={(e) => setRef(e.target.value)}>
                {walls.filter((w) => w.id !== single).map((w) => (
                  <option key={w.id} value={w.id}>{w.id}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {tab === 'level' && (
          <div className="bq-modify-row">
            <label className="bq-field"><span>Hedef kat</span>
              <select data-testid="modify-level" value={levelTarget} onChange={(e) => setTargetLevel(e.target.value)}>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} (+{l.elevation})</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {message && (
          <p className="bq-sched-note" role="status" data-testid="modify-message">{message}</p>
        )}
        <div className="bq-modal-actions">
          <button
            type="button"
            className="bq-btn bq-btn-primary"
            data-testid="modify-apply-btn"
            disabled={effective.length === 0}
            onClick={run}
          >
            Uygula
          </button>
        </div>
      </div>
    </div>
  );
};
