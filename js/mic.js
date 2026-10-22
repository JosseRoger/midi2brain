'use strict';
let micStream = null;
let micSource = null;
let micAnalyser = null;
let micMutedGain = null;
let micBuffer = null;
let micPitchBuffer = null;
let micFrequencyBuffer = null;
let micNoiseSpectrum = null;
let micNoiseSpectrumFrames = 0;
let micActive = false;
let micFrameId = 0;
let micLastFrameTime = 0;
let micPhase = 'off';
let micNoiseStartedAt = 0;
let micNoisePrompted = false;
let micNoiseSamples = [];
let micNoiseThreshold = 0.004;
let micTuningCorrection = 0;
let micCalibrationCandidate = null;
let micCalibrationFrames = 0;
let micSilentFrames = 0;
const micActiveNotes = new Set();
const micNoteStates = new Map();

function formatMicNote(midiValue) {
  const note = Math.round(midiValue);
  return `${NAMES[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`;
}

function releaseAllMicNotes() {
  micActiveNotes.forEach(note => noteOff(note, false));
  micActiveNotes.clear();
  micNoteStates.clear();
  resetMicTake();
  micSilentFrames = 0;
}

function updateMicStatus(message) {
  $('mic-status').textContent = message;
}

function getMicSensitivity() {
  return +$('mic-sensitivity').value;
}

function updateMicSensitivityLabel() {
  $('mic-sensitivity').setAttribute('aria-valuetext', `${getMicSensitivity()} / 10`);
  $('mic-calibration-sensitivity').setAttribute('aria-valuetext', `${getMicSensitivity()} / 10`);
}

function updateMicLevelDisplay() {
  if (!micBuffer) return;
  let energy = 0;
  for (let index = 0; index < micBuffer.length; index++) energy += micBuffer[index] * micBuffer[index];
  const rms = Math.sqrt(energy / micBuffer.length);
  const decibels = Math.max(-60, Math.min(0, 20 * Math.log10(Math.max(rms, 0.001))));
  const percent = Math.round(((decibels + 60) / 60) * 100);
  [
    ['mic-level-meter', 'mic-level-fill', 'mic-level-value'],
    ['mic-calibration-level-meter', 'mic-calibration-level-fill', 'mic-calibration-level-value'],
  ].forEach(([meterId, fillId, valueId]) => {
    const meter = $(meterId);
    const fill = $(fillId);
    const value = $(valueId);
    if (!meter || !fill || !value) return;
    fill.style.width = `${percent}%`;
    fill.classList.toggle('active', percent >= 70);
    meter.setAttribute('aria-valuenow', String(percent));
    value.textContent = `${Math.round(decibels)} dB`;
  });
}

function resetMicLevelDisplay() {
  ['mic-level-fill', 'mic-calibration-level-fill'].forEach(id => {
    const fill = $(id);
    if (fill) { fill.style.width = '0%'; fill.classList.remove('active'); }
  });
  ['mic-level-meter', 'mic-calibration-level-meter'].forEach(id => {
    const meter = $(id);
    if (meter) meter.setAttribute('aria-valuenow', '0');
  });
  ['mic-level-value', 'mic-calibration-level-value'].forEach(id => {
    const value = $(id);
    if (value) value.textContent = '-60 dB';
  });
}

$('mic-sensitivity').addEventListener('input', () => {
  $('mic-calibration-sensitivity').value = $('mic-sensitivity').value;
  updateMicSensitivityLabel();
});
$('mic-calibration-sensitivity').addEventListener('input', () => {
  $('mic-sensitivity').value = $('mic-calibration-sensitivity').value;
  updateMicSensitivityLabel();
});
updateMicSensitivityLabel();

