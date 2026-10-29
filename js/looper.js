/* ---------- Chord loop: record a progression against the beat, then it repeats while you play over it ----------
   It records harmony only (chord, major/minor flip, 7th, color, flat/sharp, inversion). Voicing, knobs and sound
   stay live, so the right hand keeps shaping the loop as it plays. Positions are kept in beats, so changing
   the BPM speeds the loop up or slows it down. Beats here are always quarter notes; the meter sets how many make a bar. */
const looper={
  bars:4, snap:.5, events:[], state:'idle',   // idle · count (waiting for the downbeat) · rec · play
  get playing(){ return this.state==='play'; },
  pos:0, lastT:0, startAt:0, timer:null, clickWas:false, lastSnap:null,
  len(){ return this.bars*meterOf().bar; },
  snapshot(){ const on=st.sounding&&st.degree!==null;
    return {deg:on?st.degree:null,flip:st.flip,alt7:st.alt7,s7:st.s7,sevForce:st.sevForce,shift:shiftAmt(),inv:effInv(),
      roman:on?romanOf(st.degree):'',name:on?currentName():''}; },
  same(a,b){ return a&&b&&['deg','flip','alt7','s7','sevForce','shift','inv'].every(k=>a[k]===b[k]); },
  // Called after every chord change you play. While recording, it lands on the nearest snap step, but never past
  // the loop's end: a change in the last moments stays at the end instead of wrapping round onto the first chord
  record(){ if(this.state!=='rec')return; const s=this.snapshot(); if(this.same(s,this.lastSnap))return; this.lastSnap=s;
    const L=this.len(), pos=Math.min(this.pos+(audio.ctx.currentTime-this.lastT)/beatSec(),L-1e-3);   // exact time, not the last tick's
    let b=this.snap?Math.round(pos/this.snap)*this.snap:pos; if(b>=L)b=this.snap?Math.floor(pos/this.snap)*this.snap:pos; b=Math.round(b*1e4)/1e4;
    this.events=this.events.filter(e=>Math.abs(e.beat-b)>1e-4); this.events.push({beat:b,...s}); this.events.sort((x,y)=>x.beat-y.beat);
    loopUI(); },
  apply(e){
    st.loopOv={shift:e.shift,inv:e.inv,voicing:e.voicing||null}; st.flip=e.flip; st.alt7=e.alt7; st.s7=e.s7; st.sevForce=e.sevForce;
    $('optFlip').checked=e.flip; $('optAlt7').checked=e.alt7; $('opt7').checked=e.s7;
    if(e.deg===null)play(null,{fromLoop:true}); else play(e.deg,{fromLoop:true,retrigger:st.degree===e.deg&&st.sounding});
  },
  // Next beat (or bar) on the same grid as the arpeggio, click and MIDI clock
  nextGrid(beats,minAhead){ const c=audio.ctx, step=beatSec()*beats; let t=audio.t0+Math.ceil((c.currentTime+.03-audio.t0)/step)*step;
    while(t-c.currentTime<minAhead)t+=step; return t; },
  start(state,at){ clearInterval(this.timer); this.state=state; this.startAt=at; this.timer=setInterval(()=>this.tick(),10); loopUI(); },
  arm(){ if(!audio.ctx)return; this.stop(); if(this.events.length)loopPush(); this.events=[]; this.lastSnap=null; loopSel=null;
    this.clickWas=!!audio.clickTimer; audio.startClick();                  // count-in and recording always click
    const bar=meterOf().bar; this.recording=true; this.start('count',this.nextGrid(bar,beatSec()*bar*.75)); },   // at least ~a bar of count-in
  playLoop(){ if(!audio.ctx||!this.events.length)return; this.stop(); this.recording=false; this.start('count',this.nextGrid(1,0)); },
  stop(){ if(this.state==='idle')return; const was=this.state; clearInterval(this.timer); this.timer=null; this.state='idle'; st.loopOv=null; this.restore();
    if(!this.clickWas&&!st.click)audio.stopClick(); this.clickWas=false;
    if(was==='play'||was==='rec')play(null,{fromLoop:true}); if(this.events.length)saveLoop(); loopUI(); },
  toggle(){ if(this.state==='idle'){ this.events.length?this.playLoop():this.arm(); }
    else if(this.state==='rec'){ this.finish(); } else this.stop(); },
  // End recording: the loop carries straight on into playback, no gap
  finish(){ if(!this.clickWas&&!st.click)audio.stopClick(); this.state='play'; this.recording=false; this.keep(); saveLoop(); loopUI(); },
  tick(){
    const now=audio.ctx.currentTime;
    if(this.state==='count'){ if(now<this.startAt){loopMsg();return}
      this.state=this.recording?'rec':'play'; this.pos=0; this.lastT=this.startAt;
      if(this.state==='rec'){ this.lastSnap=null; this.record(); } else { this.keep(); this.fire(-1e-6,0); } loopUI(); }
    const L=this.len(), prev=this.pos; this.pos+=(now-this.lastT)/beatSec(); this.lastT=now;
    if(this.state==='rec'){ if(this.pos>=L){ this.pos-=L; this.finish(); this.fire(-1e-6,this.pos); } }
    else if(this.pos>=L){ this.fire(prev,L); this.pos-=L; this.fire(-1e-6,this.pos); }
    else this.fire(prev,this.pos);
    loopHead();
  },
  fire(a,b){ for(const e of this.events) if(e.beat>a&&e.beat<=b+1e-9) this.apply(e); },
  // The loop sets flip, 7ths and color as it plays; yours come back when it stops
  keep(){ this.mine={flip:st.flip,alt7:st.alt7,s7:st.s7,sevForce:st.sevForce}; },
  restore(){ const m=this.mine; if(!m)return; this.mine=null; Object.assign(st,m); $('optFlip').checked=m.flip; $('optAlt7').checked=m.alt7; $('opt7').checked=m.s7; },
};
/* Export as a .mid file: each chord as it would sound right now (current key, voicing and settings), held until
   the next change, played through `times` times. Uses MIDI out's channels and fixed velocity. */
