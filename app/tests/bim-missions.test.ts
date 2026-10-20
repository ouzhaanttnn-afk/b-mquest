import { describe, expect, it } from 'vitest';
import { loadValidatedCatalog } from '../src/content/content';
import {
  createFloorCommand,
  createGridCommand,
  createInitialSession,
  createRoofCommand,
  createRoomCommand,
  createStairCommand,
  createWindowCommand,
  setLevelElevationCommand,
  updateElementProperty,
  updateTypeParamCommand,
  type CommandResult,
  type MissionSessionState,
} from '../src/domain/commands';
import { evaluate } from '../src/domain/evaluator';

const catalog = loadValidatedCatalog();
if (!catalog.ok) throw new Error(catalog.diagnostic);
const missions = catalog.catalog.missionsById;

const run = (
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

const passes = (s: MissionSessionState) => {
  const res = evaluate(s.task, s.model, 0);
  expect(res.errors, JSON.stringify(res.errors)).toEqual([]);
  return res;
};

const solutions: Record<string, Array<(s: MissionSessionState) => CommandResult>> = {
  m09: ['w1', 'w2', 'w3', 'w4'].map((w) => (s) => updateElementProperty(s, w, 'topConstraint', 'l1')),
  m10: [
    (s) => createGridCommand(s, { start: [0, -1000], end: [0, 5000] }),
    (s) => createGridCommand(s, { start: [6000, -1000], end: [6000, 5000] }),
    (s) => createGridCommand(s, { start: [-1000, 0], end: [7000, 0] }),
    (s) => createGridCommand(s, { start: [-1000, 4000], end: [7000, 4000] }),
  ],
  m12: [(s) => setLevelElevationCommand(s, 'l1', 3200)],
  m17: [(s) => createWindowCommand(s, { hostWallId: 'w_south', offset: 2400, width: 1200, height: 1200, sill: 900 })],
  m18: [(s) => updateElementProperty(s, 'win1', 'sill', 900)],
  m19: [
    (s) => createFloorCommand(s, { levelId: 'l0' }),
    (s) => updateElementProperty(s, 'f1', 'thickness', 150),
  ],
  m20: [(s) => createRoofCommand(s, { baseLevelId: 'l1', slope: 30, overhang: 500 })],
  m21: [
    (s) => createStairCommand(s, { baseLevelId: 'l0', topLevelId: 'l1', start: [1000, 1000], direction: 'x+', risers: 18, riserHeight: 175 }),
  ],
  m22: [(s) => createRoomCommand(s, { levelId: 'l0', seedPoint: [3000, 2000], name: 'Salon', number: '101' })],
  m24: [(s) => updateTypeParamCommand(s, 'wn900', 'width', 1200)],
  m25: [(s) => updateElementProperty(s, 'w3', 'typeId', 'wt200')],
  m34: [(s) => updateElementProperty(s, 'w3', 'end', [0, 4000])],
};

describe('Faz 1 — gerçek BIM nesnelerine bağlı görevler', () => {
  for (const [id, steps] of Object.entries(solutions)) {
    it(`${id}: başlangıçta geçmez, çözümle geçer`, () => {
      const start = createInitialSession(missions[id]);
      expect(evaluate(start.task, start.model, 0).pass).toBe(false);
      const solved = run(id, steps);
      expect(passes(solved).pass).toBe(true);
    });
  }

  it('m20: çatıyı yanlış kata koymak oturuş kriterini bozar', () => {
    const s = run('m20', [(st) => createRoofCommand(st, { baseLevelId: 'l0', slope: 30, overhang: 500 })]);
    const res = passes(s);
    expect(res.pass).toBe(false);
    expect(res.criteria.find((c) => c.id === 'c_seat')?.pass).toBe(false);
  });

  it('m21: basamak toplamı kat farkına eşit değilse kalır', () => {
    const s = run('m21', [
      (st) => createStairCommand(st, { baseLevelId: 'l0', topLevelId: 'l1', start: [1000, 1000], direction: 'x+', risers: 17, riserHeight: 175 }),
    ]);
    expect(passes(s).criteria.find((c) => c.id === 'c_rise')?.pass).toBe(false);
  });

  it('m24: pencere genişliği örnek (instance) üzerinden değiştirilemez, tip üzerinden değişir', () => {
    const s = createInitialSession(missions.m24);
    const r = updateElementProperty(s, 'win1', 'width', 1200);
    expect(r.ok).toBe(false);
  });

  it('m34: sınır açıkken oda hatası boşluk yerini içerir', () => {
    const s = createInitialSession(missions.m34);
    const res = evaluate(s.task, s.model, 0);
    expect(res.criteria.find((c) => c.id === 'c_cl')?.actual).toContain('r1');
  });

  it('50 görevin hepsi hâlâ yüklenir ve şemadan geçer', () => {
    expect(Object.keys(missions)).toHaveLength(50);
  });
});
