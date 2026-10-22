'use strict';
// ---------- chord library ----------
const GROUPS = [
  { id: 'triads', label: 'Triads', on: true, chords: [
    { sfx: '', name: 'Major triad', iv: [0,4,7], on: true, tone: 'Bright, happy, clear, and stable.', usage: 'Foundational chord in pop, rock, classical, and folk music.' },
    { sfx: 'm', name: 'Minor triad', iv: [0,3,7], on: true, tone: 'Sad, melancholic, serious, or moody.', usage: 'Used for emotional depth, drama, or sad melodies.' },
    { sfx: 'dim', name: 'Diminished triad', iv: [0,3,6], on: false, tone: 'Tense, mysterious, suspenseful, dark.', usage: 'Passing chord to create dramatic musical tension.' },
    { sfx: 'aug', name: 'Augmented triad', iv: [0,4,8], on: false, tone: 'Dreamy, floating, unresolved, surreal.', usage: 'Commonly used in film scores and transitional passages.' },
    { sfx: 'sus2', name: 'Suspended 2nd', iv: [0,2,7], on: false, tone: 'Open, ethereal, peaceful, spacious.', usage: 'Popular in acoustic rock, pop, and contemporary worship.' },
    { sfx: 'sus4', name: 'Suspended 4th', iv: [0,5,7], on: false, tone: 'Expectant, soaring, longing for resolution.', usage: 'Classic setup chord right before resolving to a major chord.' },
  ]},
  { id: 'sevenths', label: 'Seventh chords', on: false, chords: [
    { sfx: 'maj7', name: 'Major 7th', iv: [0,4,7,11], tone: 'Lush, warm, dreamy, romantic.', usage: 'Staple of jazz, soul, lo-fi, and bossa nova.' },
    { sfx: '7', name: 'Dominant 7th', iv: [0,4,7,10], tone: 'Bluesy, driving, tense, expectant.', usage: 'Core chord in blues, rock and roll, and jazz turnarounds.' },
    { sfx: 'm7', name: 'Minor 7th', iv: [0,3,7,10], tone: 'Mellow, moody, smooth, atmospheric.', usage: 'Used heavily in R&B, jazz, hip-hop, and pop.' },
    { sfx: 'm7b5', name: 'Half-diminished 7th', iv: [0,3,6,10], tone: 'Sorrowful, dark, highly tense.', usage: 'Key chord in jazz minor key cadence progressions (ii-V-i).' },
    { sfx: 'dim7', name: 'Diminished 7th', iv: [0,3,6,9], tone: 'Dramatic, spooky, classic cinematic suspense.', usage: 'Used in horror/thriller themes and dramatic transitions.' },
    { sfx: 'm(maj7)', name: 'Minor-major 7th', iv: [0,3,7,11], tone: 'Mysterious, noir-like, spy thriller tone.', usage: 'Famous as the "James Bond" ending chord.' },
    { sfx: '7sus4', name: 'Dominant 7th sus4', iv: [0,5,7,10], tone: 'Funky, floating, unresolved jazz sound.', usage: 'Used in modern jazz and gospel music.' },
    { sfx: '7#5', name: 'Augmented 7th', iv: [0,4,8,10], tone: 'Pungent, highly tense, altered dominant.', usage: 'Used in jazz lead-ins and cadence turnarounds.' },
  ]},
  { id: 'sixths', label: '6th & add9', on: false, chords: [
    { sfx: '6', name: 'Major 6th', iv: [0,4,7,9], tone: 'Sweet, vintage, cozy sound.', usage: 'Popular in classic swing jazz and 50s pop.' },
    { sfx: 'm6', name: 'Minor 6th', iv: [0,3,7,9], tone: 'Bitter-sweet, melancholic jazz color.', usage: 'Used in gypsy jazz and film noir soundtracks.' },
    { sfx: 'add9', name: 'Major add9', iv: [0,4,7,14], tone: 'Bright, shimmering, expansive.', usage: 'Ubiquitous in pop ballad piano arrangements.' },
    { sfx: 'madd9', name: 'Minor add9', iv: [0,3,7,14], tone: 'Deeply expressive, dark, poignant.', usage: 'Used in acoustic ballads and dramatic scores.' },
  ]},
  { id: 'ninths', label: 'Ninth chords', on: false, chords: [
    { sfx: 'maj9', name: 'Major 9th', iv: [0,4,7,11,14], tone: 'Ultra-lush, elegant, sophisticated.', usage: 'Standard voicing in modern jazz and neo-soul.' },
    { sfx: '9', name: 'Dominant 9th', iv: [0,4,7,10,14], tone: 'Funky, rich, confident sound.', usage: 'Key chord in funk, rhythm and blues, and jazz.' },
    { sfx: 'm9', name: 'Minor 9th', iv: [0,3,7,10,14], tone: 'Silky, cool, contemplative.', usage: 'Popular in contemporary R&B, lo-fi beats, and jazz.' },
  ]},
];

