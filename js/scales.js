'use strict';
// ---------- scale trainer ----------
const SEVEN = [0,1,2,3,4,5,6];
const NAT_MINOR = [0,2,3,5,7,8,10];
const SCALE_GROUPS = [
  { id: 'major', label: 'Major', on: true, scales: [
    { name: 'Major', iv: [0,2,4,5,7,9,11], deg: SEVEN, tone: 'Bright, heroic, joyous.', usage: 'Primary foundation of Western tonal music.' },
  ]},
  { id: 'minor', label: 'Natural minor', on: true, scales: [
    { name: 'Natural minor', iv: NAT_MINOR, deg: SEVEN, tone: 'Somber, gentle, reflective.', usage: 'Foundational minor scale for classical and modern music.' },
  ]},
  { id: 'harmonic', label: 'Harmonic minor', on: true, scales: [
    { name: 'Harmonic minor', iv: [0,2,3,5,7,8,11], deg: SEVEN, tone: 'Exotic, dramatic, Middle-Eastern or neo-classical sound.', usage: 'Classical compositions and heavy metal guitar solos.' },
  ]},
  { id: 'melodic', label: 'Melodic minor', on: true, scales: [
    { name: 'Melodic minor', iv: [0,2,3,5,7,9,11], ivDown: NAT_MINOR, deg: SEVEN, tone: 'Sophisticated, jazz-like, fluid.', usage: 'Jazz improvisation and advanced vocal lines.' },
  ]},
  { id: 'modes', label: 'Modes', on: false, scales: [
    { name: 'Dorian', iv: [0,2,3,5,7,9,10], deg: SEVEN, tone: 'Jazzy, noble, medieval, slightly melancholic.', usage: 'Funk solos, jazz jams, medieval chants, and rock.' },
    { name: 'Phrygian', iv: [0,1,3,5,7,8,10], deg: SEVEN, tone: 'Dark, tense, Spanish flamenco flair.', usage: 'Flamenco guitar and metal riffs.' },
    { name: 'Lydian', iv: [0,2,4,6,7,9,11], deg: SEVEN, tone: 'Whimsical, mystical, airy, sci-fi tone.', usage: 'Film scores and jazz fusion.' },
    { name: 'Mixolydian', iv: [0,2,4,5,7,9,10], deg: SEVEN, tone: 'Bluesy, relaxed, rock-and-roll vibe.', usage: 'Blues jams, classic rock, and pop solos.' },
    { name: 'Locrian', iv: [0,1,3,5,6,8,10], deg: SEVEN, tone: 'Unsettling, dark, unstable.', usage: 'Dark passages and experimental jazz.' },
  ]},
  { id: 'pent', label: 'Pentatonic & blues', on: false, scales: [
    { name: 'Major pentatonic', iv: [0,2,4,7,9], deg: [0,1,2,4,5], tone: 'Uplifting, sweet, folk-like.', usage: 'Pop guitar, folk melodies, and country music.' },
    { name: 'Minor pentatonic', iv: [0,3,5,7,10], deg: [0,2,3,4,6], tone: 'Raw, powerful, soulful.', usage: 'The essential scale for rock and blues guitar solos.' },
    { name: 'Blues', iv: [0,3,5,6,7,10], deg: [0,2,3,4,4,6], tone: 'Gritty, expressive, quintessential blues.', usage: 'Blues, jazz, rock, and soul solos.' },
  ]},
];

