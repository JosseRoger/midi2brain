'use strict';
// ---------- Songs tab (the song trainer, merged in from "midi2brain songs") ----------
// Everything lives inside songApp so its names don't clash with the chord trainer's globals (held, buildKeys,
// keyEls, setMode…). Element ids are prefixed song-. Notes come in through noteOn in trainer.js (MIDI, and the
// computer keys too), which forwards here while the Songs tab is open. Songs come from SONGS (js/songformat.js,
// filled by songs/*.js). Sub-views: library (song cards), practice (falling notes + keys), guide.
const songApp = (() => {
  const noteName = n => NAMES[n % 12] + (Math.floor(n / 12) - 1); // 60 → C4
  const isBlack = n => [1, 3, 6, 8, 10].includes(n % 12);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const songsOpen = () => mode === 'songs';
  const practiceOpen = () => songsOpen() && !$('song-practice-view').hidden;

  // ---------- keyboard display ----------
  // Built to the song's range (whole octaves, C to B). The keys just show what to play (.tgt + .rh / .lh), what is
  // held (.on) and what was played right (.done).
  let LOW = 48, HIGH = 83;
  const kbd = $('song-kbd');
  let keyEls = {};

  function buildKeys(low, high) {
    LOW = low - (low % 12);          // down to a C
    HIGH = high + (11 - (high % 12)); // up to a B
    kbd.innerHTML = '';
    keyEls = {};
    const whites = []; for (let n = LOW; n <= HIGH; n++) if (!isBlack(n)) whites.push(n);
    kbd.style.minWidth = whites.length * 20 + 'px';
    const w = 100 / whites.length;
    whites.forEach((n, i) => {
      const el = document.createElement('div');
      el.className = 'k w'; el.style.left = (i * w) + '%'; el.style.width = w + '%';
      el.dataset.n = n;
      el.innerHTML = (n % 12 === 0 ? `<span class="c-label">${noteName(n)}</span>` : '') + '<span class="finger"></span>';
      kbd.appendChild(el); keyEls[n] = el;
    });
    for (let n = LOW; n <= HIGH; n++) if (isBlack(n)) {
      const idx = whites.filter(x => x < n).length;
      const el = document.createElement('div');
      el.className = 'k b'; el.style.width = (w * 0.6) + '%'; el.style.left = (idx * w - w * 0.3) + '%';
      el.dataset.n = n; el.innerHTML = '<span class="finger"></span>'; kbd.appendChild(el); keyEls[n] = el;
    }
  }

  // Touch / mouse: the keys play like the trainer keyboard's (js/keyboard.js), through noteOn / noteOff in
  // js/trainer.js (window.*: songApp's own noteOn shadows it). One note per pointer, so several fingers make a chord.
  const pointerNotes = new Map();
  kbd.addEventListener('pointerdown', e => {
    const el = e.target.closest('.k'); if (!el || e.button > 0) return;
    e.preventDefault();
    const n = +el.dataset.n;
    pointerNotes.set(e.pointerId, n); el.setPointerCapture?.(e.pointerId);
    setInputDevice('pointer'); window.noteOn(n);
  });
  const pointerUp = e => { const n = pointerNotes.get(e.pointerId); if (n != null) { pointerNotes.delete(e.pointerId); window.noteOff(n); } };
  kbd.addEventListener('pointerup', pointerUp); kbd.addEventListener('pointercancel', pointerUp);

  // Computer keys (js/keyboard.js asks qwertyAnchor for the note under A): the C of the hand you practise (C4 for
  // the right hand or both, C3 for the left), kept inside the song's keyboard. Z / X move it an octave.
  let qwertyShift = 0;
  function qwertyAnchor() {
    const base = P.hands.has('rh') ? 60 : 48;
    let a = base + qwertyShift * 12;
    while (a + 16 > HIGH && a - 12 >= LOW) a -= 12; // A … ; spans 17 keys
    while (a < LOW) a += 12;
    qwertyShift = (a - base) / 12;
    return a;
  }

  // Horizontal centre and width of a key as a fraction of the keyboard (the falling notes line up with these).
  function keySpan(n) {
    const el = keyEls[n];
    if (!el) return null;
    return { x: parseFloat(el.style.left) / 100, w: parseFloat(el.style.width) / 100, black: isBlack(n) };
  }

  // targets: Map midi → note (what to play now); other: the same for the hand you are not practising. The badge on a
  // key shows the finger (js/fingering.js) when Fingering is on, else the note name (if that is on).
  function drawKeys(targets, other) {
    const names = $('song-opt-key-names').checked, fingers = $('song-opt-fingers').checked;
    Object.entries(keyEls).forEach(([n, el]) => {
      n = +n;
      const note = targets.get(n) || other.get(n), hand = note && note.hand;
      el.classList.toggle('tgt', !!hand);
      el.classList.toggle('rh', hand === 'rh');
      el.classList.toggle('lh', hand === 'lh');
      el.classList.toggle('ghost', !targets.has(n) && other.has(n));
      el.classList.toggle('on', held.has(n) || (P.mode === 'listen' && S.sounding.has(n))); // listen: the played keys go down
      const f = el.querySelector('.finger');
      const label = !note ? '' : fingers && note.finger ? String(note.finger) : names ? NAMES[n % 12] : '';
      f.textContent = label;
      f.hidden = !label;
    });
  }

  // A short flash on a key that was played right.
  function flashDone(n) {
    const el = keyEls[n];
    if (!el) return;
    el.classList.remove('done'); void el.offsetWidth; el.classList.add('done');
    clearTimeout(el._doneTimer);
    el._doneTimer = setTimeout(() => el.classList.remove('done'), 260);
  }

  // ---------- falling notes ----------
  // A canvas above the keyboard (same width, inside #song-kbd-wrap so they scroll together). Notes fall towards the
  // keys and reach them at their start time. Two bars are visible.
  const roll = $('song-roll');
  const rctx = roll.getContext('2d');
  let rollColors = null;

  function readRollColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = name => cs.getPropertyValue(name).trim();
    rollColors = { rh: v('--key-tgt'), lh: v('--glow-2'), ok: v('--ok'), bad: v('--bad'), ink: v('--ink'), muted: v('--muted'), line: v('--line'), lineStrong: v('--line-strong'), bg: v('--bg'), accent: v('--accent'), accentInk: v('--accent-ink') };
  }

  function sizeRoll() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = kbd.offsetWidth, h = roll.offsetHeight;
    roll.style.width = w + 'px';
    if (roll.width !== Math.round(w * dpr) || roll.height !== Math.round(h * dpr)) {
      roll.width = Math.round(w * dpr); roll.height = Math.round(h * dpr);
    }
    rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', () => { sizeRoll(); drawRoll(); });

  // Resizing (desktop): drag the left / right edge of the notes + keys to make them wider (both sides move, so it
  // stays centred), the bottom edge to make them taller. Double-click an edge to reset. Saved as songs-kbd-size.
  const kbdFrame = $('song-kbd-frame');
  let kbdSize = { w: null, h: 1 }; // w in px (null = fit the column), h = height factor
  function setKbdSizeVars() {
    if (kbdSize.w) kbdFrame.style.setProperty('--song-kbd-w', kbdSize.w + 'px'); else kbdFrame.style.removeProperty('--song-kbd-w');
    kbdFrame.style.setProperty('--song-kbd-h', kbdSize.h);
  }
  const saveKbdSize = () => { try { localStorage.setItem('songs-kbd-size', JSON.stringify(kbdSize)); } catch { /* ignore */ } };
  try { Object.assign(kbdSize, JSON.parse(localStorage.getItem('songs-kbd-size')) || {}); } catch { /* ignore */ }
  setKbdSizeVars();
  kbdFrame.querySelectorAll('.song-resize').forEach(handle => {
    const edge = handle.dataset.edge;
    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      handle.classList.add('dragging'); document.body.classList.add('song-resizing');
      const startX = e.clientX, startY = e.clientY;
      const startW = kbdFrame.offsetWidth, startH = kbdSize.h, baseH = roll.offsetHeight + kbd.offsetHeight;
      const move = ev => {
        if (edge === 'top' || edge === 'bottom') {
          const dy = (ev.clientY - startY) * (edge === 'top' ? -1 : 1);
          kbdSize.h = Math.min(2.5, Math.max(0.6, startH * (baseH + dy) / baseH));
        } else {
          const dx = (ev.clientX - startX) * (edge === 'left' ? -1 : 1);
          kbdSize.w = Math.round(Math.min(window.innerWidth - 32, Math.max(320, startW + dx * 2))); // both sides move
        }
        const oldH = kbdFrame.offsetHeight;
        setKbdSizeVars(); sizeRoll(); drawRoll();
        // the frame grows downwards; from the top, scroll with it so the top edge follows the pointer instead
        if (edge === 'top') window.scrollBy(0, kbdFrame.offsetHeight - oldH);
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.classList.remove('dragging'); document.body.classList.remove('song-resizing');
        saveKbdSize();
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up, { once: true });
      handle.addEventListener('pointercancel', up, { once: true });
    });
    handle.addEventListener('dblclick', () => {
      if (edge === 'top' || edge === 'bottom') kbdSize.h = 1; else kbdSize.w = null;
      setKbdSizeVars(); sizeRoll(); drawRoll(); saveKbdSize();
    });
  });

  // Scrubbing: drag the falling notes up / down (or scroll the wheel over them) to move through the song and pick a
  // spot to start. The notes move with the pointer like a page; the song pauses, and on letting go the position
  // snaps to the nearest beat. Leaving the loop's range turns the loop off (not in the practice routine: you look
  // around for context, and the first note you play takes you back to the start of its bars).
  function scrubTo(beat) {
    if (!P.song) return;
    pause(); stopPreview(); glide = null;
    beat = Math.max(0, Math.min(P.song.length - 1, beat));
    if (P.loop && !P.guide && (beat < P.loop.start - 1e-6 || beat >= P.loop.end - 1e-6)) clearLoop();
    seek(beat);
  }
  const outsideLoop = () => P.loop && (P.beat < P.loop.start - 1e-6 || P.beat >= P.loop.end - 1e-6);

  // Gliding (practice routine, and restarting): a jump to another spot slides the falling notes there instead of cutting, forwards
  // to the next part, back to the start for another try. Only the view moves; the clock is already there.
  let glide = null; // { off: beats the view still lags behind, t0, dur }
  function startGlide(fromBeat) {
    const off = fromBeat - P.beat, bars = Math.abs(off) / P.song.barLen;
    glide = bars < 0.05 ? null : { off, t0: performance.now(), dur: Math.min(1600, 550 + 260 * bars) };
  }
  function viewOffset() {
    if (!glide) return 0;
    const k = (performance.now() - glide.t0) / glide.dur;
    if (k >= 1) { glide = null; return 0; }
    return glide.off * (k < 0.5 ? 1 - 4 * k * k * k : Math.pow(2 - 2 * k, 3) / 2); // ease in-out
  }
  const beatsPerPixel = () => (P.song.barLen * 2) / roll.offsetHeight;
  let drag = null, wheelSnap = 0;
  roll.addEventListener('pointerdown', e => {
    if (!P.song) return;
    drag = { id: e.pointerId, y: e.clientY, beat: P.beat };
    roll.setPointerCapture(e.pointerId);
    roll.classList.add('scrubbing');
    e.preventDefault();
  });
  roll.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    scrubTo(drag.beat + (e.clientY - drag.y) * beatsPerPixel()); // drag down = the notes come down = later
  });
  const endDrag = e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    roll.classList.remove('scrubbing');
    scrubTo(Math.round(P.beat / P.song.beat) * P.song.beat);
  };
  roll.addEventListener('pointerup', endDrag);
  roll.addEventListener('pointercancel', endDrag);
  roll.addEventListener('wheel', e => {
    if (!P.song) return;
    e.preventDefault();
    const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? roll.offsetHeight : 1);
    scrubTo(P.beat - px * beatsPerPixel()); // like a page: the notes move up as the wheel goes down
    clearTimeout(wheelSnap);
    wheelSnap = setTimeout(() => scrubTo(Math.round(P.beat / P.song.beat) * P.song.beat), 180);
  }, { passive: false });

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    rctx.beginPath();
    rctx.moveTo(x + r, y);
    rctx.arcTo(x + w, y, x + w, y + h, r);
    rctx.arcTo(x + w, y + h, x, y + h, r);
    rctx.arcTo(x, y + h, x, y, r);
    rctx.arcTo(x, y, x + w, y, r);
    rctx.closePath();
  }

  function drawRoll() {
    if (!P.song || roll.offsetParent === null) return;
    readRollColors();
    const W = kbd.offsetWidth, H = roll.offsetHeight;
    if (Math.abs(parseFloat(roll.style.width) - W) > 0.5) sizeRoll();
    const song = P.song, beat = P.beat + viewOffset();
    const span = song.barLen * 2;            // beats visible
    const ppb = H / span;                     // pixels per beat
    const y = b => H - (b - beat) * ppb;      // song time → canvas y (the keys are at the bottom, y = H)
    rctx.clearRect(0, 0, W, H);

    // octave lanes: a faint line at every C
    rctx.fillStyle = rollColors.line;
    for (let n = LOW; n <= HIGH; n++) if (n % 12 === 0) { const s = keySpan(n); rctx.fillRect(s.x * W, 0, 1, H); }

    // bar and beat lines with bar numbers
    const first = Math.max(0, Math.floor(beat)), last = Math.ceil(beat + span);
    rctx.font = '700 11px "Bricolage Grotesque", system-ui, sans-serif';
    rctx.textBaseline = 'bottom';
    for (let b = first; b <= last && b <= song.length; b++) {
      const yy = Math.round(y(b)) + 0.5;
      const isBar = Math.abs(b % song.barLen) < 1e-6;
      rctx.globalAlpha = isBar ? 0.55 : 0.18;
      rctx.fillStyle = isBar ? rollColors.lineStrong : rollColors.line;
      rctx.fillRect(0, yy, W, 1);
      if (isBar) {
        const n = b / song.barLen + 1;
        const bar = song.bars[n - 1];
        if (bar) {
          rctx.globalAlpha = 0.8; rctx.fillStyle = rollColors.muted;
          rctx.fillText(`${n}${barChord(bar) ? '  ' + barChord(bar) : ''}`, 6, yy - 3);
        }
      }
    }
    rctx.globalAlpha = 1;
    if (P.loop) {
      rctx.fillStyle = rollColors.bg;
      rctx.globalAlpha = 0.45;
      const top = y(P.loop.end), bottom = y(P.loop.start);
      if (top > 0) rctx.fillRect(0, 0, W, Math.min(H, top));
      if (bottom < H) rctx.fillRect(0, Math.max(0, bottom), W, H - Math.max(0, bottom));
      rctx.globalAlpha = 1;
    }

    // notes
    const names = $('song-opt-roll-names').checked, fingers = $('song-opt-fingers').checked;
    rctx.textAlign = 'center'; rctx.textBaseline = 'middle';
    song.notes.forEach(note => {
      if (note.start > beat + span || note.start + note.dur < beat - 0.05) return;
      const practised = P.hands.has(note.hand);
      if (!practised && !P.showOther) return;
      const s = keySpan(note.midi); if (!s) return;
      const x = s.x * W + 1.5, w = s.w * W - 3;
      const top = y(note.start + note.dur) + 1, bottom = y(note.start) - 1;
      const st = P.noteState.get(note);
      const colour = st === 'hit' ? rollColors.ok : st === 'miss' ? rollColors.bad : rollColors[note.hand];
      roundRect(x, top, w, Math.max(4, bottom - top), Math.min(6, w / 3));
      if (practised) {
        rctx.globalAlpha = st === 'hit' ? 0.55 : 0.92;
        rctx.fillStyle = colour; rctx.fill();
      } else {
        rctx.globalAlpha = 0.5;
        rctx.strokeStyle = colour; rctx.lineWidth = 1.5; rctx.stroke();
      }
      rctx.globalAlpha = 1;
      // labels at the bottom of the note: the finger (bigger), and the note name above it if there is room
      const h = bottom - top, showFinger = fingers && note.finger;
      if (w > 10 && h > 14 && (showFinger || names)) {
        rctx.fillStyle = practised ? rollColors.bg : rollColors.ink;
        let yy = bottom - 9;
        if (showFinger) {
          rctx.font = `800 ${Math.min(13, w * 0.62)}px "Bricolage Grotesque", system-ui, sans-serif`;
          rctx.fillText(String(note.finger), x + w / 2, yy);
          yy -= 13;
        }
        if (names && (!showFinger || h > 30)) {
          rctx.globalAlpha = showFinger ? 0.7 : 1;
          rctx.font = `700 ${Math.min(showFinger ? 10 : 12, w * 0.5)}px "Bricolage Grotesque", system-ui, sans-serif`;
          rctx.fillText(NAMES[note.midi % 12], x + w / 2, yy);
          rctx.globalAlpha = 1;
        }
      }
    });

    // the right notes played this take (P.playedMarks): a green outline when on time, red when early / late (unless
    // the early / late notes are switched off)
    const lateMarks = $('song-opt-late-marks').checked;
    if (P.mode !== 'listen') P.playedMarks.forEach(m => {
      if (m.t > beat + span || m.t + m.dur < beat - 0.05 || (!m.ok && !lateMarks)) return;
      const s = keySpan(m.got); if (!s) return;
      const x = s.x * W + 1.5, w = s.w * W - 3;
      const top = y(m.t + m.dur) + 1, bottom = y(m.t) - 1;
      roundRect(x, top, w, Math.max(4, bottom - top), Math.min(6, w / 3));
      rctx.globalAlpha = 0.95;
      rctx.strokeStyle = m.ok ? rollColors.ok : rollColors.bad; rctx.lineWidth = 2; rctx.stroke();
      rctx.globalAlpha = 1;
    });

    // the wrong / extra notes played, drawn like the other hand's notes but with a red outline: free mode's saved
    // mistakes, or in wait / play along the keys of this take that were not a hit (P.extraMarks)
    (P.mode === 'free' ? P.mistakes : P.extraMarks).forEach(m => {
      if (m.got == null || m.t == null || m.t > beat + span || m.t + m.dur < beat - 0.05) return;
      const s = keySpan(m.got); if (!s) return;
      const x = s.x * W + 1.5, w = s.w * W - 3;
      const top = y(m.t + m.dur) + 1, bottom = y(m.t) - 1;
      roundRect(x, top, w, Math.max(4, bottom - top), Math.min(6, w / 3));
      rctx.globalAlpha = 0.85;
      rctx.strokeStyle = rollColors.bad; rctx.lineWidth = 1.5; rctx.stroke();
      rctx.globalAlpha = 1;
      if (names && w > 10 && bottom - top > 14) {
        rctx.fillStyle = rollColors.bad;
        rctx.font = `700 ${Math.min(12, w * 0.5)}px "Bricolage Grotesque", system-ui, sans-serif`;
        rctx.fillText(NAMES[m.got % 12], x + w / 2, bottom - 9);
      }
    });

    if (P.loop) drawLoopMarks(W, H, y);

    // the "now" line just above the keys
    rctx.fillStyle = rollColors.ink; rctx.globalAlpha = 0.6;
    rctx.fillRect(0, H - 2, W, 2);
    rctx.globalAlpha = 1;
  }

  // The bars being practised (the loop): a line where they start and end, each with a tag on the right, and while
  // they are scrolled out of view a tag at the edge pointing to them, so after looking around you find the start.
  function drawLoopMarks(W, H, y) {
    const { from, to } = P.loop, top = y(P.loop.end), bottom = y(P.loop.start);
    const bars = from === to ? `bar ${from}` : `bars ${from}–${to}`;
    rctx.font = '800 11px "Bricolage Grotesque", system-ui, sans-serif';
    rctx.textBaseline = 'middle'; rctx.textAlign = 'center';
    const tag = (text, yy, solid) => {
      const w = rctx.measureText(text).width + 16, x = W - w - 6;
      yy = Math.max(11, Math.min(H - 13, yy));
      roundRect(x, yy - 9, w, 18, 9);
      rctx.globalAlpha = solid ? 0.95 : 0.85;
      if (solid) { rctx.fillStyle = rollColors.accent; rctx.fill(); }
      else { rctx.fillStyle = rollColors.bg; rctx.fill(); rctx.strokeStyle = rollColors.accent; rctx.lineWidth = 1.5; rctx.stroke(); }
      rctx.globalAlpha = 1;
      rctx.fillStyle = solid ? rollColors.accentInk : rollColors.accent;
      rctx.fillText(text, x + w / 2, yy + 0.5);
    };
    const line = yy => { rctx.globalAlpha = 0.9; rctx.fillStyle = rollColors.accent; rctx.fillRect(0, Math.round(yy) - 1, W, 2); rctx.globalAlpha = 1; };
    const back = P.guide && outsideLoop() ? ' · play to go back' : ''; // (not while gliding there)
    if (bottom < 0) tag(`▲ ${bars}${back}`, 0, true);   // all of it later (higher up): scrolled back
    else if (top > H) tag(`▼ ${bars}${back}`, H, true); // all of it earlier: scrolled on
    else {
      if (top >= 0) { line(top); tag(`end of ${bars}`, top - 12, false); }
      if (bottom <= H) { line(bottom); tag(`start · ${bars}`, bottom - 12, true); }
    }
    rctx.textAlign = 'center';
  }

  // ---------- practice engine ----------
  // One clock (P.beat, in quarter notes) runs at the song's tempo × speed. Modes:
  // - wait:  the clock stops at each group of notes you have to play ("step") until you have played all of them;
  // - play:  the clock keeps going; notes played within HIT_WINDOW seconds of their time count, the rest are missed;
  // - listen: the app plays the whole song (both hands) while the notes fall; nothing is graded;
  // - free:  like wait, but it never holds you up: each group of notes you play moves the song on, right or wrong
  //          (as many notes as the step has; a note of the next step skips ahead). Not graded, no red flashes: the
  //          wrong, missed and extra notes are written down (P.mistakes, saved per song); the wrong / extra ones are drawn
  //          on the falling notes with a red outline.
  // Every bar you get through is graded (wrong + missed notes) into its progress fill, saved per song and per hand
  // choice. A clean bar flashes #song-stage green, a wrong note red (js/ambient.js watches it like #stage).
  const HIT_WINDOW = 0.3;    // seconds either side of a note's time (play mode)
  const EARLY_WAIT = 1.5;    // beats: in wait mode the next step may be played this early

  const P = {
    song: null, beat: 0, playing: false, mode: 'wait',
    hands: new Set(['rh']), handKey: 'rh', showOther: true, speed: 0.7,
    loop: null,                // { from, to, start, end } in bars / beats
    steps: [], stepIdx: 0,     // practised notes grouped by start time
    noteState: new Map(),      // note → 'hit' | 'miss'
    barStats: new Map(),       // bar number → { wrong, miss }
    nextGrade: 1,              // the next bar to grade
    lastStep: null, mastery: {}, flashTimer: 0,
    stepWrong: new Map(),      // free mode: step → wrong notes played in it
    mistakes: [],              // free mode: { bar, hand: handKey, kind: 'wrong' | 'missed' | 'extra', want, got, t, dur }
    extraMarks: [],            // wait / play along: { got, t, dur } the keys played that were not a hit, this take
    playedMarks: [],           // wait / play along / free: { got, t, dur, ok } the right notes played this take, ok = on time
    guide: false,              // set up by the practice routine: jumps glide, scrolling keeps the loop
  };
  const follows = () => P.mode === 'wait' || P.mode === 'free';
  let routineHook = null;      // the practice routine (js/routine.js): told about loop passes and finished takes // the clock holds at each step until it is played

  // ---------- sound ----------
  // Backing: the app plays song notes as the clock passes them ('other' = the hand you are not practising, 'all' =
  // every note). In wait mode the clock holds at each step, so the backing waits with you and sounds together with
  // the notes you play. Metronome: a click on every beat (accent on beat 1), count-in included. Hear bar: plays the
  // current bar once (both hands) at the chosen speed, without moving the song or grading. Listen mode plays every
  // note whatever the backing choice. Sound: the sampled piano (startSampledPiano) or the app synth (startSynthNote,
  // palette sound), both in js/audio.js, through the master volume. Backing voices have their own keys (song:<n>), so
  // they never cut off the keys you hold. Loudness follows the bar's dynamics. Your own keys sound if "Sound on my
  // keys" is on (and the app's piano sound switch), in the same sound, with your key velocity.
  const DYN_VEL = { pp: 0.35, p: 0.48, mp: 0.6, mf: 0.72, f: 0.85, ff: 0.97 };
  const S = { sound: 'piano', backing: 'other', metronome: false, ownKeys: true, last: 0, minStart: 0, sounding: new Map(), preview: null }; // minStart: no notes from before here (the count-in bar is silent)
  const voiceKey = n => 'song:' + n;

  function audioReady() {
    initAudio();
    if (!audioCtx) return false;
    if (audioCtx.state !== 'running') { audioCtx.resume().catch(() => {}); return false; }
    return true;
  }
  function voiceOn(note, scale) {
    if (!audioReady()) return;
    const bar = P.song.bars[note.bar - 1];
    const vel = (DYN_VEL[bar && bar.dyn] || DYN_VEL.mf) * scale;
    startVoice(note.midi, vel, voiceKey(note.midi));
  }
  function startVoice(midi, vel, key) {
    stopPianoNote(key, true);
    if (S.sound === 'sampled') startSampledPiano(midi, audioCtx.currentTime, vel, key);
    else startSynthNote(midi, 440 * Math.pow(2, (midi - 69) / 12), audioCtx.currentTime, vel, key);
  }
  function stopVoices(sounding) {
    sounding.forEach((end, midi) => stopPianoNote(voiceKey(midi)));
    sounding.clear();
  }
  // A touch of pedal when the app plays the song by itself (Listen, Hear bar, the library extract): a note rings on
  // for up to RING_SECONDS after it ends, but never past the end of its bar, so runs stay clear and the harmony
  // changes cleanly. bps: beats per second at the speed it is playing.
  const RING_SECONDS = 0.7;
  const ringEnd = (song, n, bps) => {
    const end = n.start + n.dur, bar = song.bars[n.bar - 1];
    return Math.max(end, Math.min(bar ? bar.end : end, end + RING_SECONDS * bps));
  };
  // Song time moved from `from` to `to`: release the notes that have ended, start the wanted ones that begin in
  // [from, to). sounding: Map midi → end beat. ring: let the notes ring on a little (ringEnd).
  function voicesStep(from, to, wants, sounding, ring = false) {
    sounding.forEach((end, midi) => { if (to >= end - 1e-6) { stopPianoNote(voiceKey(midi)); sounding.delete(midi); } });
    if (to <= from) return;
    P.song.notes.forEach(n => {
      if (n.start >= from - 1e-6 && n.start < to - 1e-6 && wants(n)) {
        voiceOn(n, P.hands.has(n.hand) ? 1 : 0.85); // the backing hand a little softer
        sounding.set(n.midi, ring ? ringEnd(P.song, n, beatsPerSecond()) : n.start + n.dur);
      }
    });
  }
  function click(accent) {
    if (!audioReady()) return;
    const t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = accent ? 1760 : 1320;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.32 : 0.2, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(dryGainNode || audioCtx.destination); // dry: no reverb tail on the click
    o.start(t); o.stop(t + 0.08);
  }
  const backingWants = n => n.start >= S.minStart - 1e-6 && (P.mode === 'listen' || S.backing === 'all' || (S.backing === 'other' && !P.hands.has(n.hand)));
  // Called every frame while the song plays, after the clock has moved.
  function soundStep() {
    const from = S.last, to = P.beat;
    S.last = to;
    voicesStep(from, to, backingWants, S.sounding, P.mode === 'listen');
    if (S.metronome && to > from) {
      const step = P.song.beat; // one click per felt beat (a dotted quarter in 6/8, 12/8…)
      for (let b = Math.ceil(from / step - 1e-6) * step; b < to - 1e-6; b += step) {
        const inBar = ((b % P.song.barLen) + P.song.barLen) % P.song.barLen;
        click(Math.abs(inBar) < 1e-6);
      }
    }
  }
  function resetSound() {
    S.last = P.beat;
    S.minStart = P.beat;
    stopVoices(S.sounding);
  }

  function hearBar() {
    if (!P.song) return;
    pause();
    stopPreview();
    const start = barStartOf(P.beat);
    S.preview = { beat: start, last: start, end: start + P.song.barLen, sounding: new Map() };
    $('song-btn-hear').setAttribute('aria-pressed', 'true');
  }
  function previewStep(dt) {
    const pv = S.preview;
    pv.beat = Math.min(pv.end, pv.beat + dt * beatsPerSecond());
    voicesStep(pv.last, pv.beat, () => true, pv.sounding, true);
    pv.last = pv.beat;
    if (pv.beat >= pv.end) stopPreview();
  }
  function stopPreview() {
    if (!S.preview) return;
    stopVoices(S.preview.sounding);
    S.preview = null;
    $('song-btn-hear').setAttribute('aria-pressed', 'false');
  }

  // ---------- chord names ----------
  // Each bar is named by its harmony: the bar's `chord` from the song file, or else the chord its notes spell (both
  // hands, notes held into the bar included), using the chord detector's types (js/detector.js) plus the power chord.
  // Nothing fits exactly → the smallest chord that contains all the notes, rooted on the bass if possible; the bass
  // goes after a slash when it is not the root. A bar with one pitch class is named by that note. Worked out once per
  // song (bar.auto: root / sfx / bass) and named at display time, so solfège names follow the setting.
  const POWER_CHORD = { sfx: '5', iv: [0, 7] };
  function detectBarChord(song, bar) {
    const ns = song.notes.filter(n => n.start < bar.end - 1e-6 && n.start + n.dur > bar.start + 1e-6);
    if (!ns.length) return null;
    const pcs = [...new Set(ns.map(n => n.midi % 12))];
    const bass = Math.min(...ns.map(n => n.midi)) % 12;
    if (pcs.length === 1) return { root: pcs[0], sfx: '', bass: pcs[0], single: true };
    let best = null;
    [POWER_CHORD, ...DETECTOR_TYPES].forEach((type, ti) => {
      for (let root = 0; root < 12; root++) {
        const tones = new Set(type.iv.map(i => (root + i) % 12));
        if (!pcs.every(p => tones.has(p))) continue;
        const score = (tones.size - pcs.length) * 10 + (root === bass ? 0 : 3) + ti * 0.01;
        if (!best || score < best.score) best = { root, sfx: type.sfx, bass: tones.has(bass) ? bass : root, score };
      }
    });
    return best;
  }
  const barChord = bar => {
    if (!bar) return '';
    if (bar.chord) return bar.chord;
    const c = bar.auto;
    return !c ? '' : NAMES[c.root] + c.sfx + (c.bass !== c.root ? '/' + NAMES[c.bass] : '');
  };

  // ---------- mastery (saved) ----------
  const masteryKey = id => 'songs-mastery-' + id;
  function loadMastery(song) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(masteryKey(song.id))) || {}; } catch { /* storage unavailable */ }
    ['rh', 'lh', 'both'].forEach(k => { if (!Array.isArray(saved[k])) saved[k] = new Array(song.bars.length).fill(0); });
    return saved;
  }
  function saveMastery() {
    try { localStorage.setItem(masteryKey(P.song.id), JSON.stringify(P.mastery)); } catch { /* ignore */ }
  }
  // Overall progress of a song for the library: the average fill of its bars.
  function songProgress(song) {
    const m = loadMastery(song);
    const avg = a => a.reduce((s, x) => s + x, 0) / (a.length * MAX_PROGRESS);
    return { rh: avg(m.rh), lh: avg(m.lh), both: avg(m.both) };
  }

  // ---------- loading + settings ----------
  function loadSong(song, remember = true) { // remember: as the last song (not one the routine opens)
    P.song = song;
    song.bars.forEach(b => { if (!b.chord && b.auto === undefined) b.auto = detectBarChord(song, b); });
    P.mastery = loadMastery(song);
    loadMistakes(song);
    hideReport(); // the report was for the other song
    P.extraMarks = []; P.playedMarks = [];
    P.guide = false; P.timingBias = 0; glide = null; // a song picked by hand is not the routine's (routineSetup sets them again)
    buildKeys(song.low, song.high);
    buildLoopSelects();
    renderSections();
    renderBarPool();
    renderMistakes();
    P.loop = null; $('song-opt-loop').checked = false;
    rebuildSteps();
    seek(0);
    renderBeatDots();
    requestAnimationFrame(() => { sizeRoll(); drawRoll(); });
    if (remember) try { localStorage.setItem('songs-last', song.id); } catch { /* ignore */ }
  }

  function rebuildSteps() {
    const steps = [];
    P.song.notes.forEach(n => {
      if (!P.hands.has(n.hand)) return;
      const last = steps[steps.length - 1];
      if (last && Math.abs(last.t - n.start) < 1e-6) last.notes.push(n);
      else steps.push({ t: n.start, notes: [n] });
    });
    P.steps = steps;
  }

  function setHands(key) {
    P.handKey = key;
    P.hands = new Set(key === 'both' ? ['rh', 'lh'] : [key]);
    rebuildSteps();
    seek(P.loop ? P.loop.start : barStartOf(P.beat));
    renderBarPool();
  }
  function setPlayMode(m) {
    P.mode = m;
    pause();
    seek(P.loop ? P.loop.start : barStartOf(P.beat));
    renderMistakes();
  }

  // ---------- transport ----------
  const barStartOf = beat => Math.max(0, Math.floor(beat / P.song.barLen + 1e-6)) * P.song.barLen;
  const barAt = beat => Math.min(P.song.bars.length, Math.max(1, Math.floor(beat / P.song.barLen + 1e-6) + 1));
  const beatsPerSecond = () => P.song.tempo / 60 * P.speed;

  // Jump to a time: everything from there on is fresh again.
  function seek(beat) {
    P.beat = beat;
    P.noteState.forEach((v, n) => { if (n.start >= beat - 1e-6) P.noteState.delete(n); });
    P.stepIdx = P.steps.findIndex(s => s.t >= beat - 1e-6);
    if (P.stepIdx < 0) P.stepIdx = P.steps.length;
    P.firstStep = P.stepIdx; // the step a pass / take starts on (routine: slips while finding it do not count)
    P.nextGrade = barAt(beat);
    for (let b = P.nextGrade; b <= P.song.bars.length; b++) P.barStats.delete(b);
    P.lastStep = null;
    P.hold = null;
    P.stepWrong.clear();
    P.ended = false;
    P.countIn = false;
    endTake();
    resetSound();
    updateStage(true);
    drawRoll();
  }

  function play() {
    if (P.playing || !P.song) return;
    stopPreview();
    if (P.ended || P.beat >= P.song.length - 1e-6) { const from = P.beat; seek(P.loop ? P.loop.start : 0); startGlide(from); } // the notes slide back
    P.playing = true;
    // play along / listen: a one-bar count-in when starting at the start of a bar
    if (P.mode === 'free' && P.beat < 1e-6 && !P.loop) clearMistakes(); // a new take from the top
    if (P.mode !== 'listen' && !T) startTake();
    if (!follows() && Math.abs(P.beat - barStartOf(P.beat)) < 1e-6) startCountIn();
    S.last = P.beat; // the first beat (and notes on it) sound on the next frame
    $('song-btn-play').textContent = 'Pause'; $('song-btn-play').setAttribute('aria-pressed', 'true');
    lastFrame = performance.now();
  }
  function startCountIn() {
    P.countInEnd = P.beat;
    S.minStart = P.beat;
    P.beat -= P.song.barLen;
    P.countIn = true;
  }
  function pause() {
    if (!P.playing) return;
    P.playing = false;
    if (P.countIn) P.beat = P.countInEnd; // pausing during a count-in returns to where it was counting in to
    P.countIn = false;
    if (T) T.ref = null; // nothing is timed across a pause
    P.hold = null;
    resetSound();
    $('song-btn-play').textContent = 'Play'; $('song-btn-play').setAttribute('aria-pressed', 'false');
    updateStage(true);
  }
  function restart() {
    pause();
    clearMistakes();
    P.extraMarks = []; P.playedMarks = []; // the red extra notes of wait / play along too
    const from = P.beat;
    seek(P.loop ? P.loop.start : 0); // (redraws)
    startGlide(from); // the falling notes slide back to the start instead of cutting there
    centerRoll();
  }
  // the falling notes and the keys in the middle of the screen
  const centerRoll = () => $('song-kbd-frame').scrollIntoView({ block: 'center', behavior: 'smooth' });

  let lastFrame = performance.now();
  function tick(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (P.song && P.playing) { advance(dt); if (P.playing) soundStep(); }
    if (S.preview) previewStep(dt);
    if (P.song && practiceOpen()) { drawRoll(); updateKeys(); updateStage(); }
    requestAnimationFrame(tick);
  }

  // Wait / free: a bar without a note for the hand(s) you practise is not waited through. From the bar the clock is
  // in, it moves on to the start of the next bar with notes (or the end of the loop / song); the pulse your timing
  // is judged by starts again there. True when it moved.
  function skipEmptyBars() {
    if (!P.song || !follows()) return false;
    const bs = barStartOf(P.beat), step = P.steps[P.stepIdx], end = P.loop ? P.loop.end : P.song.length;
    if (step && step.t < bs + P.song.barLen - 1e-6) return false; // notes still to come in this bar
    const to = step ? Math.min(barStartOf(step.t), end) : end;
    if (to <= P.beat + 1e-6) return false;
    P.beat = to;
    resetSound(); // the other hand's backing of the skipped bars does not all sound at once
    if (T) T.ref = null; // not played yet: the next note starts the pulse again
    return true;
  }

  function advance(dt) {
    const song = P.song;
    const was = P.beat;
    let next = P.beat + dt * beatsPerSecond();
    if (follows()) {
      const step = P.steps[P.stepIdx];
      // free mode: you may play ahead of the clock, which then catches up quickly
      if (P.mode === 'free' && P.lastStep && P.lastStep.t > next) next += (P.lastStep.t - next) * Math.min(1, dt * 8);
      if (step && next >= step.t) { // hold here until the step is played
        // when the clock got there (this frame, less the overshoot): how long it waits is how late you are (markPlayed)
        if (!P.hold || P.hold.step !== step) P.hold = { step, at: performance.now() - (next - step.t) / beatsPerSecond() * 1000 };
        next = step.t;
      }
    } else if (P.mode === 'play') {
      const tol = HIT_WINDOW * beatsPerSecond();
      // notes whose window has passed without being played are missed
      while (P.stepIdx < P.steps.length && P.steps[P.stepIdx].t + tol < next) {
        P.steps[P.stepIdx].notes.forEach(n => {
          if (P.noteState.get(n) !== 'hit') { P.noteState.set(n, 'miss'); stat(n.bar).miss++; }
        });
        P.stepIdx++;
      }
    }
    P.beat = next;
    if (P.countIn && P.beat >= P.countInEnd) P.countIn = false;
    // a new bar with nothing to play: on to the next one with notes, the falling notes sliding there
    if (follows() && barStartOf(P.beat) > barStartOf(was) + 1e-6 && skipEmptyBars()) startGlide(was);

    // grade every bar we have fully passed
    const settle = P.mode === 'play' ? HIT_WINDOW * beatsPerSecond() : 0;
    while (P.nextGrade <= song.bars.length && P.beat >= song.bars[P.nextGrade - 1].end + settle - 1e-6 &&
           (!P.loop || P.nextGrade <= P.loop.to)) {
      gradeBar(P.nextGrade++);
    }

    const end = P.loop ? P.loop.end : song.length;
    if (P.beat >= end + settle - 1e-6 && (!follows() || P.stepIdx >= P.steps.length || P.steps[P.stepIdx].t >= end - 1e-6)) {
      if (P.loop) {
        // the practice routine hears about every pass, and may end the loop there (a section played once), or send
        // you back to its start to wait for you (a pass that was not clean: try again)
        const said = routineHook && routineHook({ type: 'pass', ...loopPass() });
        if (said === 'stop') { finishSong(); return; }
        if (said === 'retry') { backToLoopStart(); return; }
        const from = P.beat;
        seek(P.loop.start); skipEmptyBars(); startTake(); // every pass is a take of its own
        if (P.guide) startGlide(from);
        if (!follows()) startCountIn();
      }
      else finishSong();
    }
  }

  function finishSong() {
    P.playing = false;
    P.ended = true;
    resetSound();
    $('song-btn-play').textContent = 'Play'; $('song-btn-play').setAttribute('aria-pressed', 'false');
    showReport();
    if (routineHook) routineHook({ type: 'take', report: P.report });
    updateStage(true);
    // the report in view (not in a routine, which moves on by itself)
    if (!P.guide && !$('song-report').hidden) $('song-report').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ---------- grading ----------
  function stat(bar) {
    if (!P.barStats.has(bar)) P.barStats.set(bar, { wrong: 0, miss: 0 });
    return P.barStats.get(bar);
  }
  function gradeBar(n) {
    if (P.mode === 'listen' || P.mode === 'free') return;
    const hasNotes = P.song.notes.some(x => x.bar === n && P.hands.has(x.hand));
    if (!hasNotes) return;
    const s = stat(n), errors = s.wrong + s.miss;
    const base = P.mode === 'play' ? (P.speed >= 0.95 ? 3 : 2) : 1;
    const delta = errors === 0 ? base : errors === 1 ? 0 : -Math.min(3, errors - 1);
    const arr = P.mastery[P.handKey];
    const old = arr[n - 1];
    arr[n - 1] = Math.max(0, Math.min(MAX_PROGRESS, old + delta));
    saveMastery();
    const chip = $('song-bar-pool').children[n - 1];
    if (chip) {
      chip.title = `Bar ${n}: ${errors === 0 ? 'clean' : `${s.wrong} wrong, ${s.miss} missed`} (${delta > 0 ? '+' : ''}${delta})`;
      const fill = chip.querySelector('.pool-fill');
      fill.style.height = old / MAX_PROGRESS * 100 + '%';
      fill.classList.toggle('draining', delta < 0);
      void fill.offsetWidth;
      fill.style.height = arr[n - 1] / MAX_PROGRESS * 100 + '%';
      if (delta > 0) { fill.classList.remove('splash'); void fill.offsetWidth; fill.classList.add('splash'); }
      if (delta !== 0) liquidSlosh(fill, delta > 0, Math.abs(delta));
    }
    if (errors === 0) flashStage('ok');
  }
  function flashStage(cls) {
    const st = $('song-stage');
    st.classList.remove('ok', 'bad');
    void st.offsetWidth;
    st.classList.add(cls);
    clearTimeout(P.flashTimer);
    P.flashTimer = setTimeout(() => st.classList.remove(cls), cls === 'ok' ? 420 : 320);
  }

  // ---------- hidden songs ----------
  // The library shows only the songs marked publicDomain in their file. Playing the chords C, E, D (major, any
  // inversion or doubling, each within SECRET_GAP s of the last) anywhere in the Songs tab shows the others too, and
  // again hides them. Remembered (songs-unlocked).
  const SECRET = [[0, 4, 7], [4, 8, 11], [2, 6, 9]].map(pcs => pcs.join(',')); // C, E, D major as pitch-class sets
  const SECRET_GAP = 8000;
  let unlocked = false, revealNew = false; // revealNew: the next library render pops the newly shown cards in
  try { unlocked = localStorage.getItem('songs-unlocked') === '1'; } catch { /* ignore */ }
  const songVisible = song => song.publicDomain || unlocked;
  const secret = { step: 0, at: 0, last: null };
  function checkSecret() {
    const chord = [...new Set([...held].map(m => m % 12))].sort((a, b) => a - b).join(',');
    if (chord === secret.last) return; // still the same chord (another key of it, or a repeat)
    secret.last = chord;
    const now = performance.now();
    if (now - secret.at > SECRET_GAP) secret.step = 0;
    if (chord === SECRET[secret.step]) { secret.step++; secret.at = now; }
    else if (chord === SECRET[0]) { secret.step = 1; secret.at = now; }
    else return; // anything else (part of a chord on the way to it, too) keeps the progress until the gap runs out
    if (secret.step < SECRET.length) return;
    secret.step = 0;
    unlocked = !unlocked;
    try { localStorage.setItem('songs-unlocked', unlocked ? '1' : '0'); } catch { /* ignore */ }
    if (P.song && !songVisible(P.song)) loadSong(SONGS.find(songVisible));
    revealNew = unlocked;
    showView('library'); // renders the library, the new cards popping in
  }

  // ---------- input (from noteOn / noteOff in js/trainer.js, which keep `held` up to date) ----------
  // playSound + velocity come from noteOn (velocity 0..1 from MIDI, null from the computer keys).
  function noteOn(n, playSound = true, velocity = null) {
    if (playSound && S.ownKeys && $('opt-sound').checked && audioReady()) startVoice(n, velocity == null ? 0.7 : velocity, n); // noteOff stops it (key n)
    checkSecret();
    if (!P.song || !practiceOpen() || P.mode === 'listen') return;
    // practice routine, scrolled away from the bars to practise: a note takes you back to their start
    if (P.guide && outsideLoop()) { backToLoopStart(); return; }
    if (!P.playing && skipEmptyBars()) updateStage(true); // standing on a bar with nothing to play: to the notes
    if (P.mode === 'wait') {
      const step = P.steps[P.stepIdx];
      // waiting for your first note (after a jump, a new part, a retry): the next step counts however far it is
      const want = step && (!P.playing || step.t - P.beat <= EARLY_WAIT) && step.notes.find(x => x.midi === n && P.noteState.get(x) !== 'hit');
      if (want) {
        if (!P.playing) { if (step.t - P.beat > EARLY_WAIT) P.beat = step.t; play(); } // just start playing: the song follows (this note sets the pulse)
        P.noteState.set(want, 'hit');
        takeHit(want, step);
        flashDone(n);
        if (step.notes.every(x => P.noteState.get(x) === 'hit')) { P.lastStep = step; P.stepIdx++; }
        return;
      }
      // playing the previous chord again, or a note already done in this step: not a mistake
      if ((P.lastStep && P.lastStep.notes.some(x => x.midi === n)) || (step && step.notes.some(x => x.midi === n))) return;
      if (!P.playing && !step) return;
      wrongNote(n);
    } else if (P.mode === 'play') {
      if (!P.playing) return;
      const tol = HIT_WINDOW * beatsPerSecond();
      const hit = P.song.notes.find(x => x.midi === n && P.hands.has(x.hand) && !P.noteState.has(x) && Math.abs(x.start - P.beat) <= tol);
      if (hit) { P.noteState.set(hit, 'hit'); takeHit(hit); flashDone(n); }
      else wrongNote(n);
    } else if (P.mode === 'free') freeNote(n);
  }
  // Free mode: the note goes to the step being played. A note of the next step (and not of this one) means the rest
  // of this step was skipped. A step is done once it has as many notes as it asks for, right or wrong.
  function freeNote(n) {
    if (!P.playing) { play(); } // first: after the end, play() starts again from the top; this note sets the pulse
    let step = P.steps[P.stepIdx];
    if (!step) return;
    const open = s => s.notes.find(x => x.midi === n && P.noteState.get(x) !== 'hit');
    let want = open(step);
    if (!want) {
      const next = P.steps[P.stepIdx + 1];
      if (next && open(next) && !step.notes.some(x => x.midi === n)) { finishFreeStep(step); step = next; want = open(step); }
    }
    if (want) { P.noteState.set(want, 'hit'); takeHit(want, step); flashDone(n); }
    else if (step.notes.some(x => x.midi === n) || (P.lastStep && P.lastStep.notes.some(x => x.midi === n))) return; // played again: fine
    else { if (!P.stepWrong.has(step)) P.stepWrong.set(step, []); P.stepWrong.get(step).push(n); }
    const hits = step.notes.filter(x => P.noteState.get(x) === 'hit').length;
    if (hits + (P.stepWrong.get(step) || []).length >= step.notes.length) finishFreeStep(step);
  }
  // Write down what went wrong in a step: each wrong note against the nearest note it should have been, then the
  // notes left over (missed) or the wrong ones left over (extra).
  function finishFreeStep(step) {
    const missed = step.notes.filter(x => P.noteState.get(x) !== 'hit');
    const wrong = [...(P.stepWrong.get(step) || [])];
    const bar = step.notes[0].bar, t = step.t, shortest = Math.min(...step.notes.map(x => x.dur));
    const add = (kind, want, got, dur = shortest) => P.mistakes.push({ bar, hand: P.handKey, kind, want, got, t, dur });
    wrong.forEach(got => {
      if (!missed.length) { add('extra', null, got); takeExtra(got, bar); return; }
      const near = missed.reduce((a, b) => (Math.abs(b.midi - got) < Math.abs(a.midi - got) ? b : a));
      missed.splice(missed.indexOf(near), 1);
      add('wrong', near.midi, got, near.dur);
      takeExtra(got, bar, near.midi);
    });
    missed.forEach(x => add('missed', x.midi, null));
    P.stepWrong.delete(step);
    P.lastStep = step;
    P.stepIdx = P.steps.indexOf(step) + 1;
    if (wrong.length || missed.length) { saveMistakes(); renderMistakes(); }
  }

  // ---------- mistakes (free mode) ----------
  // The last take's mistakes, per song (songs-mistakes-<id>): the wrong / extra notes are drawn on the falling notes
  // (drawRoll) and bars with a mistake get a red dot. A new take from the top of the song clears them.
  const mistakesKey = id => 'songs-mistakes-' + id;
  function loadMistakes(song) {
    let m = [];
    try { m = JSON.parse(localStorage.getItem(mistakesKey(song.id))) || []; } catch { /* storage unavailable */ }
    P.mistakes = Array.isArray(m) ? m : [];
  }
  function saveMistakes() {
    try { localStorage.setItem(mistakesKey(P.song.id), JSON.stringify(P.mistakes)); } catch { /* ignore */ }
  }
  function clearMistakes() {
    if (!P.mistakes.length) return;
    P.mistakes = [];
    saveMistakes();
    renderMistakes();
  }
  function renderMistakes() {
    [...$('song-bar-pool').children].forEach((c, i) => c.classList.toggle('has-mistakes', P.mistakes.some(m => m.bar === i + 1)));
    drawRoll();
  }
  const EXTRA_MARK_BEATS = 0.5; // how long an extra note is drawn on the falling notes
  function wrongNote(n) {
    if (P.countIn) return;
    if (P.guide && P.mode === 'wait' && P.stepIdx <= P.firstStep) return; // practice routine: finding the first note is not a slip
    stat(barAt(P.beat)).wrong++;
    P.extraMarks.push({ got: n, t: P.mode === 'play' ? clockNow() : P.beat, dur: EXTRA_MARK_BEATS }); // where it was played
    drawRoll();
    const step = P.steps[P.stepIdx]; // wait mode: the bar of the notes it waits for (the clock may still be behind)
    // the note it was aimed at: wait mode, the closest in pitch of the step's notes still to play; play along, of the
    // notes around the clock (for the practice routine's kinds of mistakes, takeEvents)
    let cands = [];
    if (P.mode === 'wait' && step) cands = step.notes.filter(x => P.noteState.get(x) !== 'hit');
    else if (P.mode === 'play') { const beat = clockNow(); cands = P.song.notes.filter(x => P.hands.has(x.hand) && P.noteState.get(x) !== 'hit' && Math.abs(x.start - beat) <= 1); }
    const aim = cands.sort((x, y) => Math.abs(x.midi - n) - Math.abs(y.midi - n))[0];
    takeExtra(n, P.mode === 'wait' && step ? step.notes[0].bar : barAt(P.beat), null, aim ? { aim: aim.midi, hand: aim.hand, t: aim.start } : {});
    flashStage('bad');
  }
  // Practice routine: back to the start of the loop, the notes gliding there, and wait for your first note (a pass
  // that was not clean: try again). The red notes of the last pass stay until you start (play → startTake).
  function backToLoopStart() {
    const from = P.beat + viewOffset();
    pause();
    seek(P.loop.start);
    skipEmptyBars();
    startGlide(from);
  }

  // ---------- take report ----------
  // A take runs from where you start playing (wait / play along / free) to the end of the song; any jump (seek,
  // hands, mode) starts over, a loop never ends one. Each practised note of it is on time, early, late or missed
  // (free mode: wrong, when another key was played instead), and every other key is an extra note.
  // Timing: in play along, how far the note was from the clock (a note just outside HIT_WINDOW is "too early / late to
  // count": missed, but shown as what it was). In wait / free the clock follows you, so a note is timed against the
  // last note you played on time, at this speed: a steady pulse scores, a hesitation is late. After a long
  // hesitation, or two notes off in a row (you changed pace), the new pace is the reference.
  // Score: on time 1, early / late 1 … 0.6 (by timing strictness), missed / wrong / too early or late 0, out of the
  // notes + the extra notes.
  // The report (#song-report) stays up until the next finished take replaces it, ×, or another song.
  const ON_TIME = 0.15;     // seconds: this close counts as on time
  const GAP_SLACK = 0.25;   // wait / free: or within this share of the time since the reference note…
  const MAX_SLACK = 0.35;   // …up to this
  const HESITATION = 0.6;   // seconds late: a pause in the flow, not a pace change
  const OFF_RANGE = 0.6;    // play along: a key this close to an unplayed note of the same pitch is that note, off time
  let T = null;             // { from, timing: Map note → { dev, tol } (s), onsets: Map step → timing, ref, streak, extras, offs: Map note → dev }
  // ---------- timing strictness ----------
  // How much timing counts: 0 = you are learning these notes, only the notes matter … 1 = you know these bars, timing
  // counts fully. From your progress (mastery) on the bars being played (the loop, else the song) with these hands,
  // plus the practice routine's bias for its stage (P.timingBias). Fixed for a take (T.strict). It sets:
  // - the on-time window: TIMING_LOOSE × ON_TIME / MAX_SLACK at 0 … TIMING_TIGHT × at 1;
  // - the score's credit for an early / late note (1 … 0.6), and how much they make a bar one to work on (0 … ½);
  // - a clean loop pass (loopPass): from ½ on, at most (1 - strictness) × 6 notes off time.
  const TIMING_LOOSE = 2.5, TIMING_TIGHT = 0.8;
  function timingStrictness() {
    if (!P.song) return 0;
    const from = P.loop ? P.loop.from : 1, to = P.loop ? P.loop.to : P.song.bars.length;
    const arr = P.mastery[P.handKey] || [];
    let sum = 0, n = 0;
    for (let b = from; b <= to; b++) if (P.song.notes.some(x => x.bar === b && P.hands.has(x.hand))) { sum += arr[b - 1] || 0; n++; }
    const skill = n ? sum / (n * MAX_PROGRESS) : 0;
    return Math.max(0, Math.min(1, (skill - 0.15) / 0.65 + (P.timingBias || 0)));
  }
  const timingWord = s => s < 0.34 ? 'loosely' : s < 0.67 ? 'a fair bit' : 'strictly';
  const timingScale = strict => TIMING_LOOSE + (TIMING_TIGHT - TIMING_LOOSE) * strict;

  function startTake() {
    T = { strict: timingStrictness(), from: P.beat, timing: new Map(), onsets: new Map(), ref: null, streak: 0, extras: [], offs: new Map() };
    P.extraMarks = []; P.playedMarks = [];
    P.report = null; // the last report stays on screen until this take's replaces it
  }
  function endTake() { T = null; P.report = null; }
  const clockNow = () => P.beat + (performance.now() - lastFrame) / 1000 * beatsPerSecond(); // not just the last frame's
  // Wait / free: the first note of a take (and after a pause / skipped empty bars) is not timed: it sets your pulse,
  // so it is never early or late (nor late for the falling notes having waited at it, markPlayed).
  function takeHit(note, step) {
    if (!T) return;
    const k = timingScale(T.strict);
    if (P.mode === 'play') { T.timing.set(note, { dev: (clockNow() - note.start) / beatsPerSecond(), tol: ON_TIME * k }); markPlayed(note); return; }
    if (!T.onsets.has(step)) { // the first note of a step times it; a chord's other notes share it
      const now = performance.now() / 1000;
      let t = { dev: null, tol: ON_TIME * k };
      const ref = T.ref;
      if (ref && ref.t < step.t) {
        const want = (step.t - ref.t) / beatsPerSecond();
        t = { dev: now - ref.time - want, tol: Math.min(MAX_SLACK * k, Math.max(ON_TIME * k, GAP_SLACK * want)) };
      }
      const off = t.dev !== null && Math.abs(t.dev) > t.tol;
      T.streak = off ? T.streak + 1 : 0;
      if (!off || T.streak >= 2 || t.dev > HESITATION) { T.ref = { t: step.t, time: now }; T.streak = 0; }
      T.onsets.set(step, t);
    }
    T.timing.set(note, T.onsets.get(step));
    markPlayed(note, step);
  }
  // The note just played, for the falling notes: green outline if on time, red if early / late. Play along draws it
  // where you played it on the clock. Wait / free: off your own pulse, or late: the falling notes reached it and
  // stopped more than LATE_WAIT s before you played it; it is then drawn that much later (higher up).
  const LATE_WAIT = ON_TIME;
  function markPlayed(note, step) {
    const t = T.timing.get(note);
    let off = t && t.dev !== null && Math.abs(t.dev) > t.tol, at = note.start;
    if (P.mode === 'play') at = clockNow();
    else if (step && P.hold && P.hold.step === step && t && t.dev !== null) { // the first note sets the pulse: never late
      const waited = (performance.now() - P.hold.at) / 1000;
      if (waited > LATE_WAIT) { off = true; at = note.start + waited * beatsPerSecond(); }
    }
    P.playedMarks.push({ got: note.midi, t: at, dur: note.dur, ok: !off });
  }
  // A key that is not a hit. Play along: the nearest unplayed note of that pitch, if close, played off time.
  // Otherwise an extra note (want: in free mode, the note it was played instead of).
  function takeExtra(midi, bar, want = null, info = {}) {
    if (!T || P.countIn) return;
    if (P.mode === 'play') {
      const beat = clockNow(), range = OFF_RANGE * beatsPerSecond();
      const near = P.song.notes.filter(x => x.midi === midi && P.hands.has(x.hand) && P.noteState.get(x) !== 'hit' && !T.offs.has(x) && Math.abs(x.start - beat) <= range)
        .sort((x, y) => Math.abs(x.start - beat) - Math.abs(y.start - beat))[0];
      if (near) { T.offs.set(near, (beat - near.start) / beatsPerSecond()); return; }
    }
    T.extras.push({ midi, bar, want, ...info });
  }
  // The mistakes of the take so far in bars from..to, for the practice routine to tell their kinds apart
  // (js/routine.js): wrong keys (got, with the note it was aimed at: aim, its hand, its time t), missed notes, and
  // steps off the pulse (early / late by dev s, the window tol s; one per step).
  function takeEvents(from, to) {
    if (!T) return [];
    const inR = bar => bar >= from && bar <= to, ev = [];
    T.extras.forEach(x => { if (inR(x.bar)) ev.push({ type: 'wrong', bar: x.bar, got: x.midi, aim: x.aim ?? x.want, hand: x.hand, t: x.t }); });
    P.noteState.forEach((s, n) => { if (s === 'miss' && inR(n.bar)) ev.push({ type: 'miss', bar: n.bar, aim: n.midi, hand: n.hand, t: n.start }); });
    const seen = new Set();
    T.timing.forEach((t, n) => {
      if (!inR(n.bar) || t.dev === null || Math.abs(t.dev) <= t.tol) return;
      const k = n.start.toFixed(3); // a step's notes share their timing
      if (seen.has(k)) return;
      seen.add(k);
      ev.push({ type: t.dev > 0 ? 'late' : 'early', bar: n.bar, t: n.start, dev: t.dev, tol: t.tol, hand: n.hand });
    });
    return ev;
  }

  // The last take per song and hand (songs-takes-<id>: { rh, lh, both }): the practice routine reads it as the
  // level you play the song at (js/routine.js).
  const takesKey = id => 'songs-takes-' + id;
  function loadTakes(song) {
    try { return JSON.parse(localStorage.getItem(takesKey(song.id))) || {}; } catch { return {}; }
  }
  function saveTake(r) {
    const takes = loadTakes(P.song);
    // slips: the notes not played right (missed, wrong, extra, too far off to count), timing aside
    takes[r.hands] = { score: r.score, speed: r.speed, mode: r.mode, coverage: r.coverage, at: r.at, slips: r.missed + r.wrong + r.extra + r.off, notes: r.notes };
    try { localStorage.setItem(takesKey(P.song.id), JSON.stringify(takes)); } catch { /* ignore */ }
  }

  function hideReport() { $('song-report').hidden = true; }
  function showReport() {
    if (!T) return;
    const end = P.loop ? P.loop.end : Infinity;
    const notes = P.steps.flatMap(s => s.notes).filter(n => n.start >= T.from - 1e-6 && n.start < end - 1e-6);
    if (!notes.length) { T = null; return; }
    const bars = new Map();
    const barOf = b => {
      if (!bars.has(b)) bars.set(b, { missed: [], extra: [], wrong: [], early: 0, late: 0, tooEarly: [], tooLate: [], hand: { rh: 0, lh: 0 } });
      return bars.get(b);
    };
    const c = { onTime: 0, early: 0, late: 0, off: 0, missed: 0, wrong: 0, extra: 0 };
    const devs = [];
    const wrongs = T.extras.filter(x => x.want !== null);
    T.extras.filter(x => x.want === null).forEach(x => { c.extra++; barOf(x.bar).extra.push(x.midi); });
    notes.forEach(n => {
      const b = barOf(n.bar);
      if (P.noteState.get(n) !== 'hit') {
        const w = wrongs.findIndex(x => x.want === n.midi && x.bar === n.bar);
        if (w >= 0) { c.wrong++; b.hand[n.hand]++; b.wrong.push(wrongs.splice(w, 1)[0]); return; }
        if (T.offs.has(n)) {
          const dev = T.offs.get(n);
          devs.push(dev); c.off++; b.hand[n.hand]++;
          if (dev < 0) { c.early++; b.tooEarly.push(n.midi); } else { c.late++; b.tooLate.push(n.midi); }
          return;
        }
        c.missed++; b.hand[n.hand]++; b.missed.push(n.midi);
        return;
      }
      const t = T.timing.get(n);
      if (t && t.dev !== null) devs.push(t.dev);
      if (!t || t.dev === null || Math.abs(t.dev) <= t.tol) c.onTime++;
      else if (t.dev < 0) { c.early++; b.early++; b.hand[n.hand] += 0.5; }
      else { c.late++; b.late++; b.hand[n.hand] += 0.5; }
    });
    const strict = T.strict;
    const score = Math.round(100 * (c.onTime + (1 - 0.4 * strict) * (c.early + c.late - c.off)) / (notes.length + c.extra));
    const all = P.steps.reduce((a, st) => a + st.notes.length, 0);
    const report = { score, strict, ...c, notes: notes.length, hands: P.handKey, mode: P.mode, speed: P.speed, coverage: notes.length / all, at: Date.now(),
      events: takeEvents(1, P.song.bars.length) };
    T = null;
    saveTake(report);

    // rushing or dragging: the middle of the timed notes, when it is clearly off
    devs.sort((a, b) => a - b);
    const mid = devs.length ? devs[devs.length >> 1] : 0;
    const ms = Math.round(Math.abs(mid) * 1000);
    const tendency = devs.length < 4 || ms < 80 ? 'Your timing is steady.'
      : mid < 0 ? `You tend to rush: notes come about ${ms} ms early.` : `You tend to drag: notes come about ${ms} ms late.`;
    const basis = P.mode === 'play' ? 'timed against the clock' : `timed by your own pulse at ${Math.round(P.speed * 100)}% speed`;

    // the bars to work on: most mistakes first (early / late count 0 … ½, by timing strictness)
    const cost = b => b.missed.length + b.extra.length + b.wrong.length + b.tooEarly.length + b.tooLate.length + (b.early + b.late) * strict / 2;
    const names = arr => arr.map(noteName).join(', ');
    // for the practice routine: every bar with a mistake, and how much of it was in each hand (slips: the wrong notes
    // alone, timing aside)
    const slips = b => b.missed.length + b.extra.length + b.wrong.length + b.tooEarly.length + b.tooLate.length;
    report.bars = [...bars.entries()].filter(([, b]) => cost(b) > 0).map(([bar, b]) => ({ bar, cost: cost(b), slips: slips(b), rh: b.hand.rh, lh: b.hand.lh }));
    const worst = [...bars.entries()].filter(([, b]) => cost(b) > 0).sort((a, b) => cost(b[1]) - cost(a[1]) || a[0] - b[0]).slice(0, 6);
    const barLine = b => [
      b.missed.length && `${b.missed.length} missed (${names(b.missed)})`,
      b.wrong.length && `${b.wrong.length} wrong (${b.wrong.map(x => `${noteName(x.midi)} for ${noteName(x.want)}`).join(', ')})`,
      b.extra.length && `${b.extra.length} extra (${names(b.extra)})`,
      b.tooEarly.length && `${b.tooEarly.length} too early to count (${names(b.tooEarly)})`,
      b.tooLate.length && `${b.tooLate.length} too late to count (${names(b.tooLate)})`,
      b.early && `${b.early} early`,
      b.late && `${b.late} late`,
    ].filter(Boolean).join(' · ');

    const verdict = score >= 95 ? 'excellent' : score >= 85 ? 'great take' : score >= 70 ? 'good, keep going' : score >= 50 ? 'getting there' : 'slow it down and try again';
    const modeName = { wait: 'wait for me', play: 'play along', free: 'free play' }[P.mode];
    const stat = (n, label, cls = '') => `<div class="report-stat ${cls}"><b>${n}</b><span>${label}</span></div>`;
    $('song-report-body').innerHTML = `
      <div class="report-score"><b>${score}%</b><span>${esc(verdict)}<br>${esc(`${modeName} · ${HAND_NAMES[P.handKey]} · ${Math.round(P.speed * 100)}%`)}</span></div>
      <div class="report-stats">
        ${stat(c.onTime, 'on time', 'ok')}${stat(c.early, 'early')}${stat(c.late, 'late')}${stat(c.missed, 'missed', c.missed ? 'bad' : '')}${stat(c.wrong + c.extra, P.mode === 'free' ? 'wrong / extra' : 'extra', c.wrong + c.extra ? 'bad' : '')}
      </div>
      <p class="report-note">${esc(tendency)} <span>(${esc(basis)}; ${notes.length} notes)</span></p>
      <p class="report-note">Timing counted ${timingWord(strict)} <span>(${strict < 0.34 ? 'you are still learning these bars: the notes come first'
        : strict < 0.67 ? 'you know these bars better now: keep a steady pulse' : 'you know these bars: timing matters as much as the notes'})</span></p>
      ${worst.length ? `<div class="report-bars"><span class="song-field-label">Bars to work on</span>${worst.map(([n, b]) =>
        `<button type="button" class="report-bar" data-bar="${n}"><b>bar ${n}</b><span>${esc(barLine(b))}</span></button>`).join('')}</div>`
        : '<p class="report-note">Not a single mistake. Try it faster?</p>'}`;
    $('song-report').hidden = false;
    P.report = report;
  }

  // ---------- what to show ----------
  // Keys: the notes to play now (practised hands) and, faintly, what the other hand is doing.
  function updateKeys() {
    const targets = new Map(), other = new Map();
    if (follows()) {
      const step = P.steps[P.stepIdx];
      if (step && (!P.playing || step.t - P.beat <= EARLY_WAIT)) step.notes.forEach(x => { if (P.noteState.get(x) !== 'hit') targets.set(x.midi, x); });
    } else {
      // the notes reaching the keys now (just ahead, so you see them a moment before)
      P.song.notes.forEach(x => {
        if (P.hands.has(x.hand) && x.start <= P.beat + 0.25 && x.start + x.dur > P.beat) targets.set(x.midi, x);
      });
    }
    if (P.showOther) P.song.notes.forEach(x => {
      if (!P.hands.has(x.hand) && x.start <= P.beat + 0.05 && x.start + x.dur > P.beat) other.set(x.midi, x);
    });
    drawKeys(targets, other);
  }

  function sectionAt(bar) { return (P.song.sections || []).find(s => bar >= s.from && bar <= s.to); }
  const HAND_NAMES = { rh: 'right hand', lh: 'left hand', both: 'both hands' };
  let stageCache = '';
  function updateStage(force = false) {
    const song = P.song;
    if (!song) return;
    const bar = barAt(P.beat);
    const beatInBar = P.countIn ? 0 : Math.floor((P.beat - (bar - 1) * song.barLen) / song.beat + 1e-6) + 1;
    const sec = sectionAt(bar);
    let notesHtml, hint;
    // the big line: the chord of this bar (not the single notes: those are on the keys), and the next one when it changes
    // Always the same two lines (the small one empty when there is nothing to say), so the box never changes height.
    const twoLines = (big, small = '') =>
      `<span class="stage-chord">${esc(big)}</span><span class="stage-next-chord">${small ? esc(small) : '&nbsp;'}</span>`;
    const chordHtml = () => {
      const now = barChord(song.bars[bar - 1]), next = barChord(song.bars[bar]);
      return twoLines(now || '–', next && next !== now ? 'then ' + next : '');
    };
    if (P.ended) {
      const graded = [...P.barStats.entries()];
      const clean = graded.filter(([, s]) => s.wrong + s.miss === 0).length;
      notesHtml = twoLines('Done!');
      const n = P.mistakes.length;
      hint = P.mode === 'listen' ? 'press play to listen again'
        : P.mode === 'free' ? (n ? `${n} mistake${n > 1 ? 's' : ''} · the red notes` : 'no mistakes!') + ' · press play to go again'
        : `${clean} of ${graded.length || song.bars.length} bars clean · press play to go again`;
      if (P.report) hint = `score ${P.report.score}% · ` + hint;
    } else if (P.countIn) {
      notesHtml = twoLines(String(Math.max(1, Math.ceil((P.countInEnd - P.beat) / song.beat - 1e-6))));
      hint = 'get ready…';
    } else {
      notesHtml = chordHtml();
      const s = P.barStats.get(bar);
      if (P.mode === 'listen') hint = P.playing ? 'listen: the app plays the song, both hands' : 'press play to hear the song';
      else if (P.mode === 'free') hint = !P.playing ? 'play the first notes to start: the song follows you' : P.mistakes.length ? `${P.mistakes.length} mistake${P.mistakes.length > 1 ? 's' : ''} so far · red on the falling notes` : 'just play: mistakes are written down, not stopped';
      else if (P.mode === 'wait') hint = !P.playing ? 'play the first notes to start (or press play)' : s && s.wrong ? `${s.wrong} wrong note${s.wrong > 1 ? 's' : ''} in this bar` : 'take your time: the song waits for you';
      else hint = !P.playing ? 'press play: one bar count-in' : s && (s.wrong || s.miss) ? `${s.wrong} wrong, ${s.miss} missed in this bar` : 'play the notes as they reach the keys';
    }
    const pos = `bar ${bar} / ${song.bars.length}${beatInBar ? ` · beat ${beatInBar}` : ''}`;
    const key = [notesHtml, hint, pos, sec && sec.name, bar].join('|');
    if (!force && key === stageCache) return;
    stageCache = key;
    $('song-stage-song').textContent = `${song.title} · ${HAND_NAMES[P.handKey]}${sec ? ' · ' + sec.name : ''}`;
    $('song-stage-pos').textContent = pos;
    $('song-stage-notes').innerHTML = notesHtml;
    $('song-stage-hint').textContent = hint;
    $('song-stage-tip').textContent = sec ? sec.tip : '';
    $('song-stage-tip').title = sec ? sec.tip : ''; // the box shows up to three lines; the whole tip on hover
    $('song-stage-song').title = $('song-stage-song').textContent;
    // current bar chip + beat dots
    [...$('song-bar-pool').children].forEach((c, i) => c.classList.toggle('current', i === bar - 1));
    [...$('song-beat-dots').children].forEach((d, i) => d.classList.toggle('on', P.playing && i === (P.countIn ? Math.floor((P.beat - P.countInEnd + song.barLen) / song.beat) : beatInBar - 1)));
  }

  // ---------- bars, sections, loop ----------
  function renderBarPool() {
    const pool = $('song-bar-pool');
    pool.innerHTML = '';
    const arr = P.mastery[P.handKey];
    P.song.bars.forEach((b, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chord-chip bar-chip';
      chip.innerHTML = `<span class="pool-fill" style="height:${arr[i] / MAX_PROGRESS * 100}%"></span><span class="bar-n">${b.n}</span><span class="bar-chord${b.chord ? '' : ' auto'}">${barChord(b)}</span>`;
      chip.title = `Bar ${b.n}`;
      if (P.mistakes.some(m => m.bar === b.n)) chip.classList.add('has-mistakes'); // free mode (renderMistakes)
      const sec = sectionAt(b.n);
      if (sec && sec.from === b.n && b.n > 1) chip.classList.add('section-start');
      chip.addEventListener('click', e => {
        if (e.shiftKey) {
          const from = P.loop ? P.loop.from : barAt(P.beat);
          setLoop(Math.min(from, b.n), Math.max(from, b.n));
        } else {
          pause();
          if (P.loop && (b.n < P.loop.from || b.n > P.loop.to)) clearLoop();
          seek((b.n - 1) * P.song.barLen);
        }
      });
      pool.appendChild(chip);
    });
  }
  function renderSections() {
    const box = $('song-section-chips');
    box.innerHTML = '';
    (P.song.sections || []).forEach(s => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="radio" name="song-section"> <span>${s.from}–${s.to}</span> ${esc(s.name)}`;
      label.title = s.tip;
      label.querySelector('input').addEventListener('change', () => setLoop(s.from, s.to));
      box.appendChild(label);
    });
  }
  function buildLoopSelects() {
    ['song-loop-from', 'song-loop-to'].forEach((id, k) => {
      const sel = $(id);
      sel.innerHTML = P.song.bars.map(b => `<option value="${b.n}">${b.n}</option>`).join('');
      sel.value = k ? P.song.bars.length : 1;
    });
  }
  function setLoop(from, to) {
    pause();
    P.loop = { from, to, start: (from - 1) * P.song.barLen, end: to * P.song.barLen };
    $('song-opt-loop').checked = true;
    $('song-loop-from').value = from; $('song-loop-to').value = to;
    document.querySelectorAll('#song-section-chips input').forEach((inp, i) => {
      const s = P.song.sections[i];
      inp.checked = s.from === from && s.to === to;
    });
    seek(P.loop.start);
  }
  function clearLoop() {
    P.loop = null;
    $('song-opt-loop').checked = false;
    document.querySelectorAll('#song-section-chips input').forEach(inp => { inp.checked = false; });
  }
  function renderBeatDots() {
    $('song-beat-dots').innerHTML = '<i></i>'.repeat(P.song.beatsPerBar);
  }

  // ---------- library extract ----------
  // The ▶ on a song card plays about EXTRACT_SECONDS of the song (both hands, real tempo, to the end of the bar) in
  // the chosen sound: from the bar in the song file's `preview`, else from the first note. Clicking it again, another
  // card's ▶, opening a song or leaving the tab stops it. Its voices use their own keys (song-ex:<n>).
  const EXTRACT_SECONDS = 12;
  let extract = null; // { song, btn, t0, from, to, notes, idx, sounding: Map midi → end beat, timer }
  const extractKey = n => 'song-ex:' + n;
  function playExtract(song, btn) {
    const same = extract && extract.song === song;
    stopExtract();
    if (same) return;
    initAudio();
    if (!audioCtx) return;
    const firstNote = Math.min(...song.notes.map(n => n.start));
    const from = song.preview ? song.bars[song.preview - 1].start : Math.floor(firstNote / song.barLen) * song.barLen;
    const to = Math.min(song.length, Math.ceil((from + EXTRACT_SECONDS * song.tempo / 60) / song.barLen - 1e-6) * song.barLen);
    const notes = song.notes.filter(n => n.start >= from - 1e-6 && n.start < to - 1e-6).sort((a, b) => a.start - b.start);
    const ex = extract = { song, btn, t0: 0, from, to, notes, idx: 0, sounding: new Map(), timer: 0 };
    btn.classList.add('playing'); btn.setAttribute('aria-pressed', 'true');
    const go = () => {
      if (extract !== ex) return;
      ex.t0 = audioCtx.currentTime;
      ex.timer = setInterval(() => {
        const beat = ex.from + (audioCtx.currentTime - ex.t0) * song.tempo / 60;
        ex.sounding.forEach((end, midi) => { if (beat >= end - 1e-6) { stopPianoNote(extractKey(midi)); ex.sounding.delete(midi); } });
        while (ex.idx < ex.notes.length && ex.notes[ex.idx].start <= beat) {
          const n = ex.notes[ex.idx++], bar = song.bars[n.bar - 1];
          startVoice(n.midi, (DYN_VEL[bar && bar.dyn] || DYN_VEL.mf) * 0.9, extractKey(n.midi));
          ex.sounding.set(n.midi, ringEnd(song, n, song.tempo / 60));
        }
        if (beat >= ex.to) stopExtract();
      }, 20);
    };
    if (audioCtx.state === 'running') go(); else audioCtx.resume().then(go).catch(() => stopExtract());
  }
  function stopExtract() {
    if (!extract) return;
    clearInterval(extract.timer);
    extract.sounding.forEach((end, midi) => stopPianoNote(extractKey(midi)));
    extract.btn.classList.remove('playing'); extract.btn.setAttribute('aria-pressed', 'false');
    extract = null;
  }

  // ---------- library + song guide ----------
  // The library is grouped by the song file's `level` (Beginner, Beginner → intermediate, Intermediate, ...), easiest
  // first; within a level the songs with fewer notes per second (at the song's tempo) come first.
  const LEVEL_WORDS = ['beginner', 'intermediate', 'advanced'];
  const levelRank = level => {
    const words = (level || '').toLowerCase().match(/[a-z]+/g) || [];
    const ranks = words.map(w => LEVEL_WORDS.indexOf(w)).filter(r => r >= 0);
    return ranks.length ? ranks[0] + ranks[ranks.length - 1] : Infinity; // 'Beginner → intermediate' sits between the two
  };
  const notesPerSecond = song => {
    const beats = Math.max(...song.notes.map(n => n.start + n.dur));
    return song.notes.length / (beats * 60 / song.tempo);
  };
  function renderLibrary() {
    stopExtract();
    const list = $('song-list');
    list.innerHTML = '';
    const sorted = SONGS.filter(songVisible).map(song => ({ song, rank: levelRank(song.level), busy: notesPerSecond(song) }))
      .sort((a, b) => a.rank - b.rank || a.busy - b.busy);
    let lastLevel = null;
    const reveal = revealNew; revealNew = false; // the cards the secret just showed pop in, once
    sorted.forEach(({ song, rank }) => {
      const level = rank === Infinity ? 'Other' : song.level;
      if (level !== lastLevel) {
        const head = document.createElement('div');
        head.className = 'section-head song-level-head';
        head.innerHTML = `<span>${esc(level)}</span>`;
        list.appendChild(head);
        lastLevel = level;
      }
      const prog = songProgress(song);
      const wrap = document.createElement('div');
      wrap.className = 'song-card-wrap' + (reveal && !song.publicDomain ? ' song-card-reveal' : '');
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'song-card' + (P.song === song ? ' current' : '');
      const bar = (label, v) => `<div class="song-prog"><span>${label}</span><div class="song-prog-track"><i style="width:${Math.round(v * 100)}%"></i></div><b>${Math.round(v * 100)}%</b></div>`;
      card.innerHTML = `
        <span class="song-title">${esc(song.title)}</span>
        <span class="song-from">${esc([song.from, song.composer].filter(Boolean).join(' · '))}${song.arranger ? ` <em>arr. ${esc(song.arranger)}</em>` : ''}</span>
        <span class="song-facts">${Math.round(song.tempo / song.beat)} bpm · ${song.time.join('/')} · ${esc(song.key || '')} · ${song.bars.length} bars</span>
        ${bar('right', prog.rh)}${bar('left', prog.lh)}${bar('both', prog.both)}`;
      card.addEventListener('click', () => { if (P.song !== song) loadSong(song); showView('practice'); });
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'song-card-play';
      play.setAttribute('aria-pressed', 'false');
      play.setAttribute('aria-label', 'Play an extract of ' + song.title);
      play.title = 'Hear an extract';
      play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-play" d="M8 5.5v13l10.5-6.5z"/><rect class="i-stop" x="7" y="7" width="10" height="10" rx="1.5"/></svg>';
      play.addEventListener('click', () => playExtract(song, play));
      wrap.append(card, play);
      list.appendChild(wrap);
    });
  }

  function renderGuide() {
    const song = P.song;
    if (!song) return;
    $('song-guide-title').textContent = song.title;
    $('song-guide-sub').textContent = [song.from, song.composer, song.arranger && 'arr. ' + song.arranger].filter(Boolean).join(' · ');
    const range = `${noteName(song.low)} – ${noteName(song.high)}`;
    const facts = [['Tempo', `${Math.round(song.tempo / song.beat)} bpm${song.beat === 1.5 ? ' (dotted quarter)' : ''}`], ['Time', `${song.time.join('/')} (${song.beatsPerBar} beats per bar)`], ['Key', song.key || '–'],
      ['Length', `${song.bars.length} bars`], ['Range', range]];
    $('song-guide-facts').innerHTML =
      `<dl class="guide-dl">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` +
      (song.about ? `<p class="theory-callout">${esc(song.about)}</p>` : '') +
      (song.patterns ? `<div class="section-head"><span>Patterns to notice</span></div><ul class="guide-patterns">${song.patterns.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : '') +
      `<div class="section-head"><span>Sections</span></div>`;
    const box = $('song-guide-sections');
    box.innerHTML = '';
    (song.sections || []).forEach(s => {
      const chords = [...new Set(song.bars.slice(s.from - 1, s.to).map(barChord).filter(Boolean))];
      const art = document.createElement('article');
      art.className = 'theory-lesson';
      art.innerHTML = `<h4>${esc(s.name)} <span class="guide-bars">bars ${s.from}–${s.to}</span></h4>
        ${chords.length ? `<p class="guide-chords">${chords.map(esc).join(' → ')}</p>` : ''}
        <p>${esc(s.tip)}</p>
        <button type="button" class="action-btn">Practise these bars</button>`;
      art.querySelector('button').addEventListener('click', () => { showView('practice'); setLoop(s.from, s.to); });
      box.appendChild(art);
    });
  }

  // ---------- sub-views (Songs / Practice / Song guide) ----------
  const VIEWS = ['library', 'practice', 'guide'];
  let view = 'library';
  function showView(name) {
    if (name !== 'library' && !P.song) name = 'library';
    if (name !== 'practice') pause();
    if (name !== 'library') stopExtract();
    view = name;
    VIEWS.forEach(v => {
      const tab = $('song-tab-' + v), on = v === name;
      $('song-' + v + '-view').hidden = !on;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    if (name === 'library') renderLibrary();
    if (name === 'guide') renderGuide();
    if (name === 'practice') requestAnimationFrame(() => { sizeRoll(); drawRoll(); updateStage(true); });
  }
  VIEWS.forEach(v => $('song-tab-' + v).addEventListener('click', () => showView(v)));
  $('song-tabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const at = VIEWS.indexOf(view);
    const next = VIEWS[(at + (e.key === 'ArrowRight' ? 1 : VIEWS.length - 1)) % VIEWS.length];
    showView(next); $('song-tab-' + next).focus();
  });

  // ---------- controls ----------
  $('song-btn-play').addEventListener('click', () => { if (P.playing) pause(); else { centerRoll(); play(); } });
  $('song-btn-restart').addEventListener('click', restart);
  $('song-btn-hear').addEventListener('click', () => (S.preview ? stopPreview() : hearBar()));
  // sound options, remembered
  const stored = (k, fallback) => { try { const v = localStorage.getItem(k); return v === null ? fallback : v; } catch { return fallback; } };
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
  S.sound = stored('songs-sound', 'sampled') === 'synth' ? 'synth' : 'sampled'; // (the old synth-built 'piano' became the sampled one)
  // the recordings load when the sampled piano is first needed: on opening the tab or choosing it
  const preloadSamples = () => { if (S.sound === 'sampled' && appReady) { initAudio(); loadPianoSamples(); } };
  S.backing = stored('songs-backing', 'other');
  S.metronome = stored('songs-metronome', '0') === '1';
  S.ownKeys = stored('songs-own-keys', '1') === '1';
  document.querySelectorAll('input[name="song-sound"]').forEach(r => {
    r.checked = r.value === S.sound;
    r.addEventListener('change', () => { S.sound = r.value; store('songs-sound', r.value); preloadSamples(); });
  });
  document.querySelectorAll('input[name="song-backing"]').forEach(r => {
    r.checked = r.value === S.backing;
    r.addEventListener('change', () => { S.backing = r.value; store('songs-backing', r.value); stopVoices(S.sounding); });
  });
  $('song-opt-metronome').checked = S.metronome;
  $('song-opt-metronome').addEventListener('change', e => { S.metronome = e.target.checked; store('songs-metronome', S.metronome ? '1' : '0'); });
  $('song-opt-own-keys').checked = S.ownKeys;
  $('song-opt-own-keys').addEventListener('change', e => { S.ownKeys = e.target.checked; store('songs-own-keys', S.ownKeys ? '1' : '0'); });
  $('song-report-close').addEventListener('click', hideReport);
  // a bar in the report: go there (and loop it, if a loop is on)
  $('song-report-body').addEventListener('click', e => {
    const b = e.target.closest('.report-bar');
    if (!b) return;
    const n = +b.dataset.bar;
    if (P.loop) setLoop(n, n);
    else seek((n - 1) * P.song.barLen);
    $('song-stage').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  document.querySelectorAll('input[name="song-pmode"]').forEach(r => r.addEventListener('change', () => setPlayMode(r.value)));
  document.querySelectorAll('input[name="song-hands"]').forEach(r => r.addEventListener('change', () => setHands(r.value)));
  $('song-opt-other-hand').addEventListener('change', e => { P.showOther = e.target.checked; drawRoll(); });
  $('song-speed').addEventListener('input', e => {
    P.speed = +e.target.value;
    $('song-speed-value').textContent = Math.round(P.speed * 100) + '%';
  });
  $('song-opt-loop').addEventListener('change', e => {
    const a = +$('song-loop-from').value, b = +$('song-loop-to').value;
    if (e.target.checked) setLoop(Math.min(a, b), Math.max(a, b));
    else clearLoop();
  });
  ['song-loop-from', 'song-loop-to'].forEach(id => $(id).addEventListener('change', () => {
    const a = +$('song-loop-from').value, b = +$('song-loop-to').value;
    setLoop(Math.min(a, b), Math.max(a, b));
  }));
  [['song-opt-fingers', 'songs-opt-fingers'], ['song-opt-key-names', 'songs-opt-key-names'], ['song-opt-roll-names', 'songs-opt-roll-names'], ['song-opt-late-marks', 'songs-opt-late-marks']].forEach(([id, store]) => {
    try { if (localStorage.getItem(store) === '0') $(id).checked = false; } catch { /* ignore */ }
    $(id).addEventListener('change', e => {
      try { localStorage.setItem(store, e.target.checked ? '1' : '0'); } catch { /* ignore */ }
      drawRoll();
    });
  });
  // Space: play / pause. Left / right arrows: previous / next bar.
  window.addEventListener('keydown', e => {
    if (!appReady || !P.song || !practiceOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
    const tg = e.target;
    if (tg.isContentEditable || tg.tagName === 'SELECT' || tg.tagName === 'TEXTAREA' || (tg.tagName === 'INPUT' && tg.type === 'text')) return;
    if (e.key === ' ') { e.preventDefault(); if (P.playing) pause(); else { centerRoll(); play(); } } // after the end: from the top
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (tg.closest && tg.closest('[role="tablist"], input[type="range"], input[type="radio"]')) return; // those use the arrows themselves
      e.preventDefault();
      pause();
      const bar = barAt(P.beat) + (e.key === 'ArrowRight' ? 1 : (P.beat - barStartOf(P.beat) > 0.01 ? 0 : -1));
      seek((Math.max(1, Math.min(P.song.bars.length, bar)) - 1) * P.song.barLen);
    }
  });

  // ---------- start: open the last practised song, show the library ----------
  {
    let last = null;
    try { last = localStorage.getItem('songs-last'); } catch { /* ignore */ }
    const song = SONGS.find(s => s.id === last && songVisible(s)) || SONGS.find(songVisible);
    if (song) loadSong(song);
    showView('library');
    requestAnimationFrame(tick);
  }

  // Called by setMode (js/tabs.js) when the Songs tab opens / closes.
  // ---------- for the practice routine (js/routine.js) ----------
  // A loop pass: the wrong + missed notes in the loop's bars (grading per bar, gradeBar), before they are reset.
  function loopPass() {
    let wrong = 0, miss = 0;
    for (let b = P.loop.from; b <= P.loop.to; b++) { const st = P.barStats.get(b); if (st) { wrong += st.wrong; miss += st.miss; } }
    // timing: the notes of this pass off the pulse, counted as the timing strictness says
    const strict = T ? T.strict : timingStrictness();
    let offTime = 0;
    if (T) T.timing.forEach((t, n) => { if (t.dev !== null && Math.abs(t.dev) > t.tol && n.bar >= P.loop.from && n.bar <= P.loop.to) offTime++; });
    const timingOk = strict < 0.5 || offTime <= Math.floor((1 - strict) * 6);
    return { from: P.loop.from, to: P.loop.to, wrong, miss, offTime, strict, timingOk, clean: wrong + miss === 0 && timingOk,
      speed: P.speed, mode: P.mode, hands: P.handKey, events: takeEvents(P.loop.from, P.loop.to) };
  }
  // Set the practice view up: song, hands ('rh' | 'lh' | 'both'), mode, speed, loop [from, to] or none;
  // Within a song the notes glide to the new spot.
  // timingBias: added to the timing strictness (the routine's stage: hands alone count timing less, in context more).
  function routineSetup({ song, hands, pmode, speed, loop, timingBias = 0 }) {
    const from = P.song === song ? P.beat + viewOffset() : null;
    if (P.song !== song) loadSong(song, false);
    hideReport(); P.extraMarks = []; P.playedMarks = [];
    document.querySelectorAll('input[name="song-hands"]').forEach(r => { r.checked = r.value === hands; });
    setHands(hands);
    document.querySelectorAll('input[name="song-pmode"]').forEach(r => { r.checked = r.value === pmode; });
    setPlayMode(pmode);
    P.speed = speed;
    $('song-speed').value = speed; $('song-speed-value').textContent = Math.round(speed * 100) + '%';
    if (loop) setLoop(loop[0], loop[1]);
    else { clearLoop(); seek(0); }
    P.guide = true; P.timingBias = timingBias;
    skipEmptyBars();
    showView('practice');
    if (from !== null) startGlide(from);
  }
  // The chords of each bar: [{ root, sfx }] from the song file's chord (two in a bar: "F#m · A"), else detected.
  function parseChordName(name) {
    const m = /^([A-G])([#b♯♭]?)([^/]*)/.exec(name.trim());
    if (!m) return null;
    return { root: (LETTER[m[1]] + (/[#♯]/.test(m[2]) ? 1 : /[b♭]/.test(m[2]) ? -1 : 0) + 12) % 12, sfx: m[3].trim() };
  }
  function barChords(song) {
    return song.bars.map(b => {
      if (b.chord) return b.chord.split('·').map(parseChordName).filter(Boolean);
      if (b.auto === undefined) b.auto = detectBarChord(song, b);
      return b.auto && !b.auto.single ? [{ root: b.auto.root, sfx: b.auto.sfx }] : [];
    });
  }

  return {
    routine: {
      setHook(fn) { routineHook = fn; if (!fn) { P.guide = false; P.timingBias = 0; } }, // null: the routine ended
      setup: routineSetup,
      // the falling notes and keys in the middle of the screen, as on Play (after the tab / view has laid out)
      focus() { requestAnimationFrame(() => requestAnimationFrame(() => { if (practiceOpen()) centerRoll(); })); },
      play, pause,
      setSpeed(v) { P.speed = v; $('song-speed').value = v; $('song-speed-value').textContent = Math.round(v * 100) + '%'; },
      progress: songProgress, // song → { rh, lh, both }: 0..1, the average fill of its bars (Songs tab)
      mastery: loadMastery,   // song → { rh, lh, both }: per bar 0..MAX_PROGRESS
      barChords,
      takes: loadTakes,       // song → { rh, lh, both }: the last take's { score, speed, mode, coverage, at }
      openSong(song) { loadSong(song); showView('practice'); },
      // the Songs tab as you left it, taken when a routine starts and put back when it ends
      snapshot: () => P.song && { song: P.song.id, hands: P.handKey, pmode: P.mode, speed: P.speed,
        loop: P.loop && [P.loop.from, P.loop.to], beat: P.beat, view },
      restore(s) {
        pause(); P.guide = false; P.timingBias = 0; glide = null;
        const song = s && SONGS.find(x => x.id === s.song);
        if (!song) return;
        if (P.song !== song) loadSong(song, false);
        hideReport(); P.extraMarks = []; P.playedMarks = [];
        document.querySelectorAll('input[name="song-hands"]').forEach(r => { r.checked = r.value === s.hands; });
        setHands(s.hands);
        document.querySelectorAll('input[name="song-pmode"]').forEach(r => { r.checked = r.value === s.pmode; });
        setPlayMode(s.pmode);
        P.speed = s.speed; $('song-speed').value = s.speed; $('song-speed-value').textContent = Math.round(s.speed * 100) + '%';
        if (s.loop) setLoop(s.loop[0], s.loop[1]); else clearLoop();
        seek(Math.max(0, Math.min(P.song.length - 1, s.beat)));
        showView(s.view);
      },
      // where the song is: the clock (beats), playing, count-in, mode, hands, loop, speed
      clock: () => ({ timing: T ? T.strict : timingStrictness(), beat: P.beat, playing: P.playing, countIn: !!P.countIn, mode: P.mode, hands: P.handKey, loop: P.loop && { from: P.loop.from, to: P.loop.to }, speed: P.speed, song: P.song && P.song.id,
        want: (P.steps[P.stepIdx] || { notes: [] }).notes.filter(n => P.noteState.get(n) !== 'hit').map(n => n.midi) }), // want: the step to play next
    },
    noteOn,
    qwertyAnchor,
    // for the microphone's octave correction (js/mic.js): the notes of the step to play and the one before it
    expectedNotes() {
      if (!P.song || !practiceOpen() || P.mode === 'listen') return [];
      const steps = [P.steps[P.stepIdx], P.steps[P.stepIdx - 1]].filter(Boolean);
      return [...new Set(steps.flatMap(s => s.notes.map(x => x.midi)))];
    },
    shiftQwerty(d) { qwertyShift += d; qwertyAnchor(); },
    show() { showView(view); preloadSamples(); },
    library() { showView('library'); }, // the Songs tab button, pressed again
    // the MIDI restart button (Settings, js/midi.js)
    // stopped: start (after the end: from the top); playing: back to the start. Always brings the falling notes into view.
    startRestart() {
      if (!P.song || !practiceOpen()) return false;
      if (P.playing) restart(); else { centerRoll(); play(); }
      return true;
    },
    hide() { pause(); stopPreview(); stopExtract(); },
  };
})();
