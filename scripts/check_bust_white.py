"""近景立绘抠图验收：白边残留 / 白袍破洞 / 尺寸 / 四角透明 / 中心不透明。

用法：python scripts/check_bust_white.py
失败时非零退出，可用作 npm run check:bust-white。
同时输出五张深绿底放大图 test-artifacts/bust-{key}-check.png 供肉眼复核。
"""
from pathlib import Path
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/assets/characters"
ART = ROOT / "test-artifacts"
ART.mkdir(parents=True, exist_ok=True)
TOP_TRIM = 60
W, H = 641, 730

FILES = {
    "bao": "baozheng-white-full.jpg",
    "qin": "qinxianglian-white-full.jpg",
    "chen": "chenshimei-white-full.jpg",
    "han": "hanqi-white-full.jpg",
    "princess": "princess-white-full.jpg",
}

# 用户截图红圈三处（按 641x790 原图坐标，验收时裁掉 TOP_TRIM 对齐）
QIN_REGIONS = {
    "发髻右上白块": (320, 380, 10, 90),
    "左侧头发白条": (225, 285, 100, 230),
    "右侧脸颊白条": (345, 395, 140, 250),
}

# 验收阈值
# 白边 = 「近白 + 不透明 + 紧贴透明区(<=4px)」，避免把人物自身的白色
# 衣料 / 白袍 / 珠饰误算成残留。
EDGE_BAND = 4
MAX_EDGE_QIN = 300         # 秦香莲边缘白边（旧版 1519，收紧后应 <=300）
MAX_EDGE_OTHER = 900       # 其他角色
MAX_EDGE_ROBE_HEAD = 800   # 陈世美只验头部/肩以上（含白色玉簪，白袍主体须排除）
ROBE_HEAD_END = 300        # 裁切后 y < 300 为头部区，以下为白袍躯干
MAX_REGION_RESIDUE = 60    # 红圈单区
MAX_ROBE_HOLE = 30         # 陈世美白袍内部采样区允许的最大透明像素
# 包拯耳下银灰鬓髯（原图对照确认是人物造型）：压暗后输出 RGB 不得再显白
TEMPLE_BANDS = ((210, 300, 170, 335), (345, 435, 170, 335))  # 裁切后坐标
MAX_TEMPLE_BRIGHT = 0.06   # 带内「不透明且 mn>=150」的占比上限
DARK_BG = (18, 41, 31)

errors = []


def require(cond, msg):
    if not cond:
        errors.append(msg)


print(f"{'key':>9} {'size':>12} {'edge':>7} {'all':>7} {'robe_hole':>10} "
      f"{'corner':>8} {'center':>7} {'specks':>7}")
