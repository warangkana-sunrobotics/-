import type { Player } from '../../game/types';
import './hud.css';

const MAX_ENERGY = 6;
const SKILL_SHIFT_GOAL = 3;

interface Props {
  player: Player;
  /** แสดงแบบย่อ (ใช้ในรายชื่อผู้เล่น) */
  compact?: boolean;
  /** ซ่อนเวลา (เช่น หน้าสรุปที่เวลาไม่สำคัญ) */
  hideTime?: boolean;
}

interface ItemProps {
  icon: string;
  value: string | number;
  label: string;
  aria: string;
  tone?: 'bad' | 'good';
}

function Item({ icon, value, label, aria, tone }: ItemProps) {
  return (
    <li className={`res-item${tone ? ` res-${tone}` : ''}`} aria-label={aria} title={aria}>
      <span className="res-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="res-value" aria-hidden="true">
        {value}
      </span>
      <span className="res-label" aria-hidden="true">
        {label}
      </span>
    </li>
  );
}

/** แถบทรัพยากรของผู้เล่น: ไอคอน + ตัวเลข + คำไทย */
export function ResourceBar({ player, compact, hideTime }: Props) {
  return (
    <ul className={`resource-bar${compact ? ' compact' : ''}`} aria-label={`ทรัพยากรของ ${player.name}`}>
      <Item icon="🪙" value={player.coins} label="เหรียญ" aria={`เหรียญ ${player.coins}`} />
      {!hideTime && <Item icon="⏰" value={player.time} label="เวลา" aria={`เวลาเหลือ ${player.time}`} />}
      <Item
        icon="⚡"
        value={`${player.energy}/${MAX_ENERGY}`}
        label="พลัง"
        aria={`พลัง ${player.energy} จาก ${MAX_ENERGY}`}
        tone={player.energy <= 1 ? 'bad' : undefined}
      />
      <Item
        icon="📖"
        value={player.hasSkill ? 'มี' : 'ไม่มี'}
        label="ทักษะ"
        aria={player.hasSkill ? 'มีทักษะแล้ว' : 'ยังไม่มีทักษะ'}
        tone={player.hasSkill ? 'good' : undefined}
      />
      <Item
        icon="🛠️"
        value={`${player.skillShifts}/${SKILL_SHIFT_GOAL}`}
        label="กะใช้ทักษะ"
        aria={`กะใช้ทักษะ ${player.skillShifts} จาก ${SKILL_SHIFT_GOAL}`}
      />
      {(player.debt > 0 || !compact) && (
        <Item
          icon="🧾"
          value={player.debt}
          label="ยอดค้าง"
          aria={`ยอดค้าง ${player.debt} เหรียญ`}
          tone={player.debt > 0 ? 'bad' : undefined}
        />
      )}
    </ul>
  );
}

export default ResourceBar;
