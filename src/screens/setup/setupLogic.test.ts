import { describe, expect, it } from 'vitest';
import type { GameMap, GameSetup } from '../../game/types';
import { CHARACTERS, getCharacter } from '../../data/characters';
import {
  PLAYER_COUNTS,
  assignCharacter,
  availableCharacters,
  buildSetup,
  defaultName,
  homeNodeIds,
  isDraftComplete,
  isValidPlayerCount,
  resizeDrafts,
  shiftSeats,
  validateSetup,
} from './setupLogic';

const map: GameMap = {
  id: 'canal',
  name: 'ทดสอบ',
  description: '',
  image: 'x.webp',
  width: 100,
  height: 100,
  nodes: [
    { id: 'h1', kind: 'home', x: 0, y: 0, label: 'บ้าน 1' },
    { id: 'h2', kind: 'home', x: 0, y: 0, label: 'บ้าน 2' },
    { id: 'w1', kind: 'work', x: 0, y: 0, label: 'ร้านสะดวกซื้อ' },
  ],
  edges: [],
};

const setupOf = (n: number): GameSetup => ({
  mapId: 'canal',
  players: Array.from({ length: n }, (_, i) => ({
    name: defaultName(i),
    characterId: CHARACTERS[i].id,
    homeNodeId: 'h1',
  })),
});

describe('characters', () => {
  it('has 10 unique characters with unique colours', () => {
    expect(CHARACTERS).toHaveLength(10);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(10);
    expect(new Set(CHARACTERS.map((c) => c.color.toLowerCase())).size).toBe(10);
    expect(getCharacter('yai-on').name).toBe('ยายอร');
    expect(CHARACTERS[0].id).toBe('manao');
    expect(CHARACTERS[9].id).toBe('nam');
  });
});

describe('player counts', () => {
  it('allows 2–8 only', () => {
    expect(PLAYER_COUNTS).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(isValidPlayerCount(1)).toBe(false);
    expect(isValidPlayerCount(9)).toBe(false);
    expect(shiftSeats(4)).toBe(1);
    expect(shiftSeats(5)).toBe(2);
  });
  it('validateSetup rejects 1 and 9 players, accepts 2 and 8', () => {
    expect(validateSetup(setupOf(2), map)).toEqual([]);
    expect(validateSetup(setupOf(8), map)).toEqual([]);
    expect(validateSetup(setupOf(1), map).length).toBeGreaterThan(0);
    expect(validateSetup(setupOf(9), map).length).toBeGreaterThan(0);
  });
  it('resizeDrafts keeps existing players and uses default names', () => {
    const d = resizeDrafts(2);
    expect(d.map((x) => x.name)).toEqual(['ผู้เล่น 1', 'ผู้เล่น 2']);
    const d2 = resizeDrafts(3, [{ ...d[0], name: 'เอ' }, d[1]]);
    expect(d2[0].name).toBe('เอ');
    expect(d2[2].name).toBe('ผู้เล่น 3');
  });
});

describe('unique characters', () => {
  it('excludes characters taken by others, keeps own', () => {
    let d = resizeDrafts(3);
    d = assignCharacter(d, 0, 'manao');
    d = assignCharacter(d, 1, 'ton');
    const forP2 = availableCharacters(d, 2).map((c) => c.id);
    expect(forP2).not.toContain('manao');
    expect(forP2).not.toContain('ton');
    expect(forP2).toHaveLength(8);
    expect(availableCharacters(d, 0).map((c) => c.id)).toContain('manao');
  });
  it('refuses duplicates and frees a changed pick', () => {
    let d = resizeDrafts(2);
    d = assignCharacter(d, 0, 'manao');
    const same = assignCharacter(d, 1, 'manao');
    expect(same[1].characterId).toBeNull();
    d = assignCharacter(d, 0, 'fang');
    d = assignCharacter(d, 1, 'manao');
    expect(d[1].characterId).toBe('manao');
  });
  it('validateSetup flags duplicate characters', () => {
    const s = setupOf(2);
    s.players[1].characterId = s.players[0].characterId;
    expect(validateSetup(s, map).some((p) => p.includes('ซ้ำ'))).toBe(true);
  });
});

describe('homes', () => {
  it('lists only home nodes', () => {
    expect(homeNodeIds(map)).toEqual(['h1', 'h2']);
  });
  it('requires a home-kind node', () => {
    const s = setupOf(2);
    s.players[0].homeNodeId = 'w1';
    expect(validateSetup(s, map).some((p) => p.includes('บ้าน'))).toBe(true);
    s.players[0].homeNodeId = 'nope';
    expect(validateSetup(s, map).length).toBeGreaterThan(0);
  });
  it('isDraftComplete needs name, character and home', () => {
    let d = resizeDrafts(2);
    expect(isDraftComplete(d, 0, map)).toBe(false);
    d = assignCharacter(d, 0, 'kaew');
    expect(isDraftComplete(d, 0, map)).toBe(false);
    d = d.map((x, i) => (i === 0 ? { ...x, homeNodeId: 'w1' } : x));
    expect(isDraftComplete(d, 0, map)).toBe(false);
    d = d.map((x, i) => (i === 0 ? { ...x, homeNodeId: 'h2' } : x));
    expect(isDraftComplete(d, 0, map)).toBe(true);
    d = d.map((x, i) => (i === 0 ? { ...x, name: '   ' } : x));
    expect(isDraftComplete(d, 0, map)).toBe(false);
  });
  it('buildSetup trims names and allows shared homes', () => {
    const d = [
      { name: '  เอ ', characterId: 'manao' as const, homeNodeId: 'h1' },
      { name: 'บี', characterId: 'ton' as const, homeNodeId: 'h1' },
    ];
    const s = buildSetup('canal', d)!;
    expect(s.players[0].name).toBe('เอ');
    expect(validateSetup(s, map)).toEqual([]);
    expect(buildSetup('canal', [{ name: 'x', characterId: null, homeNodeId: 'h1' }])).toBeNull();
  });
});
