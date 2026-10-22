'use strict';
// ---------- Web Audio Synthesizer ----------
let audioCtx = null;
let reverbNode = null;
let dryGainNode = null;
let wetGainNode = null;
let masterGainNode = null;
let masterLimiterNode = null;
const activeVoices = new Map();

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      // Light version: a larger audio buffer (a few ms more latency) so a busy device doesn't crackle.
      audioCtx = LITE ? new AudioContext({ latencyHint: 'balanced' }) : new AudioContext();

      reverbNode = audioCtx.createConvolver();
      dryGainNode = audioCtx.createGain();
      wetGainNode = audioCtx.createGain();
      masterGainNode = audioCtx.createGain();
      masterLimiterNode = audioCtx.createDynamicsCompressor();

      const rate = audioCtx.sampleRate;
      const length = rate * (LITE ? 1.2 : 2.5); // a shorter reverb tail is much cheaper (light version)
      const impulse = audioCtx.createBuffer(2, length, rate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);
      for (let i = 0; i < length; i++) {
        const decay = Math.exp(-i / (rate * 0.5));
        left[i] = (Math.random() * 2 - 1) * decay;
        right[i] = (Math.random() * 2 - 1) * decay;
      }
      reverbNode.buffer = impulse;

      dryGainNode.connect(masterGainNode);
      reverbNode.connect(wetGainNode);
      wetGainNode.connect(masterGainNode);
      // No clipping at any volume: a limiter (the compressor, hard and fast), then a soft clipper for the attacks
      // it lets through, which can never go past full scale.
      const clipIn = audioCtx.createGain(), clipper = audioCtx.createWaveShaper();
      clipIn.gain.value = 1 / CLIP_HEADROOM;
      clipper.curve = softClipCurve();
      clipper.oversample = LITE ? 'none' : '2x';
      masterGainNode.connect(masterLimiterNode);
      masterLimiterNode.connect(clipIn).connect(clipper).connect(audioCtx.destination);

      masterGainNode.gain.value = getVolume();
      masterLimiterNode.threshold.setValueAtTime(-8, audioCtx.currentTime);
      masterLimiterNode.knee.setValueAtTime(6, audioCtx.currentTime);
      masterLimiterNode.ratio.setValueAtTime(20, audioCtx.currentTime);
      masterLimiterNode.attack.setValueAtTime(0.002, audioCtx.currentTime);
      masterLimiterNode.release.setValueAtTime(0.2, audioCtx.currentTime);

      updateReverbMix();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Soft clipper (after the limiter): straight up to CLIP_LINEAR, then bending smoothly towards full scale, never past
// it. A wave shaper clamps its input to -1..1, so the signal goes in scaled down by CLIP_HEADROOM and the curve
// spans ±CLIP_HEADROOM: peaks up to that far over full scale are rounded off, not cut.
const CLIP_HEADROOM = 4, CLIP_LINEAR = 0.7;
function softClipCurve() {
  const n = 4096, curve = new Float32Array(n), a = CLIP_LINEAR;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) * 2 - 1) * CLIP_HEADROOM, m = Math.abs(x);
    curve[i] = Math.sign(x) * (m <= a ? m : a + (1 - a) * Math.tanh((m - a) / (1 - a)));
  }
  return curve;
}

function updateReverbMix() {
  if (!dryGainNode || !wetGainNode || !audioCtx) return;
  const isReverbOn = $('opt-reverb').checked;
  const now = audioCtx.currentTime;
  dryGainNode.gain.setValueAtTime(isReverbOn ? 0.7 : 0.9, now);
  wetGainNode.gain.setValueAtTime(isReverbOn ? 0.3 : 0.0, now);
}

$('opt-reverb').addEventListener('change', () => {
  initAudio();
  updateReverbMix();
});

// Browsers keep the AudioContext suspended until a user gesture. Resume it on the
// very first interaction of any kind (click, touch, computer key) so sound is ready.
(function setupAudioUnlock() {
  const events = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'];
  function unlock() {
    if (!appReady) return; // wait for the full / light choice: startApp creates the audio then
    initAudio();
    if (audioCtx && audioCtx.state === 'running') {
      events.forEach(ev => document.removeEventListener(ev, unlock, true));
    }
  }
  events.forEach(ev => document.addEventListener(ev, unlock, true));
})();

// ---------- Palette sounds ----------
// Each colour palette has its own drone chord (played on the start → app hand-off and when switching to it) and its
// own base synth preset for the keys, so the sound changes character with the colours.
// chord = MIDI notes (lowest first; a sub-octave of the lowest is added); synth = the key synth settings.
const PALETTE_SOUNDS = {
  ember:     { chord: [38, 45, 50, 53, 57, 64], // D minor add9: dark and warm
               synth: { wave: 'sawtooth', attack: 0.04, decay: 1.4, sustain: 0.6, release: 2.2, cutoff: 1500, reso: 6, detune: 11, fenv: 0.45 } },
  dusk:      { chord: [34, 41, 45, 50, 53, 60], // B♭ maj9: dreamy, slow and wide
               synth: { wave: 'sawtooth', attack: 0.12, decay: 2, sustain: 0.7, release: 3, cutoff: 1000, reso: 4, detune: 15, fenv: 0.3 } },
  moss:      { chord: [43, 50, 55, 57, 62, 67], // G sus2: open and earthy
               synth: { wave: 'triangle', attack: 0.03, decay: 1.6, sustain: 0.5, release: 2.4, cutoff: 2000, reso: 3, detune: 8, fenv: 0.4 } },
  ash:       { chord: [33, 40, 45, 48, 52, 55], // A minor 7: cold and hollow
               synth: { wave: 'square', attack: 0.05, decay: 1.2, sustain: 0.55, release: 2.4, cutoff: 850, reso: 8, detune: 9, fenv: 0.5 } },
  paper:     { chord: [48, 55, 60, 64, 67, 74], // C maj add9: light and clear
               synth: { wave: 'triangle', attack: 0.01, decay: 1.8, sustain: 0.35, release: 1.8, cutoff: 3200, reso: 2, detune: 5, fenv: 0.6 } },
  vermilion: { chord: [40, 47, 52, 56, 59, 66], // E add9: bright and bold
               synth: { wave: 'sawtooth', attack: 0.02, decay: 1.2, sustain: 0.6, release: 2, cutoff: 2600, reso: 5, detune: 9, fenv: 0.55 } },
};
const paletteSound = id => PALETTE_SOUNDS[id] || PALETTE_SOUNDS.ember;

