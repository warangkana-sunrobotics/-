import type { CharacterId, MapId } from '../game/types';

/**
 * รายการภาพทั้งหมดของเกม (path ใต้ public/ แบบ relative ไม่มี / นำหน้า เพื่อให้ใช้ได้กับ base './')
 * เพิ่ม/เปลี่ยนภาพ: ดู docs/ASSETS.md
 */
export interface ImageAsset {
  path: string;
  /** มีไฟล์ภาพอยู่จริงแล้วหรือยัง (false = ให้ UI ใช้ภาพแทน/การ์ดตัวแทน) */
  available: boolean;
  width?: number;
  height?: number;
}

export const MAP_IMAGES: Record<MapId, ImageAsset> = {
  canal: { path: 'assets/maps/canal.webp', available: true, width: 1536, height: 1024 },
  market: { path: 'assets/maps/market.webp', available: true, width: 1536, height: 1024 },
  hill: { path: 'assets/maps/hill.webp', available: true, width: 1536, height: 1024 },
  park: { path: 'assets/maps/park.webp', available: true, width: 1536, height: 1024 },
};

/** ตัวละครที่มีไฟล์การ์ดใน public/assets/cards แล้ว — เพิ่ม id ที่นี่เมื่อวางไฟล์ใหม่ */
const AVAILABLE_CARDS: ReadonlySet<CharacterId> = new Set<CharacterId>([
  'manao', 'pa-nid', 'ton', 'fang', 'lung-chai', 'kaew', 'mek', 'yai-on', 'pete', 'nam',
]);

const CHARACTER_IDS: CharacterId[] = [
  'manao',
  'pa-nid',
  'ton',
  'fang',
  'lung-chai',
  'kaew',
  'mek',
  'yai-on',
  'pete',
  'nam',
];

export const CARD_IMAGES: Record<CharacterId, ImageAsset> = Object.fromEntries(
  CHARACTER_IDS.map((id) => [id, { path: `assets/cards/${id}.webp`, available: AVAILABLE_CARDS.has(id) }]),
) as Record<CharacterId, ImageAsset>;

/** path ของการ์ดตัวละคร หรือ null ถ้ายังไม่มีภาพ (ตรงกับ Character.card) */
export function cardImage(id: CharacterId): string | null {
  const a = CARD_IMAGES[id];
  return a.available ? a.path : null;
}

export function mapImage(id: MapId): string {
  return MAP_IMAGES[id].path;
}

/** ทุกภาพที่มีอยู่จริง (ใช้ preload) */
export function allAvailableImages(): string[] {
  return [...Object.values(MAP_IMAGES), ...Object.values(CARD_IMAGES)]
    .filter((a) => a.available)
    .map((a) => a.path);
}
