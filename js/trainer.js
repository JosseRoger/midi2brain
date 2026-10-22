'use strict';
const held = new Set();
let target = null;
let currentDegreeIndex = null;
let locked = false;
let mode = 'chords';

function updateRootOctaveDisplay() {
  if ((mode !== 'chords' && mode !== 'ear') || !target) { rootOctaveEl.textContent = ''; return; }
  if (mode === 'ear' && !$('opt-ear-show-root').checked) {
    rootOctaveEl.textContent = '';
    return;
  }
  const rootMidi = leftmostAnchor(target.root);
  const octaveNum = Math.floor(rootMidi / 12) - 1;
  rootOctaveEl.textContent = String(octaveNum);
}

$('opt-ear-show-root').addEventListener('change', updateRootOctaveDisplay);

// Inversion k puts chord tone k in the bass and stacks the others above it
// (shifted down an octave when the bass is above the octave, e.g. the 9th).
function invertChord(iv, k) {
  const bass = iv[k];
  const notes = iv.map(x => { while (x < bass) x += 12; return x; }).sort((a, b) => a - b);
  return bass >= 12 ? notes.map(x => x - 12) : notes;
}
// Inversions switched on in the chord's category menu (root position if none).
function allowedInversions(type) {
  const g = GROUPS.find(gr => gr.chords.includes(type));
  const on = g ? type.iv.map((_, k) => k).filter(k => $(`g-${g.id}-inv${k}`)?.checked) : [];
  return on.length ? on : [0];
}
function pickInversion(root, type) {
  const allowed = allowedInversions(type);
  const fits = allowed.filter(k => lastInput !== 'qwerty' || root + Math.max(...invertChord(type.iv, k)) <= 16);
  const pool = fits.length ? fits : [0];
  return pool[Math.floor(Math.random() * pool.length)];
}
// Chord name with the inversion spelled out underneath when the category uses inversions.
function renderTargetName() {
  chordEl.textContent = target.name;
  if (target.inv > 0 || allowedInversions(target.type).some(k => k > 0)) {
    const sub = document.createElement('small'); sub.textContent = INV_NAMES[target.inv]; chordEl.appendChild(sub);
  }
}

// inv: a set inversion (the routine's voicings from a song), else one of those switched on;
// shift: octaves up from the selected one, in semitones (the routine's chord-change drills, at the song's octaves)
function setChord(root, type, degreeIndex = null, inv = null, shift = 0) {
  currentDegreeIndex = degreeIndex;
  if (inv === null || inv >= type.iv.length) inv = pickInversion(root, type);
  const iv = invertChord(type.iv, inv).map(x => x + shift);
  target = {
    root, type, iv, inv,
    name: NAMES[root] + type.sfx + (inv ? '/' + NAMES[(root + iv[0]) % 12] : ''),
  };
  startScoreTimer(target);
  collected.clear();
  locked = false;
  updateChordInfo(type, mode !== 'ear');
  if (mode === 'ear') chordEl.textContent = '???'; else renderTargetName();
  chordEl.classList.remove('small-text');
  hintEl.textContent = mode === 'ear' ? EAR_PLAY_HINT : '';
  drawTarget();
  evaluate();
  markActiveChordChip();
  updateRootOctaveDisplay();
  retuneBed(); // the ambient drone glides to the new chord (js/audio.js)
}

let activeProgression = null;
let progressionStep = 0;
let smartPracticeComplete = false;

