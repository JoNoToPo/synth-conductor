/* ---------- State ---------- */
const st={pedalHand:'off',key:0,degree:1,voicing:'drop2',s7:true,bass:true,vl:true,rh:true,flip:false,alt7:false,pure:false,fast:false,leftTwist:'flip',sevForce:null,leanDeg:0,left67:'chinese',handInv:true,shiftKey:null,shiftPalm:null,palmShift:'flat',shiftQual:'common',posMove:false,posSrcMem:'lx',sevMode:'maj',mode:'ionian',rightOnly:true,invBase:0,invKey:null,invHand:null,sound:'pad',
  rhMap:RH_DEFAULT.slice(),upper:[],bassNote:null,moved:null,history:[],sounding:false};
try{const m=localStorage.getItem('vh-sevmode');if(['maj','diatonic','twist','twistE'].includes(m))st.sevMode=m}catch(e){}
try{const m=localStorage.getItem('vh-mode');if(MODES[m])st.mode=m;
  const r=localStorage.getItem('vh-rightonly');if(r!==null)st.rightOnly=r==='1';}catch(e){}
SCALE=MODES[st.mode].steps;
try{let saved=JSON.parse(localStorage.getItem('vh-rhmap')||'null');
  if(Array.isArray(saved))saved=saved.map(id=>id==='add2'?'six':id);
  if(Array.isArray(saved)&&saved.every(id=>VOICINGS.some(v=>v.id===id))){
    if(saved.length===4)st.rhMap=['close',...saved];      // older 1–4 layout
    else if(saved.length===5)st.rhMap=saved;
  }}catch(e){}

