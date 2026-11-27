#!/usr/bin/env python3
"""ตรวจหาวงกลมสีครีม (ช่องเดินบนกระดาน) ในภาพแผนที่ แล้วพิมพ์พิกัดศูนย์กลาง

ใช้: python3 scripts/detect_circles.py public/assets/maps/canal.webp [--json]
วิธี: ทำ mask สีครีม -> connected components (BFS ด้วย numpy/python ล้วน) -> กรองตามขนาด/ความกลม
"""
import json
import sys
from collections import deque

import numpy as np
from PIL import Image


def cream_mask(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r >= 238) & (g >= 228) & (b >= 180) & (b <= 232) & (r - b >= 22) & (g - b >= 14) & (np.abs(r - g) <= 18)


def components(mask):
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    comps = []
    ys, xs = np.nonzero(mask)
    cur = 0
    for y0, x0 in zip(ys, xs):
        if labels[y0, x0]:
            continue
        cur += 1
        labels[y0, x0] = cur
        q = deque([(y0, x0)])
        pts = []
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = cur
                    q.append((ny, nx))
        comps.append(np.array(pts))
    return comps


def detect(path):
    a = np.array(Image.open(path).convert('RGB')).astype(int)
    m = cream_mask(a)
    found = []
    for pts in components(m):
        n = len(pts)
        if n < 700 or n > 3200:
            continue
        y0, x0 = pts.min(0)
        y1, x1 = pts.max(0)
        bw, bh = x1 - x0 + 1, y1 - y0 + 1
        if not (30 <= bw <= 62 and 26 <= bh <= 58):
            continue
        if not (0.65 <= bw / bh <= 1.5):
            continue
        fill = n / (bw * bh)
        if fill < 0.6:
            continue
        cy, cx = pts.mean(0)
        found.append({'x': round(float(cx), 1), 'y': round(float(cy), 1), 'w': int(bw), 'h': int(bh), 'n': int(n), 'fill': round(fill, 2)})
    found.sort(key=lambda p: (p['y'], p['x']))
    return a.shape[1], a.shape[0], found


if __name__ == '__main__':
    w, h, pts = detect(sys.argv[1])
    if '--json' in sys.argv:
        print(json.dumps({'width': w, 'height': h, 'points': pts}))
    else:
        print(f'{sys.argv[1]} {w}x{h} -> {len(pts)} circles')
        for i, p in enumerate(pts):
            print(i, p)