// A deep synth drone: the palette's chord as unison-detuned oscillators (its synth's wave/detune) plus a
// sub-octave, swelling in with no attack. A resonant low-pass sweeps open to the synth's cutoff and settles back
// darker while a slow LFO keeps it breathing; it then sinks away through the reverb.
// Follows the Sound switch and master volume. A new drone fades out the one still ringing.
// timing: level, swell (fade-in), peak (filter fully open), fadeAt + fadeTau (fade-out), length (s).
const DRONE_INTRO = { level: 0.4, swell: 0.6, peak: 1.8, fadeAt: 2.8, fadeTau: 0.9, length: 8 };
const DRONE_PALETTE = { level: 0.26, swell: 0.35, peak: 1, fadeAt: 1.4, fadeTau: 0.6, length: 5 };
let currentDrone = null;
function playDrone(sound, timing) {
  if (!$('opt-sound').checked || !audioCtx) return;
  const t = audioCtx.currentTime;
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const stopAt = t + timing.length;
  const { wave, cutoff, reso, detune } = sound.synth;
  if (currentDrone) {
    currentDrone.gain.cancelScheduledValues(t);
    currentDrone.gain.setTargetAtTime(0.0001, t, 0.12);
  }

  const out = audioCtx.createGain();
  out.gain.setValueAtTime(0.001, t);
  out.gain.exponentialRampToValueAtTime(timing.level, t + timing.swell); // soft swell in, nothing percussive
  out.gain.setTargetAtTime(0.0001, t + timing.fadeAt, timing.fadeTau);   // fade out
  routeAudio(out);
  currentDrone = out;

  // resonant low-pass: opens with the swell, settles back darker; an LFO makes it slowly "breathe"
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass'; filter.Q.value = reso + 1;
  filter.frequency.setValueAtTime(cutoff * 0.075, t);
  filter.frequency.exponentialRampToValueAtTime(cutoff, t + timing.peak);
  filter.frequency.exponentialRampToValueAtTime(cutoff * 0.25, t + timing.length - 2);
  const lfo = audioCtx.createOscillator(), lfoDepth = audioCtx.createGain();
  lfo.frequency.value = 0.22; lfoDepth.gain.value = 450; // ± cents on the cutoff
  lfo.connect(lfoDepth).connect(filter.detune);
  lfo.start(t); lfo.stop(stopAt);
  filter.connect(out);

  // slow pitch drift shared by all oscillators, for a warm analog wobble
  const drift = audioCtx.createOscillator(), driftDepth = audioCtx.createGain();
  drift.frequency.value = 0.13; driftDepth.gain.value = 4;
  drift.connect(driftDepth);
  drift.start(t); drift.stop(stopAt);

  // sub-octave: a pure low note underneath everything
  const sub = audioCtx.createOscillator(), subGain = audioCtx.createGain();
  sub.type = 'triangle'; sub.frequency.value = hz(sound.chord[0] - 12);
  subGain.gain.value = 0.32;
  sub.connect(subGain).connect(out);
  sub.start(t); sub.stop(stopAt);

  // the chord: each note a 3-voice unison of detuned oscillators, spread across the stereo field
  // (light version: one oscillator per note, a little louder to make up for it)
  const notes = sound.chord, unison = LITE ? [0] : [-detune, 0, detune];
  notes.forEach((n, i) => {
    const voice = audioCtx.createGain();
    voice.gain.value = (i < 2 ? 0.75 : 0.45) / notes.length * (LITE ? 1.7 : 1);
    const pan = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
    if (pan) { pan.pan.value = (i % 2 ? 1 : -1) * (0.15 + 0.1 * i); voice.connect(pan).connect(filter); }
    else voice.connect(filter);
    unison.forEach(cents => {
      const osc = audioCtx.createOscillator();
      osc.type = wave;
      osc.frequency.value = hz(n);
      osc.detune.value = cents;
      driftDepth.connect(osc.detune);
      osc.connect(voice);
      osc.start(t); osc.stop(stopAt);
    });
  });
}
const currentPalette = () => document.documentElement.getAttribute('data-palette');
const playIntroChord = () => playDrone(paletteSound(currentPalette()), DRONE_INTRO);

// Called by the palette menu (js/core.js) when the user picks a palette: the keys take on that palette's synth
// preset and its drone plays as the colours change (not in the light version or with the drone switched off: the change is silent there).
function onPaletteChange(id) {
  const sound = paletteSound(id);
  applySynthPreset(sound.synth);
  initAudio();
  if (!audioCtx) return;
  const go = () => { if (!LITE && $('opt-drone').checked) playDrone(sound, DRONE_PALETTE); if (bed) { stopBed(2); startBed(); } }; // the ambient drone cross-fades too
  if (audioCtx.state === 'running') go();
  else audioCtx.resume().then(go).catch(() => {});
}

function startApp(event) {
  if (appReady) return;
  // start screen: only the full / light options start the app
  const option = event && event.target.closest ? event.target.closest('.gate-option') : null;
  if (!option) return;
  option.classList.add('chosen');
  setLite(option.dataset.lite === '1'); // before initAudio: the audio settings are fixed when it is created
  appReady = true;
  document.body.classList.add('app-ready');
  // a history step, so the browser's back button returns to the start screen (leaveApp below). After a reload
  // inside the app the step is already there: reuse it instead of stacking another.
  if (history.state && history.state.app) history.replaceState({ app: 1 }, '');
  else history.pushState({ app: 1 }, '');
  initAudio();
  if (audioCtx) {
    if (instrument === 'piano') loadPianoSamples(); // so the first notes are already the piano
    const go = () => { if (!LITE && $('opt-drone').checked) playIntroChord(); startBed(); }; // the ambient drone (if on) swells in slowly under the intro; the light version, or the drone switched off, starts silently
    if (audioCtx.state === 'running') go();
    else audioCtx.resume().then(go).catch(() => {});
  }
  initializeMidi();
}

const startupGate = $('startup-gate');
startupGate.addEventListener('pointerdown', startApp); // start on press, not release, so the drone answers at once
startupGate.addEventListener('click', startApp); // the options are buttons: their own Enter / Space click starts the app

// Back button → start screen: the page and the sound fade out (body.leaving in theme.css), then the page reloads
// onto the start screen, which fades in from the same plain background. Reloading clears every bit of app state.
let leaving = false;
function leaveApp() {
  if (leaving) return;
  leaving = true;
  document.body.classList.add('leaving');
  if (audioCtx && masterGainNode) {
    masterGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
  }
  setTimeout(() => location.reload(), 1000);
}
addEventListener('popstate', () => { if (appReady && !(history.state && history.state.app)) leaveApp(); });

$('opt-show').addEventListener('change', () => { drawTarget(); });

function routeAudio(node) {
  if (dryGainNode && reverbNode) {
    node.connect(dryGainNode);
    node.connect(reverbNode);
  } else if (audioCtx) {
    node.connect(audioCtx.destination);
  }
}

// The instrument for the keys in every tab but Songs (Settings → Sound): 'piano' (the sampled piano) or 'synth'.
// Remembered. The Songs tab has its own choice (js/songs.js).
const INSTRUMENT_KEY = 'instrument';
let instrument = (() => { try { return localStorage.getItem(INSTRUMENT_KEY) === 'piano' ? 'piano' : 'synth'; } catch { return 'synth'; } })();

function playPianoNote(noteNum, velocity = null) {
  const soundOn = $('opt-sound').checked;
  if (!soundOn) return;
  initAudio();
  if (!audioCtx) return;

  // If the context is still suspended (e.g. first note came from MIDI, which is not
  // a user gesture), wait for resume() instead of scheduling on a frozen clock, and
  // then play the note if the key is still held.
  if (audioCtx.state !== 'running') {
    audioCtx.resume().then(() => {
      if (held.has(noteNum)) startPianoNote(noteNum, velocity);
    }).catch(() => {});
    return;
  }
  startPianoNote(noteNum, velocity);
}

function startPianoNote(noteNum, velocity = null) {
  stopPianoNote(noteNum, true);

  const freq = 440 * Math.pow(2, (noteNum - 69) / 12);
  const now = audioCtx.currentTime;
  if (instrument === 'piano') { startSampledPiano(noteNum, now, velocity); return; } // Settings → Sound: Piano / Synth
  startSynthNote(noteNum, freq, now, velocity); return; // the preset code below is unused
  const soundType = $('sound-type').value;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  if (soundType === 'acoustic') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 4, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(freq, 200), now + 1.2);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

    osc.connect(filter);
    filter.connect(gain);
    routeAudio(gain);
    osc.start(now);
    osc.stop(now + 2.5);

    activeVoices.set(noteNum, { osc, gain });

  } else if (soundType === 'bright') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 8, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.5, 300), now + 1.5);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

    osc.connect(filter);
    filter.connect(gain);
    routeAudio(gain);
    osc.start(now);
    osc.stop(now + 2.2);

    activeVoices.set(noteNum, { osc, gain });

  } else if (soundType === 'warm') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 2.5, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(freq, 150), now + 1.0);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.26, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

    osc.connect(filter);
    filter.connect(gain);
    routeAudio(gain);
    osc.start(now);
    osc.stop(now + 3.0);

    activeVoices.set(noteNum, { osc, gain });

  } else if (soundType === 'epiano') {
    const modOsc = audioCtx.createOscillator();
    const modGain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    modOsc.type = 'sine';
    modOsc.frequency.setValueAtTime(freq * 14, now);

    modGain.gain.setValueAtTime(freq * 2, now);
    modGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

    modOsc.connect(modGain);
    modGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

    osc.connect(gain);
    routeAudio(gain);

    modOsc.start(now);
    osc.start(now);
    modOsc.stop(now + 2.0);
    osc.stop(now + 2.0);

    activeVoices.set(noteNum, { osc, gain, modOsc });

  } else if (soundType === 'organ') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 3, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
    gain.gain.setValueAtTime(0.18, now + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    routeAudio(gain);
    osc.start(now);

    activeVoices.set(noteNum, { osc, gain });

  } else if (soundType === 'synthpad') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 1.5, now);
    filter.frequency.exponentialRampToValueAtTime(freq * 4, now + 0.8);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    routeAudio(gain);
    osc.start(now);

    activeVoices.set(noteNum, { osc, gain });

  } else if (soundType === 'strings') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 2, now);
    filter.Q.setValueAtTime(1.5, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    routeAudio(gain);
    osc.start(now);

    activeVoices.set(noteNum, { osc, gain });

  } else if (soundType === 'musicbox') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 6, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    routeAudio(gain);
    osc.start(now);
    osc.stop(now + 1.2);

    activeVoices.set(noteNum, { osc, gain });
  }
}