function loopMidi(times=1){
  const ev=looper.events, L=looper.len(), tpq=midiOut.TPQ; if(!ev.some(e=>e.deg!==null))return null;
  const keep={flip:st.flip,alt7:st.alt7,s7:st.s7,sevForce:st.sevForce,loopOv:st.loopOv,upper:st.upper.slice(),bassNote:st.bassNote,degree:st.degree};
  const ch=midiOut.ch, bch=midiOut.bassCh??ch, vel=midiOut.vel, out=[];
  try{
    for(let r=0;r<times;r++) ev.forEach((e,i)=>{ if(e.deg===null)return;
      // rings until the next change; the last one carries into the next time round, as it does when playing
      const end=i+1<ev.length?ev[i+1].beat+r*L:r<times-1?(r+1)*L+ev[0].beat:times*L;
      st.loopOv={shift:e.shift,inv:e.inv,voicing:e.voicing||null}; st.flip=e.flip; st.alt7=e.alt7; st.s7=e.s7; st.sevForce=e.sevForce;
      const n=realize(e.deg); st.upper=n.upper; st.bassNote=n.bass; st.degree=e.deg;   // so voice leading follows on
      const notes=[...(n.bass!==null?[[bch,n.bass]]:[]),...n.upper.map(m=>[ch,m])];
      const t0=Math.round((e.beat+r*L)*tpq), t1=Math.round(end*tpq);
      for(const [c,m] of notes){ out.push([t0,[0x90|c,m,vel]]); out.push([t1,[0x80|c,m,0]]); }
    });
  } finally { Object.assign(st,keep); }
  out.sort((a,b)=>a[0]-b[0]||((a[1][0]&0xf0)===0x80?-1:1)-((b[1][0]&0xf0)===0x80?-1:1));   // a note ends before the next one starts
  return midiOut.smf(out,st.bpm).blob;
}
const LOOP_MAX_BARS=32, loopBarsOk=n=>Number.isInteger(n)&&n>=1&&n<=LOOP_MAX_BARS;
function saveLoop(){ try{localStorage.setItem('vh-loop',JSON.stringify({bars:looper.bars,snap:looper.snap,events:looper.events}))}catch(e){} }

