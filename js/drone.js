/* ---------- Drone: notes that keep sounding under everything you play, like bagpipe drones ----------
   It sits on the key's root (or each chord's root), glides when that changes, and goes through the same
   filter and effects as the chords. Off until you turn it on; hiding its panel silences it too */
const DRONE_NOTES={root:[0],fifth:[0,7],pipes:[0,12],pipes5:[0,7,12]};   // semitones above the drone's root
// Each oscillator: [wave, detune in cents, frequency ratio, level]
const DRONE_TONES={
  reed:{osc:[['sawtooth',0,1,.45],['square',7,1,.2],['sawtooth',-6,2,.12]],cut:1700,q:1.4},   // buzzy, like a chanter's drones
  organ:{osc:[['sine',0,1,.55],['sine',0,2,.28],['sine',0,4,.08]],cut:6000,q:.5},
  soft:{osc:[['triangle',0,1,.6],['sine',3,2,.1]],cut:1500,q:.4},
  gurdy:{osc:[['sawtooth',0,1,.4],['sawtooth',5,1,.24],['square',0,2,.1]],cut:2300,q:2.2},   // nasal and bright, like a hurdy-gurdy's drone strings
};
// The drone's sound: one of its own, any instrument (yours too), or whatever the Instrument menu has.
// An instrument's oscillators play held (its own fades and envelope are left out), at the drone's usual loudness
function droneTone(){
  const id=drone.tone==='same'?st.sound:drone.tone.startsWith('i:')?drone.tone.slice(2):null;
  if(id===null)return {id:drone.tone,...DRONE_TONES[drone.tone]||DRONE_TONES.reed};
  const s=SOUNDS[id]; if(!s)return {id:'reed',...DRONE_TONES.reed};
  const sum=s.osc.reduce((a,o)=>a+o[3],0)||1;
  return {id:'i:'+id,osc:s.osc.map(([w,det,ratio,lvl])=>[w,det,ratio,lvl*.78/sum]),cut:Math.min(9000,s.cut||3000),q:.6};
}
function droneToneFill(){ const sel=$('droneTone'); if(!sel)return;
  const opt=(v,l)=>`<option value="${v}">${l}</option>`, list=Object.entries(SOUNDS).filter(([k])=>k!=='_draft');
  sel.innerHTML=`<optgroup label="Drone">${opt('reed','Reed (bagpipe)')}${opt('organ','Organ')}${opt('soft','Soft')}${opt('gurdy','Hurdy-gurdy')}</optgroup>`
    +`<optgroup label="Instrument">${opt('same','Same as Instrument')}</optgroup>`
    +`<optgroup label="Any instrument">${list.map(([k,s])=>opt('i:'+k,s.label)).join('')}</optgroup>`;
  sel.value=drone.tone; if(sel.value!==drone.tone)sel.value='reed'; }
const DRONE_DEFAULT=()=>({on:false,notes:'pipes',follow:'key',tone:'reed',oct:2,when:'always',arp:'along',custom:[0,7]});
// Custom notes: any of these steps above the drone's root
const DRONE_STEPS=['1','♭2','2','♭3','3','4','♯4','5','♭6','6','♭7','7'];
const droneStep=off=>DRONE_STEPS[((off%12)+12)%12];
function droneClean(d){ const x=DRONE_DEFAULT(); if(!d||typeof d!=='object')return x;
  return {on:d.on===true,notes:DRONE_NOTES[d.notes]||d.notes==='custom'?d.notes:x.notes,arp:d.arp==='join'?'join':'along',
    custom:Array.isArray(d.custom)?[...new Set(d.custom.filter(n=>Number.isInteger(n)&&n>=-48&&n<=72))].sort((a,b)=>a-b).slice(0,24):x.custom,follow:d.follow==='chord'?'chord':'key',
    tone:DRONE_TONES[d.tone]||d.tone==='same'||/^i:[\w-]+$/.test(d.tone||'')?d.tone:x.tone,oct:[2,3,4].includes(d.oct)?d.oct:x.oct,when:d.when==='chord'?'chord':'always'}; }
let drone=DRONE_DEFAULT();
try{ drone=droneClean(JSON.parse(localStorage.getItem('vh-drone')||'null')); }catch(e){}
const droneSave=()=>{ try{localStorage.setItem('vh-drone',JSON.stringify(drone))}catch(e){} };
const droneCapture=()=>({...drone});
function droneApply(d){ drone=droneClean(d); droneSave(); droneUI(); droneSync(); }

