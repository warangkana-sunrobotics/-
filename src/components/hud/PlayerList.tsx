import { useState } from 'react';
import type { GameState, Player } from '../../game/types';
import { getCharacter } from '../../data/characters';
import { ResourceBar } from './ResourceBar';
import './hud.css';

/** รูปย่อตัวละคร — ถ้าโหลดภาพไม่ได้ แสดงวงกลมสี + ชื่อย่อ */
export function Portrait({ player, size = 44 }: { player: Player; size?: number }) {
  const c = getCharacter(player.characterId);
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, background: c.color };
  if (!c.card || broken) {
    return (
      <span className="portrait portrait-fallback" style={style} aria-hidden="true">
        {c.initials}
      </span>
    );
  }
  return (
    <span className="portrait" style={style} aria-hidden="true">
      <img src={c.card} alt="" onError={() => setBroken(true)} />
    </span>
  );
}

interface Props {
  state: GameState;
  /** แสดงสถานะส่งแผน (ช่วงรวบรวมแผน) */
  showSubmitted?: boolean;
  /** ผู้เล่นที่ไฮไลต์ (เช่น คนที่กำลังวางแผน) */
  currentId?: string | null;
  compact?: boolean;
  title?: string;
}

/** รายชื่อผู้เล่น เรียงตามลำดับสิทธิ์ (ผู้ถือสิทธิ์ก่อนอยู่บนสุด) */
export function PlayerList({ state, showSubmitted, currentId, compact = true, title = 'ผู้เล่น' }: Props) {
  const n = state.players.length;
  const ordered = [...state.players].sort(
    (a, b) => ((a.seat - state.firstSeat + n) % n) - ((b.seat - state.firstSeat + n) % n),
  );
  return (
    <section className="player-list" aria-label={title}>
      <h3 className="player-list-title">{title}</h3>
      <ol>
        {ordered.map((p) => {
          const c = getCharacter(p.characterId);
          const submitted = Boolean(state.plans[p.id]);
          const first = p.seat === state.firstSeat;
          return (
            <li
              key={p.id}
              className={`player-row${p.id === currentId ? ' current' : ''}`}
              style={{ borderLeftColor: c.color }}
              data-testid={`player-row-${p.id}`}
            >
              <Portrait player={p} />
              <div className="player-row-main">
                <div className="player-row-name">
                  <strong>{p.name}</strong> <span className="player-row-char">({c.name})</span>
                  {first && (
                    <span className="badge badge-first" title="ผู้ถือสิทธิ์ก่อน — ทำกิจกรรมก่อนในทุกช่วง">
                      ⭐ สิทธิ์ก่อน
                    </span>
                  )}
                  {showSubmitted && (
                    <span className={`badge ${submitted ? 'badge-done' : 'badge-wait'}`}>
                      {submitted ? '✓ ส่งแผนแล้ว' : '… ยังไม่ส่ง'}
                    </span>
                  )}
                </div>
                <ResourceBar player={p} compact={compact} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default PlayerList;
