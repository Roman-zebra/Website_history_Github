/* Gunkanjima, 1947 to today: a lab test for Japan Time Atlas. Plain WebGL, no libraries.
   Version 7 is a reconstruction model rather than a raw height field: the terrain is GSI's 5 m
   elevation, the sea wall is the OpenStreetMap ring, and every building is a prism drawn from its
   outline, its storey count and its completion year from the published building list, so the slider
   shows each building rising in the year it was built and falling when it collapsed. Façades are
   drawn by style (workers' housing with open galleries, apartment blocks, the school, workshops,
   wooden houses, the shrine) and are a drawing, not a photograph. Roofs and ground carry the aerial
   photograph of the chosen year; the sun of 30 May casts shadows through a shadow map. */
(function(){
  'use strict';
  const V = '22';
  const GAME = !!window.JTA_WALK_PAGE;
  const here = document.currentScript ? document.currentScript.src : location.href;
  const asset = name => new URL(name + '?v=' + V, here).href;
  const LANG = window.LAB_LANG || 'en';
  const LOCAL = {
    ja: { weatherDusk: '天気：夕暮れ', weatherOvercast: '天気：曇天', weatherSnow: '天気：雪', weatherNight: '天気：月夜', walk: '島内を歩く', orbit: '俯瞰に戻る', walkReady: '歩行モード：WASD・矢印キーまたは画面のボタンで移動し、ドラッグで周囲を見回せます。', weatherClear: '天気：晴れ', weatherCloudy: '天気：曇り', weatherRain: '天気：雨', weatherFog: '天気：霧', outline: '建物輪郭', outlineOsm: 'OpenStreetMapの建物輪郭', outlineAerial: '1962年の空中写真からトレース' },
    ko: { weatherDusk: '날씨: 해 질 녘', weatherOvercast: '날씨: 잔뜩 흐림', weatherSnow: '날씨: 눈', weatherNight: '날씨: 달밤', walk: '섬을 걷기', orbit: '조감도로 돌아가기', walkReady: '걷기 모드: WASD·화살표 키 또는 화면 버튼으로 이동하고 드래그해서 둘러보세요.', weatherClear: '날씨: 맑음', weatherCloudy: '날씨: 흐림', weatherRain: '날씨: 비', weatherFog: '날씨: 안개', outline: '건물 윤곽', outlineOsm: 'OpenStreetMap 건물 윤곽', outlineAerial: '1962년 항공사진에서 추적' },
    'zh-Hans': { weatherDusk: '天气：黄昏', weatherOvercast: '天气：阴天', weatherSnow: '天气：雪', weatherNight: '天气：月夜', walk: '步行探索', orbit: '返回俯瞰', walkReady: '步行模式：用 WASD、方向键或屏幕按钮移动，拖动查看四周。', weatherClear: '天气：晴', weatherCloudy: '天气：阴', weatherRain: '天气：雨', weatherFog: '天气：雾', outline: '建筑轮廓', outlineOsm: 'OpenStreetMap 建筑轮廓', outlineAerial: '根据1962年航拍照片描绘' },
    'zh-Hant': { weatherDusk: '天氣：黃昏', weatherOvercast: '天氣：陰天', weatherSnow: '天氣：雪', weatherNight: '天氣：月夜', walk: '步行探索', orbit: '返回俯瞰', walkReady: '步行模式：用 WASD、方向鍵或螢幕按鈕移動，拖曳查看四周。', weatherClear: '天氣：晴', weatherCloudy: '天氣：陰', weatherRain: '天氣：雨', weatherFog: '天氣：霧', outline: '建築輪廓', outlineOsm: 'OpenStreetMap 建築輪廓', outlineAerial: '依1962年航空照片描繪' }
  };
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
    walk: 'Walk the island', orbit: 'Orbit view', walkReady: 'Walk mode: use WASD or the arrows to move; drag to look.',
    weatherClear: 'Weather: clear', weatherCloudy: 'Weather: cloudy', weatherRain: 'Weather: rain', weatherFog: 'Weather: fog',
    weatherDusk: 'Weather: dusk', weatherOvercast: 'Weather: overcast', weatherSnow: 'Weather: snow', weatherNight: 'Weather: moonlit night',
    outline: 'Building footprint', outlineOsm: 'OpenStreetMap building footprint', outlineAerial: 'Traced from the 1962 aerial photograph'
  }, LOCAL[LANG] || {}, window.LAB_TEXT || {});

  const $ = id => document.getElementById(id);
  const canvas = $('view'), status = $('viewStatus'), compass = $('viewCompass');
  const weatherFx = $('weatherFx'), weatherCtx = weatherFx && weatherFx.getContext('2d');
  const btnFlat = $('btnFlat'), btnReset = $('btnReset'), btnExag = $('btnExag'), btnChange = $('btnChange'), btnWalls = $('btnWalls'), btnLabels = $('btnLabels');
  const btnWalk = $('btnWalk'), btnWeather = $('btnWeather'), walkPad = $('walkPad');
  const yearRange = $('yearRange'), yearLabel = $('yearLabel'), yearNote = $('yearNote'), yearTicks = $('yearTicks'), btnPlay = $('btnPlayYears');
  const spotLayer = $('spotLayer'), panel = $('spotPanel');
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const lowEnd = !!((window.matchMedia && matchMedia('(max-width: 720px)').matches) || (navigator.deviceMemory && navigator.deviceMemory <= 4));
  const say = s => { if (status) status.textContent = s; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pick = obj => obj ? (obj[LANG] || obj.en || '') : '';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const unit = v => { const l = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / l); };
  const WEATHER = [
    { key: 'clear', bg: [0.075, 0.117, 0.13], horizon: [0.40, 0.47, 0.50], sky: [0.10, 0.16, 0.20], sun: unit([0.492, 0.863, 0.112]), fog: 0.28, rain: 0 },
    { key: 'cloudy', bg: [0.12, 0.14, 0.15], horizon: [0.46, 0.49, 0.50], sky: [0.25, 0.29, 0.31], sun: unit([0.35, 0.72, 0.18]), fog: 0.72, rain: 0 },
    { key: 'rain', bg: [0.07, 0.09, 0.10], horizon: [0.30, 0.34, 0.36], sky: [0.13, 0.16, 0.18], sun: unit([0.30, 0.66, 0.12]), fog: 1.08, rain: 1 },
    { key: 'fog', bg: [0.31, 0.34, 0.34], horizon: [0.58, 0.60, 0.59], sky: [0.48, 0.51, 0.51], sun: unit([0.24, 0.72, 0.10]), fog: 1.65, rain: 0 }
  ];
  /* Walking view, sengoku look (the default): an original, SEKIRO-inspired treatment built from the user's reference
     video study (docs/gunkanjima-video-study-sengoku.md). No game assets, code or footage are used. Six skies:
     dusk, overcast, rain, fog, snow and a moonlit night. Colours are display values; lin() squares them (gamma 2)
     for the shaders' linear lighting. key/ambient values are linear light and may exceed 1. */
  const lin = c => c.map(x => x * x);
  const sunAt = (az, el) => [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
  const SENGOKU = [
    { key: 'dusk', lift: [.02, .02, .024], gamma: [.96, 1, 1.06], gain: [1, .94, .86], sun: sunAt(-1.2, .26), top: [.235, .29, .39], horizon: [.94, .70, .48], far: [.60, .56, .60], sunC: [1, .69, .44], fog: [.55, .53, .56],
      keyC: [1.45, 1.0, .68], ambS: [.15, .17, .25], ambG: [.08, .07, .06], fogK: [.0028, .015, .06, .97], cover: .45, storm: 0, snow: 0, wet: 0, rain: 0, night: 0, bg: [.30, .28, .31] },
    { key: 'overcast', lift: [.10, .105, .11], gamma: [1.02, 1, .97], gain: [.86, .88, .90], sun: sunAt(-.9, .62), top: [.47, .50, .54], horizon: [.72, .72, .72], far: [.64, .66, .68], sunC: [.80, .80, .78], fog: [.63, .65, .67],
      keyC: [.52, .54, .58], ambS: [.40, .44, .50], ambG: [.15, .14, .13], fogK: [.006, .025, .05, .97], cover: .95, storm: .35, snow: 0, wet: .15, rain: 0, night: 0, bg: [.40, .42, .45] },
    { key: 'rain', lift: [.07, .08, .085], gamma: [1.03, 1, .96], gain: [.78, .81, .84], sun: sunAt(-.9, .6), top: [.30, .33, .37], horizon: [.52, .54, .56], far: [.46, .49, .52], sunC: [.55, .56, .58], fog: [.46, .49, .52],
      keyC: [.28, .30, .34], ambS: [.26, .29, .34], ambG: [.09, .09, .09], fogK: [.008, .03, .05, .98], cover: 1, storm: .8, snow: 0, wet: 1, rain: 1, night: 0, bg: [.22, .24, .27] },
    { key: 'mist', lift: [.14, .145, .145], gamma: [1, 1, .98], gain: [.86, .87, .87], sun: sunAt(-1.0, .45), top: [.62, .64, .65], horizon: [.80, .80, .78], far: [.72, .73, .73], sunC: [.95, .90, .82], fog: [.72, .73, .73],
      keyC: [.60, .58, .54], ambS: [.42, .45, .48], ambG: [.16, .15, .14], fogK: [.02, .08, .035, .995], cover: .8, storm: .2, snow: 0, wet: .35, rain: 0, night: 0, bg: [.52, .53, .53] },
    { key: 'snow', lift: [.10, .11, .12], gamma: [1.03, 1, .95], gain: [.88, .90, .94], sun: sunAt(-1.0, .5), top: [.52, .56, .62], horizon: [.80, .82, .86], far: [.72, .75, .80], sunC: [.92, .90, .88], fog: [.70, .73, .78],
      keyC: [.55, .58, .66], ambS: [.36, .41, .51], ambG: [.20, .21, .24], fogK: [.007, .03, .04, .98], cover: .9, storm: .3, snow: 1, wet: 0, rain: 0, night: 0, bg: [.55, .58, .62] },
    { key: 'night', lift: [.05, .07, .08], gamma: [1.02, 1, .96], gain: [.95, .93, .92], sun: sunAt(1.9, .55), top: [.035, .05, .09], horizon: [.20, .24, .33], far: [.13, .16, .23], sunC: [.62, .70, .86], fog: [.14, .17, .24],
      keyC: [.16, .21, .34], ambS: [.035, .05, .09], ambG: [.015, .015, .02], fogK: [.004, .02, .05, .96], cover: .35, storm: 0, snow: 0, wet: 0, rain: 0, night: 1, bg: [.04, .05, .08] }
  ];
  const sengoku = () => GAME && look.style === 'sengoku';
  const weatherCount = () => sengoku() ? SENGOKU.length : WEATHER.length;
  const env = () => {
    const e = WEATHER[st.weather] || WEATHER[0];
    if (!GAME) return e;
    if (sengoku()){
      const s = SENGOKU[st.weather] || SENGOKU[0];
      const fog = lin(s.fog), fk = s.fogK.slice();
      fk[0] *= look.haze; fk[1] *= look.haze;
      return { key: s.key, lift: s.lift, gamma: s.gamma, gain: s.gain, sun: unit(s.sun), bg: s.bg, horizon: lin(s.horizon), skyHorizon: lin(s.horizon), mid: lin(s.far), sky: lin(s.top), sunC: lin(s.sunC), fogC: fog,
        keyC: s.keyC, ambS: s.ambS, ambG: s.ambG, fogK: fk, cover: s.cover, storm: s.storm, snow: Math.max(s.snow, look.preset === 'winter' ? .75 : 0), wet: s.wet, rain: s.rain, night: s.night, lamps: [.06, .03, .08, .06, .06, 1][st.weather] || .06, fog: 1 };
    }
    // Clear sky stops between the video's reference image (#36C9F9 to #C1F2F8) and its final scene (#6BC8F8 to #BCE8F7); cyan haze.
    const palettes=[{bg:[.23,.62,.77],horizon:[.72,.91,.94],skyHorizon:[.74,.91,.97],mid:[.45,.85,.98],sky:[.30,.78,.97],fog:.3},{bg:[.42,.61,.70],horizon:[.78,.83,.85],sky:[.40,.58,.74],fog:.50},{bg:[.25,.40,.51],horizon:[.56,.67,.74],sky:[.25,.39,.56],fog:.78},{bg:[.60,.75,.77],horizon:[.78,.88,.87],sky:[.55,.73,.80],fog:1.10}];
    const p=Object.assign({},e,palettes[st.weather]);
    p.skyHorizon=p.skyHorizon||p.horizon;p.mid=p.mid||p.sky.map((c,i)=>c*.55+p.horizon[i]*.45);p.fog*=look.haze;
    return p;
  };
  /* Walking-view look, adjustable in the page menu (the video's lesson: expose parameters and tune by eye). */
  /* Palette presets, bright to dark, for the ground, grass and foliage together. Summer follows the
     reference image in the video; the others follow its season presets (highlight/shadow pairs). */
  const PRESETS = {
    spring: ['#d6ff9a', '#bdf07e', '#9fdc70', '#6eb863', '#3f8a55'],
    summer: ['#bdf57a', '#a0e65e', '#82d052', '#52a04a', '#2c7439'],
    autumn: ['#edc75a', '#e0a347', '#c67a35', '#8e4a1d', '#4d1d07'],
    winter: ['#ebf2ff', '#d2deef', '#aebfd6', '#7d91ab', '#475b73'],
    magic: ['#c9a2ee', '#ab78dd', '#8455c0', '#52308f', '#200951']
  };
  /* The same five preset buttons in the sengoku look: autumn maples over straw grass (default), snow, deep summer
     moss, spring cherry and a violet haze. Tints: grass tip, grass base, then foliage bright, mid and dark. */
  const SENGOKU_PRESETS = {
    autumn: ['#9c8a68', '#4a4230', '#b44a5b', '#8a3f4a', '#4f2630'],
    winter: ['#a59d8a', '#4a4538', '#7a6a5a', '#4e4238', '#25201c'],
    summer: ['#7d8a55', '#2f3a22', '#5d7a3a', '#2f4a26', '#16241a'],
    spring: ['#93a066', '#3f4a2c', '#efc3cf', '#d892a8', '#7d4a5a'],
    magic: ['#a99bb0', '#4a3f55', '#c9a0d8', '#8a5aa8', '#3a2248']
  };
  /* Each look has its own defaults; choosing a look restores them so the sliders suit it. */
  const LOOK_BASE = { quality: 'auto', grass: 1, flowers: 1, land: 1, haze: 1, cloudScale: 66, cloudSpeed: 3.5, spots: 1, wind: 1, sparkle: 1, ambient: 1, slope: 28 };
  const LOOK_STYLES = {
    sengoku: { style: 'sengoku', preset: 'autumn', exposure: .9, saturation: .8, contrast: .32, warmth: 0, clouds: .3, mottle: .3, sheen: .05, streaks: 0, grain: .012, bloom: lowEnd ? 0 : .55 },
    anime: { style: 'anime', preset: 'summer', exposure: 1.04, saturation: 1.06, contrast: .2, warmth: .4, clouds: .55, mottle: .32, sheen: .13, streaks: .25, grain: .03, bloom: lowEnd ? 0 : .4 }
  };
  const LOOK_DEFAULT = Object.assign({}, LOOK_BASE, LOOK_STYLES.sengoku);
  const LOOK_RANGE = { slope: [10, 60], exposure: [.6, 1.6], saturation: [0, 2], contrast: [0, 1], warmth: [-1, 1], grass: [0, 1.5], flowers: [0, 2], land: [0, 1.5], haze: [0, 2],
    clouds: [0, 1], cloudScale: [20, 200], cloudSpeed: [0, 12], mottle: [0, 1], sheen: [0, .6], streaks: [0, 1], grain: [0, .12], spots: [.4, 3], wind: [0, 2], sparkle: [0, 2], ambient: [0, 2], bloom: [0, 1.5] };
  /* Quality tiers after the video's mobile/mid/PC split: grass density, the far grass ring, the bloom pass and the
     render scale (pixel density cap), which dominates the cost of the full-screen shading. */
  const QUALITY = { auto: 1, low: .5, mid: .8, high: 1 };
  const dprCap = () => GAME ? ({ low: 1, mid: 1.5, auto: lowEnd ? 1.5 : 2 }[look.quality] || 2) : 2;
  const look = Object.assign({}, LOOK_DEFAULT);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function setLook(patch){
    patch = patch || {};
    if (own(LOOK_STYLES, patch.style) && patch.style !== look.style){
      Object.assign(look, LOOK_STYLES[patch.style]);
      if (st.weather >= weatherCount()) st.weather = 0;
      syncUi();
    }
    for (const k of Object.keys(patch)){
      const v = patch[k];
      if (k === 'style') continue;
      if (k === 'preset'){ if (own(PRESETS, v)) look.preset = v; }
      else if (k === 'quality'){ if (own(QUALITY, v) && look.quality !== v){ look.quality = v; resize(); } }
      else if (own(LOOK_RANGE, k) && typeof v === 'number' && isFinite(v)) look[k] = Math.min(LOOK_RANGE[k][1], Math.max(LOOK_RANGE[k][0], v));
    }
    return Object.assign({}, look);
  }
  const bloomAmount = () => look.quality === 'low' ? 0 : look.bloom;
  /* Bare-soil slope band for the ground shader: the video's auto-paint angle with a 10 degree blend, as n.y limits. */
  const slopeBand = () => [Math.cos((look.slope + 5) * Math.PI / 180), Math.cos((look.slope - 5) * Math.PI / 180)];
  const gradeOf = () => GAME ? [look.exposure, look.saturation, look.contrast, look.warmth] : [1, 1, 0, 0];
  const rampOf = () => ((sengoku() ? SENGOKU_PRESETS : PRESETS)[look.preset] || PRESETS.summer).map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255));
  const lookTime = () => reduce ? 0 : (performance.now() - t0) / 1000;
  const EL_MIN = 0.06, EL_MAX = 1.5, D_MIN = 40, D_MAX = 1800;
  /* inside a room the camera may come right up to the furniture and look a little upward; outside it may come close to a building */
  const D_MIN_SCENE = 0.6, D_MAX_SCENE = 90, EL_MIN_SCENE = -0.35, D_MIN_OUTSIDE = 8;
  const dMin = () => scene ? D_MIN_SCENE : D_MIN_OUTSIDE, dMax = () => scene ? D_MAX_SCENE : D_MAX, elMin = () => scene ? EL_MIN_SCENE : EL_MIN;
  const STYLE = { apartment: 1, nikkyu: 2, school: 3, industrial: 4, wood: 5, shrine: 6 };
  const controls = [btnFlat, btnReset, btnExag, btnChange, btnWalls, btnLabels, btnWalk, btnWeather, yearRange, btnPlay];

  function fallback(message){
    say(message);
    if (btnWalk) btnWalk.textContent = T.walk;
    if (btnWeather) btnWeather.textContent = T.weatherClear;
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
    void finish(vec3 p){ vWorld=p; vShadow = uLightPV * vec4(p, 1.0); vec4 q = uPV * vec4(p, 1.0); vDepth = q.w; gl_Position = q; }
    /* a building stands from its completion year to its collapse; it rises over about a year */
    float standing(vec2 life){
      float up = smoothstep(life.x - 1.2, life.x, uYear);
      float down = life.y > 0.0 ? 1.0 - smoothstep(life.y - 1.0, life.y + 0.5, uYear) : 1.0;
      return up * down;
    }`;
  const SHADOW_FN = `
    varying vec3 vWorld; uniform vec3 uEye; uniform vec4 uGrade;
    /* Walking-view look (tunable in the page menu): a five-tint palette shared by the ground and everything
       growing on it, overlay amounts (mottling, sheen, wind streaks, time) and clouds (shadow amount,
       scale in metres, drift m/s, film grain). */
    uniform vec3 uRamp0, uRamp1, uRamp2, uRamp3, uRamp4; uniform vec4 uOverlay, uCloud;
    float hash(vec2 p){ p=mod(p,113.0); return fract(sin(dot(p, vec2(7.13, 3.71))) * 157.91); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
    // Worley F1/F2 (cells, cracks, water caustics).
    vec2 worley(vec2 p){
      vec2 i=floor(p),f=fract(p);float d1=8.0,d2=8.0;
      for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y)),o=vec2(hash(i+g),hash(i+g+19.7));float d=length(g+o-f);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}
      return vec2(d1,d2);
    }
    vec3 rampAt(float t){
      t=clamp(t,0.0,1.0)*4.0;
      if(t<1.0)return mix(uRamp0,uRamp1,t);if(t<2.0)return mix(uRamp1,uRamp2,t-1.0);if(t<3.0)return mix(uRamp2,uRamp3,t-2.0);return mix(uRamp3,uRamp4,t-3.0);
    }
    // A twinkling four-point star in a jittered cell grid (size in metres): the sparkle of small anime waters.
    float twinkle(vec2 p,float size,float rate,float t){
      vec2 c=floor(p/size),q=fract(p/size)-.5;
      float star=clamp(max(1.0-abs(q.x)*9.0-abs(q.y)*2.2,1.0-abs(q.y)*9.0-abs(q.x)*2.2),0.0,1.0);
      return star*step(1.0-rate,hash(c))*pow(max(sin(t*2.6+hash(c+3.0)*6.28),0.0),6.0);
    }
    // Shade on vegetation takes the hue of the palette's darkest tint (deep saturated green in summer), never grey.
    vec3 shadeTint(){ return mix(vec3(1.0),uRamp4/max(max(uRamp4.r,uRamp4.g),max(uRamp4.b,.01)),.4)*1.05; }
    // One world-space colour field for the ground and every blade on it: large soft colour areas,
    // teal mottling (multiply) and a pale-yellow sheen (add), after the reference video's grass manager.
    vec3 meadowColor(vec2 p){
      float n=.55*noise(p*.024)+.3*noise(p*.09+5.0)+.15*noise(p*.31-3.0);
      vec3 c=rampAt(mix(.6,.04,smoothstep(.25,.75,n)));
      c*=mix(vec3(1.0),vec3(.04,.47,.41),uOverlay.x*smoothstep(.52,.8,noise(p*.043+11.0)));
      return c+vec3(.94,.99,.55)*uOverlay.y*smoothstep(.58,.86,noise(vec2(p.x*.03+p.y*.017,(p.y*.03-p.x*.017)*.57)+2.0));
    }
    // Drifting cloud shadows projected along the sun, so the same blotches sweep over ground, walls and roofs.
    float cloudShadow(vec3 wp,vec3 sun){
      vec2 p=wp.xz-sun.xz/max(sun.y,.3)*wp.y-vec2(.83,.55)*uOverlay.w*uCloud.z;
      return smoothstep(.5,.64,.62*noise(p/uCloud.y)+.38*noise(p/(uCloud.y*.36)+7.0))*uCloud.x;
    }
    // Colour pass: exposure (high key), saturation, S-curve contrast, warm balance and a faint film grain.
    vec3 grade(vec3 c){
      c*=uGrade.x;float l=dot(c,vec3(.299,.587,.114));c=max(mix(vec3(l),c,uGrade.y),0.0);
      c=mix(c,c*c*(3.0-2.0*c),clamp(uGrade.z,0.0,1.0));
      c=c*vec3(1.0+uGrade.w*.05,1.0+uGrade.w*.015,1.0-uGrade.w*.05);
      // The per-frame offset stays small so mediump shaders never overflow in long sessions.
      vec2 g=gl_FragCoord.xy+floor(fract(uOverlay.w*.37)*64.0)*vec2(17.0,31.0);
      return clamp(c+(fract(52.9829189*fract(dot(g,vec2(.06711056,.00583715))))-.5)*uCloud.w,0.0,1.0);
    }
    /* Sengoku look (the walking view's default): linear light, height fog and a filmic grade. Original JTA code informed by
       the user's SEKIRO reference study; no game code, shaders or assets. uEnv: (on, snow cover, wetness, night);
       uTone: (cool shadows, warm highlights, vignette, lamplight in windows). Colours passed as display values are
       squared into linear light (gamma 2) and graded back at the end. */
    uniform vec3 uKey, uAmbS, uAmbG, uFogC, uSunC, uGLift, uGGamma, uGGain; uniform vec4 uFogK, uTone, uFire0, uFire1, uFire2, uFire3; uniform mediump vec4 uEnv;
    vec3 toLin(vec3 c){ return c*c; }
    float fbm3(vec2 p){ return .5*noise(p)+.3*noise(p*2.03+3.1)+.2*noise(p*4.07-1.7); }
    // Fine grit (soil crumbs, pitting, wood grain) in metres; each octave fades out before it would alias.
    float grit(vec2 p,float depth){
      float g=(noise(p*9.0)-.5)*(1.0-smoothstep(12.0,30.0,depth));
      g+=(noise(p*23.0+3.7)-.5)*.75*(1.0-smoothstep(5.0,13.0,depth));
      return g+(noise(p*57.0-8.1)-.5)*.55*(1.0-smoothstep(2.0,5.5,depth));
    }
    // Nearest Worley feature: distance, the feature's own random value, and the offset from the feature (stones, pebbles).
    vec4 cellNear(vec2 p){
      vec2 i=floor(p),f=fract(p),id=vec2(0.0),off=vec2(0.0);float d1=8.0;
      for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y)),r=f-g-vec2(hash(i+g),hash(i+g+19.7));float d=dot(r,r);if(d<d1){d1=d;id=i+g;off=r;}}
      return vec4(sqrt(d1),hash(id*1.37+5.3),off);
    }
    // A burning brazier or bonfire (world position, flickering strength) lights what faces it, falling off with distance.
    vec3 fireAt(vec4 f,vec3 p,vec3 n){
      if(f.w<=0.0)return vec3(0.0);
      vec3 d=f.xyz-p;float l2=max(dot(d,d),.04);
      return vec3(1.0,.45,.16)*f.w*clamp(dot(n,d)*inversesqrt(l2)*.75+.25,0.0,1.0)/(1.0+l2*.12);
    }
    vec3 fireLight(vec3 p,vec3 n){ return fireAt(uFire0,p,n)+fireAt(uFire1,p,n)+fireAt(uFire2,p,n)+fireAt(uFire3,p,n); }
    // Key light with its shadow and drifting cloud shadows, a sky/ground hemisphere ambient, a little warm bounce on faces
    // turned away from a low sun, and firelight. ao darkens only the ambient.
    float gCloud=-1.0;   // the cloud shadow is evaluated once per fragment, however often sLight is called
    vec3 sLight(vec3 alb,vec3 n,vec3 sun,float shadow,float ao){
      float ndl=dot(n,sun);
      if(gCloud<0.0)gCloud=cloudShadow(vWorld,sun);
      float direct=clamp(ndl,0.0,1.0)*shadow*(1.0-gCloud);
      vec3 amb=mix(uAmbG,uAmbS,n.y*.5+.5)*ao+uKey*.05*clamp(.4-ndl,0.0,1.0)*ao;
      return alb*(uKey*direct+amb+fireLight(vWorld,n));
    }
    // Uniform haze plus exponential height fog integrated along the view ray, lightly broken into drifting banks; it
    // brightens and warms towards the sun.
    float sFogAmount(vec3 wp){
      vec3 ray=wp-uEye;float dist=length(ray);vec3 dir=ray/max(dist,.001);
      float k=uFogK.z,dy=dir.y*dist,base=exp(-k*max(uEye.y,0.0));
      float column=abs(dir.y)>.002?base*(1.0-exp(-k*dy))/(k*dir.y):base*dist;
      float optical=uFogK.x*dist+uFogK.y*column*(.75+.5*noise(wp.xz*.012+vec2(uOverlay.w*.015,0.0)));
      return min(1.0-exp(-optical),uFogK.w);
    }
    vec3 sFog(vec3 col,vec3 wp){
      vec3 dir=normalize(wp-uEye);
      float mu=max(dot(dir,uSun),0.0);
      vec3 inscatter=uFogC+uSunC*(pow(mu,5.0)*.45+pow(mu,40.0)*.7)*(1.0-uEnv.w*.6);
      return mix(col,inscatter,sFogAmount(wp));
    }
    // Filmic curve (Narkowicz's ACES fit), then saturation, split toning, contrast, warmth and a faint grain.
    vec3 sGrade(vec3 c){
      c*=uGrade.x;
      c=sqrt(clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.0,1.0));
      float l=dot(c,vec3(.2126,.7152,.0722));
      c=max(mix(vec3(l),c,uGrade.y),0.0);
      c=mix(c,c*c*(3.0-2.0*c),clamp(uGrade.z,0.0,1.0)*.7);
      // One colour cast per sky (lift, gamma, gain): blacks are lifted and tinted, whites roll off to the sky's tint.
      c=uGLift+(uGGain-uGLift)*pow(c,uGGamma);
      c*=vec3(1.0+uGrade.w*.04,1.0+uGrade.w*.01,1.0-uGrade.w*.04);
      vec2 g=gl_FragCoord.xy+floor(fract(uOverlay.w*.37)*64.0)*vec2(17.0,31.0);
      return clamp(c+(fract(52.9829189*fract(dot(g,vec2(.06711056,.00583715))))-.5)*uCloud.w,0.0,1.0);
    }
    // Sky-coloured directional fog, informed by Godot sky.glsl (MIT).
    vec3 aerial(vec3 col,vec3 horizon,vec3 sun,float density,float depth,float enabled){
#ifdef SENGOKU
      return sGrade(sFog(col,vWorld));   // sengoku: col is linear light
#else
      float amount=clamp(density*smoothstep(80.0,900.0,depth),0.0,1.0);
      vec3 haze=horizon;
      if(enabled>.5){
        vec3 ray=vWorld-uEye; float distanceToEye=length(ray*.01)*100.0;
        float forward=pow(max(dot(ray/max(distanceToEye,.001),sun),0.0),8.0);
        haze=mix(horizon,vec3(.94,.86,.70),forward*.18);
        amount=clamp(1.0-exp(-density*max(distanceToEye-24.0,0.0)*.0035),0.0,.92);
        // Cloud shadows are teal-green, never grey.
        col*=mix(vec3(1.0),vec3(.30,.60,.62),cloudShadow(vWorld,sun));
        return grade(mix(col,haze,amount));
      }
      return mix(col,haze,amount);
#endif
    }
    /* uShadowK: bias scale, and 1 where the shadow box follows the walker (shadows fade out at its border) */
    uniform sampler2D uShadowMap; uniform float uShadowOn, uShadowTexel; uniform vec2 uShadowK;
    float shadowAt(vec4 sc, float bias){
      if (uShadowOn < 0.5) return 1.0;
      vec3 p = sc.xyz / sc.w * 0.5 + 0.5;
      if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
      bias *= uShadowK.x;
      float lit = 0.0;
      if (uShadowK.y > 0.5){
        vec2 o = vec2(.5, -.5) * uShadowTexel;
        lit = (step(p.z - bias, texture2D(uShadowMap, p.xy - o.xx).r) + step(p.z - bias, texture2D(uShadowMap, p.xy + o.xx).r)
          + step(p.z - bias, texture2D(uShadowMap, p.xy + o).r) + step(p.z - bias, texture2D(uShadowMap, p.xy - o).r)) * 2.25;
      } else {
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
          float d = texture2D(uShadowMap, p.xy + vec2(float(i), float(j)) * uShadowTexel).r;
          lit += (p.z - bias > d) ? 0.0 : 1.0;
        }
      }
      return mix(lit / 9.0, 1.0, uShadowK.y * smoothstep(.8, .97, max(abs(p.x - .5), abs(p.y - .5)) * 2.0));
    }
    // GLSL adaptation of NiloCat's MIT-licensed ShadeSingleLight/CompositeAllLightResults.
    // Copyright (c) 2020 ColinLeung-NiloCat; full notice: /3d/licenses/nilocat-toon-MIT.txt
    // Environment-specific colours and hemisphere fill are original JTA additions.
    vec3 toonLight(vec3 albedo,vec3 normal,vec3 sun,float shadow,float occlusion){
      float litOrShadowArea=smoothstep(-.18,1.0,dot(normal,sun));
      litOrShadowArea*=clamp(occlusion,0.0,1.0);
      litOrShadowArea*=mix(1.0,shadow,.75);
      vec3 mainLight=mix(vec3(.58,.63,.73),vec3(1.08,1.02,.88),litOrShadowArea);
      vec3 indirect=mix(vec3(.32,.35,.41),vec3(.69,.75,.83),normal.y*.5+.5);
      indirect*=mix(1.0,occlusion,.5);
      return albedo*max(indirect,mainLight);
    }`;
  // ground and sea: the aerial photograph draped on the terrain
  const TERRAIN_VS = COMMON_VS + `
    attribute vec2 aGrid; attribute float aH; attribute vec3 aNor; attribute float aSea;
    /* walking view only: (grass, path, cliff) and (flower, weed, coast proximity); zero elsewhere */
    attribute vec3 aMaskA; attribute vec3 aMaskB;
    varying vec2 vUvP; varying vec2 vUvO; varying vec3 vNor; varying float vSea; varying vec3 vPos;
    varying vec3 vMaskA; varying vec3 vMaskB;
    void main(){
      float h = aH * uLift;
      vec2 g = uPP + (aGrid - uPP) * (1.0 - h / uHf);
      float e = uLift * uExag;
      vNor = turn(normalize(vec3(aNor.x * e, aNor.y, aNor.z * e)));
      vMaskA = aMaskA; vMaskB = aMaskB;
      vUvP = (aGrid + 0.5) / (2.0 * uC); vUvO = (g + 0.5) / (2.0 * uC); vSea = aSea;
      vec3 p = place(g, h); vPos = p;
      finish(p);
    }`;
  const TERRAIN_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
#else
    precision mediump float;
#endif
    uniform sampler2D uTexA, uTexB;
    uniform float uMix, uOrthoA, uOrthoB, uShade, uChange, uFog, uTime, uAnime; uniform mediump float uYear;
    uniform vec3 uBg, uSun, uHorizon; uniform vec4 uWater; uniform vec2 uSlope; uniform vec4 uPond;
    varying vec2 vUvP; varying vec2 vUvO; varying vec3 vNor; varying float vSea; varying vec3 vPos;
    varying vec3 vMaskA; varying vec3 vMaskB;
    varying vec4 vShadow; varying float vDepth;
    ` + SHADOW_FN + `
    void main(){
      /* the walking view paints its own ground and roofs, so it skips the two photograph fetches */
      vec3 t = uAnime > 0.5 ? vec3(0.5) : mix(texture2D(uTexA, mix(vUvP, vUvO, uOrthoA)).rgb, texture2D(uTexB, mix(vUvP, vUvO, uOrthoB)).rgb, uMix);
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
      // Land only: sea fragments are coloured in the sea branch below, so they skip all of this.
      #ifdef SENGOKU
      if(vSea<0.5){
        // Sengoku ground: worn stone slabs with mossy joints, dark rock, packed earth, straw grass, leaf drifts, snow and wet sheen.
        float pavement=smoothstep(.60,.92,n.y),nearSurface=1.0-smoothstep(14.0,60.0,vDepth);
        float age=smoothstep(74.0,110.0,uYear);
        // Stone slabs on the existing 2.7 x 3.4 m paving grid, each with its own tone and chipped edges.
        vec2 cellId=floor(vPos.xz/vec2(2.7,3.4)),panel=fract(vPos.xz/vec2(2.7,3.4));
        vec2 edgeD=min(panel,1.0-panel)*vec2(2.7,3.4);
        float chip=.06*noise(vPos.xz*2.7);
        float joint=(1.0-smoothstep(.015+chip*.5,.05+chip*.6,min(edgeD.x,edgeD.y)))*nearSurface;
        vec3 moss=mix(vec3(.12,.14,.08),vec3(.23,.25,.13),noise(vPos.xz*1.7));
        vec3 slab=vec3(.45),rock=vec3(.3);
        if(pavement>.01){
          slab=mix(vec3(.40,.38,.35),vec3(.52,.50,.46),hash(cellId+3.1))*(.84+.26*fbm3(vPos.xz*.9))*(.93+.1*noise(vPos.xz*6.0));
          if(nearSurface>.001){
            vec2 cr=worley(vPos.xz*.55);
            slab*=1.0-.3*(1.0-smoothstep(.01,.05,cr.y-cr.x))*nearSurface*step(.55,noise(vPos.xz*.2+4.0));
          }
          slab=mix(slab,vec3(.23,.24,.22),smoothstep(.55,.85,noise(vPos.xz*.21+8.0))*.4);
          slab=mix(slab,moss*.8,joint*.7);
        }
        if(pavement<.99){
          rock=mix(vec3(.24,.25,.26),vec3(.38,.37,.35),fbm3(vPos.xz*.25+vPos.y*.2))*(.85+.3*noise(vec2(vPos.x+vPos.z,vPos.y*4.0)*.9));
          rock=mix(rock,moss*.9,smoothstep(.55,.9,n.y)*smoothstep(.4,.7,noise(vPos.xz*.6))*.8);
        }
        vec3 surface=mix(rock,slab,pavement);
        // Earth and straw grass where the placeholder cover lies (preset tints uRamp0: tip, uRamp1: base).
        float cover=smoothstep(.10,.50,vMaskA.x+age*.22*(1.0-vMaskA.z));
        float straw=fbm3(vPos.xz*.35);
        vec3 grassC=mix(uRamp1,uRamp0,smoothstep(.25,.8,straw))*(.8+.35*noise(vPos.xz*3.3));
        vec3 ground=surface;
        if(cover>.01){
          vec3 earth=mix(vec3(.19,.17,.15),vec3(.29,.26,.22),noise(vPos.xz*.8));
          vec3 field=mix(earth,grassC*.72,smoothstep(.22,.55,straw+.25*noise(vPos.xz*1.3)));
          field=mix(field,moss*.9,smoothstep(.6,.85,noise(vPos.xz*.5+6.0))*.6);
          // Drifts of fallen leaves (foliage tints) where the old flower mask lies and along wall bases.
          vec2 lc=floor(vPos.xz*6.0);
          float leafy=smoothstep(.2,.7,vMaskB.x+.5*vMaskB.y)*step(.5,noise(vPos.xz*3.1))*smoothstep(.35,.65,noise(vPos.xz*.4+2.0))*step(.35,hash(lc+5.0))*smoothstep(.86,.95,n.y);
          field=mix(field,mix(uRamp2,mix(uRamp3,uRamp4,hash(lc+1.7)),hash(lc)),leafy*.9);
          ground=mix(surface,field,cover);
        }
        // Trampled paths: dark packed earth and mud.
        float pm=smoothstep(.22,.6,vMaskA.y)*smoothstep(.8,.95,n.y);
        if(pm>.001){
          // Packed earth with dry dusty patches, damp dark hollows and trodden-in grit.
          vec3 path=mix(vec3(.16,.13,.10),vec3(.25,.21,.16),noise(vPos.xz*.9))*(.8+.4*fbm3(vPos.xz*1.6+4.0));
          path=mix(path,vec3(.33,.30,.26),smoothstep(.55,.78,noise(vPos.xz*.7+9.0))*.45);
          path*=1.0-.35*smoothstep(.6,.85,noise(vPos.xz*.35-3.0));
          ground=mix(ground,path,pm);
        }
        // Dry tufts in joints and along wall bases.
        float bare=(1.0-cover)*pavement;
        if(bare>.001&&(joint>.001||vMaskB.y>.001)){
          float tufts=max(joint*step(.5,noise(vPos.xz*1.7)),smoothstep(.55,.8,noise(vPos.xz*2.6))*vMaskB.y)*bare*clamp(vMaskB.y*.9+.35+age*.4,0.0,1.0);
          ground=mix(ground,grassC*.85,tufts);
        }
        ground*=1.0-.4*smoothstep(.955,.995,vMaskB.z)*(1.0-cover);
        // Fine grit, and small stones on earth and paths near the walker: the scale the reference shows at the player's feet.
        ground*=1.0+.55*grit(vPos.xz,vDepth);
        float pebbleNear=(1.0-smoothstep(6.0,16.0,vDepth))*pm;
        if(pebbleNear>.001){
          vec4 pb=cellNear(vPos.xz*5.5);
          float pr=mix(.10,.22,fract(pb.y*7.3)),inStone=(1.0-smoothstep(pr-.04,pr,pb.x))*step(.72,pb.y)*pebbleNear;
          vec3 pn=normalize(vec3(pb.z,max(pr*pr-pb.x*pb.x,0.0)*9.0+.25,pb.w));
          vec3 stoneC=mix(vec3(.30,.29,.27),vec3(.52,.50,.46),fract(pb.y*13.1));
          ground=mix(ground,stoneC*(.55+.6*max(dot(pn,uSun),0.0)),inStone*.8);
          // Each stone casts a short shadow away from the sun.
          float stoneShade=(1.0-smoothstep(pr-.03,pr+.02,length(pb.zw+normalize(uSun.xz+vec2(1e-4))*.06/max(uSun.y,.15))))*(1.0-inStone)*step(.72,pb.y)*pebbleNear;
          ground*=1.0-.5*stoneShade*sh;
        }
        // Snow on what faces up, thinning on slopes and in drifts; rain darkens the ground.
        float snow=uEnv.y>0.0?uEnv.y*smoothstep(.62,.9,n.y)*smoothstep(.25,.55,fbm3(vPos.xz*.22)+uEnv.y*.35-pm*.3):0.0;
        vec3 albedo=mix(ground*(1.0-.38*uEnv.z),vec3(.74,.76,.80),snow);
        col=sLight(toLin(albedo),n,uSun,sh,1.0-.35*vMaskB.y*(1.0-snow));
        // Wet sheen, and puddles on flat paving that mirror the sky (more and rippling in rain).
        vec3 eyeDir=normalize(uEye-vPos);float fres=pow(1.0-max(dot(n,eyeDir),0.0),4.0);
        col+=uFogC*fres*uEnv.z*.35*(1.0-snow);
        float level=pavement*(1.0-smoothstep(.02,.15,cover))*(1.0-pm*.5)*smoothstep(.97,.995,n.y)*(1.0-smoothstep(.9,.99,vMaskB.z))*(1.0-snow);
        float pn=level>.001?.65*noise(vPos.xz*.21+17.0)+.35*noise(vPos.xz*.63-4.0):0.0,th=mix(.8,.71,uEnv.z);
        float puddle=smoothstep(th,th+.012,pn)*level;
        if(puddle>.001){
          vec3 rdir=reflect(-eyeDir,vec3(0.0,1.0,0.0));
          vec3 sky=mix(uFogC,uAmbS*.6,smoothstep(0.0,.5,rdir.y))+uSunC*pow(max(dot(rdir,uSun),0.0),30.0)*1.5;
          col=mix(col,sky*(.42+uEnv.z*.3*(noise(vPos.xz*9.0+uTime*3.0)-.5))*mix(.7,1.0,sh),puddle*(.3+.55*fres));
        }
      }
#else
      if(uAnime>0.5&&vSea<0.5){
        // Inhabited Hashima was predominantly concrete. Surface pattern/colour remain inferred.
        float fine=noise(vPos.xz*3.2),broad=noise(vPos.xz*.085);
        float pavement=smoothstep(.60,.92,n.y);
        vec3 concrete=mix(vec3(.48,.49,.47),vec3(.66,.65,.59),broad);
        concrete*=.96+.08*fine;
        vec2 panel=fract(vPos.xz/vec2(2.7,3.4));
        vec2 edgeDistance=min(panel,1.0-panel)*vec2(2.7,3.4);
        float nearSurface=1.0-smoothstep(12.0,42.0,vDepth);
        float joint=(1.0-smoothstep(.012,.033,min(edgeDistance.x,edgeDistance.y)))*nearSurface;
        concrete*=1.0-joint*.14;
        // Worley F2-F1 hairline cracks break up the slick paving (near the walker only).
        if(nearSurface>.001){
          vec2 cracks=worley(vPos.xz*.55);
          concrete*=1.0-.1*(1.0-smoothstep(.01,.04,cracks.y-cracks.x))*nearSurface*step(.6,noise(vPos.xz*.2+4.0));
        }
        float stain=smoothstep(.56,.83,noise(vPos.xz*.24+8.0));
        concrete=mix(concrete,vec3(.35,.37,.36),stain*.22);
        vec3 rock=mix(vec3(.36,.38,.38),vec3(.53,.52,.47),noise(vPos.xz*.21+vPos.y*.18));
        vec3 surface=mix(rock,concrete,pavement);
        float age=smoothstep(74.0,110.0,uYear);
        if(age>0.0)surface=mix(surface,vec3(.27,.34,.26),age*smoothstep(.52,.78,noise(vPos.xz*.13))*mix(.46,.13,pavement));
        // Placeholder anime cover (illustrative, not historical vegetation). The ground uses the same world-space
        // colour field as every grass blade, so sparse blades read as dense grass (the video's key rule).
        float cover=smoothstep(.10,.50,vMaskA.x+age*.22*(1.0-vMaskA.z));
        vec3 field=meadowColor(vPos.xz),meadow=field;
        // Slope auto-paint (28 degrees with a 10 degree blend by default, adjustable): steep banks turn pale olive-yellow
        // soil, as in the video's tool.
        meadow=mix(meadow,mix(vec3(.76,.82,.37),vec3(.81,.84,.42),noise(vPos.xz*.6))*mix(rampAt(.2)/max(rampAt(.2).g,.01),vec3(1.0),.7),(1.0-smoothstep(uSlope.x,uSlope.y,n.y))*.85);
        // Flower speckles keep colour at mid distance, where the flower sprites have faded out. Round dots, and only on
        // gentle ground: projected from above, dots and streaks would smear into long flakes on steep banks.
        float gentle=smoothstep(.86,.95,n.y);
        vec2 speck=floor(vPos.xz*3.0);float petals=step(.9,hash(speck))*step(length(fract(vPos.xz*3.0)-.5),.32)*smoothstep(.15,.55,vMaskB.x)*smoothstep(8.0,20.0,vDepth)*gentle;
        meadow=mix(meadow,mix(vec3(1.0,.86,.92),vec3(1.0,.98,.90),hash(speck+7.0)),petals*.8);
        // Wind streaks: long thin white dashes travelling with the wind.
        float along=dot(vPos.xz,vec2(.83,.55)),across=dot(vPos.xz,vec2(-.55,.83));
        meadow+=vec3(1.0)*uOverlay.z*smoothstep(.78,.92,noise(vec2(along*.11-uOverlay.w*.8,across*1.7)))*smoothstep(.45,.75,noise(vec2(along*.02,across*.05)+3.0))*gentle;
        vec3 ground=mix(surface,meadow,cover);
        float pm=smoothstep(.22,.6,vMaskA.y)*smoothstep(.8,.95,n.y);
        if(pm>.001){
          // Pale butter-cream dirt paths, slightly darker along their feathered banks.
          vec3 dirt=mix(vec3(.84,.85,.60),vec3(.90,.90,.65),noise(vPos.xz*.45+1.0));
          dirt=mix(dirt,vec3(.95,.94,.72),smoothstep(.6,.9,noise(vPos.xz*1.3))*.6);
          ground=mix(ground,dirt*mix(.86,1.0,smoothstep(.3,.75,vMaskA.y)),pm);
        }
        // Tufts in paving joints and along wall bases, in the meadow colours; more on the abandoned island.
        float bare=(1.0-cover)*pavement;
        if(bare>.001){
          float jointLine=1.0-smoothstep(.02,.10,min(edgeDistance.x,edgeDistance.y));
          float tufts=max(jointLine*step(.5,noise(vPos.xz*1.7)),smoothstep(.55,.8,noise(vPos.xz*2.6))*vMaskB.y);
          ground=mix(ground,field*.88,tufts*clamp(vMaskB.y*.9+age*.5,0.0,1.0)*bare);
        }
        // A bright yellow-green halo on the ground around the pond, as in the video's final scene (uPond: x, z, radius, on).
        float pd=length(vPos.xz-uPond.xy)-uPond.z,halo=uPond.w*step(-.4,pd)*(1.0-smoothstep(.3,3.0,pd));
        ground=mix(ground,mix(vec3(.81,.96,.47),vec3(.69,.86,.37),smoothstep(.3,3.0,pd)),halo*.75);
        // Wet, darker stone just above the waterline.
        ground*=1.0-.32*smoothstep(.955,.995,vMaskB.z)*(1.0-cover);
        col=toonLight(ground,n,uSun,sh,1.0);
        // Shade on grass stays a deep saturated green, never grey.
        col=mix(col,col*shadeTint(),(1.0-sh)*cover*(1.0-pm));
        // Placeholder puddles on flat paving: pale sky-tinted water with a bright rim and twinkles, more in rain (uWater.w).
        float level=pavement*(1.0-smoothstep(.02,.15,cover))*(1.0-pm)*smoothstep(.97,.995,n.y)*(1.0-smoothstep(.9,.99,vMaskB.z));
        float pn=level>.001?.65*noise(vPos.xz*.21+17.0)+.35*noise(vPos.xz*.63-4.0):0.0,th=mix(.77,.68,uWater.w);
        float puddle=smoothstep(th,th+.012,pn)*level;
        if(puddle>.001){
          vec3 water=mix(uHorizon*1.04,vec3(.62,.86,.88),.45+.1*noise(vPos.xz*1.3+uTime*.2))*mix(.8,1.0,sh);
          water+=vec3(1.0,.99,.94)*twinkle(vPos.xz,.5,.12,uTime)*.8*mix(.3,1.0,sh)*uWater.y;
          float rim=smoothstep(th,th+.012,pn)-smoothstep(th+.018,th+.03,pn);
          col=mix(col,mix(water,vec3(.95,.99,.97),rim*.65),puddle);
        }
      }
#endif
      float edge = smoothstep(0.5, 0.36, max(abs(vUvP.x - 0.5), abs(vUvP.y - 0.5)));
      if (vSea > 0.5){
        vec3 sea = mix(vec3(0.06, 0.13, 0.17), vec3(0.12, 0.25, 0.31), d);
        vec3 eye = normalize(-vPos + (uAnime>.5?uEye:vec3(0.0, 300.0, 0.0)));
        float glint = pow(max(dot(reflect(-uSun, n), eye), 0.0), 60.0) * 0.3;
        float foam = smoothstep(0.86, 0.98, noise(vPos.xz * 0.12 + vec2(uTime * 0.02, 0.0))) * 0.08;
        col = sea + glint + foam;
        #ifdef SENGOKU
        {
          // Sengoku sea: dark slate water, the sky by Fresnel, a glitter path under a low sun and broken foam at the sea wall.
          vec2 q=vPos.xz;
          vec2 w1=vec2(noise(q*.045+vec2(uTime*.02,uTime*.013)),noise(q*.045+vec2(7.1-uTime*.017,3.3)))-.5;
          vec2 w2=vec2(noise(q*.21-vec2(uTime*.06,0.0)),noise(q*.21+vec2(5.2,uTime*.05)))-.5;
          vec2 w3=vec2(noise(q*.9+uTime*.12),noise(q*.9-uTime*.1+9.0))-.5;
          float rip=1.0-smoothstep(12.0,45.0,vDepth);
          vec2 w4=rip>.001?vec2(noise(q*2.7+uTime*.35),noise(q*2.7-uTime*.3+4.0))-.5:vec2(0.0);
          vec2 w5=rip>.001?vec2(noise(q*6.3-uTime*.5+2.0),noise(q*6.3+uTime*.45+7.0))-.5:vec2(0.0);
          vec2 slope=(w1*.5+w2*.24+w3*.08+(w4*.07+w5*.05*(1.0-smoothstep(4.0,15.0,vDepth)))*rip)*(1.0+uEnv.z*.5);
          vec3 nw=normalize(vec3(slope.x,1.0,slope.y));
          vec3 eyeDir=normalize(uEye-vPos);
          float fres=.02+.98*pow(1.0-max(dot(nw,eyeDir),0.0),5.0);
          vec3 rdir=reflect(-eyeDir,nw);
          float mu=max(dot(rdir,uSun),0.0);
          vec3 skyRef=mix(uFogC*.85,mix(uFogC,uAmbS*.9,.55)*.8,smoothstep(0.0,.35,rdir.y))+uSunC*(pow(mu,8.0)*.5+pow(mu,300.0)*16.0)*(1.0-uEnv.z*.8);
          float coast=(1.0-vMaskB.z)*40.0,near=step(.001,vMaskB.z);
          vec3 deep=toLin(vec3(.13,.17,.165))*(uAmbS*1.2+uKey*.15);
          vec3 shoal=toLin(vec3(.10,.16,.15))*(uAmbS*1.2+uKey*.2);
          col=mix(mix(deep,shoal,near*(1.0-smoothstep(1.0,14.0,coast))),skyRef*.65,fres)*mix(.8,1.0,sh);
          // Foam: a thin white line against the sea wall and lacy cells drifting off it, thinning with distance.
          float band=near*(1.0-smoothstep(.3,2.5+2.0*noise(q*.3+uTime*.1),coast)),foam=0.0;
          if(band>.001){
            vec2 fq=q+1.2*vec2(noise(q*.7+uTime*.1),noise(q*.7-uTime*.08+3.0));
            vec2 fw=worley(fq*1.3+vec2(uTime*.12,-uTime*.09)),fv=worley(fq*3.1-vec2(uTime*.1,uTime*.07));
            float lace=max((1.0-smoothstep(.02,.09,fw.y-fw.x))*smoothstep(.45,.75,noise(fq*1.9+uTime*.15)),
                           (1.0-smoothstep(.02,.07,fv.y-fv.x))*smoothstep(.55,.8,noise(fq*1.1-uTime*.12))*.7);
            foam=band*max(lace,(1.0-smoothstep(0.0,.45,coast+.3*noise(q*3.0+uTime*.4)))*.85);
          }
          col=mix(col,(uKey*.3+uAmbS)*toLin(vec3(.74,.76,.76)),foam*.6);
        }
#else
        if(uAnime>0.5){
          float wave=sin(vPos.x*.16+uTime*.65)+sin(vPos.z*.21-uTime*.4);
          float fresnel=.05+.65*pow(1.0-max(dot(n,eye),0.0),5.0);
          vec3 water=mix(vec3(.045,.24,.34),vec3(.08,.40,.47),.48+.09*wave);
          // Anime water: turquoise shallows near the island, drifting Voronoi cells, star glints and banded foam.
          float coast=(1.0-vMaskB.z)*40.0,shallow=vMaskB.z>0.0?1.0-smoothstep(1.5,20.0,coast):0.0,near=1.0-smoothstep(25.0,90.0,vDepth);
          water=mix(water,vec3(.16,.62,.66),shallow*.8);
          // Warped, broken cell lines read as drifting caustics rather than a tiled honeycomb.
          vec2 wp=vPos.xz/(3.4*uWater.x);wp+=vec2(noise(wp*.7+uTime*.05),noise(wp*.7-uTime*.04+5.0))*.7;
          vec2 cells=worley(wp+vec2(uTime*.1,uTime*.06));
          water+=vec3(.55,.85,.90)*(1.0-smoothstep(.02,.1,cells.y-cells.x))*smoothstep(.35,.7,noise(wp*.35+uTime*.03+9.0))*.09*near*(.4+.6*shallow);
          col=mix(water,uHorizon*.82,fresnel)+vec3(1.0,.91,.72)*glint*.65;
          col+=vec3(.52,.74,.73)*smoothstep(1.83,1.98,wave)*.07;
          vec2 cell=floor(vPos.xz/.9),q=fract(vPos.xz/.9)-.5;
          float star=clamp(max(1.0-abs(q.x)*12.0-abs(q.y)*2.6,1.0-abs(q.y)*12.0-abs(q.x)*2.6),0.0,1.0);
          col+=vec3(1.0,.98,.90)*star*step(.79,hash(cell))*pow(max(sin(uTime*3.0+hash(cell+3.0)*6.28),0.0),6.0)*near*uWater.y*.9;
          float wob=(noise(vPos.xz*.7+uTime*.3)-.5)*.6,phase=fract(coast-uTime*.36+wob);
          float bands=(1.0-smoothstep(0.0,4.0,coast))*smoothstep(.42,.5,phase)*(1.0-smoothstep(.5,.58,phase));
          float line=1.0-smoothstep(.25,.9,coast+wob*.5);
          col=mix(col,vec3(.95,.99,1.0),max(line,bands*.7)*step(.001,vMaskB.z)*uWater.z);
        }
#endif
        edge = 1.0;
      }
      col = aerial(col,uHorizon,uSun,uFog,vDepth,uAnime);
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
#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
#else
    precision mediump float;
#endif
    uniform float uChange, uFog, uShade, uAnime; uniform mediump float uYear;
    uniform vec3 uBg, uSun, uHorizon;
    varying vec3 vNor; varying vec3 vWall; varying vec4 vInfo; varying float vAlive; varying float vTop; varying float vGhost;
    varying vec4 vShadow; varying float vDepth;
    uniform float uGhostPass;
    ` + SHADOW_FN + `
    // Nearest leaf on a jittered lattice, for walking-view foliage on walls: (distance, offset to its centre, id).
    vec4 leafCell(vec2 p){
      vec2 i=floor(p),f=fract(p);vec4 best=vec4(8.0,0.0,0.0,0.0);
      for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y)),d=g+.15+.7*vec2(hash(i+g),hash(i+g+19.7))-f;float l=length(d);if(l<best.x)best=vec4(l,d,hash(i+g+5.3));}
      return best;
    }
    // Two layers of overlapping round leaves in the season palette, each lit from the upper left, over a deep-shade
    // backing. Returns the colour and the leaf cover (0 in the gaps); far away it fades to one flat tone.
    vec4 leaves(vec2 p,float far){
      vec4 a=leafCell(p),b=leafCell(p*1.31+vec2(3.1,7.7));
      float la=1.0-smoothstep(.38,.46,a.x),lb=1.0-smoothstep(.36,.44,b.x);
      float ka=.5+.6*dot(-a.yz/max(a.x,.001),vec2(-.55,.83))*smoothstep(.05,.4,a.x),kb=.5+.6*dot(-b.yz/max(b.x,.001),vec2(-.55,.83))*smoothstep(.05,.4,b.x);
      vec3 ca=rampAt(mix(.15,.75,a.w))*mix(.82,1.12,clamp(ka,0.0,1.0))*mix(1.0,.75,smoothstep(.3,.45,a.x));
      vec3 cb=rampAt(mix(.45,.95,b.w))*mix(.7,.95,clamp(kb,0.0,1.0));
      vec3 c=mix(mix(rampAt(1.0)*.42,cb,lb),ca,la);
      return vec4(mix(c,rampAt(.62)*.82,far),mix(max(la,lb),1.0,far));
    }
    void main(){
      if (vAlive < 0.02) discard;
      if (uGhostPass < 0.5 && vGhost > 0.5) discard;   /* the host building is drawn later, translucent */
      if (uGhostPass > 0.5 && vGhost < 0.5) discard;
      vec3 n = normalize(vNor);
      float d = max(dot(n, uSun), 0.0);
      float sh = shadowAt(vShadow, 0.003);
      float style = floor(vInfo.x+.5), floorH = floor(vInfo.y*100.0+.5)/100.0, seed = floor(vInfo.z*89.0+.5), gone = vInfo.w;
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
      #ifdef SENGOKU
      {
        /* Sengoku facades: the same storeys and bays as old stained concrete, dark timber and plaster in hard weather.
           Streaks, leaching, rust, spalling, moss, soot, broken or boarded openings and lamplit rooms are illustrative. */
        float period=2.4, left=.2, right=.72, bottom=.32, top=.78;
        if(style>1.5&&style<2.5){period=3.2;left=.25;right=.75;bottom=.45;top=.85;}
        else if(style>2.5&&style<3.5){period=1.8;left=.06;right=1.0;bottom=.34;top=.82;}
        else if(style>3.5&&style<4.5){period=5.0;left=.3;right=.7;bottom=.35;top=.8;}
        else if(style>4.5&&style<5.5){period=2.0;left=.3;right=.65;bottom=.4;top=.75;}
        else if(style>5.5){period=2.0;left=.35;right=.65;bottom=.45;top=.75;}
        vec2 pane=vec2((fract(s/period)-left)/(right-left),(fy-bottom)/(top-bottom));
        float paneWidth=(right-left)*period, paneHeight=(top-bottom)*floorH;
        float nearDetail=1.0-smoothstep(45.0,140.0,vDepth);
        float bay=fract(s/period),bayId=floor(s/period);
        // vWall.z rises with the face like y; the wall's real top is its storeys plus the 0.6 m sunk below ground.
        H=(vTop+.6)*vAlive;
        vec3 alb=mix(vec3(.40,.39,.37),vec3(.49,.47,.43),hash(vec2(seed,41.0)));
        float timber=0.0,tiles=0.0,castle=step(style,3.5),boards=0.0,calm=max(castle,step(4.5,style));
        vec3 timberC=mix(vec3(.11,.09,.08),vec3(.19,.16,.13),noise(vec2(s*.5,y*3.0)+seed));
        if(castle>.5){
          // Castle quarter: the apartments, the 1918 housing and the school as old white plaster between dark timber posts
          // and beams, black clapboard on the ground storey over a stone base, a tiled pent roof along every floor line and a
          // tiled coping along the top (depth without geometry, like the recessed openings below).
          alb=mix(vec3(.56,.55,.52),vec3(.64,.63,.59),hash(vec2(seed,41.0)));
          float post=1.0-smoothstep(.075,.09,min(bay,1.0-bay)*period);
          float head=1.0-smoothstep(.06,.075,abs(fy-top)*floorH-.03);
          float sillBeam=1.0-smoothstep(.04,.055,abs(fy-bottom)*floorH-.02);
          timber=max(post,max(head,sillBeam));
          if(storey<.5&&fy<top){
            float bd=fract(y/.21);boards=1.0;
            alb=mix(vec3(.09,.08,.07),vec3(.16,.14,.12),hash(vec2(floor(y/.21),floor(s/1.8)+seed)))*(1.0-.5*(1.0-smoothstep(0.0,.12,bd)));
          }
          if(y<.62){
            vec2 wq=vec2(s*1.6,y*2.4)+seed,wj=worley(wq);
            vec3 base0=mix(vec3(.27,.26,.24),vec3(.42,.40,.37),cellNear(wq).y)*(1.0-.6*(1.0-smoothstep(.03,.1,wj.y-wj.x)));
            alb=mix(alb,base0,step(y,.45+.12*noise(vec2(s*.8,seed))));
          }
          float ey=fy*floorH,row=fract(s/.26);
          if(storey>.5&&ey<.32&&y<H-.45){
            if(ey<.085){
              vec2 cd=vec2((row-.5)*.26,ey-.045);
              float cap=1.0-smoothstep(.034,.042,length(cd));
              alb=mix(vec3(.07,.07,.08),vec3(.22,.23,.25)*(1.0-.3*smoothstep(.0,.04,-cd.y)),cap);
            } else {
              float r=row*2.0-1.0;
              alb=mix(vec3(.12,.13,.14),vec3(.31,.32,.34),sqrt(max(0.0,1.0-r*r)))*(.85+.25*noise(vec2(s*1.5,ey*20.0)));
            }
            tiles=1.0;timber=0.0;
          }
          if(y>H-.4){
            float r=row*2.0-1.0,cy=y-(H-.4);
            alb=cy<.08?mix(vec3(.07,.07,.08),vec3(.22,.23,.25),1.0-smoothstep(.034,.042,length(vec2((row-.5)*.26,cy-.04)))):
              mix(vec3(.12,.13,.14),vec3(.31,.32,.34),sqrt(max(0.0,1.0-r*r)))*(.85+.25*noise(vec2(s*1.5,y*20.0)));
            tiles=1.0;timber=0.0;
          }
          alb=mix(alb,timberC,timber*(1.0-tiles));
          // The underside of the pent roof above shows as a dark strip at the top of each storey.
          alb*=1.0-.8*step((1.0-fy)*floorH,.06)*step(y+(1.0-fy)*floorH,H-.45)*(1.0-tiles);
        }
        if(style>3.5&&style<4.5){
          // Board-and-batten storehouse walls: weathered vertical boards (some bleached silver), battens every 0.96 m,
          // a rail at mid storey and a rubble-stone plinth.
          float bi=floor(s/.24),bf=fract(s/.24);
          vec3 wood=mix(vec3(.19,.16,.13),vec3(.31,.27,.22),hash(vec2(bi,seed)));
          wood=mix(wood,vec3(.43,.42,.40),smoothstep(.55,.85,noise(vec2(s*.35,y*.2+seed*3.0)))*.7);
          wood*=(.86+.28*noise(vec2(bf*3.0+bi*7.0,y*6.0)))*(1.0-.5*(1.0-smoothstep(.004,.014,min(bf,1.0-bf)*.24)));
          float batten=1.0-smoothstep(.026,.034,abs(fract(s/.96+.5)-.5)*.96);
          float railY=abs(fy-.5)*floorH,rail=1.0-smoothstep(.06,.075,railY);
          wood=mix(wood,mix(vec3(.24,.20,.16),vec3(.34,.30,.25),hash(vec2(floor(s/.96),seed+3.0))),max(batten,rail));
          wood*=1.0-.35*max(batten,rail)*(1.0-smoothstep(.0,.02,abs(railY-.075)));
          alb=wood;
          if(y<.7){
            vec2 wq=vec2(s*1.6,y*2.4)+seed,wj=worley(wq);
            vec3 plinth=mix(vec3(.28,.27,.25),vec3(.44,.42,.39),cellNear(wq).y)*(1.0-.6*(1.0-smoothstep(.03,.1,wj.y-wj.x)));
            alb=mix(alb,plinth,step(y,.5+.15*noise(vec2(s*.8,seed))));
          }
        }
        if(style>4.5&&style<5.5){
          // Dark clapboard below, old white plaster above, framed by posts and beams.
          float board=fract(y*4.2);
          vec3 wood=mix(vec3(.17,.14,.11),vec3(.26,.21,.17),hash(vec2(floor(y*4.2),floor(s/1.8)+seed)))*(1.0-.35*(1.0-smoothstep(0.0,.14,board)));
          float plasterBand=step(floorH*.62,fy*floorH);
          timber=clamp(step(.94,fract(s/1.8))+1.0-step(.06,fy),0.0,1.0)*plasterBand;
          alb=mix(mix(wood,vec3(.60,.59,.55),plasterBand),vec3(.13,.11,.09),timber);
        }
        if(style>5.5){
          timber=clamp(step(.92,fract(s/2.0))+1.0-step(.08,fy),0.0,1.0);
          alb=mix(vec3(.70,.68,.62),vec3(.12,.10,.08),timber);
        }
        // Broad mottling, then rain streaks running down from the parapet, the sills and every beam.
        alb*=mix(.86+.22*fbm3(vec2(s*.23,y*.19+seed*3.0)),.93+.1*fbm3(vec2(s*.23,y*.19+seed*3.0)),calm);
        float closeDetail=1.0-smoothstep(6.0,26.0,vDepth);
        if(closeDetail>.001)alb*=1.0-closeDetail*mix(1.0,.5,calm)*(.08*fbm3(vec2(s,y)*2.7+seed)+.08*smoothstep(.55,.8,noise(vec2(s*9.0,y*.9+seed)))-.05);
        vec2 gq=vec2(s,y);
        if(style>3.5&&style<4.5||timber>.5)gq.y*=.2; else if(style>4.5&&style<5.5&&fy<.62)gq.x*=.2;
        alb*=1.0+mix(.3,.18,castle*(1.0-timber))*grit(gq+seed,vDepth);
        float streak=smoothstep(.45,.75,noise(vec2(s*2.4,y*mix(.11,.06,castle)+seed*5.0)))*(.4+.6*noise(vec2(s*.7+seed,y*.04)));
        alb*=1.0-(.55-.3*castle)*streak*(.55+.45*smoothstep(H-4.0,H,y))*(1.0-tiles);
        float underSill=step(left+.04,bay)*step(bay,right-.04)*step(fy,bottom)*(1.0-smoothstep(0.0,.45,bottom-fy));
        alb*=1.0-(1.0-win)*underSill*.35*smoothstep(.25,.7,noise(vec2(s*7.0,y*.5+seed)))*(1.0-tiles);
        float underSlab=1.0-smoothstep(0.0,.22,fy);
        alb*=1.0-.22*underSlab*(1.0-win)*(1.0-castle);
        // Concrete: pale leaching below some slab joints and rust bleeding from rebar in thin lines.
        alb=mix(alb,vec3(.70,.69,.64),(1.0-smoothstep(0.0,.35,fy))*smoothstep(.72,.9,noise(vec2(s*3.3,storey+seed)))*nearDetail*.45*(1.0-castle));
        float rustLine=step(.93,hash(vec2(floor(s*2.5),seed+storey)))*(1.0-smoothstep(.015,.04,abs(fract(s*2.5)-.5)/2.5))*smoothstep(.1,.9,1.0-fy);
        alb=mix(alb,vec3(.36,.20,.11),rustLine*.6*nearDetail*(1.0-win)*(1.0-castle));
        // Fallen plaster shows the clay and lath behind it; hairline cracks near the walker.
        if(nearDetail>.001&&win<.5&&castle>.5&&tiles<.5&&timber<.5&&boards<.5&&y>.62){
          // Irregular sharp-edged patches with a dirty rim; the lath shows as faint horizontal lines.
          float pf=fbm3(vec2(s*1.7,y*1.3)+seed*3.0)+.16*noise(vec2(s,y)*9.0)+.08*noise(vec2(s,y)*23.0)-.12;
          float spall=smoothstep(.64,.65,pf)*nearDetail,rim=smoothstep(.6,.64,pf)*(1.0-spall);
          vec3 clay=mix(vec3(.28,.25,.21),vec3(.36,.32,.27),noise(vec2(s,y)*7.0))*(1.0+.5*grit(vec2(s,y)*1.3,vDepth));
          clay*=1.0-.3*(1.0-smoothstep(.0,.25,abs(fract(y*7.0+.4*noise(vec2(s*2.0,y)))-.5)*2.0))*step(.5,noise(vec2(s*.9,y*.4)+seed));
          alb=mix(alb*(1.0-.2*rim*nearDetail),clay,spall*.9);
        }
        if(nearDetail>.001&&win<.5&&tiles<.5){
          // A few long hairline cracks: isolines of a warped noise field where a broad mask allows them.
          vec2 cq=vec2(s,y)*.55+seed;
          float cn=noise(cq+.6*vec2(noise(cq*2.3),noise(cq*2.3+5.2)));
          alb*=1.0-.4*(1.0-smoothstep(.004,.012,abs(cn-.5)))*smoothstep(.6,.78,noise(vec2(s*.12,y*.15)+seed*4.0))*nearDetail*(1.0-timber);
        }
        // Moss and algae rising from the ground and along ledges; soot above a few openings.
        float moss=smoothstep(2.4,0.0,y+.8*noise(vec2(s*.8,seed)))*smoothstep(.3,.65,noise(vec2(s*.6,y*.9+seed)));
        moss=max(moss,underSlab*smoothstep(.62,.85,noise(vec2(s*.9,storey*1.7+seed)))*.7*(1.0-castle));
        moss=max(moss,tiles*smoothstep(.55,.8,noise(vec2(s*.7,y*2.0+seed)))*.6);
        alb=mix(alb,mix(vec3(.12,.15,.08),vec3(.22,.24,.13),noise(vec2(s,y)*3.0)),clamp(moss,0.0,1.0)*.8*(1.0-win));
        alb*=1.0-.55*step(.82,hash(vec2(bayId+seed*3.0,storey*1.7)))*step(top,fy)*(1.0-smoothstep(top,1.0,fy))*step(left,bay)*step(bay,right)*(1.0-castle*.5);
        // Galleries and recesses sit in deep shade; railings and columns catch the light (timber in the castle quarter).
        alb=mix(alb,mix(alb*1.12,timberC,castle),max(rail,column*.8));
        float ao=1.0-recess*.7-underSlab*.2*(1.0-castle);
        // Depth without geometry: projecting slabs and pent roofs shade a band under them and open galleries shade their
        // depth, all from the real sun direction (t runs along the wall; sN, sT, sY are the sun's normal, lateral and
        // vertical components).
        vec3 t=normalize(vec3(n.z,0.0,-n.x));
        float sN=max(dot(uSun,n),.03),sT=dot(uSun,t),sY=uSun.y;
        float below=(1.0-fy)*floorH;
        float ledge=1.0-(1.0-win)*(1.0-step(.12*sY/sN,below))*(1.0-castle);
        if(castle>.5){
          float eave=step(y+below,H-.45)*(1.0-tiles);
          ledge=1.0-eave*step(below,.6*sY/sN);
          ledge*=1.0-step(y,H-.4)*step(H-.4-y,.5*sY/sN)*(1.0-tiles);
          ao*=1.0-.45*eave*(1.0-smoothstep(0.0,.6,below));
          ao*=1.0-.4*(1.0-smoothstep(0.0,.3,y-(H-.4)+.35))*step(y,H-.4);
        }
        float gallery=1.0-recess*(1.0-step(1.6*sY/sN,(1.0-fy)*floorH*.62));
        vec3 lit=sLight(toLin(alb),n,uSun,sh*ledge*gallery,ao);
        if(win>.5){
          // Openings: wooden lattice (renji) over a dark room, paper screens (shoji) with torn holes, boarded bays and, at
          // dusk and night in the inhabited years, a few screens glowing with lamplight. No glass in this world.
          float kind=hash(vec2(bayId*1.7+seed,storey*3.1+1.0));
          float edgeX=min(pane.x,1.0-pane.x)*paneWidth,edgeY=min(pane.y,1.0-pane.y)*paneHeight;
          float frame=1.0-smoothstep(.035,.065,min(edgeX,edgeY));
          vec3 inside=(uAmbS*.5+uKey*.06)*toLin(vec3(.10,.09,.08))*(.4+pane.y);
          float shoji=step(kind,.38),lamp=step(kind,.13)*(1.0-age)*uTone.w;
          vec2 kg=vec2(pane.x*paneWidth/.32,pane.y*paneHeight/.42);
          float kumiko=1.0-smoothstep(.012,.02,min(min(fract(kg.x),1.0-fract(kg.x))*.32,min(fract(kg.y),1.0-fract(kg.y))*.42));
          float torn=step(.74-.22*age,noise(vec2(pane.x*paneWidth,pane.y*paneHeight)*5.3+bayId*7.0+storey)+.12*noise(vec2(pane.x,pane.y)*40.0))*(1.0-lamp);
          float lattice=mix(.38,1.0-smoothstep(.012,.024,abs(fract(pane.x*paneWidth/.11)-.5)*.11),nearDetail)*(1.0-shoji);
          // The opening is recessed 0.22 m: its head and one jamb shade it from the sun, and seen at an angle the inner jamb,
          // soffit or sill shows as a strip of wall.
          float D=.22,distTop=(1.0-pane.y)*paneHeight,distL=pane.x*paneWidth,distR=(1.0-pane.x)*paneWidth;
          float reveal=max(step(distTop,D*sY/sN),step(sT>0.0?distR:distL,D*abs(sT)/sN));
          float shIn=sh*(1.0-reveal);
          vec3 toEye=normalize(uEye-vWorld);float vN=max(dot(toEye,n),.05),vT=dot(toEye,t);
          float jamb=step(vT>0.0?distL:distR,D*abs(vT)/vN),soffit=step(distTop,D*max(-toEye.y,0.0)/vN),sill=step(pane.y*paneHeight,D*max(toEye.y,0.0)/vN);
          vec3 paper=toLin(vec3(.74,.70,.60)*(.9+.2*noise(kg*1.3+seed)))*(uAmbS*.8+uKey*.3*shIn)+toLin(vec3(1.0,.64,.32))*lamp*(.6+.4*pane.y);
          paper=mix(paper,inside,torn*(1.0-kumiko));
          paper=mix(paper,sLight(toLin(vec3(.16,.13,.10)),n,uSun,shIn,.7),kumiko*mix(.5,1.0,nearDetail));
          vec3 wcol=mix(inside,paper,shoji);
          wcol=mix(wcol,sLight(toLin(vec3(.29,.26,.22)),n,uSun,shIn,.8),lattice);
          float boarded=step(.88,kind)*step(.5,age+hash(vec2(seed,storey)));
          vec3 plank=mix(vec3(.19,.16,.12),vec3(.30,.25,.19),hash(vec2(floor(pane.y*paneHeight/.19),bayId+seed)))*(1.0-.4*(1.0-smoothstep(0.0,.1,fract(pane.y*paneHeight/.19))));
          wcol=mix(wcol,sLight(toLin(plank),n,uSun,shIn,.8),boarded);
          wcol=mix(wcol,sLight(toLin(vec3(.14,.12,.10)),n,uSun,shIn,.8),frame*nearDetail);
          vec3 jambN=vT>0.0?t:-t;
          wcol=mix(wcol,sLight(toLin(alb*.9),jambN,uSun,sh,.8),jamb*(1.0-boarded)*nearDetail);
          wcol=mix(wcol,sLight(toLin(alb*.8),vec3(0.0,-1.0,0.0),uSun,sh,.6),soffit*(1.0-jamb)*nearDetail);
          wcol=mix(wcol,sLight(toLin(alb*1.05),vec3(0.0,1.0,0.0),uSun,sh,.9),sill*(1.0-jamb)*nearDetail);
          lit=mix(lit,wcol,win);
        }
        float snowCap=uEnv.y*(1.0-smoothstep(.0,.06,H-y))*(1.0-win);
        lit=mix(lit,sLight(toLin(vec3(.74,.76,.80)),vec3(0.0,1.0,0.0),uSun,sh,1.0),snowCap);
        lit*=1.0-uEnv.z*.25*(1.0-win);
        gl_FragColor = vec4(aerial(lit,uHorizon,uSun,uFog,vDepth,uAnime), uGhostPass > 0.5 ? 0.22 : 1.0);
        return;
      }
#else
      if(uAnime>0.5){
        // Restrained concrete/wood palette: material colour is independent of light colour.
        base=mix(base,vec3(.84,.81,.73),.22);
        base*=.96+.08*hash(vec2(seed,17.0));
        if(style>4.5&&style<5.5){
          base=mix(vec3(.50,.30,.16),vec3(.60,.37,.21),plank)*(.93+.12*hash(vec2(floor(y*4.0),floor(s/1.8)+seed)));
          base*=1.0-.26*(1.0-smoothstep(0.0,.12,fract(y*4.0)));
        }
        if(style>2.5&&style<3.5)base=vec3(.83,.84,.78);
        if(style>3.5&&style<4.5)base=vec3(.55,.58,.59);
        // Placeholder colour variety between concrete buildings (cream, sage, pale blue, blush), kept subtle.
        float tintId=hash(vec2(seed,41.0));
        if(style<3.5)base*=tintId<.3?vec3(1.03,1.0,.92):tintId<.5?vec3(.97,1.02,.96):tintId<.7?vec3(.95,.99,1.04):tintId<.8?vec3(1.03,.97,.96):vec3(1.0);
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
      if(uAnime>0.5){
        /* Stylised inferred panes: variation and a sky reflection, without texture downloads. */
        glass=mix(vec3(.10,.23,.29),vec3(.42,.67,.70),clamp(.18+.6*fy+.22*cell,0.0,1.0));
      }
      col = mix(col, glass, win);
      if(uAnime>0.5){
        float period=2.4, left=.2, right=.72, bottom=.32, top=.78;
        if(style>1.5&&style<2.5){period=3.2;left=.25;right=.75;bottom=.45;top=.85;}
        else if(style>2.5&&style<3.5){period=1.8;left=.06;right=1.0;bottom=.34;top=.82;}
        else if(style>3.5&&style<4.5){period=5.0;left=.3;right=.7;bottom=.35;top=.8;}
        else if(style>4.5&&style<5.5){period=2.0;left=.3;right=.65;bottom=.4;top=.75;}
        else if(style>5.5){period=2.0;left=.35;right=.65;bottom=.45;top=.75;}
        vec2 pane=vec2((fract(s/period)-left)/(right-left),(fy-bottom)/(top-bottom));
        float paneWidth=(right-left)*period, paneHeight=(top-bottom)*floorH;
        float nearDetail=1.0-smoothstep(45.0,110.0,vDepth);
        float edgeX=min(pane.x,1.0-pane.x)*paneWidth;
        float edgeY=min(pane.y,1.0-pane.y)*paneHeight;
        float frame=1.0-smoothstep(.025,.055,min(edgeX,edgeY));
        float mullion=1.0-smoothstep(.014,.035,abs(pane.x-.5)*paneWidth);
        float crossbar=1.0-smoothstep(.014,.028,abs(pane.y-.5)*paneHeight);
        vec3 timber=mix(vec3(.30,.35,.31),vec3(.66,.61,.45),cell);
        col=mix(col,timber,win*max(frame,max(mullion,crossbar*.7))*nearDetail);
        float reveal=1.0-smoothstep(.04,.18,edgeY);
        col*=1.0-win*reveal*.22*nearDetail;
        // Subtle plaster variation and contact shading below projecting floor slabs.
        col*=.94+.09*noise(vec2(s*.65,y*.9+seed));
        float plaster=noise(vec2(s*3.1,y*3.1));
        col*=1.0-(1.0-win)*.06*smoothstep(.58,.85,plaster);
        col*=1.0-.12*(1.0-smoothstep(.03,.16,fy))*(1.0-win);
        float trim=step(.31,fy)*step(fy,.35)+step(.77,fy)*step(fy,.80);
        col=mix(col,vec3(.43,.56,.53),trim*.25*(1.0-win));
        // Placeholder facade life, not documented detail: rain streaks, balcony laundry and pots, climbing ivy.
        float bay=fract(s/period),bayId=floor(s/period);
        float underSill=step(left+.06,bay)*step(bay,right-.06)*step(fy,bottom)*(1.0-smoothstep(0.0,.3,bottom-fy));
        col*=1.0-(1.0-win)*underSill*.2*smoothstep(.3,.75,noise(vec2(s*7.0,y*.5+seed)));
        float lively=hash(vec2(bayId+seed*3.0,storey*1.7+7.0))*(1.0-age*.8);
        if(style<2.5&&storey>=1.0){
          float cloth=step(.62,lively)*step(.42,pane.y)*step(pane.y,.9)*step(.06,pane.x)*step(pane.x,.94),piece=fract(pane.x*3.0+lively*7.0);
          cloth*=step(.08,piece)*step(piece,.9)*step(.4,pane.y+.4*fract(pane.x*3.0+lively));
          vec3 fabric=hash(vec2(bayId,storey+floor(pane.x*3.0)))>.5?vec3(.96,.95,.91):mix(vec3(.56,.72,.93),vec3(.98,.70,.72),hash(vec2(storey,bayId+3.0)));
          col=mix(col,fabric*mix(.9,1.0,step(.5,fract(pane.y*9.0))),cloth*nearDetail);
          col=mix(col,vec3(.35,.29,.22),(1.0-smoothstep(.006,.016,abs(pane.y-.93)*paneHeight))*step(.62,lively)*step(0.0,pane.x)*step(pane.x,1.0)*nearDetail);
          float pot=step(.78,hash(vec2(bayId*1.3,storey+seed)))*step(abs(pane.y+.07)*paneHeight,.12)*step(.18,pane.x)*step(pane.x,.46);
          col=mix(col,mix(vec3(.25,.52,.20),vec3(.66,.37,.24),step(pane.y,-.09)),pot*nearDetail);
        }
        // Ground cover creeps up the wall base in the shared meadow colours, with a jagged top edge.
        if(y<1.45&&nearDetail>.001){
          float creep=(1.0-smoothstep(.12,.5+.9*noise(vec2(s*1.7,seed)),y))*smoothstep(.35,.6,noise(vec2(s*.23,seed*2.1)))*nearDetail;
          col=mix(col,meadowColor(vWorld.xz)*mix(.7,1.0,smoothstep(0.0,.6,y)),creep);
        }
        // Painted brush strokes and hairline cracks keep plain concrete from looking slick.
        col*=.95+.08*noise(vec2(s*.8,y*3.2+seed));
        if(nearDetail>.001&&win<.5){
          vec2 wc=worley(vec2(s,y)*1.9+seed);
          col*=1.0-.09*(1.0-smoothstep(.006,.03,wc.y-wc.x))*nearDetail*step(.68,noise(vec2(s*.15,y*.2+seed*3.0)))*step(.58,noise(vec2(s,y)*2.3+seed*7.0));
        }
        float sill=step(bottom-.06,fy)*step(fy,bottom)*step(left,bay)*step(bay,right);
        col=mix(col,mix(vec3(.51,.60,.25),vec3(.32,.33,.13),noise(vec2(s*6.0,y*6.0))),sill*smoothstep(.45,.65,noise(vec2(s*1.3,storey+seed)))*.8);
        if(nearDetail>.001&&(style<1.5||(style>2.5&&style<3.5))){
          // Painted downpipes on some piers between window bays, with a bracket at every floor.
          if(style<1.5){
            float pc=(right+1.0+left)*.5,dp=abs(fract(s/period-pc+.5)-.5)*period,pipe=step(.78,hash(vec2(floor(s/period-pc+.5),seed*2.3)))*(1.0-smoothstep(.05,.065,dp));
            float bracket=pipe*step(abs(fy-.12)*floorH,.035)*(1.0-smoothstep(.07,.085,dp));
            vec3 metal=vec3(.46,.53,.50)*(1.0-.4*pow(dp/.065,2.0))+vec3(.12)*(1.0-smoothstep(0.0,.02,abs(dp-.02)));
            col=mix(col,metal,max(pipe,bracket*.9)*step(.2,y)*nearDetail);
            col*=1.0-bracket*.25*nearDetail;
          }
          // Flower boxes under some upper-floor windows: a wooden box with blooms rising above the sill.
          float fb=step(.8,hash(vec2(bayId*2.1,storey+seed*1.3)))*step(1.0,storey)*step(.05,pane.x)*step(pane.x,.95)*(1.0-age);
          float sy=pane.y*paneHeight;vec2 fl=vec2(pane.x*paneWidth,sy)*14.0,fc=floor(fl);
          float bloom=fb*step(-.03,sy)*step(sy,.12)*step(length(fract(fl)-.5),.42)*step(.35,hash(fc+seed));
          vec3 petal=hash(fc+3.0)<.4?vec3(.95,.35,.42):hash(fc+3.0)<.7?vec3(1.0,.93,.95):vec3(.98,.78,.30);
          col=mix(col,vec3(.42,.28,.18)*(.85+.15*step(.5,fract(sy*20.0))),fb*step(-.2,sy)*step(sy,-.03)*nearDetail);
          col=mix(col,mix(rampAt(.5),petal,step(.55,hash(fc+9.0))),bloom*nearDetail);
        }
        // Ivy climbing from the ground on some stretches and greenery draping from the roof edge on others, drawn as
        // overlapping round leaves: a covered body with a leafy fringe (placeholders, not documented planting).
        float ivySeed=hash(vec2(seed*11.0,5.0)),stretch=smoothstep(.42,.62,noise(vec2(s*.11,seed*5.3)))*step(.25,ivySeed);
        float dropSeed=hash(vec2(seed*5.0,23.0)),drop=smoothstep(.5,.66,noise(vec2(s*.13,seed*3.1)))*step(.55,dropSeed)*step(6.0,H);
        if(stretch+drop>.001){
          float reach=(mix(1.0,4.5,ivySeed)+age*8.0)*(.4+.6*noise(vec2(s*.45,seed*2.7)));
          float edge=reach-y+.9*(noise(vec2(s,y)*2.2)-.5);
          float hang=(mix(.6,2.4,dropSeed)+age*4.0)*(.2+.8*noise(vec2(s*2.2,seed*4.3)))*(.5+.5*noise(vec2(s*.5,seed)))-(H-y)+.4*(noise(vec2(s,y)*2.6+7.0)-.5);
          float grow=max(stretch*smoothstep(-.35,.1,edge),drop*smoothstep(-.35,.1,hang));
          if(grow>.001){
            vec4 lf=leaves(vec2(s,y)*5.5+seed,1.0-nearDetail);
            float body=max(stretch*smoothstep(.25,.6,edge),drop*smoothstep(.25,.6,hang));
            col=mix(col,lf.rgb,max(body,grow*lf.w)*(1.0-win*(1.0-age)*.85));
          }
        }
      }
      /* weathering after 1974: streaks, stains, moss near the ground */
      float streak = noise(vec2(s * 1.5, y * 0.3 + seed * 5.0));
      col *= 1.0 - age * (0.25 * streak + 0.1 * smoothstep(3.0, 0.0, y));
      col = mix(col, vec3(0.30, 0.36, 0.22), age * 0.35 * smoothstep(2.5, 0.0, y) * noise(vec2(s * 0.7, seed * 3.0)));
      float light = 0.32 + 0.62 * d * mix(0.35, 1.0, sh);
      col *= mix(1.0, light, uShade);
      if(uAnime>0.5) col=toonLight(col/max(.32,light),n,uSun,sh,1.0-recess*.25);
      if (uChange > 0.001){
        vec3 grey = vec3(dot(col, vec3(0.299, 0.587, 0.114)));
        vec3 flag = gone > 0.0 && gone <= 110.0 ? vec3(0.88, 0.22, 0.16) : vec3(0.35, 0.55, 0.85);
        col = mix(col, mix(grey, flag, 0.75) * (0.55 + 0.45 * d), uChange);
      }
      col = aerial(col,uHorizon,uSun,uFog,vDepth,uAnime);
      gl_FragColor = vec4(col, uGhostPass > 0.5 ? 0.22 : 1.0);
#endif
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
#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
#else
    precision mediump float;
#endif
    uniform sampler2D uTexA, uTexB;
    uniform float uMix, uOrthoA, uOrthoB, uShade, uChange, uFog, uAnime; uniform mediump float uYear;
    uniform vec3 uBg, uSun, uHorizon;
    varying vec2 vUvP; varying vec2 vUvO; varying float vAlive; varying vec2 vInfo; varying vec2 vPos; varying float vGhost;
    varying vec4 vShadow; varying float vDepth;
    uniform float uGhostPass;
    ` + SHADOW_FN + `
    void main(){
      if (vAlive < 0.02) discard;
      if (uGhostPass < 0.5 && vGhost > 0.5) discard;
      if (uGhostPass > 0.5 && vGhost < 0.5) discard;
      /* the walking view paints its own ground and roofs, so it skips the two photograph fetches */
      vec3 t = uAnime > 0.5 ? vec3(0.5) : mix(texture2D(uTexA, mix(vUvP, vUvO, uOrthoA)).rgb, texture2D(uTexB, mix(vUvP, vUvO, uOrthoB)).rgb, uMix);
      float style = vInfo.x, seed = vInfo.y;
      float sh = shadowAt(vShadow, 0.0022);
      float d = max(dot(vec3(0.0, 1.0, 0.0), uSun), 0.0);
      /* the photograph carries the roof; a faint concrete tone keeps it from looking like paper */
      vec3 roof = style > 4.5 && style < 5.5 ? vec3(0.30, 0.27, 0.24) : vec3(0.62, 0.60, 0.57);
      vec3 col = mix(t, roof * (0.6 + 0.4 * dot(t, vec3(0.33))), vAlive < 0.98 ? 0.8 : 0.25);
      col *= mix(1.0, 0.42 + 0.6 * d * mix(0.35, 1.0, sh), uShade);
      #ifdef SENGOKU
      {
        // Sengoku roofs: weathered slabs with moss and ponding, dark round-tile roofs on the wooden houses, overgrown beds.
        vec2 m=vPos*.805;
        vec3 alb=mix(vec3(.33,.32,.30),vec3(.43,.42,.39),fbm3(m*.12+seed*9.0))*(.85+.25*noise(m*2.3));
        alb=mix(alb,vec3(.13,.16,.09),smoothstep(.55,.8,noise(m*.35+seed*5.0))*.6);
        if(style>4.5&&style<5.5){
          float row=fract(m.x/.28)*2.0-1.0;
          alb=mix(vec3(.10,.11,.12),vec3(.25,.26,.28),sqrt(max(0.0,1.0-row*row)))*(.85+.3*noise(m*vec2(1.0,6.0)));
        }
        vec2 bedCell=fract(m/vec2(2.4,5.2));
        float bed=step(.55,fract(seed*37.3+style*.13))*(1.0-step(4.5,style)*step(style,5.5))*step(.18,bedCell.x)*step(bedCell.x,.78)*step(.1,bedCell.y)*step(bedCell.y,.9);
        alb=mix(alb,mix(vec3(.15,.11,.08),uRamp1,smoothstep(.45,.62,noise(m*2.2+seed*9.0))),bed);
        float snow=uEnv.y*smoothstep(.3,.6,fbm3(m*.3)+uEnv.y*.4);
        col=sLight(toLin(mix(alb*(1.0-.35*uEnv.z),vec3(.74,.76,.80),snow)),vec3(0.0,1.0,0.0),uSun,sh,1.0);
        float pool=smoothstep(.66,.7,noise(m*.18+seed*3.0))*(1.0-bed)*(1.0-snow)*(.3+.7*uEnv.z);
        vec3 eyeDir=normalize(uEye-vWorld);
        col=mix(col,(mix(uFogC,uAmbS*.6,.5)+uSunC*pow(max(dot(reflect(-eyeDir,vec3(0.0,1.0,0.0)),uSun),0.0),30.0))*.7,pool*(.4+.6*pow(1.0-max(eyeDir.y,0.0),3.0)));
      }
#else
      if(uAnime>0.5){
        vec3 roofBase=mix(vec3(.54,.56,.55),vec3(.73,.72,.66),.55+.16*noise(vPos*.12));
        // Placeholder rooftop vegetable beds on some concrete roofs (illustrative, not per-building evidence).
        vec2 m=vPos*.805,bedCell=fract(m/vec2(2.4,5.2));
        float bed=step(.55,fract(seed*37.3+style*.13))*(1.0-step(4.5,style)*step(style,5.5))*step(.18,bedCell.x)*step(bedCell.x,.78)*step(.1,bedCell.y)*step(bedCell.y,.9);
        vec3 plot=mix(vec3(.40,.29,.19),mix(vec3(.26,.50,.19),vec3(.46,.68,.24),noise(m*4.0)),smoothstep(.42,.6,noise(m*2.2+seed*9.0)));
        roofBase=mix(roofBase,plot,bed);
        col=toonLight(roofBase,vec3(0.0,1.0,0.0),uSun,sh,1.0);
      }
#endif
      if (uChange > 0.001){ vec3 grey = vec3(dot(col, vec3(0.299, 0.587, 0.114))); col = mix(col, grey * 0.9, 0.5 * uChange); }
      col = aerial(col,uHorizon,uSun,uFog,vDepth,uAnime);
      gl_FragColor = vec4(col, uGhostPass > 0.5 ? 0.18 : 1.0);
    }`;
  // the sea wall ring
  const SEAWALL_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
