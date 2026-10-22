'use strict';
// ---------- song format ----------
// tempo in the song file is in quarter notes per minute (a 12/8 song at dotted quarter = 70 has tempo 105).
// Each file in songs/ calls addSong({...}). Bars are written in a compact text notation, one string per hand:
//
//   'E4:q E4 E4'            notes separated by spaces; :q sets the length, which carries on until changed
//   'A3+E4+A4:q E5:h'        + makes a chord
//   'r:q'                    a rest
//   'B4:h.~'                 . = dotted, ~ after the length = tie every note of the chord into the next bar/note
//   'F2~+C3~+F3:h'           ~ after a single pitch ties just that note
//   'A4:h. | E4:q E4 E4'     | separates voices inside one hand (each voice starts at the start of the bar)
//   'E4/1:q A4/5'            /1../5 after a pitch fixes its finger (1 = thumb); the rest is worked out (js/fingering.js)
//   'C5:g B4:h'              :g = grace note: a quick note squeezed in before the next one (it takes GRACE beats of its time)
//
// Lengths: w (whole) h (half) q (quarter) e (eighth) s (sixteenth) x (thirty-second), t = triplet (e.g. et = triplet eighth), a digit
// = other tuplets (s5 = quintuplet sixteenth: five in one beat; e6 = six eighths in the time of four).
// Pitches: letter, optional # or b, octave (C4 = middle C). Times are counted in quarter notes ("beats").
// A hand left out (or '') rests for the bar.
const SONGS = [];
const DUR = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25, x: 0.125 };
const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const GRACE = 0.125; // beats a grace note takes from the note after it

function parsePitch(p) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(p);
  if (!m) throw new Error(`bad pitch "${p}"`);
  return 12 * (+m[3] + 1) + LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
function parseDur(d) {
  const m = /^([whqesx])(t|[2-9])?(\.*)$/.exec(d);
  if (!m) throw new Error(`bad length "${d}"`);
  // t = triplet (3 in the time of 2); a digit n = n-tuplet in the time of the power of two below it (s5: 5 in 4)
  const n = m[2] === 't' ? 3 : m[2] ? +m[2] : 0;
  let v = DUR[m[1]] * (n ? 2 ** Math.floor(Math.log2(n)) / n : 1), add = v / 2;
  for (let i = 0; i < m[3].length; i++) { v += add; add /= 2; }
  return v;
}

function addSong(def) {
  const [num, den] = def.time || [4, 4];
  const barLen = num * 4 / den;
  // the felt beat: a dotted quarter in compound time (6/8, 9/8, 12/8), else the time signature's note value
  const beat = den === 8 && num % 3 === 0 && num > 3 ? 1.5 : 4 / den;
  const song = { ...def, barLen, beat, beatsPerBar: Math.round(barLen / beat), notes: [], bars: [] };
  const pending = { rh: new Map(), lh: new Map() }; // tied notes waiting for their continuation, by pitch
  let dyn = 'mf';
  def.measures.forEach((m, i) => {
    const start = i * barLen;
    if (m.dyn) dyn = m.dyn;
    song.bars.push({ n: i + 1, start, end: start + barLen, chord: m.chord || '', dyn });
    ['rh', 'lh'].forEach(hand => {
      const src = (m[hand] || '').trim();
      const ends = new Map(); // ties only reach notes that start exactly where the tied note ends
      src.split('|').map(v => v.trim()).filter(Boolean).forEach(voice => {
        let t = start, len = 1, debt = 0; // debt: time grace notes have taken from the next note
        voice.split(/\s+/).forEach(tok => {
          const [pitches, durTxt] = tok.split(':');
          let tieAll = false, dur;
          if (durTxt === 'g') { dur = GRACE; debt += GRACE; } // the carried-on length (len) stays as it was
          else {
            if (durTxt) { tieAll = durTxt.endsWith('~'); len = parseDur(durTxt.replace(/~$/, '')); }
            dur = len - debt; debt = 0;
          }
          if (pitches !== 'r') pitches.split('+').forEach(p => {
            const fixed = /\/([1-5])/.exec(p);
            p = p.replace(/\/[1-5]/, '');
            const tie = tieAll || p.endsWith('~');
            const midi = parsePitch(p.replace(/~$/, ''));
            const prev = ends.has(midi) ? ends.get(midi) : pending[hand].get(midi); // a key played again in this bar is not tied
            let note;
            if (prev && Math.abs(prev.start + prev.dur - t) < 1e-6) { prev.dur += dur; note = prev; }
            else { note = { midi, hand, start: t, dur, bar: i + 1 }; song.notes.push(note); }
            if (fixed) note.fixedFinger = +fixed[1];
            ends.set(midi, tie ? note : null);
          });
          t += dur;
        });
        if (t - start > barLen + 1e-6) console.warn(`${def.id} bar ${i + 1} ${hand}: voice is ${t - start} beats, bar is ${barLen}`, voice);
      });
      // ties last one bar step: anything not tied again is dropped
      pending[hand] = new Map([...ends].filter(([, n]) => n));
    });
  });
  song.length = def.measures.length * barLen;
  song.notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
  // one key can't sound twice: where two voices of a hand hit the same pitch, the earlier note ends when the later
  // one starts (and of two starting together, the longer one stays)
  const lastOn = new Map();
  song.notes = song.notes.filter(n => {
    const k = n.hand + n.midi, prev = lastOn.get(k);
    if (prev && Math.abs(prev.start - n.start) < 1e-6) { prev.dur = Math.max(prev.dur, n.dur); return false; }
    if (prev && prev.start + prev.dur > n.start + 1e-6) prev.dur = n.start - prev.start;
    lastOn.set(k, n);
    return true;
  });
  song.low = Math.min(...song.notes.map(n => n.midi));
  song.high = Math.max(...song.notes.map(n => n.midi));
  assignFingering(song); // js/fingering.js: note.finger on every note
  SONGS.push(song);
}
