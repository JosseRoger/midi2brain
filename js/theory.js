'use strict';
const THEORY_PROGRESSIONS = {
  pop: { degrees: [0, 4, 5, 3], romans: ['I', 'V', 'vi', 'IV'], note: 'A familiar loop: V adds a little pull, vi softens the mood, and IV opens the sound before it repeats.' },
  classic: { degrees: [0, 3, 4, 0], romans: ['I', 'IV', 'V', 'I'], note: 'A clear journey away from home, through tension, and back to home.' },
  jazz: { degrees: [1, 4, 0], romans: ['ii', 'V', 'I'], note: 'The ii chord leads into V, and V strongly wants to resolve to I.' },
  reflective: { degrees: [5, 3, 0, 4], romans: ['vi', 'IV', 'I', 'V'], note: 'Starting on vi feels softer; I and V give the loop a gentle lift and a reason to repeat.' },
};

function renderTheoryProgression() {
  const root = +$('theory-progression-key').value;
  const progression = THEORY_PROGRESSIONS[$('theory-progression-pattern').value];
  const scaleSteps = [0, 2, 4, 5, 7, 9, 11];
  const chordQualities = ['', 'm', 'm', '', '', 'm', 'dim'];
  const list = $('theory-progression-chords');
  list.replaceChildren();

  progression.degrees.forEach((degree, index) => {
    const item = document.createElement('li');
    const roman = document.createElement('span');
    const chord = document.createElement('strong');
    roman.textContent = progression.romans[index];
    chord.textContent = NAMES[(root + scaleSteps[degree]) % 12] + chordQualities[degree];
    item.setAttribute('aria-label', `${roman.textContent} ${chord.textContent}`);
    item.append(roman, chord);
    list.appendChild(item);
  });
  $('theory-progression-note').textContent = progression.note;
}

$('theory-progression-key').addEventListener('change', renderTheoryProgression);
$('theory-progression-pattern').addEventListener('change', renderTheoryProgression);
renderTheoryProgression();

const theoryTopicTabs = Array.from(document.querySelectorAll('#theory-topic-tabs [role="tab"]'));
function activateTheoryTopic(tab) {
  theoryTopicTabs.forEach(topicTab => {
    const selected = topicTab === tab;
    topicTab.setAttribute('aria-selected', String(selected));
    topicTab.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll('#theory-view .theory-panel').forEach(panel => {
    panel.hidden = panel.id !== tab.getAttribute('aria-controls');
  });
}

theoryTopicTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateTheoryTopic(tab));
  tab.addEventListener('keydown', event => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % theoryTopicTabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index + theoryTopicTabs.length - 1) % theoryTopicTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = theoryTopicTabs.length - 1;
    else return;
    event.preventDefault();
    theoryTopicTabs[nextIndex].focus();
    activateTheoryTopic(theoryTopicTabs[nextIndex]);
  });
});