// again: the same key is struck again, so its damper doesn't land (no release noise) and the old note gives way quickly.
function stopPianoNote(noteNum, again = false) {
  if (activeVoices.has(noteNum)) {
    const voice = activeVoices.get(noteNum);
    const soundType = $('sound-type').value;
    const isSustained = soundType === 'organ' || soundType === 'synthpad' || soundType === 'strings';
    
    if (audioCtx) {
      const now = audioCtx.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), now);
      let releaseTime = voice.release || (voice.synth ? Math.max(0.02, SYNTH.release) : isSustained ? 0.35 : 0.08);
      if (voice.release && again) releaseTime = Math.min(releaseTime, 0.12);
      if (voice.damper != null && !again) playPianoRelease(voice.damper, voice.vel, now);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
      if (voice.oscs) voice.oscs.forEach(o => o.stop(now + releaseTime));
      else voice.osc.stop(now + releaseTime);
      if (voice.modOsc) voice.modOsc.stop(now + releaseTime);
    }
    activeVoices.delete(noteNum);
  }
}

// Sustain pedal (MIDI CC 64, js/midi.js): while it is down, letting go of a key (noteOff in js/trainer.js) leaves
// its note ringing; lifting the pedal ends the notes whose keys are up by then. Only the sound: grading and chord
// detection still follow the keys.
let sustainDown = false;
const sustainedKeys = new Set();
function releasePianoNote(key) {
  if (sustainDown) sustainedKeys.add(key); else stopPianoNote(key);
}
function setSustain(down) {
  if (down === sustainDown) return;
  sustainDown = down;
  if (down) return;
  sustainedKeys.forEach(key => { if (!held.has(key)) stopPianoNote(key); });
  sustainedKeys.clear();
}


