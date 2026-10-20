import React from 'react';

const STEPS = [-100, -10, 10, 100] as const;

export interface MmStepperFieldProps {
  testId: string;
  /** Text currently shown in the input (draft). */
  draft: string;
  /** Last committed model value, used when the draft is not a number. */
  current: number;
  disabled?: boolean;
  /** Lowest value a stepper press may produce. */
  min?: number;
  onDraftChange: (next: string) => void;
  /** Commit a value (raw draft string on blur/Enter, number on stepper). */
  onCommit: (value: string | number) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Millimetre input with −100 / −10 / +10 / +100 steppers, so a value can be
 * adjusted without opening the keyboard. It never suggests a target value.
 */
export const MmStepperField: React.FC<MmStepperFieldProps> = ({
  testId,
  draft,
  current,
  disabled,
  min = 0,
  onDraftChange,
  onCommit,
  onKeyDown,
}) => {
  const step = (delta: number) => {
    const parsed = Number(draft);
    const base = draft.trim() !== '' && Number.isFinite(parsed) ? parsed : current;
    onCommit(Math.max(min, base + delta));
  };

  return (
    <>
      <div className="bq-input-with-unit">
        <input
          type="text"
          inputMode="numeric"
          data-testid={testId}
          disabled={disabled}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={() => {
            if (!disabled) onCommit(draft);
          }}
          onKeyDown={onKeyDown}
        />
        <span className="bq-unit-tag">mm</span>
      </div>
      {!disabled && (
        <div className="bq-mm-steppers" data-testid={`${testId}-steppers`}>
          {STEPS.map((d) => (
            <button
              key={d}
              type="button"
              className="bq-chip-btn"
              data-testid={`${testId}-step${d > 0 ? '+' : '-'}${Math.abs(d)}`}
              onClick={() => step(d)}
            >
              {d > 0 ? `+${d}` : `−${Math.abs(d)}`}
            </button>
          ))}
        </div>
      )}
    </>
  );
};
