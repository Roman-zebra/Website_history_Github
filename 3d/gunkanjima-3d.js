/* Gunkanjima, 1947 to today: a lab test for Japan Time Atlas. Plain WebGL, no libraries.
   Version 4 is a reconstruction model rather than a raw height field: the terrain is GSI's 5 m
   elevation, the sea wall is the OpenStreetMap ring, and every building is a prism drawn from its
   outline, its storey count and its completion year from the published building list, so the slider
   shows each building rising in the year it was built and falling when it collapsed. Façades are
   drawn by style (workers' housing with open galleries, apartment blocks, the school, workshops,
   wooden houses, the shrine) and are a drawing, not a photograph. Roofs and ground carry the aerial
   photograph of the chosen year; the sun of 30 May casts shadows through a shadow map. */
(function(){
  'use strict';
  const V = '4';
  const here = document.currentScript ? document.currentScript.src : location.href;
  const asset = name => new URL(name + '?v=' + V, here).href;
  const LANG = window.LAB_LANG || 'en';
  const T = Object.assign({
    loading: 'Loading the photographs…', ready: 'Drag to turn. Scroll or pinch to zoom. Shift-drag to move.',
    failed: 'The 3D data could not be loaded. Please try again later.',
    noWebgl: 'This browser cannot draw 3D, so the flat photograph is shown instead.',
    flat: 'Flat photo', raise: 'Raise in 3D', reset: 'Reset view', exag: 'Heights ×2', trueScale: 'True heights',
    change: 'Show change', changeOff: 'Hide change', latest: 'Latest', play: 'Play the years', pause: 'Pause',
    walls: 'Buildings: on', wallsOff: 'Buildings: off', labels: 'Names: on', labelsOff: 'Names: off',
    loadingYear: 'Loading the photograph…', yearFlat: 'Buildings with a known completion date up to this year',
    yearMeasured: 'Buildings that stood in this year, from the building list and the photographs', yearShape1962: 'Buildings that stood in this year',
    yearShape2010: 'Buildings still standing; collapsed ones are gone', close: 'Close', sources: 'Sources',
    aerial1962: '1962', aerialLatest: 'Latest', photo: 'Photo', built: 'Completed', storeys: 'Storeys', units: 'Units', use: 'Use',
    structure: 'Structure', gone: 'Collapsed', unknown: 'unknown', traced: 'Outline traced from the 1962 photograph; name unknown',
    factsSource: 'Building list: Japanese Wikipedia, 端島 (長崎県)', schoolShort: 'School'
  }, window.LAB_TEXT || {});

  const $ = id => document.getElementById(id);
  const canvas = $('view'), status = $('viewStatus'), compass = $('viewCompass');
  const btnFlat = $('btnFlat'), btnReset = $('btnReset'), btnExag = $('btnExag'), btnChange = $('btnChange'), btnWalls = $('btnWalls'), btnLabels = $('btnLabels');
  const yearRange = $('yearRange'), yearLabel = $('yearLabel'), yearNote = $('yearNote'), yearTicks = $('yearTicks'), btnPlay = $('btnPlayYears');
  const spotLayer = $('spotLayer'), panel = $('spotPanel');
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const lowEnd = !!((window.matchMedia && matchMedia('(max-width: 720px)').matches) || (navigator.deviceMemory && navigator.deviceMemory <= 4));
  const say = s => { if (status) status.textContent = s; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pick = obj => obj ? (obj[LANG] || obj.en || '') : '';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const BG = [0.075, 0.117, 0.13], HORIZON = [0.40, 0.47, 0.50], SKY_TOP = [0.10, 0.16, 0.20];
  const SUN = (() => { const v = [0.492, 0.863, 0.112], l = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / l); })();
  const EL_MIN = 0.06, EL_MAX = 1.5, D_MIN = 40, D_MAX = 1800;
  const STYLE = { apartment: 1, nikkyu: 2, school: 3, industrial: 4, wood: 5, shrine: 6 };
  const controls = [btnFlat, btnReset, btnExag, btnChange, btnWalls, btnLabels, yearRange, btnPlay];

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
    uniform mediump float uMorph, uYear;   /* years are sent as (year - 1900) so mediump is exact enough */
    uniform vec2 uPP;
    varying vec4 vShadow; varying float vDepth;
    vec3 place(vec2 g, float h){
      vec2 xz = (g - vec2(uC)) * uMpp;
      float c = cos(uRot), s = sin(uRot);
      return vec3(xz.x * c - xz.y * s, h * uExag + uYOff, xz.x * s + xz.y * c);
    }
    vec3 turn(vec3 n){ float c = cos(uRot), s = sin(uRot); return vec3(n.x * c - n.z * s, n.y, n.x * s + n.z * c); }
    void finish(vec3 p){ vShadow = uLightPV * vec4(p, 1.0); vec4 q = uPV * vec4(p, 1.0); vDepth = q.w; gl_Position = q; }
    /* a building stands from its completion year to its collapse; it rises over about a year */
    float standing(vec2 life){
      float up = smoothstep(life.x - 1.2, life.x, uYear);
      float down = life.y > 0.0 ? 1.0 - smoothstep(life.y - 1.0, life.y + 0.5, uYear) : 1.0;
      return up * down;
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
    }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }`;
  // ground and sea: the aerial photograph draped on the terrain
  const TERRAIN_VS = COMMON_VS + `
    attribute vec2 aGrid; attribute float aH; attribute vec3 aNor; attribute float aSea;
    varying vec2 vUvP; varying vec2 vUvO; varying vec3 vNor; varying float vSea; varying vec3 vPos;
    void main(){
      float h = aH * uLift;
      vec2 g = uPP + (aGrid - uPP) * (1.0 - h / uHf);
      float e = uLift * uExag;
      vNor = turn(normalize(vec3(aNor.x * e, aNor.y, aNor.z * e)));
      vUvP = (aGrid + 0.5) / (2.0 * uC); vUvO = (g + 0.5) / (2.0 * uC); vSea = aSea;
      vec3 p = place(g, h); vPos = p;
      finish(p);
    }`;
  const TERRAIN_FS = `
    precision mediump float;
    uniform sampler2D uTexA, uTexB;
    uniform float uMix, uOrthoA, uOrthoB, uShade, uChange, uFog, uTime;
    uniform vec3 uBg, uSun, uHorizon;
    varying vec2 vUvP; varying vec2 vUvO; varying vec3 vNor; varying float vSea; varying vec3 vPos;
    varying vec4 vShadow; varying float vDepth;
    ` + SHADOW_FN + `
    void main(){
      vec3 a = texture2D(uTexA, mix(vUvP, vUvO, uOrthoA)).rgb;
      vec3 b = texture2D(uTexB, mix(vUvP, vUvO, uOrthoB)).rgb;
      vec3 t = mix(a, b, uMix);
      vec3 n = normalize(vNor);
      if (vSea > 0.5){
        /* water: small moving ripples tilt the normal, a soft sun glint, deeper tone away from the shore */
        float r1 = noise(vPos.xz * 0.35 + vec2(uTime * 0.05, uTime * 0.03)), r2 = noise(vPos.xz * 0.9 - vec2(uTime * 0.04, 0.0));
        n = normalize(vec3((r1 - 0.5) * 0.25, 1.0, (r2 - 0.5) * 0.25));
      }
      float d = max(dot(n, uSun), 0.0);
      float sh = shadowAt(vShadow, 0.0022);
      float light = mix(1.0, min(1.0, 0.42 + 0.6 * d * mix(0.35, 1.0, sh)), uShade);
      vec3 col = t * light;
      float edge = smoothstep(0.5, 0.36, max(abs(vUvP.x - 0.5), abs(vUvP.y - 0.5)));
      if (vSea > 0.5){
        vec3 sea = mix(vec3(0.06, 0.13, 0.17), vec3(0.12, 0.25, 0.31), d);
        vec3 eye = normalize(-vPos + vec3(0.0, 300.0, 0.0));
        float glint = pow(max(dot(reflect(-uSun, n), eye), 0.0), 60.0) * 0.3;
        float foam = smoothstep(0.86, 0.98, noise(vPos.xz * 0.12 + vec2(uTime * 0.02, 0.0))) * 0.08;
        col = sea + glint + foam;
        edge = 1.0;
      }
      col = mix(col, uHorizon, uFog * smoothstep(500.0, 2400.0, vDepth));
      col = mix(uBg, col, edge);
      gl_FragColor = vec4(col, 1.0);
    }`;
  // building walls
  const WALL_VS = COMMON_VS + `
    attribute vec2 aPos; attribute vec2 aY; attribute vec3 aNor; attribute vec3 aWall; attribute vec4 aInfo; attribute vec2 aLife;
    varying vec3 vNor; varying vec3 vWall; varying vec4 vInfo; varying float vAlive; varying float vTop;
    void main(){
      float alive = standing(aLife);
      float y = mix(aY.x, aY.x + (aY.y - aY.x) * alive, uLift);
      vNor = turn(aNor);
      vWall = vec3(aWall.x, (y - aY.x) * uExag, (aY.y - aY.x) * alive * uExag);
      vInfo = aInfo; vAlive = alive; vTop = aWall.z;
      finish(place(aPos, y));
    }`;
  const WALL_FS = `
    precision mediump float;
    uniform float uChange, uFog, uShade, uYear;
    uniform vec3 uBg, uSun, uHorizon;
    varying vec3 vNor; varying vec3 vWall; varying vec4 vInfo; varying float vAlive; varying float vTop;
    varying vec4 vShadow; varying float vDepth;
    ` + SHADOW_FN + `
    void main(){
      if (vAlive < 0.02) discard;
      vec3 n = normalize(vNor);
      float d = max(dot(n, uSun), 0.0);
      float sh = shadowAt(vShadow, 0.003);
      float style = vInfo.x, floorH = vInfo.y, seed = vInfo.z, gone = vInfo.w;
      float y = vWall.y, s = vWall.x, H = vWall.z;
      float age = clamp((uYear - 74.0) / 36.0, 0.0, 1.0);
      float fy = fract(y / floorH), storey = floor(y / floorH);
      vec3 base = vec3(0.70, 0.68, 0.64);
      float win = 0.0, recess = 0.0, rail = 0.0, column = 0.0, plank = 0.0;
      float cell = hash(vec2(floor(s / 2.4), storey + seed * 7.0));
      if (style < 1.5){            /* apartment block: windows in rows, slab lines, some balconies */
        float fx = fract(s / 2.4);
        win = step(0.32, fy) * step(fy, 0.78) * step(0.2, fx) * step(fx, 0.72);
        float balcony = step(0.5, hash(vec2(seed * 13.0, 1.0)));
        recess = balcony * step(0.02, fy) * step(fy, 0.32) * step(0.08, fx) * step(fx, 0.95) * 0.5;
        rail = balcony * step(0.26, fy) * step(fy, 0.32) * 0.6;
      } else if (style < 2.5){     /* workers' housing of 1918: open galleries stacked floor on floor */
        float fx = fract(s / 3.2);
        recess = step(0.36, fy) * step(fy, 0.96) * 0.75;
        column = step(0.36, fy) * step(fy, 0.96) * (1.0 - step(0.06, fx) * step(fx, 0.94));
        rail = step(0.24, fy) * step(fy, 0.36) * 0.7;
        win = step(0.45, fy) * step(fy, 0.85) * step(0.25, fx) * step(fx, 0.75) * 0.7;
        base = vec3(0.66, 0.64, 0.60);
      } else if (style < 3.5){     /* school: ribbon windows with thin mullions */
        float fx = fract(s / 1.8);
        win = step(0.34, fy) * step(fy, 0.82) * step(0.06, fx);
        base = vec3(0.74, 0.72, 0.68);
      } else if (style < 4.5){     /* workshop: sheet walls with a few tall openings */
        float fx = fract(s / 5.0);
        win = step(0.35, fy) * step(fy, 0.8) * step(0.3, fx) * step(fx, 0.7);
        plank = 0.5 + 0.5 * step(0.5, fract(s * 1.4));
        base = vec3(0.52, 0.50, 0.47) * (0.9 + 0.1 * plank);
      } else if (style < 5.5){     /* wooden house: dark boards, small windows */
        float fx = fract(s / 2.0);
        plank = step(0.5, fract(y * 4.0));
        base = mix(vec3(0.36, 0.31, 0.26), vec3(0.42, 0.37, 0.31), plank);
        win = step(0.4, fy) * step(fy, 0.75) * step(0.3, fx) * step(fx, 0.65);
      } else {                     /* shrine: whitewashed stone with a dark plinth */
        base = vec3(0.82, 0.80, 0.74);
        win = step(0.45, fy) * step(fy, 0.75) * step(0.35, fract(s / 2.0)) * step(fract(s / 2.0), 0.65) * 0.6;
      }
      float slab = (1.0 - smoothstep(0.0, 0.05, fy)) * 0.5;                 /* floor slab line */
      float parapet = smoothstep(H - 0.9, H - 0.6, y);                        /* top band */
      float plinth = 1.0 - smoothstep(0.0, 1.2, y);                            /* darker base */
      vec3 col = base * (1.0 + 0.08 * slab + 0.06 * parapet) * (1.0 - 0.18 * plinth);
      col = mix(col, col * 0.55, recess);
      col = mix(col, base * 1.08, rail);
      col = mix(col, base * 1.04, column * 0.8);
      float open = step(0.6, cell) * age;
      vec3 glass = mix(vec3(0.24, 0.27, 0.30), vec3(0.09, 0.08, 0.07), open) * (0.75 + 0.25 * cell);
      col = mix(col, glass, win);
      /* weathering after 1974: streaks, stains, moss near the ground */
      float streak = noise(vec2(s * 1.5, y * 0.3 + seed * 5.0));
      col *= 1.0 - age * (0.25 * streak + 0.1 * smoothstep(3.0, 0.0, y));
      col = mix(col, vec3(0.30, 0.36, 0.22), age * 0.35 * smoothstep(2.5, 0.0, y) * noise(vec2(s * 0.7, seed * 3.0)));
      float light = 0.32 + 0.62 * d * mix(0.35, 1.0, sh);
      col *= mix(1.0, light, uShade);
      if (uChange > 0.001){
        vec3 grey = vec3(dot(col, vec3(0.299, 0.587, 0.114)));
        vec3 flag = gone > 0.0 && gone <= 110.0 ? vec3(0.88, 0.22, 0.16) : vec3(0.35, 0.55, 0.85);
        col = mix(col, mix(grey, flag, 0.75) * (0.55 + 0.45 * d), uChange);
      }
      col = mix(col, uHorizon, uFog * smoothstep(500.0, 2400.0, vDepth));
      gl_FragColor = vec4(col, 1.0);
    }`;
  // roofs: the aerial photograph of the year, drawn where the roof is in that photograph
  const ROOF_VS = COMMON_VS + `
    attribute vec2 aPos; attribute vec2 aY; attribute vec2 aLife; attribute vec2 aInfo;
    varying vec2 vUvP; varying vec2 vUvO; varying float vAlive; varying vec2 vInfo; varying vec2 vPos;
    void main(){
      float alive = standing(aLife);
      float y = mix(aY.x, aY.x + (aY.y - aY.x) * alive, uLift);
      vec2 photo = uPP + (aPos - uPP) / (1.0 - y / uHf);      /* where this roof appears in the photograph */
      vUvP = (photo + 0.5) / (2.0 * uC); vUvO = (aPos + 0.5) / (2.0 * uC);
      vAlive = alive; vInfo = aInfo; vPos = aPos;
      finish(place(aPos, y));
    }`;
  const ROOF_FS = `
    precision mediump float;
    uniform sampler2D uTexA, uTexB;
    uniform float uMix, uOrthoA, uOrthoB, uShade, uChange, uFog, uYear;
    uniform vec3 uBg, uSun, uHorizon;
    varying vec2 vUvP; varying vec2 vUvO; varying float vAlive; varying vec2 vInfo; varying vec2 vPos;
    varying vec4 vShadow; varying float vDepth;
    ` + SHADOW_FN + `
    void main(){
      if (vAlive < 0.02) discard;
      vec3 a = texture2D(uTexA, mix(vUvP, vUvO, uOrthoA)).rgb;
      vec3 b = texture2D(uTexB, mix(vUvP, vUvO, uOrthoB)).rgb;
      vec3 t = mix(a, b, uMix);
      float style = vInfo.x, seed = vInfo.y;
      float sh = shadowAt(vShadow, 0.0022);
      float d = max(dot(vec3(0.0, 1.0, 0.0), uSun), 0.0);
      /* the photograph carries the roof; a faint concrete tone keeps it from looking like paper */
      vec3 roof = style > 4.5 && style < 5.5 ? vec3(0.30, 0.27, 0.24) : vec3(0.62, 0.60, 0.57);
      vec3 col = mix(t, roof * (0.6 + 0.4 * dot(t, vec3(0.33))), vAlive < 0.98 ? 0.8 : 0.25);
      col *= mix(1.0, 0.42 + 0.6 * d * mix(0.35, 1.0, sh), uShade);
      if (uChange > 0.001){ vec3 grey = vec3(dot(col, vec3(0.299, 0.587, 0.114))); col = mix(col, grey * 0.9, 0.5 * uChange); }
      col = mix(col, uHorizon, uFog * smoothstep(500.0, 2400.0, vDepth));
      gl_FragColor = vec4(col, 1.0);
    }`;
  // the sea wall ring
  const SEAWALL_FS = `
    precision mediump float;
    uniform float uChange, uFog, uShade, uYear;
    uniform vec3 uBg, uSun, uHorizon;
    varying vec3 vNor; varying vec3 vWall; varying vec4 vInfo; varying float vAlive; varying float vTop;
    varying vec4 vShadow; varying float vDepth;
    ` + SHADOW_FN + `
    void main(){
      vec3 n = normalize(vNor);
      float d = max(dot(n, uSun), 0.0);
      float sh = shadowAt(vShadow, 0.003);
      float y = vWall.y, s = vWall.x;
      float course = step(0.92, fract(y / 1.5)) * 0.3 + step(0.94, fract(s / 6.0)) * 0.25;   /* joints between blocks */
      float age = clamp((uYear - 74.0) / 36.0, 0.0, 1.0);
      vec3 col = vec3(0.60, 0.58, 0.54) * (1.0 - course) * (0.92 + 0.16 * noise(vec2(s * 0.6, y * 0.8)));
      col = mix(col, vec3(0.22, 0.24, 0.22), smoothstep(2.2, 0.0, y));                         /* wet band at the waterline */
      col *= 1.0 - age * 0.2 * noise(vec2(s * 0.3, y));
      col *= mix(1.0, 0.32 + 0.62 * d * mix(0.35, 1.0, sh), uShade);
      col = mix(col, uHorizon, uFog * smoothstep(500.0, 2400.0, vDepth));
      gl_FragColor = vec4(col, 1.0);
    }`;
  const SKY_VS = `attribute vec2 aPos; varying vec2 vP; void main(){ vP = aPos; gl_Position = vec4(aPos, 0.9999, 1.0); }`;
  const SKY_FS = `precision mediump float; uniform vec3 uTop, uHorizon; uniform float uEl; varying vec2 vP;
    void main(){ float k = smoothstep(-0.2, 1.0, vP.y + uEl * 0.6); gl_FragColor = vec4(mix(uHorizon, uTop, k), 1.0); }`;
  const DEPTH_FS = `precision mediump float; void main(){ gl_FragColor = vec4(1.0); }`;
  const DEPTH_FS_ALIVE = `precision mediump float; varying float vAlive; void main(){ if (vAlive < 0.02) discard; gl_FragColor = vec4(1.0); }`;

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
  const COMMON_U = ['uPV', 'uLightPV', 'uRot', 'uLift', 'uExag', 'uMorph', 'uMpp', 'uC', 'uHf', 'uYOff', 'uPP', 'uYear', 'uShadowMap', 'uShadowOn', 'uShadowTexel', 'uFog', 'uShade', 'uChange', 'uBg', 'uSun', 'uHorizon', 'uTime'];
  const TEX_U = ['uTexA', 'uTexB', 'uMix', 'uOrthoA', 'uOrthoB'];
  const TERRAIN_A = ['aGrid', 'aH', 'aNor', 'aSea'], WALL_A = ['aPos', 'aY', 'aNor', 'aWall', 'aInfo', 'aLife'], ROOF_A = ['aPos', 'aY', 'aLife', 'aInfo'];
  let progT, progW, progR, progS, progSky, depthT, depthW, depthR;
  try {
    progT = program(TERRAIN_VS, TERRAIN_FS, TERRAIN_A, COMMON_U.concat(TEX_U));
    progW = program(WALL_VS, WALL_FS, WALL_A, COMMON_U);
    progR = program(ROOF_VS, ROOF_FS, ROOF_A, COMMON_U.concat(TEX_U));
    progS = program(WALL_VS, SEAWALL_FS, WALL_A, COMMON_U);
    progSky = program(SKY_VS, SKY_FS, ['aPos'], ['uTop', 'uHorizon', 'uEl']);
    if (SHADOW){ depthT = program(TERRAIN_VS, DEPTH_FS, TERRAIN_A, COMMON_U); depthW = program(WALL_VS, DEPTH_FS_ALIVE, WALL_A, COMMON_U); depthR = program(ROOF_VS, DEPTH_FS_ALIVE, ROOF_A, COMMON_U); }
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
  function disableFrom(loc){ for (let i = loc; i < 8; i++) gl.disableVertexAttribArray(i); }
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

  /* ---------- geometry helpers ---------- */
  function signedArea(poly){ let a = 0; for (let i = 0; i < poly.length; i++){ const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  /* ear clipping for a simple polygon; returns index triples */
  function triangulate(poly){
    const n = poly.length, idx = [];
    for (let i = 0; i < n; i++) idx.push(i);
    if (signedArea(poly) < 0) idx.reverse();
    const tris = [];
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inside = (p, a, b, c) => cross(a, b, p) >= -1e-9 && cross(b, c, p) >= -1e-9 && cross(c, a, p) >= -1e-9;
    let guard = 0;
    while (idx.length > 3 && guard++ < 5000){
      let cut = false;
      for (let i = 0; i < idx.length; i++){
        const i0 = idx[(i + idx.length - 1) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length];
        const a = poly[i0], b = poly[i1], c = poly[i2];
        if (cross(a, b, c) <= 1e-9) continue;
        let ok = true;
        for (const j of idx){ if (j === i0 || j === i1 || j === i2) continue; if (inside(poly[j], a, b, c)){ ok = false; break; } }
        if (!ok) continue;
        tris.push(i0, i1, i2);
        idx.splice(i, 1);
        cut = true;
        break;
      }
      if (!cut){
        for (let i = 1; i < idx.length - 1; i++) tris.push(idx[0], idx[i], idx[i + 1]);
        return tris;
      }
    }
    if (idx.length === 3) tris.push(idx[0], idx[1], idx[2]);
    return tris;
  }
  function centroid(poly){ let x = 0, y = 0; for (const p of poly){ x += p[0]; y += p[1]; } return [x / poly.length, y / poly.length]; }

  /* ---------- data ---------- */
  let lab = null, model = null, texts = null, photos = {}, terrain = null, sea = null, walls = null, roofs = null, seawall = null;
  let rot = 0, mpp = 0.8, C = 512, PP = [512, 512], HF = 1950;
  const years = [], texCache = new Map();
  const YEAR_OF = { '1947': 1947, '1962': 1962, '1975': 1975, '2010': 2010, 'latest': 2024 };

  function normals(h, w, hh, step){
    const n = new Float32Array(w * hh * 3), d = 2 * step * mpp;
    for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++){
      const k = j * w + i;
      const hl = h[j * w + Math.max(i - 1, 0)], hr = h[j * w + Math.min(i + 1, w - 1)];
      const hu = h[Math.max(j - 1, 0) * w + i], hd = h[Math.min(j + 1, hh - 1) * w + i];
      let nx = -(hr - hl) / d, ny = 1, nz = -(hd - hu) / d;
      const len = Math.hypot(nx, ny, nz);
      n[k * 3] = nx / len; n[k * 3 + 1] = ny / len; n[k * 3 + 2] = nz / len;
    }
    return n;
  }
  function buildTerrain(t, buf, forceStep){
    const step = forceStep || (lowEnd ? 2 : 1);
    const w = Math.floor((t.w - 1) / step) + 1, h = Math.floor((t.h - 1) / step) + 1, count = w * h;
    const v = new DataView(buf);
    const grid = new Float32Array(count * 2), hts = new Float32Array(count), seaF = new Float32Array(count);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++){
      const k = j * w + i, src = (j * step) * t.w + i * step;
      grid[k * 2] = t.x0 + i * step; grid[k * 2 + 1] = t.y0 + j * step;
      const hv = v.getUint16(src * 2, true) * t.unit;
      hts[k] = hv; seaF[k] = hv < 0.05 ? 1 : 0;
    }
    const tris = (w - 1) * (h - 1) * 2, useBig = count > 65535;
    if (useBig && !bigIndex) return buildTerrain(t, buf, step * 2);
    const idx = useBig ? new Uint32Array(tris * 3) : new Uint16Array(tris * 3);
    let p = 0;
    for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++){
      const a = j * w + i, b = a + 1, d = a + w, e = d + 1;
      idx[p++] = a; idx[p++] = d; idx[p++] = b; idx[p++] = b; idx[p++] = d; idx[p++] = e;
    }
    return { grid: buffer(grid), hts: buffer(hts), nor: buffer(normals(hts, w, h, step)), sea: buffer(seaF),
      idx: buffer(idx, gl.ELEMENT_ARRAY_BUFFER), count: idx.length, type: useBig ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, w, h, step, hts0: hts, x0: t.x0, y0: t.y0 };
  }
  function buildSea(){
    const s = C * 2 - 1;
    return { grid: buffer(new Float32Array([0, 0, s, 0, 0, s, s, s])), hts: buffer(new Float32Array(4)),
      nor: buffer(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0])), sea: buffer(new Float32Array([1, 1, 1, 1])),
      idx: buffer(new Uint16Array([0, 2, 1, 1, 2, 3]), gl.ELEMENT_ARRAY_BUFFER), count: 6, type: gl.UNSIGNED_SHORT };
  }

  /* prisms: walls (one quad per outline edge) and roofs (ear-clipped) for every building or wing */
  function lifeOf(b){
    const built = b.built || b.seen || 1950;
    return [built - 1900, b.gone ? b.gone - 1900 : 0];
  }
  function buildBuildings(list){
    const W = { pos: [], y: [], nor: [], wall: [], info: [], life: [], idx: [] };
    const R = { pos: [], y: [], life: [], info: [], idx: [] };
    let nw = 0, nr = 0, seedN = 0;
    for (const b of list){
      const parts = b.wings || [b.poly];
      const H = b.storeys * b.floorH, base = b.ground - 0.6, top = b.ground + H;
      const style = STYLE[b.style] || 1, seed = (seedN++ % 89) / 89, life = lifeOf(b);
      for (const poly of parts){
        if (poly.length < 3) continue;
        const cw = signedArea(poly) > 0;
        for (let i = 0; i < poly.length; i++){
          const p = poly[i], q = poly[(i + 1) % poly.length];
          const ex = q[0] - p[0], ey = q[1] - p[1], len = Math.hypot(ex, ey) * mpp;
          if (len < 0.3) continue;
          let nx = ey, nz = -ex;
          if (cw){ nx = -nx; nz = -nz; }
          const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
          for (const [pt, s, up] of [[p, 0, 0], [q, len, 0], [p, 0, 1], [q, len, 1]]){
            W.pos.push(pt[0], pt[1]); W.y.push(base, up ? top : base); W.nor.push(nx, 0, nz);
            W.wall.push(s, b.ground, H); W.info.push(style, b.floorH, seed, b.gone ? b.gone - 1900 : 0); W.life.push(life[0], life[1]);
          }
          W.idx.push(nw, nw + 2, nw + 1, nw + 1, nw + 2, nw + 3);
          nw += 4;
        }
        const tri = triangulate(poly);
        for (const p of poly){ R.pos.push(p[0], p[1]); R.y.push(base, top); R.life.push(life[0], life[1]); R.info.push(style, seed); }
        for (const t of tri) R.idx.push(nr + t);
        nr += poly.length;
      }
    }
    const mk = (o, keys) => {
      const out = {};
      for (const k of keys) out[k] = buffer(new Float32Array(o[k]));
      const big = o.idx.length && Math.max.apply(null, o.idx) > 65535;
      if (big && !bigIndex) return null;
      out.idx = buffer(big ? new Uint32Array(o.idx) : new Uint16Array(o.idx), gl.ELEMENT_ARRAY_BUFFER);
      out.count = o.idx.length; out.type = big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      return out;
    };
    return { walls: mk(W, ['pos', 'y', 'nor', 'wall', 'info', 'life']), roofs: mk(R, ['pos', 'y', 'life', 'info']) };
  }
  function buildSeawall(ring){
    const W = { pos: [], y: [], nor: [], wall: [], info: [], life: [], idx: [] };
    let n = 0, s0 = 0;
    const cw = signedArea(ring.map(r => [r.u, r.v])) > 0;
    for (let i = 0; i < ring.length; i++){
      const p = ring[i], q = ring[(i + 1) % ring.length];
      const ex = q.u - p.u, ey = q.v - p.v, len = Math.hypot(ex, ey) * mpp;
      if (len < 0.3) continue;
      let nx = ey, nz = -ex;
      if (cw){ nx = -nx; nz = -nz; }
      const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      for (const [pt, s, up] of [[p, s0, 0], [q, s0 + len, 0], [p, s0, 1], [q, s0 + len, 1]]){
        W.pos.push(pt.u, pt.v); W.y.push(-1.5, up ? pt.top : -1.5); W.nor.push(nx, 0, nz);
        W.wall.push(s, 0, pt.top); W.info.push(0, 1, 0, 0); W.life.push(-100, 0);
      }
      W.idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      n += 4; s0 += len;
    }
    const out = {};
    for (const k of ['pos', 'y', 'nor', 'wall', 'info', 'life']) out[k] = buffer(new Float32Array(W[k]));
    out.idx = buffer(new Uint16Array(W.idx), gl.ELEMENT_ARRAY_BUFFER); out.count = W.idx.length; out.type = gl.UNSIGNED_SHORT;
    return out;
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
  const st = { az: HOME.az, el: HOME.el, dist: 700, tx: 0, tz: 0, lift: 0, exag: 1, year: 1, change: 0, userLift: 1, walls: true, labels: true };
  let anim = null, spin = false, queued = false, activeSpot = null, t0 = performance.now();

  function homeDistance(){
    const aspect = canvas.width / Math.max(1, canvas.height);
    return clamp(540 * Math.max(1, 1.45 / aspect), D_MIN, D_MAX);
  }
  function yearMix(){
    const n = years.length, v = clamp(st.year, 0, n - 1), i = Math.min(Math.floor(v), n - 2), f = v - i;
    const ya = YEAR_OF[years[i].id] || 1962, yb = YEAR_OF[years[i + 1].id] || 1962;
    return { i, f, year: ya + (yb - ya) * f, lift: 1, morph: 0 };
  }
  function toWorld(u, v, hgt){
    const g = [PP[0] + (u - PP[0]) * (1 - hgt / HF), PP[1] + (v - PP[1]) * (1 - hgt / HF)];
    const x = (g[0] - C) * mpp, z = (g[1] - C) * mpp, c = Math.cos(rot), s = Math.sin(rot);
    return [x * c - z * s, z * c + x * s];
  }
  function toWorldTrue(u, v){
    const x = (u - C) * mpp, z = (v - C) * mpp, c = Math.cos(rot), s = Math.sin(rot);
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
    gl.uniform1f(U.uMorph, 0);
    gl.uniform1f(U.uMpp, mpp);
    gl.uniform1f(U.uC, C);
    gl.uniform1f(U.uHf, HF);
    gl.uniform2fv(U.uPP, PP);
    gl.uniform1f(U.uYear, ym.year - 1900);
    gl.uniform1f(U.uShade, Math.min(1, lift));
    gl.uniform1f(U.uChange, st.change);
    gl.uniform3fv(U.uBg, BG);
    gl.uniform3fv(U.uSun, SUN);
    gl.uniform3fv(U.uHorizon, HORIZON);
    gl.uniform1f(U.uFog, 1);
    gl.uniform1f(U.uTime, (performance.now() - t0) / 1000);
    gl.uniform1f(U.uShadowOn, shadowOn ? 1 : 0);
    gl.uniform1f(U.uShadowTexel, 1 / (SHADOW || 1));
    if (U.uShadowMap){ gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, shadowOn ? shadowTex : null); gl.uniform1i(U.uShadowMap, 2); }
  }
  function setTextures(P, texA, texB, ym){
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB || texA);
    gl.uniform1i(P.U.uTexA, 0); gl.uniform1i(P.U.uTexB, 1);
    gl.uniform1f(P.U.uMix, texB ? ym.f : 0);
    gl.uniform1f(P.U.uOrthoA, years[ym.i].ortho ? 1 : 0);
    gl.uniform1f(P.U.uOrthoB, years[ym.i + 1].ortho ? 1 : 0);
  }
  function drawTerrain(P, m, yOff){
    attr(m.grid, 0, 2); attr(m.hts, 1, 1); attr(m.nor, 2, 3); attr(m.sea, 3, 1); disableFrom(4);
    gl.uniform1f(P.U.uYOff, yOff);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
    gl.drawElements(gl.TRIANGLES, m.count, m.type, 0);
  }
  function drawWalls(P, w){
    attr(w.pos, 0, 2); attr(w.y, 1, 2); attr(w.nor, 2, 3); attr(w.wall, 3, 3); attr(w.info, 4, 4); attr(w.life, 5, 2); disableFrom(6);
    gl.uniform1f(P.U.uYOff, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, w.idx);
    gl.drawElements(gl.TRIANGLES, w.count, w.type, 0);
  }
  function drawRoofs(P, r){
    attr(r.pos, 0, 2); attr(r.y, 1, 2); attr(r.life, 2, 2); attr(r.info, 3, 2); disableFrom(4);
    gl.uniform1f(P.U.uYOff, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, r.idx);
    gl.drawElements(gl.TRIANGLES, r.count, r.type, 0);
  }
  let skyBuf = null;
  function drawSky(){
    if (!skyBuf) skyBuf = buffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(progSky.p);
    attr(skyBuf, 0, 2); disableFrom(1);
    gl.uniform3fv(progSky.U.uTop, SKY_TOP); gl.uniform3fv(progSky.U.uHorizon, HORIZON); gl.uniform1f(progSky.U.uEl, st.el);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.DEPTH_TEST);
  }

  function draw(){
    const w = canvas.width, h = canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(BG[0], BG[1], BG[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!terrain) return;
    const ym = yearMix(), A = texture(ym.i), B = texture(ym.i + 1);
    uploadedThisFrame = false;
    const texA = gpu(A), texB = gpu(B);
    if (!texA) return;
    const lift = st.lift * st.userLift;
    const showB = st.walls && walls && lift > 0.001;
    const M = frameMatrices(), lightPV = lightMatrix();
    gl.enable(gl.DEPTH_TEST);
    const shadowOn = !!(shadowFb && lift > 0.001);
    if (shadowOn){
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFb);
      gl.viewport(0, 0, SHADOW, SHADOW);
      gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
      gl.colorMask(false, false, false, false);
      gl.disable(gl.CULL_FACE);
      setCommon(depthT, lightPV, lightPV, lift, ym, false);
      drawTerrain(depthT, terrain, 0);
      if (showB){
        setCommon(depthW, lightPV, lightPV, lift, ym, false); drawWalls(depthW, walls); if (seawall) drawWalls(depthW, seawall);
        setCommon(depthR, lightPV, lightPV, lift, ym, false); drawRoofs(depthR, roofs);
      }
      gl.colorMask(true, true, true, true);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
    }
    drawSky();
    gl.disable(gl.CULL_FACE);
    setCommon(progT, M.pv, lightPV, lift, ym, shadowOn);
    setTextures(progT, texA, texB, ym);
    drawTerrain(progT, sea, -0.6);
    drawTerrain(progT, terrain, 0);
    if (showB){
      gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      setCommon(progS, M.pv, lightPV, lift, ym, shadowOn);
      if (seawall) drawWalls(progS, seawall);
      setCommon(progW, M.pv, lightPV, lift, ym, shadowOn);
      drawWalls(progW, walls);
      gl.disable(gl.CULL_FACE);
      setCommon(progR, M.pv, lightPV, lift, ym, shadowOn);
      setTextures(progR, texA, texB, ym);
      drawRoofs(progR, roofs);
    }
    placeSpots(M.pv, lift, ym);
    if (compass) compass.style.transform = 'rotate(' + (st.az * 180 / Math.PI).toFixed(1) + 'deg)';
  }

  function frame(now){
    queued = false;
    if (anim) anim(now);
    if (spin) st.az -= 0.0016;
    draw();
    if (anim || spin || (!reduce && !document.hidden && sea)) request();   // the water moves, so keep a slow loop while visible
  }
  let lastFrame = 0;
  function request(){ if (!queued){ queued = true; requestAnimationFrame(now => { if (now - lastFrame < 40 && !anim && !spin){ queued = false; setTimeout(request, 40); return; } lastFrame = now; frame(now); }); } }

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
    const s0 = performance.now();
    anim = now => {
      const k = Math.min(1, (now - s0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
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
    if (yearNote) yearNote.textContent = near.id === '1947' ? T.yearFlat : near.id === '1962' ? T.yearMeasured : near.id === '1975' ? T.yearShape1962 : T.yearShape2010;
    if (btnFlat){ btnFlat.textContent = st.userLift > 0.5 ? T.flat : T.raise; btnFlat.setAttribute('aria-pressed', String(st.userLift <= 0.5)); }
    if (btnExag){ btnExag.textContent = st.exag > 1.5 ? T.trueScale : T.exag; btnExag.setAttribute('aria-pressed', String(st.exag > 1.5)); }
    if (btnChange){ btnChange.textContent = st.change > 0.5 ? T.changeOff : T.change; btnChange.setAttribute('aria-pressed', String(st.change > 0.5)); }
    if (btnWalls){ btnWalls.textContent = st.walls ? T.walls : T.wallsOff; btnWalls.setAttribute('aria-pressed', String(!st.walls)); }
    if (btnLabels){ btnLabels.textContent = st.labels ? T.labels : T.labelsOff; btnLabels.setAttribute('aria-pressed', String(!st.labels)); }
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
      Promise.all([texture(i).promise]).then(() => animate({ year: i }, 2600, () => setTimeout(next, 900)));
    };
    if (st.year >= years.length - 1.01) animate({ year: 0 }, 900, () => setTimeout(next, 600)); else next();
  }

  /* ---------- spots, building labels and the panel ---------- */
  const pins = {}, labels = [];
  function spotHeight(s){ return s.h1962; }
  function spotWorld(id){ const s = lab.spots[id]; return toWorld(s.u, s.v, spotHeight(s) * st.lift * st.userLift); }
  function project(pv, x, y, z){
    const cw = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
    if (cw <= 0) return null;
    return [(pv[0] * x + pv[4] * y + pv[8] * z + pv[12]) / cw, (pv[1] * x + pv[5] * y + pv[9] * z + pv[13]) / cw, cw];
  }
  function placeSpots(pv, lift, ym){
    if (!spotLayer) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const id of Object.keys(pins)){
      const s = lab.spots[id], hgt = spotHeight(s) * lift;
      const xz = toWorld(s.u, s.v, hgt), y = hgt * st.exag + 7;
      const q = project(pv, xz[0], y, xz[1]), pin = pins[id];
      if (!q){ pin.hidden = true; continue; }
      const sx = (q[0] * 0.5 + 0.5) * w, sy = (1 - (q[1] * 0.5 + 0.5)) * h;
      pin.hidden = sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20;
      pin.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
    }
    const showLabels = st.labels && st.walls && lift > 0.5 && st.dist < 420;
    for (const L of labels){
      const b = L.b;
      const alive = ym.year >= (b.built || b.seen || 1950) && !(b.gone && ym.year > b.gone);
      if (!showLabels || !alive){ L.el.hidden = true; continue; }
      const xz = toWorldTrue(L.c[0], L.c[1]), y = (b.ground + b.storeys * b.floorH) * lift * st.exag + 2;
      const q = project(pv, xz[0], y, xz[1]);
      if (!q){ L.el.hidden = true; continue; }
      const sx = (q[0] * 0.5 + 0.5) * w, sy = (1 - (q[1] * 0.5 + 0.5)) * h;
      L.el.hidden = sx < 0 || sy < 0 || sx > w || sy > h || q[2] > 520;
      L.el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
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
    for (const b of model.buildings){
      if (!b.name) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'bld-label';
      el.textContent = b.name.replace('端島小中学校', T.schoolShort);
      el.onclick = () => openBuilding(b, true);
      spotLayer.appendChild(el);
      labels.push({ b, el, c: centroid(b.poly) });
    }
  }
  function photoFigure(ph, src, extraClass){
    const cap = pick(ph.caption);
    return '<figure' + (extraClass ? ' class="' + extraClass + '"' : '') + '><img src="' + esc(asset(src)) + '" alt="' + esc(cap) + '" decoding="async"><figcaption>' + esc(cap)
      + ' <span class="credit">' + esc(T.photo) + ': ' + esc(ph.author) + (ph.year ? ' (' + esc(ph.year) + ')' : '')
      + ' · <a href="' + esc(ph.licenseUrl) + '" target="_blank" rel="noopener">' + esc(ph.license) + '</a> · <a href="' + esc(ph.page) + '" target="_blank" rel="noopener">Wikimedia Commons</a></span></figcaption></figure>';
  }
  function openSpot(id, fly){
    const info = texts.spots[id], s = lab.spots[id];
    if (!info || !panel) return;
    activeSpot = id;
    for (const k of Object.keys(pins)) pins[k].classList.toggle('is-on', k === id);
    const img = (src, alt, cap) => '<figure><img src="' + esc(asset(src)) + '" alt="' + esc(alt) + '" decoding="async"><figcaption>' + cap + '</figcaption></figure>';
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
      animate({ tx: xz[0], tz: xz[1], dist: 230, el: clamp(st.el, 0.4, 0.9) }, 1200);
    }
  }
  function openBuilding(b, fly){
    if (!panel) return;
    for (const k of Object.keys(pins)) pins[k].classList.remove('is-on');
    const row = (k, v) => v === undefined || v === null || v === '' ? '' : '<tr><th>' + esc(k) + '</th><td>' + v + '</td></tr>';
    let html = '<table class="bld-facts">'
      + row(T.built, b.built ? esc(String(b.built)) + (b.builtNote ? ' <small>' + esc(b.builtNote) + '</small>' : '') : (b.seen ? esc(T.unknown) + ' <small>(' + esc(String(b.seen)) + ')</small>' : null))
      + row(T.storeys, esc(String(b.storeys)) + (b.storeysNote ? ' <small>' + esc(b.storeysNote) + '</small>' : ''))
      + row(T.units, b.units)
      + row(T.use, b.use ? esc(b.use) : null)
      + row(T.structure, b.structure ? esc(b.structure) : null)
      + row(T.gone, b.gone ? esc(String(b.gone)) + (b.goneNote ? ' <small>' + esc(b.goneNote) + '</small>' : '') : null)
      + '</table>';
    if (b.notes) html += '<p>' + esc(b.notes) + '</p>';
    for (const ph of (b.name && photos[b.name]) || []) html += photoFigure(ph, ph.file, 'spot-photo');
    if (b.source === 'traced1962') html += '<p><small>' + esc(T.traced) + '</small></p>';
    html += '<p class="credit"><a href="' + esc(model.facts.url) + '" target="_blank" rel="noopener">' + esc(T.factsSource) + '</a></p>';
    $('spotTitle').textContent = b.name || T.unknown;
    $('spotBody').innerHTML = html;
    panel.hidden = false;
    if (fly){
      stopSpin();
      const c = centroid(b.poly), xz = toWorldTrue(c[0], c[1]);
      animate({ tx: xz[0], tz: xz[1], dist: Math.max(120, b.storeys * b.floorH * 5), el: clamp(st.el, 0.35, 0.8) }, 1100);
    }
  }
  function closeSpot(){
    if (panel) panel.hidden = true;
    activeSpot = null;
    for (const k of Object.keys(pins)) pins[k].classList.remove('is-on');
  }
  if ($('spotClose')) $('spotClose').onclick = closeSpot;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel && !panel.hidden) closeSpot(); });

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
  document.addEventListener('visibilitychange', () => { if (!document.hidden) request(); });

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

  if (btnFlat) btnFlat.onclick = () => { stopSpin(); animate({ userLift: st.userLift > 0.5 ? 0 : 1 }, 1100); };
  if (btnExag) btnExag.onclick = () => { animate({ exag: st.exag > 1.5 ? 1 : 2 }, 600); };
  if (btnChange) btnChange.onclick = () => { animate({ change: st.change > 0.5 ? 0 : 1 }, 500); };
  if (btnWalls) btnWalls.onclick = () => { st.walls = !st.walls; syncUi(); request(); };
  if (btnLabels) btnLabels.onclick = () => { st.labels = !st.labels; syncUi(); request(); };
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

  /* ---------- audio cues ---------- */
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
      Object.assign(to, { tx: xz[0], tz: xz[1], dist: 230, el: 0.58 });
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
    fetch(asset('gunkanjima-model.json')).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch(asset('gunkanjima-spots.json')).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(asset('gunkanjima-photos.json')).then(r => r.ok ? r.json() : null).catch(() => null)
  ]).then(([meta, mdl, words, ph]) => {
    lab = meta; model = mdl; texts = words; photos = ph && ph.photos ? ph.photos : {};
    return fetch(asset(model.terrain.file)).then(r => r.arrayBuffer()).then(buf => {
      const t = model.terrain;
      if (buf.byteLength !== t.w * t.h * 2) throw new Error('terrain size');
      mpp = meta.frame.metersPerPixel;
      C = meta.frame.size / 2;
      PP = meta.principalPoint;
      HF = meta.flyingHeightM;
      rot = -Math.atan2(meta.north[0], -meta.north[1]);
      for (const y of meta.years) years.push(y);
      if (yearRange){ yearRange.max = String(years.length - 1); yearRange.step = '0.01'; }
      if (yearTicks) yearTicks.innerHTML = years.map((y, i) => '<button type="button" data-year="' + i + '">' + esc(yearName(y)) + '</button>').join('');
      if (yearTicks) for (const b of yearTicks.querySelectorAll('button')) b.onclick = () => setYear(+b.dataset.year);
      terrain = buildTerrain(t, buf);
      sea = buildSea();
      const B = buildBuildings(model.buildings);
      walls = B.walls; roofs = B.roofs;
      if (!walls || !roofs){ st.walls = false; if (btnWalls) btnWalls.hidden = true; }
      seawall = model.seawall && model.seawall.length > 3 ? buildSeawall(model.seawall) : null;
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
    setTimeout(() => years.forEach((y, i) => texture(i)), 2500);
  }).catch(err => {
    console.error(err);
    fallback(T.failed);
  });

  window.jtaLab3d = { st, draw: () => draw(), view, setYear, openSpot, closeSpot, openBuilding: name => { const b = model.buildings.find(x => x.name === name); if (b) openBuilding(b, true); },
    years: () => years.map(y => y.id), loaded: i => texture(i).promise, shadows: () => !!shadowFb, walls: () => !!walls, model: () => model };
})();