// Sound type popup: same look/behaviour as the chord category menus, drives the hidden #sound-type select.
(() => {
  const select = $('sound-type');
  const details = document.createElement('details');
  details.className = 'chord-category'; details.id = 'sound-menu';
  const summary = document.createElement('summary');
  // Header = the existing #opt-sound on/off switch + "Piano sound"; clicking the rest opens the popup.
  const soundSwitch = $('opt-sound').closest('.toggle-switch');
  const oldRow = soundSwitch.closest('label');
  const label = document.createElement('div');
  label.className = 'toggle-label-row chord-category-master';
  label.append(soundSwitch, ' Piano sound');
  oldRow.remove();
  soundSwitch.addEventListener('click', event => {
    event.stopPropagation();
    if (event.target !== $('opt-sound')) {
      event.preventDefault();
      $('opt-sound').checked = !$('opt-sound').checked;
      $('opt-sound').dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  const indicator = document.createElement('span');
  indicator.className = 'chord-category-menu-indicator'; indicator.textContent = '+'; indicator.setAttribute('aria-hidden', 'true');
  summary.append(label, indicator);
  details.appendChild(summary);
  const sync = () => { summary.title = select.selectedOptions[0].text; };

  const items = document.createElement('div');
  items.className = 'chord-category-items'; items.hidden = true;
  [...select.options].forEach(opt => {
    const item = document.createElement('label');
    item.className = 'toggle-label-row chord-category-item';
    item.innerHTML = `<span class="toggle-switch"><input type="radio" name="sound-menu" value="${opt.value}" ${opt.selected ? 'checked' : ''}><span class="toggle-slider"></span></span> ${opt.text}`;
    item.querySelector('input').addEventListener('change', () => { select.value = opt.value; select.dispatchEvent(new Event('change')); sync(); });
    items.appendChild(item);
  });
  document.body.appendChild(items);

  const positionPopup = () => {
    const s = summary.getBoundingClientRect(), p = items.getBoundingClientRect();
    let top = s.bottom + 4;
    if (top + p.height > window.innerHeight - 8) top = Math.max(8, s.top - p.height - 4);
    items.style.left = `${Math.max(8, Math.min(s.left, window.innerWidth - p.width - 8))}px`;
    items.style.top = `${top}px`;
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
    if (details.open) { items.hidden = false; requestAnimationFrame(positionPopup); }
  });

  $('global-toggles').after(details);
  sync();
})();

// ---------- Synth engine ----------
// Detuned 3-oscillator unison + sub -> resonant lowpass -> ADSR gain. Replaces the piano presets while "Synth" is on.
// The synth starts on the remembered palette's preset (see PALETTE_SOUNDS); picking a palette loads its own preset.
// Slider tweaks are remembered by js/settings.js, which loads them over this.
const SYNTH = { ...paletteSound(currentPalette()).synth };
// Load a preset into the synth (the Synth popup below replaces this to also update its controls).
let applySynthPreset = values => { Object.assign(SYNTH, values); };

// Each note is built like one voice of the intro drone: a 3-oscillator unison (detuned left / centre / right),
// a soft sub-octave, a slow shared pitch drift, and a resonant low-pass that slowly "breathes".
// Velocity (MIDI, full version only): soft notes are quieter and darker, hard ones a little louder and brighter,
// like a struck string. A medium touch (velocity ~100 of 127) sounds as the notes always did; without a velocity
// (mouse, computer keys, mic, the light version) nothing changes.
// Light version: the key synth is simpler (one oscillator, no velocity) unless its Full synth switch is on.
const FULL_SYNTH_KEY = 'lite-full-synth';
let fullSynthInLite = false;
try { fullSynthInLite = localStorage.getItem(FULL_SYNTH_KEY) === '1'; } catch { /* storage unavailable */ }
const simpleSynth = () => LITE && !fullSynthInLite;
const VEL_REF = 100 / 127;
function velocityFeel(velocity) {
  if (velocity == null || simpleSynth()) return { amp: 1, bright: 1 };
  const v = Math.max(0.05, Math.min(1, velocity));
  const curve = x => 0.15 + 0.85 * Math.pow(x, 1.6); // gentle at the bottom, so soft notes stay audible
  return { amp: curve(v) / curve(VEL_REF), bright: Math.pow(2, (v - VEL_REF) * 1.6) };
}

// key: the activeVoices entry (default the note number; the Songs tab uses its own keys so backing notes and your
// own notes on the same pitch don't cut each other off).
function startSynthNote(noteNum, freq, now, velocity = null, key = noteNum) {
  const feel = velocityFeel(velocity);
  const filter = audioCtx.createBiquadFilter(), gain = audioCtx.createGain();
  const oscs = [];
  // slow pitch drift shared by the unison, for the warm analog wobble
  const drift = audioCtx.createOscillator(), driftDepth = audioCtx.createGain();
  drift.frequency.value = 0.13; driftDepth.gain.value = 4;
  drift.connect(driftDepth); oscs.push(drift);
  // light version: a single centre oscillator instead of the 3-voice unison (much cheaper for chords)
  const simple = simpleSynth();
  (simple ? [0] : [-1, 0, 1]).forEach(side => {
    const osc = audioCtx.createOscillator(), level = audioCtx.createGain();
    osc.type = SYNTH.wave;
    osc.frequency.setValueAtTime(freq, now);
    osc.detune.setValueAtTime(side * SYNTH.detune, now);
    driftDepth.connect(osc.detune);
    level.gain.value = simple ? 0.57 : 1 / 3; // one oscillator, about as loud as the detuned three
    const pan = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
    if (pan) { pan.pan.value = side * 0.35; osc.connect(level).connect(pan).connect(filter); }
    else osc.connect(level).connect(filter);
    oscs.push(osc);
  });
  // sub-octave underneath (softer high up, where it would just muddy chords)
  const sub = audioCtx.createOscillator(), subLevel = audioCtx.createGain();
  sub.type = 'triangle'; sub.frequency.setValueAtTime(freq / 2, now);
  subLevel.gain.value = noteNum < 60 ? 0.35 : 0.18;
  sub.connect(subLevel).connect(filter); oscs.push(sub);

  filter.type = 'lowpass';
  const cutoff = Math.min(18000, SYNTH.cutoff * feel.bright);
  filter.frequency.setValueAtTime(cutoff, now);
  // Filter envelope: brightness falls with the decay, like a struck string.
  filter.frequency.setTargetAtTime(Math.max(120, cutoff * (1 - (SYNTH.fenv || 0) * 0.85)), now + 0.005, Math.max(0.02, SYNTH.decay) / 3);
  filter.Q.setValueAtTime(SYNTH.reso, now);
  // the slow "breathing" of the cutoff, as in the intro
  const lfo = audioCtx.createOscillator(), lfoDepth = audioCtx.createGain();
  lfo.frequency.value = 0.22; lfoDepth.gain.value = 300; // ± cents on the cutoff
  lfo.connect(lfoDepth).connect(filter.detune); oscs.push(lfo);

  const peak = 0.17 * feel.amp; // the unison is averaged (1/3 each), so this keeps roughly the old two-oscillator loudness
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + Math.max(0.003, SYNTH.attack));
  gain.gain.setTargetAtTime(Math.max(0.0001, peak * SYNTH.sustain), now + Math.max(0.003, SYNTH.attack), Math.max(0.01, SYNTH.decay) / 3);
  filter.connect(gain);
  routeAudio(gain);
  oscs.forEach(o => o.start(now));
  activeVoices.set(key, { osc: oscs[1], oscs, gain, synth: true });
}

// Sampled piano (Settings → Sound → Piano, and the Songs tab's Piano): the Salamander Grand Piano by Alexander Holm
// (CC-BY 3.0), in samples/piano/ (tools/piano-samples.ps1), one recording every three semitones from A0 to C8
// (C, D#, F#, A) in four velocity layers (Salamander's v4, v8, v12, v16: soft to hard, each with its own tone),
// cut to 10 s. Loaded on first use (loadPianoSamples), a few at a time, the layer for an unknown velocity first and
// from middle C outwards; until a note has a recording startSampledPiano falls back to the synth above.
// Each recording is stored at 32 kHz, with the silence before the attack trimmed (up to 30 ms: the keys answer
// straight away) and its end faded out. The Piano popup (pianoSettings) sets how much is kept:
// - stereo: both microphones; off keeps one microphone's channel (half the memory). They stood apart, so adding
//   them up to mono would cancel some frequencies and sound hollow;
// - layers: 4, 2 (v8, v16) or 1 (v12) velocity layers;
// - length: how many seconds of each recording ring (the rest is cut, faded).
// Full version on a desktop: stereo, 4 layers, 10 s (~250 MB); light version or a touch device: one channel,
// 2 layers, 6 s (~40 MB). Each saved apart (piano-settings-full / -light). A change reloads the recordings, the old
// ones playing until the new ones are in.
// The layers keep their recorded levels (soft ones are quieter). Each note plays the nearest recording (re-pitched by
// at most a semitone) blended from the two active layers around its velocity (so the tone brightens smoothly as you
// play harder, not in steps); below the softest / above the hardest the velocity shades that layer's loudness a
// little; while loading, the nearest layer already in. Same voice map, so stopPianoNote(key) ends it.
// Letting go: the note dies away as damped strings do, slower in the bass (pianoRelease; no dampers above F#6), and the
// key's release noise plays softly (the damper landing, Salamander's rel1..rel88 as samples/piano/rel<midi>.mp3,
// playPianoRelease; Piano popup → Key release, keyNoise), not when the key is struck again (stopPianoNote again).
const PIANO_SAMPLE_NAMES = ['C', 'Ds', 'Fs', 'A'];
const PIANO_LAYERS = [{ file: 'v4', at: 0.23 }, { file: 'v8', at: 0.48 }, { file: 'v12', at: 0.73 }, { file: 'v16', at: 0.98 }];
const PIANO_LAYER_SETS = { 4: [0, 1, 2, 3], 2: [1, 3], 1: [2] };
const PIANO_DEFAULT_VEL = 0.7; // mouse, computer keys, mic: no velocity
const PIANO_RATE = 32000, PIANO_FADE = 1.5;
const PIANO_DEFAULTS = { full: { stereo: true, layers: 4, length: 10, keyNoise: true }, light: { stereo: false, layers: 2, length: 6, keyNoise: true } };
const pianoProfile = () => LITE || IS_TOUCH ? 'light' : 'full'; // LITE is set (start screen) before the samples load
function pianoSettings() {
  const p = pianoProfile();
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('piano-settings-' + p)) || {}; } catch { /* storage unavailable */ }
  return { ...PIANO_DEFAULTS[p], ...saved };
}
function setPianoSettings(values, reload = true) { // reload: the setting changes which recordings are loaded
  try { localStorage.setItem('piano-settings-' + pianoProfile(), JSON.stringify({ ...pianoSettings(), ...values })); } catch { /* ignore */ }
  if (reload) reloadPianoSamples();
}
const pianoMemoryMB = s => Math.round(62 * s.layers * (s.stereo ? 1 : 0.5) * Math.min(1, s.length / 10)); // measured: 4 layers, stereo, 10 s ≈ 250 MB
let pianoSamples = new Map(); // midi → [AudioBuffer per layer]
let pianoSamplesPrev = null; // while reloading after a settings change: the old recordings, still played
let pianoSamplesLoading = null, pianoGen = 0;
const pianoReleases = new Map(); // midi → AudioBuffer of the key's release noise (kept across settings changes)
const PIANO_RELEASE_VOL = 0.03; // of a note's loudness: just a hint
const pianoRelease = midi => midi >= 91 ? 1.2 : 0.25 + 0.75 * Math.max(0, 88 - midi) / 67; // s: ~1 s in the bass, 0.6 s at middle C
const pianoLayerFor = (v, set = PIANO_LAYER_SETS[pianoSettings().layers] || PIANO_LAYER_SETS[4]) =>
  set.reduce((best, i) => Math.abs(PIANO_LAYERS[i].at - v) < Math.abs(PIANO_LAYERS[best].at - v) ? i : best, set[0]);