function realize(d){
  const c=tonesOf(d), v=VOICINGS.find(x=>x.id===voicingNow());
  let shapes=v.shapes(c,has7(),d);
  if(addNine()) shapes=shapes.map(sh=>{
    if(sh.some(i=>((i-c.n)%12+12)%12===0))return sh;      // already has a 9th/2nd
    let x=c.n%12; while(x<sh[sh.length-1])x+=12;           // put the 9th on top
    return [...sh,x];
  });
  const rootPc=rootPcOf(d), base=48+rootPc, P=posTarget();
  const cands=[];
  // With Position on, allow a wider range so the chord can travel up and down the keyboard
  const lo=P===null?47:36, hi=P===null?86:98, kr=P===null?2:3;
  shapes.forEach((sh,si)=>{for(let k=-kr;k<=kr;k++){const notes=sh.map(i=>base+i+12*k);
    if(notes[0]<lo||notes[notes.length-1]>hi)continue;cands.push({notes,si})}});
  if(!cands.length)cands.push({notes:shapes[0].map(i=>base+i),si:0});
  // Inversion: which chord tone is lowest
  const bassIv=bassInterval(d,c), bassPc=(rootPc+bassIv)%12;
  if(!st.bass&&bassIv!==0){
    const inv=cands.filter(cd=>((cd.notes[0]%12)+12)%12===bassPc);
    if(inv.length){cands.length=0;cands.push(...inv)}
    else { // no shape starts on that tone: drop the voicing's copy of it below everything else
      for(const cd of cands){const i=cd.notes.findIndex(m=>m%12===bassPc);
        if(i>0){const m=cd.notes.splice(i,1)[0];let low=m;while(low>cd.notes[0])low-=12;cd.notes.unshift(low)}}
    }
  }
  const cen=n=>n.reduce((a,b)=>a+b,0)/n.length;
  let pick;
  const prev=st.upper;
  if(P!==null){
    // Position on: stay near the hand's target. Smooth voice leading still matters between chords,
    // but while you're sliding the position it follows the hand directly.
    let best=Infinity;
    for(const cd of cands){
      const away=Math.abs(cen(cd.notes)-P);
      const cost=st.vl&&prev.length&&!st.posMove?vlCost(prev,cd.notes)+0.5*away:away+(!st.vl&&cd.si?0.5:0);
      if(cost<best){best=cost;pick=cd}}
  } else if(st.vl&&prev.length){
    let best=Infinity;
    for(const cd of cands){const cost=vlCost(prev,cd.notes)+0.12*Math.abs(cen(cd.notes)-64);if(cost<best){best=cost;pick=cd}}
  } else {
    const pool=cands.filter(x=>x.si===0); const list=pool.length?pool:cands;
    pick=list.reduce((a,b)=>Math.abs(cen(b.notes)-63)<Math.abs(cen(a.notes)-63)?b:a);
  }
  let bass=null;
  if(st.bass){
    if(P===null) bass=36+bassPc;
    else { // bass follows the chord: just below the lowest voicing note
      let m=pick.notes[0]-3; while(((m-bassPc)%12+12)%12)m--;
      while(m>55)m-=12; while(m<28)m+=12; bass=m;
    }
  }
  return {upper:pick.notes, bass, rootPc};
}
// Chord position: knob 0 = off (old automatic placement); otherwise the chord centres between C3 and C6
const posTarget=()=>{const v=st.ctrl?.position?.v??0;return v<.03?null:48+v*36};
let posTimer=null,posLastApplied=null,posLastTime=0;
function setPosition(v){
  const c=st.ctrl.position;
  if(v<.03&&c.src!=='none'){st.posSrcMem=c.src+(c.inv?':i':'');c.src='none';c.inv=false} // turned all the way down by hand
  const P=posTarget();
  const move=()=>{ const p=posTarget(); posLastApplied=p; posLastTime=performance.now();
    st.posMove=true; if(st.sounding&&st.degree!==null)play(st.degree,{fromVoicingChange:true}); else preview(); st.posMove=false; };
  // Waiting for the beat: the chord moves once, to wherever Position is when the step comes
  const go=()=>{ posTimer=null; if(positionWaits()){ if(posQ.timer===null)posQ.timer=setTimeout(()=>{posQ.timer=null;move()},gridDelay()); return; } move(); };
  if(posLastApplied===null||P===null||Math.abs(P-posLastApplied)>=1.5){
    clearTimeout(posTimer);
    const wait=Math.max(0,90-(performance.now()-posLastTime)); // at most ~11 re-voicings a second
    if(wait===0)go(); else posTimer=setTimeout(go,wait);
  }
  const led=document.getElementById('optPos'); if(led)led.checked=P!==null;
}
// Semitones above the root for the current bass setting. Sus chords use their sus note in place of the 3rd;
// 3rd inversion falls back to root position when the chord has no 7th.
function effInv(){ return st.loopOv?st.loopOv.inv:(st.invKey??st.invHand??st.invBase); }
function bassInterval(d,c=tonesOf(d)){
  const inv=effInv();
  if(inv===1) return voicingNow()==='sus4'?5:voicingNow()==='sus2'?c.n%12:c.t%12;
  if(inv===2) return c.f%12;
  if(inv===3) return has7()?c.s%12:0;
  return 0;
}
function setInvSource(src,val){
  const before=effInv();
  if(src==='key')st.invKey=val; else if(src==='hand')st.invHand=val; else st.invBase=val;
  if(effInv()!==before)refreshAfterChange();
}
function vlCost(a,b){
  let s=0;for(const x of b)s+=Math.min(...a.map(y=>Math.abs(x-y)));
  for(const y of a)s+=Math.min(...b.map(x=>Math.abs(x-y)));return s/2;
}
function moved(a,b){if(!a.length)return null;let s=0;for(const x of b)s+=Math.min(...a.map(y=>Math.abs(x-y)));return s}