const scaleGroupsEl = $('scale-groups');
SCALE_GROUPS.forEach(g => {
  const details = document.createElement('details');
  details.className = 'chord-category';
  const summary = document.createElement('summary');
  const masterLabel = document.createElement('div');
  masterLabel.className = 'toggle-label-row chord-category-master';
  masterLabel.innerHTML = `<span class="toggle-switch"><input type="checkbox" id="sg-${g.id}" ${g.on ? 'checked' : ''}><span class="toggle-slider"></span></span> ${g.label}`;
  summary.appendChild(masterLabel);
  const menuIndicator = document.createElement('span');
  menuIndicator.className = 'chord-category-menu-indicator';
  menuIndicator.textContent = '+';
  menuIndicator.setAttribute('aria-hidden', 'true');
  summary.appendChild(menuIndicator);
  addInfoButton(summary, g.label, () => g.scales.map(s => `<b>${s.name}</b>\n<i>Formula:</i> ${scaleFormula(s.iv)}\n<i>Intervals:</i> ${formula(s.iv)}\n<i>Tone:</i> ${s.tone}\n<i>Usage:</i> ${s.usage}`).join('\n\n'));
  masterLabel.addEventListener('click', event => {
    if (event.target.closest('.toggle-switch')) event.stopPropagation();
  });

  const items = document.createElement('div');
  items.className = 'chord-category-items';
  g.scales.forEach((scale, index) => {
    const item = document.createElement('label');
    item.className = 'toggle-label-row chord-category-item';
    item.innerHTML = `<span class="toggle-switch"><input type="checkbox" id="sg-${g.id}-${index}" ${g.on ? 'checked' : ''}><span class="toggle-slider"></span></span> ${scale.name}`;
    addInfoButton(item, scale.name, () => `<b>${scale.name}</b>\n<i>Formula:</i> ${scaleFormula(scale.iv)}\n<i>Intervals:</i> ${formula(scale.iv)}\n<i>Tone:</i> ${scale.tone}\n<i>Usage:</i> ${scale.usage}`);
    items.appendChild(item);
    item.querySelector('input').addEventListener('change', () => {
      const selected = Array.from(items.querySelectorAll('input')).filter(input => input.checked).length;
      const groupInput = masterLabel.querySelector('input');
      groupInput.checked = selected === g.scales.length;
      groupInput.indeterminate = selected > 0 && selected < g.scales.length;
      updateScaleSelection();
    });
  });
  items.hidden = true;
  document.body.appendChild(items);
  details.appendChild(summary);
  scaleGroupsEl.appendChild(details);

  const positionPopup = () => {
    const summaryRect = summary.getBoundingClientRect();
    const popupRect = items.getBoundingClientRect();
    const left = Math.max(8, Math.min(summaryRect.left, window.innerWidth - popupRect.width - 8));
    let top = summaryRect.bottom + 4;
    if (top + popupRect.height > window.innerHeight - 8) top = Math.max(8, summaryRect.top - popupRect.height - 4);
    items.style.left = `${left}px`;
    items.style.top = `${top}px`;
  };
  summary.addEventListener('click', event => {
    if (event.target.closest('.toggle-switch, .info-btn')) return;
    event.preventDefault();
    document.querySelectorAll('.chord-category[open]').forEach(category => {
      if (category !== details) {
        category.open = false;
        category.querySelector('.chord-category-menu-indicator')?.replaceChildren(document.createTextNode('+'));
      }
    });
    document.querySelectorAll('.chord-category-items').forEach(menu => { menu.hidden = true; });
    details.open = !details.open;
    menuIndicator.textContent = details.open ? '-' : '+';
    if (details.open) { items.hidden = false; requestAnimationFrame(positionPopup); }
    else { items.style.left = ''; items.style.top = ''; }
  });

  const masterInput = masterLabel.querySelector('input');
  const masterSwitch = masterLabel.querySelector('.toggle-switch');
  masterInput.indeterminate = false;
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
    items.querySelectorAll('input').forEach(input => { input.checked = event.target.checked; });
    event.target.indeterminate = false;
    updateScaleSelection();
  });
});

function updateScaleSelection() {
    const pool = scalePool();
    populateScaleSelect();
    renderScalePool();

    if (sTarget && !pool.some(sc => sc.name === sTarget.type.name)) {
      nextScale();
      return;
    }

    const [selRoot, selName] = (scaleSelect.value || '').split(':');
    if (selRoot !== undefined && selName) {
      const sc = scalePool().find(s => s.name === selName);
      if (sc) setScale(+selRoot, sc);
    }
}

