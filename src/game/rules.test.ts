import { describe, expect, it } from 'vitest';
import { ACTIVITIES, activityInfo, shiftCapacity } from './rules';
import { REASON_TEXT, reasonText } from './reasons';

describe('rules table', () => {
  it('ค่ากิจกรรมตามกติกา', () => {
    expect(activityInfo('work')).toMatchObject({ time: 2, energy: -1, coins: 3 });
    expect(activityInfo('office')).toMatchObject({ time: 3, energy: -2, coins: 5 });
    expect(activityInfo('study')).toMatchObject({ time: 2, energy: 0, coins: -2 });
    expect(activityInfo('skillWork')).toMatchObject({ time: 2, energy: -1, coins: 4 });
    expect(activityInfo('openShop')).toMatchObject({ time: 1, energy: 0, coins: -5 });
    expect(activityInfo('buyLunch')).toMatchObject({ time: 1, energy: 2, coins: -2 });
    expect(activityInfo('rest')).toMatchObject({ time: 1, energy: 2, coins: 0 });
    for (const t of Object.keys(ACTIVITIES) as (keyof typeof ACTIVITIES)[]) {
      expect(activityInfo(t).label.length).toBeGreaterThan(0);
    }
  });
  it('activityInfo คืนสำเนา (แก้แล้วไม่กระทบตาราง)', () => {
    const w = activityInfo('work');
    w.coins = 99;
    expect(activityInfo('work').coins).toBe(3);
  });
  it('shiftCapacity: 1 สำหรับ 2–4 คน, 2 สำหรับ 5–8 คน', () => {
    expect([2, 3, 4].map(shiftCapacity)).toEqual([1, 1, 1]);
    expect([5, 6, 7, 8].map(shiftCapacity)).toEqual([2, 2, 2, 2]);
  });
  it('มีข้อความไทยทุกเหตุผล', () => {
    for (const r of Object.keys(REASON_TEXT) as (keyof typeof REASON_TEXT)[]) {
      expect(reasonText(r)).toMatch(/[฀-๿]/);
    }
  });
});