function finishMicNoiseCalibration() {
  micNoiseSamples.sort((a, b) => a - b);
  const noiseFloor = micNoiseSamples[Math.floor(micNoiseSamples.length / 2)] || 0;
  micNoiseThreshold = Math.max(0.005, Math.min(0.06, noiseFloor * 4.2 + 0.005));
  for (let bin = 1; bin < micNoiseSpectrum.length; bin++) {
    const averageAmplitude = micNoiseSpectrum[bin] / Math.max(1, micNoiseSpectrumFrames);
    micNoiseSpectrum[bin] = 20 * Math.log10(averageAmplitude + 1e-8);
  }
  micPhase = 'reference-c4';
  micCalibrationCandidate = null;
  micCalibrationFrames = 0;
  $('mic-calibration-instruction').textContent = 'Quiet baseline captured. Hold C4 steady for a moment to confirm it.';
  updateMicStatus('Quiet baseline captured. Hold C4 steady to confirm it.');
}

function finishMicCalibration() {
  micPhase = 'ready';
  micSilentFrames = 0;
  $('mic-calibrate').hidden = false;
  $('mic-calibration-note').textContent = 'Calibration complete';
  $('mic-calibration-instruction').textContent = 'Calibration complete. Microphone practice is ready.';
  $('mic-calibration-gate').hidden = true;
  updateMicStatus('Calibrated. Microphone notes now act like keyboard or MIDI input.');
}

function beginMicCalibration() {
  if (!micActive) return;
  releaseAllMicNotes();
  micPhase = 'noise';
  micNoiseSamples = [];
  micNoiseSpectrum = new Float32Array(micAnalyser.frequencyBinCount);
  micNoiseSpectrumFrames = 0;
  micNoiseStartedAt = performance.now();
  micNoisePrompted = false;
  micNoiseThreshold = 0.003;
  micTuningCorrection = 0;
  micCalibrationCandidate = null;
  micCalibrationFrames = 0;
  $('mic-calibrate').hidden = true;
  updateMicStatus('Stay quiet while the microphone measures room noise.');
  $('mic-calibration-title').textContent = 'Microphone calibration';
  $('mic-calibration-instruction').textContent = 'Stay quiet while the microphone measures room noise. You will be asked to play C4 when there is enough silence.';
  $('mic-calibration-note').textContent = '';
  $('mic-calibration-retry').hidden = true;
  $('mic-calibration-gate').hidden = false;
}

function estimateMicPitch() {
  const samples = micPitchBuffer;
  for (let index = 0; index < samples.length; index++) samples[index] = micBuffer[index * 4];
  let mean = 0;
  for (let index = 0; index < samples.length; index++) mean += samples[index];
  mean /= samples.length;

  let energy = 0;
  for (let index = 0; index < samples.length; index++) {
    const centered = samples[index] - mean;
    energy += centered * centered;
  }
  const rms = Math.sqrt(energy / samples.length);
  const sensitivity = getMicSensitivity();
  const noiseMultiplier = 1.55 - ((sensitivity - 1) / 9) * .9;
  if (rms < micNoiseThreshold * noiseMultiplier) return { rms, frequency: 0, clarity: 0 };

  const sampleRate = audioCtx.sampleRate / 4;
  const minLag = Math.max(2, Math.floor(sampleRate / 1000));
  const maxLag = Math.min(Math.floor(sampleRate / 65), samples.length - 2);
  const correlations = new Float32Array(maxLag + 1);
  let bestLag = 0;
  let bestClarity = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    for (let index = 0; index < samples.length - lag; index++) {
      correlation += (samples[index] - mean) * (samples[index + lag] - mean);
    }
    const clarity = correlation / energy;
    correlations[lag] = clarity;
    if (clarity > bestClarity) {
      bestClarity = clarity;
      bestLag = lag;
    }
  }

  if (bestLag === 0 || bestClarity < 0.86) return { rms, frequency: 0, clarity: bestClarity };
  const previous = correlations[bestLag - 1] || bestClarity;
  const current = correlations[bestLag];
  const next = correlations[bestLag + 1] || current;
  const curve = previous - 2 * current + next;
  const adjustment = curve === 0 ? 0 : 0.5 * (previous - next) / curve;
  const refinedLag = bestLag + Math.max(-0.5, Math.min(0.5, adjustment));
  return { rms, frequency: sampleRate / refinedLag, clarity: bestClarity };
}

