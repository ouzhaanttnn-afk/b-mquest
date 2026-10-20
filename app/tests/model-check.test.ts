import { describe, expect, it } from 'vitest';
import { loadValidatedCatalog } from '../src/content/content';
import {
  createInitialSession,
  updateElementProperty,
  type CommandResult,
  type MissionSessionState,
} from '../src/domain/commands';
import { enclosedRegions } from '../src/domain/derived';
import { evaluate } from '../src/domain/evaluator';
import { checkModel, summarizeIssues, type ModelIssueCode } from '../src/domain/modelCheck';
import { explainCriterionFailureTr } from '../src/domain/pedagogy';
import type { BimModel, WallElement } from '../src/domain/types';

const wall = (
  id: string,
  start: [number, number],
  end: [number, number],
  extra: Partial<WallElement> = {}
): WallElement => ({
  id, type: 'wall', name: id, baseLevelId: 'l0', start, end, height: 3000, thickness: 200, ...extra,
});

const box = (): WallElement[] => [
  wall('w1', [0, 0], [6000, 0]),
  wall('w2', [6000, 0], [6000, 4000]),
  wall('w3', [6000, 4000], [0, 4000]),
  wall('w4', [0, 4000], [0, 0]),
];

const base = (): BimModel => ({
  levels: [{ id: 'l0', elevation: 0, name: 'Zemin' }, { id: 'l1', elevation: 3000, name: 'Kat 1' }],
  elements: [
    ...box(),
    { id: 'r1', type: 'room', name: 'Salon', number: '101', levelId: 'l0', seedPoint: [3000, 2000] },
    { id: 'win1', type: 'window', name: 'W', hostWallId: 'w1', offset: 500, width: 1200, height: 1200, sill: 900, mark: 'W-1' },
    { id: 'win2', type: 'window', name: 'W', hostWallId: 'w1', offset: 2500, width: 1200, height: 1200, sill: 900, mark: 'W-2' },
    { id: 'win3', type: 'window', name: 'W', hostWallId: 'w1', offset: 4500, width: 1200, height: 1200, sill: 900, mark: 'W-3' },
  ],
});

const codes = (m: BimModel): ModelIssueCode[] => checkModel(m).map((i) => i.code);
const edit = (fn: (m: BimModel) => void): BimModel => {
  const m = JSON.parse(JSON.stringify(base())) as BimModel;
  fn(m);
  return m;
};

describe('Faz 3 — modelCheck (her kod: pozitif + negatif)', () => {
  it('temiz model hiçbir sorun üretmez', () => {
    expect(checkModel(base())).toEqual([]);
  });

  it('ROOM_OPEN_BOUNDARY', () => {
    const m = edit((x) => { x.elements = x.elements.filter((e) => e.id !== 'w3'); });
    const issue = checkModel(m).find((i) => i.code === 'ROOM_OPEN_BOUNDARY');
    expect(issue?.elementIds).toEqual(['r1']);
    expect(issue?.at).toBeDefined();
    expect(codes(base())).not.toContain('ROOM_OPEN_BOUNDARY');
  });

  it('ROOM_NOT_PLACED', () => {
    const m = edit((x) => { x.elements = x.elements.filter((e) => e.id !== 'r1'); });
    const issue = checkModel(m, { requireRooms: true }).find((i) => i.code === 'ROOM_NOT_PLACED');
    expect(issue?.message).toContain('24.0 m²');
    expect(checkModel(m).map((i) => i.code)).not.toContain('ROOM_NOT_PLACED'); // opt-in
    expect(checkModel(base(), { requireRooms: true }).map((i) => i.code)).not.toContain('ROOM_NOT_PLACED');
  });

  it('ROOM_NOT_PLACED: iki alanın yalnızca biri odalı', () => {
    const m = edit((x) => {
      x.elements.push(wall('w5', [3000, 0], [3000, 4000]));
      (x.elements.find((e) => e.id === 'r1') as { seedPoint: [number, number] }).seedPoint = [1500, 2000];
    });
    expect(enclosedRegions(m, 'l0')).toHaveLength(2);
    expect(checkModel(m, { requireRooms: true }).filter((i) => i.code === 'ROOM_NOT_PLACED')).toHaveLength(1);
  });

  it('WALL_WRONG_LEVEL', () => {
    const m = edit((x) => { (x.elements[3] as WallElement).baseLevelId = 'l1'; });
    const issue = checkModel(m).find((i) => i.code === 'WALL_WRONG_LEVEL');
    expect(issue?.elementIds).toEqual(['w4']);
    expect(codes(base())).not.toContain('WALL_WRONG_LEVEL');
  });

  it('WALL_TOP_MISMATCH', () => {
    const m = edit((x) => { (x.elements[2] as WallElement).height = 2600; });
    const issue = checkModel(m).find((i) => i.code === 'WALL_TOP_MISMATCH');
    expect(issue?.elementIds).toEqual(['w3']);
    expect(codes(base())).not.toContain('WALL_TOP_MISMATCH');
  });

  it('WALL_TOP_MISMATCH: Top Constraint ile eşitlenince kalkar', () => {
    const m = edit((x) => {
      for (const e of x.elements) if (e.type === 'wall') { e.topConstraint = 'l1'; e.topOffset = 0; }
      (x.elements[2] as WallElement).height = 3000;
    });
    expect(codes(m)).not.toContain('WALL_TOP_MISMATCH');
  });

  it('HOST_MISSING', () => {
    const m = edit((x) => { x.elements = x.elements.filter((e) => e.id !== 'w1'); });
    expect(checkModel(m).filter((i) => i.code === 'HOST_MISSING').length).toBe(3);
    expect(codes(base())).not.toContain('HOST_MISSING');
  });

  it('OPENING_OUT_OF_WALL', () => {
    const m = edit((x) => { (x.elements.find((e) => e.id === 'win3') as { offset: number }).offset = 5500; });
    expect(checkModel(m).find((i) => i.code === 'OPENING_OUT_OF_WALL')?.elementIds).toEqual(['win3']);
    expect(codes(base())).not.toContain('OPENING_OUT_OF_WALL');
  });

  it('TYPE_INCONSISTENT', () => {
    const m = edit((x) => {
      x.types = [
        { id: 'a', category: 'wall', family: 'F', name: 'A', params: { thickness: 200 } },
        { id: 'b', category: 'wall', family: 'F', name: 'B', params: { thickness: 100 } },
      ];
      x.elements.forEach((e, i) => { if (e.type === 'wall') e.typeId = i === 1 ? 'b' : 'a'; });
    });
    expect(checkModel(m).find((i) => i.code === 'TYPE_INCONSISTENT')?.elementIds).toEqual(['w2']);
    const same = edit((x) => {
      x.types = [{ id: 'a', category: 'wall', family: 'F', name: 'A', params: { thickness: 200 } }];
      x.elements.forEach((e) => { if (e.type === 'wall') e.typeId = 'a'; });
    });
    expect(codes(same)).not.toContain('TYPE_INCONSISTENT');
  });

  it('SILL_INCONSISTENT', () => {
    const m = edit((x) => { (x.elements.find((e) => e.id === 'win2') as { sill: number }).sill = 600; });
    expect(checkModel(m).find((i) => i.code === 'SILL_INCONSISTENT')?.elementIds).toEqual(['win2']);
    expect(codes(base())).not.toContain('SILL_INCONSISTENT');
  });

  it('ROOM_DATA_MISSING', () => {
    const m = edit((x) => { (x.elements.find((e) => e.id === 'r1') as { number: string }).number = ''; });
    expect(checkModel(m).find((i) => i.code === 'ROOM_DATA_MISSING')?.elementIds).toEqual(['r1']);
    expect(codes(base())).not.toContain('ROOM_DATA_MISSING');
  });

  it('özet yalnızca sayı ve kategori verir', () => {
    const m = edit((x) => {
      (x.elements[2] as WallElement).height = 2600;
      (x.elements.find((e) => e.id === 'win2') as { sill: number }).sill = 600;
    });
    const sum = summarizeIssues(checkModel(m));
    expect(sum.count).toBe(2);
    expect(sum.categories.sort()).toEqual(['Duvar üst kotu', 'Parapet tutarlılığı']);
  });
});

