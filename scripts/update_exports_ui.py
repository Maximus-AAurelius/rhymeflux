"""One-time source migration for exports, artwork and the shared transport."""
from pathlib import Path
import re
path = Path(__file__).resolve().parents[1] / 'docs/barwork.html'
s = path.read_text(encoding='utf-8')
assert 'id="studio-transport"' not in s
s = s.replace('<title>ScrewShop</title>', '<title>ScrewShop</title>\n<link rel="stylesheet" href="/studio.css">')
start = s.index('<div style="flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:linear-gradient')
end = s.index('\n', start)
s = s[:start] + '''<div class="studio-brand"><img src="/assets/screwshop.png" alt="Screwed Up Records and Tapes storefront" /><div class="studio-brand-copy"><strong>SCREWSHOP</strong><span>HOUSTON IN THE SPEAKERS.<br>SLOW IT DOWN. MAKE IT YOURS.</span></div></div>''' + s[end:]
s = re.sub(r'<button onClick="{{ openHelp }}"[^>]*>\?</button>', '<button onClick="{{ openHelp }}" class="trill-help" aria-label="Open the Trill walkthrough" title="Let Trill show you around"><img src="/assets/trill.png" alt="Trill studio guide" /><span>GUIDE</span></button>', s, count=1)
start = s.index('<sc-if value="{{ hasBeatFile }}"', s.index('{{ notice }}'))
end = s.index('<sc-if value="{{ isWrite }}"', start)
s = s[:start] + '''<div id="studio-transport" class="studio-transport" role="region" aria-label="Global audio controls">
<div class="transport-title">{{ transportTitle }}</div>
<div class="transport-controls">
<div class="transport-buttons">
<button onClick="{{ seekBeatBack }}" aria-label="Skip back five seconds" title="Back 5 seconds">«</button>
<button onClick="{{ stopTransport }}" aria-label="Stop all audio" title="Stop all audio">■</button>
<button onClick="{{ toggleTransport }}" class="main-play" aria-label="{{ transportPlayLabel }}">{{ transportPlayIcon }}</button>
<button onClick="{{ seekBeatFwd }}" aria-label="Skip forward five seconds" title="Forward 5 seconds">»</button>
<button onClick="{{ recToggle }}" aria-label="{{ transportRecordLabel }}" title="Record a take" style="color:{{ transportRecBg }}">●</button>
</div>
<span class="transport-time">{{ beatPosLabel }} / {{ beatDurLabel }}</span>
<input class="transport-progress" type="range" aria-label="Audio position" min="0" max="{{ beatDur }}" step="0.1" value="{{ beatPos }}" onChange="{{ seekBeat }}" />
<label>SOURCE BPM<input aria-label="Source BPM" title="Enter the track's original BPM; no automatic detection" type="number" min="30" max="300" value="{{ sourceBpm }}" onChange="{{ onSourceBpm }}" /></label>
<label>BPM<input aria-label="Playback BPM" type="number" min="30" max="300" value="{{ playbackBpm }}" onChange="{{ onPlaybackBpm }}" /></label>
<label>TEMPO {{ beatRateLabel }}<input aria-label="Tempo speed" type="range" min="0.25" max="2" step="0.01" value="{{ beatRate }}" onChange="{{ onBeatRate }}" /></label>
<button onClick="{{ toggleBeatLoop }}" style="border:1px solid var(--color-divider);padding:9px;background:{{ beatLoopBg }};color:{{ beatLoopFg }};font:700 9px system-ui;cursor:pointer">LOOP {{ beatLoopState }}</button>
</div></div>

''' + s[end:]
s = s.replace('    beatPlaying: false,', '    sourceBpm: 82, transportSource: "audio", transportTitle: "Pick a track, stem or take to play — or record something new",\n    beatPlaying: false,',1)
s = s.replace('    allStems: [],', '    packExports: [],\n    allStems: [],',1)
s = s.replace('Everything split so far. PLAY previews it; tapping a number loads it onto that BEATS pad and saves it there for next time.', 'Save individual WAVs, reuse an instrumental as a separate track, or download a full pack for your DAW. Full splits also save automatically under Beats / sound packs.')
s = s.replace('<sc-if value="{{ hasAllStems }}"', '''<sc-for list="{{ packExports }}" as="pack" hint-placeholder-count="0">
<div class="pack-export-card"><div><strong>{{ pack.name }}</strong><small>Full breakdown · 7 aligned WAVs · DAW-ready ZIP</small></div><button class="pack-export-button" onClick="{{ pack.onSave }}">SAVE SOUND PACK ZIP</button></div>
</sc-for>
<sc-if value="{{ hasAllStems }}"''',1)
needle='<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">\n<span style="font:700 8px'
s=s.replace(needle, '''<div class="stem-actions"><button onClick="{{ st.onSave }}">SAVE WAV</button><button class="reuse-track" onClick="{{ st.onReuse }}" title="Add an independent copy to SONGS without changing your existing lyrics">USE AS NEW TRACK</button></div>
<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
<span style="font:700 8px''',1)
s = s.replace('  loadAllStems = async () => {', '''  exportFile = async (options) => {
    this.setState({ notice: "Saving your audio…" });
    const { data, error } = await window.ScrewShop.export(options);
    if (error || !data) { this.setState({ notice: error?.message || "Export failed. Try again." }); return; }
    this.setState({ notice: "Saved on this computer: " + data.saved_to + ". Your download is ready." });
    const link = document.createElement("a");
    link.href = data.download_url; link.download = "";
    document.body.appendChild(link); link.click(); link.remove();
  };

  reuseStem = async (stem) => {
    const { data, error } = await window.ScrewShop.export({ kind: "reuse", stem_id: stem.id });
    if (error || !data) return;
    await this.loadLibrary();
    this.setState({ tab: "songs", notice: "Added " + data.name + " as a separate track. Choose SET AS BEAT to work with it; your lyrics stay intact." });
  };

  loadAllStems = async () => {''',1)
