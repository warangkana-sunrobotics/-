// กลยุทธ์เล่นอัตโนมัติ (คำนวณแผนด้วย engine จริง) — ใช้ทั้งจำลองใน Node และขับเบราว์เซอร์
// คืน [{target, activity}] 3 ช่วง (target = จุดปลายทาง) และ actions (PlannedAction[3])

function nearest(engine, map, from, kinds, filter = () => true) {
  let best = null;
  for (const n of map.nodes) {
    if (!kinds.includes(n.kind) || !filter(n)) continue;
    const p = engine.findPath(map, from, n.id);
    if (p && (!best || p.length < best.path.length)) best = { id: n.id, path: p };
  }
  return best;
}

/**
 * persona: 'worker' | 'lazy'
 * ctx: { contestWork?: string }  จุดงานที่ให้ทั้งสองคนแย่งกันในสัปดาห์ 1
 */
export function planWeek(engine, map, state, playerId, persona, ctx = {}) {
  const player = state.players.find((p) => p.id === playerId);
  const steps = [];
  const actions = [];
  let pos = player.position;

  const tryCandidates = (cands) => {
    for (const c of cands) {
      if (!c) continue;
      const path = c.target === pos ? [pos] : engine.findPath(map, pos, c.target);
      if (!path) continue;
      const trial = [...actions, { path, activity: c.activity }];
      const pv = engine.previewPlan(state, playerId, trial);
      const sp = pv.slots[trial.length - 1];
      if (sp.valid && pv.totalTime <= player.time) return { step: c, action: trial[trial.length - 1], sp };
    }
    return null;
  };

  for (let slot = 0; slot < 3; slot++) {
    const pv = actions.length ? engine.previewPlan(state, playerId, actions).slots[actions.length - 1] : null;
    const coins = pv ? pv.coinsAfter : player.coins;
    const energy = pv ? pv.energyAfter : player.energy;
    const hasSkill =
      player.hasSkill || actions.some((a) => a.activity === 'study');
    const cands = [];
    const near = (kinds, f) => nearest(engine, map, pos, kinds, f)?.id;
    const restSpot = near(['home', 'park']);
    const week = state.week;

    if (week === 1 && slot === 0 && ctx.contestWork) {
      cands.push({ target: ctx.contestWork, activity: 'work' });
    } else if (persona === 'worker') {
      if (week === 1 && slot === 1 && coins >= 5) {
        cands.push({ target: near(['lot'], (n) => !state.shops.some((s) => s.nodeId === n.id)), activity: 'openShop' });
      }
      if (!hasSkill && coins >= 2 && week >= 2) cands.push({ target: near(['school']), activity: 'study' });
      if (hasSkill && energy >= 1) cands.push({ target: near(['work']), activity: 'skillWork' });
      if (energy >= 2) cands.push({ target: near(['work']), activity: 'work' });
      if (energy < 6) cands.push({ target: restSpot, activity: 'rest' });
    } else {
      // lazy: สัปดาห์ 2 ซื้อข้าวกล่องร้านคนอื่น, สัปดาห์ 1-4 พักเป็นหลัก, 5+ ทำงาน
      const otherShop = state.shops.find((s) => s.ownerId !== playerId);
      if (week === 2 && slot === 0 && otherShop && coins >= 2) cands.push({ target: otherShop.nodeId, activity: 'buyLunch' });
      if (week >= 5 && energy >= 1) cands.push({ target: near(['work']), activity: 'work' });
      cands.push({ target: restSpot, activity: 'rest' });
    }
    cands.push({ target: pos, activity: 'none' });
    const pick = tryCandidates(cands);
    steps.push(pick.step);
    actions.push(pick.action);
    pos = pick.action.path[pick.action.path.length - 1];
  }
  return { steps, actions, preview: engine.previewPlan(state, playerId, actions) };
}
