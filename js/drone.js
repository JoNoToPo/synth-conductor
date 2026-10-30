/* ---------- Drone: notes that keep sounding under everything you play, like bagpipe drones ----------
   It sits on the key's root (or each chord's root), glides when that changes, and goes through the same
   filter and effects as the chords. Off until you turn it on; hiding its panel silences it too */
const DRONE_NOTES={root:[0],fifth:[0,7],pipes:[0,12],pipes5:[0,7,12]};   // semitones above the drone's root
// Each oscillator: [wave, detune in cents, frequency ratio, level]
const DRONE_TONES={
  reed:{osc:[['sawtooth',0,1,.45],['square',7,1,.2],['sawtooth',-6,2,.12]],cut:1700,q:1.4},   // buzzy, like a chanter's drones
  organ:{osc:[['sine',0,1,.55],['sine',0,2,.28],['sine',0,4,.08]],cut:6000,q:.5},
  soft:{osc:[['triangle',0,1,.6],['sine',3,2,.1]],cut:1500,q:.4},
};
const DRONE_DEFAULT=()=>({on:false,notes:'pipes',follow:'key',tone:'reed',oct:2,when:'always',arp:'along',custom:[0,7]});
// Custom notes: any of these steps above the drone's root
const DRONE_STEPS=['1','♭2','2','♭3','3','4','♯4','5','♭6','6','♭7','7','8'];
function droneClean(d){ const x=DRONE_DEFAULT(); if(!d||typeof d!=='object')return x;
  return {on:d.on===true,notes:DRONE_NOTES[d.notes]||d.notes==='custom'?d.notes:x.notes,arp:d.arp==='join'?'join':'along',
    custom:Array.isArray(d.custom)?[...new Set(d.custom.filter(n=>Number.isInteger(n)&&n>=0&&n<=12))].sort((a,b)=>a-b):x.custom,follow:d.follow==='chord'?'chord':'key',
    tone:DRONE_TONES[d.tone]?d.tone:x.tone,oct:[2,3,4].includes(d.oct)?d.oct:x.oct,when:d.when==='chord'?'chord':'always'}; }
let drone=DRONE_DEFAULT();
try{ drone=droneClean(JSON.parse(localStorage.getItem('vh-drone')||'null')); }catch(e){}
const droneSave=()=>{ try{localStorage.setItem('vh-drone',JSON.stringify(drone))}catch(e){} };
const droneCapture=()=>({...drone});
function droneApply(d){ drone=droneClean(d); droneSave(); droneUI(); droneSync(); }

const dr={out:null,filt:null,voices:[],sig:'',notes:'',root:null,stop:null};
const droneGain=()=>effV('drone')*.09;
// With the chords: only while one is sounding, fading out with the instrument's Release when it stops
// In the arp: while the arpeggiator runs a chord, the drone's notes join it instead of holding underneath
const droneActive=()=>drone.on&&(typeof panelShown!=='function'||panelShown('drone'));
const droneInArp=()=>droneActive()&&drone.arp==='join'&&audio.arpRate>0&&st.sounding;
const droneHeard=()=>(drone.when==='always'||st.sounding)&&!droneInArp();
function droneFade(now){ const on=droneHeard(); dr.out.gain.setTargetAtTime(on?droneGain():0,now,on?.08:Math.max(.05,env().r/3)); }
// The drone's root: the key's, or the chord's while one is sounding (it stays put through a stop)
function droneNotes(){
  if(drone.follow==='chord'&&st.sounding&&st.degree!==null)dr.root=rootPcOf(st.degree);
  const root=drone.follow==='chord'&&dr.root!==null?dr.root:KEYS[st.key][0];
  const steps=drone.notes==='custom'?(drone.custom.length?drone.custom:[0]):DRONE_NOTES[drone.notes];
  return steps.map(i=>12*(drone.oct+1)+root+i);
}
// The drone notes you can hear right now (held, or stepping through the arpeggio), for the keyboard
const droneShown=()=>droneActive()&&audio.ctx&&(droneHeard()||droneInArp())?droneNotes():[];
function droneKill(){ for(const v of dr.voices)for(const o of v.oscs){ try{o.stop();o.disconnect()}catch(e){} } dr.voices=[]; dr.sig=''; dr.notes=''; }
function droneSync(){
  const c=audio.ctx; if(!c)return;
  const want=droneActive();
  if(!dr.out){ dr.out=c.createGain(); dr.out.gain.value=0; dr.filt=c.createBiquadFilter(); dr.filt.type='lowpass'; dr.filt.connect(dr.out); dr.out.connect(audio.bus); }
  const now=c.currentTime;
  if(!want){ if(dr.voices.length&&!dr.stop){ dr.out.gain.setTargetAtTime(0,now,.25); dr.stop=setTimeout(()=>{dr.stop=null;droneKill()},1500); } return; }
  if(dr.stop){ clearTimeout(dr.stop); dr.stop=null; }
  const T=DRONE_TONES[drone.tone], notes=droneNotes(), sig=drone.tone+'|'+notes.length, key=notes.join();
  if(sig!==dr.sig){ droneKill();   // a new sound or number of notes: build them fresh
    dr.filt.frequency.value=T.cut; dr.filt.Q.value=T.q;
    dr.voices=notes.map(m=>{ const f=440*Math.pow(2,(m-69)/12);
      return {oscs:T.osc.map(([w,det,ratio,lvl])=>{ const o=c.createOscillator(), g=c.createGain(); o.type=w; o.frequency.value=f*ratio; o.detune.value=det;
        o._ratio=ratio; g.gain.value=lvl; o.connect(g); g.connect(dr.filt); o.start(); return o; })}; });
    dr.sig=sig; dr.notes=key; if(droneHeard())dr.out.gain.setTargetAtTime(droneGain(),now,.35); return; }
  if(key!==dr.notes){ dr.notes=key;   // same sound, new root: glide there
    notes.forEach((m,i)=>{ const f=440*Math.pow(2,(m-69)/12); for(const o of dr.voices[i].oscs)o.frequency.setTargetAtTime(f*o._ratio,now,.06); }); }
  droneFade(now);
}
function droneLevel(){ if(audio.ctx&&dr.out&&dr.voices.length&&!dr.stop&&droneHeard())dr.out.gain.setTargetAtTime(droneGain(),audio.ctx.currentTime,.05); }

