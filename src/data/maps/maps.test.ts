import { describe, expect, it } from 'vitest';
import type { GameMap, NodeKind } from '../../game/types';
import { MAPS, getMap } from './index';

function neighbours(map: GameMap): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const n of map.nodes) adj.set(n.id, new Set());
  for (const e of map.edges) {
    adj.get(e.a)?.add(e.b);
    adj.get(e.b)?.add(e.a);
  }
  return adj;
}

function reachable(map: GameMap, from: string): Set<string> {
  const adj = neighbours(map);
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of adj.get(cur) ?? []) {
      if (!seen.has(nb)) {
        seen.add(nb);
        queue.push(nb);
      }
    }
  }
  return seen;
}

const count = (map: GameMap, kind: NodeKind) => map.nodes.filter((n) => n.kind === kind).length;

describe('MAPS', () => {
  it('มี 4 แผนที่เรียง canal, market, hill, park', () => {
    expect(MAPS.map((m) => m.id)).toEqual(['canal', 'market', 'hill', 'park']);
    expect(getMap('hill').id).toBe('hill');
  });

  for (const map of MAPS) {
    describe(map.name, () => {
      it('ข้อมูลภาพและพิกัดถูกต้อง', () => {
        expect(map.image).toBe(`assets/maps/${map.id}.webp`);
        expect(map.image.startsWith('/')).toBe(false);
        expect(map.width).toBeGreaterThan(0);
        expect(map.height).toBeGreaterThan(0);
        for (const n of map.nodes) {
          expect(n.x).toBeGreaterThanOrEqual(0);
          expect(n.x).toBeLessThanOrEqual(1);
          expect(n.y).toBeGreaterThanOrEqual(0);
          expect(n.y).toBeLessThanOrEqual(1);
          expect(n.label.length).toBeGreaterThan(0);
        }
      });

      it('id ของ node ไม่ซ้ำ', () => {
        const ids = map.nodes.map((n) => n.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('เส้นเชื่อมอ้าง node ที่มีอยู่ ไม่ซ้ำ ไม่วนเข้าตัวเอง', () => {
        const ids = new Set(map.nodes.map((n) => n.id));
        const keys = new Set<string>();
        for (const e of map.edges) {
          expect(ids.has(e.a), `${e.a} ไม่มีอยู่`).toBe(true);
          expect(ids.has(e.b), `${e.b} ไม่มีอยู่`).toBe(true);
          expect(e.a).not.toBe(e.b);
          const key = [e.a, e.b].sort().join('|');
          expect(keys.has(key), `เส้นซ้ำ ${key}`).toBe(false);
          keys.add(key);
        }
      });

      it('กราฟเชื่อมถึงกันทั้งหมด', () => {
        expect(reachable(map, map.nodes[0].id).size).toBe(map.nodes.length);
      });

      it('มีจุดครบตามที่กติกาต้องการ', () => {
        expect(count(map, 'office')).toBe(1);
        expect(count(map, 'home')).toBeGreaterThanOrEqual(3);
        expect(count(map, 'work')).toBeGreaterThanOrEqual(2);
        expect(count(map, 'school')).toBeGreaterThanOrEqual(1);
        expect(count(map, 'park')).toBeGreaterThanOrEqual(1);
        expect(count(map, 'lot')).toBeGreaterThanOrEqual(3);
      });

      it('ทุกบ้านไปถึงจุดทุกประเภทได้', () => {
        const kinds: NodeKind[] = ['work', 'office', 'school', 'park', 'lot'];
        for (const home of map.nodes.filter((n) => n.kind === 'home')) {
          const r = reachable(map, home.id);
          for (const k of kinds) {
            expect(
              map.nodes.some((n) => n.kind === k && r.has(n.id)),
              `${home.id} ไปถึง ${k} ไม่ได้`,
            ).toBe(true);
          }
        }
      });
    });
  }
});
