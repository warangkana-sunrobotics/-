import { describe, expect, it } from 'vitest';
import { areAdjacent, findEdge, findPath, neighbors, pathCost, validatePath } from './paths';
import { testMap } from './__fixtures__/testMap';

describe('findPath (BFS)', () => {
  it('คืนเส้นทางสั้นสุดรวมต้นทาง', () => {
    expect(findPath(testMap, 'h1', 'l1')).toEqual(['h1', 'j1', 'w1', 'l1']);
    expect(findPath(testMap, 'l2', 'pk')).toEqual(['l2', 'w1', 'j1', 's1', 'pk']);
  });
  it('ต้นทาง = ปลายทาง คืน [from]', () => {
    expect(findPath(testMap, 'w1', 'w1')).toEqual(['w1']);
  });
  it('จุดไม่มีอยู่หรือไปไม่ถึง คืน null', () => {
    expect(findPath(testMap, 'h1', 'nope')).toBeNull();
    const island = { ...testMap, nodes: [...testMap.nodes, { id: 'x', kind: 'junction' as const, x: 0, y: 0, label: 'x' }] };
    expect(findPath(island, 'h1', 'x')).toBeNull();
  });
});

describe('edges', () => {
  it('หาเส้นเชื่อมได้สองทิศ', () => {
    expect(findEdge(testMap, 'j1', 's1')?.kind).toBe('bridge');
    expect(findEdge(testMap, 's1', 'j1')?.kind).toBe('bridge');
    expect(findEdge(testMap, 'h1', 'w1')).toBeUndefined();
    expect(areAdjacent(testMap, 'w1', 'l1')).toBe(true);
    expect(areAdjacent(testMap, 'w1', 'w1')).toBe(false);
    expect(neighbors(testMap, 'j1').sort()).toEqual(['h1', 'h2', 'o1', 's1', 'w1']);
  });
});

describe('validatePath', () => {
  it('เส้นทางถูกต้อง: cost = จำนวนเส้น', () => {
    expect(validatePath(testMap, ['h1', 'j1', 'w1'], 'h1', 8)).toEqual({ ok: true, cost: 2 });
    expect(validatePath(testMap, ['h1'], 'h1', 0)).toEqual({ ok: true, cost: 0 });
    expect(pathCost(['a', 'b', 'c'])).toBe(2);
  });
  it('ต้นทางไม่ตรงตำแหน่งจริง / ว่าง / ไม่มีเส้นเชื่อม → INVALID_PATH', () => {
    expect(validatePath(testMap, ['h2', 'j1'], 'h1', 8)).toMatchObject({ ok: false, reason: 'INVALID_PATH' });
    expect(validatePath(testMap, [], 'h1', 8)).toMatchObject({ ok: false, reason: 'INVALID_PATH' });
    expect(validatePath(testMap, ['h1', 'w1'], 'h1', 8)).toMatchObject({ ok: false, reason: 'INVALID_PATH' });
    expect(validatePath(testMap, ['h1', 'h1'], 'h1', 8)).toMatchObject({ ok: false, reason: 'INVALID_PATH' });
  });
  it('เวลาไม่พอเดิน → NOT_ENOUGH_TIME_TO_MOVE', () => {
    expect(validatePath(testMap, ['h1', 'j1', 'w1'], 'h1', 1)).toMatchObject({ ok: false, reason: 'NOT_ENOUGH_TIME_TO_MOVE' });
  });
});
