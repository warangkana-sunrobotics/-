import type { GameState } from '../../game/types';
import { HandoffScreen } from './HandoffScreen';
import { PlanningScreen } from './PlanningScreen';
import { RevealScreen } from './RevealScreen';
import { WeekSummaryScreen } from './WeekSummaryScreen';
import { WinnerScreen } from './WinnerScreen';
import { BILL_AMOUNT, BILL_WEEKS, TOTAL_WEEKS } from './helpers';
import './game.css';

interface Props {
  state: GameState;
  onChange: (s: GameState) => void;
  onExit: () => void;
}

const PHASE_LABEL: Record<GameState['phase'], string> = {
  handoff: 'ส่งเครื่อง',
  planning: 'วางแผน',
  reveal: 'เปิดผล',
  weekSummary: 'สรุปสัปดาห์',
  gameOver: 'จบเกม',
};

/** หน้าเล่นเกม — เลือกหน้าย่อยตาม state.phase; เปลี่ยนสถานะผ่าน onChange เท่านั้น */
export function GameScreen({ state, onChange, onExit }: Props) {
  const billWeek =
    BILL_WEEKS.includes(state.week) && (state.phase === 'handoff' || state.phase === 'planning' || state.phase === 'reveal');
  const planner = state.players.find((p) => p.id === state.planningPlayerId);

  let body: JSX.Element;
  switch (state.phase) {
    case 'handoff':
      body = <HandoffScreen state={state} onChange={onChange} />;
      break;
    case 'planning':
      body = planner ? (
        <PlanningScreen key={`${state.week}-${planner.id}`} state={state} onChange={onChange} />
      ) : (
        <p className="panel">ไม่พบผู้เล่นที่ต้องวางแผน</p>
      );
      break;
    case 'reveal':
      body = <RevealScreen state={state} onChange={onChange} />;
      break;
    case 'weekSummary':
      body = <WeekSummaryScreen state={state} onChange={onChange} />;
      break;
    case 'gameOver':
      body = <WinnerScreen state={state} onExit={onExit} />;
      break;
    default:
      body = <p className="panel">สถานะเกมไม่ถูกต้อง</p>;
  }

  return (
    <div className="game-screen" data-phase={state.phase}>
      <header className="game-header">
        <div className="game-header-info">
          <span className="week-chip" data-testid="week-label">
            สัปดาห์ {Math.min(state.week, TOTAL_WEEKS)}/{TOTAL_WEEKS}
          </span>
          <span className="phase-chip">{PHASE_LABEL[state.phase]}</span>
          {billWeek && (
            <span className="bill-notice" role="note" data-testid="bill-notice">
              🧾 จบสัปดาห์นี้มีบิล {BILL_AMOUNT} เหรียญ
            </span>
          )}
        </div>
        <button type="button" className="btn btn-ghost" onClick={onExit} data-testid="exit-game">
          ออกไปหน้าแรก <span className="muted small">(บันทึกอัตโนมัติ)</span>
        </button>
      </header>
      <main className="game-body">{body}</main>
    </div>
  );
}

export default GameScreen;
