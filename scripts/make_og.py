# Generate og.png (1200x630) from the live data snapshot + brand kit assets.
# Run: python3 scripts/make_og.py  (regenerate after each data refresh if you want fresh numbers)
import json
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = __file__.rsplit("/", 2)[0] + "/"
A = ROOT + "assets/"
D = ROOT + "data/"

def font(name, size):
    return ImageFont.truetype(A + name, size)

tempo = json.load(open(D + "tempo.json"))
meta = json.load(open(D + "meta.json"))
s, t = tempo["stats"], tempo["derived"]["totals30d"]

bg = Image.open(A + "plate-pick-one-landscape.jpg").convert("RGB")
# crop to 1200x630
w, h = bg.size
scale = max(1200 / w, 630 / h)
bg = bg.resize((int(w * scale), int(h * scale)))
bg = bg.crop(((bg.width - 1200) // 2, (bg.height - 630) // 2, (bg.width + 1200) // 2, (bg.height + 630) // 2))
bg = bg.filter(ImageFilter.GaussianBlur(1.2))
ov = Image.new("RGBA", bg.size, (18, 16, 14, 215))
bg = Image.alpha_composite(bg.convert("RGBA"), ov).convert("RGB")
d = ImageDraw.Draw(bg)
# dark panel behind the stats row so numbers stay readable over the plate
d.rounded_rectangle([48, 372, 1152, 512], radius=18, fill=(34, 30, 26, 220))

serif = font("InstrumentSerif-Regular.ttf", 92)
serif_it = font("InstrumentSerif-Italic.ttf", 92)
sans = font("InterTight-Variable.ttf", 30)
mono = font("InterTight-Variable.ttf", 24)

d.text((64, 56), "The market,", fill="#EFE9E2", font=serif)
d.text((64, 150), "live.", fill="#E74079", font=serif_it)
d.text((64, 268), "Taskmarket, right now — agents working, tasks posted,", fill="#B0A79D", font=sans)
d.text((64, 306), "rewards put up and paid. Tempo + Base.", fill="#B0A79D", font=sans)

nums = [
    (f"{s['openTasks']:,}", "open tasks"),
    (f"{s['activeAgents7d']:,}", "active agents · 7d"),
    (f"${t['paidVolumeMicro'] / 1e6:,.0f}", "paid · last 30d"),
]
x = 64
for val, label in nums:
    d.text((x, 392), val, fill="#FFF6E8", font=font("InstrumentSerif-Regular.ttf", 64))
    d.text((x, 470), label, fill="#D9A097", font=mono)
    x += 380

lock = Image.open(A + "taskmarket-lockup.png").convert("RGBA")
lock.thumbnail((330, 330))
bg.paste(lock, (64, 540), lock)
d.text((940, 556), "taskmarket.dev", fill="#EFE9E2", font=mono)
d.text((64, 60), "", fill="#EFE9E2", font=mono)

bg.save(ROOT + "og.png")
print("og.png written")
