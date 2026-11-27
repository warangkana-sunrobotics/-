/** เส้นทางบนแผนที่: BFS, หาเส้นเชื่อม, ตรวจเส้นทาง */
import type { FailReason, GameMap, MapEdge, MapNode } from './types';

export function getNode(map: GameMap, id: string): MapNode | undefined {
  return map.nodes.find((n) => n.id === id);
}

/** หาเส้นเชื่อมระหว่าง a กับ b (สองทิศ) */
export function findEdge(map: GameMap, a: string, b: string): MapEdge | undefined {
  return map.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
}

export function areAdjacent(map: GameMap, a: string, b: string): boolean {
  return a !== b && findEdge(map, a, b) !== undefined;
}

export function neighbors(map: GameMap, id: string): string[] {
  const out: string[] = [];
  for (const e of map.edges) {
    if (e.a === id && e.b !== id) out.push(e.b);
    else if (e.b === id && e.a !== id) out.push(e.a);
  }
  return out;
}

/** BFS เส้นทางสั้นสุด (รวมต้นทาง) หรือ null ถ้าไปไม่ได้/ไม่มีจุด */
export function findPath(map: GameMap, from: string, to: string): string[] | null {
  if (!getNode(map, from) || !getNode(map, to)) return null;
  if (from === to) return [from];
  const prev = new Map<string, string>();
  const seen = new Set<string>([from]);
  const queue: string[] = [from];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const nb of neighbors(map, cur)) {
      if (seen.has(nb)) continue;
      seen.add(nb);
      prev.set(nb, cur);
      if (nb === to) {
        const path = [to];
        let p = to;
        while (p !== from) {
          p = prev.get(p) as string;
          path.unshift(p);
        }
        return path;
      }
      queue.push(nb);
    }
  }
  return null;
}

/** จำนวนเวลาเดินของเส้นทาง (= จำนวนเส้น) */
export function pathCost(path: string[]): number {
  return Math.max(0, path.length - 1);
}

export type PathCheck = { ok: true; cost: number } | { ok: false; reason: FailReason; cost: number };

/**
 * ตรวจเส้นทาง: path[0] ต้องตรงตำแหน่งจริง, จุดถัดกันต้องมีเส้นเชื่อม, เวลาต้องพอเดิน
 */
export function validatePath(map: GameMap, path: string[], position: string, timeLeft: number): PathCheck {
  if (!Array.isArray(path) || path.length === 0 || path[0] !== position) {
    return { ok: false, reason: 'INVALID_PATH', cost: 0 };
  }
  if (!getNode(map, path[0])) return { ok: false, reason: 'INVALID_PATH', cost: 0 };
  for (let i = 1; i < path.length; i++) {
    if (!getNode(map, path[i]) || !areAdjacent(map, path[i - 1], path[i])) {
      return { ok: false, reason: 'INVALID_PATH', cost: 0 };
    }
  }
  const cost = pathCost(path);
  if (timeLeft < cost) return { ok: false, reason: 'NOT_ENOUGH_TIME_TO_MOVE', cost };
  return { ok: true, cost };
}