try{ const s=JSON.parse(localStorage.getItem('vh-loop')||'null');
  if(s){ if(loopBarsOk(s.bars))looper.bars=s.bars; if([0,.25,.5,1].includes(s.snap))looper.snap=s.snap;
    if(Array.isArray(s.events))looper.events=s.events.filter(e=>e&&typeof e.beat==='number'&&e.beat>=0&&e.beat<looper.len()&&(e.deg===null||(e.deg>=0&&e.deg<7))); } }catch(e){}

/* Loop panel: a timeline of the recorded chords with a playhead */
function loopHead(){ const h=document.getElementById('loopHead'); if(!h)return;
  const show=looper.state==='play'||looper.state==='rec'; h.hidden=!show; if(show)h.style.left=(looper.pos/looper.len()*100)+'%'; }
function loopUI(){
  const tl=document.getElementById('loopTl'); if(!tl)return; const L=looper.len(), ev=looper.events;
  const m=meterOf(); tl.style.setProperty('--bars',looper.bars); tl.style.setProperty('--pulses',looper.bars*m.n);
  tl.querySelectorAll('.lseg').forEach(n=>n.remove());
  if(!ev.includes(loopSel))loopSel=null;
  // Rests (where you stopped) are drawn too, so their timing can be fixed like any chord
  ev.forEach((e,i)=>{ const end=i+1<ev.length?ev[i+1].beat:L;
    const s=document.createElement('div'); s.className='lseg'+(e.deg===null?' rest':'')+(e===loopSel?' sel':'')+(e===loopSel&&loopEditing?' editing':''); s.dataset.i=i;
    s.style.left=(e.beat/L*100)+'%'; s.style.width=((end-e.beat)/L*100)+'%';
    s.title=`${e.deg===null?'Rest':e.name} · ${loopWhere(e.beat)}`; const r=document.createElement('b'); r.textContent=e.deg===null?'—':e.roman; const n=document.createElement('span'); n.textContent=e.deg===null?'rest':e.name;
    s.append(r,n); tl.insertBefore(s,document.getElementById('loopHead')); });
  const ed=loopEditable(); $('loopEdit').hidden=!loopSel||!ed;
  if(loopSel)$('loopSelName').textContent=`${loopSel.deg===null?'Rest':loopSel.name} · ${loopWhere(loopSel.beat)}`;
  $('loopUndo').disabled=!loopUndo.length||!ed;
  const st0=looper.state, rec=$('loopRec'), pl=$('loopPlay');
  rec.textContent=st0==='rec'?'■ Finish':looper.recording&&st0==='count'?'Cancel':'● Record';
  rec.classList.toggle('recording',looper.recording&&(st0==='rec'||st0==='count'));
  pl.textContent=st0==='play'||(!looper.recording&&st0==='count')?'■ Stop':'▶ Play'; pl.disabled=!ev.length&&st0==='idle';
  $('loopClear').disabled=!ev.length||st0!=='idle';
  loopMsg(); loopHead(); loopChordUI();
}
function loopMsg(){
  const m=$('loopMsg'), st0=looper.state, ev=looper.events, n=ev.filter(e=>e.deg!==null).length;
  if(st0==='count'){ const left=Math.max(1,Math.ceil((looper.startAt-audio.ctx.currentTime)/(beatSec()*meterOf().step))); m.textContent=looper.recording?`Count-in… ${left}`:'Starting on the next beat…'; }
  else if(st0==='rec') m.textContent=`Recording ${looper.bars} bar${looper.bars>1?'s':''} of ${st.meter}: play your chords. C finishes early.`;
  else if(st0==='play') m.textContent='Looping. Play voicings and knobs over it; C or Space stops. Drag a chord to move it.';
  else m.textContent=n?`${n} chord${n>1?'s':''} recorded. Drag a chord along the timeline to fix its timing; C plays the loop.`:'Records your chord changes against the BPM, starting on the next bar after a count-in. Press C to record, play or stop.';
}
$('loopBars').value=String(looper.bars); $('loopSnap').value=String(looper.snap); $('loopMeter').value=st.meter;
// Changing the meter changes the bar length; chords past the new end are dropped. It also sets the click and MIDI clock bars
$('loopMeter').addEventListener('change',e=>{ if(looper.events.length)loopPush(); st.meter=e.target.value; saveTempo();
  looper.events=looper.events.filter(x=>x.beat<looper.len()); if(looper.pos>=looper.len())looper.pos%=looper.len();
  if(audio.clickTimer){audio.stopClick();audio.startClick()} if(midiOut.clockTimer){midiOut.stopClock();midiOut.startClock()} saveLoop(); loopUI(); });
