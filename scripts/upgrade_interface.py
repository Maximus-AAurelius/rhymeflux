"""One-time migration of the preserved Barwork interface to ScrewShop local storage."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
path = root / "docs/barwork.html"
s = path.read_text(encoding="utf-8")
assert '<title>Barwork</title>' in s, "Interface migration has already run"
s = s.replace('Barwork', 'ScrewShop').replace('BARWORK', 'SCREWSHOP')
s = s.replace('<script src="./support.js"></script>', '''<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#140c20">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="ScrewShop">
<link rel="apple-touch-icon" href="/assets/icon-192.png">
<script src="/vendor/react.production.min.js"></script>
<script src="/vendor/react-dom.production.min.js"></script>
<script src="/local-client.js"></script>
<script src="./support.js"></script>''')
s = re.sub(r'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/[^" ]+">', '', s)
s = s.replace('src="assets/trill.png"', 'src="assets/screwshop.png"')
s = s.replace('A rap writing studio. Rhymes, syllables, beats, and takes — all in one place, saved to your account.', 'Slow it down. Make it yours. Bars, beats, chopped records and sound packs — saved on your computer.')
s = s.replace('Sign in — this app is private to your account.', 'Your private local studio. On a phone, enter the pairing code from your computer.')
s = re.sub(r'<input value="{{ authEmail }}"[^>]+/>\n', '', s)
s = s.replace('placeholder="password" type="password"', 'placeholder="computer pairing code" type="password"')
s = re.sub(r'<button onClick="{{ toggleAuthMode }}".*?</button>\n', '', s)
s = s.replace('SIGN OUT</button>', 'CLOSE SETTINGS</button>')
s = s.replace('Accent: US English · Synced to your account · Audio uploads only after you sign in', 'Local only · Audio and songs stay on this computer · Lyrics also export to data/Obsidian/Songs')
s = s.replace('A background helper on your computer (see README) picks the job up and runs it automatically — no commands to copy.', 'ScrewShop processes the audio on this computer. Keep it running. The first split downloads the model; your audio stays local.')
s = s.replace('· cloud', '· local')
s = re.sub(r'  SUPABASE_URL = .*?\n  SUPABASE_KEY = .*?\n', '', s)
s = s.replace('    session: null,', '    saveStatus: "CONNECTING", notice: "",\n    session: null,')
s = s.replace('    import("https://esm.sh/@supabase/supabase-js@2").then(({ createClient }) => {', '    /* legacy cloud initialization removed */\n    import("https://esm.sh/@supabase/supabase-js@2").then(({ createClient }) => {')
start = s.index('    /* legacy cloud initialization removed */')
end = s.index('\n  fmtLen =', start)
s = s[:start] + '''    this._statusListener = (event) => this.setState({ notice: event.detail });
    window.addEventListener("screwshop-status", this._statusListener);
    this.connectLocal();
    if ("serviceWorker" in navigator && window.isSecureContext) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  connectLocal = async () => {
    try {
      const status = await window.ScrewShop.connect();
      if (!status.paired) { this.setState({ authError: "Enter the pairing code in ScrewShop/data/phone-pairing-code.txt on your computer." }); return; }
      this.sb = window.ScrewShop.client;
      this.setState({ session: { user: { id: "local" } }, authError: "", saveStatus: "LOCAL" });
      await this.loadCloud();
      const { data: preferences } = await this.sb.from("settings").select("*").eq("id", "studio").maybeSingle();
      if (preferences) this.setState({ sequencerSteps: preferences.steps || this.state.sequencerSteps, seqBpm: preferences.bpm || 90 });
    } catch (error) { this.setState({ authError: error.message, saveStatus: "OFFLINE" }); }
  };
''' + s[end:]
start = s.index('  doAuth = async () => {')
end = s.index('\n  loadCloud =', start)
s = s[:start] + '''  doAuth = async () => {
    this.setState({ authBusy: true, authError: "" });
    const { error } = await window.ScrewShop.pair(this.state.authPassword);
    this.setState({ authBusy: false, authPassword: "", authError: error ? error.message : "" });
    if (!error) await this.connectLocal();
  };
  signOut = () => this.setState({ settings: false });
''' + s[end:]
s = s.replace('if (parsed.lines && parsed.lines.length)', 'if (Array.isArray(parsed.lines))')
s = s.replace('    const uid = this.state.session.user.id;\n    const { data: song }', '    const uid = this.state.session.user.id;\n    const { data: song }', 1)
start = s.index('  saveSong = (lines) => {')
end = s.index('\n  uploadBeat =', start)
s = s[:start] + '''  saveSong = (lines) => {
    const value = lines || this.state.lines;
    try { localStorage.setItem("screwshop-draft", JSON.stringify({ lines: value, at: Date.now() })); } catch (_) {}
    if (!this.sb || !this.state.session) { this.setState({ saveStatus: "NOT SAVED" }); return; }
    const version = this._saveVersion = (this._saveVersion || 0) + 1;
    this.setState({ saveStatus: "SAVING" });
    this._saveChain = (this._saveChain || Promise.resolve()).then(async () => {
      const { error } = await this.sb.from("songs").upsert({ id: this.SONG_UUID, user_id: "local", title: "SCREWSHOP SESSION", meta: JSON.stringify({ lines: value }) });
      if (version === this._saveVersion) {
        this.setState({ saveStatus: error ? "NOT SAVED" : "SAVED ON DISK" });
        if (!error) localStorage.removeItem("screwshop-draft");
      }
    }).catch(() => this.setState({ saveStatus: "NOT SAVED" }));
  };

  savePattern = async (steps, bpm) => {
    if (this.sb) await this.sb.from("settings").upsert({ id: "studio", steps, bpm });
  };
''' + s[end:]
s = s.replace('  renameLibraryItem = (id, name) => {', '  renameLibraryItem = async (id, name) => {')
s = s.replace('if (this.sb) this.sb.from("library").update', 'if (this.sb) await this.sb.from("library").update')
s = s.replace('    this.setState({ library: withUrls });', '''    this.setState({ library: withUrls });
    const { data: jobs } = await this.sb.from("split_jobs").select("*").order("created_at");
    const { data: beats } = await this.sb.from("beats").select("*");
    for (const item of withUrls) {
      const beat = (beats || []).find(b => b.storage_path === item.storage_path);
      const job = beat && (jobs || []).filter(j => j.beat_id === beat.id).pop();
      if (job) {
        this.setState(prev => ({ splitJobs: { ...prev.splitJobs, [item.id]: { status: job.status, jobId: job.id, error: job.error_message } } }));
        if (["pending", "processing"].includes(job.status)) this.pollSplitJob(item.id, job.id);
      }
    }''')
start = s.index('  requestSplit = async (item, mode) => {')
end = s.index('\n  loadDeckFromLibrary =', start)
s = s[:start] + '''  requestSplit = async (item, mode) => {
    if (!this.sb || !this.state.session) return;
    const existing = this.state.splitJobs[item.id];
    if (existing && ["linking", "pending", "processing"].includes(existing.status)) return;
    const update = (job) => this.setState(prev => ({ splitJobs: { ...prev.splitJobs, [item.id]: job } }));
    update({ status: "linking" });
    try {
      const status = await window.ScrewShop.connect();
      if (!status.worker || !status.worker.ready) throw new Error(status.worker?.message || "Pair this device first.");
      const beat = await this.linkAsBeatRow(item);
      if (!beat) throw new Error("Could not locate the source audio. Try importing it again.");
      const { data, error } = await this.sb.from("split_jobs").insert({ user_id: "local", beat_id: beat.id, mode }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not queue the split");
      update({ status: data.status, jobId: data.id });
      this.pollSplitJob(item.id, data.id);
    } catch (error) { update({ status: "error", error: error.message }); }
  };

  pollSplitJob = (itemId, jobId) => {
    this._jobTimers = this._jobTimers || {};
    clearTimeout(this._jobTimers[itemId]);
    const tick = async () => {
      if (!this.sb || this._unmounted) return;
      const { data, error } = await this.sb.from("split_jobs").select("*").eq("id", jobId).maybeSingle();
      if (!data || error) {
        this.setState({ notice: error?.message || "Cannot read split status. Reconnecting…" });
        this._jobTimers[itemId] = setTimeout(tick, 4000); return;
      }
      this.setState(prev => ({ splitJobs: { ...prev.splitJobs, [itemId]: { status: data.status, jobId, error: data.error_message } } }));
      if (data.status === "done") { this.loadAllStems(); this.loadStems(data.beat_id); return; }
      if (data.status === "error") return;
      this._jobTimers[itemId] = setTimeout(tick, 2000);
    };
    tick();
  };
''' + s[end:]
s = s.replace('    this.setState({ sequencerSteps: steps });', '    this.setState({ sequencerSteps: steps });\n    this.savePattern(steps, this.state.seqBpm);')
s = s.replace('    this.setState({ seqBpm: bpm });', '    this.setState({ seqBpm: bpm });\n    this.savePattern(this.state.sequencerSteps, bpm);')
s = s.replace('import("https://esm.sh/tone@15")', 'import("/vendor/tone.js")')
s = s.replace('  componentWillUnmount() {', '''  componentWillUnmount() {
    this._unmounted = true;
    Object.values(this._jobTimers || {}).forEach(clearTimeout);
    window.removeEventListener("screwshop-status", this._statusListener);''')
s = s.replace('job ? JOB_LABELS[job.status] : ""', 'job ? (job.error || JOB_LABELS[job.status]) : ""')
s = s.replace('Queued — waiting for your computer to pick it up…', 'Queued locally — the processor will start this after the current job.')
s = s.replace('Splitting on your computer — this can take a few minutes…', 'Splitting on your computer. First use downloads the model; allow several minutes.')
s = s.replace('Something went wrong — check the worker\'s terminal window.', 'Split failed. Tap QUICK or FULL to retry.')
s = s.replace('authButtonLabel: S.authBusy ? "…" : (S.authMode === "signup" ? "CREATE ACCOUNT" : "SIGN IN")', 'authButtonLabel: S.authBusy ? "CONNECTING…" : "CONNECT TO COMPUTER"')
s = s.replace('syncLabel: S.edit >= 0 ? "SAVED LOCALLY" : "SYNCED"', 'syncLabel: S.saveStatus')
s = s.replace('      kb: S.edit >= 0,', '      notice: S.notice, dismissNotice: () => this.setState({ notice: "" }),\n      kb: S.edit >= 0,')
s = s.replace('<sc-if value="{{ hasBeatFile }}"', '''<sc-if value="{{ notice }}" hint-placeholder-val="{{ false }}">
<div role="status" style="padding:10px 16px;background:#382047;color:#f4dcff;font:12px/1.5 system-ui;display:flex;gap:12px;align-items:center"><span style="flex:1">{{ notice }}</span><button onClick="{{ dismissNotice }}" style="background:transparent;color:inherit;border:1px solid currentColor;padding:8px">DISMISS</button></div>
</sc-if>
<sc-if value="{{ hasBeatFile }}"''', 1)
s = s.replace('          navigator.mediaDevices.getUserMedia', '''          if (!navigator.mediaDevices?.getUserMedia) { this.setState({ notice: "Recording requires a secure connection. On this computer use localhost; on iPhone use HTTPS. You can still import recordings from Files." }); return; }
          navigator.mediaDevices.getUserMedia''')
s = s.replace('Date.now() + "_" + file.name', 'crypto.randomUUID() + "_" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_")')
s = s.replace('Date.now() + ".webm"', 'crypto.randomUUID() + (blob.type.includes("mp4") ? ".m4a" : ".webm")')
s = s.replace('A small helper program running on your computer picks the job up automatically and processes it — no commands to copy once it\'s running (see the README to set it up once).', 'The local ScrewShop processor picks up the job automatically. Keep the computer running; audio and stems stay on disk.')
s = s.replace('saved to your account', 'saved on your computer').replace('saved for next time', 'saved on disk for next time')
s = s.replace('</style></helmet>', '''
:root{--font-heading:"Arial Black",Impact,system-ui;--font-body:Arial,system-ui;--color-bg:#140c20;--color-surface:#20122e;--color-accent:#ac75ff;--color-accent-700:#d5b1ff}
body{background:radial-gradient(ellipse at top,#301548,#09060e)}
button,input{color:inherit}input{background:var(--color-neutral-100)}
button:focus-visible,input:focus-visible{outline:2px solid #e2c6ff;outline-offset:2px}
#app-card{box-shadow:0 0 70px #0008;border-inline:1px solid #b681ff22}
#app-card>div:first-child{background:linear-gradient(110deg,#20102e,#140c20)}
#brand-panel .bp-portrait{inset:0;width:100%;height:100%;max-width:none;object-fit:cover;opacity:.22;mix-blend-mode:luminosity;filter:none}
#brand-panel .bp-word,#brand-panel .bp-tag,#brand-panel .bp-rule{position:relative;z-index:1}
#brand-panel .bp-word{font-family:Impact,"Arial Black",sans-serif;letter-spacing:.025em;font-size:clamp(38px,5vw,78px)}
@media(min-width:900px){#app-shell{padding:18px;box-sizing:border-box}#app-card{border-radius:8px;overflow:hidden}#brand-panel{border-radius:8px 0 0 8px}}
@media(max-width:450px){button{touch-action:manipulation}#app-card{width:100%;min-width:0}}
</style></helmet>''')
path.write_text(s, encoding="utf-8")
