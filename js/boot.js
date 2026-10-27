/* ---------- Boot ---------- */
buildPads();buildVoicings();buildSelects();buildSlots();buildRoutes();preview();
/* Tempo controls */
function syncTempoUI(){ $('bpm').value=st.bpm; $('bpmSlider').value=st.bpm; $('optSync').checked=st.sync; $('optClick').checked=st.click; $('vibDiv').value=st.vibDiv; $('vibDiv').disabled=!st.sync; }
function setBpm(b){ b=Math.round(Math.max(40,Math.min(240,b))); if(!b||b===st.bpm){syncTempoUI();return} st.bpm=b; syncTempoUI(); tempoChanged();
  if(audio.clickTimer){audio.stopClick();audio.startClick()} }
$('bpm').addEventListener('change',e=>setBpm(+e.target.value));
$('bpmSlider').addEventListener('input',e=>setBpm(+e.target.value));
$('optSync').addEventListener('change',e=>{st.sync=e.target.checked;syncTempoUI();tempoChanged()});
$('vibDiv').addEventListener('change',e=>{st.vibDiv=e.target.value;tempoChanged()});
$('optClick').addEventListener('change',e=>{audio.init();st.click=e.target.checked;st.click?audio.startClick():audio.stopClick()});
const taps=[];
$('tapBtn').addEventListener('click',()=>{
  const now=performance.now(); if(taps.length&&now-taps[taps.length-1]>2000)taps.length=0;
  taps.push(now); if(taps.length>5)taps.shift();
  const btn=$('tapBtn');btn.classList.add('tapping');setTimeout(()=>btn.classList.remove('tapping'),90);
  if(taps.length>=2){const avg=(taps[taps.length-1]-taps[0])/(taps.length-1);setBpm(60000/avg)}
});
syncTempoUI();

/* Presets: whole-setup snapshots kept in this browser */
// Presets that ship with the page (shown to everyone; a user preset with the same name takes its place)
const BUILTIN_PRESETS={"Default":{"key":0,"mode":"ionian","sound":"pad","voicing":"guitar","s7":false,"bass":true,"vl":true,"rh":true,"sevMode":"diatonic","invBase":0,"rhMap":["close","open","sus2","sus4","six"],"ctrl":{"volume":{"v":0.38,"src":"y","inv":false},"attack":{"v":0.706,"src":"none","inv":false},"decay":{"v":0.642,"src":"none","inv":false},"sustain":{"v":0.8,"src":"none","inv":false},"release":{"v":0.756,"src":"none","inv":false},"cutoff":{"v":0.604,"src":"x","inv":false},"resonance":{"v":0,"src":"none","inv":false},"vowel":{"v":0,"src":"none","inv":false},"highpass":{"v":0,"src":"none","inv":false},"reverb":{"v":0.535,"src":"dist","inv":false},"chorus":{"v":0,"src":"none","inv":false},"drive":{"v":0,"src":"none","inv":false},"detune":{"v":0,"src":"none","inv":false},"vibrato":{"v":0,"src":"none","inv":false},"strum":{"v":0,"src":"none","inv":false},"arp":{"v":0,"src":"none","inv":false}},"leanColor":true,"arpPattern":"updown","bpm":117,"sync":true,"vibDiv":"free","holds":{"flip":"shift","inv1":"z","inv2":"x"},"holdKeys":false,"rightOnly":false},"Default_Arpediate":{"key":0,"mode":"ionian","sound":"pad","voicing":"guitar","s7":true,"bass":true,"vl":true,"rh":true,"sevMode":"diatonic","invBase":0,"rhMap":["close","open","sus2","sus4","six"],"ctrl":{"volume":{"v":0.449,"src":"y","inv":false},"attack":{"v":0.706,"src":"none","inv":false},"decay":{"v":0.642,"src":"none","inv":false},"sustain":{"v":0.8,"src":"none","inv":false},"release":{"v":0.756,"src":"none","inv":false},"cutoff":{"v":0.46,"src":"x","inv":false},"resonance":{"v":0,"src":"none","inv":false},"vowel":{"v":0,"src":"none","inv":false},"highpass":{"v":0,"src":"none","inv":false},"reverb":{"v":0.33,"src":"dist","inv":false},"chorus":{"v":0,"src":"none","inv":false},"drive":{"v":0,"src":"none","inv":false},"detune":{"v":0,"src":"none","inv":false},"vibrato":{"v":0,"src":"none","inv":false},"strum":{"v":0,"src":"none","inv":false},"arp":{"v":0.275,"src":"none","inv":false}},"leanColor":true,"arpPattern":"updown","bpm":117,"sync":true,"vibDiv":"free","holds":{"flip":"shift","inv1":"z","inv2":"x"},"holdKeys":false,"rightOnly":false}};
const SOUND_BOOLS=['s7','bass','vl','pure'], HAND_BOOLS=['rh','rightOnly','handInv','fast'];
// Built-in hand setups (sound presets above keep only their musical settings now)
const BUILTIN_HANDS={
  "Default":{rhMap:["close","open","sus2","sus4","six"],left67:"chinese",leftTwist:"flip",palmShift:"flat",leanColor:true,rh:true,rightOnly:false,handInv:true,fast:false,
    holds:{...HOLD_DEFAULT},holdKeys:false,posV:.444,src:{volume:{src:"y",inv:false},cutoff:{src:"x",inv:false},reverb:{src:"dist",inv:false},position:{src:"lx",inv:false}}},
  // Homage to Eric Wei's Gesture Synth: twist for major ↔ minor, right-hand twist for maj7 ↔ 7, horns / ILY for 6 / 7
  "Eric Wei":{rhMap:["close","close","open","drop2","dim"],left67:"horns",leftTwist:"dir",palmShift:"off",leanColor:true,rh:true,rightOnly:false,handInv:false,fast:false,
    pure:true,sevMode:"twistE",
    holds:{...HOLD_DEFAULT},holdKeys:false,posV:.444,src:{volume:{src:"y",inv:false},cutoff:{src:"x",inv:false},reverb:{src:"dist",inv:false},position:{src:"lx",inv:false}}},
  "Keys + right hand":{rhMap:["close","open","sus2","sus4","six"],left67:"chinese",leftTwist:"flip",palmShift:"off",leanColor:true,rh:true,rightOnly:true,handInv:false,fast:false,
    holds:{...HOLD_DEFAULT},holdKeys:false,posV:.444,src:{volume:{src:"y",inv:false},cutoff:{src:"x",inv:false},reverb:{src:"dist",inv:false},position:{src:"lean",inv:false}}}
};
function loadBank(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch(e){return {}}}
function storeBank(key,p){try{localStorage.setItem(key,JSON.stringify(p));return true}catch(e){return false}}
const loadPresets=()=>loadBank('vh-presets'), storePresets=p=>storeBank('vh-presets',p);
let activePreset=null, activeHands=null;

