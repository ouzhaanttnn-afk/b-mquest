import React, { useState } from 'react';
import {
  createFloorCommand,
  createGridCommand,
  createRoofCommand,
  createRoomCommand,
  createStairCommand,
  createWindowCommand,
  setLevelElevationCommand,
  updateTypeParamCommand,
  type CommandResult,
  type MissionSessionState,
} from '../../domain/commands';
import {
  levelById,
  roomBoundary,
  stairRise,
  wallTopElevation,
} from '../../domain/derived';
import type {
  BimElement,
  BimModel,
  CreatableElementType,
  EditableField,
  ElementType,
  StairDirection,
  WallElement,
} from '../../domain/types';
import { MmStepperField } from '../MmStepperField';

type Drafts = Record<string, string>;

interface FieldProps {
  model: BimModel;
  selectedElement: BimElement;
  editDrafts: Drafts;
  setEditDrafts: (next: Drafts) => void;
  isFieldEditable: (field: EditableField) => boolean;
  commitSingleField: (field: EditableField, raw: unknown) => void;
  handleFieldKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement>,
    fieldKey: string,
    onCommit: () => void
  ) => void;
}

type Kind = 'text' | 'mm' | 'level' | 'wall' | 'type' | 'direction';
interface Spec {
  field: EditableField;
  label: string;
  kind: Kind;
}

const SPECS: Record<string, Spec[]> = {
  window: [
    { field: 'name', label: 'Ad', kind: 'text' },
    { field: 'hostWallId', label: 'Host (Taşıyıcı Duvar)', kind: 'wall' },
    { field: 'offset', label: 'Ofset (mm)', kind: 'mm' },
    { field: 'width', label: 'Genişlik (mm)', kind: 'mm' },
    { field: 'height', label: 'Yükseklik (mm)', kind: 'mm' },
    { field: 'sill', label: 'Parapet / Sill (mm)', kind: 'mm' },
    { field: 'mark', label: 'İşaret (Mark)', kind: 'text' },
    { field: 'typeId', label: 'Tip (Type)', kind: 'type' },
  ],
  floor: [
    { field: 'name', label: 'Ad', kind: 'text' },
    { field: 'levelId', label: 'Kat (Level)', kind: 'level' },
    { field: 'thickness', label: 'Kalınlık (mm)', kind: 'mm' },
    { field: 'typeId', label: 'Tip (Type)', kind: 'type' },
  ],
  roof: [
    { field: 'name', label: 'Ad', kind: 'text' },
    { field: 'baseLevelId', label: 'Taban Katı (Base Level)', kind: 'level' },
    { field: 'slope', label: 'Eğim (derece)', kind: 'mm' },
    { field: 'overhang', label: 'Çıkma / Overhang (mm)', kind: 'mm' },
  ],
  stair: [
    { field: 'name', label: 'Ad', kind: 'text' },
    { field: 'baseLevelId', label: 'Alt Kat (Base Level)', kind: 'level' },
    { field: 'topLevelId', label: 'Üst Kat (Top Level)', kind: 'level' },
    { field: 'direction', label: 'Yön', kind: 'direction' },
    { field: 'width', label: 'Genişlik (mm)', kind: 'mm' },
    { field: 'risers', label: 'Basamak Sayısı (Riser)', kind: 'mm' },
    { field: 'riserHeight', label: 'Yükseklik / Riser (mm)', kind: 'mm' },
    { field: 'treadDepth', label: 'Derinlik / Tread (mm)', kind: 'mm' },
  ],
  room: [
    { field: 'name', label: 'Ad', kind: 'text' },
    { field: 'number', label: 'Numara', kind: 'text' },
    { field: 'levelId', label: 'Kat (Level)', kind: 'level' },
  ],
  grid: [{ field: 'name', label: 'Aks Adı', kind: 'text' }],
  door: [{ field: 'typeId', label: 'Tip (Type)', kind: 'type' }],
};

const MIN: Partial<Record<EditableField, number>> = {
  slope: 0,
  overhang: 0,
  risers: 1,
  riserHeight: 50,
  treadDepth: 100,
  width: 100,
  height: 100,
  thickness: 50,
  offset: 0,
  sill: 0,
};

