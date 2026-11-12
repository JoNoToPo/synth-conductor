/* ---------- Bass: the bass note as its own part ----------
   Folded to Less it's the plain bass of before: the chord's lowest note, held, in the instrument's sound.
   Opened (More), this module plays the bass itself: which note (root, 5th, 3rd, or whatever Inversion picks),
   a pattern on the beat grid (held, every beat, root–5th, octave bounce), its own sound and level.
   The chord voices never play the bass note while the module has it. MIDI keeps using the bass channel */
const BASS_NOTES={inv:'Follows Inversion',root:'Root',fifth:'5th',third:'3rd'};
const BASS_PATTERNS={held:{label:'Held'},beat:{step:1,label:'Every beat'},rootfifth:{step:1,label:'Root – 5th'},octave:{step:.5,label:'Octave bounce'}};
// Each sound: oscillators [wave, frequency ratio, level, detune], a lowpass (cut, q, and for a pluck where it starts), and its envelope
const BASS_TONES={
  sub:{osc:[['sine',1,.8],['triangle',2,.12]],cut:900,q:.5,env:{a:.006,d:.3,s:.85,r:.14}},
  pluck:{osc:[['sawtooth',1,.5],['square',1,.18]],cut:350,q:3,from:2600,env:{a:.003,d:.55,s:0,r:.1}},   // the filter closes as the note dies, like a plucked string
  synth:{osc:[['sawtooth',1,.38,-7],['sawtooth',1,.38,7],['square',.5,.2]],cut:1100,q:5,env:{a:.005,d:.25,s:.6,r:.12}},
};
const BASS_DEFAULT=()=>({note:'inv',pattern:'held',sound:'same'});
let bassCfg=BASS_DEFAULT();
function bassClean(d){ const x=BASS_DEFAULT(); if(!d||typeof d!=='object')return x;
  return {note:BASS_NOTES[d.note]?d.note:x.note,pattern:BASS_PATTERNS[d.pattern]?d.pattern:x.pattern,sound:d.sound==='same'||BASS_TONES[d.sound]?d.sound:x.sound}; }
try{ bassCfg=bassClean(JSON.parse(localStorage.getItem('vh-bassmod')||'null')); }catch(e){}
const bassSave=()=>{ try{localStorage.setItem('vh-bassmod',JSON.stringify(bassCfg))}catch(e){} };
const bassCapture=()=>({...bassCfg});
function bassApply(d){ bassCfg=bassClean(d); bassSave(); bassUI(); bassRestart(); }

// The module has the bass while its panel is open (More); folded, the chord plays it as before
const bassOwn=()=>typeof panelShown==='function'&&panelShown('bass');
// Which note is in the bass: realize() asks this in place of the inversion's own
function bassNoteIv(d,c){ if(!bassOwn()||bassCfg.note==='inv')return bassInterval(d,c);
  return bassCfg.note==='fifth'?c.f%12:bassCfg.note==='third'?c.t%12:0; }

const bs={held:null,heldM:null,key:'',timer:null,next:0,booked:[]};
// One bass note starting at t. dur: a pattern note's length; without it the note holds until bassRelease
function bassNote(m,t,dur){
  const c=audio.ctx, T=BASS_TONES[bassCfg.sound], vel=midiOut.velocity(), lvl=effV('basslvl')*2;
  let g, oscs, e;
  if(!T){ ({g,oscs}=audio.build(m,t)); e=env(); }   // the instrument's own oscillators, low-note lift included
  else { e=T.env; g=c.createGain(); g.gain.value=0; g.connect(audio.voiceBus);
    const f=c.createBiquadFilter(); f.type='lowpass'; f.Q.value=T.q; f.connect(g);
    if(T.from){ f.frequency.setValueAtTime(T.from,t); f.frequency.setTargetAtTime(T.cut,t,.12); } else f.frequency.value=T.cut;
    // The same overtones the chords get on low notes (Low notes dial), so small speakers can play the bass
    const sum=T.osc.reduce((a,x)=>a+x[2],0), lo=lowBelow(m), boost=lowAmt();
    const list=lo>0&&boost>.01?[...T.osc,...LOW_OT.map(([r,k])=>['sine',r,boost*k*lo*sum])]:T.osc;
    const freq=440*Math.pow(2,(m-69)/12);
    oscs=list.map(([w,r,l,det])=>{ const o=c.createOscillator(), og=c.createGain(); o.type=w; o.frequency.value=freq*r; if(det)o.detune.value=det;
      if(audio.bend)audio.bend.connect(o.detune); og.gain.value=l; o.connect(og); og.connect(f); o.start(t);
      o.onended=()=>{ try{audio.bend&&audio.bend.disconnect(o.detune)}catch(err){} try{o.disconnect();og.disconnect()}catch(err){} }; return o; });
    oscs[0].addEventListener('ended',()=>{ try{f.disconnect();g.disconnect()}catch(err){} }); }
  const peak=.16*midiOut.level(vel)*lowGain(m)*lvl, a=dur?Math.min(e.a,dur*.3):e.a;
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak,t+a); g.gain.setTargetAtTime(peak*e.s,t+a,Math.max(.01,e.d/3));
  const v={g,oscs,t,e,m};
  if(dur){ const r=Math.min(e.r,.5), end=t+dur; g.gain.setTargetAtTime(0,end,r/4); oscs.forEach(o=>{try{o.stop(end+r*1.6+.05)}catch(err){}});
    const h=midiOut.shot(m,t,dur); if(h&&midiOut.bassCh!==null)h.ch=midiOut.bassCh; v.midi=h; }
  else midiOut.on(m,t,vel);
  return v;
}
function bassRelease(v,quick){ if(!v)return; const now=audio.ctx.currentTime, t=Math.max(now,v.t);
  const r=quick?.04:audio.pedal?audio.ringSec:v.e.r;
  v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value,t); v.g.gain.setTargetAtTime(0,t,r/(audio.pedal&&!quick?5:4));
  v.oscs.forEach(o=>{try{o.stop(t+r*1.6+.05)}catch(e){}}); if(!v.midi)midiOut.off(v.m); }
