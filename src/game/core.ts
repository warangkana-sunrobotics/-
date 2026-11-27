/**
 * แกนกติกา (ฟังก์ชันบริสุทธิ์) — ทุกฟังก์ชันที่ต้องใช้แผนที่รับ GameMap เป็นพารามิเตอร์
 * เพื่อให้ทดสอบได้โดยไม่ต้องพึ่ง src/data/maps (engine.ts ห่อด้วย getMap ให้อีกชั้น)
 * เรียกผิด phase → คืน state เดิม (no-op) เสมอ
 */
import type {
  ActionResult,
  ActivityType,
  BillResult,
  FailReason,
  GameMap,
  GameSetup,
  GameState,
  LunchPayout,
  PlanPreview,
  PlannedAction,
  Player,
  ResourceDelta,
  Shop,
  SlotPreview,
  WeekPlan,
} from './types';
import {
  ACTIVITIES,
  BILL,
  BILL_WEEKS,
  KIND_ACTIVITIES,
  LUNCH_PAYOUT,
  MAX_ENERGY,
  MAX_PLAYERS,
  MIN_PLAYERS,
  SHIFT_ACTIVITIES,
  SLOTS_PER_WEEK,
  START_COINS,
  START_ENERGY,
  TOTAL_WEEKS,
  SAVE_VERSION,
  WEEK_TIME,
  shiftCapacity,
} from './rules';
import { getNode, validatePath } from './paths';
import { reasonText } from './reasons';


const ACTIVITY_TYPES = Object.keys(ACTIVITIES) as ActivityType[];

// ---------- ตัวช่วย ----------

/** ลำดับสิทธิ์: เริ่มจากผู้ถือสิทธิ์ก่อน แล้ววนตาม seat */
export function priorityOrder(state: GameState): Player[] {
  const n = state.players.length;
  return [...state.players].sort(
    (a, b) => (((a.seat - state.firstSeat) % n) + n) % n - ((((b.seat - state.firstSeat) % n) + n) % n),
  );
}

export function getPlayer(state: GameState, playerId: string): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

function passAt(nodeId: string): PlannedAction {
  return { path: [nodeId], activity: 'none' };
}

/** เติมแผนให้ครบ 3 ช่วง: ช่วงที่ขาด = ผ่าน ณ ตำแหน่งที่คาดไว้ */
export function normalizeActions(
  startNodeId: string,
  actions: readonly (PlannedAction | undefined | null)[] | undefined | null,
): [PlannedAction, PlannedAction, PlannedAction] {
  const out: PlannedAction[] = [];
  let expected = startNodeId;
  for (let i = 0; i < SLOTS_PER_WEEK; i++) {
    const a = actions?.[i];
    if (!a || !Array.isArray(a.path) || a.path.length === 0) {
      out.push(passAt(expected));
      continue;
    }
    const activity: ActivityType = ACTIVITY_TYPES.includes(a.activity) ? a.activity : 'none';
    const path = a.path.map(String);
    out.push({ path, activity });
    expected = path[path.length - 1];
  }
  return out as [PlannedAction, PlannedAction, PlannedAction];
}

/** กิจกรรมที่ทำได้ ณ จุด ตามประเภทจุดและร้านที่มีอยู่ (ไม่รวม 'none') */
export function activitiesAtWithMap(state: Pick<GameState, 'shops'>, map: GameMap, nodeId: string): ActivityType[] {
  const node = getNode(map, nodeId);
  if (!node) return [];
  if (node.kind === 'lot') {
    return state.shops.some((s) => s.nodeId === nodeId) ? ['buyLunch'] : ['openShop'];
  }
  return [...KIND_ACTIVITIES[node.kind]];
}

// ---------- การทำกิจกรรม (ใช้ร่วมกันระหว่างประมวลผลจริงกับพรีวิว) ----------

interface Actor {
  id: string;
  position: string;
  coins: number;
  energy: number;
  time: number;
  hasSkill: boolean;
}

type ActivityCheck =
  | { ok: true }
  | { ok: false; reason: FailReason };

/**
 * ตรวจตามลำดับ: สถานที่ → ทักษะ → เวลา → เงิน → พลัง → ที่กะ/ทำเล
 * seatAvailable: คืน false ถ้ากะที่จุดนี้เต็ม (พรีวิวส่ง () => true)
 */
