import { createInitialSession, type CommandResult, type MissionSessionState } from '../domain/commands';
import { commitModelTransaction } from '../domain/commandCore';
import { addLevelOp, setLevelElevationOp } from '../domain/modelOps';
import type { BimModel, MissionTask, Point } from '../domain/types';
import type { Text } from './i18n';

/**
 * Shared shape of the house-by-house campaign. Every house is a list of short
 * levels; every level teaches one Revit command family through a few steps.
 * Revit menu paths follow the English UI (Revit 2022 and later).
 */

export type CommandId =
  | 'level'
  | 'grid'
  | 'wall'
  | 'door'
  | 'window'
  | 'floor'
  | 'roof'
  | 'stair'
  | 'room'
  | 'tag'
  | 'section'
  | 'paste';

export type RibbonTab = 'architecture' | 'annotate' | 'view' | 'modify';

export interface RibbonCommand {
  id: CommandId;
  /** Name as on Revit's ribbon. */
  label: string;
  tab: RibbonTab;
  panel: string;
  path: string;
  shortcut?: string;
}

export const RIBBON_TABS: RibbonTab[] = ['architecture', 'annotate', 'view', 'modify'];

export const RIBBON: RibbonCommand[] = [
  { id: 'wall', label: 'Wall', tab: 'architecture', panel: 'Build', path: 'Architecture › Build › Wall', shortcut: 'WA' },
  { id: 'door', label: 'Door', tab: 'architecture', panel: 'Build', path: 'Architecture › Build › Door', shortcut: 'DR' },
  { id: 'window', label: 'Window', tab: 'architecture', panel: 'Build', path: 'Architecture › Build › Window', shortcut: 'WN' },
  { id: 'floor', label: 'Floor', tab: 'architecture', panel: 'Build', path: 'Architecture › Build › Floor', shortcut: 'SB' },
  { id: 'roof', label: 'Roof', tab: 'architecture', panel: 'Build', path: 'Architecture › Build › Roof › Roof by Footprint' },
  { id: 'stair', label: 'Stair', tab: 'architecture', panel: 'Circulation', path: 'Architecture › Circulation › Stair' },
  { id: 'room', label: 'Room', tab: 'architecture', panel: 'Room & Area', path: 'Architecture › Room & Area › Room', shortcut: 'RM' },
  { id: 'level', label: 'Level', tab: 'architecture', panel: 'Datum', path: 'Architecture › Datum › Level', shortcut: 'LL' },
  { id: 'grid', label: 'Grid', tab: 'architecture', panel: 'Datum', path: 'Architecture › Datum › Grid', shortcut: 'GR' },
  { id: 'tag', label: 'Tag by Category', tab: 'annotate', panel: 'Tag', path: 'Annotate › Tag › Tag by Category', shortcut: 'TG' },
  { id: 'section', label: 'Section', tab: 'view', panel: 'Create', path: 'View › Create › Section' },
  {
    id: 'paste',
    label: 'Paste Aligned',
    tab: 'modify',
    panel: 'Clipboard',
    path: 'Modify › Clipboard › Paste › Aligned to Selected Levels',
  },
];

export const commandById = (id: CommandId) => RIBBON.find((c) => c.id === id)!;

export type Ghost =
  | { kind: 'line'; a: Point; b: Point; label?: string }
  | { kind: 'opening'; a: Point; b: Point; label?: string }
  | { kind: 'area'; points: Point[]; label?: string }
  | { kind: 'elevation'; at: number; label?: string };

export interface StepDef {
  id: string;
  command: CommandId;
  goal: Text;
  ghost: Ghost[];
  /** Points the demo finger moves through (plan mm, or [0, elevation] on the elevation view). */
  demo: Point[];
  done: (m: BimModel) => boolean;
  /** Reference solution; builds the start model of later levels and is used by tests. */
  solve: (s: MissionSessionState) => MissionSessionState;
  /** Fewest taps that finish the step. */
  taps: number;
  /** Plan level the step works on (default: ground floor 'l0'). */
  on?: string;
  /** Level step: the levels to place, bottom to top. */
  levels?: Array<{ at: number; name: string }>;
  /** Stair step: where the stair should start; taps near it snap onto it. */
  magnet?: Point;
  /** Paste step: the level the walls come from. */
  from?: string;
}

