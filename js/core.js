'use strict';
const NAMES = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const $ = id => document.getElementById(id);
const stage = $('stage'), chordEl = $('chord'), chordNameWrapEl = $('chord-name-wrap'), hintEl = $('hint'), heldEl = $('held'), rootOctaveEl = $('root-octave');
let chordInfoEl;
let chordInfoHtml = '';
let appReady = false;
let midiStarted = false;

let chordWeights = {};
let scaleWeights = {};
const MAX_PROGRESS = 10;

// Adaptive scoring. Mistakes are recorded during an attempt and settled once the
// target is finally played correctly: clean plays earn 0..+4 by speed (steady = +2),
// plays with mistakes lose 1..4 by how wrong they were.
const READ_BUFFER_MS = 1000;
let skipNextTiming = true; // first target after startup / tab switch is untimed
function startScoreTimer(t) {
  t.shownAt = Date.now(); t.untimed = skipNextTiming; skipNextTiming = false;
  t.wrong = new Map(); t.attempts = 0;
}
// Semitone slip or right note in the wrong octave 1, whole tone 2, further 3.
function noteMissCost(n, expected) {
  const d = Math.min(...expected.map(e => { const x = Math.abs(e - n); return x % 12 === 0 ? 1 : x; }));
  return d <= 1 ? 1 : d === 2 ? 2 : 3;
}
function recordMiss(t, notes, expected, newAttempt, tag = '') {
  notes.forEach(n => { if (!t.wrong.has(tag + n)) t.wrong.set(tag + n, noteMissCost(n, expected)); });
  if (newAttempt) t.attempts++;
}
const SPEED_WORDS = ['very slow', 'slow', 'steady', 'quick', 'fast'];
function settleScore(t, fastMs, okMs) {
  let speed = 2;
  if (!t.untimed) {
    const ms = Date.now() - t.shownAt - READ_BUFFER_MS;
    speed = ms <= fastMs ? 4 : ms <= fastMs * 2 ? 3 : ms <= okMs ? 2 : ms <= okMs * 2 ? 1 : 0;
  }
  const penalty = [...t.wrong.values()].reduce((s, c) => s + c, 0) + Math.max(0, t.attempts - 1);
  const delta = penalty ? Math.max(-4, Math.min(-1, Math.floor(speed / 2) - penalty)) : speed;
  const parts = [];
  if (t.wrong.size) parts.push(`${t.wrong.size} wrong note${t.wrong.size > 1 ? 's' : ''}`);
  if (t.attempts > 1) parts.push(`${t.attempts} tries`);
  parts.push(SPEED_WORDS[speed]);
  return { delta, label: `${delta > 0 ? '+' : ''}${delta} · ${parts.join(', ')}` };
}
// Score change on the pool chip: the fill animates from the old score (the points show in its tooltip).
function showScoreChip(chip, r, oldW, newW) {
  if (!chip || (r.delta < 0 && oldW === 0)) return; // nothing left to take
  chip.title = 'Last: ' + r.label;
  // Gains: the liquid rises (with a splash); losses: it drops. Either way the surface sloshes.
  const gain = r.delta >= 0;
  const fill = chip.querySelector('.pool-fill');
  if (!fill) return;
  fill.style.height = oldW / MAX_PROGRESS * 100 + '%';
  fill.classList.toggle("draining", !gain);
  void fill.offsetWidth; // start from the old level, so the height transition runs
  fill.style.height = newW / MAX_PROGRESS * 100 + "%";
  if (gain) { fill.classList.remove("splash"); void fill.offsetWidth; fill.classList.add("splash"); }
  liquidSlosh(fill, gain, Math.abs(r.delta));
}

// ---------- colour palette menu ----------
// The palettes themselves are token sets in theme.css ([data-palette="…"]); this only picks one and sets data-theme
// light/dark to match its tone (a few base styles key off that). The pick is remembered ('palette'); an inline
// script in <head> applies it before first paint, so there is no flash.
(function initPalette() {
  const root = document.documentElement;
  const btn = $('palette-btn'), list = $('palette-list');
  const items = [...list.querySelectorAll('[data-palette-choice]')];
  const themeColor = document.querySelector('meta[name="theme-color"]');

  function apply(id) {
    const item = items.find(i => i.dataset.paletteChoice === id) || items[0];
    root.setAttribute('data-palette', item.dataset.paletteChoice);
    root.setAttribute('data-theme', item.dataset.tone);
    items.forEach(i => i.setAttribute('aria-checked', String(i === item)));
    if (themeColor) themeColor.content = getComputedStyle(root).getPropertyValue('--bg').trim();
  }
  function open(show) {
    list.hidden = !show;
    btn.setAttribute('aria-expanded', String(show));
    if (show) (items.find(i => i.getAttribute('aria-checked') === 'true') || items[0]).focus();
  }

  apply(root.getAttribute('data-palette') || 'ember'); // the remembered palette, set by the <head> script

  btn.addEventListener('click', () => open(list.hidden));
  items.forEach(i => i.addEventListener('click', () => {
    const changed = root.getAttribute('data-palette') !== i.dataset.paletteChoice;
    apply(i.dataset.paletteChoice);
    try { localStorage.setItem('palette', i.dataset.paletteChoice); } catch { /* ignore */ }
    if (changed) onPaletteChange(i.dataset.paletteChoice); // js/audio.js: palette synth preset + drone
    open(false);
    btn.focus();
  }));
  // close on outside click / Escape; arrow keys move through the list
  document.addEventListener('pointerdown', e => { if (!list.hidden && !$('palette-menu').contains(e.target)) open(false); });
  list.addEventListener('keydown', e => {
    const at = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { open(false); btn.focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
    }
  });
})();


