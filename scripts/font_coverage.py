"""检查两款字体对本项目全部用字的覆盖情况（缺字会回退到朱雀仿宋）。"""
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(r"C:/Users/Administrator/WorkBuddy/baozha")
chars = set()
for path in list((root / "src").rglob("*.js")) + list((root / "src").rglob("*.jsx")):
    chars |= set(re.findall(r"[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]", path.read_text(encoding="utf-8")))
chars = sorted(chars)
print("项目用字总数:", len(chars))

fonts = {
    "LXGWZhenKai-HanOnly-Level1": root / "public/assets/fonts/LXGWZhenKai-HanOnly-Level1.ttf",
    "ZhuqueFangsong-Regular": root / "public/assets/fonts/ZhuqueFangsong-Regular.ttf",
    "ZhiMangXing-Regular": root / "public/assets/fonts/ZhiMangXing-Regular.ttf",
    "LongCang-Regular": root / "public/assets/fonts/LongCang-Regular.ttf",
}

def ink_of(font, ch):
    image = Image.new("L", (80, 80), 0)
    draw = ImageDraw.Draw(image)
    draw.text((5, 5), ch, font=font, fill=255)
    return sum(image.point(lambda v: 255 if v > 40 else 0).getdata())


for name, path in fonts.items():
    font = ImageFont.truetype(str(path), 48)
    missing_ink = ink_of(font, "\ue123")
    missing = [ch for ch in chars if ink_of(font, ch) == missing_ink]
    print(f"\n[{name}] 缺字数: {len(missing)}")
    if missing:
        print("  缺字:", "".join(missing))
