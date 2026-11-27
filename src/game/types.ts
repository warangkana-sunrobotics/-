/**
 * สัญญาข้อมูลร่วม (shared contract) ของเกม "สิ้นเดือนยังไหว"
 * เจ้าของ: Main Agent — Subagent ห้ามแก้ไฟล์นี้เอง ให้แจ้ง Main Agent ก่อน
 */

// ---------- แผนที่ ----------
export type MapId = 'canal' | 'market' | 'hill' | 'park';

/** ประเภทจุดบนกระดาน */
export type NodeKind =
  | 'home' // บ้าน — พักได้ / จุดเริ่ม
  | 'work' // จุดงาน — กะทั่วไป, กะใช้ทักษะ
  | 'office' // ออฟฟิศกลางเมือง (1 จุดต่อแผนที่) — กะออฟฟิศ
  | 'school' // ที่เรียน — เรียนทักษะ
  | 'park' // สวน — พักได้
  | 'lot' // ทำเล — เปิดร้าน / ซื้อข้าวกล่องเมื่อมีร้าน
  | 'junction'; // ทางแยก/จุดผ่าน — ไม่มีกิจกรรม

export interface MapNode {
  id: string;
  kind: NodeKind;
  /** พิกัดแบบสัดส่วน 0..1 ของความกว้างภาพ (กึ่งกลางวงกลมในภาพ) */
  x: number;
  /** พิกัดแบบสัดส่วน 0..1 ของความสูงภาพ */
  y: number;
  /** ชื่อสถานที่ภาษาไทย เช่น "ร้านสะดวกซื้อ", "ออฟฟิศกลางเมือง" */
  label: string;
}

export interface MapEdge {
  a: string;
  b: string;
  /** ใช้แสดงผลเท่านั้น ทุกเส้นใช้ 1 เวลาเสมอ */
  kind?: 'road' | 'bridge' | 'stairs';
}

export interface GameMap {
  id: MapId;
  name: string; // ชื่อไทย เช่น "เมืองริมคลอง"
  description: string;
  image: string; // path ใต้ public เช่น "assets/maps/canal.webp"
  width: number; // ขนาดภาพจริง (px)
  height: number;
  nodes: MapNode[];
  edges: MapEdge[];
}

// ---------- ตัวละคร ----------
export type CharacterId =
  | 'manao'
  | 'pa-nid'
  | 'ton'
  | 'fang'
  | 'lung-chai'
  | 'kaew'
  | 'mek'
  | 'yai-on'
  | 'pete'
  | 'nam';

export interface Character {
  id: CharacterId;
  name: string; // "มะนาว"
  title: string; // "สาวออฟฟิศ"
  description: string; // คำอธิบายบุคลิก
  /** path ใต้ public ของภาพการ์ด หรือ null ถ้ายังไม่มีภาพ (ใช้การ์ดตัวแทน) */
  card: string | null;
  color: string; // สีตัวเดิน (hex)
  initials: string; // ชื่อย่อ 1–2 ตัวอักษรบนตัวเดิน
}

// ---------- ผู้เล่น ----------
export interface Player {
  id: string; // "p1".."p8"
  seat: number; // 0..n-1 ลำดับที่นั่ง
  name: string; // ชื่อที่ผู้เล่นตั้ง
  characterId: CharacterId;
  homeNodeId: string;
  position: string; // node id ปัจจุบัน
  coins: number;
  energy: number; // 0..MAX_ENERGY
  time: number; // เวลาที่เหลือในสัปดาห์นี้
  hasSkill: boolean;
  skillShifts: number; // จำนวนกะใช้ทักษะที่สำเร็จ
  debt: number; // ยอดค้างบิล (เหรียญ)
}

// ---------- แผน ----------
export type ActivityType =
  | 'none' // เดินอย่างเดียว / ผ่าน
  | 'work' // กะทั่วไป
  | 'office' // กะออฟฟิศ
  | 'study' // เรียน
  | 'skillWork' // กะใช้ทักษะ
  | 'openShop' // เปิดร้านข้าวกล่อง
  | 'buyLunch' // ซื้อข้าวกล่อง
  | 'rest'; // พัก

/**
 * หนึ่งช่วงของแผน
 * path[0] = ตำแหน่งที่คาดว่าจะอยู่ตอนเริ่มช่วง; path.length-1 = จำนวนเส้นที่เดิน (= เวลาเดิน)
 * path ยาว 1 = อยู่ที่เดิม; activity 'none' + path ยาว 1 = ผ่าน
 */
export interface PlannedAction {
  path: string[];
  activity: ActivityType;
}

export interface WeekPlan {
  playerId: string;
  actions: [PlannedAction, PlannedAction, PlannedAction];
}

export interface Shop {
  nodeId: string;
  ownerId: string;
}

