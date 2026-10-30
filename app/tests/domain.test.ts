import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadValidatedCatalog } from '../src/content/content';
import {
  createDoorCommand,
  createInitialSession,
  createWallCommand,
  deleteElementCommand,
  redoCommand,
  revealNextHintCommand,
  undoCommand,
  updateElementProperty,
} from '../src/domain/commands';
import {
  capBadgeForWalkthrough,
  evaluate,
  modelErrors,
  permissionErrors,
  taskErrors,
} from '../src/domain/evaluator';
import {
  createDefaultSaveEnvelope,
  loadFromBrowserStorage,
  parseAndValidateSaveJson,
  recordPassingScore,
  writeToBrowserStorage,
} from '../src/domain/persistence';
import type { BimModel, MissionTask } from '../src/domain/types';

const catalogRes = loadValidatedCatalog();
if (!catalogRes.ok) {
  throw new Error(`Catalog failed to load in test: ${catalogRes.diagnostic}`);
}
const { missionsById } = catalogRes.catalog;

describe('Layer 2 — Domain, Reference Parity & Persistence Suite (D01–D15, P01)', () => {
  it('D01: matches reference evaluator for all initial missions and 16 golden fixtures', () => {
    for (const mId of ['m01', 'm02', 'm03']) {
      const initResult = evaluate(missionsById[mId], missionsById[mId].initialModel, 0);
      expect(initResult.pass).toBe(false);
    }

    const fixturesDir = join(__dirname, 'fixtures');
    const files = readdirSync(fixturesDir)
      .filter((f) => f.endsWith('.json'))
      .sort();
    expect(files.length).toBe(16);

    for (const file of files) {
      const fx = JSON.parse(readFileSync(join(fixturesDir, file), 'utf8'));
      const task = missionsById[fx.taskId];
      const res = evaluate(task, fx.model, fx.hintCount ?? 0);

      expect(res.pass, `Fixture ${file} pass mismatch`).toBe(fx.expectedPass);
    }

    // Score & badge threshold parity from reference/test.mjs
    const m03Pass = JSON.parse(
      readFileSync(join(fixturesDir, 'm03-pass.json'), 'utf8')
    ).model;
    expect(evaluate(missionsById.m03, m03Pass, 0).score).toBe(100);
    expect(evaluate(missionsById.m03, m03Pass, 2).badge).toBe('gold');
    expect(evaluate(missionsById.m03, m03Pass, 3).score).toBe(85);
    expect(evaluate(missionsById.m03, m03Pass, 3).badge).toBe('silver');
    expect(
      evaluate(missionsById.m01, missionsById.m01.initialModel, 0).score
    ).toBe(33);
  });

  it('D01b: repeat evaluation 100 times, order invariance, and input immutability', () => {
    const fxPass = JSON.parse(
      readFileSync(join(__dirname, 'fixtures', 'm02-pass.json'), 'utf8')
    );
    const before = JSON.stringify(fxPass.model);
    const first = evaluate(missionsById.m02, fxPass.model, 0);
    for (let i = 0; i < 100; i++) {
      expect(evaluate(missionsById.m02, fxPass.model, 0)).toEqual(first);
    }
    const reversedElements = {
      ...fxPass.model,
      elements: [...fxPass.model.elements].reverse(),
    };
    expect(evaluate(missionsById.m02, reversedElements, 0)).toEqual(first);
    expect(JSON.stringify(fxPass.model)).toBe(before);
  });

  it('D02 & D03: commit height 3000, undo, redo; failed command preserves history', () => {
    let session = createInitialSession(missionsById.m01);
    const r1 = updateElementProperty(session, 'w1', 'height', '3000');
    expect(r1.ok).toBe(true);
    session = r1.state;
    expect(session.model.elements.find((e) => e.id === 'w1')?.height).toBe(3000);
    expect(session.past.length).toBe(1);

    session = undoCommand(session);
    expect(session.model.elements.find((e) => e.id === 'w1')?.height).toBe(2800);
    expect(session.future.length).toBe(1);

    session = redoCommand(session);
    expect(session.model.elements.find((e) => e.id === 'w1')?.height).toBe(3000);

    // Undo then make a different valid edit clears redo stack
    session = undoCommand(session);
    expect(session.future.length).toBe(1);

    // Failed edit does NOT clear redo stack or mutate state
    const badRes = updateElementProperty(session, 'w1', 'height', 'abc');
    expect(badRes.ok).toBe(false);
    expect(badRes.state.future.length).toBe(1);

    const r2 = updateElementProperty(session, 'w1', 'height', 2950);
    expect(r2.ok).toBe(true);
    expect(r2.state.future.length).toBe(0);
  });

  it('D04: create wall with duplicate ID, zero length, diagonal, missing level rejected atomically', () => {
    const session = createInitialSession(missionsById.m02);
    const snap = JSON.stringify(session.model);

    // Zero length
    const zeroRes = createWallCommand(session, {
      name: 'w_zero',
      baseLevelId: 'l0',
      startX: 0,
      startZ: 0,
      endX: 0,
      endZ: 0,
      height: 3000,
      thickness: 200,
    });
    expect(zeroRes.ok).toBe(false);
    expect(JSON.stringify(zeroRes.state.model)).toBe(snap);

    // Diagonal
    const diagRes = createWallCommand(session, {
      name: 'w_diag',
      baseLevelId: 'l0',
      startX: 0,
      startZ: 0,
      endX: 3000,
      endZ: 4000,
      height: 3000,
      thickness: 200,
    });
    expect(diagRes.ok).toBe(false);
    expect(JSON.stringify(diagRes.state.model)).toBe(snap);

    // Missing level
    const lvlRes = createWallCommand(session, {
      name: 'w_lvl',
      baseLevelId: 'l_missing',
      startX: 0,
      startZ: 0,
      endX: 6000,
      endZ: 0,
      height: 3000,
      thickness: 200,
    });
    expect(lvlRes.ok).toBe(false);
    expect(JSON.stringify(lvlRes.state.model)).toBe(snap);

    // Valid wall then duplicate ID
    const validRes = createWallCommand(session, {
      id: 'w1',
      name: 'w_south',
      baseLevelId: 'l0',
      startX: 0,
      startZ: 0,
      endX: 6000,
      endZ: 0,
      height: 3000,
      thickness: 200,
    });
    expect(validRes.ok).toBe(true);
    const dupRes = createWallCommand(validRes.state, {
      id: 'w1',
      name: 'w_dup',
      baseLevelId: 'l0',
      startX: 6000,
      startZ: 0,
      endX: 6000,
      endZ: 4000,
      height: 3000,
      thickness: 200,
    });
    expect(dupRes.ok).toBe(false);
  });

  it('D05: delete host wall with live door or change door host to invalid one is rejected', () => {
    const customTask: MissionTask = {
      ...missionsById.m02,
      permissions: {
        ...missionsById.m02.permissions,
        creatableTypes: ['wall', 'door'],
        editableFields: [
          ...missionsById.m02.permissions.editableFields,
          'hostWallId',
          'offset',
          'width',
          'sill',
          'mark',
          'fireRating',
        ],
      },
    };
    let session = createInitialSession(customTask);
    const wRes = createWallCommand(session, {
      id: 'w1',
      name: 'w_south',
      baseLevelId: 'l0',
      startX: 0,
      startZ: 0,
      endX: 6000,
      endZ: 0,
      height: 3000,
      thickness: 200,
    });
    expect(wRes.ok).toBe(true);
    session = wRes.state;

    const dRes = createDoorCommand(session, {
      id: 'd1',
      name: 'Kapı 1',
      hostWallId: 'w1',
      offset: 2550,
      width: 900,
      height: 2100,
      sill: 0,
      mark: 'D-01',
      fireRating: 'none',
    });
    expect(dRes.ok).toBe(true);
    session = dRes.state;

    // Try deleting w1 while d1 is hosted on it
    const delHost = deleteElementCommand(session, 'w1');
    expect(delHost.ok).toBe(false);
    if (!delHost.ok) {
      expect(delHost.error.code).toBe('E_DELETE_HOST_WITH_DOOR');
    }

    // Try changing d1 hostWallId to nonexistent wall
    const badHost = updateElementProperty(session, 'd1', 'hostWallId', 'w_nonexistent');
    expect(badHost.ok).toBe(false);
  });

  it('D06 & D13: editing or reversing an m03 seed wall fails permission check', () => {
    const session = createInitialSession(missionsById.m03);
    const editHeight = updateElementProperty(session, 'w_south', 'height', 3100);
    expect(editHeight.ok).toBe(false);

    const reverseStart = updateElementProperty(
      session,
      'w_south',
      'start',
      [6000, 0]
    );
    expect(reverseStart.ok).toBe(false);
  });

  it('D07: empty, comma, fractional, exponential, NaN, and out-of-range inputs rejected', () => {
    const session = createInitialSession(missionsById.m01);
    for (const bad of ['', '   ', '3000,5', '3000.5', '3e3', '1e4', NaN, Infinity, 0, 25000]) {
      const res = updateElementProperty(session, 'w1', 'height', bad);
      expect(res.ok, `Expected ${String(bad)} to be rejected`).toBe(false);
    }
  });

  it('D08: revealing h1 twice then h2 keeps distinct set size 2 and deducts 10 points', () => {
    let session = createInitialSession(missionsById.m01);
    session = revealNextHintCommand(session, 'h1');
    session = revealNextHintCommand(session, 'h1');
    session = revealNextHintCommand(session, 'h2');
    expect(session.revealedHints).toEqual(['h1', 'h2']);

    for (const id of ['w1', 'w2', 'w3', 'w4']) {
      const r = updateElementProperty(session, id, 'height', 3000);
      if (r.ok) session = r.state;
    }
    const evalRes = evaluate(session.task, session.model, session.revealedHints.length);
    expect(evalRes.pass).toBe(true);
    expect(evalRes.score).toBe(90);
    expect(evalRes.badge).toBe('gold');
  });

  it('D09: editing model after passing submission marks result stale; best completion persists', () => {
    let session = createInitialSession(missionsById.m01);
    for (const id of ['w1', 'w2', 'w3', 'w4']) {
      const r = updateElementProperty(session, id, 'height', 3000);
      if (r.ok) session = r.state;
    }
    const evalRes = evaluate(session.task, session.model, 0);
    session = {
      ...session,
      lastEvaluation: {
        ...evalRes,
        evaluatedRevision: session.revision,
        stale: false,
      },
    };
    let save = createDefaultSaveEnvelope();
    save = recordPassingScore(save, 'm01', evalRes.score);
    expect(save.completed.m01.bestScore).toBe(100);

    // Edit after pass
    const afterEdit = updateElementProperty(session, 'w1', 'height', 2800);
    expect(afterEdit.ok).toBe(true);
    expect(afterEdit.state.lastEvaluation?.stale).toBe(true);

    // Best score never decreases
    save = recordPassingScore(save, 'm01', 85);
    expect(save.completed.m01.bestScore).toBe(100);
  });

  it('D10, D11, D12, D14: persistence validation, quota fallback, oversize & hostile save rejection', () => {
    const validSave = createDefaultSaveEnvelope();
    validSave.completed.m01 = { bestScore: 95 };
    validSave.drafts.m01 = {
      model: missionsById.m01.initialModel,
      revealedHints: ['h1'],
    };

    const parsedValid = parseAndValidateSaveJson(
      JSON.stringify(validSave),
      missionsById
    );
    expect(parsedValid.ok).toBe(true);

    // Corrupt JSON
    const corrupt = parseAndValidateSaveJson('{not-json', missionsById);
    expect(corrupt.ok).toBe(false);
    if (!corrupt.ok) expect(corrupt.reason).toBe('E_CORRUPT_JSON');

    // Unknown version
    const unknownVer = parseAndValidateSaveJson(
      JSON.stringify({ ...validSave, saveVersion: 2 }),
      missionsById
    );
    expect(unknownVer.ok).toBe(false);
    if (!unknownVer.ok) expect(unknownVer.reason).toBe('E_UNKNOWN_VERSION');

    // Unknown hint ID
    const badHint = parseAndValidateSaveJson(
      JSON.stringify({
        ...validSave,
        drafts: {
          m01: { model: missionsById.m01.initialModel, revealedHints: ['h99'] },
        },
      }),
      missionsById
    );
    expect(badHint.ok).toBe(false);

    // Score 101 rejected
    const score101 = parseAndValidateSaveJson(
      JSON.stringify({
        ...validSave,
        completed: { m01: { bestScore: 101 } },
      }),
      missionsById
    );
    expect(score101.ok).toBe(false);

    // Hostile extra field rejected
    const extraField = parseAndValidateSaveJson(
      JSON.stringify({ ...validSave, evil: true }),
      missionsById
    );
    expect(extraField.ok).toBe(false);

    // Prototype pollution string rejected
    const protoRaw =
      '{"saveVersion":1,"contentVersion":"1.0.0","__proto__":{"polluted":true},"completed":{},"drafts":{},"settings":{"sound":false,"reducedMotion":false}}';
    const protoRes = parseAndValidateSaveJson(protoRaw, missionsById);
    expect(protoRes.ok).toBe(false);

    // Oversize (>1 MiB) rejected
    const huge = 'x'.repeat(1024 * 1024 + 10);
    const oversizeRes = parseAndValidateSaveJson(huge, missionsById);
    expect(oversizeRes.ok).toBe(false);
    if (!oversizeRes.ok) expect(oversizeRes.reason).toBe('E_OVERSIZE');

    // Storage throw / quota fallback (D11)
    const throwingStorage = {
      getItem(): string | null {
        throw new Error('SecurityError');
      },
      setItem(): void {
        throw new Error('QuotaExceededError');
      },
    };
    const loadOut = loadFromBrowserStorage(missionsById, throwingStorage);
    expect(loadOut.storageWarning).toBeTruthy();
    const writeOut = writeToBrowserStorage(validSave, throwingStorage);
    expect(writeOut.ok).toBe(false);
  });

  it('P01: evaluates deterministic 500-element scene in <= 50ms p95 over 100 warmed runs', () => {
    const elements: BimModel['elements'] = [];
    for (let i = 1; i <= 500; i++) {
      elements.push({
        id: `w${i}`,
        type: 'wall',
        name: `Duvar_${i}`,
        baseLevelId: 'l0',
        start: [0, i * 100],
        end: [6000, i * 100],
        height: 3000,
        thickness: 200,
      });
    }
    const syntheticModel: BimModel = {
      levels: [{ id: 'l0', elevation: 0, name: 'Zemin Kat' }],
      elements,
    };
    const syntheticTask: MissionTask = {
      ...missionsById.m02,
      criteria: [
        {
          id: 'c_count_500',
          type: 'count',
          elementType: 'wall',
          expected: 500,
          message: '500 duvar kontrolü.',
        },
      ],
    };

    // Warmup
    for (let i = 0; i < 5; i++) {
      evaluate(syntheticTask, syntheticModel, 0);
    }

    const durations: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = performance.now();
      const res = evaluate(syntheticTask, syntheticModel, 0);
      const t1 = performance.now();
      expect(res.pass).toBe(true);
      durations.push(t1 - t0);
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)];
    expect(p95).toBeLessThanOrEqual(50);
  });

  it('validates schema/semantic edge cases matches reference test.mjs', () => {
    expect(modelErrors({ levels: [], elements: [] })).toEqual(['E_SCHEMA']);
    expect(taskErrors({ bad: true })).toEqual(['E_TASK_SCHEMA']);
    expect(
      permissionErrors(missionsById.m03, {
        ...missionsById.m03.initialModel,
        levels: [{ id: 'l0', elevation: 100, name: 'Zemin Kat' }],
      })
    ).toContain('E_LEVELS_IMMUTABLE');
  });

  it('D15: Wall translation (moveWallCommand) translates start & end atomically and supports undo/redo', async () => {
    const { moveWallCommand } = await import('../src/domain/commands');
    let state = createInitialSession(missionsById.m02);
    const created = createWallCommand(state, {
      name: 'w_south',
      baseLevelId: 'l0',
      startX: 0,
      startZ: 0,
      endX: 6000,
      endZ: 0,
      height: 3000,
      thickness: 200,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    state = created.state;

    // Move wall by dx=500, dz=1000
    const moved = moveWallCommand(state, 'w1', 500, 1000);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    const wMoved = moved.state.model.elements[0];
    expect(wMoved.type === 'wall' && wMoved.start).toEqual([500, 1000]);
    expect(wMoved.type === 'wall' && wMoved.end).toEqual([6500, 1000]);

    // Undo restores original coordinates [0,0]->[6000,0]
    const undone = undoCommand(moved.state);
    const wUndone = undone.model.elements[0];
    expect(wUndone.type === 'wall' && wUndone.start).toEqual([0, 0]);
    expect(wUndone.type === 'wall' && wUndone.end).toEqual([6000, 0]);

    // Locked seed walls in m03 cannot be moved
    const m03State = createInitialSession(missionsById.m03);
    const lockedMove = moveWallCommand(m03State, 'w_south', 500, 0);
    expect(lockedMove.ok).toBe(false);
  });

  it('D16: Pedagogical feedback explains WHY a criterion failed and HOW to fix it (e.g. wrong door hostWallId)', async () => {
    const {
      explainCriterionFailureTr,
      calculateMissionXp,
      calculateTotalPlayerXp,
    } = await import('../src/domain/pedagogy');

    // Place door d1 on wrong host wall (w_north instead of w_south) in m03
    let state = createInitialSession(missionsById.m03);
    const wrongDoor = createDoorCommand(state, {
      name: 'Giriş Kapısı',
      hostWallId: 'w_north',
      offset: 2550,
      width: 900,
      height: 2100,
      sill: 0,
      mark: 'D-01',
      fireRating: 'none',
    });
    expect(wrongDoor.ok).toBe(true);
    if (!wrongDoor.ok) return;

    const evalRes = evaluate(missionsById.m03, wrongDoor.state.model, 0);
    expect(evalRes.pass).toBe(false);
    const hostCrit = evalRes.criteria.find((c) => c.id === 'c_host')!;
    expect(hostCrit.pass).toBe(false);

    const explanation = explainCriterionFailureTr(
      missionsById.m03,
      wrongDoor.state.model,
      hostCrit
    );
    expect(explanation).toContain('Neden Yanlış');
    expect(explanation).toContain('Nasıl Düzeltilir');
    expect(explanation).toContain('w_north');
    expect(explanation).toContain('w_south');

    // XP calculation check
    expect(calculateMissionXp(100)).toBe(200);
    const xpSummary = calculateTotalPlayerXp({
      m01: { bestScore: 100 },
      m02: { bestScore: 95 },
    });
    expect(xpSummary.totalXp).toBe(390);
    expect(xpSummary.level).toBe(2);
  });

  it('D17: 10-Chapter / 61-Mission Revit architecture & all 61 playable missions validate without engine changes', async () => {
    const { SIX_CHAPTER_CURRICULUM, SEVEN_CHAPTER_CURRICULUM, getTotalCurriculumMissionCount } =
      await import('../src/content/curriculum');
    expect(SEVEN_CHAPTER_CURRICULUM).toHaveLength(10);
    expect(SIX_CHAPTER_CURRICULUM).toHaveLength(10);
    expect(getTotalCurriculumMissionCount()).toBe(61);
    expect(catalogRes.catalog.missions).toHaveLength(61);

    // Every single mission m01..m50 starts in a failing state and has valid schema
    for (const task of catalogRes.catalog.missions) {
      expect(taskErrors(task)).toEqual([]);
      expect(evaluate(task, task.initialModel, 0).pass).toBe(false);
    }

    // Define Mission 4 purely via JSON data using existing schema & criteria
    const mission04Json: MissionTask = {
      schemaVersion: '1.0',
      contentVersion: '1.0.0',
      id: 'm04',
      title: 'İç Bölme Duvarı ve Aks Hizalama',
      prerequisites: ['m03'],
      estimatedMinutes: 5,
      objective:
        'Odayı ikiye bölen 100 mm kalınlığında ve 3000 mm yüksekliğinde w_part iç bölme duvarını oluşturun.',
      recap:
        'İç bölme duvarları taşıyıcı dış kabuktan daha ince (100 mm) modellenir ve aynı kat referansına bağlanır.',
      initialModel: missionsById.m03.initialModel,
      permissions: {
        creatableTypes: ['wall'],
        editableSeedIds: [],
        editableFields: ['start', 'end', 'height', 'thickness', 'name'],
        deletableCreated: true,
      },
      criteria: [
        {
          id: 'c_wall_count',
          type: 'count',
          elementType: 'wall',
          expected: 5,
          message: 'Modelde 4 dış + 1 iç bölme olmak üzere 5 duvar bulunmalıdır.',
        },
        {
          id: 'c_part_thick',
          type: 'property',
          elementId: 'w1',
          field: 'thickness',
          expected: 100,
          tolerance: 0,
          message: 'Yeni iç bölme duvarının (w1) kalınlığı 100 mm olmalıdır.',
        },
      ],
      hints: [
        { id: 'h1', text: 'Duvar Oluştur aracını açın.' },
        { id: 'h2', text: 'Kalınlığı 100 mm olarak girin.' },
        { id: 'h3', text: '(3000,0) ile (3000,4000) arasına iç duvarı çizin.' },
      ],
    };

    expect(taskErrors(mission04Json)).toEqual([]);
    let s4 = createInitialSession(mission04Json);
    const addPart = createWallCommand(s4, {
      name: 'İç Bölme',
      baseLevelId: 'l0',
      startX: 3000,
      startZ: 0,
      endX: 3000,
      endZ: 4000,
      height: 3000,
      thickness: 100,
    });
    expect(addPart.ok).toBe(true);
    if (!addPart.ok) return;
    const evalM04 = evaluate(mission04Json, addPart.state.model, 0);
    expect(evalM04.pass).toBe(true);
    expect(evalM04.score).toBe(100);

    // Ensure existing save with m01..m03 + m04 validates cleanly
    const extendedTasks = { ...missionsById, m04: mission04Json };
    const saveWithM04 = JSON.stringify({
      saveVersion: 1,
      contentVersion: '1.0.0',
      completed: {
        m01: { bestScore: 100 },
        m02: { bestScore: 100 },
        m03: { bestScore: 100 },
        m04: { bestScore: 95 },
      },
      drafts: {
        m04: {
          model: addPart.state.model,
          revealedHints: ['h1'],
        },
      },
      settings: { sound: false, reducedMotion: false },
    });
    const parsedSave = parseAndValidateSaveJson(saveWithM04, extendedTasks);
    expect(parsedSave.ok).toBe(true);
  });
});


describe('Guide walkthrough star penalty', () => {
  const gold = { pass: true, score: 100, badge: 'gold' as const, errors: [], criteria: [] };

  it('caps gold at silver when the final walkthrough was used', () => {
    expect(capBadgeForWalkthrough(gold, true).badge).toBe('silver');
  });

  it('leaves the result untouched otherwise', () => {
    expect(capBadgeForWalkthrough(gold, false)).toBe(gold);
    const silver = { ...gold, badge: 'silver' as const };
    expect(capBadgeForWalkthrough(silver, true).badge).toBe('silver');
  });
});
