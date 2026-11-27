import { describe, expect, it } from 'vitest';
import { CARD_IMAGES, MAP_IMAGES, allAvailableImages, cardImage } from './assets';
import { MAPS } from './maps';

describe('assets manifest', () => {
  it('path ของภาพเป็นแบบ relative (ไม่มี / นำหน้า) และอยู่ใต้ assets/', () => {
    for (const path of allAvailableImages()) {
      expect(path.startsWith('/')).toBe(false);
      expect(path.startsWith('assets/')).toBe(true);
    }
  });

  it('ภาพแผนที่ตรงกับข้อมูลแผนที่', () => {
    for (const m of MAPS) expect(MAP_IMAGES[m.id].path).toBe(m.image);
  });

  it('การ์ดครบ 10 ตัวละคร และ cardImage คืน null เมื่อยังไม่มีภาพ', () => {
    expect(Object.keys(CARD_IMAGES)).toHaveLength(10);
    expect(cardImage('yai-on')).toBe('assets/cards/yai-on.webp');
    for (const [id, a] of Object.entries(CARD_IMAGES)) {
      if (!a.available) expect(cardImage(id as keyof typeof CARD_IMAGES)).toBeNull();
    }
  });
});
