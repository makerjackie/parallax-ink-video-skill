#!/usr/bin/env python3
"""Deterministic offline MP4 export: explicit __renderAt(frame/fps), not screen recording."""
from __future__ import annotations
import argparse,asyncio,base64,hashlib,json,shutil,subprocess,time
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
FLAGS=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
async def run(a):
 if not shutil.which('ffmpeg'):raise RuntimeError('ffmpeg is required on PATH.')
 if not a.html.is_file():raise FileNotFoundError(a.html)
 if not a.audio.is_file():raise FileNotFoundError(a.audio)
 a.output.parent.mkdir(parents=True,exist_ok=True)
 frames=a.output.parent/(a.output.stem+'-frames');frames.mkdir(exist_ok=True)
 text=a.html.read_text();params=f'render=1&w={a.width}&h={a.height}'
 text=text.replace('<head>','<head><script>window.INK_RENDER_PARAMS='+json.dumps(params)+';</script>',1)
 begin=time.time();completed=0;runtime_errors=[]
 async with async_playwright() as p:
  exe=a.chromium or shutil.which('chromium') or shutil.which('google-chrome');launch={'headless':True,'args':FLAGS}
  if exe:launch['executable_path']=exe
  probe=await p.chromium.launch(**launch);page=await probe.new_page(viewport={'width':a.width,'height':a.height},device_scale_factor=1)
  await page.set_content(text,wait_until='load',timeout=120000);await page.wait_for_function('window.__ready || window.__error',timeout=120000)
  error=await page.evaluate('window.__error || null')
  if error:raise RuntimeError(error)
  natural_duration=await page.evaluate('window.__getDuration()');duration=a.seconds or natural_duration
  if duration<=0 or duration>natural_duration:raise ValueError('--seconds must be positive and no longer than the artwork.')
  stats=await page.evaluate('window.__statistics');still_intervals=await page.evaluate('window.__constantIntervals || []');await probe.close()
  count=round(duration*a.fps);settings={'html_sha256':hashlib.sha256(a.html.read_bytes()).hexdigest(),'width':a.width,'height':a.height,'fps':a.fps,'frames':count};cache=frames/'render-settings.json'
  if a.resume and any(frames.glob('*.jpg')) and (not cache.exists() or json.loads(cache.read_text())!=settings):raise RuntimeError('Resume refused: existing frames belong to different or unknown render settings. Render again without --resume.')
  cache.write_text(json.dumps(settings,indent=2))
  print(f'Rendering {count} frames at {a.width}x{a.height}, {a.fps} fps; {stats["renderer"]}',flush=True)
  async def worker(worker_id):
   nonlocal completed
   browser=await p.chromium.launch(**launch);page=await browser.new_page(viewport={'width':a.width,'height':a.height},device_scale_factor=1)
   page.on('pageerror',lambda e:runtime_errors.append(str(e)))
   await page.set_content(text,wait_until='load',timeout=120000);await page.wait_for_function('window.__ready',timeout=120000)
   still_cache={}
   for frame in range(worker_id,count,a.jobs):
    out=frames/f'{frame:06d}.jpg'
    still=next((i for i,v in enumerate(still_intervals) if v['start']<=frame/a.fps<=v['end']),None)
    if not (a.resume and out.is_file()):
     if still is not None and still in still_cache:shutil.copyfile(still_cache[still],out)
     else:
      data=await page.evaluate('(t)=>{window.__renderAt(t);return document.getElementById("art").toDataURL("image/jpeg",.96).split(",")[1]}',frame/a.fps)
      out.write_bytes(base64.b64decode(data))
    if still is not None:still_cache[still]=out
    completed+=1
    if completed%90==0 or completed==count:print(f'{completed}/{count} frames · {time.time()-begin:.1f}s',flush=True)
   await browser.close()
  await asyncio.gather(*(worker(i) for i in range(a.jobs)))
  if runtime_errors:raise RuntimeError('Browser errors: '+str(runtime_errors))
 if any(not (frames/f'{i:06d}.jpg').is_file() for i in range(count)):raise RuntimeError('Missing frames.')
 subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-framerate',str(a.fps),'-i',str(frames/'%06d.jpg'),'-i',str(a.audio),'-map','0:v:0','-map','1:a:0','-t',str(duration),'-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-threads','4','-c:a','aac','-b:a','192k','-movflags','+faststart','-metadata','title=Parallax Ink — Another Point of View','-metadata','artist=MakerJackie',str(a.output)],check=True)
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(a.output)]))
 report={'html_sha256':hashlib.sha256(a.html.read_bytes()).hexdigest(),'width':a.width,'height':a.height,'fps':a.fps,'frames':count,'duration':duration,'statistics':stats,'runtime_errors':runtime_errors,'elapsed_seconds':round(time.time()-begin,2),'ffprobe':probe}
 a.output.with_suffix('.render.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(f'Done: {a.output} ({a.output.stat().st_size/1e6:.1f} MB), {time.time()-begin:.1f}s',flush=True)
 if not a.keep_frames:shutil.rmtree(frames)
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--html',type=Path,default=ROOT/'output'/'parallax-ink.html');p.add_argument('--audio',type=Path,default=ROOT/'assets'/'score.wav');p.add_argument('--output',type=Path,default=ROOT/'output'/'ai-leaders.mp4');p.add_argument('--width',type=int,default=1080);p.add_argument('--height',type=int,default=1920);p.add_argument('--fps',type=int,default=30);p.add_argument('--jobs',type=int,default=4);p.add_argument('--chromium');p.add_argument('--keep-frames',action='store_true');p.add_argument('--resume',action='store_true');p.add_argument('--seconds',type=float);a=p.parse_args()
 if a.width%2 or a.height%2:p.error('MP4 dimensions must be even.')
 if abs(a.width/a.height-9/16)>1e-6:p.error('This artwork uses a 9:16 layout. Use 1080x1920 or 720x1280; redesign before changing aspect ratio.')
 if not 1<=a.jobs<=8 or not 1<=a.fps<=60:p.error('jobs must be 1–8; fps must be 1–60.')
 asyncio.run(run(a))
if __name__=='__main__':main()
