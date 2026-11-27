# สัญญางานร่วม (Main Agent)

ชนิดข้อมูลร่วมอยู่ใน `src/game/types.ts` — **ห้าม Subagent แก้เอง** ถ้าต้องเปลี่ยนให้เขียนข้อเสนอในรายงานส่งกลับ

## ขอบเขตไฟล์

| เจ้าของ | ไฟล์ |
|---|---|
| Main | `src/game/types.ts`, `src/App.tsx`, `src/main.tsx`, `src/styles/global.css`, `src/screens/Home.tsx`, `src/screens/HowToPlay.tsx`, `src/storage.ts`, config, README |
| rules-engine | `src/game/**` (ยกเว้น types.ts) เช่น `rules.ts`, `engine.ts`, `paths.ts`, `scoring.ts`, `reasons.ts`, `save.ts`, `*.test.ts` |
| map-and-assets | `src/data/maps/**`, `src/data/assets.ts`, `src/components/board/**`, `public/assets/**`, `docs/ASSETS.md`, `scripts/` |
| character-and-setup | `src/data/characters.ts`, `src/components/CharacterCard.tsx`, `src/screens/setup/**` |
| gameplay-ui | `src/screens/game/**`, `src/components/hud/**` |
| playtest-and-qa | `tests/e2e/**`, `docs/QA_REPORT.md` (อ่านอย่างเดียวที่อื่น) |

CSS: ให้แต่ละคนใช้ไฟล์ `.css` ข้างคอมโพเนนต์ของตัวเอง (import ในคอมโพเนนต์) ใช้ตัวแปรสีจาก `src/styles/global.css`
(`--bg`, `--paper`, `--ink`, `--ink-soft`, `--accent`, `--accent-2`, `--good`, `--bad`, `--line`, `--radius`) และฟอนต์ `var(--font-head)`, `var(--font-body)`

## API ของ rules-engine (`src/game/engine.ts`) — ฟังก์ชันบริสุทธิ์ คืน state ใหม่

```ts
createGame(setup: GameSetup, rng?: () => number): GameState   // สุ่ม firstSeat, phase 'handoff', planningPlayerId = ผู้ถือสิทธิ์ก่อน
beginPlanning(state): GameState                                // handoff -> planning
submitPlan(state, playerId, actions: PlannedAction[3]): GameState
   // ล็อกแผน; ถ้ายังมีคนไม่ส่ง -> 'handoff' ให้คนถัดไปตามลำดับสิทธิ์; ส่งครบ -> 'reveal', slotsResolved 0
resolveNextSlot(state): GameState
   // reveal & slotsResolved<3 -> ประมวลผลช่วงถัดไป; เมื่อครบ 3 ช่วง: หักบิล (สัปดาห์ 4,8 ครั้งเดียวด้วย billsChargedWeek) -> 'weekSummary'
payDebt(state, playerId, amount): GameState                    // เฉพาะ weekSummary
nextWeek(state): GameState
   // weekSummary -> ถ้า week===8: 'gameOver'; ไม่งั้น week+1, หมุนสิทธิ์, เวลา=8, ล้าง plans/slotResults,
   //   พักเที่ยงถ้าสัปดาห์คู่ (กันซ้ำด้วย lunchPaidWeek), -> 'handoff'
normalizeLoaded(state): GameState                             // planning -> handoff (ใช้ตอนโหลดเซฟ)
previewPlan(state, playerId, actions: PlannedAction[]): PlanPreview
activitiesAt(state, nodeId): ActivityType[]                   // กิจกรรมที่ทำได้ ณ ประเภทจุด (ไม่รวม 'none')
findPath(map: GameMap, from, to): string[] | null             // BFS รวมต้นทาง
priorityOrder(state): Player[]                                 // จากผู้ถือสิทธิ์ก่อน วนตาม seat
computeScores(state): ScoreRow[]
activityInfo(type): { label: string; time: number; energy: number; coins: number; icon: string } // ค่ากิจกรรม (coins + = ได้, - = จ่าย)
shiftCapacity(playerCount): number
```
ถ้าเรียกผิด phase ให้คืน state เดิม (no-op) — กดซ้ำ/รีโหลดต้องไม่คิดผลซ้ำ

`src/game/save.ts`: `SAVE_KEY`, `SAVE_VERSION`, `serialize(state): string`, `deserialize(text): GameState | null` (เวอร์ชันไม่ตรง → null)

## API แผนที่ (`src/data/maps/index.ts`)
```ts
MAPS: GameMap[]; getMap(id: MapId): GameMap
```

## คอมโพเนนต์กระดาน (`src/components/board/Board.tsx`)
```tsx
export interface PawnInfo { playerId: string; nodeId: string; color: string; initials: string; name: string }
<Board
  map={GameMap}
  pawns?={PawnInfo[]}            // ซ้อนเยื้องเมื่ออยู่จุดเดียวกัน
  shops?={{nodeId, ownerName, color}[]}
  highlightPath?={string[]}      // เส้นทางที่เลือก (ลากเส้นระหว่างจุด)
  ghostPaths?={{path:string[]; color:string}[]} // เส้นทางของช่วงอื่น (จางลง)
  selectableNodeIds?={string[]}  // จุดที่กดได้ (ถ้าไม่ระบุ = ทุกจุดเมื่อมี onNodeClick)
  selectedNodeId?={string}
  onNodeClick?={(nodeId) => void}
  showLabels?={boolean}
/>
```
จุดเป็น `<button>` มี `aria-label` = ชื่อสถานที่ + ประเภท

## ตัวละคร (`src/data/characters.ts`)
```ts
CHARACTERS: Character[]; getCharacter(id): Character
```
`src/components/CharacterCard.tsx`: `<CharacterCard character selected? disabled? onSelect? compact? />` — ถ้า card เป็น null หรือโหลดภาพไม่ได้ ให้แสดงการ์ดตัวแทน (สี + ชื่อย่อ) ชื่อ/คำอธิบายเป็นข้อความจริงเสมอ

## หน้าจอ
- `src/screens/setup/SetupFlow.tsx`: `<SetupFlow onStart={(setup: GameSetup) => void} onCancel={() => void} />`
  ขั้น: จำนวนผู้เล่น (2–8) → เลือกแผนที่ → ผู้เล่นแต่ละคน: ชื่อ + ตัวละคร (ไม่ซ้ำ) + บ้าน (กดจุด home บนกระดาน)
- `src/screens/game/GameScreen.tsx`: `<GameScreen state={GameState} onChange={(s: GameState) => void} onExit={() => void} />`
  แสดงตาม phase: handoff / planning / reveal / weekSummary / gameOver. App เซฟทุกครั้งที่ onChange
