"""统计五张白底图里「近白像素」的连通域，区分背景 / 封闭白块 / 白色衣料。"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/assets/characters"
FILES = {
    "bao": "baozheng-white-full.jpg",
    "qin": "qinxianglian-white-full.jpg",
    "chen": "chenshimei-white-full.jpg",
    "han": "hanqi-white-full.jpg",
    "princess": "princess-white-full.jpg",
}

# 白袍采样框（原图 641x790 坐标）
ROBE = (190, 450, 330, 650)

for key, name in FILES.items():
    a = np.asarray(Image.open(SRC / name).convert("RGB")).astype(np.int16)
    mn = a.min(axis=2)
    spread = a.max(axis=2) - mn
    near = (mn >= 232) & (spread <= 22)
    labels, n = ndi.label(near)
    border = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    border.discard(0)
    sizes = np.bincount(labels.ravel())
    closed = []
    for lab in range(1, n + 1):
        if lab in border:
            continue
        closed.append((sizes[lab], lab))
    closed.sort(reverse=True)
    x0, x1, y0, y1 = ROBE
    robe_mn = mn[y0:y1, x0:x1]
    robe_near = near[y0:y1, x0:x1]
    print(f"\n=== {key} ===")
    print(f"  near pixels = {near.sum()}, domains = {n}, border domains = {len(border)}")
    print(f"  closed near domains: {len(closed)},  top sizes = {[s for s, _ in closed[:8]]}")
    print(f"  robe region mn p10/p50/p90 = {np.percentile(robe_mn,10):.0f}/{np.percentile(robe_mn,50):.0f}/{np.percentile(robe_mn,90):.0f}, near ratio = {robe_near.mean():.3f}")
    if closed:
        big = [(s, lab) for s, lab in closed if s >= 200]
        print(f"  closed domains >=200px: {len(big)}, sizes={[s for s, _ in big[:8]]}")
        for s, lab in big[:3]:
            ys, xs = np.where(labels == lab)
            print(f"    size={s} bbox x[{xs.min()},{xs.max()}] y[{ys.min()},{ys.max()}]")
