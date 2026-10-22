'use strict';
// ---------- song fingering ----------
// assignFingering(song) (called by addSong, js/songformat.js) gives every note a `finger` (1 = thumb … 5 = little
// finger), for each hand separately. Fingers fixed in the song file (note.fixedFinger, written E4/1) are kept.
//
// How: the hand's music is cut into events, one per note onset. An event covers every note sounding at that moment
// (new ones plus ones still held, if less than an octave from them), so a held note keeps its finger and
// the moving voice has to fit around it. Each event can be fingered a few ways (fingers in pitch order: up the keyboard is 1→5 in the right hand, 5→1 in the
// left). A dynamic-programming pass picks the cheapest path through the whole song, where the costs are:
// - stretch: every finger pair has a relaxed, comfortable and possible span (in semitones, after Parncutt et al.,
//   "An ergonomic model of keyboard fingering", 1997). Thumb pairs may cross (negative span: thumb under / over);
//   other pairs may not. Used inside a chord and between one note and the next.
// - the same finger on a different key straight away, a thumb on a black key, and a little for finger 4;
// - hand movement: how far the hand's position (where the thumb would sit) shifts between events.
// A leap of more than an octave is a jump to a new hand position, not a stretch.
// Movement costs less after longer notes or rests, when there is time to move.

const FINGER_SPAN = { // pair: [min possible, min comfortable, min relaxed, max relaxed, max comfortable, max possible]
  '1-2': [-5, -3, 1, 5, 8, 10], '1-3': [-4, -2, 3, 7, 10, 12], '1-4': [-3, -1, 5, 9, 12, 14], '1-5': [-1, 1, 7, 10, 13, 15],
  '2-3': [1, 1, 1, 2, 3, 5], '2-4': [1, 1, 3, 5, 7, 9], '2-5': [2, 2, 5, 7, 9, 11], // 2-4, 2-5 a little wider than Parncutt: an octave hand shape (5-2-1) is normal
  '3-4': [1, 1, 1, 2, 2, 4], '3-5': [1, 1, 3, 4, 5, 7], '4-5': [1, 1, 1, 2, 3, 5],
};
const FINGER_OFFSET = [0, 0, 2, 4, 5, 7]; // semitones from the thumb in a plain five-finger position (C D E F G)
const FINGER_NATURAL = [0, 0, 3, 5, 7, 8]; // the same for a relaxed, slightly open hand: the spacing the model leans towards
const FINGER_COMBOS = (() => { // all ascending finger choices for 1..5 notes
  const out = [[], [], [], [], [], []];
  for (let mask = 1; mask < 32; mask++) {
    const fs = [1, 2, 3, 4, 5].filter((f, i) => mask & (1 << i));
    out[fs.length].push(fs);
  }
  return out;
})();
const isBlackKey = n => [1, 3, 6, 8, 10].includes(n % 12);

// Cost of fingers a and b (any order) on pitches pa and pb in hand `hand`.
function fingerPairCost(a, pa, b, pb, hand) {
  if (a > b) [a, b, pa, pb] = [b, a, pb, pa];
  const d = (pb - pa) * (hand === 'rh' ? 1 : -1); // positive = b sits further from the thumb, as it should
  const [minP, minC, minR, maxR, maxC, maxP] = FINGER_SPAN[a + '-' + b];
  let c = 0;
  if (d < minP) c += 10 + 2 * (minP - d); else if (d > maxP) c += 10 + 2 * (d - maxP);
  if (d < minC) c += 2 * (minC - d); else if (d > maxC) c += 2 * (d - maxC);
  if (d < minR) c += minR - d; else if (d > maxR) c += d - maxR;
  c += 0.1 * Math.abs(d - (FINGER_NATURAL[b] - FINGER_NATURAL[a])); // a light pull towards the natural hand shape
  return c;
}

