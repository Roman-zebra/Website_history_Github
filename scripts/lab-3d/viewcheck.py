"""Can the viewer's camera see into each interior scene?

For every scene camera (and the shrine's approach) this checks, as the viewer draws the model:
  - the eye is not inside a solid part or another building;
  - the line from the eye to the camera's target is clear (solid parts, other buildings, the rock's surface);
  - how much of the furnishings around the scene's focus can be seen: each part within 7 m of the focus
    counts by its volume (capped) if it lies inside the view with nothing solid in front of it, and each
    translucent part in front (an assumed wall or door, a paper screen, glass, water) halves it.
Occluders are the scene's opaque parts, the buildings standing in 1962 other than the ghosted hosts (drawn
translucent while a scene is open) and the terrain surface. Coordinates are metres in the crop frame
(x = u * MPP, z = v * MPP) and metres above sea level; the viewer's turn to north changes nothing here.

    python viewcheck.py <folder with gunkanjima-interiors.json, -model.json, -lab.json, -terrain.bin> [--search]

interiors.py calls Scene.best_camera() so that every published camera passes; tests/lab-3d-views.test.cjs
checks the published cameras again with its own implementation. An approach view (the shrine's walk in)
keeps its designed direction: it must have a clear eye and a clear line, but is not scored.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np

MPP = 0.805
ROT = -math.atan2(0.5517, 0.834)
GLASS, WATER = 8, 12
YEAR = 1962
ASPECT = 1.0          # narrower than a desktop canvas (1.34), wider than a phone held upright (0.77)
MIN_SCORE = 0.4       # share of the furnishings (by volume) a scene camera must see
FOCUS_R, FOCUS_DY = 7.0, 2.6
EYE_CLEAR = 0.25      # the eye keeps this far from solid parts (the near plane is 0.2 m)
ELEVATIONS = (0.05, 0.1, 0.18, 0.28, 0.4, 0.55, 0.75, 0.95, 1.2)   # up to nearly overhead, for rooms open above
PER_GROUP = 15        # candidates per (target, elevation) scored in full
STRUCTURE = ('floor', 'ceiling', 'slab', 'wall', 'corridor', 'roof', 'terrace', 'parapet', 'gallery', 'rail', 'window',
             'frame', 'veranda', 'front', 'door', 'handle', 'fence', 'truss', 'post', 'column', 'stair', 'jigokudan',
             'rock', 'bush', 'trunk', 'crown', 'soil', 'stake', 'cord', 'shade', 'bulb', 'aerial', 'tatami', 'doma',
             'genkan', 'duckboard', 'partition', 'ladder', 'walkway', 'line', 'pole', 'curtain', 'awning')


def opaque(b):
    return not b.get('a') and b.get('k') not in (GLASS, WATER)


def is_content(b):
    t = b.get('t') or ''
    return not any(w in t for w in STRUCTURE) and max(b['s']) <= 3.5


class World:
    def __init__(self, folder):
        folder = Path(folder)
        self.model = json.loads((folder / 'gunkanjima-model.json').read_text(encoding='utf-8'))
        lab = json.loads((folder / 'gunkanjima-lab.json').read_text(encoding='utf-8'))
        g = self.grid = lab['grid']
        self.hts = np.fromfile(folder / 'gunkanjima-terrain.bin', dtype='<u2').reshape(g['h'], g['w']).astype(np.float64) * g['unit']
        self.buildings = []
        for b in self.model['buildings']:
            built = b.get('built') or b.get('seen') or 1950
            if built > YEAR or (b.get('gone') and YEAR > b['gone']):
                continue
            base, top = b['ground'] - 0.6, b['ground'] + b['storeys'] * b['floorH']
            for poly in (b.get('wings') or [b['poly']]):
                p = np.array(poly, dtype=np.float64) * MPP
                self.buildings.append({'name': b['name'], 'poly': p, 'base': base, 'top': top, 'lo': p.min(axis=0), 'hi': p.max(axis=0)})

    def height(self, x, z):
        g = self.grid
        col = np.clip(np.rint(np.asarray(x) / MPP).astype(int) - g['x0'], 0, g['w'] - 1)
        row = np.clip(np.rint(np.asarray(z) / MPP).astype(int) - g['y0'], 0, g['h'] - 1)
        return self.hts[row, col]


def parts(boxes, keep):
    sel = [i for i, b in enumerate(boxes) if keep(b)]
    B = [boxes[i] for i in sel]
    a = np.radians([b.get('r', 0.0) for b in B])
    return {'idx': np.array(sel, dtype=int), 'cx': np.array([b['u'] * MPP for b in B]), 'cz': np.array([b['v'] * MPP for b in B]),
            'y0': np.array([b['y'] for b in B]), 'y1': np.array([b['y'] + b['s'][1] for b in B]),
            'hx': np.array([b['s'][0] / 2 for b in B]), 'hz': np.array([b['s'][2] / 2 for b in B]), 'ca': np.cos(a), 'sa': np.sin(a)}


def seg_parts(P, p0, p1, grow=0.0):
    """Entry parameter t in [0, 1] of the segment p0 -> p1 into every part (inf where it misses)."""
    n = len(P['idx'])
    if not n:
        return np.array([])
    dx0, dz0, dx1, dz1 = p0[0] - P['cx'], p0[2] - P['cz'], p1[0] - P['cx'], p1[2] - P['cz']
    axes = [(dx0 * P['ca'] + dz0 * P['sa'], dx1 * P['ca'] + dz1 * P['sa'], -P['hx'] - grow, P['hx'] + grow),
            (-dx0 * P['sa'] + dz0 * P['ca'], -dx1 * P['sa'] + dz1 * P['ca'], -P['hz'] - grow, P['hz'] + grow),
            (p0[1] - P['y0'], p1[1] - P['y0'], np.full(n, -grow), P['y1'] - P['y0'] + grow)]
    t0, t1 = np.zeros(n), np.ones(n)
    for a0, a1, lo, hi in axes:
        d = a1 - a0
        with np.errstate(divide='ignore', invalid='ignore'):
            ta, tb = (lo - a0) / d, (hi - a0) / d
        flat = np.abs(d) < 1e-9
        inside = (a0 >= lo) & (a0 <= hi)
        t0 = np.maximum(t0, np.where(flat, np.where(inside, -np.inf, np.inf), np.minimum(ta, tb)))
        t1 = np.minimum(t1, np.where(flat, np.where(inside, np.inf, -np.inf), np.maximum(ta, tb)))
    return np.where(t0 <= t1, t0, np.inf)


def inside_poly(x, z, poly):
    inside, n = False, len(poly)
    for i in range(n):
        ax, az = poly[i]
        bx, bz = poly[(i + 1) % n]
        if (az > z) != (bz > z) and x < ax + (z - az) * (bx - ax) / (bz - az):
            inside = not inside
    return inside


def seg_building(bl, p0, p1):
    lo, hi = np.minimum(p0[[0, 2]], p1[[0, 2]]), np.maximum(p0[[0, 2]], p1[[0, 2]])
    if (lo > bl['hi']).any() or (hi < bl['lo']).any() or max(p0[1], p1[1]) < bl['base'] or min(p0[1], p1[1]) > bl['top']:
        return None
    if bl['base'] <= p0[1] <= bl['top'] and inside_poly(p0[0], p0[2], bl['poly']):
        return 0.0
    ts, poly, n = [], bl['poly'], len(bl['poly'])
    rx, rz = p1[0] - p0[0], p1[2] - p0[2]
    for i in range(n):
        ax, az = poly[i]
        bx, bz = poly[(i + 1) % n]
        sx, sz = bx - ax, bz - az
        den = rx * sz - rz * sx
        if abs(den) < 1e-12:
            continue
        t = ((ax - p0[0]) * sz - (az - p0[2]) * sx) / den
        s = ((ax - p0[0]) * rz - (az - p0[2]) * rx) / den
        if 0 <= t <= 1 and 0 <= s <= 1 and bl['base'] <= p0[1] + t * (p1[1] - p0[1]) <= bl['top']:
            ts.append(t)
    dy = p1[1] - p0[1]
    if abs(dy) > 1e-9:
        for yc in (bl['base'], bl['top']):
            t = (yc - p0[1]) / dy
            if 0 <= t <= 1 and inside_poly(p0[0] + t * rx, p0[2] + t * rz, poly):
                ts.append(t)
    return min(ts) if ts else None


def crosses_terrain(W, p0, p1, end=0.3):
    L = float(np.linalg.norm(p1 - p0))
    t = np.linspace(0.0, 1.0, max(3, int(L / 0.35)) + 1)
    t = t[t <= 1.0 - min(0.5, end / max(L, 1e-6))]
    pts = p0[None, :] + t[:, None] * (p1 - p0)[None, :]
    above = pts[:, 1] > W.height(pts[:, 0], pts[:, 2]) + 0.05
    return bool(above.any() and (~above).any())


class Scene:
    def __init__(self, W, sc):
        self.W, self.sc = W, sc
        boxes = sc['boxes']
        self.solid = parts(boxes, opaque)
        self.glassy = parts(boxes, lambda b: not opaque(b))
        hosts = set(sc.get('ghost') or [])
        self.others = [bl for bl in W.buildings if bl['name'] not in hosts]
        f = sc.get('focus') or sc['camera']
        self.F = self.point(f['u'], f['v'], f['y'])
        content = [i for i, b in enumerate(boxes) if is_content(b)]
        near = [i for i in content if math.hypot(*(self.center(i) - self.F)[[0, 2]]) <= FOCUS_R and abs(self.center(i)[1] - self.F[1]) <= FOCUS_DY]
        self.focus = near if len(near) >= 4 else content
        self.fc = np.array([self.center(i) for i in self.focus]).reshape(-1, 3)
        self.fw = np.array([min(2.0, max(0.02, float(np.prod(boxes[i]['s'])))) for i in self.focus])

    def point(self, u, v, y):
        return np.array([u * MPP, y, v * MPP], dtype=np.float64)

    def center(self, i):
        b = self.sc['boxes'][i]
        return self.point(b['u'], b['v'], b['y'] + b['s'][1] / 2)

    def blockers(self, p0, p1, skip=None, end=0.97, others=None):
        """What stops the segment before `end` (fraction of its length): part tags, building names, 'terrain'."""
        hit = []
        t = seg_parts(self.solid, p0, p1)
        for j in np.nonzero(t < end)[0]:
            i = int(self.solid['idx'][j])
            if i != skip:
                hit.append(self.sc['boxes'][i].get('t') or 'part')
        for bl in (self.others if others is None else others):
            tb = seg_building(bl, p0, p1)
            if tb is not None and tb < end:
                hit.append(bl['name'])
        if crosses_terrain(self.W, p0, p1):
            hit.append('terrain')
        return hit

    def eye_problem(self, e, others=None):
        near = seg_parts(self.solid, e, e, grow=EYE_CLEAR)
        hit = [self.sc['boxes'][int(self.solid['idx'][j])].get('t') or 'part' for j in np.nonzero(near < np.inf)[0]]
        for bl in (self.others if others is None else others):
            if bl['lo'][0] <= e[0] <= bl['hi'][0] and bl['lo'][1] <= e[2] <= bl['hi'][1] and bl['base'] <= e[1] <= bl['top'] and inside_poly(e[0], e[2], bl['poly']):
                hit.append(bl['name'])
        return hit

    def eye_target(self, cam):
        ce = math.cos(cam['el'])
        dx, dz = cam['dist'] * ce * math.sin(cam['az']), cam['dist'] * ce * math.cos(cam['az'])
        c, s = math.cos(ROT), math.sin(ROT)
        T = self.point(cam['u'], cam['v'], cam['y'])
        return T + np.array([dx * c + dz * s, cam['dist'] * math.sin(cam['el']), -dx * s + dz * c]), T

    def in_view(self, e, T, fov):
        """Which furnishings lie inside the view (nothing about what stands in front of them)."""
        f = (T - e) / np.linalg.norm(T - e)
        r = np.cross(f, [0.0, 1.0, 0.0])
        r = r / np.linalg.norm(r) if np.linalg.norm(r) > 1e-6 else np.array([1.0, 0.0, 0.0])
        up = np.cross(r, f)
        d = self.fc - e
        z = d @ f
        ty = math.tan(fov / 2)
        with np.errstate(divide='ignore', invalid='ignore'):
            return (z >= 0.3) & (np.abs(d @ r) / z <= ty * ASPECT) & (np.abs(d @ up) / z <= ty)

    def score(self, e, T, fov, others=None):
        """Share of the furnishings (by volume) in view with nothing solid in front. Each translucent part in front
        halves what it lets through: the Building 30 camera once passed by seeing the flat through seven translucent
        gallery fronts and doors, which in the picture hide it."""
        seen, count = 0.0, 0
        for k in np.nonzero(self.in_view(e, T, fov))[0]:
            p, i = self.fc[k], self.focus[k]
            if self.blockers(e, p, skip=i, others=others):
                continue
            t = seg_parts(self.glassy, e, p)
            layers = int(np.count_nonzero((t < 0.97) & (self.glassy['idx'] != i))) if len(t) else 0
            seen += float(self.fw[k]) * 0.5 ** layers
            count += 1
        return seen / max(float(self.fw.sum()), 1e-9), count

    def assess(self, cam):
        e, T = self.eye_target(cam)
        sc, n = self.score(e, T, cam.get('fov', 0.9))
        return {'eye_inside': self.eye_problem(e), 'target_blocked_by': sorted(set(self.blockers(e, T))),
                'score': round(sc, 2), 'seen': n, 'content': len(self.focus), 'eye_y': round(float(e[1]), 2)}

    def passes(self, a, need_score=True):
        return not a['eye_inside'] and not a['target_blocked_by'] and (a['score'] >= MIN_SCORE or not need_score)

    def camera_from(self, T, theta, el, dist, like):
        du, dv = dist * math.cos(el) * math.cos(theta), dist * math.cos(el) * math.sin(theta)
        c, s = math.cos(ROT), math.sin(ROT)
        cam = dict(like)
        cam.update({'u': float(round(T[0] / MPP, 1)), 'v': float(round(T[2] / MPP, 1)), 'y': float(round(T[1], 2)), 'dist': float(round(dist, 2)),
                    'el': float(round(el, 3)), 'az': float(round(math.atan2(du * c - dv * s, dv * c + du * s), 3))})
        return cam

    def best_camera(self, cam):
        """None when the camera already passes; otherwise the camera that sees the most, preferring small changes:
        the same target (or the focus, or the middle of the furnishings), all round the circle, heights up to
        nearly overhead, several distances. Candidates with a clear eye and a clear line are grouped by target and
        height; the PER_GROUP with most furnishings in frame from each group are scored in full, so views that only
        look good before occlusion (through translucent walls) cannot crowd out the rest."""
        base = self.assess(cam)
        if self.passes(base):
            return None, base
        fov = cam.get('fov', 0.9)
        e0, T0 = self.eye_target(cam)
        targets = [(0.0, T0)]
        if np.linalg.norm(self.F - T0) > 0.5:
            targets.append((3.0, self.F))
        mid = (self.fc * self.fw[:, None]).sum(axis=0) / self.fw.sum()
        mid[1] = self.F[1]
        if min(np.linalg.norm(mid - t) for _, t in targets) > 0.5:
            targets.append((3.0, mid))
        th0 = math.atan2(e0[2] - T0[2], e0[0] - T0[0])
        d0, el0 = cam['dist'], cam['el']
        dists = sorted({round(d0, 2), round(d0 * 0.8, 2), round(d0 * 0.62, 2), round(d0 * 0.48, 2), 6.0, 4.5, 3.2, 2.2})
        # only buildings the candidate lines can reach
        reach = max(dists) + FOCUS_R + 5.0 + max(float(np.linalg.norm(t - self.F)) for _, t in targets)
        near = [bl for bl in self.others if (bl['lo'] - reach <= self.F[[0, 2]]).all() and (bl['hi'] + reach >= self.F[[0, 2]]).all()]
        groups = {}
        for ti, (tp, T) in enumerate(targets):
            for k in range(-11, 13):
                for ei, el in enumerate(ELEVATIONS):
                    for d in dists:
                        if d < 1.2:
                            continue
                        th = th0 + k * math.pi / 12
                        e = T + np.array([d * math.cos(el) * math.cos(th), d * math.sin(el), d * math.cos(el) * math.sin(th)])
                        if self.eye_problem(e, near) or self.blockers(e, T, others=near):
                            continue
                        penalty = tp + abs(k) + 4 * abs(el - el0) + 2 * abs(d - d0) / max(d0, 1.0)
                        rough = float(self.fw[self.in_view(e, T, fov)].sum() / self.fw.sum())
                        groups.setdefault((ti, ei), []).append((rough - 0.004 * penalty, penalty, th, el, d, e, T))
        best = None
        for items in groups.values():
            items.sort(key=lambda x: -x[0])
            for _, penalty, th, el, d, e, T in items[:PER_GROUP]:
                sc, _ = self.score(e, T, fov, others=near)
                value = sc - 0.004 * penalty
                if best is None or value > best[0]:
                    best = (value, th, el, d, sc, T)
        if best is None:
            return None, base
        if not base['eye_inside'] and not base['target_blocked_by'] and best[4] < base['score'] + 0.1:
            return None, base
        return self.camera_from(best[5], best[1], best[2], best[3], cam), base


def main(argv):
    sys.stdout.reconfigure(encoding='utf-8')
    folder, search = Path(argv[1]), '--search' in argv
    W = World(folder)
    data = json.loads((folder / 'gunkanjima-interiors.json').read_text(encoding='utf-8'))
    bad = 0
    for sid, sc in data['scenes'].items():
        S = Scene(W, sc)
        for key in ('camera', 'approach'):
            cam = sc.get(key)
            if not cam:
                continue
            a = S.assess(cam)
            ok = S.passes(a, need_score=(key == 'camera'))
            bad += not ok
            print(f"{'OK ' if ok else 'BAD'} {sid}.{key}: furnishings seen {a['seen']}/{a['content']} score {a['score']} eye_y {a['eye_y']} eye_inside {a['eye_inside'][:4]} blocked {a['target_blocked_by'][:6]}")
            if search and not ok and key == 'camera':
                new, _ = S.best_camera(cam)
                if new:
                    b = S.assess(new)
                    print(f"    -> u {new['u']} v {new['v']} y {new['y']} dist {new['dist']} el {new['el']} az {new['az']}: seen {b['seen']}/{b['content']} score {b['score']} blocked {b['target_blocked_by'][:4]}")
                else:
                    print('    -> no better camera found')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
