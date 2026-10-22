'use strict';
// ---------- practice routine (Routine tab) ----------
// Pick up to 3 songs and a length (15 / 30 / 45 / 60 min); the routine builds a session and drives the other tabs:
//   1. warm-up, scales: each song's key scale, right hand, left hand, then both (Scales tab)
//   2. warm-up, chords: each song's main chords, in the order the song plays them, grouped by song (Chords tab)
//   3. per song (Songs tab, all through songApp.routine in js/songs.js):
//      - a run: the song (or, when it does not fit, its next / weakest section) once, which finds the weak bars
//      - chunks: the weak bars merged into chunks of 1-4 bars, worst first, each through stages:
//        one hand alone (wait mode) → hands together (wait) → tempo ladder (wait mode: REPS clean passes in a row
//        → 5% faster, a mistake → 5% slower, up to the session's goal speed) → in context (a bar either side)
//        Notes first: until you have played every bar of the song with the right notes, no tempo ladder and no
//        speed-ups, and only the notes count (notesKnown / notesRight, routine-song-<id>.notesBars).
//        After every pass the notes go back to where the next one starts and wait for you. The chunks go in song
//        order, each until it is done or set aside, so you always know where you are.
//      - a final run of the same bars, to compare with the first
//   4. a summary, saved per song (routine-song-<id>) so the next session carries on.
// Level, per song, from the Songs tab (its bar progress and the last take per hand, songs-takes-<id>):
//   new   → learn a section hands separately, then together;   hands → hands known alone: together, slowly;
//   known → both hands from the start, run at your speed. Playing a song through in the Songs tab calibrates this.
// Less time asks for less: fewer clean repetitions, a lower bar for "fixed", fewer chunks (PROFILE).
// Research behind it: expert pianists' practice (find the exact error, vary the tempo on purpose, repeat until it is
// stable: Duke, Simmons & Cash 2009), tempo ladders, chunking, interleaving, hands separately then together,
// warm-up → technique → repertoire → play-through.
const routineApp = (() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DURATIONS = [15, 30, 45, 60];
  // per session length: warm-up minutes, clean passes in a row that count, the take score that counts as fixed,
  // chunks worked on per song, main chords per song, a final run, one weak hand practised alone
  const PROFILE = {
    15: { warm: 2, reps: 1, fixed: 80, chunks: 2, chords: 3, finalRun: false, isolate: false, turn: 3 },
    30: { warm: 4, reps: 2, fixed: 85, chunks: 3, chords: 4, finalRun: true, isolate: true, turn: 4 },
    45: { warm: 6, reps: 2, fixed: 90, chunks: 4, chords: 5, finalRun: true, isolate: true, turn: 4 },
    60: { warm: 8, reps: 3, fixed: 95, chunks: 6, chords: 6, finalRun: true, isolate: true, turn: 4 },
  };
  const MAX_SONGS = 3;
  const SONG_MIN_MINUTES = 6;  // a song gets at least this much, else it waits for the next session
  const LEVEL_PROGRESS = 0.35; // Songs tab bar progress (0..1) that counts as "plays it"
  const LEVEL_TAKE = 70;       // or a last take of at least this score…
  const LEVEL_COVER = 0.5;     // …over at least half the song
  const SPEED_STEP = 0.05;
  const SPEED_MIN = 0.5;        // the slowest the routine ever asks for (a failed pass never slows you below it)
  const FAIL_LIMIT = 3;         // failed passes in a row on a part: set it aside, on to the next (back next session)
  const OVERTIME = 60;         // seconds a warm-up block may run over before it moves on by itself
  const CONTEXT_MAX_PASSES = 3;
  const CONTINUE_SEC = 180;     // a song with this much of its time left after its final run goes on (next section)
  const LEARN_STAGES = 3;       // new song: a chunk goes through 3 stages (each hand, together; tempo comes later)…
  const LEARN_SLACK = 1.5;      // …of REPS clean passes, plus this many passes for slips

  const setupKey = 'routine-setup';
  const songKey = id => 'routine-song-' + id;
  const load = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

  let setup = load(setupKey, { songs: [], duration: 30 });
  if (!DURATIONS.includes(setup.duration)) setup.duration = 30;
  let R = null; // the running routine

  // ---------- the song's level and speed ----------
  function levelOf(song) {
    const p = songApp.routine.progress(song), t = songApp.routine.takes(song);
    const good = k => t[k] && t[k].score >= LEVEL_TAKE && t[k].coverage >= LEVEL_COVER;
    if (p.both >= LEVEL_PROGRESS || good('both')) return 'known';
    if ((p.rh >= LEVEL_PROGRESS || good('rh')) && (p.lh >= LEVEL_PROGRESS || good('lh'))) return 'hands';
    return 'new';
  }
  const LEVEL_TEXT = {
    new: ['new to you', 'learn it hands separately, then together'],
    hands: ['hands learnt', 'both hands together, slowly'],
    known: ['you play it', 'both hands from the start'],
  };
  // the speed the session starts at: the last good speed of a routine, a good take's speed, or a guess by level
  function startSpeed(song, level) {
    const mem = load(songKey(song.id), {});
    if (mem.speed) return mem.speed;
    const t = songApp.routine.takes(song).both;
    if (level === 'known' && t && t.score >= LEVEL_TAKE) return clampSpeed(t.score >= 85 ? t.speed : t.speed - 0.1);
    const lv = /^beginner$/i.test(song.level || '') ? 0.05 : /intermediate/i.test(song.level || '') && !/beginner/i.test(song.level || '') ? -0.05 : 0;
    const p = songApp.routine.progress(song).both;
    return clampSpeed((level === 'known' ? 0.6 + 0.3 * p : level === 'hands' ? 0.6 : 0.55) + lv);
  }
  const clampSpeed = v => Math.round(Math.max(SPEED_MIN, Math.min(1, v)) * 20) / 20;
  const pct = v => Math.round(v * 100) + '%';

  // ---------- notes first, then tempo ----------
  // Until you have played every bar of the song with the right notes (both hands), the routine works on the notes
  // only: no tempo ladder, the speed stays put, and a pass is clean when its notes are right (timing does not fail
  // it). The bars played right are kept in routine-song-<id>.notesBars; when they cover the song, notesOk: tempo.
  // A Songs tab take of nearly the whole song with (almost) no slips counts too.
  const noteBarsOf = song => [...new Set(song.notes.map(n => n.bar))];
  function notesKnown(song) {
    if (load(songKey(song.id), {}).notesOk) return true;
    const t = songApp.routine.takes(song).both;
    if (!t || t.coverage < 0.95) return false;
    return t.slips !== undefined ? t.slips <= Math.max(1, Math.floor(t.notes * 0.02)) : t.score >= 90;
  }
  // these bars were played with the right notes, by every hand that plays in them
  function notesRight(b, bars) {
    if (!b.notesPhase || !bars.length) return;
    const song = b.item.song, mem = load(songKey(song.id), {});
    const got = new Set([...(mem.notesBars || []), ...bars]);
    mem.notesBars = [...got].sort((x, y) => x - y);
    if (noteBarsOf(song).every(x => got.has(x))) {
      mem.notesOk = true; b.notesPhase = false;
      b.notice = 'You have now played every note of the song right: from here on, tempo.';
    }
    save(songKey(song.id), mem);
  }
  // the share of the song's bars played with the right notes so far
  const notesShare = song => { const got = new Set(load(songKey(song.id), {}).notesBars || []), all = noteBarsOf(song); return pct(all.filter(x => got.has(x)).length / all.length); };
  const barList =(from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

  // ---------- warm-up material ----------
  const ALL_CHORDS = () => GROUPS.flatMap(g => g.chords);
  const ALL_SCALES = () => SCALE_GROUPS.flatMap(g => g.scales);
  function keyScale(song) {
    const m = /^([A-G])([#b]?)\s+(major|minor)/i.exec(song.key || '');
    if (!m) return null;
    const root = (LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
    const type = ALL_SCALES().find(s => s.name === (/major/i.test(m[3]) ? 'Major' : 'Natural minor'));
    return type && { root, type };
  }
  function chordType(sfx) {
    return ALL_CHORDS().find(c => c.sfx === sfx)
      || ALL_CHORDS().find(c => c.sfx === (/^m(?!aj)/.test(sfx) ? 'm' : /^dim/.test(sfx) ? 'dim' : ''));
  }
  // What each hand plays: per bar, the shape of that hand's notes (a chord of the library up to 4 notes, a fifth or an
  // octave; at most one chord tone missing, the bar's chord root preferred) and its voicing: the inversion, from the
  // lowest note (inv, as in js/trainer.js invertChord). A melody (a step of 1-2 semitones from
  // one note to the next) or notes that fit no shape: the right hand takes the bar's chord, the left hand has nothing
  // to warm up in that bar.
  const FIFTH = { sfx: '5', name: 'Fifth (power chord)', iv: [0, 7], fingers: { right: [1, 4], left: [5, 1] },
    tone: 'Open and solid: root and 5th, no 3rd.', usage: 'The most common left-hand shape under a melody.' };
  const OCTAVE = { sfx: ' octave', name: 'Octave', iv: [0, 12], fingers: { right: [1, 5], left: [5, 1] },
    tone: 'The root doubled an octave up: a full, steady bass.', usage: 'Bass lines, and big moments.' };
  // (no add9 or 6th chords: a melody of steps would fit them; its bar takes the bar's chord instead)
  const SHAPES = () => [FIFTH, ...ALL_CHORDS().filter(c => c.iv.length <= 4 && c.iv.every(i => i < 12) && !['6', 'm6'].includes(c.sfx))];
  function handShape(song, hand, bar, barRoot) {
    const ns = song.notes.filter(n => n.hand === hand && n.bar === bar);
    if (!ns.length) return null;
    const line = [...ns].sort((a, b) => a.start - b.start || a.midi - b.midi);
    if (line.some((n, i) => i && n.start > line[i - 1].start + 1e-6 && Math.abs(n.midi - line[i - 1].midi) <= 2)) return null;
    return shapeOf(ns, barRoot);
  }
  // the shape of these notes (see above), or null
  function shapeOf(ns, barRoot = null) {
    const pcs = [...new Set(ns.map(n => n.midi % 12))];
    const low = Math.min(...ns.map(n => n.midi)), bass = low % 12;
    if (pcs.length === 1) return ns.some(n => n.midi === low + 12) ? { root: bass, type: OCTAVE, inv: 0 } : null;
    let best = null;
    SHAPES().forEach((type, ti) => {
      for (let root = 0; root < 12; root++) {
        const tones = new Set(type.iv.map(i => (root + i) % 12));
        const missing = tones.size - pcs.length;
        if (missing < 0 || missing > 1 || !pcs.every(p => tones.has(p))) continue;
        const score = missing * 10 + (barRoot != null && root !== barRoot ? 4 : 0) + (root === bass ? 0 : 2) + ti * 0.01;
        if (!best || score < best.score) best = { root, type, score };
      }
    });
    return best && { root: best.root, type: best.type, inv: Math.max(0, best.type.iv.findIndex(i => (best.root + i) % 12 === bass)) };
  }
  // per hand, the most played shapes as voiced in the song (an inversion is its own shape), in song order:
  // { rh: [{ root, type, inv }], lh: [...] }
  function handChords(song, n) {
    const bc = songApp.routine.barChords(song);
    const tally = () => ({ count: new Map(), first: new Map() });
    const t = { rh: tally(), lh: tally() };
    const add = (h, k, item, bar) => { t[h].count.set(k, (t[h].count.get(k) || 0) + 1); if (!t[h].first.has(k)) t[h].first.set(k, { ...item, bar }); };
    const key = c => c.root + '|' + c.type.sfx + '|' + (c.inv || 0);
    song.bars.forEach(b => {
      const main = bc[b.n - 1][0], type = main && chordType(main.sfx);
      const barChord = type && { root: main.root, type, inv: 0 };
      const rh = handShape(song, 'rh', b.n, main && main.root) || barChord;
      const lh = handShape(song, 'lh', b.n, main && main.root);
      if (rh) add('rh', key(rh), rh, b.n);
      if (lh) add('lh', key(lh), lh, b.n);
    });
    const top = h => [...t[h].count.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => t[h].first.get(k)).sort((a, b) => a.bar - b.bar);
    return { rh: top('rh'), lh: top('lh') };
  }
  const chordName = c => NAMES[c.root] + c.type.sfx + (c.inv ? '/' + NAMES[(c.root + invertChord(c.type.iv, c.inv)[0]) % 12] : '');

  // ---------- song ranges ----------
  const barsSec = (song, bars, speed, pmode) => bars * song.barLen / (song.tempo / 60 * speed) * (pmode === 'wait' ? 1.4 : 1) + 6;
  function sectionsOf(song) {
    if (song.sections && song.sections.length) return song.sections.map(s => ({ from: s.from, to: s.to, name: s.name }));
    const out = [];
    for (let b = 1; b <= song.bars.length; b += 8) out.push({ from: b, to: Math.min(song.bars.length, b + 7), name: `bars ${b}–${Math.min(song.bars.length, b + 7)}` });
    return out;
  }
  const avg = (arr, from, to) => { let s = 0; for (let b = from; b <= to; b++) s += arr[b - 1] || 0; return s / ((to - from + 1) * MAX_PROGRESS); };
  // The bars this session works on: the whole song when its run fits in maxSec, else the section to work on
  // (new: the first one not learnt yet; else the weakest), plus the sections after it while they fit.
  // A new song: as many chunks as can be learnt in learnSec, from its first section not learnt yet.
  const chunkSize = () => 2; // the average part, for time estimates (a part's real length: partTo / fitParts)

  // ---------- how much a part holds ----------
  // A bar's load: what there is to play and remember in it. Per hand, each onset 1, each extra note of a chord ½, each
  // leap of more than a 5th from the last onset ½. A part takes bars while their loads fit in PART_LOAD (up to
  // PART_MAX bars): easy bars come several at a time, a dense bar alone.
  const PART_LOAD = 24, PART_MAX = 4;
  const loadCache = new Map();
  function barLoad(song, n) {
    const key = song.id + '|' + n;
    if (loadCache.has(key)) return loadCache.get(key);
    let load = 0;
    ['rh', 'lh'].forEach(h => {
      const onsets = new Map();
      song.notes.filter(x => x.hand === h && x.bar === n).forEach(x => {
        const k = x.start.toFixed(3);
        if (!onsets.has(k)) onsets.set(k, []);
        onsets.get(k).push(x.midi);
      });
      let prev = null;
      [...onsets.entries()].sort((a, b) => a[0] - b[0]).forEach(([, ms]) => {
        const mid = ms.reduce((a, m) => a + m, 0) / ms.length;
        load += 1 + (ms.length - 1) * 0.5 + (prev !== null && Math.abs(mid - prev) > 7 ? 0.5 : 0);
        prev = mid;
      });
    });
    loadCache.set(key, load);
    return load;
  }
  // the last bar of a part starting at `from` (not past `limit`)
  function partTo(song, from, limit) {
    let to = from, load = barLoad(song, from);
    while (to < limit && to - from + 1 < PART_MAX && load + barLoad(song, to + 1) <= PART_LOAD) load += barLoad(song, ++to);
    return to;
  }
  // bars from..to (a weak spot) as parts that fit: too much → split; room left → the bars around it join, within
  // the range rf..rt. Returns [[from, to], …].
  function fitParts(song, from, to, rf, rt) {
    const out = [];
    for (let f = from; f <= to;) { const t = partTo(song, f, to); out.push([f, t]); f = t + 1; }
    if (out.length === 1) {
      let [f, t] = out[0], load = 0;
      for (let x = f; x <= t; x++) load += barLoad(song, x);
      let grew = true;
      while (grew && t - f + 1 < PART_MAX) {
        grew = false;
        if (t < rt && load + barLoad(song, t + 1) <= PART_LOAD) { load += barLoad(song, ++t); grew = true; }
        else if (f > rf && load + barLoad(song, f - 1) <= PART_LOAD) { load += barLoad(song, --f); grew = true; }
      }
      out[0] = [f, t];
    }
    return out;
  }
  function chooseRange(song, level, speed, maxSec, learnSec, reps) {
    const pmode = 'wait';
    if (level === 'new') {
      const secs = sectionsOf(song), m = songApp.routine.mastery(song);
      const sec = secs.find(s => Math.min(avg(m.rh, s.from, s.to), avg(m.lh, s.from, s.to)) < LEVEL_PROGRESS) || secs[0];
      const size = chunkSize(song), passes = LEARN_STAGES * (reps + LEARN_SLACK);
      const bars = size * Math.max(2, Math.floor(learnSec / (passes * barsSec(song, size, speed, 'wait'))));
      const to = Math.min(song.bars.length, sec.from + bars - 1);
      return { from: sec.from, to, whole: sec.from === 1 && to === song.bars.length };
    }
    if (barsSec(song, song.bars.length, speed, pmode) <= maxSec) return { from: 1, to: song.bars.length, whole: true };
    const secs = sectionsOf(song), m = songApp.routine.mastery(song);
    let i;
    if (level === 'new') {
      i = secs.findIndex(s => Math.min(avg(m.rh, s.from, s.to), avg(m.lh, s.from, s.to)) < LEVEL_PROGRESS);
      if (i < 0) i = 0;
    } else {
      const key = 'both';
      i = secs.reduce((best, s, k) => (avg(m[key], s.from, s.to) < avg(m[key], secs[best].from, secs[best].to) ? k : best), 0);
    }
    let from = secs[i].from, to = secs[i].to;
    while (i + 1 < secs.length && barsSec(song, secs[i + 1].to - from + 1, speed, pmode) <= maxSec) to = secs[++i].to;
    return { from, to, whole: false };
  }

  // ---------- the plan ----------
  // Songs that fit in the time: the ones practised longest ago first; the time split by how much each still needs.
  function buildPlan(ids, duration) {
    const prof = PROFILE[duration];
    const songs = ids.map(id => SONGS.find(s => s.id === id)).filter(Boolean);
    const songSec = (duration - prof.warm) * 60;
    const fit = Math.max(1, Math.min(songs.length, Math.floor(songSec / 60 / SONG_MIN_MINUTES)));
    const order = [...songs].sort((a, b) => (load(songKey(a.id), {}).lastAt || 0) - (load(songKey(b.id), {}).lastAt || 0));
    const today = songs.filter(s => order.indexOf(s) < fit);
    const later = songs.filter(s => !today.includes(s));
    const need = s => 1.3 - songApp.routine.progress(s).both;
    const total = today.reduce((a, s) => a + need(s), 0);
    const items = today.map(song => {
      const level = levelOf(song), speed = startSpeed(song, level), budget = songSec * need(song) / total;
      const notes = !notesKnown(song); // still learning the notes: no tempo work yet
      const goal = level === 'new' || notes ? speed : clampSpeed(speed + 0.1);
      const range = chooseRange(song, level, speed, budget * 0.35, budget * 0.85, prof.reps);
      return { song, level, speed, goal, budget, range, notes };
    });
    const warm = prof.warm * 60;
    return {
      duration, prof, items, later,
      scales: items.map(it => ({ song: it.song, scale: keyScale(it.song), level: it.level })).filter(x => x.scale),
      chords: items.map(it => {
        const hc = handChords(it.song, prof.chords);
        const hands = ['rh', 'lh'].filter(h => hc[h].length);
        return { song: it.song, hands: hands.map(h => ({ hand: h, chords: hc[h] })) };
      }).filter(x => x.hands.length),
      scaleSec: warm * 0.45, chordSec: warm * 0.55,
    };
  }

  // ---------- running ----------
  // Blocks: scales, chords, then one per song. Time: wall clock while not paused.
  const now = () => performance.now() / 1000;
  function elapsed() { return R ? (R.pausedAt ? R.pausedAt : now()) - R.start - R.pausedFor : 0; }
  function blockElapsed() { return elapsed() - R.blockStart; }
  function start() {
    if (!setup.songs.length) return;
    const plan = buildPlan(setup.songs, setup.duration);
    R = {
      plan, start: now(), pausedFor: 0, pausedAt: 0, blockIdx: -1, blockStart: 0,
      // your own settings, put back when the routine ends (the routine changes these as it goes; settings.js keeps
      // saving these values meanwhile, normalSettings)
      saved: { both: $('opt-both-hands').checked, octave: octaveSelect.value, dir: radio('dir'),
        scale: sTarget && { root: sTarget.root, type: sTarget.type }, songs: songApp.routine.snapshot(),
        songControls: { 'song-speed': $('song-speed').value }, songRadios: { 'song-hands': radio('song-hands'), 'song-pmode': radio('song-pmode') } },
      // parts: the bars worked on, each { from, to, before, after } (first and final run scores)
      results: plan.items.map(it => ({ song: it.song, level: it.level, parts: [], speed: it.speed, chunks: [] })),
      log: [],
    };
    R.blocks = [];
    if (plan.scales.length) R.blocks.push({ kind: 'scales', budget: plan.scaleSec });
    if (plan.chords.length) R.blocks.push({ kind: 'chords', budget: plan.chordSec });
    plan.items.forEach((it, i) => R.blocks.push({ kind: 'song', item: it, res: R.results[i], budget: it.budget }));
    songApp.routine.setHook(onSongEvent);
    document.body.classList.add('routine-on');
    clearInterval(R.timer);
    R.timer = setInterval(tick, 500);
    nextBlock();
  }
  function nextBlock() {
    R.blockIdx++;
    R.blockStart = elapsed();
    if (!R.blocks[R.blockIdx]) moreRounds();
    const b = R.blocks[R.blockIdx];
    if (!b || timeUp()) return finish();
    // the last block has the rest of the session, however much its plan said (it carries on to its next bars)
    if (b.kind === 'song' && !R.blocks[R.blockIdx + 1]) b.budget = Math.max(b.budget, R.plan.duration * 60 - elapsed());
    if (b.kind === 'scales') startScales(b);
    else if (b.kind === 'chords') startChords(b);
    else startSong(b);
    renderBar();
  }

  // Done before the time is up: the songs again, each from where it got to (its next bars, its speed now), sharing
  // the time left. Not when a round played nothing (nothing left to practise).
  const EXTRA_MIN = 20; // seconds left that are worth another round
  // The session has run its length: it ends once the part you are on is done (a part may run over, up to OVER_MAX
  // seconds; no new part or final run is started past the time).
  const timeUp = () => elapsed() >= R.plan.duration * 60;
  const OVER_MAX = 300;
  const overMax = () => elapsed() >= R.plan.duration * 60 + OVER_MAX;
  function moreRounds() {
    const left = R.plan.duration * 60 - elapsed();
    if (left < EXTRA_MIN || !R.plan.items.length) return;
    // a round where nothing was played (nothing to practise): one more try, then the end
    R.emptyRounds = R.lastRoundPlayed === (R.played || 0) ? (R.emptyRounds || 0) + 1 : 0;
    if (R.emptyRounds >= 2) return;
    R.lastRoundPlayed = R.played || 0;
    const prof = R.plan.prof, budget = left / R.plan.items.length;
    R.plan.items.forEach((it, i) => {
      const song = it.song, last = [...R.blocks].reverse().find(x => x.kind === 'song' && x.item.song === song);
      const level = levelOf(song), speed = last && last.speed !== undefined ? last.speed : it.speed;
      const notes = !notesKnown(song);
      let range = chooseRange(song, level, speed, budget * 0.35, budget * 0.85, prof.reps);
      // a song worked on in sections: on to the section after the last one (round to the start at the end)
      if (last && !range.whole && level !== 'new') range = nextRange({ item: { song, level, range: last.item.range }, speed }, budget);
      const item = { song, level, speed, goal: level === 'new' || notes ? speed : clampSpeed(speed + 0.1), budget, range, notes };
      R.blocks.push({ kind: 'song', item, res: R.results[i], budget, extra: true });
    });
  }

  // hands for the Scales / Chords tabs: both (left hand from C3, right from C4), or one (the octave picks the hand: below C4 = left)
  // oct: another octave (a drill at the song's octave); the hand is set, not taken from the octave (chords.js forcedHand)
  function setTrainerHands(h, oct = null) {
    handsGap = 12;
    forcedHand = h === 'rh' ? 'right' : h === 'lh' ? 'left' : null;
    const was = LOW;
    const both = $('opt-both-hands');
    if (both.checked !== (h === 'both')) { both.checked = h === 'both'; both.dispatchEvent(new Event('change')); }
    octaveSelect.value = String(oct ?? (h === 'rh' ? 4 : 3)); octaveSelect.dispatchEvent(new Event('change'));
    slideKeyboard(was);
  }
  // Another hand: the keyboard (rebuilt to the new range) slides over from where it was, so the change is clear:
  // to the left hand it pans down, to the right hand up. Starts with the old lowest key where it stood.
  function slideKeyboard(was) {
    if (was === LOW || !kbd.offsetWidth || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const whites = kbd.querySelectorAll('.k.w').length;
    let steps = 0; // white keys from the new lowest key to the old one (negative: the old one is lower)
    for (let n = Math.min(was, LOW); n < Math.max(was, LOW); n++) if (!isBlack(n)) steps++;
    if (was < LOW) steps = -steps;
    const wrap = $('kbd-wrap'), overflow = wrap.style.overflowX;
    wrap.style.overflowX = 'hidden'; // the moving keys make no scrollbar
    const anim = kbd.animate([{ transform: `translateX(${-steps / whites * 100}%)` }, { transform: 'none' }],
      { duration: 750, easing: 'cubic-bezier(.45, 0, .2, 1)' });
    anim.onfinish = anim.oncancel = () => { wrap.style.overflowX = overflow; };
  }

  // ---------- warm-up: scales ----------
  // Each song's key scale: right hand, left hand, then both (both hands only from 30 min, or a song you play),
  // REPS clean times each (a scale only completes without a slip: a wrong note starts it again).
  function startScales(b) {
    b.items = [];
    const done = new Set();
    R.plan.scales.forEach(({ song, scale, level }) => {
      const k = scale.root + scale.type.name;
      if (done.has(k)) return; // two songs in one key: one scale
      done.add(k);
      const hands = R.plan.duration >= 30 || level === 'known' ? ['rh', 'lh', 'both'] : ['rh', 'lh'];
      hands.forEach(h => b.items.push({ song, scale, hands: h }));
    });
    b.idx = 0; b.count = 0;
    const dir = document.querySelector('input[name="dir"][value="both"]'); dir.checked = true;
    setMode('scales');
    showScaleItem(b);
  }
  function showScaleItem(b) {
    const it = b.items[b.idx];
    setTrainerHands(it.hands);
    fromMemory(b, scaleKey(it));
    setScale(it.scale.root, it.scale.type);
    renderBar();
  }
  // ---------- from memory ----------
  // Per chord / scale and hand, how well you play it in the warm-up (routine-known): a clean one +1, a slip −2.
  // From KNOWN_AT on it is not shown on the keyboard (keyboard.js hideTarget): you play it from memory. A slip shows
  // it again, for the rest of that one.
  const KNOWN_KEY = 'routine-known', KNOWN_AT = 5, KNOWN_MAX = 10;
  let known = load(KNOWN_KEY, {});
  const scaleKey = it => `scale|${it.scale.root}|${it.scale.type.name}|${it.hands}`;
  const chordKey = (it, hand) => `chord|${it.root}|${it.type.sfx}${it.inv ? '/' + it.inv : ''}|${hand}`;
  const isKnown = k => (known[k] || 0) >= KNOWN_AT;
  function practised(k, clean) {
    known[k] = Math.max(0, Math.min(KNOWN_MAX, (known[k] || 0) + (clean ? 1 : -2)));
    save(KNOWN_KEY, known);
  }
  // a new chord / scale on the keys: hidden if you know it (set before it is drawn)
  function fromMemory(b, k) { b.key = k; b.slipped = false; hideTarget = isKnown(k); }

  // ---------- warm-up: chords ----------
  // Per song and hand (right, then left), the chords that hand plays in the song, as a
  // progression in song order; each progression goes round REPS times, then the next.
  function startChords(b) {
    b.phases = R.plan.chords.flatMap(({ song, hands }) => hands.map(({ hand, chords }) => ({ song, hand, items: chords })));
    b.ph = 0; b.idx = 0; b.lap = 0; b.missed = false; b.clean = 0;
    setMode('chords');
    showChordItem(b);
  }
  function showChordItem(b) {
    const p = b.phases[b.ph], it = p.items[b.idx];
    b.missed = false;
    setTrainerHands(p.hand);
    fromMemory(b, chordKey(it, p.hand));
    chooseChord(it.root, it.type, null, it.inv || 0); // the voicing the song uses
    renderBar();
  }
  // the next chord: round the progression, then the next hand / song; false when the block is done
  function nextChordItem(b) {
    if (++b.idx >= b.phases[b.ph].items.length) { b.idx = 0; b.lap++; }
    if (b.lap >= R.plan.prof.reps) { b.lap = 0; b.ph++; }
    return b.ph < b.phases.length;
  }
  // From tryAdvance (js/trainer.js): a scale / chord was completed. True = the routine picked the next one.
  function targetDone() {
    if (!R || R.pausedAt) return false;
    const b = R.blocks[R.blockIdx];
    if (b && b.kind === 'song' && b.drill && mode === 'chords') { nextDrillItem(b); return true; } // a drill inside a song
    if (!b || (b.kind === 'scales' && mode !== 'scales') || (b.kind === 'chords' && mode !== 'chords') || b.kind === 'song') return false;
    const over = blockElapsed() >= b.budget;
    practised(b.key, !b.slipped);
    if (b.kind === 'scales') {
      b.count++;
      if (b.count >= R.plan.prof.reps || over) {
        b.count = 0;
        if (++b.idx >= b.items.length || over) { nextBlock(); return true; }
      }
      showScaleItem(b); // the same scale again, or the next one
      return true;
    }
    if (!b.missed) b.clean++;
    if (!nextChordItem(b) || over) { nextBlock(); return true; }
    showChordItem(b);
    return true;
  }
  function miss() {
    const b = R && R.blocks[R.blockIdx];
    if (!b || (b.kind !== 'chords' && b.kind !== 'scales')) return;
    if (b.kind === 'chords') b.missed = true;
    b.slipped = true;
    if (hideTarget) { hideTarget = false; drawTarget(); renderBar(); } // a slip: show it again
  }

  // ---------- songs ----------
  // A song block runs steps: 'run' → chunk stages (turns) → 'final'. Each step sets the Songs tab up through
  // songApp.routine.setup and waits for its events (onSongEvent).
  function startSong(b) {
    const { song, level, range } = b.item;
    if (b.speed === undefined) { b.speed = b.item.speed; b.allChunks = []; b.learnt = new Map(); b.notesPhase = b.item.notes; }
    setMode('songs');
    songApp.routine.focus(); // from the warm-up: the falling notes into view
    if (R.lastSong !== song) { R.lastSong = song; songIntro(song, level); }
    if (level === 'new') {
      b.chunks = newChunks(b); b.allChunks.push(...b.chunks);
      if (!b.chunks.length) return nextBlock(); // nothing to play in these bars
      b.queue = b.chunks.slice(0, R.plan.prof.chunks); b.cur = 0; runChunk(b, true); return;
    }
    b.step = { kind: 'run', from: range.from, to: range.to };
    songSetup({ song, hands: 'both', pmode: 'wait', speed: b.speed, loop: [range.from, range.to] }, 2500);
    renderBar();
  }
  // Another song: its name comes up in the middle of the screen and the falling notes slide in, so it is clear the
  // routine has moved on (routine.css .routine-song-card, #songs-view.routine-switch).
  function songIntro(song, level) {
    document.querySelectorAll('.routine-song-card').forEach(x => x.remove());
    const first = !R.blocks.slice(0, R.blockIdx).some(x => x.kind === 'song');
    const card = document.createElement('div');
    card.className = 'routine-song-card';
    card.setAttribute('aria-hidden', 'true');
    card.innerHTML = `<small>${first ? 'Now the song' : 'Next song'}</small><b>${esc(song.title)}</b>` +
      `<span>${esc([song.composer, LEVEL_TEXT[level][0]].filter(Boolean).join(' · '))}</span>`;
    document.body.appendChild(card);
    card.addEventListener('animationend', () => card.remove());
    const view = $('songs-view');
    view.classList.remove('routine-switch'); void view.offsetWidth; view.classList.add('routine-switch');
    clearTimeout(songIntro.t);
    songIntro.t = setTimeout(() => view.classList.remove('routine-switch'), 1500); // (the stage's own flashes animate again)
  }
  // new song: its range in parts sized by how much is in them (partTo), learnt in order
  function newChunks(b) {
    const { song, range } = b.item;
    const out = [];
    for (let f = range.from; f <= range.to;) { const t = partTo(song, f, range.to); out.push(makeChunk(b, f, t, null)); f = t + 1; }
    return out.filter(c => c.stages.length); // bars with no notes at all: nothing to learn
  }
  // does the hand ('rh' | 'lh' | 'both' = either) play anything in these bars?
  const playsIn = (song, hand, from, to) => song.notes.some(n => n.bar >= from && n.bar <= to && (hand === 'both' || n.hand === hand));
  // stages of a chunk: [hands, pmode] … ; weak: 'rh' | 'lh' (one hand to practise alone first) | null
  function makeChunk(b, from, to, weak) {
    const { level, song } = b.item, m = songApp.routine.mastery(song);
    const stages = [];
    // still learning the notes of the song (b.notesPhase): no tempo ladder, hands together instead
    const ladder = !b.notesPhase;
    if (level === 'new') {
      if (avg(m.rh, from, to) < LEVEL_PROGRESS) stages.push({ hands: 'rh', pmode: 'wait', name: 'right hand alone' });
      if (avg(m.lh, from, to) < LEVEL_PROGRESS) stages.push({ hands: 'lh', pmode: 'wait', name: 'left hand alone' });
      stages.push({ hands: 'both', pmode: 'wait', name: 'hands together', together: true });
      if (ladder) stages.push({ hands: 'both', pmode: 'wait', name: 'tempo ladder', ladder: true });
    } else {
      if (weak) stages.push({ hands: weak, pmode: 'wait', name: (weak === 'rh' ? 'right' : 'left') + ' hand alone' });
      if (level === 'hands' || weak || !ladder) stages.push({ hands: 'both', pmode: 'wait', name: 'hands together', together: true });
      if (ladder) stages.push({ hands: 'both', pmode: 'wait', name: 'tempo ladder', ladder: true });
      stages.push({ hands: 'both', pmode: 'wait', name: 'in context', context: true });
    }
    const start = level === 'new' ? clampSpeed(b.speed - 0.05) : clampSpeed(b.speed - 0.1);
    // a hand with no notes in these bars has nothing to practise alone, and with only one hand playing there is no
    // "hands together" (the ladder and in context then just play that hand)
    return { from, to, weak, stages: stages.filter(st => st.together ? playsIn(song, 'rh', from, to) && playsIn(song, 'lh', from, to) : playsIn(song, st.hands, from, to)), stage: 0, streak: 0, passes: 0, turn: 0, speed: start, done: false, fixedAt: null };
  }
  // the run's report → chunks: the bars with mistakes, merged (gap ≤ 1 bar, up to 4 bars), worst first
  function chunksFromReport(b, report) {
    // (a bar with only a little timing to it is not a spot: a real slip, or 4 notes early / late; while learning the
    // notes, only the wrong notes make a spot)
    const spot = x => b.notesPhase ? x.slips >= 1 : x.cost >= 1;
    const bars = (report && report.bars || []).filter(x => x.bar >= b.item.range.from && x.bar <= b.item.range.to && spot(x)).sort((x, y) => x.bar - y.bar);
    const groups = [];
    bars.forEach(x => {
      const g = groups[groups.length - 1];
      if (g && x.bar - g.to <= 2 && x.bar - g.from < 4) { g.to = x.bar; g.cost += x.cost; g.rh += x.rh; g.lh += x.lh; }
      else groups.push({ from: x.bar, to: x.bar, cost: x.cost, rh: x.rh, lh: x.lh });
    });
    groups.sort((x, y) => y.cost - x.cost);
    // last session's unfinished spots (routine-song-<id>.todo) come along when this run did not find them again
    const todo = (load(songKey(b.item.song.id), {}).todo || []).filter(t => t.from >= b.item.range.from && t.to <= b.item.range.to &&
      !groups.some(g => g.from <= t.to && t.from <= g.to)).map(t => ({ ...t, cost: 0.5, rh: 0, lh: 0 }));
    const prof = R.plan.prof;
    // the worst ones, then in song order (so you always know where you are), each as long as its bars allow (fitParts:
    // easy bars several at a time, a hard one alone)
    const { from: rf, to: rt } = b.item.range, song = b.item.song;
    const picked = [...groups, ...todo].slice(0, prof.chunks).sort((x, y) => x.from - y.from);
    return picked.flatMap((g, i) => {
      const handErr = g.rh + g.lh;
      const weak = prof.isolate && handErr >= 2 && (g.rh / handErr >= 0.75 ? 'rh' : g.lh / handErr >= 0.75 ? 'lh' : null);
      // it grows only up to its neighbours, so no spot is swallowed by another
      const lo = i ? Math.max(rf, picked[i - 1].to + 1) : rf, hi = i < picked.length - 1 ? Math.min(rt, picked[i + 1].from - 1) : rt;
      return fitParts(song, g.from, g.to, Math.min(lo, g.from), Math.max(hi, g.to)).map(([from, to]) => makeChunk(b, from, to, weak || null));
    }).filter((c, i, all) => c.stages.length && !all.slice(0, i).some(p => p.from <= c.to && c.from <= p.to));
  }
  // After a clean run: the weakest sections of the range (by Songs tab progress), tempo ladder only, from this speed.
  function speedChunks(b) {
    const { song, range } = b.item, m = songApp.routine.mastery(song).both;
    const secs = sectionsOf(song).map(x => ({ from: Math.max(x.from, range.from), to: Math.min(x.to, range.to) })).filter(x => x.from <= x.to);
    return secs.sort((x, y) => avg(m, x.from, x.to) - avg(m, y.from, y.to)).slice(0, R.plan.prof.chunks).sort((x, y) => x.from - y.from).map(x => {
      const c = makeChunk(b, x.from, x.to, null);
      c.stages = c.stages.filter(st => st.ladder); c.speed = b.speed;
      return c;
    }).filter(c => c.stages.length);
  }
  // ---------- repeats ----------
  // The music of a hand in a bar, as a fingerprint: its notes, when they start in the bar and how long they are
  // ('both': both hands). Bars with the same fingerprints are the same music, wherever they are in the song.
  const sigCache = new Map();
  function barSigs(song, hand) {
    const key = song.id + '|' + hand;
    if (!sigCache.has(key)) sigCache.set(key, song.bars.map(bar => song.notes.filter(n => n.bar === bar.n && (hand === 'both' || n.hand === hand))
      .map(n => `${n.hand}${n.midi}@${(n.start - bar.start).toFixed(3)}/${n.dur.toFixed(3)}`).sort().join(' ')));
    return sigCache.get(key);
  }
  const rangeSig = (song, hand, from, to) => barSigs(song, hand).slice(from - 1, to).join('|');
  const stageKind = st => st.ladder ? 'ladder' : st.context ? 'context' : st.together ? 'together' : 'alone';
  const stageRange = (song, c, st) => st.range ? st.range : st.context ? [Math.max(1, c.from - 1), Math.min(song.bars.length, c.to + 1)] : [c.from, c.to];
  const stageKey = (song, c, st) => { const [f, t] = stageRange(song, c, st); return stageKind(st) + '|' + st.hands + '|' + rangeSig(song, st.hands, f, t); };
  // Has this stage's music been learnt already? The same stage finished on identical bars this session (b.learnt), or,
  // for one hand alone / hands together, identical bars elsewhere in the song that your progress says you know.
  // Returns those bars, or null.
  function learntAs(b, c, st) {
    const song = b.item.song, [from, to] = stageRange(song, c, st);
    if (st.remedy) return null; // a stage added for a kind of mistake is never skipped
    if (!rangeSig(song, st.hands, from, to).replace(/|/g, '')) return null;
    const done = b.learnt.get(stageKey(song, c, st));
    if (done && (done.from !== from || done.to !== to)) return done;
    if (st.ladder || st.context) return null;
    const sig = rangeSig(song, st.hands, from, to), len = to - from, m = songApp.routine.mastery(song)[st.hands];
    for (let f = 1; f + len <= song.bars.length; f++) {
      if (f === from || rangeSig(song, st.hands, f, f + len) !== sig) continue;
      if (avg(m, f, f + len) >= LEVEL_PROGRESS) return { from: f, to: f + len };
    }
    return null;
  }
  // Skip the stages of a chunk learnt already (as above). True when that was all of them: the chunk is done.
  function skipLearnt(b, c) {
    while (c.stage < c.stages.length) {
      const as = learntAs(b, c, c.stages[c.stage]);
      if (!as) return false;
      b.notice = `${barsText(c.from, c.to).replace(/^b/, 'B')} ${c.stages[c.stage].hands === 'both' ? '' : '(' + (c.stages[c.stage].hands === 'rh' ? 'right' : 'left') + ' hand) '}` +
        `${c.from === c.to ? 'is' : 'are'} the same as ${barsText(as.from, as.to)}, which you know: skipped.`;
      c.stage++; c.streak = 0; c.fails = 0;
    }
    c.done = true; c.repeat = true;
    return true;
  }
  const barsText = (f, t) => f === t ? `bar ${f}` : `bars ${f}–${t}`;

  // ---------- kinds of mistakes ----------
  // Each wrong / missed note and each step off the pulse of a pass (js/songs.js takeEvents) gets a kind and a spot (where
  // it is: a mistake that comes back to the same spot is not one that wanders):
  //   transition  at the first notes of a bar where the hand's chord shape changes (with the change, from → to)
  //   leap        the hand moved far (more than LEAP semitones from its last notes), or the key was an octave off
  //   chord       a chord of 3+ notes in that hand
  //   neighbour   a key 1-2 semitones from the right one (usually the fingering)
  //   hesitation  a long pause before the step (not at a chord change: that is a transition)
  //   timing      a little early / late;  wrong: anything else
  const LEAP = 9, HESITATE = 0.6;
  const HAND_WORD = { rh: 'right hand', lh: 'left hand', both: 'both hands' };
  const noteLabel = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
  const onsetOf = (song, hand, t) => song.notes.filter(n => n.hand === hand && Math.abs(n.start - t) < 1e-3);
  function prevOnset(song, hand, t) {
    let at = -Infinity;
    song.notes.forEach(n => { if (n.hand === hand && n.start < t - 1e-3 && n.start > at) at = n.start; });
    return at === -Infinity ? [] : onsetOf(song, hand, at);
  }
  const meanMidi = ns => ns.reduce((a, n) => a + n.midi, 0) / ns.length;
  const shapeCache = new Map();
  function shapeIn(song, hand, bar) {
    const k = song.id + '|' + hand + '|' + bar;
    if (!shapeCache.has(k)) {
      const main = (songApp.routine.barChords(song)[bar - 1] || [])[0];
      shapeCache.set(k, handShape(song, hand, bar, main ? main.root : null));
    }
    return shapeCache.get(k);
  }
  const sameShape = (a, b) => a.root === b.root && a.type.sfx === b.type.sfx && (a.inv || 0) === (b.inv || 0);
  // a change of the hand's chord shape from bar - 1 to bar, when t is in the first quarter of the bar
  function changeAt(song, hand, bar, t) {
    const b = song.bars[bar - 1];
    if (!b || bar < 2 || !hand || t - b.start > song.barLen / 4 + 1e-3) return null;
    const from = shapeIn(song, hand, bar - 1), to = shapeIn(song, hand, bar);
    return from && to && !sameShape(from, to) ? { from, to } : null;
  }
  function classify(song, e) {
    const at = e.t == null ? '?' : e.t.toFixed(2), hand = e.hand;
    if (e.type === 'early' || e.type === 'late') {
      if (e.type === 'late' && (e.dev > HESITATE || e.dev > 2 * e.tol)) {
        const h = ['rh', 'lh'].find(x => changeAt(song, x, e.bar, e.t));
        return h ? { kind: 'transition', spot: `c${e.bar}${h}`, bar: e.bar, hand: h, change: changeAt(song, h, e.bar, e.t) }
          : { kind: 'hesitation', spot: 'h' + at, bar: e.bar, t: e.t };
      }
      return { kind: 'timing', spot: 't' + at, bar: e.bar };
    }
    if (!hand || e.t == null || e.aim == null) return { kind: 'wrong', spot: 'w' + e.bar, bar: e.bar, hand };
    const change = changeAt(song, hand, e.bar, e.t);
    if (change) return { kind: 'transition', spot: `c${e.bar}${hand}`, bar: e.bar, hand, change };
    const here = onsetOf(song, hand, e.t), prev = prevOnset(song, hand, e.t);
    if ((here.length && prev.length && Math.abs(meanMidi(here) - meanMidi(prev)) > LEAP) || (e.got != null && Math.abs(e.got - e.aim) >= 10))
      return { kind: 'leap', spot: `l${at}${hand}`, bar: e.bar, hand, t: e.t, aim: e.aim, fromBar: prev.length ? prev[0].bar : e.bar };
    if (here.length >= 3) return { kind: 'chord', spot: `k${at}${hand}`, bar: e.bar, hand, t: e.t };
    if (e.got != null && Math.abs(e.got - e.aim) <= 2) return { kind: 'neighbour', spot: `n${at}${hand}`, bar: e.bar, hand, t: e.t, aim: e.aim, got: e.got };
    return { kind: 'wrong', spot: `w${at}${hand}`, bar: e.bar, hand };
  }
  const isSlip = k => k.kind !== 'timing' && k.kind !== 'hesitation';

  // ---------- what to do about them ----------
  // After a pass that was not clean: the mistakes of this pass and the one before (before a part's first pass: the
  // first run's, which only start drills). A spot that comes back decides, in this order:
  //   transition → drill the change (Chords tab: A → B → A → B, as voiced in the song), then back to the bars
  //   chord      → drill that chord shape, then back
  //   leap       → just the bar(s) of the jump, that hand alone, slower
  //   hesitation → just the bar(s) of the pause (with the bar before when it is on the bar line), a little slower
  //   neighbour  → that hand alone (fingering), or a little slower when it is alone already
  //   together   → hands together slips while each hand knows it alone: together, slower
  //   pulse      → the notes right but off the pulse all over: with the clock (play along)
  //   random     → slips in a new place each pass: a little slower
  // Each at most REMEDY_MAX times per part, REMEDY_ALL in all (it never loops), and not past the session's time.
  const REMEDY_MAX = 2, REMEDY_ALL = 4;
  // a drill (chord change, chord shape) once per part, and once per chord change / shape in a song block: after it,
  // the part itself again
  const DRILLS = new Set(['transition', 'chord']);
  const lowIn = (song, hand, bar) => Math.min(...song.notes.filter(n => n.hand === hand && n.bar === bar).map(n => n.midi));
  function remedyFor(b, c, st, kinds, first = false) {
    c.rem = c.rem || {};
    if ((c.remAll || 0) >= REMEDY_ALL) return null;
    const song = b.item.song, ok = kind => (c.rem[kind] || 0) < (DRILLS.has(kind) ? 1 : REMEDY_MAX);
    const fresh = key => !(b.drilled && b.drilled.has(key));
    const recent = first ? (c.pre || []) : [...kinds, ...((c.hist || []).slice(-2, -1)[0] || [])];
    const need = first ? 1 : 2;
    const top = kind => {
      const n = new Map();
      recent.filter(k => k.kind === kind).forEach(k => n.set(k.spot, { k, n: ((n.get(k.spot) || {}).n || 0) + 1 }));
      const best = [...n.values()].sort((x, y) => y.n - x.n)[0];
      return best && best.n >= need ? best.k : null;
    };
    const slower = (by, tip) => st.ladder || st.context ? null : { kind: 'speed', speed: clampSpeed((st.speed ?? b.speed) - by), tip };
    const t = top('transition');
    const tKey = t && `t|${t.hand}|${chordName(t.change.from)}|${chordName(t.change.to)}`;
    if (t && ok('transition') && fresh(tKey)) {
      const { from, to } = t.change;
      // each chord where the song has it: the jump between them as it really is
      const items = [{ ...from, low: lowIn(song, t.hand, t.bar - 1) }, { ...to, low: lowIn(song, t.hand, t.bar) }];
      return { kind: 'transition', key: tKey, drill: { kind: 'transition', hand: t.hand, bar: t.bar, items, laps: R.plan.prof.reps + 1, name: 'chord change' },
        tip: `The change ${chordName(from)} → ${chordName(to)} (${HAND_WORD[t.hand]}) into bar ${t.bar} keeps catching you: switch between the two shapes until it is quick, then back to the bars.` };
    }
    const k = top('chord');
    if (k && ok('chord')) {
      const ns = onsetOf(song, k.hand, k.t), shape = shapeOf(ns), kKey = shape && `k|${k.hand}|${chordName(shape)}`;
      if (shape && fresh(kKey)) return { kind: 'chord', key: kKey, drill: { kind: 'chord', hand: k.hand, bar: k.bar, items: [{ ...shape, low: Math.min(...ns.map(n => n.midi)) }], laps: R.plan.prof.reps + 2, name: 'chord shape' },
        tip: `The ${chordName(shape)} chord (${HAND_WORD[k.hand]}) in bar ${k.bar}: find the whole shape at once, a few times, then back to the bars.` };
    }
    if (first) return null;
    const l = top('leap');
    if (l && ok('leap')) {
      const from = Math.max(c.from - 1, Math.min(l.fromBar, l.bar), l.bar - 1, 1);
      return { kind: 'leap', stage: { hands: l.hand, pmode: 'wait', name: 'the jump, slower', remedy: 'leap', range: [from, l.bar], speed: clampSpeed(b.speed - 0.1),
        tip: `The jump to ${noteLabel(l.aim)} in bar ${l.bar} (${HAND_WORD[l.hand]}): look where you land before you move, then go in one motion. Just that spot, slower.` } };
    }
    const h = top('hesitation');
    if (h && ok('hesitation')) {
      const bar = song.bars[h.bar - 1], onLine = bar && h.t - bar.start < 1e-3;
      const beat = bar ? Math.floor((h.t - bar.start) / song.beat + 1e-6) + 1 : 1;
      return { kind: 'hesitation', stage: { hands: st.hands, pmode: 'wait', name: 'the pause spot', remedy: 'hesitation', range: [onLine ? Math.max(1, h.bar - 1) : h.bar, h.bar],
        speed: clampSpeed((st.speed ?? b.speed) - 0.05),
        tip: `You pause before ${onLine ? 'the start of' : 'beat ' + beat + ' of'} bar ${h.bar}: get those notes ready while you play the ones before. Just that spot.` } };
    }
    const nb = top('neighbour');
    if (nb && ok('neighbour')) {
      const note = onsetOf(song, nb.hand, nb.t).find(n => n.midi === nb.aim), finger = note && note.finger ? `, finger ${note.finger} on ${noteLabel(nb.aim)}` : '';
      const tip = `A key next to the right one (${noteLabel(nb.got)} for ${noteLabel(nb.aim)} in bar ${nb.bar}): that is usually the fingering${finger}.`;
      if (st.hands === 'both') return { kind: 'neighbour', stage: { hands: nb.hand, pmode: 'wait', name: `${HAND_WORD[nb.hand]} alone, fingering`, remedy: 'neighbour', tip: tip + ' That hand alone first.' } };
      const s = slower(0.05, tip + ' A little slower.');
      if (s) return { ...s, kind: 'neighbour' };
    }
    const slips = kinds.filter(isSlip);
    if (st.together && slips.length && ok('together')) {
      const m = songApp.routine.mastery(song), alone = c.stages.slice(0, c.stage).filter(x => !x.together && x.hands !== 'both').length;
      if (alone >= 2 || (avg(m.rh, c.from, c.to) >= LEVEL_PROGRESS && avg(m.lh, c.from, c.to) >= LEVEL_PROGRESS)) {
        const s = slower(0.1, 'Each hand knows it alone; together it slips: hands together, slower.');
        if (s) return { ...s, kind: 'together' };
      }
    }
    if (!slips.length && kinds.length >= 3 && !b.notesPhase && st.pmode === 'wait' && !st.ladder && ok('pulse'))
      return { kind: 'pulse', stage: { hands: st.hands, pmode: 'play', name: 'with the clock', remedy: 'pulse', pulse: true,
        tip: 'The notes are right, the pulse wanders: now with the clock (play along). It keeps going, so feel the beat and keep up.' } };
    const hist = (c.hist || []).slice(-3);
    if ((c.fails || 0) >= 2 && hist.length >= 2 && ok('random')) {
      const spots = hist.map(ks => new Set(ks.filter(isSlip).map(x => x.spot)));
      const again = spots.some((s, i) => [...s].some(x => spots.some((o, j) => j !== i && o.has(x))));
      if (!again && spots.every(s => s.size)) {
        const s = slower(0.05, 'Slips in a different place each time: that is focus, not one hard spot. Breathe, a little slower.');
        if (s) return { ...s, kind: 'random' };
      }
    }
    return null;
  }
  // Put a remedy in: a stage before the current one, a slower speed, or a drill (the caller starts it). Returns
  // 'stage' | 'speed' | 'drill'.
  function applyRemedy(b, c, st, r) {
    c.rem = c.rem || {};
    c.rem[r.kind] = (c.rem[r.kind] || 0) + 1;
    c.remAll = (c.remAll || 0) + 1;
    c.fails = 0; c.streak = 0; c.again = c.againTiming = 0;
    R.log.push({ song: b.item.song.id, from: c.from, to: c.to, remedy: r.kind });
    if (r.drill) { r.drill.tip = r.tip; (b.drilled = b.drilled || new Set()).add(r.key); return 'drill'; }
    if (r.stage) { c.stages.splice(c.stage, 0, r.stage); return 'stage'; }
    st.speed = r.speed;
    songApp.routine.setSpeed(r.speed);
    return 'speed';
  }

  // ---------- drills (Chords tab, inside a song block) ----------
  // A chord change (A → B → A → B …) or one chord, voiced as the hand plays it in the song and at the song's octaves
  // (so a chord change is the real jump), `laps` rounds; then back to the part. Always shown on the keys.
  // The keyboard starts at the C under the lowest chord (d.anchor); a higher one is played `shift` semitones up.
  function startDrill(b, d) {
    clearTimeout(R.autoPlay);
    songApp.routine.pause();
    const at = it => it.low - it.root - invertChord(it.type.iv, it.inv || 0)[0]; // the C the chord is played from
    const anchor = Math.min(...d.items.map(at));
    const fits = d.items.every(it => Number.isFinite(at(it))) && anchorToCNum(anchor) >= 1 && anchorToCNum(anchor) <= 7;
    b.drill = { ...d, idx: 0, lap: 0, ready: false, anchor: fits ? anchor : null,
      items: d.items.map(it => ({ ...it, shift: fits ? at(it) - anchor : 0 })) };
    setMode('chords');
    showDrillItem(b);
  }
  function showDrillItem(b) {
    const d = b.drill, it = d.items[d.idx];
    if (!d.ready) { // once per drill (and after a pause): the hand, the octave, keys up to the highest chord
      d.ready = true;
      setTrainerHands(d.hand, d.anchor === null ? null : anchorToCNum(d.anchor));
      const top = Math.max(...d.items.map(x => LOW + x.root + Math.max(...invertChord(x.type.iv, x.inv || 0)) + x.shift));
      if (top > HIGH) buildKeys(LOW, top + 2);
    }
    b.key = null; b.slipped = false; hideTarget = false;
    chooseChord(it.root, it.type, null, it.inv || 0, it.shift);
    renderBar();
  }
  // the next chord of the drill; at the end, back to the song
  function nextDrillItem(b) {
    const d = b.drill;
    if (++d.idx >= d.items.length) { d.idx = 0; d.lap++; }
    if (d.lap >= d.laps) return endDrill(b);
    showDrillItem(b);
  }
  function endDrill(b) {
    b.drill = null;
    setMode('songs');
    songApp.routine.focus();
    runChunk(b);
  }

  function runChunk(b, first = false) {
    // parts (or stages of them) identical to what you know: on to the next
    for (let guard = 0; skipLearnt(b, b.queue[b.cur]) && guard < 100; guard++) {
      if (b.chunks.length > b.queue.length && b.item.level === 'new') b.queue.push(b.chunks[b.queue.length]);
      if (b.queue.every(x => x.done)) { renderBar(); return wrapSong(b); }
      let k = b.cur;
      do k = (k + 1) % b.queue.length; while (b.queue[k].done);
      b.cur = k;
    }
    const c = b.queue[b.cur];
    const st = c.stages[c.stage];
    // before a part's first pass: a chord drill when the first run showed its kind of mistake (remedyFor)
    if (!c.preDone) {
      c.preDone = true;
      const r = remedyFor(b, c, st, [], true);
      if (r && r.drill) { applyRemedy(b, c, st, r); b.step = { kind: 'chunk' }; return startDrill(b, r.drill); }
    }
    const loop = stageRange(b.item.song, c, st);
    const speed = st.speed ?? (st.ladder || st.context ? c.speed : b.speed);
    b.step = { kind: 'chunk' };
    // timing counts more as a chunk gets further: less with one hand alone, more in the ladder and in context (on top
    // of what your progress on these bars says, js/songs.js timingStrictness)
    const timingBias = b.notesPhase ? -0.3 : st.context || st.pulse ? 0.2 : st.ladder ? 0.1 : st.hands === 'both' ? 0 : -0.2;
    songSetup({ song: b.item.song, hands: st.hands, pmode: st.pmode, speed, loop, timingBias }, first ? 1500 : 900);
    renderBar();
  }
  // Set the Songs tab up for a step. Play along starts by itself after `delay` ms (then its one-bar count-in);
  // wait mode starts with your first notes.
  function songSetup(opts, delay) {
    clearTimeout(R.autoPlay);
    songApp.routine.setup(opts);
    if (opts.pmode === 'play') R.autoPlay = setTimeout(() => { if (R && !R.pausedAt && mode === 'songs') songApp.routine.play(); }, delay);
  }
  function startFinal(b) {
    const { song, level } = b.item;
    let from = b.item.range.from, to = b.item.range.to;
    if (level === 'new') {
      const learnt = b.chunks.filter(c => c.stage >= c.stages.findIndex(s => s.hands === 'both'));
      if (!learnt.length) return nextBlock();
      from = Math.min(...learnt.map(c => c.from)); to = Math.max(...learnt.map(c => c.to));
    }
    const done = b.queue ? b.queue.filter(c => c.done || (c.stages[c.stage] && (c.stages[c.stage].ladder || c.stages[c.stage].context))) : [];
    const speed = level === 'new' ? b.speed : done.length ? clampSpeed(Math.min(...done.map(c => c.speed))) : b.speed;
    b.step = { kind: 'final', from, to, speed };
    songSetup({ song, hands: 'both', pmode: 'wait', speed: Math.max(b.speed, speed), loop: [from, to] }, 2500);
    renderBar();
  }
  // the next section(s) after this range, as many as fit in a third of the time left (the whole song stays whole)
  function nextRange(b, left) {
    const { song, level } = b.item, r = b.item.range, pmode = 'wait';
    if (r.whole) return r;
    const secs = sectionsOf(song);
    let i = secs.findIndex(x => x.from > r.to);
    if (i < 0) i = 0;
    const from = secs[i].from;
    let to = secs[i].to;
    while (i + 1 < secs.length && barsSec(song, secs[i + 1].to - from + 1, b.speed, pmode) <= left * 0.35) to = secs[++i].to;
    return { from, to, whole: false };
  }
  const finalReserve = b => (R.plan.prof.finalRun || b.item.level === 'new')
    ? barsSec(b.item.song, b.item.range.to - b.item.range.from + 1, b.speed, 'wait') : 0;

  // From js/songs.js: { type: 'pass', clean, wrong, miss, … } at the end of each loop pass; { type: 'take', report }
  // when a run (one pass, ended with 'stop') finishes. Returning 'stop' ends the loop after this pass.
  function onSongEvent(e) {
    if (!R || R.pausedAt) return;
    const b = R.blocks[R.blockIdx];
    if (!b || b.kind !== 'song' || mode !== 'songs') return;
    R.played = (R.played || 0) + 1; // something was played (moreRounds)
    if (b.step.kind === 'run' || b.step.kind === 'final') {
      if (e.type === 'pass') return 'stop';
      if (e.type !== 'take' || !e.report) return;
      // the bars of this run whose notes were all right
      const notesPhase = b.notesPhase;
      if (e.report.hands === 'both') {
        const slipped = new Set((e.report.bars || []).filter(x => x.slips > 0).map(x => x.bar));
        notesRight(b, barList(b.step.from, b.step.to).filter(x => !slipped.has(x)));
      }
      if (b.step.kind === 'run') {
        b.part = { from: b.step.from, to: b.step.to, before: e.report.score, after: null };
        b.res.parts.push(b.part);
        if (timeUp()) { setTimeout(finish, 3500); renderBar(); return; } // the run was the last part
        b.chunks = chunksFromReport(b, e.report);
        // the run's kinds of mistakes, per part: a chord change or chord shape that slipped is drilled before its first pass
        const runKinds = (e.report.events || []).map(ev => classify(b.item.song, ev));
        b.chunks.forEach(c => { c.pre = runKinds.filter(k => k.bar >= c.from && k.bar <= c.to); });
        // clean: work on speed, or, while learning the notes, on to the next bars
        if (!b.chunks.length && !notesPhase) b.chunks = speedChunks(b);
        b.allChunks.push(...b.chunks);
        b.queue = b.chunks; b.cur = 0;
        if (!b.queue.length && notesPhase) { b.part.after = b.part.before; b.part = null; carryOn(b, e.report.score); }
        else setTimeout(() => (b.queue.length ? runChunk(b, true) : wrapSong(b)), 2500); // a moment to read the report
      } else {
        if (!b.part) { b.part = { from: b.step.from, to: b.step.to, before: null, after: null }; b.res.parts.push(b.part); }
        b.part.after = e.report.score; b.part = null;
        carryOn(b, e.report.score, notesPhase);
      }
      renderBar();
      return;
    }
    if (e.type !== 'pass') return;
    const c = b.queue[b.cur], st = c.stages[c.stage], reps = R.plan.prof.reps;
    c.passes++; c.turn++;
    // while learning the notes, a pass with the right notes is clean (timing does not fail it)
    const clean = b.notesPhase ? e.wrong + e.miss === 0 : e.clean;
    c.streak = clean ? c.streak + 1 : 0;
    c.again = clean ? 0 : e.wrong + e.miss; // not clean: the same bars again (the bar says so)
    c.againTiming = !clean && !c.again ? e.offTime : 0; // …the notes were right, the timing was not
    c.fails = clean ? 0 : (c.fails || 0) + 1;
    // the kinds of mistakes in this pass: one that comes back gets its own remedy (remedyFor)
    const kinds = (e.events || []).map(ev => classify(b.item.song, ev));
    c.hist = [...(c.hist || []), kinds].slice(-3);
    let remedyTip = '';
    if (!clean && !timeUp()) {
      const r = remedyFor(b, c, st, kinds);
      if (r) {
        const how = applyRemedy(b, c, st, r);
        if (how === 'speed') remedyTip = r.tip;
        else { b.notice = ''; renderBar(); setTimeout(() => (how === 'drill' ? startDrill(b, r.drill) : runChunk(b)), 0); return 'retry'; }
      }
    }
    let stageDone = false;
    if (st.ladder) {
      if (clean && c.streak >= reps) {
        if (c.speed >= b.item.goal - 1e-6) stageDone = true;
        else { c.speed = clampSpeed(c.speed + SPEED_STEP); c.streak = 0; songApp.routine.setSpeed(c.speed); }
      } else if (!clean) { c.speed = clampSpeed(c.speed - SPEED_STEP); songApp.routine.setSpeed(c.speed); }
    } else if (st.context) stageDone = (clean && c.streak >= 1) || c.turn >= CONTEXT_MAX_PASSES;
    else stageDone = c.streak >= reps;
    if (stageDone) { b.learnt.set(stageKey(b.item.song, c, st), { from: stageRange(b.item.song, c, st)[0], to: stageRange(b.item.song, c, st)[1] }); }
    b.notice = remedyTip; // the "skipped: same as" note is for the first pass after it (a slower speed's reason, for the next)
    // the right notes, played by every hand these bars have: they count as learnt (notes first, then tempo)
    const other = { rh: 'lh', lh: 'rh' }[st.hands];
    if (e.wrong + e.miss === 0 && (!other || !playsIn(b.item.song, other, e.from, e.to))) notesRight(b, barList(e.from, e.to));
    if (stageDone) { c.stage++; c.streak = 0; c.again = c.againTiming = 0; c.fails = 0; if (c.stage >= c.stages.length) { c.done = true; c.fixedAt = c.passes; } }
    // stuck: the part is set aside (done for today, not fixed: it is saved as a spot for next session)
    else if (c.fails >= FAIL_LIMIT) { c.done = true; c.setAside = true; c.again = c.againTiming = 0; c.fails = 0; }
    R.log.push({ song: b.item.song.id, from: c.from, to: c.to, clean, speed: e.speed, hands: e.hands });

    // After every pass, clean or not, 'retry': the Songs tab puts the notes back at the start of these bars and waits
    // for your first note; a new part / stage / hand (runChunk) then glides them on to where that one starts.
    // out of time for the chunks → final run (or the next song)
    const left = b.budget - blockElapsed() - finalReserve(b);
    // past the time: the part you are on is finished first (up to OVER_MAX), then the end
    if (timeUp() && (c.done || overMax())) { setTimeout(finish, 1200); return 'retry'; }
    if (left <= 0 && !timeUp()) { setTimeout(() => wrapSong(b), 0); return 'retry'; }
    // chunk done: a new song brings in its next chunk; all done → final
    if (c.done && b.chunks.length > b.queue.length && b.item.level === 'new') b.queue.push(b.chunks[b.queue.length]);
    // a new song learnt faster than planned: its next bars, while they fit
    const song = b.item.song, size = chunkSize(song);
    if (b.item.level === 'new' && b.queue.every(x => x.done) && b.item.range.to < song.bars.length &&
        left > LEARN_STAGES * (R.plan.prof.reps + LEARN_SLACK) * barsSec(song, size, b.speed, 'wait')) {
      const from = b.item.range.to + 1, to = partTo(song, from, song.bars.length);
      const nc = makeChunk(b, from, to, null);
      b.chunks.push(nc); b.allChunks.push(nc); b.queue.push(nc);
      b.item.range = { from: b.item.range.from, to, whole: false };
      b.cur = b.queue.length - 1;
      setTimeout(() => runChunk(b), 0);
      return 'retry';
    }
    const open = b.queue.filter(x => !x.done);
    if (!open.length) { setTimeout(() => wrapSong(b), 0); return 'retry'; }
    // in song order: a part until it is done (or set aside), then the next unfinished one after it
    if (c.done || stageDone) {
      if (c.done) {
        c.turn = 0; c.again = c.againTiming = 0;
        let k = b.cur;
        do k = (k + 1) % b.queue.length; while (b.queue[k].done);
        b.cur = k;
      }
      setTimeout(() => runChunk(b), 0); // new hands / mode / bars: set up after this pass
      return 'retry';
    }
    renderBar();
    return c.stages[c.stage] && c.stages[c.stage].pmode === 'play' ? undefined : 'retry'; // with the clock: it just goes round again (count-in)
  }
  // After a final run (or a clean first run while learning the notes): with time left, on to the next section (or the
  // whole song again), a little faster if this one was good: only once you play all the notes (notesPhase: as it
  // was before this run).
  function carryOn(b, score, notesPhase = true) {
    const speed = b.step.speed || b.speed;
    b.res.speed = speed;
    const left = b.budget - blockElapsed();
    if (b.item.level !== 'new' && left > CONTINUE_SEC && elapsed() < R.plan.duration * 60 - CONTINUE_SEC) {
      b.speed = !notesPhase && score >= R.plan.prof.fixed ? clampSpeed(speed + SPEED_STEP) : speed;
      b.item.goal = b.notesPhase ? b.speed : clampSpeed(b.speed + 0.1);
      b.item.range = nextRange(b, left);
      setTimeout(() => startSong(b), 3500);
    } else setTimeout(nextBlock, 3500);
  }
  // what became of the chunks, for the summary
  // (all of a song's blocks: the extra rounds add theirs)
  function keepChunks() {
    R.results.forEach(r => { r.chunks = []; });
    R.blocks.forEach(b => { if (b.kind === 'song' && b.allChunks) b.res.chunks.push(...b.allChunks.map(c => ({ from: c.from, to: c.to, done: c.done && !c.setAside, speed: c.speed, stage: c.stages[Math.min(c.stage, c.stages.length - 1)].name }))); });
  }
  function wrapSong(b) {
    songApp.routine.pause();
    keepChunks();
    if (R.plan.prof.finalRun || b.item.level === 'new') startFinal(b);
    else nextBlock();
  }

  // ---------- skipping, pausing, ending ----------
  function skip() {
    if (!R) return;
    const b = R.blocks[R.blockIdx];
    if (b.kind === 'scales') { b.count = 0; if (++b.idx >= b.items.length) nextBlock(); else showScaleItem(b); return; }
    if (b.kind === 'chords') { nextBlock(); return; }
    if (b.drill) { endDrill(b); return; }
    if (b.step.kind === 'run') { songApp.routine.pause(); b.chunks = [makeChunk(b, b.item.range.from, b.item.range.to, null)]; b.queue = b.chunks; b.cur = 0; runChunk(b, true); return; }
    if (b.step.kind === 'final') { nextBlock(); return; }
    const c = b.queue[b.cur];
    b.notice = '';
    c.stage++; c.streak = 0; c.turn = 0;
    if (c.stage >= c.stages.length) { c.done = true; if (b.queue.every(x => x.done)) return wrapSong(b); let k = b.cur; do k = (k + 1) % b.queue.length; while (b.queue[k].done); b.cur = k; }
    runChunk(b);
  }
  // the stage tap in Scales / Chords (js/tabs.js): next item
  function skipItem() {
    if (!R || R.pausedAt) return false;
    const b = R.blocks[R.blockIdx];
    if (b.kind === 'scales' && mode === 'scales') { skip(); return true; }
    if (b.kind === 'chords' && mode === 'chords') { if (nextChordItem(b)) showChordItem(b); else nextBlock(); return true; }
    if (b.kind === 'song' && b.drill && mode === 'chords') { nextDrillItem(b); return true; }
    return false;
  }
  function togglePause() {
    if (!R) return;
    if (R.pausedAt) { R.pausedFor += now() - R.pausedAt; R.pausedAt = 0; backToStep(); }
    else { R.pausedAt = now(); songApp.routine.pause(); clearTimeout(R.autoPlay); }
    renderBar();
  }
  // back to the tab of the current step (after looking at another tab, or a pause)
  function backToStep() {
    const b = R.blocks[R.blockIdx];
    if (b.kind === 'scales') { setMode('scales'); showScaleItem(b); }
    else if (b.kind === 'chords') { setMode('chords'); showChordItem(b); }
    else if (b.drill) { setMode('chords'); b.drill.ready = false; showDrillItem(b); }
    else {
      setMode('songs');
      songApp.routine.focus();
      if (b.step.kind === 'chunk') runChunk(b);
      else songSetup({ song: b.item.song, hands: 'both', pmode: 'wait', speed: b.step.speed || b.speed, loop: [b.step.from, b.step.to] }, 1500);
    }
  }
  function tick() {
    if (!R || R.pausedAt) return;
    const b = R.blocks[R.blockIdx];
    // time's up: the part you are on is finished first (onSongEvent, targetDone); only well past it, the end
    if (overMax() && !(b && b.kind === 'song' && mode === 'songs' && songApp.routine.clock().playing)) return finish();
    // a warm-up block that ran well over moves on by itself
    if (b && (b.kind === 'scales' || b.kind === 'chords') && blockElapsed() > b.budget + OVERTIME) nextBlock();
    renderBar();
  }
  function finish() {
    if (!R) return;
    clearInterval(R.timer); clearTimeout(R.autoPlay);
    songApp.routine.pause();
    songApp.routine.setHook(null);
    hideTarget = false;
    // put the Scales / Chords hand settings back
    handsGap = 24; forcedHand = null;
    const both = $('opt-both-hands');
    if (both.checked !== R.saved.both) { both.checked = R.saved.both; both.dispatchEvent(new Event('change')); }
    octaveSelect.value = R.saved.octave; octaveSelect.dispatchEvent(new Event('change'));
    const dir = document.querySelector(`input[name="dir"][value="${R.saved.dir}"]`); if (dir) dir.checked = true;
    // the scale you were on (else the Scales tab picks one), and the Songs tab as you left it
    if (R.saved.scale) setScale(R.saved.scale.root, R.saved.scale.type); else sTarget = null;
    songApp.routine.restore(R.saved.songs);
    // remember per song: the speed to start at next time, the date, the history
    const prof = R.plan.prof;
    keepChunks();
    R.results.forEach(r => {
      const mem = load(songKey(r.song.id), {});
      const p = r.parts[r.parts.length - 1], ran = !p ? null : p.after !== null ? p.after : p.before;
      if (ran !== null) {
        if (ran >= prof.fixed) mem.speed = clampSpeed(r.speed + (r.level === 'known' && mem.notesOk ? SPEED_STEP : 0));
        else if (ran < prof.fixed - 20) mem.speed = clampSpeed(r.speed - SPEED_STEP);
        else mem.speed = r.speed;
      }
      mem.lastAt = Date.now();
      mem.todo = r.chunks.filter(c => !c.done).map(c => ({ from: c.from, to: c.to })); // picked up next session
      mem.history = [...(mem.history || []), { at: Date.now(), duration: R.plan.duration, parts: r.parts, speed: r.speed }].slice(-20);
      save(songKey(r.song.id), mem);
    });
    const done = R;
    R = null;
    document.body.classList.remove('routine-on');
    renderBar();
    setMode('routine');
    renderSummary(done);
  }

  // ---------- the bar (on every tab while a routine runs) ----------
  const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function stepInfo() {
    const b = R.blocks[R.blockIdx], reps = R.plan.prof.reps;
    if (!b) return { title: '', tip: '', count: '' };
    const handName = { rh: 'right hand', lh: 'left hand', both: 'both hands' };
    // a chord / scale you know: from memory (or shown again after a slip)
    const mem = (b.kind === 'scales' || b.kind === 'chords') && b.key && isKnown(b.key)
      ? (hideTarget ? 'From memory: you know this one, so the keys are not shown. ' : 'Shown again after the slip. ') : '';
    if (b.kind === 'scales') {
      const it = b.items[b.idx];
      return { phase: 'warm-up · scales', title: `${NAMES[it.scale.root]} ${it.scale.type.name.toLowerCase()} · ${handName[it.hands]}`,
        tip: mem + `The key of ${it.song.title}. Even, relaxed and up & down: a slip starts it again.`, count: `${b.count} / ${reps}` };
    }
    if (b.kind === 'chords') {
      const p = b.phases[b.ph];
      const tip = {
        rh: 'What your right hand plays in the song, in its order and voiced as in the song (the inversion it uses). Find each shape without looking for the notes one by one.',
        lh: 'What your left hand plays in the song (often just root and 5th, or an octave), in its order and voicing.',
      }[p.hand];
      return { phase: 'warm-up · chords', title: `${p.song.title} · ${handName[p.hand]}: ${p.items.map(chordName).join(' → ')}`,
        tip: mem + tip, count: `round ${b.lap + 1} / ${reps}` };
    }
    const song = b.item.song.title, bars = (f, t) => f === t ? `bar ${f}` : `bars ${f}–${t}`;
    if (b.drill) {
      const d = b.drill;
      return { phase: song + ' · drill', title: `${d.name} · ${handName[d.hand]}: ${d.items.map(chordName).join(' → ')}${d.items.length > 1 ? ' → …' : ''}`,
        tip: d.tip + ' As the song voices it.', count: `round ${d.lap + 1} / ${d.laps}` };
    }
    if (b.step.kind === 'run') return { phase: song, title: `First run · ${bars(b.item.range.from, b.item.range.to)} · ${pct(b.speed)}`,
      tip: `Play it once without stopping to fix anything: this finds the bars to work on. ${b.item.level === 'known' ? 'It starts by itself after a one-bar count-in.' : 'Start whenever you are ready: the song waits for you.'}`, count: '' };
    if (b.step.kind === 'final') return { phase: song, title: `Final run · ${bars(b.step.from, b.step.to)}`,
      tip: b.part && b.part.before !== null ? `Once more, all the way. First run: ${b.part.before}%.` : 'Hands together, all the bars you learnt today.', count: '' };
    const c = b.queue[b.cur], st = c.stages[Math.min(c.stage, c.stages.length - 1)];
    const tips = {
      alone: 'One hand alone, the song waits for you: the right notes and fingers first, speed later.',
      together: 'Hands together, the song waits for you. Slow and clean beats fast and messy.',
      ladder: `Tempo ladder: ${reps} clean in a row → 5% faster, a mistake → 5% slower. Goal ${pct(b.item.goal)}.`,
      context: 'With a bar before and after, so it fits back into the music.',
    };
    const tip = (b.notice ? b.notice + ' ' : '') + (st.tip ? st.tip : st.context ? tips.context : st.ladder ? tips.ladder : st.hands === 'both' ? tips.together : tips.alone) +
      (b.notesPhase ? ` Notes first: the tempo comes once you have played the whole song right (${notesShare(b.item.song)} of its bars so far).` : '');
    const open = b.queue.filter(x => !x.done).length;
    const last = c.fails === FAIL_LIMIT - 1 ? ' (if this one slips too, it waits for next session and you move on)' : '';
    const again = c.again ? `Not clean yet (${c.again} slip${c.again > 1 ? 's' : ''}): once more from the start, whenever you are ready${last}. `
      : c.againTiming ? `The notes were right, but ${c.againTiming} came off the pulse: once more, steady and even${last}. ` : '';
    // how much timing counts now (js/songs.js): it grows as you learn these bars
    const strict = songApp.routine.clock().timing;
    const timing = b.notesPhase ? 'Only the notes count for now.' : strict < 0.34 ? 'Timing hardly counts yet: get the notes.' : strict < 0.67 ? 'Timing counts a fair bit now: keep a steady pulse.'
      : 'Timing counts fully: steady and even, every note.';
    const [sf, stt] = st.range || [c.from, c.to];
    return { phase: song, title: `${bars(sf, stt)} · ${st.name}${st.ladder || st.context ? ' · ' + pct(c.speed) : st.speed ? ' · ' + pct(st.speed) : ''}`,
      tip: again + tip + ' ' + timing + (open > 1 ? ` (${open} spots, in song order.)` : ''),
      count: `clean ${c.streak} / ${st.context ? 1 : reps}` };
  }
  function renderBar() {
    const bar = $('routine-bar');
    if (!R) { bar.hidden = true; return; }
    bar.hidden = false;
    const b = R.blocks[R.blockIdx], info = stepInfo();
    const left = R.plan.duration * 60 - elapsed(), blockLeft = b ? b.budget - blockElapsed() : 0;
    const away = b && ((b.kind === 'scales' && mode !== 'scales') || (b.kind === 'chords' && mode !== 'chords') || (b.kind === 'song' && mode !== (b.drill ? 'chords' : 'songs')));
    $('routine-bar-phase').textContent = `${info.phase || ''} · step ${R.blockIdx + 1} of ${R.blocks.length}`;
    $('routine-bar-title').textContent = info.title;
    $('routine-bar-tip').textContent = info.tip;
    $('routine-bar-count').textContent = info.count;
    $('routine-bar-time').textContent = `${mmss(blockLeft)} for this · ${mmss(left)} left`;
    $('routine-bar-time').classList.toggle('over', blockLeft < 0);
    $('routine-pause').textContent = R.pausedAt ? 'Resume' : away ? 'Back to it' : 'Pause';
    $('routine-bar').classList.toggle('paused', !!R.pausedAt);
  }

  // ---------- the Routine tab: setup, plan, summary ----------
  function renderSetup() {
    $('routine-summary').hidden = true;
    $('routine-setup').hidden = false;
    const list = $('routine-songs');
    list.innerHTML = '';
    const songs = SONGS.filter(s => s.publicDomain || localStorageUnlocked());
    setup.songs = setup.songs.filter(id => songs.some(s => s.id === id));
    songs.forEach(song => {
      const level = levelOf(song), p = songApp.routine.progress(song), on = setup.songs.includes(song.id);
      const card = document.createElement('label');
      card.className = 'routine-song' + (on ? ' on' : '');
      card.innerHTML = `
        <input type="checkbox" ${on ? 'checked' : ''} ${!on && setup.songs.length >= MAX_SONGS ? 'disabled' : ''}>
        <span class="routine-song-main">
          <b>${esc(song.title)}</b><small>${esc(song.composer || '')}${song.key ? ' · ' + esc(song.key) : ''}</small>
          <span class="routine-level level-${level}">${esc(LEVEL_TEXT[level][0])}: ${esc(LEVEL_TEXT[level][1])}</span>
          <span class="routine-prog">right ${pct(p.rh)} · left ${pct(p.lh)} · both ${pct(p.both)}</span>
        </span>
        <button type="button" class="action-btn routine-calibrate" title="Already know it? Play it through once with both hands in the Songs tab: the routine then starts you on both hands">Calibrate</button>`;
      card.querySelector('input').addEventListener('change', e => {
        if (e.target.checked && setup.songs.length < MAX_SONGS) setup.songs.push(song.id);
        else setup.songs = setup.songs.filter(id => id !== song.id);
        save(setupKey, setup); renderSetup();
      });
      card.querySelector('.routine-calibrate').addEventListener('click', e => {
        e.preventDefault();
        setMode('songs');
        songApp.routine.setup({ song, hands: 'both', pmode: 'wait', speed: 0.7, loop: null });
        songApp.routine.focus();
      });
      list.appendChild(card);
    });
    document.querySelectorAll('#routine-durations button').forEach(btn => btn.setAttribute('aria-pressed', String(+btn.dataset.min === setup.duration)));
    $('routine-start').disabled = !setup.songs.length;
    renderPlan();
  }
  const localStorageUnlocked = () => { try { return localStorage.getItem('songs-unlocked') === '1'; } catch { return false; } };
  function renderPlan() {
    const el = $('routine-plan');
    if (!setup.songs.length) { el.innerHTML = '<p class="routine-empty">Pick up to three songs to see your plan.</p>'; return; }
    const plan = buildPlan(setup.songs, setup.duration), prof = plan.prof;
    const min = s => Math.max(1, Math.round(s / 60));
    const rows = [];
    const scaleHands = x => plan.duration >= 30 || x.level === 'known' ? 'right, left, both hands' : 'right, left hand';
    if (plan.scales.length) rows.push(['Warm-up · scales', min(plan.scaleSec), [...new Map(plan.scales.map(x => [x.scale.root + x.scale.type.name, `${NAMES[x.scale.root]} ${x.scale.type.name.toLowerCase()} (${scaleHands(x)})`])).values()].join(', ')]);
    const handWord = { rh: 'right', lh: 'left' };
    if (plan.chords.length) rows.push(['Warm-up · chords', min(plan.chordSec), plan.chords.map(x => `${x.song.title}: ${x.hands.map(h => `${handWord[h.hand]} ${h.chords.map(chordName).join(' → ')}`).join('; ')}`).join(' · ')]);
    plan.items.forEach(it => {
      const bars = it.range.whole ? 'the whole song' : `bars ${it.range.from}–${it.range.to}`;
      const later = ` (tempo once you play the whole song right: ${notesShare(it.song)} of its bars so far)`;
      const how = it.level === 'new'
        ? `${bars}, two bars at a time: each hand alone, then together, at ${pct(it.speed)}${it.notes ? later : ', then a tempo ladder'}`
        : `run ${bars} at ${pct(it.speed)}, fix the ${prof.chunks} weakest spots${prof.isolate ? ' (a weak hand alone first)' : ''}${it.notes ? ', notes only' + later : `, tempo ladder to ${pct(it.goal)}`}${prof.finalRun ? ', final run' : ''}`;
      rows.push([`${it.song.title} · ${LEVEL_TEXT[it.level][0]}`, min(it.budget), how]);
    });
    el.innerHTML = `<ol class="routine-plan-list">${rows.map(([t, m, d]) => `<li><span class="routine-plan-min">${m} min</span><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      <p class="routine-rules">${esc(`${plan.duration} minutes: ${prof.reps > 1 ? prof.reps + ' clean passes in a row' : 'one clean pass'} to move on, a spot counts as fixed at ${prof.fixed}%.`)}${plan.later.length ? ' ' + esc(`Next session: ${plan.later.map(s => s.title).join(', ')} (not enough time for all three today).`) : ''}</p>`;
  }
  function renderSummary(done) {
    $('routine-setup').hidden = true;
    const el = $('routine-summary');
    el.hidden = false;
    const mins = Math.round((done.pausedAt || now()) - done.start - done.pausedFor) / 60;
    const rows = done.results.map(r => {
      const uniq = cs => [...new Map(cs.map(c => [c.from + '-' + c.to, c])).values()].sort((x, y) => x.from - y.from);
      const fixed = uniq(r.chunks.filter(c => c.done)), open = uniq(r.chunks.filter(c => !c.done && !fixed.some(f => f.from === c.from && f.to === c.to)));
      const bars = c => c.from === c.to ? `bar ${c.from}` : `bars ${c.from}–${c.to}`;
      const range = p => p.from === 1 && p.to === r.song.bars.length ? 'Whole song' : `Bars ${p.from}–${p.to}`;
      const score = p => p.after === null ? `first run ${p.before}%` : p.before === null ? `${p.after}%` : `${p.before}% → ${p.after}%`;
      const last = [...r.parts].reverse().find(p => p.after !== null) || r.parts[r.parts.length - 1]; // the last finished round
      return `<div class="routine-result">
        <div class="routine-result-head"><b>${esc(r.song.title)}</b>${last ? `<span class="routine-score">${esc(score(last))}</span>` : ''}</div>
        <p>${r.parts.map((p, i) => esc(`${r.parts.length > 1 ? `Round ${i + 1}, ${range(p).toLowerCase()}` : range(p)}: ${score(p)}.`)).join(' ')} ${esc(`Speed ${pct(r.speed)}.`)}
        ${fixed.length ? esc(` Fixed: ${fixed.map(bars).join(', ')}.`) : ''}
        ${open.length ? esc(` Still to do: ${open.map(c => `${bars(c)} (${c.stage})`).join(', ')}.`) : ''}</p>
      </div>`;
    }).join('');
    el.innerHTML = `<div class="section-head"><span>Session done · ${Math.round(mins)} min</span></div>${rows || '<p>No song work this time.</p>'}
      <p class="routine-rules">Next time starts from here: the speeds and the bars to work on are remembered.</p>
      <button type="button" class="action-btn" id="routine-again">Back to the plan</button>`;
    $('routine-again').addEventListener('click', renderSetup);
  }

  // ---------- wiring ----------
  document.querySelectorAll('#routine-durations button').forEach(btn => btn.addEventListener('click', () => {
    setup.duration = +btn.dataset.min; save(setupKey, setup); renderSetup();
  }));
  $('routine-start').addEventListener('click', start);
  $('routine-skip').addEventListener('click', skip);
  $('routine-pause').addEventListener('click', () => {
    const b = R && R.blocks[R.blockIdx];
    const away = b && !R.pausedAt && ((b.kind === 'scales' && mode !== 'scales') || (b.kind === 'chords' && mode !== 'chords') || (b.kind === 'song' && mode !== (b.drill ? 'chords' : 'songs')));
    if (away) { backToStep(); renderBar(); } else togglePause();
  });
  $('routine-end').addEventListener('click', finish);

  return {
    targetDone, miss, skipItem,
    active: () => !!R,
    // for settings.js while a routine runs: your own values of the settings the routine changes, saved instead
    normalSettings: () => R && {
      controls: { 'opt-both-hands': R.saved.both, 'octave-select': R.saved.octave, ...R.saved.songControls },
      radios: { dir: R.saved.dir, ...R.saved.songRadios },
    },
    show() {
      if (R) { // running: the bar above has the controls
        $('routine-setup').hidden = true;
        $('routine-summary').hidden = false;
        $('routine-summary').innerHTML = '<p class="routine-rules">Your routine is running: the bar at the top shows the step. "Back to it" returns to the practice.</p>';
      } else if ($('routine-summary').hidden || $('routine-summary').querySelector('.routine-rules:only-child')) renderSetup();
    },
  };
})();