function getMicBandLevels(frequency) {
  const binWidth = audioCtx.sampleRate / micAnalyser.fftSize;
  const centerBin = Math.round(frequency / binWidth);
  const radius = Math.max(1, Math.round(centerBin * .006));
  let peakDb = -Infinity;
  let noiseDb = -100;
  for (let bin = Math.max(1, centerBin - radius); bin <= Math.min(micFrequencyBuffer.length - 1, centerBin + radius); bin++) {
    peakDb = Math.max(peakDb, micFrequencyBuffer[bin]);
    noiseDb = Math.max(noiseDb, micNoiseSpectrum?.[bin] ?? -100);
  }
  return { peakDb, noiseDb };
}

function detectMicNotes() {
  micAnalyser.getFloatFrequencyData(micFrequencyBuffer);
  const noteCandidates = [];
  const sensitivity = getMicSensitivity();
  const minimumPeakDb = -48 - sensitivity * 2;
  const minimumNoiseMarginDb = 20 - sensitivity * 1.1;
  const minimumNeighborMarginDb = 15 - sensitivity * .7;
  const minimumHarmonicClarityDb = 20 - sensitivity * .8;
  const overtoneSuppressionMarginDb = 16 - sensitivity;

  for (let note = 21; note <= 108; note++) {
    const fundamentalFrequency = 440 * Math.pow(2, (note - micTuningCorrection - 69) / 12);
    const fundamental = getMicBandLevels(fundamentalFrequency);
    if (fundamental.peakDb < minimumPeakDb || fundamental.peakDb - fundamental.noiseDb < minimumNoiseMarginDb) continue;
    const lowerSemitone = getMicBandLevels(fundamentalFrequency * Math.pow(2, -1 / 12));
    const upperSemitone = getMicBandLevels(fundamentalFrequency * Math.pow(2, 1 / 12));
    if (fundamental.peakDb < Math.max(lowerSemitone.peakDb, upperSemitone.peakDb) - minimumNeighborMarginDb) continue;

    let signalEnergy = 0;
    let noiseEnergy = 0;
    for (let harmonic = 1; harmonic <= 6; harmonic++) {
      const harmonicFrequency = fundamentalFrequency * harmonic;
      if (harmonicFrequency >= audioCtx.sampleRate * .48) break;
      const levels = harmonic === 1 ? fundamental : getMicBandLevels(harmonicFrequency);
      const weight = 1 / Math.pow(harmonic, 1.2);
      signalEnergy += Math.pow(10, levels.peakDb / 20) * weight;
      noiseEnergy += Math.pow(10, levels.noiseDb / 20) * weight;
    }
    const harmonicClarityDb = 20 * Math.log10((signalEnergy + 1e-8) / (noiseEnergy + 1e-8));
    if (harmonicClarityDb >= minimumHarmonicClarityDb) {
      noteCandidates.push({ note, fundamentalDb: fundamental.peakDb, harmonicClarityDb });
    }
  }

  noteCandidates.sort((a, b) => a.note - b.note);
  const detectedNotes = new Set();
  noteCandidates.forEach(candidate => {
    const explainedByLowerNote = noteCandidates.some(lower => {
      if (lower.note >= candidate.note || lower.fundamentalDb < candidate.fundamentalDb + overtoneSuppressionMarginDb) return false;
      const ratio = Math.pow(2, (candidate.note - lower.note) / 12);
      const harmonic = Math.round(ratio);
      return harmonic >= 2 && harmonic <= 6 && Math.abs(ratio - harmonic) / harmonic < .02;
    });
    if (!explainedByLowerNote) detectedNotes.add(candidate.note);
  });
  return detectedNotes;
}

