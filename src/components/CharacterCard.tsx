import { useEffect, useState } from 'react';
import type { Character } from '../game/types';
import './CharacterCard.css';

export interface CharacterCardProps {
  character: Character;
  selected?: boolean;
  disabled?: boolean;
  /** ข้อความบอกเหตุผลที่เลือกไม่ได้ เช่น "ถูกเลือกแล้วโดย ผู้เล่น 1" */
  disabledReason?: string;
  onSelect?: (character: Character) => void;
  /** แบบย่อ: ซ่อนคำอธิบาย */
  compact?: boolean;
}

/** ผสมสี hex กับสีขาวตามสัดส่วน (0 = สีเดิม, 1 = ขาว) เพื่อทำพื้นพาสเทล */
export function tint(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#f3ece2';
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function CharacterCard({
  character,
  selected = false,
  disabled = false,
  disabledReason,
  onSelect,
  compact = false,
}: CharacterCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setImgFailed(false), [character.card]);

  const showImage = character.card !== null && !imgFailed;
  const alt = `${character.name} ${character.title}`;

  const art = showImage ? (
    <img
      className="cc-img"
      src={character.card ?? undefined}
      alt={alt}
      loading="lazy"
      onError={() => setImgFailed(true)}
    />
  ) : (
    <div
      className="cc-placeholder"
      style={{ background: tint(character.color, 0.78), color: character.color }}
      role="img"
      aria-label={`${alt} (การ์ดตัวแทน)`}
    >
      <span className="cc-initials" aria-hidden="true">
        {character.initials}
      </span>
      <span className="cc-missing" aria-hidden="true">
        ภาพการ์ดยังไม่มา
      </span>
    </div>
  );

  const body = (
    <>
      <div className="cc-art">
        {art}
        {selected && (
          <span className="cc-badge" aria-hidden="true">
            ✓ เลือกแล้ว
          </span>
        )}
      </div>
      <div className="cc-text">
        <span className="cc-name">
          <span className="cc-dot" style={{ background: character.color }} aria-hidden="true" />
          {character.name}
        </span>
        <span className="cc-title">{character.title}</span>
        {!compact && <span className="cc-desc">{character.description}</span>}
        {disabled && disabledReason && <span className="cc-reason">{disabledReason}</span>}
      </div>
    </>
  );

  const cls = [
    'cc',
    compact ? 'cc-compact' : '',
    selected ? 'cc-selected' : '',
    disabled ? 'cc-disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (onSelect) {
    return (
      <button
        type="button"
        className={cls}
        aria-pressed={selected}
        disabled={disabled}
        onClick={() => onSelect(character)}
        data-testid={`char-${character.id}`}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={cls} data-testid={`char-${character.id}`}>
      {body}
    </div>
  );
}

export default CharacterCard;
