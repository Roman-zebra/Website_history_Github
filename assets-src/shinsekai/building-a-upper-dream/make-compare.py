"""Builds renders/compare-*.png: 2x2 sheets [Codex hybrid base | add-on base or Codex dream | add-on dream | matched dreamcore frame].
Run: blender -b -P make-compare.py        (reads renders/*.png, hybrid/renders/*.png, video-work/mZX2Xqb13xc/frames/*.jpg; writes renders/)
Dreamcore frames are copyrighted reference stills (local only, not redistributed); only the method is used."""
import bpy, numpy as np
from pathlib import Path

HERE = Path(__file__).resolve().parent
HYB = HERE.parents[0] / 'eval-building-a' / 'hybrid' / 'renders'
FR = HERE.parents[3] / 'video-work' / 'mZX2Xqb13xc' / 'frames'
OUT = HERE / 'renders'
TW, TH = 640, 360


def load(p):
    img = bpy.data.images.load(str(p))
    w, h = img.size
    a = np.array(img.pixels[:], np.float32).reshape(h, w, 4)[..., :3]
    bpy.data.images.remove(img)
    return a                      # row 0 = bottom


def fit(a):
    h, w = a.shape[:2]
    yi = (np.arange(TH) * h / TH).astype(int)
    xi = (np.arange(TW) * w / TW).astype(int)
    return a[yi][:, xi]


def label(a, k):
    a = a.copy()
    a[TH - 14:TH - 2, 4:4 + 10 * k] = (0.05, 0.05, 0.05)
    return a


def save(a, path):
    h, w = a.shape[:2]
    img = bpy.data.images.new('cmp', w, h, alpha=False)
    buf = np.ones((h, w, 4), np.float32)
    buf[..., :3] = a
    img.pixels.foreach_set(buf.ravel())
    img.filepath_raw = str(path)
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


PAIRS = {   # view -> (left-top, right-top, left-bottom, reference frame)
    'upper-axis': ('hyb:base-upper-axis', 'me:base-upper-axis', 'me:dream-upper-axis', '00012'),
    'upper-corner': ('hyb:base-upper-corner', 'me:base-upper-corner', 'me:dream-upper-corner', '00033'),
    'upper-ceiling': ('hyb:base-upper-ceiling', 'me:base-upper-ceiling', 'me:dream-upper-ceiling', '00012'),
    'upper-window': ('hyb:base-upper-window', 'me:base-upper-window', 'me:dream-upper-window', '00044'),
    'ground-axis': ('hyb:base-ground-axis', 'hyb:dream-ground-axis', 'me:dream-ground-axis', '00033'),
    'ground-corner': ('hyb:base-ground-corner', 'hyb:dream-ground-corner', 'me:dream-ground-corner', '00059'),
    'ground-ceiling': ('hyb:base-ground-ceiling', 'hyb:dream-ground-ceiling', 'me:dream-ground-ceiling', '00012'),
    'ground-window': ('hyb:base-ground-window', 'hyb:dream-ground-window', 'me:dream-ground-window', '00044'),
    'ground-street': ('hyb:base-ground-street', 'hyb:dream-ground-street', 'me:dream-ground-street', '00059'),
}
for view, (a, b, c, ref) in PAIRS.items():
    tiles = []
    for spec in (a, b, c):
        src, name = spec.split(':')
        p = (HYB if src == 'hyb' else OUT) / f'{name}.png'
        tiles.append(fit(load(p)) if p.exists() else np.zeros((TH, TW, 3), np.float32))
    tiles.append(fit(load(FR / f'{ref}.jpg')))
    sheet = np.vstack([np.hstack(tiles[2:]), np.hstack(tiles[:2])])
    save(sheet, OUT / f'compare-{view}.png')
    print('wrote compare', view)
