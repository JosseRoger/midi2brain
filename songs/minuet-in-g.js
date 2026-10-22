'use strict';
// Minuet in G major, BWV Anh. 114, from the Notebook for Anna Magdalena Bach (1725); now credited to Christian Petzold.
// Notes from the Mutopia Project edition (public domain), typeset after the Bach-Gesellschaft edition, converted bar by
// bar from its MIDI file. Both halves are repeated, written out here. Mordents and trills are left out; the grace B
// before the A in bar 8 is kept.
(() => {
  // the bars as written in the score (repeats not written out)
  const B = [
    ['D5:q G4:e A4 B4 C5', 'G3+B3+D4:h A3:q'], // 1
    ['D5:q G4 G4', 'B3:h.'], // 2
    ['E5:q C5:e D5 E5 F#5', 'C4:h.'], // 3
    ['G5:q G4 G4', 'B3:h.'], // 4
    ['C5:q D5:e C5 B4 A4', 'A3:h.'], // 5
    ['B4:q C5:e B4 A4 G4', 'G3:h.'], // 6
    ['F#4:q G4:e A4 B4 G4', 'D4:q B3 G3'], // 7
    ['B4:g A4:h.', 'D4:q D3:e C4 B3 A3'], // 8
    ['D5:q G4:e A4 B4 C5', 'B3:h A3:q'], // 9
    ['D5:q G4 G4', 'G3:q B3 G3'], // 10
    ['E5:q C5:e D5 E5 F#5', 'C4:h.'], // 11
    ['G5:q G4 G4', 'B3:q C4:e B3 A3 G3'], // 12
    ['C5:q D5:e C5 B4 A4', 'A3:h F#3:q'], // 13
    ['B4:q C5:e B4 A4 G4', 'G3:h B3:q'], // 14
    ['A4:q B4:e A4 G4 F#4', 'C4:q D4 D3'], // 15
    ['G4:h.', 'G3:h G2:q'], // 16
    ['B5:q G5:e A5 B5 G5', 'G3:h.'], // 17
    ['A5:q D5:e E5 F#5 D5', 'F#3:h.'], // 18
    ['G5:q E5:e F#5 G5 D5', 'E3:q G3 E3'], // 19
    ['C#5:q B4:e C#5 A4:q', 'A3:h A2:q'], // 20
    ['A4:e B4 C#5 D5 E5 F#5', 'A3:h.'], // 21
    ['G5:q F#5 E5', 'B3:q D4 C#4'], // 22
    ['F#5:q A4 C#5', 'D4:q F#3 A3'], // 23
    ['D5:h.', 'D4:q D3 C4'], // 24
    ['D5:q G4:e F#4 G4:q', 'B3:h B3:q | r:q D4:h'], // 25
    ['E5:q G4:e F#4 G4:q', 'C4:h C4:q | r:q E4:h'], // 26
    ['D5:q C5 B4', 'B3:q A3 G3'], // 27
    ['A4:e G4 F#4 G4 A4:q', 'D4:h'], // 28
    ['D4:e E4 F#4 G4 A4 B4', 'D3:h. | r:h F#3:q'], // 29
    ['C5:q B4 A4', 'E3:q G3 F#3'], // 30
    ['B4:e D5 G4:q F#4', 'G3:q B2 D3'], // 31
    ['B3+D4+G4:h.', 'G3:q D3 G2'], // 32
  ];
  // play order: [from, to] ranges of written bars, repeats written out
  const ORDER = [[1, 16], [1, 16], [17, 32], [17, 32]];
  const m = ORDER.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, k) => a + k)).map(n => ({ rh: B[n - 1][0], lh: B[n - 1][1] }));

  addSong({
    id: 'minuet-in-g',
    title: 'Minuet in G',
    from: 'Notebook for Anna Magdalena Bach (BWV Anh. 114)',
    publicDomain: true, // shown without the secret (js/songs.js: songVisible)
    composer: 'Christian Petzold',
    tempo: 116,
    time: [3, 4],
    key: 'G major',
    level: 'Beginner',
    about: 'One of the first "real" pieces most pianists learn. It comes from a notebook of music Bach put together for ' +
      'his wife, Anna Magdalena; the composer was later found to be Christian Petzold. Two voices, one per hand: the ' +
      'right hand dances in quarters and eighths, the left hand answers with a slow, simple bass line. Each half is ' +
      'played twice.',
    patterns: [
      'The right hand opens with a leap: D on 1, then G–A–B–C walking back up to D. This shape comes back again and again.',
      'Bars 1–2 and 9–10 are the same: once you know the first two bars, you know a quarter of the piece.',
      'The left hand is mostly one long note per bar (a dotted half), so watch the few bars where it moves in quarters or eighths.',
      'The second half moves to D major (F#, C#) and comes home to G at the end.',
    ],
    sections: [
      { name: 'First half', from: 1, to: 16, tip: 'Right hand alone first: keep the eighths even and the quarters light, like a dance step. The left hand holds long notes; count all three beats.' },
      { name: 'First half again', from: 17, to: 32, tip: 'The repeat. Try it hands together, slowly. Bar 8 has a quick grace note B before the A.' },
      { name: 'Second half', from: 33, to: 48, tip: 'It starts high on B and moves to D major: watch the C# in bars 36–39. In bars 41–42 the left hand plays two voices: hold the half note while the quarter moves.' },
      { name: 'Second half again', from: 49, to: 64, tip: 'The repeat, ending back in G. Bar 61 is a scale run up from D: fingers 1-2-3, thumb under, 1-2-3.' },
    ],
    measures: m,
  });
})();
