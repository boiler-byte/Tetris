from PIL import Image, ImageDraw, ImageFilter
import math
from pathlib import Path

OUT = Path(__file__).parent

def icon(size, maskable=False):
    s = 1024
    im = Image.new('RGB', (s,s))
    p = im.load()
    for y in range(s):
        for x in range(s):
            v = max(0, 1 - math.hypot((x-260)/780,(y-210)/810))
            w = max(0, 1 - math.hypot((x-850)/1000,(y-900)/1000))
            p[x,y] = (int(7 + 18*v + 4*w), int(11+28*v+15*w), int(25+45*v+22*w))
    tint = Image.new('RGBA',(s,s),(0,0,0,0))
    d = ImageDraw.Draw(tint)
    margin = 100 if not maskable else 60
    d.rounded_rectangle((margin,margin,s-margin,s-margin),radius=215,outline=(119,183,220,55),width=4)
    # Bright connected T-shaped tetromino motif: cyan top strip, lavender stem.
    blocks = [
        (0,0,'cyan'),(1,0,'cyan'),(2,0,'cyan'),
        (1,1,'purple'),(1,2,'purple'),
        (2,2,'pink')
    ]
    csize = 160 if not maskable else 142
    gap = 15
    extent = csize*3 + gap*2
    start_x = (s-extent)//2
    start_y = (s-(3*csize + 2*gap))//2
    palette = {'cyan':(75,234,241,255),'purple':(161,140,255,255),'pink':(255,113,162,255)}
    for x,y,name in blocks:
        a = start_x+x*(csize+gap)
        b = start_y+y*(csize+gap)
        d.rounded_rectangle((a,b,a+csize,b+csize),radius=33,fill=palette[name])
        d.rounded_rectangle((a+15,b+12,a+csize-17,b+34),radius=10,fill=(255,255,255,67))
    glow = tint.filter(ImageFilter.GaussianBlur(radius=38))
    glow.putalpha(glow.getchannel('A').point(lambda a: round(a*.46)))
    base = im.convert('RGBA')
    base = Image.alpha_composite(base,glow)
    base = Image.alpha_composite(base,tint)
    return base.resize((size,size),Image.Resampling.LANCZOS).convert('RGB')

icon(192).save(OUT/'icon-192.png',optimize=True)
icon(512).save(OUT/'icon-512.png',optimize=True)
icon(512,True).save(OUT/'icon-maskable-512.png',optimize=True)
print('Icon assets generated')
