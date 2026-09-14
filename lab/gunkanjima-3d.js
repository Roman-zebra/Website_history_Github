/* Gunkanjima 1962 in 3D, a lab test for Japan Time Atlas.
   Plain WebGL, no libraries. The height grid and the photo were made from two GSI
   aerial photographs, MKU628 C18-2 and C18-3, taken on 30 May 1962. */
(function(){
  'use strict';
  const V = '1';
  const here = document.currentScript ? document.currentScript.src : location.href;
  const asset = name => new URL(name + '?v=' + V, here).href;
  const T = Object.assign({
    loading: 'Loading the 1962 photographs…',
    ready: 'Drag to turn. Scroll or pinch to zoom.',
    failed: 'The 3D data could not be loaded. Please try again later.',
    noWebgl: 'This browser cannot draw 3D, so the flat photograph is shown instead.',
    flat: 'Flat photo', raise: 'Raise in 3D', reset: 'Reset view', exag: 'Heights ×2', trueScale: 'True heights'
  }, window.LAB_TEXT || {});

  const $ = id => document.getElementById(id);
  const canvas = $('view'), status = $('viewStatus'), compass = $('viewCompass');
  const btnFlat = $('btnFlat'), btnReset = $('btnReset'), btnExag = $('btnExag');
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const say = s => { if (status) status.textContent = s; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const BG = [0.059, 0.098, 0.106];
  // Sun at about 10 a.m. on 30 May at this latitude, so the shading agrees with the photo's shadows.
  const SUN = (() => { const v = [0.492, 0.863, 0.112], l = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / l); })();
  const EL_MIN = 0.09, EL_MAX = 1.5, D_MIN = 160, D_MAX = 1800;

  function fallback(message){
    say(message);
    const img = $('viewFallback');
    if (img) img.hidden = false;
    canvas.hidden = true;
    if (compass) compass.hidden = true;
    for (const b of [btnFlat, btnReset, btnExag]) if (b) b.disabled = true;
  }

  const opts = { antialias: true, alpha: false };
  const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  if (!gl){ fallback(T.noWebgl); return; }
  const isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  const bigIndex = isGL2 || !!gl.getExtension('OES_element_index_uint');
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');

  const VS = `
    attribute vec3 aPos; attribute vec2 aUv; attribute vec3 aNor;
    uniform mat4 uProj, uView; uniform float uRot, uLift;
    varying vec2 vUv; varying vec3 vNor;
    void main(){
      float c = cos(uRot), s = sin(uRot);
      vec3 p = vec3(aPos.x * c - aPos.z * s, aPos.y * uLift, aPos.x * s + aPos.z * c);
      vec3 n = normalize(vec3(aNor.x * uLift, aNor.y, aNor.z * uLift));
      vNor = vec3(n.x * c - n.z * s, n.y, n.x * s + n.z * c);
      vUv = aUv;
      gl_Position = uProj * uView * vec4(p, 1.0);
    }`;
  const FS = `
    precision mediump float;
    uniform sampler2D uTex; uniform vec3 uBg, uSun; uniform float uShade;
    varying vec2 vUv; varying vec3 vNor;
    void main(){
      vec3 t = texture2D(uTex, vUv).rgb;
      vec3 n = normalize(vNor);
      float d = max(dot(n, uSun), 0.0);
      vec3 col = t * mix(1.0, 0.5 + 0.62 * d, uShade);
      /* A height grid drags the photo down every wall into streaks, so steep faces get plain shaded concrete. */
      float steep = smoothstep(0.8, 0.35, n.y) * uShade;
      col = mix(col, vec3(0.6, 0.59, 0.56) * (0.4 + 0.6 * d), steep);
      float edge = smoothstep(0.5, 0.33, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));
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
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.bindAttribLocation(prog, 1, 'aUv');
  gl.bindAttribLocation(prog, 2, 'aNor');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)){ fallback(T.noWebgl); return; }
  const U = {};
  for (const n of ['uProj', 'uView', 'uRot', 'uLift', 'uTex', 'uBg', 'uSun', 'uShade']) U[n] = gl.getUniformLocation(prog, n);

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
    let xx = zz, xy = 0, xz = -zx;                        // up = (0, 1, 0)
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1]);
  }

  /* Grid node (i, j) is pixel (x0 + i*step, y0 + j*step) of the photo. A roof seen off-centre
     leans away from the point straight below the camera by r*h/H, so it is pulled back. */
  function buildIsland(meta, view){
    const g = meta.grid, w = g.w, rows = g.h, size = meta.texture.size, mpp = meta.texture.metersPerPixel;
    const c = size / 2, ppx = meta.principalPoint[0], ppy = meta.principalPoint[1], H = meta.flyingHeightM;
    const n = w * rows, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), nor = new Float32Array(n * 3);
    for (let j = 0; j < rows; j++) for (let i = 0; i < w; i++){
      const k = j * w + i, h = view.getUint16(k * 2, true) * g.unit;
      const u = g.x0 + i * g.step, v = g.y0 + j * g.step, f = 1 - h / H;
      pos[k * 3] = (ppx + (u - ppx) * f - c) * mpp;
      pos[k * 3 + 1] = h;
      pos[k * 3 + 2] = (ppy + (v - ppy) * f - c) * mpp;
      uv[k * 2] = (u + 0.5) / size;
      uv[k * 2 + 1] = (v + 0.5) / size;
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < w; i++){
      const k = j * w + i;
      const l = j * w + Math.max(i - 1, 0), r = j * w + Math.min(i + 1, w - 1);
      const up = Math.max(j - 1, 0) * w + i, dn = Math.min(j + 1, rows - 1) * w + i;
      const ax = pos[r * 3] - pos[l * 3], ay = pos[r * 3 + 1] - pos[l * 3 + 1], az = pos[r * 3 + 2] - pos[l * 3 + 2];
      const bx = pos[dn * 3] - pos[up * 3], by = pos[dn * 3 + 1] - pos[up * 3 + 1], bz = pos[dn * 3 + 2] - pos[up * 3 + 2];
      let nx = by * az - bz * ay, ny = bz * ax - bx * az, nz = bx * ay - by * ax;
      const len = Math.hypot(nx, ny, nz) || 1;
      nor[k * 3] = nx / len; nor[k * 3 + 1] = ny / len; nor[k * 3 + 2] = nz / len;
    }
    let step = 1, gw = w, gh = rows;
    if (n > 65535 && !bigIndex){ step = 2; gw = Math.ceil(w / 2); gh = Math.ceil(rows / 2); }
    const tris = (gw - 1) * (gh - 1) * 2;
    const idx = n > 65535 && bigIndex ? new Uint32Array(tris * 3) : new Uint16Array(tris * 3);
    let p = 0;
    for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++){
      const jj = Math.min(j * step, rows - 1), jn = Math.min((j + 1) * step, rows - 1);
      const ii = Math.min(i * step, w - 1), in_ = Math.min((i + 1) * step, w - 1);
      const a = jj * w + ii, b = jj * w + in_, d = jn * w + ii, e = jn * w + in_;
      idx[p++] = a; idx[p++] = d; idx[p++] = b;
      idx[p++] = b; idx[p++] = d; idx[p++] = e;
    }
    if (idx instanceof Uint16Array && n > 65535){
      // Without 32-bit indices only every other node is addressable: rebuild the vertex arrays to match.
      const m = gw * gh, pos2 = new Float32Array(m * 3), uv2 = new Float32Array(m * 2), nor2 = new Float32Array(m * 3);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++){
        const s = Math.min(j * step, rows - 1) * w + Math.min(i * step, w - 1), t = j * gw + i;
        pos2.set(pos.subarray(s * 3, s * 3 + 3), t * 3); uv2.set(uv.subarray(s * 2, s * 2 + 2), t * 2); nor2.set(nor.subarray(s * 3, s * 3 + 3), t * 3);
      }
      p = 0;
      for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++){
        const a = j * gw + i, b = a + 1, d = a + gw, e = d + 1;
        idx[p++] = a; idx[p++] = d; idx[p++] = b; idx[p++] = b; idx[p++] = d; idx[p++] = e;
      }
      return { pos: buffer(pos2), uv: buffer(uv2), nor: buffer(nor2), idx: buffer(idx, gl.ELEMENT_ARRAY_BUFFER), count: idx.length, type: gl.UNSIGNED_SHORT };
    }
    return { pos: buffer(pos), uv: buffer(uv), nor: buffer(nor), idx: buffer(idx, gl.ELEMENT_ARRAY_BUFFER),
             count: idx.length, type: idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
  }

  function buildSea(meta){
    const half = meta.texture.size / 2 * meta.texture.metersPerPixel, y = -0.4;
    return {
      pos: buffer(new Float32Array([-half, y, -half, half, y, -half, -half, y, half, half, y, half])),
      uv: buffer(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])),
      nor: buffer(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0])),
      idx: buffer(new Uint16Array([0, 2, 1, 1, 2, 3]), gl.ELEMENT_ARRAY_BUFFER), count: 6, type: gl.UNSIGNED_SHORT
    };
  }

  function loadImage(src){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image ' + src));
      img.src = src;
    });
  }
  const ok = r => { if (!r.ok) throw new Error(r.status + ' ' + r.url); return r; };

  const HOME = { az: -1.1, el: 0.46 };
  const cam = { az: HOME.az, el: HOME.el, dist: 900 };
  const target = [0, 14, 0];
  let rot = 0, lift = 0, exag = 1, island = null, sea = null, anim = null, spin = false, queued = false;

  function homeDistance(){
    const aspect = canvas.width / Math.max(1, canvas.height);
    return clamp(540 * Math.max(1, 1.45 / aspect), D_MIN, D_MAX);
  }

  function draw(){
    const w = canvas.width, h = canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(BG[0], BG[1], BG[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!island) return;
    gl.enable(gl.DEPTH_TEST);
    const ce = Math.cos(cam.el);
    const eye = [target[0] + cam.dist * ce * Math.sin(cam.az), target[1] + cam.dist * Math.sin(cam.el), target[2] + cam.dist * ce * Math.cos(cam.az)];
    gl.useProgram(prog);
    gl.uniformMatrix4fv(U.uProj, false, perspective(0.7, w / Math.max(1, h), 2, 6000));
    gl.uniformMatrix4fv(U.uView, false, lookAt(eye, target));
    gl.uniform1f(U.uRot, rot);
    gl.uniform1f(U.uLift, lift * exag);
    gl.uniform1f(U.uShade, Math.min(1, lift));
    gl.uniform3fv(U.uBg, BG);
    gl.uniform3fv(U.uSun, SUN);
    gl.uniform1i(U.uTex, 0);
    for (const m of [sea, island]){
      attr(m.pos, 0, 3); attr(m.uv, 1, 2); attr(m.nor, 2, 3);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
      gl.drawElements(gl.TRIANGLES, m.count, m.type, 0);
    }
    if (compass) compass.style.transform = 'rotate(' + (cam.az * 180 / Math.PI).toFixed(1) + 'deg)';
  }

  function frame(now){
    queued = false;
    if (anim) anim(now);
    if (spin) cam.az -= 0.0016;
    draw();
    if (anim || spin) request();
  }
  function request(){ if (!queued){ queued = true; requestAnimationFrame(frame); } }

  function animate(to, ms, done){
    if (reduce || ms <= 0){ Object.assign(state(), to); anim = null; request(); if (done) done(); return; }
    const from = {}; for (const k of Object.keys(to)) from[k] = state()[k];
    const t0 = performance.now();
    anim = now => {
      const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const s = {}; for (const key of Object.keys(to)) s[key] = from[key] + (to[key] - from[key]) * e;
      Object.assign(state(), s);
      if (k >= 1){ anim = null; if (done) done(); }
    };
    request();
  }
  /* One object so animate() can tween lift and the camera together. */
  const live = {};
  Object.defineProperties(live, {
    lift: { get: () => lift, set: v => { lift = v; } },
    exag: { get: () => exag, set: v => { exag = v; } },
    az: { get: () => cam.az, set: v => { cam.az = v; } },
    el: { get: () => cam.el, set: v => { cam.el = v; } },
    dist: { get: () => cam.dist, set: v => { cam.dist = v; } }
  });
  const state = () => live;

  function stopSpin(){ spin = false; }

  function paintButtons(){
    if (btnFlat) btnFlat.textContent = lift > 0.5 ? T.flat : T.raise;
    if (btnFlat) btnFlat.setAttribute('aria-pressed', String(lift <= 0.5));
    if (btnExag){ btnExag.textContent = exag > 1 ? T.trueScale : T.exag; btnExag.setAttribute('aria-pressed', String(exag > 1)); }
    if (btnReset) btnReset.textContent = T.reset;
  }

  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
    request();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  resize();

  const pointers = new Map();
  let pinch0 = 0, dist0 = 0;
  canvas.addEventListener('pointerdown', e => {
    stopSpin();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2){ const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); dist0 = cam.dist; }
  });
  canvas.addEventListener('pointermove', e => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1){
      cam.az -= (e.clientX - prev[0]) * 0.006;
      cam.el = clamp(cam.el + (e.clientY - prev[1]) * 0.005, EL_MIN, EL_MAX);
    } else if (pointers.size === 2 && pinch0){
      const [a, b] = [...pointers.values()];
      cam.dist = clamp(dist0 * pinch0 / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), D_MIN, D_MAX);
    }
    request();
  });
  const release = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = 0; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    stopSpin();
    cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0012), D_MIN, D_MAX);
    request();
  }, { passive: false });
  canvas.addEventListener('keydown', e => {
    const moves = { ArrowLeft: () => { cam.az += 0.08; }, ArrowRight: () => { cam.az -= 0.08; },
      ArrowUp: () => { cam.el = clamp(cam.el + 0.06, EL_MIN, EL_MAX); }, ArrowDown: () => { cam.el = clamp(cam.el - 0.06, EL_MIN, EL_MAX); },
      '+': () => { cam.dist = clamp(cam.dist / 1.15, D_MIN, D_MAX); }, '=': () => { cam.dist = clamp(cam.dist / 1.15, D_MIN, D_MAX); },
      '-': () => { cam.dist = clamp(cam.dist * 1.15, D_MIN, D_MAX); } };
    if (!moves[e.key]) return;
    e.preventDefault();
    stopSpin();
    moves[e.key]();
    request();
  });

  if (btnFlat) btnFlat.onclick = () => { stopSpin(); animate({ lift: lift > 0.5 ? 0 : 1 }, 1100, paintButtons); paintButtons(); };
  if (btnExag) btnExag.onclick = () => { exag = exag > 1 ? 1 : 2; paintButtons(); request(); };
  if (btnReset) btnReset.onclick = () => { stopSpin(); animate({ az: HOME.az, el: HOME.el, dist: homeDistance(), lift: 1 }, 900, paintButtons); };

  say(T.loading);
  for (const b of [btnFlat, btnReset, btnExag]) if (b) b.disabled = true;
  Promise.all([
    fetch(asset('gunkanjima-1962.json')).then(ok).then(r => r.json()),
    fetch(asset('gunkanjima-1962-height.bin')).then(ok).then(r => r.arrayBuffer()),
    loadImage(asset('gunkanjima-1962.jpg'))
  ]).then(([meta, buf, img]) => {
    if (buf.byteLength !== meta.grid.w * meta.grid.h * 2) throw new Error('height grid size');
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    rot = -Math.atan2(meta.north[0], -meta.north[1]);
    island = buildIsland(meta, new DataView(buf));
    sea = buildSea(meta);
    for (const b of [btnFlat, btnReset, btnExag]) if (b) b.disabled = false;
    say(T.ready);
    cam.dist = homeDistance();
    if (reduce){ lift = 1; paintButtons(); request(); return; }
    cam.el = 1.2;
    animate({ lift: 1, el: HOME.el }, 2200, () => { paintButtons(); spin = true; request(); });
    paintButtons();
  }).catch(err => {
    console.error(err);
    fallback(T.failed);
  });

  window.jtaLab3d = { cam, draw: () => draw(), setLift: v => { lift = v; draw(); } };
})();
