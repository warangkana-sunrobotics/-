import type { GameMap, MapNode, NodeKind } from '../../game/types';
import './Board.css';

/** ตัวเดินบนกระดาน */
export interface PawnInfo {
  playerId: string;
  nodeId: string;
  color: string;
  initials: string;
  name: string;
}

export interface ShopMarker {
  nodeId: string;
  ownerName: string;
  color: string;
}

export interface GhostPath {
  path: string[];
  color: string;
}

export interface BoardProps {
  map: GameMap;
  pawns?: PawnInfo[];
  shops?: ShopMarker[];
  /** เส้นทางที่เลือก (ลากเส้นหนาระหว่างจุด + เลขก้าว) */
  highlightPath?: string[];
  /** สีเส้นทางที่เลือก (ค่าเริ่มต้น var(--accent)) */
  highlightColor?: string;
  /** เส้นทางของช่วงอื่น (เส้นประจางลง) */
  ghostPaths?: GhostPath[];
  /** จุดที่กดได้ (ถ้าไม่ระบุ = ทุกจุดเมื่อมี onNodeClick) */
  selectableNodeIds?: string[];
  selectedNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
  showLabels?: boolean;
}

const KIND_LABEL: Record<NodeKind, string> = {
  home: 'บ้าน',
  work: 'ที่ทำงาน',
  office: 'ออฟฟิศกลางเมือง',
  school: 'ที่เรียน',
  park: 'สวน',
  lot: 'ทำเล',
  junction: 'ทางแยก',
};

const KIND_ICON: Record<NodeKind, string> = {
  home: '🏠',
  work: '🛠️',
  office: '💼',
  school: '📚',
  park: '🌳',
  lot: '📍',
  junction: '🔀',
};

/** ชื่อประเภทจุดภาษาไทย */
export function kindLabel(kind: NodeKind): string {
  return KIND_LABEL[kind];
}

/** อีโมจิประจำประเภทจุด */
export function kindIcon(kind: NodeKind): string {
  return KIND_ICON[kind];
}

/** ขนาดปุ่มจุด (% ของความกว้างกระดาน) — ใช้คำนวณระยะเยื้องตัวเดิน */
const NODE_SIZE_PCT = 3.4;

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

function pathPoints(path: string[], byId: Map<string, MapNode>, w: number, h: number): string {
  return path
    .map((id) => byId.get(id))
    .filter((n): n is MapNode => !!n)
    .map((n) => `${(n.x * w).toFixed(1)},${(n.y * h).toFixed(1)}`)
    .join(' ');
}