function scalePool() {
  const p = [];
  SCALE_GROUPS.forEach(g => {
    g.scales.forEach((scale, index) => {
      if ($(`sg-${g.id}-${index}`)?.checked) p.push(scale);
    });
  });
  return p.length ? p : SCALE_GROUPS[0].scales;
}
const radio = name => document.querySelector('input[name="' + name + '"]:checked').value;

const scaleSelect = $('scale-select');
function populateScaleSelect() {
  scaleSelect.innerHTML = '';
  const pool = scalePool();
  NAMES.forEach((rootName, r) => {
    pool.forEach(sc => {
      const opt = document.createElement('option');
      opt.value = `${r}:${sc.name}`;
      opt.textContent = `${rootName} ${sc.name}`;
      scaleSelect.appendChild(opt);
    });
  });
}
populateScaleSelect();

scaleSelect.addEventListener('change', () => {
  const [r, name] = scaleSelect.value.split(':');
  const sc = scalePool().find(s => s.name === name) || SCALE_GROUPS[0].scales[0];
  setScale(+r, sc);
});

$('btn-random-scale').addEventListener('click', () => {
  nextScale();
});

const LETTERS = ['C','D','E','F','G','A','B'], LETTER_PC = [0,2,4,5,7,9,11];
function accOf(pc, letter) { const a = (((pc - LETTER_PC[letter]) % 12) + 12) % 12; return a > 6 ? a - 12 : a; }
function spellSets(root, sets) {
  let best = null;
  for (let l = 0; l < 7; l++) {
    if (Math.abs(accOf(root, l)) > 1) continue;
    let cost = 0, fine = true;
    const out = sets.map(st => st.iv.map((semi, i) => {
      const li = (l + st.deg[i]) % 7, a = accOf((root + semi) % 12, li);
      if (Math.abs(a) > 1) fine = false;
      cost += Math.abs(a);
      return LETTERS[li] + (a > 0 ? '#' : a < 0 ? 'b' : '');
    }));
    if (!fine) continue;
    if (out[0][0] !== NAMES[root]) cost += 0.1;
    if (!best || cost < best.cost) best = { cost, out };
  }
  return best ? best.out : sets.map(st => st.iv.map(semi => NAMES[(root + semi) % 12]));
}

function solveFingering(blacks) {
  const n = blacks.length;
  const endCost = { 1: 5, 2: 3, 3: 2, 4: 1, 5: 0 };
  let best = null;
  for (let mask = 1; mask < (1 << n); mask++) {
    const T = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) T.push(i);
    if (T.some(i => blacks[i])) continue;
    const groups = T.map((t, k) => ({ start: t, len: (k + 1 < T.length ? T[k + 1] : n) - t }));
    const pre = T[0];
    let valid = pre <= 3;
    groups.forEach((g, k) => {
      const last = k === groups.length - 1;
      if (last ? (g.len < 1 || g.len > 5) : (g.len < 3 || g.len > 4)) valid = false;
    });
    if (!valid) continue;
    const preOpts = pre === 0 ? [null] : [3, 4].filter(e => e - pre + 1 >= 2);
    for (const e of preOpts) {
      const f = new Array(n);
      for (let i = 0; i < pre; i++) f[i] = e - pre + 1 + i;
      groups.forEach(g => { for (let i = 0; i < g.len; i++) f[g.start + i] = i + 1; });
      let cost = T.filter(t => t > 0).length;
      cost += endCost[f[n - 1]];
      f.forEach((x, i) => { if (x === 5 && blacks[i]) cost += 6; });
      T.forEach(t => { if (t > 0 && !blacks[t - 1]) cost += 0.5; });
      if (groups[groups.length - 1].len === 1) cost += 3;
      if (pre > 0 && !blacks[0]) cost += 2.5;
      const cross = []; if (pre) cross.push(e);
      groups.slice(0, -1).forEach(g => cross.push(g.len));
      for (let i = 1; i < cross.length; i++) if (cross[i] === cross[i - 1]) cost += 0.6;
      if (!best || cost < best.cost - 1e-9) best = { cost, f };
    }
  }
  return best ? best.f : null;
}
function fingering(blacks, hand) {
  const f = hand === 'left' ? solveFingering(blacks.slice().reverse()) : solveFingering(blacks);
  if (!f) return blacks.map(() => '');
  return hand === 'left' ? f.reverse() : f;
}

