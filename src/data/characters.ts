import type { Character, CharacterId } from '../game/types';

/**
 * ตัวละคร 10 ตัว (เรียงตามลำดับนี้เสมอ)
 * card: path ใต้ public — ถ้าไฟล์ยังไม่มี CharacterCard จะแสดงการ์ดตัวแทนเมื่อโหลดภาพไม่ได้
 * color: สีตัวเดิน เลือกให้ตัดกับตัวอักษรสีขาวชัดเจน (contrast ≥ 4.5:1)
 */
import { cardImage } from './assets';
const card = (id: CharacterId) => cardImage(id);

export const CHARACTERS: Character[] = [
  {
    id: 'manao',
    name: 'มะนาว',
    title: 'สาวออฟฟิศ',
    description: 'เห็นแจ้งเตือนเงินเดือนแล้วหายเหนื่อย มีแมวส้มคู่ใจ',
    card: card('manao'),
    color: '#2f7d32',
    initials: 'มน',
  },
  {
    id: 'pa-nid',
    name: 'ป้านิด',
    title: 'แม่ค้าข้าวกล่อง',
    description: 'จำเมนูโปรดของลูกค้าประจำได้ทุกคน',
    card: card('pa-nid'),
    color: '#b8432f',
    initials: 'นิด',
  },
  {
    id: 'ton',
    name: 'ต้น',
    title: 'ไรเดอร์ส่งพัสดุ',
    description: 'รู้ทุกทางลัด แต่ชอบใส่หมวกเอียง',
    card: card('ton'),
    color: '#1f5fa8',
    initials: 'ต้น',
  },
  {
    id: 'fang',
    name: 'ฟาง',
    title: 'นักเรียนศิลปะ',
    description: 'ชอบวาดมุมเมืองลงในสมุดคู่ใจ',
    card: card('fang'),
    color: '#a8327a',
    initials: 'ฟาง',
  },
  {
    id: 'lung-chai',
    name: 'ลุงชัย',
    title: 'ช่างซ่อมจักรยาน',
    description: 'ฟังเสียงล้อก็รู้ว่าต้องซ่อมตรงไหน',
    card: card('lung-chai'),
    color: '#5b4636',
    initials: 'ชัย',
  },
  {
    id: 'kaew',
    name: 'แก้ว',
    title: 'บาริสต้า',
    description: 'ถือกาแฟมือเดียวได้แม้ตอนร้านยุ่ง',
    card: card('kaew'),
    color: '#8a5a12',
    initials: 'แก้ว',
  },
  {
    id: 'mek',
    name: 'เมฆ',
    title: 'พนักงานคลังสินค้า',
    description: 'หอบกล่องพะรุงพะรังแต่ยังยิ้มได้',
    card: card('mek'),
    color: '#46557a',
    initials: 'เมฆ',
  },
  {
    id: 'yai-on',
    name: 'ยายอร',
    title: 'คนรักต้นไม้',
    description: 'ชอบแบ่งกิ่งไม้ให้เพื่อนบ้านเอาไปปลูก',
    card: card('yai-on'),
    color: '#0f766e',
    initials: 'อร',
  },
  {
    id: 'pete',
    name: 'พีท',
    title: 'พ่อค้าก๋วยเตี๋ยว',
    description: 'ชอบคีบเส้นโชว์ก่อนยกชามเสิร์ฟ',
    card: card('pete'),
    color: '#c2410c',
    initials: 'พีท',
  },
  {
    id: 'nam',
    name: 'น้ำ',
    title: 'บรรณารักษ์ชุมชน',
    description: 'หาหนังสือเก่งและชอบทำท่าจุ๊ ๆ',
    card: card('nam'),
    color: '#6d3fb0',
    initials: 'น้ำ',
  },
];

const BY_ID = new Map(CHARACTERS.map((c) => [c.id, c] as const));

/** คืนตัวละครตาม id (ถ้า id ไม่ถูกต้องจะโยน error) */
export function getCharacter(id: CharacterId | string): Character {
  const c = BY_ID.get(id as CharacterId);
  if (!c) throw new Error(`Unknown character id: ${id}`);
  return c;
}
