import type { GameState } from '../../game/types';
import { computeScores } from '../../game/engine';
import { getCharacter } from '../../data/characters';
import { CharacterCard } from '../../components/CharacterCard';
import { playerById } from './helpers';

interface Props {
  state: GameState;
  onExit: () => void;
}

const Mark = ({ ok }: { ok: boolean }) => (
  <span className={ok ? 'text-good' : 'muted'}>{ok ? '✓ ได้' : '✗ ไม่ได้'}</span>
);

/** ประกาศผู้ชนะ + ตารางคะแนน */
export function WinnerScreen({ state, onExit }: Props) {
  const rows = [...computeScores(state)].sort((a, b) => a.rank - b.rank);
  const winners = rows.filter((r) => r.isWinner);
  const tie = winners.length > 1;

  return (
    <div className="winner">
      <section className="panel winner-hero" aria-labelledby="winner-title">
        <h2 id="winner-title">🎉 {tie ? 'ชนะร่วม!' : 'ผู้ชนะ!'}</h2>
        <div className="winner-cards">
          {winners.map((w) => {
            const p = playerById(state, w.playerId);
            if (!p) return null;
            return (
              <figure key={w.playerId} className="winner-card" data-testid={`winner-${w.playerId}`}>
                <CharacterCard character={getCharacter(p.characterId)} />
                <figcaption>
                  <strong>{p.name}</strong> — {tie ? 'ชนะร่วม' : 'ผู้ชนะ'} ({w.total} คะแนน)
                </figcaption>
              </figure>
            );
          })}
        </div>
      </section>

      <section className="panel" aria-label="ตารางคะแนน">
        <h3>ตารางคะแนน</h3>
        <p className="muted small">คะแนน = หมุดหมาย + ชุดเหรียญ (เหรียญ÷5 ปัดลง) − ยอดค้าง · เสมอ → พลังมากกว่าชนะ</p>
        <div className="table-wrap">
          <table className="score-table" data-testid="score-table">
            <thead>
              <tr>
                <th scope="col">อันดับ</th>
                <th scope="col">ผู้เล่น</th>
                <th scope="col">📖 เรียนสำเร็จ</th>
                <th scope="col">🛠️ กะใช้ทักษะครั้งแรก</th>
                <th scope="col">🛠️ ครบ 3 กะ</th>
                <th scope="col">หมุดหมาย</th>
                <th scope="col">🪙 เหรียญ</th>
                <th scope="col">ชุดเหรียญ</th>
                <th scope="col">🧾 ยอดค้าง</th>
                <th scope="col">⚡ พลัง</th>
                <th scope="col">รวม</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = playerById(state, r.playerId);
                return (
                  <tr key={r.playerId} className={r.isWinner ? 'is-winner' : ''} data-testid={`score-row-${r.playerId}`}>
                    <td>
                      {r.rank}
                      {r.isWinner && <span className="badge badge-done"> {tie ? 'ชนะร่วม' : 'ผู้ชนะ'}</span>}
                    </td>
                    <th scope="row">
                      {p?.name ?? r.playerId}
                      {p && <span className="muted small"> ({getCharacter(p.characterId).name})</span>}
                    </th>
                    <td><Mark ok={r.milestoneLearn} /></td>
                    <td><Mark ok={r.milestoneFirstSkillShift} /></td>
                    <td><Mark ok={r.milestoneThreeSkillShifts} /></td>
                    <td>{r.milestonePoints}</td>
                    <td>{r.coins}</td>
                    <td>{r.coinSetPoints}</td>
                    <td className={r.debt > 0 ? 'text-bad' : ''}>{r.debt > 0 ? `−${r.debt}` : 0}</td>
                    <td>{r.energy}</td>
                    <td><strong>{r.total}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="center">
        <button type="button" className="btn btn-primary btn-big" onClick={onExit} data-testid="back-home">
          กลับหน้าแรก
        </button>
      </div>
    </div>
  );
}

export default WinnerScreen;