const INV_NAMES = ['Root position', '1st inversion', '2nd inversion', '3rd inversion', '4th inversion'];
const INVERSIONS_INFO = `<b>Chord inversions</b>
An inversion plays the same chord notes with a different note at the bottom.

<i>Root position:</i> root at the bottom (C E G)
<i>1st inversion:</i> 3rd at the bottom (E G C), written C/E
<i>2nd inversion:</i> 5th at the bottom (G C E), written C/G
<i>3rd inversion:</i> 7th at the bottom, for 7th chords

Inversions keep your hand close between chords and give smoother progressions. Each chord gets a random inversion from the ones switched on; the root key stays marked.`;

const groupsEl = $('groups');
GROUPS.forEach(g => {
  const details = document.createElement('details');
  details.className = 'chord-category';
  const summary = document.createElement('summary');
  const masterLabel = document.createElement('div');
  masterLabel.className = 'toggle-label-row chord-category-master';
  masterLabel.innerHTML = `<span class="toggle-switch"><input type="checkbox" id="g-${g.id}" ${g.on ? 'checked' : ''}><span class="toggle-slider"></span></span> ${g.label}`;
  masterLabel.addEventListener('click', event => {
    if (event.target.closest('.toggle-switch')) event.stopPropagation();
  });
  summary.appendChild(masterLabel);
  const menuIndicator = document.createElement('span');
  menuIndicator.className = 'chord-category-menu-indicator';
  menuIndicator.textContent = '+';
  menuIndicator.setAttribute('aria-hidden', 'true');
  summary.appendChild(menuIndicator);
  addInfoButton(summary, g.label, () => g.chords.map(c => `<b>${c.name}</b> (${formula(c.iv)})\n<i>Tone:</i> ${c.tone}\n<i>Usage:</i> ${c.usage}`).join('\n\n'));
  details.appendChild(summary);

  const items = document.createElement('div');
  items.className = 'chord-category-items';
  g.chords.forEach((chord, index) => {
    const item = document.createElement('label');
    item.className = 'toggle-label-row chord-category-item';
    const isChordOn = g.on && chord.on !== false;
    item.innerHTML = `<span class="toggle-switch"><input type="checkbox" id="g-${g.id}-${index}" ${isChordOn ? 'checked' : ''}><span class="toggle-slider"></span></span> ${chord.name}`;
    addInfoButton(item, chord.name, () => `<b>${chord.name}</b> (${formula(chord.iv)})\n<i>Tone:</i> ${chord.tone}\n<i>Usage:</i> ${chord.usage}`);
    items.appendChild(item);
    item.querySelector('input').addEventListener('change', () => {
      const selected = Array.from(items.querySelectorAll('.chord-category-item input')).filter(input => input.checked).length;
      const groupInput = masterLabel.querySelector('input');
      groupInput.checked = selected === g.chords.length;
      groupInput.indeterminate = selected > 0 && selected < g.chords.length;
      target = null; activeProgression = null; progressionStep = 0;
      nextChord(); renderChordPool();
    });
  });
  // Inversions allowed for this category (root position on by default).
  const invHead = document.createElement('div');
  invHead.className = 'chord-category-inv-head';
  invHead.textContent = 'Inversions';
  addInfoButton(invHead, 'Inversions', () => INVERSIONS_INFO);
  items.appendChild(invHead);
  INV_NAMES.slice(0, Math.max(...g.chords.map(c => c.iv.length))).forEach((name, k) => {
    const item = document.createElement('label');
    item.className = 'toggle-label-row chord-category-inv';
    item.innerHTML = `<span class="toggle-switch"><input type="checkbox" id="g-${g.id}-inv${k}" ${k === 0 ? 'checked' : ''}><span class="toggle-slider"></span></span> ${name}`;
    item.querySelector('input').addEventListener('change', () => { if (mode === 'chords' || mode === 'ear') nextChord(); });
    items.appendChild(item);
  });
  items.hidden = true;
  document.body.appendChild(items);
  groupsEl.appendChild(details);

  const positionPopup = () => {
    const summaryRect = summary.getBoundingClientRect();
    const popupRect = items.getBoundingClientRect();
    const left = Math.max(8, Math.min(summaryRect.left, window.innerWidth - popupRect.width - 8));
    let top = summaryRect.bottom + 4;
    if (top + popupRect.height > window.innerHeight - 8) {
      top = Math.max(8, summaryRect.top - popupRect.height - 4);
    }
    items.style.left = `${left}px`;
    items.style.top = `${top}px`;
  };
  summary.addEventListener('click', event => {
    if (event.target.closest('.toggle-switch, .info-btn')) return;
    event.preventDefault();
    document.querySelectorAll('.chord-category[open]').forEach(category => {
      if (category !== details) {
        category.open = false;
        category.querySelector('.chord-category-menu-indicator').textContent = '+';
      }
    });
    document.querySelectorAll('.chord-category-items').forEach(menu => { menu.hidden = true; });
    details.open = !details.open;
    menuIndicator.textContent = details.open ? '-' : '+';
    if (details.open) {
      items.hidden = false;
      requestAnimationFrame(positionPopup);
    } else {
      items.style.left = '';
      items.style.top = '';
    }
  });

  const masterInput = masterLabel.querySelector('input');
  const masterSwitch = masterLabel.querySelector('.toggle-switch');
  const selected = Array.from(items.querySelectorAll('.chord-category-item input')).filter(input => input.checked).length;
  masterInput.checked = selected === g.chords.length;
  masterInput.indeterminate = selected > 0 && selected < g.chords.length;
  masterSwitch.addEventListener('click', event => {
    event.stopPropagation();
    if (event.target !== masterInput) {
      event.preventDefault();
      masterInput.checked = !masterInput.checked;
      masterInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  masterInput.addEventListener('click', event => event.stopPropagation());
  masterInput.addEventListener('change', event => {
    items.querySelectorAll('.chord-category-item input').forEach(input => { input.checked = event.target.checked; });
    event.target.indeterminate = false;
    target = null; activeProgression = null; progressionStep = 0;
    nextChord(); renderChordPool();
  });
});
document.addEventListener('pointerdown', event => {
  document.querySelectorAll('.chord-category[open]').forEach(category => {
    if (!category.contains(event.target) && !event.target.closest('.chord-category-items, .info-popover')) {
      category.open = false;
      category.querySelector('.chord-category-menu-indicator').textContent = '+';
      document.querySelectorAll('.chord-category-items').forEach(menu => { menu.hidden = true; });
    }
  });
});
// Last used input device ('midi' | 'qwerty' | 'pointer' | 'mic'). QWERTY keys only
// cover currentAnchor..+16 (see KEYMAP_OFFSETS), so chords outside that are unplayable.
let lastInput = 'midi';
function isPlayable(root, type) {
  if (lastInput !== 'qwerty' || !type) return true;
  return !getSelectedHands().both && root + Math.max(...type.iv) <= 16;
}
function setInputDevice(device) {
  if (device === lastInput) return;
  lastInput = device;
  if ((mode === 'chords' || mode === 'ear') && target && !isPlayable(target.root, target.type)) nextChord();
  renderChordPool();
}

function pool() {
  const p = [];
  GROUPS.forEach(g => {
    g.chords.forEach((chord, index) => {
      if ($(`g-${g.id}-${index}`)?.checked) p.push(chord);
    });
  });
  return p.length ? p : GROUPS[0].chords.filter(chord => chord.on !== false);
}

$('opt-jazz-chords').addEventListener('change', e => {
  const checked = e.target.checked;
  ['sevenths', 'sixths', 'ninths'].forEach(id => {
    const el = $('g-' + id);
    if (el) {
      el.checked = checked;
      el.indeterminate = false;
      const group = GROUPS.find(item => item.id === id);
      group?.chords.forEach((_, index) => {
        const chordInput = $(`g-${id}-${index}`);
        if (chordInput) chordInput.checked = checked;
      });
    }
  });
  target = null; nextChord(); renderChordPool();
});

$('opt-smart-practice').addEventListener('change', e => {
  if (!e.target.checked) chordWeights = {};
  target = null; nextChord(); renderChordPool();
});

$('opt-scale-smart-practice').addEventListener('change', e => {
  if (!e.target.checked) scaleWeights = {};
  sTarget = null; nextScale(); renderScalePool();
});

// Musical Keys setup
const MUSICAL_KEYS = [
  { label: 'Any key (random)', value: 'any' },
  { label: 'C Major', root: 0, scale: [0,2,4,5,7,9,11], sfxs: ['', 'm', 'm', '', '', 'm', 'dim'] },
  { label: 'G Major', root: 7, scale: [0,2,4,5,7,9,11], sfxs: ['', 'm', 'm', '', '', 'm', 'dim'] },
  { label: 'D Major', root: 2, scale: [0,2,4,5,7,9,11], sfxs: ['', 'm', 'm', '', '', 'm', 'dim'] },
  { label: 'A Major', root: 9, scale: [0,2,4,5,7,9,11], sfxs: ['', 'm', 'm', '', '', 'm', 'dim'] },
  { label: 'E Major', root: 4, scale: [0,2,4,5,7,9,11], sfxs: ['', 'm', 'm', '', '', 'm', 'dim'] },
  { label: 'F Major', root: 5, scale: [0,2,4,5,7,9,11], sfxs: ['', 'm', 'm', '', '', 'm', 'dim'] },
  { label: 'Bb Major', root: 10, scale: [0,2,4,5,7,9,11], sfxs: ['', 'm', 'm', '', '', 'm', 'dim'] },
  { label: 'Eb Major', root: 3, scale: [0,2,4,5,7,9,11], sfxs: ['', 'm', 'm', '', '', 'm', 'dim'] },
  { label: 'A Minor', root: 9, scale: [0,2,3,5,7,8,10], sfxs: ['m', 'dim', '', 'm', 'm', '', ''] },
  { label: 'E Minor', root: 4, scale: [0,2,3,5,7,8,10], sfxs: ['m', 'dim', '', 'm', 'm', '', ''] },
  { label: 'D Minor', root: 2, scale: [0,2,3,5,7,8,10], sfxs: ['m', 'dim', '', 'm', 'm', '', ''] },
  { label: 'C Minor', root: 0, scale: [0,2,3,5,7,8,10], sfxs: ['m', 'dim', '', 'm', 'm', '', ''] },
];

const keySelect = $('key-select');
MUSICAL_KEYS.forEach((k, idx) => {
  const opt = document.createElement('option');
  opt.value = String(idx); opt.textContent = k.label;
  keySelect.appendChild(opt);
});

keySelect.addEventListener('change', () => {
  target = null; activeProgression = null; progressionStep = 0; currentDegreeIndex = null;
  nextChord(); renderChordPool();
});

function getDiatonicChordsForKey(keyIdx) {
  const keyData = MUSICAL_KEYS[keyIdx];
  if (!keyData || keyData.value === 'any') return null;
  const list = [];
  keyData.scale.forEach((degreeOff, i) => {
    const root = (keyData.root + degreeOff) % 12;
    const sfx = keyData.sfxs[i];
    list.push({ root, sfx, degreeIndex: i });
  });
  return list;
}

function checkSmartPracticeCompletion() {
  if (!$('opt-smart-practice').checked) return false;
  const p = pool();
  const keyIdx = +keySelect.value;
  const diatonicList = getDiatonicChordsForKey(keyIdx);
  
  let allCompleted = true;
  if (diatonicList) {
    diatonicList.forEach(item => {
      const type = p.find(c => c.sfx === item.sfx) || GROUPS.flatMap(g=>g.chords).find(c => c.sfx === item.sfx);
      if (type) {
        const key = `${item.root}_${type.sfx}`;
        if ((chordWeights[key] || 0) < MAX_PROGRESS) allCompleted = false;
      }
    });
  } else {
    NAMES.forEach((_, root) => {
      p.forEach(type => {
        const key = `${root}_${type.sfx}`;
        if ((chordWeights[key] || 0) < MAX_PROGRESS) allCompleted = false;
      });
    });
  }
  return allCompleted;
}

function getWeightedRandomDiatonic(diatonicList, p) {
  const candidates = diatonicList.map(item => {
    const type = p.find(c => c.sfx === item.sfx) || GROUPS.flatMap(g=>g.chords).find(c => c.sfx === item.sfx);
    const key = `${item.root}_${type ? type.sfx : item.sfx}`;
    const progress = chordWeights[key] !== undefined ? chordWeights[key] : 0;
    const weight = progress < MAX_PROGRESS ? (MAX_PROGRESS + 1 - progress) : 0;
    return { item, type, weight };
  }).filter(c => c.weight > 0);

  if (candidates.length === 0) {
    chordWeights = {};
    return getWeightedRandomDiatonic(diatonicList, p);
  }

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let r = Math.random() * totalWeight;
  for (const c of candidates) {
    if (r < c.weight) return c.item;
    r -= c.weight;
  }
  return candidates[0].item;
}

function getWeightedRandomGeneralPool(p) {
  const candidates = [];
  NAMES.forEach((_, root) => {
    p.forEach(type => {
      const key = `${root}_${type.sfx}`;
      const progress = chordWeights[key] !== undefined ? chordWeights[key] : 0;
      const weight = progress < MAX_PROGRESS ? (MAX_PROGRESS + 1 - progress) : 0;
      if (weight > 0) {
        candidates.push({ root, type, weight });
      }
    });
  });

  if (candidates.length === 0) {
    chordWeights = {};
    return getWeightedRandomGeneralPool(p);
  }

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let r = Math.random() * totalWeight;
  for (const c of candidates) {
    if (r < c.weight) return c;
    r -= c.weight;
  }
  return candidates[0];
}

// A chord counts as completed (and is off-limits) only while Smart practice is on.
function isChordCompleted(root, type) {
  if (!$('opt-smart-practice')?.checked || !type) return false;
  return (chordWeights[`${root}_${type.sfx}`] || 0) >= MAX_PROGRESS;
}

// Pick a chord type for a fixed root, respecting smart-practice progress.
// With smart practice on, completed chords are never returned: if every type
// for this root is completed, returns null so the caller can skip that step.
function pickChordTypeForRoot(root, p, useSmart) {
  if (!useSmart) return p[Math.floor(Math.random() * p.length)];
  const candidates = p.map(type => {
    const key = `${root}_${type.sfx}`;
    const progress = chordWeights[key] !== undefined ? chordWeights[key] : 0;
    const weight = progress < MAX_PROGRESS ? (MAX_PROGRESS + 1 - progress) : 0;
    return { type, weight };
  }).filter(c => c.weight > 0);

  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let r = Math.random() * totalWeight;
  for (const c of candidates) {
    if (r < c.weight) return c.type;
    r -= c.weight;
  }
  return candidates[0].type;
}

// Builds a progression (trying several random candidates) and returns the one
// with the most playable steps. Steps that can't be played (all completed) are dropped.
function buildBestProgression(makeCandidate) {
  let best = [];
  for (let i = 0; i < 24; i++) {
    const { steps, total } = makeCandidate();
    if (steps.length > best.length) best = steps;
    if (steps.length === total) break;
  }
  return best;
}

// Returns the next playable progression step, or null if none is available.
// Re-checks completion at serve time, since chords can be cleared mid-progression.
function takeProgressionStep(p, isSmart, build) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (!activeProgression || progressionStep >= activeProgression.length) {
      activeProgression = build();
      progressionStep = 0;
      if (activeProgression.length === 0) break;
    }
    while (progressionStep < activeProgression.length) {
      const step = activeProgression[progressionStep++];
      if (!isSmart || !isChordCompleted(step.root, step.type)) return step;
      const alt = pickChordTypeForRoot(step.root, p, true);
      if (alt) return { root: step.root, type: alt };
    }
  }
  activeProgression = null; progressionStep = 0;
  return null;
}

function renderChordPool() {
  const el = $('chord-pool');
  if (!el) return;
  el.textContent = '';
  const p = pool();
  const keyIdx = +keySelect.value;
  const diatonicList = getDiatonicChordsForKey(keyIdx);
  const isSmart = $('opt-smart-practice')?.checked;

  const renderItem = (root, sfx, type) => {
    if (!isPlayable(root, type)) return;
    const key = `${root}_${sfx}`;
    const progress = chordWeights[key] !== undefined ? chordWeights[key] : 0;
    const inPool = !isSmart || progress < MAX_PROGRESS;

    const btn = document.createElement('button');
    btn.type = 'button'; 
    btn.className = 'chord-chip';
    if (!inPool) {
      btn.style.opacity = '0.4';
    }

    const fillPercent = (progress / MAX_PROGRESS) * 100;

    btn.innerHTML = `
      <span class="pool-fill" style="height: ${fillPercent}%;"></span>
      <span>${NAMES[root] + sfx}</span>
    `;

    btn.dataset.root = root; 
    btn.dataset.sfx = sfx;
    btn.addEventListener('click', () => { if (isChordCompleted(root, type)) return; chooseChord(root, type); });
    el.appendChild(btn);
  };

  if (diatonicList) {
    diatonicList.forEach(item => {
      const type = p.find(c => c.sfx === item.sfx) || GROUPS.flatMap(g=>g.chords).find(c => c.sfx === item.sfx);
      if (type) renderItem(item.root, type.sfx, type);
    });
  } else {
    NAMES.forEach((_, root) => {
      p.forEach(type => {
        renderItem(root, type.sfx, type);
      });
    });
  }
  markActiveChordChip();
}

function markActiveChordChip() {
  document.querySelectorAll('#chord-pool .chord-chip').forEach(b => {
    b.classList.toggle('active', mode !== 'ear' && !!target && +b.dataset.root === target.root && b.dataset.sfx === target.type.sfx);
  });
}

function chooseChord(root, type, degreeIndex = null, inv = null, shift = 0) {
  held.clear();
  clearTimeout(advanceTimer); clearTimeout(missTimer);
  setState('');
  setChord(root, type, degreeIndex, inv, shift);
  updatePressedKeysDisplay();
  if (mode === 'ear') playEarTrainingChord();
}

// the practice routine sets the hand itself ('left' | 'right'), as it plays chords in the song's octave (js/routine.js)
let forcedHand = null;
function getSelectedHands() {
  const both = !!$('opt-both-hands') && $('opt-both-hands').checked;
  if (both) return { left: true, right: true, both: true };
  // Not both: decide left/right dynamically from the chosen octave.
  const oct = anchorToCNum(currentAnchor);
  // Low octaves => left hand; high octaves => right hand. Middle defaults to right.
  const left = forcedHand ? forcedHand === 'left' : oct < 4;
  return { left: left, right: !left, both: false };
}

