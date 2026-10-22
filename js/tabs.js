'use strict';
// ---------- tabs ----------
const CHORD_NOTE = $('kbd-note').textContent;
const SCALE_NOTE = 'Play the scale one note at a time, starting from the selected octave. With the microphone, play the whole scale and pause: it is checked once you stop.';
const EAR_NOTE = IS_TOUCH ? 'Tap the chord display to hear the target chord again, double-tap for a new one. Then play it back!' : 'Click the chord display or press Space to hear the target chord again; double-click or press Space twice for a new one. Then play it back!';
const DETECT_NOTE = 'Play any notes on a MIDI keyboard, through the microphone, on the keys above or on your computer keyboard to see the chord identified in real time.';

function showChord() {
  locked = false;
  updateChordInfo(target.type, mode !== 'ear');
  if (mode === 'ear') chordEl.textContent = '???'; else renderTargetName(); chordEl.classList.remove('small-text');
  hintEl.textContent = mode === 'ear' ? EAR_PLAY_HINT : '';
  drawTarget(); evaluate(); updateRootOctaveDisplay(); markActiveChordChip();
}

function setMode(m) {
  if (m === mode) return;
  const keepMicActive = micActive && m !== 'theory' && m !== 'contact'; // Songs listens too (js/songs.js gets the notes via noteOn)
  if (mode === 'songs') songApp.hide();
  if (micActive && !keepMicActive) stopMicInput();
  else if (keepMicActive) releaseAllMicNotes();
  mode = m;
  if (appReady) updateBed(); // the ambient drone stops in Songs and comes back when you leave (js/audio.js)
  retuneBed(); // the ambient drone follows the asked chord/scale, or goes back to the palette chord (js/audio.js)
  skipNextTiming = true;
  updateMicOfferHint();
  if (target) target.untimed = true;
  if (sTarget) sTarget.untimed = true;
  updateChordInfo(null);
  document.body.classList.toggle('mode-chords', m === 'chords');
  document.body.classList.toggle('mode-detector', m === 'detector');
  document.body.classList.toggle('mode-scales', m === 'scales');
  clearTimeout(advanceTimer); clearTimeout(missTimer);
  held.clear(); Object.keys(keyEls).forEach(n => updatePressedKeysDisplay());
  locked = false; setState('');

  const isChord = (m === 'chords');
  const isScale = (m === 'scales');
  const isEar = (m === 'ear');
  const isDetect = (m === 'detector');
  const isTheory = (m === 'theory');
  const isContact = (m === 'contact');
  const isSongs = (m === 'songs');
  const isRoutine = (m === 'routine');
  const isPage = isTheory || isContact || isSongs || isRoutine; // pages: no chord display or trainer keyboard

  $('opt-show-text').textContent = isScale ? 'Show scale on keyboard' : 'Show chord on keyboard';
  $('stage-next-hint').textContent = isEar ? (IS_TOUCH ? 'single tap: play again · double tap: next chord' : 'click or space: play again · double-click or double space: next chord') : `${TAP} for next ${isScale ? 'scale' : 'chord'}`;
  $('stage-next-hint').hidden = isDetect || isPage;

  $('tab-chords').setAttribute('aria-selected', String(isChord));$('tab-chords').tabIndex = isChord ? 0 : -1;
  $('tab-scales').setAttribute('aria-selected', String(isScale));$('tab-scales').tabIndex = isScale ? 0 : -1;
  $('tab-ear').setAttribute('aria-selected', String(isEar));$('tab-ear').tabIndex = isEar ? 0 : -1;
  $('tab-detector').setAttribute('aria-selected', String(isDetect));$('tab-detector').tabIndex = isDetect ? 0 : -1;
  $('tab-theory').setAttribute('aria-selected', String(isTheory));$('tab-theory').tabIndex = isTheory ? 0 : -1;
  $('tab-contact').setAttribute('aria-selected', String(isContact));$('tab-contact').tabIndex = isContact ? 0 : -1;
  $('tab-songs').setAttribute('aria-selected', String(isSongs));$('tab-songs').tabIndex = isSongs ? 0 : -1;
  $('tab-routine').setAttribute('aria-selected', String(isRoutine));$('tab-routine').tabIndex = isRoutine ? 0 : -1;

  $('theory-view').hidden = !isTheory;
  $('contact-view').hidden = !isContact;
  $('songs-view').hidden = !isSongs;
  $('routine-view').hidden = !isRoutine;
  $('stage').hidden = isPage;
  $('kbd-wrap').hidden = isPage;
  $('kbd-controls').hidden = isDetect || isEar || isPage;
  $('mic-input-panel').hidden = isTheory || isContact; // the microphone works in Songs too
  $('pool-area').hidden = isPage;
  $('options').hidden = isPage;
  $('kbd-note').hidden = isPage;
  $('groups').hidden = !isChord && !isEar; $('held').hidden = isScale;
  $('key-row').hidden = !isChord && !isEar; $('jazz-toggle-row').hidden = !isChord && !isEar; $('chord-pool-wrap').hidden = !isChord && !isEar;
  $('hand-selection-row').hidden = isDetect;
  $('octave-row').hidden = false;
  $('detector-controls').hidden = !isDetect;
  $('detector-history').hidden = !isDetect;

  $('scale-groups').hidden = !isScale; $('scale-opts').hidden = !isScale; $('scale-select-row').hidden = !isScale; $('trail').hidden = !isScale;
  $('root-octave').hidden = isScale;

  $('global-toggles').hidden = isDetect;

  $('sec-hands').hidden = false; // detector shows the octave slider; its hand selection row is hidden
  $('sec-chord-key').hidden = !isChord && !isEar;
  $('sec-chord-types').hidden = !isChord && !isEar;
  $('sec-chord-pool').hidden = !isChord && !isEar;
  $('sec-ear-opts').hidden = !isEar;
  $('sec-scale-select').hidden = !isScale;
  $('sec-scale-groups').hidden = !isScale;
  $('sec-scale-opts').hidden = !isScale;
  $('sec-scale-pool').hidden = !isScale;

  if (isSongs) songApp.show();
  if (isRoutine) routineApp.show();
  if (isPage) {
    $('kbd-note').textContent = CHORD_NOTE;
  } else if (isScale) {
    $('kbd-note').textContent = SCALE_NOTE;
    if (!sTarget) nextScale();
    else { setScale(sTarget.root, sTarget.type); }
  } else if (isEar) {
    $('kbd-note').textContent = EAR_NOTE;
    nextChord();
  } else if (isDetect) {
    $('kbd-note').textContent = DETECT_NOTE;
    detectorCollected.clear(); buildKeys();
    detectChordFromHeld();
  } else {
    $('kbd-note').textContent = CHORD_NOTE;
    buildKeys();
    nextChord();
  }

}

