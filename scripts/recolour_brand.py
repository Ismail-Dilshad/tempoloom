"""Recolours Tempoloom's brand files from the old teal and coral palette to the blue one.

Text files (SVG, CSS, JSON, HTML, webmanifest) get their hex values swapped. PNG and ICO files are
remapped pixel by pixel: each pixel is matched to the nearest old colour, or to a blend of two old
colours (anti-aliased edges), and redrawn with the same blend of the new colours, so the shapes and
edges stay exactly as drawn. Pixels far from every brand colour (photos, other art) are left alone.

Run: python3 scripts/recolour_brand.py [--check]
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Old hex -> new hex. White and near-black stay.
PALETTE = {
    "#0B3B3C": "#0B1F4A",  # dark teal -> deep navy
    "#082D2E": "#081738",
    "#0F4749": "#12296A",
    "#071F20": "#050F26",
    "#FF6B4A": "#4C8DFF",  # coral -> brand blue
    "#FFF1D6": "#EAF1FF",  # cream -> pale blue-white
    "#F2DDB3": "#C9DBFF",  # sand tints -> light blue tints
    "#E6CE9C": "#A9C6FF",
    "#5BB8C4": "#7FB2FF",
}
KEEP = ["#FFFFFF", "#111111", "#000000"]

TARGETS = [ROOT / "assets/brand/logo", ROOT / "assets/brand/expressions", ROOT / "assets/brand/icons",
           ROOT / "assets/brand/social", ROOT / "assets/brand/web", ROOT / "agent/status"]
TEXT = {".svg", ".css", ".json", ".html", ".webmanifest"}


def recolour_text(path: Path) -> bool:
    src = path.read_text(encoding="utf-8")
    out = src
    for old, new in PALETTE.items():
        out = re.sub(re.escape(old), new, out, flags=re.IGNORECASE)
    if out != src:
        path.write_text(out, encoding="utf-8")
        return True
    return False


def rgb(h: str):
    return [int(h[i:i + 2], 16) for i in (1, 3, 5)]


def remap(img):
    import numpy as np
    arr = np.asarray(img.convert("RGBA")).astype(np.float32)
    px = arr[..., :3].reshape(-1, 3)
    olds = np.array([rgb(o) for o in PALETTE] + [rgb(k) for k in KEEP], dtype=np.float32)
    news = np.array([rgb(n) for n in PALETTE.values()] + [rgb(k) for k in KEEP], dtype=np.float32)
    best_err = np.full(len(px), np.inf, dtype=np.float32)
    best_val = px.copy()
    n = len(olds)
    for i in range(n):
        for j in range(i, n):
            a, b = olds[i], olds[j]
            d = b - a
            dd = float(d @ d)
            t = np.zeros(len(px), dtype=np.float32) if dd == 0 else np.clip(((px - a) @ d) / dd, 0, 1)
            proj = a + t[:, None] * d
            err = np.linalg.norm(px - proj, axis=1)
            val = news[i] + t[:, None] * (news[j] - news[i])
            better = err < best_err
            best_err[better] = err[better]
            best_val[better] = val[better]
    touch = best_err < 14  # a brand colour or a blend of two
    px[touch] = best_val[touch]
    arr[..., :3] = px.reshape(arr.shape[:2] + (3,))
    from PIL import Image
    return Image.fromarray(np.clip(arr + 0.5, 0, 255).astype(np.uint8), "RGBA"), int(touch.sum())


def recolour_image(path: Path) -> bool:
    from PIL import Image
    with Image.open(path) as im:
        if path.suffix == ".ico":
            sizes = sorted({s for s in im.info.get("sizes", {(im.width, im.height)})})
            frames = []
            for s in sizes:
                im.size = s
                frames.append(remap(im.copy().convert("RGBA"))[0])
            big = max(frames, key=lambda f: f.width)
            big.save(path, format="ICO", sizes=sizes)
            return True
        mode = im.mode
        out, touched = remap(im)
    if not touched:
        return False
    if mode in ("RGB", "P", "L"):
        out = out.convert("RGB")
    out.save(path, optimize=True)
    return True


def old_left() -> list[str]:
    bad = []
    pat = re.compile("|".join(re.escape(o) for o in PALETTE), re.IGNORECASE)
    for base in TARGETS:
        for p in base.rglob("*"):
            if p.suffix in TEXT and pat.search(p.read_text(encoding="utf-8", errors="ignore")):
                bad.append(str(p.relative_to(ROOT)))
    return bad


def main() -> int:
    if "--check" in sys.argv:
        bad = old_left()
        print("\n".join(bad) or "Brand files use only the blue palette.")
        return 1 if bad else 0
    changed = 0
    for base in TARGETS:
        for p in sorted(base.rglob("*")):
            if not p.is_file():
                continue
            if p.suffix in TEXT:
                changed += recolour_text(p)
            elif p.suffix in (".png", ".ico"):
                changed += recolour_image(p)
    print(f"Recoloured {changed} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
