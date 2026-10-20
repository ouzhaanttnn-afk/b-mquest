import React, { useState } from 'react';
import {
  addLevelCommand,
  setLevelElevationCommand,
  type CommandResult,
  type MissionSessionState,
} from '../../domain/commands';
import { MmStepperField } from '../MmStepperField';

interface LevelsSheetProps {
  open: boolean;
  session: MissionSessionState;
  activeLevelId: string;
  setActiveLevelId: (id: string) => void;
  applyResult: (res: CommandResult) => void;
  onClose: () => void;
}

/** Project Browser → Levels: pick the active level, edit elevations, add levels. */
export const LevelsSheet: React.FC<LevelsSheetProps> = ({
  open,
  session,
  activeLevelId,
  setActiveLevelId,
  applyResult,
  onClose,
}) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  if (!open) return null;
  const editable = session.task.permissions.editableFields.includes('elevation');
  return (
    <div
      className="bq-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Katlar"
      data-testid="levels-sheet"
      onClick={onClose}
    >
      <div className="bq-modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Katlar (Levels)</h2>
        <ul className="bq-object-items">
          {session.model.levels.map((l) => (
            <li key={l.id}>
              <label className="bq-field">
                <span>
                  <input
                    type="radio"
                    name="active-level"
                    data-testid={`active-level-${l.id}`}
                    checked={activeLevelId === l.id}
                    onChange={() => setActiveLevelId(l.id)}
                  />{' '}
                  {l.name} ({l.id}) · kot mm
                </span>
                <MmStepperField
                  testId={`sheet-level-${l.id}`}
                  draft={drafts[l.id] ?? String(l.elevation)}
                  current={l.elevation}
                  min={0}
                  disabled={!editable}
                  onDraftChange={(v) => setDrafts({ ...drafts, [l.id]: v })}
                  onCommit={(v) => {
                    applyResult(setLevelElevationCommand(session, l.id, v));
                    setDrafts((d) => {
                      const { [l.id]: _drop, ...rest } = d;
                      return rest;
                    });
                  }}
                />
              </label>
            </li>
          ))}
        </ul>
        <div className="bq-modal-actions">
          {editable && (
            <button
              type="button"
              className="bq-btn bq-btn-secondary"
              data-testid="add-level-btn"
              onClick={() => applyResult(addLevelCommand(session))}
            >
              ＋ Kat Ekle
            </button>
          )}
          <button
            type="button"
            className="bq-btn bq-btn-primary"
            data-testid="close-levels-sheet-btn"
            onClick={onClose}
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
