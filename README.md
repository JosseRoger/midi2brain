# midi2brain

A free piano trainer that runs in your browser. Learn chords, inversions, scales and songs with a MIDI keyboard, your microphone or your computer keyboard.

**[▶ Try it now at midi2brain.com](https://midi2brain.com)**

<!-- TODO: add a screenshot or GIF of the falling notes here -->

## What it does

- **Chords**: an adaptive chord trainer with inversions, progressions, musical keys and ear training. It practises the chords you find hardest more often.
- **Scales**: scale practice with fingering, for either hand or both.
- **Songs**: falling notes with automatic fingering, wait / play / listen / free modes, loops, a tempo control, a metronome and a score for every take.
- **Routine**: pick up to 3 songs and a session length (15 to 60 minutes) and it builds a practice plan. You warm up on the songs' scales and chords, then work on your weak bars hand by hand and speed them up step by step.
- **Chord detector and theory**: names whatever you play, and explains the theory behind it.

The app works with any MIDI keyboard (Web MIDI works in Chrome, Edge and Opera), with an acoustic piano through the microphone, or with just your computer keyboard.

## Songs

The public version includes public-domain pieces only:

- J. S. Bach: Prelude in C major
- Frédéric Chopin: Waltz in A minor
- Erik Satie: Gnossienne No. 1

## Running it locally

There is no build step. Download or clone the repository and open `index.html` in your browser. The microphone and MIDI work best when the folder is served over `http://localhost`, for example with `python -m http.server`.

## Adding a song

Songs are plain JS files in `songs/`, written in a compact bar notation (the syntax is described at the top of `js/songformat.js`). `CLAUDE.md` explains how songs are read from sheet music PDFs with the scripts in `tools/`. Only pieces that are in the public domain can be added.

## Licence

midi2brain is **source-available** under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). You're free to use, study, change and share it for any non-commercial purpose: learning, teaching, personal projects or research. Commercial use needs a separate licence. For that, please contact [feedback@midi2brain.com](mailto:feedback@midi2brain.com).

### Credits

The piano sound is the [Salamander Grand Piano V3](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). It was taken from the MP3s of [Tone.js's Piano](https://github.com/tambien/Piano) and shortened (see `samples/piano/README.md`).
