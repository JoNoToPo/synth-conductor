/* ---------- UI ---------- */
const $=id=>document.getElementById(id);
const padsEl=$('pads'), vEl=$('voicings');

function buildPads(){
  padsEl.innerHTML='';
  NUMS.forEach((r,d)=>{
    const b=document.createElement('button');b.type='button';b.className='pad';b.dataset.d=d;
    b.innerHTML=`<span class="r">${r}</span><span class="c"></span><span class="k">${d+1}</span>`;
    b.addEventListener('click',e=>{ if(holdKeys&&e.detail>0)return;   // in hold mode, pressing and letting go is handled below
      audio.init();handOwnsChord=false;play(d,{retrigger:st.degree===d&&st.sounding})});
    b.addEventListener('pointerdown',e=>{ if(!holdKeys||e.button>0)return; e.preventDefault(); try{b.setPointerCapture(e.pointerId)}catch(err){}
      audio.init();handOwnsChord=false; const i=heldDigits.indexOf(d); if(i>=0)heldDigits.splice(i,1); heldDigits.push(d);
      play(d,{retrigger:st.degree===d&&st.sounding}); });
    const up=()=>{ if(!holdKeys)return; const i=heldDigits.indexOf(d); if(i<0)return; heldDigits.splice(i,1);
      if(heldDigits.length)play(heldDigits[heldDigits.length-1]); else play(null); };
    b.addEventListener('pointerup',up); b.addEventListener('pointercancel',up); b.addEventListener('lostpointercapture',up);
    padsEl.appendChild(b);
  });
  const s=document.createElement('button');s.type='button';s.className='pad stop';
  s.innerHTML='<span class="r">Stop</span><span class="c">silence</span><span class="k">space</span>';
  s.addEventListener('click',()=>{looper.stop();play(null,{now:true});audio.damp()});padsEl.appendChild(s);
}
// Voicings as buttons; the description shows on hover (and below the grid, so touch screens get it too)
let vHover=null;
function showVinfo(){
  const v=VOICINGS.find(x=>x.id===(vHover||st.voicing)); if(!v)return;
  $('vinfo').innerHTML=''; const b=document.createElement('b'); b.textContent=v.name+'. ';
  $('vinfo').append(b, document.createTextNode(v.blurb));
}
function buildVoicings(){
  vEl.innerHTML='';
  VOICINGS.forEach(v=>{
    const b=document.createElement('button');b.type='button';b.className='vchip';b.dataset.id=v.id;b.setAttribute('role','radio');
    b.title=`${v.name} (key ${v.key}): ${v.blurb}`;
    b.innerHTML=`<span class="vk">${v.key}</span><span class="vn">${v.name}</span><span class="vh"></span>`;
    b.addEventListener('click',()=>{audio.init();setVoicing(v.id)});
    b.addEventListener('mouseenter',()=>{vHover=v.id;showVinfo()});
    b.addEventListener('mouseleave',()=>{vHover=null;showVinfo()});
    b.addEventListener('focus',()=>{vHover=v.id;showVinfo()});
    b.addEventListener('blur',()=>{vHover=null;showVinfo()});
    vEl.appendChild(b);
  });
}
// Instrument menu: held and struck built-ins, then the ones you made
function fillSoundSel(){ const ss=$('soundSel'); ss.innerHTML='';
  for(const [name,test] of [['Held',s=>!s.mine&&!s.draft&&!s.strike],['Struck',s=>!s.mine&&!s.draft&&s.strike],['Yours',s=>s.mine||s.draft]]){
    const list=Object.entries(SOUNDS).filter(([k,s])=>test(s)); if(!list.length)continue;
    const grp=document.createElement('optgroup');grp.label=name;
    list.forEach(([k,s])=>{const o=document.createElement('option');o.value=k;o.textContent=s.label;grp.appendChild(o)}); ss.appendChild(grp);}
  ss.value=st.sound; if(typeof droneToneFill==='function')droneToneFill(); }
