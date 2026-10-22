'use strict';
// ---------- technical terms dictionary ----------
const TECH_TERMS = {
  'root': 'The foundational pitch upon which a chord or scale is built.',
  'minor 2nd': '1 semitone step. Very dissonant; creates tension, suspense, or darkness.',
  'major 2nd': '2 semitones step. A whole-tone step; sounds smooth and lyrical.',
  'minor 3rd': '3 semitones. The defining interval of minor keys; evokes melancholy, pathos, or sadness.',
  'major 3rd': '4 semitones. The defining interval of major keys; sounds bright, warm, and happy.',
  'perfect 4th': '5 semitones. An open, consonant, stable interval often found in fanfares and hymns.',
  'tritone': '6 semitones (augmented 4th / diminished 5th). "The devil\'s interval"; tense, restless, unstable.',
  'perfect 5th': '7 semitones. Extremely stable, open, and resonant; forms the backbone of triads.',
  'minor 6th': '8 semitones. Romantic, dramatic, or slightly mournful sound.',
  'major 6th': '9 semitones. Warm, sweet, nostalgic; common in jazz and pop harmony.',
  'minor 7th': '10 semitones. Mildly dissonant, mellow, bluesy tone.',
  'major 7th': '11 semitones. Lush, dreamy, nostalgic, and sophisticated.',
  'octave': '12 semitones. The exact same pitch class in a higher or lower register.',
  'minor 9th': '13 semitones. Highly dissonant and dramatic interval.',
  'major 9th': '14 semitones. Open, sprawling, lush sound common in jazz and modern pop.'
};

function annotateTechTerms(htmlText) {
  let result = htmlText;
  const sortedTerms = Object.keys(TECH_TERMS).sort((a, b) => b.length - a.length);
  sortedTerms.forEach(term => {
    const regex = new RegExp('\\b(' + term + ')\\b', 'gi');
    result = result.replace(regex, `<span class="tech-term" data-term="$1">$1</span>`);
  });
  return result;
}

// ---------- info bubbles ----------
let infoPop = null;
let termPop = null;
let termPopTitle = null;
let termPopDescription = null;

function hideTermPopover() {
  if (termPop) termPop.hidden = true;
}

function showTermPopover(termEl) {
  if (!termPop) {
    termPop = document.createElement('div');
    termPop.className = 'info-popover term-definition-popover';
    termPop.hidden = true;
    termPopTitle = document.createElement('strong');
    termPopTitle.className = 'term-definition-title';
    termPopDescription = document.createElement('div');
    termPop.append(termPopTitle, termPopDescription);
    document.body.appendChild(termPop);
  }

  const term = termEl.dataset.term;
  const description = TECH_TERMS[term.toLowerCase()] || 'Musical interval or structural term.';
  termPopTitle.textContent = term;
  termPopDescription.textContent = description;
  termPop.style.maxWidth = `${Math.max(0, window.innerWidth - 16)}px`;
  termPop.hidden = false;

  const termRect = termEl.getBoundingClientRect();
  const popupRect = termPop.getBoundingClientRect();
  let left = termRect.right + 6;
  if (left + popupRect.width > window.innerWidth - 8) left = termRect.left - popupRect.width - 6;
  left = Math.max(8, Math.min(left, window.innerWidth - popupRect.width - 8));
  const top = Math.max(8, Math.min(termRect.top, window.innerHeight - popupRect.height - 8));
  termPop.style.left = `${left}px`;
  termPop.style.top = `${top}px`;
}

function ensureInfoPopover() {
  if (infoPop) return infoPop;
  infoPop = document.createElement('div');
  infoPop.className = 'info-popover'; infoPop.hidden = true;
  document.body.appendChild(infoPop);

  infoPop.addEventListener('pointerover', event => {
    const termEl = event.target.closest('.tech-term');
    if (termEl && infoPop.contains(termEl)) showTermPopover(termEl);
  });
  infoPop.addEventListener('pointerout', event => {
    const termEl = event.target.closest('.tech-term');
    if (!termEl || termEl.contains(event.relatedTarget)) return;
    hideTermPopover();
  });

  document.addEventListener('click', e => {
    if (infoPop.hidden || e.target.closest('.info-btn') || infoPop.contains(e.target)) return;
    infoPop.hidden = true;
    hideTermPopover();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { infoPop.hidden = true; hideTermPopover(); }
  });
  window.addEventListener('resize', () => { infoPop.hidden = true; hideTermPopover(); });
  window.addEventListener('scroll', () => { infoPop.hidden = true; hideTermPopover(); }, true);
  return infoPop;
}

function addInfoButton(container, label, getHtml) {
  if (!container) return null;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'info-btn'; btn.textContent = 'i';
  btn.setAttribute('aria-label', 'Info about ' + label);
  btn.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    hideTermPopover();
    const pop = ensureInfoPopover();
    if (!pop.hidden && pop.dataset.for === label) { pop.hidden = true; return; }
    pop.innerHTML = annotateTechTerms(getHtml());
    pop.dataset.for = label;
    pop.hidden = false;
    const r = btn.getBoundingClientRect();
    const popupRect = pop.getBoundingClientRect();
    let left = Math.max(8, Math.min(r.left, window.innerWidth - popupRect.width - 8));
    let top = r.bottom + 6;
    if (top + popupRect.height > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - popupRect.height - 8);
    }
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  });
  container.appendChild(btn);
  return btn;
}

