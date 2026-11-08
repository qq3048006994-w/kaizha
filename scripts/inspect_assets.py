from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(r"C:/Users/Administrator/WorkBuddy/baozha/public/assets/source")
files = sorted(root.glob("clipboard-*"))
thumbs = []
for path in files:
    with Image.open(path) as image:
        print(path.name, image.size, image.mode)
        thumb = image.convert("RGB")
        thumb.thumbnail((240, 240))
        thumbs.append((path.name, thumb.copy()))
width = 800
height = ((len(thumbs) + 2) // 3) * 290
sheet = Image.new("RGB", (width, height), "#e9dfc6")
draw = ImageDraw.Draw(sheet)
for index, (name, thumb) in enumerate(thumbs):
    x = (index % 3) * 265 + 10
    y = (index // 3) * 290 + 10
    sheet.paste(thumb, (x, y))
    draw.text((x, y + 245), name.replace("clipboard-2026-11-07T09-42-19-", ""), fill="#171914")
sheet.save(root.parent / "source-contact.jpg", quality=90)
