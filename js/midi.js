'use strict';
// ---------- Web MIDI initialization ----------
// No MIDI (none connected, no permission, or unsupported): offer the microphone via a double tap on the
// display box (see tabs.js). Nothing starts on its own; the offer disappears once the mic or MIDI is in use.
let micOffer = false;
function micOfferPending() { return micOffer && mode !== 'ear' && !micActive && !$('mic-toggle').checked; }
function updateMicOfferHint() { $('mic-offer-hint').hidden = !micOfferPending(); }
function autoMicFallback() { micOffer = true; updateMicOfferHint(); }

function initializeMidi() {
  if (midiStarted) return;
  midiStarted = true;
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(midiAccess => {
      updateMidiState(midiAccess);
      midiAccess.onstatechange = () => updateMidiState(midiAccess);
    }, () => {
      $('midi-text').textContent = 'MIDI unavailable';
      autoMicFallback();
    });
  } else {
    $('midi-text').textContent = 'MIDI unsupported';
    autoMicFallback();
  }
}

function updateMidiState(midiAccess) {
  let inputs = Array.from(midiAccess.inputs.values());
  const status = $('midi-status');
  const text = $('midi-text');
  const btn = $('connect');

  if (inputs.length > 0) {
    status.classList.add('on');
    text.textContent = `${inputs.length} MIDI device(s) connected`;
    btn.hidden = true;
    micOffer = false; updateMicOfferHint();
    inputs.forEach(input => {
      input.onmidimessage = handleMidiMessage;
    });
  } else {
    status.classList.remove('on');
    text.textContent = 'No MIDI device found';
    autoMicFallback();
    btn.hidden = false;
    btn.onclick = () => {
      navigator.requestMIDIAccess({ sysex: true }).then(access => updateMidiState(access));
    };
  }
}

// ---------- start / restart button (Songs tab): a key or controller button that starts and restarts the song ----------
// Set: the next key / button pressed becomes it. In the Songs practice view it is not played as a note: it calls
// songApp.startRestart() (js/songs.js). Saved as `song-midi-button` ({ type: 'note' | 'cc', num }).
let songMidiBtn = null, songMidiLearn = false;
try { songMidiBtn = JSON.parse(localStorage.getItem('song-midi-button')); } catch { /* ignore */ }
function songMidiBtnName(r) {
  if (!r) return 'None';
  return r.type === 'cc' ? `Controller ${r.num}` : `Key ${NAMES[r.num % 12]}${Math.floor(r.num / 12) - 1}`;
}
function updateSongMidiBtnUi() {
  $('song-midi-btn-name').textContent = songMidiLearn ? 'Press a key or button…' : songMidiBtnName(songMidiBtn);
  $('song-midi-btn-learn').textContent = songMidiLearn ? 'Cancel' : 'Set';
  $('song-midi-btn-learn').setAttribute('aria-pressed', String(songMidiLearn));
  $('song-midi-btn-clear').disabled = !songMidiBtn || songMidiLearn;
}
function saveSongMidiBtn(r) {
  songMidiBtn = r; songMidiLearn = false;
  try { localStorage.setItem('song-midi-button', JSON.stringify(r)); } catch { /* ignore */ }
  updateSongMidiBtnUi();
}
$('song-midi-btn-learn').addEventListener('click', () => { songMidiLearn = !songMidiLearn; updateSongMidiBtnUi(); });
$('song-midi-btn-clear').addEventListener('click', () => saveSongMidiBtn(null));
updateSongMidiBtnUi();

// true when the message was the start / restart button (or set it), and is not played
function songMidiBtnMessage(command, num, value) {
  const press = (command === 9 && value > 0) || (command === 11 && num !== 64 && value > 0);
  if (songMidiLearn) {
    if (press) saveSongMidiBtn({ type: command === 9 ? 'note' : 'cc', num });
    return press;
  }
  if (!songMidiBtn || mode !== 'songs') return false;
  const cmd = songMidiBtn.type === 'cc' ? 11 : 9;
  if (command !== cmd || num !== songMidiBtn.num) return false;
  if (value === 0) return cmd === 11; // a controller button let go: nothing (a key let go goes on to noteOff)
  return songApp.startRestart();
}

// ---------- volume knob (Settings → MIDI controls): a slider / knob that moves the Volume slider (js/audio.js) ----------
// Set: the next controller moved becomes it. Its 0..127 spans the Volume slider's range. Saved as `midi-volume-knob`
// ({ num }).
let midiVolume = null, midiVolumeLearn = false;
try { midiVolume = JSON.parse(localStorage.getItem('midi-volume-knob')); } catch { /* ignore */ }
function updateMidiVolumeUi() {
  $('midi-volume-name').textContent = midiVolumeLearn ? 'Move a slider or knob…' : midiVolume ? `Controller ${midiVolume.num}` : 'None';
  $('midi-volume-learn').textContent = midiVolumeLearn ? 'Cancel' : 'Set';
  $('midi-volume-learn').setAttribute('aria-pressed', String(midiVolumeLearn));
  $('midi-volume-clear').disabled = !midiVolume || midiVolumeLearn;
}
function saveMidiVolume(r) {
  midiVolume = r; midiVolumeLearn = false;
  try { localStorage.setItem('midi-volume-knob', JSON.stringify(r)); } catch { /* ignore */ }
  updateMidiVolumeUi();
}
$('midi-volume-learn').addEventListener('click', () => { midiVolumeLearn = !midiVolumeLearn; updateMidiVolumeUi(); });
$('midi-volume-clear').addEventListener('click', () => saveMidiVolume(null));
updateMidiVolumeUi();

// true when the message was the volume knob (or set it)
function midiVolumeMessage(command, num, value) {
  if (command !== 11 || num === 64) return false; // controllers only, not the sustain pedal
  if (midiVolumeLearn) { saveMidiVolume({ num }); return true; }
  if (!midiVolume || num !== midiVolume.num) return false;
  const slider = $('volume');
  if (slider) {
    slider.value = +slider.min + (+slider.max - +slider.min) * value / 127;
    slider.dispatchEvent(new Event('input')); // saves it and sets the gain
  }
  return true;
}

function handleMidiMessage(event) {
  const [status, note, velocity] = event.data;
  const command = status >> 4;
  const channel = status & 0xf;
  if (midiVolumeMessage(command, note, velocity)) return;
  if (songMidiBtnMessage(command, note, velocity)) return;

  if (command === 9 && velocity > 0) {
    setInputDevice('midi'); noteOn(note, true, velocity / 127);
  } else if (command === 8 || (command === 9 && velocity === 0)) {
    noteOff(note);
  } else if (command === 11 && note === 64) { // control change 64: sustain pedal (value ≥ 64 = down)
    setSustain(velocity >= 64);
  }
}

