// ตรวจกติกาการแย่งกะ/ทำเล/สิทธิ์ก่อน/เส้นทางผิด/เงินไม่พอ/ร้านข้าวกล่อง ระดับ engine (ใช้แผนที่จริง)
export function engineChecks({ engine, maps }) {
  const results = [];
  const check = (id, name, fn) => {
    try {
      const evidence = fn();
      results.push({ id, name, pass: true, evidence });
    } catch (e) {
      results.push({ id, name, pass: false, evidence: e.message });
    }
  };
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };
  const map = maps.getMap('canal');
  const CHARS = ['manao', 'pa-nid', 'ton', 'fang', 'lung-chai', 'kaew', 'mek', 'yai-on'];
  const mk = (n, home = 'home-3', r = 0) =>
    engine.createGame(
      { mapId: 'canal', players: Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}`, characterId: CHARS[i], homeNodeId: home })) },
      () => r,
    );
  /** ให้ทุกคนส่งแผนตามฟังก์ชัน (pid → actions) แล้วเปิดผลทั้ง 3 ช่วง */
  const playWeek = (s, planFor, slots = 3) => {
    while (s.phase === 'handoff') {
      const pid = s.planningPlayerId;
      s = engine.submitPlan(engine.beginPlanning(s), pid, planFor(pid, s));
    }
    for (let i = 0; i < slots; i++) s = engine.resolveNextSlot(s);
    return s;
  };
  const stay = (node) => ({ path: [node], activity: 'none' });
  const toWork = ['home-3', 'x-1', 'work-1'];

  check('4a', 'กะเต็ม (2 คน, จุดเดียวกัน ช่วงเดียวกัน) — คนที่สองได้ SHIFT_FULL', () => {
    let s = mk(2, 'home-3', 0); // firstSeat 0 → p1 ก่อน
    s = playWeek(s, () => [{ path: toWork, activity: 'work' }, stay('work-1'), stay('work-1')], 1);
    const r = s.slotResults[0];
    const p1 = r.find((x) => x.playerId === 'p1');
    const p2 = r.find((x) => x.playerId === 'p2');
    assert(p1.success && p1.delta.coins === 3, 'p1 ควรได้กะ +3');
    assert(!p2.success && p2.reason === 'SHIFT_FULL', `p2 reason=${p2.reason}`);
    assert(/เต็ม/.test(p2.reasonText), `reasonText=${p2.reasonText}`);
    assert(p2.moved && p2.endNodeId === 'work-1' && p2.delta.time === -2, 'p2 ควรเดินถึงและเสียแค่เวลาเดิน 2');
    // สลับสิทธิ์ก่อน → p2 ได้แทน
    let t = mk(2, 'home-3', 0.99);
    t = playWeek(t, () => [{ path: toWork, activity: 'work' }, stay('work-1'), stay('work-1')], 1);
    const q1 = t.slotResults[0].find((x) => x.playerId === 'p1');
    assert(t.firstSeat === 1 && !q1.success && q1.reason === 'SHIFT_FULL', 'firstSeat=1 → p1 ควรได้ SHIFT_FULL');
    return `p1 ✓ +3; p2 ✗ "${p2.reasonText}" (เวลา −2, ไม่เสียพลัง/เงิน); สลับ firstSeat แล้วผลกลับด้าน`;
  });

  check('4b', 'กะ 5–8 คน = 2 ที่ต่อจุด; คนที่ 3 ได้ SHIFT_FULL; กะทั่วไป+กะใช้ทักษะใช้ที่ร่วมกัน', () => {
    let s = mk(5, 'home-3', 0);
    s = { ...s, players: s.players.map((p) => (p.id === 'p2' ? { ...p, hasSkill: true } : p)) };
    s = playWeek(s, (pid) => [{ path: toWork, activity: pid === 'p2' ? 'skillWork' : 'work' }, stay('work-1'), stay('work-1')], 1);
    const ok = s.slotResults[0].filter((x) => x.success).map((x) => x.playerId);
    const full = s.slotResults[0].filter((x) => x.reason === 'SHIFT_FULL').map((x) => x.playerId);
    assert(engine.shiftCapacity(5) === 2 && engine.shiftCapacity(4) === 1, 'shiftCapacity');
    assert(ok.join() === 'p1,p2' && full.join() === 'p3,p4,p5', `ok=${ok} full=${full}`);
    return `สำเร็จ ${ok} (p2 กะใช้ทักษะ), เต็ม ${full}`;
  });

  check('4c', 'แย่งทำเล — คนที่สองได้ LOT_TAKEN, ร้านเป็นของคนแรก', () => {
    let s = mk(2, 'home-4', 0);
    // home-4 → x-2 → lot-2
    s = playWeek(s, () => [{ path: ['home-4', 'x-2', 'lot-2'], activity: 'openShop' }, stay('lot-2'), stay('lot-2')], 1);
    const r2 = s.slotResults[0].find((x) => x.playerId === 'p2');
    assert(s.shops.length === 1 && s.shops[0].ownerId === 'p1', JSON.stringify(s.shops));
    assert(r2.reason === 'LOT_TAKEN', `p2 reason=${r2.reason}`);
    const p1 = s.players[0];
    const p2 = s.players[1];
    assert(p1.coins === 1 && p2.coins === 6, `coins p1=${p1.coins} p2=${p2.coins}`);
    return `ร้านของ p1 (6→1 เหรียญ); p2 "${r2.reasonText}" เหรียญคงเดิม 6`;
  });

  check('4d', 'หมุนสิทธิ์ก่อนทุกสัปดาห์ (seat ถัดไป) และลำดับวางแผนตามสิทธิ์', () => {
    let s = mk(3, 'home-3', 0);
    const seen = [];
    for (let w = 1; w <= 4; w++) {
      seen.push(`${s.week}:${s.firstSeat}/${s.planningPlayerId}`);
      assert(s.firstSeat === (w - 1) % 3, `week ${w} firstSeat=${s.firstSeat}`);
      assert(s.planningPlayerId === `p${((w - 1) % 3) + 1}`, `week ${w} planner=${s.planningPlayerId}`);
      s = engine.nextWeek(playWeek(s, (pid, st) => [stay(st.players.find((p) => p.id === pid).position), null, null].filter(Boolean)));
    }
    return seen.join(', ');
  });

  check('4e', 'เส้นทางผิด (ช่วง 2 เริ่มผิดจุด) → ข้ามทั้งช่วง ไม่ย้าย ไม่หัก', () => {
    let s = mk(2, 'home-3', 0);
    s = playWeek(s, (pid) =>
      pid === 'p1'
        ? [stay('home-3'), { path: ['school-1', 'x-3'], activity: 'none' }, { path: ['home-3', 'school-1'], activity: 'study' }]
        : [stay('home-3'), stay('home-3'), stay('home-3')],
    );
    const r = s.slotResults[1].find((x) => x.playerId === 'p1');
    assert(!r.moved && r.reason === 'INVALID_PATH' && r.endNodeId === 'home-3', JSON.stringify(r));
    assert(r.delta.time === 0 && r.delta.coins === 0, 'ไม่ควรหัก');
    const r3 = s.slotResults[2].find((x) => x.playerId === 'p1');
    assert(r3.success && s.players[0].hasSkill, 'ช่วง 3 (เริ่มจากตำแหน่งจริง) ควรสำเร็จ');
    // เวลาไม่พอเดิน
    let t = mk(2, 'home-3', 0);
    const long = Array.from({ length: 10 }, (_, i) => (i % 2 ? 'x-1' : 'home-3')); // 9 เส้น > 8 เวลา
    t = playWeek(t, (pid) => (pid === 'p1' ? [{ path: long, activity: 'none' }, stay('x-1'), stay('x-1')] : [stay('home-3'), stay('home-3'), stay('home-3')]), 1);
    const rl = t.slotResults[0].find((x) => x.playerId === 'p1');
    assert(!rl.moved && rl.reason === 'NOT_ENOUGH_TIME_TO_MOVE' && t.players[0].time === 8, `long path len ${long.length - 1} result ${rl.reason}`);
    return `ช่วง 2: "${r.reasonText}" อยู่ home-3 เวลา/เงินไม่เปลี่ยน; ช่วง 3 เรียนสำเร็จ; เส้นทางยาว ${long.length - 1} เส้น → ${rl.reason ?? 'เดินได้'}`;
  });

  check('4f', 'เงินไม่พอ → NOT_ENOUGH_COINS (ไม่เรียน, หักเวลาเดิน)', () => {
    let s = mk(2, 'home-3', 0);
    s = { ...s, players: s.players.map((p) => (p.id === 'p1' ? { ...p, coins: 1 } : p)) };
    s = playWeek(s, (pid) => (pid === 'p1' ? [{ path: ['home-3', 'school-1'], activity: 'study' }, stay('school-1'), stay('school-1')] : [stay('home-3'), stay('home-3'), stay('home-3')]), 1);
    const r = s.slotResults[0].find((x) => x.playerId === 'p1');
    const p1 = s.players[0];
    assert(r.reason === 'NOT_ENOUGH_COINS' && !p1.hasSkill && p1.coins === 1 && p1.time === 7, JSON.stringify({ r: r.reason, p1 }));
    return `"${r.reasonText}"; coins 1, time 8→7 (เวลาเดินเท่านั้น), ไม่ได้ทักษะ`;
  });

  check('4g', 'เปิดร้าน + ซื้อข้าวกล่อง โอนเงินให้เจ้าของ; ร้านตัวเองจ่ายกองกลาง; พักเที่ยงสัปดาห์คู่ครั้งเดียว', () => {
    let s = mk(2, 'home-4', 0);
    s = playWeek(s, (pid) =>
      pid === 'p1'
        ? [{ path: ['home-4', 'x-2', 'lot-2'], activity: 'openShop' }, stay('lot-2'), { path: ['lot-2'], activity: 'buyLunch' }]
        : [stay('home-4'), { path: ['home-4', 'x-2', 'lot-2'], activity: 'buyLunch' }, stay('lot-2')],
    );
    const [p1, p2] = s.players;
    const r2 = s.slotResults[1].find((x) => x.playerId === 'p2');
    const r1own = s.slotResults[2].find((x) => x.playerId === 'p1');
    // p1: 6 −5 (ร้าน) +2 (p2 ซื้อ) −2 (ซื้อร้านตัวเอง) = 1; p2: 6 −2 = 4
    assert(r2.success && r2.paidTo === 'p1', JSON.stringify(r2));
    assert(r1own.success && !r1own.paidTo, 'ซื้อร้านตัวเองไม่ควรมี paidTo');
    assert(p1.coins === 1 && p2.coins === 4, `p1=${p1.coins} p2=${p2.coins}`);
    s = engine.nextWeek(s);
    assert(s.week === 2 && s.lunchPayouts.length === 1 && s.players[0].coins === 2, `lunch week2 p1=${s.players[0].coins}`);
    const again = engine.nextWeek(s); // ผิด phase → no-op
    assert(again === s, 'nextWeek ใน handoff ควร no-op');
    return `p1 6−5+2−2=${p1.coins}, p2 6−2=${p2.coins}; สัปดาห์ 2 พักเที่ยง p1 +1 → ${s.players[0].coins}`;
  });

  check('4h', 'บิลสัปดาห์ 4 หักครั้งเดียว; resolveNextSlot/nextWeek ซ้ำเป็น no-op', () => {
    let s = mk(2, 'home-3', 0);
    for (let w = 1; w <= 3; w++) s = engine.nextWeek(playWeek(s, (pid, st) => [stay(st.players.find((p) => p.id === pid).position)]));
    s = playWeek(s, (pid, st) => [stay(st.players.find((p) => p.id === pid).position)]);
    assert(s.week === 4 && s.phase === 'weekSummary' && s.billsChargedWeek === 4, `${s.week} ${s.phase}`);
    const again = engine.resolveNextSlot(s);
    assert(again === s, 'resolveNextSlot ใน weekSummary ควร no-op');
    const p = s.players[0];
    assert(p.coins === 0 && p.debt === 2, `coins=${p.coins} debt=${p.debt}`);
    return `หลังบิล: coins 0, debt 2; เรียกซ้ำคืน state เดิม`;
  });

  return results;
}
