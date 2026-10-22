'use strict';
// ---------- chord detector tab ----------
const ALL_TYPES = GROUPS.flatMap(g => g.chords);
const DETECTOR_TYPES = ALL_TYPES.concat([
  { sfx: '6/9', name: 'Six-nine chord', iv: [0, 4, 7, 9, 14] },
  { sfx: 'add11', name: 'Major add11', iv: [0, 4, 7, 17] },
  { sfx: 'm11', name: 'Minor 11th', iv: [0, 3, 7, 10, 14, 17] },
  { sfx: 'maj11', name: 'Major 11th', iv: [0, 4, 7, 11, 14, 17] },
  { sfx: '11', name: 'Dominant 11th', iv: [0, 4, 7, 10, 14, 17] },
  { sfx: '7b9', name: 'Dominant 7th flat 9', iv: [0, 4, 7, 10, 13] },
  { sfx: '7#9', name: 'Dominant 7th sharp 9', iv: [0, 4, 7, 10, 15] },
  { sfx: '7#11', name: 'Dominant 7th sharp 11', iv: [0, 4, 7, 10, 18] },
  { sfx: '7b13', name: 'Dominant 7th flat 13', iv: [0, 4, 7, 10, 20] },
  { sfx: 'm13', name: 'Minor 13th', iv: [0, 3, 7, 10, 14, 17, 21] },
  { sfx: 'maj13', name: 'Major 13th', iv: [0, 4, 7, 11, 14, 17, 21] },
  { sfx: '13', name: 'Dominant 13th', iv: [0, 4, 7, 10, 14, 17, 21] },
]);

// Note by note (click/tap only): tapped notes are collected and shown blue so a chord can be built one key at a time.
// If no chord forms within DETECT_GAP_MS of the last tap, or you click/tap off the keys, the collection is cleared.
const DETECT_GAP_MS = 1500;
const detectorCollected = new Set();
let detectorLastNoteAt = 0, detectorClearTimer = null;
// Each chord attempt (a tapped collection or a held chord) adds at most one entry to the recent chords.
let detectorAttempt = 0;
function clearDetectorCollection() {
  clearTimeout(detectorClearTimer);
  if (!detectorCollected.size) return;
  detectorCollected.clear();
  detectChordFromHeld();
}
function detectorNoteOn() {
  clearDetectorPreview(); // playing a note ends the pinned recent chord
  if (lastInput !== "pointer") { detectorCollected.clear(); if (held.size === 1) detectorAttempt++; return; }
  if (Date.now() - detectorLastNoteAt > DETECT_GAP_MS || !detectorCollected.size) { detectorCollected.clear(); detectorAttempt++; }
  held.forEach(n => detectorCollected.add(n));
  detectorLastNoteAt = Date.now();
  clearTimeout(detectorClearTimer);
  detectorClearTimer = setTimeout(() => { if (!held.size) clearDetectorCollection(); }, DETECT_GAP_MS);
}
document.addEventListener("pointerdown", e => {
  if (mode === "detector" && !e.target.closest(".k, .detector-chip")) clearDetectorCollection();
});

function detectChordFromHeld() {
  if (detectorPreview) return; // a pinned recent chord stays until a click elsewhere or a new note
  const notes = new Set([...held, ...detectorCollected]);
  if (notes.size === 0) {
    detectorDisplayedMatch = null;
    rootOctaveEl.textContent = '';
    chordEl.textContent = 'Play notes';
    chordEl.classList.add('small-text');
    hintEl.textContent = 'Play 2 or more notes to identify the chord';
    drawDetectorTarget();
    return;
  }

  const sortedHeld = [...notes].sort((a, b) => a - b);
  const bassNote = sortedHeld[0];
  const pcs = Array.from(new Set(sortedHeld.map(n => ((n % 12) + 12) % 12))).sort((a, b) => a - b);

  // Every chord these notes can be read as (same pitch classes, any root). The bass note decides the inversion:
  // on the root = root position, on the 3rd / 5th / 7th (2nd / 3rd / 4th chord tone) = 1st / 2nd / 3rd inversion,
  // on an added tone (9th, 11th, 13th) = a slash chord. Inverted chords are named with a slash: C/E.
  const bassPc = bassNote % 12;
  const ORDINALS = ['', '1st', '2nd', '3rd'];
  let matches = [];
  NAMES.forEach((_, root) => {
    DETECTOR_TYPES.forEach(type => {
      const targetPcs = Array.from(new Set(type.iv.map(i => (root + i) % 12))).sort((a, b) => a - b);
      if (targetPcs.length !== pcs.length || !targetPcs.every((p, index) => p === pcs[index])) return;
      const tone = type.iv.findIndex(i => (root + i) % 12 === bassPc); // which chord tone is in the bass
      const inverted = tone > 0;
      const name = NAMES[root] + type.sfx + (inverted ? '/' + NAMES[bassPc] : '');
      const inversionText = !inverted ? 'Root position'
        : type.iv[tone] < 12 && ORDINALS[tone] ? `${ORDINALS[tone]} inversion`
        : `Slash chord / ${NAMES[bassPc]} bass`;
      if (!matches.some(m => m.name === name)) matches.push({ name, typeName: type.name, inversionText, root, sfx: type.sfx, iv: type.iv, tone });
    });
  });
  // root position first, then the closest inversions (1st before 2nd …); otherwise library order
  matches.sort((a, b) => a.tone - b.tone);

  if (matches.length > 0) {
    const match = { ...matches[0], notes: [...sortedHeld] };
    const others = matches.slice(1, 4).map(m => m.name);
    match.alsoText = others.length ? ` · also: ${others.join(', ')}` : '';
    const rootNote = sortedHeld.find(note => note % 12 === match.root);
    match.rootOctave = rootNote === undefined ? '' : String(Math.floor(rootNote / 12) - 1);
    rootOctaveEl.textContent = match.rootOctave;
    chordEl.textContent = match.name;
    chordEl.classList.remove('small-text');
    hintEl.textContent = `${match.typeName} (${match.inversionText})${match.alsoText}`;
    detectorDisplayedMatch = match;
    drawDetectorTarget();
    // Record to detector history
    addDetectorHistory(match);
  } else {
    detectorDisplayedMatch = null;
    rootOctaveEl.textContent = '';
    const noteNames = sortedHeld.map(n => NAMES[n % 12]).join(' - ');
    chordEl.textContent = 'Custom / Unknown';
    chordEl.classList.add('small-text');
    hintEl.textContent = `Notes: ${noteNames}`;
    drawDetectorTarget();
  }
}