#else
    precision mediump float;
#endif
    uniform float uChange, uFog, uShade, uAnime; uniform mediump float uYear;
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
      #ifdef SENGOKU
      {
        /* Sengoku sea wall: staggered dark stone blocks, a black-green tide band, streaks from the crest, dry grass on top. */
        float H = vTop + 1.5, course = floor(y / 1.2), along = (s + course * 1.7) / 2.1;
        float cy = fract(y / 1.2), cx = fract(along);
        float joint = clamp((1.0 - smoothstep(0.0, .05, min(cy, 1.0 - cy) * 1.2)) + (1.0 - smoothstep(0.0, .05, min(cx, 1.0 - cx) * 2.1)), 0.0, 1.0);
        vec3 stone = mix(vec3(.33, .32, .30), vec3(.45, .43, .40), hash(vec2(floor(along), course))) * (.82 + .3 * fbm3(vec2(s * .5, y * .7)));
        stone *= 1.0 - .5 * joint;
        float tide = smoothstep(2.6 + .6 * noise(vec2(s * .3, 1.0)), .2, y);
        stone = mix(stone, mix(vec3(.07, .09, .06), vec3(.15, .17, .10), noise(vec2(s, y) * 2.0)), tide * .85);
        stone *= 1.0 - .3 * smoothstep(.5, .8, noise(vec2(s * 2.2, y * .12))) * smoothstep(H - 3.5, H, y);
        float lip = step(H - (.2 + .35 * noise(vec2(s * .9, 5.0))), y) * smoothstep(.4, .6, noise(vec2(s * .35, 9.0)));
        stone = mix(stone, mix(uRamp1, uRamp0, .4), lip * .8);
        stone = mix(stone * (1.0 - .3 * uEnv.z * (1.0 - tide)), vec3(.86, .88, .92), uEnv.y * step(H - .12, y));
        col = sLight(toLin(stone), n, uSun, sh, 1.0 - .3 * tide);
        vec3 eyeDir = normalize(uEye - vWorld);
        col += uFogC * pow(1.0 - max(dot(n, eyeDir), 0.0), 4.0) * .25 * max(tide, uEnv.z);
      }
