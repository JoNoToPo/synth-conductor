/* ---------- Sound controls: one slider per effect, each optionally driven by a hand movement ---------- */
const INPUTS={x:'Left ↔ right',y:'Height',lean:'Lean right',tilt:'Tilt',dist:'Distance',roll:'Palm roll',lx:'Left hand ↔',speed:'Hand speed'};
const clamp01=v=>Math.max(0,Math.min(1,v));
// Envelope times use an exponential scale so short times get most of the slider
const ENV={a:[.002,3],d:[.02,4],r:[.02,5]};
const expMap=(v,[lo,hi])=>lo*Math.pow(hi/lo,v);
const expInv=(sec,[lo,hi])=>clamp01(Math.log(Math.max(lo,sec)/lo)/Math.log(hi/lo));
const PEDAL_RING=[.3,12];   // how long notes ring under the sustain pedal, in seconds
const fmtDb=db=>Math.abs(db)<.3?'Flat':(db>0?'+':'−')+Math.abs(db).toFixed(1)+' dB';
const fmtSec=s=>s<1?Math.round(s*1000)+' ms':s.toFixed(1)+' s';
function env(){ return {a:expMap(effV('attack'),ENV.a),d:expMap(effV('decay'),ENV.d),s:effV('sustain'),r:expMap(effV('release'),ENV.r)}; }
const TARGETS={
  velocity: {label:'Velocity: how hard chords are struck (read as each chord starts)', base:(100-1)/126, apply:()=>{}, noCtx:true, fmt:v=>String(Math.round(1+v*126))},
  drone:    {label:'Drone level', base:.5, apply:()=>{ if(typeof droneLevel==='function')droneLevel(); }, noCtx:true},
  volume:   {label:'Volume',         base:.75, apply:v=>audio.ramp(audio.master.gain,.04+v*.76)},
  pedal:    {label:'Pedal ring length (with a hand assigned, the pedal stays down)', base:()=>expInv(4,PEDAL_RING), apply:v=>audio.setRing(expMap(v,PEDAL_RING)), noCtx:true, fmt:v=>fmtSec(expMap(v,PEDAL_RING))},
  attack:   {label:'Attack',  base:()=>expInv(SOUNDS[st.sound].a,ENV.a), apply:()=>{}, noCtx:true, fmt:v=>fmtSec(expMap(v,ENV.a)), perSound:true},
  decay:    {label:'Decay',   base:()=>expInv(SOUNDS[st.sound].d,ENV.d), apply:()=>{}, noCtx:true, fmt:v=>fmtSec(expMap(v,ENV.d)), perSound:true},
  sustain:  {label:'Sustain', base:()=>SOUNDS[st.sound].s,               apply:()=>{}, noCtx:true, perSound:true},
  release:  {label:'Release', base:()=>expInv(SOUNDS[st.sound].r,ENV.r), apply:()=>{}, noCtx:true, fmt:v=>fmtSec(expMap(v,ENV.r)), perSound:true},
  bass:     {label:'Bass (centre = flat)',   base:.5, apply:v=>audio.ramp(audio.bassEq.gain,(v-.5)*24), fmt:v=>fmtDb((v-.5)*24)},
  mid:      {label:'Mid (centre = flat)',    base:.5, apply:v=>audio.ramp(audio.midEq.gain,(v-.5)*24), fmt:v=>fmtDb((v-.5)*24)},
  treble:   {label:'Treble (centre = flat)', base:.5, apply:v=>audio.ramp(audio.trebleEq.gain,(v-.5)*24), fmt:v=>fmtDb((v-.5)*24)},
  cutoff:   {label:'Filter cutoff',  perSound:true, base:()=>clamp01(Math.log2(SOUNDS[st.sound].cut/250)/5.3), apply:v=>audio.ramp(audio.filter.frequency,250*Math.pow(2,v*5.3))},
  resonance:{label:'Resonance (wah)',base:0, apply:v=>audio.ramp(audio.filter.Q,.5+v*17)},
  vowel:    {label:'Vowel filter',   base:0, apply:v=>audio.setVowel(v<.02?0:(v-.02)/.98,v>=.02), fmt:v=>v<.02?'Off':['ah','eh','ee','oh','oo'][Math.min(4,Math.floor((v-.02)/.98*5))]},
  highpass: {label:'High-pass',      base:0, apply:v=>audio.ramp(audio.hp.frequency,20*Math.pow(2,v*6))},
  reverb:   {label:'Reverb',         base:.33, apply:v=>audio.ramp(audio.wet.gain,v*.9)},
  chorus:   {label:'Chorus',         base:0, apply:v=>audio.ramp(audio.chWet.gain,v*.7)},
  drive:    {label:'Drive',          base:0, apply:v=>audio.setDrive(v)},
  detune:   {label:'Detune',         base:0, apply:v=>audio.setDetune(v)},
  phaser:   {label:'Phaser',  base:0, apply:v=>audio.mix(audio.ph,v)},
  flanger:  {label:'Flanger', base:0, apply:v=>audio.mix(audio.fl,v)},
  tremolo:  {label:'Tremolo', base:0, apply:v=>audio.setTrem(v)},
  autopan:  {label:'Auto-pan',base:0, apply:v=>audio.setPan(v)},
  rotary:   {label:'Rotary speaker', base:0, apply:v=>audio.setRotary(v), fmt:v=>v<.03?'Off':(.7*Math.pow(6.8/.7,(v-.03)/.97)).toFixed(1)+' Hz'},
  crush:    {label:'Bit crush: fewer bits, grittier', base:0, apply:()=>{ if(typeof lofiApply==='function')lofiApply(); }, noCtx:true, fmt:v=>v<.02?'Off':Math.round(16-v*12)+' bit'},
  rate:     {label:'Sample rate: lower is grittier and more aliased', base:0, apply:()=>{ if(typeof lofiApply==='function')lofiApply(); }, noCtx:true,
             fmt:v=>v<.02?'Off':((audio.ctx?audio.ctx.sampleRate:48000)/(1+Math.round(v*v*31))/1000).toFixed(1)+' kHz'},
  wobble:   {label:'Wobble: tape wow and flutter on the pitch', base:0, apply:v=>{ if(typeof lofiWobble==='function')lofiWobble(v); }},
  noise:    {label:'Noise: a bed of hiss or vinyl crackle', base:0, apply:v=>{ if(typeof lofiNoise==='function')lofiNoise(v); }},
  delay:    {label:'Delay',   base:0, apply:v=>audio.setDelayMix(v)},
  feedback: {label:'Delay feedback', base:.35, apply:v=>audio.setFeedback(v)},
  tempo:    {label:'Tempo push and pull (centre = your BPM)', base:.5, apply:()=>{ if(typeof setArp==='function')tempoNudged(); }, noCtx:true,
             fmt:v=>{ const d=tempoOff(v); return Math.abs(d)<.5?'Set BPM':`${d>0?'+':'−'}${Math.round(Math.abs(d))} · ${Math.round(Math.max(40,Math.min(240,st.bpm+d)))}`; }},
  pump:     {label:'Pump',    base:0, apply:v=>audio.setPump(v), fmt:v=>v<.02?'Off':Math.round(v*100)+'%'},
  vibrato:  {label:'Vibrato depth (MIDI mod wheel)', base:0, apply:v=>audio.ramp(audio.vibDepth.gain,v*35)},
  bend:     {label:'Pitch bend (centre = in tune)', base:.5, apply:v=>audio.ramp(audio.bend.offset,bendAmt(v)*midiOut.bendRange*100,.02),
             fmt:v=>{const b=bendAmt(v)*midiOut.bendRange;return Math.abs(b)<.05?'In tune':(b>0?'+':'−')+Math.abs(b).toFixed(1)+' st'}},
  strum:    {label:'Strum',          base:0, apply:v=>{audio.strum=v*.12}, noCtx:true, fmt:v=>v<.01?'Off':Math.round(v*120)+' ms'},
  position: {label:'Chord position', base:.444, apply:v=>setPosition(v), noCtx:true, fmt:v=>v<.03?'Off':'around '+midiName(Math.round(48+v*36))},
  arp:      {label:'Arpeggio',       base:0, apply:v=>setArp(v), noCtx:true, fmt:()=>st.arpLabel},
};
const CTRL_SRC_DEFAULT={cutoff:'x',volume:'y',reverb:'dist',position:'lx'};
const baseOf=k=>{const b=TARGETS[k].base;return typeof b==='function'?b():b};
st.ctrl={}; for(const k in TARGETS)st.ctrl[k]={v:baseOf(k),src:CTRL_SRC_DEFAULT[k]||'none',inv:false};
st.leanColor=true;
try{
  const c=JSON.parse(localStorage.getItem('vh-ctrl')||'null');
  if(c&&typeof c==='object'){for(const k in TARGETS)if(c[k])st.ctrl[k]={v:clamp01(+c[k].v||0),src:INPUTS[c[k].src]?c[k].src:'none',inv:!!c[k].inv}}
  else{ // older input → target routing: keep the assignments
    const r=JSON.parse(localStorage.getItem('vh-routes')||'null');
    if(Array.isArray(r)){for(const k in TARGETS)st.ctrl[k].src='none';st.leanColor=false;
      r.forEach(x=>{if(x.target==='color')st.leanColor=true;else if(st.ctrl[x.target]){st.ctrl[x.target].src=x.input;st.ctrl[x.target].inv=!!x.invert}})}
  }
  const lc=localStorage.getItem('vh-leancolor');if(lc!==null)st.leanColor=lc==='1';
}catch(e){}
st.ctrl.arp.v=0; // arpeggio always starts off
st.inVals={x:.6,y:.75,lean:0,tilt:.5,dist:.4,roll:1,lx:.5,speed:0};
st.arp=0; st.arpLabel='Off';
// Time signatures. The BPM always counts quarter notes; x/8 meters click on every eighth, grouped as listed
// (the first eighth of each group gets a stronger click, the bar's first one the strongest)
const METERS={'2/4':{n:2,d:4},'3/4':{n:3,d:4},'4/4':{n:4,d:4},'5/4':{n:5,d:4},'6/4':{n:6,d:4},
  '5/8':{n:5,d:8,g:[3,2]},'6/8':{n:6,d:8,g:[3,3]},'7/8':{n:7,d:8,g:[2,2,3]},'9/8':{n:9,d:8,g:[3,3,3]},'12/8':{n:12,d:8,g:[3,3,3,3]}};
