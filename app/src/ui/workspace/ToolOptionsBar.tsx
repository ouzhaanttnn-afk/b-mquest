import React from 'react';
import type { BimModel, StairDirection } from '../../domain/types';
import { TOOL_DEFS, type ToolId } from './toolActions';

export interface ToolOptions {
  winWidth: string;
  winHeight: string;
  winSill: string;
  doorWidth: string;
  doorHeight: string;
  doorSill: string;
  wallHeight: string;
  wallThickness: string;
  slope: string;
  overhang: string;
  risers: string;
  riserHeight: string;
  direction: StairDirection;
  topLevelId: string;
}

export interface ToolOptionsBarProps {
  activeTool: ToolId;
  model: BimModel;
  activeLevelId: string;
  setActiveLevelId: (id: string) => void;
  opts: ToolOptions;
  setOpts: React.Dispatch<React.SetStateAction<ToolOptions>>;
  /** A wall chain / grid line is running. */
  drawing: boolean;
  pickedCount: number;
  onFinish: () => void;
  onCreateFloor: () => void;
  onCreateRoof: () => void;
}

const Num: React.FC<{
  label: string;
  name: keyof ToolOptions;
  opts: ToolOptions;
  setOpts: ToolOptionsBarProps['setOpts'];
}> = ({ label, name, opts, setOpts }) => (
  <label className="bq-tool-opt">
    <span>{label}</span>
    <input
      type="text"
      inputMode="numeric"
      data-testid={`tool-opt-${name}`}
      value={String(opts[name])}
      onChange={(e) => setOpts((o) => ({ ...o, [name]: e.target.value }))}
    />
  </label>
);

/** Options bar shown while a modelling tool is active (like Revit's). */
export const ToolOptionsBar: React.FC<ToolOptionsBarProps> = ({
  activeTool,
  model,
  activeLevelId,
  setActiveLevelId,
  opts,
  setOpts,
  drawing,
  pickedCount,
  onFinish,
  onCreateFloor,
  onCreateRoof,
}) => {
  if (activeTool === 'select') return null;
  const def = TOOL_DEFS.find((t) => t.id === activeTool);
  const levelSelect = (
    value: string,
    onChange: (v: string) => void,
    testId: string,
    label = 'Kat'
  ) => (
    <label className="bq-tool-opt">
      <span>{label}</span>
      <select data-testid={testId} value={value} onChange={(e) => onChange(e.target.value)}>
        {model.levels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name} (+{l.elevation})
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="bq-tool-options" data-testid="tool-options-bar">
      <p className="bq-tool-hint" data-testid="tool-hint">
        <strong>{def?.label}:</strong> {def?.hint}
      </p>
      <div className="bq-tool-opt-row">
        {model.levels.length > 1 &&
          levelSelect(activeLevelId, setActiveLevelId, 'tool-level-select', 'Aktif kat')}

        {activeTool === 'wall' && (
          <>
            <Num label="Yükseklik" name="wallHeight" opts={opts} setOpts={setOpts} />
            <Num label="Kalınlık" name="wallThickness" opts={opts} setOpts={setOpts} />
          </>
        )}
        {activeTool === 'door' && (
          <>
            <Num label="Genişlik" name="doorWidth" opts={opts} setOpts={setOpts} />
            <Num label="Yükseklik" name="doorHeight" opts={opts} setOpts={setOpts} />
            <Num label="Sill" name="doorSill" opts={opts} setOpts={setOpts} />
          </>
        )}
        {activeTool === 'window' && (
          <>
            <Num label="Genişlik" name="winWidth" opts={opts} setOpts={setOpts} />
            <Num label="Yükseklik" name="winHeight" opts={opts} setOpts={setOpts} />
            <Num label="Sill" name="winSill" opts={opts} setOpts={setOpts} />
          </>
        )}
        {activeTool === 'roof' && (
          <>
            <Num label="Eğim °" name="slope" opts={opts} setOpts={setOpts} />
            <Num label="Çıkma" name="overhang" opts={opts} setOpts={setOpts} />
          </>
        )}
        {activeTool === 'stair' && (
          <>
            {levelSelect(opts.topLevelId, (v) => setOpts((o) => ({ ...o, topLevelId: v })), 'tool-top-level-select', 'Üst kat')}
            <label className="bq-tool-opt">
              <span>Yön</span>
              <select
                data-testid="tool-opt-direction"
                value={opts.direction}
                onChange={(e) => setOpts((o) => ({ ...o, direction: e.target.value as StairDirection }))}
              >
                {['x+', 'x-', 'z+', 'z-'].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <Num label="Basamak" name="risers" opts={opts} setOpts={setOpts} />
            <Num label="Yükseklik" name="riserHeight" opts={opts} setOpts={setOpts} />
          </>
        )}

        {(activeTool === 'floor' || activeTool === 'roof') && (
          <button
            type="button"
            className="bq-btn bq-btn-primary bq-btn-compact"
            data-testid={activeTool === 'floor' ? 'tool-create-floor-btn' : 'tool-create-roof-btn'}
            onClick={activeTool === 'floor' ? onCreateFloor : onCreateRoof}
          >
            {activeTool === 'floor' ? 'Döşeme' : 'Çatı'} Oluştur ({pickedCount || 'tüm'} duvar)
          </button>
        )}
        {drawing && (
          <button
            type="button"
            className="bq-btn bq-btn-secondary bq-btn-compact"
            data-testid="tool-finish-btn"
            onClick={onFinish}
          >
            Bitir
          </button>
        )}
      </div>
    </div>
  );
};
