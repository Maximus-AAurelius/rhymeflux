/* ScrewShop STUDIO — a GarageBand-style multitrack session on one Web Audio clock.
   Tracks hold clips. A clip plays its audio from `start` (session seconds) for
   `length` seconds; a length longer than the audio repeats it (a loop).
   The arrange area (ruler, track headers, lanes, clips) is drawn straight into
   #gb-arrange by this file, so dragging stays smooth and never re-renders the app. */
window.RecordingStudio = class RecordingStudio {
  constructor(app) {
    this.app = app; this.tracks = []; this.buffers = new Map(); this.voices = []; this.cursor = 0;
    this.playing = false; this.busy = false; this.ready = false; this.rate = 1;
    this.bpm = 82; this.cycle = { on: false, start: 0, end: 0 }; this.metronome = false; this.countIn = true;
    this.zoom = 26; // pixels per beat
    this.selected = null; this.drag = null; this.dirty = true;
    this.timer = setInterval(() => this.tick(), 50);
    this.onPointerDown = (e) => this.pointerDown(e);
    this.onKey = (e) => this.key(e);
    this.onDragStart = (e) => this.loopDragStart(e);
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('dragstart', this.onDragStart);
    this.onResize = () => { this.dirty = true; };
    window.addEventListener('resize', this.onResize);
  }

  // ---------- plumbing ----------
  notify(message) { this.app.setState({ notice: message }); }
  refresh() { this.dirty = true; this.app.setState(p => ({ studioRevision: (p.studioRevision || 0) + 1 })); }
  context() {
    if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); }
    return this.ctx;
  }
  async checked(query) { const result = await query; if (result.error) throw new Error(result.error.message); return result.data; }
  url(bucket, path) { return '/audio/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/'); }
  newId() { return window.ScrewShop?.id ? window.ScrewShop.id() : Math.random().toString(36).slice(2); }
  beat() { return 60 / this.bpm; }
  bar() { return this.beat() * 4; }
  pps() { return this.zoom / this.beat(); } // pixels per session second
  snap(sec, free) { if (free) return Math.max(0, sec); const b = this.beat(); return Math.max(0, Math.round(sec / b) * b); }
  snapBar(sec) { const b = this.bar(); return Math.max(0, Math.round(sec / b) * b); }
  allClips() { return this.tracks.flatMap(t => t.clips.map(c => ({ track: t, clip: c }))); }
  findClip(id) { return this.allClips().find(x => x.clip.id === id); }
  clipLen(c) { return c.length != null ? c.length : (this.buffers.get(c.url)?.duration || c.dur || 0); }
  audioLen(c) { return this.buffers.get(c.url)?.duration || c.dur || 0; }

  // Old sessions stored one audio file per track with an `offset`. Turn each into a one-clip track.
  normalize(t) {
    if (Array.isArray(t.clips)) return { volume: 0.8, ...t, clips: t.clips.map(c => ({ id: c.id || this.newId(), ...c })) };
    const clips = t.url ? [{ id: t.id + '-clip', name: t.name, url: t.url, start: +t.offset || 0, length: null, dur: t.duration }] : [];
    return { id: t.id, name: t.name, volume: t.volume ?? 0.8, muted: !!t.muted, solo: !!t.solo, clips };
  }

  async load() {
    try {
      const saved = await this.checked(this.app.sb.from('settings').select('*').eq('id', 'recording-session').maybeSingle());
      if (saved && Array.isArray(saved.tracks)) {
        this.tracks = saved.tracks.map(t => this.normalize(t));
        if (saved.bpm) this.bpm = +saved.bpm;
        if (saved.cycle) this.cycle = { ...this.cycle, ...saved.cycle };
        if (saved.metronome != null) this.metronome = !!saved.metronome;
        if (saved.countIn != null) this.countIn = !!saved.countIn;
        if (saved.zoom) this.zoom = +saved.zoom;
      } else {
        const beats = await this.checked(this.app.sb.from('beats').select('*').eq('song_id', this.app.SONG_UUID).order('created_at', { ascending: false }));
        if (beats?.[0]?.storage_path) this.tracks.push(this.normalize({ id: 'beat', name: beats[0].label || 'Beat', url: this.url('beats', beats[0].storage_path), offset: 0, volume: 0.8 }));
        const takes = await this.checked(this.app.sb.from('takes').select('*').eq('song_id', this.app.SONG_UUID).order('created_at'));
        for (const take of takes || []) this.tracks.push(this.normalize({ id: take.id, name: take.label || 'Vocal take', url: this.url('takes', take.storage_path), offset: take.offset_secs || 0, volume: 0.8 }));
        if (this.app.state?.sourceBpm) this.bpm = this.app.state.sourceBpm;
      }
      this.ready = true; this.refresh();
      await Promise.all(this.allClips().map(({ clip }) => this.decode(clip).catch(e => { clip.loadError = e.message; })));
      this.refresh();
    } catch (e) { this.notify('Could not load recording session: ' + e.message); }
  }

  save() {
    const tracks = this.tracks.map(t => ({ ...t, clips: t.clips.map(({ loadError, ...c }) => c) }));
    const body = { id: 'recording-session', version: 2, tracks, bpm: this.bpm, cycle: this.cycle, metronome: this.metronome, countIn: this.countIn, zoom: this.zoom };
    this.saving = (this.saving || Promise.resolve()).catch(() => {}).then(() => this.checked(this.app.sb.from('settings').upsert(body))).catch(e => { this.notify('Session not saved: ' + e.message); throw e; });
    this.saving.catch(() => {});
    return this.saving;
  }

  async decode(clipOrTrack) {
    const url = clipOrTrack.url;
    if (!url) return null;
    if (this.buffers.has(url)) { clipOrTrack.dur = this.buffers.get(url).duration; return this.buffers.get(url); }
    const response = await fetch(url); if (!response.ok) throw new Error('Audio file unavailable');
    const buffer = await this.context().decodeAudioData(await response.arrayBuffer());
    this.buffers.set(url, buffer); clipOrTrack.dur = buffer.duration; delete clipOrTrack.loadError; return buffer;
  }

  contentEnd() { return Math.max(0, ...this.allClips().map(({ clip }) => (+clip.start || 0) + this.clipLen(clip))); }
  duration() { return Math.max(this.bar() * 8, this.contentEnd(), this.recording ? this.position() + 2 : 0); }

  // ---------- playback ----------
  cyclePlan(recording) {
    const c = this.cycle;
    if (recording || !c.on || c.end - c.start < this.beat() - 1e-6 || this.cursor >= c.end) return null;
    return { start: c.start, end: c.end };
  }
  position() {
    if (!this.playing) return this.cursor;
    const el = Math.max(0, this.context().currentTime - this.t0) * this.rate;
    const plan = this.plan;
    if (!plan) return this.p0 + el;
    const first = plan.end - this.p0;
    if (el < first) return this.p0 + el;
    const len = plan.end - plan.start;
    return plan.start + ((el - first) % len);
  }
  // Remember a scheduled sound so STOP can silence it; forget it once it finishes.
  track(source) { const v = { source }; this.voices.push(v); source.onended = () => { const i = this.voices.indexOf(v); if (i >= 0) this.voices.splice(i, 1); }; }
  level(track) { return track.muted || (this.tracks.some(t => t.solo) && !track.solo) ? 0 : (track.volume ?? 0.8); }
  click(at, accent) {
    const ctx = this.context(), osc = ctx.createOscillator(), g = ctx.createGain();
    osc.frequency.value = accent ? 1760 : 1175; g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(accent ? 0.45 : 0.28, at + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    osc.connect(g); g.connect(this.master); osc.start(at); osc.stop(at + 0.07);
    this.track(osc);
  }
  // Play session time [from, to) starting at context time `at`.
  schedulePass(from, to, at) {
    const ctx = this.context();
    for (const track of this.tracks) {
      const gain = this.trackGains.get(track.id); if (!gain) continue;
      for (const clip of track.clips) {
        const buffer = this.buffers.get(clip.url); if (!buffer) continue;
        const D = buffer.duration, L = this.clipLen(clip); if (D <= 0 || L <= 0) continue;
        const segStart = Math.max(from, clip.start), segEnd = Math.min(to, clip.start + L);
        let t = segStart, guard = 0;
        while (t < segEnd - 1e-4 && guard++ < 4000) {
          const local = (t - clip.start) % D, chunk = Math.min(D - local, segEnd - t);
          if (chunk > 1e-4) {
            const source = ctx.createBufferSource(); source.buffer = buffer; source.playbackRate.value = this.rate;
            source.connect(gain); source.start(at + (t - from) / this.rate, local, chunk);
            this.track(source);
          }
          t += Math.max(chunk, 1e-4);
        }
      }
    }
  }
  scheduleClicks(from, to, at) {
    if (!this.metronome) return;
    const b = this.beat();
    for (let k = Math.ceil((from - 1e-6) / b); k * b < to; k++) this.click(at + (k * b - from) / this.rate, k % 4 === 0);
  }
  halt(reset = false) {
    this.cursor = reset ? 0 : this.position(); this.playing = false; this.plan = null;
    for (const voice of this.voices) { try { voice.source.stop(); } catch (_) {} try { voice.source.disconnect(); } catch (_) {} }
    for (const g of this.trackGains?.values() || []) { try { g.disconnect(); } catch (_) {} }
    this.voices = []; this.trackGains = new Map(); this.refresh();
  }
  async play(recording = false) {
    if (this.busy || !this.ready) return;
    this.busy = true;
    try {
      const ctx = this.context(); await ctx.resume();
      await Promise.all(this.allClips().map(({ clip }) => this.decode(clip).catch(e => { clip.loadError = e.message; })));
      if (this.cursor >= this.contentEnd() && !recording && !this.cycle.on) this.cursor = 0;
      this.trackGains = new Map();
      for (const track of this.tracks) { const g = ctx.createGain(); g.gain.value = this.level(track); g.connect(this.master); this.trackGains.set(track.id, g); }
      this.t0 = ctx.currentTime + (recording ? 0 : 0.05); this.p0 = this.cursor; this.plan = this.cyclePlan(recording);
      this.playing = true;
      if (this.plan) {
        this.schedulePass(this.cursor, this.plan.end, this.t0); this.scheduleClicks(this.cursor, this.plan.end, this.t0);
        this.nextPassAt = this.t0 + (this.plan.end - this.cursor) / this.rate;
      } else {
        this.schedulePass(this.cursor, Infinity, this.t0);
        this.clickUntil = this.cursor; this.topUpClicks();
      }
      this.app.setState({ transportSource: 'studio', transportTitle: 'STUDIO · Multitrack session', beatRate: this.rate }); this.refresh();
    } catch (e) { this.halt(); this.notify('Could not play session: ' + e.message); throw e; }
    finally { this.busy = false; }
  }
  // Linear playback: keep about 4 seconds of metronome clicks queued ahead.
  topUpClicks() {
    if (!this.playing || this.plan || !this.metronome) return;
    const ahead = this.position() + 4 * this.rate;
    if (this.clickUntil >= ahead) return;
    const from = this.clickUntil, to = ahead;
    this.scheduleClicks(from, to, this.t0 + (from - this.p0) / this.rate);
    this.clickUntil = to;
  }
  async toggle() {
    if (this.recording) { this.stopRecord(); return; }
    if (this.playing) this.halt(); else { this.app.stopPlayback(); await this.play(); }
  }
  restartIfPlaying(fn) {
    const resume = this.playing && !this.recording; if (resume) this.halt();
    fn();
    if (resume) this.play().catch(() => {});
    this.refresh();
  }
  seek(value) {
    if (this.recording || this.busy) return;
    this.restartIfPlaying(() => { this.cursor = Math.max(0, Math.min(this.duration(), Number(value) || 0)); });
  }
  setRate(value) { if (this.recording) return; this.restartIfPlaying(() => { this.rate = value; }); }

  // ---------- editing ----------
  change(id, patch) {
    const track = this.tracks.find(t => t.id === id); if (!track) return;
    Object.assign(track, patch);
    const ctx = this.ctx;
    if (ctx) for (const t of this.tracks) { const g = this.trackGains?.get(t.id); if (g) g.gain.setTargetAtTime(this.level(t), ctx.currentTime, 0.01); }
    this.save(); this.refresh();
  }
  setBpm(v) {
    v = Math.round(+v); if (!(v >= 30 && v <= 300)) return;
    this.restartIfPlaying(() => { this.bpm = v; }); this.save();
  }
  toggleCycle() {
    this.restartIfPlaying(() => {
      if (this.cycle.end - this.cycle.start < this.beat()) {
        const s = this.snapBar(this.cursor); this.cycle = { on: true, start: s, end: s + this.bar() * 4 };
      } else this.cycle.on = !this.cycle.on;
    }); this.save();
  }
  toggleMetronome() { this.restartIfPlaying(() => { this.metronome = !this.metronome; }); this.save(); }
  toggleCountIn() { this.countIn = !this.countIn; this.save(); this.refresh(); }
  setZoom(dir) { this.zoom = Math.max(8, Math.min(90, Math.round(this.zoom * (dir > 0 ? 1.35 : 1 / 1.35)))); this.save(); this.refresh(); }
  palette(i) { return ['#b98af2', '#63d6b2', '#f5a35c', '#6fb5ff', '#f27ab0', '#e8d45c', '#8fd16a', '#ff8a7a'][i % 8]; }
  addTrack(name) {
    const n = this.tracks.length + 1;
    const track = { id: this.newId(), name: name || 'Track ' + n, volume: 0.8, muted: false, solo: false, clips: [] };
    this.tracks.push(track); this.save(); this.refresh(); return track;
  }
  deleteTrack(id) {
    if (this.recording) return;
    const t = this.tracks.find(x => x.id === id); if (!t) return;
    if (t.clips.length && !confirm('Remove track "' + t.name + '" and its clips from the session? Your audio files stay in SONGS/takes.')) return;
    this.restartIfPlaying(() => { this.tracks = this.tracks.filter(x => x.id !== id); }); this.save();
  }
  async addClip(trackId, item, start) {
    if (!item?.url) { this.notify('That file has no audio address yet.'); return; }
    const clip = { id: this.newId(), name: item.name || 'Clip', url: item.url, start: this.snap(start ?? this.cursor), length: null };
    try { await this.decode(clip); } catch (e) { this.notify('Could not load ' + clip.name + ': ' + e.message); return; }
    let track = this.tracks.find(t => t.id === trackId);
    this.restartIfPlaying(() => {
      if (!track) { track = this.addTrack(item.name); }
      track.clips.push(clip);
    });
    this.selected = clip.id; this.save(); this.refresh();
  }
  moveClip(clipId, trackId, start) {
    const found = this.findClip(clipId); if (!found) return;
    this.restartIfPlaying(() => {
      found.clip.start = Math.max(0, start);
      let dest = this.tracks.find(t => t.id === trackId);
      if (trackId === '__new') dest = this.addTrack(found.clip.name);
      if (dest && dest !== found.track) { found.track.clips = found.track.clips.filter(c => c !== found.clip); dest.clips.push(found.clip); }
    }); this.save();
  }
  setClipLength(clipId, len) {
    const found = this.findClip(clipId); if (!found) return;
    this.restartIfPlaying(() => { found.clip.length = Math.max(this.beat() / 4, len); }); this.save();
  }
  deleteClip(clipId) {
    const found = this.findClip(clipId); if (!found || this.recording) return;
    this.restartIfPlaying(() => { found.track.clips = found.track.clips.filter(c => c !== found.clip); });
    if (this.selected === clipId) this.selected = null; this.save();
  }
  duplicateClip(clipId) {
    const found = this.findClip(clipId); if (!found) return;
    const c = found.clip, copy = { ...c, id: this.newId(), start: c.start + this.clipLen(c) };
    this.restartIfPlaying(() => { found.track.clips.push(copy); }); this.selected = copy.id; this.save();
  }
  async setBeat(item) {
    if (this.recording || this.busy) { this.notify('Stop recording or loading before replacing the beat.'); return; }
    try {
      const clip = { id: this.newId(), name: item.name || item.label || 'Instrumental', url: item.url, start: 0, length: null };
      await this.decode(clip); this.app.stopPlayback(); this.halt(true);
      let beat = this.tracks.find(t => t.id === 'beat');
      if (!beat) { beat = { id: 'beat', name: clip.name, volume: 0.8, muted: false, solo: false, clips: [] }; this.tracks.unshift(beat); }
      beat.name = clip.name; beat.clips = [clip];
      await this.save();
      this.app.setState({ tab: 'studio', transportSource: 'studio', transportTitle: 'STUDIO · ' + clip.name }); this.refresh();
    } catch (e) { this.notify('Beat could not be loaded: ' + e.message); }
  }
  async uploadFile(file) {
    const path = 'local/library/' + this.newId() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    await this.checked(this.app.sb.storage.from('beats').upload(path, file));
    const row = await this.checked(this.app.sb.from('library').insert({ user_id: 'local', name: file.name, storage_path: path }).select().single());
    this.app.loadLibrary();
    return { ...row, name: file.name.replace(/\.[^.]+$/, ''), url: this.url('beats', path) };
  }
  // IMPORT AUDIO: the first import becomes the beat on Track 1; later ones get their own track at the playhead.
  importBeat() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'audio/*,.wav,.mp3,.m4a';
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        const item = await this.uploadFile(file);
        if (!this.tracks.some(t => t.id === 'beat' && t.clips.length)) await this.setBeat(item);
        else await this.addClip(null, item, this.cursor);
      } catch (e) { this.notify('Import failed: ' + e.message); }
    }; input.click();
  }

  // ---------- recording ----------
  async record() {
    if (this.recording) { this.stopRecord(); return; }
    if (this.busy || !this.ready || this.pending) return;
    this.busy = true; this.refresh(); let stream;
    try {
      const ctx = this.context(); await ctx.resume();
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await Promise.all(this.allClips().map(({ clip }) => this.decode(clip).catch(() => {})));
      const offset = this.position(); this.app.stopPlayback(); this.cursor = offset; this.rate = 1;
      if (this.countIn) { // one bar of clicks before the take starts
        const b = this.beat(), at = ctx.currentTime + 0.05;
        for (let i = 0; i < 4; i++) this.click(at + i * b, i === 0);
        this.app.setState({ notice: 'Count-in… 1 2 3 4' });
        await new Promise(r => setTimeout(r, (0.05 + 4 * b) * 1000));
      }
      const recorder = new MediaRecorder(stream), chunks = [];
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        this.pending = { blob, offset: this.captureOffset, id: this.newId(), name: 'Vocal ' + (this.tracks.filter(t => t.id !== 'beat').length + 1) };
        this.app.setState({ rec: false, secs: 0 }); this.refresh(); await this.saveRecording();
      };
      this.recorder = recorder; this.recording = true; this.recordStarted = performance.now();
      this.busy = false; await this.play(true);
      // Align the clip with the shared audio clock at the instant capture starts.
      recorder.start(); this.captureOffset = this.position();
      this.app.setState({ tab: 'studio', rec: true, secs: 0 }); this.refresh();
    } catch (e) {
      stream?.getTracks().forEach(t => t.stop()); this.recording = false; this.halt();
      this.notify('Recording could not start: ' + e.message);
    } finally { this.busy = false; this.refresh(); }
  }
  stopRecord() {
    if (this.recorder?.state === 'recording') { this.busy = true; this.recorder.stop(); }
    this.recording = false; this.halt(); this.app.setState({ rec: false }); this.refresh();
  }
  async saveRecording() {
    const pending = this.pending; if (!pending) return;
    this.busy = true; this.refresh();
    try {
      const path = 'local/' + this.app.SONG_UUID + '/' + pending.id + (pending.blob.type.includes('mp4') ? '.m4a' : '.webm');
      await this.checked(this.app.sb.storage.from('takes').upload(path, pending.blob));
      const clip = { id: pending.id + '-clip', name: pending.name, url: this.url('takes', path), start: pending.offset, length: null };
      await this.decode(clip);
      await this.checked(this.app.sb.from('takes').upsert({ id: pending.id, user_id: 'local', song_id: this.app.SONG_UUID, storage_path: path, duration_secs: clip.dur, offset_secs: clip.start, label: pending.name, bar_start: 0 }));
      if (!this.tracks.some(t => t.id === pending.id)) this.tracks.push({ id: pending.id, name: pending.name, volume: 0.8, muted: false, solo: false, clips: [clip] });
      await this.save(); this.pending = null; this.notify('Vocal saved locally on its own track.');
    } catch (e) { this.notify('Recording is still in memory. Use RETRY SAVE before closing: ' + e.message); }
    finally { this.busy = false; this.refresh(); }
  }

  // ---------- clock ----------
  tick() {
    if (this.playing && this.ctx) {
      if (this.plan) {
        if (this.ctx.currentTime > this.nextPassAt - 0.6) {
          this.schedulePass(this.plan.start, this.plan.end, this.nextPassAt); this.scheduleClicks(this.plan.start, this.plan.end, this.nextPassAt);
          this.nextPassAt += (this.plan.end - this.plan.start) / this.rate;
        }
      } else {
        this.topUpClicks();
        if (!this.recording && this.position() >= this.contentEnd() + 0.05) { this.halt(); this.cursor = this.contentEnd(); }
      }
    }
    if (this.recording) this.app.setState({ secs: Math.floor((performance.now() - this.recordStarted) / 1000) });
    const position = this.position(), b = this.beat();
    const bar = Math.floor(position / (b * 4)) + 1, beatIn = Math.floor(position / b) % 4 + 1, sixteenth = Math.floor(position / (b / 4)) % 4 + 1;
    for (const el of document.querySelectorAll('[data-studio-clock]')) el.textContent = this.app.fmtTime(position) + ' / ' + this.app.fmtTime(Math.max(this.contentEnd(), position));
    for (const el of document.querySelectorAll('[data-gb-bars]')) el.textContent = bar + '.' + beatIn + '.' + sixteenth;
    const host = document.getElementById('gb-arrange');
    if (host) {
      if ((this.dirty || host.dataset.built !== '1') && !this.drag) this.build(host);
      const head = host.querySelector('.gb-playhead');
      if (head) head.style.transform = 'translateX(' + (position * this.pps()) + 'px)';
      if (this.playing && !this.drag && this.follow !== false) {
        const x = position * this.pps() + this.headW, left = host.scrollLeft, w = host.clientWidth;
        if (x > left + w - 40 || x < left + this.headW) host.scrollLeft = Math.max(0, x - this.headW - 40);
      }
    }
  }

  // ---------- arrange view ----------
  headW = 214;
  build(host) {
    this.dirty = false; host.dataset.built = '1';
    const pps = this.pps(), b = this.beat(), barPx = this.zoom * 4;
    const total = Math.max(this.duration() + this.bar() * 4, host.clientWidth / pps);
    const W = Math.ceil(total * pps), bars = Math.ceil(total / this.bar());
    const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    let html = '<div class="gb-inner" style="width:' + (W + this.headW) + 'px">';
    // ruler + cycle strip
    html += '<div class="gb-row gb-ruler-row"><div class="gb-corner">' + this.tracks.length + ' TRACK' + (this.tracks.length === 1 ? '' : 'S') + '</div><div class="gb-ruler" style="width:' + W + 'px;--bar:' + barPx + 'px;--beatw:' + this.zoom + 'px">';
    const c = this.cycle;
    if (c.end - c.start > 0) html += '<div class="gb-cycle-region' + (c.on ? ' on' : '') + '" style="left:' + (c.start * pps) + 'px;width:' + ((c.end - c.start) * pps) + 'px"></div>';
    html += '<div class="gb-cycle-strip" title="Drag here to set the cycle (loop) region"></div>';
    for (let i = 0; i < bars; i++) html += '<span class="gb-barnum" style="left:' + (i * barPx) + 'px">' + (i + 1) + '</span>';
    html += '</div></div>';
    // tracks
    this.tracks.forEach((t, i) => {
      const color = t.id === 'beat' ? '#b98af2' : this.palette(i + 1);
      html += '<div class="gb-row" data-row="' + esc(t.id) + '"><div class="gb-head" style="--c:' + color + '">'
        + '<div class="gb-head-top"><span class="gb-swatch"></span><input class="gb-name" data-track-name="' + esc(t.id) + '" aria-label="Track name" value="' + esc(t.name) + '" />'
        + '<button class="gb-x" data-track-del="' + esc(t.id) + '" title="Remove track" aria-label="Remove track ' + esc(t.name) + '">×</button></div>'
        + '<div class="gb-head-ctl"><button data-track-mute="' + esc(t.id) + '" class="gb-ms' + (t.muted ? ' on' : '') + '" aria-label="Mute ' + esc(t.name) + '">M</button>'
        + '<button data-track-solo="' + esc(t.id) + '" class="gb-ms gb-solo' + (t.solo ? ' on' : '') + '" aria-label="Solo ' + esc(t.name) + '">S</button>'
        + '<input type="range" min="0" max="1" step="0.01" value="' + (t.volume ?? 0.8) + '" data-track-vol="' + esc(t.id) + '" aria-label="' + esc(t.name) + ' volume" /></div></div>'
        + '<div class="gb-lane" data-lane="' + esc(t.id) + '" style="width:' + W + 'px;--bar:' + barPx + 'px;--beatw:' + this.zoom + 'px">';
      for (const clip of t.clips) {
        const L = this.clipLen(clip), D = this.audioLen(clip), w = Math.max(6, L * pps);
        const reps = D > 0 && L > D + 1e-3 ? Math.ceil(L / D - 1e-6) : 1;
        html += '<div class="gb-clip' + (this.selected === clip.id ? ' sel' : '') + (t.muted ? ' muted' : '') + '" data-clip="' + esc(clip.id) + '" style="left:' + (clip.start * pps) + 'px;width:' + w + 'px;--c:' + color + '" title="' + esc(clip.name) + ' — drag to move, drag the right edge to loop or trim">'
          + '<div class="gb-clip-top"><span>' + esc(clip.name) + (reps > 1 ? ' ⟳' + reps : '') + (clip.loadError ? ' ⚠ ' + esc(clip.loadError) : '') + '</span><button class="gb-clip-dup" data-clip-dup="' + esc(clip.id) + '" title="Duplicate after itself" aria-label="Duplicate clip">⧉</button><button class="gb-clip-x" data-clip-del="' + esc(clip.id) + '" title="Delete clip" aria-label="Delete clip ' + esc(clip.name) + '">×</button></div>'
          + '<canvas data-clip-wave="' + esc(clip.id) + '" width="' + Math.min(4000, Math.ceil(w)) + '" height="46"></canvas>'
          + '<div class="gb-clip-loop" data-clip-loop="' + esc(clip.id) + '" title="Drag to loop (repeat) or trim"></div></div>';
      }
      html += '</div></div>';
    });
    html += '<div class="gb-row gb-new-row"><div class="gb-head gb-new-head"><button data-add-track="1">+ NEW TRACK</button><small>or drop audio / loops on the lane →</small></div><div class="gb-lane gb-new-lane" data-lane="__new" style="width:' + W + 'px"><span>Drop a loop, stem or audio file here to start a new track</span></div></div>';
    html += '<div class="gb-playhead" style="left:' + this.headW + 'px"></div></div>';
    const keepLeft = host.scrollLeft, keepTop = host.scrollTop;
    host.innerHTML = html; host.scrollLeft = keepLeft; host.scrollTop = keepTop;
    const corner = host.querySelector('.gb-corner'); if (corner?.offsetWidth) this.headW = corner.offsetWidth;
    const ph = host.querySelector('.gb-playhead'); if (ph) ph.style.left = this.headW + 'px';
    host.querySelectorAll('canvas[data-clip-wave]').forEach(cv => this.drawClip(cv));
    if (!host.dataset.wired) this.wire(host);
  }
  drawClip(canvas) {
    const found = this.findClip(canvas.dataset.clipWave); if (!found) return;
    const { clip } = found, buffer = this.buffers.get(clip.url);
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height; ctx.clearRect(0, 0, w, h);
    if (!buffer) { ctx.fillStyle = '#ffffff55'; ctx.font = '11px system-ui'; ctx.fillText('loading…', 6, 26); return; }
    const L = this.clipLen(clip), D = buffer.duration, data = buffer.getChannelData(0), perPx = L / w;
    ctx.fillStyle = 'rgba(15,8,24,.72)';
    for (let x = 0; x < w; x++) {
      const t0 = (x * perPx) % D, t1 = t0 + perPx;
      const a = Math.floor(t0 / D * data.length), z = Math.min(data.length, Math.max(a + 1, Math.floor(t1 / D * data.length)));
      let peak = 0; for (let i = a; i < z; i += Math.max(1, Math.floor((z - a) / 60))) peak = Math.max(peak, Math.abs(data[i]));
      const bh = Math.max(1, peak * (h - 4)); ctx.fillRect(x, (h - bh) / 2, 1, bh);
    }
    if (L > D + 1e-3) { // loop notches like GarageBand
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      for (let r = D; r < L; r += D) { const x = Math.round(r / perPx); ctx.fillRect(x, 0, 1, h); ctx.beginPath(); ctx.moveTo(x - 5, 0); ctx.lineTo(x + 5, 0); ctx.lineTo(x, 6); ctx.fill(); }
    }
  }

  // ---------- interaction ----------
  wire(host) {
    host.dataset.wired = '1';
    host.addEventListener('pointerdown', this.onPointerDown);
    host.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.trackName) this.change(t.dataset.trackName, { name: t.value });
    });
    host.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.trackVol) { const track = this.tracks.find(x => x.id === t.dataset.trackVol); if (track) { track.volume = +t.value; const g = this.trackGains?.get(track.id); if (g) g.gain.setTargetAtTime(this.level(track), this.ctx.currentTime, 0.01); clearTimeout(this.volSave); this.volSave = setTimeout(() => this.save(), 400); } }
    });
    host.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.trackMute) { const tr = this.tracks.find(x => x.id === t.dataset.trackMute); this.change(tr.id, { muted: !tr.muted }); }
      else if (t.dataset.trackSolo) { const tr = this.tracks.find(x => x.id === t.dataset.trackSolo); this.change(tr.id, { solo: !tr.solo }); }
      else if (t.dataset.trackDel) this.deleteTrack(t.dataset.trackDel);
      else if (t.dataset.clipDel) this.deleteClip(t.dataset.clipDel);
      else if (t.dataset.clipDup) this.duplicateClip(t.dataset.clipDup);
      else if (t.dataset.addTrack) this.addTrack();
    });
    host.addEventListener('dragover', e => { const lane = e.target.closest('[data-lane]'); if (lane) { e.preventDefault(); host.querySelectorAll('.drop-hover').forEach(el => el.classList.remove('drop-hover')); lane.classList.add('drop-hover'); } });
    host.addEventListener('dragleave', e => { if (!host.contains(e.relatedTarget)) host.querySelectorAll('.drop-hover').forEach(el => el.classList.remove('drop-hover')); });
    host.addEventListener('drop', e => this.drop(e, host));
  }
  laneTime(lane, clientX) { const r = lane.getBoundingClientRect(); return (clientX - r.left) / this.pps(); }
  pointerDown(e) {
    if (e.button !== 0 || e.target.closest('button,input')) return;
    const host = e.currentTarget, loop = e.target.closest('[data-clip-loop]'), clipEl = e.target.closest('[data-clip]');
    const strip = e.target.closest('.gb-cycle-strip'), ruler = e.target.closest('.gb-ruler'), lane = e.target.closest('[data-lane]');
    const free = e.altKey, pps = this.pps();
    let drag = null;
    if (loop) {
      const found = this.findClip(loop.dataset.clipLoop); if (!found) return;
      const el = loop.parentElement, len0 = this.clipLen(found.clip);
      drag = { move: ev => { const len = Math.max(this.beat() / 4, this.snap(found.clip.start + len0 + (ev.clientX - e.clientX) / pps, ev.altKey) - found.clip.start); drag.len = len; el.style.width = Math.max(6, len * pps) + 'px'; },
        up: () => { if (drag.len != null) this.setClipLength(found.clip.id, drag.len); } };
    } else if (clipEl) {
      const found = this.findClip(clipEl.dataset.clip); if (!found) return;
      this.selected = found.clip.id; host.querySelectorAll('.gb-clip.sel').forEach(x => x.classList.remove('sel')); clipEl.classList.add('sel');
      const s0 = found.clip.start;
      drag = { move: ev => {
          const dx = ev.clientX - e.clientX; if (Math.abs(dx) + Math.abs(ev.clientY - e.clientY) < 4 && !drag.moved) return;
          drag.moved = true; drag.start = this.snap(s0 + dx / pps, ev.altKey); clipEl.style.left = drag.start * pps + 'px';
          clipEl.style.transform = 'translateY(' + (ev.clientY - e.clientY) + 'px)'; clipEl.classList.add('dragging');
          const under = document.elementsFromPoint(ev.clientX, ev.clientY).find(x => x.dataset?.lane);
          host.querySelectorAll('.drop-hover').forEach(x => x.classList.remove('drop-hover')); if (under) under.classList.add('drop-hover'); drag.lane = under?.dataset.lane;
        },
        up: () => { if (drag.moved) this.moveClip(found.clip.id, drag.lane || found.track.id, drag.start ?? s0); else this.refresh(); } };
    } else if (strip) {
      const t0 = this.snapBar(this.laneTime(strip.parentElement, e.clientX));
      const region = strip.parentElement.querySelector('.gb-cycle-region') || (() => { const d = document.createElement('div'); d.className = 'gb-cycle-region on'; strip.parentElement.prepend(d); return d; })();
      drag = { move: ev => { const t1 = this.snapBar(this.laneTime(strip.parentElement, ev.clientX)); const a = Math.min(t0, t1), z = Math.max(t0, t1, a + this.bar()); drag.a = a; drag.z = z; region.classList.add('on'); region.style.left = a * pps + 'px'; region.style.width = (z - a) * pps + 'px'; },
        up: () => { const a = drag.a ?? t0, z = drag.z ?? t0 + this.bar(); this.restartIfPlaying(() => { this.cycle = { on: true, start: a, end: z }; }); this.save(); } };
      drag.move(e);
    } else if (ruler || lane) {
      const base = ruler || lane; this.seek(this.laneTime(base, e.clientX));
      if (lane && !clipEl) { this.selected = null; host.querySelectorAll('.gb-clip.sel').forEach(x => x.classList.remove('sel')); }
      return;
    } else return;
    e.preventDefault();
    this.drag = drag;
    const move = ev => drag.move(ev), up = ev => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      host.querySelectorAll('.drop-hover').forEach(x => x.classList.remove('drop-hover'));
      this.drag = null; drag.up(ev); this.dirty = true;
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  key(e) {
    if (this.app.state?.tab !== 'studio' || e.target.closest?.('input,textarea,[contenteditable]')) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) { e.preventDefault(); this.deleteClip(this.selected); }
    else if (e.key === 'c' || e.key === 'C') this.toggleCycle();
    else if (e.key === 'k' || e.key === 'K') this.toggleMetronome();
    else if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey) && this.selected) { e.preventDefault(); this.duplicateClip(this.selected); }
  }
  // Loop browser rows carry data-loop-url / data-loop-name; dragging one onto a lane adds a clip there.
  loopDragStart(e) {
    const row = e.target.closest?.('[data-loop-url]'); if (!row) return;
    e.dataTransfer.setData('application/x-screwshop-loop', JSON.stringify({ url: row.dataset.loopUrl, name: row.dataset.loopName }));
    e.dataTransfer.effectAllowed = 'copy';
  }
  async drop(e, host) {
    const lane = e.target.closest('[data-lane]'); host.querySelectorAll('.drop-hover').forEach(x => x.classList.remove('drop-hover'));
    if (!lane) return; e.preventDefault();
    const trackId = lane.dataset.lane === '__new' ? null : lane.dataset.lane, at = this.laneTime(lane, e.clientX);
    const raw = e.dataTransfer.getData('application/x-screwshop-loop');
    if (raw) { try { await this.addClip(trackId, JSON.parse(raw), at); } catch (err) { this.notify(err.message); } return; }
    const files = [...(e.dataTransfer.files || [])].filter(f => /^audio\//.test(f.type) || /\.(wav|mp3|m4a|aac|flac|ogg)$/i.test(f.name));
    let start = at;
    for (const file of files) {
      try { const item = await this.uploadFile(file); await this.addClip(trackId, item, start); start = null; }
      catch (err) { this.notify('Import failed: ' + err.message); }
    }
  }
  rows() { return this.tracks.map((t, i) => ({ id: t.id, name: t.name, number: i + 1 })); }
  dispose() {
    clearInterval(this.timer); this.stopRecord();
    document.removeEventListener('keydown', this.onKey); document.removeEventListener('dragstart', this.onDragStart); window.removeEventListener('resize', this.onResize);
    this.ctx?.close();
  }
};
