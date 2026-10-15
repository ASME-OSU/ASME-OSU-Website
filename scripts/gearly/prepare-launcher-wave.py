from PIL import Image, ImageDraw, ImageFilter
from collections import deque
from pathlib import Path
import argparse
import numpy as np, json
parser=argparse.ArgumentParser(description='Prepare the supplied opaque 24fps Gearly WebP for the launcher. Requires Pillow and NumPy.')
parser.add_argument('source',type=Path)
source=parser.parse_args().source
out=Path('assets/gearly/sprites')
im=Image.open(source); frames=[]; durations=[]
for index in range(im.n_frames):
 im.seek(index); im.load(); durations.append(im.info.get('duration',42)); rgb=im.convert('RGB').resize((384,216),Image.Resampling.LANCZOS)
 arr=np.array(rgb); candidate=(arr.max(axis=2)<52).astype('uint8')*255
 background=np.zeros(candidate.shape,bool); queue=deque()
 for yy,xx in [(y,x) for y in range(216) for x in (0,383)]+[(y,x) for x in range(384) for y in (0,215)]:
  if candidate[yy,xx] and not background[yy,xx]:background[yy,xx]=True;queue.append((yy,xx))
 while queue:
  yy,xx=queue.popleft()
  for dy,dx in ((0,1),(0,-1),(1,0),(-1,0)):
   ny,nx=yy+dy,xx+dx
   if 0<=ny<216 and 0<=nx<384 and candidate[ny,nx] and not background[ny,nx]:background[ny,nx]=True;queue.append((ny,nx))
 fg=~background
 # Drop disconnected encoder flecks, keeping the character's largest component.
 seen=np.zeros(fg.shape,bool); biggest=[]
 for y,x in zip(*np.where(fg)):
  if seen[y,x]:continue
  queue=deque([(y,x)]);seen[y,x]=True;component=[]
  while queue:
   yy,xx=queue.popleft();component.append((yy,xx))
   for dy,dx in ((0,1),(0,-1),(1,0),(-1,0)):
    ny,nx=yy+dy,xx+dx
    if 0<=ny<216 and 0<=nx<384 and fg[ny,nx] and not seen[ny,nx]:seen[ny,nx]=True;queue.append((ny,nx))
  if len(component)>len(biggest):biggest=component
 alpha=np.zeros(fg.shape,'uint8')
 for y,x in biggest:alpha[y,x]=255
 rgba=rgb.convert('RGBA');rgba.putalpha(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(.35)));frames.append(rgba)
bounds=[f.getbbox() for f in frames];box=(min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds))
# Fixed crop and scale across the whole sequence: never recenter individual poses.
# The visor sits at x=188 on the 384px working canvas. Center this stable
# anatomical anchor, rather than the union bounds enlarged by the waving hand.
anchor_x,anchor_y=188,108
side=2*max(anchor_x-box[0],box[2]-anchor_x,anchor_y-box[1],box[3]-anchor_y)+12
final=[]
for f in frames:
 canvas=Image.new('RGBA',(side,side))
 canvas.alpha_composite(f,(side//2-anchor_x,side//2-anchor_y))
 final.append(canvas.resize((128,128),Image.Resampling.LANCZOS))
final[0].save(out/'gearly-centered-idle.webp',quality=90,method=6)
final[0].save(out/'gearly-centered-idle.png')
final[0].save(out/'gearly-centered-wave.webp',save_all=True,append_images=final[1:],duration=durations,loop=1,quality=78,method=4,minimize_size=False)
print(json.dumps({'frames':len(final),'durationMs':sum(durations),'sourceBytes':source.stat().st_size,'outputBytes':(out/'gearly-centered-wave.webp').stat().st_size,'crop':box}))