// Mic note correction, assuming the player plays the right notes:
// - a note an octave (or more) off a target note counts as that target note;
// - intervals that keep showing up above correctly heard notes are learned as overtones and dropped.
// Learned counts persist in localStorage so it improves over sessions.
const MIC_LEARNABLE = [16, 19, 28, 31, 34]; // only intervals above an octave: a wrong note a 5th up must still count as wrong
const micOvertoneStats = (() => { try { return JSON.parse(localStorage.getItem('micOvertones')) || { frames: 0 }; } catch { return { frames: 0 }; } })();
function isLearnedOvertone(k) {
  const seen = micOvertoneStats[k] || 0;
  return seen >= 40 && seen / Math.max(1, micOvertoneStats.frames) > .05;
}
function micExpectedNotes() {
  if ((mode === 'chords' || mode === 'ear') && target) return [...targetExactNotes()];
  if (mode === 'songs') return songApp.expectedNotes(); // the song's next notes (and the ones just played)
  if (mode === 'scales' && sTarget) {
    // Next expected note first, so octave-shifted notes snap to it before other scale notes.
    const base = currentAnchor + sTarget.root, both = getSelectedHands().both;
    const offs = [sTarget.seq[Math.min(sProgress, sTarget.seq.length - 1)], ...sTarget.seq].map(s => s.off);
    return [...new Set(offs.flatMap(off => both ? [base + off, base + off + handsGap] : [base + off]))];
  }
  return [];
}
function correctMicNotes(detected) {
  const expected = micExpectedNotes();
  if (!expected.length) return detected;
  const out = new Set(), unexplained = [];
  detected.forEach(n => {
    if (expected.includes(n)) { out.add(n); return; }
    const matches = expected.filter(e => (n - e) % 12 === 0);
    const octave = mode === 'scales' ? matches[0] : matches.sort((a, b) => Math.abs(a - n) - Math.abs(b - n))[0];
    if (octave !== undefined) out.add(octave); else unexplained.push(n);
  });
  if (out.size && ++micOvertoneStats.frames % 300 === 0) { try { localStorage.setItem('micOvertones', JSON.stringify(micOvertoneStats)); } catch {} }
  unexplained.forEach(n => {
    const ks = [...out].map(e => n - e).filter(k => MIC_LEARNABLE.includes(k));
    ks.forEach(k => { micOvertoneStats[k] = (micOvertoneStats[k] || 0) + 1; });
    if (!ks.some(isLearnedOvertone)) out.add(n);
  });
  return out;
}

function updateMicHeldNotes(detectedNotes) {
  detectedNotes = correctMicNotes(detectedNotes);
  const sensitivity = getMicSensitivity();
  const requiredAttackFrames = Math.round(14 - sensitivity * .6);
  const requiredReleaseFrames = Math.round(13 - sensitivity * .5);
  const notesToUpdate = new Set([...detectedNotes, ...micActiveNotes]);
  notesToUpdate.forEach(note => {
    const state = micNoteStates.get(note) || { active: false, attackFrames: 0, releaseFrames: 0 };
    if (detectedNotes.has(note)) {
      state.attackFrames++;
      state.releaseFrames = 0;
      if (!state.active && state.attackFrames >= requiredAttackFrames) {
        state.active = true;
        micActiveNotes.add(note);
        setInputDevice('mic'); noteOn(note, false);
      }
    } else {
      state.attackFrames = 0;
      if (state.active) {
        state.releaseFrames++;
        if (state.releaseFrames >= requiredReleaseFrames) {
          state.active = false;
          state.releaseFrames = 0;
          micActiveNotes.delete(note);
          noteOff(note, false);
        }
      }
    }
    if (state.active || state.attackFrames || state.releaseFrames) micNoteStates.set(note, state);
    else micNoteStates.delete(note);
  });

}

