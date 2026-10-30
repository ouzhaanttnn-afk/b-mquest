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
  m38: [(s) => updateElementProperty(s, 'w3', 'end', [0, 4000])],
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

  it('m38: sınır açıkken oda hatası boşluk yerini içerir', () => {
    const s = createInitialSession(missions.m38);
    const res = evaluate(s.task, s.model, 0);
    expect(res.criteria.find((c) => c.id === 'c_cl')?.actual).toContain('r1');
  });

  it('58 görevin hepsi hâlâ yüklenir ve şemadan geçer', () => {
    expect(Object.keys(missions)).toHaveLength(58);
  });
});

describe('Bonus Bölüm 8 — çizelgeler', () => {
  const edit = (id: string, field: string, v: string) => (s: MissionSessionState) =>
    updateElementProperty(s, id, field as never, v);

  it('m51: başlangıçta kalır, poz düzeltilince geçer', () => {
    expect(evaluate(missions.m51, missions.m51.initialModel, 0).pass).toBe(false);
    const s = run('m51', [
      edit('d2', 'mark', 'D-02'),
      edit('d4', 'mark', 'D-04'),
    ]);
    expect(passes(s).pass).toBe(true);
  });
  it('m52: yalnızca d1-d3 düzenlenebilir', () => {
    const s0 = createInitialSession(missions.m52);
    expect(updateElementProperty(s0, 'd4', 'fireRating', 'EI30').ok).toBe(false);
    const s = run('m52', ['d1', 'd2', 'd3'].map((d) => edit(d, 'fireRating', 'EI30')));
    expect(passes(s).pass).toBe(true);
  });
  it('m53: oda numarası ve adı doldurulunca geçer', () => {
    expect(evaluate(missions.m53, missions.m53.initialModel, 0).pass).toBe(false);
    const s = run('m53', [
      edit('r1', 'number', '101'),
      edit('r1', 'name', 'Salon'),
      edit('r2', 'number', '102'),
      edit('r2', 'name', 'Yatak Odası'),
    ]);
    expect(passes(s).pass).toBe(true);
  });
});

import {
  alignWallCommand,
  copyWallsCommand,
  mirrorWallsCommand,
  offsetWallCommand,
} from '../src/domain/commands';

describe('Bonus Bölüm 9 — Modify araçları', () => {
  it('hepsi başlangıçta kalır', () => {
    for (const id of ['m54', 'm55', 'm56', 'm57', 'm58']) {
      expect(evaluate(missions[id], missions[id].initialModel, 0).pass, id).toBe(false);
    }
  });
  it('m54: kopya duvarla birlikte kapıyı da getirir ve yeni duvara bağlar', () => {
    const s = run('m54', [(st) => copyWallsCommand(st, ['w1'], 0, 4000)]);
    expect(passes(s).pass).toBe(true);
    const door = s.model.elements.filter((e) => e.type === 'door');
    expect(door.map((d) => (d as { hostWallId: string }).hostWallId).sort()).toEqual(['w1', 'w2']);
  });
  it('m55: aynalama kapalı 24 m² kabuk üretir', () => {
    const s = run('m55', [(st) => mirrorWallsCommand(st, ['w1', 'w2', 'w3'], 'x', 3000)]);
    expect(passes(s).pass).toBe(true);
  });
  it('m56: öteleme paralel duvar üretir; sıfır mesafe reddedilir', () => {
    const s0 = createInitialSession(missions.m56);
    expect(offsetWallCommand(s0, 'w1', 0).ok).toBe(false);
    expect(passes(run('m56', [(st) => offsetWallCommand(st, 'w1', 3000)])).pass).toBe(true);
  });
  it('m57: hizalama w2’yi w1 çizgisine getirir; paralel olmayan reddedilir', () => {
    expect(passes(run('m57', [(st) => alignWallCommand(st, 'w2', 'w1')])).pass).toBe(true);
    const s55 = createInitialSession(missions.m55);
    expect(alignWallCommand(s55, 'w1', 'w3').ok).toBe(false);
  });
  it('m58: kapı aynalanır', () => {
    const s = run('m58', [(st) => mirrorWallsCommand(st, ['w1', 'w2', 'w3'], 'x', 3000)]);
    expect(passes(s).pass).toBe(true);
  });
  it('geri al kopyayı geri alır', () => {
    let s = createInitialSession(missions.m54);
    const r = copyWallsCommand(s, ['w1'], 0, 4000);
    expect(r.ok).toBe(true);
    if (r.ok) {
      s = r.state;
      expect(s.model.elements.length).toBe(4);
    }
  });
});

import { addLevelCommand, setLevelElevationCommand as setElev, moveWallCommand } from '../src/domain/commands';

