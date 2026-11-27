/**
 * ค่าคงที่ของกติกา "สิ้นเดือนยังไหว" (อ้างอิง docs/RULES.md)
 * ไฟล์นี้ไม่มี side effect และไม่พึ่งแผนที่
 */
import type { ActivityType, NodeKind } from './types';

/** เวอร์ชันรูปแบบเซฟ */
export const SAVE_VERSION = 1;
export const START_COINS = 6;
export const START_ENERGY = 5;
export const MAX_ENERGY = 6;
export const WEEK_TIME = 8;
export const TOTAL_WEEKS = 8;
export const BILL = 8;
export const BILL_WEEKS: readonly number[] = [4, 8];
export const LUNCH_PAYOUT = 1;
export const SLOTS_PER_WEEK = 3;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
/** หมุดหมาย "ย้ายสายงาน": กะใช้ทักษะครบกี่ครั้ง */
export const SKILL_SHIFT_GOAL = 3;
/** ราคาข้าวกล่อง (จ่ายให้เจ้าของร้าน) */
export const LUNCH_PRICE = 2;

export interface ActivityInfo {
  label: string;
  /** เวลาที่ใช้ (ไม่รวมเวลาเดิน) */
  time: number;
  /** + = ได้พลัง, - = ใช้พลัง */
  energy: number;
  /** + = ได้เหรียญ, - = จ่ายเหรียญ */
  coins: number;
  icon: string;
}

export const ACTIVITIES: Record<ActivityType, ActivityInfo> = {
  none: { label: 'เดิน/ผ่าน', time: 0, energy: 0, coins: 0, icon: '🚶' },
  work: { label: 'กะทั่วไป', time: 2, energy: -1, coins: 3, icon: '🧰' },
  office: { label: 'กะออฟฟิศ', time: 3, energy: -2, coins: 5, icon: '💼' },
  study: { label: 'เรียน', time: 2, energy: 0, coins: -2, icon: '📚' },
  skillWork: { label: 'กะใช้ทักษะ', time: 2, energy: -1, coins: 4, icon: '🛠️' },
  openShop: { label: 'เปิดร้านข้าวกล่อง', time: 1, energy: 0, coins: -5, icon: '🏪' },
  buyLunch: { label: 'ซื้อข้าวกล่อง', time: 1, energy: 2, coins: -LUNCH_PRICE, icon: '🍱' },
  rest: { label: 'พัก', time: 1, energy: 2, coins: 0, icon: '😴' },
};

export function activityInfo(type: ActivityType): ActivityInfo {
  return { ...ACTIVITIES[type] };
}

/** กิจกรรมที่ใช้ "ที่กะ" ร่วมกันที่จุดเดียวกัน */
export const SHIFT_ACTIVITIES: readonly ActivityType[] = ['work', 'office', 'skillWork'];

/** กิจกรรมตามประเภทจุด (ไม่สนใจร้าน — ใช้ตรวจ WRONG_PLACE) */
export const KIND_ACTIVITIES: Record<NodeKind, ActivityType[]> = {
  home: ['rest'],
  park: ['rest'],
  work: ['work', 'skillWork'],
  office: ['office'],
  school: ['study'],
  lot: ['openShop', 'buyLunch'],
  junction: [],
};

/** จำนวนที่กะต่อจุดต่อช่วง: 1 (2–4 คน), 2 (5–8 คน) */
export function shiftCapacity(playerCount: number): number {
  return playerCount >= 5 ? 2 : 1;
}
