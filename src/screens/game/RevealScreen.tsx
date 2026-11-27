import type { GameState } from '../../game/types';
import { resolveNextSlot } from '../../game/engine';
import { getMap } from '../../data/maps';
import { Board } from '../../components/board/Board';
import { PlayerList } from '../../components/hud/PlayerList';
import { SlotResults } from './SlotResults';
import { pawnsFor, playerById, playerColor, shopsFor } from './helpers';

interface Props {
  state: GameState;
  onChange: (s: GameState) => void;
}

/** เปิดผลทีละช่วง */
export function RevealScreen({ state, onChange }: Props) {
  const map = getMap(state.mapId);
  const resolved = state.slotResults.slice(0, state.slotsResolved);
  const last = resolved[resolved.length - 1] ?? [];
  const ghostPaths = last
    .filter((r) => r.moved && r.planned.path.length > 1)
    .map((r) => {
      const p = playerById(state, r.playerId);
      return { path: r.planned.path, color: p ? playerColor(p) : '#888888' };
    });
  const next = state.slotsResolved + 1;

  return (
    <div className="reveal">
      <div className="reveal-board">
        <h2>เปิดผลแผน {state.slotsResolved > 0 ? `(เปิดแล้ว ${state.slotsResolved}/3 ช่วง)` : ''}</h2>
        <Board map={map} pawns={pawnsFor(state)} shops={shopsFor(state)} ghostPaths={ghostPaths} showLabels />
        {state.slotsResolved < 3 && (
          <div className="reveal-actions">
            <button
              type="button"
              className="btn btn-primary btn-big"
              data-testid="reveal-next"
              onClick={() => onChange(resolveNextSlot(state))}
              autoFocus
            >
              เปิดผลช่วงที่ {next}
            </button>
            <p className="muted small">ทุกคนเดินพร้อมกัน แล้วทำกิจกรรมตามลำดับสิทธิ์ (⭐ สิทธิ์ก่อนได้ก่อน)</p>
          </div>
        )}
      </div>
      <aside className="reveal-side">
        <div aria-live="polite">
          {resolved.length === 0 && <p className="panel">ทุกคนส่งแผนครบแล้ว! กดปุ่มเพื่อเปิดผลช่วงที่ 1</p>}
          {[...resolved]
            .map((rs, i) => ({ rs, i }))
            .reverse()
            .map(({ rs, i }) => (
              <div className="panel" key={i}>
                <SlotResults state={state} map={map} slot={i} results={rs} />
              </div>
            ))}
        </div>
        <div className="panel">
          <PlayerList state={state} />
        </div>
      </aside>
    </div>
  );
}

export default RevealScreen;
