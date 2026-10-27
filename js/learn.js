/* ---------- Learning: Simple view, a hands-on walkthrough, and the optional support link ---------- */

// Where the "chip in" link in About & support goes. Empty = the line stays hidden.
// A Ko-fi, GitHub Sponsors, PayPal.me or similar page.
const SUPPORT_URL='https://paypal.me/JonathanEngelhard/5';   // /5 fills in a suggested amount of 5; donors can change it

/* Simple view: hides everything marked adv-only. New visitors start in it; returning players keep the full panel */
{ let simple=firstVisit; try{const v=localStorage.getItem('vh-simple');if(v!==null)simple=v==='1'}catch(e){}
  const set=on=>{document.body.classList.toggle('simple',on);$('optSimple').checked=on;try{localStorage.setItem('vh-simple',on?'1':'0')}catch(e){}};
  set(simple); $('optSimple').addEventListener('change',e=>set(e.target.checked)); }

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
  {t:'Make it yours', d:'That’s the core. Next: press C to record a 4-bar chord loop and play voicings over it, try other Sound choices, or turn off Simple view to reach every knob, MIDI out and presets. The Hand guide below has every gesture.',
   act:{label:'Show all controls',run:()=>{const c=$('optSimple');if(c.checked){c.checked=false;c.dispatchEvent(new Event('change'))}}}, final:true},
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
if(firstVisit)lessonOpen(false);

/* Support link: shown only once a page address is filled in above */
if(SUPPORT_URL){ $('supportLink').href=SUPPORT_URL; $('supportLine').hidden=false; }