$('tab-chords').addEventListener('click', () => setMode('chords'));$('tab-scales').addEventListener('click', () => setMode('scales'));
$('tab-ear').addEventListener('click', () => setMode('ear'));$('tab-detector').addEventListener('click', () => setMode('detector'));
$('tab-theory').addEventListener('click', () => setMode('theory'));
$('tab-contact').addEventListener('click', () => setMode('contact'));
$('tab-songs').addEventListener('click', () => (mode === 'songs' ? songApp.library() : setMode('songs')));
$('tab-routine').addEventListener('click', () => setMode('routine'));

// Stage taps. Touch + ear training: single tap replays the chord, double tap goes to the next one.
// While the mic is offered (no MIDI), a double tap turns the microphone on (calibration follows).
let stageTapTimer = null;
function stageSingleTap() {
  if (routineApp.skipItem()) return; // in a practice routine: on to its next chord / scale
  if (mode === 'ear') playEarTrainingChord();
  else if (mode === 'scales') nextScale();
  else nextChord();
}
function stageDoubleTap() {
  if (micOfferPending()) { $('mic-toggle').checked = true; $('mic-toggle').dispatchEvent(new Event('change')); }
  else if (mode === 'ear') nextChord();
}
stage.addEventListener('click', () => {
  if (!((mode === 'ear') || micOfferPending())) { stageSingleTap(); return; }
  if (stageTapTimer) { clearTimeout(stageTapTimer); stageTapTimer = null; stageDoubleTap(); }
  else stageTapTimer = setTimeout(() => { stageTapTimer = null; stageSingleTap(); }, 280);
});

stage.addEventListener('keydown', (event) => {
  if (event.target.closest('button')) return;
  if (mode === 'ear' && event.key === ' ') return; // space replays the chord (global handler), not next
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (mode === 'scales') nextScale();
    else nextChord();
  }
});