// ---------- detector history ----------
const detectorHistory = [];
let detectorDisplayedMatch = null;
// Clicking a recent chord pins it on the display and keyboard. It stays (releasing notes doesn't replace it) until
// a click anywhere else, a click on it again, or a new note; then normal detection resumes.
let detectorPreview = null;
function clearDetectorPreview() {
  if (!detectorPreview) return;
  detectorPreview = null;
  detectorDisplayedMatch = null;
  renderDetectorHistory(); // drops the pinned chip's highlight
  buildKeys(); updatePressedKeysDisplay(); // back to the normal keyboard range, if the preview moved it
  detectChordFromHeld();
}
function addDetectorHistory(match) {
  const entry = { ...match, ts: Date.now(), attempt: detectorAttempt };
  if (detectorHistory[0]?.attempt === detectorAttempt) {
    if (entry.notes.length < detectorHistory[0].notes.length) return; // releasing notes shouldn't downgrade the entry
    detectorHistory[0] = entry;
  } else detectorHistory.unshift(entry);
  if (detectorHistory.length > 12) detectorHistory.length = 12;
  renderDetectorHistory();
}
function renderDetectorHistory() {
  const list = $('detector-history-list'); if (!list) return;
  list.textContent = '';
  detectorHistory.forEach(item => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'detector-chip';
    el.classList.toggle('pinned', detectorPreview === item);
    el.setAttribute('aria-label', `Show ${item.name} on the keyboard`);
    el.setAttribute('aria-pressed', String(detectorPreview === item));
    const name = document.createElement('span');
    name.className = 'detector-chip-name';
    name.textContent = item.name;
    el.append(name);
    const showPreview = () => {
      if (detectorPreview === item) { clearDetectorPreview(); return; } // clicked again: unpin
      detectorPreview = item;
      detectorDisplayedMatch = item;
      list.querySelectorAll('.detector-chip').forEach(c => { c.classList.toggle('pinned', c === el); c.setAttribute('aria-pressed', String(c === el)); });
      const notes = item.notes || [];
      // Only move the keyboard if the chord is out of view; then start it on a C.
      if (notes.length > 0 && (notes[0] < LOW || notes[notes.length - 1] > HIGH)) {
        const low = notes[0] - (notes[0] % 12);
        buildKeys(low, Math.max(low + 36, notes[notes.length - 1] + 3));
        updatePressedKeysDisplay();
      }
      chordEl.textContent = item.name;
      chordEl.classList.remove('small-text');
      hintEl.textContent = `${item.typeName} (${item.inversionText})${item.alsoText || ''}`;
      drawDetectorTarget();
    };
    el.addEventListener('pointerdown', event => {
      event.preventDefault();
      showPreview();
    });
    el.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
        event.preventDefault();
        showPreview();
      }
    });
    list.appendChild(el);
  });
}

document.addEventListener('pointerdown', event => {
  if (event.target.closest('.detector-chip')) return;
  if (detectorPreview) { clearDetectorPreview(); return; } // a click anywhere else unpins the recent chord
  if (!detectorDisplayedMatch) return;
  detectorDisplayedMatch = null;
  if (mode === 'detector') detectChordFromHeld();
});