function checkActivity(
  map: GameMap,
  actor: Actor,
  activity: ActivityType,
  shops: Shop[],
  seatAvailable: (nodeId: string) => boolean,
): ActivityCheck {
  if (activity === 'none') return { ok: true };
  const node = getNode(map, actor.position);
  if (!node || !KIND_ACTIVITIES[node.kind].includes(activity)) return { ok: false, reason: 'WRONG_PLACE' };
  if (activity === 'skillWork' && !actor.hasSkill) return { ok: false, reason: 'NO_SKILL' };
  if (activity === 'study' && actor.hasSkill) return { ok: false, reason: 'ALREADY_SKILLED' };
  const info = ACTIVITIES[activity];
  if (actor.time < info.time) return { ok: false, reason: 'NOT_ENOUGH_TIME' };
  if (info.coins < 0 && actor.coins < -info.coins) return { ok: false, reason: 'NOT_ENOUGH_COINS' };
  if (info.energy < 0 && actor.energy < -info.energy) return { ok: false, reason: 'NOT_ENOUGH_ENERGY' };
  if (SHIFT_ACTIVITIES.includes(activity) && !seatAvailable(actor.position)) {
    return { ok: false, reason: 'SHIFT_FULL' };
  }
  const shop = shops.find((s) => s.nodeId === actor.position);
  if (activity === 'openShop' && shop) return { ok: false, reason: 'LOT_TAKEN' };
  if (activity === 'buyLunch' && !shop) return { ok: false, reason: 'NO_SHOP' };
  return { ok: true };
}

interface ActivityEffect {
  delta: ResourceDelta;
  /** เจ้าของร้านที่ได้รับเงิน (ไม่ใช่ตัวเอง) */
  paidTo?: string;
  newShop?: Shop;
}

/** คำนวณผลของกิจกรรมที่ผ่านการตรวจแล้ว (พลังไม่เกิน MAX_ENERGY) */
function activityEffect(actor: Actor, activity: ActivityType, shops: Shop[]): ActivityEffect {
  const info = ACTIVITIES[activity];
  const newEnergy = Math.min(MAX_ENERGY, actor.energy + info.energy);
  const effect: ActivityEffect = {
    delta: { coins: info.coins, energy: newEnergy - actor.energy, time: -info.time },
  };
  if (activity === 'openShop') effect.newShop = { nodeId: actor.position, ownerId: actor.id };
  if (activity === 'buyLunch') {
    const shop = shops.find((s) => s.nodeId === actor.position);
    if (shop && shop.ownerId !== actor.id) effect.paidTo = shop.ownerId;
  }
  return effect;
}

// ---------- สร้างเกม / วางแผน ----------

export function createGame(setup: GameSetup, rng: () => number = Math.random): GameState {
  const n = setup.players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) {
    throw new Error(`จำนวนผู้เล่นต้องอยู่ระหว่าง ${MIN_PLAYERS}–${MAX_PLAYERS} คน`);
  }
  const chars = new Set(setup.players.map((p) => p.characterId));
  if (chars.size !== n) throw new Error('ตัวละครต้องไม่ซ้ำกัน');
  const players: Player[] = setup.players.map((p, i) => ({
    id: `p${i + 1}`,
    seat: i,
    name: p.name,
    characterId: p.characterId,
    homeNodeId: p.homeNodeId,
    position: p.homeNodeId,
    coins: START_COINS,
    energy: START_ENERGY,
    time: WEEK_TIME,
    hasSkill: false,
    skillShifts: 0,
    debt: 0,
  }));
  const r = rng();
  const firstSeat = Math.min(n - 1, Math.max(0, Math.floor((Number.isFinite(r) ? r : 0) * n)));
  const state: GameState = {
    saveVersion: SAVE_VERSION,
    mapId: setup.mapId,
    players,
    week: 1,
    firstSeat,
    phase: 'handoff',
    planningPlayerId: null,
    plans: {},
    slotsResolved: 0,
    slotResults: [],
    shops: [],
    lunchPaidWeek: 0,
    lunchPayouts: [],
    billsChargedWeek: 0,
    billResults: [],
  };
  state.planningPlayerId = priorityOrder(state)[0].id;
  return state;
}

export function beginPlanning(state: GameState): GameState {
  if (state.phase !== 'handoff' || !state.planningPlayerId) return state;
  return { ...state, phase: 'planning' };
}

/** โหลดเซฟ: planning → handoff (ไม่เปิดแผนค้างของคนอื่น) */
export function normalizeLoaded(state: GameState): GameState {
  if (state.phase !== 'planning') return state;
  return { ...state, phase: 'handoff' };
}