function buildSelects(){
  const ks=$('keySel');KEYS.forEach(([pc,n],i)=>{const o=document.createElement('option');o.value=i;o.textContent=n;ks.appendChild(o)});
  const ms=$('modeSel');Object.entries(MODES).forEach(([k,m])=>{const o=document.createElement('option');o.value=k;o.textContent=m.name;ms.appendChild(o)});
  ms.value=st.mode;
  ms.addEventListener('change',()=>{st.mode=ms.value;SCALE=MODES[st.mode].steps;try{localStorage.setItem('vh-mode',st.mode)}catch(e){}refreshAfterChange();render()});
  ks.addEventListener('change',()=>{st.key=+ks.value;st.upper=[];refreshAfterChange()});
  const ss=$('soundSel'); fillSoundSel();
  ss.addEventListener('change',()=>{audio.allOff();st.sound=ss.value;rememberSound();
    // Each sound has its own natural brightness and envelope: reset those sliders unless a hand is driving them
    for(const k in TARGETS)if(TARGETS[k].perSound&&st.ctrl[k].src==='none')st.ctrl[k].v=baseOf(k);
    showRouteVals();saveRoutes();
    applyAllRoutes();if(st.sounding&&st.degree!==null){const all=st.bassNote!==null?[st.bassNote,...st.upper]:st.upper;audio.setNotes(all)}
    instPicked(); if(typeof droneSync==='function')droneSync();});
}
function buildSlots(){
  const wrap=$('rhSlots');wrap.innerHTML='';
  st.rhMap.forEach((id,i)=>{
    const l=document.createElement('label');l.htmlFor='rh'+i;l.textContent=i===0?'✊ 0':`✋ ${i}`;l.title=i===0?'Closed hand (fist)':`${i} finger${i>1?'s':''} up`;
    const s=document.createElement('select');s.id='rh'+i;
    VOICINGS.forEach(v=>{const o=document.createElement('option');o.value=v.id;o.textContent=v.name;s.appendChild(o)});
    s.value=id;
    s.addEventListener('change',()=>{st.rhMap[i]=s.value;try{localStorage.setItem('vh-rhmap',JSON.stringify(st.rhMap))}catch(e){}render()});
    l.appendChild(s);wrap.appendChild(l);
  });
}
function setShift(src,val){
  const before=shiftAmt();
  if(src==='key')st.shiftKey=val; else st.shiftPalm=val;
  if(shiftAmt()===before)return;
  if(st.sounding&&st.degree!==null)play(st.degree,{refresh:true}); else preview();
}
function twistTag(){ if(!st.sevForce||st.degree===null)return '';
  const c=tonesOf(st.degree); return c.f===6&&c.s===9?'°7':c.s===11?'maj7':c.t===3?'m7':'7'; }