/* Panel */
function droneSteps(){ const box=$('droneCustom'); box.hidden=drone.notes!=='custom';
  box.querySelectorAll('button').forEach(b=>{ const on=drone.custom.includes(+b.dataset.n); b.classList.toggle('on',on); b.setAttribute('aria-pressed',on); }); }
function droneUI(){ $('droneArp').value=drone.arp; droneSteps(); $('droneOn').checked=drone.on; $('droneNotes').value=drone.notes; $('droneFollow').value=drone.follow; $('droneTone').value=drone.tone; $('droneOct').value=String(drone.oct); $('droneWhen').value=drone.when; }
$('droneOn').addEventListener('change',e=>{ audio.init(); drone.on=e.target.checked; droneSave(); droneSync(); });
$('droneNotes').addEventListener('change',e=>{ drone.notes=e.target.value; droneSteps(); droneSave(); droneSync(); });
$('droneArp').addEventListener('change',e=>{ drone.arp=e.target.value; droneSave(); droneSync(); });
// Custom: a toggle per step above the root
$('droneCustom').innerHTML=DRONE_STEPS.map((l,n)=>`<button type="button" class="dstep" data-n="${n}" aria-pressed="false" title="${n===12?'Octave':l} above the drone's root">${l}</button>`).join('');
$('droneCustom').addEventListener('click',e=>{ const b=e.target.closest('.dstep'); if(!b)return; const n=+b.dataset.n, i=drone.custom.indexOf(n);
  if(i>=0)drone.custom.splice(i,1); else { drone.custom.push(n); drone.custom.sort((a,c)=>a-c); }
  droneSteps(); droneSave(); droneSync(); });
$('droneFollow').addEventListener('change',e=>{ drone.follow=e.target.value; dr.root=null; droneSave(); droneSync(); });
$('droneTone').addEventListener('change',e=>{ drone.tone=e.target.value; droneSave(); droneSync(); });
$('droneOct').addEventListener('change',e=>{ drone.oct=+e.target.value; droneSave(); droneSync(); });
$('droneWhen').addEventListener('change',e=>{ drone.when=e.target.value; droneSave(); droneSync(); });
droneUI();
// Every redraw (a new chord, a key change, sound starting up) checks whether the drone should move
{ const r0=render; render=function(){ r0.apply(this,arguments); droneSync(); }; }
// When the drone's notes change (turned on or off, a new key, fading with the chords) the keyboard follows
{ const s0=droneSync; droneSync=function(){ s0(); if(typeof drawPiano==='function'&&droneShown().join()!==(drawPiano.drone||''))drawPiano(); }; }
// The arpeggio takes the drone's notes while it runs (when set to), and turning it on or off moves the drone in or out
{ const n0=audio.arpNotes.bind(audio); audio.arpNotes=()=>{ const ns=n0(); if(!ns.length||!droneInArp())return ns;
    return [...new Set([...ns,...droneNotes()])].sort((a,b)=>a-b); };
  const s0=audio.setArpRate.bind(audio); audio.setArpRate=nps=>{ s0(nps); droneSync(); }; }
