/* ---------- Mod matrix: rows of source → knob, amount ----------
   Each row pushes a knob up or down from where you set it, so several sources can stack on one knob and one
   source can move several knobs. Hand movements and the chord envelope push one way (amount sets which);
   the LFOs and Random swing both ways around the knob. Runs about 40 times a second while any row is on. */
const MOD_SRC=[
  ['lfo1','LFO 1'],['lfo2','LFO 2'],['env','Chord envelope'],['rand','Random, each beat'],
  ['x','Right hand ← →'],['y','Right hand height'],['lean','Right hand lean'],['tilt','Right hand tilt'],['dist','Right hand push'],['roll','Palm roll'],['lx','Left hand ← →'],
];
const MOD_BIPOLAR=new Set(['lfo1','lfo2','rand']);
const MOD_RATES=[['4bar','4 bars',{bars:4}],['2bar','2 bars',{bars:2}],['1bar','1 bar',{bars:1}],['1/2','1/2 note',{beats:2}],['1/4','1/4 note',{beats:1}],
  ['1/8','1/8 note',{beats:.5}],['1/16','1/16 note',{beats:.25}],['0.1','0.1 Hz',{hz:.1}],['0.3','0.3 Hz',{hz:.3}],['1','1 Hz',{hz:1}],['3','3 Hz',{hz:3}],['7','7 Hz',{hz:7}]];
const MOD_SHAPES=[['sine','Sine'],['tri','Triangle'],['square','Square'],['saw','Saw up'],['ramp','Saw down'],['sh','Random steps']];
// Knobs it can move, grouped the way the panels are. Position and Arp rate re-voice the chord, so they stay out
const MOD_GROUPS=[['Amp & tone',['volume','bass','mid','treble','attack','decay','sustain','release']],['Filter',['cutoff','resonance','highpass','vowel']],
  ['Effects',['reverb','chorus','pedal','drive','phaser','flanger']],['Modulation',['bend','detune','vibrato','tremolo','autopan','rotary']],['Timing',['pump','delay','feedback','strum']]];
const MOD_DST=MOD_GROUPS.flatMap(g=>g[1]);
const MOD_MAX_ROWS=8;
const MATRIX_DEFAULT=()=>({on:true,rows:[],lfo:[{rate:'1bar',shape:'sine'},{rate:'1/4',shape:'tri'}],env:{a:.02,d:.8}});
let matrix=MATRIX_DEFAULT();

function matrixClean(m){ const d=MATRIX_DEFAULT(); if(!m||typeof m!=='object')return d;
  const rate=r=>MOD_RATES.some(x=>x[0]===r)?r:'1bar', shape=s=>MOD_SHAPES.some(x=>x[0]===s)?s:'sine', num=(v,lo,hi,f)=>typeof v==='number'&&isFinite(v)?Math.max(lo,Math.min(hi,v)):f;
  return {on:m.on!==false,
    rows:(Array.isArray(m.rows)?m.rows:[]).filter(r=>r&&MOD_SRC.some(x=>x[0]===r.src)&&MOD_DST.includes(r.dst)).slice(0,MOD_MAX_ROWS)
      .map(r=>({src:r.src,dst:r.dst,amt:num(r.amt,-1,1,.3)})),
    lfo:[0,1].map(i=>({rate:rate(m.lfo?.[i]?.rate??d.lfo[i].rate),shape:shape(m.lfo?.[i]?.shape??d.lfo[i].shape)})),
    env:{a:num(m.env?.a,0,2,d.env.a),d:num(m.env?.d,.05,4,d.env.d)}}; }
try{ matrix=matrixClean(JSON.parse(localStorage.getItem('vh-matrix')||'null')); }catch(e){}
const matrixSave=()=>{ try{localStorage.setItem('vh-matrix',JSON.stringify(matrix))}catch(e){} };
const matrixCapture=()=>JSON.parse(JSON.stringify(matrix));
const modSrcName=k=>(MOD_SRC.find(x=>x[0]===k)||[k,k])[1], modDstName=k=>KSHORT[k]&&KSHORT[k].length>2?KSHORT[k]:TARGETS[k]?.label||k;
const matrixSummary=m=>{ const r=(m.rows||[]).map(x=>`${modSrcName(x.src)} → ${modDstName(x.dst)}`);
  return r.length?`${r.length} row${r.length>1?'s':''}: ${r.slice(0,3).join(', ')}${r.length>3?' …':''}`:'No rows'; };