// Touch devices (phones/tablets): "tap" wording and tap gestures instead of click/spacebar.
const IS_TOUCH = matchMedia('(pointer: coarse)').matches;
const TAP = IS_TOUCH ? 'tap' : 'click';
const EAR_PLAY_HINT = '';
// Light version (chosen on the start screen): cheaper sound engine (js/audio.js) and page (html.lite in theme.css),
// the drone starts off and the background is switched off (still, no new shapes). Neither is saved, so the full
// version keeps its own settings (js/audio.js and js/ambient.js skip saving them while html.lite is set).
let LITE = false;
function setLite(on) {
  LITE = on;
  document.documentElement.classList.toggle('lite', on);
  if (!on) return;
  $('opt-drone').checked = false;
  const bg = $('opt-background');
  if (bg && bg.checked) { bg.checked = false; bg.dispatchEvent(new Event('change')); }
  if (window.ambientClear) window.ambientClear(); // the start screen's shapes fade away: plain background
}
{
  // the start screen offers two options (full / light) instead of "click anywhere"
  const gate = $('startup-gate');
  gate.removeAttribute('role'); gate.removeAttribute('tabindex'); gate.removeAttribute('aria-label');
  $('startup-gate-instruction').hidden = true;
  $('startup-gate-modes').hidden = false;
}
if (IS_TOUCH) {
  $('stage-next-hint').textContent = 'tap for next chord';
  $('mic-offer-hint').textContent = 'double-tap here to use the microphone';
  $('kbd-note').textContent = $('kbd-note').textContent.replace(/ No MIDI keyboard\?.*$/, ' No MIDI keyboard? Turn on the microphone in Settings or tap the keys above.');
}

// Liquid surface physics for the pool fill: a row of damped springs coupled to their neighbours
// (waves travel and reflect off the chip walls). The stream lands near the right edge: gains push
// the surface down there, losses pull it up. Drawn as an SVG curve over the fill's top band.
function liquidSlosh(fill, gain, strength) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  fill._slosh?.stop();
  const N = 24, K = 0.001, DAMP = 0.035, SPREAD = 0.22, BAND = 6;
  const h = new Float32Array(N), v = new Float32Array(N), l = new Float32Array(N), r = new Float32Array(N);
  const hit = (0.78 + Math.random() * 0.12) * (N - 1);
  const impulse = (gain ? 1 : -1) * (0.35 + strength * 0.1) * (0.85 + Math.random() * 0.3); // peaks of roughly 2–5px
  for (let i = 0; i < N; i++) v[i] = impulse * Math.exp(-((i - hit) ** 2) / 6);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'pool-surface');
  svg.setAttribute('viewBox', `0 0 100 ${BAND * 2}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  fill.appendChild(svg);
  fill.classList.add('sloshing');

  let raf = 0, frames = 0;
  const stop = () => { cancelAnimationFrame(raf); svg.remove(); fill.classList.remove('sloshing'); fill._slosh = null; };
  fill._slosh = { stop };
  const step = () => {
    for (let i = 0; i < N; i++) { v[i] += -K * h[i] - DAMP * v[i]; h[i] += v[i]; }
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < N; i++) {
        if (i > 0) { l[i] = SPREAD * (h[i] - h[i - 1]); v[i - 1] += l[i]; }
        if (i < N - 1) { r[i] = SPREAD * (h[i] - h[i + 1]); v[i + 1] += r[i]; }
      }
      for (let i = 0; i < N; i++) { if (i > 0) h[i - 1] += l[i]; if (i < N - 1) h[i + 1] += r[i]; }
    }
    let d = `M0 ${BAND * 2}`, energy = 0;
    for (let i = 0; i < N; i++) {
      const y = Math.max(0, Math.min(BAND * 2, BAND + h[i]));
      d += ` L${(i / (N - 1) * 100).toFixed(2)} ${y.toFixed(2)}`;
      energy += h[i] * h[i] + v[i] * v[i];
    }
    path.setAttribute('d', d + ` L100 ${BAND * 2} Z`);
    if (++frames > 20 && energy < 0.01 || frames > 180 || !fill.isConnected) { stop(); return; }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
