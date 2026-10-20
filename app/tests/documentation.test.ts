import { describe, expect, it } from 'vitest';
import { loadValidatedCatalog } from '../src/content/content';
import {
  createDimensionCommand,
  createInitialSession,
  createSheetCommand,
  createTagCommand,
  createViewCommand,
  placeOnSheetCommand,
  setCropCommand,
  setCropRectCommand,
  updateElementProperty,
  type CommandResult,
  type MissionSessionState,
} from '../src/domain/commands';
import { dimensionValue, viewPaperSize } from '../src/domain/documentation';
import { evaluate } from '../src/domain/evaluator';
import { checkModel } from '../src/domain/modelCheck';
import type { BimModel, DimensionElement, SheetElement, ViewElement } from '../src/domain/types';
import { buildElevation, buildPlan, buildSection } from '../src/domain/viewDrawing';

const catalog = loadValidatedCatalog();
if (!catalog.ok) throw new Error(catalog.diagnostic);
const missions = catalog.catalog.missionsById;

const ok = (r: CommandResult): MissionSessionState => {
  expect(r.ok, JSON.stringify(!r.ok && r.error)).toBe(true);
  return r.state;
};

const solved = (id: string, steps: Array<(s: MissionSessionState) => CommandResult>) => {
  let s = createInitialSession(missions[id]);
  for (const step of steps) s = ok(step(s));
  return s;
};

const passes = (s: MissionSessionState) => {
  const r = evaluate(s.task, s.model, 0);
  expect(r.errors).toEqual([]);
  return r.pass;
};