st.bpm=100; st.sync=true; st.vibDiv='free'; st.click=false; st.meter='4/4';
try{const t=JSON.parse(localStorage.getItem('vh-tempo')||'null');if(t){st.bpm=t.bpm||100;st.sync=t.sync!==false;st.vibDiv=t.vibDiv||'free';if(METERS[t.meter])st.meter=t.meter}}catch(e){}
// The current meter: pulses per bar, bar length and pulse length in quarter notes, and which pulses start a group
function meterOf(){ const m=METERS[st.meter]||METERS['4/4'], strong=new Set([0]);
  if(m.g){let i=0;for(const x of m.g){strong.add(i);i+=x}}
  return {n:m.n,d:m.d,bar:m.n*4/m.d,step:4/m.d,strong}; }
// Note values in beats
const DIVS=[['1/4',1],['1/8',.5],['1/8T',1/3],['1/16',.25],['1/16T',1/6],['1/32',.125]];
// The Tempo knob pushes and pulls the BPM like Bend does pitch: the middle (with a small dead zone) is your set BPM,
// the ends are ± Tempo knob range. Everything that keeps time reads beatSec, so it all follows
st.tempoRange=10; try{ const v=+localStorage.getItem('vh-temporange'); if([5,10,20,40].includes(v))st.tempoRange=v; }catch(e){}
const tempoOff=(v=effV('tempo'))=>bendAmt(v)*st.tempoRange;
const bpmNow=()=>Math.max(40,Math.min(240,st.bpm+tempoOff()));
const beatSec=()=>60/bpmNow();
let tempoLast=null;
function tempoNudged(){ const b=bpmNow(); if(tempoLast!==null&&Math.abs(b-tempoLast)<.25)return; tempoLast=b;
  setArp(st.ctrl.arp.v); setVibRate(); setTimeFx(); }
