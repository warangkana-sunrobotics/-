/** ข้อความเหตุผลภาษาไทยสำหรับแต่ละ FailReason */
import type { FailReason } from './types';

export const REASON_TEXT: Record<FailReason, string> = {
  INVALID_PATH: 'เดินตามเส้นทางนี้ไม่ได้ (จุดเริ่มไม่ตรงกับตำแหน่งจริง หรือไม่มีทางเชื่อม) จึงข้ามทั้งช่วง',
  NOT_ENOUGH_TIME_TO_MOVE: 'เวลาไม่พอเดินตามเส้นทางนี้ จึงข้ามทั้งช่วง',
  WRONG_PLACE: 'ทำกิจกรรมนี้ที่จุดนี้ไม่ได้',
  NOT_ENOUGH_TIME: 'เวลาเหลือไม่พอทำกิจกรรม',
  NOT_ENOUGH_COINS: 'เงินไม่พอ',
  NOT_ENOUGH_ENERGY: 'พลังไม่พอ',
  SHIFT_FULL: 'กะที่จุดนี้เต็มแล้วในช่วงนี้ (มีคนได้สิทธิ์ก่อน)',
  LOT_TAKEN: 'ทำเลนี้มีร้านแล้ว',
  NO_SKILL: 'ยังไม่มีทักษะ ต้องไปเรียนก่อน',
  ALREADY_SKILLED: 'มีทักษะแล้ว ไม่ต้องเรียนซ้ำ',
  NO_SHOP: 'ทำเลนี้ยังไม่มีร้านข้าวกล่อง',
};

export function reasonText(reason: FailReason): string {
  return REASON_TEXT[reason];
}