// ---------- ผลลัพธ์ ----------
export type FailReason =
  | 'INVALID_PATH' // ต้นทางไม่ตรงตำแหน่งจริง หรือไม่มีเส้นเชื่อม
  | 'NOT_ENOUGH_TIME_TO_MOVE'
  | 'WRONG_PLACE' // ทำกิจกรรมนี้ที่จุดนี้ไม่ได้
  | 'NOT_ENOUGH_TIME'
  | 'NOT_ENOUGH_COINS'
  | 'NOT_ENOUGH_ENERGY'
  | 'SHIFT_FULL' // กะที่จุดนี้เต็มแล้วในช่วงนี้
  | 'LOT_TAKEN' // ทำเลมีร้านแล้ว
  | 'NO_SKILL'
  | 'ALREADY_SKILLED'
  | 'NO_SHOP';

export interface ResourceDelta {
  coins: number;
  energy: number;
  time: number;
}

export interface ActionResult {
  playerId: string;
  slot: 0 | 1 | 2;
  planned: PlannedAction;
  /** เดินสำเร็จ (หรืออยู่ที่เดิม) */
  moved: boolean;
  moveCost: number;
  activity: ActivityType;
  /** กิจกรรมสำเร็จ (activity 'none' ถือว่าสำเร็จถ้าเดินได้) */
  success: boolean;
  reason?: FailReason;
  /** ข้อความเหตุผลภาษาไทยที่ผู้เล่นอ่านเข้าใจ */
  reasonText?: string;
  delta: ResourceDelta; // การเปลี่ยนแปลงทรัพยากรของผู้เล่นคนนี้ในช่วงนี้
  /** เงินที่โอนให้เจ้าของร้าน (ซื้อข้าวกล่อง) */
  paidTo?: string;
  endNodeId: string;
}

export interface BillResult {
  playerId: string;
  bill: number;
  paid: number;
  addedDebt: number;
}

export interface LunchPayout {
  ownerId: string;
  nodeId: string;
  amount: number;
}

// ---------- สถานะเกม ----------
/**
 * handoff     — หน้าส่งเครื่องให้ state.planningPlayerId
 * planning    — ผู้เล่น planningPlayerId กำลังวางแผน (ไม่ถูกเซฟเป็นสถานะนี้; โหลดแล้วกลับเป็น handoff)
 * reveal      — เปิดผลทีละช่วง (slotsResolved 0..3)
 * weekSummary — สรุปสัปดาห์ (บิลถูกหักแล้วถ้าเป็นสัปดาห์ 4/8) จ่ายยอดค้างเพิ่มได้
 * gameOver    — ประกาศผู้ชนะ
 */
export type Phase = 'handoff' | 'planning' | 'reveal' | 'weekSummary' | 'gameOver';

export interface GameState {
  saveVersion: number;
  mapId: MapId;
  players: Player[]; // เรียงตาม seat
  week: number; // 1..TOTAL_WEEKS
  firstSeat: number; // seat ของผู้ถือสิทธิ์ก่อน
  phase: Phase;
  /** ผู้เล่นที่ต้องวางแผนคนถัดไป (ใช้ใน handoff/planning) */
  planningPlayerId: string | null;
  /** แผนที่ล็อกแล้ว — ห้าม UI แสดงแผนคนอื่นก่อน phase 'reveal' */
  plans: Record<string, WeekPlan>;
  slotsResolved: number; // 0..3
  slotResults: ActionResult[][]; // index = slot
  shops: Shop[];
  /** สัปดาห์ล่าสุดที่จ่ายเหตุการณ์พักเที่ยงแล้ว (กันจ่ายซ้ำ) */
  lunchPaidWeek: number;
  lunchPayouts: LunchPayout[]; // ของสัปดาห์ปัจจุบัน
  /** สัปดาห์ล่าสุดที่หักบิลแล้ว (กันหักซ้ำ) */
  billsChargedWeek: number;
  billResults: BillResult[]; // ของสัปดาห์ปัจจุบัน
}

export interface GameSetup {
  mapId: MapId;
  players: { name: string; characterId: CharacterId; homeNodeId: string }[];
}

// ---------- ส่วนแสดงผลที่ engine คำนวณให้ ----------
export interface SlotPreview {
  startNodeId: string;
  endNodeId: string;
  moveCost: number;
  activityCost: number; // เวลา
  timeLeftAfter: number;
  coinsAfter: number; // คาดการณ์ (ไม่รวมการแย่งกะ)
  energyAfter: number;
  valid: boolean;
  problems: string[]; // ข้อความไทย
}

export interface PlanPreview {
  slots: SlotPreview[];
  totalTime: number;
  valid: boolean;
}

export interface ScoreRow {
  playerId: string;
  milestoneLearn: boolean;
  milestoneFirstSkillShift: boolean;
  milestoneThreeSkillShifts: boolean;
  milestonePoints: number;
  coins: number;
  coinSetPoints: number; // floor(coins/5)
  debt: number;
  energy: number;
  total: number;
  rank: number; // 1 = ชนะ (ผู้ชนะร่วมได้)
  isWinner: boolean;
}