// Arpeggio speed 0..1: Off near zero. Synced: steps through note values at the current BPM. Free: 2 → 16 notes per second.
function setArp(v){
  st.arp=v; let nps=0,label='Off';
  if(v>=.03){
    if(st.sync){const d=DIVS[Math.min(DIVS.length-1,Math.floor((v-.03)/.97*DIVS.length))];nps=1/(beatSec()*d[1]);label=`${d[0]} @ ${Math.round(bpmNow())}`;audio.arpDiv=d[1]}
    else{nps=2*Math.pow(2,(v-.03)/.97*3);label=`${nps.toFixed(1)}/s`;audio.arpDiv=null}
  }
  st.arpLabel=label; audio.setArpRate(nps);
}
// Tremolo/auto-pan rate and delay time follow the BPM
st.fx={reverbType:'hall',tremDiv:'1/8',delayDiv:'1/8d',noiseType:'hiss'};
try{const f=JSON.parse(localStorage.getItem('vh-fx')||'null');if(f)Object.assign(st.fx,f)}catch(e){}
const DELAY_DIVS={'1/4':1,'1/8d':.75,'1/8':.5,'1/8T':1/3,'1/16':.25};
function saveFx(){try{localStorage.setItem('vh-fx',JSON.stringify(st.fx))}catch(e){}}
function setTimeFx(){
  if(!audio.ctx)return; const b=beatSec(), now=audio.ctx.currentTime;
  const d=DIVS.find(x=>x[0]===st.fx.tremDiv), hz=st.sync&&d?1/(b*d[1]):5;
  audio.ramp(audio.tremLfo.frequency,hz,.02); audio.ramp(audio.panLfo.frequency,hz/4,.02);
  const t=Math.min(3.9,b*(DELAY_DIVS[st.fx.delayDiv]||.75)); audio.dL.delayTime.setTargetAtTime(t,now,.05); audio.dR.delayTime.setTargetAtTime(t,now,.05);
  if(audio.pumpTimer){clearInterval(audio.pumpTimer);audio.pumpTimer=null;audio.setPump(audio.pumpDepth)}
}
function setVibRate(){
  if(!audio.ctx)return;
  const d=DIVS.find(x=>x[0]===st.vibDiv);
  audio.ramp(audio.vibLfo.frequency,st.sync&&d?1/(beatSec()*d[1]):5.5,.02);
}
function saveTempo(){try{localStorage.setItem('vh-tempo',JSON.stringify({bpm:st.bpm,sync:st.sync,vibDiv:st.vibDiv,meter:st.meter}))}catch(e){}}
function tempoChanged(){ setArp(st.ctrl.arp.v); setVibRate(); setTimeFx(); saveTempo(); showRouteVals(); }

