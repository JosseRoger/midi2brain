# Piano samples

Salamander Grand Piano V3 by Alexander Holm, licensed under CC-BY 3.0
(https://creativecommons.org/licenses/by/3.0/). One recording every three semitones, A0 to C8, in four of its
sixteen velocity layers (v4, v8, v12, v16; `<note>v<layer>.mp3`), cut to 10 s. Downloaded from the full-length MP3s
of Tone.js's Piano (https://github.com/tambien/Piano) by `tools/piano-samples.ps1`.
Used by `startSampledPiano` in js/audio.js.

`rel<midi>.mp3` (A0 = 21 to C8 = 108): the key-release noises (the damper landing), Salamander's rel1..rel88 from the
same source, downloaded by `tools/piano-samples.ps1 -release`. Played by `playPianoRelease` in js/audio.js.
