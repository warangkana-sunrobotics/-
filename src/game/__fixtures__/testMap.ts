/**
 * แผนที่ทดสอบขนาดเล็ก (ไม่ใช่แผนที่จริงของเกม)
 *
 *   h1 ─┐            ┌─ l1
 *       j1 ── w1 ────┤
 *   h2 ─┘ │ \        └─ l2
 *         o1  s1 ── pk ── f1 ── f2 ── ... ── f8
 */
import type { GameMap, MapNode } from '../types';

const n = (id: string, kind: MapNode['kind'], x = 0.5, y = 0.5): MapNode => ({ id, kind, x, y, label: id });

const far = Array.from({ length: 8 }, (_, i) => n(`f${i + 1}`, 'junction'));

export const testMap: GameMap = {
  id: 'canal',
  name: 'แผนที่ทดสอบ',
  description: 'ใช้ในชุดทดสอบเท่านั้น',
  image: 'assets/maps/test.webp',
  width: 1000,
  height: 1000,
  nodes: [
    n('h1', 'home'),
    n('h2', 'home'),
    n('j1', 'junction'),
    n('w1', 'work'),
    n('o1', 'office'),
    n('s1', 'school'),
    n('pk', 'park'),
    n('l1', 'lot'),
    n('l2', 'lot'),
    ...far,
  ],
  edges: [
    { a: 'h1', b: 'j1' },
    { a: 'h2', b: 'j1' },
    { a: 'j1', b: 'w1' },
    { a: 'j1', b: 'o1' },
    { a: 'j1', b: 's1', kind: 'bridge' },
    { a: 's1', b: 'pk' },
    { a: 'w1', b: 'l1' },
    { a: 'w1', b: 'l2' },
    { a: 'pk', b: 'f1' },
    ...far.slice(1).map((f, i) => ({ a: far[i].id, b: f.id })),
  ],
};