let sTarget = null;
let sProgress = 0;
let sPlayed = [];
let sMissAt = 0, missTimer = null;

function renderScalePool() {
  const el = $('scale-pool');
  if (!el) return;
  el.textContent = '';
  const pool = scalePool();
  const isSmart = $('opt-scale-smart-practice')?.checked;

  NAMES.forEach((rootName, root) => {
    pool.forEach(sc => {
      const key = `${root}_${sc.name}`;
      const progress = scaleWeights[key] !== undefined ? scaleWeights[key] : 0;
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
        <span>${rootName} ${sc.name}</span>
      `;

      btn.dataset.root = root;
      btn.dataset.scale = sc.name;
      btn.addEventListener('click', () => setScale(root, sc));
      el.appendChild(btn);
    });
  });
  markActiveScaleChip();
}

function markActiveScaleChip() {
  document.querySelectorAll('#scale-pool .chord-chip').forEach(b => {
    b.classList.toggle('active', !!sTarget && +b.dataset.root === sTarget.root && b.dataset.scale === sTarget.type.name);
  });
}

function nextScale() {
  buildKeys();
  const pool = scalePool();
  let root, type, tries = 0;
  const isSmart = $('opt-scale-smart-practice')?.checked;

  if (isSmart) {
    const candidates = [];
    NAMES.forEach((_, r) => {
      pool.forEach(sc => {
        const key = `${r}_${sc.name}`;
        const progress = scaleWeights[key] !== undefined ? scaleWeights[key] : 0;
        if (progress < MAX_PROGRESS) {
          const weight = MAX_PROGRESS + 1 - progress;
          candidates.push({ root: r, type: sc, weight });
        }
      });
    });

    if (candidates.length === 0) {
      scaleWeights = {};
      return nextScale();
    }

    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let r = Math.random() * totalWeight;
    let chosen = candidates[0];
    for (const c of candidates) {
      if (r < c.weight) { chosen = c; break; }
      r -= c.weight;
    }
    root = chosen.root;
    type = chosen.type;
  } else {
    do {
      root = Math.floor(Math.random() * 12);
      type = pool[Math.floor(Math.random() * pool.length)];
      tries++;
    } while (sTarget && tries < 20 && root === sTarget.root && type === sTarget.type);
  }
  setScale(root, type);
}

function setScale(root, type) {
  const dirMode = radio('dir');
  const hands = getSelectedHands();
  const handLabel = hands.both ? 'Both hands simultaneously' : (hands.left ? 'Left hand' : 'Right hand');

  const ivDown = type.ivDown || type.iv;
  const spelled = spellSets(root, [{ iv: type.iv, deg: type.deg }, { iv: ivDown, deg: type.deg }]);
  
  const mk = (iv, names) => {
    const offs = [...iv, 12];
    const lhFingers = fingering(offs.map(o => isBlack(root + o)), 'left');
    const rhFingers = fingering(offs.map(o => isBlack(root + o)), 'right');
    return { offs, names: [...names, names[0]], lhFingers, rhFingers };
  };
  
  const up = mk(type.iv, spelled[0]), down = mk(ivDown, spelled[1]);
  const toSeq = (set, dir) => set.offs.map((off, i) => ({ off, dir, label: set.names[i] }));
  const upSeq = toSeq(up, 'up'), downSeq = toSeq(down, 'down').reverse();
  const seq = dirMode === 'up' ? upSeq : dirMode === 'down' ? downSeq : upSeq.concat(downSeq);

  let hint = handLabel + ' · ' + { up: 'ascending', down: 'descending', both: 'up and down' }[dirMode];
  if (type.ivDown && dirMode !== 'up') hint += ' · comes down as natural minor';

  sTarget = { root, type, dirMode, up, down, seq, hint };
  startScoreTimer(sTarget);
  sProgress = 0; sPlayed = []; locked = false;
  clearTimeout(advanceTimer); clearTimeout(missTimer); setState('');

  chordEl.textContent = spelled[0][0];
  chordEl.classList.remove('small-text');
  const sub = document.createElement('small'); sub.textContent = type.name; chordEl.appendChild(sub);
  hintEl.textContent = hint;

  if (scaleSelect.value !== `${root}:${type.name}`) {
    scaleSelect.value = `${root}:${type.name}`;
  }

  drawTarget();
  markActiveScaleChip();
  retuneBed();
}

function scaleNoteOn(n) {
  if (!sTarget || locked) return;
  const hands = getSelectedHands();
  const seq = sTarget.seq;
  const expectedOffset = seq[sProgress].off;

  const lhAnchor = currentAnchor + sTarget.root;
  const rhAnchor = lhAnchor + handsGap;
  const expectedLH = lhAnchor + expectedOffset;
  const expectedRH = rhAnchor + expectedOffset;

  if (hands.both) {
    const expectedSet = new Set([expectedLH, expectedRH]);
    const strayNote = [...held].find(x => !expectedSet.has(x));
    if (strayNote !== undefined) { scaleMiss(strayNote, [expectedLH, expectedRH]); return; }

    if (held.has(expectedLH) && held.has(expectedRH)) {
      sProgress++;
      sPlayed.push(expectedLH, expectedRH);

      if (sProgress === seq.length) {
        locked = true; lockedAt = Date.now();
        setState('ok'); hintEl.textContent = 'Scale completed with both hands! Release keys to continue';
        if ($('opt-scale-smart-practice')?.checked && sTarget) {
          const key = `${sTarget.root}_${sTarget.type.name}`;
          const currentW = scaleWeights[key] !== undefined ? scaleWeights[key] : 0;
          const r = settleScore(sTarget, sTarget.seq.length * 500, sTarget.seq.length * 1200);
          scaleWeights[key] = Math.max(0, Math.min(MAX_PROGRESS, currentW + r.delta));
          renderScalePool();
          showScoreChip(document.querySelector(`#scale-pool .chord-chip[data-root="${sTarget.root}"][data-scale="${CSS.escape(sTarget.type.name)}"]`), r, currentW, scaleWeights[key]);
        }
      } else {
        setState(''); hintEl.textContent = 'Keep playing both hands in unison';
      }
      drawTarget();
    }
    return;
  }

  const right = n === expectedLH;
  if (!right) { scaleMiss(n, [expectedLH]); return; }

  sProgress++; sPlayed.push(expectedLH);
  if (sProgress === seq.length) {
    locked = true; lockedAt = Date.now();
    setState('ok'); hintEl.textContent = 'Correct, release the keys to continue';
    if ($('opt-scale-smart-practice')?.checked && sTarget) {
      const key = `${sTarget.root}_${sTarget.type.name}`;
      const currentW = scaleWeights[key] !== undefined ? scaleWeights[key] : 0;
      const r = settleScore(sTarget, sTarget.seq.length * 500, sTarget.seq.length * 1200);
      scaleWeights[key] = Math.max(0, Math.min(MAX_PROGRESS, currentW + r.delta));
      renderScalePool();
      showScoreChip(document.querySelector(`#scale-pool .chord-chip[data-root="${sTarget.root}"][data-scale="${CSS.escape(sTarget.type.name)}"]`), r, currentW, scaleWeights[key]);
    }
  } else {
    setState(''); hintEl.textContent = 'Keep going';
  }
  drawTarget();
}

