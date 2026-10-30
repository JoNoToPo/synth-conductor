/* ---------- MIDI out: the same notes, pedal and knob moves, sent to another instrument and/or recorded to a .mid file ---------- */
// Knobs sent as controllers. Standard numbers where one exists, so most synths respond without any setup
const MIDI_CC={vibrato:1,volume:7,cutoff:74,resonance:71,attack:73,release:72,decay:75,reverb:91,chorus:93,tremolo:92,detune:94,phaser:95,drive:85,delay:86,feedback:87,
  // No standard numbers for these, so they sit together on 20–31, which MIDI leaves free for this kind of use
  bass:20,treble:21,pedal:22,highpass:23,vowel:24,flanger:25,autopan:26,rotary:27,sustain:28,pump:29,strum:30,mid:31,
  crush:102,rate:103,wobble:104,noise:105,tempo:106};
// Pitch bend knob: a dead zone around the middle so an upright hand is reliably in tune. Returns -1..1
const bendAmt=v=>v<.45?(v-.45)/.45:v>.55?(v-.55)/.45:0;
const midiOut={
  accP:null,acc:null,port:null,ch:0,bassCh:null,vel:100,velMode:'fixed',sens:.5,bendRange:2,cc:true,clock:false,mute:false,
  held:new Map(),last:{},ccLast:{},bendLast:null,rec:null,lastVel:100,velAt:0,
  access(){ return this.accP||(this.accP=navigator.requestMIDIAccess().catch(e=>{this.accP=null;throw e})); },
  live(){ return !!(this.port||this.rec); },
  // Audio-clock time → MIDI timestamp (page clock, ms)
  stamp(t){ const c=audio.ctx; return performance.now()+(c?Math.max(0,t-c.currentTime)*1000:0); },
  emit(bytes,when=performance.now()){
    if(this.port)try{this.port.send(bytes,when)}catch(e){}
    if(this.rec)this.rec.ev.push([when,bytes]);
  },
  // How hard a chord is struck. With Hand speed, every note of one chord shares the speed read when it started,
  // and arpeggio notes keep the chord's velocity (a still hand mid-arpeggio shouldn't fade it out)
  velocity(){ const now=performance.now();
    if(this.velMode==='speed'){ if(now-this.velAt>40){ const s=handPeak(st.rightOnly?'R':'L');
        const k=this.knobVel(); this.lastVel=s===null?k:k<=25?k:Math.round(25+(k-25)*handSpeed01(st.rightOnly?'R':'L')); showVel(this.lastVel); }
      this.velAt=now; return this.lastVel; }
    return this.lastVel=this.velMode==='volume'?Math.max(1,Math.round(20+st.ctrl.volume.v*107)):this.knobVel(); },
  // The Velocity knob as 1–127 (with anything the mod matrix adds)
  knobVel(){ return Math.max(1,Math.min(127,Math.round(1+effV('velocity')*126))); },
  // Built-in synth loudness for a velocity; 100 is the usual level. With Volume knob, Volume already sets the level
  level(vel){ return this.velMode==='volume'?1:(.3+.7*vel/127)/.85; },
  chans(){ return this.bassCh!==null&&this.bassCh!==this.ch?[this.ch,this.bassCh]:[this.ch]; },
  // Held chord notes. A note's off is always stamped after its on, even when a strum delays the on
  on(m,t,vel=this.velocity()){ if(!this.live())return; const ch=this.bassCh!==null&&m===st.bassNote?this.bassCh:this.ch;
    const w=Math.max(this.stamp(t),this.last[m]||0); this.last[m]=w; this.held.set(m,ch); this.emit([0x90|ch,m,vel],w); },
  off(m){ const ch=this.held.get(m); if(ch===undefined)return; this.held.delete(m);
    const w=Math.max(performance.now(),(this.last[m]||0)+1); this.last[m]=w; this.emit([0x80|ch,m,0],w); },
  // Arpeggio notes are booked ahead and can be cancelled, so they go out on timers shortly before they're due
  shot(m,t,dur){ if(!this.live())return null; const h={m,ch:this.ch,on:false,w:0};
    const at=(sec,fn)=>setTimeout(fn,Math.max(0,(sec-audio.ctx.currentTime)*1000-20));
    h.t1=at(t,()=>{ h.on=true; h.w=this.stamp(t); this.emit([0x90|h.ch,m,this.velMode==='fixed'?this.knobVel():this.lastVel],h.w);
      h.t2=at(t+dur,()=>{ h.on=false; this.emit([0x80|h.ch,m,0],Math.max(this.stamp(t+dur),h.w+1)); }); });
    return h; },
  drop(h){ if(!h)return; clearTimeout(h.t1); clearTimeout(h.t2);
    if(h.on){ h.on=false; this.emit([0x80|h.ch,h.m,0],Math.max(performance.now(),h.w+1)); } },
  pedal(on){ if(this.live())for(const ch of this.chans())this.emit([0xb0|ch,64,on?127:0]); },
  damp(){ if(audio.pedal){ this.pedal(false); this.pedal(true); } },   // Stop: a quick lift of the pedal cuts the ringing tails
  // Pitch bend always goes out; the knobs only with "Knobs as CC"
  ctrl(k,v){ if(k==='bend')return this.bend(v); const n=MIDI_CC[k];
    if(n===undefined||!this.live()||!this.cc||(k==='volume'&&this.velMode==='volume'))return;
    const x=Math.round(clamp01(v)*127); if(this.ccLast[k]===x)return; this.ccLast[k]=x;
    for(const ch of this.chans())this.emit([0xb0|ch,n,x]); },
  bend(v){ if(!this.live())return; const x=Math.max(0,Math.min(16383,Math.round(8192+bendAmt(v)*8191)));
    if(this.bendLast!==null&&Math.abs(x-this.bendLast)<8&&x!==8192)return; if(x===this.bendLast)return; this.bendLast=x;
    for(const ch of this.chans())this.emit([0xe0|ch,x&127,x>>7]); },
  // Tell the instrument the bend range (RPN 0), then close the RPN so later data-entry moves don't change it
  sendBendRange(){ if(this.live())for(const ch of this.chans())
    for(const [c,v] of [[101,0],[100,0],[6,this.bendRange],[38,0],[101,127],[100,127]])this.emit([0xb0|ch,c,v]); },
  // Send the current knob, bend and pedal state, so a newly connected instrument (or a new recording) starts in step
  sync(){ this.ccLast={}; this.bendLast=null; this.sendBendRange(); for(const k in MIDI_CC)this.ctrl(k,st.ctrl[k].v); this.bend(st.ctrl.bend.v);
    if(audio.pedal)this.pedal(true); },
  // Release everything: held notes, booked arpeggio notes, the pedal, and "all notes off" on every channel
  panic(){ for(const m of [...this.held.keys()])this.off(m);
    for(const p of audio.pendingShots)this.drop(p.midi);
    if(this.port)for(let ch=0;ch<16;ch++)try{this.port.send([0xb0|ch,64,0]);this.port.send([0xb0|ch,123,0]);this.port.send([0xe0|ch,0,64])}catch(e){}
    this.bendLast=null; },
  /* Clock: 24 pulses per beat on the same grid as the arpeggio, starting on the next bar */
  clockTimer:null,clockNext:0,clockStep:0,
  startClock(){ if(this.clockTimer||!this.port||!audio.ctx)return;
    const c=audio.ctx,bar=beatSec()*meterOf().bar; this.clockStep=beatSec()/24;
    this.clockNext=audio.t0+Math.ceil((c.currentTime+.05-audio.t0)/bar)*bar;
    try{this.port.send([0xfa],this.stamp(this.clockNext))}catch(e){}
    this.clockTimer=setInterval(()=>{ if(!this.port)return this.stopClock(); const now=c.currentTime,step=beatSec()/24;
      if(step!==this.clockStep){ this.clockStep=step; this.clockNext=audio.t0+Math.ceil((this.clockNext-audio.t0)/step)*step; }
      if(this.clockNext<now)this.clockNext=audio.t0+Math.ceil((now-audio.t0)/step)*step;   // catch up after the tab was in the background
      while(this.clockNext<now+.1){ try{this.port.send([0xf8],this.stamp(this.clockNext))}catch(e){} this.clockNext+=step; } },25); },
  stopClock(){ if(!this.clockTimer)return; clearInterval(this.clockTimer); this.clockTimer=null; if(this.port)try{this.port.send([0xfc])}catch(e){} },
  /* Recording to a Standard MIDI File (type 0, 480 ticks per beat, at the BPM when recording started) */
  startRec(){ const now=performance.now(); this.rec={ev:[],t0:now,bpm:st.bpm}; this.sync();
    for(const m of audio.voices.keys()){ const ch=this.held.get(m);
      if(ch===undefined)this.on(m,audio.ctx.currentTime,this.lastVel); else this.rec.ev.push([now,[0x90|ch,m,this.lastVel]]); } },
  stopRec(){ const r=this.rec; if(!r)return null; this.rec=null; const end=performance.now();
    for(const [m,ch] of this.held)r.ev.push([end,[0x80|ch,m,0]]);
    for(const p of audio.pendingShots)if(p.midi&&p.midi.on)r.ev.push([end,[0x80|p.midi.ch,p.midi.m,0]]);
    const msTick=60000/r.bpm/this.TPQ, ev=r.ev.sort((a,b)=>a[0]-b[0]).map(([w,b])=>[Math.round((w-r.t0)/msTick),b]);
    const f=this.smf(ev,r.bpm); return {blob:f.blob,notes:f.notes,sec:(end-r.t0)/1000}; },
  /* A type 0 Standard MIDI File from [tick, bytes] events in time order, with the tempo and time signature first */
  TPQ:480,
  smf(ev,bpm){ const tpq=this.TPQ, us=Math.round(6e7/bpm);
    const vlq=n=>{const o=[n&0x7f];while(n>>=7)o.unshift((n&0x7f)|0x80);return o};
    const m=meterOf(), trk=[0,0xff,0x51,3,us>>16&255,us>>8&255,us&255, 0,0xff,0x58,4,m.n,Math.log2(m.d),24*m.step,8];   // tempo, then time signature
    let last=0,notes=0;
    for(const [t,b] of ev){ const tick=Math.max(last,t); trk.push(...vlq(tick-last),...b); last=tick; if((b[0]&0xf0)===0x90)notes++; }
    trk.push(0,0xff,0x2f,0); const n=trk.length;
    const file=new Uint8Array([0x4d,0x54,0x68,0x64,0,0,0,6,0,0,0,1,tpq>>8,tpq&255, 0x4d,0x54,0x72,0x6b,n>>>24,n>>16&255,n>>8&255,n&255,...trk]);
    return {blob:new Blob([file],{type:'audio/midi'}),notes}; },
  setMute(on){ this.mute=on; if(audio.ctx)audio.ramp(audio.out.gain,on?0:1,.03); },
};
