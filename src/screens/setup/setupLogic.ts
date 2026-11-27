// ฟังก์ชันบริสุทธิ์สำหรับขั้นตอนตั้งเกม (ไม่มี React) — ทดสอบได้ด้วย Vitest
import type { Character, CharacterId, GameMap, GameSetup, MapId } from '../../game/types';
import { CHARACTERS } from '../../data/characters';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const PLAYER_COUNTS: number[] = Array.from(
  { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
  (_, i) => MIN_PLAYERS + i,
);

/** ข้อมูลผู้เล่นระหว่างตั้งเกม (ยังเลือกไม่ครบได้) */
export interface PlayerDraft {
  name: string;
  characterId: CharacterId | null;
  homeNodeId: string | null;
}

/** ชื่อเริ่มต้น: index 0 → "ผู้เล่น 1" */
export function defaultName(index: number): string {
  return `ผู้เล่น ${index + 1}`;
}

/** จำนวนที่ต่อจุดกะงานต่อช่วง ตามกติกา (2–4 คน = 1, 5–8 คน = 2) */
export function shiftSeats(playerCount: number): number {
  return playerCount >= 5 ? 2 : 1;
}

export function shiftCapacityText(playerCount: number): string {
  return `กะงาน ${shiftSeats(playerCount)} ที่ต่อจุดต่อช่วง`;
}

export function isValidPlayerCount(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_PLAYERS && n <= MAX_PLAYERS;
}

/** สร้าง/ปรับจำนวนผู้เล่น โดยเก็บข้อมูลเดิมของคนที่ยังอยู่ */
export function resizeDrafts(count: number, prev: PlayerDraft[] = []): PlayerDraft[] {
  return Array.from({ length: count }, (_, i) => prev[i] ?? { name: defaultName(i), characterId: null, homeNodeId: null });
}

/** ตัวละครที่ถูกคนอื่น (ไม่ใช่ forIndex) เลือกไปแล้ว → index ของผู้เล่นที่เลือก */
export function takenCharacters(drafts: PlayerDraft[], forIndex: number): Map<CharacterId, number> {
  const taken = new Map<CharacterId, number>();
  drafts.forEach((d, i) => {
    if (i !== forIndex && d.characterId) taken.set(d.characterId, i);
  });
  return taken;
}

/** ตัวละครที่ผู้เล่น forIndex เลือกได้ (รวมตัวที่ตัวเองเลือกอยู่) */
export function availableCharacters(
  drafts: PlayerDraft[],
  forIndex: number,
  all: Character[] = CHARACTERS,
): Character[] {
  const taken = takenCharacters(drafts, forIndex);
  return all.filter((c) => !taken.has(c.id));
}

/** เลือกตัวละครให้ผู้เล่น index — ถ้าถูกคนอื่นเลือกอยู่จะไม่เปลี่ยน (กันซ้ำ) ตัวเดิมของเขาว่างทันที */
export function assignCharacter(drafts: PlayerDraft[], index: number, id: CharacterId): PlayerDraft[] {
  if (takenCharacters(drafts, index).has(id)) return drafts;
  return drafts.map((d, i) => (i === index ? { ...d, characterId: id } : d));
}

export function homeNodeIds(map: GameMap): string[] {
  return map.nodes.filter((n) => n.kind === 'home').map((n) => n.id);
}

export function isHomeNode(map: GameMap, nodeId: string | null | undefined): boolean {
  return !!nodeId && map.nodes.some((n) => n.id === nodeId && n.kind === 'home');
}

export function nodeLabel(map: GameMap, nodeId: string | null | undefined): string | null {
  if (!nodeId) return null;
  return map.nodes.find((n) => n.id === nodeId)?.label ?? null;
}

/** ผู้เล่นคนนี้เลือกครบหรือยัง (ชื่อไม่ว่าง ตัวละครไม่ซ้ำ บ้านเป็นจุด home) */
export function isDraftComplete(drafts: PlayerDraft[], index: number, map: GameMap): boolean {
  const d = drafts[index];
  if (!d) return false;
  if (d.name.trim() === '') return false;
  if (!d.characterId || takenCharacters(drafts, index).has(d.characterId)) return false;
  return isHomeNode(map, d.homeNodeId);
}

/** แปลงข้อมูลร่างเป็น GameSetup (ตัดช่องว่างชื่อ, ชื่อว่างใช้ชื่อเริ่มต้น) — คืน null ถ้ายังไม่ครบ */
export function buildSetup(mapId: MapId, drafts: PlayerDraft[]): GameSetup | null {
  if (drafts.some((d) => !d.characterId || !d.homeNodeId)) return null;
  return {
    mapId,
    players: drafts.map((d, i) => ({
      name: d.name.trim() || defaultName(i),
      characterId: d.characterId as CharacterId,
      homeNodeId: d.homeNodeId as string,
    })),
  };
}

/** ตรวจ GameSetup ทั้งชุด คืนรายการปัญหาเป็นภาษาไทย (ว่าง = ใช้ได้) */
export function validateSetup(setup: GameSetup, map: GameMap): string[] {
  const problems: string[] = [];
  const n = setup.players.length;
  if (!isValidPlayerCount(n)) problems.push(`จำนวนผู้เล่นต้องอยู่ระหว่าง ${MIN_PLAYERS}–${MAX_PLAYERS} คน`);
  if (setup.mapId !== map.id) problems.push('แผนที่ไม่ตรงกับที่เลือก');
  const validIds = new Set(CHARACTERS.map((c) => c.id));
  const seen = new Set<string>();
  setup.players.forEach((p, i) => {
    const who = p.name.trim() || defaultName(i);
    if (p.name.trim() === '') problems.push(`${defaultName(i)} ยังไม่ได้ตั้งชื่อ`);
    if (!validIds.has(p.characterId)) problems.push(`${who} ยังไม่ได้เลือกตัวละคร`);
    else if (seen.has(p.characterId)) problems.push(`${who} เลือกตัวละครซ้ำกับคนอื่น`);
    seen.add(p.characterId);
    if (!isHomeNode(map, p.homeNodeId)) problems.push(`${who} ต้องเลือกบ้านเริ่มต้นเป็นจุดบ้าน`);
  });
  return problems;
}