#else
      if(uAnime>0.5){
        /* Walking view: the sea wall in the buildings' toon light instead of the dark photographic shading, with an
           algae band at the waterline, weeds in some joints and grass spilling over the top (placeholders). */
        float H = vTop + 1.5;   /* the ring's crest above its foot at -1.5 m (vWall.z is interpolated along the face here) */
        vec3 stone = mix(vec3(.66, .66, .61), vec3(.75, .74, .68), noise(vec2(s * .35, y * .5))) * (1.0 - course * .55) * (.93 + .1 * noise(vec2(s * 1.3, y * 1.7)));
        stone = mix(stone, vec3(.30, .42, .33), smoothstep(1.9, .3, y) * .8);
        float seam = step(0.92, fract(y / 1.5)) * smoothstep(.62, .8, noise(vec2(s * 1.9, floor(y / 1.5) * 3.7)));
        // Grass spills over the top in a jagged fringe 0.2-0.6 m deep on some stretches only.
        float fringe = .18 + .3 * noise(vec2(s * .9, 5.0)) + .12 * noise(vec2(s * 4.3, 2.0));
        float lip = step(H - fringe, y) * smoothstep(.45, .62, noise(vec2(s * .35, 9.0)));
        stone = mix(stone, meadowColor(vWorld.xz) * .82, seam * step(2.2, y) * .85);
        stone = mix(stone, meadowColor(vWorld.xz) * mix(.68, .92, smoothstep(H - fringe, H, y)), lip * .9);
        col = toonLight(stone, n, uSun, sh, 1.0);
      }
