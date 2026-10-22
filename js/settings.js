'use strict';
// ---------- remembered settings ----------
// Every setting that its own file doesn't already save is kept here, in one localStorage entry ('settings'), and
// put back on load (before main.js renders the first chord). Saved elsewhere: palette (core.js), drone, volume,
// instrument, piano and light-synth settings (audio.js), background (ambient.js), full keyboard (keyboard.js),
// note names (tabs.js), the Songs sound options, last song and mastery (songs.js).
// While a practice routine runs, the settings it changes are saved as you had them (routineApp.normalSettings).
// Not saved on purpose: the scale picker (it shows the scale being practised), the microphone switch (it would ask
// for the mic on every visit) and the song loop (it belongs to one song).
// Values are put back without change events where the code reads them when needed; the few that keep their own
// state get the event or call that applies them. Saving: any change / input / click, a moment later.
const SETTINGS_KEY = 'settings';
const SETTING_IDS = [
  'opt-sound', 'opt-reverb', 'opt-show', 'opt-both-hands', 'octave-select', 'key-select',
  'opt-jazz-chords', 'opt-smart-practice', 'opt-nice-progression', 'opt-scale-smart-practice',
  'opt-ear-simultaneous', 'opt-ear-ascending', 'opt-ear-show-root', 'mic-sensitivity',
  'song-speed', 'song-opt-other-hand',
];
const SETTING_RADIOS = ['key-order', 'dir', 'song-hands', 'song-pmode'];
const SYNTH_FIELDS = ['wave', 'attack', 'decay', 'sustain', 'release', 'cutoff', 'reso', 'detune', 'fenv'];
// chord categories (g-<group>, g-<group>-<n>, g-<group>-inv<k>) and scale categories (sg-<group>, sg-<group>-<n>)
const settingControls = () => [
  ...SETTING_IDS.map(id => $(id)).filter(Boolean),
  ...document.querySelectorAll('input[type="checkbox"][id^="g-"], input[type="checkbox"][id^="sg-"]'),
];

function snapshotSettings() {
  const s = { controls: {}, radios: {}, synth: {}, tab: mode };
  settingControls().forEach(el => { s.controls[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
  SETTING_RADIOS.forEach(name => {
    const r = document.querySelector(`input[name="${name}"]:checked`);
    if (r) s.radios[name] = r.value;
  });
  SYNTH_FIELDS.forEach(k => { s.synth[k] = SYNTH[k]; });
  return s;
}
function saveSettings() {
  const s = snapshotSettings();
  // a practice routine running: the settings it changes are saved as you had them, not as it set them (js/routine.js)
  const own = routineApp.normalSettings();
  if (own) { Object.assign(s.controls, own.controls); Object.assign(s.radios, own.radios); }
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

let savedTab = null; // put back by restoreSettingsTab (main.js), after the first render
(function restoreSettings() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch { /* storage unavailable */ }
  if (s && typeof s === 'object') {
    const c = s.controls || {}, r = s.radios || {};
    const set = (el, v) => {
      if (!el || v === undefined) return false;
      const before = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.tagName !== 'SELECT' || [...el.options].some(o => o.value === v)) el.value = v;
      return before !== (el.type === 'checkbox' ? el.checked : el.value);
    };
    // plain values, read when needed
    settingControls().forEach(el => { if (!['song-speed', 'song-opt-other-hand', 'mic-sensitivity'].includes(el.id)) set(el, c[el.id]); });
    SETTING_RADIOS.filter(n => !n.startsWith('song-')).forEach(name => {
      const el = document.querySelector(`input[name="${name}"][value="${r[name]}"]`);
      if (el) el.checked = true;
    });

    // sound on/off: the Piano and Synth switches show it
    const on = $('opt-sound').checked;
    if ($('opt-piano')) $('opt-piano').checked = on && instrument === 'piano';
    if ($('opt-synth')) $('opt-synth').checked = on && instrument === 'synth';

    // chord / scale categories: the group switches follow their chords (all, some = indeterminate, none)
    const syncGroup = (master, inputs) => {
      if (!master || !inputs.length) return;
      const n = inputs.filter(i => i.checked).length;
      master.checked = n === inputs.length;
      master.indeterminate = n > 0 && n < inputs.length;
    };
    GROUPS.forEach(g => syncGroup($(`g-${g.id}`), g.chords.map((_, i) => $(`g-${g.id}-${i}`)).filter(Boolean)));
    SCALE_GROUPS.forEach(g => syncGroup($(`sg-${g.id}`), g.scales.map((_, i) => $(`sg-${g.id}-${i}`)).filter(Boolean)));
    populateScaleSelect();

    // octave: the range depends on both hands
    currentAnchor = cNumToAnchor(+$('octave-select').value);
    populateOctaveSelect();
    buildKeys();

    // the synth sliders
    const synth = {};
    SYNTH_FIELDS.forEach(k => { if (s.synth && s.synth[k] !== undefined) synth[k] = s.synth[k]; });
    if (Object.keys(synth).length) applySynthPreset(synth);

    // controls with their own state: through their events
    const fire = (el, v, type) => { if (set(el, v)) el.dispatchEvent(new Event(type)); };
    fire($('mic-sensitivity'), c['mic-sensitivity'], 'input');
    fire($('song-speed'), c['song-speed'], 'input');
    fire($('song-opt-other-hand'), c['song-opt-other-hand'], 'change');
    ['song-hands', 'song-pmode'].forEach(name => {
      const el = document.querySelector(`input[name="${name}"][value="${r[name]}"]`);
      if (el && !el.checked) { el.checked = true; el.dispatchEvent(new Event('change')); }
    });
    savedTab = s.tab;
  }

  let timer = 0;
  const later = () => { clearTimeout(timer); timer = setTimeout(saveSettings, 250); };
  ['change', 'input', 'click'].forEach(type => document.addEventListener(type, later, true));
  window.addEventListener('pagehide', saveSettings);
})();

// The last tab, once the first chord is up (main.js).
function restoreSettingsTab() {
  const tabs = ['chords', 'scales', 'ear', 'detector', 'songs', 'routine', 'theory', 'contact'];
  if (savedTab && savedTab !== mode && tabs.includes(savedTab)) setMode(savedTab);
}