/* ----- Sound presets ----- */
function captureSound(){
  const vals={}; for(const k in TARGETS)if(k!=='position'&&k!=='bend')vals[k]={v:st.ctrl[k].v};
  return {key:st.key,mode:st.mode,sound:st.sound,voicing:st.voicing,s7:st.s7,bass:st.bass,vl:st.vl,pure:st.pure,
    sevMode:st.sevMode,invBase:st.invBase,shiftQual:st.shiftQual,ctrl:vals,
    arpPattern:audio.arpPattern,strumDir:audio.strumDir,bendRange:midiOut.bendRange,bpm:st.bpm,meter:st.meter,sync:st.sync,vibDiv:st.vibDiv,fx:{...st.fx},saved:Date.now()};
}
function applySound(c){
  const ok=(v,test)=>v!==undefined&&test(v);
  if(ok(c.key,v=>v>=0&&v<12))st.key=c.key;
  if(ok(c.mode,v=>MODES[v]))st.mode=c.mode;
  if(ok(c.sound,v=>SOUNDS[v])&&c.sound!==st.sound){audio.allOff();st.sound=c.sound}
  if(ok(c.voicing,v=>VOICINGS.some(x=>x.id===v)))st.voicing=c.voicing;
  for(const k of SOUND_BOOLS)if(typeof c[k]==='boolean')st[k]=c[k];
  if(c.shiftQual==='common'||c.shiftQual==='keep')st.shiftQual=c.shiftQual;
  if(ok(c.sevMode,v=>['maj','diatonic','twist','twistE'].includes(v)))st.sevMode=c.sevMode;
  if(ok(c.invBase,v=>v>=0&&v<=3))st.invBase=c.invBase;
  // Knob values only: which hand movement drives each knob belongs to the hand setup
  if(c.ctrl&&typeof c.ctrl==='object')for(const k in TARGETS)if(k!=='position'&&k!=='bend'&&c.ctrl[k]&&c.ctrl[k].v!==undefined)st.ctrl[k].v=clamp01(+c.ctrl[k].v||0);
  if(ok(c.arpPattern,v=>['up','down','updown','random'].includes(v)))audio.arpPattern=c.arpPattern;
  audio.strumDir=['up','down','alt'].includes(c.strumDir)?c.strumDir:'up'; $('strumDir').value=audio.strumDir; try{localStorage.setItem('vh-strumdir',audio.strumDir)}catch(e){}
  if([1,2,7,12].includes(c.bendRange)&&c.bendRange!==midiOut.bendRange){const s=$('midiBendRange');s.value=String(c.bendRange);s.dispatchEvent(new Event('change'))}
  if(ok(c.bpm,v=>v>=40&&v<=240))st.bpm=c.bpm;
  if(METERS[c.meter]&&c.meter!==st.meter){const s=$('loopMeter');s.value=c.meter;s.dispatchEvent(new Event('change'))}
  if(typeof c.sync==='boolean')st.sync=c.sync;
  if(ok(c.vibDiv,v=>v==='free'||DIVS.some(d=>d[0]===v)))st.vibDiv=c.vibDiv;
  if(c.fx&&typeof c.fx==='object'){Object.assign(st.fx,c.fx);saveFx();syncFxUI();audio.setReverbType(st.fx.reverbType);setTimeFx()}
  SCALE=MODES[st.mode].steps;
  $('keySel').value=st.key;$('modeSel').value=st.mode;$('soundSel').value=st.sound;
  $('optVL').checked=st.vl;$('opt7').checked=st.s7;$('optBass').checked=st.bass;$('optPure').checked=st.pure;
  $('sevSel').value=st.sevMode;$('invSel').value=st.invBase;$('arpPat').value=audio.arpPattern;$('shiftQualSel').value=st.shiftQual;
  syncTempoUI();syncSevUI();
  try{localStorage.setItem('vh-mode',st.mode);localStorage.setItem('vh-sevmode',st.sevMode);localStorage.setItem('vh-arppat',audio.arpPattern);
    localStorage.setItem('vh-pure',st.pure?'1':'0');localStorage.setItem('vh-shiftqual',st.shiftQual);saveRoutes();saveTempo();}catch(e){}
  st.upper=[];
  applyAllRoutes();setVibRate();showRouteVals();
  refreshAfterChange();render();
}
const soundSummary=c=>[pcName(KEYS[c.key]?.[0]??0)+' '+(MODES[c.mode]?.name||''),SOUNDS[c.sound]?.label,VOICINGS.find(v=>v.id===c.voicing)?.name,c.bpm+' BPM'].filter(Boolean).join(' · ');