#endif
      col = aerial(col,uHorizon,uSun,uFog,vDepth,uAnime);
      gl_FragColor = vec4(col, 1.0);
    }`;
  const SKY_VS = `attribute vec2 aPos; varying vec2 vP; void main(){ vP = aPos; gl_Position = vec4(aPos, 0.9999, 1.0); }`;
  // Original lightweight approximation inspired by public atmosphere talks; no game assets/code.
  const SKY_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
#else
    precision mediump float;
#endif
    uniform vec3 uTop, uHorizon, uSun, uMid;
    uniform float uEl, uAz, uAspect, uAnime, uTime, uCloudCover, uStorm, uLand;
    uniform vec4 uGrade;
    uniform mediump vec4 uEnv; uniform vec3 uSunC, uFogC, uGLift, uGGamma, uGGain; uniform vec4 uTone;
    varying vec2 vP;
    float skyHash(vec2 p){p=mod(p,113.0);return fract(sin(dot(p,vec2(7.13,3.71)))*157.91);}
    float skyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(skyHash(i),skyHash(i+vec2(1,0)),f.x),mix(skyHash(i+vec2(0,1)),skyHash(i+vec2(1,1)),f.x),f.y);}
    float fbm5(vec2 p){float a=.5,s=0.0;for(int i=0;i<4;i++){s+=a*skyNoise(p);p=p*2.03+vec2(17.1,-9.2);a*=.5;}return s+.03;}
    float fbm2(vec2 p){return .67*skyNoise(p)+.33*skyNoise(p*2.03+vec2(17.1,-9.2));}
    // The sengoku grade of the scene shaders, repeated here for the sky (linear light in, display out).
    vec3 sGradeSky(vec3 c){
      c*=uGrade.x;
      c=sqrt(clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.0,1.0));
      float l=dot(c,vec3(.2126,.7152,.0722));
      c=max(mix(vec3(l),c,uGrade.y),0.0);
      c=mix(c,c*c*(3.0-2.0*c),clamp(uGrade.z,0.0,1.0)*.7);
      c=uGLift+(uGGain-uGLift)*pow(c,uGGamma);
      return clamp(c*vec3(1.0+uGrade.w*.04,1.0+uGrade.w*.01,1.0-uGrade.w*.04),0.0,1.0);
    }
    float cloudNoise(vec2 p){return .57*skyNoise(p)+.28*skyNoise(p*2.03+17.1)+.15*skyNoise(p*4.07-9.2);}
    float density(vec2 p){return smoothstep(.57-uCloudCover*.23,.78-uCloudCover*.19,cloudNoise(p));}
    float wrapAngle(float a){return a-6.28318*floor((a+3.14159)/6.28318);}
    // Periodic rounded ridge over azimuth, 0..1.
    float ridge(float az,float k){return .55+.22*sin(3.0*az+k)+.14*sin(7.0*az+k*2.3)+.09*sin(13.0*az+k*.7);}
    vec3 grade(vec3 c){
      c*=uGrade.x;float l=dot(c,vec3(.299,.587,.114));c=max(mix(vec3(l),c,uGrade.y),0.0);
      c=mix(c,c*c*(3.0-2.0*c),clamp(uGrade.z,0.0,1.0));
      return clamp(c*vec3(1.0+uGrade.w*.05,1.0+uGrade.w*.015,1.0-uGrade.w*.05),0.0,1.0);
    }
    void main(){
      if(uAnime<.5){gl_FragColor=vec4(mix(uHorizon,uTop,smoothstep(-.2,1.0,vP.y+uEl*.6)),1);return;}
      float ce=cos(uEl),se=sin(uEl),ca=cos(uAz),sa=sin(uAz);
      vec3 forward=vec3(sa*ce,se,ca*ce),right=vec3(-ca,0,sa),up=vec3(-sa*se,ce,-ca*se);
      vec3 ray=normalize(forward+.483055*(right*vP.x*uAspect+up*vP.y));
      float altitude=max(ray.y,0.0),sunAmount=max(dot(ray,uSun),0.0);
      #ifdef SENGOKU
      {
        /* Sengoku sky (linear light): a warm horizon towards the sun cooling away from it, a broad Mie glow, the sun or the
           moon, stars at night, a slow deck of lit clouds, and distant ranges in aerial perspective to the north-east
           through south-east (the Nagasaki peninsula, Unzen beyond): illustrative silhouettes, not survey data. */
        float mu=dot(ray,uSun),az=atan(ray.x,ray.z),el=asin(clamp(ray.y,-1.0,1.0));
        vec3 hor=mix(uHorizon,uMid,smoothstep(.2,2.4,abs(wrapAngle(az-atan(uSun.x,uSun.z)))));
        vec3 col=mix(hor,uTop,pow(altitude,.5));
        col+=uSunC*(pow(max(mu,0.0),4.0)*.35+pow(max(mu,0.0),48.0)*.8)*(1.0-uStorm*.7);
        col=mix(col,uSunC*mix(3.5,1.4,uEnv.w)+vec3(.2),smoothstep(.99955,.99985,mu)*(1.0-uStorm*.85));
        if(uEnv.w>.5&&ray.y>0.0){
          vec2 sp=vec2(az*60.0,el*60.0);
          col+=vec3(.8,.85,1.0)*step(.985,skyHash(floor(sp)))*smoothstep(.3,0.0,length(fract(sp)-.5))*.5*smoothstep(.05,.3,altitude)*(1.0-uCloudCover*.8);
        }
        if(ray.y>0.0){
          vec2 plane=ray.xz/(ray.y+.07),wind=vec2(uTime*.004,uTime*.0015),q=plane*.55+wind;
          float d=fbm5(q),dl=fbm2(q+uSun.xz*.06)*.95+.02;
          float dens=smoothstep(.62-uCloudCover*.42,.95-uCloudCover*.42,d);
          float lit=clamp(.55+(d-dl)*5.0,0.0,1.0);
          vec3 cc=mix(mix(uTop*.9,uMid*.55,.5)*(1.0-uStorm*.4),uSunC*1.25+uTop*.35,lit*(1.0-uStorm*.6));
          cc+=uSunC*pow(max(mu,0.0),6.0)*(1.0-dens)*1.2;
          float fade=smoothstep(0.0,.12,altitude);
          col=mix(col,mix(hor,cc,fade*.85+.15),dens*fade*.97);
          col=mix(col,uSunC*.6+uTop*.6,smoothstep(.55,.8,fbm2(plane*vec2(.25,1.2)+wind*2.0+31.0))*.18*fade*(1.0-uCloudCover*.5));
        }
        float window=smoothstep(1.6,1.1,abs(wrapAngle(az-1.95)));
        for(int i=0;i<3;i++){
          float fi=float(i),x=az*(4.0+fi*2.3)+fi*7.3;
          // Ridged sums: sharp summits and rounded saddles, as real ranges have (a sum of |sin| gives domes and notches).
          float r=.5*(1.0-abs(sin(x)))+.3*(1.0-abs(sin(x*2.13+1.3)))+.15*(1.0-abs(sin(x*4.7+.4)))+.08*skyNoise(vec2(az*40.0,fi*9.0));
          float peak=(i==0?.105:i==1?.06:.032)*uLand*window*mix(.45,1.1,r);
          if(i==0)peak=max(peak,uLand*.13*pow(max(1.0-abs(wrapAngle(az-2.25))/.55,0.0),1.7)*(.92+.08*r)*window);
          if(el<peak&&el>-.02){
            float h=el/max(peak,.0001);
            vec3 m=mix(mix(uMid,uFogC,.3)*.95,uFogC*.35+uTop*.25,fi/2.0);
            if(i==0)m=mix(m,mix(uFogC,uSunC*.7+uMid*.4,.5),smoothstep(.8,.95,h+.2*skyNoise(vec2(az*90.0,el*200.0)))*.45*smoothstep(.08,.11,peak));
            col=mix(m,hor,(1.0-smoothstep(0.0,.6,h))*(.55-fi*.15));
          }
        }
        if(el<-.004)col=mix(uFogC,uFogC*.55,smoothstep(-.004,-.12,el));
        gl_FragColor=vec4(sGradeSky(col),1.0);
        return;
      }
#else
      // Four-stop anime gradient: horizon, mid and top (top exponent 1.4, horizon sharpness 3).
      vec3 col=mix(uMid,uTop,pow(altitude,1.0/1.4));
      col=mix(col,uHorizon,pow(1.0-altitude,3.0));
      col+=vec3(1.0,.76,.42)*pow(sunAmount,18.0)*.18*(1.0-uStorm);
      col+=vec3(1.0,.90,.68)*smoothstep(.9993,.9998,sunAmount)*(1.0-uStorm)*.8;
      float az=atan(ray.x,ray.z),el=asin(clamp(ray.y,-1.0,1.0));
      if(ray.y>0.0){
        vec2 wind=vec2(uTime*.014,uTime*.005);
        vec2 plane=ray.xz/(ray.y+.13);
        float veil=smoothstep(.48,.76,cloudNoise(plane*vec2(1.1,3.7)-wind*.43+31.0));
        col=mix(col,mix(vec3(.91,.95,.99),uHorizon,.35),veil*.27*smoothstep(0.0,.22,altitude));
        vec2 q=plane*2.2-wind;
        float d=density(q)*mix(.45,1.0,uCloudCover),litDensity=density(q+uSun.xz*.28);
        float rim=clamp((d-litDensity)*3.0,0.0,1.0);
        vec3 bottom=mix(vec3(.60,.70,.82),vec3(.31,.39,.48),uStorm);
        vec3 cloud=mix(vec3(1.0,.98,.91),bottom,clamp(d*.70+uStorm*.30,0.0,1.0));
        cloud+=vec3(1.0,.85,.56)*rim*.22*(1.0-uStorm);
        cloud=mix(uHorizon,cloud,smoothstep(0.0,.32,altitude));
        col=mix(col,cloud,d*smoothstep(0.0,.11,altitude)*.96);
        // Flat cartoon cumulus: a few lobed puffs with flat bottoms, white tops and blue-grey undersides.
        for(int i=0;i<12;i++){
          float fi=float(i),h1=skyHash(vec2(fi,3.1)),h2=skyHash(vec2(fi,7.7)),h3=skyHash(vec2(fi,11.3));
          float size=.085+.07*h2,base=.20+.30*h1;
          float dx=wrapAngle(az-(fi*.5236+h3*.35+uTime*.0012))*cos(el)/size,dy=(el-base)/size;
          if(abs(dx)>1.6||dy<-.2||dy>1.4)continue;
          float lobes=max(max(.44-length(vec2(dx+.55,dy-.18)),.56-length(vec2(dx+.08,dy-.42))),max(.48-length(vec2(dx-.45,dy-.30)),.36-length(vec2(dx-.95,dy-.12))));
          lobes=min(lobes,dy+.02);
          float a=smoothstep(0.0,.03,lobes)*(1.0-uStorm*.7);
          float band=smoothstep(.1,.16,dy)+smoothstep(.42,.48,dy);
          vec3 puff=mix(vec3(.78,.86,.91),mix(vec3(.88,.93,.96),vec3(.99,.99,.98),step(1.5,band)),step(.5,band));
          puff+=vec3(1.0,.93,.78)*.08*smoothstep(.0,.08,lobes)*max(dot(normalize(vec3(dx,dy,.6)),normalize(vec3(uSun.x,uSun.y,.3))),0.0);
          col=mix(col,puff,a);
        }
      }
      // A continuous bank of cumulus sitting on the horizon (flat base, lobed tops), cel-toned, drifting slowly.
      if(ray.y>-.01){
        float drift=az+uTime*.0009,lobe=.5*sin(drift*9.0+1.7)+.3*sin(drift*23.0+.4)+.2*sin(drift*41.0+2.9);
        float top=(.075+.035*lobe+.03*skyNoise(vec2(drift*6.0,1.3)))*mix(.7,1.3,uCloudCover);
        float bank=smoothstep(0.0,.012,top-el)*smoothstep(-.01,.004,el);
        float tone=el/max(top,.001);
        vec3 puff=mix(vec3(.80,.89,.93),vec3(.99,.99,.94),smoothstep(.15,.55,tone+.12*skyNoise(vec2(drift*30.0,el*60.0))));
        puff=mix(puff,uHorizon,.25);
        col=mix(col,puff,bank*(1.0-uStorm*.5));
      }
      // Distant land painted into the sky, only where land lies: north through east to south-east
      // (Takashima and the Nagasaki peninsula). Illustrative silhouettes, not survey data.
      float window=smoothstep(1.35,.95,abs(wrapAngle(az-1.95)));
      float farTop=uLand*.052*ridge(az,1.3)*window,nearTop=uLand*.03*ridge(az*1.7,4.1)*smoothstep(.42,.18,abs(wrapAngle(az-2.72)));
      if(el<farTop&&el>-.004){col=mix(vec3(.66,.86,.90),vec3(.78,.94,.96),smoothstep(farTop,0.0,el)*.7);}
      if(el<nearTop&&el>-.004){col=mix(vec3(.56,.76,.83),vec3(.66,.84,.88),smoothstep(nearTop,0.0,el)*.7);}
      // Below the horizon beyond the modelled sea: distant water fading into haze.
      if(el<-.004)col=mix(uHorizon*.92,vec3(.20,.47,.62),smoothstep(-.004,-.08,el));
      gl_FragColor=vec4(grade(col),1.0);
#endif
    }`;
  const DEPTH_FS = `precision mediump float; void main(){ gl_FragColor = vec4(1.0); }`;
  const DEPTH_FS_ALIVE = `precision mediump float; varying float vAlive; varying float vGhost; void main(){ if (vAlive < 0.02 || vGhost > 0.5) discard; gl_FragColor = vec4(1.0); }`;
  // interior scenes: plain coloured boxes, lit and shadowed; assumed parts are translucent
  /* aMat = (material kind, seed). The surface detail is procedural, in metres of the model, so a
     tatami mat shows its weave and border, wood its grain, concrete its stains, rock its moss. */
  const BOX_VS = COMMON_VS + `
    attribute vec3 aPos3; attribute vec3 aNor; attribute vec4 aCol; attribute vec2 aMat; attribute float aWind; uniform float uWindTime, uWindStrength;
    varying vec3 vNor; varying vec4 vCol; varying vec3 vLoc; varying vec2 vMat;
    void main(){ vNor = turn(aNor); vCol = aCol; vMat = aMat; vLoc = vec3((aPos3.x - uC) * uMpp, aPos3.y, (aPos3.z - uC) * uMpp); vec3 p=place(aPos3.xz,aPos3.y); float phase=uWindTime*1.3+aMat.y*6.28; float bend=aWind*aWind*uWindStrength; p.x+=sin(phase)*bend; p.z+=sin(phase*.73+1.2)*bend*.55; finish(p); }`;
  const BOX_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
#else
    precision mediump float;
