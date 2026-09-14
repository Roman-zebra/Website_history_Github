/* Gunkanjima from the air, 1947 to today: a lab test for Japan Time Atlas.
   Plain WebGL, no libraries. Heights for 1962 and 2010 were measured from pairs of GSI aerial
   photographs; the photographs of the other years are laid over the nearest measured shape. */
(function(){
  'use strict';
  const V = '2';
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
    loadingYear: 'Loading the photograph…', yearFlat: 'Flat photograph: no heights for this year',
    yearMeasured: 'Heights measured from this year’s photographs', yearShape1962: 'Photograph laid over the 1962 shape',
    yearShape2010: 'Photograph laid over the 2010 shape', close: 'Close', sources: 'Sources',
    aerial1962: '1962', aerialLatest: 'Latest', photo: 'Photo', podPlay: 'Play', podPause: 'Pause',
    audioLang: 'Audio', follow: 'Move the model with the audio', chapters: 'Chapters', transcript: 'Transcript'
  }, window.LAB_TEXT || {});

  const $ = id => document.getElementById(id);
  const canvas = $('view'), status = $('viewStatus'), compass = $('viewCompass');
  const btnFlat = $('btnFlat'), btnReset = $('btnReset'), btnExag = $('btnExag'), btnChange = $('btnChange');
  const yearRange = $('yearRange'), yearLabel = $('yearLabel'), yearNote = $('yearNote'), yearTicks = $('yearTicks'), btnPlay = $('btnPlayYears');
  const spotLayer = $('spotLayer'), panel = $('spotPanel');
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const lowEnd = !!((window.matchMedia && matchMedia('(max-width: 720px)').matches) || (navigator.deviceMemory && navigator.deviceMemory <= 4));
  const say = s => { if (status) status.textContent = s; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pick = obj => obj ? (obj[LANG] || obj.en || '') : '';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const BG = [0.059, 0.098, 0.106];
  // Sun at about 10 a.m. on 30 May at this latitude, so the shading agrees with the 1962 shadows.
  const SUN = (() => { const v = [0.492, 0.863, 0.112], l = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / l); })();
  const EL_MIN = 0.09, EL_MAX = 1.5, D_MIN = 120, D_MAX = 1800;
  const controls = [btnFlat, btnReset, btnExag, btnChange, yearRange, btnPlay];

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
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;

  const VS = `
    attribute vec2 aGrid; attribute vec2 aH; attribute vec3 aN1; attribute vec3 aN2; attribute float aChg;
    uniform mat4 uProj, uView;
    uniform float uRot, uLift, uExag, uMorph, uMpp, uC, uHf, uYOff;
    uniform vec2 uPP;
    varying vec2 vUvP; varying vec2 vUvO; varying vec3 vNor; varying float vChg;
    void main(){
      float h = mix(aH.x, aH.y, uMorph) * uLift;
      vec2 g = uPP + (aGrid - uPP) * (1.0 - h / uHf);   // roofs lean away from the nadir: pull them back
      vec2 xz = (g - vec2(uC)) * uMpp;
      float c = cos(uRot), s = sin(uRot);
      vec3 p = vec3(xz.x * c - xz.y * s, h * uExag + uYOff, xz.x * s + xz.y * c);
      vec3 n0 = normalize(mix(aN1, aN2, uMorph));
      float e = uLift * uExag;
      vec3 n = normalize(vec3(n0.x * e, n0.y, n0.z * e));
      vNor = vec3(n.x * c - n.z * s, n.y, n.x * s + n.z * c);
      vUvP = (aGrid + 0.5) / (2.0 * uC);   // where the camera photographed it
      vUvO = (g + 0.5) / (2.0 * uC);       // where it stands (for the orthophoto)
      vChg = aChg;
      gl_Position = uProj * uView * vec4(p, 1.0);
    }`;
  const FS = `
    precision mediump float;
    uniform sampler2D uTexA, uTexB;
    uniform float uMix, uOrthoA, uOrthoB, uShade, uChange;
    uniform vec3 uBg, uSun;
    varying vec2 vUvP; varying vec2 vUvO; varying vec3 vNor; varying float vChg;
    void main(){
      vec3 a = texture2D(uTexA, mix(vUvP, vUvO, uOrthoA)).rgb;
      vec3 b = texture2D(uTexB, mix(vUvP, vUvO, uOrthoB)).rgb;
      vec3 t = mix(a, b, uMix);
      vec3 n = normalize(vNor);
      float d = max(dot(n, uSun), 0.0);
      vec3 col = t * mix(1.0, 0.5 + 0.62 * d, uShade);
      /* A height grid drags the photo down every wall into streaks, so steep faces get plain shaded concrete. */
      float steep = smoothstep(0.88, 0.5, n.y) * uShade;
      col = mix(col, vec3(0.6, 0.59, 0.56) * (0.4 + 0.6 * d), steep);
      if (uChange > 0.001){
        float lower = smoothstep(4.0, 14.0, -vChg), higher = smoothstep(4.0, 14.0, vChg);
        vec3 grey = vec3(dot(col, vec3(0.299, 0.587, 0.114)));
        col = mix(col, grey * 0.85, 0.55 * uChange);
        col = mix(col, vec3(0.88, 0.22, 0.16) * (0.55 + 0.45 * d), lower * 0.9 * uChange);
        col = mix(col, vec3(0.22, 0.48, 0.92) * (0.55 + 0.45 * d), higher * 0.9 * uChange);
      }
      float edge = smoothstep(0.5, 0.33, max(abs(vUvP.x - 0.5), abs(vUvP.y - 0.5)));
      gl_FragColor = vec4(mix(uBg, col, edge), 1.0);
    }`;

  function compile(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  ['aGrid', 'aH', 'aN1', 'aN2', 'aChg'].forEach((n, i) => gl.bindAttribLocation(prog, i, n));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)){ fallback(T.noWebgl); return; }
  const U = {};
  for (const n of ['uProj', 'uView', 'uRot', 'uLift', 'uExag', 'uMorph', 'uMpp', 'uC', 'uHf', 'uYOff', 'uPP', 'uTexA', 'uTexB', 'uMix', 'uOrthoA', 'uOrthoB', 'uShade', 'uChange', 'uBg', 'uSun'])
    U[n] = gl.getUniformLocation(prog, n);

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
  function lookAt(eye, at){
    let zx = eye[0] - at[0], zy = eye[1] - at[1], zz = eye[2] - at[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = zz, xz = -zx;
    l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l;
    const yx = zy * xz, yy = zz * xx - zx * xz, yz = -zy * xx;
    return new Float32Array([xx, yx, zx, 0, 0, yy, zy, 0, xz, yz, zz, 0,
      -(xx * eye[0] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1]);
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
  let lab = null, texts = null, mesh = null, sea = null, rot = 0, mpp = 0.8, C = 512, PP = [512, 512], HF = 1950;
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

  function buildMesh(g, h62buf, h10buf, chgbuf){
    const step = lowEnd ? 2 : 1;
    const w = Math.floor((g.w - 1) / step) + 1, h = Math.floor((g.h - 1) / step) + 1, count = w * h;
    const v62 = new DataView(h62buf), v10 = new DataView(h10buf), chg = new Int8Array(chgbuf);
    const grid = new Float32Array(count * 2), hts = new Float32Array(count * 2), c = new Float32Array(count);
    const a62 = new Float32Array(count), a10 = new Float32Array(count);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++){
      const k = j * w + i, src = (j * step) * g.w + i * step;
      grid[k * 2] = g.x0 + i * step; grid[k * 2 + 1] = g.y0 + j * step;
      a62[k] = hts[k * 2] = v62.getUint16(src * 2, true) * g.unit;
      a10[k] = hts[k * 2 + 1] = v10.getUint16(src * 2, true) * g.unit;
      c[k] = chg[src];
    }
    const tris = (w - 1) * (h - 1) * 2, useBig = count > 65535;
    if (useBig && !bigIndex) return buildMesh(g, h62buf, h10buf, chgbuf, step * 2);
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

  /* ---------- state and camera ---------- */
  const HOME = { az: -1.1, el: 0.62 };
  const st = { az: HOME.az, el: HOME.el, dist: 700, tx: 0, tz: 0, lift: 0, exag: 1, year: 1, change: 0, userLift: 1 };
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

  function drawMesh(m, yOff, ym){
    attr(m.grid, 0, 2); attr(m.hts, 1, 2); attr(m.n1, 2, 3); attr(m.n2, 3, 3); attr(m.chg, 4, 1);
    gl.uniform1f(U.uYOff, yOff);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
    gl.drawElements(gl.TRIANGLES, m.count, m.type, 0);
  }

  function draw(){
    const w = canvas.width, h = canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(BG[0], BG[1], BG[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!mesh) return;
    const ym = yearMix(), A = texture(ym.i), B = texture(ym.i + 1);
    uploadedThisFrame = false;
    const texA = gpu(A), texB = gpu(B);
    if (!texA) return;
    const lift = ym.lift * st.lift * st.userLift;
    gl.enable(gl.DEPTH_TEST);
    const M = frameMatrices();
    gl.useProgram(prog);
    gl.uniformMatrix4fv(U.uProj, false, M.proj);
    gl.uniformMatrix4fv(U.uView, false, M.view);
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
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB || texA);
    gl.uniform1i(U.uTexA, 0); gl.uniform1i(U.uTexB, 1);
    gl.uniform1f(U.uMix, texB ? ym.f : 0);
    gl.uniform1f(U.uOrthoA, years[ym.i].ortho ? 1 : 0);
    gl.uniform1f(U.uOrthoB, years[ym.i + 1].ortho ? 1 : 0);
    drawMesh(sea, -0.4, ym);
    gl.uniform1f(U.uChange, st.change);
    drawMesh(mesh, 0, ym);
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
  function openSpot(id, fly){
    const info = texts.spots[id], s = lab.spots[id];
    if (!info || !panel) return;
    activeSpot = id;
    for (const k of Object.keys(pins)) pins[k].classList.toggle('is-on', k === id);
    const img = (src, alt, cap) => '<figure><img src="' + esc(asset(src)) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async"><figcaption>' + cap + '</figcaption></figure>';
    let html = '<p>' + esc(pick(info.text)) + '</p><div class="spot-aerial">'
      + img(s.images['1962'], pick(info.name) + ' 1962', esc(T.aerial1962))
      + img(s.images.latest, pick(info.name) + ' ' + T.aerialLatest, esc(T.aerialLatest)) + '</div>';
    const ph = texts.photos[id];
    if (ph && s.images.photo){
      html += img(s.images.photo, pick(ph.caption), esc(pick(ph.caption)) + ' <span class="credit">' + esc(T.photo) + ': ' + esc(ph.author)
        + ' · <a href="' + esc(ph.licenseUrl) + '" target="_blank" rel="noopener">' + esc(ph.license) + '</a> · <a href="' + esc(ph.page) + '" target="_blank" rel="noopener">Wikimedia Commons</a></span>');
    }
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
      animate({ tx: xz[0], tz: xz[1], dist: 300, el: clamp(st.el, 0.5, 0.95) }, 1200);
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
      st.az -= (e.clientX - prev[0]) * 0.006;
      st.el = clamp(st.el + (e.clientY - prev[1]) * 0.005, EL_MIN, EL_MAX);
    } else if (pointers.size === 2 && pinch0){
      const [a, b] = [...pointers.values()];
      st.dist = clamp(dist0 * pinch0 / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), D_MIN, D_MAX);
    }
    request();
  });
  const release = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = 0; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
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

  if (btnFlat) btnFlat.onclick = () => { stopSpin(); animate({ userLift: st.userLift > 0.5 ? 0 : 1 }, 1100); };
  if (btnExag) btnExag.onclick = () => { animate({ exag: st.exag > 1.5 ? 1 : 2 }, 600); };
  if (btnChange) btnChange.onclick = () => { animate({ change: st.change > 0.5 ? 0 : 1 }, 500); };
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
      Object.assign(to, { tx: xz[0], tz: xz[1], dist: 300, el: 0.72 });
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
    fetch(asset('gunkanjima-spots.json')).then(r => r.ok ? r.json() : null).catch(() => null)
  ]).then(([meta, words]) => {
    lab = meta;
    texts = words;
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
      mesh = buildMesh(g, a, b, c);
      sea = buildSea();
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
    loaded: i => texture(i).promise };
})();
