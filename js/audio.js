/* ---------- Audio ---------- */
const SOUNDS={
  pad:{label:'Warm pad',osc:[['sawtooth',-8,1,.5],['sawtooth',8,1,.5],['sine',0,.5,.6]],a:.14,d:.5,s:.75,r:1.0,cut:2600},
  keys:{label:'Electric keys',osc:[['sine',0,1,.8],['triangle',0,2,.18],['sine',3,4,.05]],a:.004,d:1.6,s:.22,r:.45,cut:6000,strike:true},
  organ:{label:'Drawbar organ',osc:[['sine',0,1,.5],['sine',0,2,.3],['sine',0,3,.18],['sine',0,.5,.3]],a:.015,d:.05,s:1,r:.12,cut:5000},
  strings:{label:'Soft strings',osc:[['sawtooth',-5,1,.4],['sawtooth',5,1,.4],['sawtooth',0,2,.08]],a:.35,d:.6,s:.8,r:1.3,cut:1800},
  // Each partial: [wave, detune in cents, frequency ratio, level, own fade time in seconds (struck sounds: upper partials die away first)]
  glass:{label:'Glass pad',osc:[['sine',0,1,.55],['sine',4,2,.28],['triangle',-4,3,.09],['sine',0,4,.06]],a:.5,d:.8,s:.9,r:1.6,cut:5200},
  brass:{label:'Warm brass',osc:[['sawtooth',0,1,.5],['sawtooth',6,1,.35],['square',-6,.5,.12]],a:.07,d:.4,s:.85,r:.25,cut:2200},
  accordion:{label:'Accordion',osc:[['square',-7,1,.28],['square',7,1,.28],['sawtooth',0,2,.12]],a:.03,d:.1,s:1,r:.1,cut:3000},
  pan:{label:'Steel pan',osc:[['sine',0,1,.75,1.4],['sine',3,2,.38,.5],['sine',-4,3,.14,.22],['triangle',0,4.02,.06,.07]],a:.002,d:1.5,s:0,r:.5,cut:7000,strike:true},
  marimba:{label:'Marimba',osc:[['sine',0,1,.9,.9],['sine',0,4,.2,.12],['sine',0,10,.05,.03]],a:.002,d:1,s:0,r:.3,cut:6000,strike:true},
  vibes:{label:'Vibraphone',osc:[['sine',0,1,.75],['sine',0,4,.14,.4],['sine',2,3,.05,.2]],a:.003,d:3.5,s:.05,r:1.2,cut:6000,strike:true},
  kalimba:{label:'Kalimba',osc:[['sine',0,1,.8,1.1],['sine',0,5.4,.14,.06],['triangle',0,2,.09,.2]],a:.002,d:1.3,s:0,r:.4,cut:6000,strike:true},
  musicbox:{label:'Music box',osc:[['sine',0,2,.6,1.6],['sine',0,4,.22,.6],['sine',0,8.4,.1,.2],['sine',0,13.6,.04,.08]],a:.001,d:2,s:0,r:.6,cut:9000,strike:true},
  reed:{label:'Reed (bagpipe)',osc:[['sawtooth',0,1,.45],['square',7,1,.2],['sawtooth',-6,2,.12]],a:.04,d:.3,s:.9,r:.2,cut:1700},   // the drone's reed, to play chords with
  harp:{label:'Harp',osc:[['triangle',0,1,.75,1.2],['sawtooth',0,1,.18,.25],['sine',0,2,.16,.6]],a:.002,d:1.8,s:0,r:.5,cut:4500,strike:true},
};
// Instruments you build in the Mod matrix panel: the same shape as above, kept in this browser under ids starting u_
const INSTR_WAVES=['sine','triangle','sawtooth','square'], INSTR_MAX_OSC=6, INSTR_RATIO=[1/16,32];   // pitch multiples allowed
function instrClean(c){ if(!c||typeof c!=='object'||!Array.isArray(c.osc))return null;
  const n=(v,lo,hi,f)=>typeof v==='number'&&isFinite(v)?Math.max(lo,Math.min(hi,v)):f;
  const osc=c.osc.filter(o=>Array.isArray(o)&&INSTR_WAVES.includes(o[0])).slice(0,INSTR_MAX_OSC)
    .map(o=>{const x=[o[0],n(o[1],-100,100,0),n(o[2],INSTR_RATIO[0],INSTR_RATIO[1],1),n(o[3],0,1,.5)]; const f=n(o[4],0,5,0); if(f>=.02)x.push(f); return x});
  if(!osc.length)return null;
  return {label:String(c.label||'My instrument').slice(0,30).trim()||'My instrument',osc,a:n(c.a,.001,3,.02),d:n(c.d,.02,4,.5),s:n(c.s,0,1,.7),
    r:n(c.r,.02,5,.4),cut:n(c.cut,250,12000,3000),strike:!!c.strike}; }
