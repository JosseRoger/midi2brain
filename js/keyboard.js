'use strict';
let LOW = 60, HIGH = 88;
const kbd = $('kbd');
let keyEls = {};
const isBlack = n => [1,3,6,8,10].includes(n % 12);

function updatePressedKeysDisplay() {
  Object.values(keyEls).forEach(el => el.classList.remove('on'));
  held.forEach(n => { if (keyEls[n]) keyEls[n].classList.add('on'); });
}

// The practice routine hides a chord / scale you know (js/routine.js): you play it from memory.
let hideTarget = false;
const showOnKeys = () => $('opt-show').checked && !hideTarget;

function leftmostAnchor(root) {
  return currentAnchor + root;
}

function buildKeys(forceLow = null, forceHigh = null) {
  if (forceLow !== null && forceHigh !== null) {
    LOW = forceLow;
    HIGH = forceHigh;
  } else {
    const hands = getSelectedHands();
    LOW = currentAnchor;
    HIGH = hands.both ? currentAnchor + 60 : currentAnchor + 28;
  }

  kbd.innerHTML = '';
  keyEls = {};
  const whites = []; for (let n = LOW; n <= HIGH; n++) if (!isBlack(n)) whites.push(n);
  
  const minWhiteKeyWidth = document.body.classList.contains('playable-kbd') ? 64 : 28;
  const calculatedMinWidth = whites.length * minWhiteKeyWidth;
  kbd.style.minWidth = calculatedMinWidth + 'px';

  const w = 100 / whites.length;
  whites.forEach((n, i) => {
    const el = document.createElement('div');
    el.className = 'k w'; el.style.left = (i * w) + '%'; el.style.width = w + '%';
    el.dataset.n = n;
    el.innerHTML = (n % 12 === 0) ? `<span class="c-label">${noteToCLabel(n)}</span><span class="finger"></span>` : '<span class="finger"></span>';
    kbd.appendChild(el); keyEls[n] = el;
  });
  for (let n = LOW; n <= HIGH; n++) if (isBlack(n)) {
    const idx = whites.filter(x => x < n).length;
    const el = document.createElement('div');
    el.className = 'k b'; el.style.width = (w * 0.6) + '%'; el.style.left = (idx * w - w * 0.3) + '%';
    el.dataset.n = n; el.innerHTML = '<span class="finger"></span>'; kbd.appendChild(el); keyEls[n] = el;
  }
}
populateOctaveSelect();
buildKeys();

function fingeringFor(type, hand) {
  if (type.fingers) return type.fingers[hand]; // shapes with their own (the routine's fifths and octaves)
  const count = type.iv.length;
  let f;
  if (count === 3) f = [1, 3, 5];
  else if (count === 4) f = [1, 2, 3, 5];
  else if (count === 5) f = [1, 2, 3, 4, 5];
  else f = type.iv.map((_, i) => Math.min(5, i + 1));
  return hand === 'left' ? f.slice().reverse() : f;
}

function drawTarget() { requestAnimationFrame(() => { scrollKeyboardToTarget(); updateKbdScroll(); });
  if (mode === 'scales') drawScale(); 
  else if (mode === 'chords') drawChordTarget(); 
  else if (mode === 'detector') drawDetectorTarget();
  else if (mode === 'ear') {
    Object.values(keyEls).forEach(el => {
      el.classList.remove('tgt', 'root', 'done', 'half');
      const f = el.querySelector('.finger'); if (f) f.textContent = '';
    });
  }
}

function drawDetectorTarget() {
  Object.values(keyEls).forEach(el => {
    el.classList.remove('tgt', 'root', 'done', 'half');
    const f = el.querySelector('.finger'); if (f) f.textContent = '';
  });
  detectorCollected.forEach(n => keyEls[n]?.classList.add('tgt')); // tapped notes (note by note) show blue
  if (!detectorDisplayedMatch) return;

  const chordNotes = new Set(detectorDisplayedMatch.notes || []);
  Object.entries(keyEls).forEach(([note, el]) => {
    const noteNumber = +note;
    const pitchClass = noteNumber % 12;
    if (!chordNotes.has(noteNumber)) return;
    el.classList.add('tgt');
    if (pitchClass === detectorDisplayedMatch.root) el.classList.add('root');
  });
}

function drawChordTarget() {
  Object.values(keyEls).forEach(el => {
    el.classList.remove('tgt', 'root', 'done', 'half');
    const f = el.querySelector('.finger'); if (f) f.textContent = '';
  });
  if (!target || !showOnKeys()) return;

  const hands = getSelectedHands();
  const lhAnchor = leftmostAnchor(target.root);
  const rhAnchor = hands.both ? lhAnchor + handsGap : lhAnchor;

  if (hands.both) {
    const lhFingers = fingeringFor(target.type, 'left');
    const rhFingers = fingeringFor(target.type, 'right');

    target.iv.forEach((i, idx) => {
      const nLH = lhAnchor + i;
      const elLH = keyEls[nLH];
      if (elLH) {
        elLH.classList.add('tgt'); if (i % 12 === 0) elLH.classList.add('root');
        const f = elLH.querySelector('.finger');
        if (f && showOnKeys()) f.textContent = `${lhFingers[idx]}`;
      }

      const nRH = rhAnchor + i;
      const elRH = keyEls[nRH];
      if (elRH) {
        elRH.classList.add('tgt'); if (i % 12 === 0) elRH.classList.add('root');
        const f = elRH.querySelector('.finger');
        if (f && showOnKeys()) f.textContent = `${rhFingers[idx]}`;
      }
    });
  } else {
    const activeHand = hands.left ? 'left' : 'right';
    const fingers = fingeringFor(target.type, activeHand);
    const anchor = lhAnchor;

    target.iv.forEach((i, idx) => {
      const n = anchor + i;
      const el = keyEls[n]; if (!el) return;
      el.classList.add('tgt'); if (i % 12 === 0) el.classList.add('root');
      const f = el.querySelector('.finger');
      if (f) f.textContent = showOnKeys() ? `${fingers[idx]}` : '';
    });
  }
}