function assignFingering(song) {
  ['rh', 'lh'].forEach(hand => {
    const notes = song.notes.filter(n => n.hand === hand);
    if (!notes.length) return;
    const times = [...new Set(notes.map(n => n.start))].sort((a, b) => a - b);
    const events = times.map(t => {
      const sounding = notes.filter(n => n.start <= t + 1e-6 && n.start + n.dur > t + 1e-6).sort((a, b) => a.midi - b.midi);
      const fresh = sounding.filter(n => Math.abs(n.start - t) < 1e-6);
      // Held notes only stay under the fingers when the hand can still reach them together with the new notes (less
      // than an octave apart in all); further apart, the pedal holds them and the hand moves on. At most five notes.
      const span = sounding[sounding.length - 1].midi - sounding[0].midi;
      const held = span < 12 ? sounding.filter(n => !fresh.includes(n)) : [];
      const keep = [...fresh.slice(0, 5), ...held.slice(0, Math.max(0, 5 - fresh.length))].sort((a, b) => a.midi - b.midi);
      return { t, notes: keep, fresh: fresh.filter(n => keep.includes(n)) };
    });

    // the ways to finger one event, each with its own (static) cost
    const options = events.map(ev => {
      const k = ev.notes.length;
      return FINGER_COMBOS[k].map(combo => {
        const fs = hand === 'rh' ? combo : combo.slice().reverse(); // left hand: the lowest note gets the highest finger
        const fingers = new Map(ev.notes.map((n, i) => [n, fs[i]]));
        let cost = 0;
        for (const n of ev.fresh) {
          const f = fingers.get(n);
          if (n.fixedFinger && n.fixedFinger !== f) cost += 1000;
          if (f === 1 && isBlackKey(n.midi)) cost += 1;
          if (f === 4) cost += 0.1;
        }
        for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
          cost += fingerPairCost(fs[i], ev.notes[i].midi, fs[j], ev.notes[j].midi, hand);
        }
        const pos = ev.notes.reduce((s, n) => s + n.midi + (hand === 'rh' ? -1 : 1) * FINGER_OFFSET[fingers.get(n)], 0) / k;
        return { fingers, cost, pos };
      });
    });

    const transition = (prevEv, a, ev, b) => {
      let c = 0;
      for (const [n, f] of b.fingers) if (a.fingers.has(n) && a.fingers.get(n) !== f) return Infinity; // held notes keep their finger
      const gap = ev.t - prevEv.t;
      const ease = gap <= 0.5 ? 1 : gap <= 1 ? 0.8 : gap <= 2 ? 0.55 : 0.35; // more time = easier to move
      for (const pn of prevEv.fresh) for (const nn of ev.fresh) {
        const pf = a.fingers.get(pn), nf = b.fingers.get(nn);
        if (pf === undefined || nf === undefined) continue;
        const melodic = prevEv.fresh.length === 1 && ev.fresh.length === 1;
        if (melodic && Math.abs(nn.midi - pn.midi) > 12) { c += 2; continue; } // a leap: the hand jumps, any fingers will do
        if (pf === nf) {
          if (pn.midi === nn.midi) continue;
          // one finger hopping to another key: bad in a quick line, normal when a whole chord shape moves slowly
          if (melodic || gap <= 0.5) c += (gap <= 0.5 ? 6 : 3) + 0.5 * Math.abs(nn.midi - pn.midi);
        } else if (melodic) c += 0.8 * fingerPairCost(pf, pn.midi, nf, nn.midi, hand);
        else if (pn.midi === nn.midi) c += 0.5; // the same key repeated with another finger inside chords
      }
      c += (prevEv.fresh.length === 1 && ev.fresh.length === 1 ? 0.1 : 0.35) * Math.abs(b.pos - a.pos); // single notes: the stretch costs above say most
      return c * ease;
    };

    // dynamic programming over the events
    let best = options[0].map(o => ({ cost: o.cost, back: -1 }));
    const backs = [best];
    for (let e = 1; e < events.length; e++) {
      const cur = options[e].map(o => {
        let min = Infinity, back = 0;
        options[e - 1].forEach((p, i) => {
          const c = best[i].cost + transition(events[e - 1], p, events[e], o);
          if (c < min) { min = c; back = i; }
        });
        return { cost: min + o.cost, back };
      });
      backs.push(cur);
      best = cur;
    }
    let idx = best.reduce((bi, s, i) => (s.cost < best[bi].cost ? i : bi), 0);
    for (let e = events.length - 1; e >= 0; e--) {
      const chosen = options[e][idx];
      for (const n of events[e].fresh) n.finger = chosen.fingers.get(n);
      idx = backs[e][idx].back;
    }
  });
}
