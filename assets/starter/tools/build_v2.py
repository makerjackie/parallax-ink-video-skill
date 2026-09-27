#!/usr/bin/env python3
"""Bundle semantic 3D artwork, optional motion studies and score into one offline HTML."""
from __future__ import annotations
import argparse
import base64
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def validate_scene(scene: dict, count: int) -> None:
    """Fail before rendering malformed optional art-direction coordinates."""
    if not isinstance(scene, dict):
        raise ValueError("scene must be a JSON object")
    if scene.get("motionVariant") not in (None,"fold","dive","cube","bloom"):
        raise ValueError("motionVariant must be fold, dive, cube or bloom")
    if scene.get("motionVariant") and any(key in scene for key in ("families","accents","ending")):
        raise ValueError("motion variants define their own families, accents and ending; omit original-path overrides")
    if scene.get("motionVariant")=="cube" and count>5:
        raise ValueError("the orthogonal room supports at most five subjects")
    def vector(value, size, label):
        if not isinstance(value, list) or len(value) != size or not all(isinstance(x,(int,float)) and math.isfinite(x) for x in value):
            raise ValueError(f"{label} must contain {size} finite numbers")
    if "families" in scene:
        if len(scene["families"]) != count:
            raise ValueError("scene families must match the number of subjects")
        for item in scene["families"]:
            vector(item.get("center"),3,"family center")
            vector([item.get("yaw"),item.get("size")],2,"family yaw/size")
            if item["size"] <= 0:
                raise ValueError("family size must be positive")
    if "accents" in scene:
        if len(scene["accents"]) != count:
            raise ValueError("scene accents must match the number of subjects")
        for item in scene["accents"]:
            if "focus" in item: vector(item["focus"],2,"accent focus")
            vector([item.get("lift",0),item.get("bank",0)],2,"accent lift/bank")
    if "ending" in scene:
        if len(scene["ending"]) != 3:
            raise ValueError("ending needs three camera poses")
        for item in scene["ending"]:
            if set(item) - {"eye","target","roll"}:
                raise ValueError("ending accepts only eye, target and roll")
            vector(item.get("eye"),3,"ending eye")
            vector(item.get("target"),3,"ending target")
            vector([item.get("roll",0)],1,"ending roll")
            if item["eye"] == item["target"]:
                raise ValueError("ending eye and target must differ")
    opacity=scene.get("bridgeOpacity",1)
    if not isinstance(opacity,(int,float)) or not 0 <= opacity <= 1:
        raise ValueError("bridgeOpacity must be between 0 and 1")
    hold=scene.get("alignedHoldSeconds",0)
    if isinstance(hold,bool) or not isinstance(hold,(int,float)) or not math.isfinite(hold) or hold < 0:
        raise ValueError("alignedHoldSeconds must be a finite non-negative number")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["preview", "full", "generic"], default="preview")
    ap.add_argument("--manifest", type=Path, default=ROOT / "assets/v2-layers/manifest.json")
    ap.add_argument("--out", type=Path)
    ap.add_argument("--block-seconds", type=float, default=3.5)
    ap.add_argument("--duration", type=float)
    ap.add_argument("--arrivals", nargs="+", type=float, help="measured music transient times for each portrait arrival, starting at zero")
    ap.add_argument("--audio", type=Path, required=True)
    ap.add_argument("--scene", type=Path, help="optional layout, camera accents, thread and closing text JSON")
    args = ap.parse_args()
    manifest = json.loads(args.manifest.read_text())
    portraits = []
    selected = manifest["portraits"][:3] if args.mode == "preview" else manifest["portraits"]
    for p in selected:
        layers = []
        for l in p["layers"]:
            payload = base64.b64encode((ROOT / l["file"]).read_bytes()).decode("ascii")
            layers.append({"role": l["semanticRole"], "depth": l["depth"], "image": "data:image/png;base64," + payload})
        bridge = "data:image/png;base64," + base64.b64encode((ROOT / p["bridge"]).read_bytes()).decode("ascii")
        portraits.append({"id": p["id"], "name": p["name"], "en": p["en"], "layers": layers, "bridge": bridge})
    audio = "data:audio/mpeg;base64," + base64.b64encode(args.audio.read_bytes()).decode("ascii")
    if args.mode == "preview" and len(portraits) < 3:
        ap.error("preview camera path needs at least three portraits; use --mode generic")
    if args.mode == "full" and len(portraits) != 5:
        ap.error("full demo camera path needs five portraits; use --mode generic")
    arrivals = args.arrivals or [i*args.block_seconds for i in range(len(portraits))]
    if len(arrivals) != len(portraits) or arrivals[0] != 0 or any(b-a < 2 for a,b in zip(arrivals,arrivals[1:])):
        ap.error("arrivals must start at zero and give each subject >=2 seconds")
    duration = args.duration or arrivals[-1]+args.block_seconds+1.34
    if args.block_seconds < 2 or duration <= arrivals[-1]+args.block_seconds:
        ap.error("block-seconds must be >= 2 and duration must include the final overview")
    scene = json.loads(args.scene.read_text()) if args.scene else {}
    if isinstance(scene,dict) and scene.get("motionVariant"):
        scene.setdefault("alignedHoldSeconds",1.2)
    try:
        validate_scene(scene,len(portraits))
        spans=[b-a for a,b in zip(arrivals,arrivals[1:])]+[args.block_seconds]
        if scene.get("alignedHoldSeconds",0) > min(spans)*.45:
            raise ValueError("alignedHoldSeconds must leave at least 55% of each subject interval for travel")
    except (ValueError,TypeError,AttributeError) as exc:
        ap.error(str(exc))
    data = {"version": "3.2.0", "mode": args.mode, "blockSeconds": args.block_seconds, "arrivals": arrivals, "duration": duration, "portraits": portraits, "audio": audio, "scene": scene}
    html = (ROOT / "src/v2.html").read_text()
    html = html.replace("/*__DATA__*/", json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c"))
    html = html.replace("/*__ENGINE__*/", (ROOT / "src/motion_variants.js").read_text()+"\n"+(ROOT / "src/v2.js").read_text())
    out = args.out or ROOT / "output" / f"parallax-ink-v3-{args.mode}.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print(f"{out} · {len(portraits)} portraits / {sum(len(p['layers']) for p in portraits)} semantic layers · {out.stat().st_size/1e6:.1f} MB")

if __name__ == "__main__":
    main()
