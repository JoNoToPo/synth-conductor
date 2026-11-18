/* ---------- Learning: Simple view, a hands-on walkthrough, and the optional support link ---------- */

// Where the "chip in" link in About & support goes. Empty = the line stays hidden.
// A Ko-fi, GitHub Sponsors, PayPal.me or similar page.
const SUPPORT_URL='https://paypal.me/JonathanEngelhard/5';   // /5 fills in a suggested amount of 5; donors can change it

/* Panels: the controls past the camera and pads, sorted into tabs (layout.js), each folding shut to its name.
   Some also fold to their main knobs (More / Less). "Voicing" folded that way is Simple view: just the voicings
   your fingers play, without the finger slots (adv-only). New visitors start with them folded. */
const PANELS=[   // in the order they appear on the page
  ['presets','Presets','Save and load sounds and hand setups'],
  ['piano','Keyboard','The notes that are sounding, with the chord path'],
  ['loop','Chord loop','Record chords to the beat, then play over them'],
  ['chord','Chord options','7ths, color, major/minor, voice leading, bass note and inversion'],
  ['details','Voicing','Every voicing, not just the ones your fingers play, plus the right-hand finger slots'],
  ['hands','Left hand','Shapes for 6 and 7, twist, fist, palm roll and height inversions'],
  ['camera','Camera','View shape, zoom, and where left/right and up/down are measured'],
  ['amp','Amp & tone','Bass, mid and treble. Volume always shows'],
  ['mod','Modulation','Bend, detune, vibrato, tremolo, auto-pan and rotary'],
  ['bass','Bass','The bass note: root, 5th or 3rd, held or in a pattern on the beat, with its own sound'],
  ['drone','Drone','Notes held under everything, like bagpipes, with a hurdy-gurdy buzz'],
  ['filter','Filter','Resonance, high-pass and the vowel filter. Cutoff always shows'],
  ['fx','Effects','Drive, phaser, flanger and the reverb type. Reverb, chorus and pedal ring always show'],
  ['lofi','Lo-fi','Bit crush, lower sample rate, tape wobble and hiss or vinyl crackle'],
  ['tempo','Tempo & pump','BPM, tap, sync, click and pump'],
  ['arp','Arp & strum','Play chords as arpeggios, or strum them'],
  ['delay','Delay','Echoes in time with the tempo'],
  ['perc','Percussion','A shaker, rattle or click on the beat, or played by its dial'],
  ['instrument','Instrument','Build your own: oscillators, envelope, struck or held'],
  ['matrix','Mod matrix','Let LFOs, a chord envelope or your hands move any knob'],
  ['midi','MIDI out','Play other synths or a DAW, or record a .mid file'],
];
const PANELS_ESSENTIAL=['piano','loop'];
// Panels with finer knobs fold down to their main ones (More / Less); nothing is hidden any more: each tab's panels fold shut instead.
// Voicing's "−" is Simple view (just the voicings your fingers play). panels[k] is true when a foldable panel shows everything
const PANELS_MIN=[...document.querySelectorAll('[data-panel-min]')].map(el=>el.dataset.panel);
let panels={};
{ let saved=null; try{saved=JSON.parse(localStorage.getItem('vh-panels')||'null')}catch(e){}
  let simple=firstVisit; try{const v=localStorage.getItem('vh-simple');if(v!==null)simple=v==='1'}catch(e){}   // carried over from Simple view
  PANELS.forEach(([k])=>{ const w=saved&&saved[k]; panels[k]=!PANELS_MIN.includes(k)||(typeof w==='boolean'?w:!simple); }); }
const panelShown=k=>!!panels[k];
function panelsApply(){
  document.querySelectorAll('[data-panel-min]').forEach(el=>{ const on=panelShown(el.dataset.panel);
    el.classList.toggle('panel-min',!on); const b=el.querySelector(':scope>.phide'); if(!b)return;
    const sign=el.hasAttribute('data-panel-sign'); b.textContent=sign?(on?'−':'+'):on?'Less':'More';
    b.title=sign?(on?'Show just the voicings your fingers play':'Show every voicing and the finger slots'):on?'Show just the main knobs':'Show every knob';
    b.setAttribute('aria-label',b.title); b.setAttribute('aria-expanded',on); b.classList.toggle('psign',sign); });
  document.body.classList.toggle('simple',!panels.details);
  try{localStorage.setItem('vh-panels',JSON.stringify(panels))}catch(e){}
  if(typeof droneSync==='function')droneSync();
  if(typeof bassPanelChanged==='function')bassPanelChanged();   // folding Bass hands the bass back to the chord
  dispatchEvent(new Event('resize'));
}
// on: show it (and for a foldable panel, all of it). Asking for a panel also brings its tab up, once the tabs exist
function setPanel(k,on){ if(PANELS_MIN.includes(k))panels[k]=on; panelsApply(); if(on&&typeof revealPanel==='function')revealPanel(k); }
function setAllPanels(list){ PANELS_MIN.forEach(k=>panels[k]=list===true||list.includes(k)); panelsApply(); }
// More / Less (or + / −) in the corner of each foldable panel
document.querySelectorAll('[data-panel-min]').forEach(el=>{
  const k=el.dataset.panel, b=document.createElement('button'); b.type='button'; b.className='phide pmore';
  b.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); panels[k]=!panels[k]; panelsApply(); });
  el.appendChild(b);
});
panelsApply();

