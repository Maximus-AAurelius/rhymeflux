/* Local multitrack session. All sources share one Web Audio clock. */
window.RecordingStudio = class RecordingStudio {
  constructor(app) {
    this.app=app; this.tracks=[]; this.buffers=new Map(); this.voices=[]; this.cursor=0;
    this.playing=false; this.busy=false; this.ready=false; this.rate=1;
    this.timer=setInterval(()=>this.tick(),80);
  }
  notify(message) { this.app.setState({notice:message}); }
  refresh() { this.app.setState(p=>({studioRevision:(p.studioRevision||0)+1})); }
  context() { return this.ctx ||= new (window.AudioContext || window.webkitAudioContext)(); }
  async checked(query) { const result=await query; if(result.error) throw new Error(result.error.message); return result.data; }
  url(bucket,path) { return '/audio/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/'); }
  async load() {
    try {
      const saved=await this.checked(this.app.sb.from('settings').select('*').eq('id','recording-session').maybeSingle());
      if(saved && Array.isArray(saved.tracks)) this.tracks=saved.tracks;
      else {
        const beats=await this.checked(this.app.sb.from('beats').select('*').eq('song_id',this.app.SONG_UUID).order('created_at',{ascending:false}));
        if(beats?.[0]?.storage_path) this.tracks.push({id:'beat',name:beats[0].label||'Beat',url:this.url('beats',beats[0].storage_path),offset:0,volume:0.8});
        const takes=await this.checked(this.app.sb.from('takes').select('*').eq('song_id',this.app.SONG_UUID).order('created_at'));
        for(const take of takes||[]) this.tracks.push({id:take.id,name:take.label||'Vocal take',url:this.url('takes',take.storage_path),offset:take.offset_secs||0,volume:0.8});
      }
      this.ready=true; this.refresh();
      await Promise.all(this.tracks.map(track=>this.decode(track).catch(e=>{track.loadError=e.message;})));
      this.refresh();
    } catch(e) { this.notify('Could not load recording session: '+e.message); }
  }
  save() {
    const tracks=this.tracks.map(({loadError,...track})=>track);
    this.saving=(this.saving||Promise.resolve()).catch(()=>{}).then(()=>this.checked(this.app.sb.from('settings').upsert({id:'recording-session',tracks}))).catch(e=>{this.notify('Session not saved: '+e.message);throw e;});
    this.saving.catch(()=>{});
    return this.saving;
  }
  async decode(track) {
    if(this.buffers.has(track.url)) return this.buffers.get(track.url);
    const response=await fetch(track.url); if(!response.ok) throw new Error('Audio file unavailable');
    const buffer=await this.context().decodeAudioData(await response.arrayBuffer());
    this.buffers.set(track.url,buffer); track.duration=buffer.duration; delete track.loadError; return buffer;
  }
  duration() { return Math.max(10,...this.tracks.map(t=>(+t.offset||0)+(t.duration||0)),this.recording ? this.position()+2:0); }
  position() { return this.playing ? this.cursor+Math.max(0,this.context().currentTime-this.started)*this.rate : this.cursor; }
  halt(reset=false) {
    this.cursor=reset?0:this.position(); this.playing=false;
    for(const voice of this.voices) { try{voice.source.stop();}catch(_){} voice.source.disconnect();voice.gain.disconnect(); }
    this.voices=[];this.refresh();
  }
  async play(recording=false) {
    if(this.busy || !this.ready) return;
    this.busy=true;
    try {
      await this.context().resume();
      const buffers=await Promise.all(this.tracks.map(t=>this.decode(t)));
      if(this.cursor>=this.duration() && !recording) this.cursor=0;
      this.started=this.context().currentTime+(recording?0:0.04);
      this.playing=true;
      this.tracks.forEach((track,i)=>{
        const local=this.cursor-(+track.offset||0), buffer=buffers[i];
        if(local>=buffer.duration)return;
        const source=this.context().createBufferSource(), gain=this.context().createGain();
        source.buffer=buffer;source.playbackRate.value=this.rate;
        gain.gain.value=this.level(track);source.connect(gain);gain.connect(this.context().destination);
        source.start(this.started+Math.max(0,-local)/this.rate,Math.max(0,local));
        this.voices.push({id:track.id,source,gain});
      });
      this.app.setState({transportSource:'studio',transportTitle:'STUDIO · Beat + vocal tracks',beatRate:this.rate});this.refresh();
    } catch(e) {this.halt();this.notify('Could not play session: '+e.message);throw e;}
    finally {this.busy=false;}
  }
  async toggle() {
    if(this.recording) {this.stopRecord();return;}
    if(this.playing)this.halt();else {this.app.stopPlayback(); await this.play();}
  }
  seek(value) {
    if(this.recording||this.busy)return;
    const resume=this.playing;this.halt();this.cursor=Math.max(0,Math.min(this.duration(),Number(value)||0));
    if(resume)this.play().catch(()=>{});this.refresh();
  }
  setRate(value) {
    if(this.recording)return;
    const resume=this.playing;this.halt();this.rate=value;if(resume)this.play().catch(()=>{});this.refresh();
  }
  level(track) {return track.muted || (this.tracks.some(t=>t.solo)&&!track.solo)?0:(track.volume??0.8);}
  change(id,patch) {
    if(this.recording && ('offset' in patch))return;
    const track=this.tracks.find(t=>t.id===id);if(!track)return;
    if('offset' in patch){patch.offset=Math.max(0,Math.min(7200,+patch.offset||0));this.halt();}
    Object.assign(track,patch);
    for(const v of this.voices)v.gain.gain.setTargetAtTime(this.level(this.tracks.find(t=>t.id===v.id)),this.context().currentTime,0.01);
    this.save();this.refresh();
  }
  async setBeat(item) {
    if(this.recording || this.busy){this.notify('Stop recording or loading before replacing the beat.');return;}
    try {
      const track={id:'beat',name:item.name||item.label||'Instrumental',url:item.url,offset:0,volume:0.8};
      await this.decode(track);this.app.stopPlayback();this.halt(true);
      this.tracks=[track,...this.tracks.filter(t=>t.id!=='beat')];await this.save();
      this.app.setState({tab:'studio',transportSource:'studio',transportTitle:'STUDIO · '+track.name});this.refresh();
    }catch(e){this.notify('Beat could not be loaded: '+e.message);}
  }
  importBeat() {
    const input=document.createElement('input');input.type='file';input.accept='audio/*,.wav,.mp3,.m4a';
    input.onchange=async()=>{
      const file=input.files?.[0];if(!file)return;
      try {
        const path='local/library/'+window.ScrewShop.id()+'_'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
        await this.checked(this.app.sb.storage.from('beats').upload(path,file));
        const row=await this.checked(this.app.sb.from('library').insert({user_id:'local',name:file.name,storage_path:path}).select().single());
        this.app.loadLibrary();await this.setBeat({...row,url:this.url('beats',path)});
      }catch(e){this.notify('Import failed: '+e.message);}
    };input.click();
  }
  async record() {
    if(this.recording){this.stopRecord();return;}
    if(this.busy||!this.ready||this.pending)return;
    this.busy=true;this.refresh();let stream;
    try {
      await this.context().resume();
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      await Promise.all(this.tracks.map(t=>this.decode(t)));
      const offset=this.position();this.app.stopPlayback();this.cursor=offset;this.rate=1;
      const recorder=new MediaRecorder(stream), chunks=[];
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());
        const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});
        this.pending={blob,offset:this.captureOffset,id:window.ScrewShop.id(),name:'Vocal '+(this.tracks.filter(t=>t.id!=='beat').length+1)};
        this.app.setState({rec:false,secs:0});this.refresh();await this.saveRecording();
      };
      this.recorder=recorder;this.recording=true;this.recordStarted=performance.now();
      this.busy=false;await this.play(true);
      // Align the clip with the shared audio clock at the instant capture starts.
      recorder.start();this.captureOffset=this.position();
      this.app.setState({tab:'studio',rec:true,secs:0});this.refresh();
    } catch(e) {
      stream?.getTracks().forEach(t=>t.stop());this.recording=false;this.halt();
      this.notify('Recording could not start: '+e.message);
    } finally{this.busy=false;this.refresh();}
  }
  stopRecord() {
    if(this.recorder?.state==='recording'){this.busy=true;this.recorder.stop();}
    this.recording=false;this.halt();this.app.setState({rec:false});this.refresh();
  }
  async saveRecording() {
    const pending=this.pending;if(!pending)return;
    this.busy=true;this.refresh();
    try {
      const path='local/'+this.app.SONG_UUID+'/'+pending.id+(pending.blob.type.includes('mp4')?'.m4a':'.webm');
      await this.checked(this.app.sb.storage.from('takes').upload(path,pending.blob));
      const track={id:pending.id,name:pending.name,url:this.url('takes',path),offset:pending.offset,volume:0.8};
      await this.decode(track);
      await this.checked(this.app.sb.from('takes').upsert({id:track.id,user_id:'local',song_id:this.app.SONG_UUID,storage_path:path,duration_secs:track.duration,offset_secs:track.offset,label:track.name,bar_start:0}));
      if(!this.tracks.some(t=>t.id===track.id))this.tracks.push(track);
      await this.save();this.pending=null;this.notify('Vocal saved locally as its own track.');
    } catch(e){this.notify('Recording is still in memory. Use RETRY SAVE before closing: '+e.message);}
    finally{this.busy=false;this.refresh();}
  }
  tick() {
    if(this.playing && !this.recording && this.position()>=this.duration())this.halt();
    if(this.recording)this.app.setState({secs:Math.floor((performance.now()-this.recordStarted)/1000)});
    const position=this.position(), duration=this.duration();
    for(const el of document.querySelectorAll('[data-studio-clock]'))el.textContent=this.app.fmtTime(position)+' / '+this.app.fmtTime(duration);
    const seek=document.getElementById('session-seek');if(seek && document.activeElement!==seek)seek.value=position;
    document.querySelectorAll('[data-track-wave]').forEach(canvas=>{
      const track=this.tracks.find(t=>t.id===canvas.dataset.trackWave),buffer=track&&this.buffers.get(track.url);if(!track)return;
      const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
      ctx.strokeStyle='#d9b4ff19';for(let x=0;x<w;x+=w/16){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
      if(buffer){const data=buffer.getChannelData(0);ctx.fillStyle=track.id==='beat'?'#aa79ed':'#63d6b2';
        const left=track.offset/duration*w,width=buffer.duration/duration*w;
        ctx.globalAlpha=track.muted?0.3:1;
        for(let x=0;x<width;x++){let peak=0;const a=Math.floor(x/width*data.length),b=Math.floor((x+1)/width*data.length);for(let i=a;i<b;i+=Math.max(1,Math.floor((b-a)/80)))peak=Math.max(peak,Math.abs(data[i]));const height=Math.max(2,peak*(h-16));ctx.fillRect(left+x,(h-height)/2,1,height);}
        ctx.globalAlpha=1;
      }
      ctx.fillStyle='#fff';ctx.fillRect(position/duration*w,0,2,h);
    });
  }
  rows() {
    const tracks=this.tracks.some(t=>t.id==='beat')?this.tracks:[{id:'empty',name:'Load a beat or instrumental',offset:0},...this.tracks];
    return tracks.map((t,i)=>({...t,number:i+1,volume:t.volume??0.8,muteLabel:t.muted?'UNMUTE':'MUTE',soloLabel:t.solo?'UNSOLO':'SOLO',status:t.loadError|| (t.id==='empty'?'Track 1 is reserved for your beat':this.app.fmtLen(t.duration||0)),
      rename:e=>this.change(t.id,{name:e.target.value}),level:e=>this.change(t.id,{volume:+e.target.value}),mute:()=>this.change(t.id,{muted:!t.muted}),solo:()=>this.change(t.id,{solo:!t.solo}),move:e=>this.change(t.id,{offset:+e.target.value}),seek:e=>{const rect=e.currentTarget.getBoundingClientRect();this.seek((e.clientX-rect.left)/rect.width*this.duration());}}));
  }
  dispose(){clearInterval(this.timer);this.stopRecord();this.ctx?.close();}
};
