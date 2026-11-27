import type { GameState } from '../../game/types';
import { beginPlanning } from '../../game/engine';
import { getCharacter } from '../../data/characters';
import { CharacterCard } from '../../components/CharacterCard';
import { getMap } from '../../data/maps';
import { nodeLabel, playerById, TOTAL_WEEKS } from './helpers';

interface Props {
  state: GameState;
  onChange: (s: GameState) => void;
}

/** หน้าส่งเครื่อง — ไม่แสดงแผนของใครเลย */
export function HandoffScreen({ state, onChange }: Props) {
  const player = playerById(state, state.planningPlayerId);
  const map = getMap(state.mapId);
  if (!player) {
    return <p className="panel">ไม่พบผู้เล่นที่ต้องวางแผน</p>;
  }
  const character = getCharacter(player.characterId);
  const submittedNames = state.players.filter((p) => state.plans[p.id]).map((p) => p.name);
  const waitingNames = state.players.filter((p) => !state.plans[p.id]).map((p) => p.name);
  const showLunch = state.lunchPayouts.length > 0 && submittedNames.length === 0;

  return (
    <div className="handoff">
      <section className="panel handoff-main" aria-labelledby="handoff-title">
        <p className="handoff-week">
          สัปดาห์ที่ {state.week}/{TOTAL_WEEKS}
        </p>
        <h2 id="handoff-title" className="handoff-title">
          ส่งเครื่องให้ {player.name}
        </h2>
        <p className="handoff-hint">คนอื่นช่วยหันหน้าออกก่อนนะ — แผนของแต่ละคนเป็นความลับจนกว่าจะเปิดผล</p>
        <div className="handoff-card">
          <CharacterCard character={character} />
        </div>
        <button
          type="button"
          className="btn btn-primary btn-big"
          data-testid="start-planning"
          onClick={() => onChange(beginPlanning(state))}
          autoFocus
        >
          ฉันคือ {player.name} — เริ่มวางแผน
        </button>
      </section>

      <aside className="handoff-side">
        {showLunch && (
          <section className="panel notice notice-lunch" aria-label="พักเที่ยงพร้อมกัน" data-testid="lunch-notice">
            <h3>🍱 พักเที่ยงพร้อมกัน!</h3>
            <ul>
              {state.lunchPayouts.map((lp) => (
                <li key={`${lp.ownerId}-${lp.nodeId}`}>
                  ร้านของ {playerById(state, lp.ownerId)?.name ?? lp.ownerId} ที่ {nodeLabel(map, lp.nodeId)}: +{lp.amount} 🪙
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="panel" aria-label="สถานะการส่งแผน" data-testid="submit-status">
          <h3>สถานะการส่งแผน</h3>
          <p>
            <strong>✓ ส่งแผนแล้ว:</strong> {submittedNames.length ? submittedNames.join(', ') : 'ยังไม่มี'}
          </p>
          <p>
            <strong>… ยังไม่ส่ง:</strong> {waitingNames.length ? waitingNames.join(', ') : 'ครบแล้ว'}
          </p>
        </section>
      </aside>
    </div>
  );
}

export default HandoffScreen;