/* ----- Hand setups ----- */
function captureHands(){
  const src={}; for(const k in TARGETS)src[k]={src:st.ctrl[k].src,inv:st.ctrl[k].inv};
  return {pedalHand:st.pedalHand,rhMap:[...st.rhMap],left67:st.left67,leftTwist:st.leftTwist,palmShift:st.palmShift,leanColor:st.leanColor,rh:st.rh,rightOnly:st.rightOnly,
    handInv:st.handInv,fast:st.fast,holds:{...holds},holdKeys,posV:st.ctrl.position.v,src,saved:Date.now()};
}
function applyHands(h){
  if(Array.isArray(h.rhMap)&&h.rhMap.length===5&&h.rhMap.every(id=>VOICINGS.some(v=>v.id===id)))st.rhMap=[...h.rhMap];
  if(['chinese','horns','asl'].includes(h.left67))st.left67=h.left67;
  if(h.leftTwist==='flip'||h.leftTwist==='dir')st.leftTwist=h.leftTwist;
  st.pedalHand=h.pedalHand==='fist'?'fist':'off'; if(st.pedalHand==='off')setPedal('hand',false);
  if(['flat','sharp','off'].includes(h.palmShift))st.palmShift=h.palmShift;
  if(typeof h.leanColor==='boolean')st.leanColor=h.leanColor;
  for(const k of HAND_BOOLS)if(typeof h[k]==='boolean')st[k]=h[k];
  if(h.holds&&typeof h.holds==='object')holds={...HOLD_DEFAULT,...h.holds};
  if(typeof h.holdKeys==='boolean')holdKeys=h.holdKeys;
  if(h.src&&typeof h.src==='object')for(const k in TARGETS){const x=h.src[k]||{src:'none',inv:false};st.ctrl[k].src=INPUTS[x.src]?x.src:'none';st.ctrl[k].inv=!!x.inv}
  if(typeof h.posV==='number')st.ctrl.position.v=clamp01(h.posV);
  // A few setups also set chord style (e.g. "Eric Wei": Pure maj/min with Major 7th); this overrides the sound preset
  if(typeof h.pure==='boolean'){st.pure=h.pure;$('optPure').checked=st.pure;try{localStorage.setItem('vh-pure',st.pure?'1':'0')}catch(e){}}
  if(['maj','diatonic','twist','twistE'].includes(h.sevMode)){st.sevMode=h.sevMode;try{localStorage.setItem('vh-sevmode',st.sevMode)}catch(e){}}
  st.upper=[];
  if(st.palmShift==='off'||!stab.L.back){stab.L.back=false;setShift('palm',null)}
  if(!st.handInv){stab.L.zone=undefined;setInvSource('hand',null)}
  if(!st.leanColor&&st.alt7)setAlt7(false);
  $('optRH').checked=st.rh;$('optRightOnly').checked=st.rightOnly;$('optHandInv').checked=st.handInv;$('optFast').checked=st.fast;if(!(st.sevMode==='twist'||st.sevMode==='twistE')&&st.sevForce)setSevForce(null);
  $('optHoldKeys').checked=holdKeys;$('palmSel').value=st.palmShift;$('left67Sel').value=st.left67;$('leftTwistSel').value=st.leftTwist;$('pedalHandSel').value=st.pedalHand;
  showHold();buildSlots();buildRoutes();syncSevUI();syncLeftGuide();
  try{localStorage.setItem('vh-rhmap',JSON.stringify(st.rhMap));localStorage.setItem('vh-holds',JSON.stringify(holds));localStorage.setItem('vh-holdkeys',holdKeys?'1':'0');
    localStorage.setItem('vh-rightonly',st.rightOnly?'1':'0');localStorage.setItem('vh-handinv',st.handInv?'1':'0');localStorage.setItem('vh-fast',st.fast?'1':'0');
    localStorage.setItem('vh-palm',st.palmShift);localStorage.setItem('vh-left67',st.left67);localStorage.setItem('vh-lefttwist',st.leftTwist);localStorage.setItem('vh-pedalhand',st.pedalHand);saveRoutes();}catch(e){}
  applyCtrl('position');refreshAfterChange();render();ensureTrackerHands();
}
const L67NAME={chinese:'Chinese 6/7',horns:'Horns / ILY 6/7',asl:'ASL 6/7'};
const handSummary=h=>{const n=h.src?Object.values(h.src).filter(x=>x&&x.src&&x.src!=='none').length:0;
  return [h.rightOnly?'Keys + right hand':'Both hands',L67NAME[h.left67]||'',h.pure?'Pure maj/min':'',n+' hand control'+(n===1?'':'s')].filter(Boolean).join(' · ')};

