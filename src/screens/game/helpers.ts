import type { ActivityType, GameMap, GameState, Player, ResourceDelta } from '../../game/types';
import { activityInfo } from '../../game/engine';
import { getCharacter } from '../../data/characters';
import type { PawnInfo } from '../../components/board/Board';

/** ค่าคงที่ที่ UI ใช้แสดงผล (ตรงกับ docs/RULES.md) */
export const TOTAL_WEEKS = 8;
export const MAX_ENERGY = 6;
export const WEEK_TIME = 8;
export const SKILL_SHIFT_GOAL = 3;
export const BILL_WEEKS = [4, 8];
export const BILL_AMOUNT = 8;

export const MINUS = '−';

export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${MINUS}${Math.abs(n)}`;
  return '0';
}

/** "+3 🪙 −1 ⚡ −4 ⏰" (ข้ามค่าที่เป็น 0) */
export function formatDelta(d: ResourceDelta): string {
  const parts: string[] = [];
  if (d.coins) parts.push(`${signed(d.coins)} 🪙`);
  if (d.energy) parts.push(`${signed(d.energy)} ⚡`);
  if (d.time) parts.push(`${signed(d.time)} ⏰`);
  return parts.length ? parts.join(' ') : 'ไม่มีการเปลี่ยนแปลง';
}

/** ข้อความอ่านออกเสียงของ delta */
export function deltaAria(d: ResourceDelta): string {
  const parts: string[] = [];
  if (d.coins) parts.push(`เหรียญ ${signed(d.coins)}`);
  if (d.energy) parts.push(`พลัง ${signed(d.energy)}`);
  if (d.time) parts.push(`เวลา ${signed(d.time)}`);
  return parts.length ? parts.join(', ') : 'ไม่มีการเปลี่ยนแปลง';
}

export const NONE_LABEL = 'เดินอย่างเดียว / ผ่าน';

export function activityLabel(type: ActivityType): string {
  if (type === 'none') return NONE_LABEL;
  try {
    return activityInfo(type).label;
  } catch {
    return type;
  }
}

export function activityIcon(type: ActivityType): string {
  if (type === 'none') return '🚶';
  try {
    return activityInfo(type).icon;
  } catch {
    return '•';
  }
}

export function nodeLabel(map: GameMap, id: string): string {
  return map.nodes.find((n) => n.id === id)?.label ?? id;
}

export function routeText(map: GameMap, path: string[]): string {
  if (path.length <= 1) return `อยู่ที่ ${nodeLabel(map, path[0] ?? '')}`;
  return path.map((id) => nodeLabel(map, id)).join(' → ');
}

export function playerById(state: GameState, id: string | null | undefined): Player | undefined {
  return state.players.find((p) => p.id === id);
}

export function playerColor(p: Player): string {
  return getCharacter(p.characterId).color;
}

export function pawnsFor(state: GameState): PawnInfo[] {
  return state.players.map((p) => {
    const c = getCharacter(p.characterId);
    return { playerId: p.id, nodeId: p.position, color: c.color, initials: c.initials, name: p.name };
  });
}

export function shopsFor(state: GameState): { nodeId: string; ownerName: string; color: string }[] {
  return state.shops.map((s) => {
    const owner = playerById(state, s.ownerId);
    return {
      nodeId: s.nodeId,
      ownerName: owner?.name ?? '?',
      color: owner ? playerColor(owner) : '#888888',
    };
  });
}