function matrixApply(m){ matrix=matrixClean(m); matrixSave(); matrixBuild(); matrixRun(); }

/* Sources */
const modNow=()=>audio.ctx&&audio.ctx.state==='running'?audio.ctx.currentTime-audio.t0:performance.now()/1000;   // the audio clock, so tempo rates sit on the beat grid
const hash01=n=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x)};
function lfoVal(i,t){ const L=matrix.lfo[i], R=(MOD_RATES.find(x=>x[0]===L.rate)||MOD_RATES[2])[2];
  const cyc=R.hz?t*R.hz:t/(beatSec()*(R.beats??R.bars*meterOf().bar)), p=cyc-Math.floor(cyc);   // tempo rates follow the beat grid
  switch(L.shape){ case 'tri':return 1-4*Math.abs(p-.5); case 'square':return p<.5?1:-1; case 'saw':return 2*p-1; case 'ramp':return 1-2*p;
    case 'sh':return hash01(Math.floor(cyc)+i*997)*2-1; default:return Math.sin(p*2*Math.PI); } }
const modEnv={seq:-1,t0:0};
function envVal(t){ if(st.chordSeq!==modEnv.seq){modEnv.seq=st.chordSeq;modEnv.t0=t}
  if(!st.sounding)return 0; const x=t-modEnv.t0, {a,d}=matrix.env;
  return x<a?x/Math.max(a,1e-3):Math.max(0,1-(x-a)/d); }
function modSrcVal(src,t){
  if(src==='lfo1')return lfoVal(0,t); if(src==='lfo2')return lfoVal(1,t);
  if(src==='env')return envVal(t); if(src==='rand')return hash01(Math.floor(t/beatSec())+4242)*2-1;
  return st.inVals[src]??0; }

/* Engine */
let modTimer=null; const modLast={};
function matrixTick(){
  const t=modNow(), off={}, vals={};
  if(matrix.on)for(const r of matrix.rows){ const v=vals[r.src]??(vals[r.src]=modSrcVal(r.src,t));
    off[r.dst]=(off[r.dst]||0)+r.amt*(MOD_BIPOLAR.has(r.src)?v*.5:v); }   // bipolar sources at 100% sweep the whole knob from the middle
  for(const k of new Set([...Object.keys(off),...Object.keys(modOff)])){
    modOff[k]=off[k]||0; if(!modOff[k])delete modOff[k];
    const v=effV(k); if(modLast[k]!==undefined&&Math.abs(v-modLast[k])<.003)continue; modLast[k]=v; applyCtrl(k); }
  matrixDraw(vals);
  if(!matrix.on||!matrix.rows.length){ clearInterval(modTimer); modTimer=null; }
}
function matrixRun(){ if(!modTimer&&(matrix.on&&matrix.rows.length||Object.keys(modOff).length))modTimer=setInterval(matrixTick,25); if(modTimer)matrixTick(); }