async function preparePianoSample(buf, { stereo, length }) { // → PIANO_RATE, starting at the attack, faded at the end
  const chans = [...Array(buf.numberOfChannels)].map((_, c) => buf.getChannelData(c));
  let peak = 0;
  for (const d of chans) for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  let onset = 0;
  while (onset < chans[0].length && chans.every(d => Math.abs(d[onset]) < peak * 0.02)) onset++;
  const start = Math.min(0.03, Math.max(0, onset / buf.sampleRate - 0.002)), dur = Math.min(length, buf.duration - start);
  stereo = stereo && buf.numberOfChannels > 1;
  const off = new OfflineAudioContext(stereo ? 2 : 1, Math.ceil(dur * PIANO_RATE), PIANO_RATE);
  const src = off.createBufferSource(), fade = off.createGain();
  src.buffer = buf;
  fade.gain.setValueAtTime(1, Math.max(0, dur - PIANO_FADE));
  fade.gain.linearRampToValueAtTime(0, dur);
  if (stereo) src.connect(fade);
  else { const split = off.createChannelSplitter(buf.numberOfChannels); src.connect(split); split.connect(fade, 0); } // one microphone
  fade.connect(off.destination);
  src.start(0, start);
  return off.startRendering();
}
function loadPianoSamples() {
  if (pianoSamplesLoading || !audioCtx) return pianoSamplesLoading;
  const settings = pianoSettings(), gen = pianoGen, into = pianoSamples;
  const set = PIANO_LAYER_SETS[settings.layers] || PIANO_LAYER_SETS[4], first = pianoLayerFor(PIANO_DEFAULT_VEL, set);
  const layerOrder = [...set].sort((a, b) => Math.abs(a - first) - Math.abs(b - first));
  const notes = [], jobs = [];
  for (let midi = 21; midi <= 108; midi += 3) notes.push(midi);
  notes.sort((a, b) => Math.abs(a - 60) - Math.abs(b - 60));
  layerOrder.forEach((layer, i) => {
    notes.forEach(midi => jobs.push({ midi, layer }));
    if (i === 0) for (let midi = 21; midi <= 90; midi++) if (!pianoReleases.has(midi)) jobs.push({ midi, release: true }); // small: right after the first layer
  });
  const loadOne = ({ midi, layer, release }) => {
    if (release) return fetch(`samples/piano/rel${midi}.mp3`)
      .then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status)))
      .then(data => audioCtx.decodeAudioData(data))
      .then(buf => pianoReleases.set(midi, buf))
      .catch(() => { /* missing: that key lets go silently */ });
    const file = PIANO_SAMPLE_NAMES[(midi % 12) / 3] + (Math.floor(midi / 12) - 1) + PIANO_LAYERS[layer].file;
    return fetch(`samples/piano/${file}.mp3`)
      .then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status)))
      .then(data => audioCtx.decodeAudioData(data))
      .then(buf => preparePianoSample(buf, settings))
      .then(buf => {
        if (!into.has(midi)) into.set(midi, []);
        into.get(midi)[layer] = buf;
      })
      .catch(() => { /* missing: that note / layer falls back to another layer or the synth piano */ });
  };
  const worker = async () => { while (jobs.length && gen === pianoGen) await loadOne(jobs.shift()); }; // few at a time: decoding is memory-hungry; a newer load stops this one
  return pianoSamplesLoading = Promise.all([worker(), worker(), worker()]).then(() => { if (gen === pianoGen) pianoSamplesPrev = null; });
}
function reloadPianoSamples() { // after a settings change (only if the recordings were wanted already)
  if (!pianoSamplesLoading) return;
  pianoGen++;
  if (!pianoSamplesPrev) pianoSamplesPrev = pianoSamples; // keep the most complete old set playing meanwhile
  pianoSamples = new Map();
  pianoSamplesLoading = null;
  loadPianoSamples();
}
function startSampledPiano(noteNum, now, velocity = null, key = noteNum) {
  const nearest = Math.max(21, Math.min(108, 21 + Math.round((noteNum - 21) / 3) * 3));
  const v = Math.max(0.05, Math.min(1, velocity == null ? PIANO_DEFAULT_VEL : velocity));
  const set = PIANO_LAYER_SETS[pianoSettings().layers] || PIANO_LAYER_SETS[4];
  const below = [...set].reverse().find(i => PIANO_LAYERS[i].at <= v), above = set.find(i => PIANO_LAYERS[i].at >= v);
  let parts = []; // [buffer, gain]
  for (const map of [pianoSamples, pianoSamplesPrev]) { // the new recordings first
    const layers = (map && map.get(nearest)) || [];
    if (below != null && above != null && layers[below] && layers[above]) { // between two layers: blend them
      const w = above === below ? 1 : (v - PIANO_LAYERS[below].at) / (PIANO_LAYERS[above].at - PIANO_LAYERS[below].at);
      parts = [[layers[below], 0.75 * (1 - w)], [layers[above], 0.75 * w]].filter(([, g]) => g > 0.01);
    } else { // past either end, or still loading: the loaded layer nearest the velocity, its level shaded
      const want = pianoLayerFor(v, set);
      for (let d = 0; d < PIANO_LAYERS.length && !parts.length; d++) {
        const used = layers[want + d] ? want + d : layers[want - d] ? want - d : -1;
        if (used >= 0) parts = [[layers[used], 0.75 * Math.pow(v / PIANO_LAYERS[used].at, 0.6)]];
      }
    }
    if (parts.length) break;
  }
  if (!parts.length || Math.abs(nearest - noteNum) > 2) {
    loadPianoSamples();
    startSynthNote(noteNum, 440 * Math.pow(2, (noteNum - 69) / 12), now, velocity, key);
    return;
  }
  const out = audioCtx.createGain();
  out.gain.setValueAtTime(1, now);
  const srcs = parts.map(([buf, g]) => {
    const src = audioCtx.createBufferSource(), level = audioCtx.createGain();
    src.buffer = buf;
    src.playbackRate.value = Math.pow(2, (noteNum - nearest) / 12);
    level.gain.value = g;
    src.connect(level).connect(out);
    src.start(now);
    return src;
  });
  routeAudio(out);
  activeVoices.set(key, { osc: srcs[0], oscs: srcs, gain: out, release: pianoRelease(noteNum), damper: noteNum <= 90 ? noteNum : null, vel: v });
}
function playPianoRelease(midi, v, now) { // the damper landing on the strings as the key comes up
  const buf = pianoReleases.get(midi);
  if (!buf || !audioCtx || !pianoSettings().keyNoise) return; // Piano popup → Key release
  const src = audioCtx.createBufferSource(), level = audioCtx.createGain();
  src.buffer = buf;
  level.gain.value = 0.75 * PIANO_RELEASE_VOL * Math.pow(v, 0.8);
  src.connect(level);
  routeAudio(level);
  src.start(now);
}