function acceptMicReference(midiValue, expectedMidi) {
  const detectedMidi = Math.round(midiValue);
  if (detectedMidi !== expectedMidi) {
    micCalibrationCandidate = null;
    micCalibrationFrames = 0;
    updateMicStatus(`Heard ${formatMicNote(midiValue)}. Play ${formatMicNote(expectedMidi)} and hold it briefly.`);
    $('mic-calibration-instruction').textContent = `Heard ${formatMicNote(midiValue)}. Play ${formatMicNote(expectedMidi)} and hold it steady.`;
    $('mic-calibration-note').textContent = `${formatMicNote(midiValue)} detected`;
    return;
  }

  if (micCalibrationCandidate === detectedMidi) micCalibrationFrames++;
  else { micCalibrationCandidate = detectedMidi; micCalibrationFrames = 1; }

  $('mic-calibration-note').textContent = `${formatMicNote(midiValue)} detected`;
  if (micCalibrationFrames < 8) {
    $('mic-calibration-instruction').textContent = `Hold ${formatMicNote(expectedMidi)} steady for a moment.`;
    return;
  }
  micCalibrationCandidate = null;
  micCalibrationFrames = 0;
  if (expectedMidi === 60) {
    micTuningCorrection = 60 - midiValue;
    micPhase = 'reference-c5';
    $('mic-calibration-instruction').textContent = 'C4 confirmed. Now play C5 and hold it steady to check octave detection.';
    $('mic-calibration-note').textContent = 'C4 confirmed';
    updateMicStatus('C4 looks good. Now play C5 to check octave detection.');
  } else {
    micPhase = 'release-c5';
    micSilentFrames = 0;
    $('mic-calibration-instruction').textContent = 'C5 confirmed. Release the key; the screen will clear after the microphone hears silence.';
    $('mic-calibration-note').textContent = 'C5 confirmed';
    updateMicStatus('Release C5 to finish calibration.');
  }
}

// ---- Scale mode (one hand): record the whole take, then judge it against the scale ----
// Heard notes are tracked per MIDI number (so an overtone can't hide a real note of the same name),
// ordered by when they started, then aligned to the scale by pitch name (octaves don't matter).
// Live progress is shown while playing; pass/fail is only decided once the take ends (silence).
const TAKE_END_SILENCE_MS = 1000, TAKE_MIN_NOTE_MS = 60, TAKE_WRONG_MIN_MS = 150, TAKE_PASS_RATIO = .85;
const micTake = { active: false, open: new Map(), events: [], lastSoundAt: 0, startedAt: 0, shown: '' };

function resetMicTake() { micTake.active = false; micTake.open.clear(); micTake.events = []; micTake.shown = ''; }