// Notes booked ahead for the old chord are dropped when the chord changes
function bassDropBooked(){ const now=audio.ctx.currentTime;
  for(const v of bs.booked) if(v.t>now+.003){ v.g.gain.cancelScheduledValues(0); v.g.gain.value=0; v.oscs.forEach(o=>{try{o.stop(now)}catch(e){}}); midiOut.drop(v.midi); }
  bs.booked=bs.booked.filter(v=>v.t<=now+.003); }
// The note for step k of the pattern: the bass note, or its partner (the 5th below the root, the root below a 5th or 3rd, the octave up)
function bassStepNote(k){ const m=st.bassNote, P=bassCfg.pattern; if(k%2===0||P==='beat')return m;
  if(P==='octave')return m+12;
  const rootPc=rootPcOf(st.degree); let p;
  if(((m-rootPc)%12+12)%12===0){ p=m-5; if(p<28)p=m+7; }
  else { p=m-((m-rootPc)%12+12)%12; if(p<28)p+=12; }
  return p; }
const bassPlaying=()=>bassOwn()&&audio.ctx&&st.sounding&&st.degree!==null&&st.bassNote!==null;
function bassTick(){ const c=audio.ctx, P=BASS_PATTERNS[bassCfg.pattern]; if(!c||!P.step)return;
  const step=beatSec()*P.step;
  if(!bs.next||bs.next<c.currentTime-.05)bs.next=audio.t0+Math.ceil((c.currentTime+.03-audio.t0)/step)*step;
  while(bs.next<c.currentTime+.12){ const t=bs.next, k=Math.round((t-audio.t0)/step);
    if(bassPlaying()){ bs.booked=bs.booked.filter(v=>v.t>c.currentTime-1); bs.booked.push(bassNote(bassStepNote(k),t,step*.85)); }
    bs.next+=step; } }
// Every redraw checks whether the chord (or its bass note) changed
function bassSync(){
  if(!audio.ctx)return;
  const key=bassPlaying()?st.chordSeq+'|'+st.bassNote+'|'+bassCfg.pattern+'|'+bassCfg.sound:'';
  const pat=bassPlaying()&&!!BASS_PATTERNS[bassCfg.pattern].step;
  if(pat&&!bs.timer){ bs.next=0; bs.timer=setInterval(bassTick,16); } else if(!pat&&bs.timer){ clearInterval(bs.timer); bs.timer=null; }
  if(key===bs.key)return; bs.key=key;
  bassRelease(bs.held); bs.held=null; bassDropBooked();
  if(!key)return;
  const now=audio.ctx.currentTime+.005;
  if(!pat){ bs.held=bassNote(st.bassNote,now); return; }
  // A pattern: the new chord's bass sounds right away, unless a step is about to play it anyway
  const step=beatSec()*BASS_PATTERNS[bassCfg.pattern].step;
  if(!(bs.next&&bs.next-now<.08&&bs.next>=now)){ bs.booked.push(bassNote(st.bassNote,now,Math.max(.1,(bs.next>now?bs.next-now:step)*.9))); }
}
function bassRestart(){ bs.key='__'; if(audio.ctx){ bassRelease(bs.held,true); bs.held=null; bassDropBooked(); } bassSync(); }
// Opening or folding the panel hands the bass between the chord and this module: the sounding chord is played again without a gap
function bassPanelChanged(){ const own=bassOwn(); if(own===bs.own)return; bs.own=own;
  if(!audio.ctx)return; if(st.sounding&&st.degree!==null){ const r=realize(st.degree); st.bassNote=r.bass;
    audio.setNotes(r.bass!==null?[r.bass,...st.upper]:st.upper.slice()); }
  bassRestart(); if(typeof render==='function')render(); }

/* Panel */
function bassUI(){ $('bassNoteSel').value=bassCfg.note; $('bassPattern').value=bassCfg.pattern; $('bassSound').value=bassCfg.sound; }
$('bassNoteSel').addEventListener('change',e=>{ bassCfg.note=e.target.value; bassSave(); refreshAfterChange(); });
$('bassPattern').addEventListener('change',e=>{ audio.init(); bassCfg.pattern=e.target.value; bassSave(); bassRestart(); });
$('bassSound').addEventListener('change',e=>{ audio.init(); bassCfg.sound=e.target.value; bassSave(); bassRestart(); });
bassUI(); bs.own=bassOwn();
{ const r0=render; render=function(){ r0.apply(this,arguments); bassSync(); }; }