export function submitPlan(state: GameState, playerId: string, actions: readonly PlannedAction[]): GameState {
  if (state.phase !== 'planning') return state;
  if (state.planningPlayerId !== playerId || state.plans[playerId]) return state;
  const player = getPlayer(state, playerId);
  if (!player) return state;
  const plan: WeekPlan = { playerId, actions: normalizeActions(player.position, actions) };
  const plans = { ...state.plans, [playerId]: plan };
  const next = priorityOrder(state).find((p) => !plans[p.id]);
  if (next) {
    return { ...state, plans, phase: 'handoff', planningPlayerId: next.id };
  }
  return { ...state, plans, phase: 'reveal', planningPlayerId: null, slotsResolved: 0, slotResults: [] };
}

// ---------- ประมวลผลช่วง ----------

const ZERO: ResourceDelta = { coins: 0, energy: 0, time: 0 };

export function resolveNextSlotWithMap(state: GameState, map: GameMap): GameState {
  if (state.phase !== 'reveal' || state.slotsResolved >= SLOTS_PER_WEEK) return state;
  const slot = state.slotsResolved as 0 | 1 | 2;
  const players = state.players.map((p) => ({ ...p }));
  const byId = new Map(players.map((p) => [p.id, p]));
  let shops = [...state.shops];
  const order = priorityOrder({ ...state, players });
  const results = new Map<string, ActionResult>();

  // 1) เดินของทุกคนก่อน
  for (const p of order) {
    const planned = state.plans[p.id]?.actions[slot] ?? passAt(p.position);
    const check = validatePath(map, planned.path, p.position, p.time);
    if (!check.ok) {
      results.set(p.id, {
        playerId: p.id,
        slot,
        planned,
        moved: false,
        moveCost: 0,
        activity: planned.activity,
        success: false,
        reason: check.reason,
        reasonText: reasonText(check.reason),
        delta: { ...ZERO },
        endNodeId: p.position,
      });
      continue;
    }
    p.position = planned.path[planned.path.length - 1];
    p.time -= check.cost;
    results.set(p.id, {
      playerId: p.id,
      slot,
      planned,
      moved: true,
      moveCost: check.cost,
      activity: planned.activity,
      success: true,
      delta: { coins: 0, energy: 0, time: 0 - check.cost },
      endNodeId: p.position,
    });
  }

  // 2) กิจกรรมตามลำดับสิทธิ์
  const capacity = shiftCapacity(players.length);
  const seatsUsed = new Map<string, number>();
  for (const p of order) {
    const res = results.get(p.id) as ActionResult;
    if (!res.moved || res.activity === 'none') continue;
    const check = checkActivity(map, p, res.activity, shops, (nodeId) => (seatsUsed.get(nodeId) ?? 0) < capacity);
    if (!check.ok) {
      res.success = false;
      res.reason = check.reason;
      res.reasonText = reasonText(check.reason);
      continue;
    }
    const eff = activityEffect(p, res.activity, shops);
    p.coins += eff.delta.coins;
    p.energy += eff.delta.energy;
    p.time += eff.delta.time;
    if (res.activity === 'study') p.hasSkill = true;
    if (res.activity === 'skillWork') p.skillShifts += 1;
    if (SHIFT_ACTIVITIES.includes(res.activity)) seatsUsed.set(p.position, (seatsUsed.get(p.position) ?? 0) + 1);
    if (eff.newShop) shops = [...shops, eff.newShop];
    if (eff.paidTo) {
      const owner = byId.get(eff.paidTo);
      if (owner) owner.coins += -ACTIVITIES.buyLunch.coins;
      res.paidTo = eff.paidTo;
    }
    res.delta = {
      coins: res.delta.coins + eff.delta.coins,
      energy: res.delta.energy + eff.delta.energy,
      time: res.delta.time + eff.delta.time,
    };
  }

  const slotResults = [...state.slotResults.slice(0, slot), order.map((p) => results.get(p.id) as ActionResult)];
  let next: GameState = { ...state, players, shops, slotResults, slotsResolved: slot + 1 };

  // 3) จบช่วงที่ 3 → บิล (สัปดาห์ 4, 8 ครั้งเดียว) → สรุปสัปดาห์
  if (next.slotsResolved >= SLOTS_PER_WEEK) {
    next = chargeBills(next);
    next = { ...next, phase: 'weekSummary' };
  }
  return next;
}