// The mod matrix adds an offset on top of each knob; what you hear (and MIDI out sends) is the two together
const modOff={};
const effV=k=>clamp01(st.ctrl[k].v+(modOff[k]||0));
function applyCtrl(k){ const t=TARGETS[k], v=effV(k); midiOut.ctrl(k,v); if(!audio.ctx&&!t.noCtx)return; t.apply(v); }
function applyAllRoutes(){ for(const k in TARGETS)applyCtrl(k); }
// Called every camera frame with the right hand's smoothed inputs
// How far a hand must twist to count as a turn (degrees). Turning back under ~10° releases it.
const TURN=17;
const lastDriven={};
function driveCtrls(only){
  for(const k in TARGETS){const c=st.ctrl[k]; if(c.src==='none')continue;
    if(only&&!only.includes(c.src))continue; if(!only&&c.src==='lx')continue;
    let v=st.inVals[c.src]; if(c.inv)v=1-v;
    if(k==='position')v=.05+.95*v; // a hand never switches Position off; that's the knob's job
    c.v=v;
    if(lastDriven[k]!==undefined&&Math.abs(v-lastDriven[k])<.004)continue; // skip changes too small to hear
    lastDriven[k]=v; applyCtrl(k);}
  if(only)return;
  if((st.sevMode==='twist'||st.sevMode==='twistE')&&st.s7){ // 7th type "Twist": thumb out, twist left = maj7, right = 7, upright = natural 7th (with hysteresis)
    const a=st.leanDeg; let f=st.sevForce;
    if(a>TURN)f='dom'; else if(a<-TURN)f='maj'; else if(Math.abs(a)<10)f=null;
    if(st.alt7)setAlt7(false);
    if(f!==st.sevForce)setSevForce(f);
    return;
  }
  if(st.sevForce)setSevForce(null);
  if(st.leanColor){ // hysteresis: on past TURN degrees of lean, off below ~10°
    const v=st.inVals.lean; let want=st.alt7; if(!st.alt7&&v>TURN/45)want=true; else if(st.alt7&&v<.22)want=false;
    if(want!==st.alt7)setAlt7(want);
  }
}
let saveTimer=null;
function saveRoutes(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{
  localStorage.setItem('vh-ctrl',JSON.stringify(st.ctrl));localStorage.setItem('vh-leancolor',st.leanColor?'1':'0')}catch(e){}},300)}