function setSevForce(f){
  st.sevForce=f;
  if(st.sounding&&st.degree!==null)play(st.degree,{fromVoicingChange:true}); else preview();
}
function setFlip(on){
  if(st.flip===on)return; st.flip=on; $('optFlip').checked=on;
  if(st.sounding&&st.degree!==null)play(st.degree,{refresh:true}); else preview();
}
function setAlt7(on){
  if(st.alt7===on)return; st.alt7=on; $('optAlt7').checked=on;
  if(st.sounding&&st.degree!==null)play(st.degree,{refresh:true}); else preview();
}
function setSevenths(on){
  if(st.s7===on)return; st.s7=on; $('opt7').checked=on; refreshAfterChange();
}
function refreshAfterChange(){ if(st.sounding&&st.degree!==null) play(st.degree,{fromVoicingChange:true}); else preview(); }
[['optVL','vl'],['opt7','s7'],['optBass','bass'],['optRH','rh']].forEach(([id,k])=>{
  $(id).addEventListener('change',e=>{st[k]=e.target.checked; if(k!=='rh'&&k!=='vl')refreshAfterChange(); render();});
});
$('optFlip').addEventListener('change',e=>setFlip(e.target.checked));
let handOwnsChord=false;
$('optRightOnly').checked=st.rightOnly;
$('optRightOnly').addEventListener('change',e=>{
  st.rightOnly=e.target.checked;try{localStorage.setItem('vh-rightonly',st.rightOnly?'1':'0')}catch(err){}
  if(st.rightOnly){
    // No left-hand twist or height any more: back to normal major/minor and root-position bass
    Object.assign(stab.L,{cand:undefined,degC:undefined,degN:0,flipCand:undefined,flipN:0,zone:undefined,zoneCand:undefined});
    if(holdPrior===null)setFlip(false);
    setInvSource('hand',null);
  }
  ensureTrackerHands();
});
$('optAlt7').addEventListener('change',e=>setAlt7(e.target.checked));
$('invSel').addEventListener('change',e=>setInvSource('base',+e.target.value));
$('sevSel').value=st.sevMode;
$('sevSel').addEventListener('change',e=>{st.sevMode=e.target.value;if(!(st.sevMode==='twist'||st.sevMode==='twistE')&&st.sevForce)st.sevForce=null;syncSevUI();try{localStorage.setItem('vh-sevmode',st.sevMode)}catch(err){}refreshAfterChange();render()});

function render(){
  const key=KEYS[st.key];
  document.body.classList.toggle('rh-only',st.rightOnly);   // full screen drops the chord pads when the left hand plays them
  // pads
  [...padsEl.querySelectorAll('.pad[data-d]')].forEach(b=>{
    const d=+b.dataset.d,c=tonesOf(d),rel=new Set([0,c.t%12,c.f%12].concat(has7()?[c.s%12]:[]));
    b.querySelector('.c').textContent=chordName(d,rel);
    b.querySelector('.r').textContent=romanOf(d);
    b.classList.toggle('on',st.sounding&&st.degree===d);
    b.classList.toggle('queued',chordQ.timer!==null&&chordQ.d===d);
  });
  [...vEl.children].forEach(b=>{const on=b.dataset.id===st.voicing;b.classList.toggle('on',on);b.setAttribute('aria-checked',on);b.classList.toggle('queued',voiceQ.timer!==null&&voiceQ.id===b.dataset.id);
    const slots=st.rhMap.map((id,i)=>id===b.dataset.id?String(i):null).filter(x=>x!==null);
    b.querySelector('.vh').textContent=slots.length?'✋ '+slots.join(' · '):'';
    b.classList.toggle('spare',!slots.length&&!on);}); // no finger plays it: tucked away unless Voicing is open
  showVinfo();
  $('keySel').value=st.key;
  const v=VOICINGS.find(x=>x.id===voicingNow());
  if(st.degree===null){
    $('roman').textContent=modeLabel();
    $('chordName').textContent='Tap a chord or raise your left hand';$('chordName').className='chordname idle';
    $('stack').innerHTML='';$('meta').innerHTML=`<span>Voicing <b>${v.name}</b></span>`;
  } else {
    const rootPc=rootPcOf(st.degree);
    $('roman').textContent=`${romanOf(st.degree)}${st.flip&&!st.pure?' (flipped)':''}${st.sevForce?` · ${twistTag()} (twist)`:st.alt7?(st.s7?(majMode()?' · ♭7':' · other 7th'):' · add9'):''} · ${modeLabel()}${st.sounding?'':' · preview'}`;
    $('chordName').textContent=currentName();$('chordName').className='chordname';
    const notes=(st.bassNote!==null?[{m:st.bassNote,b:1}]:[]).concat(st.upper.map(m=>({m})));
    $('stack').innerHTML=notes.map(({m,b})=>`<span class="n${b?' bass':''}"><span class="f">${FN[((m-rootPc)%12+12)%12]}</span><span class="nm">${midiName(m)}</span></span>`).join('');
    const span=st.upper[st.upper.length-1]-st.upper[0];
    const invNames=['root position','1st inversion','2nd inversion','3rd inversion'];
    const inv=effInv(), invTxt=inv>0&&bassInterval(st.degree)!==0?`<span><b>${invNames[inv]}</b></span>`:'';
    $('meta').innerHTML=`<span>Voicing <b>${v.name}</b></span>${invTxt}<span title="Semitones from the lowest to the highest voicing note">Spread <b>${span}</b></span>`+
      (st.moved!==null?`<span title="Total semitones the voices moved from the last chord">Moved <b>${st.moved}</b></span>`:'');
  }
  $('path').innerHTML=st.history.length?'<span>'+st.history.join('  →  ')+'</span>':'';
  drawPiano();
  status();
}
// The real state of the sound, not just whether it was started: a browser can hold it paused
function status(){
  const s=audio.ctx&&audio.ctx.state;
  const parts=[!s?'Sound off · tap a chord to start':s==='running'?'Sound on':`Sound paused by the browser (${s}) · tap anywhere`];
  if(cam.on)parts.push(cam.ready?'hands tracking':'starting camera');
  $('statusText').textContent=parts.join(' · ');
}