// ---------- animated theory loops ----------
// Small looping keyboards placed after matching examples. Frames list the lit notes (semitones from C,
// two octaves) and a caption; note names come from NAMES so they follow the solfège setting.
// Loops replay in several keys: N(i) names note i transposed to the key being shown.
let loopShift = 0;
const N = i => NAMES[(i + loopShift) % 12];
const THEORY_LOOPS = [
  { match: 'C to C# is a half step', frames: [
    { notes: [0], label: () => N(0) },
    { notes: [0, 1], label: () => `${N(0)} → ${N(1)}: half step` },
    { notes: [0], label: () => N(0) },
    { notes: [0, 2], label: () => `${N(0)} → ${N(2)}: whole step` },
  ] },
  { match: 'use different names for the same piano key', frames: [
    { notes: [0], label: () => N(0) },
    { notes: [1], label: () => `${N(0)}# — one half step up` },
    { notes: [2], label: () => N(2) },
    { notes: [1], label: () => `${N(2)}b — one half step down: same key` },
  ] },
  { match: 'This one uses only the white keys', frames: [0, 2, 4, 5, 7, 9, 11, 12].map((n, i, a) => ({
    notes: a.slice(0, i + 1), root: [0, 12],
    label: () => i === 0 ? N(0) : `${['', 'whole', 'whole', 'half', 'whole', 'whole', 'whole', 'half'][i]} step → ${N(n % 12)}`,
  })) },
  { match: 'C minor = C, Eb, G', frames: [
    { notes: [0], root: [0], label: () => `${N(0)}: root` },
    { notes: [0, 4], root: [0], label: () => `+ ${N(4)}: major third` },
    { notes: [0, 4, 7], root: [0], label: () => `+ ${N(7)}: fifth = ${N(0)} major` },
    { notes: [0, 3, 7], root: [0], label: () => `${N(4)} drops to ${N(3)} = ${N(0)} minor` },
  ] },
  { match: 'the second has E in the bass', frames: [
    { notes: [0, 4, 7], root: [0], label: () => `Root position: ${N(0)} ${N(4)} ${N(7)}` },
    { notes: [4, 7, 12], root: [12], label: () => `1st inversion: ${N(4)} ${N(7)} ${N(0)}` },
    { notes: [7, 12, 16], root: [12], label: () => `2nd inversion: ${N(7)} ${N(0)} ${N(4)}` },
  ] },,
  { match: 'The next C has the same name and sounds higher', frames: [
    { notes: [0], root: [0], label: () => `${N(0)}` },
    { notes: [0, 12], root: [0, 12], label: () => `${N(0)} → ${N(0)}: one octave higher` },
  ] },
  { match: 'but A feels like home', frames: [9, 11, 12, 14, 16, 17, 19, 21].map((n, i, a) => ({
    notes: a.slice(0, i + 1), root: [9, 21],
    label: () => i === 0 ? `${N(9)}: home` : `${N(n % 12)}`,
  })) },
  { match: 'C is 1, G is 5, and B is 7', frames: [0, 2, 4, 5, 7, 9, 11].map((n, i) => ({
    notes: [n], root: n === 0 ? [0] : [],
    label: () => `${N(n)} = ${i + 1}`,
  })) },
  { match: 'ii = D minor, V = G, vi = A minor', frames: [
    { notes: [0, 4, 7], root: [0], label: () => `I = ${N(0)}` },
    { notes: [2, 5, 9], root: [2], label: () => `ii = ${N(2)} minor` },
    { notes: [7, 11, 14], root: [7], label: () => `V = ${N(7)}` },
    { notes: [9, 12, 16], root: [9], label: () => `vi = ${N(9)} minor` },
  ] },
  { match: 'that is C, D, E, G, A', frames: [0, 2, 4, 7, 9, 12].map((n, i, a) => ({
    notes: a.slice(0, i + 1), root: [0, 12],
    label: () => i === 0 ? `${N(0)} major pentatonic` : `+ ${N(n % 12)}`,
  })) },
  { match: 'Over G major, try B or D', frames: [
    { notes: [0, 4, 7], root: [], label: () => `${N(0)} major chord` },
    { notes: [0, 4, 7, 16], root: [16], label: () => `melody on ${N(4)}: settled` },
    { notes: [7, 11, 14], root: [], label: () => `${N(7)} major chord` },
    { notes: [7, 11, 14, 23], root: [23], label: () => `melody on ${N(11)}: settled` },
  ] },
  { match: 'loop I - V - vi - IV in C', frames: [
    { notes: [0, 4, 7], root: [0], label: () => `I: ${N(0)}` },
    { notes: [7, 11, 14], root: [7], label: () => `V: ${N(7)}` },
    { notes: [9, 12, 16], root: [9], label: () => `vi: ${N(9)}m` },
    { notes: [5, 9, 12], root: [5], label: () => `IV: ${N(5)}` },
  ] },
];

function buildTheoryLoop(loop) {
  const wrap = document.createElement('figure');
  wrap.className = 'theory-loop';
  wrap.setAttribute('aria-hidden', 'true');
  const keys = document.createElement('div');
  keys.className = 'theory-loop-keys';
  const els = {}, whites = [0, 2, 4, 5, 7, 9, 11].flatMap(s => [s, s + 12]).sort((a, b) => a - b), w = 100 / whites.length;
  whites.forEach((n, i) => {
    const el = document.createElement('div');
    el.className = 'k w'; el.style.left = `${i * w}%`; el.style.width = `${w}%`;
    keys.appendChild(el); els[n] = el;
  });
  for (let n = 0; n < 24; n++) if ([1, 3, 6, 8, 10].includes(n % 12)) {
    const el = document.createElement('div');
    el.className = 'k b'; el.style.width = `${w * 0.6}%`; el.style.left = `${whites.filter(x => x < n).length * w - w * 0.3}%`;
    keys.appendChild(el); els[n] = el;
  }
  const caption = document.createElement('figcaption');
  wrap.append(keys, caption);

  // Keys to show this idea in (white-key roots), keeping only those that fit the two octaves.
  const top = Math.max(...loop.frames.flatMap(f => f.notes));
  const roots = [0, 7, 2, 9, 5].filter(t => top + t <= 23);
  let frame = 0, ri = 0;
  const advance = () => { frame = (frame + 1) % loop.frames.length; if (frame === 0) ri = (ri + 1) % roots.length; show(); };
  const show = () => {
    const t = roots[ri], src = loop.frames[frame];
    const f = { notes: src.notes.map(n => n + t), root: (src.root || []).map(n => n + t) };
    loopShift = t;
    Object.entries(els).forEach(([n, el]) => {
      el.classList.toggle('tgt', f.notes.includes(+n));
      el.classList.toggle('root', (f.root || []).includes(+n) && f.notes.includes(+n));
    });
    caption.textContent = src.label();
  };
  show();
  // Plays all the time.
  setInterval(advance, 1300);
  return wrap;
}

THEORY_LOOPS.forEach(loop => {
  const example = [...document.querySelectorAll('#theory-view p')].find(p => p.textContent.includes(loop.match));
  if (!example) return;
  // Loops sit at the bottom of their lesson card so loops in the same row line up.
  const lesson = example.closest(".theory-lesson");
  if (lesson) lesson.append(buildTheoryLoop(loop)); else example.after(buildTheoryLoop(loop));
});
