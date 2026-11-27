import { describe, expect, it } from 'vitest';
import type { GameState } from './types';
import {
  activitiesAtWithMap,
  beginPlanning,
  createGame,
  nextWeek,
  normalizeLoaded,
  payDebt,
  previewPlanWithMap,
  priorityOrder,
  resolveNextSlotWithMap,
  submitPlan,
} from './core';
import { deserialize, serialize } from './save';
import { testMap } from './__fixtures__/testMap';
import { act, makeGame, patchPlayer, playWeek, player, resolveAll, submitAll } from './__fixtures__/helpers';

const resolve = (s: GameState) => resolveNextSlotWithMap(s, testMap);
const result = (s: GameState, slot: number, id: string) => {
  const r = s.slotResults[slot].find((x) => x.playerId === id);
  if (!r) throw new Error('no result');
  return r;
};

describe('createGame', () => {
  it('ตั้งค่าเริ่มต้นตามกติกา', () => {
    const s = makeGame(3, ['h1', 'h2', 'h1'], 2);
    expect(s.phase).toBe('handoff');
    expect(s.week).toBe(1);
    expect(s.firstSeat).toBe(2);
    expect(s.planningPlayerId).toBe('p3');
    expect(s.saveVersion).toBe(1);
    expect(s.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    for (const p of s.players) {
      expect(p).toMatchObject({ coins: 6, energy: 5, time: 8, hasSkill: false, skillShifts: 0, debt: 0 });
      expect(p.position).toBe(p.homeNodeId);
    }
  });
  it('ตรวจจำนวนผู้เล่นและตัวละครซ้ำ', () => {
    const pl = (c: 'manao' | 'ton') => ({ name: 'a', characterId: c, homeNodeId: 'h1' });
    expect(() => createGame({ mapId: 'canal', players: [pl('manao')] })).toThrow();
    expect(() => createGame({ mapId: 'canal', players: [pl('manao'), pl('manao')] })).toThrow();
    expect(() => makeGame(9)).toThrow();
    expect(() => makeGame(8)).not.toThrow();
  });
  it('ใช้ Math.random เป็นค่าเริ่มต้น และ firstSeat อยู่ในช่วงเสมอ', () => {
    const s = createGame({ mapId: 'canal', players: [
      { name: 'a', characterId: 'manao', homeNodeId: 'h1' },
      { name: 'b', characterId: 'ton', homeNodeId: 'h2' },
    ] });
    expect([0, 1]).toContain(s.firstSeat);
    const s2 = createGame({ mapId: 'canal', players: s.players.map((p) => ({ name: p.name, characterId: p.characterId, homeNodeId: p.homeNodeId })) }, () => 0.9999999);
    expect(s2.firstSeat).toBe(1);
  });
});

describe('การวางแผน (hot-seat)', () => {
  it('handoff → planning → handoff คนถัดไป → reveal', () => {
    let s = makeGame(2, undefined, 1);
    expect(submitPlan(s, 'p2', [])).toBe(s); // ยังไม่ใช่ planning
    s = beginPlanning(s);
    expect(s.phase).toBe('planning');
    expect(beginPlanning(s)).toBe(s);
    expect(submitPlan(s, 'p1', [])).toBe(s); // ไม่ใช่ตาของ p1
    s = submitPlan(s, 'p2', [act(['h2', 'j1'])]);
    expect(s.phase).toBe('handoff');
    expect(s.planningPlayerId).toBe('p1');
    s = beginPlanning(s);
    expect(submitPlan(s, 'p2', [])).toBe(s); // ส่งซ้ำ
    s = submitPlan(s, 'p1', []);
    expect(s.phase).toBe('reveal');
    expect(s.planningPlayerId).toBeNull();
    expect(s.slotsResolved).toBe(0);
  });
  it('เติมช่วงที่ขาดเป็น "ผ่าน" ณ ตำแหน่งที่คาดไว้', () => {
    const s = submitAll(makeGame(2), { p1: [act(['h1', 'j1', 'w1'], 'work')] });
    expect(s.plans.p1.actions).toEqual([act(['h1', 'j1', 'w1'], 'work'), act(['w1']), act(['w1'])]);
    expect(s.plans.p2.actions).toEqual([act(['h2']), act(['h2']), act(['h2'])]);
  });
  it('รับไม่เกิน 3 ช่วง', () => {
    const s = submitAll(makeGame(2), { p1: [act(['h1']), act(['h1']), act(['h1']), act(['h1', 'j1'])] });
    expect(s.plans.p1.actions).toHaveLength(3);
  });
  it('normalizeLoaded: planning → handoff', () => {
    const s = beginPlanning(makeGame(2));
    expect(normalizeLoaded(s).phase).toBe('handoff');
    const h = makeGame(2);
    expect(normalizeLoaded(h)).toBe(h);
  });
});

describe('การเดิน', () => {
  it('เดินสำเร็จ หักเวลาเดิน + กิจกรรม', () => {
    let s = submitAll(makeGame(2), { p1: [act(['h1', 'j1', 'w1'], 'work')] });
    s = resolve(s);
    const r = result(s, 0, 'p1');
    expect(r).toMatchObject({ moved: true, moveCost: 2, success: true, endNodeId: 'w1', delta: { coins: 3, energy: -1, time: -4 } });
    expect(player(s, 'p1')).toMatchObject({ position: 'w1', time: 4, coins: 9, energy: 4 });
  });
  it('ต้นทางไม่ตรงตำแหน่งจริง → ข้ามทั้งช่วง ไม่หักอะไร', () => {
    let s = submitAll(makeGame(2), { p1: [act(['h2', 'j1', 'w1'], 'work')] });
    s = resolve(s);
    expect(result(s, 0, 'p1')).toMatchObject({ moved: false, success: false, reason: 'INVALID_PATH', moveCost: 0, delta: { coins: 0, energy: 0, time: 0 }, endNodeId: 'h1' });
    expect(result(s, 0, 'p1').reasonText).toBeTruthy();
    expect(player(s, 'p1')).toMatchObject({ position: 'h1', time: 8, coins: 6 });
  });
  it('ไม่มีเส้นเชื่อม → INVALID_PATH', () => {
    const s = resolve(submitAll(makeGame(2), { p1: [act(['h1', 'w1'], 'work')] }));
    expect(result(s, 0, 'p1').reason).toBe('INVALID_PATH');
  });
  it('ช่วงก่อนเดินพลาด ทำให้ช่วงถัดไปต้นทางไม่ตรงด้วย', () => {
    const s = resolveAll(submitAll(makeGame(2), { p1: [act(['h1', 'w1']), act(['w1', 'l1'])] }));
    expect(result(s, 1, 'p1').reason).toBe('INVALID_PATH');
    expect(player(s, 'p1').position).toBe('h1');
  });
  it('เวลาไม่พอเดิน → ข้ามทั้งช่วง', () => {
    // h1 → pk → f8 = 3 + 8 = 11 เส้น; แบ่งเป็นช่วงแรก 7 เส้น ช่วงสอง 4 เส้น (เหลือเวลา 1)
    const p1 = ['h1', 'j1', 's1', 'pk', 'f1', 'f2', 'f3', 'f4'];
    const p2 = ['f4', 'f5', 'f6', 'f7', 'f8'];
    const s = resolveAll(submitAll(makeGame(2), { p1: [act(p1), act(p2)] }));
    expect(result(s, 0, 'p1')).toMatchObject({ moved: true, moveCost: 7 });
    expect(result(s, 1, 'p1')).toMatchObject({ moved: false, reason: 'NOT_ENOUGH_TIME_TO_MOVE', delta: { time: 0 } });
    expect(player(s, 'p1')).toMatchObject({ position: 'f4', time: 1 });
  });
  it('เดินได้แต่ทำกิจกรรมผิดที่ → หักแค่เวลาเดิน อยู่ปลายทาง', () => {
    const s = resolve(submitAll(makeGame(2), { p1: [act(['h1', 'j1'], 'work')] }));
    expect(result(s, 0, 'p1')).toMatchObject({ moved: true, success: false, reason: 'WRONG_PLACE', delta: { coins: 0, energy: 0, time: -1 }, endNodeId: 'j1' });
    expect(player(s, 'p1')).toMatchObject({ position: 'j1', time: 7 });
  });
  it('เดินสองทิศและทุกคนเดินก่อนทำกิจกรรม', () => {
    const s = resolve(submitAll(makeGame(2), { p1: [act(['h1', 'j1', 'h2'], 'rest')], p2: [act(['h2', 'j1', 'h1'], 'rest')] }));
    expect(player(s, 'p1').position).toBe('h2');
    expect(player(s, 'p2').position).toBe('h1');
    expect(result(s, 0, 'p1').success).toBe(true);
  });
});

describe('ทรัพยากรไม่พอ', () => {
  it('เงินไม่พอเรียน', () => {
    const s0 = patchPlayer(makeGame(2), 'p1', { coins: 1 });
    const s = resolve(submitAll(s0, { p1: [act(['h1', 'j1', 's1'], 'study')] }));
    expect(result(s, 0, 'p1')).toMatchObject({ success: false, reason: 'NOT_ENOUGH_COINS', delta: { time: -2, coins: 0 } });
    expect(player(s, 'p1').hasSkill).toBe(false);
  });
  it('พลังไม่พอกะออฟฟิศ (ต้องมี ≥ 2)', () => {
    const s0 = patchPlayer(makeGame(2), 'p1', { energy: 1 });
    const s = resolve(submitAll(s0, { p1: [act(['h1', 'j1', 'o1'], 'office')] }));
    expect(result(s, 0, 'p1').reason).toBe('NOT_ENOUGH_ENERGY');
    const ok = resolve(submitAll(patchPlayer(makeGame(2), 'p1', { energy: 2 }), { p1: [act(['h1', 'j1', 'o1'], 'office')] }));
    expect(player(ok, 'p1')).toMatchObject({ energy: 0, coins: 11, time: 3 });
  });
  it('เวลาไม่พอทำกิจกรรม', () => {
    const s0 = patchPlayer(makeGame(2), 'p1', { time: 4 });
    const s = resolve(submitAll(s0, { p1: [act(['h1', 'j1', 'o1'], 'office')] }));
    expect(result(s, 0, 'p1')).toMatchObject({ success: false, reason: 'NOT_ENOUGH_TIME', delta: { time: -2 } });
    expect(player(s, 'p1').time).toBe(2);
  });
  it('ลำดับการตรวจ: สถานที่ก่อนทักษะ ก่อนเวลา', () => {
    const s0 = patchPlayer(makeGame(2), 'p1', { time: 2, energy: 0, coins: 0 });
    const s = resolveAll(submitAll(s0, { p1: [act(['h1', 'j1'], 'skillWork'), act(['j1', 'w1'], 'skillWork')] }));
    expect(result(s, 0, 'p1').reason).toBe('WRONG_PLACE');
    expect(result(s, 1, 'p1').reason).toBe('NO_SKILL');
  });
  it('กะใช้ทักษะต้องมีทักษะ; เรียนซ้ำไม่ได้', () => {
    const s0 = patchPlayer(makeGame(2), 'p1', { hasSkill: true });
    const s = resolveAll(submitAll(s0, { p1: [act(['h1', 'j1', 's1'], 'study'), act(['s1', 'j1', 'w1'], 'skillWork')] }));
    expect(result(s, 0, 'p1').reason).toBe('ALREADY_SKILLED');
    expect(result(s, 1, 'p1')).toMatchObject({ success: true, delta: { coins: 4, energy: -1 } });
    expect(player(s, 'p1').skillShifts).toBe(1);
    const n = resolve(submitAll(makeGame(2), { p1: [act(['h1', 'j1', 'w1'], 'skillWork')] }));
    expect(result(n, 0, 'p1').reason).toBe('NO_SKILL');
  });
  it('พักไม่เกินพลังสูงสุด 6', () => {
    const s = resolve(submitAll(makeGame(2), { p1: [act(['h1'], 'rest')] }));
    expect(player(s, 'p1').energy).toBe(6);
    expect(result(s, 0, 'p1').delta).toEqual({ coins: 0, energy: 1, time: -1 });
  });
  it('พักที่สวนได้', () => {
    const s = resolve(submitAll(patchPlayer(makeGame(2), 'p1', { energy: 1 }), { p1: [act(['h1', 'j1', 's1', 'pk'], 'rest')] }));
    expect(player(s, 'p1').energy).toBe(3);
  });
});

describe('แย่งกะ', () => {
  const both = { p1: [act(['h1', 'j1', 'w1'], 'work')], p2: [act(['h2', 'j1', 'w1'], 'work')] };
  it('ความจุ 1 (2 คน): ผู้ถือสิทธิ์ก่อนได้ อีกคน SHIFT_FULL หักแค่เวลาเดิน', () => {
    const s = resolve(submitAll(makeGame(2, undefined, 0), both));
    expect(result(s, 0, 'p1').success).toBe(true);
    expect(result(s, 0, 'p2')).toMatchObject({ success: false, reason: 'SHIFT_FULL', delta: { coins: 0, energy: 0, time: -2 } });
    // ผลเรียงตามลำดับสิทธิ์
    expect(s.slotResults[0].map((r) => r.playerId)).toEqual(['p1', 'p2']);
    const t = resolve(submitAll(makeGame(2, undefined, 1), both));
    expect(result(t, 0, 'p2').success).toBe(true);
    expect(result(t, 0, 'p1').reason).toBe('SHIFT_FULL');
    expect(t.slotResults[0].map((r) => r.playerId)).toEqual(['p2', 'p1']);
  });
  it('กะทั่วไปกับกะใช้ทักษะใช้สิทธิ์ร่วมกัน', () => {
    const s0 = patchPlayer(makeGame(2), 'p2', { hasSkill: true });
    const s = resolve(submitAll(s0, { p1: both.p1, p2: [act(['h2', 'j1', 'w1'], 'skillWork')] }));
    expect(result(s, 0, 'p2').reason).toBe('SHIFT_FULL');
  });
  it('ทำไม่สำเร็จไม่กินที่กะ', () => {
    const s0 = patchPlayer(makeGame(2), 'p1', { energy: 0 });
    const s = resolve(submitAll(s0, both));
    expect(result(s, 0, 'p1').reason).toBe('NOT_ENOUGH_ENERGY');
    expect(result(s, 0, 'p2').success).toBe(true);
  });
  it('ที่กะคืนใหม่ทุกช่วง', () => {
    const s = resolveAll(submitAll(makeGame(2), { p1: both.p1, p2: [act(['h2', 'j1', 'w1'], 'work'), act(['w1'], 'work')] }));
    expect(result(s, 1, 'p2').success).toBe(true);
  });
  it('ความจุ 2 (5 คน): สองคนแรกได้ คนที่สาม SHIFT_FULL', () => {
    const g = makeGame(5, ['h1', 'h1', 'h1', 'h1', 'h1'], 3);
    const w = [act(['h1', 'j1', 'w1'], 'work')];
    const s = resolve(submitAll(g, { p1: w, p2: w, p3: w, p4: w }));
    // ลำดับ: p4, p5, p1, p2, p3
    expect(priorityOrder(s).map((p) => p.id)).toEqual(['p4', 'p5', 'p1', 'p2', 'p3']);
    expect(result(s, 0, 'p4').success).toBe(true);
    expect(result(s, 0, 'p1').success).toBe(true);
    expect(result(s, 0, 'p2').reason).toBe('SHIFT_FULL');
    expect(result(s, 0, 'p3').reason).toBe('SHIFT_FULL');
  });
});

describe('ทำเลและร้านข้าวกล่อง', () => {
  const toL1 = (h: string) => [h, 'j1', 'w1', 'l1'];
  it('แย่งทำเล: คนแรกเปิดร้าน คนต่อไป LOT_TAKEN', () => {
    const s = resolve(submitAll(makeGame(2, undefined, 1), { p1: [act(toL1('h1'), 'openShop')], p2: [act(toL1('h2'), 'openShop')] }));
    expect(s.shops).toEqual([{ nodeId: 'l1', ownerId: 'p2' }]);
    expect(player(s, 'p2')).toMatchObject({ coins: 1, time: 4 });
    expect(result(s, 0, 'p1')).toMatchObject({ success: false, reason: 'LOT_TAKEN', delta: { coins: 0, time: -3 } });
  });
  it('เงินไม่พอเปิดร้าน', () => {
    const s = resolve(submitAll(patchPlayer(makeGame(2), 'p1', { coins: 4 }), { p1: [act(toL1('h1'), 'openShop')] }));
    expect(result(s, 0, 'p1').reason).toBe('NOT_ENOUGH_COINS');
    expect(s.shops).toEqual([]);
  });
  it('ซื้อข้าวกล่อง: จ่าย 2 ให้เจ้าของ +2 พลัง; ร้านว่าง → NO_SHOP', () => {
    const s0 = patchPlayer(makeGame(2), 'p2', { energy: 2 });
    const s = resolveAll(submitAll(s0, {
      p1: [act(toL1('h1'), 'openShop')],
      p2: [act(toL1('h2'), 'buyLunch'), act(['l1'], 'buyLunch')],
    }));
    // ช่วง 1: p1 (ก่อน) เปิดร้าน แล้ว p2 ซื้อได้ทันทีในช่วงเดียวกัน
    expect(result(s, 0, 'p2')).toMatchObject({ success: true, paidTo: 'p1', delta: { coins: -2, energy: 2, time: -4 } });
    expect(result(s, 1, 'p2')).toMatchObject({ success: true, paidTo: 'p1' });
    expect(player(s, 'p2')).toMatchObject({ coins: 2, energy: 6 });
    expect(player(s, 'p1').coins).toBe(6 - 5 + 4);
    const n = resolve(submitAll(makeGame(2), { p1: [act(toL1('h1'), 'buyLunch')] }));
    expect(result(n, 0, 'p1').reason).toBe('NO_SHOP');
  });
  it('ซื้อจากร้านตัวเอง → จ่ายกองกลาง', () => {
    const s0 = { ...patchPlayer(makeGame(2), 'p1', { energy: 1 }), shops: [{ nodeId: 'l1', ownerId: 'p1' }] };
    const s = resolve(submitAll(s0, { p1: [act(toL1('h1'), 'buyLunch')] }));
    expect(result(s, 0, 'p1').paidTo).toBeUndefined();
    expect(player(s, 'p1')).toMatchObject({ coins: 4, energy: 3 });
    expect(player(s, 'p2').coins).toBe(6);
  });
  it('activitiesAt ขึ้นกับประเภทจุดและร้าน', () => {
    const s = makeGame(2);
    expect(activitiesAtWithMap(s, testMap, 'h1')).toEqual(['rest']);
    expect(activitiesAtWithMap(s, testMap, 'pk')).toEqual(['rest']);
    expect(activitiesAtWithMap(s, testMap, 'w1')).toEqual(['work', 'skillWork']);
    expect(activitiesAtWithMap(s, testMap, 'o1')).toEqual(['office']);
    expect(activitiesAtWithMap(s, testMap, 's1')).toEqual(['study']);
    expect(activitiesAtWithMap(s, testMap, 'j1')).toEqual([]);
    expect(activitiesAtWithMap(s, testMap, 'l1')).toEqual(['openShop']);
    expect(activitiesAtWithMap({ shops: [{ nodeId: 'l1', ownerId: 'p1' }] }, testMap, 'l1')).toEqual(['buyLunch']);
    expect(activitiesAtWithMap(s, testMap, 'zzz')).toEqual([]);
  });
});

describe('พักเที่ยง (สัปดาห์คู่)', () => {
  it('จ่ายร้านละ +1 ตอนเริ่มสัปดาห์คู่ ครั้งเดียว', () => {
    let s: GameState = { ...makeGame(2), shops: [{ nodeId: 'l1', ownerId: 'p1' }, { nodeId: 'l2', ownerId: 'p1' }] };
    s = playWeek(s, {});
    expect(s.phase).toBe('weekSummary');
    s = nextWeek(s);
    expect(s.week).toBe(2);
    expect(s.lunchPaidWeek).toBe(2);
    expect(s.lunchPayouts).toEqual([{ ownerId: 'p1', nodeId: 'l1', amount: 1 }, { ownerId: 'p1', nodeId: 'l2', amount: 1 }]);
    expect(player(s, 'p1').coins).toBe(8);
    expect(player(s, 'p2').coins).toBe(6);
    expect(nextWeek(s)).toBe(s); // ไม่ใช่ weekSummary → no-op
    s = nextWeek(playWeek(s, {}));
    expect(s.week).toBe(3);
    expect(s.lunchPayouts).toEqual([]);
    expect(player(s, 'p1').coins).toBe(8);
    s = nextWeek(playWeek(s, {}));
    expect(player(s, 'p1').coins).toBe(10);
  });
  it('กันซ้ำด้วย lunchPaidWeek', () => {
    let s: GameState = { ...makeGame(2), shops: [{ nodeId: 'l1', ownerId: 'p2' }], lunchPaidWeek: 2 };
    s = nextWeek(playWeek(s, {}));
    expect(player(s, 'p2').coins).toBe(6);
  });
});

describe('ลำดับสิทธิ์', () => {
  it('หมุนทุกสัปดาห์และวนกลับ', () => {
    let s = makeGame(3, undefined, 1);
    expect(priorityOrder(s).map((p) => p.id)).toEqual(['p2', 'p3', 'p1']);
    s = nextWeek(playWeek(s, {}));
    expect(s.firstSeat).toBe(2);
    expect(s.planningPlayerId).toBe('p3');
    expect(priorityOrder(s).map((p) => p.id)).toEqual(['p3', 'p1', 'p2']);
    s = nextWeek(playWeek(s, {}));
    expect(s.firstSeat).toBe(0);
    expect(s.planningPlayerId).toBe('p1');
  });
  it('ลำดับการวางแผนตามสิทธิ์', () => {
    let s = makeGame(3, undefined, 2);
    const seen: string[] = [];
    while (s.phase === 'handoff') {
      seen.push(s.planningPlayerId as string);
      s = submitPlan(beginPlanning(s), s.planningPlayerId as string, []);
    }
    expect(seen).toEqual(['p3', 'p1', 'p2']);
  });
  it('เริ่มสัปดาห์ใหม่: เวลา 8, ล้างแผน/ผล, ยกตำแหน่ง/เงิน/พลังไป', () => {
    let s = playWeek(makeGame(2), { p1: [act(['h1', 'j1', 'w1'], 'work')] });
    s = nextWeek(s);
    expect(s.phase).toBe('handoff');
    expect(s.plans).toEqual({});
    expect(s.slotResults).toEqual([]);
    expect(s.slotsResolved).toBe(0);
    expect(player(s, 'p1')).toMatchObject({ time: 8, position: 'w1', coins: 9, energy: 4 });
  });
});

describe('บิลและยอดค้าง', () => {
  const toWeek = (s: GameState, week: number): GameState => {
    let x = s;
    while (x.week < week) x = nextWeek(playWeek(x, {}));
    return x;
  };
  it('สัปดาห์ 4: หัก 8 จ่ายเท่าที่มี ส่วนต่างเป็นยอดค้าง ครั้งเดียว', () => {
    let s = toWeek(patchPlayer(makeGame(2), 'p2', { coins: 5 }), 4);
    expect(s.billResults).toEqual([]);
    s = submitAll(s, {});
    s = resolve(resolve(s));
    expect(s.billsChargedWeek).toBe(0);
    expect(s.phase).toBe('reveal');
    s = resolve(s);
    expect(s.phase).toBe('weekSummary');
    expect(s.billsChargedWeek).toBe(4);
    expect(s.billResults).toEqual([
      { playerId: 'p1', bill: 8, paid: 6, addedDebt: 2 },
      { playerId: 'p2', bill: 8, paid: 5, addedDebt: 3 },
    ]);
    expect(player(s, 'p1')).toMatchObject({ coins: 0, debt: 2 });
    expect(player(s, 'p2')).toMatchObject({ coins: 0, debt: 3 });
    expect(resolve(s)).toBe(s);
  });
  it('สัปดาห์อื่นไม่มีบิล', () => {
    const s = playWeek(toWeek(makeGame(2), 3), {});
    expect(s.billResults).toEqual([]);
    expect(player(s, 'p1').coins).toBe(6);
  });
  it('กันหักซ้ำด้วย billsChargedWeek', () => {
    let s = toWeek(makeGame(2), 4);
    s = { ...s, billsChargedWeek: 4 };
    s = playWeek(s, {});
    expect(player(s, 'p1').coins).toBe(6);
  });
  it('payDebt: เฉพาะ weekSummary และไม่เกินเงิน/ยอดค้าง', () => {
    let s = toWeek(makeGame(2), 4);
    s = playWeek(patchPlayer(s, 'p1', { coins: 10, debt: 1 }), {});
    // p1: 10 - 8 = 2, debt 1
    expect(player(s, 'p1')).toMatchObject({ coins: 2, debt: 1 });
    expect(payDebt(s, 'p1', 0)).toBe(s);
    expect(payDebt(s, 'nobody', 1)).toBe(s);
    const paid = payDebt(s, 'p1', 99);
    expect(player(paid, 'p1')).toMatchObject({ coins: 1, debt: 0 });
    expect(payDebt(paid, 'p1', 1)).toBe(paid);
    // p2 ไม่มีเงินเลย
    expect(payDebt(s, 'p2', 5)).toBe(s);
    const s2 = patchPlayer(s, 'p2', { coins: 3 });
    expect(player(payDebt(s2, 'p2', 1), 'p2')).toMatchObject({ coins: 2, debt: 1 });
    // ผิด phase
    const h = nextWeek(s);
    expect(payDebt(h, 'p1', 1)).toBe(h);
  });
});

describe('ไม่คิดผลซ้ำ', () => {
  it('resolveNextSlot เรียกซ้ำหลังครบ 3 ช่วงไม่เปลี่ยนอะไร', () => {
    const s = playWeek(makeGame(2), { p1: [act(['h1', 'j1', 'w1'], 'work')] });
    expect(resolve(s)).toBe(s);
    expect(resolve({ ...s, phase: 'reveal' }).slotsResolved).toBe(3);
  });
  it('serialize/deserialize กลางการเปิดผล ได้ผลเท่ากัน', () => {
    let s = submitAll(makeGame(2), { p1: [act(['h1', 'j1', 'w1'], 'work'), act(['w1'], 'work')] });
    s = resolve(s);
    const loaded = deserialize(serialize(s)) as GameState;
    expect(loaded).toEqual(s);
    expect(resolve(resolve(loaded))).toEqual(resolve(resolve(s)));
    const done = deserialize(serialize(resolveAll(s))) as GameState;
    expect(resolve(done)).toBe(done);
    expect(player(done, 'p1').coins).toBe(12);
  });
  it('บิลไม่ถูกหักซ้ำหลังโหลดเซฟ', () => {
    let s = makeGame(2);
    for (let w = 1; w < 4; w++) s = nextWeek(playWeek(s, {}));
    s = playWeek(s, {});
    const loaded = deserialize(serialize(s)) as GameState;
    expect(resolve(loaded)).toBe(loaded);
    expect(player(loaded, 'p1').coins).toBe(0);
  });
  it('พักเที่ยงไม่จ่ายซ้ำหลังโหลดเซฟ', () => {
    let s: GameState = { ...makeGame(2), shops: [{ nodeId: 'l1', ownerId: 'p1' }] };
    s = nextWeek(playWeek(s, {}));
    const loaded = deserialize(serialize(s)) as GameState;
    expect(nextWeek(loaded)).toBe(loaded);
    expect(player(loaded, 'p1').coins).toBe(7);
  });
});

describe('previewPlan', () => {
  it('คำนวณต่อช่วงโดยไม่สนคนอื่น', () => {
    const s = beginPlanning(makeGame(2));
    const pv = previewPlanWithMap(s, testMap, 'p1', [
      act(['h1', 'j1', 's1'], 'study'),
      act(['s1', 'j1', 'w1'], 'skillWork'),
      act(['w1', 'l1'], 'openShop'),
    ]);
    expect(pv.slots[0]).toMatchObject({ startNodeId: 'h1', endNodeId: 's1', moveCost: 2, activityCost: 2, timeLeftAfter: 4, coinsAfter: 4, energyAfter: 5, valid: true });
    expect(pv.slots[1]).toMatchObject({ endNodeId: 'w1', timeLeftAfter: 0, coinsAfter: 8, energyAfter: 4, valid: true });
    expect(pv.slots[2].valid).toBe(false);
    expect(pv.slots[2].problems[0]).toMatch(/เวลา/);
    expect(pv.valid).toBe(false);
    expect(pv.totalTime).toBe(8);
  });
  it('รายงานปัญหาเป็นภาษาไทย และร้านที่เปิดในแผนเองนับด้วย', () => {
    const s = makeGame(2);
    const pv = previewPlanWithMap(s, testMap, 'p1', [act(['h1', 'w1'], 'work'), act(['h1', 'j1', 'w1', 'l1'], 'openShop'), act(['l1'], 'buyLunch')]);
    expect(pv.slots[0]).toMatchObject({ valid: false, endNodeId: 'h1', moveCost: 0 });
    expect(pv.slots[0].problems[0]).toMatch(/[฀-๿]/);
    expect(pv.slots[1]).toMatchObject({ valid: true, coinsAfter: 1 });
    expect(pv.slots[2]).toMatchObject({ valid: false });
    expect(pv.slots[2].problems[0]).toMatch(/เงิน/);
  });
  it('ไม่แก้ state', () => {
    const s = makeGame(2);
    const copy = JSON.parse(JSON.stringify(s));
    previewPlanWithMap(s, testMap, 'p1', [act(['h1', 'j1', 'w1'], 'work')]);
    expect(s).toEqual(copy);
    expect(previewPlanWithMap(s, testMap, 'nobody', []).valid).toBe(false);
  });
});

describe('เกมเต็ม 2 คน 8 สัปดาห์', () => {
  it('เล่นจนจบ คะแนนตรงตามที่คำนวณ', async () => {
    const { computeScores } = await import('./scoring');
    let s = makeGame(2, ['h1', 'h2'], 0);
    const roundtrip = (x: GameState) => deserialize(serialize(x)) as GameState;
    for (let week = 1; week <= 8; week++) {
      expect(s.week).toBe(week);
      const p1 = week === 1
        ? [act(['h1', 'j1', 's1'], 'study'), act(['s1', 'j1', 'w1'], 'skillWork'), act(['w1'])]
        : [act(['w1'], 'skillWork'), act(['w1', 'j1', 'h1'], 'rest'), act(['h1', 'j1', 'w1'])];
      const p2 = [act(['h2', 'j1', 'o1'], 'office'), act(['o1', 'j1', 'h2'], 'rest'), act(['h2'])];
      s = roundtrip(submitAll(s, { p1, p2 }));
      expect(submitPlan(s, 'p1', [])).toBe(s);
      for (let i = 0; i < 3; i++) {
        s = roundtrip(resolve(s));
        for (const r of s.slotResults[i]) expect(r.success).toBe(true);
      }
      expect(s.phase).toBe('weekSummary');
      expect(resolve(s)).toBe(s);
      s = roundtrip(nextWeek(s));
    }
    expect(s.phase).toBe('gameOver');
    expect(s.week).toBe(8);
    expect(nextWeek(s)).toBe(s);
    expect(s.billsChargedWeek).toBe(8);
    expect(player(s, 'p1')).toMatchObject({ coins: 20, energy: 6, hasSkill: true, skillShifts: 8, debt: 0 });
    expect(player(s, 'p2')).toMatchObject({ coins: 30, energy: 5, debt: 0 });
    const scores = computeScores(s);
    expect(scores[0]).toMatchObject({ playerId: 'p1', milestonePoints: 3, coinSetPoints: 4, total: 7, rank: 1, isWinner: true });
    expect(scores[1]).toMatchObject({ playerId: 'p2', milestonePoints: 0, coinSetPoints: 6, total: 6, rank: 2, isWinner: false });
  });
});