for key, fn in FILES.items():
    bust_path = SRC / "stage" / f"{key}-bust.png"
    require(bust_path.exists(), f"{key}: 缺少 {bust_path}")
    if not bust_path.exists():
        continue
    bust = np.asarray(Image.open(bust_path).convert("RGBA"))
    require(bust.shape == (H, W, 4), f"{key}: 尺寸应为 {W}x{H}，实际 {bust.shape[1]}x{bust.shape[0]}")
    alpha = bust[:, :, 3]
    rgb = bust[:, :, :3].astype(np.int16)

    raw = np.asarray(Image.open(SRC / fn).convert("RGB")).astype(np.int16)[TOP_TRIM:]
    mn = raw.min(axis=2)
    spread = raw.max(axis=2) - mn
    near_white = (mn >= 205) & (spread <= 45)
    opaque = alpha > 40
    residue_mask = near_white & opaque
    residue = int(residue_mask.sum())
    # 只统计紧贴透明区的近白像素 = 真白边 / 白噪点；
    # 白袍主体、珠饰等人物自身白色离透明区远，不计入。
    edge_dist = ndi.distance_transform_edt(opaque)
    edge_mask = residue_mask & (edge_dist <= EDGE_BAND)
    edge_residue = int(edge_mask.sum())
    # 陈世美白袍本身近白且贴着透明轮廓，统计时只看头部/肩以上
    assert_edge = (int(edge_mask[:ROBE_HEAD_END, :].sum())
                   if key == "chen" else edge_residue)

    # 四角透明、中心不透明
    corners = [int(alpha[0, 0]), int(alpha[0, -1]), int(alpha[-1, 0]), int(alpha[-1, -1])]
    corner_ok = all(c < 40 for c in corners)
    center = int(alpha[H // 2, W // 2])
    center_ok = center > 200
    require(corner_ok, f"{key}: 四角应透明，实际 {corners}")
    require(center_ok, f"{key}: 中心应不透明，实际 alpha={center}")

    # 孤立近白噪点：不透明、近白、面积 < 80px 的小连通块
    speck_seed = residue_mask & (mn >= 230) & (spread <= 30)
    lab, n = ndi.label(speck_seed)
    sizes = np.asarray(ndi.sum(np.ones_like(lab, dtype=np.int32), lab,
                               index=list(range(1, n + 1)))) if n else np.array([])
    specks = int((sizes < 80).sum()) if sizes.size else 0

    # 包拯鬓髯压暗后不得再显白（不挖洞，只验输出亮度）
    temple_ratios = []
    if key == "bao":
        for x0, x1, y0, y1 in TEMPLE_BANDS:
            sub = rgb[y0:y1, x0:x1].min(axis=2)
            op = alpha[y0:y1, x0:x1] > 40
            ratio = float((sub[op] >= 150).mean()) if op.any() else 0.0
            temple_ratios.append(round(ratio, 3))
            require(ratio <= MAX_TEMPLE_BRIGHT,
                    f"{key}: 鬓髯区显白像素占比 {ratio:.3f} > {MAX_TEMPLE_BRIGHT}")
        print(f"    包拯鬓髯区显白占比 = {temple_ratios}")

    # 陈世美白袍内部（裁切后坐标）不得被啃出透明洞
    robe_hole = 0
    if key == "chen":
        sub = alpha[360:640, 200:440]
        robe_hole = int((sub < 40).sum())
        require(robe_hole <= MAX_ROBE_HOLE,
                f"{key}: 白袍内部透明洞 {robe_hole} > {MAX_ROBE_HOLE}（白袍被啃穿）")

    if key == "qin":
        require(assert_edge <= MAX_EDGE_QIN,
                f"{key}: 边缘白边残留 {assert_edge} > {MAX_EDGE_QIN}")
        for name, (x0, x1, y0, y1) in QIN_REGIONS.items():
            y0c, y1c = max(0, y0 - TOP_TRIM), max(0, y1 - TOP_TRIM)
            if y1c <= y0c:
                continue
            cnt = int(residue_mask[y0c:y1c, x0:x1].sum())
            require(cnt <= MAX_REGION_RESIDUE,
                    f"{key}: 红圈「{name}」残留 {cnt} > {MAX_REGION_RESIDUE}")
            print(f"    红圈 {name}: alpha>40 近白 = {cnt}")
    elif key == "chen":
        require(assert_edge <= MAX_EDGE_ROBE_HEAD,
                f"{key}: 头部边缘白边残留 {assert_edge} > {MAX_EDGE_ROBE_HEAD}")
    else:
        require(assert_edge <= MAX_EDGE_OTHER,
                f"{key}: 边缘近白残留 {assert_edge} > {MAX_EDGE_OTHER}")

    # 深绿底放大图
    a = alpha.astype(np.float32) / 255.0
    bg = np.zeros((*alpha.shape, 3), dtype=np.float32)
    bg[:] = DARK_BG
    comp = (rgb * a[:, :, None] + bg * (1 - a[:, :, None])).clip(0, 255).astype(np.uint8)
    Image.fromarray(comp).resize((W, H * 2), Image.LANCZOS).save(ART / f"bust-{key}-check.png")

    print(f"{key:>9} {str(bust.shape[1]) + 'x' + str(bust.shape[0]):>12} "
          f"{edge_residue:>7} {residue:>7} {robe_hole:>10} "
          f"{str(corner_ok):>8} {str(center_ok):>7} {specks:>7}")

print()
if errors:
    print(f"FAILED: {len(errors)} 项")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
print("PASS: 近景立绘抠图验收通过（白边已去除、白袍无破洞、尺寸/透明正确）")
