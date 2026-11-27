// บันทึก/โหลดเกมจาก localStorage (ห่อ try/catch เพราะอาจถูกบล็อก)
import type { GameState } from './game/types';
import { SAVE_KEY, serialize, deserialize } from './game/save';
import { normalizeLoaded } from './game/engine';

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, serialize(state));
  } catch {
    /* ไม่มีที่เก็บ — เล่นต่อได้แต่จะไม่ถูกบันทึก */
  }
}

export function loadGame(): GameState | null {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (!text) return null;
    const s = deserialize(text);
    return s ? normalizeLoaded(s) : null;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