/* ----- One preset row, used twice ----- */
function presetMsg(t){$('presetMsg').textContent=t}
function makeBank(o){
  const render=()=>{
    const mine=loadBank(o.key),all={...o.builtins,...mine},list=$(o.list);list.innerHTML='';
    const builtinOnly=n=>o.builtins[n]&&!mine[n];
    const names=[...Object.keys(o.builtins),...Object.keys(mine).filter(n=>!o.builtins[n]).sort((a,b)=>(mine[b].saved||0)-(mine[a].saved||0))];
    names.forEach(name=>{
      const c=all[name],row=document.createElement('div');row.className='prow'+(name===o.active()?' active':'');
      const load=document.createElement('button');load.type='button';load.className='pload';
      load.textContent=name;const sm=document.createElement('small');sm.textContent=(builtinOnly(name)?'Included · ':'')+o.summary(c);load.appendChild(sm);
      load.title=sm.textContent; if(builtinOnly(name))row.classList.add('builtin');
      load.addEventListener('click',()=>{audio.init();o.apply(c);o.setActive(name);$(o.name).value=name;render();presetMsg(`Loaded ${o.noun} "${name}".`)});
      row.appendChild(load);
      if(!builtinOnly(name)){
        const del=document.createElement('button');del.type='button';del.className='pdel';del.textContent='Delete';del.setAttribute('aria-label','Delete '+name);
        let armed=null;
        del.addEventListener('click',()=>{
          if(!armed){del.textContent='Confirm';del.classList.add('confirm');armed=setTimeout(()=>{armed=null;del.textContent='Delete';del.classList.remove('confirm')},3000);return}
          clearTimeout(armed);const m=loadBank(o.key);delete m[name];storeBank(o.key,m);if(o.active()===name)o.setActive(null);render();presetMsg(`Deleted ${o.noun} "${name}".`);
        });
        row.appendChild(del);
      }
      list.appendChild(row);
    });
  };
  $(o.form).addEventListener('submit',e=>{
    e.preventDefault();const name=$(o.name).value.trim();
    if(!name){presetMsg(`Type a name for this ${o.noun} first.`);$(o.name).focus();return}
    const m=loadBank(o.key),existed=!!m[name];m[name]=o.capture();
    if(!storeBank(o.key,m)){presetMsg('Couldn’t save here: this browser is blocking storage for the page.');return}
    o.setActive(name);render();presetMsg(existed?`Updated ${o.noun} "${name}".`:`Saved ${o.noun} "${name}".`);
  });
  render(); return render;
}
// Left-hand 6/7 shape picker
const L67GUIDE={chinese:['thumb + pinky 🤙','thumb + index (L)'],horns:['index + pinky 🤘 (horns)','index + pinky + thumb 🤟 (ILY)'],asl:['thumb touches pinky tip (3 up)','thumb touches ring tip (3 up)']};
function syncLeftGuide(){const g=L67GUIDE[st.left67];$('g6t').textContent=g[0];$('g7t').textContent=g[1];}
try{const v=localStorage.getItem('vh-left67');if(L67GUIDE[v])st.left67=v;const t=localStorage.getItem('vh-lefttwist');if(t==='flip'||t==='dir')st.leftTwist=t}catch(e){}
try{if(localStorage.getItem('vh-pedalhand')==='fist')st.pedalHand='fist'}catch(e){}
$('pedalHandSel').value=st.pedalHand;
$('pedalHandSel').addEventListener('change',e=>{st.pedalHand=e.target.value;if(st.pedalHand==='off')setPedal('hand',false);
  try{localStorage.setItem('vh-pedalhand',st.pedalHand)}catch(err){} ensureTrackerHands();});
