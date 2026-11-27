import { describe, expect, it, vi } from 'vitest';
import { testMap } from './__fixtures__/testMap';

vi.mock('../data/maps', () => ({ MAPS: [testMap], getMap: () => testMap }));

describe('engine (public API wrapper)', () => {
  it('ส่งออกครบตามสัญญาและใช้ getMap', async () => {
    const e = await import('./engine');
    for (const fn of ['createGame', 'beginPlanning', 'submitPlan', 'resolveNextSlot', 'payDebt', 'nextWeek', 'normalizeLoaded', 'previewPlan', 'activitiesAt', 'findPath', 'priorityOrder', 'computeScores', 'activityInfo', 'shiftCapacity'] as const) {
      expect(typeof e[fn]).toBe('function');
    }
    let s = e.createGame({ mapId: 'canal', players: [
      { name: 'a', characterId: 'manao', homeNodeId: 'h1' },
      { name: 'b', characterId: 'ton', homeNodeId: 'h2' },
    ] }, () => 0);
    expect(e.activitiesAt(s, 'w1')).toEqual(['work', 'skillWork']);
    expect(e.previewPlan(s, 'p1', [{ path: ['h1', 'j1', 'w1'], activity: 'work' }]).valid).toBe(true);
    expect(e.resolveNextSlot(s)).toBe(s);
    s = e.submitPlan(e.beginPlanning(s), 'p1', [{ path: ['h1', 'j1', 'w1'], activity: 'work' }]);
    s = e.submitPlan(e.beginPlanning(s), 'p2', []);
    s = e.resolveNextSlot(s);
    expect(s.players[0].coins).toBe(9);
  });
});