// Chord changes can wait for the next step of the beat grid, so you queue a chord and it lands on time.
// st.quant is that step in beats (0 = right away). The loop, voicing changes and Stop/Space never wait
const chordQ={d:undefined,o:null,timer:null};
const quantOn=()=>st.quant>0&&audio.ctx&&audio.ctx.state==='running';
const quantBeats=()=>st.quant===4?meterOf().bar:st.quant===2?meterOf().bar/2:st.quant;   // "bar" and "half bar" follow the meter
// Where we are between steps: seconds since the last one and until the next
function gridPos(){ const step=beatSec()*quantBeats(), k=(audio.ctx.currentTime-audio.t0)/step, since=(k-Math.floor(k))*step; return {step,since,until:step-since}; }
const gridDelay=()=>Math.max(0,gridPos().until*1000-6);   // ms to the next step
// Just past a step (a fifth of it, at most 120 ms): a change that's only a little late plays straight away instead of waiting a whole step
const gridGrace=()=>{ const p=gridPos(); return p.since<Math.min(.12,p.step*.2); };
function play(d,o={}){
  if(o.now||o.fromLoop||o.fromVoicingChange||!quantOn()){ if(o.now&&!o.queued)chordCancel(); return timed('building the chord',()=>playCore(d,o)); }
  // Already what's sounding and nothing to restart: no need to wait, and anything queued is called off
  const already=d===null?!st.sounding:d===st.degree&&st.sounding;
  if(already&&!o.retrigger){ if(chordQ.timer!==null){ clearTimeout(chordQ.timer); chordQ.timer=null; chordQ.d=undefined; chordQ.o=null; render(); return; }
    if(d!==null)return timed('building the chord',()=>playCore(d,o)); return; }
  if(gridGrace()){ if(chordQ.timer!==null){ clearTimeout(chordQ.timer); chordQ.timer=null; chordQ.d=undefined; chordQ.o=null; } return timed('building the chord',()=>playCore(d,o)); }
  chordQ.d=d; chordQ.o=o; clearTimeout(chordQ.timer);
  const ms=gridDelay();
  chordQ.timer=setTimeout(()=>{ const q=chordQ.d, qo=chordQ.o; chordQ.d=undefined; chordQ.o=null; chordQ.timer=null;
    play(q,{...qo,now:true,queued:true,retrigger:qo.retrigger||(q!==null&&q===st.degree&&st.sounding)}); },ms);
  render();
}
function chordCancel(){ if(chordQ.timer!==null){ clearTimeout(chordQ.timer); chordQ.timer=null; chordQ.d=undefined; chordQ.o=null; }
  if(voiceQ.timer!==null){ clearTimeout(voiceQ.timer); voiceQ.timer=null; voiceQ.id=null; } if(posQ.timer!==null){ clearTimeout(posQ.timer); posQ.timer=null; } render(); }