$('loopBars').addEventListener('change',e=>{ const v=Math.round(+e.target.value), b=Number.isFinite(v)&&e.target.value!==''?Math.max(1,Math.min(LOOP_MAX_BARS,v)):looper.bars; e.target.value=b;
  if(b===looper.bars)return; loopPush(); looper.bars=b; looper.events=looper.events.filter(x=>x.beat<looper.len()); saveLoop(); loopUI(); });
$('loopSnap').addEventListener('change',e=>{ looper.snap=+e.target.value; saveLoop(); });
$('loopRec').addEventListener('click',()=>{ audio.init(); if(looper.state==='rec')looper.finish(); else if(looper.recording&&looper.state==='count')looper.stop(); else looper.arm(); });
$('loopPlay').addEventListener('click',()=>{ audio.init(); if(looper.state==='idle')looper.playLoop(); else looper.stop(); });
$('loopExport').addEventListener('click',()=>{ const times=+$('loopTimes').value, blob=loopMidi(times), msg=$('loopBankMsg');
  if(!blob){ msg.textContent='Record a loop with at least one chord first.'; return; }
  const name=(typeof loopActive==='string'&&loopActive?loopActive:'chord loop').replace(/–/g,'-').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'chord-loop';
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`synth-conductor-${name}.mid`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  msg.textContent=`Saved ${a.download}: ${times>1?times+' times round, ':''}${st.bpm} BPM, in your current voicing.`; });
$('loopClear').addEventListener('click',()=>{ loopPush(); looper.events=[]; saveLoop(); loopUI(); });

/* Editing after the fact: drag a chord (or rest) along the timeline, nudge it, delete it, undo.
   Each chord rings until the next change, so moving one moves the boundary with the chord before it.
   Chords keep their order; moves land on the Snap grid (1/16 when Snap is off for the buttons). */
let loopSel=null, loopDrag=null, loopEditing=false; const loopUndo=[];
function loopPush(){ loopUndo.push(JSON.stringify(looper.events)); if(loopUndo.length>40)loopUndo.shift(); }
function loopEditable(){ return !(looper.recording&&(looper.state==='rec'||looper.state==='count')); }
function loopWhere(b){ const m=meterOf(); return `bar ${Math.floor(b/m.bar+1e-6)+1}, ${m.d===8?'eighth':'beat'} ${Math.floor((b%m.bar)/m.step+1e-6)+1}`; }
function loopMove(e,b){ const ev=looper.events,i=ev.indexOf(e),g=looper.snap||.25;
  const lo=i>0?ev[i-1].beat+g:0, hi=i+1<ev.length?ev[i+1].beat-g:looper.len()-g; if(hi<lo)return false;
  b=Math.round(Math.max(lo,Math.min(hi,b))*1e4)/1e4; if(Math.abs(b-e.beat)<1e-6)return false; e.beat=b; return true; }
