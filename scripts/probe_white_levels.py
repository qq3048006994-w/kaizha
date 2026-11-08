"""量化「背景纯白 / 白边抗锯齿 / 白袍衣料」三类像素的亮度分布。

目的：为重写抠图阈值提供数据，确保删掉秦香莲发髻白边的同时
不误删陈世美白袍。纯背景均匀纯白（mn≈255、spread≈0）；
白边是灰白渐变；白袍带纹理/灰调/光影，三者 mn 分布不同。
"""
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


def stats(name, mn, spread, mask=None):
    v = mn if mask is None else mn[mask]
    s = spread if mask is None else spread[mask]
    if v.size == 0:
        print(f"    {name}: (empty)")
        return
    print(f"    {name}: n={v.size:7d} mn p5/25/50/75/95="
          f"{np.percentile(v,5):.0f}/{np.percentile(v,25):.0f}/"
          f"{np.percentile(v,50):.0f}/{np.percentile(v,75):.0f}/{np.percentile(v,95):.0f}"
          f"  spread p50/p90={np.percentile(s,50):.0f}/{np.percentile(s,90):.0f}")


for key, fn in FILES.items():
    a = np.asarray(Image.open(SRC / fn).convert("RGB")).astype(np.int16)
    mn = a.min(axis=2)
    spread = a.max(axis=2) - mn
    print(f"\n=== {key} ({a.shape[1]}x{a.shape[0]}) ===")

    pure = (mn >= 246) & (spread <= 14)
    labels, n = ndi.label(pure)
    border = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    border.discard(0)
    border_pure = np.isin(labels, list(border)) if border else np.zeros_like(pure)
    closed_pure = pure & ~border_pure
    print(f"  pure(mn>=246,spread<=14): {pure.sum()}  边界连通={border_pure.sum()}  封闭={closed_pure.sum()}")
    # 封闭纯白块的外环深色占比（区分发髻缝隙 vs 白袍高光）
    cl, m = ndi.label(closed_pure)
    dark_closed = 0
    light_closed = 0
    for lab in range(1, m + 1):
        mk = cl == lab
        if mk.sum() < 12:
            continue
        ring = ndi.binary_dilation(mk, iterations=3) & ~mk
        if (mn[ring] < 170).mean() > 0.35:
            dark_closed += int(mk.sum())
        else:
            light_closed += int(mk.sum())
    print(f"  封闭纯白块: 深色包围={dark_closed}  浅色包围={light_closed}")

    stats("全图 mn", mn, spread)
    stats("纯白核心", mn, spread, pure)

    if key == "chen":
        # 白袍主体采样：肩以下、中心区域
        robe = np.zeros_like(mn, dtype=bool)
        robe[360:760, 160:480] = True
        stats("白袍主体[360:760,160:480]", mn, spread, robe)
        stats("白袍内较亮(mn>=225)", mn, spread, robe & (mn >= 225))
        stats("白袍内偏灰(mn<225)", mn, spread, robe & (mn < 225))
        # 白袍里 mn>=246 的「纯白高光」有多少
        stats("白袍纯白高光", mn, spread, robe & pure)

    if key == "qin":
        # 头部轮廓附近（排除纯背景大块）的灰白过渡带样本
        head = np.zeros_like(mn, dtype=bool)
        head[20:340, 150:470] = True
        stats("秦头部区域", mn, spread, head)
        stats("秦头部灰白(200<=mn<246)", mn, spread, head & (mn >= 200) & (mn < 246))
        for label, (x0, x1, y0, y1) in {
            "发髻右上": (320, 380, 10, 90),
            "左侧鬓角": (225, 285, 100, 230),
            "右侧脸颊": (345, 395, 140, 250),
        }.items():
            sub = np.zeros_like(mn, dtype=bool)
            sub[y0:y1, x0:x1] = True
            stats(f"红圈-{label}", mn, spread, sub)
