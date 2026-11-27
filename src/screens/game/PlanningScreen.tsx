import { useMemo, useState } from 'react';
import type { ActivityType, GameState, PlannedAction } from '../../game/types';
import { activitiesAt, activityInfo, findPath, previewPlan, submitPlan } from '../../game/engine';
import { getMap } from '../../data/maps';
import { getCharacter } from '../../data/characters';
import { Board } from '../../components/board/Board';
import { ResourceBar } from '../../components/hud/ResourceBar';
import { PlayerList } from '../../components/hud/PlayerList';
import {
  activityIcon,
  activityLabel,
  NONE_LABEL,
  nodeLabel,
  pawnsFor,
  playerById,
  routeText,
  shopsFor,
  signed,
} from './helpers';

interface Props {
  state: GameState;
  onChange: (s: GameState) => void;
}

type Actions = [PlannedAction, PlannedAction, PlannedAction];

const endOf = (a: PlannedAction) => a.path[a.path.length - 1];

/** ช่วงหลังที่ต้นทางไม่ตรงปลายทางของช่วงก่อน → ตั้งใหม่ให้อยู่ที่เดิม */
function reanchor(actions: Actions, start: string): Actions {
  const out = [...actions] as Actions;
  let expected = start;
  for (let i = 0; i < 3; i++) {
    if (out[i].path[0] !== expected) out[i] = { path: [expected], activity: 'none' };
    expected = endOf(out[i]);
  }
  return out;
}

function costText(type: ActivityType): string {
  if (type === 'none') return 'ไม่ใช้เวลาเพิ่ม';
  const info = activityInfo(type);
  const parts = [`${info.time} ⏰`];
  if (info.energy) parts.push(`${signed(info.energy)} ⚡`);
  if (info.coins) parts.push(`${signed(info.coins)} 🪙`);
  return parts.join(' · ');
}

function costAria(type: ActivityType): string {
  if (type === 'none') return 'ไม่ใช้เวลาเพิ่ม';
  const info = activityInfo(type);
  const parts = [`ใช้เวลา ${info.time}`];
  if (info.energy) parts.push(`พลัง ${signed(info.energy)}`);
  if (info.coins) parts.push(`เหรียญ ${signed(info.coins)}`);
  return parts.join(', ');
}

