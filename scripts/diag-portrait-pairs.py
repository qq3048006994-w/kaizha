"""诊断：把并排图的左右半脸部放大，判断朝向（哪半面朝画面中心）。"""
from PIL import Image, ImageDraw
from pathlib import Path

SRC = Path(r"C:/Users/Administrator/.workbuddy/clipboard-images")
OUT = Path(r"C:/Users/Administrator/WorkBuddy/baozha/test-artifacts")
files = [
    ("bao", "clipboard-2026-11-07T17-24-23-045Z-db4be4d4.jpg"),
    ("qin", "clipboard-2026-11-07T17-24-23-046Z-9c86061b.jpg"),
    ("chen", "clipboard-2026-11-07T17-24-23-047Z-9fe824ec.jpg"),
]
canvas = Image.new("RGB", (900, 3 * 420), "white")
d = ImageDraw.Draw(canvas)
for i, (name, fn) in enumerate(files):
    im = Image.open(SRC / fn).convert("RGB")
    w, h = im.size
    for side, box in [("L", (0, 0, w // 2, h)), ("R", (w // 2, 0, w, h))]:
        half = im.crop(box)
        # 头部区域：原图 y 60..520
        face = half.crop((int(half.width * 0.15), 60, int(half.width * 0.85), 520))
        face = face.resize((360, 380))
        x = 20 if side == "L" else 470
        y = i * 420 + 30
        canvas.paste(face, (x, y))
        d.text((x, y - 20), f"{name}-{side}", fill="black")
canvas.save(OUT / "portrait-faces.png")
print("saved", OUT / "portrait-faces.png")