$('leftTwistSel').value=st.leftTwist;
$('leftTwistSel').addEventListener('change',e=>{st.leftTwist=e.target.value;try{localStorage.setItem('vh-lefttwist',st.leftTwist)}catch(err){}});
$('left67Sel').value=st.left67;syncLeftGuide();
$('left67Sel').addEventListener('change',e=>{st.left67=e.target.value;try{localStorage.setItem('vh-left67',st.left67)}catch(err){}syncLeftGuide()});
const renderPresets=makeBank({key:'vh-presets',builtins:BUILTIN_PRESETS,list:'presetList',form:'presetForm',name:'presetName',noun:'sound preset',
  capture:captureSound,apply:applySound,summary:soundSummary,active:()=>activePreset,setActive:n=>{activePreset=n}});
const renderHands=makeBank({key:'vh-hands',builtins:BUILTIN_HANDS,list:'handList',form:'handForm',name:'handName',noun:'hand setup',
  capture:captureHands,apply:applyHands,summary:handSummary,active:()=>activeHands,setActive:n=>{activeHands=n}});
// First visit: start from the included "Default" sound and "Default" hand setup
let firstVisit=false;
try{ if(!localStorage.getItem('vh-visited')){ localStorage.setItem('vh-visited','1'); firstVisit=true;
  if(!localStorage.getItem('vh-ctrl')&&!localStorage.getItem('vh-presets')){
    applyHands(BUILTIN_HANDS.Default);activeHands='Default';applySound(BUILTIN_PRESETS.Default);activePreset='Default';renderPresets();renderHands()} } }catch(e){}
$('presetExport').addEventListener('click',()=>{
  const p=loadBank('vh-presets'),h=loadBank('vh-hands'),np=Object.keys(p).length,nh=Object.keys(h).length,ta=$('presetJson');
  if(!np&&!nh){presetMsg('There are no saved presets or hand setups to copy yet.');return}
  ta.value=JSON.stringify({voicingHandsPresets:2,presets:p,hands:h});
  const what=`${np} sound preset${np===1?'':'s'} and ${nh} hand setup${nh===1?'':'s'}`;
  const fallback=()=>{ta.focus();ta.select();presetMsg(`Selected ${what}. Press Ctrl+C or ⌘C to copy.`)};
  try{navigator.clipboard.writeText(ta.value).then(()=>presetMsg(`Copied ${what}. Paste them anywhere to share or back them up.`),fallback)}catch(e){fallback()}
});
$('presetImport').addEventListener('click',()=>{
  let data;try{data=JSON.parse($('presetJson').value)}catch(e){presetMsg('That text isn’t a presets export. Copy it again with "Copy all presets & hand setups".');return}
  const sp=data&&data.presets&&typeof data.presets==='object'?data.presets:(data&&!data.hands?data:{});
  const hs=data&&data.hands&&typeof data.hands==='object'?data.hands:{};
  const sn=Object.keys(sp||{}).filter(k=>sp[k]&&typeof sp[k]==='object'&&sp[k].key!==undefined);
  const hn=Object.keys(hs).filter(k=>hs[k]&&typeof hs[k]==='object'&&Array.isArray(hs[k].rhMap));
  if(!sn.length&&!hn.length){presetMsg('No presets or hand setups found in that text.');return}
  const p=loadBank('vh-presets');sn.forEach(k=>p[k]=sp[k]);const h=loadBank('vh-hands');hn.forEach(k=>h[k]=hs[k]);
  if(!storeBank('vh-presets',p)||!storeBank('vh-hands',h)){presetMsg('Couldn’t save here: this browser is blocking storage for the page.');return}
  renderPresets();renderHands();presetMsg(`Imported ${sn.length} sound preset${sn.length===1?'':'s'} and ${hn.length} hand setup${hn.length===1?'':'s'}.`);
});