function chargeBills(state: GameState): GameState {
  if (!BILL_WEEKS.includes(state.week) || state.billsChargedWeek === state.week) return state;
  const billResults: BillResult[] = [];
  const players = state.players.map((p) => {
    const paid = Math.max(0, Math.min(p.coins, BILL));
    const addedDebt = BILL - paid;
    billResults.push({ playerId: p.id, bill: BILL, paid, addedDebt });
    return { ...p, coins: p.coins - paid, debt: p.debt + addedDebt };
  });
  return { ...state, players, billResults, billsChargedWeek: state.week };
}

/** จ่ายยอดค้างเพิ่ม (เฉพาะหน้าสรุปสัปดาห์) จ่ายได้ไม่เกินเงินที่มีและยอดค้าง */
export function payDebt(state: GameState, playerId: string, amount: number): GameState {
  if (state.phase !== 'weekSummary') return state;
  const player = getPlayer(state, playerId);
  if (!player || !Number.isFinite(amount)) return state;
  const pay = Math.min(Math.floor(amount), player.coins, player.debt);
  if (pay <= 0) return state;
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, coins: p.coins - pay, debt: p.debt - pay } : p)),
  };
}

export function nextWeek(state: GameState): GameState {
  if (state.phase !== 'weekSummary') return state;
  if (state.week >= TOTAL_WEEKS) return { ...state, phase: 'gameOver', planningPlayerId: null };
  const n = state.players.length;
  const week = state.week + 1;
  let next: GameState = {
    ...state,
    week,
    firstSeat: (state.firstSeat + 1) % n,
    players: state.players.map((p) => ({ ...p, time: WEEK_TIME })),
    plans: {},
    slotResults: [],
    slotsResolved: 0,
    billResults: [],
    lunchPayouts: [],
  };
  if (week % 2 === 0 && next.lunchPaidWeek !== week) next = payLunch(next);
  return { ...next, phase: 'handoff', planningPlayerId: priorityOrder(next)[0].id };
}

/** พักเที่ยงพร้อมกัน: ร้านละ +1 เหรียญให้เจ้าของ */
function payLunch(state: GameState): GameState {
  const lunchPayouts: LunchPayout[] = state.shops.map((s) => ({ ownerId: s.ownerId, nodeId: s.nodeId, amount: LUNCH_PAYOUT }));
  const players = state.players.map((p) => {
    const gain = lunchPayouts.filter((l) => l.ownerId === p.id).reduce((sum, l) => sum + l.amount, 0);
    return gain ? { ...p, coins: p.coins + gain } : p;
  });
  return { ...state, players, lunchPayouts, lunchPaidWeek: state.week };
}

// ---------- พรีวิวแผน ----------

/** จำลองแผนของผู้เล่นคนเดียวจากสถานะปัจจุบัน (ไม่คิดการแย่งกะ/ทำเลกับคนอื่น) */
export function previewPlanWithMap(
  state: GameState,
  map: GameMap,
  playerId: string,
  actions: readonly PlannedAction[],
): PlanPreview {
  const player = getPlayer(state, playerId);
  if (!player) return { slots: [], totalTime: 0, valid: false };
  const actor: Actor = { ...player };
  const startTime = actor.time;
  let shops = [...state.shops];
  const slots: SlotPreview[] = [];
  for (const planned of actions.slice(0, SLOTS_PER_WEEK)) {
    const startNodeId = actor.position;
    const activityCost = planned.activity === 'none' ? 0 : ACTIVITIES[planned.activity]?.time ?? 0;
    const problems: string[] = [];
    const move = validatePath(map, planned?.path ?? [], actor.position, actor.time);
    let moveCost = 0;
    if (!move.ok) {
      problems.push(reasonText(move.reason));
    } else {
      moveCost = move.cost;
      actor.position = planned.path[planned.path.length - 1];
      actor.time -= move.cost;
      const check = checkActivity(map, actor, planned.activity, shops, () => true);
      if (!check.ok) {
        problems.push(reasonText(check.reason));
      } else if (planned.activity !== 'none') {
        const eff = activityEffect(actor, planned.activity, shops);
        actor.coins += eff.delta.coins;
        actor.energy += eff.delta.energy;
        actor.time += eff.delta.time;
        if (planned.activity === 'study') actor.hasSkill = true;
        if (eff.newShop) shops = [...shops, eff.newShop];
      }
    }
    slots.push({
      startNodeId,
      endNodeId: actor.position,
      moveCost,
      activityCost,
      timeLeftAfter: actor.time,
      coinsAfter: actor.coins,
      energyAfter: actor.energy,
      valid: problems.length === 0,
      problems,
    });
  }
  return { slots, totalTime: startTime - actor.time, valid: slots.every((s) => s.valid) };
}
