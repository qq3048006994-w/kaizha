from pathlib import Path
from PIL import Image

assets = Path(r"C:/Users/Administrator/WorkBuddy/baozha/public/assets")
src = assets / "source"
chars = assets / "characters"
backgrounds = assets / "backgrounds"
logo = assets / "logo"

crops = {
    "chenshimei-full.png": ("clipboard-2026-11-07T09-42-19-958Z-722c3f9d.jpg", (180, 20, 1030, 1880)),
    "qinxianglian-full.png": ("clipboard-2026-11-07T09-42-19-962Z-2fcfbaba.jpg", (330, 30, 845, 1545)),
    "hanqi-full.png": ("clipboard-2026-11-07T09-42-19-964Z-498ea5f3.jpg", (180, 25, 770, 1575)),
    "baozheng-full.png": ("clipboard-2026-11-07T09-42-19-966Z-b7197c66.jpg", (95, 30, 825, 1550)),
    "princess-full.png": ("clipboard-2026-11-07T09-42-19-968Z-f253f039.jpg", (150, 25, 775, 1545)),
}
for output, (source, box) in crops.items():
    with Image.open(src / source) as image:
        image.crop(box).save(chars / output)

copies = {
    "court-empty.jpg": "clipboard-2026-11-07T09-42-19-964Z-1855f408.jpg",
    "court-gavel.jpg": "clipboard-2026-11-07T09-42-19-960Z-4bb82c73.jpg",
    "baozheng-study.jpg": "clipboard-2026-11-07T09-42-19-967Z-4cc1e97c.jpg",
}
for output, source in copies.items():
    with Image.open(src / source) as image:
        image.save(backgrounds / output, quality=94)

with Image.open(src / "clipboard-2026-11-07T09-42-19-959Z-79b915fc.jpg") as image:
    image = image.convert("RGBA")
    pixels = []
    for r, g, b, _ in image.getdata():
        alpha = max(255-r, 255-g, 255-b)
        alpha = 0 if alpha < 20 else min(255, int((alpha-20)*1.15))
        pixels.append((r, g, b, alpha))
    image.putdata(pixels)
    bbox = image.getbbox()
    image = image.crop(bbox)
    image.save(logo / "kaizha-calligraphy.png")
print("Prepared 5 character crops, 3 backgrounds and transparent title artwork.")
