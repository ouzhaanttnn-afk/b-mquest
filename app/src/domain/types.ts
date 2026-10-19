export type FireRating = 'none' | 'EI30' | 'EI60';

export type EditableField =
  | 'height'
  | 'thickness'
  | 'name'
  | 'start'
  | 'end'
  | 'baseLevelId'
  | 'offset'
  | 'width'
  | 'sill'
  | 'mark'
  | 'fireRating'
  | 'hostWallId';

export type CreatableElementType = 'wall' | 'door';

export interface Level {
  id: string;
  elevation: number;
  name: string;
}

export interface WallElement {
  id: string;
  type: 'wall';
  name: string;
  baseLevelId: string;
  start: [number, number];
  end: [number, number];
  height: number;
  thickness: number;
}

export interface DoorElement {
  id: string;
  type: 'door';
  name: string;
  hostWallId: string;
  offset: number;
  width: number;
  height: number;
  sill: number;
  mark: string;
  fireRating: FireRating;
}

export type BimElement = WallElement | DoorElement;

export interface BimModel {
  levels: Level[];
  elements: BimElement[];
}

export interface TaskPermissions {
  editableFields: EditableField[];
  creatableTypes: CreatableElementType[];
  deletableCreated: boolean;
  editableSeedIds: string[];
}

export interface TaskHint {
  id: string;
  text: string;
}

export interface CountCriterion {
  id: string;
  type: 'count';
  elementType: CreatableElementType;
  expected: number;
  message: string;
}

export interface PropertyCriterion {
  id: string;
  type: 'property';
  elementId: string;
  field:
    | 'height'
    | 'thickness'
    | 'width'
    | 'offset'
    | 'sill'
    | 'mark'
    | 'fireRating'
    | 'baseLevelId'
    | 'hostWallId';
  expected: number | string;
  tolerance: number;
  message: string;
}

export interface RectangleCriterion {
  id: string;
  type: 'rectangle';
  levelId: string;
  origin: [number, number];
  width: number;
  depth: number;
  wallHeight: number;
  thickness: number;
  tolerance: number;
  message: string;
}

export type TaskCriterion = CountCriterion | PropertyCriterion | RectangleCriterion;

export interface MissionTask {
  schemaVersion: '1.0';
  contentVersion: '1.0.0';
  id: string;
  title: string;
  objective: string;
  prerequisites: string[];
  estimatedMinutes: number;
  initialModel: BimModel;
  permissions: TaskPermissions;
  hints: [TaskHint, TaskHint, TaskHint];
  recap: string;
  criteria: TaskCriterion[];
}

export type BadgeType = 'gold' | 'silver' | 'bronze' | null;

export interface CriterionEvidence {
  id: string;
  pass: boolean;
  actual: unknown;
  expected: unknown;
  tolerance: number;
  message: string;
}

export interface EvaluationResult {
  pass: boolean;
  score: number;
  badge: BadgeType;
  errors: string[];
  criteria: CriterionEvidence[];
}

export interface SubmittedEvaluation extends EvaluationResult {
  evaluatedRevision: number;
  stale: boolean;
}

export interface MissionDraft {
  model: BimModel;
  revealedHints: string[];
}

export interface CompletedMissionRecord {
  bestScore: number;
}

export interface SaveSettings {
  sound: boolean;
  reducedMotion: boolean;
}

export interface SaveEnvelopeV1 {
  saveVersion: 1;
  contentVersion: '1.0.0';
  completed: Record<string, CompletedMissionRecord>;
  drafts: Record<string, MissionDraft>;
  settings: SaveSettings;
}