export interface HouseGeom {
  w: number;
  d: number;
  wallH: number;
}

export interface LevelDef {
  id: string;
  number: number;
  title: Text;
  why: Text;
  bridge: Text;
  view: 'plan' | 'elevation';
  steps: StepDef[];
  /** Tap allowance for the third star. */
  par: number;
  geom: HouseGeom;
  /** Shown on the level-complete card as the reward picture. */
  reveal?: 'section';
}

export interface HouseDef {
  id: string;
  title: Text;
  brief: Text;
  levels: LevelDef[];
  /** Names offered when a room is tagged. */
  nameChoices: string[];
}

/** Every permission the campaign needs; the model is carried level to level. */
export const CAMPAIGN_TASK: MissionTask = {
  schemaVersion: '1.0',
  contentVersion: '1.0.0',
  id: 'kampanya',
  title: 'Ev',
  objective: 'Ev',
  prerequisites: [],
  estimatedMinutes: 30,
  initialModel: { levels: [{ id: 'l0', name: 'Zemin Kat', elevation: 0 }], elements: [] },
  permissions: {
    editableFields: ['elevation', 'name', 'number', 'typeParams'],
    creatableTypes: ['wall', 'door', 'window', 'floor', 'roof', 'room', 'grid', 'tag', 'stair', 'view'],
    deletableCreated: true,
    editableSeedIds: [],
  },
  hints: [
    { id: 'h1', text: '-' },
    { id: 'h2', text: '-' },
    { id: 'h3', text: '-' },
  ],
  recap: 'Ev',
  criteria: [{ id: 'c_any', type: 'metric', metric: 'levelCount', min: 1, max: 99, message: '-' }],
};

export function sessionFor(model: BimModel): MissionSessionState {
  return createInitialSession(CAMPAIGN_TASK, { model, revealedHints: [] });
}

/** Model at the start of a level: the reference solution of every earlier step. */
export function startModelFor(house: HouseDef, levelIndex: number): BimModel {
  let s = createInitialSession(CAMPAIGN_TASK);
  for (let i = 0; i < levelIndex; i++) for (const st of house.levels[i].steps) s = st.solve(s);
  return s.model;
}

/** Applies a command result inside a reference solution; a failure is a bug in the level. */
export const step = (_s: MissionSessionState, r: CommandResult): MissionSessionState => {
  if (!r.ok) throw new Error(`campaign solve: ${r.error.code} ${r.error.message}`);
  return r.state;
};

export const roofLevelId = (m: BimModel) =>
  [...m.levels].sort((a, b) => b.elevation - a.elevation)[0]?.id ?? 'l0';

export const levelName = (m: BimModel, id: string) => m.levels.find((l) => l.id === id)?.name ?? id;

/**
 * A tap on the elevation with the Level tool. Adds the next level until the
 * step has as many as it asks for; after that, moves the first level that is
 * not where it should be. Levels are named bottom to top from the step.
 */
export function levelTap(s: MissionSessionState, elevation: number, targets: Array<{ at: number; name: string }>): CommandResult {
  let m = s.model;
  if (m.levels.some((l) => l.elevation === elevation)) {
    return { ok: false, state: s, error: { code: 'E_LEVEL_TAKEN', message: 'Bu kotta zaten bir kat var.' } };
  }
  const placed = m.levels.filter((l) => l.id !== 'l0');
  let id: string;
  if (placed.length < targets.length) {
    const add = addLevelOp(m);
    if (!add.ok) return { ok: false, state: s, error: add.error };
    m = add.model;
    id = add.createdId!;
  } else {
    const wanted = new Set(targets.map((t) => t.at));
    const wrong = placed.find((l) => !wanted.has(l.elevation)) ?? placed[placed.length - 1];
    id = wrong.id;
  }
  const moved = setLevelElevationOp(m, id, elevation);
  if (!moved.ok) return { ok: false, state: s, error: moved.error };
  m = moved.model;
  const order = m.levels.filter((l) => l.id !== 'l0').sort((a, b) => a.elevation - b.elevation).map((l) => l.id);
  m = { ...m, levels: m.levels.map((l) => (l.id === 'l0' ? l : { ...l, name: targets[order.indexOf(l.id)]?.name ?? l.name })) };
  return commitModelTransaction(s, m);
}
