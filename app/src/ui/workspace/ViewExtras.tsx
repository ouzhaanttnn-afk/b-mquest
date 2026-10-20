import React from 'react';
import {
  setCropCommand,
  updateElementProperty,
  type CommandResult,
  type MissionSessionState,
} from '../../domain/commands';
import type { BimElement } from '../../domain/types';

/** Buttons that only make sense for views and sheets. */
export const ViewExtras: React.FC<{
  element: BimElement;
  session: MissionSessionState;
  applyResult: (res: CommandResult) => void;
  onOpenSheet: (id: string) => void;
}> = ({ element, session, applyResult, onOpenSheet }) => {
  if (element.type === 'sheet') {
    return (
      <button
        type="button"
        className="bq-btn bq-btn-secondary bq-btn-compact"
        data-testid="open-sheet-editor-btn"
        onClick={() => onOpenSheet(element.id)}
      >
        Pafta düzenleyiciyi aç
      </button>
    );
  }
  if (element.type !== 'view') return null;
  const cropped = element.cropMinX !== undefined;
  const canCrop = session.task.permissions.editableFields.includes('cropMinX');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {element.kind === 'plan' && (
        <button
          type="button"
          className="bq-chip-btn"
          data-testid="toggle-crop-btn"
          disabled={!canCrop}
          onClick={() => applyResult(setCropCommand(session, element.id, !cropped))}
        >
          {cropped ? 'Kadrajı kapat' : 'Kadrajı aç (Crop Region)'}
        </button>
      )}
      {element.kind === 'section' && (
        <button
          type="button"
          className="bq-chip-btn"
          data-testid="flip-section-btn"
          onClick={() => applyResult(updateElementProperty(session, element.id, 'flip', true))}
        >
          ⇄ Bakış yönünü çevir
        </button>
      )}
    </div>
  );
};