/* Panel */
const optHTML=list=>list.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
const DST_HTML=MOD_GROUPS.map(([g,ks])=>`<optgroup label="${g}">${ks.map(k=>`<option value="${k}">${KSHORT[k].length<3?TARGETS[k].label:KSHORT[k]}</option>`).join('')}</optgroup>`).join('');
const pctTxt=a=>(a>0?'+':a<0?'−':'')+Math.round(Math.abs(a)*100)+'%';
function matrixBuild(){
  const box=$('modRows'); box.innerHTML='';
  matrix.rows.forEach((r,i)=>{
    const row=document.createElement('div'); row.className='mrow'; row.dataset.i=i;
    row.innerHTML=`<select class="msrc" aria-label="Row ${i+1} source">${optHTML(MOD_SRC)}</select><span class="marrow" aria-hidden="true">→</span>
      <select class="mdst" aria-label="Row ${i+1} knob">${DST_HTML}</select>
      <span class="mmeter" aria-hidden="true"><i></i></span>
      <input type="range" class="mamt" min="-100" max="100" step="1" aria-label="Row ${i+1} amount"><output class="mval"></output>
      <button class="mdel" type="button" aria-label="Remove row ${i+1}" title="Remove this row">✕</button>`;
    const [s,d,a]=[row.querySelector('.msrc'),row.querySelector('.mdst'),row.querySelector('.mamt')];
    s.value=r.src; d.value=r.dst; a.value=Math.round(r.amt*100); row.querySelector('.mval').textContent=pctTxt(r.amt);
    s.addEventListener('change',()=>{r.src=s.value;matrixSave();matrixRun()});
    d.addEventListener('change',()=>{r.dst=d.value;matrixSave();matrixRun()});
    a.addEventListener('input',()=>{r.amt=+a.value/100;row.querySelector('.mval').textContent=pctTxt(r.amt);matrixSave();matrixRun()});
    a.addEventListener('dblclick',()=>{a.value=0;a.dispatchEvent(new Event('input'))});
    a.addEventListener('keydown',e=>e.stopPropagation());   // arrow keys move the slider, not the synth shortcuts
    row.querySelector('.mdel').addEventListener('click',()=>{matrix.rows.splice(i,1);matrixSave();matrixBuild();matrixRun()});
    box.appendChild(row);
  });
  $('modAdd').disabled=matrix.rows.length>=MOD_MAX_ROWS;
  $('modEmpty').hidden=matrix.rows.length>0;
  $('modOn').checked=matrix.on;
  matrix.lfo.forEach((L,i)=>{$('lfoRate'+i).value=L.rate;$('lfoShape'+i).value=L.shape});
  $('envA').value=matrix.env.a; $('envD').value=matrix.env.d; envLabels();
  matrixDraw({});
}
function envLabels(){ $('envAVal').textContent=fmtSec(Math.max(.001,matrix.env.a)); $('envDVal').textContent=fmtSec(matrix.env.d); }
// Live view: each row's meter shows its source moving, and each moved knob gets a dot where it really is
function matrixDraw(vals){
  $('modRows').querySelectorAll('.mrow').forEach(row=>{ const r=matrix.rows[+row.dataset.i]; if(!r)return; const v=vals[r.src];
    const i=row.querySelector('.mmeter i'), bi=MOD_BIPOLAR.has(r.src);
    if(v===undefined||!matrix.on){i.style.left='0';i.style.width='0';return}
    if(bi){const w=Math.abs(v)*50;i.style.left=(v<0?50-w:50)+'%';i.style.width=w+'%'} else {i.style.left='0';i.style.width=(v*100)+'%'} });
  document.querySelectorAll('.knob').forEach(w=>{ const k=w.dataset.k, on=modOff[k]!==undefined; w.classList.toggle('modded',on); if(!on)return;
    const [x,y]=pt(A0+(A1-A0)*effV(k),25), dot=w.querySelector('.mdot'); dot.setAttribute('cx',x.toFixed(2)); dot.setAttribute('cy',y.toFixed(2)); });
}
[0,1].forEach(i=>{ $('lfoRate'+i).innerHTML=optHTML(MOD_RATES); $('lfoShape'+i).innerHTML=optHTML(MOD_SHAPES);
  $('lfoRate'+i).addEventListener('change',e=>{matrix.lfo[i].rate=e.target.value;matrixSave()});
  $('lfoShape'+i).addEventListener('change',e=>{matrix.lfo[i].shape=e.target.value;matrixSave()}); });
$('envA').addEventListener('input',e=>{matrix.env.a=+e.target.value;envLabels();matrixSave()});
$('envD').addEventListener('input',e=>{matrix.env.d=+e.target.value;envLabels();matrixSave()});
$('modOn').addEventListener('change',e=>{matrix.on=e.target.checked;matrixSave();matrixRun()});
$('modAdd').addEventListener('click',()=>{ if(matrix.rows.length>=MOD_MAX_ROWS)return;
  const used=new Set(matrix.rows.map(r=>r.dst)), dst=['cutoff','tremolo','reverb','volume','vibrato','delay','resonance','autopan'].find(k=>!used.has(k))||'cutoff';
  matrix.rows.push({src:'lfo1',dst,amt:.3}); matrix.on=true; matrixSave(); matrixBuild(); matrixRun();
  const last=$('modRows').lastElementChild; last&&last.querySelector('.msrc').focus(); });
