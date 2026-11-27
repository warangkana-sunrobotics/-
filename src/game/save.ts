/** รูปแบบเซฟเกม (JSON) พร้อมตรวจเวอร์ชัน */
import type { GameState } from './types';
import { SAVE_VERSION } from './rules';

export { SAVE_VERSION };
export const SAVE_KEY = 'sinduean.save';

const PHASES = ['handoff', 'planning', 'reveal', 'weekSummary', 'gameOver'];

export function serialize(state: GameState): string {
  return JSON.stringify({ ...state, saveVersion: SAVE_VERSION });
}

/** คืน null ถ้า JSON เสีย, เวอร์ชันไม่ตรง หรือโครงสร้างไม่ถูกต้อง; สถานะ planning จะกลับเป็น handoff */
export function deserialize(text: string | null | undefined): GameState | null {
  if (typeof text !== 'string') return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const s = data as Partial<GameState>;
  if (s.saveVersion !== SAVE_VERSION) return null;
  if (
    !Array.isArray(s.players) ||
    s.players.length === 0 ||
    typeof s.week !== 'number' ||
    typeof s.firstSeat !== 'number' ||
    typeof s.phase !== 'string' ||
    !PHASES.includes(s.phase) ||
    typeof s.plans !== 'object' ||
    s.plans === null ||
    !Array.isArray(s.slotResults) ||
    !Array.isArray(s.shops) ||
    typeof s.slotsResolved !== 'number' ||
    typeof s.mapId !== 'string'
  ) {
    return null;
  }
  const full = s as GameState;
  const state: GameState = {
    ...full,
    planningPlayerId: full.planningPlayerId ?? null,
    lunchPaidWeek: full.lunchPaidWeek ?? 0,
    lunchPayouts: full.lunchPayouts ?? [],
    billsChargedWeek: full.billsChargedWeek ?? 0,
    billResults: full.billResults ?? [],
  };
  return state.phase === 'planning' ? { ...state, phase: 'handoff' } : state;
}