// Diagnostics controls
{const at=audio.arpTick.bind(audio); audio.arpTick=()=>timed('arpeggiator',at);}
$('trackSel').value=trackDelegate;
$('trackSel').addEventListener('change',async e=>{trackDelegate=e.target.value;try{localStorage.setItem('vh-delegate',trackDelegate)}catch(err){}
  renderDiag(); if(cam.on&&cam.vision){camMsg('Switching hand tracking to '+trackDelegate+'…');try{await loadTracker();camMsg('')}catch(err){camMsg('Couldn’t switch hand tracking: '+err.message)}}});
$('diagClear').addEventListener('click',()=>{diag.log=[];diag.stalls=0;diag.stutters=0;renderDiag()});
$('diagCopy').addEventListener('click',()=>{
  const lines=['Synth Conductor diagnostics','Browser: '+navigator.userAgent,'Hand tracking: '+(cam.delegate||trackDelegate)+(cam.inWorker?' (background worker)':cam.ready?' (on the page)':''),
    `Tracking looks for ${cam.numHands||'?'} hand(s)`,
    `Settings: ${SOUNDS[st.sound].label} · voicing ${st.voicing} · arp ${st.ctrl.arp.v>=.03?'on':'off'} · right hand only ${st.rightOnly} · fast ${st.fast} · position ${st.ctrl.position.v>=.03?'on':'off'}`,
    'Latency: '+($('latency').textContent||'n/a'),'',...diag.log.map(e=>`${e.time} | ${e.msg} | ${e.ctx}`)];
  const text=lines.join('\n');
  const ta=$('presetJson'); ta.value=text;
  const ok=()=>{$('diagSummary').textContent='Report copied. Paste it to Claude.'};
  const fallback=()=>{$('s-diag').open=true;document.querySelector('#s-diag').scrollIntoView({block:'nearest'});ta.closest('details').open=true;ta.focus();ta.select();$('diagSummary').textContent='Report selected in the presets text box. Press Ctrl+C to copy.'};
  try{navigator.clipboard.writeText(text).then(ok,fallback)}catch(err){fallback()}
});
renderDiag();

// Arpeggiator controls
function syncSevUI(){ // "Major 7th" needs Lean color to reach the ♭7; without it that type follows the key
  const s=$('sevSel'); s.disabled=false; s.value=st.sevMode;
  $('sevNote').hidden=st.leanColor||st.sevMode!=='maj';
}
try{const v=localStorage.getItem('vh-palm');if(['flat','sharp','off'].includes(v))st.palmShift=v;
  const q=localStorage.getItem('vh-shiftqual');if(q==='common'||q==='keep')st.shiftQual=q;}catch(e){}
$('palmSel').value=st.palmShift;$('shiftQualSel').value=st.shiftQual;
$('palmSel').addEventListener('change',e=>{st.palmShift=e.target.value;try{localStorage.setItem('vh-palm',st.palmShift)}catch(err){}
  const sL=stab.L; if(st.palmShift==='off'||!sL.back){sL.back=false;setShift('palm',null)} else setShift('palm',st.palmShift==='flat'?-1:1);});
$('shiftQualSel').addEventListener('change',e=>{st.shiftQual=e.target.value;try{localStorage.setItem('vh-shiftqual',st.shiftQual)}catch(err){}
  if(shiftAmt())refreshAfterChange(); render();});