// Which module each control lives in, and its short panel name
const MODULE_OF={amp:['volume','velocity','bass','mid','treble'],env:['attack','decay','sustain','release'],
  filter:['cutoff','resonance','highpass','vowel'],fx:['reverb','chorus','pedal','drive','phaser','flanger'],mod:['bend','detune','vibrato','tremolo','autopan','rotary'],
  pump:['pump','tempo'],drone:['drone'],lofi:['crush','rate','wobble','noise'],delay:['delay','feedback'],arp:['arp','strum'],chordpos:['position']};
// The finer knobs: hidden when their panel is switched to just the basics
const CTRL_ADV=new Set(['bass','mid','treble','resonance','highpass','vowel','drive','phaser','flanger']);
const KSHORT={tempo:'Tempo',crush:'Crush',rate:'Rate',wobble:'Wobble',noise:'Noise',drone:'Drone',velocity:'Velocity',bass:'Bass',mid:'Mid',treble:'Treble',pedal:'Pedal ring',volume:'Volume',cutoff:'Cutoff',resonance:'Reso',highpass:'Hi-pass',vowel:'Vowel',reverb:'Reverb',chorus:'Chorus',
  drive:'Drive',detune:'Detune',vibrato:'Vibrato',strum:'Strum',arp:'Arp rate',phaser:'Phaser',flanger:'Flanger',tremolo:'Tremolo',autopan:'Auto-pan',rotary:'Rotary',delay:'Delay',feedback:'Feedback',pump:'Pump',position:'Position',bend:'Bend',attack:'A',decay:'D',sustain:'S',release:'R'};