const catalog = loadValidatedCatalog();
if (!catalog.ok) throw new Error(catalog.diagnostic);
const missions = catalog.catalog.missionsById;

const solve = (
  id: string,
  steps: Array<(s: MissionSessionState) => CommandResult>
): MissionSessionState => {
  let s = createInitialSession(missions[id]);
  for (const step of steps) {
    const r = step(s);
    expect(r.ok, `${id}: ${JSON.stringify(!r.ok && r.error)}`).toBe(true);
    s = r.state;
  }
  return s;
};

describe('Faz 3 — Bölüm 6 görevleri model kontrolüne dayanır', () => {
  const sol: Record<string, Array<(s: MissionSessionState) => CommandResult>> = {
    m38: [(s) => updateElementProperty(s, 'w3', 'end', [0, 4000])],
    m39: [(s) => updateElementProperty(s, 'w4', 'baseLevelId', 'l0')],
    m40: [(s) => updateElementProperty(s, 'd3', 'typeId', 'dt900')],
    m41: [(s) => updateElementProperty(s, 'win3', 'sill', 900)],
    m42: [(s) => updateElementProperty(s, 'r2', 'number', '102')],
    m43: [
      (s) => updateElementProperty(s, 'w3', 'height', 3000),
      (s) => updateElementProperty(s, 'win3', 'sill', 900),
      (s) => updateElementProperty(s, 'r1', 'number', '101'),
    ],
  };

  for (const [id, steps] of Object.entries(sol)) {
    it(`${id}: başlangıçta uyarı var, çözümle model temiz ve görev geçer`, () => {
      const start = createInitialSession(missions[id]);
      expect(evaluate(start.task, start.model, 0).pass).toBe(false);
      expect(checkModel(start.model).length).toBeGreaterThan(0);
      const done = solve(id, steps);
      const res = evaluate(done.task, done.model, 0);
      expect(res.errors).toEqual([]);
      expect(res.pass).toBe(true);
    });
  }

  it('m43: başlangıç sorunları üç ayrı kategoride', () => {
    const s = createInitialSession(missions.m43);
    expect(summarizeIssues(checkModel(s.model)).count).toBe(3);
  });

  it('geri bildirim ipucu merdivenine göre kademelenir (alan → tür → nesne → çözüm)', () => {
    const s = createInitialSession(missions.m43);
    const res = evaluate(s.task, s.model, 0);
    const ev = res.criteria.find((c) => c.id === 'c_clean')!;
    const t0 = explainCriterionFailureTr(s.task, s.model, ev, 0);
    const t1 = explainCriterionFailureTr(s.task, s.model, ev, 1);
    const t2 = explainCriterionFailureTr(s.task, s.model, ev, 2);
    const t3 = explainCriterionFailureTr(s.task, s.model, ev, 3);
    expect(t0).toContain('3 tutarsızlık');
    expect(t0).not.toContain('w3');
    expect(t1).toContain('nesnelerinde');
    expect(t1).not.toContain('w3');
    expect(t2).toContain('w3');
    expect(t2).not.toContain('Constraints');
    expect(t3).toContain('Sill Height');
  });
});
