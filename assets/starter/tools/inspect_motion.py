#!/usr/bin/env python3
"""Render a time-labelled contact sheet from actual deterministic scene frames."""
import argparse,asyncio,base64,json
from pathlib import Path
from PIL import Image,ImageDraw
from playwright.async_api import async_playwright
FLAGS=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
async def run(a):
 out=a.out;out.mkdir(parents=True,exist_ok=True)
 text=a.html.read_text().replace('<head>','<head><script>window.INK_RENDER_PARAMS="render=1&w=360&h=640";</script>',1)
 frames=[];cameras=[]
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True,args=FLAGS);page=await b.new_page(viewport={'width':360,'height':640})
  await page.set_content(text,wait_until='load');await page.wait_for_function('window.__ready||window.__error')
  error=await page.evaluate('window.__error||null');assert not error,error
  for t in a.times:
   r=await page.evaluate('(t)=>{window.__renderAt(t);return {camera:window.__lastFrame,png:document.getElementById("art").toDataURL("image/png").split(",")[1]}}',t)
   path=out/f'{t:06.2f}.png';path.write_bytes(base64.b64decode(r['png']));cameras.append(r['camera']);frames.append(path)
  (out/'camera.json').write_text(json.dumps(cameras,indent=2));await b.close()
 w,h=216,384;sheet=Image.new('RGB',(w*a.columns,(h+25)*((len(frames)+a.columns-1)//a.columns)),(235,229,219));d=ImageDraw.Draw(sheet)
 for i,(t,path) in enumerate(zip(a.times,frames)):
  x=i%a.columns*w;y=i//a.columns*(h+25);sheet.paste(Image.open(path).resize((w,h)),(x,y));d.text((x+8,y+h+6),f'{t:.2f}s',fill=(30,30,30))
 sheet.save(out/'contact.jpg',quality=90);print(out/'contact.jpg')
p=argparse.ArgumentParser();p.add_argument('--html',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--times',nargs='+',type=float,required=True);p.add_argument('--columns',type=int,default=6);asyncio.run(run(p.parse_args()))
