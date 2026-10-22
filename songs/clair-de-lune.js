'use strict';
// Clair de lune, from Suite bergamasque (L. 75), Claude Debussy (published 1905). Notes from the Mutopia Project
// edition (public domain), typeset after the Fromont edition of 1905, converted bar by bar from its MIDI file. Bars
// 37–42 are spelled with sharps, as in the score's E major key there. Arpeggiated chords are played together.
(() => {
  // the bars as written in the score (repeats not written out)
  const B = [
    ['r:q F5+Ab5:h Db5+F5:q.~', 'r:e F4+Ab4:w'], // 1
    ['Db5+F5:e C5+Eb5 Db5+F5 C5+Eb5:h.~', 'Gb4+A4:w~ Gb4+A4:e'], // 2
    ['C5+Eb5:e Bb4+Db5 C5+Eb5 Bb4:h.~ | r:q. Db5:e. F5:q. Db5:e.~', 'F4+Ab4:w~ F4+Ab4:e'], // 3
    ['Bb4+Db5:e Ab4+C5 Bb4+Db5 Ab4:h. | r:q. C5:h.~', 'Eb4+Gb4:w~ Eb4+Gb4:e'], // 4
    ['Gb4:h. Gb4:q. | C5:e Bb4 C5 Bb4 Eb5 Bb4 Ab4 Bb4 Ab4:e~', 'Db4+Eb4:h. C4+Eb4:q.'], // 5
    ['Eb4:h. Eb4:q. | Ab4:e Gb4 Ab4 Gb4:q. F4:q.~', 'Bb3+Db4:h. A3+C4:q.'], // 6
    ['Db4:w~ Db4:e | F4:e F4 Gb4 F4 Bb4 F4 Eb4 F4 Eb4:e~', 'Bb3:w~ Bb3:e | Ab3:h. Gb3:q.'], // 7
    ['Bb3:h. Ab3+C4:q. | Eb4:e Db4 Eb4 Db4:q.', 'F3+Ab3:h. Gb3:q. | r:h. Eb3:e. Ab2:e.~'], // 8
    ['r:e F3+Ab3:q F5+Ab5:q. Db5+F5:q.~', 'Db2+Ab2:e r F4+Ab4:h.~ F4+Ab4:e'], // 9
    ['Db5+F5:e Gb4+Bb4:w | r:e Eb5 F5 Eb5:h.~', 'Db3:w~ Db3:e | Gb2:h. | r:e Gb3+Bb3+Db4:w'], // 10
    ['Eb5:e Ab4:q Ab4+Db5+Ab5:q. F5:q.~ | r:e Db4+Db5 Eb4+Eb5 r:q. F4+Db5', 'F2+Db3:h. Ab3+Db4:q. | r:e F3+Ab3:q Db4+F4:q.'], // 11
    ['F5:e Gb4+Bb4:w | r:e Eb5 F5 Eb5:q. Db5:q.~', 'Db3:w~ Db3:e | Gb2:h. | r:e Gb3+Bb3+Db4:w'], // 12
    ['Db5:e Ab4:q F5:h. | r:e Db4+Db5 Eb4+Eb5 Bb4+Bb5:e. Ab4+Ab5:q. F4:e.', 'Ab2:w~ Ab2:e | r:e F3+B3:q B3+Db4+F4:h'], // 13
    ['F5:e F4+Bb4:w | r:e Eb5 F5 Eb5:e. Db5:q.', 'Bb2:h. | r:e F3+Bb3:w | r:e Eb4:q.~ Eb4:s Db4:h~ Db4:s'], // 14
    ['r:e. F5+Bb5+F6:q~ F5+Bb5+F6:s Eb5+Bb5+Eb6:e Eb5+Bb5+Eb6 Eb5+Bb5+Eb6 Db5+Bb5+Db6 Db5+Bb5+Db6', 'Eb1+Eb2:h. Eb4+Gb4+Bb4:e Db4+Gb4+Bb4 Db4+Gb4+Bb4 | r:e. F4+Gb4+Bb4:q~ F4+Gb4+Bb4:s Eb4+Gb4+Bb4:e Eb4+Gb4+Bb4'], // 15
    ['Db5+Bb5+Db6:e C5+Gb5+Bb5+C6 C5+Gb5+Bb5+C6 C5+Gb5+Bb5+C6:e. Db5+Bb5+Db6 Bb4+Gb5+Bb5:q.', 'Db4+Gb4+Bb4:e C4+Gb4+Bb4 C4+Gb4+Bb4 C4+Gb4+Bb4:e. Db4+Gb4+Bb4 Bb3+Db4+Gb4:q.'], // 16
    ['r:e. F5+Bb5+F6:q~ F5+Bb5+F6:s Gb5+Bb5+Gb6:e F5+Bb5+F6 Eb5+Bb5+Eb6 F5+Bb5+F6 Eb5+Bb5+Eb6', 'Eb1+Eb2+Bb2:h. Eb4+Gb4+Bb4:e F4+Gb4+Bb4 Eb4+Gb4+Bb4 | r:e. F4+Gb4+Bb4:q~ F4+Gb4+Bb4:s Gb4+Bb4+Eb5:e F4+Gb4+Bb4'], // 17
    ['Db5+Bb5+Db6:e Eb5+Bb5+Eb6 Db5+Bb5+Db6 Bb5+C6:et~ Bb5+C6:s r:st Eb6:g Db5+Bb5+Db6:e. Bb4+Gb5+Bb5:q.~', 'Db4+Gb4+Bb4:e Eb4+Gb4+Bb4 Db4+Gb4+Bb4 C4+Gb4+Bb4:e. Db4+Gb4+Bb4 Bb3+Eb4+Gb4:q.'], // 18
    ['Bb4+Gb5+Bb5:e. Gb4+Gb5 Ab4+Eb5+Ab5 C5+C6 Bb4+Gb5+Bb5 Gb4+Gb5', 'Ab1+Ab2:h. Eb4+Gb4:q. | r:e. Gb3 C4+Eb4:q. Bb3:e. Gb3 | r:q. Ab3:e.'], // 19
    ['r:e Gb4+C5+Eb5+Gb5 Gb4+C5+Eb5+Gb5 Gb4+C5+Eb5+Gb5 Gb4+C5+Eb5+Gb5 Ab4+C5+Eb5+Ab5 Gb4+C5+Eb5+Gb5:q.', 'A1+A2:h. Gb3+C4+Eb4:q. | r:e Gb3+C4+Eb4 Gb3+C4+Eb4 Gb3+C4+Eb4 Gb3+C4+Eb4 Ab3+C4+Eb4'], // 20
    ['r:e. Db5:q. Db5+Db6:e. Gb5:q. | r:e. Gb4+Gb5 Ab4+Ab5 r Bb4+Bb5 Gb4', 'Bb1+Bb2:h. Db4+Gb4:q. | r:e. Bb3+Db4:q. Db4:e. Bb3 Gb3 | r:e. Gb3 Ab3'], // 21
    ['r:e Gb4+Bb4+Eb5+Gb5 Gb4+Bb4+Eb5+Gb5 Gb4+Bb4+Eb5+Gb5 Gb4+Bb4+Eb5+Gb5 Ab4+C5+F5+Ab5 Gb4+Bb4+Eb5+Gb5:q.', 'Ab1+Ab2:h. Gb3+Bb3+Eb4:q. | r:e Gb3+Bb3+Eb4 Gb3+Bb3+Eb4 Gb3+Bb3+Eb4 Gb3+Bb3+Eb4 Ab3+C4+F4'], // 22
    ['r:e. Bb4+Db5:h~ Bb4+Db5:s Gb5+Bb5:q. | r:e. Gb4+Gb5 Ab4+Ab5 Eb5+Eb6 Db5+Db6 Bb4', 'Db2+Db3:h. Gb4+Bb4:q. | r:e. Bb3+Db4:h~ Bb3+Db4:s Db4:e. Bb3 | r:e. Gb3 Ab3 Eb4'], // 23
    ['r:e Bb4+Gb5+Bb5 Bb4+Gb5+Bb5 Bb4+Gb5+Bb5 Bb4+Gb5+Bb5 C5+Ab5+C6 Bb4+Gb5+Bb5 Db5+Bb5+Db6 Eb5+Bb5+Eb6', 'Eb2+Eb3:h. Bb3+Db4+Gb4:e Db4+Gb4+Bb4 Eb4+Gb4+Bb4 | r:e Bb3+Db4+Gb4 Bb3+Db4+Gb4 Bb3+Db4+Gb4 Bb3+Db4+Gb4 C4+Eb4+Ab4'], // 24
    ['Ab5+Db6+Ab6:h. Ab5+Db6+Ab6:q.', 'F4+Ab4+Db5+F5:h. E4+Ab4+Bb4+Db5+E5:q.'], // 25
    ['Ab5+Db6+Ab6:h. Ab4+Eb5+Ab5:q.', 'Eb4+Gb4+Ab4+Db5+Eb5:h. Ab3+Eb4+Gb4+C5:q.'], // 26
    ['F4+Ab4:h. Ab4+B4:q Db5:e | r:q Ab3:s Db4 r:e. Ab3:s C4 r:q B3:s E4 Ab4', 'Db2:q. F2 Ab2 | r:s Ab2 Db3 F3 r:e. C3:s F3 r:q E3:s Ab3'], // 27
    ['F4+Ab4:h. Ab4+B4:q Ab4:e | r:q Ab3:s Db4 r:e. Ab3:s C4 r:q B3:s r E4', 'Db2:q. F2 Ab2 | r:s Ab2 Db3 F3 r:e. C3:s F3 r:q E3:s Ab3'], // 28
    ['F4+Db5:q Ab4+Eb5:e Db5+F5:q. F4+Db5:q Db5+F5:e', 'Db2:s Ab2 Db3 F3 Ab3 Db4 F4 Ab4 F4 Db4 Ab3 F3 Ab3 F3 Db3 Ab2 Db3 Ab2'], // 29
    ['Eb5+G5:e Db5+F5 Bb4+Db5 Bb4+Db5:q. Db4:e. Bb3 | r:h F4:e Db4', 'Eb2:s Bb2 Eb3 G3 Bb3 Eb4 G4:e Bb3:s G3 Eb3 Bb2 Eb2 Bb2 Eb3 G3 Eb3 Bb2 | r:q. r:s Eb4'], // 30
    ['Bb4:h. C5:q F5:e | r:q C4:s Gb4 r:q Db4:s Gb4 r:q Ab4:s F4', 'Ab2:q. Gb2 F2 | r:s Eb3 Gb3 Bb3 r:e. Db3:s Gb3 Bb3 r:e. C3:s F3 Ab3 C4:e'], // 31
    ['Bb4:h. C5:q F5:e | r:q C4:s Gb4 r:q Db4:s Gb4 r:q Ab4:s F4', 'Ab2:q. Gb2 F2 | r:s Eb3 Gb3 Bb3 r:e. Db3:s Gb3 Bb3 r:e. C3:s F3 Ab3 C4:e'], // 32
    ['Gb5:h~ Gb5:s F5:e. D5 Eb5 | r:q. r:s Gb4 Bb4 r Gb4 Bb4 r Gb4 Bb4 r Gb4 Bb4', 'Eb2:q. Gb4:e. F4 D4 Eb4 | r:s Bb2 Eb3 Gb3 Bb3 Eb4'], // 33
    ['Bb5:h. Ab5:q. | r:e. Bb4:s Gb5 r:q Bb4:s Gb5 r:q C5:s E5', 'D4:q. Eb4 Ab3 | r:s Gb4 Bb4 r:q Gb4:s Bb4 r:e. C4:s E4 Ab4'], // 34
    ['F5+Ab5:h. Ab5+B5:q Db6:e | r:q Ab4:s Db5 r:q C5:s r:q B4:s E5 Ab5', 'Db3:q. F3 Ab3 | r:s Ab3 Db4 F4 r:e Ab3:s C4 F4 Ab4 r:e B3:s E4 Ab4'], // 35
    ['F5+Ab5:h. Ab5+B5:q Ab5:e | r:q Ab4:s Db5 r:q C5:s r:q B4:s r E5', 'Db3:q. F3 Ab3 | r:s Ab3 Db4 F4 r:e Ab3:s C4 F4 Ab4 r:e B3:s E4 Ab4'], // 36
    ['C#6:q G#5:e E6:q C#6:e G#6:q E6:e | r:e. C#5:s r E5 r:e. E5:s r G#5 r:e. G#5:s r B5', 'B3:q. C#4 E4 | C#4:s E4 G#4 B4:e. E4:s G#4 B4 C#5:e. G#4:s B4 C#5 E5:e.'], // 37
    ['G#6:q. F#6:h. | r:e. G#5:s C#6 A5 r:e. F#5:s C#6 A5 r:e. F#5:s C#6 A5', 'G#4:q. F#4 F4 | r:s A4 C#5 r:q A4:s C#5 r:e. F#4:s A4 C#5'], // 38
    ['F#6:h. A6:q C#7:e | r:e. F#5:s C#6 A5 r:e. F#5:s C#6 A5 r:q C#6:s C#5', 'E4:q. D#4 C#4 | F#4:s A4 C#5 r:e. F#4:s A4 C#5 r:e. E4:s A4 C#5 E5'], // 39
    ['F#5:h. A5:q C#6:e | r:e. F#4:s C#5 A4 r:e. F#4:s C#5 A4 r:q E5:s A5', 'B3:q. A3 G#3 | r:s D#4 F#4 r:q C#4:s E4 r:q C#4:s E4 A4'], // 40
    ['C#6+E6:e B5+D#6 A5+C#6 G#5+B5:e. F#5+A5:q~ F#5+A5:s E5+G#5:e D#5+F#5', 'F#3:w~ F#3:e | r:s C#4 E4 F#4 A4 C#5 E5 F#5 E5 C#5 A4 F#4 E4 F#4 E4 C#4 A3'], // 41
    ['C#5+E5:e B4+D#5 A4+C#5 G#4+B4 F#4+A4 E4+G#4:q D#4+F#4:e C#4+E4 | r:h. A3:q.', 'F#2:s C#3 E3 F#3 A3 C#4 E4 C#4 A3 F#3 E3 C#3 F#2 C#3 F#2 C#3 F#2 C#3'], // 42
    ['Db4+Eb4:h. C4:q. | Gb3:q Ab3:e Bb3:q r:e Eb4+Gb4:q Eb4+Gb4+Bb4:e', 'Ab2:s Eb3 Ab2 Eb3 Ab2 Eb3 Ab2 Eb3 Ab2 Eb3 Ab2 Eb3 Ab2 Eb3 Ab2 Eb3 Ab2 Eb3'], // 43
    ['Db4+Eb4:h. C4:q. | Gb3:q Ab3:e Bb3:q r:e Eb4+Gb4:q Gb4+Bb4:e~ | r:w Eb4:e', 'Ab2:s Eb3 Ab2 Eb3 Ab2 Eb3 Ab2 Eb3 Ab2 Eb3 Ab2 Eb3 Ab2 Eb3 Ab2 Eb3 Ab2 Eb3'], // 44
    ['Db4+Gb4+Bb4:e Ab4+C5+F5 Gb4+Bb4+Eb5 Gb4+Bb4:q. Gb4+Ab4 | r:q. Db4:e Bb3 Db4 Bb3 C4 Eb4', 'Ab2:s Eb2 Ab2 Eb3 Ab2 Eb3 Ab3 Eb3 Ab3 Eb4 Ab3 Eb3 Ab3 Eb3 Ab2 Eb3 Ab2 Eb2'], // 45
    ['Db4+Gb4+Bb4:e Ab4+C5+F5 Gb4+Bb4+Eb5 Gb4+Bb4:q. Gb4+Ab4 | r:q. Db4:e Bb3 Db4 Bb3 C4 Eb4', 'Ab2:s Eb2 Ab2 Eb3 Ab2 Eb3 Ab3 Eb3 Ab3 Eb4 Ab3 Eb3 Ab3 Eb3 Ab3 Eb3 Ab3 Eb3'], // 46
    ['Eb5:h. Gb5:q Bb5:e | r:s Eb4 Gb4 Bb4 Gb4 Eb4 r Eb4 Gb4 Bb4 Gb4 Eb4 r:q C5:s Eb5', 'Db4:h. C4:q. | Gb3:q Ab3:e Bb3:q r:e. Eb4:s Gb4 Bb4'], // 47
    ['Eb5:h. Gb5:q Bb5:e | r:s Eb4 Gb4 Bb4 Gb4 Eb4 r Eb4 Gb4 Bb4 Gb4 Eb4 r:q C5:s Eb5', 'Db4:h. C4:q. | Gb3:q Ab3:e Bb3:q r:e. Eb4:s Gb4 Bb4'], // 48
    ['Eb6:w~ Eb6:e~ | r:e. Eb5:s Gb5 Bb5 r:e. Eb5:s Gb5 C6 r:e. Eb5:s Gb5 Bb5', 'Gb4:w~ Gb4:e | r:s Bb4 Db5 r:q Bb4:s Db5 r:q Bb4:s Db5'], // 49
    ['Eb6:q. Db6 Eb6 | r:e. Eb5:s Gb5 A5 r:e. Eb5:s Gb5 B5 r:e. Eb5:s Gb5 A5', 'Gb4:w~ Gb4:e | r:s A4 Db5 r:q A4:s Db5 r:q A4:s Db5'], // 50
    ['r:q. F6+Ab6 F6:q.~', 'F4:h. F4:q. | r:s Ab4 C5 F5 Ab5 C6'], // 51
    ['F6:e C6+Eb6 Db6+F6 C6+Eb6:h.~', 'F4:h. F4:q. | r:s A4 C5 Eb5 F5 A5'], // 52
    ['C6+Eb6:e Bb5+Db6 C6+Eb6 Bb5:h.~ | r:q. Db6:e. Db6+F6:q. Db6:e.~', 'F4:h. F4:q. | r:s Ab4 Bb4 Db5 F5 Ab5'], // 53
    ['Bb5+Db6:e Ab5+C6 Bb5+Db6 Ab5+C6:h.', 'Eb4:h. Eb4:q. | r:s Gb4 Ab4 C5 Eb5 Gb5'], // 54
    ['r:e Gb5+Bb5 Ab5+C6 Gb5:q. F5:q.~ | r:q. Bb5:e Eb6 Bb5 Ab5 Bb5 Ab5:e~', 'Db4:h. C4+Eb4+F4+Ab4+C5:q. | r:s Eb4 Gb4 Bb4 Db5 Eb5'], // 55
    ['F5+Ab5:e Eb5+Gb5 F5+Ab5 Eb5+Gb5:q. F5:q.~ | r:h. A4:q.', 'C3:h. F3+C4+Eb4:q. | r:s Gb3 Bb3 C4 Eb4 Gb4 Bb4:q.'], // 56
    ['F5:e Db5+F5 Eb5+Gb5 Db5:q. Db5 | r:q. F5:e Bb5 F5 Eb5 F5 Eb5:e~', 'Ab3:h. Gb3+Bb3+Db4+Eb4:q. | r:s Bb3 Db4 F4 Ab4 Bb4'], // 57
    ['Eb5:e Bb4+Db5 C5+Eb5 Bb4+Db5:q. Ab4+C5', 'F3:h. Gb3+C4:q. | r:s Ab3 Bb3 Db4 F4 Ab4 r:q. Eb3:e. Ab2'], // 58
    ['r:e F3+Ab3:q F5+Ab5:q. Db5+F5:q.~', 'Db2+Ab2:e r F4+Ab4:h.~ F4+Ab4:e | r:q. B3:h.'], // 59
    ['Db5+F5:e Gb4+Bb4:w | r:e Eb5 F5 Eb5:h.~', 'Db3:w~ Db3:e | Gb2:h. | r:e Gb3+Bb3+Db4:w'], // 60
    ['Eb5:e Ab4:q Ab4+F5+Ab5:q. F5:q.~ | r:e Db4+Db5 Eb4+Eb5 r:q. F4+Db5', 'Ab2:h. Db4:q. | r:e F3+Ab3:q B3:h. | r:q. Db4+F4'], // 61
    ['F5:e F4+Bb4:w | r:e Eb5 F5 Eb5:q. Db5', 'Bb2:h. Db4:q. | r:e F3+Bb3:w | r:e Eb4:h~ Eb4:e'], // 62
    ['r:e Ab3:q Db4+F4+Bb4:q. Ab3+Db4+F4 | r:e Db4 Eb4', 'F2:w~ F2:e'], // 63
    ['r:e Bb3+Db4:q Gb4+Bb4+Db5:q. Db4+Gb4+Bb4 | r:e Gb4 Ab4', 'Eb2:q. Eb3 Eb4'], // 64
    ['r:e C4+Gb4:q Ab4+C5+F5:q. C4+Gb4+Ab4 | r:e Bb4 C5', 'Ab2:h. Ab3:q. | r:e. Eb3 Ab5:q.'], // 65
    ['r:q Ab3:s Db4 r:e. Ab3:s C4 F4 r:q Ab3:s Db4', 'Db2:q. F2 Db2 | r:s Ab2 Db3 F3 r:e. C3:s F3 r:q Ab2:s Db3 F3'], // 66
    ['r:e. Ab3:s C4 F4 Ab4+B4:q. E4+Db5', 'F2:q. Ab2:h. | r:s C3 F3 r:q E3:s Ab3 B3 E4 Gb4 Ab4:q.'], // 67
    ['r:q Ab4:s Db5 r:e. Ab4:s C5 F5 r:q Ab4:s Db5', 'Db3:q. F3 Db3 | r:s Ab3 Db4 F4 r:e. C4:s F4 r:q Ab3:s Db4 F4'], // 68
    ['r:e. Ab4:s C5 F5 Ab5:h. | r:q. B5 Db6', 'F3:q. Ab3:h. | r:s C4 F4 r:q B3:s E4 Ab4 B4 E5:q.~ E5:s'], // 69
    ['Ab5:h. E6:q. | B5:q. Db6', 'Ab3:h. Ab2:q. | r:s B3 E4 Ab4 B4 E5:q.~ E5:s'], // 70
    ['F6+Ab6:w~ F6+Ab6:e', 'Db2:h. F5:e Ab5 Db6 | r:s Ab2 Db3 F3 Ab3 Db4 F4:e Ab4 Db5'], // 71
    ['Ab5+Db6+F6+Ab6:h.', 'Db4+Ab4+Db5+F5:h.'], // 72
  ];
  // play order: [from, to] ranges of written bars, repeats written out
  const ORDER = [[1, 72]];
  const m = ORDER.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, k) => a + k)).map(n => ({ rh: B[n - 1][0], lh: B[n - 1][1] }));

  addSong({
    id: 'clair-de-lune',
    title: 'Clair de lune',
    from: 'Suite bergamasque',
    publicDomain: true, // shown without the secret (js/songs.js: songVisible)
    composer: 'Claude Debussy',
    tempo: 60,
    time: [9, 8],
    key: 'D♭ major',
    level: 'Advanced',
    about: 'Debussy\'s moonlight piece: soft, floating thirds and sixths that seem to have no beat, then a flowing ' +
      'middle part over rippling left-hand arpeggios that swells to a climax and settles back to the opening. ' +
      'Play it freely: the tempo bends all the time (rubato), and the pedal blends the harmonies together.',
    patterns: [
      'The opening is all two-note chords (thirds and sixths) in the right hand, starting after the beat: it should feel like it floats.',
      'Count three big beats of three eighths each (9/8), but don\'t let the beat show.',
      'From bar 27 the left hand plays wide arpeggios in sixteenths while the right hand sings the melody on top.',
      'Bars 37–42 move to E major (written in sharps): the loudest and highest point of the piece.',
      'The ending brings back the opening thirds, then dissolves into high, quiet D♭ major chords.',
    ],
    sections: [
      { name: 'Opening', from: 1, to: 14, tip: 'Very soft. Right hand: the thirds and sixths, legato, the top note singing. Hold the tied notes over the bar lines.' },
      { name: 'Tempo rubato', from: 15, to: 26, tip: 'Big chords in both hands, moving together. Let the tempo breathe: a little faster going up, slower coming down.' },
      { name: 'Un poco mosso', from: 27, to: 36, tip: 'Left hand: the sixteenth arpeggios, smooth and even, with the pedal. Practise them alone first, then the melody on top.' },
      { name: 'En animant', from: 37, to: 42, tip: 'The climax, in E major. The melody loud but warm, then falling back down.' },
      { name: 'Calmato', from: 43, to: 50, tip: 'Calm again: the left hand rocks between A♭ and E♭ while the right hand sings.' },
      { name: 'Opening returns', from: 51, to: 58, tip: 'The opening thirds, an octave higher, over a quiet left-hand arpeggio.' },
      { name: 'Ending', from: 59, to: 72, tip: 'The last phrases, softer and softer, ending on high D♭ major chords. Let the last chord ring.' },
    ],
    measures: m,
  });
})();
