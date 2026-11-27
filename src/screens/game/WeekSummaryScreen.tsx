import { useState } from 'react';
import type { GameState, Player } from '../../game/types';
import { nextWeek, payDebt } from '../../game/engine';
import { getMap } from '../../data/maps';
import { PlayerList } from '../../components/hud/PlayerList';
import { SlotResults } from './SlotResults';
import { nodeLabel, playerById, TOTAL_WEEKS } from './helpers';

interface Props {
  state: GameState;
  onChange: (s: GameState) => void;
}

function DebtPayer({ state, player, onChange }: { state: GameState; player: Player; onChange: (s: GameState) => void }) {
  const max = Math.min(player.debt, player.coins);
  const [amount, setAmount] = useState(1);
  const amt = Math.max(1, Math.min(amount, max));
  return (
    <li className="debt-row" data-testid={`debt-row-${player.id}`}>
      <div>
        <strong>{player.name}</strong> — ยอดค้าง 🧾 {player.debt} · มี 🪙 {player.coins}
      </div>
      <div className="btn-row">
        <div className="stepper" role="group" aria-label={`จำนวนที่ ${player.name} จะจ่าย`}>
          <button type="button" className="btn btn-sm" aria-label="ลดจำนวน" onClick={() => setAmount(amt - 1)} disabled={amt <= 1}>
            −
          </button>
          <output className="stepper-value" aria-live="polite" data-testid={`pay-debt-amount-${player.id}`}>
            {amt}
          </output>
          <button type="button" className="btn btn-sm" aria-label="เพิ่มจำนวน" onClick={() => setAmount(amt + 1)} disabled={amt >= max}>
            +
          </button>
        </div>
        <button
          type="button"
          className="btn"
          data-testid={`pay-debt-some-${player.id}`}
          onClick={() => {
            onChange(payDebt(state, player.id, amt));
            setAmount(1);
          }}
        >
          จ่าย {amt} 🪙
        </button>
        <button
          type="button"
          className="btn btn-primary"
          data-testid={`pay-debt-${player.id}`}
          onClick={() => onChange(payDebt(state, player.id, max))}
        >
          จ่ายเท่าที่จ่ายได้ ({max} 🪙)
        </button>
      </div>
    </li>
  );
}

/** สรุปสัปดาห์: ผลทั้ง 3 ช่วง, พักเที่ยง, บิล, จ่ายยอดค้าง */
export function WeekSummaryScreen({ state, onChange }: Props) {
  const map = getMap(state.mapId);
  const debtors = state.players.filter((p) => p.debt > 0 && p.coins > 0);
  const isLast = state.week >= TOTAL_WEEKS;

  return (
    <div className="summary">
      <h2>สรุปสัปดาห์ที่ {state.week}</h2>
      <div className="summary-grid">
        <div className="summary-main">
          {state.slotResults.slice(0, state.slotsResolved).map((rs, i) => (
            <div className="panel" key={i}>
              <SlotResults state={state} map={map} slot={i} results={rs} />
            </div>
          ))}
        </div>
        <aside className="summary-side">
          {state.lunchPayouts.length > 0 && (
            <section className="panel" aria-label="พักเที่ยงพร้อมกัน">
              <h3>🍱 พักเที่ยงสัปดาห์นี้</h3>
              <ul>
                {state.lunchPayouts.map((lp) => (
                  <li key={`${lp.ownerId}-${lp.nodeId}`}>
                    ร้านของ {playerById(state, lp.ownerId)?.name ?? lp.ownerId} ที่ {nodeLabel(map, lp.nodeId)}: +{lp.amount} 🪙
                  </li>
                ))}
              </ul>
            </section>
          )}

          {state.billResults.length > 0 && (
            <section className="panel" aria-label="ผลการจ่ายบิล" data-testid="bill-results">
              <h3>🧾 บิลสิ้นเดือน</h3>
              <ul>
                {state.billResults.map((b) => (
                  <li key={b.playerId}>
                    <strong>{playerById(state, b.playerId)?.name ?? b.playerId}</strong>: บิล {b.bill}, จ่าย {b.paid}
                    {b.addedDebt > 0 ? (
                      <span className="text-bad">, ค้างเพิ่ม {b.addedDebt}</span>
                    ) : (
                      <span className="text-good">, จ่ายครบ ✓</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {debtors.length > 0 && (
            <section className="panel" aria-label="จ่ายยอดค้าง">
              <h3>จ่ายยอดค้าง</h3>
              <p className="muted small">ยอดค้างหักคะแนน 1 ต่อ 1 เหรียญ จ่ายตอนนี้ได้</p>
              <ul className="debt-list">
                {debtors.map((p) => (
                  <DebtPayer key={p.id} state={state} player={p} onChange={onChange} />
                ))}
              </ul>
            </section>
          )}

          <div className="panel">
            <PlayerList state={state} />
          </div>

          <button
            type="button"
            className="btn btn-primary btn-big"
            data-testid="next-week"
            onClick={() => onChange(nextWeek(state))}
          >
            {isLast ? 'คิดคะแนนสุดท้าย' : `ไปสัปดาห์ที่ ${state.week + 1}`}
          </button>
        </aside>
      </div>
    </div>
  );
}

export default WeekSummaryScreen;