$('modClear').addEventListener('click',()=>{ matrix.rows=[]; matrixSave(); matrixBuild(); matrixRun(); });
matrixBuild();
matrixRun();   // rows saved last time start moving straight away

/* Instrument editor: the oscillators of the instrument that's playing. A built-in one becomes an edited copy
   ("… (edited)") the moment you change it, so the originals stay as they are; your own ones save as you go */
const OSC_FADES=[[0,'Holds'],[.1,'0.1 s'],[.3,'0.3 s'],[.6,'0.6 s'],[1.2,'1.2 s'],[2.5,'2.5 s']];
const OSC_RATIOS=[.25,.5,1,1.5,2,3,4,5,6,8,10,12,16];
const instMine=()=>!!SOUNDS[st.sound].mine;
function instSaveMine(){ if(!instMine())return; const all=loadInstruments(), {mine,...def}=SOUNDS[st.sound]; all[st.sound]=def;
  try{localStorage.setItem('vh-instruments',JSON.stringify(all))}catch(e){} }
// The instrument to change: yours as it is, or a copy of a built-in
function instEditable(){
  const cur=SOUNDS[st.sound]; if(cur.mine||cur.draft)return cur;
  const copy=JSON.parse(JSON.stringify(cur)); copy.label=cur.label+' (edited)'; copy.draft=true;
  SOUNDS._draft=copy; st.sound='_draft'; fillSoundSel(); return copy; }
// Rebuild what's sounding so a change is heard now
function instRefresh(){ audio.allOff(); if(st.sounding&&st.degree!==null){const all=st.bassNote!==null?[st.bassNote,...st.upper]:st.upper;audio.setNotes(all)} }
function instChanged(rebuild){ instSaveMine(); if(rebuild)instRefresh(); instHeader(); }
function instHeader(){ const s0=SOUNDS[st.sound];
  $('instName').textContent=s0.label; $('instState').textContent=s0.mine?'yours · changes save as you go':s0.draft?'edited copy · save it to keep it':'built-in · changing it makes a copy';
  $('instStrike').checked=!!s0.strike; $('instDel').hidden=!s0.mine; $('oscAdd').disabled=s0.osc.length>=INSTR_MAX_OSC; }
