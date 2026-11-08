"""统一人物档案白底大图规格（以包拯成品为基准）。

背景：档案大图容器宽度固定，图片按宽度撑开，三张图宽高比不同会导致
显示差异极大（秦被放大成大脸、陈缩成全身）。本脚本把所有人物的白底图
统一输出为 641x790 纯白画布：
  - 人物等比缩放，使「头顶到脚底」高度与包拯一致；
  - 人物水平居中（修正秦香莲偏左）；
  - 头顶留白与包拯一致；
  - 背景网格/水印/文字残影一律刷成纯白；
  - 画布高度直接取裁切线 CUT_Y=790，不再补 1600 高的纯白尾部。

旧版输出 641x1600、人物只占前 790 行，下面 810 行全是纯白；图片固有
宽高比会把整个档案面板撑到约 1093px 高，页面出现大片空白。改为按裁切线
直接出图后，人物从「头顶」到「手刚好看不见」刚好铺满白底容器。
"""
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

ROOT = Path(r"C:/Users/Administrator/WorkBuddy/baozha")
SRC = ROOT / "public" / "assets" / "source"
OUT = ROOT / "public" / "assets" / "characters"

CANVAS_W, CANVAS_H = 641, 790
NONWHITE = 232

# (源文件, 输出文件, 人物列搜索范围占全宽比例, 是否用开运算去文字)
# 列范围来自各设定集图的列投影：左为文字栏、中为人物、右为特写。
ITEMS = [
    ("clipboard-2026-11-07T09-42-19-966Z-b7197c66.jpg", "baozheng-white-full.jpg", (0.00, 0.52), False),
    ("clipboard-2026-11-07T09-42-19-962Z-2fcfbaba.jpg", "qinxianglian-white-full.jpg", (0.24, 0.52), True),
    ("clipboard-2026-11-07T09-42-19-958Z-722c3f9d.jpg", "chenshimei-white-full.jpg", (0.00, 1.00), False),
    ("clipboard-2026-11-07T09-42-19-964Z-498ea5f3.jpg", "hanqi-white-full.jpg", (0.14, 0.45), True),
    ("clipboard-2026-11-07T09-42-19-968Z-f253f039.jpg", "princess-white-full.jpg", (0.13, 0.46), True),
]


def clean_background(arr):
    """把接近白 / 低饱和的浅灰（网格、水印、纸纹）刷成纯白。"""
    mn = arr.min(axis=2).astype(int)
    mx = arr.max(axis=2).astype(int)
    bg = (mn >= 232) & ((mx - mn) <= 16)
    out = arr.copy()
    out[bg] = 255
    return out


def remove_stray_text(arr):
    """开运算去掉设定集里散落的深色文字笔画，只保留人物主体。

    人物是大块连通区域，文字是细笔画：先腐蚀再膨胀可抹掉文字；
    随后把保留区向外扩一点，区外的深色像素（文字）一律刷白。
    """
    gray = Image.fromarray(arr.min(axis=2))
    mask = gray.point(lambda p: 255 if p < NONWHITE else 0)
    opened = mask.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7))
    keep = np.asarray(opened.filter(ImageFilter.MaxFilter(11))) > 0
    out = arr.copy()
    out[~keep] = 255
    return out


def longest_run(hit, gap):
    """找最长连续 True 区间，允许 <=gap 的短断裂。返回 (start, end)。"""
    best, cur_start, last_true = None, None, -1
    for i, v in enumerate(hit):
        if v:
            if cur_start is None:
                cur_start = i
            last_true = i
        elif cur_start is not None and i - last_true > gap:
            if best is None or last_true - cur_start > best[1] - best[0]:
                best = (cur_start, last_true + 1)
            cur_start = None
    if cur_start is not None and (best is None or last_true - cur_start > best[1] - best[0]):
        best = (cur_start, last_true + 1)
    return best or (0, len(hit))


def figure_bbox(gray):
    """用行/列投影找人物主体包围盒（忽略角落水印等孤立小块）。"""
    mask = gray < NONWHITE
    h, w = mask.shape
    col = mask.mean(axis=0)
    row = mask.mean(axis=1)
    ci = longest_run(col > 0.10, max(4, int(w * 0.02)))
    ri = longest_run(row > 0.06, max(6, int(h * 0.01)))
    # 略放宽，避免切到袖口 / 帽翅
    pad_x, pad_y = int(w * 0.01), int(h * 0.005)
    return (max(0, ci[0] - pad_x), max(0, ri[0] - pad_y),
            min(w, ci[1] + pad_x), min(h, ri[1] + pad_y))


def extract_person(src_name, col_range, open_text):
    im = Image.open(SRC / src_name).convert("RGB")
    arr = np.asarray(im, dtype=np.uint8)
    h, w = arr.shape[:2]
    x0, x1 = int(w * col_range[0]), int(w * col_range[1])
    sub = clean_background(arr[:, x0:x1])
    if open_text:
        sub = remove_stray_text(sub)
    gray = sub.min(axis=2)
    l, t, r, b = figure_bbox(gray)
    return sub[t:b, l:r], (x0 + l, t, x0 + r, b)


# 包拯成品的固定基准（首次实测），写成常量避免反复生成时 JPEG 边界漂移累积
BASE_H = 1488      # 人物「头顶→脚底」高度
BASE_TOP = 77      # 头顶留白
BASE_CX = 322.5    # 人物水平中心
CUT_Y = CANVAS_H   # 统一裁切线：腰带(y≈670-750)保留，手部(y≈800-950)刚好全部切掉
print(f"基准(包拯): 高度={BASE_H} 头顶={BASE_TOP} 中心={BASE_CX} 裁切线={CUT_Y}")

for src_name, out_name, col_range, open_text in ITEMS:
    person, bbox = extract_person(src_name, col_range, open_text)
    ph, pw = person.shape[:2]
    scale = BASE_H / ph
    new_w, new_h = round(pw * scale), BASE_H
    img = Image.fromarray(person).resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), (255, 255, 255))
    px = round(BASE_CX - new_w / 2)
    # 画布只到裁切线，人物下半身（含手部）直接不贴，不再保留纯白尾部
    visible_h = CANVAS_H - BASE_TOP
    canvas.paste(img.crop((0, 0, new_w, visible_h)), (px, BASE_TOP))
    final = np.asarray(canvas).copy()
    # 底部 4px 刷白，给 JPEG 边界振铃留缓冲，避免最下一行出现灰边
    final[CANVAS_H - 4:, :, :] = 255
    Image.fromarray(final).save(OUT / out_name, quality=92)
    print(f"{out_name}: 源bbox={bbox} -> 缩放{scale:.3f} 贴于({px},{BASE_TOP}) {new_w}x{new_h}, 画布{CANVAS_W}x{CANVAS_H}")
print("done")
