from pathlib import Path
from PIL import Image, ImageDraw

assets = Path(r"C:/Users/Administrator/WorkBuddy/baozha/public/assets")
chars = assets / "characters"
portraits = assets / "portraits"
names = ["baozheng", "qinxianglian", "chenshimei", "hanqi", "princess"]
contact = Image.new("RGB", (1500, 720), "#14271f")
draw = ImageDraw.Draw(contact)
for index, name in enumerate(names):
    path = chars / f"{name}.png"
    with Image.open(path) as source:
        image = source.convert("RGBA")
        bbox = image.getbbox()
        if bbox:
            image = image.crop(bbox)
        image.save(chars / f"{name}.png", optimize=True)
        thumb = image.copy()
        thumb.thumbnail((285, 650))
        x = index * 300 + (300-thumb.width)//2
        contact.paste(thumb, (x, 40), thumb)
        draw.text((index*300+20, 695), name, fill="#e9dfc6")
        w, h = image.size
        portrait = image.crop((0, 0, w, int(h*0.34)))
        portrait.save(portraits / f"{name}.png", optimize=True)
contact.save(assets / "character-contact.jpg", quality=92)
print("Trimmed transparent sprites and generated portraits.")
