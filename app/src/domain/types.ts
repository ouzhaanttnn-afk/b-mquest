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
  | 'hostWallId'
  | 'topConstraint'
  | 'topOffset'
  | 'typeId'
  | 'levelId'
  | 'slope'
  | 'overhang'
  | 'number'
  | 'risers'
  | 'riserHeight'
  | 'treadDepth'
  | 'topLevelId'
  | 'direction'
  | 'seedPoint'
  | 'elevation'
  | 'footprint'
  | 'typeParams'
  | 'boundary';

export type CreatableElementType =
  | 'wall'
  | 'door'
  | 'window'
  | 'floor'
  | 'roof'
  | 'stair'
  | 'room'
  | 'grid';

export type ElementCategory = CreatableElementType;
export type Point = [number, number];

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
  /** Level id the wall top is attached to; null/undefined = Unconnected. */
  topConstraint?: string | null;
  /** Offset (mm) from the top constraint level. */
  topOffset?: number;
  /** Wall type (Type parameters live on the ElementType). */
  typeId?: string;
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
  typeId?: string;
}

export interface WindowElement {
  id: string;
  type: 'window';
  name: string;
  hostWallId: string;
  offset: number;
  width: number;
  height: number;
  sill: number;
  mark: string;
  typeId?: string;
}

export interface FloorElement {
  id: string;
  type: 'floor';
  name: string;
  levelId: string;
  boundary: Point[];
  thickness: number;
  typeId?: string;
}

export interface RoofElement {
  id: string;
  type: 'roof';
  name: string;
  baseLevelId: string;
  footprint: Point[];
  /** Slope in degrees. */
  slope: number;
  overhang: number;
  typeId?: string;
}

export type StairDirection = 'x+' | 'x-' | 'z+' | 'z-';

export interface StairElement {
  id: string;
  type: 'stair';
  name: string;
  baseLevelId: string;
  topLevelId: string;
  start: Point;
  direction: StairDirection;
  width: number;
  riserHeight: number;
  treadDepth: number;
  risers: number;
}

export interface RoomElement {
  id: string;
  type: 'room';
  name: string;
  number: string;
  levelId: string;
  seedPoint: Point;
}

export interface GridElement {
  id: string;
  type: 'grid';
  name: string;
  start: Point;
  end: Point;
}

export type BimElement =
  | WallElement
  | DoorElement
  | WindowElement
  | FloorElement
  | RoofElement
  | StairElement
  | RoomElement
  | GridElement;

/** Revit Type: shared parameters that drive every instance using it. */
export interface ElementType {
  id: string;
  category: 'wall' | 'door' | 'window' | 'floor' | 'roof';
  family: string;
  name: string;
  params: Record<string, number | string>;
}

export interface BimModel {
  levels: Level[];
  elements: BimElement[];
  types?: ElementType[];
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
    | 'hostWallId'
    | 'topConstraint'
    | 'topOffset'
    | 'typeId'
    | 'levelId'
    | 'slope'
    | 'overhang'
    | 'number'
    | 'risers'
    | 'riserHeight'
    | 'treadDepth'
    | 'topLevelId'
    | 'name'
    | 'direction';
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

export interface ExistsCriterion {
  id: string;
  type: 'exists';
  category: ElementCategory;
  where?: Record<string, number | string>;
  message: string;
}

export interface HostedCriterion {
  id: string;
  type: 'hosted';
  category: 'door' | 'window';
  hostCategory: 'wall';
  min?: number;
  message: string;
}

export interface ConstraintCriterion {
  id: string;
  type: 'constraint';
  elementId?: string;
  topConstraint: string;
  message: string;
}

export interface RoomClosedCriterion {
  id: string;
  type: 'roomClosed';
  roomId?: string;
  message: string;
}

export interface TypeUsageCriterion {
  id: string;
  type: 'typeUsage';
  category: ElementCategory;
  typeId: string;
  count?: number;
  message: string;
}

export interface AllEqualCriterion {
  id: string;
  type: 'allEqual';
  category: ElementCategory;
  field: string;
  message: string;
}

export interface CompareCriterion {
  id: string;
  type: 'compare';
  elementId: string;
  field: string;
  otherElementId: string;
  otherField: string;
  tolerance: number;
  message: string;
}

export type TaskCriterion =
  | CountCriterion
  | PropertyCriterion
  | RectangleCriterion
  | ExistsCriterion
  | HostedCriterion
  | ConstraintCriterion
  | RoomClosedCriterion
  | TypeUsageCriterion
  | AllEqualCriterion
  | CompareCriterion;

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