try{st.pure=localStorage.getItem('vh-pure')==='1';st.fast=localStorage.getItem('vh-fast')==='1'}catch(e){}
$('optFast').checked=st.fast;
$('optFast').addEventListener('change',e=>{st.fast=e.target.checked;try{localStorage.setItem('vh-fast',st.fast?'1':'0')}catch(err){}});
function syncFxUI(){$('verbType').value=st.fx.reverbType;$('tremDiv').value=st.fx.tremDiv;$('delayDiv').value=st.fx.delayDiv;}
syncFxUI();
$('verbType').addEventListener('change',e=>{st.fx.reverbType=e.target.value;saveFx();audio.setReverbType(st.fx.reverbType)});
$('tremDiv').addEventListener('change',e=>{st.fx.tremDiv=e.target.value;saveFx();setTimeFx()});
$('delayDiv').addEventListener('change',e=>{st.fx.delayDiv=e.target.value;saveFx();setTimeFx()});
$('optPure').checked=st.pure;
$('optPure').addEventListener('change',e=>{st.pure=e.target.checked;try{localStorage.setItem('vh-pure',st.pure?'1':'0')}catch(err){}
  st.upper=[];refreshAfterChange();render();});
try{const h=localStorage.getItem('vh-handinv');if(h!==null)st.handInv=h==='1'}catch(e){}
$('optHandInv').checked=st.handInv;
$('optHandInv').addEventListener('change',e=>{st.handInv=e.target.checked;try{localStorage.setItem('vh-handinv',st.handInv?'1':'0')}catch(err){}
  if(!st.handInv){stab.L.zone=undefined;stab.L.zoneCand=undefined;setInvSource('hand',null)}});
$('optPos').addEventListener('change',e=>{audio.init();const c=st.ctrl.position;
  if(e.target.checked){const [src,inv]=(st.posSrcMem||'lx').split(':');c.src=src;c.inv=inv==='i';if(c.v<.03)c.v=.444}
  else{if(c.src!=='none')st.posSrcMem=c.src+(c.inv?':i':'');c.src='none';c.inv=false;c.v=0}
  applyCtrl('position');showRouteVals();saveRoutes();});
$('optLeanColor').addEventListener('change',e=>{st.leanColor=e.target.checked;
  if(!st.leanColor&&st.alt7)st.alt7=false,$('optAlt7').checked=false;
  syncSevUI();saveRoutes();refreshAfterChange();render();});
syncSevUI();
try{const pt=localStorage.getItem('vh-arppat');if(pt)audio.arpPattern=pt}catch(e){}
try{const sd=localStorage.getItem('vh-strumdir');if(['up','down','alt'].includes(sd))audio.strumDir=sd}catch(e){}
$('strumDir').value=audio.strumDir;
$('strumDir').addEventListener('change',e=>{audio.strumDir=e.target.value;audio.strumFlip=false;try{localStorage.setItem('vh-strumdir',audio.strumDir)}catch(err){}});
$('arpPat').value=audio.arpPattern;
$('arpPat').addEventListener('change',e=>{audio.arpPattern=e.target.value;try{localStorage.setItem('vh-arppat',audio.arpPattern)}catch(err){}});
// Remember which sections are open
document.querySelectorAll('details.sect').forEach(dt=>{
  try{const v=localStorage.getItem('vh-open-'+dt.id);if(v!==null)dt.open=v==='1'}catch(e){}
  dt.addEventListener('toggle',()=>{try{localStorage.setItem('vh-open-'+dt.id,dt.open?'1':'0')}catch(e){}});
});
// draw idle stage art when camera is off
function idleStage(){
  if(cam.on)return;
  const rect=cv.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  cv.width=Math.round(rect.width*dpr);cv.height=Math.round(rect.height*dpr);
  g.clearRect(0,0,cv.width,cv.height);
  g.strokeStyle='rgba(214,171,82,.10)';g.lineWidth=1*dpr;
  for(let i=0;i<5;i++){const y=cv.height*.18+i*cv.height*.06;g.beginPath();g.moveTo(cv.width*.06,y);g.lineTo(cv.width*.94,y);g.stroke()}
}
idleStage();addEventListener('resize',idleStage);

// Phones pause sound for calls, Siri and the lock screen: once it has started, any tap brings it back
for(const ev of ['pointerdown','touchend','keydown'])
  addEventListener(ev,()=>{ if(audio.ctx&&audio.ctx.state!=='running')audio.init(); },{capture:true,passive:true});
// Problems on devices we can't test: show script errors where people will see them, so they can report them
const errSeen=new Set();
function showError(msg,where){ const t=`Something went wrong: ${msg}${where?' ('+where+')':''}`; if(errSeen.has(t))return; errSeen.add(t);
  camMsg([...errSeen].slice(-3).join('\n')); }
