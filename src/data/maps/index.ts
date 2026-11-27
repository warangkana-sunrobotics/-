import type { GameMap, MapId } from '../../game/types';
import { CANAL_MAP } from './canal';
import { HILL_MAP } from './hill';
import { MARKET_MAP } from './market';
import { PARK_MAP } from './park';

/** แผนที่ทั้งหมด เรียงตามลำดับที่แสดงในหน้าเลือกแผนที่ */
export const MAPS: GameMap[] = [CANAL_MAP, MARKET_MAP, HILL_MAP, PARK_MAP];

export function getMap(id: MapId): GameMap {
  const map = MAPS.find((m) => m.id === id);
  if (!map) throw new Error(`ไม่พบแผนที่: ${id}`);
  return map;
}

export { CANAL_MAP, MARKET_MAP, HILL_MAP, PARK_MAP };