// Mic input: only fail on a wrong note that is still heard after a moment, so flickers are ignored.
let micMissTimer = null;
function scaleMiss(n, expected, confirmed = false) {
  if (lastInput === 'mic' && !confirmed) {
    clearTimeout(micMissTimer);
    const t = sTarget, p = sProgress;
    micMissTimer = setTimeout(() => {
      if (sTarget === t && sProgress === p && !locked && held.has(n)) scaleMiss(n, expected, true);
    }, 250);
    return;
  }
  if (sTarget) recordMiss(sTarget, [n], expected, true, sProgress + ':');
  routineApp.miss();
  sProgress = 0; sPlayed = [];
  setState('bad'); hintEl.textContent = 'Not quite, start again from the first note';
  sMissAt = Date.now();
  drawTarget();
}

function scaleNoteOff() {
  if (locked) { tryAdvance(); return; }
  if (held.size > 0 || !stage.classList.contains('bad')) return;
  clearTimeout(missTimer);
  missTimer = setTimeout(() => {
    if (mode !== 'scales' || held.size > 0 || !stage.classList.contains('bad')) return;
    setState(''); if (sTarget) hintEl.textContent = sTarget.hint;
  }, Math.max(0, 450 - (Date.now() - sMissAt)));
}

function renderTrail() {
  const trail = $('trail'); trail.textContent = '';
  if (!sTarget) return;
  const show = showOnKeys();
  sTarget.seq.forEach((e, i) => {
    const pill = document.createElement('span');
    pill.className = 'pill' + (i < sProgress ? ' done' : '') + (i === sProgress ? ' next' : '');
    pill.textContent = (i < sProgress || show) ? e.label : '•';
    trail.appendChild(pill);
  });
}