const loadInstruments=()=>{try{return JSON.parse(localStorage.getItem('vh-instruments')||'{}')||{}}catch(e){return {}}};
for(const [id,c] of Object.entries(loadInstruments())){ const x=instrClean(c); if(x&&/^u_[\w-]+$/.test(id))SOUNDS[id]={...x,mine:true}; }
function rememberSound(){ try{localStorage.setItem('vh-sound',SOUNDS[st.sound]?.draft?SOUNDS[st.sound].from||'pad':st.sound)}catch(e){} }
try{ const v=localStorage.getItem('vh-sound'); if(v&&SOUNDS[v])st.sound=v; }catch(e){}
// An instrument that came with a preset or a link: reuse yours if it's the same one, otherwise add it to Yours
function instrInstall(c){ const def=instrClean(c); if(!def)return null; const all=loadInstruments(), same=JSON.stringify(def);
  let id=Object.keys(all).find(k=>JSON.stringify(instrClean(all[k]))===same);
  if(!id){ id='u_'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36); all[id]=def; try{localStorage.setItem('vh-instruments',JSON.stringify(all))}catch(e){} }
  SOUNDS[id]={...def,mine:true}; if(typeof fillSoundSel==='function')fillSoundSel(); return id; }
// Vowel formants (F1, F2, F3 in Hz), swept in this order: ah, eh, ee, oh, oo
const VOWELS=[[730,1090,2440],[530,1840,2480],[270,2290,3010],[570,840,2410],[300,870,2240]];
const audio={
  ctx:null,voices:new Map(),strum:0,detuneAmt:0,pedal:false,ringSec:4,sustained:[],
  init(){
    this.unmuteIOS();
    // iOS also leaves sound "interrupted" after a call, Siri or the lock screen, not just "suspended"
    if(this.ctx){ if(this.ctx.state!=='running')this.ctx.resume().catch(()=>{}); return; }
    const AC=window.AudioContext||window.webkitAudioContext; const ctx=this.ctx=new AC();
    // Some browsers create it paused even inside a tap; ask for it to start while the tap still counts
    if(ctx.state!=='running')ctx.resume().catch(()=>{});
    ctx.onstatechange=()=>status();
    const G=v=>{const g=ctx.createGain();g.gain.value=v;return g};
    // Chain: voices → bus → drive → high-pass → low-pass → vowel formants → chorus → post → (dry + reverb) → bass → mid → treble → comp → master
    this.bus=G(1);
    this.voiceBus=G(1); // chord voices only: the Bow dial shapes each stroke here
    this.bowTone=ctx.createBiquadFilter(); this.bowTone.type='highshelf'; this.bowTone.frequency.value=2800; this.bowTone.gain.value=0;   // a down bow's bite, an up bow's softness
    this.voiceBus.connect(this.bowTone); this.bowTone.connect(this.bus);
    this.drive=ctx.createWaveShaper(); this.driveGain=G(1);
    this.hp=ctx.createBiquadFilter(); this.hp.type='highpass'; this.hp.frequency.value=20; this.hp.Q.value=.7;
    this.filter=ctx.createBiquadFilter(); this.filter.type='lowpass'; this.filter.Q.value=.6; this.filter.frequency.value=SOUNDS[st.sound].cut;
    this.formants=VOWELS[0].map(f=>{const b=ctx.createBiquadFilter();b.type='peaking';b.frequency.value=f;b.Q.value=6;b.gain.value=0;return b});
    this.chDelay=ctx.createDelay(.05); this.chDelay.delayTime.value=.018; this.chWet=G(0);
    const chLfo=ctx.createOscillator(); chLfo.frequency.value=.7; const chDepth=G(.004); chLfo.connect(chDepth); chDepth.connect(this.chDelay.delayTime); chLfo.start();
    this.vibLfo=ctx.createOscillator(); this.vibLfo.frequency.value=5.5; this.vibDepth=G(0); this.vibLfo.connect(this.vibDepth); this.vibLfo.start();
    this.bend=ctx.createConstantSource(); this.bend.offset.value=0; this.bend.start();   // pitch bend, in cents, on every oscillator
    const post=G(1);
    this.master=G(.6);
    const comp=ctx.createDynamicsCompressor(); comp.threshold.value=-16; comp.ratio.value=3;
    const verb=this.verb=ctx.createConvolver(); verb.buffer=this.impulse(st.fx.reverbType); this.wet=G(.3);
    this.bus.connect(this.drive); this.drive.connect(this.driveGain); this.driveGain.connect(this.hp); this.hp.connect(this.filter);
    let node=this.filter; for(const f of this.formants){node.connect(f);node=f}
    // Serial effects, each with its own dry/wet: phaser → flanger → rotary → tremolo → auto-pan
    const lfo=(hz,type='sine')=>{const o=ctx.createOscillator();o.type=type;o.frequency.value=hz;o.start();return o};
    const insert=(src,fxIn,fxOut)=>{const dry=G(1),wet=G(0),out=G(1);src.connect(dry);dry.connect(out);src.connect(fxIn);fxOut.connect(wet);wet.connect(out);return {dry,wet,out}};
    // Phaser: four sweeping all-pass stages
    const aps=[0,1,2,3].map(()=>{const a=ctx.createBiquadFilter();a.type='allpass';a.frequency.value=900;a.Q.value=.7;return a});
    for(let i=0;i<3;i++)aps[i].connect(aps[i+1]);
    this.phLfo=lfo(.45); const phDepth=G(650); this.phLfo.connect(phDepth); aps.forEach(a=>phDepth.connect(a.frequency));
    this.ph=insert(node,aps[0],aps[3]); node=this.ph.out;
    // Flanger: a very short swept delay with feedback
    const fl=ctx.createDelay(.02); fl.delayTime.value=.003; const flFb=G(.55); fl.connect(flFb); flFb.connect(fl);
    this.flLfo=lfo(.22); const flDepth=G(.0025); this.flLfo.connect(flDepth); flDepth.connect(fl.delayTime);
    this.fl=insert(node,fl,fl); node=this.fl.out;
    // Rotary speaker: one spinning rotor gives pitch wobble (doppler), level wobble and left/right movement
    const rDelay=ctx.createDelay(.02); rDelay.delayTime.value=.004; const rAM=G(.78), rPan=ctx.createStereoPanner();
    rDelay.connect(rAM); rAM.connect(rPan);
    this.rotLfo=lfo(.7); const rDop=G(.0012), rAmD=G(.22), rPanD=G(.75);
    this.rotLfo.connect(rDop); rDop.connect(rDelay.delayTime); this.rotLfo.connect(rAmD); rAmD.connect(rAM.gain); this.rotLfo.connect(rPanD); rPanD.connect(rPan.pan);
    this.rot=insert(node,rDelay,rPan); node=this.rot.out;
    // Tremolo (level) and auto-pan (left/right), tempo-synced
    this.trem=G(1); this.tremLfo=lfo(5); this.tremDepth=G(0); this.tremLfo.connect(this.tremDepth); this.tremDepth.connect(this.trem.gain);
    node.connect(this.trem); node=this.trem;
    this.pan=ctx.createStereoPanner(); this.panLfo=lfo(.5); this.panDepth=G(0); this.panLfo.connect(this.panDepth); this.panDepth.connect(this.pan.pan);
    node.connect(this.pan); node=this.pan;
    node.connect(post); node.connect(this.chDelay); this.chDelay.connect(this.chWet); this.chWet.connect(post);
    // Pump: tempo-synced ducking on everything, reverb and delay included
    this.pumpGain=G(1);
    post.connect(this.pumpGain); post.connect(verb); verb.connect(this.wet); this.wet.connect(this.pumpGain);
    // Ping-pong delay, tempo-synced, darkening as it repeats
    this.dSend=G(0); const dL=this.dL=ctx.createDelay(4), dR=this.dR=ctx.createDelay(4);
    const pL=ctx.createStereoPanner(), pR=ctx.createStereoPanner(); pL.pan.value=-.8; pR.pan.value=.8;
    const damp=()=>{const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=3200;return f};
    const dampL=damp(), dampR=damp(); this.fbL=G(.35); this.fbR=G(.35); const dOut=G(.9);
    post.connect(this.dSend); this.dSend.connect(dL);
    dL.connect(pL); pL.connect(dOut); dL.connect(dampL); dampL.connect(this.fbL); this.fbL.connect(dR);
    dR.connect(pR); pR.connect(dOut); dR.connect(dampR); dampR.connect(this.fbR); this.fbR.connect(dL);
    dOut.connect(this.pumpGain);
    // Tone: bass and treble shelves with a mid band between, flat at the centre of their knobs
    this.bassEq=ctx.createBiquadFilter(); this.bassEq.type='lowshelf'; this.bassEq.frequency.value=220; this.bassEq.gain.value=0;
    this.trebleEq=ctx.createBiquadFilter(); this.trebleEq.type='highshelf'; this.trebleEq.frequency.value=3200; this.trebleEq.gain.value=0;
    this.midEq=ctx.createBiquadFilter(); this.midEq.type='peaking'; this.midEq.frequency.value=1000; this.midEq.Q.value=.7; this.midEq.gain.value=0;
    this.pumpGain.connect(this.bassEq); this.bassEq.connect(this.midEq); this.midEq.connect(this.trebleEq); this.trebleEq.connect(comp); comp.connect(this.master);
    // Output stage: about 8 dB of extra level, then a limiter so loud chords and arpeggios can't clip
    const boost=G(2.5), lim=ctx.createDynamicsCompressor();
    lim.threshold.value=-4; lim.knee.value=0; lim.ratio.value=20; lim.attack.value=.002; lim.release.value=.12;
    // Last stage: muted when only the MIDI instrument should be heard
    this.out=G(midiOut.mute?0:1);
    this.master.connect(boost); boost.connect(lim); lim.connect(this.out); this.out.connect(ctx.destination); this.lim=lim;
    this.t0=ctx.currentTime;
    applyAllRoutes(); setVibRate(); setTimeFx(); if(st.click)this.startClick(); if(midiOut.clock)midiOut.startClock();
    document.getElementById('audioDot').classList.add('on'); status();
  },
  /* iPhone and iPad: Safari mutes web audio when the ring/silent switch is on, unless the page asks to play as
     media. iOS 17+ has a setting for that; older iOS switches over while an <audio> element plays, so a
     silent one loops quietly. Must run inside a tap, which every caller of init() is. */
  silentEl:null,
  unmuteIOS(){
    try{ if(navigator.audioSession){ if(navigator.audioSession.type!=='playback')navigator.audioSession.type='playback'; return; } }catch(e){}
    const ios=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    if(!ios)return;
    if(!this.silentEl){
      // Half a second of 8-bit silence as a WAV file
      const n=4000,b=new Uint8Array(44+n),v=new DataView(b.buffer),s=(o,t)=>[...t].forEach((c,i)=>b[o+i]=c.charCodeAt(0));
      s(0,'RIFF');v.setUint32(4,36+n,true);s(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
      v.setUint32(24,8000,true);v.setUint32(28,8000,true);v.setUint16(32,1,true);v.setUint16(34,8,true);s(36,'data');v.setUint32(40,n,true);b.fill(128,44);
      const el=this.silentEl=document.createElement('audio'); el.setAttribute('playsinline',''); el.setAttribute('x-webkit-airplay','deny');
      el.loop=true; el.preload='auto'; el.src=URL.createObjectURL(new Blob([b],{type:'audio/wav'}));
    }
    if(this.silentEl.paused)this.silentEl.play().catch(()=>{});
  },
  ramp(param,v,tc=.06){ if(this.ctx) param.setTargetAtTime(v,this.ctx.currentTime,tc); },
  setDrive(k){ // k 0..1
    if(!this.ctx)return;
    if(this._driveK!==undefined&&Math.abs(k-this._driveK)<.01)return; this._driveK=k;
    if(k<.02){this.drive.curve=null;this.ramp(this.driveGain.gain,1);return}
    const amt=k*60,n=1024,c=new Float32Array(n);
    for(let i=0;i<n;i++){const x=i*2/n-1;c[i]=(1+amt)*x/(1+amt*Math.abs(x))}
    this.drive.curve=c; this.ramp(this.driveGain.gain,1/(1+k*1.6));
  },
  setVowel(v,on){ // v 0..1 sweeps ah→oo
    if(!this.ctx)return;
    const pos=Math.max(0,Math.min(.9999,v))*(VOWELS.length-1),i=Math.floor(pos),fr=pos-i;
    this.formants.forEach((b,k)=>{const f=VOWELS[i][k]*(1-fr)+VOWELS[i+1][k]*fr;this.ramp(b.frequency,f);this.ramp(b.gain,on?13:0)});
  },
  setDetune(d){ this.detuneAmt=d; if(!this.ctx)return; for(const v of this.voices.values())v.oscs.forEach(o=>this.ramp(o.detune,this.oscDetune(o))) },
  oscDetune(o){ const d=this.detuneAmt; return o._base*(1+d*4)+(o._base===0?(o._i%2?1:-1)*d*18:0) },
  // Reverb rooms, made from shaped noise: length, decay curve, pre-delay, brightness, spring flutter
  impulse(type){
    const R={room:[1.0,2.4,.004,.55,0],hall:[2.6,3.2,.012,.35,0],plate:[2.0,2.1,0,.9,0],spring:[2.2,2.6,.008,.6,1],cathedral:[5.5,3.4,.03,.3,0]}[type]||[2.6,3.2,.012,.35,0];
    const [sec,curve,pre,bright,spring]=R, ctx=this.ctx, sr=ctx.sampleRate, len=Math.floor(sr*sec), b=ctx.createBuffer(2,len,sr), p0=Math.floor(pre*sr);
    for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);let lp=0;
      for(let i=p0;i<len;i++){const t=(i-p0)/(len-p0);let x=(Math.random()*2-1);
        lp+= (x-lp)*(.08+bright*.9); x=lp;                       // darker rooms lose highs
        if(spring)x*=1+.6*Math.sin(2*Math.PI*(28+ch*3)*i/sr);    // springy flutter
        d[i]=x*Math.pow(1-t,curve);}}
    return b;
  },
  setReverbType(type){ if(this.ctx)this.verb.buffer=this.impulse(type); },
  mix(fx,v,dryDrop=.35){ if(!this.ctx)return; this.ramp(fx.wet.gain,v*.85); this.ramp(fx.dry.gain,1-v*dryDrop); },
  setRotary(v){ if(!this.ctx)return; const on=v>=.03;
    this.ramp(this.rot.wet.gain,on?.95:0,.15); this.ramp(this.rot.dry.gain,on?.3:1,.15);
    // Leslie-style inertia: the rotor takes a moment to speed up or slow down
    if(on)this.rotLfo.frequency.setTargetAtTime(.7*Math.pow(6.8/.7,(v-.03)/.97),this.ctx.currentTime,.7); },
  setTrem(v){ if(!this.ctx)return; this.ramp(this.tremDepth.gain,v/2); this.ramp(this.trem.gain,1-v/2); },
  setPan(v){ if(!this.ctx)return; this.ramp(this.panDepth.gain,v*.9); },
  setDelayMix(v){ if(!this.ctx)return; this.ramp(this.dSend.gain,v*.8); },
  setFeedback(v){ if(!this.ctx)return; this.ramp(this.fbL.gain,v*.85); this.ramp(this.fbR.gain,v*.85); },
  /* Pump: dip on every beat, then swell back (sidechain style) */
  pumpDepth:0,pumpTimer:null,pumpNext:0,
  setPump(v){ this.pumpDepth=v; if(!this.ctx)return;
    if(v<.02){clearInterval(this.pumpTimer);this.pumpTimer=null;this.pumpGain.gain.cancelScheduledValues(this.ctx.currentTime);this.ramp(this.pumpGain.gain,1);return}
    if(this.pumpTimer)return;
    const b=beatSec(),now=this.ctx.currentTime+.03; this.pumpNext=this.t0+Math.ceil((now-this.t0)/b)*b;
    this.pumpTimer=setInterval(()=>{const now=this.ctx.currentTime,b=beatSec(),g=this.pumpGain.gain;
      if(this.pumpNext<now)this.pumpNext=this.t0+Math.ceil((now-this.t0)/b)*b;
      while(this.pumpNext<now+.12){const t=this.pumpNext;
        g.setTargetAtTime(1-this.pumpDepth*.85,t,.004); g.setTargetAtTime(1,t+.02,b*.2); this.pumpNext+=b;}},25); },
  // Build one note's oscillators. When every oscillator has finished, all of its connections are removed
  // so finished notes don't stay in the audio graph (they were piling up and stalling playback).
  build(m,t){
    const ctx=this.ctx,p=SOUNDS[st.sound],f=440*Math.pow(2,(m-69)/12);
    const g=ctx.createGain(); g.gain.value=0; g.connect(this.voiceBus);
    // Low notes get an octave-up overtone: small speakers can't play a low fundamental, and the ear rebuilds it from this
    const lo=lowBelow(m), boost=lowAmt(), sum=p.osc.reduce((a,x)=>a+x[3],0), fade=p.osc[0][4];
    const osc=lo>0&&boost>.01?[...p.osc,...LOW_OT.map(([r,k])=>['sine',0,r,boost*k*lo*sum,fade])]:p.osc;
    let live=osc.length;
    const oscs=osc.map(([type,det,ratio,lvl,fade],i)=>{const o=ctx.createOscillator(),og=ctx.createGain();o.type=type;o.frequency.value=f*ratio;
      o._base=det;o._i=i;o.detune.value=this.oscDetune(o);this.vibDepth.connect(o.detune);this.bend.connect(o.detune);if(this.wobble)this.wobble.connect(o.detune);
      og.gain.value=lvl; if(fade){og.gain.setValueAtTime(lvl,t);og.gain.setTargetAtTime(0,t,fade/3);}
      o.connect(og);og.connect(g);o.start(t);
      o.onended=()=>{try{this.vibDepth.disconnect(o.detune)}catch(e){} try{this.bend.disconnect(o.detune)}catch(e){} try{this.wobble&&this.wobble.disconnect(o.detune)}catch(e){} try{o.disconnect();og.disconnect()}catch(e){}
        if(--live<=0){try{g.disconnect()}catch(e){}}};
      return o});
    return {g,oscs,p};
  },
  noteOn(m,delay=0){
    const t=this.ctx.currentTime+delay,{g,oscs}=this.build(m,t),e=env(),vel=midiOut.velocity();
    // Low notes are lifted (Low notes dial)
    const peak=.16*midiOut.level(vel)*lowGain(m); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak,t+e.a); g.gain.setTargetAtTime(peak*e.s,t+e.a,e.d/3);
    this.voices.set(m,{g,oscs,start:t}); midiOut.on(m,t,vel);
  },
  releasing:[],
  // Sustain pedal (piano damper): while it's down, released notes keep ringing and fade over the ring length
  ring(v){
    const now=this.ctx.currentTime,t=Math.max(now,v.start||0),R=this.ringSec;
    v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value,t); v.g.gain.setTargetAtTime(0,t,R/5);
    v.end=t+R*1.2; v.oscs.forEach(o=>{try{o.stop(v.end)}catch(e){}});
    this.sustained=this.sustained.filter(x=>x.end>now); this.sustained.push(v);
    while(this.sustained.length>40){const old=this.sustained.shift(); this.fade(old,.02);}
  },
  fade(v,tc){ const now=this.ctx.currentTime;
    v.g.gain.cancelScheduledValues(now); v.g.gain.setValueAtTime(v.g.gain.value,now); v.g.gain.setTargetAtTime(0,now,tc);
    v.oscs.forEach(o=>{try{o.stop(now+tc*7)}catch(e){}}); },
  // A new ring length also reshapes notes already ringing, so moving the hand shortens or lengthens them
  setRing(R){ this.ringSec=R; if(!this.ctx||!this.pedal)return;
    if(this._ringAt&&Math.abs(R-this._ringAt)/this._ringAt<.1)return; this._ringAt=R;
    const now=this.ctx.currentTime; this.sustained=this.sustained.filter(v=>v.end>now);
    for(const v of this.sustained){ v.g.gain.cancelScheduledValues(now); v.g.gain.setValueAtTime(v.g.gain.value,now); v.g.gain.setTargetAtTime(0,now,R/5);
      const end=now+R*1.2; v.end=end; v.oscs.forEach(o=>{try{o.stop(end)}catch(e){}}); } },
  setPedal(on){
    if(this.pedal===on)return; this.pedal=on; midiOut.pedal(on);
    if(!on&&this.ctx){ const r=env().r, now=this.ctx.currentTime;
      for(const v of this.sustained) if(v.end>now) this.fade(v,r/4);
      this.sustained=[]; }
  },
  damp(){ midiOut.damp(); if(!this.ctx)return; for(const v of this.sustained)this.fade(v,.03); this.sustained=[]; },   // Stop silences pedal tails too
  noteOff(m){
    const v=this.voices.get(m); if(!v)return; this.voices.delete(m); midiOut.off(m);
    if(this.pedal){ this.ring(v); return; }
    const now=this.ctx.currentTime,t=Math.max(now,v.start||0),r=env().r;
    v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value,t); v.g.gain.setTargetAtTime(0,t,r/4);
    v.end=t+r*1.6; v.oscs.forEach(o=>{try{o.stop(v.end)}catch(e){}});
    // Cap the release tails: fast chord changes otherwise stack up dozens of fading notes
    this.releasing=this.releasing.filter(x=>x.end>now); this.releasing.push(v);
    while(this.releasing.length>24){const old=this.releasing.shift();
      old.g.gain.cancelScheduledValues(now); old.g.gain.setTargetAtTime(0,now,.01);
      old.oscs.forEach(o=>{try{o.stop(now+.06)}catch(e){}});}
  },
  /* Arpeggiator: the bass sustains, the voicing's notes play one at a time */
  chord:[],arpRate:0,arpPattern:'up',arpTimer:null,arpIdx:0,arpNext:0,strumDir:'up',strumFlip:false,
  // Strum direction: up (low to high), down (high to low), or down-up, alternating with each new chord like a guitar
  strumOrder(notes,newChord){ const o=notes.slice().sort((a,b)=>a-b);
    let down=this.strumDir==='down';
    if(this.strumDir==='alt'){ if(newChord)this.strumFlip=!this.strumFlip; down=this.strumFlip; }
    return down?o.reverse():o; },
  arpNotes(){ return this.chord.filter(m=>m!==st.bassNote).sort((a,b)=>a-b) },
  arpDiv:null,t0:0,
  setArpRate(nps){ const was=this.arpRate>0,changed=nps!==this.arpRate; this.arpRate=nps;
    if((nps>0)!==was)this.setNotes(this.chord);
    // Re-align to the grid only when the synced note value changes; never pull arpNext back
    // (notes up to arpNext are already scheduled, so moving it earlier would double them)
    else if(changed&&this.arpTimer&&this.arpDiv){const g=this.gridNext();if(g>this.arpNext)this.arpNext=g;} },
  // Next start time: on the tempo grid when synced, otherwise right away
  gridNext(){ const now=this.ctx.currentTime+.02; if(!this.arpDiv||!this.arpRate)return now;
    const step=1/this.arpRate; return this.t0+Math.ceil((now-this.t0)/step)*step; },
  startArp(){ if(this.arpTimer||!this.ctx)return; this.arpTimer=setInterval(()=>this.arpTick(),25); this.arpRetrigger(); },
  // A new chord (or the arp starting) plays its first note right away, drops any notes already booked
  // for the old chord, then carries on in time with the beat grid.
  pendingShots:[], lastArpKey:'',
  arpRetrigger(){
    const now=this.ctx.currentTime, step=1/this.arpRate, notes=this.arpNotes(); if(!notes.length)return;
    for(const p of this.pendingShots) if(p.t>now+.003){ p.g.gain.cancelScheduledValues(0); p.g.gain.value=0; p.oscs.forEach(o=>{try{o.stop(now)}catch(e){}}); midiOut.drop(p.midi); }
    this.pendingShots=this.pendingShots.filter(p=>p.t<=now+.003);
    this.arpIdx=0; const t=now+.005;
    let next;
    if(this.strum>0){
      // Strum and arp together: strum the whole chord first, then the arpeggio picks up on the next step after it
      const order=this.strumOrder(notes,true), ring=Math.max(step*2,.3), done=t+(order.length-1)*this.strum;
      order.forEach((m,i)=>this.shot(m,t+i*this.strum,ring));
      next=this.arpDiv?this.gridNext():done+step;
      while(next<done+step*.5)next+=step;
    } else {
      // The first note is the chord's own: notes the arp may skip here (the drone's, when it joins) wait for their turn in the pattern
      let i=0, m=this.arpPick(notes,0); if(this.arpSkip)while(this.arpSkip(m)&&i<notes.length*2){ i++; m=this.arpPick(notes,i); }
      this.shot(m,t,step*.85); this.arpIdx=i+1;
      next=this.arpDiv?this.gridNext():t+step;
      if(next-t<step*.5)next+=step;                   // don't double up when the press lands just before a grid step
    }
    this.arpNext=next;
  },
  arpPick(notes,i){ const n=notes.length;
    if(this.arpPattern==='down')return notes[n-1-i%n];
    if(this.arpPattern==='updown'){const per=Math.max(1,2*n-2),k=i%per;return notes[k<n?k:per-k]}
    if(this.arpPattern==='random')return notes[Math.floor(Math.random()*n)];
    return notes[i%n]; },
  /* Click track on every pulse of the meter: strongest on the bar's first pulse, stronger on each group's first */
  clickTimer:null,clickNext:0,beat:0,
  startClick(){ if(this.clickTimer||!this.ctx)return; const b=beatSec()*meterOf().step,now=this.ctx.currentTime+.02;
    this.beat=Math.ceil((now-this.t0)/b); this.clickNext=this.t0+this.beat*b;
    this.clickTimer=setInterval(()=>{const now=this.ctx.currentTime,m=meterOf(),b=beatSec()*m.step;
      if(this.clickNext<now){this.beat=Math.ceil((now-this.t0)/b);this.clickNext=this.t0+this.beat*b}
      while(this.clickNext<now+.1){const p=this.beat%m.n;this.tick(this.clickNext,p===0?2:m.strong.has(p)?1:0);this.beat++;this.clickNext+=b}},25); },
  stopClick(){ clearInterval(this.clickTimer); this.clickTimer=null; },
  tick(t,level){ const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain();
    o.frequency.value=[1100,1320,1760][level]; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime([.09,.15,.25][level],t+.002); g.gain.exponentialRampToValueAtTime(.0001,t+.05);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+.06); o.onended=()=>{try{o.disconnect();g.disconnect()}catch(e){}}; },
  stopArp(){ clearInterval(this.arpTimer); this.arpTimer=null;
    // Silence notes that were booked ahead but haven't started, so stopping is immediate
    if(this.ctx){const now=this.ctx.currentTime;
      for(const p of this.pendingShots) if(p.t>now+.003){ p.g.gain.cancelScheduledValues(0); p.g.gain.value=0; p.oscs.forEach(o=>{try{o.stop(now)}catch(e){}}); midiOut.drop(p.midi); }
      this.pendingShots=[];} },
  arpTick(){
    const notes=this.arpNotes(); if(!notes.length||this.arpRate<=0){this.stopArp();return}
    const now=this.ctx.currentTime, step=1/this.arpRate;
    if(this.arpNext<now)this.arpNext=now+.01;       // catch up after the tab was in the background
    while(this.arpNext<now+.1){
      this.shot(this.arpPick(notes,this.arpIdx),this.arpNext,step*.85); this.arpNext+=step; this.arpIdx++;
    }
  },
  shot(m,t,dur){
    // Arpeggio notes: attack is limited to a third of the step; release is capped so fast patterns stay clear
    const {g,oscs}=this.build(m,t),e=env(),peak=.17*midiOut.level(midiOut.lastVel)*lowGain(m);
    const a=Math.min(e.a,dur*.3), end=t+dur, rel=Math.min(e.r,.6);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak,t+a); g.gain.setTargetAtTime(peak*e.s,t+a,Math.max(.01,e.d/3));
    if(this.pedal){ const R=this.ringSec; g.gain.setTargetAtTime(0,end,R/5); oscs.forEach(o=>o.stop(end+R*1.2)); this.sustained.push({g,oscs,end:end+R*1.2}); }
    else { g.gain.setTargetAtTime(0,end,rel/4); oscs.forEach(o=>o.stop(end+rel*1.6+.05)); }
    this.pendingShots=this.pendingShots.filter(p=>p.t>this.ctx.currentTime-.05); this.pendingShots.push({t,g,oscs,midi:midiOut.shot(m,t,dur)});
  },
  setNotes(list,{retrigger=false}={}){
    this.chord=list.slice();
    if(!this.ctx)return;
    // Pressing the same chord again plays it again: the old notes fade out quickly and the attack restarts
    if(retrigger){ for(const m of [...this.voices.keys()]){const v=this.voices.get(m);this.noteOff(m);
      const now=this.ctx.currentTime; v.g.gain.cancelScheduledValues(now); v.g.gain.setValueAtTime(v.g.gain.value,now); v.g.gain.setTargetAtTime(0,now,.025);} }
    const arp=this.arpRate>0&&this.arpNotes().length>0;
    if(arp)list=list.filter(m=>m===st.bassNote);     // only the bass sustains while arpeggiating
    const want=new Set(list), strike=SOUNDS[st.sound].strike;
    // Struck sounds re-strike every note on a change, unless only changed notes should: then notes that stay keep ringing
    for(const m of [...this.voices.keys()]) if(!want.has(m)||(strike&&!st.keepCommon)) this.noteOff(m);
    // Strum: new notes enter low to high, spaced by this.strum seconds
    const fresh=[...want].filter(m=>!this.voices.has(m)); this.strumOrder(fresh,fresh.length>1).forEach((m,i)=>this.noteOn(m,i*this.strum));
    if(arp){ const k=this.arpNotes().join(',');
      if(!this.arpTimer){this.lastArpKey=k;this.startArp();}
      else if(retrigger||(k!==this.lastArpKey&&!st.keepCommon)){this.lastArpKey=k;this.arpRetrigger();} else this.lastArpKey=k; }   // otherwise it carries on with the new notes
    else { this.stopArp(); this.lastArpKey=''; }
  },
  allOff(){for(const m of [...this.voices.keys()])this.noteOff(m)},
  setVolume(v){if(this.ctx)this.master.gain.setTargetAtTime(v,this.ctx.currentTime,.08)},
  setCutoff(hz){if(this.ctx)this.filter.frequency.setTargetAtTime(hz,this.ctx.currentTime,.08)},
};