function nextChord() {
  smartPracticeComplete = false;
  buildKeys();
  const p = pool();
  const diatonicList = getDiatonicChordsForKey(+keySelect.value);
  let root, type, degreeIdx = null;

  const isJazzChords = $('opt-jazz-chords').checked;
  const isNiceProgression = $('opt-nice-progression')?.checked;
  const isSmart = $('opt-smart-practice').checked;

  if (isJazzChords) {
    const jazzTemplates = [
      [ {deg: 1, sfx: 'm7'}, {deg: 4, sfx: '7'}, {deg: 0, sfx: 'maj7'}, {deg: 5, sfx: '7'} ],
      [ {deg: 1, sfx: 'm7'}, {deg: 4, sfx: '9'}, {deg: 0, sfx: 'maj9'}, {deg: 1, sfx: 'm7'} ],
      [ {deg: 0, sfx: 'maj7'}, {deg: 5, sfx: '7'}, {deg: 1, sfx: 'm7'}, {deg: 4, sfx: '7'} ],
      [ {deg: 2, sfx: 'm7'}, {deg: 5, sfx: '7'}, {deg: 1, sfx: 'm7'}, {deg: 4, sfx: '7'} ]
    ];
    const nextStep = takeProgressionStep(p, isSmart, () => buildBestProgression(() => {
      const baseRoot = Math.floor(Math.random() * 12);
      const chosenTemplate = jazzTemplates[Math.floor(Math.random() * jazzTemplates.length)];
      const steps = chosenTemplate.map(step => {
        const stepRoot = (baseRoot + [0, 2, 4, 5, 7, 9, 11][step.deg]) % 12;
        const matchedType = p.find(c => c.sfx === step.sfx) || GROUPS.flatMap(g => g.chords).find(c => c.sfx === step.sfx) || p[0];
        return { root: stepRoot, type: matchedType };
      }).filter(st => !isSmart || !isChordCompleted(st.root, st.type));
      return { steps, total: chosenTemplate.length };
    }));
    if (nextStep) { root = nextStep.root; type = nextStep.type; }
  } else if (isNiceProgression) {
    const standardTemplates = [
      [ {deg: 0}, {deg: 3}, {deg: 4}, {deg: 5} ],
      [ {deg: 0}, {deg: 5}, {deg: 3}, {deg: 4} ],
      [ {deg: 5}, {deg: 3}, {deg: 0}, {deg: 4} ],
      [ {deg: 1}, {deg: 4}, {deg: 0}, {deg: 0} ]
    ];
    const nextStep = takeProgressionStep(p, isSmart, () => buildBestProgression(() => {
      const baseRoot = Math.floor(Math.random() * 12);
      const chosenTemplate = standardTemplates[Math.floor(Math.random() * standardTemplates.length)];
      const steps = chosenTemplate.map(step => {
        const stepRoot = (baseRoot + [0, 2, 4, 5, 7, 9, 11][step.deg]) % 12;
        const matchedType = pickChordTypeForRoot(stepRoot, p, isSmart);
        return matchedType ? { root: stepRoot, type: matchedType } : null;
      }).filter(Boolean);
      return { steps, total: chosenTemplate.length };
    }));
    if (nextStep) { root = nextStep.root; type = nextStep.type; }
  } else {
    activeProgression = null;
    progressionStep = 0;
  }

  if (root === undefined || type === undefined) {
    if (diatonicList) {
      const order = document.querySelector('input[name="key-order"]:checked')?.value || 'random';
      if (order === 'random') {
        let tries = 0;
        do {
          let item;
          if (isSmart) {
            item = getWeightedRandomDiatonic(diatonicList, p);
          } else {
            item = diatonicList[Math.floor(Math.random() * diatonicList.length)];
          }
          root = item.root; degreeIdx = item.degreeIndex;
          type = p.find(c => c.sfx === item.sfx) || GROUPS.flatMap(g=>g.chords).find(c => c.sfx === item.sfx);
          tries++;
        } while (tries < 50 && (!isPlayable(root, type) || (target && tries < 20 && root === target.root && type && type.sfx === target.type.sfx)));
      } else {
        const n = diatonicList.length;
        const dir = order === 'down' ? -1 : 1;
        const findType = it => p.find(c => c.sfx === it.sfx) || GROUPS.flatMap(g=>g.chords).find(c => c.sfx === it.sfx);
        let start = currentDegreeIndex === null ? (order === 'down' ? n - 1 : 0) : (currentDegreeIndex + dir + n) % n;
        degreeIdx = start;
        if (isSmart) {
          // Skip completed chords; if everything is completed, start a fresh session
          let found = false;
          for (let i = 0; i < n; i++) {
            const idx = (start + dir * i + n * n) % n;
            if (!isChordCompleted(diatonicList[idx].root, findType(diatonicList[idx]))) { degreeIdx = idx; found = true; break; }
          }
          if (!found) { chordWeights = {}; degreeIdx = start; }
        }
        const item = diatonicList[degreeIdx];
        root = item.root;
        type = findType(item);
      }
    } else {
      let tries = 0;
      do {
        if (isSmart) {
          const weightedChord = getWeightedRandomGeneralPool(p);
          root = weightedChord.root;
          type = weightedChord.type;
        } else {
          root = Math.floor(Math.random() * 12);
          type = p[Math.floor(Math.random() * p.length)];
        }
        tries++;
      } while (tries < 50 && (!isPlayable(root, type) || (target && tries < 20 && root === target.root && type && type.sfx === target.type.sfx)));
    }
  }

  if (type) {
    setChord(root, type, degreeIdx);
    if (mode === 'ear') playEarTrainingChord();
  }
}

