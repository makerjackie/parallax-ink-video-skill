#!/usr/bin/env python3
"""Split one or more illustrated subjects into genuinely different drawing roles.

This is a deterministic colour/edge decomposition of an already illustrated source.
It does not pretend to infer anatomical masks from an arbitrary photograph.
"""
from __future__ import annotations

import argparse
import json
import random
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/art-contact-sheet-v2.png"
OUT = ROOT / "assets/v2-layers"
PORTRAITS = [
    ("liang-wenfeng", "梁文锋", "Liang Wenfeng", 0, 0),
    ("elon-musk", "埃隆·马斯克", "Elon Musk", 1, 0),
    ("sam-altman", "山姆·奥特曼", "Sam Altman", 0, 1),
    ("dario-amodei", "达里奥·阿莫迪", "Dario Amodei", 1, 1),
    ("jensen-huang", "黄仁勋", "Jensen Huang", 0, 2),
]
ROLES = [
    ("construction", -0.56, "loose layout and exploratory marks"),
    ("cool-shadow", -0.30, "indigo and cyan shade"),
    ("warm-gesture", -0.12, "orange gestures and warm accents"),
    ("pigment", 0.10, "selective coloured facial and clothing pigment"),
    ("graphite", 0.35, "deep charcoal texture"),
    ("features", 0.62, "sharp eyes, hair, glasses and edge details"),
]


