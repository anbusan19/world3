#!/usr/bin/env python3
"""Splits a logo picture into flat colour layers for trace-logo.mjs.
   python3 split-colours.py <logo.png> <out-dir> [colours]
Writes <out-dir>/layer0.png ... (a soft mask per colour, centred and scaled to sit inside a coin) and <out-dir>/spec.json
(the colour of each layer, plus a suggested face and rim colour). Round badges are scaled to fill the coin; other marks are scaled
to sit comfortably inside it."""
import sys, json, math, os
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
n = int(sys.argv[3]) if len(sys.argv) > 3 else 4
os.makedirs(out, exist_ok=True)
im = Image.open(src).convert('RGBA')
im.thumbnail((512, 512), Image.LANCZOS)
W, H = im.size
px = im.load()
opaque = [[px[x, y][3] >= 128 for x in range(W)] for y in range(H)]

# main colours: quantise the opaque pixels, keep the clusters that matter, then snap every pixel to its nearest main colour
rgb = Image.new('RGB', (W, H), (255, 0, 255))
for y in range(H):
    for x in range(W):
        if opaque[y][x]:
            rgb.putpixel((x, y), px[x, y][:3])
q = rgb.quantize(colors=n + 2, method=Image.Quantize.FASTOCTREE)
pal = q.getpalette()
counts = {}
for y in range(H):
    for x in range(W):
        if opaque[y][x]:
            i = q.getpixel((x, y)); counts[i] = counts.get(i, 0) + 1
total = sum(counts.values()) or 1
main = [tuple(pal[i * 3:i * 3 + 3]) for i, c in sorted(counts.items(), key=lambda kv: -kv[1]) if c / total >= 0.012][:n]
if not main: main = [(0, 0, 0)]
dist = lambda a, b: sum((a[k] - b[k]) ** 2 for k in range(3))
owner = [[-1] * W for _ in range(H)]
area = [0] * len(main)
for y in range(H):
    for x in range(W):
        if opaque[y][x]:
            c = px[x, y][:3]
            k = min(range(len(main)), key=lambda j: dist(c, main[j])); owner[y][x] = k; area[k] += 1

# where the mark is, how big, and is it a round badge?
xs = [x for y in range(H) for x in range(W) if opaque[y][x]]
ys = [y for y in range(H) for x in range(W) if opaque[y][x]]
cx, cy = (min(xs) + max(xs) + 1) / 2, (min(ys) + max(ys) + 1) / 2
rmax = max(math.hypot(x + 0.5 - cx, y + 0.5 - cy) for y in range(H) for x in range(W) if opaque[y][x])
bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
fill = sum(area) / (math.pi * (max(bw, bh) / 2) ** 2)
badge = abs(bw - bh) / max(bw, bh) < 0.06 and 0.93 <= fill <= 1.06 and rmax <= max(bw, bh) / 2 * 1.04  # a filled disc
target = 0.96 if badge else 0.74
S = 2 * rmax / target
SIZE = 640
layers = []
order = sorted(range(len(main)), key=lambda j: -area[j])  # biggest colour first
for rank, j in enumerate(order):
    m = Image.new('L', (W, H), 0); mp = m.load()
    for y in range(H):
        for x in range(W):
            if owner[y][x] == j: mp[x, y] = 255
    out_m = m.transform((SIZE, SIZE), Image.AFFINE, (S / SIZE, 0, cx - S / 2, 0, S / SIZE, cy - S / 2), resample=Image.BILINEAR)
    layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0)); layer.putalpha(out_m)
    layer.save(f'{out}/layer{rank}.png')
    layers.append({'png': f'layer{rank}.png', 'color': '#%02X%02X%02X' % main[j], 'area': area[j]})
hexc = lambda c: '#%02X%02X%02X' % tuple(max(0, min(255, int(v))) for v in c)
dom = main[order[0]]
lum = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
rim = tuple(v * 0.72 for v in dom) if lum(dom) > 40 else (30, 30, 36)
json.dump({'badge': badge, 'face': '#F4F1EA', 'rim': hexc(rim), 'layers': layers}, open(f'{out}/spec.json', 'w'), indent=1)
print(f"{os.path.basename(src)}: {len(layers)} colours, {'round badge' if badge else 'mark'}, " + ', '.join(l['color'] for l in layers))