let lockedAt = 0, advanceTimer = null;
function tryAdvance() {
  if (!locked || held.size > 0) return;
  if (smartPracticeComplete) return;
  const wait = Math.max(0, 350 - (Date.now() - lockedAt));
  clearTimeout(advanceTimer);
  advanceTimer = setTimeout(() => {
    if (!locked || held.size > 0) return;
    setState(''); 
    if (routineApp.targetDone()) return; // a practice routine picks what comes next (js/routine.js)
    if (mode === 'scales') nextScale(); 
    else if (mode === 'chords' || mode === 'ear') nextChord();
  }, wait);
}

function setState(s) {
  stage.classList.toggle('ok', s === 'ok');
  stage.classList.toggle('bad', s === 'bad');
}

function targetExactNotes() {
  if (!target) return new Set();
  const hands = getSelectedHands();
  const lhAnchor = leftmostAnchor(target.root);
  const notes = new Set(target.iv.map(i => lhAnchor + i));
  if (hands.both) {
    const rhAnchor = lhAnchor + handsGap;
    target.iv.forEach(i => notes.add(rhAnchor + i));
  }
  return notes;
}

function playEarTrainingChord() {
  if (!target) return;
  const expected = [...targetExactNotes()].sort((a, b) => a - b);
  const playSimultaneous = $('opt-ear-simultaneous').checked;
  const playAscending = $('opt-ear-ascending').checked;

  if (playAscending && playSimultaneous) {
    expected.forEach((note, idx) => {
      setTimeout(() => { playPianoNote(note); setTimeout(() => stopPianoNote(note), 400); }, idx * 300);
    });
    setTimeout(() => {
      expected.forEach(note => playPianoNote(note));
      setTimeout(() => {
        expected.forEach(note => stopPianoNote(note));
      }, 1200);
    }, expected.length * 300 + 200);
  } else if (playAscending) {
    expected.forEach((note, idx) => {
      setTimeout(() => { playPianoNote(note); setTimeout(() => stopPianoNote(note), 400); }, idx * 300);
    });
  } else {
    expected.forEach(note => playPianoNote(note));
    setTimeout(() => {
      expected.forEach(note => stopPianoNote(note));
    }, 1500);
  }
}

// Mic and click/tap input can't easily hold a whole chord: correct notes are collected one by one until complete.
const collected = new Set();

function noteByNote() { return (lastInput === 'mic' || lastInput === 'pointer') && (mode === 'chords' || mode === 'ear'); }

