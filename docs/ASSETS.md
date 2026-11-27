# ภาพประกอบ (Assets)

ภาพต้นฉบับที่ได้รับเก็บไว้ที่ `assets/incoming/` (อย่าลบ) ส่วนภาพที่เกมใช้จริงอยู่ใต้ `public/assets/`
รายการภาพทั้งหมดอยู่ใน `src/data/assets.ts` (path แบบ relative ไม่มี `/` นำหน้า เพื่อให้ทำงานกับ `base: './'`)

## ไฟล์ที่ได้รับ → ปลายทาง

| ไฟล์ต้นฉบับ | เนื้อหา | ใช้เป็น |
|---|---|---|
| `assets/incoming/1.webp` | แผนที่ ตลาดนัดพลบค่ำ (1536×1024) | `public/assets/maps/market.webp` |
| `assets/incoming/2.webp` | แผนที่ เมืองริมคลอง (1536×1024) | `public/assets/maps/canal.webp` |
| `assets/incoming/3.webp` | แผนที่ สี่ย่านรอบสวน (1536×1024) | `public/assets/maps/park.webp` |
| `assets/incoming/4.webp` | แผนที่ เมืองเนินเขา (1536×1024) | `public/assets/maps/hill.webp` |
| `assets/incoming/5.webp` | การ์ดตัวละคร ยายอร | `public/assets/cards/yai-on.webp` |
| `assets/incoming/6.webp` | การ์ดตัวละคร พีท | `public/assets/cards/pete.webp` |
| `assets/incoming/7.webp` | การ์ดตัวละคร แก้ว | `public/assets/cards/kaew.webp` |
| `assets/incoming/8.webp` | การ์ดตัวละคร น้ำ | `public/assets/cards/nam.webp` |
| `assets/incoming/9.webp` | การ์ดตัวละคร ฟาง | `public/assets/cards/fang.webp` |
| `assets/incoming/10.webp` | การ์ดตัวละคร ลุงชัย | `public/assets/cards/lung-chai.webp` |
| `assets/incoming/11.webp` | การ์ดตัวละคร มะนาว | `public/assets/cards/manao.webp` |
| `assets/incoming/12.webp` | การ์ดตัวละคร ป้านิด | `public/assets/cards/pa-nid.webp` |
| `assets/incoming/13.webp` | การ์ดตัวละคร ต้น | `public/assets/cards/ton.webp` |
| `assets/incoming/14.webp` | การ์ดตัวละคร เมฆ | `public/assets/cards/mek.webp` |

การ์ดอีก 9 ตัว (`manao`, `pa-nid`, `ton`, `fang`, `lung-chai`, `kaew`, `mek`, `pete`, `nam`) ผู้ใช้ส่งมาในแชตแล้วแต่ยังไม่มีไฟล์ในโปรเจกต์ —
ระหว่างนี้ `available: false` และ UI แสดงการ์ดตัวแทน (สี + ชื่อย่อ)

## เพิ่ม/เปลี่ยนการ์ดตัวละคร

1. เก็บไฟล์ต้นฉบับไว้ที่ `assets/incoming/` (ตั้งชื่ออะไรก็ได้ แล้วจดในตารางด้านบน)
2. คัดลอกเป็น `public/assets/cards/<characterId>.webp` (เช่น `manao.webp`) — แนะนำ webp, อัตราส่วนเดียวกับ `yai-on.webp`
3. เพิ่ม id ใน `AVAILABLE_CARDS` ใน `src/data/assets.ts`
4. ถ้า `src/data/characters.ts` ใช้ `cardImage(id)` จาก `assets.ts` การ์ดจะขึ้นเองทันที; ถ้าเขียน path ตรง ๆ ให้แก้ `card` ของตัวละครนั้นด้วย
5. รัน `npx vitest run src/data`

## เปลี่ยนภาพแผนที่

ช่องเดินบนกระดานผูกกับตำแหน่งวงกลมสีครีมในภาพ ถ้าเปลี่ยนภาพต้องสร้างข้อมูลแผนที่ใหม่:

1. คัดลอกภาพไปที่ `public/assets/maps/<mapId>.webp` (ถ้าขนาดไม่ใช่ 1536×1024 ให้แก้ `MAP_IMAGES` ใน `assets.ts` ด้วย)
2. `python3 scripts/detect_circles.py public/assets/maps/<mapId>.webp` — พิมพ์พิกัดวงกลมที่ตรวจเจอ (สีครีม + connected components)
3. `python3 scripts/road_adjacency.py public/assets/maps/<mapId>.webp` — ช่วยบอกว่าวงกลมไหนต่อกันด้วยถนนสีม่วง (สะพาน/บันไดต้องเพิ่มเอง)
4. แก้ `scripts/map_specs.py` (node: id, ประเภท, ชื่อไทย, พิกัด px; edge: คู่ id + `bridge`/`stairs`)
5. `python3 scripts/build_maps.py --overlay-dir /tmp/overlay` — เขียน `src/data/maps/<mapId>.ts` ใหม่ และวาดภาพตรวจทาน `<mapId>_overlay.png`
   เปิดดูว่าจุดตรงวงกลม เส้นตามถนนจริง สคริปต์จะเตือนถ้ามีวงกลมที่ไม่ได้ใช้
6. `npx vitest run src/data` — ตรวจกราฟเชื่อมกัน มีออฟฟิศ 1 จุด และจุดประเภทที่กติกาต้องใช้ครบ

ไฟล์ `src/data/maps/<mapId>.ts` สร้างอัตโนมัติ อย่าแก้มือ — แก้ที่ `scripts/map_specs.py` แล้วรันใหม่