const chordInfoLabel = 'Current chord';
chordInfoEl = addInfoButton(chordNameWrapEl, chordInfoLabel, () => chordInfoHtml);
chordInfoEl.id = 'chord-info';
chordInfoEl.hidden = true;

// ---------- info buttons on the Synth and Background sliders, and the Settings sections ----------
// (the Synth popup is built by audio.js and the Background popup by ambient.js, both loaded before this file)
const SLIDER_INFO = {
  synth: {
    Attack: 'How quickly a note fades in when you press a key. Low is instant, high swells in slowly.',
    Decay: 'How quickly the note then settles down to the sustain level.',
    Sustain: 'How loud a held note stays. At 0 it fades out like a piano; higher keeps it ringing while the key is down.',
    Release: 'How long the note rings on after you let go of the key.',
    Cutoff: 'Brightness. Lower is darker and more muffled, higher is brighter and buzzier.',
    Resonance: 'A sharp, vocal peak at the cutoff: the classic synth "squelch". Low is smooth, high is whistly.',
    Detune: 'How far apart the layered tones are tuned. More is wider, thicker and more shimmery.',
    'Filter env': 'How much darker the note gets as it fades, like a struck string losing its shine.',
  },
  background: {
    Speed: 'How fast the shapes drift. At 0 they hold still.',
    Reaction: 'How strongly the background responds to the notes you play.',
    Morph: 'How much the shapes change their outline as they move.',
    Intensity: 'How bright and strong the glow is.',
    Lifespan: 'How long (in seconds) a shape lasts before it fades away. A correct answer adds a shape, a wrong one removes one.',
    Shapes: 'The most shapes the background can hold at once.',
    Grain: 'The amount of film-like grain over the picture.',
  },
};
function addSliderInfo(panel, texts) {
  if (!panel) return;
  panel.querySelectorAll('.synth-row').forEach(row => {
    const name = row.querySelector('span')?.textContent.trim();
    if (texts[name]) addInfoButton(row, name, () => `<b>${name}</b>\n${texts[name]}`);
  });
}
addSliderInfo(document.getElementById('synth-panel'), SLIDER_INFO.synth);
addSliderInfo(document.getElementById('bg-panel'), SLIDER_INFO.background);
addInfoButton(document.querySelector('.volume-row'), 'Volume', () => '<b>Volume</b>\nThe master volume for everything you hear: the keys, the drones and the reverb.');

addInfoButton(document.querySelector('#sec-notation .section-head'), 'Notation', () => [
  '<b>Notation</b>',
  'How note names are written across the app.',
  '<i>Off:</i> letter names, as in English: C D E F G A B.',
  '<i>Solfège:</i> European names: Do Re Mi Fa Sol La Si.',
].join('\n'));

addInfoButton(document.querySelector('#sec-background .section-head'), 'Visuals', () => [
  '<b>Visuals</b>',
  'Settings for how the app looks. The colour palette is picked from the Palette menu at the top; each palette also brings its own synth sound.',
  'Use the <b>Background</b> control below to tune or freeze the moving background.',
].join('\n'));

const INTERVAL_NAMES = {
  0: 'root', 1: 'minor 2nd', 2: 'major 2nd', 3: 'minor 3rd', 4: 'major 3rd', 5: 'perfect 4th',
  6: 'tritone', 7: 'perfect 5th', 8: 'minor 6th', 9: 'major 6th', 10: 'minor 7th', 11: 'major 7th',
  12: 'octave', 13: 'minor 9th', 14: 'major 9th',
};
function formula(iv) { return iv.map(i => INTERVAL_NAMES[i] || (i + ' semitones')).join(' + '); }
function scaleFormula(iv) {
  return iv.map((interval, index) => {
    const next = iv[index + 1] ?? 12;
    const steps = next - interval;
    return steps === 1 ? 'H' : steps === 2 ? 'W' : `${steps} half steps`;
  }).join(' - ');
}

function updateChordInfo(type, visible = true) {
  if (!type || !visible) {
    chordInfoEl.hidden = true;
    return;
  }
  const details = [`<b>${type.name}</b>`];
  if (type.tone) details.push(`<i>Tone:</i> ${type.tone}`);
  if (type.usage) details.push(`<i>Usage:</i> ${type.usage}`);
  if (type.iv) details.push(`<i>Notes:</i> ${formula(type.iv)}`);
  if (typeof target !== 'undefined' && target?.type === type && target.inv) {
    const roles = { 2: '9th', 3: '3rd', 4: '3rd', 5: '4th', 6: '5th', 7: '5th', 8: '5th', 9: '6th', 10: '7th', 11: '7th' };
    const bass = target.iv[0];
    const notes = target.iv.map(i => NAMES[(target.root + i) % 12]).join(' ');
    details.push(`\n<b>${INV_NAMES[target.inv]}</b>\nThe ${roles[bass % 12] || 'chord tone'} (${NAMES[(target.root + bass) % 12]}) is the lowest note instead of the root, written ${target.name}.\n<i>Play bottom to top:</i> ${notes}\nThe root (${NAMES[target.root]}) moves up an octave; it's still the marked key.`);
  }
  chordInfoHtml = details.join('\n');
  chordInfoEl.setAttribute('aria-label', `Info about ${type.name}`);
  chordInfoEl.hidden = false;
}