#endif
    uniform float uFog, uShade, uChange, uAnime; uniform vec3 uBg, uSun, uHorizon;
    uniform float uRoomLight; uniform vec4 uLamp0,uLamp1,uLamp2,uLamp3;
    uniform vec4 uContact0,uContact1,uContact2,uContact3;
    varying vec3 vNor; varying vec4 vCol; varying vec4 vShadow; varying float vDepth; varying vec3 vLoc; varying vec2 vMat;
    ` + SHADOW_FN + `
    /* material kinds: 0 flat 1 tatami 2 wood 3 concrete 4 rock 5 tile 6 metal 7 paper 8 glass 9 cloth 10 foliage 11 painted wall 12 water 13 soil.
       Two noise lookups per fragment, whatever the kind: the scales are chosen first, the noise is read once. */
    float lampPool(vec4 lamp){vec3 d=vLoc-lamp.xyz;return lamp.w>0.0?1.0/(1.0+dot(d,d)/(lamp.w*lamp.w*.18)):0.0;}
    float sPool(vec4 lamp){vec3 d=vLoc-lamp.xyz;return lamp.w>0.0?1.3/(1.0+dot(d,d)/(lamp.w*lamp.w*.05)):0.0;}
    // Bounded analytic furniture contact shade, not a screen-space AO pass.
    float contactShade(vec4 contact){
      if(contact.w<=0.0)return 0.0;
      float gap=contact.y-vLoc.y,radial=length(vLoc.xz-contact.xz);
      return (1.0-smoothstep(contact.w*.2,contact.w*1.2,radial))*smoothstep(.02,.10,gap)*(1.0-smoothstep(.9,1.8,gap));
    }
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
      if (k < 3.5){
        float broad=noise(uv*.38),nearDetail=1.0-smoothstep(9.0,34.0,vDepth);
        vec2 panel=fract(uv/vec2(1.2,2.85));
        float joint=(1.0-smoothstep(.004,.016,min(min(panel.x,1.0-panel.x),min(panel.y,1.0-panel.y))))*nearDetail;
        return c*(.79+.28*broad)*(.88+.19*na)*(.94+.08*nb)*(1.0-joint*.13);
      }   /* concrete */
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
      if (k < 11.5) return c * (.82+.24*noise(uv*.42))*(.94+.12*na) * (1.0 - .13*(1.0-smoothstep(0.0,.65,mod(p.y,2.85))));   /* painted wall */
      if (k < 12.5) return c * (0.85 + 0.3 * na);   /* water */
      return c * (0.75 + 0.5 * na);   /* soil */
    }
    void main(){
      vec3 n = normalize(vNor);
      float d = max(dot(n, uSun), 0.0);
      float sh = shadowAt(vShadow, 0.003);
      vec3 base = material(vCol.rgb, vLoc, n, vMat.x, vMat.y);
      // Keep material detail in the walk view instead of washing it into a flat fill.
      /* hemisphere ambient: faces that look up are lit by the sky, faces that look down by the ground */
      float amb = 0.30 + 0.12 * n.y;
      vec3 col = base * (amb + 0.62 * d * mix(0.4, 1.0, sh));
      #ifdef SENGOKU
      {
        // Sengoku rooms: slightly darker, dustier and less saturated materials, a dim cool fill and warm lamp pools.
        float l=dot(base,vec3(.3,.59,.11)),indoor=uTone.z;
        vec3 alb=toLin(mix(vec3(l),base,.72)*.92);
        // Indoors the rooms stay dark: only a trace of the sun gets in and the fill is dim, so windows read as bright wells.
        float direct=clamp(dot(n,uSun),0.0,1.0)*sh*mix(1.0,.14,indoor);
        col=alb*(uKey*direct+mix(uAmbG,uAmbS,n.y*.5+.5)*mix(1.0,.32,indoor)+fireLight(vWorld,n));
        if(uRoomLight>.5){
          // Lamps light small warm pools that fall off quickly into dark corners.
          float pool=sPool(uLamp0)+sPool(uLamp1)+sPool(uLamp2)+sPool(uLamp3);
          col=alb*(uKey*direct+mix(uAmbG,uAmbS,n.y*.5+.5)*.22+toLin(vec3(1.0,.62,.30))*min(pool,1.4)+fireLight(vWorld,n));
        }
        if(n.y>.6)col*=1.0-.3*max(max(contactShade(uContact0),contactShade(uContact1)),max(contactShade(uContact2),contactShade(uContact3)));
        if(vMat.x>13.5)col=toLin(vCol.rgb)*2.2;
        if(vMat.x>7.5&&vMat.x<8.5&&indoor>.5){
          gl_FragColor=vec4(sGrade(uFogC*1.35+uSunC*.25),.9);
          return;
        }
        gl_FragColor=vec4(aerial(col,uHorizon,uSun,uFog,vDepth,uAnime),vCol.a);
        return;
      }
#else
      if(uAnime>0.5){
        // Retain hemisphere light in the stylised pass: ceilings and stair undersides stay shaded.
        col=toonLight(base,n,uSun,sh,1.0);
      }
      if(uRoomLight>.5){
        float pool=lampPool(uLamp0)+lampPool(uLamp1)+lampPool(uLamp2)+lampPool(uLamp3);
        // Keep a cool ambient floor while the lamps create local warm light pools.
        vec3 fill=mix(vec3(.38,.43,.51),vec3(.60,.65,.70),n.y*.5+.5);
        vec3 warm=vec3(.68,.50,.27)*min(pool*.70,1.0);
        col=base*(fill+warm);
      }
      if(uAnime>.5&&n.y>.6){
        float contact=max(max(contactShade(uContact0),contactShade(uContact1)),max(contactShade(uContact2),contactShade(uContact3)));
        col*=1.0-.22*contact;
      }
      if(vMat.x>13.5)col=vCol.rgb*1.25;
      col = aerial(col,uHorizon,uSun,uFog,vDepth,uAnime);
      gl_FragColor = vec4(col, vCol.a);
#endif
    }`;
  const BOX_DEPTH_FS = `precision mediump float; varying vec4 vCol; void main(){ if (vCol.a < 0.9) discard; gl_FragColor = vec4(1.0); }`;
  /* Walking view placeholder nature (see gunkanjima-walk-nature.js): illustrative set dressing only.
     Grass and flowers are a fixed pool of blades wrapped around the camera, so they stay put in the world
     while the pool follows the walker; height and cover are read from a ground texture in the vertex shader. */
  const GRASS_VS = COMMON_VS + `
    attribute vec4 aBlade; attribute float aSide;
    uniform sampler2D uGround; uniform vec3 uGroundInfo; uniform vec2 uGroundSize;
    uniform vec2 uCamUV; uniform float uPatch, uWindTime, uWindStrength; uniform vec4 uPool; uniform mediump float uFlowerPass; uniform vec3 uWalker;
    uniform mediump vec4 uEnv;
#ifdef SENGOKU
    const float GRASS_H=.8,GRASS_W=.5,GRASS_FERN=0.0;
#else
    const float GRASS_H=1.0,GRASS_W=1.0,GRASS_FERN=1.0;
#endif
    varying float vTip; varying vec3 vTint; varying vec2 vCorner; varying float vGust; varying vec2 vRoot; varying float vKindF;
    float lift(vec4 t){ return (t.r*65280.0+t.g*255.0)*.01; }
#ifdef SENGOKU
    float chash(vec2 p){ return fract(sin(dot(mod(p,251.0),vec2(12.9898,78.233)))*43758.5453); }
#endif
    void main(){
      vec2 base=uCamUV-vec2(uPatch*.5),uv=base+mod(aBlade.xy-base,uPatch);
#ifdef SENGOKU
      // Tussocks: blades gather round clump centres about 1.1 m apart (pampas 2.6 m) and fountain outwards, leaving bare
      // ground between the clumps; about one cell in six stays empty.
      float cs=(uFlowerPass>.5?2.6:1.1)/uMpp;
      vec2 ci=floor(uv/cs),co=uv/cs-ci-.5;
      float cl=max(abs(co.x),abs(co.y))*2.0,clump=chash(ci+11.9);
      vec2 cdir=co/max(length(co),1e-4),cdw=vec2(cdir.x*cos(uRot)-cdir.y*sin(uRot),cdir.x*sin(uRot)+cdir.y*cos(uRot));
      uv=(ci+.5+.4*(vec2(chash(ci),chash(ci+7.3))-.5))*cs+cdir*cl*mix(.5,.78,chash(ci+3.1))*(uFlowerPass>.5?.3:1.0)/uMpp;
#endif
      vec2 g=(uv-uGroundInfo.xy)/uGroundInfo.z,cell=floor(g),f=g-cell,texel=1.0/uGroundSize;
      vec4 a=texture2D(uGround,(cell+vec2(.5,.5))*texel),b=texture2D(uGround,(cell+vec2(1.5,.5))*texel);
      vec4 c=texture2D(uGround,(cell+vec2(.5,1.5))*texel),d=texture2D(uGround,(cell+vec2(1.5,1.5))*texel);
      float h=mix(mix(lift(a),lift(b),f.x),mix(lift(c),lift(d),f.x),f.y);
      vec2 cover=mix(mix(a.ba,b.ba,f.x),mix(c.ba,d.ba,f.x),f.y);
      float s=aBlade.z,r1=fract(s*13.37),r2=fract(s*71.93),r3=fract(s*197.3),r4=fract(s*411.9);
      float inside=step(0.0,g.x)*step(g.x,uGroundSize.x-1.01)*step(0.0,g.y)*step(g.y,uGroundSize.y-1.01);
      // uPool: fade distance, near hide distance (far pool), size, density.
      float dist=length((uv-uCamUV)*uMpp),fade=(1.0-smoothstep(uPool.x*.72,uPool.x,dist))*smoothstep(uPool.y,uPool.y*1.35,dist);
      // In the sengoku look the flower pool becomes pampas grass over the grassy cover rather than flower patches.
#ifdef SENGOKU
      float amount=uFlowerPass>.5?cover.x*.45:cover.x*.75;
#else
      float amount=uFlowerPass>.5?cover.y:cover.x;
#endif
      float alive=step(r1,amount*1.12*uPool.w)*fade*inside;
#ifdef SENGOKU
      alive*=step(.08,chash(ci+5.7));
#endif
      vec3 root=place(uv,h-.03);
      float tip=aBlade.w;
      vec2 wind=vec2(.83,.55);
      float wave=sin(dot(root.xz,wind)*.22-uWindTime*1.8)*.5+.5;
      float sway=uWindStrength*(4.0+8.0*wave)*(.8+.2*sin(uWindTime*3.1+s*50.0));
      vec2 lean=vec2(cos(r4*6.2832),sin(r4*6.2832))*.22+wind*sway;
      // Player touch response: blades part around the walker.
      vec2 away=root.xz-uWalker.xz;float near=length(away);
      lean+=away/max(near,.001)*(1.0-smoothstep(.25,1.35,near))*1.2;
      vGust=wave;vRoot=root.xz;vCorner=vec2(0.0);vTint=vec3(1.0);
      vec3 p;
      #ifdef SENGOKU
      if(uFlowerPass>.5){
        // Pampas (susuki): a tall stem bowing with the wind and a long feathery plume hanging from its tip, facing the walker.
        alive*=smoothstep(1.3,2.6,dist);
        float height=mix(.7,1.3,r2)*alive,plume=mix(.30,.46,r4)*alive;
        vec2 bow=lean*.9+cdw*cl*.5;
        vec3 top=root+vec3(bow.x*height*.45,height*(1.0-.12*dot(bow,bow)),bow.y*height*.45);
        if(tip>1.5){
          vKindF=3.0;vTip=tip-2.0;
          vec3 sd=normalize(cross(top-root+vec3(0.0,.001,0.0),uWalker-root)+vec3(.0001,0.0,0.0));
          p=mix(root,top,tip-2.0)+sd*aSide*(.004+.008*(3.0-tip));
        } else {
          vec3 hang=normalize(vec3(bow.x*1.4,.35,bow.y*1.4)+vec3(.0001,0.0,0.0));
          vec3 side=normalize(cross(hang,normalize(uWalker-top)+vec3(0.0,.0001,0.0)));
          vKindF=2.0;vTip=tip;vCorner=vec2(aSide,tip*2.0-1.0);
          p=top+hang*plume*tip+side*aSide*mix(.055,.02,tip)*step(.001,alive);
        }
      } else
#else
      if(uFlowerPass>.5){
        // Cosmos-like heads on thin stems, facing up and tilted towards the walker.
        float height=mix(.24,.5,r2)*alive,size=mix(.06,.1,r4)*alive;
        vec3 head=root+vec3(lean.x*height*.35,height,lean.y*height*.35);
        if(tip>1.5){
          vKindF=3.0;vTip=tip-2.0;
          p=mix(root,head,tip-2.0)+vec3(aSide*.009*(3.0-tip),0.0,0.0);
        } else {
          vec3 toEye=normalize(vec3(uWalker.x-head.x,0.0,uWalker.z-head.z)+vec3(.0001,0.0,0.0));
          vec3 nrm=normalize(vec3(0.0,.75,0.0)+toEye*.66),right=normalize(cross(nrm,toEye)),fwd=cross(right,nrm);
          vKindF=2.0;vTip=tip;vCorner=vec2(aSide,tip*2.0-1.0);
          p=head+(right*aSide+fwd*(tip*2.0-1.0))*size;
          vTint=r3<.45?vec3(1.0,.97,.93):r3<.72?vec3(1.0,.84,.90):r3<.9?vec3(.78,.93,.97):vec3(1.0,.9,.45);
        }
      } else
#endif
      {
        // Clumped blades with random scale (x0.64-1.9); rare dark fern accents where cover thins out.
        float fern=step(.86,fract(s*531.1))*(1.0-smoothstep(.35,.8,amount))*GRASS_FERN;
        float height=mix(.2,.62,r2*r2)*mix(.64,1.9,fract(s*887.3)*fract(s*887.3))*mix(1.0,.7,fern)*uPool.z*alive*GRASS_H;
        float width=mix(.028,.05,r4)*mix(1.0,3.4,fern)*(1.0-tip)*uPool.z*step(.001,alive)*GRASS_W;
        float ang=r3*6.2832;vec3 across=vec3(cos(ang),0.0,sin(ang));
#ifdef SENGOKU
        height*=mix(.7,1.25,clump)*(1.0-.25*cl*cl);
        lean+=cdw*cl*.45;
        vTint=mix(vec3(1.0),vec3(.80,.84,.76),step(.72,fract(clump*7.7)))*mix(.82,1.12,fract(clump*3.1));
#endif
        p=root+across*aSide*width+vec3(lean.x*tip*tip*height,height*tip*(1.0-.16*dot(lean,lean)),lean.y*tip*tip*height);
        vKindF=fern;vTip=tip;
      }
      finish(p);
    }`;
  const GRASS_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
#else
    precision mediump float;
#endif
    uniform float uFog, uAnime; uniform mediump float uFlowerPass; uniform vec3 uBg, uSun, uHorizon;
    varying float vTip; varying vec3 vTint; varying vec2 vCorner; varying float vGust; varying vec2 vRoot; varying float vKindF;
    varying vec4 vShadow; varying float vDepth;
    ` + SHADOW_FN + `
    void main(){
      float sh=shadowAt(vShadow,.004);
      vec3 col,up=vec3(0.0,1.0,0.0);
      #ifdef SENGOKU
      {
        // Sengoku grass: dry straw blades and pampas with feathery silver plumes that glow when the low sun is behind them.
        vec3 alb;float gloss=.3;
        if(vKindF>1.5&&vKindF<2.5){
          float along=vCorner.y*.5+.5,fan=.25+.75*along,strands=0.0;
          for(int i=0;i<5;i++){float fi=float(i)-2.0,cx=fi*.34*fan+.12*sin(along*6.0+fi*1.7+vRoot.x*3.0);strands=max(strands,1.0-smoothstep(.04,.15,abs(vCorner.x-cx)));}
          if(strands*smoothstep(.25,.6,noise(vec2(along*40.0,vCorner.x*6.0+vRoot.y*5.0))+.3)*(1.0-smoothstep(.85,1.0,along)*.5)<.5)discard;
          alb=mix(vec3(.50,.46,.40),vec3(.76,.73,.66),along)*(.85+.3*noise(vec2(along*22.0,vCorner.x*5.0)));
          alb=mix(alb,vec3(.92,.93,.95),uEnv.y*.5);gloss=1.0;
        } else if(vKindF>2.5){
          alb=mix(uRamp1,uRamp0,.35+.5*vTip)*.85;
        } else {
          alb=mix(uRamp1*.75,uRamp0*1.05,smoothstep(0.0,1.0,vTip))*(.85+.3*hash(floor(vRoot*7.0)))*vTint*mix(.78,1.0,smoothstep(0.0,.5,vTip));
          alb=mix(alb,uRamp1*.6,step(.5,vKindF));
          alb=mix(alb,vec3(.85,.86,.88),uEnv.y*(1.0-vTip)*.6);
        }
        vec3 lit=sLight(toLin(alb),up,uSun,sh,.5+.5*vTip);
        lit+=uKey*toLin(alb)*pow(max(dot(normalize(vWorld-uEye),uSun),0.0),4.0)*vTip*sh*.7*gloss;
        gl_FragColor=vec4(aerial(lit,uHorizon,uSun,uFog,vDepth,uAnime),1.0);
        return;
      }
#else
      if(vKindF>1.5&&vKindF<2.5){
        float r=length(vCorner),petal=.6+.4*abs(cos(atan(vCorner.y,vCorner.x)*4.0));
        if(r>petal)discard;
        col=mix(vec3(1.0,.96,.64),vTint,smoothstep(.15,.25,r));
        col=mix(col,vTint*.6,smoothstep(petal-.16,petal-.05,r)*.55);
        col=toonLight(col,up,uSun,sh,1.0);
      } else if(vKindF>2.5){
        col=toonLight(meadowColor(vRoot)*.78,up,uSun,sh,1.0);
      } else {
        // Blades take the ground colour at their root and share its lighting (up normal): the video's fix
        // for grass that looked darker than the ground. Root-to-tip gradient; travelling gust highlights.
        vec3 tint=meadowColor(vRoot);
        tint=mix(tint,mix(rampAt(1.0),rampAt(.75),vTip)*vec3(.7,1.05,.5),step(.5,vKindF));
        col=mix(tint*.85,mix(tint*1.15,rampAt(0.0)*1.2,.22),smoothstep(0.0,1.0,vTip));
        col=toonLight(col,up,uSun,sh,1.0)+vec3(.14,.15,.05)*vGust*vTip*vTip*sh;
        col=mix(col,col*shadeTint(),1.0-sh);
      }
      gl_FragColor=vec4(aerial(col,uHorizon,uSun,uFog,vDepth,uAnime),1.0);
#endif
    }`;
  /* Ambient life around the walker (placeholder): drifting petals, twinkling sparkles and butterflies in a
     wrapping box, plus a V formation of five seabirds crossing west to east (adapted from the airship
     formation in the reference video). Drawn as point sprites. */
  const PART_VS = COMMON_VS + `
    attribute vec4 aPart;
    uniform vec2 uCamUV; uniform float uPatch, uGroundY, uPointScale, uWindTime, uBirds; uniform vec3 uWalker;
    uniform mediump vec4 uEnv;
    varying float vType; varying float vPhase; varying vec3 vColor; varying float vFade;
    void main(){
      float s=aPart.w;
      vec3 p;float size;
      #ifdef SENGOKU
      if(uBirds<.5){
        // Sengoku: tumbling leaves (types 0 and 2) and drifting ash (type 1) instead of petals, sparkles and butterflies.
        vType=s<.55?0.0:s<.8?1.0:2.0;
        float t=uWindTime,r1=fract(s*97.1),r2=fract(s*31.7);
        vec2 drift=vec2(.83,.55)*t*(vType>.5&&vType<1.5?.35:1.1)/uMpp;
        vec2 base=uCamUV-vec2(uPatch*.5),uv=base+mod(aPart.xy+drift-base,uPatch);
        float fall=vType>.5&&vType<1.5?.25+.15*r1:.5+.35*r1;
        float h=7.0-mod(t*fall+aPart.z*7.0,7.0);
        p=place(uv,uGroundY+h);
        p.xz+=vec2(sin(t*1.1+s*40.0),cos(t*.9+s*23.0))*(vType>.5&&vType<1.5?.6:.45);
        vPhase=t*(2.0+r2*2.0)+s*20.0;
        vColor=vec3(r2,r1,0.0);
        float d=length(p-uWalker);
        vFade=(1.0-smoothstep(uPatch*uMpp*.32,uPatch*uMpp*.48,d))*smoothstep(.5,1.2,d)*smoothstep(0.0,.6,h);
        size=vType>.5&&vType<1.5?.035:.10;
        finish(p);
        gl_PointSize=clamp(size*uPointScale/max(gl_Position.w,.1),1.0,64.0);
        return;
      }
#endif
      if(uBirds>.5){
        // aPart: rank, side, phase. 20 s crossing every 34 s; each rank 14 m back and 16 m out.
        float cycle=mod(uWindTime,34.0),prog=cycle/20.0;
        p=vec3(mix(-430.0,430.0,prog)-aPart.x*14.0,58.0+2.6*sin(uWindTime*2.64+aPart.z*6.28),-30.0+aPart.y*aPart.x*16.0);
        vType=3.0;vPhase=uWindTime*6.5+aPart.z*6.28;vColor=vec3(.24,.23,.23);vFade=step(prog,1.0);size=1.7;
      } else {
        vType=s<.62?0.0:s<.9?1.0:2.0;
        float t=uWindTime,r1=fract(s*97.1),r2=fract(s*31.7);
        vec2 drift=vec2(.83,.55)*t*(vType<.5?.9:vType<1.5?.15:.25)/uMpp;
        if(vType>1.5)drift+=vec2(sin(t*.4+s*30.0),cos(t*.33+s*17.0))*2.5/uMpp;
        vec2 base=uCamUV-vec2(uPatch*.5),uv=base+mod(aPart.xy+drift-base,uPatch);
        float h=vType<.5?6.0-mod(t*(.45+.3*r1)+aPart.z*6.0,6.0):vType<1.5?.4+aPart.z*2.6+.3*sin(t*.7+s*20.0):.45+aPart.z*1.1+.35*sin(t*1.7+s*9.0);
        p=place(uv,uGroundY+h);
        if(vType<.5)p.xz+=vec2(sin(t*1.3+s*40.0),cos(t*1.1+s*23.0))*.35;
        vPhase=vType<.5?t*(1.5+r2)+s*20.0:vType<1.5?pow(max(sin(t*2.2+s*50.0),0.0),4.0):t*14.0+s*30.0;
        vColor=vType<.5?mix(vec3(1.0,.80,.87),vec3(1.0,.96,.96),step(.5,r2)):vType<1.5?vec3(1.0,.97,.84):(r2<.35?vec3(1.0,.97,.9):r2<.6?vec3(1.0,.93,.5):r2<.8?vec3(.77,.65,.87):vec3(.72,.86,1.0));
        float d=length(p-uWalker);
        vFade=(1.0-smoothstep(uPatch*uMpp*.32,uPatch*uMpp*.48,d))*smoothstep(.5,1.2,d);
        size=vType<.5?.075:vType<1.5?.06:.16;
      }
      finish(p);
      gl_PointSize=clamp(size*uPointScale/max(gl_Position.w,.1),1.0,64.0);
    }`;
  const PART_FS = `
    precision mediump float;
    uniform float uFog, uAnime, uAmount; uniform vec3 uBg, uSun, uHorizon;
    varying float vType; varying float vPhase; varying vec3 vColor; varying float vFade;
    varying vec4 vShadow; varying float vDepth;
    ` + SHADOW_FN + `
    void main(){
      vec2 c=gl_PointCoord*2.0-1.0;float a;
      #ifdef SENGOKU
      {
        vec3 alb;
        if(vType>2.5){
          // Crows instead of seabirds.
          float wing=c.y-.55*abs(c.x)+.25*sin(vPhase)*abs(c.x);
          a=(1.0-smoothstep(.07,.15,abs(wing+.1*(1.0-abs(c.x)))))*step(abs(c.x),.95);alb=vec3(.035,.035,.04);
        } else if(vType>.5&&vType<1.5){
          a=1.0-smoothstep(.2,1.0,length(c));alb=mix(vec3(.55,.54,.52),vec3(.85,.86,.88),max(vColor.x,uEnv.y));
        } else {
          // A tumbling leaf: a pointed ellipse whose apparent width flips as it turns.
          float turn=abs(cos(vPhase*.7))*.75+.25;
          vec2 r=vec2(c.x*cos(vPhase)-c.y*sin(vPhase),c.x*sin(vPhase)+c.y*cos(vPhase));
          a=1.0-smoothstep(.75,.95,length(r*vec2(1.0/turn,1.7))+.25*abs(r.y));
          alb=vType>1.5?mix(vec3(.42,.30,.18),vec3(.30,.20,.12),vColor.y):mix(uRamp2,mix(uRamp3,uRamp4,vColor.y),vColor.x);
        }
        a*=vFade*uAmount;
        if(a<.04)discard;
        gl_FragColor=vec4(aerial(toLin(alb)*(uAmbS+uKey*.45),uHorizon,uSun,uFog,vDepth,uAnime),clamp(a,0.0,1.0));
        return;
      }
#else
      if(vType<.5){vec2 r=vec2(c.x*cos(vPhase)-c.y*sin(vPhase),c.x*sin(vPhase)+c.y*cos(vPhase));a=1.0-smoothstep(.7,.95,length(r*vec2(1.0,1.9)));}
      else if(vType<1.5)a=clamp(max(1.0-abs(c.x)*6.0-abs(c.y)*1.2,1.0-abs(c.y)*6.0-abs(c.x)*1.2),0.0,1.0)*vPhase;
      else if(vType<2.5){float flap=max(abs(sin(vPhase)),.18);vec2 q=vec2(abs(c.x)/flap,c.y);a=max(1.0-smoothstep(.75,.95,length((q-vec2(.5,-.12))*vec2(1.0,1.25))),1.0-smoothstep(.55,.75,length((q-vec2(.45,.45))*vec2(1.3,1.6))));}
      else{float wing=c.y-.55*abs(c.x)+.25*sin(vPhase)*abs(c.x);a=(1.0-smoothstep(.07,.15,abs(wing+.1*(1.0-abs(c.x)))))*step(abs(c.x),.95);}
      a*=vFade*uAmount;
      if(a<.04)discard;
      gl_FragColor=vec4(aerial(vColor,uHorizon,uSun,uFog,vDepth,uAnime),clamp(a,0.0,1.0));
#endif
    }`;
  /* Walking-view post-process: soft bloom (bright pass, separable blur at quarter size) and an edge-aware
     anti-alias in the composite, because rendering to a texture loses the canvas multisampling. */
  const POST_VS = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const BRIGHT_FS = `precision mediump float; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThreshold; varying vec2 vUv;
    void main(){
      vec3 c=(texture2D(uTex,vUv+uTexel*vec2(-1.0,-1.0)).rgb+texture2D(uTex,vUv+uTexel*vec2(1.0,-1.0)).rgb+texture2D(uTex,vUv+uTexel*vec2(-1.0,1.0)).rgb+texture2D(uTex,vUv+uTexel).rgb)*.25;
      gl_FragColor=vec4(c*smoothstep(uThreshold,uThreshold+.12,dot(c,vec3(.299,.587,.114))),1.0);
    }`;
  const BLUR_FS = `precision mediump float; uniform sampler2D uTex; uniform vec2 uDir; varying vec2 vUv;
    void main(){
      vec3 c=texture2D(uTex,vUv).rgb*.227+(texture2D(uTex,vUv+uDir*1.385).rgb+texture2D(uTex,vUv-uDir*1.385).rgb)*.316+(texture2D(uTex,vUv+uDir*3.231).rgb+texture2D(uTex,vUv-uDir*3.231).rgb)*.07;
      gl_FragColor=vec4(c,1.0);
    }`;
  const COMPOSITE_FS = `precision mediump float; uniform sampler2D uTex, uBloom; uniform vec2 uTexel; uniform float uBloomAmount; varying vec2 vUv;
    vec3 at(vec2 o){ return texture2D(uTex,vUv+o*uTexel).rgb; }
    void main(){
      // Blend along the local edge direction where luminance changes sharply; flat areas pass through.
      vec3 L=vec3(.299,.587,.114),m=at(vec2(0.0));
      float nw=dot(at(vec2(-1.0,-1.0)),L),ne=dot(at(vec2(1.0,-1.0)),L),sw=dot(at(vec2(-1.0,1.0)),L),se=dot(at(vec2(1.0,1.0)),L),lm=dot(m,L);
      float lo=min(lm,min(min(nw,ne),min(sw,se))),hi=max(lm,max(max(nw,ne),max(sw,se)));
      vec2 dir=vec2(-((nw+ne)-(sw+se)),(nw+sw)-(ne+se));
      dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+max((nw+ne+sw+se)*.03,.008)),-6.0,6.0);
      vec3 a=.5*(at(dir*(-1.0/6.0))+at(dir*(1.0/6.0))),b=.5*a+.25*(at(dir*-.5)+at(dir*.5));
      float lb=dot(b,L);
      vec3 c=hi-lo<.05?m:(lb<lo||lb>hi?a:b);
      gl_FragColor=vec4(c+texture2D(uBloom,vUv).rgb*uBloomAmount,1.0);
    }`;
  const PLANT_VS = COMMON_VS + `
    attribute vec3 aPos3; attribute vec3 aNor; attribute vec3 aCol; attribute vec3 aInfo;
    uniform float uWindTime, uWindStrength;
    varying vec3 vNor; varying vec3 vCol; varying vec3 vLoc; varying vec2 vKind;
    void main(){
      vec3 p=place(aPos3.xz,aPos3.y);
      float phase=uWindTime*1.15+aInfo.z*6.2832+p.x*.04,bend=aInfo.x*aInfo.x*uWindStrength*(aInfo.y>2.5&&aInfo.y<7.5?0.0:4.0);
      p.x+=sin(phase)*bend;p.z+=sin(phase*.77+1.3)*bend*.6;
      vNor=turn(aNor);vCol=aCol;vKind=aInfo.yz;vLoc=p;
      finish(p);
    }`;
  const PLANT_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
#else
    precision mediump float;