// Synth popup: same look/behaviour as the chord category menus; sits next to the Piano sound menu.
(() => {
  const details = document.createElement('details');
  details.className = 'chord-category'; details.id = 'synth-menu';
  const summary = document.createElement('summary');
  const label = document.createElement('div');
  label.className = 'toggle-label-row chord-category-master';
  label.innerHTML = `<span class="toggle-switch"><input type="checkbox" id="opt-synth" aria-label="Sound on/off"><span class="toggle-slider"></span></span> Synth`;
  const sw = label.querySelector('.toggle-switch'), input = label.querySelector('input');
  input.checked = $('opt-sound').checked && instrument === 'synth'; // Piano and Synth switches: one at a time, both off = no sound
  sw.addEventListener('click', event => {
    event.stopPropagation();
    if (event.target !== input) { event.preventDefault(); input.checked = !input.checked; input.dispatchEvent(new Event('change')); }
  });
  input.addEventListener('change', () => setInstrumentSwitch('synth', input.checked));
  const indicator = document.createElement('span');
  indicator.className = 'chord-category-menu-indicator'; indicator.textContent = '+'; indicator.setAttribute('aria-hidden', 'true');
  summary.append(label, indicator);
  details.appendChild(summary);

  const items = document.createElement('div');
  items.className = 'chord-category-items synth-panel'; items.id = 'synth-panel'; items.hidden = true;
  // Short preview note so changes can be heard straight away.
  let previewTimer = null;
  const preview = () => {
    if (!audioCtx || !input.checked) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => { // always the synth, even while the keys are set to Piano
      if (audioCtx.state !== 'running') return;
      stopPianoNote(60); startSynthNote(60, 440 * Math.pow(2, -9 / 12), audioCtx.currentTime);
      setTimeout(() => stopPianoNote(60), 450);
    }, 120);
  };
  const waves = document.createElement('div');
  waves.className = 'synth-waves';
  [['sine', 'Sine'], ['triangle', 'Tri'], ['sawtooth', 'Saw'], ['square', 'Square']].forEach(([value, text]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = text; b.setAttribute('aria-pressed', String(SYNTH.wave === value));
    b.addEventListener('click', () => {
      SYNTH.wave = value;
      waves.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      preview();
    });
    waves.appendChild(b);
  });
  // Light version only: a switch for the full version's richer key synth (3-voice unison, velocity). Remembered.
  const full = document.createElement('label');
  full.className = 'toggle-label-row synth-full-row';
  full.innerHTML = `<span class="toggle-switch"><input type="checkbox" aria-label="Full synth"><span class="toggle-slider"></span></span> Full synth`;
  const fullInput = full.querySelector('input');
  fullInput.checked = fullSynthInLite;
  full.hidden = true; // shown when the popup opens in the light version
  fullInput.addEventListener('change', () => {
    fullSynthInLite = fullInput.checked;
    try { localStorage.setItem(FULL_SYNTH_KEY, fullSynthInLite ? '1' : '0'); } catch { /* ignore */ }
    preview();
  });
  items.appendChild(full);
  items.appendChild(waves);
  [
    ['attack', 'Attack', 0.003, 1.5, 0.001], ['decay', 'Decay', 0.02, 2, 0.01], ['sustain', 'Sustain', 0, 1, 0.01],
    ['release', 'Release', 0.02, 3, 0.01], ['cutoff', 'Cutoff', 200, 8000, 10], ['reso', 'Resonance', 0.5, 18, 0.1],
    ['detune', 'Detune', 0, 30, 1], ['fenv', 'Filter env', 0, 1, 0.01],
  ].forEach(([key, text, min, max, step]) => {
    const row = document.createElement('label');
    row.className = 'synth-row';
    row.innerHTML = `<span>${text}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${SYNTH[key]}">`;
    row.querySelector('input').addEventListener('input', e => { SYNTH[key] = +e.target.value; preview(); });
    items.appendChild(row);
  });
  const applySynth = (values, withPreview = true) => {
    Object.assign(SYNTH, values);
    items.querySelectorAll('.synth-row input').forEach((el, i) => { el.value = SYNTH[['attack', 'decay', 'sustain', 'release', 'cutoff', 'reso', 'detune', 'fenv'][i]]; });
    const waveNames = { sine: 'Sine', triangle: 'Tri', sawtooth: 'Saw', square: 'Square' };
    waves.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.textContent === waveNames[SYNTH.wave])));
    if (withPreview) preview();
  };
  applySynthPreset = values => applySynth(values, false); // palette switches: the palette drone plays instead of a preview
  // Randomise within musical ranges: mostly quick attacks, cutoff spread on a log scale.
  const rand = (a, b) => a + Math.random() * (b - a);
  const randomSynth = () => ({
    wave: ['sine', 'triangle', 'sawtooth', 'square'][Math.floor(Math.random() * 4)],
    attack: +(Math.random() < .7 ? rand(.003, .06) : rand(.06, .6)).toFixed(3),
    decay: +rand(.05, 1.5).toFixed(2), sustain: +rand(.2, .9).toFixed(2), release: +rand(.8, 3).toFixed(2),
    cutoff: Math.round(400 * Math.pow(15, Math.random())), reso: +rand(.5, 10).toFixed(1), detune: Math.round(rand(0, 25)), fenv: +rand(0, 1).toFixed(2),
  });
  const buttons = document.createElement('div');
  buttons.className = 'synth-buttons';
  [['Randomise', () => applySynth(randomSynth())], ['Reset', () => applySynth(paletteSound(currentPalette()).synth)]].forEach(([text, fn]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'action-btn'; b.textContent = text;
    b.addEventListener('click', fn);
    buttons.appendChild(b);
  });
  items.appendChild(buttons);
  document.body.appendChild(items);

  const positionPopup = () => {
    const s = summary.getBoundingClientRect(), p = items.getBoundingClientRect();
    let top = s.bottom + 4;
    if (top + p.height > window.innerHeight - 8) top = Math.max(8, s.top - p.height - 4);
    items.style.left = `${Math.max(8, Math.min(s.left, window.innerWidth - p.width - 8))}px`;
    items.style.top = `${top}px`;
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
    full.hidden = !LITE; // the Full synth switch only means something in the light version
    if (details.open) { items.hidden = false; requestAnimationFrame(positionPopup); }
  });

  // Piano sound and Synth side by side.
  const row = document.createElement('div');
  row.className = 'sound-menus'; row.id = 'sound-row'; // (the Visuals row is a .sound-menus too)
  $('sound-menu').before(row);
  // Piano popup: a switch like the Synth one (the instrument for the keys in every tab but Songs, which has its own)
  // and the sampled piano's settings (pianoSettings: stereo, velocity layers, note length), with the memory they take.
  const piano = document.createElement('details');
  piano.className = 'chord-category'; piano.id = 'piano-menu';
  const pSummary = document.createElement('summary');
  const pLabel = document.createElement('div');
  pLabel.className = 'toggle-label-row chord-category-master';
  pLabel.title = 'A recorded grand piano (Salamander Grand Piano by Alexander Holm, CC-BY 3.0)';
  pLabel.innerHTML = `<span class="toggle-switch"><input type="checkbox" id="opt-piano" aria-label="Piano on/off"><span class="toggle-slider"></span></span> Piano`;
  const pSw = pLabel.querySelector('.toggle-switch'), pInput = pLabel.querySelector('input');
  pInput.checked = $('opt-sound').checked && instrument === 'piano';
  pSw.addEventListener('click', event => {
    event.stopPropagation();
    if (event.target !== pInput) { event.preventDefault(); pInput.checked = !pInput.checked; pInput.dispatchEvent(new Event('change')); }
  });
  pInput.addEventListener('change', () => setInstrumentSwitch('piano', pInput.checked));
  const pIndicator = document.createElement('span');
  pIndicator.className = 'chord-category-menu-indicator'; pIndicator.textContent = '+'; pIndicator.setAttribute('aria-hidden', 'true');
  pSummary.append(pLabel, pIndicator);
  piano.appendChild(pSummary);

  const pItems = document.createElement('div');
  pItems.className = 'chord-category-items synth-panel'; pItems.id = 'piano-panel'; pItems.hidden = true;
  const stereo = document.createElement('label');
  stereo.className = 'toggle-label-row';
  stereo.innerHTML = `<span class="toggle-switch"><input type="checkbox" aria-label="Stereo"><span class="toggle-slider"></span></span> Stereo`;
  stereo.title = 'Both microphones of the recording. Off: one microphone, half the memory';
  const stereoInput = stereo.querySelector('input');
  stereoInput.addEventListener('change', () => { setPianoSettings({ stereo: stereoInput.checked }); refreshPiano(); });
  const keyNoise = document.createElement('label');
  keyNoise.className = 'toggle-label-row';
  keyNoise.innerHTML = `<span class="toggle-switch"><input type="checkbox" aria-label="Key release"><span class="toggle-slider"></span></span> Key release`;
  keyNoise.title = 'The soft sound of the damper landing on the strings when you let go of a key';
  const keyNoiseInput = keyNoise.querySelector('input');
  keyNoiseInput.addEventListener('change', () => setPianoSettings({ keyNoise: keyNoiseInput.checked }, false));
  const choiceRow = (text, key, options, tip) => { // a label + segmented buttons, like the synth's wave picker
    const r = document.createElement('div');
    r.className = 'synth-row'; r.title = tip;
    const seg = document.createElement('div');
    seg.className = 'synth-waves';
    options.forEach(([value, name]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = name; b.dataset.value = value;
      b.addEventListener('click', () => { setPianoSettings({ [key]: value }); refreshPiano(); });
      seg.appendChild(b);
    });
    r.innerHTML = `<span>${text}</span>`;
    r.appendChild(seg);
    r.dataset.key = key;
    return r;
  };
  const layersRow = choiceRow('Layers', 'layers', [[1, '1'], [2, '2'], [4, '4']], 'Velocity layers: recordings of soft to hard playing, each with its own tone. More = more natural touch, more memory');
  const lengthRow = choiceRow('Length', 'length', [[4, '4 s'], [6, '6 s'], [10, '10 s']], 'How long a held note rings before it fades out. Longer = more memory');
  const mem = document.createElement('p');
  mem.className = 'piano-mem';
  const pButtons = document.createElement('div');
  pButtons.className = 'synth-buttons';
  const pReset = document.createElement('button');
  pReset.type = 'button'; pReset.className = 'action-btn'; pReset.textContent = 'Reset';
  pReset.title = LITE || IS_TOUCH ? 'Back to the light defaults' : 'Back to the defaults';
  pReset.addEventListener('click', () => {
    try { localStorage.removeItem('piano-settings-' + pianoProfile()); } catch { /* ignore */ }
    reloadPianoSamples(); refreshPiano();
  });
  pButtons.appendChild(pReset);
  pItems.append(stereo, keyNoise, layersRow, lengthRow, mem, pButtons);
  document.body.appendChild(pItems);
  function refreshPiano() { // the controls show the settings of this version (full desktop / light or touch)
    const s = pianoSettings();
    stereoInput.checked = s.stereo;
    keyNoiseInput.checked = s.keyNoise;
    [layersRow, lengthRow].forEach(r => r.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.value === s[r.dataset.key]))));
    mem.textContent = `≈ ${pianoMemoryMB(s)} MB of memory` + (pianoProfile() === 'light' ? ' (light / mobile settings)' : '');
  }
  const positionPiano = () => {
    const s = pSummary.getBoundingClientRect(), p = pItems.getBoundingClientRect();
    let top = s.bottom + 4;
    if (top + p.height > window.innerHeight - 8) top = Math.max(8, s.top - p.height - 4);
    pItems.style.left = `${Math.max(8, Math.min(s.left, window.innerWidth - p.width - 8))}px`;
    pItems.style.top = `${top}px`;
  };
  pSummary.addEventListener('click', event => {
    if (event.target.closest('.toggle-switch')) return;
    event.preventDefault();
    document.querySelectorAll('.chord-category[open]').forEach(c => {
      if (c !== piano) { c.open = false; c.querySelector('.chord-category-menu-indicator').textContent = '+'; }
    });
    document.querySelectorAll('.chord-category-items').forEach(menu => { menu.hidden = true; });
    piano.open = !piano.open;
    pIndicator.textContent = piano.open ? '-' : '+';
    if (piano.open) { refreshPiano(); pItems.hidden = false; requestAnimationFrame(positionPiano); }
  });

  // One instrument at a time: turning one on turns the other off; turning it off leaves no sound (#opt-sound).
  function setInstrumentSwitch(which, on) {
    if (on) {
      instrument = which;
      try { localStorage.setItem(INSTRUMENT_KEY, instrument); } catch { /* ignore */ }
      if (which === 'piano') { initAudio(); loadPianoSamples(); }
    }
    pInput.checked = on && which === 'piano';
    input.checked = on && which === 'synth';
    const sound = $('opt-sound');
    if (sound.checked !== on) { sound.checked = on; sound.dispatchEvent(new Event('change')); }
  }
  row.append(piano, details);
  // Master volume, next to the Synth switch.
  const vol = document.createElement("label");
  vol.className = "volume-row";
  vol.innerHTML = `<span>Volume</span><input type="range" id="volume" min="0" max="2.5" step="0.01" value="${getVolume()}" aria-label="Volume">`;
  vol.querySelector("input").addEventListener("input", e => {
    try { localStorage.setItem("volume", e.target.value); } catch {}
    if (masterGainNode) masterGainNode.gain.setTargetAtTime(+e.target.value, audioCtx.currentTime, 0.02);
  });
  row.append(vol);
  $('sound-menu').hidden = true; // piano presets replaced by the synth
})();
function getVolume() {
  try { const v = localStorage.getItem('volume'); return v === null ? 0.7 : +v; } catch { return 0.7; }
}