/* Walkthrough. Each step finishes itself when you actually do the thing; Skip is always there.
   done(b) is checked a few times a second; b is the step's own scratch state, made fresh when the step starts. */
const rightSeen=()=>!!(cam.on&&cam.R), leftByHand=()=>cam.on&&handOwnsChord&&st.sounding&&st.degree!==null;
const LESSONS=[
  {t:'Play a chord', d:'Tap any pad under the camera, or press a number key from 1 to 7. Each number is a chord built on that step of the key: 1 is home.',
   init:()=>({n:st.chordSeq||0}), done:b=>(st.chordSeq||0)>b.n},   // chordSeq counts every chord played; the history list stops growing at 6
  {t:'Play ii – V – I', d:'Press 2, then 5, then 1 (or tap ii, V, I). It’s the most used chord move in jazz and pop: tension, then home.',
   init:()=>({seq:[]}), done:b=>{ const d=st.sounding?st.degree:null; if(d!==null&&b.seq[b.seq.length-1]!==d)b.seq.push(d); return b.seq.slice(-3).join()==='1,4,0'; }},
  {t:'Turn on the camera', d:'Sit back so both hands fit in the picture. The video stays on your computer: the hand tracking runs inside the browser.',
   act:{label:'Turn on the camera',run:()=>{if(!cam.on)$('camBtn').click()}}, done:()=>cam.ready&&cam.on,
   fix:{when:()=>!!$('camMsg').textContent&&!$('camMsg').hidden,text:'No camera here? You can still learn the rest on the keys.',btn:'Skip to the end',run:()=>lessonGo(LESSONS.length-1)}},
  {t:'Left hand picks the chord', d:'Raise your left hand on the left side of the picture, palm toward the camera. Hold up 1 finger for I, then 4 for IV. The ring round your hand fills up, and the chord changes when it closes.',
   init:()=>({seen:new Set()}), done:b=>{ if(leftByHand())b.seen.add(st.degree); return b.seen.has(0)&&b.seen.has(3); },
   fix:{when:()=>st.rightOnly,text:'“Right hand only” is on, so the left hand can’t pick chords yet.',btn:'Use both hands',run:()=>$('optRightOnly').click()}},
  {t:'Six, seven and stop', d:()=>`For vi, make ${$('g6t').textContent}. For vii°, ${$('g7t').textContent}. Then make a fist to stop the chord.`,
   init:()=>({vi:false}), done:b=>{ if(leftByHand()&&st.degree===5)b.vi=true; return b.vi&&!st.sounding; },
   fix:{when:()=>st.rightOnly,text:'“Right hand only” is on.',btn:'Use both hands',run:()=>$('optRightOnly').click()}},
  {t:'Right hand picks the voicing', d:'Play a chord, then raise your right hand on the right side. How many fingers you hold up (not counting the thumb) picks how the notes are spread: try none, then two, then four, and listen.',
   init:()=>({seen:new Set()}), done:b=>{ if(rightSeen())b.seen.add(st.voicing); return b.seen.size>=3; },
   fix:{when:()=>!st.rh,text:'“Hand picks voicing” is off.',btn:'Turn it on',run:()=>{const c=$('optRH');c.checked=true;c.dispatchEvent(new Event('change'))}}},
  {t:'Thumb out for 7ths', d:'Stick your right thumb out to add the 7th (the jazzy note), tuck it in for a plain three-note chord. Try it a couple of times.',
   init:()=>({last:st.s7,flips:0}), done:b=>{ if(rightSeen()&&st.s7!==b.last){b.last=st.s7;b.flips++} return b.flips>=2; }},
  {t:'Move to shape the sound', d:'Slide your right hand slowly from one side to the other: by default it opens and closes the filter (watch the track along the bottom of the picture). Up and down sets the volume.',
   init:()=>({lo:1,hi:0}), done:b=>{ if(rightSeen()){b.lo=Math.min(b.lo,st.inVals.x);b.hi=Math.max(b.hi,st.inVals.x)} return b.hi-b.lo>.55; }},
  {t:'Choose what your hands control', d:'Every knob has a ✋ menu under it that picks which hand movement plays it. Position, in the Hands tab, slides the chord up and down the keyboard, and to start it follows your left hand across. Open its menu (it says “Left ✋ ↔”) and pick ✋ ↑: now raising your right hand climbs the keyboard. Any knob works the same way, and “✋ off” leaves it to your mouse.',
   act:{label:'Show me the menu',run:()=>{ const s=$('cs-position'); if(typeof revealEl==='function')revealEl(s); s.scrollIntoView({block:'center',behavior:'smooth'}); s.focus({preventScroll:true});
     s.classList.remove('lpoint'); void s.offsetWidth; s.classList.add('lpoint'); }},
   init:()=>({was:srcVal(st.ctrl.position)}), done:b=>{ const c=st.ctrl.position; return srcVal(c)!==b.was&&!['none','lx','lspeed'].includes(c.src); },
   fix:{when:()=>!$('optPos').checked,text:'Position is turned all the way down, so it isn’t moving the chord.',btn:'Turn it up',run:()=>$('optPos').click()}},
  {t:'Make it yours', d:'That’s the core. Next: press C to record a 4-bar chord loop and play voicings over it, try other Sound choices, or look through the tabs: Chords, Hands, Sound, Backing and Mod. Each panel opens when you tap its name. Presets, MIDI and the Hand guide (every gesture) are at the top.',
   act:{label:'Show me the tabs',run:()=>{ const t=$('tabsarea'); t.scrollIntoView({block:'start',behavior:'smooth'}); t.querySelector('.tabbar').classList.remove('lpoint'); void t.offsetWidth; t.querySelector('.tabbar').classList.add('lpoint'); }}, final:true},
];
const lesson={i:0,b:{},okAt:0,timer:null};
function lessonSave(fin){ try{localStorage.setItem('vh-lesson',JSON.stringify({i:lesson.i,finished:!!fin}))}catch(e){} }
function lessonGo(i){
  lesson.i=Math.max(0,Math.min(LESSONS.length-1,i)); const L=LESSONS[lesson.i];
  lesson.b=L.init?L.init():{}; lesson.okAt=0; lessonSave(false); lessonRender();
}
function lessonRender(){
  const L=LESSONS[lesson.i], last=lesson.i===LESSONS.length-1;
  $('lessonStep').textContent=`Learn · ${lesson.i+1} of ${LESSONS.length}`;
  $('lessonDots').innerHTML=LESSONS.map((_,k)=>`<i class="${k<lesson.i?'done':k===lesson.i?'cur':''}"></i>`).join('');
  $('lessonTitle').textContent=L.t; $('lessonText').textContent=typeof L.d==='function'?L.d():L.d;
  const act=$('lessonAct'); act.hidden=!L.act; if(L.act)act.textContent=L.act.label;
  $('lessonBack').disabled=lesson.i===0;
  $('lessonNext').textContent=last?'Finish':lesson.okAt?'Next':'Skip';
  $('lessonOk').textContent=lesson.okAt?'✓ Got it':'';
  lessonFix();
}
function lessonFix(){ const f=LESSONS[lesson.i].fix, show=!!(f&&f.when()&&!lesson.okAt), p=$('lessonFix');
  if(p.hidden!==!show){p.hidden=!show; if(show){$('lessonFixText').textContent=f.text;$('lessonFixBtn').textContent=f.btn;}} }
