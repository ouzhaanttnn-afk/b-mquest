import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadValidatedCatalog } from '../src/content/content';
import {
  addLevelCommand,
  createDimensionCommand,
  createDoorCommand,
  createFloorCommand,
  createGridCommand,
  createInitialSession,
  createRoofCommand,
  createRoomCommand,
  createSheetCommand,
  createTagCommand,
  createViewCommand,
  createWallCommand,
  createWindowCommand,
  placeOnSheetCommand,
  type CommandResult,
  type MissionSessionState,
} from '../src/domain/commands';
import { evaluate } from '../src/domain/evaluator';
import {
  carryOverDraft,
  createDefaultSaveEnvelope,
  parseAndValidateSaveJson,
  recordPassingScore,
} from '../src/domain/persistence';

const catalog = loadValidatedCatalog();
if (!catalog.ok) throw new Error(catalog.diagnostic);
const missions = catalog.catalog.missionsById;

type Step = (s: MissionSessionState) => CommandResult;

const wall = (name: string, sx: number, sz: number, ex: number, ez: number): Step => (s) =>
  createWallCommand(s, { name, baseLevelId: 'l0', startX: sx, startZ: sz, endX: ex, endZ: ez, height: 3000, thickness: 200 });

const door = (host: string, offset: number, mark: string): Step => (s) =>
  createDoorCommand(s, { name: 'Kapı', hostWallId: host, offset, width: 900, height: 2100, sill: 0, mark, fireRating: 'none' });

const win = (host: string, offset: number): Step => (s) =>
  createWindowCommand(s, { hostWallId: host, offset, width: 1200, height: 1200, sill: 900 });

const STAGES: Record<string, Step[]> = {
  m44: [
    (s) => addLevelCommand(s),
    (s) => createGridCommand(s, { start: [0, -1000], end: [0, 9000] }),
    (s) => createGridCommand(s, { start: [9000, -1000], end: [9000, 9000] }),
    (s) => createGridCommand(s, { start: [-1000, 0], end: [10000, 0] }),
    (s) => createGridCommand(s, { start: [-1000, 8000], end: [10000, 8000] }),
  ],
  m45: [
    wall('Güney', 0, 0, 9000, 0),
    wall('Doğu', 9000, 0, 9000, 8000),
    wall('Kuzey', 9000, 8000, 0, 8000),
    wall('Batı', 0, 8000, 0, 0),
    (s) => createFloorCommand(s, { levelId: 'l0' }),
    (s) => createRoofCommand(s, { baseLevelId: 'l1', slope: 25, overhang: 500 }),
  ],
  m46: [
    wall('İç', 4500, 0, 4500, 8000),
    door('w1', 1000, 'D-01'),
    door('w5', 3000, 'D-02'),
    win('w1', 2500),
    win('w1', 6000),
    win('w3', 3000),
    (s) => createRoomCommand(s, { levelId: 'l0', seedPoint: [2250, 4000], name: 'Salon', number: '101' }),
    (s) => createRoomCommand(s, { levelId: 'l0', seedPoint: [6750, 4000], name: 'Yatak Odası', number: '102' }),
  ],
  m47: [
    (s) => createViewCommand(s, { kind: 'section', cutLine: [[0, 4000], [9000, 4000]] }),
    (s) => createViewCommand(s, { kind: 'elevation', direction: 'S' }),
    (s) => createDimensionCommand(s, 'w1', 'w3'),
    (s) => createDimensionCommand(s, 'w2', 'w4'),
  ],
  m48: [
    (s) => createViewCommand(s, { kind: 'plan', levelId: 'l0' }),
    (s) => createSheetCommand(s, { name: 'Zemin Kat Planı' }),
    (s) => placeOnSheetCommand(s, 'sh1', 'v3'),
    (s) => placeOnSheetCommand(s, 'sh1', 'v1'),
    ...['d1', 'd2', 'win1', 'win2', 'win3', 'r1', 'r2'].map((id): Step => (s) => createTagCommand(s, id)),
  ],
  m49: [],
  m50: [],
};