function loopNudge(dir){ if(!loopSel||!loopEditable())return; loopPush(); if(loopMove(loopSel,loopSel.beat+dir*(looper.snap||.25))){saveLoop();loopUI()} else loopUndo.pop(); }
function loopDelete(){ if(!loopSel||!loopEditable())return; loopPush(); looper.events.splice(looper.events.indexOf(loopSel),1); loopSel=null; loopEditing=false; saveLoop(); loopUI(); }
const loopTl=$('loopTl');
loopTl.addEventListener('pointerdown',ev=>{ if(ev.button>0||!loopEditable())return; const seg=ev.target.closest('.lseg');
  if(!seg){ if(loopSel){loopDeselect();loopUI()} return; }
  const e=looper.events[+seg.dataset.i], again=loopSel===e; loopSel=e; ev.preventDefault();
  loopDrag={e,x:ev.clientX,b0:e.beat,w:loopTl.getBoundingClientRect().width,moved:false,again};
  try{loopTl.setPointerCapture(ev.pointerId)}catch(err){} loopUI(); });
loopTl.addEventListener('pointermove',ev=>{ const d=loopDrag; if(!d)return; const dx=ev.clientX-d.x;
  if(!d.moved){ if(Math.abs(dx)<5)return; d.moved=true; loopPush(); }
  const raw=d.b0+dx/d.w*looper.len(), step=looper.snap; if(loopMove(d.e,step?Math.round(raw/step)*step:raw))loopUI(); });
const loopDrop=()=>{ if(!loopDrag)return; const {moved,again}=loopDrag; loopDrag=null; if(moved)saveLoop(); else if(again)loopDeselect(); loopUI(); };
loopTl.addEventListener('pointerup',loopDrop); loopTl.addEventListener('pointercancel',loopDrop);
loopTl.addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){ if(!loopSel&&looper.events.length){loopSel=looper.events[0];loopUI()} else loopNudge(e.key==='ArrowLeft'?-1:1); }
  else if(e.key==='Delete'||e.key==='Backspace')loopDelete(); else return;
  e.preventDefault(); e.stopPropagation(); });
$('loopEarlier').addEventListener('click',()=>loopNudge(-1));
$('loopLater').addEventListener('click',()=>loopNudge(1));
$('loopDel').addEventListener('click',loopDelete);
$('loopUndo').addEventListener('click',()=>{ if(!loopUndo.length||!loopEditable())return;
  try{looper.events=JSON.parse(loopUndo.pop()).filter(x=>x.beat<looper.len())}catch(e){} loopSel=null; loopEditing=false; saveLoop(); loopUI(); });
/* Editing one chord: only through Edit chord, never by tapping, so a chord can't change by accident.
   Done, Esc, the ✕, tapping the chord again or tapping empty timeline all close it */
function loopDeselect(){ loopSel=null; loopEditing=false; }
// What a loop chord is called, worked out with that chord's own settings
function loopChordName(e){ if(e.deg===null)return {roman:'',name:''};
  const keep={flip:st.flip,alt7:st.alt7,s7:st.s7,sevForce:st.sevForce,loopOv:st.loopOv,upper:st.upper.slice(),bassNote:st.bassNote,degree:st.degree};
  try{ st.loopOv={shift:e.shift,inv:e.inv,voicing:e.voicing||null}; st.flip=!!e.flip; st.alt7=!!e.alt7; st.s7=e.s7??keep.s7; st.sevForce=e.sevForce; st.degree=e.deg;
    const r=realize(e.deg); st.upper=r.upper; st.bassNote=r.bass; return {roman:romanOf(e.deg),name:currentName()}; }
  finally{ Object.assign(st,keep); } }
