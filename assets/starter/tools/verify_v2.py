#!/usr/bin/env python3
"""Browser checks that exercise rendered pixels, fixed geometry and offline UI."""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
FLAGS = ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]


async def verify(html: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    external_requests = []
    errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=FLAGS)
        page = await browser.new_page(viewport={"width": 540, "height": 960}, device_scale_factor=1)
        page.on("request", lambda req: external_requests.append(req.url) if req.url.startswith(("http://", "https://")) else None)
        page.on("pageerror", lambda err: errors.append(str(err)))
        await page.goto(html.resolve().as_uri(), wait_until="load", timeout=120000)
        await page.wait_for_function("window.__ready || window.__error", timeout=120000)
        error = await page.evaluate("window.__error || null")
        if error:
            raise RuntimeError(error)
        if errors or external_requests:
            raise RuntimeError({"pageErrors": errors, "externalRequests": external_requests})
        duration = await page.evaluate("window.__getDuration()")
        statistics = await page.evaluate("window.__statistics")
        animated_surfaces = statistics.get("animatedSurfaces",False)
        if statistics.get("motionVariant","original") != "original":
            motion_a = await page.evaluate("window.__motionSnapshot(0)")
            motion_b = await page.evaluate("window.__motionSnapshot(2.3)")
            assert (motion_a != motion_b) == animated_surfaces, "motion mode does not match actual surface transforms"
        alignment_holds = []
        hold_config = await page.evaluate("({hold:INK_V2_DATA.scene?.alignedHoldSeconds||0,arrivals:INK_V2_DATA.arrivals})")
        if hold_config["hold"]:
            for arrival in hold_config["arrivals"]:
                samples = []
                for fraction in (.05,.35,.65,.95):
                    sample = await page.evaluate("t=>{window.__renderAt(t);return {eye:__lastFrame.eye,target:__lastFrame.target,pixels:document.getElementById('art').toDataURL('image/png')}}", arrival+hold_config["hold"]*fraction)
                    samples.append(sample)
                drift = max(abs(a-b) for sample in samples[1:] for field in ("eye","target") for a,b in zip(samples[0][field],sample[field]))
                assert drift < 1e-10, "camera drifted during calibrated alignment hold"
                assert all(sample["pixels"] == samples[0]["pixels"] for sample in samples), "layers shifted during calibrated alignment hold"
                alignment_holds.append({"start":arrival,"seconds":hold_config["hold"],"identicalPixels":True,"maxCameraDrift":drift})
        test_time = min(6.8, duration * .45)
        seek_time = min(8, duration * .7)
        scene_before = await page.evaluate("window.__sceneSnapshot()")
        await page.evaluate("(t)=>window.__renderAt(t)", test_time)
        first = await page.evaluate("document.getElementById('art').toDataURL('image/png')")
        await page.evaluate("(t)=>window.__renderAt(t)", test_time)
        second = await page.evaluate("document.getElementById('art').toDataURL('image/png')")
        assert first == second, "same-time render differs"
        await page.evaluate("window.__setLayerVisibility('cool-shadow')")
        isolated = await page.evaluate("document.getElementById('art').toDataURL('image/png')")
        assert first != isolated, "semantic role toggle had no visible effect"
        await page.locator("#art").screenshot(path=str(out / "isolated-cool-shadow.png"))
        await page.evaluate("(t)=>{window.__setLayerVisibility(null);window.__setDebug(true);window.__renderAt(t)}", min(4.7,duration*.3))
        await page.locator("#art").screenshot(path=str(out / "shared-space-debug.png"))
        scene_after = await page.evaluate("window.__sceneSnapshot()")
        assert scene_before == scene_after, "base mesh geometry changed with time"
        await page.evaluate("window.__setDebug(false);window.__renderAt(0)")
        await page.locator("#play").click()
        await page.wait_for_function("window.__lastFrame.time > .15", timeout=15000)
        played = await page.evaluate("window.__lastFrame.time")
        await page.locator("#play").click()
        assert played > 0.1, "play control did not advance"
        await page.locator("#seek").evaluate("(e,t)=>{e.value=String(t);e.dispatchEvent(new Event('input',{bubbles:true}))}", seek_time)
        sought = await page.evaluate("window.__lastFrame.time")
        assert abs(sought - seek_time) < .02, "seek control did not reach the requested time"
        before = await page.evaluate("window.__lastFrame.eye")
        box = await page.locator("#art").bounding_box()
        x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x + 58, y + 18, steps=5)
        await page.mouse.up()
        moved = await page.evaluate("window.__lastFrame.eye")
        assert before != moved, "drag did not change camera position"
        await page.mouse.dblclick(x, y)
        reset = await page.evaluate("window.__lastFrame.eye")
        assert reset == before, "double-click did not reset film view"
        result = {
            "html": str(html.resolve()), "htmlSha256": hashlib.sha256(html.read_bytes()).hexdigest(),
            "renderer": await page.evaluate("window.__statistics"), "sceneObjects": len(scene_before["objects"]),
            "fixedBaseGeometry": True, "fixedWorldGeometry": not animated_surfaces, "animatedSurfaceTransforms": animated_surfaces, "deterministicSameTimePixels": True, "semanticRoleToggleChangesPixels": True,
            "playAdvancedToSeconds": played, "seekSeconds": sought, "dragChangedEye": True, "doubleClickRestoredEye": True,
            "externalRequests": external_requests, "pageErrors": errors, "screenshots": ["isolated-cool-shadow.png", "shared-space-debug.png"],
            "alignmentHolds": alignment_holds,
        }
        (out / "browser-qa.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
        await browser.close()
        print(json.dumps(result, ensure_ascii=False, indent=2))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", type=Path, default=ROOT / "output/parallax-ink-v2-preview.html")
    ap.add_argument("--out", type=Path, default=ROOT / "qa")
    args = ap.parse_args()
    asyncio.run(verify(args.html, args.out))


if __name__ == "__main__":
    main()