const numOf = (el: BimElement, f: string): number => {
  const v = (el as unknown as Record<string, unknown>)[f];
  return typeof v === 'number' ? v : 0;
};

const typesFor = (model: BimModel, category: string): ElementType[] =>
  (model.types ?? []).filter((t) => t.category === category);

const FieldRow: React.FC<FieldProps & { spec: Spec }> = ({
  model,
  selectedElement: el,
  editDrafts,
  setEditDrafts,
  isFieldEditable,
  commitSingleField,
  handleFieldKeyDown,
  spec,
}) => {
  const editable = isFieldEditable(spec.field);
  const value = editDrafts[spec.field] ?? '';
  const rec = el as unknown as Record<string, unknown>;

  if (spec.kind === 'mm') {
    return (
      <label className="bq-field">
        <span>{spec.label}</span>
        <MmStepperField
          testId={`prop-input-${spec.field}`}
          draft={value}
          current={numOf(el, spec.field)}
          min={MIN[spec.field] ?? 0}
          disabled={!editable}
          onDraftChange={(v) => setEditDrafts({ ...editDrafts, [spec.field]: v })}
          onCommit={(v) => commitSingleField(spec.field, v)}
          onKeyDown={(e) =>
            handleFieldKeyDown(e, spec.field, () =>
              commitSingleField(spec.field, editDrafts[spec.field])
            )
          }
        />
      </label>
    );
  }

  if (spec.kind === 'text') {
    return (
      <label className="bq-field">
        <span>{spec.label}</span>
        <input
          type="text"
          data-testid={`prop-input-${spec.field}`}
          disabled={!editable}
          value={value}
          onChange={(e) => setEditDrafts({ ...editDrafts, [spec.field]: e.target.value })}
          onBlur={() => editable && commitSingleField(spec.field, value)}
          onKeyDown={(e) =>
            handleFieldKeyDown(e, spec.field, () => commitSingleField(spec.field, value))
          }
        />
      </label>
    );
  }

  const options: Array<{ value: string; label: string }> =
    spec.kind === 'level'
      ? model.levels.map((l) => ({ value: l.id, label: `${l.name} (${l.id} · +${l.elevation} mm)` }))
      : spec.kind === 'wall'
      ? model.elements.filter((w) => w.type === 'wall').map((w) => ({ value: w.id, label: `${w.id} (${w.name})` }))
      : spec.kind === 'direction'
      ? (['x+', 'x-', 'z+', 'z-'] as StairDirection[]).map((d) => ({ value: d, label: d }))
      : [
          { value: '', label: '— Tip yok —' },
          ...typesFor(model, el.type).map((t) => ({ value: t.id, label: `${t.family}: ${t.name}` })),
        ];

  if (spec.kind === 'type' && options.length <= 1) return null;

  return (
    <label className="bq-field">
      <span>{spec.label}</span>
      <select
        data-testid={`prop-input-${spec.field}`}
        disabled={!editable}
        value={String(rec[spec.field] ?? '')}
        onChange={(e) => {
          if (spec.kind === 'type' && e.target.value === '') return;
          commitSingleField(spec.field, e.target.value);
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
};

/** Editor for window / floor / roof / stair / room / grid (and door Type). */
export const GenericElementForm: React.FC<FieldProps> = (props) => {
  const { selectedElement: el, model } = props;
  const specs = SPECS[el.type] ?? [];
  let info: string | null = null;
  if (el.type === 'room') {
    const b = roomBoundary(el, model);
    info = b.open
      ? `Sınır kapalı değil${b.gapAt ? ` · boşluk ≈ (${b.gapAt[0]}, ${b.gapAt[1]})` : ''}`
      : `Alan: ${(b.area / 1_000_000).toFixed(2)} m²`;
  } else if (el.type === 'stair') {
    const lo = levelById(model, el.baseLevelId)?.elevation ?? 0;
    const hi = levelById(model, el.topLevelId)?.elevation ?? 0;
    info = `${el.risers} × ${el.riserHeight} = ${stairRise(el)} mm · kat farkı ${hi - lo} mm`;
  } else if (el.type === 'roof') {
    info = `Taban kotu: +${levelById(model, el.baseLevelId)?.elevation ?? 0} mm`;
  }
  return (
    <div className="bq-prop-form" data-testid={`prop-form-${el.id}`}>
      <div className="bq-revit-type-selector">
        <strong>
          <span data-testid="selected-element-id">{el.id}</span> · {el.type}
        </strong>
      </div>
      {info && (
        <p className="bq-muted-note" data-testid="derived-info">
          {info}
        </p>
      )}
      {specs.map((spec) => (
        <FieldRow key={spec.field} {...props} spec={spec} />
      ))}
    </div>
  );
};

/** Top Constraint / Top Offset / Type for a wall (Instance parameters). */
export const WallRelationFields: React.FC<FieldProps & { wall: WallElement }> = (props) => {
  const { wall, model, isFieldEditable, commitSingleField, editDrafts, setEditDrafts, handleFieldKeyDown } = props;
  const constrained = Boolean(wall.topConstraint);
  return (
    <div className="bq-prop-form" data-testid="wall-relations">
      <label className="bq-field">
        <span>Top Constraint (Üst Kısıt)</span>
        <select
          data-testid="prop-input-topConstraint"
          disabled={!isFieldEditable('topConstraint')}
          value={wall.topConstraint ?? ''}
          onChange={(e) => commitSingleField('topConstraint', e.target.value === '' ? null : e.target.value)}
        >
          <option value="">Unconnected</option>
          {model.levels.map((l) => (
            <option key={l.id} value={l.id}>
              Up to level: {l.name} (+{l.elevation})
            </option>
          ))}
        </select>
      </label>
      {constrained && (
        <label className="bq-field">
          <span>Top Offset (mm)</span>
          <MmStepperField
            testId="prop-input-topOffset"
            draft={editDrafts.topOffset ?? String(wall.topOffset ?? 0)}
            current={wall.topOffset ?? 0}
            min={-20000}
            disabled={!isFieldEditable('topOffset')}
            onDraftChange={(v) => setEditDrafts({ ...editDrafts, topOffset: v })}
            onCommit={(v) => commitSingleField('topOffset', v)}
            onKeyDown={(e) =>
              handleFieldKeyDown(e, 'topOffset', () =>
                commitSingleField('topOffset', editDrafts.topOffset)
              )
            }
          />
        </label>
      )}
      <p className="bq-muted-note" data-testid="wall-top-elevation">
        Üst kot: +{wallTopElevation(wall, model)} mm
      </p>
      <FieldRow {...props} selectedElement={wall} spec={{ field: 'typeId', label: 'Tip (Type)', kind: 'type' }} />
    </div>
  );
};

/** "Edit Type": parameters shared by every instance of the selected Type. */
export const TypePanel: React.FC<{
  model: BimModel;
  selectedElement: BimElement;
  session: MissionSessionState;
  canEditType: boolean;
  applyResult: (res: CommandResult) => void;
}> = ({ model, selectedElement, session, canEditType, applyResult }) => {
  const [open, setOpen] = useState(false);
  const typeId = (selectedElement as { typeId?: string }).typeId;
  const type = typeId ? model.types?.find((t) => t.id === typeId) : undefined;
  if (!type) return null;
  const users = model.elements.filter((e) => (e as { typeId?: string }).typeId === type.id).length;
  return (
    <div className="bq-type-panel" data-testid="type-panel">
      <button
        type="button"
        className="bq-chip-btn"
        data-testid="edit-type-btn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Edit Type · {type.name} ({users} nesne) {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="bq-prop-form" data-testid="type-params">
          <p className="bq-muted-note">
            Type parametresi değişirse bu tipi kullanan tüm nesneler değişir.
          </p>
          {Object.entries(type.params).map(([param, value]) =>
            typeof value === 'number' ? (
              <label className="bq-field" key={param}>
                <span>{param} (mm)</span>
                <MmStepperField
                  testId={`type-param-${param}`}
                  draft={String(value)}
                  current={value}
                  min={1}
                  disabled={!canEditType}
                  onDraftChange={() => undefined}
                  onCommit={(v) => applyResult(updateTypeParamCommand(session, type.id, param, v))}
                />
              </label>
            ) : (
              <p className="bq-muted-note" key={param}>
                {param}: {value}
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
};

/** Level elevations (Project Browser → Levels). */
export const LevelsPanel: React.FC<{
  model: BimModel;
  session: MissionSessionState;
  applyResult: (res: CommandResult) => void;
}> = ({ model, session, applyResult }) => {
  const [drafts, setDrafts] = useState<Drafts>({});
  const editable = session.task.permissions.editableFields.includes('elevation');
  return (
    <div className="bq-levels-panel" data-testid="levels-panel">
      <div className="bq-section-subheader">
        <h3>Katlar (Levels)</h3>
      </div>
      {model.levels.map((l) => (
        <label className="bq-field" key={l.id}>
          <span>
            {l.name} ({l.id}) · kot (mm)
          </span>
          <MmStepperField
            testId={`level-elevation-${l.id}`}
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
      ))}
    </div>
  );
};

const EXTRA_LABEL: Partial<Record<CreatableElementType, string>> = {
  window: '＋ Pencere',
  floor: '＋ Döşeme',
  room: '＋ Oda',
  grid: '＋ Aks',
  roof: '＋ Çatı',
  stair: '＋ Merdiven',
};

const FORM_FIELDS: Record<string, Array<{ key: string; label: string; def: string; kind?: 'level' | 'wall' | 'direction' | 'text' }>> = {
  window: [
    { key: 'hostWallId', label: 'Host duvar', def: '', kind: 'wall' },
    { key: 'offset', label: 'Ofset (mm)', def: '1000' },
    { key: 'width', label: 'Genişlik (mm)', def: '1200' },
    { key: 'height', label: 'Yükseklik (mm)', def: '1200' },
    { key: 'sill', label: 'Sill (mm)', def: '900' },
  ],
  floor: [
    { key: 'levelId', label: 'Kat', def: '', kind: 'level' },
    { key: 'thickness', label: 'Kalınlık (mm)', def: '200' },
  ],
  room: [
    { key: 'levelId', label: 'Kat', def: '', kind: 'level' },
    { key: 'x', label: 'Nokta X (mm)', def: '' },
    { key: 'z', label: 'Nokta Z (mm)', def: '' },
    { key: 'name', label: 'Ad', def: 'Oda', kind: 'text' },
    { key: 'number', label: 'Numara', def: '', kind: 'text' },
  ],
  grid: [
    { key: 'sx', label: 'Başlangıç X', def: '' },
    { key: 'sz', label: 'Başlangıç Z', def: '' },
    { key: 'ex', label: 'Bitiş X', def: '' },
    { key: 'ez', label: 'Bitiş Z', def: '' },
  ],
  roof: [
    { key: 'baseLevelId', label: 'Taban katı', def: '', kind: 'level' },
    { key: 'slope', label: 'Eğim (°)', def: '25' },
    { key: 'overhang', label: 'Çıkma (mm)', def: '500' },
  ],
  stair: [
    { key: 'baseLevelId', label: 'Alt kat', def: '', kind: 'level' },
    { key: 'topLevelId', label: 'Üst kat', def: '', kind: 'level' },
    { key: 'sx', label: 'Başlangıç X', def: '' },
    { key: 'sz', label: 'Başlangıç Z', def: '' },
    { key: 'direction', label: 'Yön', def: 'x+', kind: 'direction' },
    { key: 'risers', label: 'Basamak sayısı', def: '17' },
    { key: 'riserHeight', label: 'Riser (mm)', def: '175' },
  ],
};

/** Compact create forms for the new element kinds. */
export const CreateExtraPanel: React.FC<{
  model: BimModel;
  session: MissionSessionState;
  applyResult: (res: CommandResult) => void;
}> = ({ model, session, applyResult }) => {
  const [open, setOpen] = useState<CreatableElementType | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const creatable = session.task.permissions.creatableTypes.filter((t) => EXTRA_LABEL[t]);
  if (creatable.length === 0) return null;

  const val = (key: string, def: string, kind?: string) => {
    if (form[key] !== undefined) return form[key];
    if (kind === 'level') return model.levels[0]?.id ?? '';
    if (kind === 'wall') return model.elements.find((e) => e.type === 'wall')?.id ?? '';
    return def;
  };

  const submit = (type: CreatableElementType) => {
    const g = (k: string, def = '') => {
      const field = FORM_FIELDS[type].find((f) => f.key === k);
      return val(k, field?.def ?? def, field?.kind);
    };
    const pt = (a: string, b: string): [number, number] => [Number(g(a)), Number(g(b))];
    let res: CommandResult;
    if (type === 'window') {
      res = createWindowCommand(session, {
        hostWallId: g('hostWallId'),
        offset: g('offset'),
        width: g('width'),
        height: g('height'),
        sill: g('sill'),
      });
    } else if (type === 'floor') {
      res = createFloorCommand(session, { levelId: g('levelId'), thickness: Number(g('thickness')) });
    } else if (type === 'room') {
      res = createRoomCommand(session, { levelId: g('levelId'), seedPoint: pt('x', 'z'), name: g('name'), number: g('number') });
    } else if (type === 'grid') {
      res = createGridCommand(session, { start: pt('sx', 'sz'), end: pt('ex', 'ez') });
    } else if (type === 'roof') {
      res = createRoofCommand(session, { baseLevelId: g('baseLevelId'), slope: Number(g('slope')), overhang: Number(g('overhang')) });
    } else {
      res = createStairCommand(session, {
        baseLevelId: g('baseLevelId'),
        topLevelId: g('topLevelId') || model.levels[model.levels.length - 1]?.id,
        start: pt('sx', 'sz'),
        direction: g('direction', 'x+') as StairDirection,
        risers: Number(g('risers')),
        riserHeight: Number(g('riserHeight')),
      });
    }
    applyResult(res);
    if (res.ok) {
      setOpen(null);
      setForm({});
    }
  };

  return (
    <div className="bq-create-extra" data-testid="create-extra-panel">
      <div className="bq-quick-steppers-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {creatable.map((t) => (
          <button
            key={t}
            type="button"
            className={`bq-chip-btn ${open === t ? 'active' : ''}`}
            data-testid={`create-${t}-btn`}
            onClick={() => {
              setOpen(open === t ? null : t);
              setForm({});
            }}
          >
            {EXTRA_LABEL[t]}
          </button>
        ))}
      </div>
      {open && (
        <form
          className="bq-prop-form"
          data-testid={`create-${open}-form`}
          onSubmit={(e) => {
            e.preventDefault();
            submit(open);
          }}
        >
          {FORM_FIELDS[open].map((f) => {
            const v = val(f.key, f.def, f.kind);
            return (
              <label className="bq-field" key={f.key}>
                <span>{f.label}</span>
                {f.kind === 'level' || f.kind === 'wall' || f.kind === 'direction' ? (
                  <select
                    data-testid={`create-${open}-${f.key}`}
                    value={v}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  >
                    {(f.kind === 'level'
                      ? model.levels.map((l) => [l.id, `${l.name} (+${l.elevation})`])
                      : f.kind === 'wall'
                      ? model.elements.filter((e) => e.type === 'wall').map((w) => [w.id, `${w.id} (${w.name})`])
                      : ['x+', 'x-', 'z+', 'z-'].map((d) => [d, d])
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    inputMode={f.kind === 'text' ? 'text' : 'numeric'}
                    data-testid={`create-${open}-${f.key}`}
                    value={v}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                )}
              </label>
            );
          })}
          <button type="submit" className="bq-btn bq-btn-primary bq-btn-compact" data-testid={`create-${open}-submit`}>
            Oluştur
          </button>
        </form>
      )}
    </div>
  );
};

export { levelById };
