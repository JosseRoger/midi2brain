'use strict';
const OCTAVE_DEFAULT = { both: 2, right: 4 };
const noteToCLabel = n => NAMES[0] + (Math.floor(n / 12) - 1);
const cNumToAnchor = v => (v + 1) * 12;
const anchorToCNum = n => Math.floor(n / 12) - 1;
// Default to a sensible single-hand octave; will adapt once user toggles.
let currentAnchor = cNumToAnchor(OCTAVE_DEFAULT.right);
// both hands: semitones from the left hand up to the right (two octaves; the routine uses one: C3 + C4)
let handsGap = 24;
const octaveSelect = $('octave-select');
const octaveValueEl = $('octave-value');
const octaveTicksEl = $('octave-slider-ticks');

function getPlayableAnchorRange() {
  const both = !!$('opt-both-hands') && $('opt-both-hands').checked;
  const minOctave = 1;
  const maxOctave = both ? 5 : 7;
  return {
    min: cNumToAnchor(minOctave),
    max: cNumToAnchor(maxOctave),
    minOctave,
    maxOctave,
  };
}

function clampCurrentAnchorToPlayableRange() {
  const { min, max } = getPlayableAnchorRange();
  if (currentAnchor < min) currentAnchor = min;
  if (currentAnchor > max) currentAnchor = max;
}

function updateOctaveValueLabel() { octaveValueEl.textContent = noteToCLabel(currentAnchor); }

function populateOctaveSelect() {
  const { minOctave, maxOctave } = getPlayableAnchorRange();
  octaveSelect.min = String(minOctave);
  octaveSelect.max = String(maxOctave);
  octaveTicksEl.replaceChildren();
  for (let octave = minOctave; octave <= maxOctave; octave++) {
    const tick = document.createElement('span');
    tick.style.setProperty('--position', String((octave - minOctave) / (maxOctave - minOctave)));
    octaveTicksEl.append(tick);
  }
  clampCurrentAnchorToPlayableRange();
  octaveSelect.value = String(anchorToCNum(currentAnchor));
  updateOctaveValueLabel();
  $('octave-label').textContent = ($('opt-both-hands') && $('opt-both-hands').checked) ? 'Left hand octave' : 'Octave';
}


octaveSelect.addEventListener('input', () => {
  currentAnchor = cNumToAnchor(+octaveSelect.value);
  updateOctaveValueLabel();
});

octaveSelect.addEventListener('change', () => {
  clampCurrentAnchorToPlayableRange();
  currentAnchor = cNumToAnchor(+octaveSelect.value);
  updateOctaveValueLabel();
  if (mode === 'scales') {
    sProgress = 0; sPlayed = []; locked = false;
    clearTimeout(advanceTimer); clearTimeout(missTimer); setState('');
    if (sTarget) hintEl.textContent = sTarget.hint;
  }
  buildKeys(); drawTarget(); updatePressedKeysDisplay(); updateRootOctaveDisplay();
  if (mode === 'chords' || mode === 'ear') evaluate();
});


// Toggle for both hands; when changed, refresh keyboard and labels.
if ($('opt-both-hands')) {
  $('opt-both-hands').addEventListener('change', () => {
    populateOctaveSelect();
    buildKeys();
    drawTarget();
    updatePressedKeysDisplay();
    updateRootOctaveDisplay();
  });
}