/* Piano */
const LO=28,HI=96,isBlack=m=>[1,3,6,8,10].includes(m%12);
function drawPiano(){
  const W=24,H=118,BW=14,BH=74;
  const xs={};let wi=0;
  for(let m=LO;m<=HI;m++){ if(!isBlack(m)){xs[m]=wi*W;wi++} else xs[m]=wi*W-BW/2 }
  const width=wi*W, height=H+46;
  const rootPc=st.degree!==null?rootPcOf(st.degree):0;
  const active=new Map(); if(st.degree!==null){ st.upper.forEach(m=>active.set(m,'v')); if(st.bassNote!==null)active.set(st.bassNote,'b'); }
  const drn=new Set(typeof droneShown==='function'?droneShown():[]);   // drone notes: their own colour, a ring when a chord note shares the key
  const dot=(cx,cy,r,a,m)=>(a?`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${a==='b'?'var(--patina)':'var(--brass)'}"/>`:'')
    +(drn.has(m)?(a?`<circle cx="${cx}" cy="${cy}" r="${r+3}" fill="none" stroke="var(--drone)" stroke-width="2"/>`:`<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--drone)"/>`):'');
  let s=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Keyboard showing the sounding notes">`;
  for(let m=LO;m<=HI;m++) if(!isBlack(m)){
    const a=active.get(m);
    s+=`<rect x="${xs[m]+.5}" y=".5" width="${W-1}" height="${H}" rx="3" fill="var(--key-white)" stroke="var(--line)"/>`;
    s+=dot(xs[m]+W/2,H-16,8,a,m);
    if(m%12===0&&!a&&!drn.has(m)) s+=`<text x="${xs[m]+W/2}" y="${H-10}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="8" fill="#8a7c6e">C${Math.floor(m/12)-1}</text>`;
  }
  for(let m=LO;m<=HI;m++) if(isBlack(m)){
    const a=active.get(m);
    s+=`<rect x="${xs[m]}" y=".5" width="${BW}" height="${BH}" rx="2" fill="var(--key-black)" stroke="var(--line)"/>`;
    s+=dot(xs[m]+BW/2,BH-12,5.5,a,m);
  }
  const act=[...new Set([...active.keys(),...drn])].sort((a,b)=>a-b);
  act.forEach((m,i)=>{
    const cx=xs[m]+(isBlack(m)?BW/2:W/2), y=H+16+(i%2)*16, a=active.get(m), col=a==='b'?'var(--patina)':a?'var(--brass)':'var(--drone)';
    s+=`<text x="${cx}" y="${y}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10" fill="${col}">${a?FN[((m-rootPc)%12+12)%12]+' ':''}${pcName(m)}</text>`;
  });
  s+='</svg>';
  $('piano').innerHTML=s;
  // When it has to scroll, start with middle C in view
  { const sc=$('piano'); if(!drawPiano.centred&&sc.scrollWidth>sc.clientWidth+4){ drawPiano.centred=true; sc.scrollLeft=Math.max(0,(xs[60]+W/2)/width*sc.scrollWidth-sc.clientWidth/2); } }
  { const l=document.getElementById('droneLegend'); if(l)l.hidden=!drn.size; }
  drawPiano.drone=[...drn].join();   // what was drawn, so the drone can ask for a redraw when it changes
}