/** หน้าวางแผนส่วนตัว 3 ช่วง — แสดงเฉพาะแผนของผู้เล่นคนนี้ */
export function PlanningScreen({ state, onChange }: Props) {
  const map = getMap(state.mapId);
  const player = playerById(state, state.planningPlayerId)!;
  const color = getCharacter(player.characterId).color;
  const start = player.position;

  const [actions, setActions] = useState<Actions>(() => [
    { path: [start], activity: 'none' },
    { path: [start], activity: 'none' },
    { path: [start], activity: 'none' },
  ]);
  const [slot, setSlot] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);

  const preview = useMemo(() => previewPlan(state, player.id, actions), [state, player.id, actions]);
  const current = actions[slot];
  const pathEnd = endOf(current);
  const available = useMemo<ActivityType[]>(() => activitiesAt(state, pathEnd), [state, pathEnd]);

  const update = (next: PlannedAction) => {
    const copy = [...actions] as Actions;
    copy[slot] = next;
    setActions(reanchor(copy, start));
    setConfirming(false);
  };

  /** เปลี่ยนเส้นทาง: กิจกรรมเดิมใช้ไม่ได้ที่ปลายทางใหม่ → เดินอย่างเดียว */
  const setPath = (path: string[]) => {
    const end = path[path.length - 1];
    const keep = current.activity === 'none' || activitiesAt(state, end).includes(current.activity);
    update({ path, activity: keep ? current.activity : 'none' });
  };

  const onNodeClick = (nodeId: string) => {
    if (nodeId === pathEnd) return;
    const p = findPath(map, pathEnd, nodeId);
    if (!p) {
      setPathError(`ไปถึง ${nodeLabel(map, nodeId)} ไม่ได้จากจุดนี้`);
      return;
    }
    setPathError(null);
    setPath([...current.path, ...p.slice(1)]);
  };

  const undo = () => {
    if (current.path.length > 1) setPath(current.path.slice(0, -1));
  };
  const clear = () => setPath([current.path[0]]);
  const choose = (activity: ActivityType) => update({ ...current, activity });

  const doSubmit = () => onChange(submitPlan(state, player.id, actions));

  const ghostPaths = actions
    .map((a, i) => ({ a, i }))
    .filter(({ a, i }) => i !== slot && a.path.length > 1)
    .map(({ a }) => ({ path: a.path, color }));

  const totalTime = preview.totalTime;
  const overTime = totalTime > player.time;
  const anyProblems = !preview.valid || preview.slots.some((s) => s.problems.length > 0);

  return (
    <div className="planning">
      <div className="planning-board">
        <div className="planning-board-head">
          <h2 className="planning-title">
            แผนของ {player.name} — ช่วงที่ {slot + 1}
          </h2>
          <p className="planning-hint">กดจุดบนแผนที่เพื่อต่อเส้นทางจาก “{nodeLabel(map, pathEnd)}”</p>
        </div>
        <Board
          map={map}
          pawns={pawnsFor(state)}
          shops={shopsFor(state)}
          highlightPath={current.path}
          ghostPaths={ghostPaths}
          selectedNodeId={pathEnd}
          onNodeClick={onNodeClick}
          showLabels
        />
        {pathError && (
          <p className="text-bad" role="alert">
            ⚠ {pathError}
          </p>
        )}
      </div>

      <aside className="planning-side" aria-label="แผงวางแผน">
        <section className="panel">
          <h3 className="sr-only">ทรัพยากรของฉัน</h3>
          <ResourceBar player={player} />
          <p className={`time-total ${overTime ? 'text-bad' : ''}`} data-testid="time-total">
            ⏰ ใช้ {totalTime} จาก {player.time} เวลา
            {overTime && ' — เกินเวลาที่มี!'}
          </p>
        </section>

        <div className="slot-tabs" role="tablist" aria-label="ช่วงของแผน">
          {actions.map((a, i) => {
            const sp = preview.slots[i];
            const warn = sp && sp.problems.length > 0;
            return (
              <button
                key={i}
                type="button"
                role="tab"
                id={`slot-tab-${i}`}
                aria-selected={i === slot}
                aria-controls="slot-panel"
                className={`slot-tab${i === slot ? ' active' : ''}${warn ? ' warn' : ''}`}
                data-testid={`slot-tab-${i}`}
                onClick={() => {
                  setSlot(i);
                  setPathError(null);
                }}
              >
                <span className="slot-tab-num">ช่วง {i + 1}</span>
                <span className="slot-tab-sub">
                  {activityIcon(a.activity)} {a.activity === 'none' ? (a.path.length > 1 ? 'เดิน' : 'ผ่าน') : activityLabel(a.activity)}
                  {warn && <span className="text-bad"> ⚠</span>}
                </span>
              </button>
            );
          })}
        </div>

        <section id="slot-panel" role="tabpanel" aria-labelledby={`slot-tab-${slot}`} className="panel slot-panel">
          <h3>เส้นทางช่วงที่ {slot + 1}</h3>
          <p className="route" data-testid="current-route">
            {routeText(map, current.path)}
          </p>
          <p className="route-meta">เดิน {current.path.length - 1} เส้น</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={undo} disabled={current.path.length <= 1} data-testid="undo-node">
              ↶ ย้อนจุด
            </button>
            <button type="button" className="btn btn-ghost" onClick={clear} disabled={current.path.length <= 1} data-testid="clear-path">
              ล้างเส้นทาง
            </button>
          </div>

          <fieldset className="activity-picker">
            <legend>กิจกรรมที่ {nodeLabel(map, pathEnd)}</legend>
            {(['none', ...available] as ActivityType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`activity-btn${current.activity === t ? ' selected' : ''}`}
                aria-pressed={current.activity === t}
                data-testid={`activity-${t}`}
                onClick={() => choose(t)}
                aria-label={`${t === 'none' ? NONE_LABEL : activityLabel(t)} — ${costAria(t)}`}
              >
                <span className="activity-icon" aria-hidden="true">
                  {activityIcon(t)}
                </span>
                <span className="activity-name">{t === 'none' ? NONE_LABEL : activityLabel(t)}</span>
                <span className="activity-cost" aria-hidden="true">
                  {costText(t)}
                </span>
              </button>
            ))}
            {available.length === 0 && <p className="muted">จุดนี้ไม่มีกิจกรรม — เดินผ่านได้อย่างเดียว</p>}
          </fieldset>
        </section>

        <section className="panel" aria-label="สรุปแผนทั้ง 3 ช่วง">
          <h3>สรุปแผน</h3>
          <ol className="preview-list">
            {preview.slots.map((sp, i) => (
              <li key={i} className={`preview-item${i === slot ? ' active' : ''}`} data-testid={`slot-preview-${i}`}>
                <div>
                  <strong>ช่วง {i + 1}:</strong> {routeText(map, actions[i].path)} ·{' '}
                  {activityLabel(actions[i].activity)}
                </div>
                <div>
                  เดิน {sp.moveCost} เวลา + กิจกรรม {sp.activityCost} เวลา · เหลือ ⏰ {sp.timeLeftAfter}
                </div>
                <div>
                  หลังช่วงนี้: 🪙 {sp.coinsAfter} เหรียญ · ⚡ {sp.energyAfter} พลัง
                </div>
                {sp.problems.map((pr, k) => (
                  <div key={k} className="text-bad problem">
                    ⚠ {pr}
                  </div>
                ))}
              </li>
            ))}
          </ol>
          <p className="muted small">ผลจริงอาจต่างได้ถ้ามีคนแย่งกะหรือทำเลก่อน</p>
        </section>

        <section className="panel submit-area">
          {!confirming ? (
            <button
              type="button"
              className="btn btn-primary btn-big"
              data-testid="submit-plan"
              onClick={() => setConfirming(true)}
            >
              ยืนยันและล็อกแผน
            </button>
          ) : (
            <div className="confirm-box" role="group" aria-label="ยืนยันการล็อกแผน">
              <p>
                <strong>ล็อกแผนแล้วแก้ไม่ได้</strong> — แน่ใจใช่ไหม?
              </p>
              {anyProblems && (
                <p className="text-bad">⚠ แผนนี้มีปัญหาบางช่วง ช่วงนั้นอาจไม่สำเร็จ แต่ยังส่งได้</p>
              )}
              <div className="btn-row">
                <button type="button" className="btn btn-primary" data-testid="confirm-submit" onClick={doSubmit} autoFocus>
                  ✓ ล็อกแผนเลย
                </button>
                <button type="button" className="btn btn-ghost" data-testid="cancel-submit" onClick={() => setConfirming(false)}>
                  กลับไปแก้
                </button>
              </div>
            </div>
          )}
        </section>

        <details className="panel">
          <summary>ดูผู้เล่นทั้งหมด</summary>
          <PlayerList state={state} showSubmitted currentId={player.id} />
        </details>
      </aside>
    </div>
  );
}

export default PlanningScreen;
