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
  const V = '7';
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
    factsSource: 'Building list: Japanese Wikipedia, 端島 (長崎県)', schoolShort: 'School',
    enter: 'Go inside', leave: 'Leave', interior: 'Inside (reconstruction):',
    walk: '🚶 Walk around', walkStop: '✕ Stop walking',
    walkHelp: 'W A S D or arrow keys: walk · drag: look round · Shift: run · click the ground to walk there, a building for its facts · Esc: stop',
    walkHelpTouch: 'Left thumb: move (push far to run) · drag: look round · tap the ground to walk there, a building for its facts',
    skyStage: 'Model view', skyClear: 'Clear', skyCloudy: 'Cloudy', skyRain: 'Rain', skyFog: 'Sea fog', skyStorm: 'Typhoon'
  }, window.LAB_TEXT || {});

  const $ = id => document.getElementById(id);
  const canvas = $('view'), status = $('viewStatus'), compass = $('viewCompass');
  const btnFlat = $('btnFlat'), btnReset = $('btnReset'), btnExag = $('btnExag'), btnChange = $('btnChange'), btnWalls = $('btnWalls'), btnLabels = $('btnLabels'), btnWalk = $('btnWalk');
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
  /* inside a room the camera may come right up to the furniture and look a little upward; outside it may come close to a building */
  const D_MIN_SCENE = 0.6, D_MAX_SCENE = 90, EL_MIN_SCENE = -0.35, D_MIN_OUTSIDE = 8;
  const dMin = () => scene ? D_MIN_SCENE : D_MIN_OUTSIDE, dMax = () => scene ? D_MAX_SCENE : D_MAX, elMin = () => scene ? EL_MIN_SCENE : EL_MIN;
  const STYLE = { apartment: 1, nikkyu: 2, school: 3, industrial: 4, wood: 5, shrine: 6 };
  const controls = [btnFlat, btnReset, btnExag, btnChange, btnWalls, btnLabels, yearRange, btnPlay, btnWalk];

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
    varying vec4 vShadow; varying float vDepth; varying vec3 vWorld;
    vec3 place(vec2 g, float h){
      vec2 xz = (g - vec2(uC)) * uMpp;
      float c = cos(uRot), s = sin(uRot);
      return vec3(xz.x * c - xz.y * s, h * uExag + uYOff, xz.x * s + xz.y * c);
    }
    vec3 turn(vec3 n){ float c = cos(uRot), s = sin(uRot); return vec3(n.x * c - n.z * s, n.y, n.x * s + n.z * c); }
    void finish(vec3 p){ vShadow = uLightPV * vec4(p, 1.0); vec4 q = uPV * vec4(p, 1.0); vDepth = q.w; vWorld = p; gl_Position = q; }
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
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
    /* weather and hour: uEnv = (ambient, direct sun, shadow lift, wetness), uTint the colour of the light.
       The model view keeps (1, 1, 0, 0) and white, which is the lighting the page always had. Fog is measured
       from uFogC: the eye when walking, the point the camera turns round in the model view. */
    uniform vec3 uFogC, uTint, uEye; uniform vec2 uFogR; uniform vec4 uEnv; uniform float uNight, uStage, uWave;
    varying vec3 vWorld;
    vec3 fogged(vec3 c){ return mix(c, uHorizon, uFog * smoothstep(uFogR.x, uFogR.y, length(vWorld - uFogC))); }`;
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
        /* water: small moving ripples tilt the normal, a soft sun glint, deeper tone away from the shore; wind raises them */
        float wv = (1.0 + 2.2 * uWave) * (uStage > 0.5 ? 1.0 : 1.0 - 0.85 * smoothstep(60.0, 700.0, length(vPos - uEye))), tt = uTime * (1.0 + 1.5 * uWave);
        float r1 = noise(vPos.xz * 0.35 + vec2(tt * 0.05, tt * 0.03)), r2 = noise(vPos.xz * 0.9 - vec2(tt * 0.04, 0.0));
        n = normalize(vec3((r1 - 0.5) * 0.25 * wv, 1.0, (r2 - 0.5) * 0.25 * wv));
      }
      float d = max(dot(n, uSun), 0.0);
      float sh = shadowAt(vShadow, 0.0022);
      float light = mix(1.0, min(1.0, 0.42 * uEnv.x + 0.6 * uEnv.y * d * mix(0.35 + uEnv.z, 1.0, sh)), uShade);
      vec3 col = t * light * mix(vec3(1.0), uTint, uShade) * (1.0 - 0.22 * uEnv.w);
      float nearG = (1.0 - smoothstep(12.0, 110.0, length(vPos - uEye))) * (1.0 - uStage);
      if (nearG > 0.01 && vSea < 0.5){
        float g1 = noise(vPos.xz * 0.8) * 0.5 + noise(vPos.xz * 3.1 + 5.0) * 0.3 + noise(vPos.xz * 12.0 + 9.0) * 0.2;
        col *= mix(1.0, 0.8 + 0.4 * g1, nearG);
      }
      float edge = smoothstep(0.5, 0.36, max(abs(vUvP.x - 0.5), abs(vUvP.y - 0.5)));
      if (vSea > 0.5){
        float foam = smoothstep(0.86 - 0.22 * uWave, 0.98, noise(vPos.xz * 0.12 + vec2(uTime * 0.02, 0.0))) * (0.08 + 0.3 * uWave);
        if (uStage > 0.5){
          vec3 sea = mix(vec3(0.06, 0.13, 0.17), vec3(0.12, 0.25, 0.31), d);
          vec3 eye = normalize(-vPos + vec3(0.0, 300.0, 0.0));
          float glint = pow(max(dot(reflect(-uSun, n), eye), 0.0), 60.0) * 0.3;
          col = sea + glint + foam;
        } else {
          /* the sea under a sky: the horizon colour reflected at a grazing view, the sun's glint while it is out */
          vec3 v = normalize(uEye - vPos);
          float fr = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
          vec3 deep = mix(vec3(0.03, 0.10, 0.14), vec3(0.07, 0.19, 0.25), d) * (0.25 + 0.75 * uTint) * (0.45 + 0.55 * uEnv.x);
          float glint = pow(max(dot(reflect(-uSun, n), v), 0.0), 90.0) * 1.2 * uEnv.y * (1.0 - uEnv.z);
          col = mix(deep, uHorizon, fr * 0.85) + glint * uTint + foam * (0.35 + 0.65 * uTint * uEnv.x);
        }
        edge = 1.0;
      }
      col = fogged(col);
      col = mix(uBg, col, edge);
      gl_FragColor = vec4(col, 1.0);
    }`;
  // building walls
  const WALL_VS = COMMON_VS + `
    attribute vec2 aPos; attribute vec2 aY; attribute vec3 aNor; attribute vec3 aWall; attribute vec4 aInfo; attribute vec2 aLife; attribute float aBid;
    uniform float uGhostId; uniform float uGhostId2;
    varying vec3 vNor; varying vec3 vWall; varying vec4 vInfo; varying float vAlive; varying float vTop; varying float vGhost;
    void main(){
      float alive = standing(aLife);
      vGhost = (abs(aBid - uGhostId) < 0.5 || abs(aBid - uGhostId2) < 0.5) ? 1.0 : 0.0;
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
    varying vec3 vNor; varying vec3 vWall; varying vec4 vInfo; varying float vAlive; varying float vTop; varying float vGhost;
    varying vec4 vShadow; varying float vDepth;
    uniform float uGhostPass;
    ` + SHADOW_FN + `
    void main(){
      if (vAlive < 0.02) discard;
      if (uGhostPass < 0.5 && vGhost > 0.5) discard;   /* the host building is drawn later, translucent */
      if (uGhostPass > 0.5 && vGhost < 0.5) discard;
      vec3 n = normalize(vNor);
      float d = max(dot(n, uSun), 0.0);
      float sh = shadowAt(vShadow, 0.003);
      /* the seed is the same at every corner of a wall, but interpolation leaves it a hair different from one pixel
         to the next and hash() magnifies that: the balconies came out as grain. Snapped to its 89 steps it is exact. */
      float style = vInfo.x, floorH = vInfo.y, seed = floor(vInfo.z * 89.0 + 0.5) / 89.0, gone = vInfo.w;
      float y = vWall.y, s = vWall.x, H = vWall.z;
      float age = clamp((uYear - 74.0) / 36.0, 0.0, 1.0);
      float fy = fract(y / floorH), storey = floor(y / floorH);
      vec3 base = vec3(0.70, 0.68, 0.64);
      float win = 0.0, recess = 0.0, rail = 0.0, column = 0.0, plank = 0.0;
      float cell = hash(vec2(floor(s / 2.4), storey + seed * 7.0));
      float frame = 0.0, mull = 0.0;
      if (style < 1.5){            /* apartment block: windows in rows, slab lines, some balconies */
        float fx = fract(s / 2.4);
        win = step(0.32, fy) * step(fy, 0.78) * step(0.2, fx) * step(fx, 0.72);
        frame = step(0.295, fy) * step(fy, 0.805) * step(0.18, fx) * step(fx, 0.74) * (1.0 - win);
        mull = win * (step(abs(fx - 0.46), 0.012) + step(abs(fy - 0.55), 0.012));
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
      /* close up: window frames, glazing bars, the sky in the glass and, while people lived here, curtains */
      float close = 1.0 - smoothstep(40.0, 170.0, length(vWorld - uEye));
      glass = mix(glass, mix(glass, uHorizon * 0.55, 0.35) * (1.0 - uNight * 0.6), close * (1.0 - open) * (1.0 - uStage));
      glass = mix(glass, vec3(0.50, 0.42, 0.32) * (0.55 + 0.25 * cell), close * step(0.62, cell) * (1.0 - age) * 0.55);
      col = mix(col, base * 1.14, frame * close * 0.85);
      col = mix(col, glass, win * (1.0 - mull * close * 0.8));
      col = mix(col, base * 0.95, win * mull * close * 0.8);
      /* weathering after 1974: streaks, stains, moss near the ground */
      float streak = noise(vec2(s * 1.5, y * 0.3 + seed * 5.0));
      col *= 1.0 - age * (0.25 * streak + 0.1 * smoothstep(3.0, 0.0, y));
      col = mix(col, vec3(0.30, 0.36, 0.22), age * 0.35 * smoothstep(2.5, 0.0, y) * noise(vec2(s * 0.7, seed * 3.0)));
      float light = 0.32 * uEnv.x + 0.62 * uEnv.y * d * mix(0.35 + uEnv.z, 1.0, sh);
      col *= mix(vec3(1.0), light * uTint, uShade) * (1.0 - 0.15 * uEnv.w);
      /* after dark the flats that were lived in show their lamps, until the island was left in 1974 */
      float lit = step(0.42, hash(vec2(floor(s / (style < 1.5 ? 2.4 : 3.2)), storey + seed * 7.0)));
      col += win * lit * uNight * step(uYear, 74.3) * step(style, 2.5) * vec3(1.0, 0.78, 0.46) * 0.85;
      if (uChange > 0.001){
        vec3 grey = vec3(dot(col, vec3(0.299, 0.587, 0.114)));
        vec3 flag = gone > 0.0 && gone <= 110.0 ? vec3(0.88, 0.22, 0.16) : vec3(0.35, 0.55, 0.85);
        col = mix(col, mix(grey, flag, 0.75) * (0.55 + 0.45 * d), uChange);
      }
      col = fogged(col);
      gl_FragColor = vec4(col, uGhostPass > 0.5 ? 0.22 : 1.0);
    }`;
  // roofs: the aerial photograph of the year, drawn where the roof is in that photograph
  const ROOF_VS = COMMON_VS + `
    attribute vec2 aPos; attribute vec2 aY; attribute vec2 aLife; attribute vec2 aInfo; attribute float aBid;
    uniform float uGhostId; uniform float uGhostId2;
    varying vec2 vUvP; varying vec2 vUvO; varying float vAlive; varying vec2 vInfo; varying vec2 vPos; varying float vGhost;
    void main(){
      float alive = standing(aLife);
      vGhost = (abs(aBid - uGhostId) < 0.5 || abs(aBid - uGhostId2) < 0.5) ? 1.0 : 0.0;
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
    varying vec2 vUvP; varying vec2 vUvO; varying float vAlive; varying vec2 vInfo; varying vec2 vPos; varying float vGhost;
    varying vec4 vShadow; varying float vDepth;
    uniform float uGhostPass;
    ` + SHADOW_FN + `
    void main(){
      if (vAlive < 0.02) discard;
      if (uGhostPass < 0.5 && vGhost > 0.5) discard;
      if (uGhostPass > 0.5 && vGhost < 0.5) discard;
      vec3 a = texture2D(uTexA, mix(vUvP, vUvO, uOrthoA)).rgb;
      vec3 b = texture2D(uTexB, mix(vUvP, vUvO, uOrthoB)).rgb;
      vec3 t = mix(a, b, uMix);
      float style = vInfo.x, seed = vInfo.y;
      float sh = shadowAt(vShadow, 0.0022);
      float d = max(dot(vec3(0.0, 1.0, 0.0), uSun), 0.0);
      /* the photograph carries the roof; a faint concrete tone keeps it from looking like paper */
      vec3 roof = style > 4.5 && style < 5.5 ? vec3(0.30, 0.27, 0.24) : vec3(0.62, 0.60, 0.57);
      vec3 col = mix(t, roof * (0.6 + 0.4 * dot(t, vec3(0.33))), vAlive < 0.98 ? 0.8 : 0.25);
      col *= mix(vec3(1.0), (0.42 * uEnv.x + 0.6 * uEnv.y * d * mix(0.35 + uEnv.z, 1.0, sh)) * uTint, uShade) * (1.0 - 0.22 * uEnv.w);
      if (uChange > 0.001){ vec3 grey = vec3(dot(col, vec3(0.299, 0.587, 0.114))); col = mix(col, grey * 0.9, 0.5 * uChange); }
      col = fogged(col);
      gl_FragColor = vec4(col, uGhostPass > 0.5 ? 0.18 : 1.0);
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
      col *= mix(vec3(1.0), (0.32 * uEnv.x + 0.62 * uEnv.y * d * mix(0.35 + uEnv.z, 1.0, sh)) * uTint, uShade) * (1.0 - 0.15 * uEnv.w);
      col = fogged(col);
      gl_FragColor = vec4(col, 1.0);
    }`;
  /* the sky: in the model view a plain gradient behind the model, as the page always had; under a chosen
     weather the colour of the sky the eye looks into, with the sun, clouds drifting with the wind and, at
     night, stars. uRayF/R/U span the view: the direction under a pixel is F + x R + y U. */
  const SKY_VS = `attribute vec2 aPos; uniform vec3 uRayF, uRayR, uRayU; varying vec2 vP; varying vec3 vDir;
    void main(){ vP = aPos; vDir = uRayF + aPos.x * uRayR + aPos.y * uRayU; gl_Position = vec4(aPos, 0.9999, 1.0); }`;
  const SKY_FS = `precision mediump float; uniform vec3 uTop, uHorizon, uSun, uTint; uniform float uEl, uStage, uCloud, uTime, uNight, uDay; uniform vec2 uWind;
    varying vec2 vP; varying vec3 vDir;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
    void main(){
      if (uStage > 0.5){ float k = smoothstep(-0.2, 1.0, vP.y + uEl * 0.6); gl_FragColor = vec4(mix(uHorizon, uTop, k), 1.0); return; }
      vec3 d = normalize(vDir);
      vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.5, max(d.y, 0.0)));
      float s = max(dot(d, uSun), 0.0), clear = 1.0 - uCloud;
      col += uTint * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.2) * uDay * clear;
      if (d.y > 0.0 && uNight > 0.01){ vec2 sp = d.xz / (d.y + 0.3) * 160.0; col += step(0.9968, hash(floor(sp))) * uNight * clear * 0.8; }
      if (d.y > 0.004){
        vec2 cp = d.xz / d.y * 1.6 + uWind * uTime * 0.012;
        float c = noise(cp) * 0.5 + noise(cp * 2.3 + 3.1) * 0.3 + noise(cp * 5.1 + 7.7) * 0.2;
        float cover = smoothstep(0.66 - 0.5 * uCloud, 0.9 - 0.25 * uCloud, c) * smoothstep(0.004, 0.14, d.y);
        vec3 cc = mix(vec3(0.97, 0.97, 0.96), vec3(0.52, 0.55, 0.6), uCloud * 0.85) * uTint * (0.3 + 0.7 * uDay) + uHorizon * 0.12;
        col = mix(col, cc, cover * (0.6 + 0.4 * uCloud));
      }
      gl_FragColor = vec4(col, 1.0);
    }`;
  /* rain: streaks drawn over the finished picture, slanted by the wind */
  const RAIN_VS = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const RAIN_FS = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2 uRes; uniform float uTime, uRain, uSlant; uniform vec3 uCol;
    float h1(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
    void main(){
      vec2 p = gl_FragCoord.xy / uRes.y;
      float a = 0.0;
      for (int i = 0; i < 3; i++){
        float fi = float(i), sc = 38.0 + fi * 34.0;
        vec2 q = vec2(p.x + p.y * uSlant, p.y);
        float r = h1(floor(q.x * sc) + fi * 31.7);
        float y = fract(q.y * (0.9 + 0.3 * fi) + uTime * (1.2 + 0.4 * fi + 0.3 * r) + r * 7.0), len = 0.08 + 0.07 * r;
        float line = smoothstep(0.0, len * 0.5, y) * (1.0 - smoothstep(len * 0.5, len, y));
        a += line * smoothstep(0.1, 0.0, abs(fract(q.x * sc) - 0.5)) * step(0.55 - 0.4 * uRain, r) * (0.3 - 0.07 * fi);
      }
      gl_FragColor = vec4(uCol, clamp(a, 0.0, 0.6) * uRain);
    }`;
  const DEPTH_FS = `precision mediump float; void main(){ gl_FragColor = vec4(1.0); }`;
  const DEPTH_FS_ALIVE = `precision mediump float; varying float vAlive; varying float vGhost; void main(){ if (vAlive < 0.02 || vGhost > 0.5) discard; gl_FragColor = vec4(1.0); }`;
  // interior scenes: plain coloured boxes, lit and shadowed; assumed parts are translucent
  /* aMat = (material kind, seed). The surface detail is procedural, in metres of the model, so a
     tatami mat shows its weave and border, wood its grain, concrete its stains, rock its moss. */
  const BOX_VS = COMMON_VS + `
    attribute vec3 aPos3; attribute vec3 aNor; attribute vec4 aCol; attribute vec2 aMat;
    varying vec3 vNor; varying vec4 vCol; varying vec3 vLoc; varying vec2 vMat;
    void main(){ vNor = turn(aNor); vCol = aCol; vMat = aMat; vLoc = vec3((aPos3.x - uC) * uMpp, aPos3.y, (aPos3.z - uC) * uMpp); finish(place(aPos3.xz, aPos3.y)); }`;
  const BOX_FS = `
    precision mediump float;
    uniform float uFog, uShade, uChange, uYear; uniform vec3 uBg, uSun, uHorizon;
    varying vec3 vNor; varying vec4 vCol; varying vec4 vShadow; varying float vDepth; varying vec3 vLoc; varying vec2 vMat;
    ` + SHADOW_FN + `
    /* material kinds: 0 flat 1 tatami 2 wood 3 concrete 4 rock 5 tile 6 metal 7 paper 8 glass 9 cloth 10 foliage 11 painted wall 12 water 13 soil.
       Two noise lookups per fragment, whatever the kind: the scales are chosen first, the noise is read once. */
    vec3 material(vec3 c, vec3 p, vec3 n, float k, float seed){
      if (k < 0.5 || (k > 7.5 && k < 8.5)) return c;
      vec2 uv = abs(n.y) > 0.6 ? p.xz : (abs(n.x) > abs(n.z) ? p.zy : p.xy);
      uv += seed * 7.3;
      vec2 sa = vec2(2.0), sb = vec2(9.0);
      if (k < 1.5){ sa = vec2(2.0); sb = vec2(40.0); }
      else if (k < 2.5){ sa = vec2(0.7); sb = vec2(2.5, 40.0); }
      else if (k < 3.5){ sa = vec2(6.0); sb = vec2(9.0, 0.8); }
      else if (k < 4.5){ sa = vec2(3.0); sb = vec2(11.0); }
      else if (k < 5.5){ sa = vec2(14.0); sb = vec2(14.0); }
      else if (k < 6.5){ sa = vec2(60.0, 3.0); sb = vec2(5.0); }
      else if (k < 9.5){ sa = vec2(30.0); sb = vec2(30.0); }
      else if (k < 10.5){ sa = vec2(8.0); sb = vec2(3.0); }
      else if (k < 11.5){ sa = vec2(2.5); sb = vec2(6.0); }
      else if (k < 12.5){ sa = vec2(6.0); sb = vec2(2.0); }
      else { sa = vec2(5.0); sb = vec2(1.6); }
      float na = noise(uv * sa), nb = noise(uv * sb + 3.7);
      if (k < 1.5){   /* tatami: fine weave across the mat, darker edge every 0.91 x 1.82 m */
        float weave = 0.93 + 0.035 * sin(uv.x * 260.0) + 0.035 * sin(uv.y * 90.0);
        vec2 g = fract(uv / vec2(0.91, 1.82));
        float edge = step(0.965, g.x) + step(g.x, 0.035) + step(0.982, g.y) + step(g.y, 0.018);
        return c * weave * (1.0 - 0.28 * clamp(edge, 0.0, 1.0)) * (0.94 + 0.12 * na);
      }
      if (k < 2.5) return c * (0.78 + 0.32 * nb) * (0.9 + 0.2 * na);   /* wood grain */
      if (k < 3.5) return c * (0.86 + 0.2 * na) * (0.85 + 0.15 * nb) * (1.0 - 0.18 * smoothstep(0.9, 0.0, p.y - floor(p.y / 2.85) * 2.85) * (1.0 - abs(n.y)));   /* concrete */
      if (k < 4.5){   /* rock: mottled grey-brown; moss on the faces that look up */
        vec3 r = c * (0.7 + 0.5 * na) * (0.9 + 0.2 * nb);
        float moss = smoothstep(0.45, 0.72, na * 0.6 + nb * 0.4) * clamp(n.y * 1.4 + 0.25, 0.0, 1.0);
        return mix(r, vec3(0.30, 0.42, 0.18) * (0.8 + 0.4 * nb), moss * 0.85);
      }
      if (k < 5.5){   /* tile: 15 cm grid with light grout */
        vec2 g = fract(uv / 0.15);
        float grout = step(0.9, g.x) + step(0.9, g.y);
        return mix(c * (0.95 + 0.1 * na), vec3(0.86, 0.86, 0.82), clamp(grout, 0.0, 1.0) * 0.8);
      }
      if (k < 6.5) return mix(c * (0.9 + 0.2 * na), vec3(0.42, 0.24, 0.14), smoothstep(0.62, 0.8, nb) * 0.7);   /* metal with rust */
      if (k < 7.5){   /* paper screen: lattice every 25 cm */
        vec2 g = fract(uv / 0.25);
        float bar = step(0.93, g.x) + step(0.93, g.y);
        return mix(c, vec3(0.42, 0.30, 0.20), clamp(bar, 0.0, 1.0) * 0.85);
      }
      if (k < 9.5) return c * (0.9 + 0.2 * na) * (0.92 + 0.1 * sin(uv.x * 25.0));   /* cloth */
      if (k < 10.5) return mix(c * 0.6, c * 1.25, na * 0.7 + nb * 0.3);   /* foliage */
      if (k < 11.5) return c * (0.9 + 0.12 * na) * (1.0 - 0.12 * smoothstep(0.5, 0.0, fract(p.y / 2.85) * 2.85));   /* painted wall */
      if (k < 12.5) return c * (0.85 + 0.3 * na);   /* water */
      return c * (0.75 + 0.5 * na);   /* soil */
    }
    void main(){
      vec3 n = normalize(vNor);
      float d = max(dot(n, uSun), 0.0);
      float sh = shadowAt(vShadow, 0.003);
      vec3 base = material(vCol.rgb, vLoc, n, vMat.x, vMat.y);
      /* hemisphere ambient: faces that look up are lit by the sky, faces that look down by the ground */
      float amb = (0.30 + 0.12 * n.y) * uEnv.x;
      vec3 col = base * (amb + 0.62 * uEnv.y * d * mix(0.4 + uEnv.z, 1.0, sh)) * uTint;
      /* at night the rooms of the lived-in years are lit by their lamps */
      col += base * 0.42 * uNight * step(uYear, 74.3) * vec3(1.0, 0.86, 0.62);
      col = fogged(col);
      gl_FragColor = vec4(col, vCol.a);
    }`;
  const BOX_DEPTH_FS = `precision mediump float; varying vec4 vCol; void main(){ if (vCol.a < 0.9) discard; gl_FragColor = vec4(1.0); }`;

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
  const COMMON_U = ['uPV', 'uLightPV', 'uRot', 'uLift', 'uExag', 'uMorph', 'uMpp', 'uC', 'uHf', 'uYOff', 'uPP', 'uYear', 'uShadowMap', 'uShadowOn', 'uShadowTexel', 'uFog', 'uShade', 'uChange', 'uBg', 'uSun', 'uHorizon', 'uTime', 'uGhostId', 'uGhostId2', 'uGhostPass', 'uFogC', 'uFogR', 'uTint', 'uEye', 'uEnv', 'uNight', 'uStage', 'uWave'];
  const TEX_U = ['uTexA', 'uTexB', 'uMix', 'uOrthoA', 'uOrthoB'];
  const TERRAIN_A = ['aGrid', 'aH', 'aNor', 'aSea'], WALL_A = ['aPos', 'aY', 'aNor', 'aWall', 'aInfo', 'aLife', 'aBid'], ROOF_A = ['aPos', 'aY', 'aLife', 'aInfo', 'aBid'], BOX_A = ['aPos3', 'aNor', 'aCol', 'aMat'];
  let progT, progW, progR, progS, progSky, progB, progRain, depthT, depthW, depthR, depthB;
  try {
    progT = program(TERRAIN_VS, TERRAIN_FS, TERRAIN_A, COMMON_U.concat(TEX_U));
    progW = program(WALL_VS, WALL_FS, WALL_A, COMMON_U);
    progR = program(ROOF_VS, ROOF_FS, ROOF_A, COMMON_U.concat(TEX_U));
    progS = program(WALL_VS, SEAWALL_FS, WALL_A, COMMON_U);
    progSky = program(SKY_VS, SKY_FS, ['aPos'], ['uTop', 'uHorizon', 'uEl', 'uStage', 'uRayF', 'uRayR', 'uRayU', 'uSun', 'uTint', 'uCloud', 'uTime', 'uNight', 'uDay', 'uWind']);
    progB = program(BOX_VS, BOX_FS, BOX_A, COMMON_U);
    if (SHADOW){ depthT = program(TERRAIN_VS, DEPTH_FS, TERRAIN_A, COMMON_U); depthW = program(WALL_VS, DEPTH_FS_ALIVE, WALL_A, COMMON_U); depthR = program(ROOF_VS, DEPTH_FS_ALIVE, ROOF_A, COMMON_U); depthB = program(BOX_VS, BOX_DEPTH_FS, BOX_A, COMMON_U); }
  } catch (err) { console.error(err); fallback(T.noWebgl); return; }
  /* rain is an extra: if its shader cannot be built the model still draws, without rain */
  try { progRain = program(RAIN_VS, RAIN_FS, ['aPos'], ['uRes', 'uTime', 'uRain', 'uSlant', 'uCol']); } catch (err) { progRain = null; }

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
  let interiors = null, scene = null, sceneMesh = null, sceneMeshA = null, ghostId = 0, ghostId2 = -10;
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
  /* the sea reaches the horizon (some 25 km each way), so that from the shore or a rooftop it does not end in an edge */
  function buildSea(){
    const a = -30000, s = C * 2 + 30000;
    return { grid: buffer(new Float32Array([a, a, s, a, a, s, s, s])), hts: buffer(new Float32Array(4)),
      nor: buffer(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0])), sea: buffer(new Float32Array([1, 1, 1, 1])),
      idx: buffer(new Uint16Array([0, 2, 1, 1, 2, 3]), gl.ELEMENT_ARRAY_BUFFER), count: 6, type: gl.UNSIGNED_SHORT };
  }

  /* prisms: walls (one quad per outline edge) and roofs (ear-clipped) for every building or wing */
  function lifeOf(b){
    const built = b.built || b.seen || 1950;
    return [built - 1900, b.gone ? b.gone - 1900 : 0];
  }
  function buildBuildings(list){
    const W = { pos: [], y: [], nor: [], wall: [], info: [], life: [], bid: [], idx: [] };
    const R = { pos: [], y: [], life: [], info: [], bid: [], idx: [] };
    let nw = 0, nr = 0, seedN = 0;
    list.forEach((b, bi) => { b.bid = bi + 1; });
    for (const b of list){
      const parts = b.wings || [b.poly];
      const H = b.storeys * b.floorH, base = b.ground - 0.6, top = b.ground + H;
      const style = STYLE[b.style] || 1, seed = (seedN++ % 89) / 89, life = lifeOf(b);
      for (const part of parts){
        if (part.length < 3) continue;
        /* every outline in one winding: drawn the other way round, a wall quad faces inwards and back-face culling hides it from outside */
        const poly = signedArea(part) < 0 ? part.slice().reverse() : part;
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
            W.wall.push(s, b.ground, H); W.info.push(style, b.floorH, seed, b.gone ? b.gone - 1900 : 0); W.life.push(life[0], life[1]); W.bid.push(b.bid);
          }
          W.idx.push(nw, nw + 2, nw + 1, nw + 1, nw + 2, nw + 3);
          nw += 4;
        }
        const tri = triangulate(poly);
        for (const p of poly){ R.pos.push(p[0], p[1]); R.y.push(base, top); R.life.push(life[0], life[1]); R.info.push(style, seed); R.bid.push(b.bid); }
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
    return { walls: mk(W, ['pos', 'y', 'nor', 'wall', 'info', 'life', 'bid']), roofs: mk(R, ['pos', 'y', 'life', 'info', 'bid']) };
  }
  function buildSeawall(ring){
    const W = { pos: [], y: [], nor: [], wall: [], info: [], life: [], bid: [], idx: [] };
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
        W.wall.push(s, 0, pt.top); W.info.push(0, 1, 0, 0); W.life.push(-100, 0); W.bid.push(0);
      }
      W.idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      n += 4; s0 += len;
    }
    const out = {};
    for (const k of ['pos', 'y', 'nor', 'wall', 'info', 'life', 'bid']) out[k] = buffer(new Float32Array(W[k]));
    out.idx = buffer(new Uint16Array(W.idx), gl.ELEMENT_ARRAY_BUFFER); out.count = W.idx.length; out.type = gl.UNSIGNED_SHORT;
    return out;
  }

  /* interior scene boxes: 6 faces x 2 triangles each, rotated about the vertical axis in the crop frame */
  /* One mesh from a scene's parts. Every part has a position (u, v in crop pixels; y in metres),
     a size in metres, a colour, an optional rotation, an optional primitive p (box, cyl, rock, ball),
     a material kind k and an assumed flag a. Assumed parts, glass and water go to the translucent pass. */
  function translucent(b){ return !!b.a || b.k === 8 || b.k === 12; }
  function buildBoxes(scene){
    const P = [], N = [], Cc = [], Mm = [], I = [];
    let n = 0;
    const push = (pos, nor, col, mat) => { P.push(pos[0], pos[1], pos[2]); N.push(nor[0], nor[1], nor[2]); Cc.push(col[0], col[1], col[2], col[3]); Mm.push(mat[0], mat[1]); return n++; };
    for (const b of scene.boxes){
      if ((scene.pass === 'assumed') !== translucent(b)) continue;
      const [sx, sy, sz] = b.s, a = (b.r || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      const alpha = b.k === 8 ? 0.38 : b.k === 12 ? 0.55 : b.a ? 0.45 : 1;
      const col = [b.c[0], b.c[1], b.c[2], alpha], mat = [b.k || 0, b.sd || 0];
      const at = (dx, dy, dz) => [b.u + (dx * ca - dz * sa) / mpp, b.y + dy, b.v + (dx * sa + dz * ca) / mpp];
      const nr = (x, y, z) => [x * ca - z * sa, y, x * sa + z * ca];
      const quad = (p0, p1, p2, p3, nor) => { const i0 = push(p0, nor, col, mat); push(p1, nor, col, mat); push(p2, nor, col, mat); push(p3, nor, col, mat); I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); };
      if (b.p === 'cyl'){
        const seg = 14, rx = sx / 2, rz = sz / 2;
        const ring = y => { const r = []; for (let i = 0; i < seg; i++){ const t = i / seg * Math.PI * 2; r.push([Math.cos(t) * rx, y, Math.sin(t) * rz, Math.cos(t), Math.sin(t)]); } return r; };
        const lo = ring(0), hi = ring(sy);
        for (let i = 0; i < seg; i++){
          const j = (i + 1) % seg;
          const nA = nr(lo[i][3], 0, lo[i][4]), nB = nr(lo[j][3], 0, lo[j][4]);
          const i0 = push(at(lo[i][0], 0, lo[i][2]), nA, col, mat); push(at(lo[j][0], 0, lo[j][2]), nB, col, mat); push(at(hi[j][0], sy, hi[j][2]), nB, col, mat); push(at(hi[i][0], sy, hi[i][2]), nA, col, mat);
          I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
        }
        const c0 = push(at(0, sy, 0), [0, 1, 0], col, mat); for (const q of hi) push(at(q[0], sy, q[2]), [0, 1, 0], col, mat);
        for (let i = 0; i < seg; i++) I.push(c0, c0 + 1 + (i + 1) % seg, c0 + 1 + i);
        const b0 = push(at(0, 0, 0), [0, -1, 0], col, mat); for (const q of lo) push(at(q[0], 0, q[2]), [0, -1, 0], col, mat);
        for (let i = 0; i < seg; i++) I.push(b0, b0 + 1 + i, b0 + 1 + (i + 1) % seg);
      } else if (b.p === 'rock' || b.p === 'ball'){
        /* a sphere of latitude rings, scaled to the size box; rocks get a seeded bumpy radius and flat shading */
        const rings = b.p === 'rock' ? 6 : 8, seg = b.p === 'rock' ? 9 : 12, seed = (b.sd || 1) * 13.7;
        const bump = (i, j) => b.p === 'rock' ? 0.72 + 0.28 * Math.abs(Math.sin(i * 3.1 + j * 1.7 + seed) * Math.cos(j * 2.3 + seed)) : 1;
        const pt = (i, j) => { const ph = (i / rings) * Math.PI, th = (j / seg) * Math.PI * 2, r = bump(i, j);
          return [Math.sin(ph) * Math.cos(th) * sx / 2 * r, (1 - Math.cos(ph)) * sy / 2 * r, Math.sin(ph) * Math.sin(th) * sz / 2 * r]; };
        for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++){
          const p0 = pt(i, j), p1 = pt(i + 1, j), p2 = pt(i + 1, j + 1), p3 = pt(i, j + 1);
          const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
          let nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
          const len = Math.hypot(nn[0], nn[1], nn[2]) || 1; nn = [nn[0] / len, nn[1] / len, nn[2] / len];
          if (b.p === 'ball'){ const c = [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2 - sy / 2, (p0[2] + p2[2]) / 2]; const l = Math.hypot(c[0] / (sx / 2), c[1] / (sy / 2), c[2] / (sz / 2)) || 1; nn = [c[0] / (sx / 2) / l, c[1] / (sy / 2) / l, c[2] / (sz / 2) / l]; }
          const nor = nr(nn[0], nn[1], nn[2]);
          quad(at(p0[0], p0[1], p0[2]), at(p3[0], p3[1], p3[2]), at(p2[0], p2[1], p2[2]), at(p1[0], p1[1], p1[2]), nor);
        }
      } else {
        const hx = sx / 2, hz = sz / 2;
        quad(at(-hx, sy, -hz), at(hx, sy, -hz), at(hx, sy, hz), at(-hx, sy, hz), [0, 1, 0]);
        quad(at(-hx, 0, hz), at(hx, 0, hz), at(hx, 0, -hz), at(-hx, 0, -hz), [0, -1, 0]);
        quad(at(-hx, 0, -hz), at(-hx, 0, hz), at(-hx, sy, hz), at(-hx, sy, -hz), nr(-1, 0, 0));
        quad(at(hx, 0, hz), at(hx, 0, -hz), at(hx, sy, -hz), at(hx, sy, hz), nr(1, 0, 0));
        quad(at(hx, 0, -hz), at(-hx, 0, -hz), at(-hx, sy, -hz), at(hx, sy, -hz), nr(0, 0, -1));
        quad(at(-hx, 0, hz), at(hx, 0, hz), at(hx, sy, hz), at(-hx, sy, hz), nr(0, 0, 1));
      }
    }
    const big = n > 65535;
    if (big && !bigIndex) return null;
    return { pos3: buffer(new Float32Array(P)), nor: buffer(new Float32Array(N)), col: buffer(new Float32Array(Cc)), mat: buffer(new Float32Array(Mm)),
      idx: buffer(big ? new Uint32Array(I) : new Uint16Array(I), gl.ELEMENT_ARRAY_BUFFER), count: I.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
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
        /* decode() never settles in a background tab; after a moment the image is uploaded as it is */
        .then(img => Promise.race([img.decode ? img.decode().catch(() => {}) : Promise.resolve(), new Promise(r => setTimeout(r, 2500))]).then(() => img))
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
  /* the shadow map covers the whole island from the light; walking, it follows the walker more closely for sharper shadows */
  function lightMatrix(dir, center){
    const R = center ? 230 : 430, c = center || [0, 0, 0];
    const snap = v => Math.round(v / 4) * 4, at = [snap(c[0]), 0, snap(c[2])];
    const eye = [at[0] + dir[0] * 1500, dir[1] * 1500, at[2] + dir[2] * 1500];
    return mul(ortho(-R, R, -R, R, 600, 2400), lookAt(eye, at));
  }

  /* ---------- state and camera ---------- */
  const HOME = { az: -1.1, el: 0.62 };
  const st = { az: HOME.az, el: HOME.el, dist: 700, tx: 0, tz: 0, ty: 14, lift: 0, exag: 1, year: 1, change: 0, userLift: 1, walls: true, labels: true };
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
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

  /* ---------- weather and the hour ----------
     "Model view" keeps the page's own lighting: a dark stage and the sun of the 1962 photograph. The other
     settings light the island by the sun of the chosen hour (Japan time) on the date of the photograph shown,
     under the chosen sky. The roofs are the photograph, so they keep its shadows of about ten in the morning. */
  const LAT = 32.6278, LON = 129.7386, RAD = Math.PI / 180;
  const WEATHER = {
    clear:  { cloud: 0.12, sun: 1.00, lift: 0.00, rain: 0,   wave: 0.10, fog: [900, 16000], wet: 0,   wind: 0.3 },
    cloudy: { cloud: 0.80, sun: 0.30, lift: 0.50, rain: 0,   wave: 0.30, fog: [500, 9000],  wet: 0,   wind: 0.5 },
    rain:   { cloud: 1.00, sun: 0.10, lift: 0.62, rain: 0.6, wave: 0.55, fog: [120, 2600],  wet: 1,   wind: 0.6 },
    fog:    { cloud: 0.92, sun: 0.22, lift: 0.55, rain: 0,   wave: 0.12, fog: [12, 320],    wet: 0.4, wind: 0.1 },
    storm:  { cloud: 1.00, sun: 0.04, lift: 0.65, rain: 1.0, wave: 1.00, fog: [50, 1300],   wet: 1,   wind: 1.0 }
  };
  const SKIES = ['stage', 'clear', 'cloudy', 'rain', 'fog', 'storm'];
  const envState = { weather: 'stage', hour: 10 };
  const MOON = (() => { const v = [0.3, 0.75, 0.55], l = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / l); })();
  /* the sun seen from Hashima at a moment (ms since 1970, UTC); a unit vector with east +x, up +y, north -z */
  function sunAt(ms){
    const d = ms / 86400000 - 10957.5;
    const g = (357.529 + 0.98560028 * d) * RAD, q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD, e = (23.439 - 0.00000036 * d) * RAD;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
    const ha = (((18.697374558 + 24.06570982441908 * d) % 24) * 15 + LON) * RAD - ra, lat = LAT * RAD;
    const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha));
    const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(ha));
    return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
  }
  function photoDay(){
    const y = years[Math.round(clamp(st.year, 0, years.length - 1))];
    const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec((y && y.date) || '');
    return m ? [+m[1], +m[2], +m[3]] : [(y && YEAR_OF[y.id]) || 1962, 5, 30];
  }
  function environment(M){
    if (envState.weather === 'stage') return { stage: 1, light: SUN, sun: SUN, tint: [1, 1, 1], env: [1, 1, 0, 0], night: 0, day: 1, wave: 0,
      horizon: HORIZON, top: SKY_TOP, bg: BG, fogC: M.eye, fogR: [500, 2400], cloud: 0, rain: 0, wind: [0, 0], slant: 0, rainCol: [1, 1, 1], eye: M.eye };
    const w = WEATHER[envState.weather], [yy, mm, dd] = photoDay();
    const sun = sunAt(Date.UTC(yy, mm - 1, dd) + (envState.hour - 9) * 3600000), el = Math.asin(sun[1]);
    const day = smooth(-0.105, 0.06, el), dusk = (1 - smooth(0.05, 0.45, el)) * day * (1 - 0.75 * w.cloud);
    const tint = mix3([0.42, 0.52, 0.82], mix3([1, 1, 1], [1.0, 0.64, 0.4], dusk), day);
    const dirK = w.sun * smooth(-0.02, 0.18, el) + 0.3 * (1 - day) * (1 - 0.8 * w.cloud);   /* by night the moon lights a little */
    const ambK = (0.5 + 0.5 * day) * (1 + 0.35 * w.lift) * (1 - 0.3 * w.rain);
    let top = mix3([0.22, 0.43, 0.74], [0.45, 0.49, 0.54], w.cloud), horizon = mix3([0.68, 0.78, 0.86], [0.63, 0.66, 0.69], w.cloud);
    if (envState.weather === 'fog') horizon = [0.74, 0.76, 0.77];
    top = mix3(top, [0.28, 0.33, 0.52], dusk); horizon = mix3(horizon, [0.95, 0.6, 0.38], dusk);
    const dim = 1 - 0.45 * w.rain;
    top = mix3([0.015, 0.025, 0.06], top.map(x => x * dim), day); horizon = mix3([0.06, 0.085, 0.13], horizon.map(x => x * dim), day);
    return { stage: 0, light: el > 0 ? sun : MOON, sun, tint, env: [ambK, dirK, w.lift, w.wet], night: 1 - smooth(-0.12, 0, el), day, wave: w.wave,
      horizon, top, bg: horizon, fogC: walk.on ? M.eye : M.target, fogR: w.fog, cloud: w.cloud, rain: w.rain, wind: [0.1 + 0.9 * w.wind, -0.3 * w.wind],
      slant: 0.08 + 0.4 * w.wind, rainCol: [0.66, 0.7, 0.76].map(x => x * (0.35 + 0.65 * day)), eye: M.eye };
  }
  let E = null;

  /* ---------- walking ----------
     A first-person way round the island. The eye stands 1.55 m above the ground as it is drawn: the terrain
     grid lies in the photograph's frame, so the cell under a true position is found by iterating the relief
     shift of TERRAIN_VS. A body 0.3 m across stops at the sea wall and at the walls of the buildings standing
     in the chosen year, and may step onto a roof level with the ground it walks on. Inside a reconstructed
     room the floors, stairs and galleries carry the feet and the furniture stops the body; doors, curtains,
     laundry and small things let it through. Positions are metres of the crop frame (u, v times the pixel size). */
  const EYE = 1.55, BODY = 1.75, STEP = 0.4, RADIUS = 0.3, WALK_V = 2.8, RUN_V = 8, TURN_V = 1.8;
  const PASS = /^(door|iron-door|fusuma|storm-door|hokora-door|curtain|laundry|line|cord|bulb|shade|aerial|bell-rope|produce|plant|rice|tomato|aubergine|stake|crown|water|pond|fresh-water|sign|room-sign|shop-sign|awning|handle|fridge-handle|goods|cup|bowl|plate|teapot|bottle|sake-bottle|kettle|pot-lid|shoes|pillow|steam-pipe)$/;
  const LANDING = [491.7, 657.9];   /* just inside the sea wall by the Dolphin pier, where the boats land */
  const walk = { on: false, x: 0, z: 0, y: 0, vy: 0, eyeY: 0, pitch: 0, keys: new Set(), joy: null, to: null, last: 0, moving: false, facing: null };
  let walkBlds = [], walkRing = null, mapFit = null;

  function gridHeight(gx, gy){
    const t = terrain, fx = (gx - t.x0) / t.step, fy = (gy - t.y0) / t.step;
    if (!(fx >= 0 && fy >= 0 && fx <= t.w - 1 && fy <= t.h - 1)) return 0;
    const i = Math.min(Math.floor(fx), t.w - 2), j = Math.min(Math.floor(fy), t.h - 2), a = fx - i, b = fy - j, H = t.hts0, w = t.w;
    return (H[j * w + i] * (1 - a) + H[j * w + i + 1] * a) * (1 - b) + (H[(j + 1) * w + i] * (1 - a) + H[(j + 1) * w + i + 1] * a) * b;
  }
  function groundAt(u, v){
    let h = gridHeight(u, v);
    for (let k = 0; k < 3; k++){ const f = 1 - h / HF; h = gridHeight(PP[0] + (u - PP[0]) / f, PP[1] + (v - PP[1]) / f); }
    return h;
  }
  function buildWalkData(){
    walkBlds = model.buildings.map(b => {
      const parts = (b.wings || [b.poly]).filter(p => p.length >= 3).map(p => p.map(q => [q[0] * mpp, q[1] * mpp]));
      const xs = [].concat(...parts).map(q => q[0]), zs = [].concat(...parts).map(q => q[1]), life = lifeOf(b);
      return { b, parts, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs),
        base: b.ground - 0.6, top: b.ground + b.storeys * b.floorH, up: life[0] + 1900, down: life[1] ? life[1] + 1900 : 0, ghost: false };
    }).filter(w => w.parts.length);
    walkRing = model.seawall && model.seawall.length > 3 ? model.seawall.map(p => [p.u * mpp, p.v * mpp]) : null;
    if (walkRing){
      const pts = walkRing.map(p => toWorldTrue(p[0] / mpp, p[1] / mpp)), xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
      mapFit = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
    }
  }
  function aliveAt(w, year){ return smooth(w.up - 1.2, w.up, year) * (w.down ? 1 - smooth(w.down - 1, w.down + 0.5, year) : 1); }
  function inPoly(x, z, p){
    let c = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++){ const a = p[i], b = p[j]; if ((a[1] > z) !== (b[1] > z) && x < a[0] + (z - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) c = !c; }
    return c;
  }
  function nearestOn(x, z, p){
    let best = Infinity, bx = x, bz = z;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++){
      const a = p[j], b = p[i], ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez;
      const t = l2 ? clamp(((x - a[0]) * ex + (z - a[1]) * ez) / l2, 0, 1) : 0, qx = a[0] + t * ex, qz = a[1] + t * ez, d = Math.hypot(x - qx, z - qz);
      if (d < best){ best = d; bx = qx; bz = qz; }
    }
    return [bx, bz, best];
  }
  /* keep the body outside an outline (a building) or inside it (the sea wall) */
  function pushOut(pos, p, keepInside){
    const inside = inPoly(pos[0], pos[1], p), [qx, qz, d] = nearestOn(pos[0], pos[1], p);
    if (inside === !!keepInside && d >= RADIUS) return false;
    const away = inside === !!keepInside ? 1 : -1, nx = (pos[0] - qx) * away, nz = (pos[1] - qz) * away, l = Math.hypot(nx, nz);
    if (l < 1e-6) return false;
    pos[0] = qx + nx / l * RADIUS; pos[1] = qz + nz / l * RADIUS;
    return true;
  }
  function boxLocal(b, x, z){ const a = (b.r || 0) * RAD, ca = Math.cos(a), sa = Math.sin(a), dx = x - b.u * mpp, dz = z - b.v * mpp; return [dx * ca + dz * sa, -dx * sa + dz * ca, ca, sa]; }
  function pushBox(pos, b){
    const [lx, lz, ca, sa] = boxLocal(b, pos[0], pos[1]), hx = b.s[0] / 2, hz = b.s[2] / 2;
    const cx = clamp(lx, -hx, hx), cz = clamp(lz, -hz, hz), d = Math.hypot(lx - cx, lz - cz);
    if (d >= RADIUS) return false;
    let ox, oz;
    if (d > 1e-6){ ox = cx + (lx - cx) / d * RADIUS; oz = cz + (lz - cz) / d * RADIUS; }
    else if (hx - Math.abs(lx) < hz - Math.abs(lz)){ ox = (lx < 0 ? -1 : 1) * (hx + RADIUS); oz = lz; }
    else { ox = lx; oz = (lz < 0 ? -1 : 1) * (hz + RADIUS); }
    pos[0] = b.u * mpp + ox * ca - oz * sa; pos[1] = b.v * mpp + ox * sa + oz * ca;
    return true;
  }
  function sceneNow(){ return scene && interiors ? interiors.scenes[scene] : null; }
  const solidPart = b => !PASS.test(b.t || '') && Math.max(b.s[0], b.s[2]) >= 0.12;
  /* the highest surface under a point that feet at this height can stand on or step up to. In a room below the
     ground (the bath under Building 61) the ground over it does not count, only the room's own floors. */
  function floorAt(x, z, feet, year){
    const ground = groundAt(x / mpp, z / mpp);
    let g = ground > feet + STEP && sceneNow() ? -Infinity : ground;
    for (const w of walkBlds){
      if (w.ghost || x < w.x0 || x > w.x1 || z < w.z0 || z > w.z1) continue;
      const al = aliveAt(w, year);
      if (al < 0.5) continue;
      const top = w.base + (w.top - w.base) * al;
      if (top > g && top <= feet + STEP && w.parts.some(p => inPoly(x, z, p))) g = top;
    }
    const sc = sceneNow();
    if (sc) for (const b of sc.boxes){
      const top = b.y + b.s[1];
      if (top <= g || top > feet + STEP || PASS.test(b.t || '')) continue;
      const q = boxLocal(b, x, z);
      if (Math.abs(q[0]) <= b.s[0] / 2 && Math.abs(q[1]) <= b.s[2] / 2) g = top;
    }
    return g === -Infinity ? ground : g;
  }
  function resolve(pos, year, feet){
    const sc = sceneNow();
    for (let it = 0; it < 3; it++){
      let moved = walkRing ? pushOut(pos, walkRing, true) : false;
      for (const w of walkBlds){
        if (w.ghost || pos[0] < w.x0 - 1 || pos[0] > w.x1 + 1 || pos[1] < w.z0 - 1 || pos[1] > w.z1 + 1) continue;
        const al = aliveAt(w, year);
        if (al < 0.02) continue;
        const top = w.base + (w.top - w.base) * al;
        if (feet + STEP >= top || feet + BODY <= w.base) continue;   /* on its roof, or below its foot */
        for (const p of w.parts) moved = pushOut(pos, p, false) || moved;
      }
      if (sc) for (const b of sc.boxes){
        if (b.y + b.s[1] <= feet + STEP || b.y >= feet + BODY || !solidPart(b)) continue;
        moved = pushBox(pos, b) || moved;
      }
      if (!moved) break;
    }
  }
  function walkInput(){
    const K = walk.keys, J = walk.joy;
    let f = 0, s = 0, turn = 0;
    if (K.has('w') || K.has('arrowup')) f += 1;
    if (K.has('s') || K.has('arrowdown')) f -= 1;
    if (K.has('d')) s += 1;
    if (K.has('a')) s -= 1;
    if (K.has('arrowleft') || K.has('q')) turn += 1;
    if (K.has('arrowright') || K.has('e')) turn -= 1;
    if (J){ f += J.f; s += J.s; }
    return { f, s, turn, run: K.has('shift') || (J ? Math.hypot(J.f, J.s) > 0.92 : false) };
  }
  function walkStep(dt, year){
    const I = walkInput();
    st.az += I.turn * TURN_V * dt;
    const a = st.az + rot, fx = -Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = -Math.sin(a), m = Math.hypot(I.f, I.s);
    let vx = 0, vz = 0;
    if (m > 0.02){
      walk.to = null;
      const k = (I.run ? RUN_V : WALK_V) * Math.min(1, m) / m;
      vx = (fx * I.f + rx * I.s) * k; vz = (fz * I.f + rz * I.s) * k;
    } else if (walk.to){
      const dx = walk.to[0] - walk.x, dz = walk.to[1] - walk.z, d = Math.hypot(dx, dz);
      if (d < 0.25) walk.to = null;
      else { const k = Math.min(RUN_V * 0.75, 1 + d * 1.5) / d; vx = dx * k; vz = dz * k; }
    }
    const pos = [walk.x + vx * dt, walk.z + vz * dt];
    resolve(pos, year, walk.y);
    if (walk.to && Math.hypot(pos[0] - walk.x, pos[1] - walk.z) < Math.hypot(vx, vz) * dt * 0.25) walk.to = null;   /* against a wall */
    walk.x = pos[0]; walk.z = pos[1];
    const g = floorAt(walk.x, walk.z, walk.y, year);
    if (g >= walk.y){ walk.y = g; walk.vy = 0; }
    else { walk.vy -= 9.8 * dt; walk.y = Math.max(g, walk.y + walk.vy * dt); if (walk.y <= g) walk.vy = 0; }
    const want = walk.y + EYE, before = walk.eyeY;
    walk.eyeY += (want - walk.eyeY) * (1 - Math.exp(-dt * 12));
    return m > 0.02 || I.turn !== 0 || !!walk.to || walk.vy !== 0 || Math.abs(want - before) > 0.003;
  }
  /* stand somewhere: on the highest surface below a height, pushed clear of walls */
  function standAt(x, z, below, year){
    walk.x = x; walk.z = z;
    walk.y = floorAt(x, z, below - STEP, year);
    const pos = [x, z];
    resolve(pos, year, walk.y);
    walk.x = pos[0]; walk.z = pos[1]; walk.y = floorAt(walk.x, walk.z, walk.y, year);
    walk.vy = 0; walk.eyeY = walk.y + EYE; walk.to = null;
  }
  /* inside a room: stand where its camera stands when that eye is at standing height over a floor (the shrine,
     seen from outside the torii), else at what the camera looks at (the flat in Building 30, over the light well) */
  function placeInScene(sc, year){
    const cam = sc.flatCamera || sc.camera, ce = Math.cos(cam.el), dx = cam.dist * ce * Math.sin(cam.az), dz = cam.dist * ce * Math.cos(cam.az);
    const c = Math.cos(rot), s = Math.sin(rot);
    const ex = cam.u * mpp + dx * c + dz * s, ez = cam.v * mpp - dx * s + dz * c, ey = cam.y + cam.dist * Math.sin(cam.el);
    const drop = ey - floorAt(ex, ez, ey - 0.3 - STEP, year);
    if (cam.el < 0.5 && drop > 0.9 && drop < 2.4) standAt(ex, ez, ey - 0.3, year);
    else standAt(cam.u * mpp, cam.v * mpp, cam.y, year);
    st.az = cam.az; walk.pitch = -0.05;
  }
  /* out of a room or out of a building that rose round the walker: to the nearest free ground outside it */
  function unstick(year){
    for (const w of walkBlds){
      if (w.ghost || aliveAt(w, year) < 0.5) continue;
      const top = w.base + (w.top - w.base) * aliveAt(w, year);
      if (walk.y + STEP >= top) continue;
      for (const p of w.parts){
        if (!inPoly(walk.x, walk.z, p)) continue;
        const [qx, qz] = nearestOn(walk.x, walk.z, p), dx = qx - walk.x, dz = qz - walk.z, l = Math.hypot(dx, dz) || 1;
        const x = qx + dx / l * (RADIUS + 0.4), z = qz + dz / l * (RADIUS + 0.4);
        standAt(x, z, groundAt(x / mpp, z / mpp) + STEP, year);
      }
    }
  }
  function worldToCropM(X, Z){ const c = Math.cos(rot), s = Math.sin(rot); return [X * c + Z * s + C * mpp, -X * s + Z * c + C * mpp]; }
  /* what lies along a ray from the eye (a direction in the crop frame): the nearest building wall or roof, the ground, a room part */
  function castRay(dir, year, maxT, skip, coarse){
    const o = [walk.x, walk.eyeY, walk.z], sc = sceneNow();
    let best = maxT, hit = null;
    for (const w of walkBlds){
      const al = aliveAt(w, year);
      if (al < 0.5 || w.ghost || w === skip) continue;
      const top = w.base + (w.top - w.base) * al;
      for (const p of w.parts){
        for (let i = 0, j = p.length - 1; i < p.length; j = i++){
          const A = p[j], ex = p[i][0] - A[0], ez = p[i][1] - A[1], den = dir[0] * ez - dir[2] * ex;
          if (Math.abs(den) < 1e-9) continue;
          const wx = A[0] - o[0], wz = A[1] - o[2], t = (wx * ez - wz * ex) / den, u = (wx * dir[2] - wz * dir[0]) / den;
          if (t > 0.05 && t < best && u >= 0 && u <= 1){ const y = o[1] + dir[1] * t; if (y >= w.base && y <= top){ best = t; hit = { kind: 'building', w }; } }
        }
        if (dir[1] < 0){ const t = (top - o[1]) / dir[1]; if (t > 0.05 && t < best && inPoly(o[0] + dir[0] * t, o[2] + dir[2] * t, p)){ best = t; hit = { kind: 'building', w }; } }
      }
    }
    if (sc) for (const b of sc.boxes){
      if (!solidPart(b)) continue;
      const q0 = boxLocal(b, o[0], o[2]), ca = q0[2], sa = q0[3], ld = [dir[0] * ca + dir[2] * sa, dir[1], -dir[0] * sa + dir[2] * ca], lo = [q0[0], o[1] - b.y, q0[1]];
      const lo3 = [-b.s[0] / 2, 0, -b.s[2] / 2], hi3 = [b.s[0] / 2, b.s[1], b.s[2] / 2];
      let t0 = 0.05, t1 = best;
      for (let k = 0; k < 3 && t0 <= t1; k++){
        if (Math.abs(ld[k]) < 1e-9){ if (lo[k] < lo3[k] || lo[k] > hi3[k]) t0 = Infinity; continue; }
        let ta = (lo3[k] - lo[k]) / ld[k], tb = (hi3[k] - lo[k]) / ld[k];
        if (ta > tb){ const x = ta; ta = tb; tb = x; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      }
      if (t0 <= t1 && t0 < best){ best = t0; hit = { kind: 'part', b }; }
    }
    for (let t = 0.3; t < best; t += coarse ? 1 : t < 30 ? 0.2 : 0.8){
      const x = o[0] + dir[0] * t, z = o[2] + dir[2] * t;
      if (o[1] + dir[1] * t <= groundAt(x / mpp, z / mpp)){ best = t; hit = { kind: 'ground' }; break; }
    }
    return hit ? Object.assign(hit, { t: best, x: o[0] + dir[0] * best, z: o[2] + dir[2] * best }) : null;
  }
  /* names and pins stand over the roofs; walking, those behind a nearer building or the rock are hidden */
  function visibleFrom(x, y, z, year, skip){
    const dx = x - walk.x, dy = y - walk.eyeY, dz = z - walk.z, l = Math.hypot(dx, dy, dz);
    if (l < 1 || l > 160) return l < 1;
    return !castRay([dx / l, dy / l, dz / l], year, l - 1, skip, true);
  }
  function updateVisibility(year){
    for (const L of labels){
      const w = walkBlds.find(x => x.b === L.b), b = L.b;
      L.vis = visibleFrom(L.c[0] * mpp, b.ground + b.storeys * b.floorH + 2, L.c[1] * mpp, year, w);
    }
    for (const id of Object.keys(pins)){
      const sp = lab.spots[id], h = spotHeight(sp), f = 1 - h / HF;
      pins[id].vis = visibleFrom((PP[0] + (sp.u - PP[0]) * f) * mpp, h + 7, (PP[1] + (sp.v - PP[1]) * f) * mpp, year, null);
    }
  }
  function screenRay(M, nx, ny){
    const d = [0, 1, 2].map(k => M.ray.f[k] + nx * M.ray.r[k] + ny * M.ray.u[k]), l = Math.hypot(d[0], d[1], d[2]) || 1;
    const c = Math.cos(rot), s = Math.sin(rot), X = d[0] / l, Y = d[1] / l, Z = d[2] / l;
    return [X * c + Z * s, Y, -X * s + Z * c];
  }
  function frameMatrices(){
    const w = canvas.width, h = canvas.height, aspect = w / Math.max(1, h);
    let eye, target, fov, near;
    if (walk.on){
      /* walking: the eye above the walker's feet, looking along the heading, tilted by the pitch */
      const p = toWorldTrue(walk.x / mpp, walk.z / mpp), cp = Math.cos(walk.pitch);
      eye = [p[0], walk.eyeY, p[1]];
      target = [eye[0] - Math.sin(st.az) * cp, eye[1] + Math.sin(walk.pitch), eye[2] - Math.cos(st.az) * cp];
      fov = aspect < 0.8 ? 1.2 : 1.05; near = 0.1;
    } else {
      const ce = Math.cos(st.el);
      target = [st.tx, st.ty, st.tz];
      eye = [target[0] + st.dist * ce * Math.sin(st.az), target[1] + st.dist * Math.sin(st.el), target[2] + st.dist * ce * Math.cos(st.az)];
      const sc = scene && interiors ? interiors.scenes[scene] : null;
      fov = sc && sc.camera && sc.camera.fov ? sc.camera.fov : (scene ? 0.9 : 0.7);
      near = scene ? 0.2 : Math.max(0.5, Math.min(2, st.dist * 0.2));
    }
    const proj = perspective(fov, aspect, near, 26000), view = lookAt(eye, target);
    /* the view's corner rays for the sky */
    let f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
    const fl = Math.hypot(f[0], f[1], f[2]) || 1; f = f.map(x => x / fl);
    let r = [-f[2], 0, f[0]];
    const rl = Math.hypot(r[0], r[2]) || 1; r = r.map(x => x / rl);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const ty = Math.tan(fov / 2), tx = ty * aspect;
    return { proj, view, pv: mul(proj, view), eye, target, ray: { f, r: r.map(x => x * tx), u: u.map(x => x * ty) } };
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
    gl.uniform3fv(U.uBg, E.bg);
    gl.uniform3fv(U.uSun, E.light);
    gl.uniform3fv(U.uHorizon, E.horizon);
    gl.uniform1f(U.uFog, 1);
    gl.uniform3fv(U.uFogC, E.fogC); gl.uniform2fv(U.uFogR, E.fogR); gl.uniform3fv(U.uTint, E.tint); gl.uniform3fv(U.uEye, E.eye);
    gl.uniform4fv(U.uEnv, E.env); gl.uniform1f(U.uNight, E.night); gl.uniform1f(U.uStage, E.stage); gl.uniform1f(U.uWave, E.wave);
    gl.uniform1f(U.uTime, (performance.now() - t0) / 1000);
    gl.uniform1f(U.uShadowOn, shadowOn ? 1 : 0);
    gl.uniform1f(U.uShadowTexel, 1 / (SHADOW || 1));
    gl.uniform1f(U.uGhostId, ghostId);
    gl.uniform1f(U.uGhostId2, ghostId2);
    gl.uniform1f(U.uGhostPass, 0);
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
    attr(w.pos, 0, 2); attr(w.y, 1, 2); attr(w.nor, 2, 3); attr(w.wall, 3, 3); attr(w.info, 4, 4); attr(w.life, 5, 2); attr(w.bid, 6, 1); disableFrom(7);
    gl.uniform1f(P.U.uYOff, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, w.idx);
    gl.drawElements(gl.TRIANGLES, w.count, w.type, 0);
  }
  function drawBoxes(P, m){
    attr(m.pos3, 0, 3); attr(m.nor, 1, 3); attr(m.col, 2, 4); attr(m.mat, 3, 2); disableFrom(4);
    gl.uniform1f(P.U.uYOff, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
    gl.drawElements(gl.TRIANGLES, m.count, m.type, 0);
  }
  function drawRoofs(P, r){
    attr(r.pos, 0, 2); attr(r.y, 1, 2); attr(r.life, 2, 2); attr(r.info, 3, 2); attr(r.bid, 4, 1); disableFrom(5);
    gl.uniform1f(P.U.uYOff, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, r.idx);
    gl.drawElements(gl.TRIANGLES, r.count, r.type, 0);
  }
  let skyBuf = null;
  function drawSky(M){
    if (!skyBuf) skyBuf = buffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(progSky.p);
    attr(skyBuf, 0, 2); disableFrom(1);
    const U = progSky.U;
    gl.uniform3fv(U.uTop, E.top); gl.uniform3fv(U.uHorizon, E.horizon); gl.uniform1f(U.uEl, st.el); gl.uniform1f(U.uStage, E.stage);
    gl.uniform3fv(U.uRayF, M.ray.f); gl.uniform3fv(U.uRayR, M.ray.r); gl.uniform3fv(U.uRayU, M.ray.u);
    gl.uniform3fv(U.uSun, E.sun); gl.uniform3fv(U.uTint, E.tint); gl.uniform1f(U.uCloud, E.cloud); gl.uniform1f(U.uNight, E.night); gl.uniform1f(U.uDay, E.day);
    gl.uniform2fv(U.uWind, E.wind); gl.uniform1f(U.uTime, ((performance.now() - t0) / 1000) % 3600);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.DEPTH_TEST);
  }
  function drawRain(){
    if (!progRain || !E.rain) return;
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(progRain.p);
    attr(skyBuf, 0, 2); disableFrom(1);
    const U = progRain.U;
    gl.uniform2f(U.uRes, canvas.width, canvas.height); gl.uniform1f(U.uTime, ((performance.now() - t0) / 1000) % 600);
    gl.uniform1f(U.uRain, E.rain); gl.uniform1f(U.uSlant, E.slant); gl.uniform3fv(U.uCol, E.rainCol);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
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
    const M = frameMatrices();
    E = environment(M);
    const lightPV = lightMatrix(E.light, walk.on ? M.eye : null);
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
        if (sceneMesh && sceneMesh.count && depthB){ setCommon(depthB, lightPV, lightPV, lift, ym, false); drawBoxes(depthB, sceneMesh); }
      }
      gl.colorMask(true, true, true, true);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
    }
    drawSky(M);
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
      if (sceneMesh){
        /* the interior: opaque boxes, then the assumed (translucent) ones, then the host building as a ghost shell */
        setCommon(progB, M.pv, lightPV, lift, ym, shadowOn);
        if (sceneMesh.count) drawBoxes(progB, sceneMesh);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        if (sceneMeshA && sceneMeshA.count) drawBoxes(progB, sceneMeshA);
        gl.enable(gl.CULL_FACE);
        setCommon(progW, M.pv, lightPV, lift, ym, shadowOn); gl.uniform1f(progW.U.uGhostPass, 1); drawWalls(progW, walls);
        gl.disable(gl.CULL_FACE);
        setCommon(progR, M.pv, lightPV, lift, ym, shadowOn); setTextures(progR, texA, texB, ym); gl.uniform1f(progR.U.uGhostPass, 1); drawRoofs(progR, roofs);
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
    }
    drawRain();
    placeSpots(M.pv, lift, ym);
    if (walk.on) drawMap(ym.year);
    if (compass) compass.style.transform = 'rotate(' + (st.az * 180 / Math.PI).toFixed(1) + 'deg)';
  }

  function frame(now){
    queued = false;
    if (anim) anim(now);
    if (spin) st.az -= 0.0016;
    if (walk.on && terrain){
      const dt = Math.min(0.1, Math.max(0, (now - (walk.last || now)) / 1000));
      walk.last = now;
      walk.moving = walkStep(dt, yearMix().year);
      if (now - (walk.lookedAt || 0) > 200){ walk.lookedAt = now; updateFacing(); }
      if (now - (walk.seenAt || 0) > 300){ walk.seenAt = now; updateVisibility(yearMix().year); }
      if (walkHelp && !walkHelp.hidden && now > (walk.helpUntil || 0)) walkHelp.hidden = true;
    }
    draw();
    if (anim || spin || walk.moving || (!reduce && !document.hidden && sea)) request();   // the water moves, so keep a slow loop while visible
  }
  let lastFrame = 0;
  function request(){ if (!queued){ queued = true; requestAnimationFrame(now => { if (now - lastFrame < 40 && !anim && !spin && !walk.moving){ queued = false; setTimeout(request, 40); return; } lastFrame = now; frame(now); }); } }

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

  /* ---------- the building list in the reader's language ----------
     gunkanjima-model.json lists the buildings in Japanese. gunkanjima-names.json gives the other four
     languages, keyed by the Japanese text (the building table under the model reads the same file), and
     Korean and Chinese names for the source links, keyed by URL. Japanese pages show the list as it is.
     If the file cannot be read the names stay Japanese, as they were before it existed. */
  let names = null;
  const inLang = (e, ja) => (e && (e[LANG] || (LANG !== 'ja' && e.en))) || ja;
  const numbered = ja => /^(\d+)号棟$/.exec(ja || '');
  function buildingName(ja){
    const m = numbered(ja);
    if (m && names) return inLang(names.numbered.name, '{n}').split('{n}').join(m[1]);
    return inLang(names && names.names[ja], ja);
  }
  /* the tag on the model: a number, or the name without its bracket ("General office", not "General office (former winding-engine house)") */
  function buildingLabel(ja){
    const m = numbered(ja);
    if (m && names) return inLang(names.numbered.label, '{n}').split('{n}').join(m[1]);
    const e = names && names.names[ja];
    if (e && e.short && e.short[LANG]) return e.short[LANG];
    if (!names) return ja === '端島小中学校' ? T.schoolShort : ja;
    return buildingName(ja).replace(/\s*[(（][^()（）]*[)）]$/, '');
  }
  const useText = ja => inLang(names && names.uses[ja], ja);
  const noteText = ja => inLang(names && names.notes[ja], ja);
  const structureText = code => inLang(names && names.structures[code], code);
  const sourceLabel = src => inLang(names && names.sources[src.url], '') || src.label[LANG] || src.label.en;

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
      /* inside a room or place the pins and names of the buildings around it would float across the view */
      if (!q || scene){ pin.hidden = true; continue; }
      const sx = (q[0] * 0.5 + 0.5) * w, sy = (1 - (q[1] * 0.5 + 0.5)) * h;
      pin.hidden = sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20 || (walk.on && pin.vis === false);
      pin.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
    }
    const showLabels = st.labels && st.walls && lift > 0.5 && (walk.on ? !scene : st.dist < 420 && !scene);
    for (const L of labels){
      const b = L.b;
      const alive = ym.year >= (b.built || b.seen || 1950) && !(b.gone && ym.year > b.gone);
      if (!showLabels || !alive){ L.el.hidden = true; continue; }
      const xz = toWorldTrue(L.c[0], L.c[1]), y = (b.ground + b.storeys * b.floorH) * lift * st.exag + 2;
      const q = project(pv, xz[0], y, xz[1]);
      if (!q){ L.el.hidden = true; continue; }
      const sx = (q[0] * 0.5 + 0.5) * w, sy = (1 - (q[1] * 0.5 + 0.5)) * h;
      L.el.hidden = sx < 0 || sy < 0 || sx > w || sy > h || q[2] > (walk.on ? 140 : 520) || (walk.on && L.vis === false);
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
      el.textContent = buildingLabel(b.name);
      el.title = buildingName(b.name);
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
      return '<li><a href="' + esc(src.url) + '" target="_blank" rel="noopener">' + esc(sourceLabel(src)) + '</a></li>';
    }).join('') + '</ul>';
    /* the rooms and places of this spot: the same id, or the id and a word (no65 -> no65roof, no65flat; but no3 is not no30) */
    const scIds = interiors ? Object.keys(interiors.scenes).filter(k => k === id || (k.startsWith(id) && !/[0-9]/.test(k.charAt(id.length)))) : [];
    if (scIds.length) html = '<p class="enter-row">' + scIds.map(k => '<button type="button" class="enter-btn" data-scene="' + esc(k) + '">' + esc(enterLabel(k)) + '</button>').join(' ') + '</p>' + html;
    $('spotTitle').textContent = pick(info.name);
    $('spotBody').innerHTML = html;
    wireEnter();
    panel.hidden = false;
    if (fly && !walk.on){
      stopSpin();
      const xz = spotWorld(id);
      if (scene) leaveScene();
      animate({ tx: xz[0], tz: xz[1], ty: 14, dist: 230, el: clamp(st.el, 0.4, 0.9) }, 1200);
    }
  }
  function openBuilding(b, fly){
    if (!panel) return;
    for (const k of Object.keys(pins)) pins[k].classList.remove('is-on');
    const row = (k, v) => v === undefined || v === null || v === '' ? '' : '<tr><th>' + esc(k) + '</th><td>' + v + '</td></tr>';
    let html = '<table class="bld-facts">'
      + row(T.built, b.built ? esc(String(b.built)) + (b.builtNote ? ' <small>' + esc(noteText(b.builtNote)) + '</small>' : '') : (b.seen ? esc(T.unknown) + ' <small>(' + esc(String(b.seen)) + ')</small>' : null))
      + row(T.storeys, esc(String(b.storeys)) + (b.storeysNote ? ' <small>' + esc(noteText(b.storeysNote)) + '</small>' : ''))
      + row(T.units, b.units)
      + row(T.use, b.use ? esc(useText(b.use)) : null)
      + row(T.structure, b.structure ? esc(structureText(b.structure)) : null)
      + row(T.gone, b.gone ? esc(String(b.gone)) + (b.goneNote ? ' <small>' + esc(noteText(b.goneNote)) + '</small>' : '') : null)
      + '</table>';
    if (b.notes) html += '<p>' + esc(noteText(b.notes)) + '</p>';
    const scIds = scenesFor(b.name);
    if (scIds.length) html += '<p class="enter-row">' + scIds.map(k => '<button type="button" class="enter-btn" data-scene="' + esc(k) + '">' + esc(enterLabel(k)) + '</button>').join(' ') + '</p>';
    for (const ph of (b.name && photos[b.name]) || []) html += photoFigure(ph, ph.file, 'spot-photo');
    if (b.source === 'traced1962') html += '<p><small>' + esc(T.traced) + '</small></p>';
    html += '<p class="credit"><a href="' + esc(model.facts.url) + '" target="_blank" rel="noopener">' + esc(T.factsSource) + '</a></p>';
    $('spotTitle').textContent = b.name ? buildingName(b.name) : T.unknown;
    $('spotBody').innerHTML = html;
    wireEnter();
    panel.hidden = false;
    if (fly && !walk.on){
      stopSpin();
      const c = centroid(b.poly), xz = toWorldTrue(c[0], c[1]);
      if (scene && !scenesFor(b.name).includes(scene)) leaveScene();
      if (!scene) animate({ tx: xz[0], tz: xz[1], ty: 14, dist: Math.max(120, b.storeys * b.floorH * 5), el: clamp(st.el, 0.35, 0.8) }, 1100);
    }
  }
  function scenesFor(name){
    if (!interiors) return [];
    return Object.keys(interiors.scenes).filter(k => interiors.scenes[k].building === name);
  }
  /* "Go inside · Rooftop nursery" on the panel of a building that has several scenes */
  function enterLabel(id){
    const sc = interiors.scenes[id], l = sc.label ? (sc.label[LANG] || sc.label.en) : '';
    return (scene === id ? T.leave : T.enter) + (l ? ' · ' + l : '');
  }
  function wireEnter(){
    for (const b of document.querySelectorAll('.enter-btn')) b.onclick = () => { if (scene === b.dataset.scene) leaveScene(); else enterScene(b.dataset.scene, true); };
  }
  function enterScene(id, fly){
    const sc = interiors && interiors.scenes[id];
    if (!sc) return;
    if (scene !== id){
      scene = id;
      sceneMesh = buildBoxes(Object.assign({}, sc, { pass: 'solid' }));
      sceneMeshA = buildBoxes(Object.assign({}, sc, { pass: 'assumed' }));
      const hosts = model.buildings.filter(b => sc.ghost && sc.ghost.includes(b.name));
      ghostId = hosts[0] ? hosts[0].bid : 0;
      ghostId2 = hosts[1] ? hosts[1].bid : -10;
      for (const w of walkBlds) w.ghost = !!(sc.ghost && sc.ghost.includes(w.b.name));
    }
    stopSpin();
    if (walk.on) placeInScene(sc, yearMix().year);
    /* a scene may add an approach: the camera arrives at the first view, then walks on (the shrine: through the torii to the worship hall) */
    const pose = c => { const p = toWorldTrue(c.u, c.v); return { tx: p[0], tz: p[1], ty: c.y, dist: c.dist, el: c.el, az: c.az }; };
    const walkOn = () => { if (sc.approach && scene === id) animate(pose(sc.approach), 3200); };
    if (walk.on){ /* the walker stands in the room instead */ }
    else if (fly) animate(Object.assign(pose(sc.camera), { userLift: 1 }), 1500, walkOn); else { Object.assign(st, pose(sc.camera)); walkOn(); }
    if ($('sceneNote')){
      const n = $('sceneNote');
      n.innerHTML = '<b>' + esc(T.interior) + '</b> ' + esc(pick(sc.text)) + ' <span class="scene-src">' + (sc.sources || []).map(x => '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(sourceLabel(x)) + '</a>').join(' · ') + '</span> <button type="button" id="sceneLeave">' + esc(T.leave) + '</button>';
      n.hidden = false;
      $('sceneLeave').onclick = leaveScene;
    }
    for (const b of document.querySelectorAll('.enter-btn')) b.textContent = enterLabel(b.dataset.scene);
    request();
  }
  function leaveScene(){
    if (!scene) return;
    scene = null; sceneMesh = null; sceneMeshA = null; ghostId = 0; ghostId2 = -10;
    for (const w of walkBlds) w.ghost = false;
    if ($('sceneNote')) $('sceneNote').hidden = true;
    for (const b of document.querySelectorAll('.enter-btn')) b.textContent = enterLabel(b.dataset.scene);
    if (walk.on){ unstick(yearMix().year); request(); return; }
    animate({ ty: 14, dist: Math.max(st.dist, 180), el: Math.max(st.el, 0.45) }, 900);
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
    if (walk.on) stopWalk();
    if (scene) leaveScene();
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
    if (walk.on){ walkDown(e); return; }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2){ const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); dist0 = st.dist; }
  });
  canvas.addEventListener('pointermove', e => {
    if (walk.on){ walkMove(e); return; }
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1){
      if (e.shiftKey || e.buttons === 4 || e.buttons === 2){
        const k = Math.max(st.dist, scene ? 6 : 0) * 0.0016, c = Math.cos(st.az), s = Math.sin(st.az);
        const dx = -(e.clientX - prev[0]) * k, dz = -(e.clientY - prev[1]) * k;
        st.tx += dx * c - dz * s; st.tz += -dx * s - dz * c;
        st.tx = clamp(st.tx, -450, 450); st.tz = clamp(st.tz, -450, 450);
      } else {
        st.az -= (e.clientX - prev[0]) * 0.006;
        st.el = clamp(st.el + (e.clientY - prev[1]) * 0.005, elMin(), EL_MAX);
      }
    } else if (pointers.size === 2 && pinch0){
      const [a, b] = [...pointers.values()];
      st.dist = clamp(dist0 * pinch0 / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), dMin(), dMax());
    }
    request();
  });
  const release = e => { walkUp(e); pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = 0; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    stopSpin();
    if (walk.on){ walkNudge(-Math.sign(e.deltaY) * 1.5); return; }
    st.dist = clamp(st.dist * Math.exp(e.deltaY * 0.0012), dMin(), dMax());
    request();
  }, { passive: false });
  canvas.addEventListener('keydown', e => {
    if (walk.on) return;   /* walking keys are read on the document */
    const moves = { ArrowLeft: () => { st.az += 0.08; }, ArrowRight: () => { st.az -= 0.08; },
      ArrowUp: () => { st.el = clamp(st.el + 0.06, elMin(), EL_MAX); }, ArrowDown: () => { st.el = clamp(st.el - 0.06, elMin(), EL_MAX); },
      '+': () => { st.dist = clamp(st.dist / 1.15, dMin(), dMax()); }, '=': () => { st.dist = clamp(st.dist / 1.15, dMin(), dMax()); },
      '-': () => { st.dist = clamp(st.dist * 1.15, dMin(), dMax()); } };
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
  if (btnReset) btnReset.onclick = () => { if (walk.on) stopWalk(); if (scene) leaveScene(); view('overview', 900); animate({ userLift: 1, ty: 14 }, 900); };
  if (btnWalk) btnWalk.onclick = () => { if (walk.on) stopWalk(); else startWalk(); };
  if (btnPlay) btnPlay.onclick = playYears;
  if (yearRange) yearRange.addEventListener('input', () => {
    stopSpin();
    playing = false;
    anim = null;
    st.year = parseFloat(yearRange.value);
    syncUi();
    request();
  });

  /* ---------- walking: controls, the map and what is ahead ---------- */
  const walkHud = $('walkHud'), walkHelp = $('walkHelp'), walkFacing = $('walkFacing'), walkJoy = $('walkJoy'), walkMap = $('walkMap');
  const touchy = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  let look = null, mapLayer = null;
  function startWalk(opts){
    if (walk.on || !terrain || !walkBlds.length) return;
    stopSpin(); anim = null; playing = false; if (btnPlay) btnPlay.textContent = T.play;
    const year = yearMix().year;
    walk.on = true; walk.keys.clear(); walk.joy = null; walk.to = null; walk.facing = null; walk.last = 0;
    st.exag = 1; st.userLift = 1; st.lift = 1;
    /* the dark stage of the model view is no sky to walk under: walking starts in fair weather, and the stage comes back afterwards */
    walk.autoSky = envState.weather === 'stage';
    if (walk.autoSky) envState.weather = 'clear';
    const sc = sceneNow();
    if (sc) placeInScene(sc, year);
    else {
      /* near the point the model view was looking at when it was close enough and on free ground, else the landing by the pier */
      const t = worldToCropM(st.tx, st.tz), free = st.dist < 320 && walkRing && inPoly(t[0], t[1], walkRing) && !walkBlds.some(w => aliveAt(w, year) > 0.5 && w.parts.some(p => inPoly(t[0], t[1], p)));
      const x = free && !(opts && opts.landing) ? t[0] : LANDING[0] * mpp, z = free && !(opts && opts.landing) ? t[1] : LANDING[1] * mpp;
      standAt(x, z, groundAt(x / mpp, z / mpp) + STEP, year);
      if (!free || (opts && opts.landing)){ const aim = [602 * mpp - walk.x, 500 * mpp - walk.z]; st.az = Math.atan2(-aim[0], -aim[1]) - rot; }
      walk.pitch = 0.08;
    }
    showWalkUi(true);
    try { canvas.focus({ preventScroll: true }); } catch (err) { canvas.focus(); }
    walk.moving = true; walk.helpUntil = performance.now() + 12000;
    say(touchy ? T.walkHelpTouch : T.walkHelp);
    syncUi(); syncEnv(); request();
  }
  function stopWalk(){
    if (!walk.on) return;
    walk.on = false; walk.keys.clear(); walk.joy = null; walk.to = null; walk.moving = false; look = null;
    const p = toWorldTrue(walk.x / mpp, walk.z / mpp);
    Object.assign(st, { tx: p[0], tz: p[1], ty: walk.y, el: scene ? 0.5 : 0.55, dist: scene ? 12 : 150 });
    if (walk.autoSky && envState.weather === 'clear') envState.weather = 'stage';
    walk.autoSky = false;
    showWalkUi(false);
    say(T.ready);
    syncUi(); syncEnv(); request();
  }
  function showWalkUi(on){
    if (walkHud) walkHud.hidden = !on;
    if (walkMap){ walkMap.hidden = !on; walkMap.setAttribute('role', 'img'); walkMap.setAttribute('aria-label', T.walkMap || ''); }
    if (walkJoy) walkJoy.hidden = true;
    if (walkFacing) walkFacing.hidden = true;
    if (walkHelp){ walkHelp.textContent = touchy ? T.walkHelpTouch : T.walkHelp; walkHelp.hidden = !on; }
    canvas.classList.toggle('is-walking', on);
    if (btnWalk){ btnWalk.textContent = on ? T.walkStop : T.walk; btnWalk.setAttribute('aria-pressed', String(on)); }
    for (const b of [btnFlat, btnExag]) if (b) b.disabled = on;
  }
  const WALK_KEYS = ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'];
  function walkKey(e, down){
    const k = (e.key || '').toLowerCase();
    if (down && k === 'escape'){ if (!panel || panel.hidden) stopWalk(); return; }
    if (!WALK_KEYS.includes(k)) return;
    e.preventDefault();
    if (down){ if (!walk.keys.has(k)){ walk.keys.add(k); walk.moving = true; request(); } }
    else walk.keys.delete(k);
  }
  const typing = el => !!el && (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable);
  document.addEventListener('keydown', e => { if (walk.on && !typing(e.target)) walkKey(e, true); }, true);
  document.addEventListener('keyup', e => { if (walk.on) walkKey(e, false); }, true);
  window.addEventListener('blur', () => { walk.keys.clear(); });
  function walkNudge(d){
    const a = st.az + rot, x = walk.x - Math.sin(a) * d, z = walk.z - Math.cos(a) * d;
    walk.to = [x, z]; walk.moving = true; request();
  }
  function showJoy(x, y, dx, dy){
    if (!walkJoy) return;
    walkJoy.hidden = false;
    walkJoy.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    walkJoy.firstElementChild.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
  }
  function walkDown(e){
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    /* on a touch screen the lower left of the view is the stick; everywhere else a drag looks round */
    if (e.pointerType === 'touch' && !walk.joy && x < r.width * 0.45 && y > r.height * 0.3){
      walk.joy = { id: e.pointerId, x0: x, y0: y, f: 0, s: 0 };
      showJoy(x, y, 0, 0);
      return;
    }
    if (!look) look = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now() };
  }
  function walkMove(e){
    if (walk.joy && e.pointerId === walk.joy.id){
      const r = canvas.getBoundingClientRect(), R = 46, dx = e.clientX - r.left - walk.joy.x0, dy = e.clientY - r.top - walk.joy.y0, l = Math.hypot(dx, dy), k = l > R ? R / l : 1;
      walk.joy.s = dx * k / R; walk.joy.f = -dy * k / R;
      showJoy(walk.joy.x0, walk.joy.y0, dx * k, dy * k);
      walk.moving = true; request();
      return;
    }
    if (look && e.pointerId === look.id){
      /* the view follows the finger or the mouse, as if the picture were held and dragged */
      const k = e.pointerType === 'touch' ? 0.006 : 0.0045;
      st.az += (e.clientX - look.x) * k;
      walk.pitch = clamp(walk.pitch + (e.clientY - look.y) * k, -1.3, 1.3);
      look.x = e.clientX; look.y = e.clientY;
      request();
    }
  }
  function walkUp(e){
    if (!walk.on) return;
    if (walk.joy && e.pointerId === walk.joy.id){ walk.joy = null; if (walkJoy) walkJoy.hidden = true; request(); return; }
    if (look && e.pointerId === look.id){
      const tap = e.type === 'pointerup' && Math.hypot(e.clientX - look.x0, e.clientY - look.y0) < 8 && performance.now() - look.t < 600;
      look = null;
      if (tap) walkTap(e.clientX, e.clientY);
    }
  }
  /* a tap on a building opens its facts; on the ground or a floor it walks there */
  function walkTap(cx, cy){
    const r = canvas.getBoundingClientRect(), M = frameMatrices(), year = yearMix().year;
    const hit = castRay(screenRay(M, (cx - r.left) / r.width * 2 - 1, 1 - (cy - r.top) / r.height * 2), year, 400);
    if (!hit) return;
    if (hit.kind === 'building'){ openBuilding(hit.w.b, false); return; }
    walk.to = [hit.x, hit.z]; walk.moving = true; request();
  }
  /* the building straight ahead, named at the foot of the view with a button for its facts */
  function updateFacing(){
    if (!walkFacing) return;
    const hit = scene ? null : castRay(screenRay(frameMatrices(), 0, 0), yearMix().year, 90);
    const b = hit && hit.kind === 'building' && hit.w.b.name ? hit.w.b : null;
    if (b === walk.facing) return;
    walk.facing = b;
    walkFacing.hidden = !b;
    if (!b) return;
    const use = b.use ? useText(b.use) : '';
    walkFacing.innerHTML = '<b>' + esc(buildingName(b.name)) + '</b>' + (b.built ? ' · ' + esc(String(b.built)) : '') + (use && use !== buildingName(b.name) ? ' · ' + esc(use) : '') + ' <span aria-hidden="true">›</span>';
    walkFacing.onclick = () => openBuilding(b, false);
  }
  /* the island from above, north up: the buildings of the year, the walker and the way the walker faces; a tap goes there */
  function mapPoint(W, H, X, Z){
    const k = Math.min((W - 10) / (mapFit.x1 - mapFit.x0), (H - 10) / (mapFit.z1 - mapFit.z0));
    return [W / 2 + (X - (mapFit.x0 + mapFit.x1) / 2) * k, H / 2 + (Z - (mapFit.z0 + mapFit.z1) / 2) * k, k];
  }
  function drawMap(year){
    if (!walkMap || walkMap.hidden || !mapFit) return;
    walkMap.style.visibility = scene ? 'hidden' : '';   /* inside a room the room's note takes the top of the view */
    if (scene) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = walkMap.clientWidth, H = walkMap.clientHeight;
    if (!W || !H) return;
    if (walkMap.width !== Math.round(W * dpr) || walkMap.height !== Math.round(H * dpr)){ walkMap.width = Math.round(W * dpr); walkMap.height = Math.round(H * dpr); }
    /* the island and its buildings change only with the year: drawn once into a layer, then copied each frame */
    const key = W + 'x' + H + '@' + dpr + ':' + walkBlds.map(w => aliveAt(w, year) < 0.5 ? 0 : 1).join('');
    if (!mapLayer || mapLayer.key !== key){
      mapLayer = document.createElement('canvas'); mapLayer.key = key;
      mapLayer.width = walkMap.width; mapLayer.height = walkMap.height;
      const l = mapLayer.getContext('2d');
      l.setTransform(dpr, 0, 0, dpr, 0, 0);
      const trace = p => { l.beginPath(); p.forEach((q, i) => { const w = toWorldTrue(q[0] / mpp, q[1] / mpp), m = mapPoint(W, H, w[0], w[1]); if (i) l.lineTo(m[0], m[1]); else l.moveTo(m[0], m[1]); }); l.closePath(); };
      l.fillStyle = '#4f5f5b'; trace(walkRing); l.fill();
      l.fillStyle = '#d8d2c4';
      for (const w of walkBlds){ if (aliveAt(w, year) < 0.5) continue; for (const p of w.parts){ trace(p); l.fill(); } }
      l.fillStyle = '#f3f1ea'; l.font = '600 10px system-ui,sans-serif'; l.textAlign = 'center'; l.fillText('N', W - 9, 12);
    }
    const g = walkMap.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, walkMap.width, walkMap.height);
    g.drawImage(mapLayer, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const me = toWorldTrue(walk.x / mpp, walk.z / mpp), m = mapPoint(W, H, me[0], me[1]);
    g.save(); g.translate(m[0], m[1]); g.rotate(-st.az);
    g.fillStyle = '#f5d59655'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 26, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); g.closePath(); g.fill();
    g.fillStyle = '#e0563f'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2.5); g.lineTo(-5, 5); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  if (walkMap) walkMap.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    if (!walk.on || !mapFit) return;
    const r = walkMap.getBoundingClientRect(), W = r.width, H = r.height, k = mapPoint(W, H, 0, 0)[2];
    const X = (e.clientX - r.left - W / 2) / k + (mapFit.x0 + mapFit.x1) / 2, Z = (e.clientY - r.top - H / 2) / k + (mapFit.z0 + mapFit.z1) / 2;
    const [x, z] = worldToCropM(X, Z), year = yearMix().year;
    if (!walkRing || !inPoly(x, z, walkRing)) return;
    if (scene) leaveScene();
    standAt(x, z, groundAt(x / mpp, z / mpp) + STEP, year);
    unstick(year);
    try { canvas.focus({ preventScroll: true }); } catch (err) { canvas.focus(); }
    walk.moving = true; request();
  });

  /* ---------- weather and hour controls ---------- */
  const envWeather = $('envWeather'), envHour = $('envHour'), envHourLabel = $('envHourLabel'), envNote = $('envNote');
  const hhmm = h => { const m = Math.round(h * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  function syncEnv(){
    if (envWeather) envWeather.value = envState.weather;
    if (envHour && document.activeElement !== envHour) envHour.value = String(envState.hour);
    if (envHourLabel) envHourLabel.textContent = hhmm(envState.hour);
    if (envNote) envNote.hidden = envState.weather === 'stage';
  }
  if (envWeather){
    const key = k => 'sky' + k.charAt(0).toUpperCase() + k.slice(1);
    envWeather.innerHTML = SKIES.map(k => '<option value="' + k + '">' + esc(T[key(k)] || k) + '</option>').join('');
    envWeather.addEventListener('change', () => { envState.weather = SKIES.includes(envWeather.value) ? envWeather.value : 'stage'; walk.autoSky = false; syncEnv(); request(); });
  }
  if (envHour) envHour.addEventListener('input', () => {
    envState.hour = clamp(parseFloat(envHour.value) || 0, 0, 24);
    walk.autoSky = false;
    if (envState.weather === 'stage') envState.weather = 'clear';
    syncEnv(); request();
  });
  syncEnv();

  /* ---------- audio cues ---------- */
  function applyCues(lines, t){
    const target = { year: null, lift: null, change: null, view: null, spot: null, interior: null };
    for (const line of lines){
      if (line.start > t + 0.05) break;
      const c = line.cue;
      if (!c) continue;
      if (c.year !== undefined) target.year = c.year;
      if (c.lift !== undefined) target.lift = c.lift;
      if (c.change !== undefined) target.change = c.change;
      if (c.view !== undefined){ target.view = c.view; target.spot = null; target.interior = null; }
      if (c.spot !== undefined){ target.spot = c.spot; target.view = null; target.interior = null; }
      if (c.interior !== undefined){ target.interior = c.interior; }
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
    if (cue.change !== null) to.change = cue.change ? 1 : 0;
    /* while walking the narration may change the year and the colours, but the walker keeps the view */
    if (walk.on){ animate(to, 1600); return; }
    if (cue.lift !== null) to.userLift = cue.lift;
    if (cue.interior && interiors && interiors.scenes[cue.interior]){ enterScene(cue.interior, true); return; }
    if (scene) leaveScene();
    if (cue.spot && lab.spots[cue.spot]){
      const xz = spotWorld(cue.spot);
      Object.assign(to, { tx: xz[0], tz: xz[1], ty: 14, dist: 230, el: 0.58 });
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
    fetch(asset('gunkanjima-photos.json')).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(asset('gunkanjima-interiors.json')).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(asset('gunkanjima-names.json')).then(r => r.ok ? r.json() : null).catch(() => null)
  ]).then(([meta, mdl, words, ph, ints, nm]) => {
    lab = meta; model = mdl; texts = words; photos = ph && ph.photos ? ph.photos : {}; interiors = ints && ints.scenes ? ints : null;
    names = nm && nm.numbered && nm.names && nm.uses && nm.notes && nm.structures && nm.sources ? nm : null;
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
      buildWalkData();
      st.year = Math.max(0, years.findIndex(y => y.id === '1962'));
      buildPins();
      return texture(st.year).promise;
    });
  }).then(() => {
    for (const c of controls) if (c) c.disabled = false;
    say(T.ready);
    st.dist = homeDistance();
    syncUi();
    /* /3d/…?scene=no65roof or #scene=…: open the page already inside a room (shared links, checks);
       ?sky=rain&hour=19 sets the weather and the hour, ?walk=1 starts on foot */
    const param = name => (new RegExp('[?&#]' + name + '=([a-z0-9.]+)', 'i').exec(location.search + ' ' + location.hash) || [])[1];
    if (SKIES.includes(param('sky'))) envState.weather = param('sky');
    if (param('hour') !== undefined && isFinite(+param('hour'))){ envState.hour = clamp(+param('hour'), 0, 24); if (envState.weather === 'stage') envState.weather = 'clear'; }
    syncEnv();
    const wantScene = param('scene'), wantWalk = param('walk') === '1';
    if (wantScene && interiors && interiors.scenes[wantScene]){ st.lift = 1; st.userLift = 1; enterScene(wantScene, false); if (wantWalk) startWalk(); request(); return; }
    if (wantWalk){ st.lift = 1; st.userLift = 1; startWalk({ landing: true }); return; }
    if (reduce){ st.lift = 1; request(); return; }
    st.el = 1.2;
    animate({ lift: 1, el: HOME.el }, 2200, () => { spin = true; request(); });
    setTimeout(() => years.forEach((y, i) => texture(i)), 2500);
  }).catch(err => {
    console.error(err);
    fallback(T.failed);
  });

  window.jtaLab3d = { st, draw: () => draw(), view, setYear, openSpot, closeSpot, enterScene, leaveScene, scene: () => scene, openBuilding: name => { const b = model.buildings.find(x => x.name === name); if (b) openBuilding(b, true); },
    years: () => years.map(y => y.id), loaded: i => texture(i).promise, shadows: () => !!shadowFb, walls: () => !!walls, model: () => model,
    startWalk, stopWalk, walk: () => ({ on: walk.on, x: walk.x, z: walk.z, y: walk.y, eyeY: walk.eyeY, az: st.az, pitch: walk.pitch, facing: walk.facing && walk.facing.name }),
    setWalk: o => { Object.assign(walk, o); request(); },
    goTo: (u, v, az, pitch) => { if (!walk.on) startWalk(); const y = yearMix().year; standAt(u * mpp, v * mpp, groundAt(u, v) + STEP, y); unstick(y); if (az !== undefined) st.az = az; if (pitch !== undefined) walk.pitch = pitch; walk.seenAt = 0; walk.lookedAt = 0; walk.moving = true; request(); }, sky: o => { if (o) Object.assign(envState, o); syncEnv(); request(); return Object.assign({}, envState); },
    sunAt, groundAt, env: () => E };
})();