const dr={out:null,filt:null,voices:[],sig:'',notes:'',root:null,stop:null};
const droneGain=()=>effV('drone')*.14;   // at the middle it sits a few dB under the chords, at the top a little over them
// With the chords: only while one is sounding, fading out with the instrument's Release when it stops
// In the arp: while the arpeggiator runs a chord, the drone's notes join it instead of holding underneath
const droneActive=()=>drone.on&&(typeof panelShown!=='function'||panelShown('drone'));
const droneInArp=()=>droneActive()&&drone.arp==='join'&&audio.arpRate>0&&st.sounding;
const droneHeard=()=>(drone.when==='always'||st.sounding)&&!droneInArp();
// Joined to the arp, a short gap between chords (a key let go before the next is pressed) mustn't bring the held drone
// in for a moment: it waits a little, and comes in only if no chord has started by then
function droneFade(now){ let on=droneHeard();
  const inArp=droneInArp(); if(dr.inArp&&!inArp)dr.leftAt=performance.now(); dr.inArp=inArp;   // when the arp last let it go
  if(on&&drone.arp==='join'&&audio.arpRate>0&&performance.now()-(dr.leftAt||0)<450){ on=false; clearTimeout(dr.back); dr.back=setTimeout(droneSync,470); }
  dr.out.gain.setTargetAtTime(on?droneGain():0,now,on?.08:Math.max(.05,env().r/3)); }
// The drone's root: the key's, or the chord's while one is sounding (it stays put through a stop)
function droneNotes(){
  if(drone.follow==='chord'&&st.sounding&&st.degree!==null)dr.root=rootPcOf(st.degree);
  const root=drone.follow==='chord'&&dr.root!==null?dr.root:KEYS[st.key][0];
  dr.base=12*(drone.oct+1)+root;   // the drone's root note: custom notes are counted from here
  const steps=drone.notes==='custom'?(drone.custom.length?drone.custom:[0]):DRONE_NOTES[drone.notes];
  return steps.map(i=>12*(drone.oct+1)+root+i);
}
// The drone notes you can hear right now (held, or stepping through the arpeggio), for the keyboard
const droneShown=()=>droneActive()&&audio.ctx&&(droneHeard()||droneInArp())?droneNotes():[];
/* Buzz: the hurdy-gurdy's buzzing bridge, a rasp over the drone that rattles faster and louder the higher the Buzz dial.
   The dial follows how fast your right hand moves to start, like turning the crank harder. It plays whenever the drone does */
function droneBuzzBuild(c){ const o=c.createOscillator(); o.type='sawtooth';
  const sh=c.createWaveShaper(), cv=new Float32Array(256); for(let i=0;i<256;i++){const x=i/127.5-1; cv[i]=Math.tanh(3*x)} sh.curve=cv;
  const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1300; bp.Q.value=2;
  const am=c.createGain(); am.gain.value=.5; const lfo=c.createOscillator(); lfo.type='square'; const lg=c.createGain(); lg.gain.value=.5; lfo.connect(lg); lg.connect(am.gain);
  const g=c.createGain(); g.gain.value=0; o.connect(sh); sh.connect(bp); bp.connect(am); am.connect(g); g.connect(dr.out);
  if(audio.wobble)audio.wobble.connect(o.detune); o.start(); lfo.start(); dr.buzz={o,lfo,g}; droneBuzzSet(); }
function droneBuzzSet(){ const b=dr.buzz; if(!b||!audio.ctx)return; const v=effV('buzz'), t=audio.ctx.currentTime;
  b.g.gain.setTargetAtTime(Math.pow(v,1.1)*4,t,.04);   // it goes through the drone's quiet output (about 0.05), so it starts big here b.lfo.frequency.setTargetAtTime(6+v*34,t,.05);   // faster crank, quicker rattle
  if(dr.base)b.o.frequency.setTargetAtTime(440*Math.pow(2,(dr.base+12-69)/12),t,.06); }
function droneKill(){ for(const v of dr.voices)for(const o of v.oscs){ try{o.stop();o.disconnect()}catch(e){} } dr.voices=[]; dr.sig=''; dr.notes='';
  if(dr.buzz){ for(const o of [dr.buzz.o,dr.buzz.lfo]){ try{o.stop();o.disconnect()}catch(e){} } try{dr.buzz.g.disconnect()}catch(e){} dr.buzz=null; } }
