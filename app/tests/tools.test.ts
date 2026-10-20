import { describe, expect, it } from 'vitest';
import {
  addLevelCommand,
  createInitialSession,
  updateElementProperty,
  type CommandResult,
  type MissionSessionState,
} from '../src/domain/commands';
import { roomBoundary } from '../src/domain/derived';
import type { BimModel, MissionTask, Point, RoomElement } from '../src/domain/types';
import { lockAxis, projectOnWall, snapPoint } from '../src/plan/snap';
import {
  EMPTY_CHAIN,
  canMoveOpening,
  floorFromWalls,
  gridTap,
  placeOpening,
  placeRoomAt,
  roofFromWalls,
  stairAt,
  wallChainTap,
  type ChainState,
} from '../src/ui/workspace/toolActions';

const empty: BimModel = { levels: [{ id: 'l0', elevation: 0, name: 'Zemin' }, { id: 'l1', elevation: 3000, name: 'Kat 1' }], elements: [] };

const sandbox = (model: BimModel = empty): MissionSessionState => {
  const task: MissionTask = {
    schemaVersion: '1.0',
    contentVersion: '1.0.0',
    id: 'm98',
    title: 'Sandbox',
    objective: 'x',
    prerequisites: [],
    estimatedMinutes: 1,
    initialModel: model,
    permissions: {
      editableFields: ['offset', 'elevation', 'height', 'width'],
      creatableTypes: ['wall', 'door', 'window', 'floor', 'roof', 'room', 'stair', 'grid'],
      deletableCreated: true,
      editableSeedIds: [],
    },
    hints: [{ id: 'h1', text: 'a' }, { id: 'h2', text: 'b' }, { id: 'h3', text: 'c' }],
    recap: 'r',
    criteria: [{ id: 'c1', type: 'exists', category: 'wall', message: 'x' }],
  };
  return createInitialSession(task);
};

const ok = (r: CommandResult | null): MissionSessionState => {
  expect(r, 'result missing').not.toBeNull();
  expect(r!.ok, JSON.stringify(r && !r.ok && r.error)).toBe(true);
  return r!.state;
};

const D = { baseLevelId: 'l0', height: 3000, thickness: 200 };

function drawRoom(s: MissionSessionState): MissionSessionState {
  let chain: ChainState = EMPTY_CHAIN;
  const taps: Point[] = [[0, 0], [6000, 0], [6000, 4000], [0, 4000], [0, 0]];
  for (const t of taps) {
    const o = wallChainTap(s, chain, t, D);
    if (o.result) s = ok(o.result);
    chain = o.next;
  }
  expect(chain).toEqual(EMPTY_CHAIN); // closed loop ends the chain
  return s;
}

describe('Faz 2 — snap', () => {
  it('wall end points win over everything', () => {
    const s = drawRoom(sandbox());
    expect(snapPoint([5900, 120], s.model)).toEqual({ point: [6000, 0], kind: 'endpoint' });
  });

  it('Grid lines capture one coordinate, intersections capture both', () => {
    const m: BimModel = {
      ...empty,
      elements: [
        { id: 'g1', type: 'grid', name: 'A', start: [3050, -1000], end: [3050, 5000] },
        { id: 'g2', type: 'grid', name: '1', start: [-1000, 1020], end: [7000, 1020] },
      ],
    };
    expect(snapPoint([3000, 1100], m)).toEqual({ point: [3050, 1020], kind: 'gridline' });
    expect(snapPoint([3000, 2000], m)).toEqual({ point: [3050, 2000], kind: 'gridline' });
    expect(snapPoint([1234, 2345], m)).toEqual({ point: [1200, 2300], kind: 'grid' });
  });

  it('axis lock and projection', () => {
    expect(lockAxis([0, 0], [900, 200])).toEqual([900, 0]);
    expect(lockAxis([0, 0], [100, 700])).toEqual([0, 700]);
    const w = drawRoom(sandbox()).model.elements[0];
    if (w.type !== 'wall') throw new Error('wall expected');
    expect(projectOnWall(w, [2500, 80])).toBe(2500);
    expect(projectOnWall(w, [9000, 0])).toBe(6000);
  });
});