#endif
    uniform float uFog, uAnime, uTime; uniform vec3 uBg, uSun, uHorizon;
    varying vec3 vNor; varying vec3 vCol; varying vec3 vLoc; varying vec2 vKind;
    varying vec4 vShadow; varying float vDepth;
    ` + SHADOW_FN + `
    void main(){
      vec3 n=normalize(vNor),base=vCol;float kind=vKind.x;
      // Bushes and canopies can be walked into; leaves right in front of the eye are not drawn, so the view never
      // fills with one flat green.
      if(((kind>.5&&kind<2.5)||kind>7.5)&&length(vWorld-uEye)<.6)discard;
      float sh=shadowAt(vShadow,kind>5.5&&kind<6.5?.0015:.004);
      #ifdef SENGOKU
      {
        /* Sengoku trees and props: maples in the foliage tints (a few evergreen oaks), dark pines, black-green shrubs,
           lichened bark, grey stone with moss, weathered timber and straw rope, a still dark pond with floating leaves. */
        vec3 view=normalize(vWorld-uEye);
        if(kind>5.5&&kind<6.5){
          vec3 rdir=reflect(view,vec3(0.0,1.0,0.0));
          float fres=.03+.97*pow(1.0-max(-view.y,0.0),5.0);
          vec3 w=mix(toLin(vec3(.12,.16,.15))*(uAmbS+uKey*.1),(mix(uFogC,uAmbS*.7,smoothstep(0.0,.5,rdir.y))+uSunC*pow(max(dot(rdir,uSun),0.0),60.0)*4.0)*.5,fres);
          vec2 lc=floor(vLoc.xz*4.0);
          float leaf=step(.84,hash(lc))*step(length(fract(vLoc.xz*4.0)-.5),.28);
          w=mix(w,sLight(toLin(mix(uRamp2,uRamp3,hash(lc+2.0))),vec3(0.0,1.0,0.0),uSun,sh,1.0),leaf);
          gl_FragColor=vec4(aerial(w*mix(.85,1.0,sh),uHorizon,uSun,uFog,vDepth,uAnime),1.0);
          return;
        }
        vec3 alb=vCol;float ao=1.0,trans=0.0;vec3 nn=n;
        float leafy=((kind>.5&&kind<2.5)||(kind>7.5&&kind<8.5))?1.0:0.0;
        vec4 lf=vec4(1.0,.5,0.0,0.0);float leafGap=0.0,leafNear=0.0;
        if(kind>11.5){
          // Glowing embers and lit lantern boxes flicker; they are emissive, not lit.
          float flick=.8+.2*noise(vec2(uTime*6.0,vKind.y*40.0))+.15*noise(vLoc.xz*6.0+uTime*2.0);
          gl_FragColor=vec4(aerial(toLin(vCol)*mix(1.2,1.6,step(dot(vCol,vec3(.33)),.5))*flick,uHorizon,uSun,uFog,vDepth,uAnime),1.0);
          return;
        }
        if(kind>10.5){
          // Cloth: nobori banners (colour holds across, along, palette + tear) and jizo bibs; two-sided and translucent.
          float across=vCol.r,along=vCol.g,pal=floor(vCol.b),torn=fract(vCol.b)/.9;
          if(pal<3.5){
            if(along>1.0-torn*.35*noise(vec2(across*9.0,vKind.y*50.0))||(torn>.6&&noise(vLoc.xz*7.0+vLoc.y*5.0)<.13))discard;
          }
          vec3 cloth=pal<.5?vec3(.66,.63,.56):pal<1.5?vec3(.50,.17,.16):pal<2.5?vec3(.17,.21,.31):vec3(.55,.14,.12);
          vec3 ink=pal<.5?vec3(.08,.07,.07):vec3(.80,.77,.70);
          vec2 m=vec2((across-.5)*.62,along*2.5-.55);
          float crest=pal<3.5?max(1.0-smoothstep(.02,.035,abs(length(m)-.2)),step(length(m),.17)*step(.72,fract(m.y*8.8+.36))):0.0;
          float strokes=pal<3.5?step(.5,along)*step(along,.93)*step(abs(across-.5),.12)*step(.42,noise(vec2(across*6.0,along*14.0+vKind.y*30.0))):0.0;
          cloth=mix(cloth,ink,max(crest,strokes)*.85);
          cloth*=.82+.3*noise(vec2(across*3.0,along*9.0));
          vec3 nn2=dot(n,view)>0.0?-n:n;
          vec3 lit=sLight(toLin(cloth),nn2,uSun,sh,.9)+uKey*toLin(cloth)*pow(max(dot(view,uSun),0.0),2.0)*sh*.5;
          gl_FragColor=vec4(aerial(lit,uHorizon,uSun,uFog,vDepth,uAnime),1.0);
          return;
        }
        if(leafy>.5){
          // A ragged, leafy outline: fragments near the silhouette are cut away in noisy clusters.
          float rimF=1.0-abs(dot(n,view));
          float holes=noise(vLoc.xz*5.0+vLoc.y*4.3)*.6+noise(vLoc.xz*11.0-vLoc.y*9.0)*.4;
          if(holes<rimF*1.55-.42||holes<.16)discard;
          // Individual leaves (needle tufts on pines) near the walker: jittered cells in the plane facing the normal, each
          // with its own tint, dark gaps between them, and the gaps cut out along the silhouette.
          leafNear=1.0-smoothstep(8.0,30.0,vDepth);
          if(leafNear>.001){
            vec3 an=abs(n),lp=vLoc*(kind>7.5?11.0:kind>1.5?14.0:8.5);
            lf=cellNear(an.y>max(an.x,an.z)?lp.xz:an.x>an.z?lp.zy:lp.xy);
            leafGap=smoothstep(.36,.5,lf.x+.1*lf.y)*leafNear;
            if(leafGap>.5&&rimF>.3)discard;
          }
          nn=normalize(nn+vec3(fract(lf.y*7.1)-.5,fract(lf.y*3.3)*.4,fract(lf.y*13.7)-.5)*(kind>1.5&&kind<2.5?1.0:1.6)*leafNear);
          // Leafy clumps: the normal is broken by noise so light and shade fall in clusters, not on a smooth ball.
          vec3 j=vec3(noise(vLoc.xz*1.9+vLoc.y*1.3),noise(vLoc.zx*1.7-vLoc.y*1.6+4.0),noise(vLoc.xz*2.3+vLoc.y*.7+9.0))-.5;
          nn=normalize(n+j*1.3);
          ao=mix(1.0,.5,vCol.r)*(.75+.5*noise(vLoc.xz*3.1+vLoc.y*2.9));
        }
        if(kind>.5&&kind<1.5){
          vec3 c=mix(mix(uRamp2,uRamp3,smoothstep(.15,.65,vCol.r+(vCol.g-.5)*.3)),uRamp4,smoothstep(.6,1.0,vCol.r));
          alb=mix(c,mix(vec3(.19,.25,.13),vec3(.07,.11,.07),vCol.r),step(vCol.g,.22))*(.8+.35*noise(vLoc.xz*2.7+vLoc.y*2.3));
          trans=.8;
        } else if(kind>1.5&&kind<2.5){
          alb=mix(mix(vec3(.17,.21,.11),vec3(.07,.10,.06),vCol.r),uRamp3*.75,step(.78,vCol.g)*.7)*(.8+.35*noise(vLoc.xz*2.1+vLoc.y*2.0));
          trans=.35;
        } else if(kind>7.5&&kind<8.5){
          alb=mix(vec3(.21,.26,.19),vec3(.08,.11,.09),vCol.r)*(.85+.3*noise(vLoc.xz*3.0+vLoc.y*3.0));
          trans=.2;
        } else if(kind<.5){
          alb=vec3(.20,.17,.15)*(.75+.4*noise(vec2((vLoc.x+vLoc.z)*5.0,vLoc.y*1.1)));
          alb=mix(alb,vec3(.38,.40,.33),step(.72,noise(vec2((vLoc.x-vLoc.z)*3.0,vLoc.y*2.0)))*.5);
        } else if(kind<3.5){
          alb=vec3(.34,.33,.31)*(.8+.3*noise(vLoc.xz*2.2+vLoc.y*2.0));
          vec2 cr=worley(vLoc.xz*1.6+vLoc.y*1.9);
          alb*=1.0-.4*(1.0-smoothstep(.02,.07,cr.y-cr.x))*step(.45,noise(vLoc.xz*.9+vLoc.y));
          alb=mix(alb,vec3(.13,.17,.08),smoothstep(.55,.9,n.y)*smoothstep(.45,.7,noise(vLoc.xz*1.2))*.8);
        } else if(kind>9.5){
          // Iron: nearly black with rust.
          alb=mix(vCol,vec3(.26,.14,.08),smoothstep(.45,.8,noise(vLoc.xz*7.0+vLoc.y*6.0))*.6);
        } else if(kind>8.5){
          // Worked stone: grey granite with lichen speckle and moss on what faces up.
          alb=vCol*(.82+.26*noise(vLoc.xz*6.0+vLoc.y*5.0))*(1.0-.15*step(.8,noise(vLoc.xz*23.0+vLoc.y*19.0)));
          alb=mix(alb,vec3(.13,.17,.08),smoothstep(.55,.9,n.y)*smoothstep(.4,.75,noise(vLoc.xz*3.0+vLoc.y))*.7);
        } else if(kind<4.5){
          alb=mix(uRamp2,uRamp3,noise(vLoc.xz*5.0+vLoc.y*5.0));trans=.6;
        } else if(kind<5.5){
          float rope=step(.7,dot(vCol,vec3(.33)));
          alb=mix(mix(vec3(.19,.16,.13),vec3(.28,.24,.19),noise(vec2((vLoc.x-vLoc.z)*9.0,vLoc.y*2.0))),vec3(.47,.41,.29),rope);
        } else {
          float m=smoothstep(.35,.62,noise(vLoc.xz*1.1+vLoc.y*.9)+.35*n.y);
          alb=mix(vec3(.30,.29,.26)*(.8+.3*noise(vLoc.xz*3.0+vLoc.y*3.0)),mix(vec3(.11,.14,.07),vec3(.22,.25,.12),noise(vLoc.xz*4.0+vLoc.y*4.0)),m*.85);
          alb=mix(alb,vec3(.30,.17,.10),step(vCol.b,.3)*(1.0-m)*.6);
        }
        if(leafy>.5)alb*=(1.0-(kind>1.5&&kind<2.5?.32:.45)*leafGap)*mix(1.0,.8+.4*fract(lf.y*9.1),leafNear);
        alb=mix(alb,vec3(.74,.76,.80),uEnv.y*smoothstep(.45,.85,nn.y)*(leafy>.5?.55:.8));
        vec3 lit=sLight(toLin(alb),nn,uSun,sh,ao);
        lit+=uKey*toLin(alb)*pow(max(dot(view,uSun),0.0),3.0)*trans*sh*.6;
        gl_FragColor=vec4(aerial(lit,uHorizon,uSun,uFog,vDepth,uAnime),1.0);
        return;
      }
#else
      if(kind>5.5&&kind<6.5){
        // Pond: mint gradient, soft drifting mottling, a pale band and a wobbling white foam line at the rim, and
        // twinkling sparkles. vKind.y runs from 0 at the centre to 96 at the rim.
        vec3 water=base*(.95+.1*noise(vLoc.xz*.7+vec2(uTime*.08,-uTime*.05)));
        float rr=vKind.y/96.0+(noise(vLoc.xz*1.8+vec2(uTime*.3,0.0))-.5)*.035;
        water=mix(water,vec3(.80,.96,.93),smoothstep(.7,.9,rr)*.4);
        water=mix(water,vec3(.97,1.0,.98),max(smoothstep(.935,.96,rr),(smoothstep(.845,.86,rr)-smoothstep(.87,.885,rr))*.6));
        water+=vec3(.95,1.0,.97)*twinkle(vLoc.xz,.45,.16,uTime)*.8*mix(.4,1.0,sh);
        gl_FragColor=vec4(aerial(water*mix(.86,1.0,sh),uHorizon,uSun,uFog,vDepth,uAnime),1.0);
        return;
      }
      if((kind>.5&&kind<2.5)||kind>7.5){
        // Foliage follows the shared palette (season presets) in a calmer, slightly cooler band than the
        // meadow, so no single tree reads as an out-of-palette lime outlier. Conifer tiers step from the darkest
        // tint at the bottom to yellow-green at the tip.
        vec3 c=rampAt(clamp(mix(.1,.95,vCol.r)+(vCol.g-.5)*.18+(kind>7.5?.12:0.0),0.0,1.0));
        c=mix(vec3(dot(c,vec3(.3,.59,.11))),c,.8)*vec3(.93,.98,1.03);
        base=kind>7.5?c*vec3(.94,.97,.9):c;
      }
      if(kind<.5)base*=.8+.32*noise(vec2((vLoc.x+vLoc.z)*5.0,vLoc.y*1.1));
      else if(kind>2.5&&kind<3.5){base*=.93+.12*noise(vLoc.xz*2.2+vLoc.y*2.0);vec2 cr=worley(vLoc.xz*1.6+vLoc.y*1.9);base*=1.0-.32*(1.0-smoothstep(.02,.07,cr.y-cr.x))*step(.45,noise(vLoc.xz*.9+vLoc.y));base*=1.0+.14*smoothstep(.55,.9,n.y);base=mix(base,vec3(.47,.60,.25),smoothstep(.62,.95,n.y)*smoothstep(.5,.72,noise(vLoc.xz*1.2))*.7);}
      else if(kind>4.5&&kind<5.5)base*=.9+.18*noise(vec2((vLoc.x-vLoc.z)*9.0,vLoc.y*2.0));
      else if(kind>6.5&&kind<7.5){
        // Overgrown ruin: khaki concrete/iron patched with olive moss on top faces and in crevices.
        float m=smoothstep(.35,.62,noise(vLoc.xz*1.1+vLoc.y*.9)+.35*n.y);
        base*=.9+.18*noise(vLoc.xz*3.0+vLoc.y*3.0);
        base=mix(base,mix(vec3(.32,.33,.13),vec3(.51,.60,.25),noise(vLoc.xz*4.0+vLoc.y*4.0)),m*.85);
      }
      // Two-tone cel shading with material-specific tinted shadows (never black) and a soft rim. On foliage
      // the terminator is broken by noise so light and shade meet in leafy clumps.
      // Conifer tiers are flat-shaded facets, so they take no clump noise: each facet is simply lit or in shade.
      float clump=kind>.5&&kind<2.5?noise(vLoc.xz*1.5+vLoc.y*1.35+vKind.y*9.0)-.5:0.0;
      float lit=smoothstep(-.05,.07,dot(n,uSun)+clump*.55)*mix(1.0,sh,.85);
      vec3 tint=kind<.5?vec3(.55,.50,.52):kind>7.5?vec3(.56,.68,.74):kind<2.5?vec3(.50,.62,.72):kind<3.5?vec3(.62,.72,.68):kind<4.5?vec3(.8):kind<5.5?vec3(.56,.46,.36):vec3(.60,.66,.64);
      vec3 col=mix(base*tint,base*(kind>7.5?vec3(1.04,1.05,.96):vec3(1.08,1.04,.92)),lit);
      if(kind>.5&&kind<2.5)col+=base*.14*smoothstep(.5,.85,n.y+clump*.3)*lit;
      float rim=pow(1.0-max(dot(n,normalize(uEye-vWorld)),0.0),3.0);
      col+=vec3(1.0,.95,.75)*rim*((kind>.5&&kind<2.5)||kind>7.5?.16:.07)*(.35+.65*lit);
      if(kind>3.5&&kind<4.5)col=base*mix(.82,1.08,lit);
      gl_FragColor=vec4(aerial(col,uHorizon,uSun,uFog,vDepth,uAnime),1.0);
#endif
    }`;

  /* Sengoku fires: flames, embers and smoke as point sprites anchored to each bonfire or brazier. aFire: world x, ground y,
     z and kind * 1000 + seed; aSlot: phase and type (0 flame, 1 ember, 2 smoke). Flames and embers are added to the
     graded image and fade into the fog; smoke is blended over it. */
  const FIRE_VS = COMMON_VS + `
    attribute vec4 aFire; attribute vec2 aSlot;
    uniform float uWindTime, uPointScale;
    varying float vT; varying float vType; varying float vSeed;
    void main(){
      float kind=floor(aFire.w/1000.0),seed=mod(aFire.w,1000.0)/1000.0,scale=kind>.5?.55:1.0,ph=aSlot.x,t,size;
      vec3 base=aFire.xyz+vec3(0.0,kind>.5?1.12:.1,0.0),p;
      if(aSlot.y<.5){
        t=fract(uWindTime*1.7+ph*13.7+seed*7.0);float sw=(.35+.65*(1.0-t))*.34*scale;
        p=base+vec3(sin(ph*40.0+uWindTime*3.1)*sw,t*1.45*scale,cos(ph*31.0+uWindTime*2.7)*sw);size=mix(.85,.2,t)*scale;
      } else if(aSlot.y<1.5){
        t=fract(uWindTime*.32+ph*17.3+seed*3.0);
        p=base+vec3(sin(ph*23.0+uWindTime*.9)*t*1.4+.8*t*t,t*5.5*scale+.3,cos(ph*19.0+uWindTime*.8)*t*1.4+.55*t*t);size=.05;
      } else if(aSlot.y>2.5){
        t=.5;p=base+vec3(0.0,.55*scale,0.0);size=(3.2+.3*sin(uWindTime*7.0+seed*9.0))*scale;
      } else {
        t=fract(uWindTime*.12+ph*11.1+seed*5.0);
        p=base+vec3(.83*t*t*4.0+sin(ph*9.0+uWindTime*.4)*.4,scale+t*7.0,.55*t*t*4.0+cos(ph*7.0+uWindTime*.3)*.4);size=mix(.7,2.8,t)*scale;
      }
      vT=t;vType=aSlot.y;vSeed=ph;
      finish(p);
      gl_PointSize=clamp(size*uPointScale/max(gl_Position.w,.1),1.0,256.0);
    }`;
  const FIRE_FS = `
    precision mediump float;
    uniform float uFog, uAnime, uSmoke; uniform vec3 uBg, uSun, uHorizon;
    varying float vT; varying float vType; varying float vSeed;
    varying vec4 vShadow; varying float vDepth;
    ` + SHADOW_FN + `
    void main(){
      vec2 c=gl_PointCoord*2.0-1.0;float r=length(c);
      if(vType>2.5){
        if(uSmoke>.5)discard;
        // The glow of the fire in the smoky air around it, much stronger at night.
        gl_FragColor=vec4(vec3(1.0,.5,.18)*pow(max(1.0-r,0.0),2.2)*mix(.10,.42,uEnv.w)*(1.0-sFogAmount(vWorld)*.9),1.0);
        return;
      }
      if(vType>1.5){
        if(uSmoke<.5)discard;
        float a=(1.0-smoothstep(.2,1.0,r))*.24*(1.0-vT)*smoothstep(0.0,.15,vT)*(.6+.4*noise(c*3.0+vSeed*9.0));
        if(a<.01)discard;
        gl_FragColor=vec4(sGrade(sFog(toLin(vec3(.30,.28,.27))*(uAmbS+uKey*.3+fireLight(vWorld,vec3(0.0,-1.0,0.0))*.3),vWorld)),a);
        return;
      }
      if(uSmoke>.5)discard;
      vec3 col;
      if(vType<.5){
        // A flame tongue: wide at the root, pointed at the tip (point-sprite y runs downwards), hottest in the core.
        float yy=c.y*.5+.5,w=mix(.12,.85,yy)*(.85+.3*noise(vec2(c.y*3.0-vT*6.0,vSeed*20.0)));
        float shape=(1.0-smoothstep(w*.55,w,abs(c.x)))*smoothstep(-1.0,-.6,c.y)*(1.0-smoothstep(.75,1.0,c.y));
        vec3 hot=mix(vec3(1.0,.92,.62),vec3(1.0,.52,.14),smoothstep(.05,.55,vT+abs(c.x)*.6));
        col=mix(hot,vec3(.62,.12,.03),smoothstep(.45,.95,vT))*shape*(1.0-vT*.75)*1.25;
      } else {
        col=vec3(1.0,.55,.16)*(1.0-smoothstep(.15,1.0,r))*(1.0-vT)*1.6;
      }
      gl_FragColor=vec4(col*(1.0-sFogAmount(vWorld)*.92),1.0);
    }`;
  function compile(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  }
  /* Each look compiles its own shader variant (#define SENGOKU): a uniform branch between the looks would leave
     both paths running on GPUs that flatten branches. Programs are rebuilt in place when the look changes. */
  const built = [];
  let builtStyle = sengoku() ? 'sengoku' : 'anime';
  function link(P, style){
    const defs = P.styled && style === 'sengoku' ? '#define SENGOKU 1\n' : '';
    const v = compile(gl.VERTEX_SHADER, defs + P.vs);
    let f;
    try { f = compile(gl.FRAGMENT_SHADER, defs + P.fs); } catch (err){ gl.deleteShader(v); throw err; }
    const p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    P.attrs.forEach((n, i) => gl.bindAttribLocation(p, i, n));
    gl.linkProgram(p);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)){ const log = gl.getProgramInfoLog(p); gl.deleteProgram(p); throw new Error(log || 'link'); }
    const U = {};
    for (const n of P.uniforms) U[n] = gl.getUniformLocation(p, n);
    return { p, U };
  }
  function program(vs, fs, attrs, uniforms){
    const P = { vs, fs, attrs, uniforms, styled: /SENGOKU/.test(vs + fs) };
    Object.assign(P, link(P, builtStyle));
    built.push(P);
    return P;
  }
  function restyle(){
    const style = sengoku() ? 'sengoku' : 'anime';
    if (style === builtStyle) return;
    const next = [];
    try { for (const P of built) if (P.styled) next.push([P, link(P, style)]); }
    catch (err){
      console.error(err);
      for (const [, n] of next) gl.deleteProgram(n.p);
      setLook({ style: builtStyle });
      return;
    }
    for (const [P, n] of next){ gl.deleteProgram(P.p); Object.assign(P, n); }
    builtStyle = style;
  }
  const COMMON_U = ['uPV', 'uLightPV', 'uRot', 'uLift', 'uExag', 'uMorph', 'uMpp', 'uC', 'uHf', 'uYOff', 'uPP', 'uYear', 'uShadowMap', 'uShadowOn', 'uShadowTexel', 'uShadowK', 'uFog', 'uShade', 'uChange', 'uBg', 'uSun', 'uHorizon', 'uTime', 'uWindTime', 'uWindStrength', 'uAnime', 'uEye', 'uGhostId', 'uGhostId2', 'uGhostPass', 'uGrade', 'uRamp0', 'uRamp1', 'uRamp2', 'uRamp3', 'uRamp4', 'uOverlay', 'uCloud', 'uWater', 'uSlope', 'uPond',
    'uEnv', 'uKey', 'uAmbS', 'uAmbG', 'uFogC', 'uSunC', 'uFogK', 'uTone', 'uFire0', 'uFire1', 'uFire2', 'uFire3', 'uGLift', 'uGGamma', 'uGGain'];
  const TEX_U = ['uTexA', 'uTexB', 'uMix', 'uOrthoA', 'uOrthoB'];
  const TERRAIN_A = ['aGrid', 'aH', 'aNor', 'aSea', 'aMaskA', 'aMaskB'], WALL_A = ['aPos', 'aY', 'aNor', 'aWall', 'aInfo', 'aLife', 'aBid'], ROOF_A = ['aPos', 'aY', 'aLife', 'aInfo', 'aBid'], BOX_A = ['aPos3', 'aNor', 'aCol', 'aMat', 'aWind'];
  let progT, progW, progR, progS, progSky, progB, depthT, depthW, depthR, depthB;
  function corePrograms(){
    progT = program(TERRAIN_VS, TERRAIN_FS, TERRAIN_A, COMMON_U.concat(TEX_U));
    progW = program(WALL_VS, WALL_FS, WALL_A, COMMON_U);
    progR = program(ROOF_VS, ROOF_FS, ROOF_A, COMMON_U.concat(TEX_U));
    progS = program(WALL_VS, SEAWALL_FS, WALL_A, COMMON_U);
    progSky = program(SKY_VS, SKY_FS, ['aPos'], ['uTop', 'uHorizon', 'uEl', 'uAz', 'uAspect', 'uAnime', 'uTime', 'uSun', 'uCloudCover', 'uStorm', 'uMid', 'uLand', 'uGrade', 'uEnv', 'uSunC', 'uFogC', 'uTone', 'uGLift', 'uGGamma', 'uGGain']);
    progB = program(BOX_VS, BOX_FS, BOX_A, COMMON_U.concat(['uRoomLight','uLamp0','uLamp1','uLamp2','uLamp3','uContact0','uContact1','uContact2','uContact3']));
    if (SHADOW){ depthT = program(TERRAIN_VS, DEPTH_FS, TERRAIN_A, COMMON_U); depthW = program(WALL_VS, DEPTH_FS_ALIVE, WALL_A, COMMON_U); depthR = program(ROOF_VS, DEPTH_FS_ALIVE, ROOF_A, COMMON_U); depthB = program(BOX_VS, BOX_DEPTH_FS, BOX_A, COMMON_U); }
  }
  try { corePrograms(); }
  catch (err) {
    console.error(err);
    for (const P of built.splice(0)) gl.deleteProgram(P.p);
    // A GPU that cannot build the sengoku variant still gets the island in the lighter look.
    if (builtStyle !== 'sengoku') { fallback(T.noWebgl); return; }
    Object.assign(look, LOOK_STYLES.anime); builtStyle = 'anime';
    try { corePrograms(); } catch (err2) { console.error(err2); fallback(T.noWebgl); return; }
  }
  /* The walking view's placeholder nature is optional: without vertex texture fetch, or if a program
     fails, the island is drawn exactly as before. */
  let progG = null, progP = null, depthP = null, progA = null, progBright = null, progBlur = null, progComposite = null, progF = null;
  const PLANT_A = ['aPos3', 'aNor', 'aCol', 'aInfo'];
  if (GAME && window.JTAWalkNature && gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0){
    const mark = built.length;
    try {
      progG = program(GRASS_VS, GRASS_FS, ['aBlade', 'aSide'], COMMON_U.concat(['uGround', 'uGroundInfo', 'uGroundSize', 'uCamUV', 'uPatch', 'uPool', 'uFlowerPass', 'uWalker']));
      progP = program(PLANT_VS, PLANT_FS, PLANT_A, COMMON_U);
      if (SHADOW) depthP = program(PLANT_VS, DEPTH_FS, PLANT_A, COMMON_U);
      progA = program(PART_VS, PART_FS, ['aPart'], COMMON_U.concat(['uCamUV', 'uPatch', 'uGroundY', 'uPointScale', 'uBirds', 'uWalker', 'uAmount']));
      progBright = program(POST_VS, BRIGHT_FS, ['aPos'], ['uTex', 'uTexel', 'uThreshold']);
      progBlur = program(POST_VS, BLUR_FS, ['aPos'], ['uTex', 'uDir']);
      progComposite = program(POST_VS, COMPOSITE_FS, ['aPos'], ['uTex', 'uBloom', 'uTexel', 'uBloomAmount']);
      progF = program(FIRE_VS, FIRE_FS, ['aFire', 'aSlot'], COMMON_U.concat(['uPointScale', 'uSmoke']));
    } catch (err) { console.error(err); for (const P of built.splice(mark)) gl.deleteProgram(P.p); progG = progP = depthP = progA = progBright = progBlur = progComposite = progF = null; }
  }

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
    if(GAME)window.JTAWalkBuildings.fitTerrain(hts,{w,h,step,x0:t.x0,y0:t.y0},model.buildings);
    const tris = (w - 1) * (h - 1) * 2, useBig = count > 65535;
    if (useBig && !bigIndex) return buildTerrain(t, buf, step * 2);
    /* Walking view: placeholder cover classes per vertex. Every footprint of every era is excluded, so the
       field does not depend on the selected year; overgrowth by era is applied in the shaders. */
    let nature = null, maskA = null, maskB = null;
    if (GAME && progG){
      nature = window.JTAWalkNature.field({ w, h, step, x0: t.x0, y0: t.y0 }, hts, model.buildings, model.coast, { year: 1962 });
      nature.features = window.JTAWalkNature.features(nature, hts, { spawn: [490, 650], lowEnd, coast: model.coast, avoid: model.buildings.flatMap(b => b.wings || [b.poly]) });
      const A = new Uint8Array(count * 3), B = new Uint8Array(count * 3), byte = x => Math.round(clamp(x, 0, 1) * 255);
      for (let k = 0; k < count; k++){
        A[k * 3] = byte(nature.grass[k]); A[k * 3 + 1] = byte(nature.path[k]); A[k * 3 + 2] = byte(nature.rock[k]);
        B[k * 3] = byte(nature.flower[k]); B[k * 3 + 1] = byte(nature.weed[k]); B[k * 3 + 2] = byte(1 - Math.abs(nature.shore[k]) / 40);
      }
      maskA = buffer(A); maskB = buffer(B);
    }
    const idx = useBig ? new Uint32Array(tris * 3) : new Uint16Array(tris * 3);
    let p = 0;
    for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++){
      const a = j * w + i, b = a + 1, d = a + w, e = d + 1;
      idx[p++] = a; idx[p++] = d; idx[p++] = b; idx[p++] = b; idx[p++] = d; idx[p++] = e;
    }
    return { grid: buffer(grid), hts: buffer(hts), nor: buffer(normals(hts, w, h, step)), sea: buffer(seaF),
      idx: buffer(idx, gl.ELEMENT_ARRAY_BUFFER), count: idx.length, type: useBig ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, w, h, step, hts0: hts, x0: t.x0, y0: t.y0,
      nature, maskA, maskB };
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
  function translucent(b){ return (!GAME && !!b.a) || b.k === 8 || b.k === 12; }
  function buildBoxes(scene){
    if(!bigIndex){
      const batches=[];let batch=[],vertices=0;
      for(const b of scene.boxes){const size=b.p==='ball'?384:b.p==='rock'?216:b.p==='cyl'?88:24;
        if(vertices+size>60000){batches.push(batch);batch=[];vertices=0;}batch.push(b);vertices+=size;
      }
      if(batches.length){batches.push(batch);const parts=batches.map(boxes=>buildBoxes({...scene,boxes}));return {parts,count:parts.reduce((n,p)=>n+p.count,0)};}
    }
    const P = [], N = [], Cc = [], Mm = [], W = [], I = []; let windBase=0,windHeight=1,windOn=false;
    let n = 0;
    const push = (pos, nor, col, mat) => { P.push(pos[0], pos[1], pos[2]); N.push(nor[0], nor[1], nor[2]); Cc.push(col[0], col[1], col[2], col[3]); Mm.push(mat[0], mat[1]); W.push(windOn?clamp((pos[1]-windBase)/windHeight,0,1):0); return n++; };
    for (const b of scene.boxes){
      if ((scene.pass === 'assumed') !== translucent(b)) continue;
      windBase=b.y;windHeight=Math.max(.01,b.s[1]);windOn=GAME&&b.k===10;
      const [sx, sy, sz] = b.s, a = (b.r || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      const alpha = b.k === 8 ? 0.38 : b.k === 12 ? 0.55 : b.a && !GAME ? 0.45 : 1;
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
    return { pos3: buffer(new Float32Array(P)), nor: buffer(new Float32Array(N)), col: buffer(new Float32Array(Cc)), mat: buffer(new Float32Array(Mm)), wind: buffer(new Float32Array(W)),
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
  /* Walking: the shadow box follows the walker (reaching further ahead than behind) instead of covering the whole
     island, so shadows near the walker are about three times sharper; it is snapped to whole shadow texels so
     shadow edges do not crawl while walking. */
  /* Firelight for the sengoku look: up to four burning braziers nearest the walker, each (x, y, z, flickering strength). */
  let fireCache = null;
  function fireLights(){
    if (!sengoku() || !nature || !nature.fires || !nature.fires.length) return [];
    if (fireCache) return fireCache;
    const t = lookTime(), d = f => (f.x - st.wx) ** 2 + (f.z - st.wz) ** 2;
    fireCache = nature.fires.slice().sort((a, b) => d(a) - d(b)).slice(0, 4).map(f => [f.x, f.y + (f.kind ? 1.25 : .7), f.z,
      (f.kind ? 1.1 : 2.0) * (.82 + .1 * Math.sin(t * 9.1 + f.seed) + .08 * Math.sin(t * 23.3 + f.seed * 3.1)) * (st.weather === 2 ? .7 : 1)]);
    return fireCache;
  }
  const walkShadow = () => GAME && st.walk;
  function lightMatrix(){
    const R = 430, sun = env().sun, eye = [sun[0] * 1500, sun[1] * 1500, sun[2] * 1500], view = lookAt(eye, [0, 0, 0]);
    if (!walkShadow()) return mul(ortho(-R, R, -R, R, 600, 2400), view);
    const r = lowEnd ? 110 : 150, texel = 2 * r / (SHADOW || 2048), p = [st.wx + Math.sin(st.az) * r * .4, st.walkGround, st.wz + Math.cos(st.az) * r * .4];
    const vx = view[0] * p[0] + view[4] * p[1] + view[8] * p[2] + view[12], vy = view[1] * p[0] + view[5] * p[1] + view[9] * p[2] + view[13], d = -(view[2] * p[0] + view[6] * p[1] + view[10] * p[2] + view[14]);
    const cx = Math.round(vx / texel) * texel, cy = Math.round(vy / texel) * texel;
    return mul(ortho(cx - r, cx + r, cy - r, cy + r, d - 400, d + 400), view);
  }

  /* ---------- state and camera ---------- */
  const HOME = { az: -1.1, el: 0.62 };
  const st = { az: HOME.az, el: HOME.el, dist: 700, tx: 0, tz: 0, ty: 14, lift: 0, exag: 1, year: 1, change: 0, userLift: 1, walls: true, labels: true,
    walk: false, wx: 0, wz: 0, walkGround: 4, weather: 0 };
  let anim = null, spin = false, queued = false, activeSpot = null, t0 = performance.now();
  let orbitPose = null, walkLast = performance.now();
  const walkKeys = new Set();
  let gameIndoor = false, outsidePose = null;
  const gameInput = { x: 0, y: 0, run: false, autoRun: false };

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
  function fromWorld(x, z){
    const c = Math.cos(rot), s = Math.sin(rot), gx = x * c + z * s, gz = -x * s + z * c;
    return [gx / mpp + C, gz / mpp + C];
  }
  function pointInPoly(p, poly){
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
      const a = poly[i], b = poly[j];
      if (((a[1] > p[1]) !== (b[1] > p[1])) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / ((b[1] - a[1]) || 1e-9) + a[0]) inside = !inside;
    }
    return inside;
  }
  function sampleGround(x, z){
    if (!terrain || !terrain.hts0) return null;
    const uv = fromWorld(x, z), fx = (uv[0] - terrain.x0) / terrain.step, fy = (uv[1] - terrain.y0) / terrain.step;
    if (fx < 0 || fy < 0 || fx > terrain.w - 1 || fy > terrain.h - 1) return null;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, terrain.w - 1), y1 = Math.min(y0 + 1, terrain.h - 1), ax = fx - x0, ay = fy - y0;
    const h = terrain.hts0, a = h[y0 * terrain.w + x0], b = h[y0 * terrain.w + x1], d = h[y1 * terrain.w + x0], e = h[y1 * terrain.w + x1];
    return (a * (1 - ax) + b * ax) * (1 - ay) + (d * (1 - ax) + e * ax) * ay;
  }
  function buildingAlive(b){
    const y = yearMix().year;
    return y >= (b.built || b.seen || 1950) && !(b.gone && y > b.gone);
  }
  function canWalk(x, z){
    if(model&&model.coast&&!pointInPoly(fromWorld(x,z),model.coast))return null;
    if (gameIndoor && scene) { const uv=fromWorld(x,z); return window.JTAWalkNav.ground(interiors.scenes[scene],uv[0],uv[1],mpp,st.walkGround); }
    if (!model || !model.coast) return null;
    const deck = natureDeck(x, z), h = deck !== null ? deck : sampleGround(x, z), here = st.walk ? (natureDeck(st.wx, st.wz) !== null ? st.walkGround : sampleGround(st.wx, st.wz)) : h;
    if (h === null || h < 0.45 || (here !== null && Math.abs(h - here) > 1.4)) return null;
    if (natureBlocks(x, z)) return null;
    const probes = [[0, 0], [0.48, 0], [-0.48, 0], [0, 0.48], [0, -0.48]];
    for (const q of probes){
      const uv = fromWorld(x + q[0], z + q[1]);
      if (!pointInPoly(uv, model.coast)) return null;
      for (const b of model.buildings) if (buildingAlive(b) && (b.wings || [b.poly]).some(poly => pointInPoly(uv, poly))) return null;
    }
    return h;
  }
  function frameMatrices(){
    const w = canvas.width, h = canvas.height;
    if (st.walk){
      const cp = Math.cos(st.el), eye = [st.wx, st.walkGround + 1.68, st.wz];
      const target = [eye[0] + Math.sin(st.az) * cp, eye[1] + Math.sin(st.el), eye[2] + Math.cos(st.az) * cp];
      const proj = perspective(0.9, w / Math.max(1, h), 0.08, 1800), view = lookAt(eye, target);
      return { proj, view, pv: mul(proj, view) };
    }
    const ce = Math.cos(st.el), target = [st.tx, st.ty, st.tz];
    const eye = [target[0] + st.dist * ce * Math.sin(st.az), target[1] + st.dist * Math.sin(st.el), target[2] + st.dist * ce * Math.cos(st.az)];
    const sc = scene && interiors ? interiors.scenes[scene] : null;
    const fov = sc && sc.camera && sc.camera.fov ? sc.camera.fov : (scene ? 0.9 : 0.7);
    const proj = perspective(fov, w / Math.max(1, h), scene ? 0.2 : Math.max(0.5, Math.min(2, st.dist * 0.2)), scene ? 1500 : 6000), view = lookAt(eye, target);
    return { proj, view, pv: mul(proj, view) };
  }

  function setCommon(P, pv, lightPV, lift, ym, shadowOn){
    gl.useProgram(P.p);
    const U = P.U;
    gl.uniform1f(U.uAnime, GAME ? 1 : 0);
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
    const e = env();
    gl.uniform3fv(U.uBg, e.bg);
    gl.uniform3fv(U.uSun, e.sun);
    gl.uniform3fv(U.uHorizon, e.horizon);
    gl.uniform1f(U.uFog, e.fog);
    if (U.uGrade) gl.uniform4fv(U.uGrade, gradeOf());
    if (U.uEnv){
      const s = sengoku() ? e : null, indoor = P === progB;
      gl.uniform4fv(U.uEnv, s ? [1, s.snow, s.wet, s.night] : [0, 0, 0, 0]);
      if (s){
        /* Rooms keep only a trace of the outdoor haze, dimmed, so interiors read as dusty rather than foggy. */
        gl.uniform3fv(U.uKey, s.keyC); gl.uniform3fv(U.uAmbS, s.ambS); gl.uniform3fv(U.uAmbG, s.ambG); gl.uniform3fv(U.uSunC, s.sunC);
        gl.uniform3fv(U.uFogC, indoor ? s.fogC.map(x => x * .3) : s.fogC);
        gl.uniform4fv(U.uFogK, indoor ? [s.fogK[0] * .2, s.fogK[1] * .2, s.fogK[2], s.fogK[3]] : s.fogK);
        gl.uniform4fv(U.uTone, [0, 0, indoor && gameIndoor ? 1 : 0, s.lamps]); gl.uniform3fv(U.uGLift, s.lift); gl.uniform3fv(U.uGGamma, s.gamma); gl.uniform3fv(U.uGGain, s.gain);
        const fires = fireLights();
        for (let i = 0; i < 4; i++) gl.uniform4fv(U['uFire' + i], fires[i] || [0, 0, 0, 0]);
      }
    }
    if (U.uRamp0){
      const r = rampOf();
      for (let i = 0; i < 5; i++) gl.uniform3fv(U['uRamp' + i], r[i]);
      gl.uniform4fv(U.uOverlay, [look.mottle, look.sheen, look.streaks, lookTime()]);
      gl.uniform4fv(U.uCloud, [P === progB ? 0 : look.clouds, look.cloudScale, look.cloudSpeed, look.grain]);
      if (U.uWater) gl.uniform4fv(U.uWater, [look.spots, look.sparkle, 1, st.weather === 2 ? 1 : st.weather === 1 ? .35 : 0]);
      if (U.uSlope) gl.uniform2fv(U.uSlope, slopeBand());
      if (U.uPond) gl.uniform4fv(U.uPond, nature && nature.pond ? nature.pond : [0, 0, 0, 0]);
    }
    gl.uniform1f(U.uWindTime,reduce?0:(performance.now()-t0)/1000);
    gl.uniform1f(U.uWindStrength,GAME&&!reduce?(st.weather===2?.075:.035)*look.wind:0);
    gl.uniform1f(U.uTime, reduce?0:(performance.now() - t0) / 1000);
    if(U.uEye)gl.uniform3fv(U.uEye,[st.wx,st.walkGround+1.68,st.wz]);
    gl.uniform1f(U.uShadowOn, shadowOn ? 1 : 0);
    gl.uniform1f(U.uShadowTexel, 1 / (SHADOW || 1));
    gl.uniform2fv(U.uShadowK, walkShadow() ? [.25, 1] : [1, 0]);
    gl.uniform1f(U.uGhostId, ghostId);
    gl.uniform1f(U.uGhostId2, ghostId2);
    gl.uniform1f(U.uGhostPass, 0);
    if(P===progB){
      const sc=GAME&&gameIndoor&&scene&&interiors.scenes[scene],onRoof=sc&&sc.walkPlan&&st.walkGround>=sc.walkPlan.base+sc.walkPlan.floors*sc.walkPlan.height-.1,uv=fromWorld(st.wx,st.wz),lamps=!onRoof&&sc&&sc.walkLights?sc.walkLights.slice().sort((a,b)=>((a.u-uv[0])**2+(a.v-uv[1])**2+4*(a.y-st.walkGround-1.68)**2)-((b.u-uv[0])**2+(b.v-uv[1])**2+4*(b.y-st.walkGround-1.68)**2)).slice(0,4):[];
      gl.uniform1f(U.uRoomLight,lamps.length?1:0);
      for(let i=0;i<4;i++){const l=lamps[i];gl.uniform4fv(U['uLamp'+i],l?[(l.u-C)*mpp,l.y,(l.v-C)*mpp,l.radius]:[0,0,0,0]);}
      const contacts=sc&&!onRoof?(sc.boxes||[]).filter(b=>/^(chabudai|table|desk|teacher-desk|tansu|futon|bed|bench|cupboard|crate|vaulting-box)$/.test(b.t||'')&&b.y>=st.walkGround-.12&&b.y<st.walkGround+1.5).sort((a,b)=>((a.u-uv[0])**2+(a.v-uv[1])**2)-((b.u-uv[0])**2+(b.v-uv[1])**2)).slice(0,4):[];
      for(let i=0;i<4;i++){const b=contacts[i];gl.uniform4fv(U['uContact'+i],b?[(b.u-C)*mpp,b.y+.12,(b.v-C)*mpp,Math.max(.25,Math.sqrt(b.s[0]*b.s[2])*.55)]:[0,0,0,0]);}
    }
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
  function attrBytes(buf, loc, size){
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.UNSIGNED_BYTE, true, 0, 0);
  }
  function drawTerrain(P, m, yOff){
    attr(m.grid, 0, 2); attr(m.hts, 1, 1); attr(m.nor, 2, 3); attr(m.sea, 3, 1);
    if (m.maskA){ attrBytes(m.maskA, 4, 3); attrBytes(m.maskB, 5, 3); disableFrom(6); } else disableFrom(4);
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
    if(m.parts){for(const part of m.parts)drawBoxes(P,part);return;}
    attr(m.pos3, 0, 3); attr(m.nor, 1, 3); attr(m.col, 2, 4); attr(m.mat, 3, 2); attr(m.wind, 4, 1); disableFrom(5);
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
  function drawSky(){
    if (!skyBuf) skyBuf = buffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(progSky.p);
    attr(skyBuf, 0, 2); disableFrom(1);
    const e = env();
    gl.uniform1f(progSky.U.uAnime,GAME?1:0); gl.uniform1f(progSky.U.uTime,reduce?0:(performance.now()-t0)/1000);
    gl.uniform1f(progSky.U.uAz,st.az);gl.uniform1f(progSky.U.uAspect,canvas.width/Math.max(1,canvas.height));
    gl.uniform3fv(progSky.U.uSun,e.sun);gl.uniform1f(progSky.U.uCloudCover,sengoku()?e.cover:[0,.85,1,.65][st.weather]);gl.uniform1f(progSky.U.uStorm,sengoku()?e.storm:[0,.45,.9,.35][st.weather]);
    gl.uniform4fv(progSky.U.uEnv,sengoku()?[1,e.snow,e.wet,e.night]:[0,0,0,0]);
    if(sengoku()){gl.uniform3fv(progSky.U.uSunC,e.sunC);gl.uniform3fv(progSky.U.uFogC,e.fogC);gl.uniform4fv(progSky.U.uTone,[0,0,0,e.lamps]);gl.uniform3fv(progSky.U.uGLift,e.lift);gl.uniform3fv(progSky.U.uGGamma,e.gamma);gl.uniform3fv(progSky.U.uGGain,e.gain);}
    gl.uniform3fv(progSky.U.uTop, e.sky); gl.uniform3fv(progSky.U.uHorizon, GAME ? e.skyHorizon : e.horizon); gl.uniform1f(progSky.U.uEl, st.el);
    gl.uniform3fv(progSky.U.uMid, e.mid || e.sky); gl.uniform1f(progSky.U.uLand, look.land); gl.uniform4fv(progSky.U.uGrade, gradeOf());
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.DEPTH_TEST);
  }

  /* ---------- walking view post-process ---------- */
  let post = null, postSize = '';
  function target(w, h, depth){
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (depth){ const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb); }
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ok ? { tex, fb, w, h } : null;
  }
  // (Re)creates the scene and bloom targets when the canvas size changes; null means draw straight to the canvas.
  function postTargets(){
    if (!GAME || !progComposite || !(bloomAmount() > 0)) return null;
    const w = canvas.width, h = canvas.height, key = w + 'x' + h;
    if (postSize === key) return post;
    postSize = key;
    const scene = target(w, h, true), bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
    const a = scene && target(bw, bh, false), b = a && target(bw, bh, false);
    post = scene && a && b ? { scene, a, b } : null;
    return post;
  }
  let quadBuf = null;
  function quad(P, uniforms){
    if (!quadBuf) quadBuf = buffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    gl.useProgram(P.p); uniforms();
    attr(quadBuf, 0, 2); disableFrom(1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function runPost(p){
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    const bind = (t, unit) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); };
    gl.bindFramebuffer(gl.FRAMEBUFFER, p.a.fb); gl.viewport(0, 0, p.a.w, p.a.h);
    quad(progBright, () => { bind(p.scene.tex, 0); gl.uniform1i(progBright.U.uTex, 0); gl.uniform2fv(progBright.U.uTexel, [1 / p.scene.w, 1 / p.scene.h]); gl.uniform1f(progBright.U.uThreshold, sengoku() ? .72 : .86); });
    gl.bindFramebuffer(gl.FRAMEBUFFER, p.b.fb);
    quad(progBlur, () => { bind(p.a.tex, 0); gl.uniform1i(progBlur.U.uTex, 0); gl.uniform2fv(progBlur.U.uDir, [1 / p.a.w, 0]); });
    gl.bindFramebuffer(gl.FRAMEBUFFER, p.a.fb);
    quad(progBlur, () => { bind(p.b.tex, 0); gl.uniform1i(progBlur.U.uTex, 0); gl.uniform2fv(progBlur.U.uDir, [0, 1 / p.a.h]); });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, p.scene.w, p.scene.h);
    quad(progComposite, () => { bind(p.scene.tex, 0); bind(p.a.tex, 1); gl.uniform1i(progComposite.U.uTex, 0); gl.uniform1i(progComposite.U.uBloom, 1); gl.uniform2fv(progComposite.U.uTexel, [1 / p.scene.w, 1 / p.scene.h]); gl.uniform1f(progComposite.U.uBloomAmount, bloomAmount()); });
    gl.activeTexture(gl.TEXTURE0); gl.enable(gl.DEPTH_TEST);
  }

  /* ---------- walking view placeholder nature ---------- */
  let nature = null;
  function buildNature(){
    const N = window.JTAWalkNature, f = terrain && terrain.nature;
    if (!progG || !progP || !f) return;
    const pool = (count, metres, data) => ({ buf: buffer(data), count: data.length / 5, patch: metres / mpp, fade: metres * .5 });
    const F = f.features, scattered = N.scatter(f, terrain.hts0, { lowEnd, avoid: model.buildings.flatMap(b => b.wings || [b.poly]), spawn: [490, 650], keepOut: F.keepOut });
    const set = Object.assign({}, scattered, { trees: scattered.trees.concat(F.trees), rocks: scattered.rocks.concat(F.rocks), fences: F.fences, bridges: F.bridges, ponds: F.ponds, ruins: F.ruins });
    set.props = N.sengokuProps(f, terrain.hts0, { lowEnd, avoid: model.buildings.flatMap(b => b.wings || [b.poly]), spawn: [490, 650],
      keepOut: F.keepOut.concat(set.trees.map(t => ({ u: t.u, v: t.v, r: 1.2 })), set.rocks.map(r => ({ u: r.u, v: r.v, r: r.size * .6 })), set.ponds.map(p => ({ u: p.u, v: p.v, r: p.r + 1.5 }))) });
    const stamps = set.rocks.map(r => ({ u: r.u, v: r.v, r: r.size * .55 })).concat(set.trees.map(t => ({ u: t.u, v: t.v, r: .5 })), set.ponds.map(p => ({ u: p.u, v: p.v, r: p.r + .2 })), set.ruins.flatMap(r => r.pillars.map(p => ({ u: p.u, v: p.v, r: p.size * .8 })).concat([{ u: r.gear.u, v: r.gear.v, r: r.gear.r * .6 }])));
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, f.w, f.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, N.stampCover(N.groundTexture(f, terrain.hts0), f, stamps));
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.activeTexture(gl.TEXTURE0);
    const plants = plantMeshes(set);
    // Trunks and large rocks block walking; bins keep the check local.
    const bins = new Map(), add = (u, v, r) => { const key = Math.floor(u / 8) + ',' + Math.floor(v / 8); if (!bins.has(key)) bins.set(key, []); bins.get(key).push([u, v, r]); };
    for (const t of set.trees) add(t.u, t.v, .38 + t.radius * .07);
    for (const r of set.rocks) if (r.size > .8) add(r.u, r.v, r.size * .42);
    for (const ru of set.ruins){ for (const pl of ru.pillars) add(pl.u, pl.v, pl.size * .72); add(ru.gear.u, ru.gear.v, ru.gear.r * .8); }
    // Fence rails are segments; bins hold them by every cell they cross.
    const segments = new Map(), addSeg = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4)); for (let i = 0; i <= n; i++){ const u = a[0] + (b[0] - a[0]) * i / n, v = a[1] + (b[1] - a[1]) * i / n, key = Math.floor(u / 8) + ',' + Math.floor(v / 8); if (!segments.has(key)) segments.set(key, new Set()); segments.get(key).add([a, b]); } };
    for (const run of set.fences) for (let i = 1; i < run.length; i++) addSeg(run[i - 1], run[i]);
    // Near pool (dense), far pool (sparser, larger clumps out to about 40 m; the video faded grass 16-39 m) and flowers.
    const pools = [Object.assign(pool(0, lowEnd ? 30 : 38, N.blades(lowEnd ? 22000 : 66000, (lowEnd ? 30 : 38) / mpp)), { near: 0, size: 1, flower: 0 })];
    if (!lowEnd) pools.push(Object.assign(pool(0, 84, N.blades(34000, 84 / mpp)), { fade: 40, near: 13, size: 1.45, flower: 0 }));
    pools.push(Object.assign(pool(0, lowEnd ? 34 : 46, N.flowers(lowEnd ? 1400 : 4200, (lowEnd ? 34 : 46) / mpp)), { near: 0, size: 1, flower: 1 }));
    const parts = new Float32Array((lowEnd ? 110 : 280) * 4), patch = 44 / mpp;
    for (let i = 0; i < parts.length / 4; i++){ parts[i * 4] = N.hash(i, 1, 61) * patch; parts[i * 4 + 1] = N.hash(i, 2, 61) * patch; parts[i * 4 + 2] = N.hash(i, 3, 61); parts[i * 4 + 3] = N.hash(i, 4, 61); }
    const birds = new Float32Array([0, 0, .1, 0, 1, -1, .4, 0, 1, 1, .7, 0, 2, -1, .2, 0, 2, 1, .9, 0]);
    const pd = set.ponds[0], pw = pd ? toWorldTrue(pd.u, pd.v) : null;
    // Sengoku props: fire sprites, firelight sources and colliders (these block walking only in the sengoku look).
    const fires = set.props.fires.map(fi => { const w = toWorldTrue(fi.u, fi.v); return { x: w[0], y: fi.y, z: w[1], kind: fi.kind, seed: fi.seed }; }), fa = [], fb = [];
    for (const fi of fires) for (const [n, type] of [[26, 0], [14, 1], [8, 2], [1, 3]]) for (let i = 0; i < n; i++){ fa.push(fi.x, fi.y, fi.z, fi.kind * 1000 + fi.seed); fb.push((i + .5) / n + N.hash(i, fi.seed, 7) * .37, type); }
    const propBins = new Map(), addProp = (u, v, r) => { const key = Math.floor(u / 8) + ',' + Math.floor(v / 8); if (!propBins.has(key)) propBins.set(key, []); propBins.get(key).push([u, v, r]); };
    for (const fi of set.props.fires) addProp(fi.u, fi.v, fi.kind ? .45 : 1.05);
    for (const l of set.props.lanterns) addProp(l.u, l.v, .42);
    for (const j of set.props.jizo) addProp(j.u, j.v, .25 * j.count + .2);
    for (const b of set.props.banners) addProp(b.u, b.v, .12);
    nature = { pond: pw ? [pw[0], pw[1], pd.r + .15, 1] : null, tex, f, plants, bins, segments, set, pools, parts: { buf: buffer(parts), count: parts.length / 4, patch }, birds: { buf: buffer(birds), count: 5 }, plantStyle: look.style,
      fires, fireBuf: fires.length ? { a: buffer(new Float32Array(fa)), b: buffer(new Float32Array(fb)), count: fa.length / 4 } : null, propBins };
  }
  /* Tree, shrub and prop meshes for the current look: maples, pines and dead trees in the sengoku look, anime shapes otherwise. */
  function plantMeshes(set){
    return window.JTAWalkNature.meshes(set, sengoku() ? 'sengoku' : 'anime').map(b => ({ pos3: buffer(b.pos), nor: buffer(b.nor), col: buffer(b.col), info: buffer(b.info), idx: buffer(b.idx, gl.ELEMENT_ARRAY_BUFFER), count: b.idx.length }));
  }
  function syncPlants(){
    if (!nature || nature.plantStyle === look.style) return;
    for (const m of nature.plants) for (const k of ['pos3', 'nor', 'col', 'info', 'idx']) gl.deleteBuffer(m[k]);
    nature.plants = plantMeshes(nature.set); nature.plantStyle = look.style;
  }
  // Deck height when (x, z) is on a bridge, else null. Ends are flush with the banks.
  function natureDeck(x, z){
    if (!nature) return null;
    const uv = fromWorld(x, z);
    for (const br of nature.set.bridges){
      const du = (uv[0] - br.u) * mpp, dv = (uv[1] - br.v) * mpp, t = du * br.axis[0] + dv * br.axis[1], s = -du * br.axis[1] + dv * br.axis[0];
      if (Math.abs(t) <= br.span / 2 + .2 && Math.abs(s) <= br.width / 2 - .12){ const k = clamp(t / br.span + .5, 0, 1); return br.y0 + (br.y1 - br.y0) * k + br.arch * Math.sin(Math.PI * k); }
    }
    return null;
  }
  function natureBlocks(x, z){
    if (!nature) return false;
    const uv = fromWorld(x, z), bu = Math.floor(uv[0] / 8), bv = Math.floor(uv[1] / 8);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++){
      for (const o of nature.bins.get((bu + i) + ',' + (bv + j)) || []) if (Math.hypot(uv[0] - o[0], uv[1] - o[1]) * mpp < o[2] + .22) return true;
      for (const [a, b] of nature.segments.get((bu + i) + ',' + (bv + j)) || []){
        const ex = b[0] - a[0], ev = b[1] - a[1], t = clamp(((uv[0] - a[0]) * ex + (uv[1] - a[1]) * ev) / (ex * ex + ev * ev || 1), 0, 1);
        if (Math.hypot(uv[0] - a[0] - t * ex, uv[1] - a[1] - t * ev) * mpp < .3) return true;
      }
    }
    for (const pd of nature.set.ponds) if (Math.hypot(uv[0] - pd.u, uv[1] - pd.v) * mpp < pd.r + .15 && natureDeck(x, z) === null) return true;
    if (sengoku()) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const o of nature.propBins.get((bu + i) + ',' + (bv + j)) || []) if (Math.hypot(uv[0] - o[0], uv[1] - o[1]) * mpp < o[2] + .22) return true;
    return false;
  }
  function drawPlants(P, m){
    attr(m.pos3, 0, 3); attr(m.nor, 1, 3); attr(m.col, 2, 3); attr(m.info, 3, 3); disableFrom(4);
    gl.uniform1f(P.U.uYOff, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
  }
  function drawAmbient(M, lightPV, lift, ym){
    if (!nature || !progA || !look.ambient) return;
    setCommon(progA, M.pv, lightPV, lift, ym, false);
    gl.uniform1f(progA.U.uYOff, 0);
    gl.uniform2fv(progA.U.uCamUV, fromWorld(st.wx, st.wz)); gl.uniform1f(progA.U.uPatch, nature.parts.patch);
    gl.uniform1f(progA.U.uGroundY, st.walkGround); gl.uniform3fv(progA.U.uWalker, [st.wx, st.walkGround + 1.68, st.wz]);
    gl.uniform1f(progA.U.uPointScale, canvas.height * .5 * M.proj[5]); gl.uniform1f(progA.U.uAmount, look.ambient);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    const weatherOk = sengoku() ? st.weather !== 2 : (st.weather === 0 || st.weather === 1);
    for (const [p, birds] of [[nature.parts, 0], [nature.birds, 1]]){
      if (!birds && (gameIndoor || !weatherOk)) continue;
      gl.uniform1f(progA.U.uBirds, birds);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.buf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0); disableFrom(1);
      gl.drawArrays(gl.POINTS, 0, p.count);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
  function drawFires(M, lightPV, lift, ym){
    if (!nature || !nature.fireBuf || !progF || !sengoku()) return;
    setCommon(progF, M.pv, lightPV, lift, ym, false);
    gl.uniform1f(progF.U.uYOff, 0); gl.uniform1f(progF.U.uPointScale, canvas.height * .5 * M.proj[5]);
    gl.bindBuffer(gl.ARRAY_BUFFER, nature.fireBuf.a); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, nature.fireBuf.b); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0); disableFrom(2);
    gl.enable(gl.BLEND); gl.depthMask(false);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.uniform1f(progF.U.uSmoke, 1); gl.drawArrays(gl.POINTS, 0, nature.fireBuf.count);
    gl.blendFunc(gl.ONE, gl.ONE); gl.uniform1f(progF.U.uSmoke, 0); gl.drawArrays(gl.POINTS, 0, nature.fireBuf.count);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
  function drawNature(M, lightPV, lift, ym, shadowOn){
    if (!nature) return;
    syncPlants();
    setCommon(progP, M.pv, lightPV, lift, ym, shadowOn);
    for (const m of nature.plants) drawPlants(progP, m);
    setCommon(progG, M.pv, lightPV, lift, ym, shadowOn);
    gl.uniform1f(progG.U.uYOff, 0);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, nature.tex); gl.uniform1i(progG.U.uGround, 3); gl.activeTexture(gl.TEXTURE0);
    gl.uniform3fv(progG.U.uGroundInfo, [nature.f.x0, nature.f.y0, nature.f.step]);
    gl.uniform2fv(progG.U.uGroundSize, [nature.f.w, nature.f.h]);
    gl.uniform2fv(progG.U.uCamUV, fromWorld(st.wx, st.wz));
    gl.uniform3fv(progG.U.uWalker, [st.wx, st.walkGround + 1.68, st.wz]);
    const q = QUALITY[look.quality] || 1;
    for (const p of nature.pools){
      if (p.near && look.quality === 'low') continue;
      gl.uniform1f(progG.U.uPatch, p.patch); gl.uniform4fv(progG.U.uPool, [p.fade, p.near, p.size, (p.flower ? look.flowers : look.grass) * q]); gl.uniform1f(progG.U.uFlowerPass, p.flower);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.buf);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 20, 16);
      disableFrom(2);
      gl.drawArrays(gl.TRIANGLES, 0, p.count);
    }
  }

  function draw(){
    if (GAME) restyle();
    const w = canvas.width, h = canvas.height;
    const e = env(), pp = terrain && st.walk ? postTargets() : null, screenFb = pp ? pp.scene.fb : null;
    fireCache = null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, screenFb);
    gl.viewport(0, 0, w, h);
    gl.clearColor(e.bg[0], e.bg[1], e.bg[2], 1);
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
        if (sceneMesh && sceneMesh.count && depthB){ setCommon(depthB, lightPV, lightPV, lift, ym, false); drawBoxes(depthB, sceneMesh); }
      }
      if (nature && depthP){ setCommon(depthP, lightPV, lightPV, lift, ym, false); for (const m of nature.plants) drawPlants(depthP, m); }
      gl.colorMask(true, true, true, true);
      gl.bindFramebuffer(gl.FRAMEBUFFER, screenFb);
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
      drawNature(M, lightPV, lift, ym, shadowOn);
      drawAmbient(M, lightPV, lift, ym);
      drawFires(M, lightPV, lift, ym);
      if (sceneMesh){
        /* the interior: opaque boxes, then the assumed (translucent) ones, then the host building as a ghost shell */
        setCommon(progB, M.pv, lightPV, lift, ym, shadowOn);
        if (sceneMesh.count) drawBoxes(progB, sceneMesh);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        if (sceneMeshA && sceneMeshA.count) drawBoxes(progB, sceneMeshA);
        if(!GAME){
          gl.enable(gl.CULL_FACE);
          setCommon(progW, M.pv, lightPV, lift, ym, shadowOn); gl.uniform1f(progW.U.uGhostPass, 1); drawWalls(progW, walls);
          gl.disable(gl.CULL_FACE);
          setCommon(progR, M.pv, lightPV, lift, ym, shadowOn); setTextures(progR, texA, texB, ym); gl.uniform1f(progR.U.uGhostPass, 1); drawRoofs(progR, roofs);
        }
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
    }
    if (pp) runPost(pp);
    placeSpots(M.pv, lift, ym);
    if (compass) compass.style.transform = 'rotate(' + (st.az * 180 / Math.PI).toFixed(1) + 'deg)';
  }

  function updateWalk(now){
    const dt = Math.min(0.06, Math.max(0, (now - walkLast) / 1000));
    walkLast = now;
    if (!st.walk || !dt) return;
    const forward = gameInput.y + (walkKeys.has('w') || walkKeys.has('arrowup') || walkKeys.has('forward') ? 1 : 0) - (walkKeys.has('s') || walkKeys.has('arrowdown') || walkKeys.has('back') ? 1 : 0);
    const right = gameInput.x + (walkKeys.has('d') || walkKeys.has('right') || walkKeys.has('arrowright') ? 1 : 0) - (walkKeys.has('a') || walkKeys.has('left') || walkKeys.has('arrowleft') ? 1 : 0);
    if (!forward && !right) return;
    const n = Math.max(1, Math.hypot(forward, right)), running=walkKeys.has('shift')||gameInput.run||gameInput.autoRun, speed=gameIndoor?(running?5.6:2.8):(running?9:4.5);
    const f = forward / n, r = right / n, dx = (Math.sin(st.az) * f - Math.cos(st.az) * r) * speed * dt, dz = (Math.cos(st.az) * f + Math.sin(st.az) * r) * speed * dt;
    // Small collision steps preserve thin walls and stair rises even when sprinting at low FPS.
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
    for(let i=0;i<steps;i++){
      let h=canWalk(st.wx+dx/steps,st.wz);
      if(h!==null){st.wx+=dx/steps;st.walkGround=h;}
      h=canWalk(st.wx,st.wz+dz/steps);
      if(h!==null){st.wz+=dz/steps;st.walkGround=h;}
    }
  }
  /* Screen-space anime touches (walking view, fair weather): slanted god-ray beams when facing the sun and an
     occasional white wind swirl, as in the reference video's play mode. Purely decorative. */
  function drawLight(now){
    const cw = canvas.clientWidth, ch = canvas.clientHeight, t = now * .001, e = env(), ctx = weatherCtx;
    ctx.save(); ctx.scale(weatherFx.width / Math.max(1, cw), weatherFx.height / Math.max(1, ch)); ctx.globalCompositeOperation = 'lighter';
    let rel = Math.atan2(e.sun[0], e.sun[2]) - st.az; rel -= Math.PI * 2 * Math.round(rel / (Math.PI * 2));
    const facing = clamp(1.25 - Math.abs(rel), 0, 1) * clamp(1 - st.el * 1.2, 0, 1) * (st.weather ? .45 : 1) * Math.min(1, look.ambient);
    if (facing > .01){
      const sx = cw * (.5 + rel / 1.9);
      for (let i = 0; i < 5; i++){
        const x = sx + (i - 2) * cw * .09 + Math.sin(t * .15 + i) * 12, spread = cw * (.06 + .03 * (i % 2)), lean = cw * .22;
        const alpha = (.07 + .04 * Math.sin(t * .6 + i * 1.7)) * facing;
        const g = ctx.createLinearGradient(0, 0, 0, ch * .85);
        g.addColorStop(0, 'rgba(255,248,220,' + alpha.toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,248,220,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - spread * .3, -10); ctx.lineTo(x + spread * .3, -10); ctx.lineTo(x + lean + spread, ch * .85); ctx.lineTo(x + lean - spread, ch * .85); ctx.closePath(); ctx.fill();
      }
    }
    // A wind swirl every 7 s: a curling white stroke drawn in over about 1.4 s, then fading.
    const k = Math.floor(t / 7), phase = t / 7 - k;
    if (phase < .24){
      const hr = x => { const v = Math.sin(k * 12.9898 + x * 78.233) * 43758.5453; return v - Math.floor(v); };
      const cx = cw * (.25 + .5 * hr(1)), cy = ch * (.45 + .3 * hr(2)), r = Math.min(cw, ch) * (.05 + .04 * hr(3)), prog = phase / .2;
      ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round'; ctx.lineWidth = 2.2;
      ctx.strokeStyle = 'rgba(255,255,255,' + (.75 * Math.min(1, (.24 - phase) / .06) * Math.min(1, look.ambient)).toFixed(3) + ')';
      ctx.beginPath();
      for (let j = 0, n = 40; j <= n; j++){
        const u = Math.max(0, prog - .45) + j / n * Math.min(prog, .45);
        const a = u * 9, rr = r * (1.2 - u * .9), x = cx + u * cw * .18 + Math.cos(a) * rr, y = cy - u * ch * .04 + Math.sin(a) * rr * .45;
        if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawWeather(now){
    if (!weatherCtx || !weatherFx) return;
    const w = weatherFx.width, h = weatherFx.height, rain = env().rain;
    weatherCtx.clearRect(0, 0, w, h);
    if (!rain && !reduce && GAME && !sengoku() && st.walk && !gameIndoor && st.weather < 2 && look.ambient > 0) drawLight(now);
    if (!reduce && sengoku() && env().key === 'snow' && st.walk){
      // Snowfall: soft flakes in three depths drifting down and sideways with the wind.
      const cw = canvas.clientWidth, ch = canvas.clientHeight, count = lowEnd ? 110 : 240, t = now * .001;
      weatherCtx.save(); weatherCtx.scale(w / Math.max(1, cw), h / Math.max(1, ch)); weatherCtx.fillStyle = 'rgba(228,232,240,.75)';
      for (let i = 0; i < count; i++){
        const a = Math.sin((i + 1) * 91.731) * 43758.5453 % 1, b = Math.sin((i + 9) * 41.13) * 9283.21 % 1, depth = 1 + i % 3, r = .8 + depth * .75;
        const x = ((Math.abs(a) * (cw + 60) + t * (10 + 8 * depth) + Math.sin(t * .7 + i) * 14) % (cw + 60)) - 30, y = ((Math.abs(b) * (ch + 40) + t * (18 + 16 * depth)) % (ch + 40)) - 20;
        weatherCtx.globalAlpha = .35 + .2 * depth; weatherCtx.beginPath(); weatherCtx.arc(x, y, r, 0, 6.2832); weatherCtx.fill();
      }
      weatherCtx.restore();
    }
    if (!rain || reduce) return;
    weatherCtx.save();
    weatherCtx.scale(w / Math.max(1, canvas.clientWidth), h / Math.max(1, canvas.clientHeight));
    const cw = canvas.clientWidth, ch = canvas.clientHeight, count = lowEnd ? 65 : 145, t = now * 0.001;
    weatherCtx.lineWidth = lowEnd ? 0.8 : 1;
    weatherCtx.strokeStyle = 'rgba(205,225,232,.34)';
    weatherCtx.beginPath();
    for (let i = 0; i < count; i++){
      const seed = Math.sin((i + 1) * 91.731) * 43758.5453, a = seed - Math.floor(seed), b = Math.sin((i + 9) * 41.13) * 9283.21, c = b - Math.floor(b);
      const x = (a * (cw + 100) + t * 34 + i * 0.7) % (cw + 100) - 50, y = (c * (ch + 80) + t * (310 + (i % 7) * 24)) % (ch + 80) - 40;
      const len = 8 + (i % 6) * 2.2;
      weatherCtx.moveTo(x, y); weatherCtx.lineTo(x - 3.5, y + len);
    }
    weatherCtx.stroke(); weatherCtx.restore();
  }

  function frame(now){
    queued = false;
    updateWalk(now);
    if (anim) anim(now);
    if (spin) st.az -= 0.0016;
    draw();
    drawWeather(now);
    if ((st.walk && (walkKeys.size || gameInput.x || gameInput.y)) || anim || spin || (!reduce && !document.hidden && sea)) request();   // the water moves, so keep a slow loop while visible
  }
  let lastFrame = 0;
  function request(){ if (!queued){ queued = true; requestAnimationFrame(now => { if (now - lastFrame < (st.walk ? (lowEnd ? 32 : 16) : 40) && !anim && !spin){ queued = false; setTimeout(request, 40); return; } lastFrame = now; frame(now); }); } }

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
  function beginWalk(){
    if (!model || !terrain || st.walk) return;
    if (scene) leaveScene();
    orbitPose = { az: st.az, el: st.el, dist: st.dist, tx: st.tx, tz: st.tz, ty: st.ty };
    const spawn = toWorldTrue(490, 650);
    st.walk = true; st.wx = spawn[0]; st.wz = spawn[1]; st.walkGround = sampleGround(st.wx, st.wz) || 4.3;
    st.az = -2.96; st.el = 0.04; st.userLift = 1; st.exag = 1; st.walls = true;
    stopSpin(); anim = null; closeSpot(); walkLast = performance.now();
    canvas.classList.add('is-walk');
    if (walkPad) walkPad.hidden = false;
    syncUi(); say(T.walkReady); canvas.focus(); request();
  }
  function endWalk(silent){
    if (!st.walk) return;
    st.walk = false; walkKeys.clear(); canvas.classList.remove('is-walk');
    if (walkPad) walkPad.hidden = true;
    if (orbitPose) Object.assign(st, orbitPose);
    orbitPose = null; syncUi(); if (!silent) say(T.ready); request();
  }

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
    if (btnWalk){ btnWalk.textContent = st.walk ? T.orbit : T.walk; btnWalk.setAttribute('aria-pressed', String(st.walk)); }
    if (btnWeather){ btnWeather.textContent = (sengoku() ? [T.weatherDusk, T.weatherOvercast, T.weatherRain, T.weatherFog, T.weatherSnow, T.weatherNight] : [T.weatherClear, T.weatherCloudy, T.weatherRain, T.weatherFog])[st.weather] || T.weatherClear; }
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
  /* Walking labels for the inferred multi-floor studies, in every page language: the building's own name from
     gunkanjima-names.json (numbered blocks by pattern), falling back to the Japanese name. */
  const INFERRED = { ja: [' · 各階・屋上（推定）', '名称未確認'], en: [' · floors & roof (inferred)', 'Unnamed building'], ko: [' · 각 층·옥상(추정)', '이름 미확인 건물'],
    'zh-Hans': [' · 各层与屋顶（推定）', '名称未确认的建筑'], 'zh-Hant': [' · 各層與屋頂（推定）', '名稱未確認的建築'] };
  function inferredLabel(ja){
    const out = {}, m = numbered(ja), e = names && names.names[ja];
    for (const l of Object.keys(INFERRED)){
      const name = !ja ? INFERRED[l][1] : l === 'ja' ? ja : m && names ? (names.numbered.name[l] || names.numbered.name.en).split('{n}').join(m[1]) : (e && (e[l] || e.en)) || ja;
      out[l] = name + INFERRED[l][0];
    }
    return out;
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
      pin.hidden = sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20;
      pin.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
    }
    const showLabels = st.labels && st.walls && lift > 0.5 && (st.walk || st.dist < 420) && !scene;
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
    if (fly && !st.walk){
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
      + row(T.outline, esc(b.source === 'osm' ? T.outlineOsm : T.outlineAerial))
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
    if (fly && !st.walk){
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
    if (st.walk) endWalk(true);
    if (scene !== id){
      disposeScene(); scene = id;
      sceneMesh = buildBoxes(Object.assign({}, sc, { pass: 'solid' }));
      sceneMeshA = buildBoxes(Object.assign({}, sc, { pass: 'assumed' }));
      const hosts = model.buildings.filter(b => sc.buildingId ? b.id===sc.buildingId : sc.ghost && sc.ghost.includes(b.name));
      ghostId = hosts[0] ? hosts[0].bid : 0;
      ghostId2 = hosts[1] ? hosts[1].bid : -10;
    }
    stopSpin();
    /* a scene may add an approach: the camera arrives at the first view, then walks on (the shrine: through the torii to the worship hall) */
    const pose = c => { const p = toWorldTrue(c.u, c.v); return { tx: p[0], tz: p[1], ty: c.y, dist: c.dist, el: c.el, az: c.az }; };
    const walkOn = () => { if (sc.approach && scene === id) animate(pose(sc.approach), 3200); };
    if (fly) animate(Object.assign(pose(sc.camera), { userLift: 1 }), 1500, walkOn); else { Object.assign(st, pose(sc.camera)); walkOn(); }
    if ($('sceneNote')){
      const n = $('sceneNote');
      n.innerHTML = '<b>' + esc(T.interior) + '</b> ' + esc(pick(sc.text)) + ' <span class="scene-src">' + (sc.sources || []).map(x => '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(sourceLabel(x)) + '</a>').join(' · ') + '</span> <button type="button" id="sceneLeave">' + esc(T.leave) + '</button>';
      n.hidden = false;
      $('sceneLeave').onclick = leaveScene;
    }
    for (const b of document.querySelectorAll('.enter-btn')) b.textContent = enterLabel(b.dataset.scene);
    request();
  }
  function disposeScene(){ const free=mesh=>{if(!mesh)return;if(mesh.parts){mesh.parts.forEach(free);return;}for(const key of ['pos3','nor','col','mat','wind','idx'])if(mesh[key])gl.deleteBuffer(mesh[key]);};free(sceneMesh);free(sceneMeshA); }
  function leaveScene(){
    if (!scene) return;
    disposeScene(); scene = null; sceneMesh = null; sceneMeshA = null; ghostId = 0; ghostId2 = -10;
    if ($('sceneNote')) $('sceneNote').hidden = true;
    for (const b of document.querySelectorAll('.enter-btn')) b.textContent = enterLabel(b.dataset.scene);
    animate({ ty: 14, dist: Math.max(st.dist, 180), el: Math.max(st.el, 0.45) }, 900);
  }
  function closeSpot(){
    if (panel) panel.hidden = true;
    activeSpot = null;
    for (const k of Object.keys(pins)) pins[k].classList.remove('is-on');
  }
  if ($('spotClose')) $('spotClose').onclick = closeSpot;
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (panel && !panel.hidden) closeSpot();
    else if (st.walk && !GAME) endWalk(false);
  });

  function view(name, ms){
    stopSpin();
    if (st.walk) endWalk(true);
    if (scene) leaveScene();
    if (name === 'top') animate({ tx: 0, tz: 0, el: 1.35, dist: homeDistance() * 1.25 }, ms || 1400);
    else animate({ tx: 0, tz: 0, az: HOME.az, el: HOME.el, dist: homeDistance() }, ms || 1400);
  }

  /* ---------- input ---------- */
  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap()), r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
    if (weatherFx && (weatherFx.width !== w || weatherFx.height !== h)){ weatherFx.width = w; weatherFx.height = h; }
    request();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
  resize();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) request(); });

  const pointers = new Map();
  let pinch0 = 0;
  canvas.addEventListener('pointerdown', e => {
    stopSpin();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (!st.walk && pointers.size === 2){ const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  canvas.addEventListener('pointermove', e => {
    if (GAME && document.pointerLockElement === canvas) return;
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1){
      if (st.walk){
        st.az -= (e.clientX - prev[0]) * 0.0045;
        st.el = clamp(st.el - (e.clientY - prev[1]) * 0.0038, -1.05, 1.05);
      } else if (e.shiftKey || e.buttons === 4 || e.buttons === 2){
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
      const distance = Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]));
      st.dist = clamp(st.dist * pinch0 / distance, dMin(), dMax());
      pinch0 = distance;
    }
    request();
  });
  const release = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = 0; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);
  window.addEventListener('blur',()=>{pointers.clear();pinch0=0;});
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    if(e.ctrlKey||e.metaKey)return;
    e.preventDefault();
    stopSpin();
    if (st.walk) return;
    st.dist = clamp(st.dist * Math.exp(e.deltaY * 0.0012), dMin(), dMax());
    request();
  }, { passive: false });
  canvas.addEventListener('keydown', e => {
    if(e.ctrlKey||e.metaKey)return;
    const key = e.key.toLowerCase();
    if (st.walk && ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)){
      e.preventDefault(); walkKeys.add(key); request(); return;
    }
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
  canvas.addEventListener('keyup', e => walkKeys.delete(e.key.toLowerCase()));
  canvas.addEventListener('blur', () => walkKeys.clear());
  for (const b of document.querySelectorAll('[data-walk]')){
    const key = b.dataset.walk;
    const releaseWalk = () => walkKeys.delete(key);
    b.addEventListener('pointerdown', e => { e.preventDefault(); walkKeys.add(key); canvas.focus(); request(); });
    b.addEventListener('pointerup', releaseWalk); b.addEventListener('pointercancel', releaseWalk); b.addEventListener('pointerleave', releaseWalk);
  }

  if (btnFlat) btnFlat.onclick = () => { stopSpin(); animate({ userLift: st.userLift > 0.5 ? 0 : 1 }, 1100); };
  if (btnExag) btnExag.onclick = () => { animate({ exag: st.exag > 1.5 ? 1 : 2 }, 600); };
  if (btnChange) btnChange.onclick = () => { animate({ change: st.change > 0.5 ? 0 : 1 }, 500); };
  if (btnWalls) btnWalls.onclick = () => { st.walls = !st.walls; syncUi(); request(); };
  if (btnLabels) btnLabels.onclick = () => { st.labels = !st.labels; syncUi(); request(); };
  if (btnWalk) btnWalk.onclick = () => { if (st.walk) endWalk(false); else beginWalk(); };
  if (btnWeather) btnWeather.onclick = () => { st.weather = (st.weather + 1) % weatherCount(); syncUi(); request(); };
  if (btnReset) btnReset.onclick = () => { if (st.walk) endWalk(true); if (scene) leaveScene(); view('overview', 900); animate({ userLift: 1, ty: 14 }, 900); };
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
    if (st.walk) endWalk(true);
    const cue = applyCues(lines, t), key = JSON.stringify(cue);
    if (key === lastCueKey) return;
    lastCueKey = key;
    stopSpin();
    const to = {};
    if (cue.year !== null){ const i = years.findIndex(y => y.id === cue.year); if (i >= 0){ to.year = i; texture(i); } }
    if (cue.lift !== null) to.userLift = cue.lift;
    if (cue.change !== null) to.change = cue.change ? 1 : 0;
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
      if (GAME) buildNature();
      st.year = Math.max(0, years.findIndex(y => y.id === '1962'));
      buildPins();
      return texture(st.year).promise;
    });
  }).then(() => {
    for (const c of controls) if (c) c.disabled = false;
    say(T.ready);
    st.dist = homeDistance();
    syncUi();
    /* /3d/…?scene=no65roof or #scene=…: open the page already inside a room (shared links, checks) */
    const wantScene = (/[?&#]scene=([a-z0-9]+)/i.exec(location.search + ' ' + location.hash) || [])[1];
    if (!GAME && wantScene && interiors && interiors.scenes[wantScene]){ st.lift = 1; st.userLift = 1; enterScene(wantScene, false); request(); return; }
    if (GAME){ st.lift=1; initGame(); return; }
    if (reduce){ st.lift = 1; request(); return; }
    st.el = 1.2;
    animate({ lift: 1, el: HOME.el }, 2200, () => { spin = true; request(); });
    setTimeout(() => years.forEach((y, i) => texture(i)), 2500);
  }).catch(err => {
    console.error(err);
    fallback(T.failed);
  });

  // Curated walking views for cutaway source scenes; independent of their orbit cameras.
  const WALK_ENTRY_VIEWS = { no65flat: { u:655.15, v:437.21, target:[656.33,435.26], el:-.60 } };
  function gameEnter(id){
    let sc=interiors && interiors.scenes[id]; if(!sc)return false;
    if(sc.generatedBuilding){const b=sc.generatedBuilding;if(!buildingAlive(b))return false;sc=window.JTAWalkBuildings.build(b,model.coast);if(!sc)return false;sc.buildingId=b.id;sc.label=Object.assign(inferredLabel(b.name),{ja:sc.label.ja});interiors.scenes[id]=sc;}
    if(!sc.inferred && window.JTAWalkInteriors){sc=window.JTAWalkInteriors.complete(sc,id);interiors.scenes[id]=sc;}
    if(sc.buildingId && !buildingAlive(model.buildings.find(b=>b.id===sc.buildingId)))return false;
    const entry=WALK_ENTRY_VIEWS[id]||sc.walkEntry;
    const spawn=window.JTAWalkNav.spawn(entry?{...sc,camera:entry}:sc,mpp); if(!spawn)return false;
    if(!gameIndoor)outsidePose={wx:st.wx,wz:st.wz,walkGround:st.walkGround,az:st.az,el:st.el};
    enterScene(id,false); anim=null; gameIndoor=true;
    const w=toWorldTrue(spawn.u,spawn.v);
    st.walk=true; st.wx=w[0];st.wz=w[1];st.walkGround=spawn.y;st.el=0;st.az=sc.inferred?-(sc.walkPlan.a+rot):sc.camera.az+Math.PI;
    if(entry){
      const target=toWorldTrue(...entry.target);
      st.az=Math.atan2(target[0]-w[0],target[1]-w[1]);st.el=entry.el;
    }else if(!sc.inferred){
      let best=-1;
      for(let i=0;i<24;i++){const a=i*Math.PI/12;let score=0,y=spawn.y;
        for(let d=.35;d<=4;d+=.35){const uv=fromWorld(w[0]+Math.sin(a)*d,w[1]+Math.cos(a)*d);const h=window.JTAWalkNav.ground(sc,uv[0],uv[1],mpp,y);if(h===null)break;y=h;score=d;}
        if(score>best){best=score;st.az=a;}
      }
    }
    canvas.classList.add('is-walk'); walkKeys.clear();gameInput.x=gameInput.y=0;
    if($('sceneNote'))$('sceneNote').hidden=true;
    closeSpot(); canvas.focus();request(); return true;
  }
  function gameLeave(){
    if(!gameIndoor)return;
    gameIndoor=false; leaveScene(); anim=null;st.walk=true;
    if(outsidePose)Object.assign(st,outsidePose);outsidePose=null;
    walkKeys.clear();gameInput.x=gameInput.y=0;canvas.focus();request();
  }
  function initGame(){
    for(const b of model.buildings){
      const p=window.JTAWalkBuildings.plan(b,model.coast);if(!p)continue;
      const x=p.x,z=p.z;const u=(x*p.c-z*p.s)/mpp,v=(x*p.s+z*p.c)/mpp;
      interiors.scenes['building-'+b.id]={building:b.name,camera:{u,v},label:inferredLabel(b.name),generatedBuilding:b,inferred:true,buildingId:b.id};
    }
    beginWalk();
    window.dispatchEvent(new CustomEvent('jta-walk-ready'));
  }
  window.jtaLab3d = { st, draw: () => draw(), view, setYear, openSpot, closeSpot, enterScene, leaveScene, beginWalk, endWalk, scene: () => scene, openBuilding: name => { const b = model.buildings.find(x => x.name === name); if (b) openBuilding(b, true); },
    game: { input: gameInput, enter: gameEnter, leave: gameLeave, indoor:()=>gameIndoor, reset:()=>{gameLeave();endWalk(true);beginWalk();}, fromWorld, toWorldTrue, canWalk, floor:()=>{const sc=scene&&interiors.scenes[scene];return sc&&sc.walkPlan?{current:Math.min(sc.walkPlan.floors,Math.floor((st.walkGround-sc.walkPlan.base+.18)/sc.walkPlan.height)),total:sc.walkPlan.floors}:null;}, year:()=>Math.round(yearMix().year), scenes:()=>interiors?interiors.scenes:{}, nature:()=>nature?nature.set:null, skies:()=>(sengoku()?SENGOKU:WEATHER).map(s=>s.key), appearance:{ get:()=>Object.assign({}, look), set:patch=>{const v=setLook(patch);request();return v;}, styles:()=>Object.keys(LOOK_STYLES), reset:()=>{Object.assign(look, LOOK_DEFAULT);resize();return Object.assign({}, look);}, ranges:()=>JSON.parse(JSON.stringify(LOOK_RANGE)), presets:()=>Object.keys(PRESETS), qualities:()=>Object.keys(QUALITY) }, pause:()=>{walkKeys.clear();gameInput.x=gameInput.y=0;gameInput.run=false;gameInput.autoRun=false;}, look:(x,y)=>{st.az-=x*0.0045;st.el=clamp(st.el-y*0.0038,-0.9,0.9);request();}, request },
    years: () => years.map(y => y.id), loaded: i => texture(i).promise, shadows: () => !!shadowFb, walls: () => !!walls, model: () => model };
})();