def save_layer(rgb: np.ndarray, alpha: np.ndarray, path: Path) -> None:
    rgba = np.dstack([rgb, np.uint8(np.clip(alpha * 255, 0, 255))])
    Image.fromarray(rgba, "RGBA").save(path, optimize=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--art", nargs="+", type=Path, help="one or more already illustrated images; raw photos require an art stage first")
    ap.add_argument("--names", nargs="+", help="display names in the same order as --art")
    ap.add_argument("--out-dir", type=Path, default=OUT, help="layer directory inside this work-v2 project")
    ap.add_argument("--size", type=int, default=512, choices=[512,768,1024], help="texture resolution; 768 helps retain fine fur and whiskers")
    ap.add_argument("--subject-kind", choices=["person","animal","object"], default="person")
    args = ap.parse_args()
    size = args.size
    out_dir = args.out_dir.resolve()
    if not out_dir.is_relative_to(ROOT):
        ap.error("--out-dir must be inside the work-v2 project")
    if args.names and (not args.art or len(args.names) != len(args.art)):
        ap.error("--names must match --art")
    if args.art and not 1 <= len(args.art) <= 8:
        ap.error("provide 1–8 illustrated images")
    out_dir.mkdir(parents=True, exist_ok=True)
    if args.art:
        specs = []
        for i, path in enumerate(args.art):
            slug = re.sub(r"[^a-z0-9-]+", "-", path.stem.lower()).strip("-") or f"subject-{i+1:02}"
            name = args.names[i] if args.names else path.stem
            specs.append((slug, name, name, path))
        source_note = "user-provided illustrated images"
    else:
        sheet = Image.open(SOURCE).convert("RGB")
        assert sheet.size == (1024, 1536), sheet.size
        specs = [(slug, zh, en, sheet.crop((col * 512, row * 512, (col + 1) * 512, (row + 1) * 512))) for slug, zh, en, col, row in PORTRAITS]
        source_note = str(SOURCE.relative_to(ROOT))
    manifest = {"source": source_note, "method": "colour and edge role decomposition of an illustrated source; not automatic anatomical segmentation", "subjectKind": args.subject_kind, "textureSize": size, "portraits": []}
    for index, (slug, zh, en, source) in enumerate(specs):
        folder = out_dir / slug
        folder.mkdir(exist_ok=True)
        original = Image.open(source).convert("RGB") if isinstance(source, Path) else source
        crop = ImageOps.fit(original, (size, size), Image.Resampling.LANCZOS)
        crop.save(folder / "art.png", optimize=True)
        rgb = np.asarray(crop).astype(np.float32)
        r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
        lum = .299 * r + .587 * g + .114 * b
        # The source has warm paper, not a flat white background. Alpha is
        # derived from difference to that paper so planes never become cards.
        paper = np.array([251., 243., 228.], np.float32)
        delta = np.sqrt(np.sum(((rgb - paper) * np.array([.75, 1., .85])) ** 2, axis=2))
        amount = np.clip((delta - 12.) / 90., 0, 1) ** .72
        amount = np.maximum(amount, np.clip((225 - lum) / 150., 0, 1) * .72)
        yy, xx = np.mgrid[0:size, 0:size] * (512.0 / size)
        face = ((xx - 256) / 154) ** 2 + ((yy - 220) / 198) ** 2 < 1
        if args.subject_kind == "animal":
            face = ((xx - 256) / 222) ** 2 + ((yy - 245) / 258) ** 2 < 1
        elif args.subject_kind == "object":
            face = np.ones((size,size), dtype=bool)
        shoulder = yy > 335
        blue = (b > r * 1.10) & (b > g * 1.045) & (b > 66)
        cyan = (b > r * 1.09) & (g > r * 1.035) & (b > 76)
        cool = blue | cyan
        warm = (r > b * 1.20) & (r > g * 1.12) & (b < 185)
        # Warm skin wash is separate from the hot exterior gesture strokes.
        skin = warm & face & (lum > 145)
        orange = warm & ~skin
        edge = np.asarray(crop.convert("L").filter(ImageFilter.FIND_EDGES)).astype(np.float32)
        features = (lum < 118) & (edge > 35) & (face | shoulder) & ~cool & ~orange
        if args.subject_kind == "animal":
            # Dense fur edges must stay together. Classifying every hair as a
            # feature creates checkerboard alpha gaps when texture mipmaps shrink.
            features = (lum < 86) & (edge > 68) & (yy > 80) & (yy < 325) & ~cool & ~orange
        graphite = (lum < (185 if args.subject_kind == "animal" else 162)) & ~features & ~cool & ~orange
        pigment = (skin | ((lum < 220) & (face | shoulder) & ~cool & ~orange & ~graphite & ~features))
        construction = ~(cool | orange | graphite | features | pigment)
        masks = [construction, cool, orange, pigment, graphite, features]
        boosts = [.80, 1.18 if args.subject_kind == "animal" else 1.08, 1.23 if args.subject_kind == "animal" else 1.13, 1.12 if args.subject_kind != "person" else .63, .95, 1.18]
        entries = []
        for (role, depth, description), mask, boost in zip(ROLES, masks, boosts):
            alpha = amount * mask.astype(np.float32) * boost
            if role == "construction":
                alpha *= np.where(face, .38, .73)
            if role == "pigment":
                alpha *= np.where(face, .95 if args.subject_kind != "person" else .85, .42)
            out = folder / f"{role}.png"
            save_layer(np.uint8(rgb), alpha, out)
            entries.append({"semanticRole": role, "depth": depth, "file": str(out.relative_to(ROOT)), "description": description, "nonzeroPixels": int(np.count_nonzero(alpha > .05))})
        # Connector strokes have no face silhouette. Two crossing directional
        # bundles make the in-between camera path visibly occupy a space.
        rand = random.Random(13091 + index * 97)
        field = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
        draw = ImageDraw.Draw(field, "RGBA")
        for family, count in [("warm", 66), ("cool", 66), ("graphite", 24)]:
            for _ in range(count):
                offset = rand.uniform(-370, 370)
                if family == "warm":
                    x0, y0 = -90 + offset, 1130 + rand.uniform(-100, 100)
                    vx, vy = 1060 + rand.uniform(-190, 140), -1180 + rand.uniform(-140, 190)
                    color = rand.choice([(216, 91, 40), (229, 112, 51), (178, 71, 42)])
                elif family == "cool":
                    x0, y0 = 1130 + offset, -100 + rand.uniform(-100, 100)
                    vx, vy = -1130 + rand.uniform(-170, 180), 1180 + rand.uniform(-160, 180)
                    color = rand.choice([(42, 74, 143), (61, 109, 164), (61, 145, 164)])
                else:
                    x0, y0 = rand.uniform(-100, 1000), rand.uniform(-100, 1100)
                    vx, vy = rand.uniform(-600, 600), rand.uniform(-600, 600)
                    color = (48, 45, 49)
                length = rand.uniform(.24, .82)
                points = []
                for step in range(5):
                    t = step * length / 4
                    points.append((x0 + vx*t + rand.uniform(-20, 20), y0 + vy*t + rand.uniform(-20, 20)))
                draw.line(points, fill=(*color, rand.randint(35, 105)), width=rand.choice([1, 2, 3, 4]), joint="curve")
        bridge = folder / "bridge.png"
        field.resize((512, 512), Image.Resampling.LANCZOS).save(bridge, optimize=True)
        manifest["portraits"].append({"id": slug, "name": zh, "en": en, "source": str((folder / "art.png").relative_to(ROOT)), "layers": entries, "bridge": str(bridge.relative_to(ROOT))})
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"Wrote {len(specs)} portraits and {len(specs) * len(ROLES)} semantic PNG layers to {out_dir}")


if __name__ == "__main__":
    main()
