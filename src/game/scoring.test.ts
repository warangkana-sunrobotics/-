import { describe, expect, it } from 'vitest';
import { computeScores } from './scoring';
import { makeGame, patchPlayer } from './__fixtures__/helpers';

describe('computeScores', () => {
  it('หมุดหมาย + floor(เงิน/5) − ยอดค้าง', () => {
    let s = makeGame(2);
    s = patchPlayer(s, 'p1', { hasSkill: true, skillShifts: 1, coins: 14, debt: 2 });
    s = patchPlayer(s, 'p2', { hasSkill: true, skillShifts: 3, coins: 4 });
    const rows = computeScores(s);
    const p1 = rows.find((r) => r.playerId === 'p1');
    const p2 = rows.find((r) => r.playerId === 'p2');
    expect(p1).toMatchObject({ milestoneLearn: true, milestoneFirstSkillShift: true, milestoneThreeSkillShifts: false, milestonePoints: 2, coinSetPoints: 2, debt: 2, total: 2 });
    expect(p2).toMatchObject({ milestonePoints: 3, coinSetPoints: 0, total: 3, rank: 1, isWinner: true });
    expect(rows[0].playerId).toBe('p2');
  });
  it('เสมอ → พลังมากกว่าชนะ', () => {
    let s = makeGame(3);
    s = patchPlayer(s, 'p1', { coins: 10, energy: 2 });
    s = patchPlayer(s, 'p2', { coins: 10, energy: 4 });
    s = patchPlayer(s, 'p3', { coins: 0, energy: 6 });
    const rows = computeScores(s);
    expect(rows.map((r) => [r.playerId, r.rank, r.isWinner])).toEqual([
      ['p2', 1, true],
      ['p1', 2, false],
      ['p3', 3, false],
    ]);
  });
  it('ยังเสมอ → ชนะร่วม', () => {
    let s = makeGame(3);
    s = patchPlayer(s, 'p1', { coins: 10, energy: 4 });
    s = patchPlayer(s, 'p2', { coins: 11, energy: 4 });
    s = patchPlayer(s, 'p3', { coins: 5, energy: 4 });
    const rows = computeScores(s);
    expect(rows.filter((r) => r.isWinner).map((r) => r.playerId).sort()).toEqual(['p1', 'p2']);
    expect(rows.find((r) => r.playerId === 'p3')?.rank).toBe(3);
  });
  it('คะแนนติดลบได้จากยอดค้าง', () => {
    const s = patchPlayer(makeGame(2), 'p1', { coins: 0, debt: 5 });
    expect(computeScores(s).find((r) => r.playerId === 'p1')?.total).toBe(-5);
  });
});