describe('Faz 4 — görünümler, ölçü, etiket, pafta', () => {
  it('m31: kesit çizgisi binanın içinden geçmezse kriter kalır', () => {
    const far = solved('m31', [(s) => createViewCommand(s, { kind: 'section', cutLine: [[0, 9000], [6000, 9000]] })]);
    expect(passes(far)).toBe(false);
    const good = solved('m31', [(s) => createViewCommand(s, { kind: 'section', cutLine: [[0, 2000], [6000, 2000]] })]);
    expect(passes(good)).toBe(true);
  });

  it('kesit çizgisi eksene paralel olmalı', () => {
    const s = createInitialSession(missions.m31);
    expect(createViewCommand(s, { kind: 'section', cutLine: [[0, 0], [3000, 2000]] }).ok).toBe(false);
  });

  it('m32: cephe yönü seçilir, aynı yön iki kez eklenemez', () => {
    const s = solved('m32', [(st) => createViewCommand(st, { kind: 'elevation', direction: 'S' })]);
    expect(passes(s)).toBe(true);
    expect(createViewCommand(s, { kind: 'elevation', direction: 'S' }).ok).toBe(false);
    const wrong = solved('m32', [(st) => createViewCommand(st, { kind: 'elevation', direction: 'N' })]);
    expect(passes(wrong)).toBe(false);
  });

  it('m34: ölçü değeri duvarlardan gelir ve duvar taşınınca güncellenir', () => {
    let s = solved('m34', [(st) => createDimensionCommand(st, 'w1', 'w3')]);
    expect(passes(s)).toBe(true);
    const dim = s.model.elements.find((e): e is DimensionElement => e.type === 'dimension')!;
    expect(dimensionValue(dim, s.model)).toBe(4000);

    // Move the north wall: the dimension follows without being touched.
    const m: BimModel = JSON.parse(JSON.stringify(s.model));
    const w3 = m.elements.find((e) => e.id === 'w3');
    if (w3?.type === 'wall') {
      w3.start = [6000, 5000];
      w3.end = [0, 5000];
    }
    expect(dimensionValue(dim, m)).toBe(5000);
    s = { ...s, model: m };
  });

  it('ölçü yalnızca paralel duvarlar arasında', () => {
    const s = createInitialSession(missions.m34);
    expect(createDimensionCommand(s, 'w1', 'w2').ok).toBe(false);
    expect(createDimensionCommand(s, 'w1', 'w1').ok).toBe(false);
  });

  it('m35: etiket eksik uyarısı, etiketleyince kalkar', () => {
    const start = createInitialSession(missions.m35);
    const issues = checkModel(start.model, { requireTags: true });
    expect(issues[0]?.code).toBe('TAG_MISSING');
    expect(issues[0].elementIds.sort()).toEqual(['d1', 'r1', 'win1']);
    const s = solved('m35', [
      (st) => createTagCommand(st, 'd1'),
      (st) => createTagCommand(st, 'win1'),
      (st) => createTagCommand(st, 'r1'),
    ]);
    expect(passes(s)).toBe(true);
    expect(createTagCommand(s, 'd1').ok).toBe(false); // duplicate
  });

  it('etiket yalnızca kapı/pencere/oda', () => {
    const s = createInitialSession(missions.m35);
    expect(createTagCommand(s, 'w1').ok).toBe(false);
  });

  it('m36: pafta oluştur ve adlandır', () => {
    const s = solved('m36', [
      (st) => createSheetCommand(st),
      (st) => updateElementProperty(st, 'sh1', 'name', 'Zemin Kat Planı'),
    ]);
    const sheet = s.model.elements.find((e): e is SheetElement => e.type === 'sheet')!;
    expect(sheet.number).toBe('A-101');
    expect(passes(s)).toBe(true);
  });

  it('m37: plan ve kesit pafta içine, antetle çakışmadan yerleşir', () => {
    const start = createInitialSession(missions.m37);
    expect(passes(start)).toBe(false);
    const s = solved('m37', [
      (st) => placeOnSheetCommand(st, 'sh1', 'v1'),
      (st) => placeOnSheetCommand(st, 'sh1', 'v2'),
    ]);
    expect(passes(s)).toBe(true);
    const sheet = s.model.elements.find((e): e is SheetElement => e.id === 'sh1')!;
    expect(sheet.placements).toHaveLength(2);
    const [a, b] = sheet.placements.map((p) => {
      const v = s.model.elements.find((e): e is ViewElement => e.id === p.viewId)!;
      const size = viewPaperSize(v, s.model);
      return { x: p.x, z: p.z, w: size.w, h: size.h };
    });
    const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.h && b.z < a.z + a.h;
    expect(overlap).toBe(false);
  });

  it('pafta çerçevesine sığmayan yerleşim reddedilir', () => {
    const s = createInitialSession(missions.m37);
    expect(placeOnSheetCommand(s, 'sh1', 'v2', 400, 280).ok).toBe(false);
  });

  it('m33: kadraj aç, sürükle, değerler görev ölçüsüne gelir', () => {
    let s = createInitialSession(missions.m33);
    expect(passes(s)).toBe(false);
    s = ok(setCropCommand(s, 'v1', true));
    s = ok(setCropRectCommand(s, 'v1', { minX: 3000, maxX: 6000, minZ: 0, maxZ: 4000 }));
    expect(passes(s)).toBe(true);
    expect(setCropRectCommand(s, 'v1', { minX: 3000, maxX: 3100, minZ: 0, maxZ: 4000 }).ok).toBe(false);
  });

  it('m30: kesme düzlemi yüksekliği pencereyi kesince görev geçer', () => {
    const start = createInitialSession(missions.m30);
    expect(passes(start)).toBe(false);
    const s = solved('m30', [(st) => updateElementProperty(st, 'v1', 'cutHeight', 1500)]);
    expect(passes(s)).toBe(true);
  });

  it('kesit yönü çevrilir (flip), izin gerekmez', () => {
    let s = solved('m31', [(st) => createViewCommand(st, { kind: 'section', cutLine: [[0, 2000], [6000, 2000]] })]);
    const id = s.model.elements.find((e) => e.type === 'view')!.id;
    expect((s.model.elements.find((e) => e.id === id) as ViewElement).lookDir).toBe('z+');
    s = ok(updateElementProperty(s, id, 'flip', true));
    expect((s.model.elements.find((e) => e.id === id) as ViewElement).lookDir).toBe('z-');
  });
});