// Voicing and Position can wait for the beat too (each a switch, only while chord changes wait).
// Only while a chord is sounding: with nothing playing there's nothing to land on time
const voiceQ={id:null,timer:null}, posQ={timer:null};
const voicingWaits=()=>st.quantVoicing&&quantOn()&&st.sounding&&!gridGrace(), positionWaits=()=>st.quantPos&&quantOn()&&st.sounding&&!gridGrace();
try{ const v=JSON.parse(localStorage.getItem('vh-quantvp')||'{}'); st.quantVoicing=v.v===true; st.quantPos=v.p===true; }catch(e){ st.quantVoicing=st.quantPos=false; }
try{ const q=+localStorage.getItem('vh-quant'); if([0,.25,.5,1,2,4].includes(q))st.quant=q; }catch(e){}
if(st.quant===undefined)st.quant=0;
function playCore(d,{fromVoicingChange=false,retrigger=false,fromLoop=false}={}){
  if(!fromLoop&&!fromVoicingChange)st.loopOv=null;   // a chord you play yourself uses your own flat/sharp and inversion
  playChord(d,fromVoicingChange,retrigger);
  if(!fromLoop)looper.record();
}
function playChord(d,fromVoicingChange,retrigger){
  if(d===null){ st.degree=null; st.sounding=false; audio.setNotes([]); st.upper=[]; render(); return; }
  const prev=st.upper.slice();
  const r=realize(d);
  st.degree=d; st.upper=r.upper; st.bassNote=r.bass; if(!fromVoicingChange)st.moved=moved(prev,r.upper);
  const all=r.bass!==null?[r.bass,...r.upper]:r.upper.slice();
  if(st.sounding||!fromVoicingChange){ st.sounding=true; audio.setNotes(all,{retrigger}); }
  if(!fromVoicingChange){ st.history.push(currentName()); if(st.history.length>6)st.history.shift(); st.chordSeq=(st.chordSeq||0)+1; }   // chordSeq restarts the mod matrix's chord envelope
  render();
}
function currentName(){
  const name=baseName(), rootPc=rootPcOf(st.degree);
  // Slash chord when the bass plays a non-root tone, or (with no bass) when an inversion was asked for
  const lowest=st.bassNote!==null?st.bassNote:(effInv()>0?st.upper[0]:undefined);
  return (lowest!==undefined&&lowest%12!==rootPc)?name+'/'+pcName(lowest):name;
}
function baseName(){
  const rootPc=rootPcOf(st.degree);
  const rel=new Set([...st.upper,...(st.bassNote!==null?[st.bassNote]:[])].map(m=>((m-rootPc)%12+12)%12));
  {const c=tonesOf(st.degree),root=pcName(rootPc),minor=c.t===3,s=c.s%12;
    if(voicingNow()==='power')return root+'5';
    if(voicingNow()==='flat5'){const h7=rel.has(s);
      if(minor)return root+(h7?(s===10?'m7♭5':s===9?'°7':'m(maj7)♭5'):'°');
      return root+(h7?(s===11?'maj7♭5':'7♭5'):'(♭5)');}
    if(voicingNow()==='ninesus')return root+(s===11?'maj9sus4':'9sus4');
    if(voicingNow()==='sowhat')return root+(minor?'m11':rel.has(11)?'maj13':rel.has(10)?'13':'6/9');
    if(voicingNow()==='upper')return root+(minor?'m11':rel.has(s)?(s===11?'maj13♯11':'13♯11'):'6/9♯11');}
  if(voicingNow()==='six'||voicingNow()==='flat6'){
    const iv=voicingNow()==='six'?9:8, c=tonesOf(st.degree), rest=new Set(rel); rest.delete(iv);
    if(rest.has(c.s%12)) return chordName(st.degree,rest)+(iv===9?'(13)':'(♭13)');
    const base=c.t===3?(c.f===6?'m♭5':'m'):'';
    const nine=rest.has(c.n%12);
    return pcName(rootPc)+base+(iv===9?(nine?'6/9':'6'):(nine?'(♭6,add9)':'(♭6)'));
  }
  if(voicingNow()==='two'){   // the added 2nd: "add2" on a triad, a 9 on a 7th chord
    const c=tonesOf(st.degree), iv=c.n%12, rest=new Set(rel); rest.delete(iv);
    if(rest.has(c.s%12)) return chordName(st.degree,rest)+(iv===1?'(♭9)':'(9)');
    return chordName(st.degree,rest)+(iv===1?'(add♭2)':'(add2)');
  }
  if(voicingNow()==='sus4'||voicingNow()==='sus2'){
    const c=tonesOf(st.degree), s=c.s%12, sev=rel.has(s)?(s===11?'maj7':'7'):'';
    const extra=voicingNow()==='sus4'&&rel.has(c.n%12)?'(add9)':'';
    return pcName(rootPc)+sev+(voicingNow()==='sus4'?'sus4':(c.n%12===1?'sus♭2':'sus2'))+extra;
  }
  return chordName(st.degree,rel);
}
function setVoicing(id,o={}){
  if(!o.now&&voicingWaits()){ if(voiceQ.id===id||(st.voicing===id&&voiceQ.timer===null))return;
    if(st.voicing===id){ clearTimeout(voiceQ.timer); voiceQ.timer=null; voiceQ.id=null; render(); return; }   // back to the one playing: nothing to wait for
    voiceQ.id=id; clearTimeout(voiceQ.timer);
    voiceQ.timer=setTimeout(()=>{ const q=voiceQ.id; voiceQ.id=null; voiceQ.timer=null; setVoicing(q,{now:true}); },gridDelay()); render(); return; }
  if(st.voicing===id)return; st.voicing=id;
  if(st.degree!==null){ const wasOn=st.sounding; play(st.degree,{fromVoicingChange:!wasOn}); } else render();
}
function preview(){ // compute display without sound
  if(st.degree===null){render();return}
  const r=realize(st.degree); st.upper=r.upper; st.bassNote=r.bass; render();
}