/* Assignable hold keys: flip major/minor, 1st inversion, 2nd inversion */
const HOLD_DEFAULT={flip:'shift',inv1:'z',inv2:'x',flat:',',sharp:'.',pedal:'v'};
const HOLD_BTN={flip:'holdBtn',inv1:'inv1Btn',inv2:'inv2Btn',flat:'flatBtn',sharp:'sharpBtn',pedal:'pedalKeyBtn'};
// The pedal is down while any source holds it: the pedal key, the on-screen button, a MIDI foot pedal or a left fist
// "auto": while Pedal ring has a hand assigned, the pedal stays down and the hand sets how long notes ring (half-pedaling)
var pedalSrc={key:false,btn:false,midi:false,hand:false,auto:false};
function setPedal(src,on){ pedalSrc[src]=!!on; const down=Object.values(pedalSrc).some(Boolean);
  audio.setPedal(down); const b=document.getElementById('pedalBtn'); if(b){b.classList.toggle('down',down);b.setAttribute('aria-pressed',pedalSrc.btn?'true':'false');} }
function syncPedalAuto(){ if(!pedalSrc)return; const on=st.ctrl.pedal.src!=='none'; if(on!==pedalSrc.auto)setPedal('auto',on); }
syncPedalAuto();
// Comma and period keep their names even while Shift turns them into < and >
const keyName=e=>e.code==='Comma'?',':e.code==='Period'?'.':e.key.toLowerCase();
const shiftHeld=[];
function shiftKeyDown(v){ const i=shiftHeld.indexOf(v); if(i>=0)shiftHeld.splice(i,1); shiftHeld.push(v); setShift('key',v); }
function shiftKeyUp(v){ const i=shiftHeld.indexOf(v); if(i>=0)shiftHeld.splice(i,1); setShift('key',shiftHeld.length?shiftHeld[shiftHeld.length-1]:null); }
let holds={...HOLD_DEFAULT},capturing=null,holdPrior=null;
try{const old=localStorage.getItem('vh-holdkey');if(old)holds.flip=old;
  const h=JSON.parse(localStorage.getItem('vh-holds')||'null');if(h)holds={...holds,...h};}catch(e){}
const keyLabel=k=>({shift:'Shift',control:'Ctrl',alt:'Alt / Option',meta:'⌘ / Win',' ':'Space',tab:'Tab',capslock:'Caps Lock'})[k]||(k.length===1?k.toUpperCase():k[0].toUpperCase()+k.slice(1));
const actionFor=k=>Object.keys(holds).find(a=>holds[a]===k);
const isModHold=m=>Object.values(holds).includes(m);
function showHold(){
  for(const a in HOLD_BTN)$(HOLD_BTN[a]).textContent=capturing===a?'Press a key…':keyLabel(holds[a]);
  $('holdHintKey').textContent=keyLabel(holds.flip); $('pedalKeyHint').textContent=keyLabel(holds.pedal);
}
for(const a in HOLD_BTN)$(HOLD_BTN[a]).addEventListener('click',()=>{capturing=a;showHold()});
function releaseHold(){ if(holdPrior!==null){const p=holdPrior;holdPrior=null;setFlip(p)} }
const invHeld=[];
function invKeyDown(n){ if(!invHeld.includes(n)){invHeld.push(n);setInvSource('key',n)} }
function invKeyUp(n){ const i=invHeld.indexOf(n); if(i>=0)invHeld.splice(i,1); setInvSource('key',invHeld.length?invHeld[invHeld.length-1]:null); }
/* Hold-to-sound number keys */
let holdKeys=false;const heldDigits=[];
try{holdKeys=localStorage.getItem('vh-holdkeys')==='1'}catch(e){}
$('optHoldKeys').checked=holdKeys;
$('optHoldKeys').addEventListener('change',e=>{holdKeys=e.target.checked;heldDigits.length=0;
  try{localStorage.setItem('vh-holdkeys',holdKeys?'1':'0')}catch(err){}});