function droneSync(){
  const c=audio.ctx; if(!c)return;
  const want=droneActive();
  if(!dr.out){ dr.out=c.createGain(); dr.out.gain.value=0; dr.filt=c.createBiquadFilter(); dr.filt.type='lowpass'; dr.filt.connect(dr.out); dr.out.connect(audio.bus); }
  const now=c.currentTime;
  if(!want){ if(dr.voices.length&&!dr.stop){ dr.out.gain.setTargetAtTime(0,now,.25); dr.stop=setTimeout(()=>{dr.stop=null;droneKill()},1500); } return; }
  if(dr.stop){ clearTimeout(dr.stop); dr.stop=null; }
  const T=droneTone(), notes=droneNotes(), sig=T.id+'|'+JSON.stringify(T.osc)+'|'+notes.length, key=notes.join();
  if(sig!==dr.sig){ droneKill();   // a new sound or number of notes: build them fresh
    dr.filt.frequency.value=T.cut; dr.filt.Q.value=T.q;
    droneBuzzBuild(c);
    // Low drone notes get the same lift as the chords' (the Low notes dial): louder, plus overtones small speakers can play
    dr.voices=notes.map(m=>{ const f=440*Math.pow(2,(m-69)/12), lo=lowBelow(m), boost=lowAmt(), sum=T.osc.reduce((a,x)=>a+x[3],0), lift=lowGain(m);
      const osc=lo>0&&boost>.01?[...T.osc,...LOW_OT.map(([r,k])=>['sine',0,r,boost*k*lo*sum])]:T.osc;
      return {oscs:osc.map(([w,det,ratio,lvl])=>{ const o=c.createOscillator(), g=c.createGain(); o.type=w; o.frequency.value=f*ratio; o.detune.value=det;
        o._ratio=ratio; g.gain.value=lvl*lift; o.connect(g); g.connect(dr.filt); if(audio.wobble)audio.wobble.connect(o.detune); o.start(); return o; })}; });
    dr.sig=sig; dr.notes=key; if(droneHeard())dr.out.gain.setTargetAtTime(droneGain(),now,.35); return; }
  if(key!==dr.notes){ dr.notes=key;   // same sound, new root: glide there
    notes.forEach((m,i)=>{ const f=440*Math.pow(2,(m-69)/12); for(const o of dr.voices[i].oscs)o.frequency.setTargetAtTime(f*o._ratio,now,.06); }); droneBuzzSet(); }
  droneFade(now);
}
function droneLevel(){ if(audio.ctx&&dr.out&&dr.voices.length&&!dr.stop&&droneHeard())dr.out.gain.setTargetAtTime(droneGain(),audio.ctx.currentTime,.05); }