// Settings popup: holds the sound and microphone sections (moved here, listeners intact).
const settingsPanel = $('settings-panel'), settingsBtn = $('settings-btn');
settingsPanel.prepend($('sec-global'), $('mic-input-panel'));
function setSettingsOpen(open) {
  settingsPanel.hidden = !open;
  settingsBtn.setAttribute('aria-expanded', String(open));
  if (open) settingsPanel.style.top = `${settingsBtn.getBoundingClientRect().bottom + 6}px`;
}
settingsBtn.addEventListener('click', () => setSettingsOpen(settingsPanel.hidden));
document.addEventListener('pointerdown', e => {
  if (settingsPanel.hidden || e.target.closest('#settings-panel, #settings-btn, .chord-category-items, .info-popover')) return;
  setSettingsOpen(false);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !settingsPanel.hidden) { setSettingsOpen(false); settingsBtn.focus(); } });
// Mic calibration opens its own dialog; get out of its way.
$('mic-toggle').addEventListener('change', e => { if (e.target.checked) setSettingsOpen(false); updateMicOfferHint(); });
$('mic-calibrate').addEventListener('click', () => setSettingsOpen(false));

// European (fixed-do) notation: swaps the shared note-name arrays in place and redraws.
const LETTER_NAMES = { names: NAMES.slice(), letters: LETTERS.slice() };
const EURO_NAMES = { names: ['Do','Reb','Re','Mib','Mi','Fa','Fa#','Sol','Lab','La','Sib','Si'], letters: ['Do','Re','Mi','Fa','Sol','La','Si'] };
function applyNoteNames(on) {
  const src = on ? EURO_NAMES : LETTER_NAMES;
  NAMES.splice(0, 12, ...src.names);
  LETTERS.splice(0, 7, ...src.letters);
}
function refreshNoteLabels() {
  [...keySelect.options].forEach((o, i) => {
    const k = MUSICAL_KEYS[i];
    if (k && k.root !== undefined) o.textContent = NAMES[k.root] + k.label.slice(k.label.indexOf(' '));
  });
  updateOctaveValueLabel();
}
function setEuroNotation(on) {
  applyNoteNames(on);
  try { localStorage.setItem("euroNotation", on ? "1" : ""); } catch {}
  refreshNoteLabels(); renderChordPool(); renderScalePool(); updateRootOctaveDisplay();
  if (mode === 'scales' && sTarget) setScale(sTarget.root, sTarget.type);
  else if ((mode === 'chords' || mode === 'ear') && target) {
    target.name = NAMES[target.root] + target.type.sfx + (target.inv ? '/' + NAMES[(target.root + target.iv[0]) % 12] : '');
    if (mode !== 'ear') renderTargetName();
  }
  evaluate();
}
$('opt-euro-notation').addEventListener('change', e => setEuroNotation(e.target.checked));
try { if (localStorage.getItem('euroNotation') === '1') { $('opt-euro-notation').checked = true; applyNoteNames(true); refreshNoteLabels(); } } catch {}

// Theory tab text is static HTML: rewrite note names in its text nodes (originals kept for switching back).
// The word "A" is only treated as a note when it isn't an article ("A scale…" vs "Start on A", "A minor").
const theoryOriginals = new Map();
const NOTE_RE = /\b([A-G])([#b]?)(m?)(?![A-Za-z0-9#])/g;
function localizeTheory() {
  const euro = $('opt-euro-notation').checked;
  const walker = document.createTreeWalker($('theory-view'), NodeFilter.SHOW_TEXT);
  for (let node; (node = walker.nextNode());) {
    if (node.parentElement.closest('#theory-progression-chords, .theory-loop')) continue;
    if (!theoryOriginals.has(node)) theoryOriginals.set(node, node.nodeValue);
    const orig = theoryOriginals.get(node);
    node.nodeValue = !euro ? orig : orig.replace(NOTE_RE, (m, l, acc, minor, offset, str) => {
      if (l === 'A' && !acc && !minor && /^ (?!(major|minor|feels|again)\b)[a-z]/.test(str.slice(offset + 1, offset + 12))) return m;
      return EURO_NAMES.letters['CDEFGAB'.indexOf(l)] + acc + minor;
    });
  }
}
$('opt-euro-notation').addEventListener('change', () => { localizeTheory(); renderTheoryProgression(); });
if ($('opt-euro-notation').checked) { localizeTheory(); renderTheoryProgression(); }
