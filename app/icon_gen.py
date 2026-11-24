"""MEIRCHAT uygulama ikonu olusturucu (static/meirchat.ico ve .png)."""
import os
from PIL import Image, ImageDraw

def generate_meirchat_icons(base_dir: str = "."):
    static_dir = os.path.join(base_dir, "static")
    os.makedirs(static_dir, exist_ok=True)
    size = 256
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded dark square background with vibrant blue glow border
    draw.rounded_rectangle((8, 8, size - 9, size - 9), radius=54, fill=(10, 14, 24, 255), outline=(29, 123, 245, 255), width=10)
    # Inner subtle highlight ring
    draw.rounded_rectangle((22, 22, size - 23, size - 23), radius=42, outline=(59, 130, 246, 90), width=3)

    # Stylized bold geometric "M" monogram in bright white + blue accent spark
    m_pts = [
        (58, 188),
        (58, 68),
        (88, 68),
        (128, 126),
        (168, 68),
        (198, 68),
        (198, 188),
        (168, 188),
        (168, 114),
        (128, 168),
        (88, 114),
        (88, 188),
    ]
    draw.polygon(m_pts, fill=(255, 255, 255, 255))

    # Accent blue diamond dot above center V of M
    cx, cy, r = 128, 66, 13
    draw.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=(56, 189, 248, 255))

    png_path = os.path.join(static_dir, "meirchat.png")
    ico_path = os.path.join(static_dir, "meirchat.ico")
    img.save(png_path, "PNG")
    img.save(ico_path, format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
    return ico_path, png_path

if __name__ == "__main__":
    p1, p2 = generate_meirchat_icons(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    print("Icons generated:", p1, p2)