function lessonTick(){
  const L=LESSONS[lesson.i]; lessonFix();
  if(lesson.okAt||!L.done)return;
  let ok=false; try{ok=L.done(lesson.b)}catch(e){}
  if(ok){ lesson.okAt=performance.now(); lessonRender();
    setTimeout(()=>{ if(lesson.okAt&&!$('lesson').hidden&&LESSONS[lesson.i]===L)lessonGo(lesson.i+1); },1300); }
}
function lessonOpen(scroll=true){
  let s={}; try{s=JSON.parse(localStorage.getItem('vh-lesson')||'{}')||{}}catch(e){}
  $('lesson').hidden=false; lessonGo(s.finished||!Number.isInteger(s.i)?0:s.i);
  clearInterval(lesson.timer); lesson.timer=setInterval(lessonTick,150);
  if(scroll)$('lesson').scrollIntoView({block:'nearest',behavior:'smooth'});
}
function lessonClose(fin){ $('lesson').hidden=true; clearInterval(lesson.timer); lesson.timer=null; if(fin)lessonSave(true); }
$('learnBtn').addEventListener('click',()=>lessonOpen());
$('lessonClose').addEventListener('click',()=>lessonClose(false));
$('lessonBack').addEventListener('click',()=>lessonGo(lesson.i-1));
$('lessonNext').addEventListener('click',()=>{ if(lesson.i===LESSONS.length-1)lessonClose(true); else lessonGo(lesson.i+1); });
$('lessonAct').addEventListener('click',()=>{ audio.init(); const a=LESSONS[lesson.i].act; if(a)a.run(); });
$('lessonFixBtn').addEventListener('click',()=>{ const f=LESSONS[lesson.i].fix; if(f)f.run(); lessonFix(); });
if(firstVisit&&!sharedAtStart)lessonOpen(false);   // someone opening a shared link sees what they were sent first

/* Support link: shown only once a page address is filled in above */
if(SUPPORT_URL){ $('supportLink').href=SUPPORT_URL; $('supportLine').hidden=false; }