function lcSevenOf(e){ const s7=e.s7??st.s7; return s7?(e.alt7?"7c":"7"):(e.alt7?"add9":"tri"); }
function loopChordUI(){
  const p=$('loopChord'), e=loopSel, show=!!e&&loopEditing&&loopEditable(); p.hidden=!show;
  $('loopEditChord').textContent=loopEditing?'Editing…':'Edit chord'; $('loopEditChord').disabled=loopEditing;
  if(!show)return;
  const i=looper.events.indexOf(e), rest=e.deg===null;
  $('lcWhat').textContent=`${rest?'Rest':e.name||e.roman} · chord ${i+1} of ${looper.events.length} · ${loopWhere(e.beat)}`;
  // Each choice is named as it would sound with this chord's other settings
  const deg=$('lcDeg'); if(document.activeElement!==deg){
    deg.innerHTML=[0,1,2,3,4,5,6].map(d=>{const n=loopChordName({...e,deg:d});return `<option value="${d}">${n.roman} · ${n.name}</option>`}).join('')+'<option value="rest">Rest (silence)</option>';
    deg.value=rest?'rest':String(e.deg); }
  const vs=$('lcVoicing'); if(!vs.options.length)vs.innerHTML='<option value="">Live: whatever your hand picks</option>'+VOICINGS.map(v=>`<option value="${v.id}">${v.name}</option>`).join('');
  vs.value=e.voicing||''; $('lcSeven').value=lcSevenOf(e); $('lcShift').value=String(e.shift||0); $('lcInv').value=String(e.inv||0); $('lcFlip').checked=!!e.flip;
  for(const id of ['lcSeven','lcShift','lcInv','lcVoicing','lcFlip','lcHear'])$(id).disabled=rest;
  $('lcHear').disabled=rest||looper.state!=='idle';
}
// One change, one Undo step; the chord's name on the timeline follows
function lcChange(f){ const e=loopSel; if(!e||!loopEditable())return; loopPush(); f(e); Object.assign(e,loopChordName(e)); saveLoop(); loopUI(); }
$('loopEditChord').addEventListener('click',()=>{ if(!loopSel||!loopEditable())return; loopEditing=true; loopUI(); $('lcDeg').focus(); });
$('loopDeselect').addEventListener('click',()=>{ loopDeselect(); loopUI(); });
$('lcDone').addEventListener('click',()=>{ loopDeselect(); loopUI(); $('loopTl').focus(); });
$('lcDeg').addEventListener('change',ev=>lcChange(e=>{ const v=ev.target.value; e.deg=v==='rest'?null:+v; }));
$('lcSeven').addEventListener('change',ev=>lcChange(e=>{ const v=ev.target.value; e.s7=v==='7'||v==='7c'; e.alt7=v==='add9'||v==='7c'; }));
$('lcShift').addEventListener('change',ev=>lcChange(e=>{ e.shift=+ev.target.value; }));
$('lcInv').addEventListener('change',ev=>lcChange(e=>{ e.inv=+ev.target.value; }));
$('lcVoicing').addEventListener('change',ev=>lcChange(e=>{ e.voicing=ev.target.value||null; }));
$('lcFlip').addEventListener('change',ev=>lcChange(e=>{ e.flip=ev.target.checked; }));
// Hear it: plays the chord as the loop would, then puts your own settings back
$('lcHear').addEventListener('click',()=>{ const e=loopSel; if(!e||e.deg===null||looper.state!=='idle')return; audio.init();
  const mine={flip:st.flip,alt7:st.alt7,s7:st.s7,sevForce:st.sevForce};
  looper.apply(e);
  setTimeout(()=>{ if(looper.state!=='idle')return; play(null,{fromLoop:true}); st.loopOv=null; Object.assign(st,mine);
    $('optFlip').checked=mine.flip; $('optAlt7').checked=mine.alt7; $('opt7').checked=mine.s7; render(); },1200); });
// Keys typed in the editor stay there, so they don't play chords or change settings; Esc closes it
$('loopChord').addEventListener('keydown',ev=>{ ev.stopPropagation(); if(ev.key==='Escape'){ ev.preventDefault(); loopDeselect(); loopUI(); $('loopTl').focus(); } });
document.addEventListener('keydown',ev=>{ if(ev.key==='Escape'&&loopSel&&!ev.defaultPrevented){ loopDeselect(); loopUI(); } });
loopUI();
