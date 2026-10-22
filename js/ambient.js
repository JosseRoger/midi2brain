// Living background. A WebGL shader draws a soft fluid field into a low-res canvas inside .ambient; the CSS grain
// layers sit on top. Colours always come from the theme tokens (--bg, --haze*, --glow-*), re-read periodically so
// light/dark switching keeps working.
//
// Look: the warm shapes are solid, softly edged bodies with a rim light, a shaded interior and an orange-to-teal outer
// glow (see main() in the shader); the cool haze drifts behind them.
// The scene is a small, changing set of shapes (cool haze, warm glows, small glows, a lit arc, a diagonal streak):
// - on startup a couple of shapes fade in;
// - every shape lives about 30 seconds, then gently fades away by itself;
// - shapes deform: every few seconds each eases into a new form (glows stretch into streaks or crescents and round
//   up again, the streak lengthens, thickens or gathers into a blob, the arc swells and thins);
// - a correct chord/scale sends a visible bloom (warm glow swelling from the middle, a ripple pushing shapes outward)
//   and quickly fades in a new shape; a wrong one sends a gust (all shapes nudged the same way) and fades one out
//   (watches #stage and #song-stage for ok / bad);
// - notes only move things: pressing pushes nearby shapes away from the note's spot, releasing sends a ripple
//   away from the spot whose momentum grows with how long the note was held; held notes also speed up the drift.
// Nothing pops or jerks: movement follows simple physics (pushes are forces that build up and die away, momentum,
// smooth drag, steering that fades in), and every change of presence, speed or form is eased.
// Standalone: reads the globals `held` (trainer.js) and `masterLimiterNode` (audio.js) at runtime only.
(function () {
  const box = document.querySelector('.ambient');
  if (!box) return;
  box.textContent = '';

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const sign = () => (Math.random() < .5 ? -1 : 1);
  const TAU = Math.PI * 2;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- settings (Settings panel → Visuals → Background) ----------
  // Built like the Synth control in audio.js: the switch turns the moving background on/off (off = everything holds
  // still), the rest of the row opens a popup with sliders (data-bg-setting="<key>") plus Randomise / Reset.
  // Values live in cfg, are saved to localStorage and are read live by the engine.
  const BG_KEY = 'piano-trainer-background';
  const DEFAULTS = { speed: 1, response: 1, intensity: 1, morph: 1, life: 30, shapes: 10, grain: 1 };
  const cfg = Object.assign({ on: true }, DEFAULTS);
  let onBackgroundSwitch = () => {}; // set with the shapes below: the switch fades them out / brings them back
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(BG_KEY)) || {}); } catch (e) { /* storage unavailable */ }
  const saveCfg = () => {
    if (document.documentElement.classList.contains('lite')) return; // light version: its settings are not saved
    try { localStorage.setItem(BG_KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ }
  };
  function applyCfg() {
    document.documentElement.style.setProperty('--grain-mul', cfg.grain);
    document.documentElement.classList.toggle('bg-still', !cfg.on); // theme.css stops the moving grain too
  }
  (function bindSettings() {
    const details = document.getElementById('bg-menu'), panel = document.getElementById('bg-panel');
    if (!details || !panel) { applyCfg(); return; }
    const summary = details.querySelector('summary'), indicator = details.querySelector('.chord-category-menu-indicator');
    const sw = summary.querySelector('.toggle-switch'), input = document.getElementById('opt-background');
    const sliders = [...panel.querySelectorAll('[data-bg-setting]')];
    document.body.appendChild(panel); // a fixed popup inside the (filtered) settings panel would be positioned wrongly

    // on/off switch: clicking it never opens the popup
    input.checked = cfg.on;
    sw.addEventListener('click', event => {
      event.stopPropagation();
      if (event.target !== input) { event.preventDefault(); input.checked = !input.checked; input.dispatchEvent(new Event('change')); }
    });
    input.addEventListener('change', () => { cfg.on = input.checked; applyCfg(); saveCfg(); onBackgroundSwitch(cfg.on); });

    // popup open/close, same rules as the other category menus (the shared outside-click handler closes it too)
    const position = () => {
      const s = summary.getBoundingClientRect(), p = panel.getBoundingClientRect();
      let top = s.bottom + 4;
      if (top + p.height > innerHeight - 8) top = Math.max(8, s.top - p.height - 4);
      panel.style.left = `${Math.max(8, Math.min(s.left, innerWidth - p.width - 8))}px`;
      panel.style.top = `${top}px`;
    };
    summary.addEventListener('click', event => {
      if (event.target.closest('.toggle-switch')) return;
      event.preventDefault();
      document.querySelectorAll('.chord-category[open]').forEach(c => {
        if (c !== details) { c.open = false; c.querySelector('.chord-category-menu-indicator').textContent = '+'; }
      });
      document.querySelectorAll('.chord-category-items').forEach(menu => { menu.hidden = true; });
      details.open = !details.open;
      indicator.textContent = details.open ? '-' : '+';
      if (details.open) { panel.hidden = false; requestAnimationFrame(position); }
    });

    // sliders, randomise, reset
    const showValues = () => { for (const el of sliders) el.value = cfg[el.dataset.bgSetting]; };
    for (const el of sliders) el.addEventListener('input', () => { cfg[el.dataset.bgSetting] = +el.value; applyCfg(); saveCfg(); });
    const set = values => { Object.assign(cfg, values); showValues(); applyCfg(); saveCfg(); };
    // Randomise within ranges that keep the vibe (no frozen or maxed-out extremes), snapped to each slider's step.
    const RANDOM = { speed: [.4, 2.2], response: [.4, 2.4], morph: [.3, 2], intensity: [.6, 1.5], life: [15, 90], shapes: [3, 12], grain: [.4, 1.6] };
    const randomCfg = () => Object.fromEntries(sliders.map(el => {
      const [lo, hi] = RANDOM[el.dataset.bgSetting], step = +el.step;
      return [el.dataset.bgSetting, +(Math.round(rnd(lo, hi) / step) * step).toFixed(2)];
    }));
    document.getElementById('bg-random').addEventListener('click', () => set(randomCfg()));
    document.getElementById('bg-reset').addEventListener('click', () => set(DEFAULTS));
    showValues();
    applyCfg();
  })();

  const canvas = document.createElement('canvas');
  box.appendChild(canvas);
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) { // no WebGL: a static gradient in the same spirit
    canvas.remove();
    box.style.background = 'radial-gradient(60% 50% at 12% 30%, var(--haze), transparent), radial-gradient(40% 45% at 45% 110%, var(--glow-2), transparent), var(--bg)';
    return;
  }

  // ---------- shader ----------
  const MAX = 16; // blobs passed to the shader
  const frag = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uTime, uWarp, uGlowOp, uIntensity;
