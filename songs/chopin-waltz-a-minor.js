'use strict';
// Waltz in A minor, KK IVb/11 (B. 150), Frédéric Chopin. Edition: partitions-piano.fr (2 pages). Transcribed from the
// sheet music PDF: pitches read from the score rendered with pitch guides on every staff line and space.
// Repeats are written out (middle part twice, second part twice). Bar 1 holds the up-beat E. The 8va in bars 21–24
// (from the fourth note of the quintuplet) is written out an octave higher. Mordents and trills are left out.
(() => {
  const m = [];
  // left hand: bass on 1, chord on 2 and 3 (c2 = 'r' for a rest)
  const bar = (rh, bass, c1, c2 = c1, chord, extra = {}) => m.push({ rh, lh: `${bass}:q ${c1} ${c2}`, chord, ...extra });
  const AM = 'A3+C4+E4', DM = 'A3+D4+F4', G7 = 'G3+B3+F4', C = 'G3+C4+E4', AM2 = 'E3+A3+C4';
  const E7a = 'E3+B3+D4', E7b = 'E3+G#3+D4', A = 'E3+A3+C#4';

  // the main theme (A minor): 8 bars, twice; the second time it rises to A and closes on E
  const theme1 = () => {
    bar('A4:e B4 C5:q C5', 'A1', AM, AM, 'Am');
    bar('D5:e E5 F5:h', 'D2', DM, DM, 'Dm');
    bar('B4:e C5 D5 A5 G5 F5', 'G2', G7, G7, 'G7');
    bar('E5:g F5:g E5:e D#5 E5:h', 'C3', C, C, 'C');
  };
  const themeEnd = (lastChord = G7) => { // the second half's first bars; lastChord = the left hand's second G7 chord
    bar('A4:e B4 C5:q C5', 'A2', AM, AM, 'Am');
    bar('D5:e E5 F5:h', 'D2', DM, DM, 'Dm');
    bar('B4:e C5 D5 A5 G5 B4', 'G2', G7, lastChord, 'G7');
  };

  // 1–16 the theme: bar 1 is the up-beat E
  m.push({ rh: 'r:h E4:q', lh: '' });
  theme1();
  themeEnd();
  bar('C5:q r E4', 'C3', C, 'r', 'C');
  theme1();
  bar('C5:e D5 E5:q E5', 'A2', AM, AM, 'Am');
  bar('F5:e G5 A5:h', 'D2', DM, DM, 'Dm');
  bar('G5:q F#5:e G5 D6 F5', 'G2', G7, G7, 'G7');
  bar('E5:h.', 'C3', C, C, 'C');

  // 17–24 the middle part (over E7 and A minor), played twice; bars 21–24 climb an octave higher (8va)
  for (let k = 0; k < 2; k++) {
    bar('E5:e F#5 G#5 A5 B5 C6', 'E2', E7a, E7b, 'E7');
    bar('B5:g C6:g B5:e A5 E5 B5 A5:q', 'A2', AM2, AM2, 'Am');
    bar('A5:g B5:g A5:e G#5 E5 F5 E5:q', 'E2', E7a, E7b, 'E7');
    bar('E5:g F5:g E5:e C5 A4 B4 A4:q', 'A2', AM2, AM2, 'Am');
    bar('E4:et G#4 B4 E5:s5 G#5 B5 E6 G#6 B6:e. C7:s', 'E2', E7a, E7b, 'E7');
    bar('B6:g C7:g B6:e A6 E6 B6 A6:q', 'A2', AM2, AM2, 'Am');
    bar('A6:g B6:g A6:e G#6 E6 E7 E7:q', 'E2', E7a, E7b, 'E7');
    bar('A6:h r:q', 'A2', AM2, AM2, 'Am');
  }

  // second part, played twice: the theme's start, then a turn to A major (B7 – E – A)
  for (let k = 0; k < 2; k++) {
    theme1();
    bar('C5:e D5 E5:q E5', 'A2', AM, AM, 'Am');
    bar('F5:e G5 A5:h', 'D2', DM, DM, 'Dm');
    bar('D#5:e E5 F#5:q F#5', 'B1', 'A3+B3+D#4', 'A3+B3+D#4', 'B7');
    bar('G#5:e A5 B5:h', 'E2', E7a, 'r', 'E7');
    bar('B5:e C#6 D6 F#6 E6 D6', 'E2', E7b, E7b, 'E7');
    bar('C#6:e B5 C#6 G#5 A5 F#5', 'A2', A, A, 'A');
    bar('E5:g F#5:g E5:e D5 G#4 F#5 E5:q', 'E2', E7a, E7a, 'E7');
    bar('E5:g F#5:g E5:e C#5 A4 F#5 E5:q', 'A2', A, A, 'A');
    bar('B5:e C#6 D6 F#6 E6 D6', 'E2', E7b, E7b, 'E7');
    bar('C#6:e B5 C#6 G#5 A5 F#5', 'A2', A, A, 'A');
    bar('E5:g F#5:g E5:e D5 G#4 F#5 E5 G#4', 'E2', E7a, E7a, 'E7');
    bar('A4:q r E4', 'A2', 'E3+C#4', 'r', 'A');
  }

  // the theme returns, with a new ending
  theme1();
  themeEnd('G3+D4+F4');
  bar('C5:q r E4', 'C3', 'G3+E4', 'r', 'C');
  bar('A4:e B4 C5:q C5', 'A1', AM, AM, 'Am');
  bar('D5:e E5 F5:h', 'D2', DM, DM, 'Dm');
  bar('r:e E5 D#5 E5 B5 D5', 'E2', E7b, E7b, 'E7');
  bar('C5:h r:q', 'A2', AM2, AM2, 'Am');
  bar('r:e C6 B5 A5 G5 F5', 'C3', 'E3+A3+E4', 'r', 'Am/C');
  bar('E5:e D5 C#5 D5 E5 F5', 'D3', 'A3+B3+F4', 'r', 'Dm6');
  bar('E5:q D#5:e E5 F5 G#4', 'E2', 'E3+C4', E7a, 'E7');
  bar('A4:h r:q', 'A2', 'E3+C4', 'r', 'Am');

  addSong({
    id: 'chopin-waltz-a-minor',
    title: 'Waltz in A minor',
    from: 'KK IVb/11 (published after his death)',
    publicDomain: true, // shown without the secret (js/songs.js: songVisible)
    composer: 'Frédéric Chopin',
    tempo: 132,
    time: [3, 4],
    key: 'A minor',
    level: 'Intermediate',
    about: 'A short, singing waltz from Chopin\'s youth. The left hand keeps the waltz going all the way through: a low ' +
      'bass note on 1, then the chord on 2 and 3. The right hand sings a simple tune with little turns (grace notes) and ' +
      'a few runs that climb high. The middle part sits on E7 and A minor; the second part turns briefly to A major.',
    patterns: [
      'Left hand: "OOM-pah-pah": the bass on beat 1 (often a big jump down), the chord on 2 and 3, lighter.',
      'The theme is four bars over Am – Dm – G7 – C: rising, A–B–C, D–E–F, then down through a run.',
      'Grace notes (E–F before E, B–C before B) are quick and light, just before the beat.',
      'Bars 17–24 swing between E7 and A minor every bar; the second time through they climb to the top of the piano.',
      'The second part uses sharps (D#, F#, G#, C#): B7 – E – A, the bright side of A minor.',
    ],
    sections: [
      { name: 'Theme', from: 1, to: 17, tip: 'Left hand alone first: bass, chord, chord, keeping the jump down to the bass smooth. Then the tune on top: legato, the grace notes light.' },
      { name: 'Middle part', from: 18, to: 33, tip: 'Played twice. E7, A minor, every bar. Bar 22 has a fast run (three, then five notes per beat) that climbs an octave higher: practise it slowly on its own.' },
      { name: 'Second part', from: 34, to: 65, tip: 'Played twice. It starts like the theme, then turns to A major (watch the sharps: D#, G#, C#, F#).' },
      { name: 'Theme returns', from: 66, to: 81, tip: 'The theme again, then a new ending: a run down from C, a turn around D, and a last E7 – A minor.' },
    ],
    measures: m,
  });
})();
