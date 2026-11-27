/** คิดคะแนนสุดท้าย: หมุดหมาย + floor(เงิน/5) − ยอดค้าง; เสมอ → พลังมากกว่า; ยังเสมอ → ชนะร่วม */
import type { GameState, Player, ScoreRow } from './types';
import { SKILL_SHIFT_GOAL } from './rules';

export function scorePlayer(p: Player): Omit<ScoreRow, 'rank' | 'isWinner'> {
  const milestoneLearn = p.hasSkill;
  const milestoneFirstSkillShift = p.skillShifts >= 1;
  const milestoneThreeSkillShifts = p.skillShifts >= SKILL_SHIFT_GOAL;
  const milestonePoints = [milestoneLearn, milestoneFirstSkillShift, milestoneThreeSkillShifts].filter(Boolean).length;
  const coinSetPoints = Math.floor(Math.max(0, p.coins) / 5);
  return {
    playerId: p.id,
    milestoneLearn,
    milestoneFirstSkillShift,
    milestoneThreeSkillShifts,
    milestonePoints,
    coins: p.coins,
    coinSetPoints,
    debt: p.debt,
    energy: p.energy,
    total: milestonePoints + coinSetPoints - p.debt,
  };
}

/** เรียงจากอันดับดีสุด; อันดับแบบ competition ranking (1,1,3) */
export function computeScores(state: Pick<GameState, 'players'>): ScoreRow[] {
  const rows = state.players.map(scorePlayer);
  const cmp = (a: (typeof rows)[number], b: (typeof rows)[number]) => b.total - a.total || b.energy - a.energy;
  const sorted = [...rows].sort(cmp);
  return sorted.map((row) => {
    const rank = 1 + sorted.filter((o) => cmp(o, row) < 0).length;
    return { ...row, rank, isWinner: rank === 1 };
  });
}