uniform vec2 uBloom;                                            // correct-answer bloom: strength, spread (radius²)
uniform vec4 uBlob[${MAX}]; uniform int uCount;               // xy, radius, strength (>0 warm, <0 cool)
uniform vec4 uBlobForm[${MAX}];                                 // cos / sin of the long axis, stretch (1 = round), bend
uniform vec3 uBg, uHaze, uHaze2, uG1, uG2, uG3;
uniform vec4 uArc; uniform float uArcWobble, uArcG;             // cx, cy, radius, thickness; presence
uniform vec4 uStreak; uniform float uStreakBend, uStreakPhase, uStreakG; // x, y, angle, thickness; presence
uniform float uStreakLen;                                       // length falloff: small = long line, large = short, blob-like

// Smooth flow field from layered, rotated sine waves: no lattice, so no square / blocky artifacts.
vec2 flow(vec2 p, float t) {
  vec2 a = vec2(sin(p.y * 1.3 + t * .11) + sin((p.x + p.y) * .8 - t * .07 + 1.7),
                sin(p.x * 1.1 - t * .09 + 2.3) + sin((p.x - p.y) * .9 + t * .06));
  p += a * .25; // fold once more for a more liquid, less regular look
  return vec2(sin(p.y * 1.7 + t * .05 + a.x), sin(p.x * 1.5 - t * .04 + a.y)) * .5;
}

// The shape field at a point: F = warm bodies (glows, the streak, the arc, the bloom), C = cool teal haze.
float field(vec2 q, out float C) {
  float F = 0.;
  C = 0.;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uCount) break;
    vec4 b = uBlob[i], f = uBlobForm[i];
    // the blob's own frame: stretched along its long axis (same area), the cross axis curved by the bend,
    // so a round glow can draw out into a streak or a crescent and back
    vec2 d = q - b.xy;
    float u = d.x * f.x + d.y * f.y, v = d.y * f.x - d.x * f.y;
    v -= f.w * u * u / b.z;
    float g = exp(-(u * u / f.z + v * v * f.z) / (b.z * b.z));
    if (b.w > 0.) F += g * b.w; else C -= g * b.w;
  }
  if (uArcG > 0.) { // the arc: a huge body mostly off screen whose rim sways gently
    vec2 d = q - uArc.xy;
    float dist = length(d), ang = atan(d.y, d.x);
    float R = uArc.z * (1. + uArcWobble * .5 * (sin(ang * 3. + uTime * .2) * .6 + sin(ang * 5. - uTime * .13 + 1.3) * .4));
    F += uArcG * smoothstep(-uArc.w, R * .8, R - dist);
  }
  if (uStreakG > 0.) { // a ribbon that bends like a slow wave
    vec2 d = q - uStreak.xy, dir = vec2(cos(uStreak.z), sin(uStreak.z)), nrm = vec2(-dir.y, dir.x);
    float along = dot(d, dir);
    float s = (dot(d, nrm) + uStreakBend * sin(along * 3. + uStreakPhase)) / uStreak.w;
    F += exp(-s * s) * exp(-along * along * uStreakLen) * uStreakG * .85;
  }
  if (uBloom.x > 0.) { // correct answer: bodies near the middle swell and everything warms a little
    vec2 dc = q - uRes / min(uRes.x, uRes.y) * vec2(.5, .58);
    F = (F + uBloom.x * .35 * exp(-dot(dc, dc) / uBloom.y)) * (1. + uBloom.x * .2);
    C *= 1. - uBloom.x * .15;
  }
  return F * uIntensity * uGlowOp;
}

