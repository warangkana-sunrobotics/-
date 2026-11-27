// ตรวจในเบราว์เซอร์จริง (Playwright + Chromium) กับ vite preview
import path from 'path';
import { BASE, OUT } from './lib.mjs';
import { planWeek } from './strategy.mjs';

const SAVE_KEY = 'sinduean.save';

export async function browserChecks({ chromium, engine, maps, log = console.log }) {
  const results = [];
  const consoleErrors = [];
  const record = (id, name, pass, evidence) => {
    results.push({ id, name, pass, evidence });
    log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name} — ${evidence}`);
  };
  const browser = await chromium.launch();

  async function newPage(viewport = { width: 1440, height: 900 }, label = 'page') {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'th-TH' });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const url = msg.location()?.url ?? '';
      if (/assets\/cards\//.test(url)) return; // 404 ภาพการ์ดที่ยังไม่มี — ยอมรับได้
      consoleErrors.push(`[${label}] ${msg.text()} ${url}`);
    });
    page.on('pageerror', (e) => consoleErrors.push(`[${label}] pageerror: ${e.message}`));
    page.on('response', (r) => {
      if (r.status() >= 400 && !/assets\/cards\//.test(r.url())) consoleErrors.push(`[${label}] HTTP ${r.status()} ${r.url()}`);
    });
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    return { context, page };
  }

  const getSave = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), SAVE_KEY);
  const tid = (page, id) => page.locator(`[data-testid="${id}"]`);
  const node = (page, id) => page.locator(`.board button[data-node-id="${id}"]`);
  const bodyText = (page) => page.evaluate(() => document.body.innerText);
  const shot = (page, name) => page.screenshot({ path: path.join(OUT, name), fullPage: true });
  const hScroll = (page) =>
    page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));

  /** ตั้งเกมผ่าน UI ทั้งหมด */
  async function setupViaUI(page, { mapId, players }) {
    await tid(page, 'home-start').click();
    await tid(page, `player-count-${players.length}`).click();
    await tid(page, 'setup-next').click();
    await tid(page, `map-${mapId}`).click();
    await tid(page, 'setup-next').click();
    for (const p of players) {
      await tid(page, 'player-name-input').fill(p.name);
      await tid(page, `char-${p.char}`).click();
      await node(page, p.home).click({ force: true });
      await tid(page, 'setup-next').click();
    }
    await tid(page, 'setup-start').click();
    await tid(page, 'start-planning').waitFor();
  }

  /** วางแผน 3 ช่วงผ่าน UI ตาม actions (กดจุดปลายทาง → UI หาเส้นทางสั้นสุดเอง) */
  async function planViaUI(page, map, actions, expectedTotal, { submit = true } = {}) {
    for (let i = 0; i < 3; i++) {
      await tid(page, `slot-tab-${i}`).click();
      const a = actions[i];
      const end = a.path[a.path.length - 1];
      if (a.path.length > 1) await node(page, end).click({ force: true });
      await tid(page, `activity-${a.activity}`).click();
    }
    const tt = await tid(page, 'time-total').innerText();
    if (!tt.includes(`ใช้ ${expectedTotal} จาก`)) throw new Error(`time-total "${tt}" ≠ ${expectedTotal}`);
    if (!submit) return tt;
    await tid(page, 'submit-plan').click();
    await tid(page, 'confirm-submit').click();
    return tt;
  }

  const routeText = (map, p) =>
    p.length <= 1 ? null : p.map((id) => map.nodes.find((n) => n.id === id)?.label ?? id).join(' → ');
  const pointsOf = (map, p) =>
    p
      .map((id) => map.nodes.find((n) => n.id === id))
      .map((n) => `${(n.x * map.width).toFixed(1)},${(n.y * map.height).toFixed(1)}`)
      .join(' ');

  /** แผนของคนที่ส่งแล้วต้องไม่ปรากฏใน DOM */
  async function assertNoLeak(page, map, state, viewerId, where) {
    const leaks = [];
    const text = await bodyText(page);
    const polys = await page.evaluate(() => [...document.querySelectorAll('polyline')].map((p) => p.getAttribute('points')));
    for (const [pid, plan] of Object.entries(state.plans)) {
      if (pid === viewerId) continue;
      for (const a of plan.actions) {
        const rt = routeText(map, a.path);
        if (rt && text.includes(rt)) leaks.push(`${where}: route text of ${pid} "${rt}"`);
        if (a.path.length > 1 && polys.includes(pointsOf(map, a.path))) leaks.push(`${where}: polyline of ${pid}`);
      }
    }
    return leaks;
  }

  // ------------------------------------------------------------------
  // 2/4/5/6: เกมเต็ม 2 คน แผนที่ canal ถึงจบสัปดาห์ 8
  // ------------------------------------------------------------------
  try {
    const { page, context } = await newPage({ width: 1440, height: 900 }, 'full-game');
    const map = maps.getMap('canal');
    await setupViaUI(page, {
      mapId: 'canal',
      players: [
        { name: 'แอนทดสอบ', char: 'manao', home: 'home-3' },
        { name: 'บอยทดสอบ', char: 'yai-on', home: 'home-3' },
      ],
    });
    const persona = { p1: 'worker', p2: 'lazy' };
    const leaks = [];
    const notes = {};
    let reloadHandoff = null;
    let reloadPlanning = null;
    let reloadReveal = null;
    let reloadBill = null;
    let debtPaid = null;
    let shiftFullSeen = false;
    let lunchSeen = false;
    let lunchBuySeen = false;
    const mismatches = [];
    const weekLabels = [];

    const resume = async () => {
      await page.reload();
      const onHome = await tid(page, 'home-resume').isVisible().catch(() => false);
      const directHandoff = await tid(page, 'start-planning').isVisible().catch(() => false);
      if (onHome) await tid(page, 'home-resume').click();
      return { onHome, directHandoff };
    };

    for (let guard = 0; guard < 200; guard++) {
      let st = await getSave(page);
      if (st.phase === 'gameOver') break;
      if (st.phase === 'handoff') {
        weekLabels.push(await tid(page, 'week-label').innerText());
        const pid = st.planningPlayerId;
        // รีโหลดตอน handoff (สัปดาห์ 1 คนแรก)
        if (st.week === 1 && Object.keys(st.plans).length === 0 && !reloadHandoff) {
          const r = await resume();
          await tid(page, 'start-planning').waitFor();
          const after = await getSave(page);
          reloadHandoff = { ...r, ok: after.phase === 'handoff' && after.planningPlayerId === pid };
        }
        if (st.week === 2 && Object.keys(st.plans).length === 0) {
          lunchSeen = await tid(page, 'lunch-notice').isVisible().catch(() => false);
        }
        leaks.push(...(await assertNoLeak(page, map, st, pid, `w${st.week} handoff ${pid}`)));
        await tid(page, 'start-planning').click();
        await tid(page, 'submit-plan').waitFor();
        leaks.push(...(await assertNoLeak(page, map, st, pid, `w${st.week} planning ${pid}`)));
        st = engine.beginPlanning(st);
        const { actions, preview } = planWeek(engine, map, st, pid, persona[pid], { contestWork: 'work-1' });
        // รีโหลดกลางการวางแผนของคนที่ 2 สัปดาห์ 1 → ต้องกลับ handoff และแผนไม่ถูกล็อก
        if (st.week === 1 && Object.keys(st.plans).length === 1 && !reloadPlanning) {
          await planViaUI(page, map, actions, preview.totalTime, { submit: false });
          const r = await resume();
          await tid(page, 'start-planning').waitFor();
          const after = await getSave(page);
          // localStorage อาจยังเป็น 'planning' (normalizeLoaded ทำตอนโหลด) — ตรวจจากหน้าจอ + แผนไม่ถูกล็อก
          const title = await page.locator('#handoff-title').innerText();
          const me = after.players.find((p) => p.id === pid).name;
          reloadPlanning = { ...r, ok: ['handoff', 'planning'].includes(after.phase) && after.planningPlayerId === pid && !after.plans[pid] && title.includes(me), raw: after.phase };
          await tid(page, 'start-planning').click();
          await tid(page, 'submit-plan').waitFor();
        }
        await planViaUI(page, map, actions, preview.totalTime);
        const after = await getSave(page);
        const got = JSON.stringify(after.plans[pid]?.actions);
        if (got !== JSON.stringify(actions)) mismatches.push(`w${st.week} ${pid} plan saved ${got} ≠ ${JSON.stringify(actions)}`);
        continue;
      }
      if (st.phase === 'reveal') {
        let expected = st;
        for (let i = 0; i < 3; i++) expected = engine.resolveNextSlot(expected);
        for (let i = 0; i < 3; i++) {
          await tid(page, 'reveal-next').click();
          if (i < 2) await tid(page, `slot-results-${i}`).waitFor();
          if (i === 0 && st.week === 1 && !reloadReveal) {
            const before = await getSave(page);
            const r = await resume();
            await tid(page, 'slot-results-0').waitFor();
            const afterR = await getSave(page);
            const same =
              afterR.slotsResolved === 1 &&
              JSON.stringify(afterR.players) === JSON.stringify(before.players) &&
              (await tid(page, 'reveal-next').innerText()).includes('2');
            reloadReveal = { ...r, ok: same, coins: afterR.players.map((p) => p.coins) };
          }
        }
        await tid(page, 'next-week').waitFor();
        const s2 = await getSave(page);
        if (JSON.stringify(s2.players) !== JSON.stringify(expected.players))
          mismatches.push(`w${st.week} players ${JSON.stringify(s2.players)} ≠ engine ${JSON.stringify(expected.players)}`);
        if (JSON.stringify(s2.shops) !== JSON.stringify(expected.shops)) mismatches.push(`w${st.week} shops differ`);
        const txt = await bodyText(page);
        for (let i = 0; i < 3; i++) if (!(await tid(page, `slot-results-${i}`).isVisible())) mismatches.push(`w${st.week} summary missing slot ${i}`);
        if (st.week === 1 && /เต็มแล้ว/.test(txt)) shiftFullSeen = true;
        if (st.week === 2 && /จ่าย 2 🪙 ให้\s*เจ้าของร้าน/.test(txt)) lunchBuySeen = true;
        continue;
      }
      if (st.phase === 'weekSummary') {
        if (st.week === 4 || st.week === 8) {
          const vis = await tid(page, 'bill-results').isVisible();
          if (!vis) mismatches.push(`w${st.week} bill-results not visible`);
        }
        if (st.week === 4 && !reloadBill) {
          const before = await getSave(page);
          const r = await resume();
          await tid(page, 'next-week').waitFor();
          const afterB = await getSave(page);
          reloadBill = {
            ...r,
            ok: JSON.stringify(afterB.players) === JSON.stringify(before.players) && afterB.billsChargedWeek === 4,
            debt: afterB.players.map((p) => p.debt),
            coins: afterB.players.map((p) => p.coins),
          };
          await shot(page, 'week4-summary.png');
        }
        if (!debtPaid) {
          const debtor = st.players.find((p) => p.debt > 0 && p.coins > 0);
          if (debtor) {
            const btn = tid(page, `pay-debt-${debtor.id}`);
            const visible = await btn.isVisible();
            if (visible) await btn.click();
            const a = (await getSave(page)).players.find((p) => p.id === debtor.id);
            const pay = Math.min(debtor.debt, debtor.coins);
            debtPaid = {
              week: st.week,
              ok: visible && a.debt === debtor.debt - pay && a.coins === debtor.coins - pay,
              detail: `${debtor.id} debt ${debtor.debt}→${a.debt}, coins ${debtor.coins}→${a.coins}`,
            };
          }
        }
        await tid(page, 'next-week').click();
        await page.waitForTimeout(50);
        continue;
      }
      throw new Error(`unexpected phase ${st.phase}`);
    }
    const final = await getSave(page);
    await tid(page, 'score-table').waitFor();
    await shot(page, 'game-over.png');
    const scores = engine.computeScores(final);
    const winners = scores.filter((s) => s.isWinner).map((s) => s.playerId);
    const winnerVisible = await Promise.all(winners.map((w) => tid(page, `winner-${w}`).isVisible()));
    const rowsVisible = await Promise.all(final.players.map((p) => tid(page, `score-row-${p.id}`).isVisible()));
    const rowText = await Promise.all(final.players.map((p) => tid(page, `score-row-${p.id}`).innerText()));
    const totalsShown = scores.every((s, i) => rowText[final.players.findIndex((p) => p.id === s.playerId)].includes(String(s.total)));
    notes.scores = scores.map((s) => `${s.playerId}:${s.total}${s.isWinner ? '★' : ''}`).join(' ');

    record(
      '2',
      'เกมเต็ม 2 คน (canal) ถึง gameOver สัปดาห์ 8 — แผนจริง, เปิดผลครบ, ผลตรง engine, ตารางผู้ชนะ',
      final.phase === 'gameOver' && final.week === 8 && mismatches.length === 0 && winnerVisible.every(Boolean) && rowsVisible.every(Boolean) && totalsShown,
      `phase=${final.phase} week=${final.week}; สัปดาห์ที่เห็น ${[...new Set(weekLabels)].join(',')}; คะแนน ${notes.scores}; winner card ${winnerVisible}; mismatches: ${mismatches.join(' | ') || 'none'}`,
    );
    record('2b', 'จ่ายยอดค้างในหน้าสรุปสัปดาห์', !!debtPaid?.ok, debtPaid ? `week ${debtPaid.week}: ${debtPaid.detail}` : 'ไม่มีผู้เล่นที่มีหนี้+เงิน');
    record('4i', 'เบราว์เซอร์: แย่งกะสัปดาห์ 1 แสดงเหตุผล "กะ…เต็มแล้ว"', shiftFullSeen, shiftFullSeen ? 'พบข้อความ "กะที่จุดนี้เต็มแล้ว…" ในสรุปสัปดาห์ 1' : 'ไม่พบ');
    record('4j', 'เบราว์เซอร์: พักเที่ยงสัปดาห์ 2 + ซื้อข้าวกล่องจ่ายเจ้าของร้าน', lunchSeen && lunchBuySeen, `lunch-notice=${lunchSeen}, "จ่าย 2 🪙 ให้ เจ้าของร้าน"=${lunchBuySeen}`);
    record('5', 'แผนลับ: handoff/planning ของคนถัดไปไม่มีเส้นทาง/เส้นของแผนคนก่อน', leaks.length === 0, leaks.length ? leaks.slice(0, 5).join('; ') : 'ตรวจทุก handoff+planning ทั้ง 8 สัปดาห์: ไม่พบ route text / polyline ของคนที่ส่งแล้ว');
    const rl = (x) => (x ? `ok=${x.ok}${x.raw ? ` (phase ใน localStorage=${x.raw})` : ''}, หลังรีโหลดอยู่หน้าแรก=${x.onHome} (ต้องกด "เล่นต่อ"), กลับหน้าเกมทันที=${x.directHandoff}` : 'not run');
    record('6a', 'รีโหลดตอน handoff → เล่นต่อ → handoff คนเดิม', !!reloadHandoff?.ok, rl(reloadHandoff));
    record('6b', 'รีโหลดกลางการวางแผน → handoff, แผนยังไม่ถูกล็อก', !!reloadPlanning?.ok, rl(reloadPlanning));
    record('6c', 'รีโหลดหลังเปิดผลช่วง 1 → ไม่คิดซ้ำ (เหรียญเท่าเดิม)', !!reloadReveal?.ok, `${rl(reloadReveal)}; coins ${reloadReveal?.coins}`);
    record('6d', 'รีโหลดหน้าสรุปสัปดาห์ 4 → บิลไม่ถูกหักซ้ำ', !!reloadBill?.ok, `${rl(reloadBill)}; coins ${reloadBill?.coins} debt ${reloadBill?.debt}`);
    // ปุ่มกลับหน้าแรก → ไม่มี/มีปุ่มเล่นต่อ
    await tid(page, 'back-home').click();
    await tid(page, 'home-start').waitFor();
    await context.close();
  } catch (e) {
    record('2', 'เกมเต็ม 2 คน (canal)', false, `exception: ${e.message.split('\n')[0]}`);
  }

  // ------------------------------------------------------------------
  // 2c: แผนที่อื่น ตั้งเกม + วางแผน 1 รอบ
  // ------------------------------------------------------------------
  for (const mapId of ['market', 'hill', 'park']) {
    try {
      const { page, context } = await newPage({ width: 1280, height: 800 }, `map-${mapId}`);
      const map = maps.getMap(mapId);
      const homes = map.nodes.filter((n) => n.kind === 'home').map((n) => n.id);
      await setupViaUI(page, {
        mapId,
        players: [
          { name: 'หนึ่ง', char: 'ton', home: homes[0] },
          { name: 'สอง', char: 'nam', home: homes[1] ?? homes[0] },
        ],
      });
      const plannedSummary = [];
      let imgOk = false;
      for (let k = 0; k < 2; k++) {
        let st = await getSave(page);
        const pid = st.planningPlayerId;
        await tid(page, 'start-planning').click();
        await tid(page, 'submit-plan').waitFor();
        if (k === 0) {
          await page.waitForFunction(() => document.querySelector('.board-img')?.complete);
          imgOk = await page.evaluate(() => document.querySelector('.board-img').naturalWidth > 0);
        }
        st = engine.beginPlanning(st);
        const { actions, preview, steps } = planWeek(engine, map, st, pid, 'worker');
        plannedSummary.push(`${pid}: ${steps.map((s) => `${s.activity}@${s.target}`).join(',')}`);
        await planViaUI(page, map, actions, preview.totalTime);
      }
      const st = await getSave(page);
      let exp = st;
      for (let i = 0; i < 3; i++) exp = engine.resolveNextSlot(exp);
      for (let i = 0; i < 3; i++) await tid(page, 'reveal-next').click();
      await tid(page, 'next-week').waitFor();
      const s2 = await getSave(page);
      const ok = s2.phase === 'weekSummary' && JSON.stringify(s2.players) === JSON.stringify(exp.players);
      await shot(page, `map-${mapId}-summary.png`);
      record(`2c-${mapId}`, `แผนที่ ${mapId}: ตั้งเกม + วางแผน 1 รอบ + เปิดผล`, ok && imgOk, `${plannedSummary.join(' | ')}; ผลตรง engine=${ok}; ภาพแผนที่โหลด=${imgOk}`);
      await context.close();
    } catch (e) {
      record(`2c-${mapId}`, `แผนที่ ${mapId}`, false, `exception: ${e.message.split('\n')[0]}`);
    }
  }

  // ------------------------------------------------------------------
  // 3: ตั้งเกม 8 คน + การ์ด 10 ใบ + การ์ดซ้ำถูกปิด
  // ------------------------------------------------------------------
  try {
    const { page, context } = await newPage({ width: 1440, height: 900 }, 'setup-8');
    const map = maps.getMap('park');
    const homes = map.nodes.filter((n) => n.kind === 'home').map((n) => n.id);
    const ids = ['manao', 'pa-nid', 'ton', 'fang', 'lung-chai', 'kaew', 'mek', 'yai-on', 'pete', 'nam'];
    await tid(page, 'home-start').click();
    await tid(page, 'player-count-8').click();
    await tid(page, 'setup-next').click();
    await tid(page, 'map-park').click();
    await tid(page, 'setup-next').click();
    const ev = [];
    let ok = true;
    for (let i = 0; i < 8; i++) {
      const states = await Promise.all(ids.map((c) => tid(page, `char-${c}`).isEnabled()));
      const count = await page.locator('[data-testid^="char-"]').count();
      if (i === 0) {
        ev.push(`P1 เห็นการ์ด ${count} ใบ, เปิดได้ ${states.filter(Boolean).length}`);
        if (count !== 10 || !states.every(Boolean)) ok = false;
        await shot(page, 'setup-character.png');
      } else {
        const disabled = ids.filter((_, k) => !states[k]);
        const expectDisabled = ids.slice(0, i);
        if (disabled.join() !== expectDisabled.join()) {
          ok = false;
          ev.push(`P${i + 1} disabled=${disabled} expected=${expectDisabled}`);
        }
        if (i === 1) {
          const t = await tid(page, 'char-manao').innerText();
          ev.push(`P2: char-manao disabled, ข้อความ "${t.replace(/\s+/g, ' ').trim()}"`);
          // ลองกดการ์ดที่ถูกปิด — ต้องไม่เปลี่ยนการเลือก
          await tid(page, 'char-manao').click({ force: true });
        }
      }
      await tid(page, 'player-name-input').fill(`คนที่${i + 1}`);
      await tid(page, `char-${ids[i]}`).click();
      await node(page, homes[i % homes.length]).click({ force: true });
      await tid(page, 'setup-next').click();
    }
    await tid(page, 'setup-start').click();
    await tid(page, 'start-planning').waitFor();
    const st = await getSave(page);
    const chars = st.players.map((p) => p.characterId);
    if (st.players.length !== 8 || new Set(chars).size !== 8 || chars.join() !== ids.slice(0, 8).join()) ok = false;
    ev.push(`เกมเริ่ม: ${st.players.length} คน, ตัวละคร ${chars.join(',')}`);
    record('3', 'ตั้งเกม 8 คน, การ์ด 10 ใบเลือกได้, การ์ดที่ถูกเลือกแล้วถูกปิดสำหรับคนถัดไป', ok, ev.join('; '));
    await context.close();
  } catch (e) {
    record('3', 'ตั้งเกม 8 คน', false, `exception: ${e.message.split('\n')[0]}`);
  }

  // ------------------------------------------------------------------
  // 7: ความแม่นยำการกดจุด 3 ขนาดจอ × 4 แผนที่ + ไม่มี scroll แนวนอนบนมือถือ
  // ------------------------------------------------------------------
  const viewports = [
    { name: '1440x900', width: 1440, height: 900 },
    { name: '1024x768', width: 1024, height: 768 },
    { name: '390x844', width: 390, height: 844, phone: true },
  ];
  for (const vp of viewports) {
    const misses = [];
    let total = 0;
    const hs = [];
    for (const m of maps.MAPS) {
      try {
        const { page, context } = await newPage({ width: vp.width, height: vp.height }, `click-${vp.name}-${m.id}`);
        if (vp.phone && m.id === 'canal') hs.push(['home', await hScroll(page)]);
        const homes = m.nodes.filter((n) => n.kind === 'home').map((n) => n.id);
        const lots = m.nodes.filter((n) => n.kind === 'lot').map((n) => n.id);
        let st = engine.createGame(
          {
            mapId: m.id,
            players: [
              { name: 'ก', characterId: 'manao', homeNodeId: homes[0] },
              { name: 'ข', characterId: 'ton', homeNodeId: homes[0] },
              { name: 'ค', characterId: 'fang', homeNodeId: homes[1] },
            ],
          },
          () => 0,
        );
        st = { ...st, shops: [{ nodeId: lots[0], ownerId: 'p2' }] }; // มีป้ายร้าน 1 ร้านเพื่อดูว่าบังจุดไหม
        await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(st)]);
        await page.reload();
        await page.waitForTimeout(400);
        if (await tid(page, 'home-resume').isVisible().catch(() => false)) await tid(page, 'home-resume').click(); // รีโหลดในแท็บเดิมจะเข้าเกมอัตโนมัติ
        await tid(page, 'start-planning').click();
        await tid(page, 'submit-plan').waitFor();
        if (vp.phone && m.id === 'canal') hs.push(['planning', await hScroll(page)]);
        const start = homes[0];
        for (const n of m.nodes) {
          total++;
          const img = page.locator('.board-img');
          await img.evaluate((el, ny) => {
            const r = el.getBoundingClientRect();
            const y = window.scrollY + r.top + ny * r.height;
            window.scrollTo(0, Math.max(0, y - window.innerHeight / 2));
          }, n.y);
          const box = await img.boundingBox();
          const x = box.x + n.x * box.width;
          const y = box.y + n.y * box.height;
          const hit = await page.evaluate(([px, py]) => {
            const el = document.elementFromPoint(px, py);
            const b = el?.closest('[data-node-id],[data-player-id],[data-shop-node]');
            return b ? b.getAttribute('data-node-id') ?? `pawn/shop:${b.getAttribute('data-player-id') ?? b.getAttribute('data-shop-node')}` : el?.className ?? 'none';
          }, [x, y]);
          await page.mouse.click(x, y);
          const sel = await page.locator('.board .board-node.is-selected').getAttribute('data-node-id');
          if (sel !== n.id) misses.push(`${m.id}/${n.id}→${sel} (hit ${hit})`);
          if (await tid(page, 'clear-path').isEnabled()) await tid(page, 'clear-path').click();
        }
        if (vp.phone && m.id === 'canal') {
          await tid(page, 'submit-plan').click();
          await tid(page, 'confirm-submit').click();
          hs.push(['handoff', await hScroll(page)]);
        }
        await context.close();
      } catch (e) {
        misses.push(`${m.id}: exception ${e.message.split('\n')[0]}`);
      }
    }
    record(`7-${vp.name}`, `กดจุดตรงพิกัด (${vp.name}) ทุกแผนที่`, misses.length === 0, `${total - misses.length}/${total} ตรง${misses.length ? '; พลาด: ' + misses.join(', ') : ''}`);
    if (vp.phone) {
      // หน้า setup ตัวละคร + วิธีเล่นบนมือถือด้วย
      const { page, context } = await newPage({ width: vp.width, height: vp.height }, 'phone-pages');
      await tid(page, 'home-start').click();
      await tid(page, 'player-count-2').click();
      await tid(page, 'setup-next').click();
      await tid(page, 'map-canal').click();
      await tid(page, 'setup-next').click();
      hs.push(['setup-player', await hScroll(page)]);
      await shot(page, 'phone-setup-character.png');
      await page.goto(BASE);
      await tid(page, 'home-howto').click();
      hs.push(['howto', await hScroll(page)]);
      await shot(page, 'phone-howto.png');
      // หน้าเปิดผล / สรุปสัปดาห์ 4 / จบเกม — ฉีดเซฟที่สร้างด้วย engine
      let g = engine.createGame(
        { mapId: 'canal', players: [0, 1, 2].map((i) => ({ name: `ผู้เล่นชื่อยาวมาก${i + 1}`, characterId: ['manao', 'ton', 'nam'][i], homeNodeId: 'home-3' })) },
        () => 0,
      );
      const stayAll = (x) => {
        while (x.phase === 'handoff') {
          const pid = x.planningPlayerId;
          const pos = x.players.find((q) => q.id === pid).position;
          x = engine.submitPlan(engine.beginPlanning(x), pid, [{ path: [pos, engine.findPath(maps.getMap('canal'), pos, 'work-1')[1]], activity: 'none' }]);
        }
        return x;
      };
      const snaps = [];
      for (let w = 1; w <= 8; w++) {
        g = stayAll(g);
        g = engine.resolveNextSlot(g);
        if (w === 1) snaps.push(['reveal', g]);
        g = engine.resolveNextSlot(engine.resolveNextSlot(g));
        if (w === 4) snaps.push(['summary-w4', g]);
        g = engine.nextWeek(g);
      }
      snaps.push(['gameOver', g]);
      for (const [label, sv] of snaps) {
        await page.goto(BASE);
        await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(sv)]);
        await page.reload();
        await page.waitForTimeout(400);
        if (await tid(page, 'home-resume').isVisible().catch(() => false)) await tid(page, 'home-resume').click(); // รีโหลดในแท็บเดิมจะเข้าเกมอัตโนมัติ
        await page.waitForTimeout(200);
        hs.push([label, await hScroll(page)]);
        await shot(page, `phone-${label}.png`);
      }
      await context.close();
      const bad = hs.filter(([, v]) => v.sw > v.cw);
      record('7-phone-scroll', 'มือถือ 390px: ไม่มี scroll แนวนอน', bad.length === 0, hs.map(([k, v]) => `${k} ${v.sw}/${v.cw}`).join(', '));
    }
  }

  // ------------------------------------------------------------------
  // 8: ฟอนต์ไทย + ข้อความวิธีเล่น
  // ------------------------------------------------------------------
  try {
    const { page, context } = await newPage({ width: 1280, height: 900 }, 'fonts');
    await tid(page, 'home-howto').click();
    await page.evaluate(() => document.fonts.ready);
    const txt = await bodyText(page);
    const fonts = await page.evaluate(() => ({
      sarabun: document.fonts.check('16px Sarabun', 'ก'),
      mitr: document.fonts.check('16px Mitr', 'ก'),
      loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).filter((v, i, a) => a.indexOf(v) === i),
    }));
    await shot(page, 'howto.png');
    await page.goto(BASE);
    await tid(page, 'home-start').click();
    await tid(page, 'player-count-2').click();
    await tid(page, 'setup-next').click();
    await tid(page, 'map-canal').click();
    await tid(page, 'setup-next').click();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await shot(page, 'setup-character-2p.png');
    await context.close();
    const has = txt.includes('รวมใช้ 7 จาก 8 เวลา');
    record('8', 'ฟอนต์ไทย (Sarabun/Mitr) โหลด + วิธีเล่นมี "รวมใช้ 7 จาก 8 เวลา"', has && fonts.sarabun && fonts.mitr, `ข้อความ=${has}; Sarabun=${fonts.sarabun} Mitr=${fonts.mitr} loaded=[${fonts.loaded}]; ภาพ: tests/e2e/out/howto.png, setup-character.png (ต้องตรวจด้วยตา)`);
  } catch (e) {
    record('8', 'ฟอนต์ไทย', false, `exception: ${e.message.split('\n')[0]}`);
  }

  await browser.close();
  record('9', 'ไม่มี console error (ยกเว้น 404 ภาพการ์ด)', consoleErrors.length === 0, consoleErrors.length ? [...new Set(consoleErrors)].slice(0, 8).join(' | ') : 'none');
  return results;
}
