/** ตัวช่วยสำหรับชุดทดสอบ */
import type { CharacterId, GameState, PlannedAction, Player } from '../types';
import { beginPlanning, createGame, resolveNextSlotWithMap, submitPlan } from '../core';
import { testMap } from './testMap';

const CHARS: CharacterId[] = ['manao', 'pa-nid', 'ton', 'fang', 'lung-chai', 'kaew', 'mek', 'yai-on'];

/** สร้างเกม n คน; homes ค่าเริ่มต้นสลับ h1/h2; firstSeat = 0 */
export function makeGame(n = 2, homes?: string[], firstSeat = 0): GameState {
  const state = createGame(
    {
      mapId: 'canal',
      players: Array.from({ length: n }, (_, i) => ({
        name: `ผู้เล่น${i + 1}`,
        characterId: CHARS[i],
        homeNodeId: homes?.[i] ?? (i % 2 === 0 ? 'h1' : 'h2'),
      })),
    },
    () => (firstSeat + 0.5) / n,
  );
  return state;
}

export function patchPlayer(state: GameState, id: string, patch: Partial<Player>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

export function player(state: GameState, id: string): Player {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`no player ${id}`);
  return p;
}

export const act = (path: string[], activity: PlannedAction['activity'] = 'none'): PlannedAction => ({ path, activity });

/** ส่งแผนของทุกคนตามลำดับ handoff (คนที่ไม่ระบุ = ผ่านทั้งสัปดาห์) จนถึง reveal */
export function submitAll(state: GameState, plans: Record<string, PlannedAction[]>): GameState {
  let s = state;
  let guard = 0;
  while (s.phase === 'handoff' && guard++ < 20) {
    s = beginPlanning(s);
    const id = s.planningPlayerId as string;
    s = submitPlan(s, id, plans[id] ?? []);
  }
  return s;
}

/** ประมวลผลทั้ง 3 ช่วง */
export function resolveAll(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 3; i++) s = resolveNextSlotWithMap(s, testMap);
  return s;
}

/** วางแผน + ประมวลผลทั้งสัปดาห์ → weekSummary */
export function playWeek(state: GameState, plans: Record<string, PlannedAction[]>): GameState {
  return resolveAll(submitAll(state, plans));
}