describe('Faz 2 — araçlar (dokunarak modelleme)', () => {
  it('4 dokunuşla zincirleme kapalı oda, kapı ve oda yerleştirme', () => {
    let s = drawRoom(sandbox());
    expect(s.model.elements.filter((e) => e.type === 'wall')).toHaveLength(4);

    const south = s.model.elements.find((e) => e.id === 'w1');
    if (!south || south.type !== 'wall') throw new Error('w1');
    s = ok(placeOpening(s, 'door', south, 3000, { width: 900, height: 2100, sill: 0 }));
    expect(s.model.elements.find((e) => e.type === 'door')).toMatchObject({ hostWallId: 'w1', offset: 2550 });

    const room = placeRoomAt(s, 'l0', [3000, 2000]);
    s = ok(room.result);
    const r = s.model.elements.find((e) => e.type === 'room') as RoomElement;
    expect(roomBoundary(r, s.model).open).toBe(false);
    expect(r.number).toBe('101');
  });

  it('açık alanda oda oluşmaz, boşluk işaretlenir', () => {
    let s = sandbox();
    let chain: ChainState = EMPTY_CHAIN;
    for (const t of [[0, 0], [6000, 0], [6000, 4000], [0, 4000]] as Point[]) {
      const o = wallChainTap(s, chain, t, D);
      if (o.result) s = ok(o.result);
      chain = o.next;
    }
    expect(chain.start).toEqual([0, 4000]); // chain still running: 3 walls
    const room = placeRoomAt(s, 'l0', [3000, 2000]);
    expect(room.result).toBeNull();
    expect(room.gapAt).toBeDefined();
  });

  it('eğri dokunuş eksene kilitlenir; aynı noktaya dokunmak duvar üretmez', () => {
    const s = sandbox();
    const a = wallChainTap(s, EMPTY_CHAIN, [0, 0], D);
    const b = wallChainTap(s, a.next, [3000, 300], D);
    const st = ok(b.result);
    expect(st.model.elements[0]).toMatchObject({ start: [0, 0], end: [3000, 0] });
    const c = wallChainTap(st, b.next, [3000, 0], D);
    expect(c.result).toBeNull();
  });

  it('kapı/pencere duvar dışına taşmaz; geçersiz kaydırma reddedilir', () => {
    let s = drawRoom(sandbox());
    const south = s.model.elements.find((e) => e.id === 'w1');
    if (!south || south.type !== 'wall') throw new Error('w1');
    s = ok(placeOpening(s, 'window', south, 100, { width: 1200, height: 1200, sill: 900 }));
    const win = s.model.elements.find((e) => e.type === 'window');
    expect(win).toMatchObject({ offset: 0 }); // clamped to the wall start
    expect(canMoveOpening(s, win!.id, 5000)).toBe(false); // runs past the wall end
    expect(canMoveOpening(s, win!.id, 1500)).toBe(true);
  });

  it('Pick Walls: seçilen duvarlardan döşeme ve çatı', () => {
    let s = drawRoom(sandbox());
    s = ok(floorFromWalls(s, 'l0', ['w1', 'w2', 'w3', 'w4']));
    const floor = s.model.elements.find((e) => e.type === 'floor');
    expect(floor).toMatchObject({ boundary: [[0, 0], [6000, 0], [6000, 4000], [0, 4000]] });
    s = ok(roofFromWalls(s, 'l1', [], 25, 400));
    expect(s.model.elements.find((e) => e.type === 'roof')).toMatchObject({ baseLevelId: 'l1', slope: 25, overhang: 400 });
  });

  it('Aks aracı iki dokunuş, otomatik ad', () => {
    let s = sandbox();
    const a = gridTap(s, null, [0, -1000]);
    const b = gridTap(s, a.next, [0, 5000]);
    s = ok(b.result);
    const c = gridTap(s, null, [-1000, 0]);
    const d = gridTap(s, c.next, [7000, 0]);
    s = ok(d.result);
    expect(s.model.elements.map((e) => (e.type === 'grid' ? e.name : ''))).toEqual(['A', '1']);
  });

  it('Merdiven tek dokunuş', () => {
    const s = ok(stairAt(sandbox(), [1000, 1000], { baseLevelId: 'l0', topLevelId: 'l1', direction: 'x+', risers: 17, riserHeight: 176 }));
    expect(s.model.elements[0]).toMatchObject({ type: 'stair', start: [1000, 1000], risers: 17 });
  });

  it('Kat ekleme; yeni kat kotu +3000', () => {
    const s = ok(addLevelCommand(sandbox()));
    expect(s.model.levels.map((l) => l.id)).toEqual(['l0', 'l1', 'l2']);
    expect(s.model.levels[2].elevation).toBe(6000);
  });

  it('kapı yönü çevirme izinsiz de çalışır (kozmetik)', () => {
    let s = drawRoom(sandbox());
    const south = s.model.elements[0];
    if (south.type !== 'wall') throw new Error('wall');
    s = ok(placeOpening(s, 'door', south, 3000, { width: 900, height: 2100, sill: 0 }));
    const door = s.model.elements.find((e) => e.type === 'door')!;
    const flipped = ok(updateElementProperty(s, door.id, 'flip', true));
    expect(flipped.model.elements.find((e) => e.id === door.id)).toMatchObject({ flip: true });
  });
});
