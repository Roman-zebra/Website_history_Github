/* Gunkanjima from the air, 1947 to today: a lab test for Japan Time Atlas.
   Plain WebGL, no libraries. Heights for 1962 and 2010 were measured from pairs of GSI aerial
   photographs; the photographs of the other years are laid over the nearest measured shape.
   Version 3 adds walls: every building outline from OpenStreetMap is raised to the roof height
   measured inside it, with a schematic façade (rows of windows from the storey count), and the
   sun casts shadows through a shadow map. The façades are a drawing, not a photograph. */
(function(){
  'use strict';
  const V = '3';
  const here = document.currentScript ? document.currentScript.src : location.href;
  const asset = name => new URL(name + '?v=' + V, here).href;
  const LANG = window.LAB_LANG || 'en';
  const T = Object.assign({
    loading: 'Loading the photographs…',
    ready: 'Drag to turn. Scroll or pinch to zoom.',
    failed: 'The 3D data could not be loaded. Please try again later.',
    noWebgl: 'This browser cannot draw 3D, so the flat photograph is shown instead.',
    flat: 'Flat photo', raise: 'Raise in 3D', reset: 'Reset view', exag: 'Heights ×2', trueScale: 'True heights',
    change: 'Show change', changeOff: 'Hide change', latest: 'Latest', play: 'Play the years', pause: 'Pause',
    walls: 'Walls: on', wallsOff: 'Walls: off',
    loadingYear: 'Loading the photograph…', yearFlat: 'Flat photograph: no heights for this year',
    yearMeasured: 'Heights measured from this year’s photographs', yearShape1962: 'Photograph laid over the 1962 shape',
    yearShape2010: 'Photograph laid over the 2010 shape', close: 'Close', sources: 'Sources',
    aerial1962: '1962', aerialLatest: 'Latest', photo: 'Photo', podPlay: 'Play', podPause: 'Pause',
    audioLang: 'Audio', follow: 'Move the model with the audio', chapters: 'Chapters', transcript: 'Transcript'
  }, window.LAB_TEXT || {});

  const $ = id => document.getElementById(id);
  const canvas = $('view'), status = $('viewStatus'), compass = $('viewCompass');
  const btnFlat = $('btnFlat'), btnReset = $('btnReset'), btnExag = $('btnExag'), btnChange = $('btnChange'), btnWalls = $('btnWalls');
  const yearRange = $('yearRange'), yearLabel = $('yearLabel'), yearNote = $('yearNote'), yearTicks = $('yearTicks'), btnPlay = $('btnPlayYears');
  const spotLayer = $('spotLayer'), panel = $('spotPanel');
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const lowEnd = !!((window.matchMedia && matchMedia('(max-width: 720px)').matches) || (navigator.deviceMemory && navigator.deviceMemory <= 4));
  const say = s => { if (status) status.textContent = s; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pick = obj => obj ? (obj[LANG] || obj.en || '') : '';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const BG = [0.075, 0.117, 0.13];
  const HORIZON = [0.36, 0.43, 0.46];
  // Sun at about 10 a.m. on 30 May at this latitude, so the shading agrees with the 1962 shadows.
  const SUN = (() => { const v = [0.492, 0.863, 0.112], l = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / l); })();
  const EL_MIN = 0.09, EL_MAX = 1.5, D_MIN = 60, D_MAX = 1800;
  const controls = [btnFlat, btnReset, btnExag, btnChange, btnWalls, yearRange, btnPlay];

  function fallback(message){
    say(message);
    const img = $('viewFallback');
    if (img) img.hidden = false;
    canvas.hidden = true;
    if (compass) compass.hidden = true;
    for (const c of controls) if (c) c.disabled = true;
  }

  const opts = { antialias: true, alpha: false, preserveDrawingBuffer: false };
  const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  if (!gl){ fallback(T.noWebgl); return; }
  const isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  const bigIndex = isGL2 || !!gl.getExtension('OES_element_index_uint');
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
  const depthExt = isGL2 ? true : !!gl.getExtension('WEBGL_depth_texture');
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
  const SHADOW = depthExt && !reduce ? (lowEnd ? 1024 : 2048) : 0;

  /* ---------- shaders ---------- */
  const COMMON_VS = `
    uniform mat4 uPV, uLightPV;
    uniform float uRot, uLift, uExag, uMpp, uC, uHf, uYOff;
    uniform mediump float uMorph;   // also read by the wall fragment shader, which is mediump
    uniform vec2 uPP;
    varying vec4 vShadow; varying float vDepth;
    vec3 place(vec2 g, float h){
      vec2 xz = (g - vec2(uC)) * uMpp;
      float c = cos(uRot), s = sin(uRot);
      return vec3(xz.x * c - xz.y * s, h * uExag + uYOff, xz.x * s + xz.y * c);
    }
    vec3 turn(vec3 n){ float c = cos(uRot), s = sin(uRot); return vec3(n.x * c - n.z * s, n.y, n.x * s + n.z * c); }
    void finish(vec3 p){ vShadow = uLightPV * vec4(p, 1.0); vec4 q = uPV * vec4(p, 1.0); vDepth = q.w; gl_Position = q; }`;
  const TERRAIN_VS = COMMON_VS + `
    attribute vec2 aGrid; attribute vec2 aH; attribute vec3 aN1; attribute vec3 aN2; attribute float aChg;
    varying vec2 vUvP; varying vec2 vUvO; varying vec3 vNor; varying float vChg; varying float vH;
    void main(){
      float h = mix(aH.x, aH.y, uMorph) * uLift;
      vec2 g = uPP + (aGrid - uPP) * (1.0 - h / uHf);   // roofs lean away from the nadir: pull them back
      vec3 n0 = normalize(mix(aN1, aN2, uMorph));
      float e = uLift * uExag;
      vNor = turn(normalize(vec3(n0.x * e, n0.y, n0.z * e)));
      vUvP = (aGrid + 0.5) / (2.0 * uC);   // where the camera photographed it
      vUvO = (g + 0.5) / (2.0 * uC);       // where it stands (for the orthophoto)
      vChg = aChg; vH = h;
      finish(place(g, h));
    }`;
  const SHADOW_FN = `
    uniform sampler2D uShadowMap; uniform float uShadowOn, uShadowTexel;
    float shadowAt(vec4 sc, float bias){
      if (uShadowOn < 0.5) return 1.0;
      vec3 p = sc.xyz / sc.w * 0.5 + 0.5;
      if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
      float lit = 0.0;
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
        float d = texture2D(uShadowMap, p.xy + vec2(float(i), float(j)) * uShadowTexel).r;
        lit += (p.z - bias > d) ? 0.0 : 1.0;
      }
      return lit / 9.0;
    }`;
  const TERRAIN_FS = `
    precision mediump float;
    uniform sampler2D uTexA, uTexB;
    uniform float uMix, uOrthoA, uOrthoB, uShade, uChange, uFog;
    uniform vec3 uBg, uSun, uHorizon;
    varying vec2 vUvP; varying vec2 vUvO; varying vec3 vNor; varying float vChg; varying float vH;
    varying vec4 vShadow; varying float vDepth;
    ` + SHADOW_FN + `
    void main(){
      vec3 a = texture2D(uTexA, mix(vUvP, vUvO, uOrthoA)).rgb;
      vec3 b = texture2D(uTexB, mix(vUvP, vUvO, uOrthoB)).rgb;
      vec3 t = mix(a, b, uMix);
      vec3 n = normalize(vNor);
      float d = max(dot(n, uSun), 0.0);
      float sh = shadowAt(vShadow, 0.0022);
      float light = mix(1.0, min(1.0, 0.40 + 0.62 * d * mix(0.35, 1.0, sh)), uShade);
      vec3 col = t * light;
      /* A height grid drags the photo down every wall into streaks, so steep faces get plain shaded concrete. */
      float steep = smoothstep(0.86, 0.45, n.y) * uShade;
      col = mix(col, vec3(0.50, 0.49, 0.46) * (0.30 + 0.6 * d * mix(0.4, 1.0, sh)), steep);
      if (uChange > 0.001){
        float lower = smoothstep(4.0, 14.0, -vChg), higher = smoothstep(4.0, 14.0, vChg);
        vec3 grey = vec3(dot(col, vec3(0.299, 0.587, 0.114)));
        col = mix(col, grey * 0.85, 0.55 * uChange);
        col = mix(col, vec3(0.88, 0.22, 0.16) * (0.55 + 0.45 * d), lower * 0.9 * uChange);
        col = mix(col, vec3(0.22, 0.48, 0.92) * (0.55 + 0.45 * d), higher * 0.9 * uChange);
      }
      col = mix(col, uHorizon, uFog * smoothstep(500.0, 2400.0, vDepth));
      float edge = smoothstep(0.5, 0.36, max(abs(vUvP.x - 0.5), abs(vUvP.y - 0.5)));
      col = mix(uBg, col, edge);   // the sea quad dissolves into the background before its corners show
      gl_FragColor = vec4(col, 1.0);
    }`;
  const WALL_VS = COMMON_VS + `
    attribute vec2 aPos; attribute vec2 aH; attribute vec3 aNor; attribute vec3 aWall; attribute vec2 aInfo;
    varying vec3 vNor; varying vec3 vWall; varying vec2 vInfo; varying float vLift;
    void main(){
      float h = mix(aH.x, aH.y, uMorph) * uLift;
      vNor = turn(aNor);
      vWall = vec3(aWall.x, (h - aWall.y * uLift) * uExag, aWall.z);   // metres along the edge, metres above the ground, wall height
      vInfo = aInfo; vLift = uLift;
      finish(place(aPos, h));
    }`;
  const WALL_FS = `
    precision mediump float;
    uniform float uMorph, uChange, uFog, uShade;
    uniform vec3 uBg, uSun, uHorizon;
    varying vec3 vNor; varying vec3 vWall; varying vec2 vInfo; varying float vLift;
    varying vec4 vShadow; varying float vDepth;
    ` + SHADOW_FN + `
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec3 n = normalize(vNor);
      float d = max(dot(n, uSun), 0.0);
      float sh = shadowAt(vShadow, 0.003);
      float storey = vInfo.x, seed = vInfo.y;
      float y = vWall.y, s = vWall.x;
      /* concrete: pale grey with faint vertical streaks and darkening near the ground; more stain with age */
      float age = uMorph;
      float streak = 0.9 + 0.1 * hash(vec2(floor(s * 3.0), seed)) - 0.06 * age * hash(vec2(floor(s * 1.3), seed + 2.0));
      vec3 base = vec3(0.72, 0.70, 0.66) * streak;
      base = mix(base, vec3(0.46, 0.45, 0.42), age * 0.35 * smoothstep(3.0, 0.0, y));
      /* schematic windows: one row per storey, a window every 2.6 m along the wall */
      float fy = fract(y / storey), fx = fract(s / 2.6);
      float win = step(0.30, fy) * step(fy, 0.74) * step(0.18, fx) * step(fx, 0.72);
      float cell = hash(vec2(floor(s / 2.6), floor(y / storey) + seed * 7.0));
      float open = step(0.55, cell) * age;                 // some frames lost after abandonment
      vec3 glass = mix(vec3(0.16, 0.19, 0.22), vec3(0.08, 0.07, 0.06), open) * (0.6 + 0.4 * cell);
      vec3 col = mix(base, glass, win * step(0.5, vWall.z) * step(1.0, storey));
      float light = 0.32 + 0.62 * d * mix(0.35, 1.0, sh);
      col *= mix(1.0, light, uShade) * (0.85 + 0.15 * smoothstep(0.0, 2.5, y));
      if (uChange > 0.001){ vec3 grey = vec3(dot(col, vec3(0.299, 0.587, 0.114))); col = mix(col, grey * 0.85, 0.55 * uChange); }
      col = mix(col, uHorizon, uFog * smoothstep(500.0, 2400.0, vDepth));
      gl_FragColor = vec4(col, 1.0);
    }`;
  const DEPTH_FS = `precision mediump float; void main(){ gl_FragColor = vec4(1.0); }`;

  function compile(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  }
  function program(vs, fs, attrs, uniforms){
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    attrs.forEach((n, i) => gl.bindAttribLocation(p, i, n));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    const U = {};
    for (const n of uniforms) U[n] = gl.getUniformLocation(p, n);
    return { p, U };
  }
  const COMMON_U = ['uPV', 'uLightPV', 'uRot', 'uLift', 'uExag', 'uMorph', 'uMpp', 'uC', 'uHf', 'uYOff', 'uPP', 'uShadowMap', 'uShadowOn', 'uShadowTexel', 'uFog', 'uShade', 'uChange', 'uBg', 'uSun', 'uHorizon'];
  const TERRAIN_A = ['aGrid', 'aH', 'aN1', 'aN2', 'aChg'], WALL_A = ['aPos', 'aH', 'aNor', 'aWall', 'aInfo'];
  let progT, progW, depthT, depthW;
  try {
    progT = program(TERRAIN_VS, TERRAIN_FS, TERRAIN_A, COMMON_U.concat(['uTexA', 'uTexB', 'uMix', 'uOrthoA', 'uOrthoB']));
    progW = program(WALL_VS, WALL_FS, WALL_A, COMMON_U);
    if (SHADOW){ depthT = program(TERRAIN_VS, DEPTH_FS, TERRAIN_A, COMMON_U); depthW = program(WALL_VS, DEPTH_FS, WALL_A, COMMON_U); }
  } catch (err) { console.error(err); fallback(T.noWebgl); return; }

  function buffer(data, target){
    const b = gl.createBuffer();
    gl.bindBuffer(target || gl.ARRAY_BUFFER, b);
    gl.bufferData(target || gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return b;
  }
  function attr(buf, loc, size){
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }
  function perspective(fovy, aspect, near, far){
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function ortho(l, r, b, t, n, f){
    return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]);
  }
  function lookAt(eye, at, up){
    up = up || [0, 1, 0];
    let zx = eye[0] - at[0], zy = eye[1] - at[1], zz = eye[2] - at[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1]);
  }
  function mul(a, b){
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++){
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }

  /* ---------- data ---------- */
  let lab = null, texts = null, mesh = null, sea = null, walls = null, rot = 0, mpp = 0.8, C = 512, PP = [512, 512], HF = 1950;
  const years = [], texCache = new Map();

  function normals(heights, w, h, step){
    const n = new Float32Array(w * h * 3), d = 2 * step * mpp;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++){
      const k = j * w + i;
      const hl = heights[j * w + Math.max(i - 1, 0)], hr = heights[j * w + Math.min(i + 1, w - 1)];
      const hu = heights[Math.max(j - 1, 0) * w + i], hd = heights[Math.min(j + 1, h - 1) * w + i];
      let nx = -(hr - hl) / d, ny = 1, nz = -(hd - hu) / d;
      const len = Math.hypot(nx, ny, nz);
      n[k * 3] = nx / len; n[k * 3 + 1] = ny / len; n[k * 3 + 2] = nz / len;
    }
    return n;
  }
  /* The photo shows a roof displaced away from the nadir by h/H of its distance; a footprint drawn at
     its true place is moved out the same way so that it covers the roof in the photograph. */
  function toPhoto(u, v, h){ const k = 1 / (1 - h / HF); return [PP[0] + (u - PP[0]) * k, PP[1] + (v - PP[1]) * k]; }
  function inside(poly, x, y){
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  /* Flatten the measured heights to one roof level inside every footprint, so the walls meet a clean roof. */
  function flattenRoofs(g, a62, a10, buildings){
    if (!buildings) return;
    for (const b of buildings){
      for (const key of ['1962', '2010']){
        const roof = key === '1962' ? b.roof1962 : b.roof2010, arr = key === '1962' ? a62 : a10;
        if (roof <= b.ground + 1.5) continue;
        const poly = b.poly.map(p => toPhoto(p[0], p[1], roof));
        let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
        for (const p of poly){ minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
        for (let y = Math.max(g.y0, Math.floor(miny)); y <= Math.min(g.y0 + g.h - 1, Math.ceil(maxy)); y++)
          for (let x = Math.max(g.x0, Math.floor(minx)); x <= Math.min(g.x0 + g.w - 1, Math.ceil(maxx)); x++)
            if (inside(poly, x + 0.5, y + 0.5)) arr[(y - g.y0) * g.w + (x - g.x0)] = roof;
      }
    }
  }

  function buildMesh(g, h62buf, h10buf, chgbuf, buildings, forceStep){
    const step = forceStep || (lowEnd ? 2 : 1);
    const full62 = new Float32Array(g.w * g.h), full10 = new Float32Array(g.w * g.h);
    const v62 = new DataView(h62buf), v10 = new DataView(h10buf);
    for (let k = 0; k < g.w * g.h; k++){ full62[k] = v62.getUint16(k * 2, true) * g.unit; full10[k] = v10.getUint16(k * 2, true) * g.unit; }
    if (st.walls) flattenRoofs(g, full62, full10, buildings);
    const w = Math.floor((g.w - 1) / step) + 1, h = Math.floor((g.h - 1) / step) + 1, count = w * h;
    const chg = new Int8Array(chgbuf);
    const grid = new Float32Array(count * 2), hts = new Float32Array(count * 2), c = new Float32Array(count);
    const a62 = new Float32Array(count), a10 = new Float32Array(count);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++){
      const k = j * w + i, src = (j * step) * g.w + i * step;
      grid[k * 2] = g.x0 + i * step; grid[k * 2 + 1] = g.y0 + j * step;
      a62[k] = hts[k * 2] = full62[src];
      a10[k] = hts[k * 2 + 1] = full10[src];
      c[k] = chg[src];
    }
    const tris = (w - 1) * (h - 1) * 2, useBig = count > 65535;
    if (useBig && !bigIndex) return buildMesh(g, h62buf, h10buf, chgbuf, buildings, step * 2);
    const idx = useBig ? new Uint32Array(tris * 3) : new Uint16Array(tris * 3);
    let p = 0;
    for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++){
      const a = j * w + i, b = a + 1, d = a + w, e = d + 1;
      idx[p++] = a; idx[p++] = d; idx[p++] = b; idx[p++] = b; idx[p++] = d; idx[p++] = e;
    }
    return {
      grid: buffer(grid), hts: buffer(hts), n1: buffer(normals(a62, w, h, step)), n2: buffer(normals(a10, w, h, step)), chg: buffer(c),
      idx: buffer(idx, gl.ELEMENT_ARRAY_BUFFER), count: idx.length, type: useBig ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
      h62: a62, h10: a10, w, h, step, x0: g.x0, y0: g.y0
    };
  }

  function buildSea(){
    const s = C * 2 - 1;
    return {
      grid: buffer(new Float32Array([0, 0, s, 0, 0, s, s, s])), hts: buffer(new Float32Array(8)),
      n1: buffer(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0])), n2: buffer(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0])),
      chg: buffer(new Float32Array(4)), idx: buffer(new Uint16Array([0, 2, 1, 1, 2, 3]), gl.ELEMENT_ARRAY_BUFFER), count: 6, type: gl.UNSIGNED_SHORT
    };
  }

  /* One quad per footprint edge. Positions are true (orthographic) places; the vertex shader does not
     apply the photo parallax to walls, so they stand where the map puts them. */
  function buildWalls(buildings){
    if (!buildings || !buildings.length) return null;
    const pos = [], hts = [], nor = [], wall = [], info = [], idx = [];
    let n = 0, seedN = 0;
    for (const b of buildings){
      const poly = b.poly;
      if (poly.length < 3) continue;
      let area = 0;
      for (let i = 0; i < poly.length; i++){ const p = poly[i], q = poly[(i + 1) % poly.length]; area += p[0] * q[1] - q[0] * p[1]; }
      const cw = area > 0;   // image y points down, so a positive shoelace area is clockwise on screen
      const wallH = Math.max(b.roof1962, b.roof2010) - b.ground;
      const industrial = /室|工場|倉庫|坑|機|タンク|槽|事務所|会議|桟橋|捲|上家|風洞|コンベア/.test(b.name || '');
      const storey = wallH < 5 ? 0 : (industrial ? Math.max(4.2, wallH / Math.max(1, Math.round(wallH / 4.5))) : wallH / Math.max(1, Math.round(wallH / 2.85)));
      const seed = (seedN++ % 97) / 97;
      const bottom = b.ground - 1.0;
      for (let i = 0; i < poly.length; i++){
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const ex = q[0] - p[0], ey = q[1] - p[1], len = Math.hypot(ex, ey) * mpp;
        if (len < 0.3) continue;
        // outward normal in grid space (x right, y down); flip according to winding
        let nx = ey, nz = -ex;
        if (cw){ nx = -nx; nz = -nz; }
        const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        const verts = [[p, 0, 0], [q, len, 0], [p, 0, 1], [q, len, 1]];
        for (const [pt, s, top] of verts){
          pos.push(pt[0], pt[1]);
          hts.push(top ? b.roof1962 : bottom, top ? b.roof2010 : bottom);
          nor.push(nx, 0, nz);
          wall.push(s, b.ground, wallH);
          info.push(storey, seed);
        }
        idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
        n += 4;
      }
    }
    if (!n) return null;
    const useBig = n > 65535;
    if (useBig && !bigIndex) return null;
    return {
      pos: buffer(new Float32Array(pos)), hts: buffer(new Float32Array(hts)), nor: buffer(new Float32Array(nor)),
      wall: buffer(new Float32Array(wall)), info: buffer(new Float32Array(info)),
      idx: buffer(useBig ? new Uint32Array(idx) : new Uint16Array(idx), gl.ELEMENT_ARRAY_BUFFER), count: idx.length, type: useBig ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
    };
  }

  function loadImage(src){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image ' + src));
      img.src = src;
    });
  }
  function upload(img){
    let source = img;
    const limit = Math.min(maxTex, lowEnd ? 1024 : 2048);
    if (img.width > limit){
      const cv = document.createElement('canvas');
      cv.width = cv.height = limit;
      cv.getContext('2d').drawImage(img, 0, 0, limit, limit);
      source = cv;
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return tex;
  }
  /* Photos are fetched and decoded ahead of time, but a 2,048 px upload with mipmaps is the costly part,
     so each one goes to the GPU only when its year is first drawn, and at most one per frame. */
  function texture(i){
    const y = years[i];
    if (!texCache.has(y.id)){
      const entry = { tex: null, img: null, promise: null };
      entry.promise = loadImage(asset(y.texture))
        .then(img => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => img))
        .then(img => { entry.img = img; request(); return entry; });
      texCache.set(y.id, entry);
    }
    return texCache.get(y.id);
  }
  let uploadedThisFrame = false;
  function gpu(entry){
    if (entry.tex) return entry.tex;
    if (!entry.img || uploadedThisFrame) return null;
    entry.tex = upload(entry.img);
    entry.img = null;
    uploadedThisFrame = true;
    request();
    return entry.tex;
  }

  /* ---------- shadow map ---------- */
  let shadowFb = null, shadowTex = null;
  function makeShadow(){
    if (!SHADOW) return;
    shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    if (isGL2) gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW, SHADOW, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, SHADOW, SHADOW, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    shadowFb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
    if (!isGL2){
      // WebGL1 wants a colour attachment for a complete framebuffer
      const col = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, col);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SHADOW, SHADOW, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, col, 0);
    }
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok){ shadowFb = null; shadowTex = null; }
  }
  function lightMatrix(){
    const R = 430, eye = [SUN[0] * 1500, SUN[1] * 1500, SUN[2] * 1500];
    return mul(ortho(-R, R, -R, R, 600, 2400), lookAt(eye, [0, 0, 0]));
  }

  /* ---------- state and camera ---------- */
  const HOME = { az: -1.1, el: 0.62 };
  const st = { az: HOME.az, el: HOME.el, dist: 700, tx: 0, tz: 0, lift: 0, exag: 1, year: 1, change: 0, userLift: 1, walls: true };
  let anim = null, spin = false, queued = false, activeSpot = null;

  function homeDistance(){
    const aspect = canvas.width / Math.max(1, canvas.height);
    return clamp(540 * Math.max(1, 1.45 / aspect), D_MIN, D_MAX);
  }
  function yearShape(y){ return y.shape === '2010' ? { lift: 1, morph: 1 } : y.shape === '1962' ? { lift: 1, morph: 0 } : { lift: 0, morph: 0 }; }
  function yearMix(){
    const n = years.length, v = clamp(st.year, 0, n - 1), i = Math.min(Math.floor(v), n - 2), f = v - i;
    const a = yearShape(years[i]), b = yearShape(years[i + 1]);
    return { i, f, lift: a.lift + (b.lift - a.lift) * f, morph: a.morph + (b.morph - a.morph) * f };
  }
  function toWorld(u, v, hgt){
    const g = [PP[0] + (u - PP[0]) * (1 - hgt / HF), PP[1] + (v - PP[1]) * (1 - hgt / HF)];
    const x = (g[0] - C) * mpp, z = (g[1] - C) * mpp, c = Math.cos(rot), s = Math.sin(rot);
    return [x * c - z * s, z * c + x * s];
  }

  function frameMatrices(){
    const w = canvas.width, h = canvas.height;
    const ce = Math.cos(st.el), target = [st.tx, 14, st.tz];
    const eye = [target[0] + st.dist * ce * Math.sin(st.az), target[1] + st.dist * Math.sin(st.el), target[2] + st.dist * ce * Math.cos(st.az)];
    const proj = perspective(0.7, w / Math.max(1, h), 2, 6000), view = lookAt(eye, target);
    return { proj, view, pv: mul(proj, view) };
  }

  function setCommon(P, pv, lightPV, lift, ym, shadowOn){
    gl.useProgram(P.p);
    const U = P.U;
    gl.uniformMatrix4fv(U.uPV, false, pv);
    gl.uniformMatrix4fv(U.uLightPV, false, lightPV);
    gl.uniform1f(U.uRot, rot);
    gl.uniform1f(U.uLift, lift);
    gl.uniform1f(U.uExag, st.exag);
    gl.uniform1f(U.uMorph, ym.morph);
    gl.uniform1f(U.uMpp, mpp);
    gl.uniform1f(U.uC, C);
    gl.uniform1f(U.uHf, HF);
    gl.uniform2fv(U.uPP, PP);
    gl.uniform1f(U.uShade, Math.min(1, lift));
    gl.uniform1f(U.uChange, st.change);
    gl.uniform3fv(U.uBg, BG);
    gl.uniform3fv(U.uSun, SUN);
    gl.uniform3fv(U.uHorizon, HORIZON);
    gl.uniform1f(U.uFog, 1);
    gl.uniform1f(U.uShadowOn, shadowOn ? 1 : 0);
    gl.uniform1f(U.uShadowTexel, 1 / (SHADOW || 1));
    if (U.uShadowMap){ gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, shadowOn ? shadowTex : null); gl.uniform1i(U.uShadowMap, 2); }
  }
  function drawTerrain(P, m, yOff){
    attr(m.grid, 0, 2); attr(m.hts, 1, 2); attr(m.n1, 2, 3); attr(m.n2, 3, 3); attr(m.chg, 4, 1);
    gl.uniform1f(P.U.uYOff, yOff);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
    gl.drawElements(gl.TRIANGLES, m.count, m.type, 0);
  }
  function drawWalls(P, w){
    attr(w.pos, 0, 2); attr(w.hts, 1, 2); attr(w.nor, 2, 3); attr(w.wall, 3, 3); attr(w.info, 4, 2);
    gl.uniform1f(P.U.uYOff, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, w.idx);
    gl.drawElements(gl.TRIANGLES, w.count, w.type, 0);
  }

  function draw(){
    const w = canvas.width, h = canvas.height;
    if (!mesh){ gl.viewport(0, 0, w, h); gl.clearColor(BG[0], BG[1], BG[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); return; }
    const ym = yearMix(), A = texture(ym.i), B = texture(ym.i + 1);
    uploadedThisFrame = false;
    const texA = gpu(A), texB = gpu(B);
    if (!texA) return;
    const lift = ym.lift * st.lift * st.userLift;
    const showWalls = st.walls && walls && lift > 0.001;
    const M = frameMatrices(), lightPV = lightMatrix();
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    // 1. depth from the sun
    const shadowOn = !!(shadowFb && lift > 0.001);
    if (shadowOn){
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFb);
      gl.viewport(0, 0, SHADOW, SHADOW);
      gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
      gl.colorMask(false, false, false, false);
      gl.disable(gl.CULL_FACE);
      setCommon(depthT, lightPV, lightPV, lift, ym, false);
      drawTerrain(depthT, mesh, 0);
      if (showWalls){ setCommon(depthW, lightPV, lightPV, lift, ym, false); drawWalls(depthW, walls); }
      gl.colorMask(true, true, true, true);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.enable(gl.CULL_FACE);
    }
    // 2. the view
    gl.viewport(0, 0, w, h);
    gl.clearColor(BG[0], BG[1], BG[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    setCommon(progT, M.pv, lightPV, lift, ym, shadowOn);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB || texA);
    gl.uniform1i(progT.U.uTexA, 0); gl.uniform1i(progT.U.uTexB, 1);
    gl.uniform1f(progT.U.uMix, texB ? ym.f : 0);
    gl.uniform1f(progT.U.uOrthoA, years[ym.i].ortho ? 1 : 0);
    gl.uniform1f(progT.U.uOrthoB, years[ym.i + 1].ortho ? 1 : 0);
    gl.disable(gl.CULL_FACE);
    drawTerrain(progT, sea, -0.4);
    drawTerrain(progT, mesh, 0);
    if (showWalls){
      gl.enable(gl.CULL_FACE);
      setCommon(progW, M.pv, lightPV, lift, ym, shadowOn);
      drawWalls(progW, walls);
      gl.disable(gl.CULL_FACE);
    }
    placeSpots(M.pv, lift, ym.morph);
    if (compass) compass.style.transform = 'rotate(' + (st.az * 180 / Math.PI).toFixed(1) + 'deg)';
  }

  function frame(now){
    queued = false;
    if (anim) anim(now);
    if (spin) st.az -= 0.0016;
    draw();
    if (anim || spin) request();
  }
  function request(){ if (!queued){ queued = true; requestAnimationFrame(frame); } }

  function animate(to, ms, done){
    if (reduce || ms <= 0){ Object.assign(st, to); anim = null; syncUi(); request(); if (done) done(); return; }
    const from = {};
    for (const k of Object.keys(to)) from[k] = st[k];
    if ('az' in to){
      let d = to.az - from.az;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      to = Object.assign({}, to, { az: from.az + d });
    }
    const t0 = performance.now();
    anim = now => {
      const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      for (const key of Object.keys(to)) st[key] = from[key] + (to[key] - from[key]) * e;
      syncUi();
      if (k >= 1){ anim = null; if (done) done(); }
    };
    request();
  }
  function stopSpin(){ spin = false; }

  /* ---------- years ---------- */
  function yearName(y){ return y.id === 'latest' ? T.latest : y.id; }
  function syncUi(){
    if (!lab) return;
    const n = years.length, v = clamp(st.year, 0, n - 1), near = years[Math.round(v)];
    if (yearRange && document.activeElement !== yearRange) yearRange.value = v.toFixed(2);
    if (yearLabel) yearLabel.textContent = yearName(near) + (near.date ? ' · ' + near.date : '');
    if (yearNote) yearNote.textContent = near.shape === null ? T.yearFlat : near.shape === near.id ? T.yearMeasured : near.shape === '1962' ? T.yearShape1962 : T.yearShape2010;
    if (btnFlat){ btnFlat.textContent = st.userLift > 0.5 ? T.flat : T.raise; btnFlat.setAttribute('aria-pressed', String(st.userLift <= 0.5)); }
    if (btnExag){ btnExag.textContent = st.exag > 1.5 ? T.trueScale : T.exag; btnExag.setAttribute('aria-pressed', String(st.exag > 1.5)); }
    if (btnChange){ btnChange.textContent = st.change > 0.5 ? T.changeOff : T.change; btnChange.setAttribute('aria-pressed', String(st.change > 0.5)); }
    if (btnWalls){ btnWalls.textContent = st.walls ? T.walls : T.wallsOff; btnWalls.setAttribute('aria-pressed', String(!st.walls)); }
    const legend = $('changeLegend');
    if (legend) legend.hidden = st.change < 0.5;
    const ym = yearMix();
    texture(ym.i); texture(Math.min(ym.i + 1, n - 1));
  }
  function setYear(index, ms){
    stopSpin();
    const i = clamp(index, 0, years.length - 1);
    const t = texture(Math.round(i));
    if (!t.tex && !t.img){ say(T.loadingYear); t.promise.then(() => say(T.ready)); }
    animate({ year: i }, ms === undefined ? 1400 : ms);
  }
  let playing = false;
  function playYears(){
    if (playing){ playing = false; if (btnPlay) btnPlay.textContent = T.play; return; }
    playing = true;
    if (btnPlay) btnPlay.textContent = T.pause;
    const next = () => {
      if (!playing) return;
      const i = Math.floor(st.year + 0.01) + 1;
      if (i >= years.length){ playing = false; if (btnPlay) btnPlay.textContent = T.play; return; }
      Promise.all([texture(i).promise]).then(() => animate({ year: i }, 2200, () => setTimeout(next, 900)));
    };
    if (st.year >= years.length - 1.01) animate({ year: 0 }, 900, () => setTimeout(next, 600)); else next();
  }

  /* ---------- spots ---------- */
  const pins = {};
  function spotHeight(s, morph){ return s.h1962 + (s.h2010 - s.h1962) * morph; }
  function spotWorld(id){
    const s = lab.spots[id];
    const xz = toWorld(s.u, s.v, spotHeight(s, yearMix().morph) * st.lift * st.userLift * yearMix().lift);
    return xz;
  }
  function placeSpots(pv, lift, morph){
    if (!spotLayer) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const id of Object.keys(pins)){
      const s = lab.spots[id], hgt = spotHeight(s, morph) * lift;
      const xz = toWorld(s.u, s.v, hgt), y = hgt * st.exag + 7;
      const cx = pv[0] * xz[0] + pv[4] * y + pv[8] * xz[1] + pv[12];
      const cy = pv[1] * xz[0] + pv[5] * y + pv[9] * xz[1] + pv[13];
      const cw = pv[3] * xz[0] + pv[7] * y + pv[11] * xz[1] + pv[15];
      const pin = pins[id];
      if (cw <= 0){ pin.hidden = true; continue; }
      const sx = (cx / cw * 0.5 + 0.5) * w, sy = (1 - (cy / cw * 0.5 + 0.5)) * h;
      pin.hidden = sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20;
      pin.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
    }
  }
  function buildPins(){
    if (!spotLayer || !texts) return;
    for (const id of Object.keys(lab.spots)){
      const info = texts.spots[id];
      if (!info) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'spot-pin';
      b.textContent = info.icon;
      b.setAttribute('aria-label', pick(info.name));
      b.title = pick(info.name);
      b.onclick = () => openSpot(id, true);
      spotLayer.appendChild(b);
      pins[id] = b;
    }
  }
  function photoFigure(ph, src, extraClass){
    const cap = pick(ph.caption);
    return '<figure' + (extraClass ? ' class="' + extraClass + '"' : '') + '><img src="' + esc(asset(src)) + '" alt="' + esc(cap) + '" loading="lazy" decoding="async"><figcaption>' + esc(cap)
      + ' <span class="credit">' + esc(T.photo) + ': ' + esc(ph.author) + (ph.year ? ' (' + esc(ph.year) + ')' : '')
      + ' · <a href="' + esc(ph.licenseUrl) + '" target="_blank" rel="noopener">' + esc(ph.license) + '</a> · <a href="' + esc(ph.page) + '" target="_blank" rel="noopener">Wikimedia Commons</a></span></figcaption></figure>';
  }
  function openSpot(id, fly){
    const info = texts.spots[id], s = lab.spots[id];
    if (!info || !panel) return;
    activeSpot = id;
    for (const k of Object.keys(pins)) pins[k].classList.toggle('is-on', k === id);
    const img = (src, alt, cap) => '<figure><img src="' + esc(asset(src)) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async"><figcaption>' + cap + '</figcaption></figure>';
    let html = '<p>' + esc(pick(info.text)) + '</p>';
    const ph = texts.photos[id];
    if (ph && s.images.photo) html += photoFigure(ph, s.images.photo, 'spot-photo');
    html += '<div class="spot-aerial">'
      + img(s.images['1962'], pick(info.name) + ' 1962', esc(T.aerial1962))
      + img(s.images.latest, pick(info.name) + ' ' + T.aerialLatest, esc(T.aerialLatest)) + '</div>';
    html += '<h3>' + esc(T.sources) + '</h3><ul class="spot-sources">' + info.sources.map(k => {
      const src = texts.sources[k];
      return '<li><a href="' + esc(src.url) + '" target="_blank" rel="noopener">' + esc(src.label[LANG] || src.label.en) + '</a></li>';
    }).join('') + '</ul>';
    $('spotTitle').textContent = pick(info.name);
    $('spotBody').innerHTML = html;
    panel.hidden = false;
    if (fly){
      stopSpin();
      const xz = spotWorld(id);
      animate({ tx: xz[0], tz: xz[1], dist: 260, el: clamp(st.el, 0.42, 0.9) }, 1200);
    }
  }
  function closeSpot(){
    if (panel) panel.hidden = true;
    activeSpot = null;
    for (const k of Object.keys(pins)) pins[k].classList.remove('is-on');
  }
  if ($('spotClose')) $('spotClose').onclick = closeSpot;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel && !panel.hidden) closeSpot(); });

  /* ---------- views used by the buttons and the audio ---------- */
  function view(name, ms){
    stopSpin();
    if (name === 'top') animate({ tx: 0, tz: 0, el: 1.35, dist: homeDistance() * 1.25 }, ms || 1400);
    else animate({ tx: 0, tz: 0, az: HOME.az, el: HOME.el, dist: homeDistance() }, ms || 1400);
  }

  /* ---------- input ---------- */
  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
    request();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
  resize();

  const pointers = new Map();
  let pinch0 = 0, dist0 = 0;
  canvas.addEventListener('pointerdown', e => {
    stopSpin();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2){ const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); dist0 = st.dist; }
  });
  canvas.addEventListener('pointermove', e => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1){
      if (e.shiftKey || e.buttons === 4 || e.buttons === 2){
        // pan with shift, middle or right button
        const k = st.dist * 0.0016, c = Math.cos(st.az), s = Math.sin(st.az);
        const dx = -(e.clientX - prev[0]) * k, dz = -(e.clientY - prev[1]) * k;
        st.tx += dx * c - dz * s; st.tz += -dx * s - dz * c;
        st.tx = clamp(st.tx, -450, 450); st.tz = clamp(st.tz, -450, 450);
      } else {
        st.az -= (e.clientX - prev[0]) * 0.006;
        st.el = clamp(st.el + (e.clientY - prev[1]) * 0.005, EL_MIN, EL_MAX);
      }
    } else if (pointers.size === 2 && pinch0){
      const [a, b] = [...pointers.values()];
      st.dist = clamp(dist0 * pinch0 / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), D_MIN, D_MAX);
    }
    request();
  });
  const release = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = 0; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    stopSpin();
    st.dist = clamp(st.dist * Math.exp(e.deltaY * 0.0012), D_MIN, D_MAX);
    request();
  }, { passive: false });
  canvas.addEventListener('keydown', e => {
    const moves = { ArrowLeft: () => { st.az += 0.08; }, ArrowRight: () => { st.az -= 0.08; },
      ArrowUp: () => { st.el = clamp(st.el + 0.06, EL_MIN, EL_MAX); }, ArrowDown: () => { st.el = clamp(st.el - 0.06, EL_MIN, EL_MAX); },
      '+': () => { st.dist = clamp(st.dist / 1.15, D_MIN, D_MAX); }, '=': () => { st.dist = clamp(st.dist / 1.15, D_MIN, D_MAX); },
      '-': () => { st.dist = clamp(st.dist * 1.15, D_MIN, D_MAX); } };
    if (!moves[e.key]) return;
    e.preventDefault();
    stopSpin();
    moves[e.key]();
    request();
  });

  let rawGrids = null;
  function rebuildMesh(){
    if (!rawGrids) return;
    mesh = buildMesh(lab.grid, rawGrids[0], rawGrids[1], rawGrids[2], lab.buildingList);
    request();
  }
  if (btnFlat) btnFlat.onclick = () => { stopSpin(); animate({ userLift: st.userLift > 0.5 ? 0 : 1 }, 1100); };
  if (btnExag) btnExag.onclick = () => { animate({ exag: st.exag > 1.5 ? 1 : 2 }, 600); };
  if (btnChange) btnChange.onclick = () => { animate({ change: st.change > 0.5 ? 0 : 1 }, 500); };
  if (btnWalls) btnWalls.onclick = () => { st.walls = !st.walls; rebuildMesh(); syncUi(); };
  if (btnReset) btnReset.onclick = () => { view('overview', 900); animate({ userLift: 1 }, 900); };
  if (btnPlay) btnPlay.onclick = playYears;
  if (yearRange) yearRange.addEventListener('input', () => {
    stopSpin();
    playing = false;
    anim = null;
    st.year = parseFloat(yearRange.value);
    syncUi();
    request();
  });

  /* ---------- audio (the podcast drives the same state) ---------- */
  function applyCues(lines, t){
    const target = { year: null, lift: null, change: null, view: null, spot: null };
    for (const line of lines){
      if (line.start > t + 0.05) break;
      const c = line.cue;
      if (!c) continue;
      if (c.year !== undefined) target.year = c.year;
      if (c.lift !== undefined) target.lift = c.lift;
      if (c.change !== undefined) target.change = c.change;
      if (c.view !== undefined){ target.view = c.view; target.spot = null; }
      if (c.spot !== undefined){ target.spot = c.spot; target.view = null; }
    }
    return target;
  }
  let lastCueKey = '';
  window.jtaLabFollow = (lines, t) => {
    if (!lab) return;
    const cue = applyCues(lines, t), key = JSON.stringify(cue);
    if (key === lastCueKey) return;
    lastCueKey = key;
    stopSpin();
    const to = {};
    if (cue.year !== null){ const i = years.findIndex(y => y.id === cue.year); if (i >= 0){ to.year = i; texture(i); } }
    if (cue.lift !== null) to.userLift = cue.lift;
    if (cue.change !== null) to.change = cue.change ? 1 : 0;
    if (cue.spot && lab.spots[cue.spot]){
      const xz = spotWorld(cue.spot);
      Object.assign(to, { tx: xz[0], tz: xz[1], dist: 260, el: 0.62 });
      for (const k of Object.keys(pins)) pins[k].classList.toggle('is-on', k === cue.spot);
    } else if (cue.view === 'top') Object.assign(to, { tx: 0, tz: 0, el: 1.35, dist: homeDistance() * 1.25 });
    else if (cue.view === 'overview') Object.assign(to, { tx: 0, tz: 0, az: HOME.az, el: HOME.el, dist: homeDistance() });
    animate(to, 1600);
  };

  /* ---------- start ---------- */
  say(T.loading);
  for (const c of controls) if (c) c.disabled = true;
  Promise.all([
    fetch(asset('gunkanjima-lab.json')).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch(asset('gunkanjima-spots.json')).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(asset('gunkanjima-buildings.json')).then(r => r.ok ? r.json() : null).catch(() => null)
  ]).then(([meta, words, bld]) => {
    lab = meta;
    texts = words;
    lab.buildingList = bld && bld.buildings ? bld.buildings : null;
    const g = meta.grid;
    return Promise.all([
      fetch(asset(g.h1962)).then(r => r.arrayBuffer()),
      fetch(asset(g.h2010)).then(r => r.arrayBuffer()),
      fetch(asset(g.change)).then(r => r.arrayBuffer())
    ]).then(([a, b, c]) => {
      if (a.byteLength !== g.w * g.h * 2 || b.byteLength !== g.w * g.h * 2 || c.byteLength !== g.w * g.h) throw new Error('grid size');
      mpp = meta.frame.metersPerPixel;
      C = meta.frame.size / 2;
      PP = meta.principalPoint;
      HF = meta.flyingHeightM;
      rot = -Math.atan2(meta.north[0], -meta.north[1]);
      for (const y of meta.years) years.push(y);
      if (yearRange){ yearRange.max = String(years.length - 1); yearRange.step = '0.01'; }
      if (yearTicks) yearTicks.innerHTML = years.map((y, i) => '<button type="button" data-year="' + i + '">' + esc(yearName(y)) + '</button>').join('');
      if (yearTicks) for (const b of yearTicks.querySelectorAll('button')) b.onclick = () => setYear(+b.dataset.year);
      rawGrids = [a, b, c];
      mesh = buildMesh(g, a, b, c, lab.buildingList);
      sea = buildSea();
      walls = buildWalls(lab.buildingList);
      if (!walls){ st.walls = false; if (btnWalls) btnWalls.hidden = true; }
      makeShadow();
      st.year = Math.max(0, years.findIndex(y => y.id === '1962'));
      buildPins();
      return texture(st.year).promise;
    });
  }).then(() => {
    for (const c of controls) if (c) c.disabled = false;
    say(T.ready);
    st.dist = homeDistance();
    syncUi();
    if (reduce){ st.lift = 1; request(); return; }
    st.el = 1.2;
    animate({ lift: 1, el: HOME.el }, 2200, () => { spin = true; request(); });
    // Warm the neighbouring years in the background.
    setTimeout(() => years.forEach((y, i) => texture(i)), 2500);
  }).catch(err => {
    console.error(err);
    fallback(T.failed);
  });

  /* For checking the page without an animation loop (a hidden tab runs no requestAnimationFrame). */
  window.jtaLab3d = { st, draw: () => draw(), view, setYear, openSpot, closeSpot, years: () => years.map(y => y.id),
    loaded: i => texture(i).promise, shadows: () => !!shadowFb, walls: () => !!walls };
})();