describe('Faz 4 — çizimler modelden üretilir ve model değişince güncellenir', () => {
  const house = (): BimModel => ({
    levels: [{ id: 'l0', elevation: 0, name: 'Zemin' }, { id: 'l1', elevation: 3000, name: 'Kat 1' }],
    elements: [
      { id: 'w1', type: 'wall', name: 'w1', baseLevelId: 'l0', start: [0, 0], end: [6000, 0], height: 3000, thickness: 200 },
      { id: 'w2', type: 'wall', name: 'w2', baseLevelId: 'l0', start: [6000, 0], end: [6000, 4000], height: 3000, thickness: 200 },
      { id: 'w3', type: 'wall', name: 'w3', baseLevelId: 'l0', start: [6000, 4000], end: [0, 4000], height: 3000, thickness: 200 },
      { id: 'w4', type: 'wall', name: 'w4', baseLevelId: 'l0', start: [0, 4000], end: [0, 0], height: 3000, thickness: 200 },
      { id: 'win1', type: 'window', name: 'W', hostWallId: 'w1', offset: 2400, width: 1200, height: 1200, sill: 900, mark: 'W-1' },
    ],
  });

  const count = (d: { prims: Array<{ t: string; fill?: string }> }, fill: string) =>
    d.prims.filter((p) => p.t === 'rect' && p.fill === fill).length;

  it('kesit: kesilen duvarlar dolu (cut), ardındaki duvar görünür (beyond)', () => {
    const m = house();
    const view = { id: 'v1', type: 'view', name: 'Kesit 1', kind: 'section', cutLine: [[0, 2000], [6000, 2000]], lookDir: 'z+', scale: 50 } as ViewElement;
    const d = buildSection(m, view);
    expect(count(d, 'cut')).toBe(2); // w2 and w4 are cut
    expect(count(d, 'beyond')).toBeGreaterThanOrEqual(1); // w3 behind the cut
  });

  it('kesit çizgisi pencerenin içinden geçerse cut duvar iki parçaya ayrılır', () => {
    const m = house();
    // Cut along x = 3000 through the south window (x 2400-3600): looks +x.
    const view = { id: 'v1', type: 'view', name: 'Kesit 1', kind: 'section', cutLine: [[3000, 0], [3000, 4000]], lookDir: 'x+', scale: 50 } as ViewElement;
    const d = buildSection(m, view);
    // w1 (south wall) is cut at the window: sill part + head part = 2 rects.
    const south = d.prims.filter((p) => p.t === 'rect' && p.fill === 'cut' && p.id === 'w1');
    expect(south).toHaveLength(2);
  });

  it('cephe: pencere cam olarak görünür; duvar yüksekliği değişince çizim değişir', () => {
    const m = house();
    const before = buildElevation(m, 'S');
    expect(count(before, 'glass')).toBe(1);
    const heightBefore = before.height;
    const tall = JSON.parse(JSON.stringify(m)) as BimModel;
    for (const e of tall.elements) if (e.type === 'wall') e.height = 4500;
    const after = buildElevation(tall, 'S');
    expect(after.height).toBeGreaterThan(heightBefore);
  });

  it('plan çizimi kadraja göre sınırlanır ve kesme düzlemi pencere sembolünü belirler', () => {
    const m = house();
    const view = { id: 'v1', type: 'view', name: 'P', kind: 'plan', levelId: 'l0', scale: 100, cutHeight: 1500 } as ViewElement;
    const cutLines = (d: ReturnType<typeof buildPlan>) => d.prims.filter((p) => p.t === 'line' && p.style === 'swing').length;
    expect(cutLines(buildPlan(m, view))).toBe(1);
    expect(cutLines(buildPlan(m, { ...view, cutHeight: 2400 }))).toBe(0);
    const cropped = buildPlan(m, { ...view, cropMinX: 3000, cropMaxX: 6000, cropMinZ: 0, cropMaxZ: 4000 });
    expect(cropped.width).toBe(3000);
    expect(cropped.minX).toBe(3000);
  });
});