function instBuild(){
  if(!SOUNDS[st.sound])st.sound='pad';   // e.g. one deleted in another tab
  const box=$('oscRows'), s0=SOUNDS[st.sound]; box.innerHTML='';
  s0.osc.forEach((o,i)=>{ const row=document.createElement('div'); row.className='mrow orow';
    row.innerHTML=`<select class="owave" aria-label="Oscillator ${i+1} wave">${INSTR_WAVES.map(w=>`<option value="${w}">${w[0].toUpperCase()+w.slice(1)}</option>`).join('')}</select>
      <select class="oratio" aria-label="Oscillator ${i+1} pitch" title="Pitch as a multiple of the note: 1 is the note, 2 an octave up, 0.5 an octave down">${[...new Set([...OSC_RATIOS,o[2]])].sort((a,b)=>a-b).map(r=>`<option value="${r}">× ${r}</option>`).join('')}</select>
      <span class="ocell"><input type="range" class="odet" min="-50" max="50" step="1" aria-label="Oscillator ${i+1} detune in cents"><output></output></span>
      <span class="ocell"><input type="range" class="olvl" min="0" max="100" step="1" aria-label="Oscillator ${i+1} level"><output></output></span>
      <select class="ofade" aria-label="Oscillator ${i+1} fade" title="Holds: stays as long as the note. A time: this oscillator dies away on its own, so bright parts can fade first">${OSC_FADES.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>
      <button class="mdel" type="button" aria-label="Remove oscillator ${i+1}" title="Remove this oscillator">✕</button>`;
    const q=c=>row.querySelector(c), det=q('.odet'), lvl=q('.olvl');
    q('.owave').value=o[0]; q('.oratio').value=String(o[2]); det.value=Math.round(Math.max(-50,Math.min(50,o[1]))); lvl.value=Math.round(o[3]*100);
    const fade=o[4]||0; q('.ofade').value=String(OSC_FADES.reduce((b,x)=>Math.abs(x[0]-fade)<Math.abs(b-fade)?x[0]:b,0));
    const show=()=>{det.nextElementSibling.textContent=(+det.value>0?'+':'')+det.value+'¢'; lvl.nextElementSibling.textContent=lvl.value+'%'}; show();
    // Each edit lands on oscillator i of the editable copy (the rows are redrawn if a copy was just made)
    const edit=(f,rebuild)=>{ const made=!SOUNDS[st.sound].mine&&!SOUNDS[st.sound].draft, s1=instEditable(); f(s1.osc[i]); instChanged(rebuild); if(made)instBuild(); };
    q('.owave').addEventListener('change',e=>edit(x=>{x[0]=e.target.value},true));
    q('.oratio').addEventListener('change',e=>edit(x=>{x[2]=+e.target.value},true));
    q('.ofade').addEventListener('change',e=>edit(x=>{const v=+e.target.value; if(v)x[4]=v; else x.length=4},true));
    det.addEventListener('input',()=>{show();edit(x=>{x[1]=+det.value},false)}); det.addEventListener('change',()=>instRefresh());
    lvl.addEventListener('input',()=>{show();edit(x=>{x[3]=+lvl.value/100},false)}); lvl.addEventListener('change',()=>instRefresh());
    [det,lvl].forEach(r=>r.addEventListener('keydown',e=>e.stopPropagation()));
    q('.mdel').disabled=s0.osc.length<=1;
    q('.mdel').addEventListener('click',()=>{ const s1=instEditable(); if(s1.osc.length<=1)return; s1.osc.splice(i,1); instChanged(true); instBuild(); });
    box.appendChild(row); });
  instHeader();
}
$('oscAdd').addEventListener('click',()=>{ const s1=instEditable(); if(s1.osc.length>=INSTR_MAX_OSC)return; s1.osc.push(['sine',0,2,.2]); instChanged(true); instBuild(); });
$('instStrike').addEventListener('change',e=>{ const s1=instEditable(); s1.strike=e.target.checked; instChanged(true); fillSoundSel(); });
// Save: the oscillators plus the envelope and cutoff as they are now
$('instForm').addEventListener('submit',e=>{ e.preventDefault(); const name=$('instNameIn').value.trim().slice(0,30), msg=$('instMsg');
  if(!name){msg.textContent='Type a name for this instrument first.';$('instNameIn').focus();return}
  const c=st.ctrl, cur=SOUNDS[st.sound], all=loadInstruments();
  const def=instrClean({label:name,osc:cur.osc,strike:cur.strike,a:expMap(c.attack.v,ENV.a),d:expMap(c.decay.v,ENV.d),s:c.sustain.v,r:expMap(c.release.v,ENV.r),
    cut:250*Math.pow(2,c.cutoff.v*5.3)});
  const same=Object.keys(all).find(id=>all[id]&&all[id].label===name), id=same||'u_'+Date.now().toString(36);
  all[id]=def; try{localStorage.setItem('vh-instruments',JSON.stringify(all))}catch(err){msg.textContent='Couldn’t save here: this browser is blocking storage for the page.';return}
  SOUNDS[id]={...def,mine:true}; delete SOUNDS._draft; st.sound=id; fillSoundSel(); instBuild();
  msg.textContent=same?`Updated "${name}".`:`Saved "${name}". It’s in the Instrument menu under Yours.`; });
{ let armed=null; $('instDel').addEventListener('click',()=>{ const b=$('instDel');
  if(!armed){b.textContent='Confirm';armed=setTimeout(()=>{armed=null;b.textContent='Delete'},3000);return}
  clearTimeout(armed); armed=null; b.textContent='Delete';
  const all=loadInstruments(), name=SOUNDS[st.sound].label; delete all[st.sound]; try{localStorage.setItem('vh-instruments',JSON.stringify(all))}catch(e){}
  delete SOUNDS[st.sound]; st.sound='pad'; fillSoundSel(); $('soundSel').dispatchEvent(new Event('change')); $('instMsg').textContent=`Deleted "${name}".`; }); }
// After the menu's own handler has switched instruments (it's added later, so wait for it)
$('soundSel').addEventListener('change',()=>queueMicrotask(()=>{ if(st.sound!=='_draft'&&SOUNDS._draft){delete SOUNDS._draft;fillSoundSel()} instBuild(); }));
instBuild();
