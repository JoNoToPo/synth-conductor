/* ---------- Learning: Simple view, a hands-on walkthrough, and the optional support link ---------- */

// Where the "chip in" link in About & support goes. Empty = the line stays hidden.
// A Ko-fi, GitHub Sponsors, PayPal.me or similar page.
const SUPPORT_URL='https://paypal.me/JonathanEngelhard/5';   // /5 fills in a suggested amount of 5; donors can change it

/* Panels: every part of the page past the camera and pads can be shown or hidden, from the Panels menu or a
   panel's own ✕. New visitors start with just the essentials. "Voicing" (key details) also holds the finer settings
   (everything marked adv-only: the finger slots) and the voicings no finger plays; with it off the page is in Simple view. */
const PANELS=[   // in the order they appear on the page
  ['presets','Presets','Save and load sounds and hand setups'],
  ['piano','Keyboard','The notes that are sounding, with the chord path'],
  ['loop','Chord loop','Record chords to the beat, then play over them'],
  ['chord','Chord options','7ths, color, major/minor, voice leading, bass note and inversion'],
  ['details','Voicing','Every voicing, not just the ones your fingers play, plus the right-hand finger slots'],
  ['hands','What your hands do','Left-hand shapes for 6 and 7, twist, fist, palm roll, height inversions and position'],
  ['amp','Amp & tone','Bass and treble. Volume and pedal ring always show'],
  ['mod','Modulation','Bend, detune, vibrato, tremolo, auto-pan and rotary'],
  ['filter','Filter','Resonance, high-pass and the vowel filter. Cutoff always shows'],
  ['fx','Effects','Drive, phaser, flanger and the reverb type. Reverb and chorus always show'],
  ['tempo','Tempo & pump','BPM, tap, sync, click and pump'],
  ['arp','Arp & strum','Play chords as arpeggios, or strum them'],
  ['delay','Delay','Echoes in time with the tempo'],
  ['instrument','Instrument','Build your own: oscillators, envelope, struck or held'],
  ['matrix','Mod matrix','Let LFOs, a chord envelope or your hands move any knob'],
  ['midi','MIDI out','Play other synths or a DAW, or record a .mid file'],
];
const PANELS_ESSENTIAL=['piano','loop'];
// Panels that keep time: while any of them shows, Tempo shows too
const NEEDS_TEMPO={loop:'Chord loop',arp:'Arp & strum',delay:'Delay',mod:'Modulation'};
// Older saves had one switch for all the sound panels and one for arp, tempo and delay
const PANELS_WAS={amp:'sound',mod:'sound',filter:'sound',fx:'sound',tempo:'rhythm',arp:'rhythm',delay:'rhythm'};
let panels={};
{ let saved=null; try{saved=JSON.parse(localStorage.getItem('vh-panels')||'null')}catch(e){}
  let simple=firstVisit; try{const v=localStorage.getItem('vh-simple');if(v!==null)simple=v==='1'}catch(e){}   // carried over from Simple view
    const was=k=>saved&&(typeof saved[k]==='boolean'?saved[k]:typeof saved[PANELS_WAS[k]]==='boolean'?saved[PANELS_WAS[k]]:undefined);
  PANELS.forEach(([k])=>{const w=was(k); panels[k]=w!==undefined?w:simple?PANELS_ESSENTIAL.includes(k):true}); }
