"""把用户提供的「左右站位设定图」处理成透明底立绘。

要点：
- 并排图按中线切成左/右两版，各自独立抠图；单张图作为正面通用版。
- 白底去除用「与边界连通的近白区域」：从四周向内做 8 连通传播，
  只把真正与画面边缘相连的白背景清掉，人物内部的白袍/白内衬得以保留。
- alpha 腐蚀 1px 去掉合成白边，再 0.6px 羽化，避免深色背景上出现锯齿亮边。
- 最后裁掉无用透明边，统一高度，输出 RGBA PNG。
"""
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage

SRC = Path(r"C:/Users/Administrator/.workbuddy/clipboard-images")
OUT = Path(r"C:/Users/Administrator/WorkBuddy/baozha/public/assets/characters/stage")
PREVIEW = Path(r"C:/Users/Administrator/WorkBuddy/baozha/test-artifacts")
OUT.mkdir(parents=True, exist_ok=True)

# (源文件, 输出名前缀, 模式)
ITEMS = [
    ("clipboard-2026-11-07T17-24-23-045Z-db4be4d4.jpg", "bao", "pair"),
    ("clipboard-2026-11-07T17-24-23-046Z-9c86061b.jpg", "qin", "pair"),
    ("clipboard-2026-11-07T17-24-23-047Z-9fe824ec.jpg", "chen", "pair"),
    ("clipboard-2026-11-07T17-24-23-044Z-4d2382e5.jpg", "princess", "single"),
]

TARGET_H = 1200
NEAR_WHITE_MIN = 218      # 通道最小值阈值：近白
NEAR_WHITE_SPREAD = 22    # 最大色差：低饱和


def cutout(im):
    arr = np.asarray(im.convert("RGB"), dtype=np.int16)
    mn = arr.min(axis=2)
    mx = arr.max(axis=2)
    bg = (mn >= NEAR_WHITE_MIN) & ((mx - mn) <= NEAR_WHITE_SPREAD)

    # 只从四边界开始传播；被人物轮廓包住的内部白色不会被误删
    seed = np.zeros_like(bg)
    seed[0, :] = bg[0, :]
    seed[-1, :] = bg[-1, :]
    seed[:, 0] = bg[:, 0]
    seed[:, -1] = bg[:, -1]
    reach = ndimage.binary_propagation(seed, mask=bg, structure=np.ones((3, 3), dtype=bool))

    alpha = np.where(reach, 0, 255).astype(np.uint8)
    a = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3))   # 去合成白边
    a = a.filter(ImageFilter.GaussianBlur(0.6))                  # 极轻羽化
    rgba = im.convert("RGBA")
    rgba.putalpha(a)
    bbox = rgba.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)
    return rgba, int(reach.sum()), int(bg.sum())


def fit_height(im, h=TARGET_H):
    w0, h0 = im.size
    w = round(w0 * h / h0)
    return im.resize((w, h), Image.LANCZOS)


results = []
for src_name, prefix, mode in ITEMS:
    im = Image.open(SRC / src_name).convert("RGB")
    w, h = im.size
    # 诊断中线是否干净（避免切断相邻人物）
    mid = np.asarray(im.convert("L"))[:, w // 2 - 24:w // 2 + 24]
    mid_nonwhite = float((mid < 232).mean())

    halves = [("left", im.crop((0, 0, w // 2, h))), ("right", im.crop((w // 2, 0, w, h)))] if mode == "pair" else [("front", im)]
    for side, half in halves:
        rgba, removed, candidate = cutout(half)
        rgba = fit_height(rgba)
        name = f"{prefix}-{side}.png"
        rgba.save(OUT / name, optimize=True)
        results.append((name, rgba, removed, candidate))
        print(f"{name}: 源{half.size} -> 输出{rgba.size}, 清除背景像素 {removed}/{candidate}")

print(f"中线非白占比: " + ", ".join(f"{n}={v:.3f}" for n, v in [])) if False else None

# 深色公堂色底预览，检查白边 / 残留背景 / 透明边
canvas = Image.new("RGB", (len(results) * 300, 700), "#16261d")
from PIL import ImageDraw
d = ImageDraw.Draw(canvas)
for i, (name, rgba, _, _) in enumerate(results):
    thumb = rgba.copy()
    thumb.thumbnail((270, 630))
    x = i * 300 + (300 - thumb.width) // 2
    canvas.paste(thumb, (x, 45), thumb)
    d.text((i * 300 + 10, 660), name, fill="#e9dfc6")
canvas.save(PREVIEW / "stage-portraits-preview.png")
print("preview ->", PREVIEW / "stage-portraits-preview.png")