// Longest in-order match of heard pitch classes against the scale.
function alignTake(expectedPcs, heardPcs) {
  const m = expectedPcs.length, n = heardPcs.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    dp[i][j] = expectedPcs[i - 1] === heardPcs[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  }
  const matched = [], usedHeard = new Set();
  for (let i = m, j = n; i && j;) {
    if (expectedPcs[i - 1] === heardPcs[j - 1]) { matched.unshift(i - 1); usedHeard.add(j - 1); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return { matched, usedHeard };
}

function scoreTake(now) {
  const open = [...micTake.open].filter(([, start]) => now - start >= TAKE_MIN_NOTE_MS).map(([midi, start]) => ({ midi, start, end: now }));
  const heard = [...micTake.events, ...open].sort((a, b) => a.start - b.start);
  const base = currentAnchor + sTarget.root;
  const expected = sTarget.seq.map(s => base + s.off);
  const { matched, usedHeard } = alignTake(expected.map(n => n % 12), heard.map(e => e.midi % 12));
  // Unmatched notes count as wrong only if they lasted, and don't look like an overtone of a matched note struck at the same time.
  const wrong = heard.filter((e, j) => !usedHeard.has(j) && e.end - e.start >= TAKE_WRONG_MIN_MS
    && !heard.some((o, k) => usedHeard.has(k) && e.midi > o.midi && Math.abs(e.start - o.start) < 120));
  return { expected, matched, wrong };
}

function showTakeProgress(r) {
  const key = r.matched.join(',');
  if (key === micTake.shown) return;
  micTake.shown = key;
  sProgress = r.matched.length ? r.matched[r.matched.length - 1] + 1 : 0;
  sPlayed = r.matched.map(i => r.expected[i]);
  hintEl.textContent = `Listening… ${r.matched.length}/${r.expected.length} notes`;
  drawTarget();
}

function finishTake(r) {
  resetMicTake();
  const m = r.expected.length;
  if (r.matched.length / m >= TAKE_PASS_RATIO) {
    sProgress = m; sPlayed = r.expected.slice();
    locked = true; lockedAt = Date.now();
    setState('ok'); hintEl.textContent = `Correct, heard ${r.matched.length}/${m} notes`;
    if ($('opt-scale-smart-practice')?.checked) {
      r.wrong.forEach(e => recordMiss(sTarget, [e.midi], r.expected, false, 'take:'));
      sTarget.shownAt += TAKE_END_SILENCE_MS; // don't count the end-of-take silence as playing time
      const key = `${sTarget.root}_${sTarget.type.name}`;
      const currentW = scaleWeights[key] || 0;
      const s = settleScore(sTarget, m * 500, m * 1200);
      scaleWeights[key] = Math.max(0, Math.min(MAX_PROGRESS, currentW + s.delta));
      renderScalePool();
      showScoreChip(document.querySelector(`#scale-pool .chord-chip[data-root="${sTarget.root}"][data-scale="${CSS.escape(sTarget.type.name)}"]`), s, currentW, scaleWeights[key]);
    }
    drawTarget();
    tryAdvance();
  } else {
    sTarget.attempts++;
    const missed = [...new Set(r.expected.filter((_, i) => !r.matched.includes(i)).map(n => NAMES[n % 12]))];
    sProgress = 0; sPlayed = [];
    setState('bad');
    hintEl.textContent = `Heard ${r.matched.length}/${m} notes in order${missed.length ? ' · missed ' + missed.join(' ') : ''}. Try again`;
    drawTarget();
  }
}

function processMicScaleFrame(now) {
  if (micTake.target !== sTarget) { resetMicTake(); micTake.target = sTarget; }
  if (!sTarget || locked) { resetMicTake(); return; }
  const detected = detectMicNotes();
  detected.forEach(n => { if (!micTake.open.has(n)) micTake.open.set(n, now); });
  micTake.open.forEach((start, n) => {
    if (detected.has(n)) return;
    micTake.open.delete(n);
    if (now - start >= TAKE_MIN_NOTE_MS) micTake.events.push({ midi: n, start, end: now });
  });
  if (detected.size) {
    if (!micTake.active) {
      micTake.active = true; micTake.startedAt = now;
      setInputDevice('mic'); setState('');
    }
    micTake.lastSoundAt = now;
  }
  if (!micTake.active) return;
  const r = scoreTake(now);
  showTakeProgress(r);
  if (now - micTake.lastSoundAt >= TAKE_END_SILENCE_MS || now - micTake.startedAt > r.expected.length * 2000 + 5000) finishTake(r);
}

function processMicFrame(timestamp) {
  if (!micActive || !micAnalyser) return;
  if (timestamp - micLastFrameTime < 40) {
    micFrameId = requestAnimationFrame(processMicFrame);
    return;
  }
  micLastFrameTime = timestamp;
  micAnalyser.getFloatTimeDomainData(micBuffer);
  updateMicLevelDisplay();

  if (micPhase === 'noise') {
    const elapsedQuietTime = timestamp - micNoiseStartedAt;
    const pitch = estimateMicPitch();
    if (elapsedQuietTime >= 1800 && !micNoisePrompted) {
      micNoisePrompted = true;
      $('mic-calibration-instruction').textContent = 'Now play middle C (C4) and hold it steady. Keep the room quiet until you play it.';
      updateMicStatus('Now play C4. Listening for the reference note while continuing to measure silence.');
    }

    if (micNoisePrompted && pitch.frequency > 0 && pitch.clarity >= 0.86) {
      const rawMidiValue = 69 + 12 * Math.log2(pitch.frequency / 440);
      const detectedMidi = Math.round(rawMidiValue);
      if (detectedMidi === 60) {
        if (micCalibrationCandidate === detectedMidi) micCalibrationFrames++;
        else { micCalibrationCandidate = detectedMidi; micCalibrationFrames = 1; }
        $('mic-calibration-note').textContent = `C4 detected (${micCalibrationFrames}/8)`;
        if (micCalibrationFrames >= 8) {
          finishMicNoiseCalibration();
          acceptMicReference(rawMidiValue, 60);
        }
      } else {
        micCalibrationCandidate = null;
        micCalibrationFrames = 0;
        $('mic-calibration-note').textContent = `${formatMicNote(rawMidiValue)} heard; still waiting for C4`;
      }
    } else {
      micCalibrationCandidate = null;
      micCalibrationFrames = 0;
      if (pitch.frequency === 0) {
        micNoiseSamples.push(pitch.rms);
        micAnalyser.getFloatFrequencyData(micFrequencyBuffer);
        for (let bin = 1; bin < micFrequencyBuffer.length; bin++) {
          micNoiseSpectrum[bin] += Math.pow(10, micFrequencyBuffer[bin] / 20);
        }
        micNoiseSpectrumFrames++;
      }
    }
    micFrameId = requestAnimationFrame(processMicFrame);
    return;
  }

  if (micPhase === 'release-c5') {
    const { rms } = estimateMicPitch();
    micSilentFrames = rms < micNoiseThreshold ? micSilentFrames + 1 : 0;
    if (micSilentFrames >= 6) finishMicCalibration();
    micFrameId = requestAnimationFrame(processMicFrame);
    return;
  }

  if (micPhase === 'ready') {
    if (mode === 'scales' && !getSelectedHands().both) processMicScaleFrame(timestamp);
    else { resetMicTake(); updateMicHeldNotes(detectMicNotes()); }
    micFrameId = requestAnimationFrame(processMicFrame);
    return;
  }

  const { frequency, clarity } = estimateMicPitch();
  if (frequency > 0 && clarity >= 0.78) {
    const rawMidiValue = 69 + 12 * Math.log2(frequency / 440);
    if (micPhase === 'reference-c4') acceptMicReference(rawMidiValue, 60);
    else if (micPhase === 'reference-c5') acceptMicReference(rawMidiValue + micTuningCorrection, 72);
  } else if (micPhase === 'reference-c4' || micPhase === 'reference-c5') {
    micCalibrationCandidate = null;
    micCalibrationFrames = 0;
    $('mic-calibration-note').textContent = '';
  }

  micFrameId = requestAnimationFrame(processMicFrame);
}

async function startMicInput() {
  if ((mode === 'theory' || mode === 'contact')) {
    updateMicStatus('Microphone input is available in Chords, Scales, Ear Training, and Detector.');
    return;
  }
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    updateMicStatus('Microphone access requires HTTPS or localhost in a supported browser.');
    return;
  }

  $('mic-toggle').disabled = true;
  $('mic-calibration-gate').hidden = false;
  $('mic-calibration-title').textContent = 'Microphone calibration';
  $('mic-calibration-instruction').textContent = 'Allow microphone access, then follow the quiet, C4, and C5 checks.';
  $('mic-calibration-note').textContent = '';
  $('mic-calibration-retry').hidden = true;
  updateMicStatus('Requesting microphone permission...');
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false },
    });
    if ((mode === 'theory' || mode === 'contact')) {
      micStream.getTracks().forEach(track => track.stop());
      micStream = null;
      $('mic-calibration-gate').hidden = true;
      updateMicStatus('Microphone input is available in Chords, Scales, Ear Training, and Detector.');
      return;
    }
    initAudio();
    if (!audioCtx) throw new Error('Web Audio is unavailable in this browser.');
    if (audioCtx.state !== 'running') await audioCtx.resume();
    if ((mode === 'theory' || mode === 'contact')) {
      micStream.getTracks().forEach(track => track.stop());
      micStream = null;
      $('mic-calibration-gate').hidden = true;
      updateMicStatus('Microphone input is available in Chords, Scales, Ear Training, and Detector.');
      return;
    }

    micSource = audioCtx.createMediaStreamSource(micStream);
    micAnalyser = audioCtx.createAnalyser();
    micAnalyser.fftSize = 16384;
    micAnalyser.smoothingTimeConstant = 0;
    micAnalyser.minDecibels = -100;
    micAnalyser.maxDecibels = -10;
    micMutedGain = audioCtx.createGain();
    micMutedGain.gain.value = 0;
    micBuffer = new Float32Array(micAnalyser.fftSize);
    micPitchBuffer = new Float32Array(micAnalyser.fftSize / 4);
    micFrequencyBuffer = new Float32Array(micAnalyser.frequencyBinCount);
    micSource.connect(micAnalyser);
    micAnalyser.connect(micMutedGain);
    micMutedGain.connect(audioCtx.destination);

    micActive = true;
    $('mic-toggle').checked = true;
    beginMicCalibration();
    micLastFrameTime = 0;
    micFrameId = requestAnimationFrame(processMicFrame);
  } catch (error) {
    micStream?.getTracks().forEach(track => track.stop());
    micStream = null;
    const errorMessage = error.name === 'NotAllowedError'
      ? 'Microphone permission was denied. Allow it in the browser to continue.'
      : `Could not start the microphone: ${error.message}`;
    $('mic-calibration-title').textContent = 'Microphone access needed';
    $('mic-calibration-instruction').textContent = errorMessage;
    $('mic-calibration-note').textContent = '';
    $('mic-calibration-retry').hidden = false;
    $('mic-toggle').checked = false;
    updateMicStatus(errorMessage);
  } finally {
    $('mic-toggle').disabled = false;
  }
}