const pointerNotes = new Map();
kbd.addEventListener('pointerdown', e => {
  const el = e.target.closest('.k'); if (!el) return;
  const n = +el.dataset.n; pointerNotes.set(e.pointerId, n); el.setPointerCapture?.(e.pointerId); setInputDevice('pointer'); noteOn(n);
});
const up = e => { const n = pointerNotes.get(e.pointerId); if (n != null) { pointerNotes.delete(e.pointerId); noteOff(n); } };
kbd.addEventListener('pointerup', up); kbd.addEventListener('pointercancel', up);

const KEYMAP_OFFSETS = { a:0, w:1, s:2, e:3, d:4, f:5, t:6, g:7, y:8, h:9, u:10, j:11, k:12, o:13, l:14, p:15, ';':16 };
const down = new Map(); // key → the note it started
let spaceTapTimer = null;
window.addEventListener('keydown', e => {
  if (!appReady) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tg = e.target;
  if (tg.isContentEditable || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || (tg.tagName === 'INPUT' && tg.type !== 'checkbox' && tg.type !== 'radio')) return;
  
  if (mode === 'ear' && e.key === ' ') {
    e.preventDefault();
    if (!e.repeat) {
      // Space: play again; double Space: next chord.
      if (spaceTapTimer) { clearTimeout(spaceTapTimer); spaceTapTimer = null; nextChord(); }
      else spaceTapTimer = setTimeout(() => { spaceTapTimer = null; playEarTrainingChord(); }, 280);
    }
    return;
  }

  if (e.repeat) return;
  // Songs: Z / X move the computer keys down / up an octave (elsewhere the octave slider does)
  if (mode === 'songs' && (e.key === 'z' || e.key === 'x')) { songApp.shiftQwerty(e.key === 'z' ? -1 : 1); return; }
  const off = KEYMAP_OFFSETS[e.key.toLowerCase()]; if (off == null || down.has(e.key)) return;
  // remember the note, so the key-up ends the same one even if the octave moved in between
  const n = (mode === 'songs' ? songApp.qwertyAnchor() : currentAnchor) + off;
  down.set(e.key, n); setInputDevice('qwerty'); noteOn(n);
});
window.addEventListener('keyup', e => {
  if (!appReady) return;
  const n = down.get(e.key); if (n == null) return;
  down.delete(e.key); noteOff(n);
});


// Playable keyboard (touch only): bigger keys, scrolled so the target notes are in view.
function scrollKeyboardToTarget() {
  if (!document.body.classList.contains('playable-kbd')) return;
  const el = kbd.querySelector('.k.tgt'); if (!el) return;
  const wrap = $('kbd-wrap');
  wrap.scrollLeft = el.offsetLeft - wrap.clientWidth / 2 + el.offsetWidth * 2;
}
function setPlayableKeyboard(on) {
  document.body.classList.toggle("playable-kbd", on);
  try { localStorage.setItem("fullKbd", on ? "" : "1"); } catch {}
  buildKeys(); drawTarget(); updatePressedKeysDisplay();
}
$('playable-kbd-row').hidden = !IS_TOUCH;
if (IS_TOUCH) {
  // Touch devices start with big playable keys; "Full keyboard" switches back to the compact full view.
  let full = false;
  try { full = localStorage.getItem("fullKbd") === "1"; } catch {}
  $("opt-full-kbd").checked = full;
  if (!full) document.body.classList.add("playable-kbd");
  $("opt-full-kbd").addEventListener("change", e => setPlayableKeyboard(!e.target.checked));
}

// Touch: the keys block swipe-scrolling (so playing works), so a slider under the keyboard scrolls it instead.
const kbdScroll = $('kbd-scroll'), kbdWrapEl = $('kbd-wrap');
function updateKbdScroll() {
  const range = kbdWrapEl.scrollWidth - kbdWrapEl.clientWidth;
  kbdScroll.hidden = !(IS_TOUCH && document.body.classList.contains('playable-kbd') && range > 0) || kbdWrapEl.hidden;
  if (!kbdScroll.hidden) kbdScroll.value = String(Math.round(kbdWrapEl.scrollLeft / range * 1000));
}
kbdScroll.addEventListener('input', () => {
  kbdWrapEl.scrollLeft = +kbdScroll.value / 1000 * (kbdWrapEl.scrollWidth - kbdWrapEl.clientWidth);
});
kbdWrapEl.addEventListener('scroll', updateKbdScroll, { passive: true });
window.addEventListener('resize', updateKbdScroll);
