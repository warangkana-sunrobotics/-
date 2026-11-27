import type { ActionResult, GameMap, GameState } from '../../game/types';
import { priorityOrder } from '../../game/engine';
import { getCharacter } from '../../data/characters';
import { activityIcon, activityLabel, deltaAria, formatDelta, playerById, routeText } from './helpers';

interface Props {
  state: GameState;
  map: GameMap;
  slot: number;
  results: ActionResult[];
  /** ระดับหัวข้อ */
  headingLevel?: 3 | 4;
}

/** ผลของหนึ่งช่วง เรียงตามลำดับสิทธิ์ */
export function SlotResults({ state, map, slot, results, headingLevel = 3 }: Props) {
  const order = priorityOrder(state).map((p) => p.id);
  const sorted = [...results].sort((a, b) => order.indexOf(a.playerId) - order.indexOf(b.playerId));
  const H = headingLevel === 3 ? 'h3' : 'h4';
  return (
    <section className="slot-results" aria-label={`ผลช่วงที่ ${slot + 1}`} data-testid={`slot-results-${slot}`}>
      <H>ผลช่วงที่ {slot + 1}</H>
      <ol className="result-list">
        {sorted.map((r) => {
          const p = playerById(state, r.playerId);
          const color = p ? getCharacter(p.characterId).color : 'var(--line)';
          const paidOwner = r.paidTo ? playerById(state, r.paidTo) : undefined;
          const paidAmount = Math.abs(r.delta.coins);
          return (
            <li key={r.playerId} className={`result-row ${r.success ? 'ok' : 'fail'}`} style={{ borderLeftColor: color }}>
              <div className="result-head">
                <strong>{p?.name ?? r.playerId}</strong>
                <span className="result-activity">
                  <span aria-hidden="true">{activityIcon(r.activity)}</span> {activityLabel(r.activity)}
                </span>
                <span className={`result-status ${r.success ? 'ok' : 'fail'}`}>
                  {r.success ? '✓ สำเร็จ' : '✗ ไม่สำเร็จ'}
                </span>
              </div>
              <div className="result-route">
                <span aria-hidden="true">🚶 </span>
                {routeText(map, r.planned.path)}
                {!r.moved && <span className="result-nomove"> (ไม่ได้เดิน)</span>}
              </div>
              {!r.success && r.reasonText && <div className="result-reason">⚠ {r.reasonText}</div>}
              <div className="result-delta" aria-label={deltaAria(r.delta)}>
                <span aria-hidden="true">{formatDelta(r.delta)}</span>
              </div>
              {r.paidTo && paidAmount > 0 && (
                <div className="result-paid">
                  💸 จ่าย {paidAmount} 🪙 ให้{' '}
                  {paidOwner && paidOwner.id !== r.playerId ? `เจ้าของร้าน ${paidOwner.name}` : 'กองกลาง'}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default SlotResults;
