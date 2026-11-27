import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SAVE_VERSION, deserialize, serialize } from './save';
import { beginPlanning } from './core';
import { makeGame } from './__fixtures__/helpers';

describe('save', () => {
  it('ค่าคงที่', () => {
    expect(SAVE_KEY).toBe('sinduean.save');
    expect(SAVE_VERSION).toBe(1);
  });
  it('roundtrip', () => {
    const s = makeGame(3);
    expect(deserialize(serialize(s))).toEqual(s);
  });
  it('JSON เสีย / เวอร์ชันไม่ตรง / โครงสร้างผิด → null', () => {
    expect(deserialize('{oops')).toBeNull();
    expect(deserialize('')).toBeNull();
    expect(deserialize(null)).toBeNull();
    expect(deserialize('null')).toBeNull();
    expect(deserialize('42')).toBeNull();
    expect(deserialize(JSON.stringify({ ...makeGame(2), saveVersion: 2 }))).toBeNull();
    expect(deserialize(JSON.stringify({ ...makeGame(2), players: 'x' }))).toBeNull();
    expect(deserialize(JSON.stringify({ ...makeGame(2), phase: 'weird' }))).toBeNull();
  });
  it('โหลด planning → handoff', () => {
    const s = beginPlanning(makeGame(2));
    expect(deserialize(serialize(s))?.phase).toBe('handoff');
  });
});