void main() {
  vec2 p = gl_FragCoord.xy / min(uRes.x, uRes.y); // shorter side = 1, so shapes fit portrait screens too
  // slow flowing domain warp: this is what makes every shape morph
  vec2 q = p + uWarp * flow(p, uTime);

  // The look: the warm field is cut at a threshold into solid bodies with a soft edge. Each body has a bright rim
  // light hugging its edge, an interior falling from orange through deep red into a shadowed core, white-hot spots
  // where bodies overlap, and an outer glow that cools from orange to teal away from the edge. Lit from the upper
  // left: sampling the field a step towards the light tells which side of a body faces it.
  float C, Cl;
  float F = field(q, C);
  float lit = clamp((F - field(q + vec2(-.045, .045), Cl)) * 5., -1., 1.); // > 0: this side faces the light
  const float T = .3;
  float e = F - T;
  float soft = mix(.035, .1, .5 + .5 * sin(q.x * 2.3 + q.y * 1.7 + uTime * .07)); // edge softness varies along it
  float body = smoothstep(-soft, soft, e);

  // background: near-black base with the teal haze drifting through it
  C *= uIntensity;
  vec3 col = mix(uBg, uHaze, smoothstep(.1, 1.3, C) * .55);
  col = mix(col, uHaze2, smoothstep(1., 2., C) * .2);
  // outer glow: orange right at a body's edge, cooling to teal further out
  float halo = pow(smoothstep(0., T, F), 2.) * (1. - body);
  col = mix(col, mix(uHaze2 * 1.4, uG2, smoothstep(T * .45, T * .95, F)), halo * .75);
  // interior: orange at the edge, deep red, then a shadowed core (lighter on the lit side), white-hot where bodies pile up
  vec3 inner = mix(uG2, uG3, smoothstep(0., .2, e));
  inner = mix(inner, uBg * .9 + uG3 * .15, smoothstep(.15, .55, e) * (.6 - .3 * lit));
  inner = mix(inner, uG1, smoothstep(1., 1.7, F) * .85);
  col = mix(col, inner, body);
  // rim light along the edge, brightest where it faces the light
  float rw = soft * 1.6, rim = exp(-e * e / (rw * rw));
  col = mix(col, mix(uG2, uG1, .35 + .45 * lit), rim * (.5 + .35 * lit));
  gl_FragColor = vec4(col, 1.);
}`;
  const vert = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0., 1.); }';
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn('ambient shader:', gl.getShaderInfoLog(s));
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(prog, 0, 'a');
  gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one big triangle
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ['uRes', 'uTime', 'uWarp', 'uGlowOp', 'uIntensity', 'uBlob', 'uCount', 'uBg', 'uHaze', 'uHaze2', 'uG1', 'uG2', 'uG3',
    'uArc', 'uArcWobble', 'uArcG', 'uStreak', 'uStreakBend', 'uStreakPhase', 'uStreakG', 'uBloom', 'uBlobForm', 'uStreakLen'])
    U[n] = gl.getUniformLocation(prog, n);

  // Rendered at reduced size (the field is soft, the browser upscales smoothly and the grain hides the rest).
  // Shader space is measured in units of the shorter screen side: x 0..W, y 0..H (one of them is 1).
  let W = 1, H = 1;
  function resize() {
    const w = Math.max(160, Math.round(Math.min(innerWidth, 1800) / 2.5));
    canvas.width = w;
    canvas.height = Math.max(90, Math.round(w * innerHeight / innerWidth));
    const m = Math.min(canvas.width, canvas.height);
    W = canvas.width / m; H = canvas.height / m;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
  }
  addEventListener('resize', resize);
  resize();

  // ---------- theme colours (any CSS colour -> rgb 0..1) ----------
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  function rgb(v) {
    probe.fillStyle = '#000';
    probe.fillStyle = v || '#000';
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
  }
  // Colours cross-fade: readTheme() sets targets, blendTheme() eases the shader colours towards them every frame,
  // so switching palette melts over ~1.5s instead of jumping.
  const COLORS = { uBg: '--bg', uHaze: '--haze', uHaze2: '--haze-2', uG1: '--glow-1', uG2: '--glow-2', uG3: '--glow-3' };
  const target = {}, current = {};
  let glowOpTarget = .8, glowOp = null;
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    for (const u in COLORS) target[u] = rgb(cs.getPropertyValue(COLORS[u]).trim());
    glowOpTarget = parseFloat(cs.getPropertyValue('--glow-opacity')) || .8;
  }
  function blendTheme(dt) {
    const k = glowOp === null ? 1 : 1 - Math.exp(-dt * 2.5); // first frame: take the colours as they are
    for (const u in COLORS) {
      const c = current[u] || (current[u] = target[u].slice());
      for (let j = 0; j < 3; j++) c[j] += (target[u][j] - c[j]) * k;
      gl.uniform3fv(U[u], c);
    }
    glowOp = glowOp === null ? glowOpTarget : glowOp + (glowOpTarget - glowOp) * k;
    gl.uniform1f(U.uGlowOp, glowOp);
  }
  new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-palette', 'data-theme'] });

  // ---------- shapes (shader space: x 0..W, y 0 = bottom .. H = top) ----------
  // Every shape has a presence g (0..1) that fades in / out along a smoothstep curve (soft start, soft end, no pop),
  // an age, and a lifespan (~30s) after which it fades out by itself. Blobs also roam freely: a slowly meandering
  // heading and a gentle cruising speed.
  // The arc and the streak are single forms (at most one of each) with the same presence / lifespan logic.
  const FADE_IN = 3, FADE_OUT = 5; // seconds (lifespan and shape limit come from the settings: cfg.life, cfg.shapes)
  const blobs = [];
  let arc = null, streak = null;
  const anywhere = () => ({ x: rnd(.08, .92) * W, y: rnd(.08, .92) * H });
  // spanK: this shape's share of the lifespan setting (varied a little so shapes don't all fade together)
  const presence = (o, spanK) => Object.assign(o, { g: 0, p: 0, goal: 1, age: 0, spanK: spanK || rnd(.83, 1.17) });

  const KINDS = {
    haze: () => ({ r: rnd(.4, .58), s: -rnd(.8, 1.05), band: 'all' }),
    warm: () => ({ r: rnd(.26, .42), s: rnd(.65, .85), band: pick(['low', 'mid']) }),
    glow: () => ({ r: rnd(.15, .24), s: rnd(.45, .6), band: pick(['mid', 'high']) }),
  };
  function makeBlob(kind, span) {
    // fx/fy: pending velocity change from notes, handed over gradually (see pushDir())
    const b = presence(Object.assign(anywhere(), KINDS[kind](), {
      kind, vx: 0, vy: 0, fx: 0, fy: 0, heading: rnd(0, TAU), turn: 0, cruise: rnd(.016, .032),
    }), span);
    b.vx = Math.cos(b.heading) * b.cruise; b.vy = Math.sin(b.heading) * b.cruise; // already drifting when it appears
    Object.assign(b, { a: rnd(0, TAU), st: 1, bend: 0, morphIn: rnd(0, 4) }); // form: angle, stretch, bend (see morph())
    blobs.push(b);
    return b;
  }
  function makeArc(span) {
    arc = presence({ kind: 'arc', x: pick([rnd(-.15, .1), rnd(.9, 1.15)]) * W, y: pick([rnd(.95, 1.2), rnd(-.2, .05)]) * H,
      R: rnd(.5, .75), th: rnd(.06, .1), morphIn: rnd(3, 8) }, span);
    gl.uniform4f(U.uArc, arc.x, arc.y, arc.R, arc.th);
    return arc;
  }
  function makeStreak(span) {
    streak = presence({ kind: 'streak', x: rnd(.3, .7) * W, y: rnd(.25, .75) * H, a: sign() * rnd(15, 35) * Math.PI / 180,
      th: rnd(.08, .13), len: .35, wave: 1, band: pick(['mid', 'high']), morphIn: rnd(3, 8) }, span);
    gl.uniform4f(U.uStreak, streak.x, streak.y, streak.a, streak.th);
    return streak;
  }

  // ---------- deforming shapes ----------
  // Every few seconds each shape picks a new form and slowly eases into it: glows can draw out into streaks or
  // crescents and round up again, the streak can lengthen, thicken, bend harder or shrink into a soft blob, the
  // arc swells and thins. Stretched blobs keep lining up with the way they drift (aOff: their lean off it), like a
  // drop drawn out by its own motion, so they read as flowing.
  const FORMS = {
    blob(b) {
      const long = b.kind !== 'haze' && Math.random() < .5;
      b.stT = b.kind === 'haze' ? rnd(1, 2.2) : long ? rnd(2.2, b.kind === 'glow' ? 5 : 4) : rnd(1, 1.5);
      b.bendT = long ? rnd(-.3, .3) : rnd(-.08, .08);
      if (long) { b.aOff = rnd(-.6, .6); b.aT = undefined; } else { b.aOff = undefined; b.aT = b.a + rnd(-1.2, 1.2); }
    },
    streak(s) {
      const short = Math.random() < .3; // now and then the line gathers into a soft blob
      s.lenT = short ? rnd(1, 2.5) : rnd(.12, .45);
      s.thT = short ? rnd(.14, .22) : rnd(.06, .14);
      s.waveT = rnd(.5, 3);
      s.aT = s.a + rnd(-.5, .5);
    },
    arc(a) { a.RT = rnd(.45, .8); a.thT = rnd(.05, .12); },
  };
  // Every form value moves like a mass on a critically damped spring towards its goal (its speed kept in
  // s[key + 'V']): it gathers speed, then settles without overshoot, so a new goal never starts a change with a jolt.
  const spring = (s, key, goal, w, dt) => {
    const v = (s[key + 'V'] || 0) + (-2 * w * (s[key + 'V'] || 0) - w * w * (s[key] - goal)) * dt;
    s[key + 'V'] = v; s[key] += v * dt;
  };
  function morph(s, dt) {
    if ((s.morphIn -= dt) <= 0) { s.morphIn = rnd(5, 12); FORMS[s.kind === 'arc' || s.kind === 'streak' ? s.kind : 'blob'](s); }
    for (const key of ['st', 'bend', 'len', 'th', 'wave', 'R']) if (s[key + 'T'] !== undefined) spring(s, key, s[key + 'T'], 1.2, dt); // ~4s into a new form
    const aGoal = s.aOff !== undefined ? Math.atan2(s.vy, s.vx) + s.aOff : s.aT;
    if (aGoal !== undefined) spring(s, 'a', s.a + angleTo(s.a, aGoal), 1, dt);
  }
  // Window resized: move every shape with the screen so none is left outside it.
  let lastW = W, lastH = H;
  addEventListener('resize', () => { // runs after resize() above, so W / H are already the new size
    const kx = W / lastW, ky = H / lastH;
    lastW = W; lastH = H;
    for (const s of [...blobs, arc, streak]) if (s) { s.x *= kx; s.y *= ky; }
    if (arc) gl.uniform4f(U.uArc, arc.x, arc.y, arc.R, arc.th);
    if (streak) gl.uniform4f(U.uStreak, streak.x, streak.y, streak.a, streak.th);
  });
  const alive = () => [...blobs, arc, streak].filter(s => s && s.goal === 1);
  // How alive the scene is, 0 (nothing left) .. 1 (at the shape limit), for the ambient drone (js/audio.js).
  // Sums every shape's presence, so it rises and falls smoothly as shapes fade in and out.
  window.ambientLife = () => {
    let sum = 0;
    for (const s of cfg.on ? [...blobs, arc, streak] : ghosts) if (s) sum += s.g;
    return Math.min(1, sum / Math.max(1, cfg.shapes));
  };
  // Ghost shapes: while the background is switched off (always in the light version) nothing is drawn, but the
  // scene is still kept count of, invisibly, by the same rules: a correct answer adds one, a wrong one fades one
  // out, each fades out at the end of its lifespan. ambientLife reads them, so the drone rises and falls just as it
  // does with the background on. They take over the visible shapes' state when it is switched off.
  let ghosts = [];
  const ghostsAlive = () => ghosts.filter(s => s.goal === 1);
  function addGhost(span) {
    if (ghostsAlive().length >= cfg.shapes) return;
    return ghosts[ghosts.push(presence({ kind: 'ghost' }, span)) - 1];
  }
  function removeGhost() {
    const live = ghostsAlive();
    if (live.length) pick(live).goal = 0;
  }
  // Background switched off (and the light version, setLite in js/core.js): every shape fades out quickly, even
  // though the scene is otherwise frozen, leaving a plain background. Switched back on, it starts over like on load.
  let clearing = false;
  function clearShapes() {
    clearing = true;
    for (const s of [...blobs, arc, streak]) if (s) { s.goal = 0; s.fadeOut = 1.5; }
  }
  window.ambientClear = clearShapes;
  function seedShapes() { // a couple of shapes, with staggered lifespans so they don't all fade at once
    makeBlob('haze', rnd(.83, 1.5));
    makeBlob('warm', rnd(.83, 1.5));
    addShape(rnd(.83, 1.5));
  }
  onBackgroundSwitch = on => {
    if (!on) { // the ghosts carry on where the visible shapes are now
      ghosts = [...blobs, arc, streak].filter(s => s && s.goal === 1)
        .map(s => ({ kind: 'ghost', g: s.g, p: s.p, goal: 1, age: s.age, spanK: s.spanK, fadeIn: s.fadeIn }));
      clearShapes();
      return;
    }
    ghosts = [];
    clearing = false;
    if (!alive().length) seedShapes();
  };

  // A new shape, from the same rules: mostly glows and haze, an arc or streak only if there isn't one already.
  function addShape(span) {
    if (alive().length >= cfg.shapes) return;
    const kinds = ['warm', 'warm', 'glow', 'glow', 'haze'];
    if (!arc) kinds.push('arc');
    if (!streak) kinds.push('streak');
    const kind = pick(kinds);
    return kind === 'arc' ? makeArc(span) : kind === 'streak' ? makeStreak(span) : makeBlob(kind, span);
  }
  function removeShape() {
    const live = alive();
    if (live.length) pick(live).goal = 0;
  }

  // startup: a couple of shapes (none while the background is switched off)
  if (cfg.on) seedShapes();
  else for (let i = 0; i < 3; i++) addGhost(rnd(.83, 1.5)); // the same start, kept count of invisibly

  // #stage (trainer) and #song-stage (Songs tab) both flash ok / bad
  ['stage', 'song-stage'].map(id => document.getElementById(id)).filter(Boolean).forEach(stage => {
    let prevState = '';
    new MutationObserver(() => {
      const s = stage.classList.contains('ok') ? 'ok' : stage.classList.contains('bad') ? 'bad' : '';
      if (s === prevState) return;
      prevState = s;
      if (!cfg.on) { if (s === 'ok') { const g = addGhost(); if (g) g.fadeIn = 2; } else if (s === 'bad') removeGhost(); return; } // switched off: only the ghosts
      if (s === 'ok') celebrate(); else if (s === 'bad') shiver();
    }).observe(stage, { attributes: true, attributeFilter: ['class'] });
  });

  // ---------- listening (movement only) ----------
  // Energy per register (low < C3 <= mid < C5 <= high) from held notes + synth loudness, eased over seconds.
  const level = { low: 0, mid: 0, high: 0, all: 0 };
  const bandOf = n => (n < 48 ? 'low' : n < 72 ? 'mid' : 'high');
  let prevHeld = new Set(), analyser = null, buf = null;
  function loudness() {
    if (!analyser) {
      if (typeof masterLimiterNode === 'undefined' || !masterLimiterNode) return 0;
      analyser = masterLimiterNode.context.createAnalyser();
      analyser.fftSize = 512;
      buf = new Float32Array(analyser.fftSize);
      masterLimiterNode.connect(analyser);
    }
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    return Math.min(1, Math.sqrt(sum / buf.length) * 4);
  }

  // A note adds a push (fx/fy: momentum still to deliver). It acts as a force (ax/ay) that builds up over a fraction
  // of a second, delivers the push over ~1.5s and dies away again, so a shape is never jolted: it speeds up, then
  // coasts and relaxes back to its own cruising drift over several seconds. No anchor points, so nothing snaps back
  // like a rubber band. (PUSH_RAMP > 4 × PUSH_RATE keeps this overdamped: the force never swings back.)
  const PUSH_RATE = .7, PUSH_RAMP = 3;
  const MAX_PUSH = .07, MAX_SPEED = .1; // many quick notes must not add up to a fling
  const capLen = (o, kx, ky, max) => { const l = Math.hypot(o[kx], o[ky]); if (l > max) { o[kx] *= max / l; o[ky] *= max / l; } };
  const pushDir = (b, ang, mag) => { b.fx += Math.cos(ang) * mag; b.fy += Math.sin(ang) * mag; capLen(b, 'fx', 'fy', MAX_PUSH * Math.max(1, cfg.response)); };
  const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from)); // shortest signed turn
  let arcGoal = 0, bendGoal = 0, arcKick = 0, bendKick = 0, streakPhase = 0, time = rnd(0, 100);
  // A ripple: blobs drift away from a spot, more so the closer they are and if they share its register.
  function ripple({ px, py, band }, size) {
    for (const b of blobs) {
      const d = Math.hypot(b.x - px, b.y - py);
      const mag = size * Math.exp(-d * 1.2) * (b.band === band || b.band === 'all' ? 1 : .5);
      pushDir(b, Math.atan2(b.y - py, b.x - px) + rnd(-.15, .15), mag);
    }
  }
  // Pressing a note gives a slight nudge; releasing it sends the real push, sized by how long it was held:
  // a tap barely moves things, a note held ~3s or more sends shapes on a long, sweeping drift.
  const HOLD_FULL = 3; // seconds of holding for the strongest push
  const pressed = new Map(); // note -> { px, py, band, t }
  function onNote(n, now) {
    // the note's spot: across the screen by pitch (low left, high right), at a random height
    const spot = { px: Math.min(.95, Math.max(.05, (n - 21) / 87)) * W, py: rnd(.1, .9) * H, band: bandOf(n), t: now };
    pressed.set(n, spot);
    ripple(spot, .02 * cfg.response); // a press pushes the shapes near the note away
    arcGoal = Math.min(.15, arcGoal + .04);
    bendGoal = Math.min(.04, bendGoal + .01);
  }
  function onRelease(n, now) {
    const spot = pressed.get(n);
    if (!spot) return;
    pressed.delete(n);
    const hold = Math.min(1, (now - spot.t) / 1000 / HOLD_FULL);
    ripple(spot, (.006 + .05 * hold * (2 - hold)) * cfg.response); // ease-out: the first second of holding counts most
  }

  // A correct chord / scale: a bloom (a warm glow swelling out from the middle, the whole field brightening for a
  // few seconds), a ripple that pushes every shape outward, and a new shape that fades in quickly.
  // Sized by the Response setting.
  let bloom = 0, bloomGoal = 0;
  function celebrate() {
    bloomGoal = Math.min(1, .5 * cfg.response);
    if (!still) ripple({ px: W / 2, py: H * .58, band: 'all' }, .045 * cfg.response);
    arcGoal = Math.min(.15, arcGoal + .06);
    bendGoal = Math.min(.04, bendGoal + .02);
    const s = addShape();
    if (s) s.fadeIn = 2;
  }
  // A wrong chord / scale (also a single stray note): a gust sweeps through, nudging every shape the same way (give
  // or take a little), and one shape fades out. No colour change.
  function shiver() {
    const gust = rnd(0, TAU);
    if (!still) for (const b of blobs) pushDir(b, gust + rnd(-.3, .3), .025 * cfg.response);
    arcGoal = Math.min(.15, arcGoal + .08);
    removeShape();
  }

  // ---------- frame loop ----------
  const data = new Float32Array(MAX * 4);
  const formData = new Float32Array(MAX * 4);
  const ease = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-dt * rate));
  function age(s, dt) { // presence + lifespan; returns false once fully faded out
    s.age += dt;
    if (s.goal === 1 && s.age > cfg.life * s.spanK) s.goal = 0;
    s.p = Math.min(1, Math.max(0, s.p + (s.goal ? dt / (s.fadeIn || FADE_IN) : -dt / (s.fadeOut || FADE_OUT)))); // linear progress
    s.g = s.p * s.p * (3 - 2 * s.p);                                                 // smoothstep
    return !(s.goal === 0 && s.p <= 0);
  }
  let last = performance.now(), frame = 0, skip = false;
  function tick(now) {
    // light version (html.lite, picked on the touch start screen): draw every other frame, ~30fps
    if (document.documentElement.classList.contains('lite') && (skip = !skip)) { requestAnimationFrame(tick); return; }
    // Two ways to hold back: the system "reduce motion" setting (no drifting; the scene still grows, shrinks and
    // fades) and the Background switch being off (frozen: nothing moves, ages, appears or disappears).
    const frozen = !cfg.on;
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (frame++ % 30 === 0) {
      readTheme(); // safety net; palette switches are caught at once by the MutationObserver
      if (!frozen && alive().length > cfg.shapes) removeShape(); // limit lowered in the settings: fade extras out one by one
    }
    blendTheme(dt);
    // bloom: swells in over ~.5s, then fades with its goal (half gone after ~1.2s, mostly gone after ~4s)
    bloomGoal *= Math.exp(-dt * .6);
    bloom = ease(bloom, bloomGoal, 3.5, dt);
    if (bloomGoal < .002 && bloom < .002) bloom = bloomGoal = 0; // fully off between good chords (no lingering glow)

    const notes = typeof held !== 'undefined' && held instanceof Set ? held : new Set(); // before trainer.js runs, `held` can be a DOM element
    const count = { low: 0, mid: 0, high: 0 };
    for (const n of notes) { count[bandOf(n)]++; if (!still && !frozen && !prevHeld.has(n)) onNote(n, now); }
    if (!still && !frozen) for (const n of prevHeld) if (!notes.has(n)) onRelease(n, now);
    prevHeld = new Set(notes);
    const loud = loudness();
    if (!frozen) { // levels also bend the warp and the arc, so they hold too while frozen
      for (const b of ['low', 'mid', 'high']) { const t = Math.min(1, count[b] * .35 + loud * .5); level[b] = ease(level[b], t, t > level[b] ? .4 : .3, dt); }
      level.all = ease(level.all, Math.min(1, notes.size * .18 + loud * .7), .35, dt);
    }

    if (frozen) { // the invisible scene lives on (see ghosts)
      for (let i = ghosts.length - 1; i >= 0; i--) if (!age(ghosts[i], dt)) ghosts.splice(i, 1);
      if (frame % 30 === 0 && ghostsAlive().length > cfg.shapes) removeGhost();
    }
    if (!frozen || clearing) {
      for (let i = blobs.length - 1; i >= 0; i--) if (!age(blobs[i], dt)) blobs.splice(i, 1);
      if (arc && !age(arc, dt)) arc = null;
      if (streak && !age(streak, dt)) streak = null;
    }

    if (!still && !frozen) {
      time += dt * cfg.speed * (1 + level.all * .5); // the flow quickens a little while you play
      const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      for (const b of blobs) {
        const e = b.band === 'all' ? level.all : Math.max(level[b.band], level.all * .5);
        // pending push -> a force that ramps up and down smoothly -> velocity
        b.ax = ease(b.ax || 0, b.fx * PUSH_RATE, PUSH_RAMP, dt);
        b.ay = ease(b.ay || 0, b.fy * PUSH_RATE, PUSH_RAMP, dt);
        b.vx += b.ax * dt; b.vy += b.ay * dt; b.fx -= b.ax * dt; b.fy -= b.ay * dt;
        // heading meanders randomly; after a push it slowly turns to follow the new direction. Every steer fades in
        // with how much it applies (no on/off thresholds), so the turning itself never changes abruptly.
        b.turn = b.turn * Math.exp(-dt * .5) + rnd(-1, 1) * Math.sqrt(dt) * .3;
        let want = b.heading + b.turn;
        want += angleTo(b.heading, Math.atan2(b.vy, b.vx)) * .5 * smooth(1.2, 2, Math.hypot(b.vx, b.vy) / b.cruise);
        // near an edge, steer softly back towards the middle (shapes may overhang, their centre stays on screen)
        const m = .15, inset = Math.min(b.x, W - b.x, b.y, H - b.y);
        want += angleTo(b.heading, Math.atan2(H / 2 - b.y, W / 2 - b.x)) * 1.2 * smooth(m, m * .4, inset);
        b.heading += angleTo(b.heading, want) * dt;
        // velocity relaxes towards the cruising drift
        const c = b.cruise * cfg.speed * (1 + e), k = 1 - Math.exp(-dt * .08); // momentum half-life ~9s
        b.vx += (Math.cos(b.heading) * c - b.vx) * k;
        b.vy += (Math.sin(b.heading) * c - b.vy) * k;
        // centre near / past the edge: a soft nudge back in (only there, so it never acts like a rubber band)
        const e2 = .1, ox = b.x < e2 ? e2 - b.x : b.x > W - e2 ? W - e2 - b.x : 0, oy = b.y < e2 ? e2 - b.y : b.y > H - e2 ? H - e2 - b.y : 0;
        b.vx += ox * .4 * dt; b.vy += oy * .4 * dt;
        // past top speed, drag grows with the excess (like air resistance), so it is reined in smoothly, not clipped
        const vmax = MAX_SPEED * Math.max(1, cfg.speed), spd = Math.hypot(b.vx, b.vy);
        if (spd > vmax) { const f = Math.exp(-dt * 3 * (spd / vmax - 1)); b.vx *= f; b.vy *= f; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        morph(b, dt);
      }
      // arc sway and streak bend ease towards a goal that itself fades out slowly
      arcGoal *= Math.exp(-dt * .25); bendGoal *= Math.exp(-dt * .25);
      arcKick = ease(arcKick, arcGoal, .5, dt);
      bendKick = ease(bendKick, bendGoal, .5, dt);
      streakPhase += dt * (.1 + (streak ? level[streak.band] : 0) * .2);
      if (arc) morph(arc, dt);
      if (streak) morph(streak, dt);
    }

    data.fill(0);
    blobs.slice(0, MAX).forEach((b, i) => data.set([b.x, b.y, b.r * (.7 + .3 * b.g), b.s * b.g], i * 4)); // grows in / shrinks out
    gl.uniform4fv(U.uBlob, data);
    const m = Math.min(1.5, cfg.morph); // the Morph setting also sets how far shapes deform
    formData.fill(0);
    blobs.slice(0, MAX).forEach((b, i) => formData.set([Math.cos(b.a), Math.sin(b.a), 1 + (b.st - 1) * m, b.bend * m], i * 4));
    gl.uniform4fv(U.uBlobForm, formData);
    gl.uniform1i(U.uCount, Math.min(MAX, blobs.length));
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uWarp, (.12 + level.all * .04 + bloom * .035) * cfg.morph); // the bloom also stirs the flow
    gl.uniform2f(U.uBloom, bloom, .05 + (1 - bloomGoal) * .6);                 // spread grows as the bloom fades
    gl.uniform1f(U.uIntensity, cfg.intensity);
    gl.uniform1f(U.uArcG, arc ? arc.g : 0);
    gl.uniform1f(U.uArcWobble, .05 + level.high * .05 + arcKick);
    gl.uniform1f(U.uStreakG, streak ? streak.g : 0);
    gl.uniform1f(U.uStreakBend, (.02 + (streak ? level[streak.band] : 0) * .02 + bendKick) * (streak ? streak.wave : 1));
    gl.uniform1f(U.uStreakLen, streak ? streak.len : .35);
    if (streak) gl.uniform4f(U.uStreak, streak.x, streak.y, streak.a, streak.th);
    if (arc) gl.uniform4f(U.uArc, arc.x, arc.y, arc.R, arc.th);
    gl.uniform1f(U.uStreakPhase, streakPhase);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// ---------- start screen glow ----------
// The glow dots behind the touch start screen's full / light options roam like the background's blobs:
// a randomly meandering heading, a slow cruising drift with momentum, and a soft steer back once it strays too far
// from its words; every few seconds it eases into a new stretch, drawn out along the way it drifts.
// Drives the --w1-* variables the glow pseudo-elements use in theme.css; stops once the start screen is gone.
(() => {
  const gate = document.getElementById('startup-gate');
  if (!gate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
  const glows = [];
  // reach: how far (px) it may roam from its words before it turns back
  const add = (el, key, reach) => {
    const heading = rnd(0, Math.PI * 2), cruise = rnd(10, 18);
    glows.push({ el, key, reach, cruise, heading, turn: 0, x: 0, y: 0,
      vx: Math.cos(heading) * cruise, vy: Math.sin(heading) * cruise, // already drifting when it appears
      a: heading, aT: heading, aV: 0, st: 1, stT: 1, stV: 0, morphIn: rnd(0, 4) });
  };
  document.querySelectorAll('.gate-option').forEach(el => add(el, 'w1', 35));

  let last = performance.now(), goneAt = 0;
  function step(now) {
    const dt = Math.min(.1, (now - last) / 1000);
    last = now;
    for (const g of glows) {
      // heading meanders randomly; nearing its reach it steers back towards its words (fading in, no threshold)
      g.turn = g.turn * Math.exp(-dt * .5) + rnd(-1, 1) * Math.sqrt(dt) * .3;
      let want = g.heading + g.turn;
      const d = Math.hypot(g.x, g.y), t = Math.min(1, Math.max(0, (d - g.reach * .4) / (g.reach * .5)));
      want += angleTo(g.heading, Math.atan2(-g.y, -g.x)) * 1.2 * t * t * (3 - 2 * t);
      g.heading += angleTo(g.heading, want) * dt;
      // velocity relaxes towards the cruising drift (quicker than the background: the glow has less room)
      const k = 1 - Math.exp(-dt * .3);
      g.vx += (Math.cos(g.heading) * g.cruise - g.vx) * k;
      g.vy += (Math.sin(g.heading) * g.cruise - g.vy) * k;
      if (d > g.reach) { g.vx -= g.x / d * (d - g.reach) * .5 * dt; g.vy -= g.y / d * (d - g.reach) * .5 * dt; } // soft nudge back
      g.x += g.vx * dt; g.y += g.vy * dt;
      // a new form every few seconds: now and then drawn out along the drift (and kept lined up with it), else
      // rounder and turned a little; stretch and angle move on critically damped springs, so they never jolt
      if ((g.morphIn -= dt) <= 0) {
        g.morphIn = rnd(5, 12);
        const long = Math.random() < .5;
        g.stT = long ? rnd(1.15, 1.4) : rnd(1, 1.1);
        g.aOff = long ? rnd(-.6, .6) : undefined;
        g.aT = g.a + rnd(-1.2, 1.2);
      }
      const aGoal = g.aOff !== undefined ? Math.atan2(g.vy, g.vx) + g.aOff : g.aT;
      g.stV += (-2.4 * g.stV - 1.44 * (g.st - g.stT)) * dt; g.st += g.stV * dt;
      g.aV += (-2 * g.aV - angleTo(aGoal, g.a)) * dt; g.a += g.aV * dt;
      const s = g.el.style;
      s.setProperty(`--${g.key}-x`, g.x.toFixed(1) + 'px');
      s.setProperty(`--${g.key}-y`, g.y.toFixed(1) + 'px');
      s.setProperty(`--${g.key}-a`, g.a.toFixed(3) + 'rad');
      s.setProperty(`--${g.key}-st`, g.st.toFixed(3));
    }
    // keep going through the start → app hand-off (~4.5s, theme.css), then stop
    if (document.body.classList.contains('app-ready')) goneAt = goneAt || now;
    if (!goneAt || now - goneAt < 5000) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();
