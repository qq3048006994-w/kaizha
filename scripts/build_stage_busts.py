"""把人物志白底半身照（641x790）抠成透明近景立绘。

用途：审案页「谁说话谁出现」的单人视觉小说舞台。

核心难点（由 scripts/probe_white_levels.py 像素量化与参数扫描确认）：
- 秦香莲头发/发髻/鬓角的「白边」并不是纯白块，而是紧贴人物轮廓的
  **灰白抗锯齿过渡带**（mn≈204~244、spread≈3）。旧算法用 mn>=238 的
  严格阈值做边界连通，把这圈灰带从背景域里切断，于是留在前景里，
  叠到深色公堂背景上就成了刺眼白边。
- 陈世美白袍里有约 1.4 万 px 纯白高光、约 1 万 px「浅色包围」的封闭
  纯白块。既不能全局删白，也不能把所有封闭白块当背景，否则白袍被啃穿。
- 包拯耳下两缕「显白」的东西，经原白底图同区域放大对照确认是**人物自带的
  银灰鬓髯**（细丝纹理、与黑髯自然衔接、在原图里呈浅灰而非纯白），不是抠图
  残留。直接删会在脸颊挖出两个透明洞，故只做压暗，不删除。

算法（分层剥离，兼顾「去白边」与「保白袍」）：
  ① 纯白核心 pure = mn>=246 & spread<=14；
  ② 与四边界连通的 pure = 确定背景；
  ③ 封闭 pure 块：被深色（头发）包围 → 背景；被浅色（衣料）包围 → 保留；
  ④ 从确定背景出发，按「到背景的距离」分层删除浅色过渡带：
     离背景越近，越低的亮度也判为背景；离背景远的一律保留。
     门控 near_dark：只在邻域内确实存在深色像素时才剥离 ——
     白边是「背景白 ↔ 深色头发」的过渡，白袍外沿却是「背景白 ↔ 浅色衣料」
     的渐变，后者邻域无深色，因此不会被啃出大缺口。
     含白袍的角色（chen）额外用更短的剥离距离，双保险。
  ⑤ 白袍角色做「小洞回填」：纯白高光若被 ② 误判成连通背景而挖出
     封闭小洞，用「中灰前景闭运算 → fill_holes → 腐蚀」得到的人物实体
     核心精确补回；人物轮廓外的真背景不受影响。
  ⑥ 清理远离主人物连通域的孤立白噪点；
  ⑦ 透明区 RGB 用最近前景色填充，消除浏览器缩放插值时的白色渗边；
  ⑧ 银灰鬓髯（bao）压暗：中性浅灰线性映射成深灰褐，保留发丝纹理，
     只改 RGB 不动 alpha；
  ⑨ 0.5px 羽化消锯齿，不降边缘不透明度（避免白雾 / 「跟鬼一样」）；
  ⑩ 不做 getbbox 裁切（五张共用画布）+ 底边 5% 短渐隐，硬切线藏进对话框。

输出：public/assets/characters/stage/*-bust.png（统一 641x730）
预览：test-artifacts/stage-busts-preview.png（深绿底并排，便于查白边/破洞）
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/assets/characters"
OUT = SRC / "stage"
PREVIEW = ROOT / "test-artifacts"
OUT.mkdir(parents=True, exist_ok=True)
PREVIEW.mkdir(parents=True, exist_ok=True)

FILES = {
    "bao": "baozheng-white-full.jpg",
    "qin": "qinxianglian-white-full.jpg",
    "chen": "chenshimei-white-full.jpg",
    "han": "hanqi-white-full.jpg",
    "princess": "princess-white-full.jpg",
}
# 含大面积浅色衣料（白袍）的角色：需要保守剥离 + 小洞回填
LIGHT_ROBE = {"chen"}
# 人物自带银灰鬓髯的角色：原白底图对照确认是造型而非白底残留，
# 不能删（会在脸颊挖出透明洞），改为压暗成深灰褐，保留发丝纹理与轮廓。
GRAY_TEMPLE = {"bao"}
# 裁切前（原图）坐标：左右两条耳下鬓髯带
TEMPLE_REGIONS = ((210, 300, 230, 395), (345, 435, 230, 395))
TEMPLE_MIN_MN = 110      # 中性浅灰发丝起点（肤色 spread 大，靠下一行排除）
TEMPLE_MAX_SPREAD = 22
TEMPLE_NEW_MIN = 45      # 压暗后最低亮度
TEMPLE_SLOPE = 0.35      # 保留发丝明暗纹理的线性映射斜率
TEMPLE_WARM = (6, 2, -3)  # 轻微暖褐偏移，与黑髯色系统一

# ① 纯白核心：白底 JPEG 均匀纯白，mn≈255、spread≈0
PURE_MIN = 246
PURE_SPREAD = 14
# ③ 封闭纯白块的外环判据：深色占比超过此值 = 发髻缝隙里透出的背景
RING_DARK = 170
RING_RATIO = 0.35
RING_ITER = 3
MIN_BLOCK = 8
# ④ 浅色过渡带：spread 足够小才算「白/灰」，避免误删彩色肤色、红衣
SHALLOW_SPREAD = 60
NEAR_DARK_SIZE = 17    # 邻域窗口（半径 8px）
NEAR_DARK_LEVEL = 170  # 低于此亮度算深色（黑发、深蓝官服、灰褐衣、阴影）
# (到背景的最大距离, 最低亮度, 最大色偏)
# 越靠近背景越宽松；spread 门控用来排除彩色肤色 / 红衣 / 灰褐衣料。
PEEL_BANDS = (
    (2, 190, 60),
    (3, 155, 25),   # 中性灰白发丝 / 发缝里透出的白底（包拯鬓角、秦香莲鬓角）
    (5, 212, 60),
    (10, 238, 60),
    (16, 250, 60),
)
# 白袍角色：只剥最贴背景的一圈，且不含「低亮度中性灰」档，避免啃进白袍
PEEL_BANDS_ROBE = (
    (2, 205, 60),
    (4, 228, 60),
    (7, 246, 60),
)
PEEL_ROUNDS = 2
# ⑤ 白袍内部洞回填：由「中灰前景」闭运算重建人物实体，腐蚀出核心后回填。
#    比 9x9 局部占比更准，能补掉白袍下摆与底部背景连通的竖直高光洞；
#    腐蚀保证只回填人物内部，不把轮廓外真背景填回来（白边不会复现）。
SOLID_STRUCT = 21
SOLID_ERODE = 12
# ⑥ 孤立白噪点：近白、面积小、且远离「主前景连通域」的小块 → 背景。
#    珠串/耳坠贴着头饰或脸（距主前景 <25px）保留；白袍属于主前景本身保留。
SPECK_MIN_DIST = 10
SPECK_MAX = 400
SPECK_MIN_MN = 210
SPECK_MAX_SPREAD = 50
TOP_TRIM = 60      # 裁掉头顶上方统一留白，让头顶贴近画面上方（参考图构图）
FADE_START = 0.95  # 底部 5% 短渐隐，避免硬切线露出


def cutout(path: Path, robe: bool = False, temple: bool = False):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    mn = a.min(axis=2)
    spread = a.max(axis=2) - mn

    # ① 纯白核心
    pure = (mn >= PURE_MIN) & (spread <= PURE_SPREAD)

    # ② 边界连通纯白 = 确定背景
    labels, _ = ndi.label(pure)
    border = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    border.discard(0)
    bg = np.isin(labels, list(border)) if border else np.zeros_like(pure, dtype=bool)

    # ③ 封闭纯白块：深色包围 → 背景；浅色包围（白袍高光）→ 保留
    closed_labels, m = ndi.label(pure & ~bg)
    closed_removed = 0
    closed_kept = 0
    for lab in range(1, m + 1):
        mask = closed_labels == lab
        size = int(mask.sum())
        if size < MIN_BLOCK:
            continue
        ring = ndi.binary_dilation(mask, iterations=RING_ITER) & ~mask
        if ring.any() and (mn[ring] < RING_DARK).mean() > RING_RATIO:
            bg |= mask
            closed_removed += size
        else:
            closed_kept += size

    # ④ 分层剥离浅色抗锯齿白边
    shallow = spread <= SHALLOW_SPREAD
    near_dark = ndi.minimum_filter(mn, size=NEAR_DARK_SIZE) < NEAR_DARK_LEVEL
    bands = PEEL_BANDS_ROBE if robe else PEEL_BANDS
    peeled = 0
    for _ in range(PEEL_ROUNDS):
        dist = ndi.distance_transform_edt(~bg)
        remove = np.zeros_like(bg)
        for max_dist, min_mn, max_spread in bands:
            remove |= ((dist <= max_dist) & (mn >= min_mn)
                       & (spread <= max_spread))
        remove &= shallow & near_dark & ~bg
        if not remove.any():
            break
        bg |= remove
        peeled += int(remove.sum())

    # ⑤ 白袍内部洞回填：重建人物实体，只回填实体核心里的透明洞
    refilled = 0
    if robe:
        hint = (mn < 230) & (spread <= 45)
        solid = ndi.binary_closing(hint, structure=np.ones((SOLID_STRUCT, SOLID_STRUCT)),
                                   border_value=0)
        solid = ndi.binary_fill_holes(solid)
        inner = ndi.binary_erosion(solid, iterations=SOLID_ERODE)
        holes = bg & inner
        refilled = int(holes.sum())
        bg &= ~holes

    # ⑥ 清理孤立白噪点（所有角色）：远离主人物连通域的近白小块
    fg_labels, nf = ndi.label(~bg)
    cleaned = 0
    if nf:
        sizes = np.asarray(ndi.sum(np.ones_like(fg_labels, dtype=np.int32),
                                   fg_labels, index=list(range(1, nf + 1))))
        main_fg = fg_labels == (int(np.argmax(sizes)) + 1)
        d_main = ndi.distance_transform_edt(~main_fg)
        speck_seed = ((~bg) & (mn >= SPECK_MIN_MN) & (spread <= SPECK_MAX_SPREAD)
                      & (d_main > SPECK_MIN_DIST))
        speck_labels, sn = ndi.label(speck_seed)
        if sn:
            ssz = np.asarray(ndi.sum(np.ones_like(speck_labels, dtype=np.int32),
                                     speck_labels, index=list(range(1, sn + 1))))
            small_ids = np.where((ssz > 0) & (ssz <= SPECK_MAX))[0] + 1
            if small_ids.size:
                drop = np.isin(speck_labels, small_ids)
                cleaned = int(drop.sum())
                bg |= drop

    fg = ~bg
    alpha = np.where(fg, 255, 0).astype(np.uint8)

    # ⑦ 透明区颜色扩展：每个透明像素换成最近前景像素的颜色，
    #    否则浏览器双线性缩放时纯白 RGB 会渗到边缘形成白色描边。
    _, indices = ndi.distance_transform_edt(bg, return_indices=True)
    rgb_fixed = a[indices[0], indices[1]].astype(np.uint8)

    # ⑧ 银灰鬓髯压暗：原白底图对照确认是人物造型（细丝状、与黑髯衔接），
    #    不是白底残留；直接删会挖出两个透明洞，改为把中性浅灰线性压成
    #    深灰褐，保留发丝明暗纹理，深色公堂背景上不再显白。
    if temple:
        for x0, x1, y0, y1 in TEMPLE_REGIONS:
            sub_mn = mn[y0:y1, x0:x1]
            sub_sp = spread[y0:y1, x0:x1]
            mk = (sub_mn >= TEMPLE_MIN_MN) & (sub_sp <= TEMPLE_MAX_SPREAD)
            if not mk.any():
                continue
            new_mn = TEMPLE_NEW_MIN + (sub_mn[mk] - TEMPLE_MIN_MN) * TEMPLE_SLOPE
            ratio = new_mn / sub_mn[mk]
            block = rgb_fixed[y0:y1, x0:x1].copy()
            patched = block[mk].astype(np.float32) * ratio[:, None]
            patched += np.asarray(TEMPLE_WARM, dtype=np.float32)
            block[mk] = np.clip(patched, 0, 255).astype(np.uint8)
            rgb_fixed[y0:y1, x0:x1] = block

    # ⑨ 只做 0.5px 羽化消除锯齿，不把边缘降到半透明
    alpha_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.5))

    rgba = np.dstack([rgb_fixed, np.asarray(alpha_img)])
    bust = Image.fromarray(rgba, "RGBA").crop((0, TOP_TRIM, im.width, im.height))

    # ⑩ 底边短渐隐：只在裁切后的最后 5% 行生效，人物主体完全不透明
    arr = np.asarray(bust).copy()
    h = arr.shape[0]
    start = int(h * FADE_START)
    if start < h:
        ramp = np.linspace(1.0, 0.0, h - start, dtype=np.float32)
        arr[start:, :, 3] = (arr[start:, :, 3].astype(np.float32) * ramp[:, None]).astype(np.uint8)
    bust = Image.fromarray(arr, "RGBA")

    return bust, closed_removed, closed_kept, peeled, refilled, cleaned


def main() -> None:
    tiles = []
    for key, name in FILES.items():
        src = SRC / name
        bust, closed_removed, closed_kept, peeled, refilled, cleaned = cutout(
            src, robe=key in LIGHT_ROBE, temple=key in GRAY_TEMPLE)
        dest = OUT / f"{key}-bust.png"
        bust.save(dest)
        arr = np.asarray(bust)
        fg_ratio = float((arr[:, :, 3] > 16).mean())
        print(f"{key:9s} {bust.size} -> {dest.name}  fg={fg_ratio:.1%}  "
              f"封闭白块 删={closed_removed} 留={closed_kept}  "
              f"剥离浅色={peeled}  回填={refilled}  清噪点={cleaned} px")
        tiles.append(bust)

    # 深绿底并排预览：白边、白袍破洞、硬切边一眼可见
    pad, cell_w, cell_h = 18, 641, 790 - TOP_TRIM
    scale = 0.42
    w, h = int(cell_w * scale), int(cell_h * scale)
    sheet = Image.new("RGB", (len(tiles) * (w + pad) + pad, h + pad * 2), (18, 41, 31))
    for i, tile in enumerate(tiles):
        thumb = tile.resize((w, h), Image.LANCZOS)
        sheet.paste(thumb, (pad + i * (w + pad), pad), thumb)
    preview = PREVIEW / "stage-busts-preview.png"
    sheet.save(preview)
    print(f"preview -> {preview}")


if __name__ == "__main__":
    main()