document.addEventListener('keyup',e=>{
  const act=actionFor(keyName(e));
  if(act==='flip') releaseHold();
  if(act==='flat') shiftKeyUp(-1);
  if(act==='sharp') shiftKeyUp(1);
  if(act==='inv1') invKeyUp(1);
  if(act==='inv2') invKeyUp(2);
  if(act==='pedal') setPedal('key',false);
  const dm=/^(?:Digit|Numpad)([1-7])$/.exec(e.code);
  if(dm){
    const d=+dm[1]-1,i=heldDigits.indexOf(d); if(i>=0)heldDigits.splice(i,1);
    if(holdKeys){ if(heldDigits.length)play(heldDigits[heldDigits.length-1]); else play(null); }
  }
});
addEventListener('blur',()=>{releaseHold(); setPedal('key',false); if(shiftHeld.length){shiftHeld.length=0;setShift('key',null)} if(invHeld.length){invHeld.length=0;setInvSource('key',null)} if(holdKeys&&heldDigits.length){heldDigits.length=0;play(null)}});
showHold();

/* Keyboard */
document.addEventListener('keydown',e=>{
  const k=keyName(e);
  if(capturing){
    e.preventDefault();e.stopPropagation();
    if(k!=='escape'){
      const clash=actionFor(k); if(clash&&clash!==capturing)holds[clash]=holds[capturing]; // swap if already used
      holds[capturing]=k;try{localStorage.setItem('vh-holds',JSON.stringify(holds));localStorage.removeItem('vh-holdkey')}catch(err){}
    }
    capturing=null;showHold();return;
  }
  if(e.target.closest('select,textarea,input[type=text],input[type=number]'))return; // typing in a field isn't playing
  const act=actionFor(k);
  if(act){
    e.preventDefault(); if(e.repeat)return;
    if(act==='flip'){ if(holdPrior===null){holdPrior=st.flip;setFlip(!st.flip)} }
    else if(act==='flat'||act==='sharp'){ audio.init(); shiftKeyDown(act==='flat'?-1:1); }
    else if(act==='pedal'){ audio.init(); setPedal('key',true); }
    else invKeyDown(act==='inv1'?1:2);
    return;
  }
  const blocked=(e.metaKey&&!isModHold('meta'))||(e.ctrlKey&&!isModHold('control'))||(e.altKey&&!isModHold('alt'));
  if(blocked||e.repeat)return;
  // Read digits from the physical key so they still work while Shift (or another hold key) is down
  const dm=/^(?:Digit|Numpad)([1-7])$/.exec(e.code);
  if(dm){
    const d=+dm[1]-1;audio.init();handOwnsChord=false;
    const i=heldDigits.indexOf(d); if(i>=0)heldDigits.splice(i,1); heldDigits.push(d);
    play(d,{retrigger:st.degree===d&&st.sounding});e.preventDefault();return}
  if(k===' '){looper.stop();play(null,{now:true});audio.damp();e.preventDefault();return}
  if(k==='c'){audio.init();looper.toggle();return}
  if(k==='f'){setFlip(!st.flip);return}
  if(k==='s'){setSevenths(!st.s7);return}
  if(k==='a'){setAlt7(!st.alt7);return}
  if(k==='['||k===']'){st.key=(st.key+(k===']'?1:11))%12;st.upper=[];refreshAfterChange();return}
  const v=VOICINGS.find(x=>x.key.toLowerCase()===k); if(v){audio.init();setVoicing(v.id)}
});