describe('Faz 5 — final proje: tek konut, yedi aşama', () => {
  it('her aşama bir öncekinin modelinden başlar ve altın yolla geçilir', () => {
    let save = createDefaultSaveEnvelope();
    let prevModelJson = '';
    for (const [id, steps] of Object.entries(STAGES)) {
      const task = missions[id];
      expect(task, id).toBeDefined();
      const carried = carryOverDraft(task, save);
      if (id !== 'm44') {
        expect(carried, `${id} carry-over`).toBeDefined();
        expect(JSON.stringify(carried!.model)).toBe(prevModelJson);
      }
      let s = createInitialSession(task, carried);
      const startRes = evaluate(s.task, s.model, 0);
      if (steps.length > 0) expect(startRes.pass, `${id} must not pass untouched`).toBe(false);
      for (const step of steps) {
        const r = step(s);
        expect(r.ok, `${id}: ${JSON.stringify(!r.ok && r.error)}`).toBe(true);
        s = r.state;
      }
      const res = evaluate(s.task, s.model, 0);
      expect(res.errors, id).toEqual([]);
      expect(res.criteria.filter((c) => !c.pass).map((c) => `${id}:${c.id}:${String(c.actual)}`)).toEqual([]);
      expect(res.pass, id).toBe(true);
      save = recordPassingScore(save, id, res.score, s.model);
      prevModelJson = JSON.stringify(s.model);
      if (id === 'm49') {
        // The e2e suite replays this house; regenerate with UPDATE_GOLDEN=1.
        const file = join(__dirname, 'golden', 'golden-house.json');
        const json = JSON.stringify(s.model, null, 2);
        if (process.env.UPDATE_GOLDEN) writeFileSync(file, json);
        expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(JSON.parse(json));
      }
    }
    // The finished save, with carried models, still validates and round-trips.
    const parsed = parseAndValidateSaveJson(JSON.stringify(save), missions);
    expect(parsed.ok).toBe(true);
  });

  it('m45: yanlış kata oturan çatı ve alan dışı kabuk ayrı ayrı yakalanır', () => {
    let save = createDefaultSaveEnvelope();
    for (const id of ['m44']) {
      let s = createInitialSession(missions[id], carryOverDraft(missions[id], save));
      for (const step of STAGES[id]) s = step(s).state;
      save = recordPassingScore(save, id, 100, s.model);
    }
    let s = createInitialSession(missions.m45, carryOverDraft(missions.m45, save));
    for (const step of [
      wall('a', 0, 0, 6000, 0),
      wall('b', 6000, 0, 6000, 4000),
      wall('c', 6000, 4000, 0, 4000),
      wall('d', 0, 4000, 0, 0),
      (st: MissionSessionState) => createFloorCommand(st, { levelId: 'l0' }),
      (st: MissionSessionState) => createRoofCommand(st, { baseLevelId: 'l0', slope: 25, overhang: 0 }),
    ]) {
      s = step(s).state;
    }
    const res = evaluate(s.task, s.model, 0);
    const failed = res.criteria.filter((c) => !c.pass).map((c) => c.id);
    expect(failed).toContain('c_area'); // 24 m² is far below 65 m²
    expect(failed).toContain('c_roof'); // roof on level 0, walls end at 3000
    expect(failed).not.toContain('c_floor');
  });

  it('m50: tüm brif kriterleri birlikte denetlenir (16 madde)', () => {
    expect(missions.m50.criteria.length).toBe(16);
    expect(missions.m49.criteria).toHaveLength(1);
  });

  it('final aşamalarda hiçbir menü/araç yolu verilmez', () => {
    for (const id of ['m44', 'm45', 'm46', 'm47', 'm48', 'm49', 'm50']) {
      const text = [missions[id].objective, ...missions[id].hints.map((h) => h.text)].join(' ');
      expect(text, id).not.toMatch(/→|Architecture|Annotate|Properties|Top Constraint|Pick Walls/);
    }
  });
});