export function Board({
  map,
  pawns = [],
  shops = [],
  highlightPath,
  highlightColor = 'var(--accent)',
  ghostPaths = [],
  selectableNodeIds,
  selectedNodeId,
  onNodeClick,
  showLabels = false,
}: BoardProps) {
  const { width: w, height: h } = map;
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const selectable = new Set(selectableNodeIds ?? (onNodeClick ? map.nodes.map((n) => n.id) : []));
  const unit = Math.min(w, h) / 100; // หน่วยความหนาเส้นใน SVG

  // ตัวเดินจัดกลุ่มตามจุด
  const pawnsByNode = new Map<string, PawnInfo[]>();
  for (const p of pawns) {
    if (!byId.has(p.nodeId)) continue;
    const list = pawnsByNode.get(p.nodeId) ?? [];
    list.push(p);
    pawnsByNode.set(p.nodeId, list);
  }

  // ตัวเดินทับปุ่มจุด: กดตัวเดินให้ผลเหมือนกดจุดนั้น
  const canClickNode = (id: string) => !!onNodeClick && selectable.has(id);

  const hl = highlightPath && highlightPath.length > 0 ? highlightPath : null;

  return (
    <div
      className="board"
      style={{ aspectRatio: `${w} / ${h}` }}
      data-map-id={map.id}
      role="group"
      aria-label={`กระดาน ${map.name}`}
    >
      <img className="board-img" src={map.image} alt={`แผนที่${map.name}`} draggable={false} />

      <svg className="board-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        <g className="board-edges">
          {map.edges.map((e) => {
            const a = byId.get(e.a);
            const b = byId.get(e.b);
            if (!a || !b) return null;
            return (
              <line
                key={`${e.a}|${e.b}`}
                className={`board-edge board-edge-${e.kind ?? 'road'}`}
                x1={a.x * w}
                y1={a.y * h}
                x2={b.x * w}
                y2={b.y * h}
                strokeWidth={unit * 0.5}
              />
            );
          })}
        </g>

        {ghostPaths.map((g, i) =>
          g.path.length > 1 ? (
            <polyline
              key={`ghost-${i}`}
              className="board-ghost"
              points={pathPoints(g.path, byId, w, h)}
              stroke={g.color}
              strokeWidth={unit * 0.9}
              strokeDasharray={`${unit * 1.6} ${unit * 1.2}`}
            />
          ) : null,
        )}

        {hl && hl.length > 1 && (
          <>
            <polyline
              className="board-highlight-casing"
              points={pathPoints(hl, byId, w, h)}
              strokeWidth={unit * 2.1}
            />
            <polyline
              className="board-highlight"
              points={pathPoints(hl, byId, w, h)}
              stroke={highlightColor}
              strokeWidth={unit * 1.3}
            />
          </>
        )}
        {hl &&
          hl.slice(1).map((id, i) => {
            const n = byId.get(id);
            if (!n) return null;
            return (
              <g key={`step-${i}`} className="board-step" transform={`translate(${n.x * w} ${n.y * h - unit * 3.6})`}>
                <circle r={unit * 1.7} fill={highlightColor} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={unit * 2}>
                  {i + 1}
                </text>
              </g>
            );
          })}
      </svg>

      {map.nodes.map((n) => {
        const canClick = canClickNode(n.id);
        const isSelected = n.id === selectedNodeId;
        const inPath = !!hl && hl.includes(n.id);
        const cls = [
          'board-node',
          `board-node-${n.kind}`,
          canClick ? 'is-selectable' : '',
          isSelected ? 'is-selected' : '',
          inPath ? 'is-in-path' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={n.id}
            type="button"
            className={cls}
            style={{ left: pct(n.x), top: pct(n.y) }}
            disabled={!canClick}
            aria-pressed={onNodeClick ? isSelected : undefined}
            aria-label={`${n.label} (${kindLabel(n.kind)})`}
            title={`${n.label} · ${kindLabel(n.kind)}`}
            data-node-id={n.id}
            data-kind={n.kind}
            onClick={canClick ? () => onNodeClick!(n.id) : undefined}
          >
            {n.kind !== 'junction' && (
              <span className="board-node-badge" aria-hidden="true">
                {kindIcon(n.kind)}
              </span>
            )}
            {showLabels && n.kind !== 'junction' && (
              <span className="board-node-label" aria-hidden="true">
                {n.label}
              </span>
            )}
          </button>
        );
      })}

      {shops.map((s) => {
        const n = byId.get(s.nodeId);
        if (!n) return null;
        return (
          <div
            key={`shop-${s.nodeId}`}
            className="board-shop"
            style={{ left: pct(n.x), top: pct(n.y), borderColor: s.color }}
            title={`ร้านข้าวกล่องของ ${s.ownerName}`}
            data-shop-node={s.nodeId}
          >
            <span aria-hidden="true">🍱</span>
            <span className="board-shop-name">{s.ownerName}</span>
          </div>
        );
      })}

      {[...pawnsByNode.entries()].flatMap(([nodeId, list]) => {
        const n = byId.get(nodeId)!;
        const count = list.length;
        // เยื้องเป็นวงเล็ก ๆ รอบจุดเมื่อมีหลายตัว (หน่วย: สัดส่วนความกว้าง)
        const ringR = count > 1 ? (NODE_SIZE_PCT / 100) * (count > 4 ? 0.85 : 0.65) : 0;
        return list.map((p, i) => {
          const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
          const dx = ringR * Math.cos(angle);
          const dy = ringR * Math.sin(angle) * (w / h);
          return (
            <div
              key={`pawn-${p.playerId}`}
              className="board-pawn"
              style={{ left: pct(n.x + dx), top: pct(n.y + dy), background: p.color }}
              title={p.name}
              aria-label={`${p.name} อยู่ที่ ${n.label}`}
              role="img"
              data-player-id={p.playerId}
              onClick={canClickNode(nodeId) ? () => onNodeClick!(nodeId) : undefined}
              data-clickable={canClickNode(nodeId) || undefined}
            >
              {p.initials}
            </div>
          );
        });
      })}
    </div>
  );
}

export default Board;