const tempoNeededBy=()=>Object.keys(NEEDS_TEMPO).filter(k=>panels[k]);
const panelShown=k=>panels[k]||(k==='tempo'&&tempoNeededBy().length>0);
function panelsApply(){
  document.querySelectorAll('[data-panel]').forEach(el=>{ const on=panelShown(el.dataset.panel);
    if(el.hasAttribute('data-panel-min')){ el.classList.toggle('panel-min',!on); const b=el.querySelector(':scope>.phide');
      const sign=el.hasAttribute('data-panel-sign'); b.textContent=sign?(on?'−':'+'):on?'Less':'More';
      b.title=sign?(on?'Show just the voicings your fingers play':'Show every voicing and the finger slots'):on?'Show just the main knobs':'Show every knob';
      b.setAttribute('aria-label',b.title); b.setAttribute('aria-expanded',on); b.classList.toggle('psign',sign); }
    else el.classList.toggle('panel-off',!on); });
  document.querySelectorAll('.padd').forEach(b=>b.hidden=panelShown(b.dataset.for));
  document.body.classList.toggle('simple',!panels.details);
  // Tempo can't be hidden while something uses it: its box is ticked and greyed, and its ✕ is gone
  const need=tempoNeededBy(), tb=$('panelList').querySelector('input[value=tempo]');
  tb.disabled=need.length>0; tb.closest('.pmitem').querySelector('small').textContent=need.length?`Shown while ${need.map(k=>NEEDS_TEMPO[k]).join(', ')} ${need.length>1?'are':'is'} on`:PANELS.find(p=>p[0]==='tempo')[2];
  document.querySelector('.m-tempo>.phide').hidden=need.length>0;
  const on=PANELS.filter(([k])=>panelShown(k)).length; $('panelsCount').textContent=`${on}/${PANELS.length}`;
  $('panelList').querySelectorAll('input').forEach(i=>i.checked=panelShown(i.value));
  try{localStorage.setItem('vh-panels',JSON.stringify(panels))}catch(e){}
  dispatchEvent(new Event('resize'));
}
function setPanel(k,on){ panels[k]=on; panelsApply(); }
function setAllPanels(list){ PANELS.forEach(([k])=>panels[k]=list===true||list.includes(k)); panelsApply(); }
PANELS.forEach(([k,name,desc])=>{
  const l=document.createElement('label'); l.className='pmitem';
  l.innerHTML=`<input type="checkbox" value="${k}"><b>${name}</b><small>${desc}</small>`;
  l.querySelector('input').addEventListener('change',e=>setPanel(k,e.target.checked)); $('panelList').appendChild(l);
});
// A ✕ in each panel's corner; on a collapsible section it sits in the title bar so it shows when closed too
document.querySelectorAll('[data-panel]').forEach(el=>{
  const k=el.dataset.panel, name=(PANELS.find(p=>p[0]===k)||[])[1]; if(!name||el.classList.contains('panelhint'))return;
  const b=document.createElement('button'); b.type='button'; b.className='phide';
  // A panel with main knobs that always stay folds down to them (More/Less); any other one hides (✕)
  if(el.hasAttribute('data-panel-min')){ b.classList.add('pmore'); b.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); setPanel(k,!panels[k]); }); }
  else{ b.textContent='✕'; b.title=`Hide ${name}. Bring it back from Panels at the top`; b.setAttribute('aria-label',`Hide ${name}`);
    b.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); setPanel(k,false); });
    // A hidden panel leaves a + in its place to bring it back right there
    const add=document.createElement('button'); add.type='button'; add.className='padd'; add.dataset.for=k; add.hidden=true;
    add.innerHTML=`<span aria-hidden="true">+</span> ${name}`; add.title=`Show ${name} here again`;
    add.addEventListener('click',()=>{ setPanel(k,true); el.querySelector(':scope>.phide,:scope>summary>.phide')?.focus(); }); el.after(add); }
  const sum=el.tagName==='DETAILS'&&el.querySelector(':scope>summary'); (sum||el).appendChild(b);
});
{ const btn=$('panelsBtn'), menu=$('panelMenu');
  // Opens under the button, kept inside the screen
  const place=()=>{ const r=btn.getBoundingClientRect(), w=menu.offsetWidth;
    menu.style.top=Math.round(r.bottom+8)+'px'; menu.style.left=Math.round(Math.max(16,Math.min(r.left,innerWidth-w-16)))+'px'; };
  const show=on=>{ menu.hidden=!on; btn.setAttribute('aria-expanded',on); if(on)place(); };
  addEventListener('resize',()=>{ if(!menu.hidden)place(); }); addEventListener('scroll',()=>{ if(!menu.hidden)show(false); },{passive:true});
  btn.addEventListener('click',e=>{ e.stopPropagation(); show(menu.hidden); });
  document.addEventListener('pointerdown',e=>{ if(!menu.hidden&&!menu.contains(e.target)&&e.target!==btn&&!btn.contains(e.target))show(false); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!menu.hidden){show(false);btn.focus()} });
  $('panelsEssentials').addEventListener('click',()=>setAllPanels(PANELS_ESSENTIAL));
  $('panelsAll').addEventListener('click',()=>setAllPanels(true)); }
panelsApply();

/* Walkthrough. Each step finishes itself when you actually do the thing; Skip is always there.
   done(b) is checked a few times a second; b is the step's own scratch state, made fresh when the step starts. */
const rightSeen=()=>!!(cam.on&&cam.R), leftByHand=()=>cam.on&&handOwnsChord&&st.sounding&&st.degree!==null;
const LESSONS=[
  {t:'Play a chord', d:'Tap any pad under the camera, or press a number key from 1 to 7. Each number is a chord built on that step of the key: 1 is home.',
   init:()=>({n:st.history.length}), done:b=>st.history.length>b.n},
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
  {t:'Make it yours', d:'That’s the core. Next: press C to record a 4-bar chord loop and play voicings over it, try other Sound choices, or open Panels at the top to add the sound knobs, MIDI out and presets. The Hand guide below has every gesture.',
   act:{label:'Show every panel',run:()=>setAllPanels(true)}, final:true},
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