/* Panel */
// Custom notes are picked on a small keyboard, the same range as the one at the top. Each chosen key is kept as a
// distance from the drone's root, so the set moves with the key (or chord) and with Octave
function droneSteps(){ $('droneCustom').hidden=drone.notes!=='custom'; dronePick(); }
function dronePick(){
  const box=$('dronePick'); if(drone.notes!=='custom'||!$('droneCustom').open){ return; }
  droneNotes(); const base=dr.base, sel=new Set(drone.custom.map(o=>base+o)), W=14,H=62,BW=9,BH=38;
  const xs={}; let wi=0; for(let m=LO;m<=HI;m++){ if(!isBlack(m)){xs[m]=wi*W;wi++} else xs[m]=wi*W-BW/2; }
  let s=`<svg viewBox="0 0 ${wi*W} ${H+2}" role="group" aria-label="Drone notes: tap keys to add or remove them">`;
  const key=(m,black)=>{ const on=sel.has(m), x=xs[m], w=black?BW:W, h=black?BH:H, off=m-base;
    const fill=on?'var(--drone)':black?'var(--key-black)':'var(--key-white)';
    return `<rect class="dkey" data-m="${m}" x="${x+.5}" y=".5" width="${w-1}" height="${h}" rx="2" fill="${fill}" stroke="var(--line)"><title>${pcName(m)}${Math.floor(m/12)-1} · ${droneStep(off)}${off===0?' (root)':''}</title></rect>`
      +(on?`<text x="${x+w/2}" y="${h-(black?6:8)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="${black?6:7}" fill="#16110e" pointer-events="none">${droneStep(off)}</text>`:'')
      +(!on&&!black&&m===base?`<circle cx="${x+w/2}" cy="${h-8}" r="2.5" fill="var(--drone)" pointer-events="none"/>`:''); };
  for(let m=LO;m<=HI;m++)if(!isBlack(m))s+=key(m,false);
  for(let m=LO;m<=HI;m++)if(isBlack(m))s+=key(m,true);
  const scrolled=box.scrollLeft; box.innerHTML=s+'</svg>';
  // On a narrow screen, start with the drone's root in view (then leave the scroll where you put it)
  if(!dronePick.seen&&box.scrollWidth>box.clientWidth){ dronePick.seen=true; box.scrollLeft=Math.max(0,xs[base]/(wi*W)*box.scrollWidth-40); } else box.scrollLeft=scrolled;
  $('dronePickNote').textContent=drone.custom.length?`${drone.custom.length} note${drone.custom.length>1?'s':''}: ${drone.custom.map(o=>pcName(base+o)+(Math.floor((base+o)/12)-1)).join(' ')}`:'None picked: the root plays';
}
function droneUI(){ droneToneFill(); $('droneArp').value=drone.arp; droneSteps(); $('droneOn').checked=drone.on; $('droneNotes').value=drone.notes; $('droneFollow').value=drone.follow; $('droneTone').value=drone.tone; $('droneOct').value=String(drone.oct); $('droneWhen').value=drone.when; }
$('droneOn').addEventListener('change',e=>{ audio.init(); drone.on=e.target.checked; droneSave(); droneSync(); });
$('droneNotes').addEventListener('change',e=>{ drone.notes=e.target.value; droneSteps(); droneSave(); droneSync(); });
$('droneArp').addEventListener('change',e=>{ drone.arp=e.target.value; droneSave(); droneSync(); });
// Custom: a toggle per step above the root
$('dronePick').addEventListener('click',e=>{ const k=e.target.closest('.dkey'); if(!k)return; droneNotes();
  const n=+k.dataset.m-dr.base, i=drone.custom.indexOf(n);
  if(i>=0)drone.custom.splice(i,1); else if(drone.custom.length<24){ drone.custom.push(n); drone.custom.sort((a,c)=>a-c); }
  dronePick(); droneSave(); droneSync(); });
$('droneCustom').addEventListener('toggle',dronePick);
$('droneClear').addEventListener('click',()=>{ drone.custom=[]; dronePick(); droneSave(); droneSync(); });
$('droneFollow').addEventListener('change',e=>{ drone.follow=e.target.value; dr.root=null; droneSave(); droneSync(); });
$('droneTone').addEventListener('change',e=>{ drone.tone=e.target.value; droneSave(); droneSync(); });
$('droneOct').addEventListener('change',e=>{ drone.oct=+e.target.value; droneSave(); droneSync(); });
$('droneWhen').addEventListener('change',e=>{ drone.when=e.target.value; droneSave(); droneSync(); });
droneUI();
// Every redraw (a new chord, a key change, sound starting up) checks whether the drone should move
{ const r0=render; render=function(){ r0.apply(this,arguments); droneSync(); }; }
// When the drone's notes change (turned on or off, a new key, fading with the chords) the keyboard follows
{ const s0=droneSync; droneSync=function(){ s0(); if(drone.notes==='custom'&&(droneNotes(),dr.base!==dronePick.base)){ dronePick.base=dr.base; dronePick(); } if(typeof drawPiano==='function'&&droneShown().join()!==(drawPiano.drone||''))drawPiano(); }; }
// The arpeggio takes the drone's notes while it runs (when set to), and turning it on or off moves the drone in or out
{ const n0=audio.arpNotes.bind(audio); audio.arpNotes=()=>{ const ns=n0(); if(!ns.length||!droneInArp())return ns;
    return [...new Set([...ns,...droneNotes()])].sort((a,b)=>a-b); };
  // A new chord starts its arpeggio on one of its own notes, not the drone's, so the drone doesn't sound on every change.
  // With Strum on, the whole set (drone included) is strummed together, as before
  audio.arpSkip=m=>droneInArp()&&droneNotes().includes(m)&&!n0().includes(m);   // n0: the chord's own arp notes
  const s0=audio.setArpRate.bind(audio); audio.setArpRate=nps=>{ s0(nps); droneSync(); }; }
