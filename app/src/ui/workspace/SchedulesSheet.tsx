import React, { useState } from 'react';
import {
  updateElementProperty,
  type CommandResult,
  type MissionSessionState,
} from '../../domain/commands';
import { roomArea } from '../../domain/derived';
import type { DoorElement, EditableField, RoomElement, WindowElement } from '../../domain/types';

interface SchedulesSheetProps {
  open: boolean;
  session: MissionSessionState;
  applyResult: (res: CommandResult) => void;
  onClose: () => void;
}

type Tab = 'door' | 'window' | 'room';

const TAB_LABEL: Record<Tab, string> = {
  door: 'Kapı Çizelgesi',
  window: 'Pencere Çizelgesi',
  room: 'Oda Çizelgesi',
};

interface CellProps {
  testId: string;
  value: string;
  enabled: boolean;
  onCommit: (v: string) => void;
}

/** One schedule cell: editing it changes the model element, like Revit. */
const Cell: React.FC<CellProps> = ({ testId, value, enabled, onCommit }) => {
  const [draft, setDraft] = useState<string | null>(null);
  if (!enabled) return <span>{value || '—'}</span>;
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <input
      className="bq-sched-input"
      data-testid={testId}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
};

/** Project Browser → Schedules: model data as a table you can edit in place. */
export const SchedulesSheet: React.FC<SchedulesSheetProps> = ({
  open,
  session,
  applyResult,
  onClose,
}) => {
  const [tab, setTab] = useState<Tab>('door');
  if (!open) return null;
  const { model, task } = session;
  const doors = model.elements.filter((e): e is DoorElement => e.type === 'door');
  const windows = model.elements.filter((e): e is WindowElement => e.type === 'window');
  const rooms = model.elements.filter((e): e is RoomElement => e.type === 'room');

  const can = (id: string, field: EditableField) => {
    const isSeed = task.initialModel.elements.some((e) => e.id === id);
    return (
      task.permissions.editableFields.includes(field) &&
      (!isSeed || task.permissions.editableSeedIds.includes(id))
    );
  };
  const edit = (id: string, field: EditableField, v: string) =>
    applyResult(updateElementProperty(session, id, field, v));

  const cell = (id: string, field: EditableField, value: string) => (
    <Cell
      testId={`sched-${id}-${field}`}
      value={value}
      enabled={can(id, field)}
      onCommit={(v) => edit(id, field, v)}
    />
  );

  return (
    <div
      className="bq-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Çizelgeler"
      data-testid="schedules-sheet"
      onClick={onClose}
    >
      <div className="bq-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="bq-form-title-row">
          <h2>Çizelgeler (Schedules)</h2>
          <button type="button" className="bq-chip-btn" onClick={onClose}>
            ✕ Kapat
          </button>
        </div>
        <div className="bq-chapter-pill-bar" role="tablist">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              data-testid={`sched-tab-${t}`}
              className={`bq-chip-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="bq-sched-note">
          Çizelgedeki bir hücreyi değiştirmek modeldeki nesneyi değiştirir. Toplam:{' '}
          <strong data-testid="sched-count">
            {tab === 'door' ? doors.length : tab === 'window' ? windows.length : rooms.length}
          </strong>
        </p>
        <div className="bq-sched-scroll">
          <table className="bq-sched-table">
            {tab === 'door' && (
              <>
                <thead><tr><th>Poz</th><th>Genişlik</th><th>Yükseklik</th><th>Yangın</th><th>Host</th></tr></thead>
                <tbody>
                  {doors.map((d) => (
                    <tr key={d.id} data-testid={`sched-row-${d.id}`}>
                      <td>{cell(d.id, 'mark', d.mark ?? '')}</td>
                      <td>{d.width}</td>
                      <td>{d.height}</td>
                      <td>{cell(d.id, 'fireRating', d.fireRating ?? 'none')}</td>
                      <td>{d.hostWallId}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {tab === 'window' && (
              <>
                <thead><tr><th>Poz</th><th>Genişlik</th><th>Yükseklik</th><th>Parapet</th></tr></thead>
                <tbody>
                  {windows.map((w) => (
                    <tr key={w.id} data-testid={`sched-row-${w.id}`}>
                      <td>{cell(w.id, 'mark', w.mark ?? '')}</td>
                      <td>{w.width}</td>
                      <td>{w.height}</td>
                      <td>{cell(w.id, 'sill', String(w.sill))}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {tab === 'room' && (
              <>
                <thead><tr><th>Numara</th><th>Ad</th><th>Alan (m²)</th></tr></thead>
                <tbody>
                  {rooms.map((r) => (
                    <tr key={r.id} data-testid={`sched-row-${r.id}`}>
                      <td>{cell(r.id, 'number', r.number)}</td>
                      <td>{cell(r.id, 'name', r.name)}</td>
                      <td>{(roomArea(r, model) / 1_000_000).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