// ---------- Ambient drone ----------
// A soft, endless pad (Settings → Sound, next to the Synth; on by default, remembered).
// The low chord tones on gently detuned oscillators, each swelling and fading on its own slow breath, under a dark
// low-pass that drifts. Uses the palette synth's wave (square softened to triangle), cross-fades when the palette
// changes (onPaletteChange), and follows the sound switch and the master volume.
// In Chords and Scales it moves to whatever is asked, re-striking the changed notes as a slow arpeggio
// (retuneBed, called from setChord / setScale / setMode).
const DRONE_KEY = 'ambient-drone';
let bed = null; // the playing drone: { out, nodes, voices: [{ n, src, off, g, type, cents, cur: { key, oscs } }], root, pad / rich / bleak layers, filters, timer }
const droneWanted = () => $('opt-drone').checked && $('opt-sound').checked && mode !== 'songs'; // silent in Songs (the song is the music)
const bedHz = n => 440 * Math.pow(2, (n - 69) / 12);
// The five notes the drone holds (lowest first, the first is the sine sub). In Chords and Scales: the asked root
// with a sub-octave under it, its fifth, the octave and the third an octave up (sus chords use their 4th/2nd,
// dim/aug their own fifth), so it always sits under the target. The root stays near the previous one (A♭1–B2) so
// the change is small. Elsewhere, and in Ear training so it doesn't give the answer away: the palette's chord.
function bedNotes(prevRoot) {
  const asked = mode === 'chords' ? target : mode === 'scales' ? sTarget : null;
  if (!asked) { const c = paletteSound(currentPalette()).chord; return { root: null, notes: [c[0] - 12, ...c.slice(0, 4)] }; }
  const iv = asked.type.iv.map(x => x % 12);
  const fifth = [7, 6, 8].find(x => iv.includes(x)) ?? 7;
  const third = [4, 3, 5, 2].find(x => iv.includes(x)) ?? fifth;
  const near = prevRoot ?? 38;
  let r = near - ((near - asked.root) % 12 + 12) % 12; // the asked root at or below the previous one
  if (near - r > 6) r += 12;                            // ... or above it, whichever is closer
  while (r < 32) r += 12;
  while (r > 47) r -= 12;
  return { root: r, notes: [r - 12, r, r + fifth, r + 12, r + 12 + third] };
}
// One sounding note of a drone voice: its unison oscillators into their own key gain (the "key press"), which feeds
// the voice's breathing gain. fadeIn = 0 starts at full level (the drone's own swell-in handles the start).
function bedTone(v, t, fadeIn) {
  const key = audioCtx.createGain();
  key.gain.setValueAtTime(fadeIn ? 0 : 1, t);
  if (fadeIn) key.gain.setTargetAtTime(1, t, fadeIn);
  key.connect(v.g);
  const oscs = v.cents.map(c => {
    const osc = audioCtx.createOscillator();
    osc.type = v.type;
    osc.frequency.value = bedHz(v.n);
    osc.detune.value = c;
    osc.connect(key); osc.start(t);
    return osc;
  });
  return { key, oscs };
}
// Chord change, played like a keyboard player would, never bending a pitch: notes the two chords share keep
// ringing; the others are re-struck one after another from the bottom up (a slow arpeggio, BED_ARP_STEP apart),
// each new note swelling in while the old one lets go just after it, as with the sustain pedal half down.
// Octave doublings of the same chord tone (src) move together, like one hand.
const BED_ARP_STEP = 0.22;
function retuneBed() {
  if (!bed) return;
  const { root, notes } = bedNotes(bed.root);
  const t = audioCtx.currentTime;
  bed.root = root;
  const moving = bed.voices.filter(v => notes[v.src] + v.off !== v.n);
  const order = [...new Set(moving.map(v => v.src))].sort((a, b) => notes[a] - notes[b]); // lowest first
  moving.forEach(v => { // every voice sits on one of bedNotes (src) shifted by whole octaves (off)
    const at = t + order.indexOf(v.src) * BED_ARP_STEP;
    const old = v.cur, g = old.key.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(at); else g.cancelScheduledValues(at);
    g.setTargetAtTime(0, at + 0.08, 0.45); // released just after the new note is struck
    old.oscs.forEach(o => o.stop(at + 3));
    v.n = notes[v.src] + v.off;
    v.cur = bedTone(v, at, 0.18);
  });
}
// The drone follows how alive the background is (window.ambientLife from js/ambient.js: 0 = no shapes left,
// 1 = at the shape limit), in three layers that cross-fade over a few seconds:
// - the pad (the five bedNotes): full and opening up with more shapes, almost silent with none;
// - a rich layer (the chord doubled one and two octaves up, wide detune, brighter filter) that only swells in as
//   the scene fills up, for a big, dramatic sound;
// - a desolate layer for an empty scene: a lone high tone beating against itself and a faint sub hum.
// Without WebGL (no shapes) it stays at a middle level.
const bedLife = () => (typeof window.ambientLife === 'function' ? window.ambientLife() : 0.4);
function startBed() {
  if (bed || !audioCtx || audioCtx.state !== 'running' || !droneWanted()) return;
  const sound = paletteSound(currentPalette());
  const t = audioCtx.currentTime;
  const wave = sound.synth.wave === 'square' ? 'triangle' : sound.synth.wave;
  const out = audioCtx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.setTargetAtTime(0.065, t, 1.8); // swells in over ~5s
  routeAudio(out);
  const nodes = [];
  const lfo = (freq, depth, target) => { // a slow oscillator wobbling an AudioParam
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = freq; g.gain.value = depth;
    o.connect(g).connect(target); nodes.push(o);
  };
  const layer = (into, start) => { const g = audioCtx.createGain(); g.gain.value = start; g.connect(into); return g; };
  const life = bedLife();
  const cutoff = Math.min(900, Math.max(280, sound.synth.cutoff * 0.3));
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass'; filter.Q.value = 0.7;
  filter.frequency.value = cutoff;
  lfo(0.03, 350, filter.detune); // the filter opens and closes over ~30s
  const richFilter = audioCtx.createBiquadFilter();
  richFilter.type = 'lowpass'; richFilter.Q.value = 1.2;
  richFilter.frequency.value = cutoff * 2;
  lfo(0.021, 500, richFilter.detune);
  const pad = layer(out, 0), rich = layer(out, 0), bleak = layer(out, 0);
  filter.connect(pad);
  richFilter.connect(rich);
  const { root, notes } = bedNotes(null);
  const voices = [];
  // one held tone: unison oscillators (bedTone) into a breathing gain, panned, into a layer; retuneBed re-strikes it
  const voice = (src, off, { type, base, panTo, into, cents }) => {
    const g = audioCtx.createGain();
    g.gain.value = base;
    lfo(0.025 + Math.random() * 0.045, base * 0.6, g.gain); // each voice breathes on its own clock
    const pan = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
    if (pan) { pan.pan.value = panTo; g.connect(pan).connect(into); } else g.connect(into);
    const v = { n: notes[src] + off, src, off, g, type, cents };
    v.cur = bedTone(v, t, 0);
    voices.push(v);
  };
  // the pad: sub-octave root, root, then three more tones (bedNotes); lower voices louder
  notes.forEach((n, i) => voice(i, 0, {
    type: i === 0 ? 'sine' : wave, base: i === 0 ? 0.5 : i === 1 ? 0.35 : 0.22,
    panTo: i === 0 ? 0 : (i % 2 ? 0.4 : -0.4), into: filter, cents: LITE ? [0] : [-7, 7],
  }));
  // the rich layer: the chord again, an octave and two octaves up, spread wide
  [[1, 12, -0.7], [2, 12, 0.7], [4, 12, -0.35], [1, 24, 0.5], [2, 24, -0.55], [4, 24, 0.25]].forEach(([src, off, p], i) =>
    voice(src, off, { type: wave, base: i < 3 ? 0.2 : 0.11, panTo: p, into: richFilter, cents: LITE ? [0] : [-13, 0, 13] }));
  // the desolate layer: a lone tone three octaves over the sub (two sines a few cents apart, so it slowly beats)
  // and the sub itself, very quiet
  voice(0, 36, { type: 'sine', base: 0.09, panTo: -0.3, into: bleak, cents: [-3, 3] });
  voice(0, 0, { type: 'sine', base: 0.22, panTo: 0, into: bleak, cents: [0] });
  nodes.forEach(o => o.start(t));
  bed = { out, nodes, voices, root, pad, rich, bleak, filter, richFilter, cutoff, timer: 0 };
  shapeBed(life, 0.01); // start at the scene's current state (inside the swell-in)
  bed.timer = setInterval(() => shapeBed(bedLife(), 1.5), 250);
}
// Set the three layers for a life value (0..1), easing over tau seconds.
function shapeBed(life, tau) {
  if (!bed) return;
  const t = audioCtx.currentTime, set = (param, v) => param.setTargetAtTime(v, t, tau);
  const lonely = Math.pow(Math.max(0, 1 - life * 4), 2); // full with no shapes, gone by ~a quarter of the limit
  set(bed.pad.gain, 0.03 + 0.97 * Math.sqrt(life));      // nearly dead when empty, full early on
  set(bed.rich.gain, 0.9 * Math.pow(life, 1.4));         // the big sound needs a full scene
  set(bed.bleak.gain, lonely);
  set(bed.filter.frequency, bed.cutoff * (0.45 + 1.5 * life)); // darker when empty, opening up as it fills
  set(bed.filter.Q, 0.7 + 2.3 * life * life);            // a resonant edge at the top end
  set(bed.richFilter.frequency, bed.cutoff * (1.2 + 3.5 * life));
}
function stopBed(fade = 2.5) {
  if (!bed) return;
  const { out, nodes, voices } = bed;
  clearInterval(bed.timer);
  bed = null;
  const t = audioCtx.currentTime;
  out.gain.cancelScheduledValues(t);
  out.gain.setValueAtTime(out.gain.value, t);
  out.gain.setTargetAtTime(0.0001, t, fade / 3);
  nodes.forEach(o => o.stop(t + fade + 0.5));
  // the notes now sounding (released ones already have their own stop; stopping again could throw)
  voices.forEach(v => v.cur.oscs.forEach(o => { try { o.stop(t + fade + 0.5); } catch { /* already stopped */ } }));
  setTimeout(() => out.disconnect(), (fade + 1) * 1000);
}
function updateBed() {
  if (!droneWanted()) { stopBed(); return; }
  initAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'running') startBed(); else audioCtx.resume().then(startBed).catch(() => {});
}
(() => {
  const input = $('opt-drone');
  // #global-toggles is hidden in the settings panel: show the switch in the Synth / Volume row instead
  const soundRow = $('sound-row');
  if (soundRow) soundRow.append(input.closest('label'));
  try { input.checked = localStorage.getItem(DRONE_KEY) !== '0'; } catch { /* storage unavailable: stays on */ }
  input.addEventListener('change', () => {
    if (!LITE) try { localStorage.setItem(DRONE_KEY, input.checked ? '1' : '0'); } catch { /* ignore */ } // light version: not saved
    if (appReady) updateBed();
  });
  // the sound on/off switch (the Synth switch sets #opt-sound without an event, so listen to both)
  $('opt-sound').addEventListener('change', () => { if (appReady) updateBed(); });
  const synthSwitch = $('opt-synth');
  if (synthSwitch) synthSwitch.addEventListener('change', () => { if (appReady) updateBed(); });
})();
