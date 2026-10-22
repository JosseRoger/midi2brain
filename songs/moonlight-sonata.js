'use strict';
// Piano Sonata No. 14 in C# minor, Op. 27 No. 2 ("Moonlight"), 1st movement (Adagio sostenuto), Ludwig van Beethoven
// (1801). Notes from the Mutopia Project edition (CC BY-SA 2.5), typeset after the Berners edition of 1908, converted
// bar by bar from its MIDI file. Hands follow the staves; where the score moves a few triplet notes to the other
// staff, that hand plays them.
(() => {
  // the bars as written in the score (repeats not written out)
  const B = [
    ['G#3:et C#4 E4 G#3 C#4 E4 G#3 C#4 E4 G#3 C#4 E4', 'C#2+C#3:w'], // 1
    ['G#3:et C#4 E4 G#3 C#4 E4 G#3 C#4 E4 G#3 C#4 E4', 'B1+B2:w'], // 2
    ['A3:et C#4 E4 A3 C#4 E4 A3 D4 F#4 A3 D4 F#4', 'A1+A2:h F#1+F#2'], // 3
    ['G#3:et C4 F#4 G#3 C#4 E4 G#3 C#4 D#4 F#3 C4 D#4', 'G#1+G#2:h G#1+G#2'], // 4
    ['r:q G#3:et C#4 E4 G#3 C#4 E4 G#4:e. G#4:s | r:h. G#3:et C#4 E4', 'C#2+G#2+C#3:w | E3:et G#3 C#4'], // 5
    ['G#4:h. G#4:e. G#4:s | G#3:et D#4 F#4 G#3 D#4 F#4 G#3 D#4 F#4 G#3 D#4 F#4', 'C2+G#2+C3:w'], // 6
    ['G#4:h A4 | G#3:et C#4 E4 G#3 C#4 E4 A3 C#4 F#4 A3 C#4 F#4', 'C#2+C#3:h F#1+F#2'], // 7
    ['G#4:h F#4:q B4 | G#3:et B3 E4 G#3 B3 E4 A3 B3 D#4 A3 B3 D#4', 'B1+B2:h B1+B2'], // 8
    ['E4:q G#3:et B3 E4 G#3 B3 E4 G#3 B3 E4 | G#3:et B3', 'E2+E3:w'], // 9
    ['G3:et B3 E4 G3 B3 E4 G3 B3 E4 G4:e. G4:s | r:h. G3:et B3 E4', 'E2+E3:w'], // 10
    ['G4:h. G4:e. G4:s | G3:et B3 F4 G3 B3 F4 G3 B3 F4 G3 B3 F4', 'D2+D3:w'], // 11
    ['G4:h. F#4:q | G3:et C4 E4 G3 B3 E4 G3 C#4 E4', 'C2+C3:q B1+B2 Bb1+Bb2:h | r:h. F#3:et C#4 E4'], // 12
    ['F#4:h G4:q E4', 'B1+B2:h E2:q G2 | F#3:et B3 D4 F#3 B3 D4 G3 B3 C#4 E3 B3 C#4'], // 13
    ['F#4:h F#4', 'F#2:h F#1+F#2 | F#3:et B3 D4 F#3 B3 D4 F#3 Bb3 C#4 F#3 Bb3 C#4'], // 14
    ['B3:q B3:et D4 F#4 B3 D#4 F#4 B4:q | r:et D4 F#4 r:h B3:et D#4 F#4', 'B1+B2:w~'], // 15
    ['C5:h. Bb4:q | B3:et E4 G4 B3 E4 G4 B3 E4 G4 B3 E4 G4', 'B1+B2:q E2+E3 G2+G3 E2+E3'], // 16
    ['B4:h. B4:q | B3:et D#4 F#4 B3 D#4 F#4 B3 D#4 F#4 B3 D#4 F#4', 'B1+B2:w~'], // 17
    ['C5:h. Bb4:q | B3:et E4 G4 B3 E4 G4 B3 E4 G4 B3 E4 G4', 'B1+B2:q E2+E3 G2+G3 E2+E3'], // 18
    ['B4:h B4 | B3:et D#4 F#4 B3 D#4 F#4 B3 D4 F4 B3 D4 F4', 'B1+B2:h G#1+G#2'], // 19
    ['B4:h A4 | B3:et C#4 G#4 B3 C#4 G#4 A3 C#4 F#4 A3 C#4 F#4', 'F1+F2:h F#1+F#2'], // 20
    ['G4:h F#4', 'B1+B2:h C2+C3 | G3:et B3 D4 G3 B3 D4 F#3 A3 D#4 F#3 A3 D#4'], // 21
    ['C#4:h C#4:q C#4', 'C#2:h C#2 | C#3:et F#3 A3 C#3 F#3 A3 C#3 F#3 G#3 C#3 F3 G#3'], // 22
    ['r:q. r:st F#4:et C#4 F#4 A4 C#5:e. C#5:s | r:h. C#4:et F#4 A4', 'F#1+C#2+F#2:w | F#3:q A3:et C#4 | r:et A3 C#4'], // 23
    ['C#5:h. C#5:e. C#5:s | C#4:et G#4 B4 C#4 G#4 B4 C#4 G#4 B4 C#4 G#4 B4', 'F2+C#3+F3:w'], // 24
    ['C#5:h C5:q C#5 | C#4:et F#4 A4 C#4 F#4 A4 C4 F#4 A4 C#4 F#4 A4', 'F#2+F#3:h D#2+D#3:q C#2+C#3'], // 25
    ['D#5:h. D#5:q | D#4:et F#4 G#4 D#4 F#4 G#4 D#4 F#4 G#4 D#4 F#4 G#4', 'C2+G#2+C3:h. C2+G#2+C3:q'], // 26
    ['E5:h D#5:q C#5 | E4:et G#4 C#5 E4 G#4 C#5 D#4 F#4 A4 C#4 E4 Bb4', 'C#2+G#2+C#3:h F#1+F#2:q G1+G2'], // 27
    ['C5:et C4 D#4 G#4:q A4 F#4 | r:ht C4:et D#4 r C4 D#4 r C4 D#4', 'G#1+G#2:w'], // 28
    ['r:et C4 D#4 G#3:q A3 F#3 | r:ht C4:et D#4 r C4 D#4 r C4 D#4', 'G#1+G#2:w'], // 29
    ['r:et E4 G#4 C#5:q E5 C#5 | r:ht E4:et G#4 r E4 G#4 r E4 G#4', 'G#1+G#2:w | E3:et'], // 30
    ['', 'G#1+G#2:w | r:et E3 G#3 C#4:q E4 C#4 | r:ht E3:et G#3 r E3 G#3 r E3 G#3'], // 31
    ['r:q C4:et A3 D#4 C4 F#4 D#4 A4 F#4 C5', 'G#1+G#2:w | D#3:et A3 F#3'], // 32
    ['r:q E4:et C#4 G#4 E4 C#5 G#4 E5 C#5 G#4', 'G#1+G#2:w | E3:et C#4 G#3'], // 33
    ['C#4:et G4 E4 Bb4 G4 C#5 Bb4 E5 C#5 G5 E5 Bb5', 'G#1+G#2:w'], // 34
    ['F#4:et C5 A4 D#5 C5 F#5 D#5 A5 F#5 C6 A5 D#6', 'G#1+G#2:w~'], // 35
    ['C6:et F#5 A5 D#5 F#5 C5 D#5 A4 C5 F#4 A4 D#4', 'G#1+G#2:w~'], // 36
    ['F#4:et C4 D#4 A3 C4 F#3 A3 D#3:qt C#3:q | r:h r:qt F#3:et r F#3 A3', 'G#1+G#2:w'], // 37
    ['C3:h D#3:q C#3 | r:et F#3 G#3 A3 G#3 F#3 r F#3 A3 r F#3 A3', 'G#1+G#2:w'], // 38
    ['C3:h D3:q C#3 | r:et F#3 G#3 A3 G#3 F#3 r F#3 A3 r F#3 A3', 'G#1+G#2:w'], // 39
    ['C3:h C#3:et E3 C#4 C#3 E3 C#4 | r:et F#3 G#3 A3 G#3 F#3', 'G#1+G#2:h A1+A2'], // 40
    ['D#3:et A3 C#4 D#3 A3 C#4 D#3 G#3 C4 D#3 F#3 C4', 'F#1+F#2:h G#1+G#2'], // 41
    ['E3:et G#3 C#4 G#3 C#4 E4 G#3 C#4 E4 G#4:e. G#4:s | r:h. G#3:et C#4 E4', 'C#2+G#2+C#3:w'], // 42
    ['G#4:h. G#4:e. G#4:s | G#3:et D#4 F#4 G#3 D#4 F#4 G#3 D#4 F#4 G#3 D#4 F#4', 'C2+G#2+C3:w'], // 43
    ['G#4:h A4 | G#3:et C#4 E4 G#3 C#4 E4 A3 C#4 F#4 A3 C#4 F#4', 'C#2+C#3:h F#1+F#2'], // 44
    ['G#4:h F#4:q B4 | G#3:et B3 E4 G#3 B3 E4 A3 B3 D#4 A3 B3 D#4', 'B1+B2:h B1+B2'], // 45
    ['E4:q B3:et E4 G#4 B3 E4 G#4 B4:e. B4:s | G#3:et B3 r:h r:et B3 E4 G#4', 'E2+E3:w'], // 46
    ['B4:h. B4:e. B4:s | B3:et F#4 A4 B3 F#4 A4 B3 F#4 A4 B3 F#4 A4', 'D#2+D#3:w'], // 47
    ['B4:h C5:q C#5 | B3:et E4 G#4 B3 E4 G#4 C4 F#4 G#4 C#4 E4 G#4', 'E2+E3:h D#2+D#3:q C#2+C#3'], // 48
    ['D#5:h E5 | D#4:et F#4 G#4 D#4 F#4 G#4 E4 G#4 C#5 E4 G#4 C#5', 'C2+G#2+C3:h C#2+G#2+C#3'], // 49
    ['D5:h C5 | D4:et F#4 A4 D4 F#4 A4 C4 F#4 G#4 C4 F#4 G#4', 'F#1+F#2:h G#1+G#2'], // 50
    ['C#5:h. C#5:q | C#4:et E4 G#4 C#4 E4 G#4 C#4 F4 G#4 C#4 F4 G#4', 'C#2+C#3:w~'], // 51
    ['D5:h. C5:q | C#4:et F#4 A4 C#4 F#4 A4 C#4 F#4 A4 C#4 F#4 A4', 'C#2+C#3:q F#2+F#3 A2+A3 F#2+F#3'], // 52
    ['C#5:h. C#5:q | C#4:et F4 G#4 C#4 F4 G#4 C#4 F4 G#4 C#4 F4 G#4', 'C#2+C#3:w~'], // 53
    ['D5:h. C5:q | C#4:et F#4 A4 C#4 F#4 A4 C#4 F#4 A4 C#4 F#4 A4', 'C#2+C#3:q F#2+F#3 A2+A3 F#2+F#3'], // 54
    ['C#5:h C#5 | C#4:et F4 G#4 C#4 F4 G#4 C#4 F#4 A4 C#4 F#4 A4', 'C#2+C#3:h F#1+F#2'], // 55
    ['B4:h. B4:q | B3:et F#4 A4 B3 F#4 A4 B3 F#4 A4 B3 E4 G#4', 'D#2+D#3:h. E2+E3:q'], // 56
    ['A4:q A4 G#4 G#4 | A3:et E4 G#4 A3 D#4 F#4 G#3 D#4 F#4 G#3 C#4 E4', 'C#2+C#3:q D#2+D#3 C2+C3 C#2+C#3'], // 57
    ['F#4:h G#4:q A4', 'A1+A2:h G#1+G#2:q F#1+F#2 | F#3:et C#4 D#4 F#3 C#4 D#4 G#3 C#4 D#4 A3 C#4 D#4'], // 58
    ['G#4:h G#4', 'G#1+G#2:h G#1+G#2 | G#3:et C#4 E4 G#3 C#4 E4 F#3 C4 D#4 F#3 C4 D#4'], // 59
    ['C#4:q G#3:et C#4 E4 G#3 C#4 E4 G#3 C#4 E4', 'C#2:w | G#2:h. G#2:e. G#2:s | E3:et G#3 C#4'], // 60
    ['G#3:et D#4 F#4 G#3 D#4 F#4 G#3 D#4 F#4 G#3 D#4 F#4', 'C2:w | G#2:h. G#2:e. G#2:s'], // 61
    ['G#3:et E4 C#4 G#4 E4 C#5 G#4 E5 C#5 G#5 E5 C#5', 'C#2:w | G#2:h. G#2:e. G#2:s'], // 62
    ['C5:et D#5 A4 C5 F#4 A4 D#4 F#4 A3:qt G#3:et F#3 | r:h. C4:q', 'G#1:w | G#2:h. G#2:e. G#2:s'], // 63
    ['E3+C#4:et E4 C#4 G#4 E4 C#5 G#4 E5 C#5 G#5 E5 C#5', 'C#2:w | G#2:h. G#2:e. G#2:s'], // 64
    ['C5:et D#5 A4 C5 F#4 A4 D#4 F#4 A3:qt G#3:et F#3 | r:h. C4:q', 'G#1:w | G#2:h. G#2:e. G#2:s'], // 65
    ['E3+C#4:et G#3 C#4 E4 C#4 G#3 r E3 G#3 C#4 G#3 E3', 'C#2:w~ | G#2:h C#3'], // 66
    ['r:et C#3 E3 G#3 E3 C#3', 'C#2:w | G#2:h G#2:et C#3 G#2 E2 G#2 E2'], // 67
    ['r:h E3+G#3+C#4', 'C#2:h C#2+G#2+C#3'], // 68
    ['E3+G#3+C#4:w', 'C#2+G#2+C#3:w'], // 69
  ];
  // play order: [from, to] ranges of written bars, repeats written out
  const ORDER = [[1, 69]];
  const m = ORDER.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, k) => a + k)).map(n => ({ rh: B[n - 1][0], lh: B[n - 1][1] }));

  addSong({
    id: 'moonlight-sonata',
    title: 'Moonlight Sonata',
    from: 'Piano Sonata No. 14, Op. 27 No. 2, 1st movement',
    publicDomain: true, // shown without the secret (js/songs.js: songVisible)
    composer: 'Ludwig van Beethoven',
    tempo: 54,
    time: [4, 4],
    key: 'C# minor',
    level: 'Intermediate → advanced',
    about: 'The slow, dreamy first movement of Beethoven\'s "Moonlight" sonata. Three layers all the way through: ' +
      'deep octaves in the left hand, quiet triplets in the right hand, and on top of them a slow melody that the ' +
      'right hand plays with its little finger. Beethoven asks for it all to be played very softly, with the pedal.',
    patterns: [
      'The triplets: three notes per beat, twelve per bar, always even. They are the chord of the bar, broken.',
      'The melody (from bar 5) is played by the right hand\'s 4th and 5th fingers on top of the triplets: let it sing a little louder.',
      'The dotted rhythm (a dotted eighth and a sixteenth) comes just before a long note: the sixteenth goes just after the last triplet note.',
      'The left hand plays octaves that change once or twice a bar: they are the bass line, so play them legato with the pedal.',
      'Bars 28–41 stay on a low G# while the triplets wander; the piece ends with a long, quiet C# minor coda.',
    ],
    sections: [
      { name: 'Introduction', from: 1, to: 4, tip: 'Triplets only, over left-hand octaves. Make every triplet even and soft before the melody comes in.' },
      { name: 'Melody', from: 5, to: 22, tip: 'The melody on top of the triplets, with the dotted G#. Practise the right hand\'s two layers: melody with fingers 4-5, triplets with 1-2-3.' },
      { name: 'Second theme', from: 23, to: 27, tip: 'Higher, around F# minor: the same three layers.' },
      { name: 'Over the low G#', from: 28, to: 41, tip: 'The left hand holds G# octaves; the triplets climb high, sink down and pass into the left hand.' },
      { name: 'Return', from: 42, to: 59, tip: 'The melody returns, as at bar 5, now turning a different way at the end.' },
      { name: 'Coda', from: 60, to: 69, tip: 'The dotted melody moves to the left hand under the triplets, then the last C# minor chords. Very soft.' },
    ],
    measures: m,
  });
})();