function evaluate() {
  heldEl.textContent = [...held].sort((a, b) => a - b).map(n => NAMES[n % 12]).join('  ');
  if (mode === 'detector') { detectChordFromHeld(); return; }
  if (locked) { tryAdvance(); return; }
  if (!target) return;

  const expected = targetExactNotes();
  const played = noteByNote() ? new Set([...held, ...collected]) : held;

  if (mode === 'chords' || mode === 'ear') {
    Object.keys(keyEls).forEach(n => {
      const el = keyEls[n];
      const pitchNum = +n;
      el.classList.toggle('done', expected.has(pitchNum) && played.has(pitchNum));
    });
  }

  if (played.size === 0) { 
    setState(''); 
    hintEl.textContent = mode === 'ear' ? EAR_PLAY_HINT : ''; 
    return; 
  }

  const hands = getSelectedHands();
  const sortedHeld = [...played].sort((a, b) => a - b);
  const exact = sortedHeld.length === expected.size && sortedHeld.every(n => expected.has(n));

  if (exact) {
    locked = true; lockedAt = Date.now();
    setState('ok'); 
    if (mode === 'ear') {
      renderTargetName();
      updateChordInfo(target.type);
    }
    hintEl.textContent = 'Correct, release the keys to continue';

    if ($('opt-smart-practice').checked && target) {
      const key = `${target.root}_${target.type.sfx}`;
      const currentW = chordWeights[key] !== undefined ? chordWeights[key] : 0;
      const r = settleScore(target, 1500, 5000);
      chordWeights[key] = Math.max(0, Math.min(MAX_PROGRESS, currentW + r.delta));
      renderChordPool();
      showScoreChip(document.querySelector(`#chord-pool .chord-chip[data-root="${target.root}"][data-sfx="${CSS.escape(target.type.sfx)}"]`), r, currentW, chordWeights[key]);

      // Check if the smart practice mode is fully completed
      if (checkSmartPracticeCompletion()) {
        smartPracticeComplete = true;
        stage.classList.add('ok');
        chordEl.textContent = 'congratulations';
        updateChordInfo(null);
        chordEl.classList.remove('small-text');
        hintEl.textContent = `Smart practice session complete! ${IS_TOUCH ? 'Tap' : 'Click'} the chord to practice again.`;
      }
    }
    return;
  }

  const stray = sortedHeld.some(n => !expected.has(n));
  const wrongShape = sortedHeld.length >= expected.size;
  if (stray || wrongShape) {
    const newAttempt = !stage.classList.contains('bad');
    setState('bad');
    hintEl.textContent = hands.both ? 'Play the exact keys across both hands' : noteByNote() ? 'Not quite, start the chord again' : 'Not quite, release and try again';
    recordMiss(target, sortedHeld.filter(n => !expected.has(n)), [...expected], newAttempt);
    if (newAttempt) routineApp.miss();
    collected.clear();
  } else {
    setState('');
    hintEl.textContent = noteByNote() ? `${played.size}/${expected.size} notes, keep going` : mode === 'ear' ? 'Listening...' : '';
  }
}

function noteOn(n, playSound = true, velocity = null)  { // velocity 0..1 from MIDI; other inputs have none
  if (micOffer) { micOffer = false; updateMicOfferHint(); } // mic offer only lasts until the first note is played
  if (mode === 'theory' || mode === 'contact' || mode === 'routine') return;
  if (mode === 'songs') { // the Songs tab plays (its own sound) and grades the notes itself (js/songs.js)
    const fresh = !held.has(n);
    held.add(n);
    songApp.noteOn(n, playSound && fresh, velocity);
    return;
  }
  if (playSound && !held.has(n)) playPianoNote(n, velocity);
  held.add(n);
  if (noteByNote() && target && !locked && targetExactNotes().has(n)) collected.add(n);
  updatePressedKeysDisplay();
  if (mode === 'detector') detectorNoteOn();
  if (mode === 'scales') scaleNoteOn(n); else evaluate();
}
function noteOff(n, stopSound = true) {
  if (stopSound) releasePianoNote(n); // keeps ringing while the sustain pedal is down (js/audio.js)
  if (mode === 'theory' || mode === 'contact' || mode === 'routine') return;
  held.delete(n);
  if (mode === 'songs') return;
  updatePressedKeysDisplay();
  if (mode === 'scales') scaleNoteOff(); else evaluate();
}

