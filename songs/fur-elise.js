'use strict';
// Für Elise (Bagatelle in A minor, WoO 59), Ludwig van Beethoven (1810). Notes from the Mutopia Project edition
// (public domain), typeset after the Breitkopf & Härtel edition of 1888, converted bar by bar from its MIDI file.
// Bar 1 holds the up-beat E–D#, so bar n here is printed bar n − 1. Repeats are written out, with the first and second
// endings.
(() => {
  // the bars as written in the score (repeats not written out)
  const B = [
    ['r:q E5:s D#5', ''], // 1
    ['E5:s D#5 E5 B4 D5 C5', ''], // 2
    ['A4:e r:s C4 E4 A4', 'A2:s E3 A3'], // 3
    ['B4:e r:s E4 G#4 B4', 'E2:s E3 G#3'], // 4
    ['C5:e r:s E4 E5 D#5', 'A2:s E3 A3'], // 5
    ['E5:s D#5 E5 B4 D5 C5', ''], // 6
    ['A4:e r:s C4 E4 A4', 'A2:s E3 A3'], // 7
    ['B4:e r:s E4 C5 B4', 'E2:s E3 G#3'], // 8
    ['A4:q E5:s D#5', 'A2:s E3 A3'], // 9
    ['A4:e r:s B4 C5 D5', 'A2:s E3 A3'], // 10
    ['E5:e. G4:s F5 E5', 'C3:s G3 C4'], // 11
    ['D5:e. F4:s E5 D5', 'G2:s G3 B3'], // 12
    ['C5:e. E4:s D5 C5', 'A2:s E3 A3'], // 13
    ['B4:e r:s E4 E5', 'E2:s E3 E4 r:e E4:s'], // 14
    ['r:s E5 E6 r:e D#5:s', 'E5:s r:e D#5:s E5'], // 15
    ['E5:e r:s D#5 E5 D#5', 'r:s D#5 E5'], // 16
    ['E5:s D#5 E5 B4 D5 C5', ''], // 17
    ['A4:e r:s C4 E4 A4', 'A2:s E3 A3'], // 18
    ['B4:e r:s E4 G#4 B4', 'E2:s E3 G#3'], // 19
    ['C5:e r:s E4 E5 D#5', 'A2:s E3 A3'], // 20
    ['E5:s D#5 E5 B4 D5 C5', ''], // 21
    ['A4:e r:s C4 E4 A4', 'A2:s E3 A3'], // 22
    ['B4:e r:s E4 C5 B4', 'E2:s E3 G#3'], // 23
    ['A4:e r:s B4 C5 D5', 'A2:s E3 A3'], // 24
    ['A4:e r:s E4+C5 F4+C5 E4+G4+C5', 'A2:s E3 A3 Bb3+C4 A3+C4 G3+Bb3+C4'], // 25
    ['F4:g A4:g C5:q F5:s. E5:x', 'F3:s A3 C4 A3 C4 A3'], // 26
    ['E5:e D5 Bb5:s. A5:x', 'F3:s Bb3 D4 Bb3 D4 Bb3'], // 27
    ['A5:s G5 F5 E5 D5 C5', 'F3:s E4 F3+G3+Bb3 E4 F3+G3+Bb3 E4'], // 28
    ['Bb4:e A4 Bb4:g A4:x G4 A4 Bb4', 'F3:s A3 C4 A3 C4 A3'], // 29
    ['C5:q D5:s D#5', 'F3:s A3 C4 A3 C4 A3'], // 30
    ['E5:e. E5:s F5 A4', 'E3:s A3 C4 A3 D3+D4 F3'], // 31
    ['C5:q D5:s. B4:x', 'G3:s E4 G3 E4 G3 F4'], // 32
    ['C5:x G5 G4 G5 A4 G5 B4 G5 C5 G5 D5 G5', 'C4+E4:e r:s F4+G4 E4+G4 D4+F4+G4'], // 33
    ['E5:x G5 C6 B5 A5 G5 F5 E5 D5 G5 F5 D5', 'C4+E4+G4:e F3+A3 G3+B3'], // 34
    ['C5:x G5 G4 G5 A4 G5 B4 G5 C5 G5 D5 G5', 'C4:e r:s F4+G4 E4+G4 D4+F4+G4'], // 35
    ['E5:x G5 C6 B5 A5 G5 F5 E5 D5 G5 F5 D5', 'C4+E4+G4:e F3+A3 G3+B3'], // 36
    ['E5:x F5 E5 D#5 E5 B4 E5 D#5 E5 B4 E5 D#5', 'G#3+B3:e'], // 37
    ['E5:e. B4:s E5 D#5', ''], // 38
    ['E5:e. B4:s E5 D#5', ''], // 39
    ['E5:s D#5 E5 D#5 E5 D#5', ''], // 40
    ['E5:s D#5 E5 B4 D5 C5', ''], // 41
    ['A4:e r:s C4 E4 A4', 'A2:s E3 A3'], // 42
    ['B4:e r:s E4 G#4 B4', 'E2:s E3 G#3'], // 43
    ['C5:e r:s E4 E5 D#5', 'A2:s E3 A3'], // 44
    ['E5:s D#5 E5 B4 D5 C5', ''], // 45
    ['A4:e r:s C4 E4 A4', 'A2:s E3 A3'], // 46
    ['B4:e r:s E4 C5 B4', 'E2:s E3 G#3'], // 47
    ['A4:e r:s B4 C5 D5', 'A2:s E3 A3'], // 48
    ['E5:e. G4:s F5 E5', 'C3:s G3 C4'], // 49
    ['D5:e. F4:s E5 D5', 'G2:s G3 B3'], // 50
    ['C5:e. E4:s D5 C5', 'A2:s E3 A3'], // 51
    ['B4:e r:s E4 E5', 'E2:s E3 E4 r:e E4:s'], // 52
    ['r:s E5 E6 r:e D#5:s', 'E5:s r:e D#5:s E5'], // 53
    ['E5:s r:e D#5:s E5 D#5', 'r:s D#5 E5'], // 54
    ['E5:s D#5 E5 B4 D5 C5', ''], // 55
    ['A4:e r:s C4 E4 A4', 'A2:s E3 A3'], // 56
    ['B4:e r:s E4 G#4 B4', 'E2:s E3 G#3'], // 57
    ['C5:e r:s E4 E5 D#5', 'A2:s E3 A3'], // 58
    ['E5:s D#5 E5 B4 D5 C5', ''], // 59
    ['A4:e r:s C4 E4 A4', 'A2:s E3 A3'], // 60
    ['B4:e r:s E4 C5 B4', 'E2:s E3 G#3'], // 61
    ['A4:e', 'A2:s A2 A2 A2 A2 A2'], // 62
    ['E4+G4+Bb4+C#5:q.', 'A2:s A2 A2 A2 A2 A2'], // 63
    ['F4+A4+D5:q C#5+E5:s D5+F5', 'A2:s A2 A2 A2 A2 A2'], // 64
    ['G#4+D5+F5:q G#4+D5+F5:e', 'A2:s A2 A2 A2 A2 A2'], // 65
    ['A4+C5+E5:q.', 'A2:s A2 A2 A2 A2 A2'], // 66
    ['F4+D5:q E4+C5:s D4+B4', 'D2+A2:s D2+A2 D2+A2 D2+A2 D2+A2 D2+A2'], // 67
    ['C4+F#4+A4:q C4+A4:e', 'D#2+A2:s D#2+A2 D#2+A2 D#2+A2 D#2+A2 D#2+A2'], // 68
    ['C4+A4:e E4+C5 D4+B4', 'E2+A2:s E2+A2 E2+A2 E2+A2 E2+G#2 E2+G#2'], // 69
    ['C4+A4:q.', 'A1+A2:s A2 A2 A2 A2 A2'], // 70
    ['E4+G4+Bb4+C#5:q.', 'A2:s A2 A2 A2 A2 A2'], // 71
    ['F4+A4+D5:q C#5+E5:s D5+F5', 'A2:s A2 A2 A2 A2 A2'], // 72
    ['D5+F5:q D5+F5:e', 'A2:s A2 A2 A2 A2 A2'], // 73
    ['D5+F5:q.', 'Bb2:s Bb2 Bb2 Bb2 Bb2 Bb2'], // 74
    ['G4+D#5:q F4+D5:s D#4+C5', 'Bb2:s Bb2 Bb2 Bb2 Bb2 Bb2'], // 75
    ['D4+F4+Bb4:q D4+F4+A4:e', 'Bb2:s Bb2 Bb2 Bb2 Bb2 Bb2'], // 76
    ['D4+F4+G#4:q D4+F4+G#4:e', 'B2:s B2 B2 B2 B2 B2'], // 77
    ['C4+E4+A4:q', 'C3:q'], // 78
    ['E4+B4:e', 'E3+G#3:e'], // 79
    ['A3:st C4 E4 A4 C5 E5 D5 C5 B4', 'A1:e r A3+C4+E4'], // 80
    ['A4:st C5 E5 A5 C6 E6 D6 C6 B5', 'A3+C4+E4:e r A3+C4+E4'], // 81
    ['A5:st C6 E6 A6 C7 E7 D7 C7 B6', 'A3+C4+E4:e r A3+C4+E4'], // 82
    ['Bb6:st A6 G#6 G6 F#6 F6 E6 D#6 D6', 'A3+C4+E4:e'], // 83
    ['C#6:st C6 B5 Bb5 A5 G#5 G5 F#5 F5', ''], // 84
    ['E5:s D#5 E5 B4 D5 C5', ''], // 85
    ['A4:e r:s C4 E4 A4', 'A2:s E3 A3'], // 86
    ['B4:e r:s E4 G#4 B4', 'E2:s E3 G#3'], // 87
    ['C5:e r:s E4 E5 D#5', 'A2:s E3 A3'], // 88
    ['E5:s D#5 E5 B4 D5 C5', ''], // 89
    ['A4:e r:s C4 E4 A4', 'A2:s E3 A3'], // 90
    ['B4:e r:s E4 C5 B4', 'E2:s E3 G#3'], // 91
    ['A4:e r:s B4 C5 D5', 'A2:s E3 A3'], // 92
    ['E5:e. G4:s F5 E5', 'C3:s G3 C4'], // 93
    ['D5:e. F4:s E5 D5', 'G2:s G3 B3'], // 94
    ['C5:e. E4:s D5 C5', 'A2:s E3 A3'], // 95
    ['B4:e r:s E4 E5', 'E2:s E3 E4 r:e E4:s'], // 96
    ['r:s E5 E6 r:e D#5:s', 'E5:s r:e D#5:s E5'], // 97
    ['E5:s r:e D#5:s E5 D#5', 'r:s D#5 E5'], // 98
    ['E5:s D#5 E5 B4 D5 C5', ''], // 99
    ['A4:e r:s C4 E4 A4', 'A2:s E3 A3'], // 100
    ['B4:e r:s E4 G#4 B4', 'E2:s E3 G#3'], // 101
    ['C5:e r:s E4 E5 D#5', 'A2:s E3 A3'], // 102
    ['E5:s D#5 E5 B4 D5 C5', ''], // 103
    ['A4:e r:s C4 E4 A4', 'A2:s E3 A3'], // 104
    ['B4:e r:s E4 C5 B4', 'E2:s E3 G#3'], // 105
    ['A4:e', 'A1+A2:e'], // 106
  ];
  // play order: [from, to] ranges of written bars, repeats written out
  const ORDER = [[1, 9], [2, 8], [10, 10], [11, 24], [11, 23], [25, 106]];
  const m = ORDER.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, k) => a + k)).map(n => ({ rh: B[n - 1][0], lh: B[n - 1][1] }));

  addSong({
    id: 'fur-elise',
    title: 'Für Elise',
    from: 'Bagatelle in A minor, WoO 59',
    publicDomain: true, // shown without the secret (js/songs.js: songVisible)
    composer: 'Ludwig van Beethoven',
    tempo: 66,
    time: [3, 8],
    key: 'A minor',
    level: 'Beginner → intermediate',
    about: 'Probably the most famous piano piece there is. The main theme (the E–D# rocking, then a falling line to A) ' +
      'comes back four times; in between are two contrasting episodes, a sunny one in F major and a stormy one over a ' +
      'drumming low A. The theme on its own is a good beginner goal; the episodes take it to intermediate.',
    patterns: [
      'The theme: E–D# rocking with fingers 5-4, then down B–D–C to A. The left hand answers with a broken chord A–E–A (or E–E–G#).',
      'The hands take turns: while the left hand plays its three notes, the right hand rests, and the other way round.',
      'In the bright middle part the right hand climbs down in steps: E–G–F–E, D–F–E–D, C–E–D–C (a dotted eighth, then three sixteenths).',
      'The F major episode has ornaments and fast 32nd-note runs: learn them slowly, in groups of four.',
      'The stormy episode: the left hand drums the low A in sixteenths while the right hand plays chords.',
    ],
    sections: [
      { name: 'Theme', from: 1, to: 17, tip: 'The famous part, played twice. Right hand: E–D# with fingers 5-4, relaxed. The hands take turns, so practise the hand-over points slowly.' },
      { name: 'Bright middle', from: 18, to: 45, tip: 'C major, then G: the right hand walks down in little steps, then the theme again. All of it twice.' },
      { name: 'F major episode', from: 46, to: 60, tip: 'Singing chords and two fast 32nd-note runs. Practise the runs alone at half speed, then join them up.' },
      { name: 'Theme returns', from: 61, to: 82, tip: 'The theme and the bright middle part again.' },
      { name: 'Storm', from: 83, to: 104, tip: 'Left hand: the low A repeated in sixteenths, steady and light from the wrist. Then a triplet arpeggio climbs up and falls back down chromatically.' },
      { name: 'Theme, last time', from: 105, to: 126, tip: 'The theme one last time, ending quietly on A.' },
    ],
    measures: m,
  });
})();
