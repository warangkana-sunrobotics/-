import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterId, GameMap, GameSetup, MapId } from '../../game/types';
import { MAPS } from '../../data/maps';
import { CHARACTERS, getCharacter } from '../../data/characters';
import { Board } from '../../components/board/Board';
import { CharacterCard } from '../../components/CharacterCard';
import {
  MIN_PLAYERS,
  PLAYER_COUNTS,
  type PlayerDraft,
  assignCharacter,
  buildSetup,
  defaultName,
  homeNodeIds,
  isDraftComplete,
  nodeLabel,
  resizeDrafts,
  shiftSeats,
  takenCharacters,
  validateSetup,
} from './setupLogic';
import './setup.css';

export interface SetupFlowProps {
  onStart: (setup: GameSetup) => void;
  onCancel: () => void;
}

/**
 * ขั้นตอน (step index):
 * 0 = จำนวนผู้เล่น, 1 = เลือกแผนที่, 2..(2+n-1) = ผู้เล่นแต่ละคน, 2+n = สรุป
 */
export function SetupFlow({ onStart, onCancel }: SetupFlowProps) {
  const [step, setStep] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const [mapId, setMapId] = useState<MapId | null>(null);
  const [drafts, setDrafts] = useState<PlayerDraft[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const map: GameMap | null = useMemo(() => MAPS.find((m: GameMap) => m.id === mapId) ?? null, [mapId]);
  const n = count ?? 0;
  const totalSteps = 3 + (count ?? MIN_PLAYERS);
  const summaryStep = 2 + n;
  const playerIndex = step >= 2 && step < summaryStep ? step - 2 : -1;

  // ย้ายโฟกัสไปหัวข้อเมื่อเปลี่ยนขั้น (ผู้ใช้คีย์บอร์ด/โปรแกรมอ่านหน้าจอรู้ว่าเปลี่ยนหน้า)
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const chooseCount = (c: number) => {
    setCount(c);
    setDrafts((prev) => resizeDrafts(c, prev));
  };

  const chooseMap = (id: MapId) => {
    if (id !== mapId) {
      // เปลี่ยนแผนที่ → บ้านเดิมใช้ไม่ได้ ล้างทิ้ง
      setDrafts((prev) => prev.map((d) => ({ ...d, homeNodeId: null })));
    }
    setMapId(id);
  };

  const updateDraft = (i: number, patch: Partial<PlayerDraft>) =>
    setDrafts((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const back = () => (step === 0 ? onCancel() : setStep(step - 1));
  const next = () => setStep(step + 1);

  const stepName =
    step === 0
      ? 'จำนวนผู้เล่น'
      : step === 1
        ? 'เลือกแผนที่'
        : playerIndex >= 0
          ? `ผู้เล่นคนที่ ${playerIndex + 1}`
          : 'สรุปก่อนเริ่ม';

  return (
    <main className="setup">
      <header className="setup-head">
        <button type="button" className="btn btn-ghost" onClick={back}>
          ← {step === 0 ? 'กลับหน้าแรก' : 'ย้อนกลับ'}
        </button>
        <p className="setup-steps" aria-live="polite">
          ขั้นที่ {step + 1} / {totalSteps}: {stepName}
        </p>
      </header>
      <ol className="setup-dots" aria-hidden="true">
        {Array.from({ length: totalSteps }, (_, i) => (
          <li key={i} className={i === step ? 'is-current' : i < step ? 'is-done' : ''} />
        ))}
      </ol>

      {step === 0 && (
        <section className="setup-section">
          <h2 ref={headingRef} tabIndex={-1}>
            มีผู้เล่นกี่คน?
          </h2>
          <div className="setup-count-grid" role="group" aria-label="จำนวนผู้เล่น">
            {PLAYER_COUNTS.map((c) => (
              <button
                key={c}
                type="button"
                className={`setup-count ${count === c ? 'is-selected' : ''}`}
                aria-pressed={count === c}
                onClick={() => chooseCount(c)}
                data-testid={`player-count-${c}`}
              >
                <span className="setup-count-num">{c}</span>
                <span className="setup-count-unit">คน</span>
              </button>
            ))}
          </div>
          <p className="setup-note">
            กะงาน: <strong>1 ที่ต่อจุด</strong> สำหรับ 2–4 คน · <strong>2 ที่ต่อจุด</strong> สำหรับ 5–8 คน
            {count !== null && (
              <>
                <br />
                เลือก {count} คน → กะงาน {shiftSeats(count)} ที่ต่อจุดต่อช่วง
              </>
            )}
          </p>
          <div className="setup-actions">
            <button type="button" className="btn btn-primary" disabled={count === null} onClick={next} data-testid="setup-next">
              ถัดไป: เลือกแผนที่ →
            </button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="setup-section">
          <h2 ref={headingRef} tabIndex={-1}>
            เลือกแผนที่
          </h2>
          <div className="setup-map-grid" role="group" aria-label="แผนที่">
            {MAPS.map((m: GameMap) => (
              <button
                key={m.id}
                type="button"
                className={`setup-map ${mapId === m.id ? 'is-selected' : ''}`}
                aria-pressed={mapId === m.id}
                onClick={() => chooseMap(m.id)}
                data-testid={`map-${m.id}`}
              >
                <img className="setup-map-thumb" src={m.image} alt="" loading="lazy" />
                <span className="setup-map-name">
                  {mapId === m.id && <span aria-hidden="true">✓ </span>}
                  {m.name}
                </span>
                <span className="setup-map-desc">{m.description}</span>
              </button>
            ))}
          </div>
          <div className="setup-actions">
            <button type="button" className="btn btn-primary" disabled={!map} onClick={next} data-testid="setup-next">
              ถัดไป: ผู้เล่นคนที่ 1 →
            </button>
          </div>
        </section>
      )}

      {playerIndex >= 0 && map && (
        <PlayerStep
          key={playerIndex}
          headingRef={headingRef}
          index={playerIndex}
          drafts={drafts}
          map={map}
          isLast={playerIndex === n - 1}
          onUpdate={(patch) => updateDraft(playerIndex, patch)}
          onPickCharacter={(id) => setDrafts((prev) => assignCharacter(prev, playerIndex, id))}
          onNext={next}
        />
      )}

      {step === summaryStep && map && (
        <Summary
          headingRef={headingRef}
          drafts={drafts}
          map={map}
          onEdit={(i) => setStep(2 + i)}
          onStart={() => {
            const setup = buildSetup(map.id, drafts);
            if (setup && validateSetup(setup, map).length === 0) onStart(setup);
          }}
        />
      )}
    </main>
  );
}

interface PlayerStepProps {
  headingRef: RefObject<HTMLHeadingElement>;
  index: number;
  drafts: PlayerDraft[];
  map: GameMap;
  isLast: boolean;
  onUpdate: (patch: Partial<PlayerDraft>) => void;
  onPickCharacter: (id: CharacterId) => void;
  onNext: () => void;
}

function PlayerStep({ headingRef, index, drafts, map, isLast, onUpdate, onPickCharacter, onNext }: PlayerStepProps) {
  const draft = drafts[index];
  const taken = takenCharacters(drafts, index);
  const homes = useMemo(() => homeNodeIds(map), [map]);
  const complete = isDraftComplete(drafts, index, map);
  const inputId = `player-name-${index}`;
  const homeLabel = nodeLabel(map, draft.homeNodeId);

  const pawns = drafts.flatMap((d, i) => {
    if (!d.characterId || !d.homeNodeId) return [];
    const c = getCharacter(d.characterId);
    return [
      {
        playerId: `p${i + 1}`,
        nodeId: d.homeNodeId,
        color: c.color,
        initials: c.initials,
        name: d.name.trim() || defaultName(i),
      },
    ];
  });

  const missing: string[] = [];
  if (draft.name.trim() === '') missing.push('ตั้งชื่อ');
  if (!draft.characterId) missing.push('เลือกตัวละคร');
  if (!draft.homeNodeId) missing.push('เลือกบ้านบนกระดาน');

  return (
    <section className="setup-section">
      <h2 ref={headingRef} tabIndex={-1}>
        ผู้เล่นคนที่ {index + 1}
      </h2>

      <div className="setup-field">
        <label htmlFor={inputId}>ชื่อผู้เล่น</label>
        <input
          id={inputId}
          className="setup-input"
          type="text"
          maxLength={20}
          value={draft.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          data-testid="player-name-input"
        />
        {draft.name.trim() === '' && <p className="setup-error">กรุณาใส่ชื่อ</p>}
      </div>

      <h3>เลือกตัวละคร</h3>
      <div className="setup-card-grid" role="group" aria-label="ตัวละคร">
        {CHARACTERS.map((c) => {
          const by = taken.get(c.id);
          const disabled = by !== undefined;
          return (
            <CharacterCard
              key={c.id}
              character={c}
              selected={draft.characterId === c.id}
              disabled={disabled}
              disabledReason={disabled ? `ถูกเลือกแล้วโดย ${drafts[by].name.trim() || defaultName(by)}` : undefined}
              onSelect={(ch) => onPickCharacter(ch.id)}
              compact
            />
          );
        })}
      </div>

      <h3>เลือกบ้านเริ่มต้น</h3>
      <p className="setup-hint">กดจุดบ้านบนกระดาน (บ้านซ้ำกับคนอื่นได้)</p>
      <div className="setup-board">
        <Board
          map={map}
          pawns={pawns}
          selectableNodeIds={homes}
          selectedNodeId={draft.homeNodeId ?? undefined}
          onNodeClick={(id: string) => {
            if (homes.includes(id)) onUpdate({ homeNodeId: id });
          }}
          showLabels
        />
      </div>
      <p className="setup-home" aria-live="polite">
        บ้านที่เลือก: {homeLabel ? <strong>{homeLabel}</strong> : <span className="setup-muted">ยังไม่ได้เลือก</span>}
      </p>

      <div className="setup-actions">
        {!complete && missing.length > 0 && <p className="setup-hint">ยังต้อง: {missing.join(' · ')}</p>}
        <button type="button" className="btn btn-primary" disabled={!complete} onClick={onNext} data-testid="setup-next">
          {isLast ? 'ไปหน้าสรุป →' : 'ผู้เล่นถัดไป →'}
        </button>
      </div>
    </section>
  );
}

interface SummaryProps {
  headingRef: RefObject<HTMLHeadingElement>;
  drafts: PlayerDraft[];
  map: GameMap;
  onEdit: (index: number) => void;
  onStart: () => void;
}

function Summary({ headingRef, drafts, map, onEdit, onStart }: SummaryProps) {
  const setup = buildSetup(map.id, drafts);
  const problems = setup ? validateSetup(setup, map) : ['ยังมีผู้เล่นที่เลือกไม่ครบ'];

  return (
    <section className="setup-section">
      <h2 ref={headingRef} tabIndex={-1}>
        สรุปก่อนเริ่มเกม
      </h2>
      <p>
        แผนที่: <strong>{map.name}</strong> · ผู้เล่น {drafts.length} คน · กะงาน {shiftSeats(drafts.length)} ที่ต่อจุด
      </p>
      <ul className="setup-summary">
        {drafts.map((d, i) => {
          const c = d.characterId ? getCharacter(d.characterId) : null;
          return (
            <li key={i} className="setup-summary-row">
              {c && (
                <span className="setup-pawn" style={{ background: c.color }} aria-hidden="true">
                  {c.initials}
                </span>
              )}
              <span className="setup-summary-text">
                <strong>{d.name.trim() || defaultName(i)}</strong>
                <span>
                  {c ? `${c.name} (${c.title})` : 'ยังไม่เลือกตัวละคร'} · บ้าน: {nodeLabel(map, d.homeNodeId) ?? 'ยังไม่เลือก'}
                </span>
              </span>
              <button type="button" className="btn btn-ghost setup-edit" onClick={() => onEdit(i)}>
                แก้ไข<span className="sr-only"> {d.name.trim() || defaultName(i)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {problems.length > 0 && (
        <ul className="setup-error" role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="setup-actions">
        <button type="button" className="btn btn-primary" disabled={problems.length > 0} onClick={onStart} data-testid="setup-start">
          เริ่มเกม
        </button>
      </div>
    </section>
  );
}

export default SetupFlow;