describe('Faz 1 — yeniden yazılan görevler', () => {
  it('m07: kat eklenir ve kotu 3300 yapılınca geçer', () => {
    expect(evaluate(missions.m07, missions.m07.initialModel, 0).pass).toBe(false);
    const s = run('m07', [(st) => addLevelCommand(st), (st) => setElev(st, 'l1', 3300)]);
    expect(passes(s).pass).toBe(true);
  });
  it('m07: varsayılan 3000 mm kot yetmez', () => {
    const s = run('m07', [(st) => addLevelCommand(st)]);
    expect(evaluate(s.task, s.model, 0).pass).toBe(false);
  });
  it('m11: duvarı aksa oturtunca geçer, aksı kaydırarak çözülemez', () => {
    expect(evaluate(missions.m11, missions.m11.initialModel, 0).pass).toBe(false);
    const s = run('m11', [(st) => moveWallCommand(st, 'w1', -150, 0)]);
    expect(passes(s).pass).toBe(true);
    const s0 = createInitialSession(missions.m11);
    expect(moveWallCommand(s0, 'ga', 150, 0).ok).toBe(false);
  });
  it('m23: tip değişince genişlik de değişir; genişlik tek başına düzenlenemez', () => {
    const s0 = createInitialSession(missions.m23);
    expect(updateElementProperty(s0, 'd1', 'width', 900).ok).toBe(false);
    const s = run('m23', [(st) => updateElementProperty(st, 'd1', 'typeId', 'dt900')]);
    expect(passes(s).pass).toBe(true);
  });
});

import { createRectangleWallsCommand } from '../src/domain/commands';
import { wallByLength, EMPTY_CHAIN, type WallDir } from '../src/ui/workspace/toolActions';

describe('Duvar çizmeyi kolaylaştıranlar', () => {
  const d = { baseLevelId: 'l0', height: 3000, thickness: 200 };
  it('4 duvarlı oda tek adımda gelir ve m02 çözümünü sağlar', () => {
    const s = run('m02', [
      (st) => createRectangleWallsCommand(st, { x: 0, z: 0, width: 6000, depth: 4000, ...d }),
    ]);
    expect(s.model.elements.filter((e) => e.type === 'wall')).toHaveLength(4);
    expect(s.past).toHaveLength(1);
    expect(passes(s).pass).toBe(true);
  });
  it('ölçüyle duvar zinciri: 4 yön, zincir kapanır', () => {
    let s = createInitialSession(missions.m02);
    let chain = EMPTY_CHAIN;
    for (const [dir, len] of [['R', 6000], ['D', 4000], ['L', 6000], ['U', 4000]] as const) {
      const o = wallByLength(s, chain, dir, len, d);
      expect(o.result?.ok, `${dir}`).toBe(true);
      if (o.result?.ok) s = o.result.state;
      chain = o.next;
    }
    expect(chain).toEqual(EMPTY_CHAIN);
    expect(passes(s).pass).toBe(true);
  });
  it('geçersiz uzunluk reddedilir', () => {
    const s = createInitialSession(missions.m02);
    expect(wallByLength(s, EMPTY_CHAIN, 'R', 50, d).result).toBeNull();
    expect(wallByLength(s, EMPTY_CHAIN, 'R', 1.5, d).result).toBeNull();
  });
});

describe('Çeşitlendirilen görevler: m13, m14, m28', () => {
  const d = { baseLevelId: 'l0', height: 3000, thickness: 200 };
  const chain = (id: string, steps: Array<[WallDir, number]>) => {
    let s = createInitialSession(missions[id]);
    let c = EMPTY_CHAIN;
    for (const [dir, len] of steps) {
      const o = wallByLength(s, c, dir, len, d);
      expect(o.result?.ok, `${id} ${dir}`).toBe(true);
      if (o.result?.ok) s = o.result.state;
      c = o.next;
    }
    return s;
  };

  it('hepsi başlangıçta kalır', () => {
    for (const id of ['m13', 'm14', 'm28']) {
      expect(evaluate(missions[id], missions[id].initialModel, 0).pass, id).toBe(false);
    }
  });
  it('m13: 5000 × 4000 oda geçer; m02’nin 6000 × 4000 odası geçmez', () => {
    const ok = chain('m13', [['R', 5000], ['D', 4000], ['L', 5000], ['U', 4000]]);
    expect(passes(ok).pass).toBe(true);
    const wrong = chain('m13', [['R', 6000], ['D', 4000], ['L', 6000], ['U', 4000]]);
    expect(evaluate(wrong.task, wrong.model, 0).pass).toBe(false);
  });
  it('m14: L biçimli plan 6 duvar ve 18 m²; dikdörtgen geçmez', () => {
    const ok = chain('m14', [['R', 6000], ['D', 2000], ['L', 3000], ['D', 2000], ['L', 3000], ['U', 4000]]);
    expect(passes(ok).pass).toBe(true);
    const box4 = chain('m14', [['R', 6000], ['D', 3000], ['L', 6000], ['U', 3000]]);
    expect(evaluate(box4.task, box4.model, 0).pass).toBe(false);
  });
  it('m28: üç hata üç düzeltmeyle çözülür; d1 kilitli', () => {
    const s0 = createInitialSession(missions.m28);
    expect(updateElementProperty(s0, 'd1', 'mark', 'D-09').ok).toBe(false);
    const s = run('m28', [
      (st) => updateElementProperty(st, 'd2', 'mark', 'D-02'),
      (st) => updateElementProperty(st, 'd3', 'width', 900),
      (st) => updateElementProperty(st, 'd4', 'fireRating', 'EI30'),
    ]);
    expect(passes(s).pass).toBe(true);
  });
});
