'use strict';
// Gnossienne No. 1, Erik Satie (1890). Transcribed from the Mutopia edition (Knute Snortum, 2015, CC BY-SA 4.0),
// 2 pages, 82 bars. Satie wrote no bar lines or time signature; the edition's hidden 4/4 bars are used here.
// The PDF draws its notes as font glyphs, so pitches were read from the score rendered with pitch guides on every
// staff line and space. Key F minor, "Lent". The low bass note is held by the pedal while the left hand jumps up to
// the chord on beats 2 and 4. Where the melody holds F4, the left-hand chords leave their F4 out (one key, one note).
(() => {
  const m = [];
  const bar = (rh, lh, extra = {}) => m.push({ rh, lh, ...extra });

  // left hand: bass note, then the chord on beats 2 (half) and 4 (quarter)
  const lh = (bass, chord) => `${bass}:w | r:q ${chord}:h ${chord}:q`;
  const FM = lh('F2', 'Ab3+C4+F4'), FM_ = lh('F2', 'Ab3+C4'); // FM_ = without the F4 the melody is holding
  const CM = lh('C3', 'Eb3+G3+C4'), BBM = lh('Bb1', 'F3+Bb3+Db4');

  // the melody's building blocks (B4 / D5 / E5 marked natural: Satie's raised notes against the key)
  const TURN = 'r:q C5:e Eb5 D5:q C5';                 // the opening turn
  const B_B = 'C5:g B4:h C5:g B4:h';                   // grace C onto B natural, twice
  const F_F = 'E5:g F5:h E5:g F5:h';                   // grace E natural onto F, twice
  const B_G = 'C5:g B4:h Ab4:g G4:h';                  // B natural, then G
  const G_G = 'F4:g G4:q F4:g G4:h~ G4:e r';           // the G that hangs (over C)
  const G_F = 'Ab4:g G4:q G4:g F4:q~ F4:h~';           // down to F, which is held into the next bar
  const BB_G = 'Ab4:g Bb4:h Ab4:g G4:h';               // the "très luisant" bars (over B flat)
  const RISE = 'r:e C5 D5 E5 F5 G5 B5 G5';             // "questionnez": the run up (D, E, B natural)
  const F5_F5 = 'F5:q G5:g F5:q~ F5:h';
  const F5_E = 'G5:g F5:h F5:g E5:h';
  const C_B = 'Db5:g C5:h C5:g B4:h';

  // A section: the turn, answered by B, F, then B–G and the hanging G, down to F
  const sectionA = (dynA, dynB) => {
    bar(TURN, FM, { dyn: dynA, chord: 'Fm' }); bar(B_B, FM, { chord: 'Fm' });
    bar(TURN, FM, { chord: 'Fm' }); bar(F_F, FM, { chord: 'Fm' });
    bar(TURN, FM, { chord: 'Fm' }); bar(B_G, FM, { chord: 'Fm' });
    bar(G_G, CM, { chord: 'Cm' }); bar(G_F, FM_, { dyn: dynB, chord: 'Fm' }); bar('F4:w', FM_, { chord: 'Fm' });
  };
  // B section ("très luisant"): two bars over B flat minor, then down to F; played twice
  const sectionB = (dyn) => {
    for (let k = 0; k < 2; k++) {
      bar(BB_G, BBM, { dyn: k === 0 ? dyn : undefined, chord: 'Bbm' }); bar(BB_G, BBM, { chord: 'Bbm' });
      bar(G_F, FM_, { chord: 'Fm' }); bar('F4:w', FM_, { chord: 'Fm' });
    }
  };
  // C section ("questionnez"): the run up, then F, E, C, B, G stepping down to F
  const sectionC = (dyn) => {
    bar(RISE, FM, { dyn, chord: 'Fm' }); bar(F5_F5, FM, { chord: 'Fm' }); bar(F5_E, FM, { chord: 'Fm' });
    bar(C_B, FM, { chord: 'Fm' }); bar(G_F, FM_, { chord: 'Fm' }); bar('F4:w', FM_, { chord: 'Fm' });
  };

  sectionA('p', 'f');                 // 1–9
  sectionA('p', 'f');                 // 10–18 the same nine bars again
  sectionB('f');                      // 19–26 très luisant
  sectionC('p');                      // 27–32 questionnez
  sectionC();                         // 33–38
  sectionB('f');                      // 39–46
  // 47–54 "du bout de la pensée": the turn, answered by long notes
  ['C5:g B4:w', 'E5:g F5:w', 'C5:g B4:w', 'E5:g F5:w'].forEach((answer, i) => {
    bar(TURN, FM, { dyn: i === 0 ? 'p' : undefined, chord: 'Fm' });
    bar(answer, FM, { chord: 'Fm' });
  });
  // 55–62 the B section again (bar 62 = the held F that starts "postulez en vous-même")
  sectionB('f');
  sectionC('p');                      // 63–68 postulez en vous-même
  sectionC();                         // 69–74 pas à pas
  sectionB('f');                      // 75–82 sur la langue

  addSong({
    id: 'gnossienne-1',
    title: 'Gnossienne No. 1',
    from: 'Gnossiennes',
    publicDomain: true, // shown without the secret (js/songs.js: songVisible)
    composer: 'Erik Satie',
    tempo: 60,
    time: [4, 4],
    key: 'F minor',
    level: 'Beginner → intermediate',
    about: 'Satie wrote this without bar lines and with odd instructions instead of tempo marks ("very shiny", ' +
      '"question", "from the tip of the thought"). The left hand never changes its idea: a low bass note, then a ' +
      'chord on beats 2 and 4, almost always F minor. Over it the right hand plays a few short phrases with grace ' +
      'notes, again and again in a different order. Play it slowly and freely, with the pedal down for each bar.',
    patterns: [
      'Left hand: bass note on 1 (held with the pedal), chord on 2 and 4. F2 + A♭–C–F nearly everywhere; C3 + E♭–G–C once in each A section, B♭1 + F–B♭–D♭ in the "très luisant" bars.',
      'The opening turn C–E♭–D–C (with D natural) comes back many times; it is always answered by a long note with a grace note: B natural, F, or G.',
      'Every phrase ends the same way: G, then F held for a whole bar.',
      'Grace notes are quick, just before the beat: play them lightly and land on the main note.',
      'The naturals (B, D, E) are what give the piece its strange, old-mode colour against the F minor key.',
    ],
    sections: [
      { name: 'Opening', from: 1, to: 9, tip: 'Left hand alone first: bass note, lift, chord on 2 and 4. Then the right hand: the turn C–E♭–D–C, then the long notes with their grace notes. D and B are natural.' },
      { name: 'Opening again', from: 10, to: 18, tip: 'The same nine bars. Listen for the hanging G over the C bass (bar 16) before the melody sinks to F.' },
      { name: 'Très luisant', from: 19, to: 26, tip: 'Loud and bright: B♭ and G with grace A♭s over a B♭ bass, then down to F. The left hand jumps to B♭1: look at it before you play.' },
      { name: 'Questionnez', from: 27, to: 38, tip: 'The run C–D–E–F–G–B–G (D, E, B natural) climbs like a question, then the answer walks down: F, E, C, B, G, F. Twice.' },
      { name: 'Très luisant again', from: 39, to: 46, tip: 'Same as bars 19–26.' },
      { name: 'Du bout de la pensée', from: 47, to: 54, tip: 'The opening turn, each time answered by one long note (B, then F). Let the whole notes ring for the full bar.' },
      { name: 'Très luisant, third time', from: 55, to: 62, tip: 'Same as bars 19–26 again. By now the left hand jump to B♭1 should be automatic.' },
      { name: 'Postulez / Pas à pas', from: 63, to: 74, tip: 'The questionnez phrase twice more. Keep it slow and even: "step by step".' },
      { name: 'Sur la langue', from: 75, to: 82, tip: 'The très luisant bars one last time, ending on F held for a whole bar. Let it fade with the pedal.' },
    ],
    measures: m,
  });
})();
