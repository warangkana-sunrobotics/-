#!/usr/bin/env python3
"""ช่วยหาเส้นเชื่อมระหว่างวงกลมโดยดูจากถนนสีม่วงอ่อนในภาพ (ใช้เป็นจุดตั้งต้น แล้วตรวจด้วยตาอีกครั้ง)

ใช้: python3 scripts/road_adjacency.py public/assets/maps/canal.webp
แต่ละ "ชิ้นถนน" (connected component ของ mask ถนน เมื่อเจาะวงกลมออก) ที่แตะวงกลมหลายวง
แปลว่าวงกลมเหล่านั้นเชื่อมกัน (ถ้าแตะ 3 วงขึ้นไป = มีทางแยก) สะพาน/บันได ไม่ใช่สีม่วงจึงต้องเพิ่มเอง
"""
import sys
from itertools import combinations

import numpy as np
from PIL import Image

from detect_circles import components, detect


def road_mask(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (b - g >= 8) & (r - g >= 6) & (g >= 175) & (np.abs(r - b) <= 28)


def adjacency(path, disc_r=34, min_touch=15):
    w, h, pts = detect(path)
    a = np.array(Image.open(path).convert('RGB')).astype(int)
    road = road_mask(a)
    yy, xx = np.mgrid[0:h, 0:w]
    disc = np.full((h, w), -1, dtype=np.int32)
    for i, p in enumerate(pts):
        disc[(xx - p['x']) ** 2 + (yy - p['y']) ** 2 <= disc_r ** 2] = i
    road = road & (disc < 0)
    result = []
    for comp in components(road):
        if len(comp) < 400:
            continue
        touched = {}
        for y, x in comp:
            for dy in (-2, 0, 2):
                for dx in (-2, 0, 2):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and disc[ny, nx] >= 0:
                        touched[disc[ny, nx]] = touched.get(disc[ny, nx], 0) + 1
        ids = sorted(k for k, v in touched.items() if v >= min_touch)
        cy, cx = comp.mean(0)
        result.append((ids, len(comp), int(cx), int(cy)))
    return pts, result


if __name__ == '__main__':
    pts, res = adjacency(sys.argv[1])
    for ids, n, cx, cy in sorted(res):
        tag = 'FORK' if len(ids) >= 3 else ('dead-end' if len(ids) < 2 else '')
        print(ids, n, (cx, cy), tag)