function stopMicInput() {
  micActive = false;
  if (micFrameId) cancelAnimationFrame(micFrameId);
  releaseAllMicNotes();
  micSource?.disconnect();
  micAnalyser?.disconnect();
  micMutedGain?.disconnect();
  micStream?.getTracks().forEach(track => track.stop());
  micStream = null;
  micSource = null;
  micAnalyser = null;
  micMutedGain = null;
  micBuffer = null;
  micPitchBuffer = null;
  micFrequencyBuffer = null;
  micNoiseSpectrum = null;
  micPhase = 'off';
  ['mic-level-fill', 'mic-calibration-level-fill'].forEach(id => {
    const fill = $(id);
    if (fill) { fill.style.width = '0%'; fill.classList.remove('active'); }
  });
  ['mic-level-meter', 'mic-calibration-level-meter'].forEach(id => {
    const meter = $(id);
    if (meter) meter.setAttribute('aria-valuenow', '0');
  });
  ['mic-level-value', 'mic-calibration-level-value'].forEach(id => {
    const value = $(id);
    if (value) value.textContent = '-60 dB';
  });
  $('mic-calibration-gate').hidden = true;
  $('mic-toggle').checked = false;
  $('mic-calibrate').hidden = true;
  updateMicStatus('Microphone is off.');
}

$('mic-toggle').addEventListener('change', () => {
  if ($('mic-toggle').checked && !micActive) startMicInput();
  else if (!$('mic-toggle').checked && micActive) stopMicInput();
});
$('mic-calibrate').addEventListener('click', beginMicCalibration);
$('mic-calibration-retry').addEventListener('click', startMicInput);
$('mic-calibration-gate').addEventListener('click', event => {
  if (event.target !== $('mic-calibration-gate')) return;
  if (micActive) stopMicInput();
  else $('mic-calibration-gate').hidden = true;
});