function drawScale() {
  Object.values(keyEls).forEach(el => {
    el.classList.remove('tgt', 'root', 'done', 'half');
    const f = el.querySelector('.finger'); if (f) f.textContent = '';
  });
  renderTrail();
  if (!sTarget) return;

  // Up and down: a key played once (on the way up) is half done, played a second time it is done.
  const twice = sTarget.dirMode === 'both';
  const count = {};
  sPlayed.forEach(key => { count[key] = (count[key] || 0) + 1; });
  Object.keys(count).forEach(key => {
    if (keyEls[key]) keyEls[key].classList.add(!twice || count[key] > 1 ? 'done' : 'half');
  });

  if (!showOnKeys()) return;

  const seq = sTarget.seq;
  const cur = seq[Math.min(sProgress, seq.length - 1)];
  const set = cur.dir === 'up' ? sTarget.up : sTarget.down;
  const fingersOn = showOnKeys();
  const hands = getSelectedHands();

  const lhAnchor = currentAnchor + sTarget.root;
  const rhAnchor = lhAnchor + handsGap;

  const scaleNotes = new Set();
  const noteToFinger = {};
  const rootKeys = new Set([lhAnchor]);

  if (hands.both) {
    rootKeys.add(rhAnchor);
    set.offs.forEach((o, i) => {
      const nLH = lhAnchor + o;
      scaleNotes.add(nLH);
      noteToFinger[nLH] = set.lhFingers[i];
      const nRH = rhAnchor + o;
      scaleNotes.add(nRH);
      noteToFinger[nRH] = set.rhFingers[i];
    });
  } else {
    const fingersArr = hands.left ? set.lhFingers : set.rhFingers;
    set.offs.forEach((o, i) => {
      const n = lhAnchor + o;
      scaleNotes.add(n);
      noteToFinger[n] = fingersArr[i];
    });
  }

  Object.keys(keyEls).forEach(nStr => {
    const n = +nStr;
    if (scaleNotes.has(n)) {
      const el = keyEls[n];
      if (el) {
        el.classList.add('tgt');
        if (rootKeys.has(n)) {
          el.classList.add('root');
        }
        const f = el.querySelector('.finger');
        if (f && fingersOn) {
          const fingeringVal = noteToFinger[n];
          f.textContent = fingeringVal !== undefined ? `${fingeringVal}` : '';
        }
      }
    }
  });
}