s = s.replace('    this.setState({ allStems: withUrls });', '''    const { data: beats } = await this.sb.from("beats").select("*");
    const { data: jobs } = await this.sb.from("split_jobs").select("*").eq("status", "done").eq("mode", "full").order("created_at", { ascending: false });
    const seen = new Set();
    const packExports = (jobs || []).filter(job => { if (seen.has(job.beat_id)) return false; seen.add(job.beat_id); return true; }).map(job => ({ beatId: job.beat_id, name: (beats || []).find(b => b.id === job.beat_id)?.label || "Sound pack" }));
    this.setState({ allStems: withUrls.map(st => ({ ...st, trackName: (beats || []).find(b => b.id === st.beatId)?.label || "Track" })), packExports });''',1)
s = s.replace('''      ...st,
      onPlay: () => { if (st.url) new Audio(st.url).play(); },''', '''      ...st,
      label: (st.trackName || "Track") + " · " + st.kind.toUpperCase(),
      onPlay: () => this.playAudio(st.url, (st.trackName || "Track") + " · " + st.kind),
      onSave: () => this.exportFile({ kind: "stem", stem_id: st.id }),
      onReuse: () => this.reuseStem(st),''',1)
s = s.replace('''        const a = new Audio(t.url);
        a.volume = S.vocalVol;
        a.play();''', '''        this.playAudio(t.url, "Recorded take · " + t.len, "vocal");''',1)
s = s.replace('onPlay: () => { if (st.url) new Audio(st.url).play(); }', 'onPlay: () => this.playAudio(st.url, st.label)',1)
s = s.replace('      allStemsList, hasAllStems:', '      packExports: S.packExports.map(pack => ({ ...pack, onSave: () => this.exportFile({ kind: "pack", beat_id: pack.beatId }) })),\n      allStemsList, hasAllStems:',1)
s = s.replace('<div style="font:700 9px var(--font-heading);letter-spacing:.14em;color:var(--color-accent)">STEP {{ helpStepNo }} OF {{ helpStepCount }}</div>', '<div style="display:flex;align-items:center;gap:12px"><img class="guide-avatar" src="/assets/trill.png" alt="Trill guide" /><div style="font:700 10px/1.8 system-ui;letter-spacing:.1em;color:var(--color-accent)">YOUR STUDIO GUIDE<br>STEP {{ helpStepNo }} OF {{ helpStepCount }}</div></div>',1)
path.write_text(s,encoding='utf-8')
