#!/usr/bin/env python3
"""สร้าง src/data/maps/<id>.ts จาก scripts/map_specs.py และ (ถ้าระบุ) วาดภาพตรวจทาน overlay

ใช้: python3 scripts/build_maps.py [--overlay-dir DIR]
- พิกัดของ node ที่อยู่ใกล้วงกลมที่ตรวจเจอ (detect_circles.py) จะ snap ไปกึ่งกลางวงกลมนั้น
- เตือนถ้ามีวงกลมในภาพที่ยังไม่ได้ใช้ หรือ node ที่ควรอยู่บนวงกลมแต่หาไม่เจอ
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from detect_circles import detect  # noqa: E402
from map_specs import MAPS  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAP = 18
KIND_COLOR = {
    'home': (230, 60, 60), 'work': (40, 120, 220), 'office': (120, 40, 200), 'school': (20, 150, 90),
    'park': (90, 170, 30), 'lot': (240, 140, 0), 'junction': (110, 110, 110),
}


def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def resolve(map_id, spec):
    img = os.path.join(ROOT, 'public', 'assets', 'maps', f'{map_id}.webp')
    w, h, circles = detect(img)
    used = set()
    nodes = []
    for n in spec['nodes']:
        nid, kind, label, x, y = n[:5]
        snap = n[5] if len(n) > 5 else True
        if snap:
            best = min(range(len(circles)), key=lambda i: (circles[i]['x'] - x) ** 2 + (circles[i]['y'] - y) ** 2)
            c = circles[best]
            d = ((c['x'] - x) ** 2 + (c['y'] - y) ** 2) ** 0.5
            if d > SNAP:
                print(f'WARN {map_id}: {nid} has no circle within {SNAP}px (nearest {d:.0f}px)')
            else:
                if best in used:
                    print(f'WARN {map_id}: circle {best} used twice')
                used.add(best)
                x, y = c['x'], c['y']
        nodes.append({'id': nid, 'kind': kind, 'label': label, 'x': x, 'y': y})
    for i, c in enumerate(circles):
        if i not in used:
            print(f'WARN {map_id}: circle {i} at ({c["x"]},{c["y"]}) not used by any node')
    return w, h, nodes


def ts_for(map_id, spec, w, h, nodes):
    var = f'{map_id.upper()}_MAP'
    lines = [
        "import type { GameMap } from '../../game/types';",
        '',
        f'// สร้างอัตโนมัติจาก scripts/map_specs.py ด้วย `python3 scripts/build_maps.py` — แก้ที่ spec แล้วรันใหม่',
        f'export const {var}: GameMap = {{',
        f"  id: '{map_id}',",
        f"  name: '{spec['name']}',",
        f"  description: '{spec['description']}',",
        f"  image: 'assets/maps/{map_id}.webp',",
        f'  width: {w},',
        f'  height: {h},',
        '  nodes: [',
    ]
    for n in nodes:
        lines.append(
            f"    {{ id: '{n['id']}', kind: '{n['kind']}', x: {n['x'] / w:.4f}, y: {n['y'] / h:.4f}, label: '{n['label']}' }},"
        )
    lines.append('  ],')
    lines.append('  edges: [')
    for e in spec['edges']:
        kind = e[2] if len(e) > 2 else 'road'
        lines.append(f"    {{ a: '{e[0]}', b: '{e[1]}', kind: '{kind}' }},")
    lines.append('  ],')
    lines.append('};')
    return '\n'.join(lines) + '\n'


def overlay(map_id, spec, nodes, out_dir):
    img = Image.open(os.path.join(ROOT, 'public', 'assets', 'maps', f'{map_id}.webp')).convert('RGB')
    d = ImageDraw.Draw(img)
    pos = {n['id']: (n['x'], n['y']) for n in nodes}
    for e in spec['edges']:
        kind = e[2] if len(e) > 2 else 'road'
        col = {'road': (255, 0, 120), 'bridge': (0, 160, 255), 'stairs': (255, 140, 0)}[kind]
        d.line([pos[e[0]], pos[e[1]]], fill=col, width=4)
    f = font(17)
    for n in nodes:
        x, y = n['x'], n['y']
        col = KIND_COLOR[n['kind']]
        d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=col, outline=(0, 0, 0))
        d.text((x + 11, y - 22), n['id'], fill=(0, 0, 0), font=f, stroke_width=3, stroke_fill=(255, 255, 255))
    img.save(os.path.join(out_dir, f'{map_id}_overlay.png'))


def main():
    out_dir = None
    if '--overlay-dir' in sys.argv:
        out_dir = sys.argv[sys.argv.index('--overlay-dir') + 1]
        os.makedirs(out_dir, exist_ok=True)
    for map_id, spec in MAPS.items():
        w, h, nodes = resolve(map_id, spec)
        with open(os.path.join(ROOT, 'src', 'data', 'maps', f'{map_id}.ts'), 'w', encoding='utf-8') as fh:
            fh.write(ts_for(map_id, spec, w, h, nodes))
        if out_dir:
            overlay(map_id, spec, nodes, out_dir)
        print(f'{map_id}: {len(nodes)} nodes, {len(spec["edges"])} edges')


if __name__ == '__main__':
    main()
