'use strict';
// Prelude in C major, BWV 846 (Well-Tempered Clavier I), J. S. Bach. Edition: RoadToVirtuosity.com (2 pages, 35 bars).
// Transcribed from the sheet music PDF: pitches read from the score rendered with pitch guides on every staff line and
// space. The printed right-hand fingering (1 3 5, 1 2 5…) is kept as fixed fingers; the left hand's is worked out.
(() => {
  const m = [];
  // Every bar up to 32 is one five-note chord, broken the same way twice: the left hand holds the bass (half note)
  // and a second note (from the second sixteenth), the right hand plays the top three notes as sixteenths.
  // [bass, second note, three right-hand notes, printed right-hand fingers (or '' = worked out), dynamic]
  const BARS = [
    ['C4', 'E4', 'G4 C5 E5', '135', 'p'],
    ['C4', 'D4', 'A4 D5 F5', '135'],
    ['B3', 'D4', 'G4 D5 F5', '135'],
    ['C4', 'E4', 'G4 C5 E5', '135'],
    ['C4', 'E4', 'A4 E5 A5', '135', 'mp'],
    ['C4', 'D4', 'F#4 A4 D5', '125'],
    ['B3', 'D4', 'G4 D5 G5', '135'],
    ['B3', 'C4', 'E4 G4 C5', '125'],
    ['A3', 'C4', 'E4 G4 C5', '125'],
    ['D3', 'A3', 'D4 F#4 C5', '125'],
    ['G3', 'B3', 'D4 G4 B4', '135'],
    ['G3', 'Bb3', 'E4 G4 C#5', '125'],
    ['F3', 'A3', 'D4 A4 D5', '135'],
    ['F3', 'Ab3', 'D4 F4 B4', '125'],
    ['E3', 'G3', 'C4 G4 C5', '135'],
    ['E3', 'F3', 'A3 C4 F4', '125'],
    ['D3', 'F3', 'A3 C4 F4', ''],
    ['G2', 'D3', 'G3 B3 F4', '125', 'mp'],
    ['C3', 'E3', 'G3 C4 E4', '135'],
    ['C3', 'G3', 'Bb3 C4 E4', '235', 'p'],
    ['F2', 'F3', 'A3 C4 E4', '135'],
    ['F#2', 'C3', 'A3 C4 Eb4', '124', 'mp'],
    ['Ab2', 'F3', 'B3 C4 D4', '123'],
    ['G2', 'F3', 'G3 B3 D4', '135', 'mf'],
    ['G2', 'E3', 'G3 C4 E4', '135'],
    ['G2', 'D3', 'G3 C4 F4', '125'],
    ['G2', 'D3', 'G3 B3 F4', '', 'mf'],
    ['G2', 'Eb3', 'A3 C4 F#4', '125'],
    ['G2', 'E3', 'G3 C4 G4', '125', 'f'],
    ['G2', 'D3', 'G3 C4 F4', '125'],
    ['G2', 'D3', 'G3 B3 F4', ''],
    ['C2', 'C3', 'G3 Bb3 E4', '125'],
  ];
  BARS.forEach(([bass, second, top, fingers, dyn]) => {
    const notes = top.split(' ').map((n, i) => fingers ? `${n}/${fingers[i]}` : n);
    const half = `r:e ${notes[0]}:s ${notes[1]} ${notes[2]} ${notes[0]} ${notes[1]} ${notes[2]}`;
    const tenor = `r:s ${second}:e.~ ${second}:q`;
    m.push({ rh: `${half} ${half}`, lh: `${bass}:h ${bass}:h | ${tenor} ${tenor}`, dyn });
  });
  // 33–35: the ending over a low C held for two bars: the figure runs down, then up and down again, then the chord
  m.push({ rh: 'r:e F3:s A3 C4 F4 C4 A3 C4 A3 F3 A3 F3 D3 F3 D3', lh: 'C2:w~ | r:s C3:e.~ C3:q~ C3:h' });
  m.push({ rh: 'r:e G4/1:s B4/2 D5/3 F5/5 D5/3 B4/2 D5/4 B4/2 G4/1 B4/5 D4/1 F4/3 E4/2 D4/1', lh: 'C2:w | r:s B2:e.~ B2:q~ B2:h' });
  m.push({ rh: 'E4/2+G4/3+C5/5:w', lh: 'C2+C3:w', dyn: 'p' });

  addSong({
    id: 'bach-prelude-c',
    title: 'Prelude in C major',
    from: 'The Well-Tempered Clavier, Book I (BWV 846)',
    publicDomain: true, // shown without the secret (js/songs.js: songVisible)
    composer: 'J. S. Bach',
    tempo: 66,
    time: [4, 4],
    key: 'C major',
    level: 'Beginner → intermediate',
    about: 'One idea from start to finish: each bar is a single chord, broken into the same pattern twice. The left ' +
      'hand plays the bass and a second note it then holds; the right hand ripples the three top notes. Once the ' +
      'pattern sits in the hands, the piece is really a list of 32 chords, and the music is in how one chord slides ' +
      'into the next, often by moving just one or two fingers.',
    patterns: [
      'Every bar: left hand bass (held), then a second note held from the second sixteenth; right hand: rest, then three notes up, three notes up again. Twice per bar.',
      'From one bar to the next most notes stay where they are or move by one key: look for what changes, not for a new chord.',
      'Bars 24–31 all sit on a low G in the bass (a "pedal point"), building up tension that resolves to C in bar 32.',
      'The right-hand fingers printed in the score (1 3 5, 1 2 5…) are kept: the hand keeps one shape for a whole bar.',
      'Bars 33–34 break the pattern: the right hand runs down and up over a held low C, then the final C major chord.',
    ],
    sections: [
      { name: 'Opening in C', from: 1, to: 4, tip: 'C – Dm7 – G7 – C: the whole piece in miniature. Hands separately first; in the left hand, hold the second note down for the rest of the half bar.' },
      { name: 'Towards G', from: 5, to: 11, tip: 'A minor, D7 (the first sharp, F#), G: the harmony drifts to G major. Keep the right hand relaxed over each new shape.' },
      { name: 'Back home', from: 12, to: 19, tip: 'Darker chords (C#, B♭, A♭) lead back to C major in bar 19. Slow down here at first: the hand shapes change more.' },
      { name: 'The chromatic stretch', from: 20, to: 23, tip: 'C7, F major 7, then two tense diminished chords (F#, A♭ in the bass). Softer (p), then growing.' },
      { name: 'Pedal on G', from: 24, to: 31, tip: 'The bass stays on G for eight bars while the chords above build up (mf, then f in bar 29). Keep the low G steady and let the tension grow.' },
      { name: 'Ending', from: 32, to: 35, tip: 'Bar 32 settles on C. In 33–34 the right hand runs over a held low C (hold it with the pedal); slow down (rit.) into the final chord.' },
    ],
    measures: m,
  });
})();