addEventListener('error',e=>showError(e.message||String(e.error),e.filename?e.filename.split('/').pop()+':'+e.lineno:''));
(window.vhErrors||[]).forEach(([m,w])=>showError(m,w));
addEventListener('unhandledrejection',e=>showError(e.reason&&e.reason.message||String(e.reason),'promise'));
// Sound check: tap the status line for a plain beep straight to the speaker, skipping every effect, plus what the browser reports
$('statusText').title='Tap for a sound check';
$('statusText').style.cursor='pointer';
$('statusText').addEventListener('click',()=>{
  audio.init(); const c=audio.ctx;
  try{ const o=c.createOscillator(), g=c.createGain(), t=c.currentTime+.02; o.frequency.value=660;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.3,t+.01); g.gain.setValueAtTime(.3,t+.35); g.gain.linearRampToValueAtTime(0,t+.4);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+.45); }catch(e){ showError(e.message,'sound check'); return; }
  setTimeout(()=>camMsg(`Sound check: played a beep. Audio is ${c.state}, ${c.sampleRate} Hz, `+
    `${navigator.audioSession?'audio session '+navigator.audioSession.type:'no audio session setting'}, `+
    `built-in sound ${midiOut.mute?'muted':'on'}, volume knob ${Math.round(st.ctrl.volume.v*100)}%, `+
    `${audio.voices.size} note${audio.voices.size===1?'':'s'} held. If you heard nothing, check the volume buttons and Bluetooth.`),500);
});
// Diagnostics are a troubleshooting tool, hidden until turned on
{ const tg=document.getElementById('diagToggle'), sec=document.getElementById('s-diag'), latEl=document.getElementById('latency');
  let on=false; try{on=localStorage.getItem('vh-diag')==='1'}catch(e){}
  const show=v=>{tg.checked=v; sec.hidden=!v; latEl.hidden=!v; try{localStorage.setItem('vh-diag',v?'1':'0')}catch(e){}};
  show(on); tg.addEventListener('change',()=>show(tg.checked)); }

/* Full screen. Uses the browser's real full screen where it exists; iPhone Safari has none for pages, so there the stage just fills the window */
let fullApi=false;
function setFull(on){
  if(document.body.classList.contains('full')===on)return;
  document.body.classList.toggle('full',on);
  $('fullBtn').textContent=on?'Exit':'Full screen'; $('fullBtn').setAttribute('aria-pressed',on);
  const el=document.documentElement, req=el.requestFullscreen||el.webkitRequestFullscreen;
  if(on&&req&&!document.fullscreenElement){ fullApi=true; Promise.resolve(req.call(el,{navigationUI:'hide'})).catch(()=>{fullApi=false}); }
  if(!on&&fullApi){ fullApi=false; const ex=document.exitFullscreen||document.webkitExitFullscreen; if(ex&&(document.fullscreenElement||document.webkitFullscreenElement))Promise.resolve(ex.call(document)).catch(()=>{}); }
  if(on)scrollTo(0,0);
  dispatchEvent(new Event('resize'));
}
$('optRightOnly').addEventListener('change',()=>document.body.classList.toggle('rh-only',st.rightOnly));
// Sideways with the number pad showing, the pedal sits in the pad beside Stop; everywhere else it goes back to the button row
const sidewaysMQ=matchMedia('(orientation:landscape) and (max-height:560px)'), pedalHome=$('pedalBtn').nextElementSibling;
function placePedal(){
  const b=$('pedalBtn'), inPad=document.body.classList.contains('full')&&st.rightOnly&&sidewaysMQ.matches;
  if(inPad&&b.parentNode!==padsEl)padsEl.appendChild(b);
  else if(!inPad&&b.parentNode===padsEl)pedalHome.before(b);
}
(sidewaysMQ.addEventListener?sidewaysMQ.addEventListener('change',placePedal):sidewaysMQ.addListener(placePedal));
new MutationObserver(placePedal).observe(document.body,{attributes:true,attributeFilter:['class']});
$('fullBtn').addEventListener('click',()=>setFull(!document.body.classList.contains('full')));
// Leaving the browser's full screen (Esc, swipe) leaves ours too
['fullscreenchange','webkitfullscreenchange'].forEach(t=>document.addEventListener(t,()=>{ if(fullApi&&!(document.fullscreenElement||document.webkitFullscreenElement)){fullApi=false;setFull(false)} }));
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&document.body.classList.contains('full'))setFull(false); });
// Which side the phone's lens is on when it's sideways: turned left (top of the phone to the left) puts it on the left
function camSide(){
  const t=screen.orientation&&screen.orientation.type, o=window.orientation;
  const right=t?t==='landscape-secondary':o===-90;
  document.body.classList.toggle('cam-right',right);
}
camSide();
if(screen.orientation&&screen.orientation.addEventListener)screen.orientation.addEventListener('change',camSide);
addEventListener('orientationchange',camSide); addEventListener('resize',camSide);
