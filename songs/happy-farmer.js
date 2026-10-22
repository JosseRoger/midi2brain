'use strict';
// The Happy Farmer (Fröhlicher Landmann, von der Arbeit zurückkehrend), Album for the Young Op. 68 No. 10, Robert
// Schumann (1848). Notes from the Mutopia Project edition (CC BY-SA 2.5), typeset after the Peters edition, converted
// bar by bar from its MIDI file. Bar 1 holds the up-beat C, so bar n here is printed bar n − 1.
(() => {
  // the bars as written in the score (repeats not written out)
  const B = [
    ['', 'r:h. r:e C3'], // 1
    ['r:e C4+F4+A4 C4+F4+A4 r:q F4+A4+C5:e F4+A4+C5', 'F3:q. A3:e C4:q. F3:e'], // 2
    ['r:e F4+Bb4+D5 Bb4+D5 r:q F4+A4+C5:e F4+A4+C5', 'Bb3:e D4 F4 D4 C4:q. A3:e'], // 3
    ['r:e Bb3+C4+E4 Bb3+C4+E4:q r:e C4+F4+A4 C4+F4+A4:q', 'Bb3:e G3 C3 Bb3 A3 F3 C3 A3'], // 4
    ['r:e C4+G4 r F4+G4+B4 r E4+G4+C5 E4+G4+C5:q', 'E3:q D3 C3 r:e C3'], // 5
    ['r:e C4+F4+A4 C4+F4+A4 r:q F4+A4+C5:e F4+A4+C5', 'F3:q. A3:e C4:q. F3:e'], // 6
    ['r:e F4+Bb4+D5 Bb4+D5 r:q F4+A4+C5:e F4+A4+C5', 'Bb3:e D4 F4 D4 C4:q. A3:e'], // 7
    ['r:e E4+Bb4+C5 E4+Bb4+C5:q r:e C4+F4+A4 C4+F4+A4:q', 'Bb3:e G3 C3 Bb3 A3 F3 C3 A3'], // 8
    ['r:e C4+G4 r F4+G4+B4 r E4+G4+C5 E4+G4+C5 C4', 'E3:q D3 C3 r:e C3'], // 9
    ['Bb4:q. A4:e G4:q. C4:e | r:e C4+E4 C4+E4 r:q Bb3+C4:e Bb3+C4', 'G3:q. F3:e E3:q. C3:e'], // 10
    ['Bb4:e C4+A4 C4+G4 B3+F4 G4:q. C4:e | r:h r:e C4 C4', 'G3:e F3 E3 D3 E3:q. C3:e'], // 11
    ['F4:q. A4:e C5:q. F4:e | r:e A3+C4 A3+C4 r:q F4+A4:e F4+A4', 'F3:q. A3:e C4:q. F3:e'], // 12
    ['Bb4:e F4+Bb4+D5 F5 F4+Bb4+D5 C5:q. | r:h r:e F4+A4 F4+A4', 'Bb3:e D4 F4 D4 C4:q. A3:e'], // 13
    ['r:e E4+Bb4+C5 E4+Bb4+C5:q r:e C4+F4+A4 C4+F4+A4 C4+F4+A4', 'Bb3:e G3 C3 Bb3 A3 F3 C3 A3'], // 14
    ['r:e D4+G4 r Bb3+C4 r A3+C4+F4 A3+C4+F4 C4', 'Bb2+G3:q C3+E3 F3 r:e C3'], // 15
    ['Bb4:q. A4:e G4:q. C4:e | r:e C4+E4 C4+E4 r:q Bb3+C4:e Bb3+C4', 'G3:q. F3:e E3:q. C3:e'], // 16
    ['Bb4:e C4+A4 C4+G4 B3+F4 G4:q. C4:e | r:h r:e C4 C4', 'G3:e F3 E3 D3 E3:q. C3:e'], // 17
    ['F4:q. A4:e C5:q. F4:e | r:e A3+C4 A3+C4 r:q F4+A4:e F4+A4', 'F3:q. A3:e C4:q. F3:e'], // 18
    ['Bb4:e F4+Bb4+D5 F5 F4+Bb4+D5 C5:q. | r:h r:e F4+A4 F4+A4', 'Bb3:e D4 F4 D4 C4:q. A3:e'], // 19
    ['r:e E4+Bb4+C5 E4+Bb4+C5:q r:e C4+F4+A4 C4+F4+A4 C4+F4+A4', 'Bb3:e G3 C3 Bb3 A3 F3 C3 A3'], // 20
    ['r:e D4+G4 r Bb3+C4 r A3+C4+F4 A3+C4+F4', 'Bb2+G3:q C3+E3 F3'], // 21
  ];
  // play order: [from, to] ranges of written bars, repeats written out
  const ORDER = [[1, 21]];
  const m = ORDER.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, k) => a + k)).map(n => ({ rh: B[n - 1][0], lh: B[n - 1][1] }));

  addSong({
    id: 'happy-farmer',
    title: 'The Happy Farmer',
    from: 'Album for the Young, Op. 68 No. 10',
    publicDomain: true, // shown without the secret (js/songs.js: songVisible)
    composer: 'Robert Schumann',
    tempo: 100,
    time: [4, 4],
    key: 'F major',
    level: 'Beginner',
    about: 'A farmer coming home happy from work, from the album Schumann wrote for his daughters. The tune is in the ' +
      'left hand first, loud and singing, while the right hand taps short chords off the beat. Halfway through, the ' +
      'tune moves up to the right hand. A great piece for making the left hand sing.',
    patterns: [
      'The tune: up F–A–C, then down through B♭ (a dotted quarter and an eighth, twice per bar).',
      'Bars 2–9: the tune in the left hand, short chords in the right hand on the off-beats ("and").',
      'From bar 10 the right hand plays the tune on top and chords underneath it: hold the tune notes, keep the chords light.',
      'Every phrase ends on a C chord going home to F.',
    ],
    sections: [
      { name: 'Tune in the left hand', from: 1, to: 9, tip: 'Left hand alone first: loud, legato, the dotted rhythm crisp. Then add the right-hand chords: short and quiet, on the off-beats.' },
      { name: 'Tune in the right hand', from: 10, to: 15, tip: 'The tune moves up. The right hand plays melody and chords at once: hold the melody notes their full length.' },
      { name: 'Ending', from: 16, to: 21, tip: 'The same six bars again, ending on F.' },
    ],
    measures: m,
  });
})();
