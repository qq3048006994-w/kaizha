from PIL import Image, ImageDraw, ImageFont

fonts = [
    ("Title(L2A Bold)", r"C:/Users/Administrator/WorkBuddy/baozha/public/assets/fonts/LXGWBoldKai-HanOnly-Level2A.ttf"),
    ("Text(L1)", r"C:/Users/Administrator/WorkBuddy/baozha/public/assets/fonts/LXGWZhenKai-HanOnly-Level1.ttf"),
    ("ZhuqueFangSong", r"C:/Users/Administrator/WorkBuddy/baozha/public/assets/fonts/ZhuqueFangsong-Regular.ttf"),
]
samples = {
    "titles": "鸣冤验刀对质御压终审正法昭彰抗旨权门蔽日悬案待雪",
    "names": "包拯秦香莲陈世美韩琪岚萍公主展昭公孙策",
    "ui": "证物卷宗人物记录设置开始审案继续案件跳过片头直接断案",
    "body": "秦香莲携儿女至开封府击鼓鸣冤包拯接状",
}

image = Image.new("RGB", (1500, 900), "#E9DFC6")
draw = ImageDraw.Draw(image)
y = 20
for label, path in fonts:
    draw.text((20, y), label, fill="#9D382D")
    y += 26
    for key, text in samples.items():
        font = ImageFont.truetype(path, 40)
        draw.text((30, y), text, font=font, fill="#171914")
        bbox = font.getbbox(text)
        draw.text((30, y + 52), f"{key}: 宽 {bbox[2]-bbox[0]}", fill="#74603D")
        y += 62
    y += 10
image.save(r"C:/Users/Administrator/WorkBuddy/baozha/test-artifacts/font-compare.png")
print("saved")