// Hand menu: source + direction in one choice
const SRC_OPTS=[['none','✋ off'],['x','✋ →'],['x:i','✋ ←'],['y','✋ ↑'],['y:i','✋ ↓'],['lean','Lean'],['lean:i','Lean inv'],['tilt','Tilt'],['tilt:i','Tilt inv'],['dist','Push'],['dist:i','Pull'],['roll','Palm'],['roll:i','Back'],['speed','Speed'],['speed:i','Speed inv']];
const SRC_TITLE='Let your right hand play this: → move right, ← move left, ↑ raise, ↓ lower, Lean tilt right, Tilt: upright is the middle, tilt left or right to go either way, Push toward the camera, Pull back, Palm: roll your palm toward the camera to raise it, Back: roll the back of your hand toward the camera to raise it, Speed: move your hand faster to raise it';
const srcVal=c=>c.src==='none'?'none':c.src+(c.inv?':i':'');
const fmtVal=k=>TARGETS[k].fmt?TARGETS[k].fmt(st.ctrl[k].v):Math.round(st.ctrl[k].v*100)+'%';
// Knob arc: 270° sweep from bottom-left to bottom-right
const A0=-135,A1=135,RAD=Math.PI/180;
const pt=(a,r)=>[30+r*Math.sin(a*RAD),30-r*Math.cos(a*RAD)];
function arcPath(a,b,r){const [x0,y0]=pt(a,r),[x1,y1]=pt(b,r);return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${b-a>180?1:0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`}

function setCtrl(k,v){ const c=st.ctrl[k]; c.v=clamp01(v); applyCtrl(k); showRouteVals(); saveRoutes(); }
function srcSelect(k){
  const s=document.createElement('select');s.className='ksrc';s.id='cs-'+k;s.title=SRC_TITLE;s.setAttribute('aria-label',TARGETS[k].label+': hand control');
  const opts=k==='position'?[SRC_OPTS[0],['lx','Left ✋ ↔'],['lx:i','Left ✋ ↔ inv'],...SRC_OPTS.slice(1)]:SRC_OPTS;
  s.innerHTML=opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
  s.value=srcVal(st.ctrl[k]);
  s.addEventListener('change',()=>{const [src,inv]=s.value.split(':');st.ctrl[k].src=src;st.ctrl[k].inv=inv==='i';showRouteVals();saveRoutes()});
  return s;
}
function makeKnob(k,big){
  const t=TARGETS[k],w=document.createElement('div');w.className='knob'+(big?' big':'')+(CTRL_ADV.has(k)?' pa':'');w.dataset.k=k;w.title=t.label;
  w.innerHTML=`<div class="kdial" role="slider" tabindex="0" aria-label="${t.label}" aria-valuemin="0" aria-valuemax="100">
      <svg viewBox="0 0 60 60" aria-hidden="true"><path class="trk" d="${arcPath(A0,A1,25)}" fill="none" stroke-width="4" stroke-linecap="round"/>
      <path class="arc" fill="none" stroke-width="4" stroke-linecap="round"/><circle class="cap" cx="30" cy="30" r="18" stroke-width="1.5"/>
      <line class="ptr" x1="30" y1="30" stroke-width="2.5" stroke-linecap="round"/><circle class="mdot" r="3" cx="30" cy="5"/></svg></div>
    <div class="kname">${KSHORT[k]}</div><div class="kval" id="cval-${k}"></div>`;
  w.appendChild(srcSelect(k));
  const dial=w.querySelector('.kdial');let drag=null;
  dial.addEventListener('pointerdown',e=>{audio.init();dial.setPointerCapture(e.pointerId);drag={y:e.clientY,v:st.ctrl[k].v};dial.focus();e.preventDefault()});
  dial.addEventListener('pointermove',e=>{if(!drag)return;setCtrl(k,drag.v+(drag.y-e.clientY)/(e.shiftKey?600:160))});
  const end=()=>{drag=null};dial.addEventListener('pointerup',end);dial.addEventListener('pointercancel',end);
  dial.addEventListener('wheel',e=>{e.preventDefault();audio.init();setCtrl(k,st.ctrl[k].v-e.deltaY/(e.shiftKey?3000:900))},{passive:false});
  dial.addEventListener('dblclick',()=>setCtrl(k,baseOf(k)));
  dial.addEventListener('keydown',e=>{const big=e.shiftKey?.1:.02,v=st.ctrl[k].v;
    const m={ArrowUp:v+big,ArrowRight:v+big,ArrowDown:v-big,ArrowLeft:v-big,PageUp:v+.1,PageDown:v-.1,Home:0,End:1}[e.key];
    if(m!==undefined){e.preventDefault();e.stopPropagation();audio.init();setCtrl(k,m)}});
  return w;
}
function makeFader(k){
  const t=TARGETS[k],w=document.createElement('div');w.className='fader';w.dataset.k=k;w.title=t.label;
  w.innerHTML=`<label class="kname" for="cv-${k}">${KSHORT[k]}</label><input type="range" id="cv-${k}" min="0" max="1" step="0.01" aria-label="${t.label}"><div class="kval" id="cval-${k}"></div>`;
  w.appendChild(srcSelect(k));
  const sl=w.querySelector('input');sl.value=st.ctrl[k].v;
  sl.addEventListener('input',()=>{audio.init();setCtrl(k,+sl.value)});
  sl.addEventListener('dblclick',()=>setCtrl(k,baseOf(k)));
  sl.addEventListener('keydown',e=>e.stopPropagation()); // arrow keys move the fader, not the synth shortcuts
  return w;
}
// Knob rows: as many as fit, but split evenly across rows so no knob sits alone on a row
function balanceKnobs(){ document.querySelectorAll('.knobs').forEach(box=>{ if(!box.offsetParent)return;
  const ks=[...box.children].filter(k=>k.classList.contains('knob')&&getComputedStyle(k).display!=='none'); if(!ks.length)return;
  const w=box.clientWidth, kw=ks.reduce((a,k)=>a+(k.classList.contains('big')?92:74),0)/ks.length+6, fit=Math.max(1,Math.floor((w+6)/kw)),   // average width: one big knob doesn't cost a column
    rows=Math.ceil(ks.length/fit), per=Math.ceil(ks.length/rows);
  box.style.setProperty('--per',per); box.classList.add('bal'); }); }
{ let raf=0; const later=()=>{ cancelAnimationFrame(raf); raf=requestAnimationFrame(balanceKnobs); };
  addEventListener('resize',later); if(window.ResizeObserver)new ResizeObserver(later).observe(document.documentElement); }
function buildRoutes(){
  for(const [mod,keys] of Object.entries(MODULE_OF)){
    const box=$('m-'+mod);box.innerHTML='';
    keys.forEach(k=>box.appendChild(mod==='env'?makeFader(k):makeKnob(k,k==='volume')));
  }
  $('optLeanColor').checked=st.leanColor;
  showRouteVals(); requestAnimationFrame(balanceKnobs);
}
function showRouteVals(){ syncPedalAuto(); showRouteVals0(); }
function showRouteVals0(){
  {const led=document.getElementById('optPos');if(led)led.checked=(st.ctrl.position?.v??0)>=.03;}
  for(const k in TARGETS){
    const c=st.ctrl[k],w=document.querySelector(`[data-k="${k}"]`);if(!w)continue;
    w.classList.toggle('driven',c.src!=='none');
    $('cval-'+k).textContent=fmtVal(k);
    const src=$('cs-'+k);if(src&&document.activeElement!==src)src.value=srcVal(c);
    if(w.classList.contains('knob')){
      const a=A0+(A1-A0)*c.v,[x,y]=pt(a,13),dial=w.querySelector('.kdial');
      w.querySelector('.arc').setAttribute('d',c.v>.005?arcPath(A0,a,25):'');
      const p=w.querySelector('.ptr');p.setAttribute('x2',x.toFixed(2));p.setAttribute('y2',y.toFixed(2));
      dial.setAttribute('aria-valuenow',Math.round(c.v*100));dial.setAttribute('aria-valuetext',fmtVal(k));
    } else { const sl=$('cv-'+k);if(sl&&document.activeElement!==sl)sl.value=c.v; }
  }
}
