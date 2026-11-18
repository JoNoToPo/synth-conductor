/* ---------- Layout: tabs, folding panels, popups and the play-area chips ----------
   The camera, chord and pads (the play area) always show. Everything else sits in five tabs: Chords, Hands, Sound,
   Backing and Mod. On a phone the tab bar is pinned to the bottom of the screen; on a wide screen the tabs sit
   beside the play area and scroll on their own. Each panel in a tab starts folded to one line: its name and what it's
   set to now. Presets, MIDI out and the help sections open as popups from the header. */

/* Tabs */
const TAB_KEYS=[...document.querySelectorAll('.tabbtn')].map(b=>b.dataset.tab);
const tabNarrow=()=>matchMedia('(max-width:899px)').matches;
function showTab(k,{scroll=false}={}){
  if(!TAB_KEYS.includes(k))k=TAB_KEYS[0];
  document.querySelectorAll('.tabpane').forEach(p=>p.hidden=p.dataset.tab!==k);
  document.querySelectorAll('.tabbtn').forEach(b=>{ const on=b.dataset.tab===k; b.setAttribute('aria-selected',on); b.tabIndex=on?0:-1; b.classList.toggle('on',on); });
  try{localStorage.setItem('vh-tab',k)}catch(e){}
  layoutSums();
  // On a phone the tab's panels are below the play area: bring them up
  if(scroll&&tabNarrow()){ const t=$('tabsarea'); if(t.getBoundingClientRect().top>innerHeight*.5||t.getBoundingClientRect().top<0)t.scrollIntoView({block:'start',behavior:'smooth'}); }
  dispatchEvent(new Event('resize'));   // knobs and the keyboard measure themselves when they appear
}
document.querySelectorAll('.tabbtn').forEach(b=>{
  b.addEventListener('click',()=>showTab(b.dataset.tab,{scroll:true}));
  // Arrow keys move along the tab bar, as tabs do
  b.addEventListener('keydown',e=>{ const i=TAB_KEYS.indexOf(b.dataset.tab), d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0; if(!d)return;
    e.preventDefault(); const k=TAB_KEYS[(i+d+TAB_KEYS.length)%TAB_KEYS.length]; showTab(k); $('tb-'+k).focus(); });
});

/* Folding panels: every panel in a tab folds to a header line with what it's set to now */
const FOLD_SUM={
  chord:()=>[`${optText('keySel')} ${optText('modeSel').split(' (')[0].toLowerCase()}`,st.s7&&'7th',st.alt7&&'color',st.flip&&'flipped'].filter(Boolean).join(' · '),
  loop:()=>{ const n=looper.events.filter(e=>e.deg!==null).length; return (n?`${n} chord${n>1?'s':''} · ${looper.bars} bars`:'empty')+(looper.state==='play'?' · playing':looper.state==='rec'?' · recording':''); },
  piano:()=>st.sounding&&st.degree!==null?$('chordName').textContent:'nothing sounding',
  details:()=>`${VOICINGS.find(v=>v.id===st.voicing)?.name||''}${st.rh?' · fingers pick':''}`,
  hands:()=>[`6 and 7: ${optText('left67Sel').split('·')[0].trim()}`,st.leftTwist!=='off'&&'lean flips',st.palmShift!=='off'&&'palm '+(st.palmShift==='flat'?'♭':'♯'),st.handInv&&'height inverts'].filter(Boolean).join(' · '),
  righthand:()=>[st.rh&&'fingers pick the voicing',st.thumb7!==false&&'thumb 7th',st.leanColor&&'twist'].filter(Boolean).join(' · ')||'nothing',
  position:()=>st.ctrl.position.v<.03?'off':`${fmtVal('position')}${st.ctrl.position.src!=='none'?' · '+(INPUTS[st.ctrl.position.src]||''):''}`,
  camera:()=>`${optText('camShapeSel')} · zoom ${$('camZoomVal').textContent||'1×'}`,
  instrument:()=>SOUNDS[st.sound]?.label||'',
  amp:()=>`volume ${fmtVal('volume')}`,
  filter:()=>`cutoff ${fmtVal('cutoff')}`,
  fx:()=>`reverb ${fmtVal('reverb')} · chorus ${fmtVal('chorus')}`,
  delay:()=>st.ctrl.delay.v<.01?'off':`${fmtVal('delay')} · ${optText('delayDiv')}`,
  lofi:()=>knobsMoved('lofi')||'off',
  tempo:()=>`${st.bpm} BPM${st.click?' · click on':''}${st.ctrl.pump.v>=.02?' · pump':''}`,
  arp:()=>[st.ctrl.arp.v>.01&&'arpeggio '+fmtVal('arp'),st.ctrl.strum.v>=.01&&'strum '+fmtVal('strum')].filter(Boolean).join(' · ')||'off',
  bass:()=>bassOwn()?`${BASS_NOTES[bassCfg.note]} · ${BASS_PATTERNS[bassCfg.pattern].label.toLowerCase()}`:'the chord’s lowest note',
  drone:()=>drone.on?'on':'off',
  perc:()=>perc.on?`${optText('percSound')} · ${optText('percPattern')}`:'off',
  mod:()=>knobsMoved('mod')||'all at rest',
  matrix:()=>{ const n=matrix.rows.length; return !n?'no rows':`${n} row${n>1?'s':''}${matrix.on?'':' · off'}`; },
};
function optText(id){ const s=$(id); return s&&s.selectedIndex>=0?s.options[s.selectedIndex].text:''; }
// Which of a panel's knobs are away from where they start, by name
function knobsMoved(mod){ return (MODULE_OF[mod]||[]).filter(k=>Math.abs(st.ctrl[k].v-TARGETS[k].base)>.015).map(k=>KSHORT[k]||TARGETS[k].label).join(', '); }
const folds=[];
document.querySelectorAll('.tabpane>[data-panel]').forEach(el=>{
  const k=el.dataset.panel, h=el.querySelector(':scope>h3,:scope>.cardhead>h3'); if(!h)return;
  const hold=h.parentElement===el?h:h.parentElement; hold.classList.add('fhold');
  const title=h.textContent.trim(); h.textContent='';
  const b=document.createElement('button'); b.type='button'; b.className='fhead'; b.setAttribute('aria-expanded','false');
  b.innerHTML=`<span class="fchev" aria-hidden="true"></span><span class="ftitle"></span><span class="fsum"></span>`;
  b.querySelector('.ftitle').textContent=title; h.appendChild(b);
  el.classList.add('fold','closed'); el.dataset.fold=k;
  b.addEventListener('click',()=>setFold(el,el.classList.contains('closed')));
  folds.push({el,k,sum:b.querySelector('.fsum'),last:null});
});
function setFold(el,open){ el.classList.toggle('closed',!open); el.querySelector('.fhead').setAttribute('aria-expanded',open);
  if(open)dispatchEvent(new Event('resize')); layoutSums(); }
// The summaries follow whatever changed; only the tab on show is refreshed
function layoutSums(){
  for(const f of folds){ const pane=f.el.closest('.tabpane'); if(!pane||pane.hidden)continue;
    let t=''; try{t=FOLD_SUM[f.k]?FOLD_SUM[f.k]():''}catch(e){}
    if(t!==f.last){ f.last=t; f.sum.textContent=t; } }
  layoutChips();
}

/* Bring a panel (or any control inside one) into view: its tab, then the panel unfolded */
function revealEl(el){ if(!el)return; const pane=el.closest('.tabpane'); if(pane&&pane.hidden)showTab(pane.dataset.tab);
  const f=el.closest('.fold'); if(f&&f.classList.contains('closed'))setFold(f,true);
  const d=el.closest('dialog'); if(d&&!d.open)d.showModal(); }
function revealPanel(k){ const el=document.querySelector(`.tabpane>[data-panel="${k}"]`)||(k==='presets'||k==='midi'?$(k==='presets'?'dlgPresets':'dlgMidi'):null);
  if(!el)return; if(el.tagName==='DIALOG'){ if(!el.open)el.showModal(); return; } revealEl(el); el.scrollIntoView({block:'nearest',behavior:'smooth'}); }

/* Popups from the header: Presets, MIDI out, Help */
document.querySelectorAll('[data-dlg]').forEach(b=>b.addEventListener('click',()=>{ const d=$(b.dataset.dlg); if(!d.open)d.showModal(); }));
document.querySelectorAll('dialog.dlg').forEach(d=>{
  d.querySelector('.dlgx').addEventListener('click',()=>d.close());
  d.addEventListener('click',e=>{ if(e.target===d)d.close(); });   // a click on the dim backdrop closes it
});

/* Play-area chips: the key (opens the Key panel), tempo, tap and click work from any tab */
function layoutChips(){
  $('keyChip').textContent=`${optText('keySel')} ${optText('modeSel').split(' (')[0].toLowerCase()}`;   // "C major", not "C major (ionian)"
  const q=$('bpmQuick'); if(document.activeElement!==q&&+q.value!==st.bpm)q.value=st.bpm;
  $('clickQuick').setAttribute('aria-pressed',!!st.click);
}
$('keyChip').addEventListener('click',()=>{ const k=document.querySelector('[data-fold="chord"]'); revealEl(k); k.scrollIntoView({block:'nearest',behavior:'smooth'}); $('keySel').focus({preventScroll:true}); });
$('bpmQuick').addEventListener('change',e=>setBpm(+e.target.value));
$('tapQuick').addEventListener('click',()=>{ $('tapBtn').click(); layoutChips(); });
$('clickQuick').addEventListener('click',()=>{ const c=$('optClick'); c.checked=!c.checked; c.dispatchEvent(new Event('change')); layoutChips(); });
{ const s0=syncTempoUI; syncTempoUI=function(){ s0.apply(this,arguments); layoutChips(); }; }

/* Hide video: the camera picture folds away to give the controls the room; hands are still tracked. Full screen always shows it */
function setVideo(hide){ document.body.classList.toggle('novideo',hide); const b=$('videoBtn'); b.textContent=hide?'Show video':'Hide video'; b.setAttribute('aria-pressed',hide);
  try{localStorage.setItem('vh-novideo',hide?'1':'0')}catch(e){} dispatchEvent(new Event('resize')); }
$('videoBtn').addEventListener('click',()=>setVideo(!document.body.classList.contains('novideo')));
try{ if(localStorage.getItem('vh-novideo')==='1')setVideo(true); }catch(e){}

let startTab='favs'; try{ startTab=localStorage.getItem('vh-tab')||'favs'; }catch(e){}
showTab(startTab);
document.addEventListener('change',()=>setTimeout(layoutSums,0));
document.addEventListener('input',()=>setTimeout(layoutSums,0));
setInterval(()=>{ if(document.visibilityState==='visible')layoutSums(); },700);   // hands and the loop change things without an event

/* Hands tab: one row per movement with what it does (Nothing turns it off), and what each hand is doing right now.
   Chords tab: the switches those movements play (7th, Color, Flip). A switch a hand plays shows a small hand; tapping it
   goes to the movement that plays it. With that movement set to Nothing, it's an ordinary switch */
const fire=(id,prop,v)=>{ const el=$(id); el[prop]=v; el.dispatchEvent(new Event('change')); };
function twistNow(){
  if(!st.leanColor)return 'nothing';
  if(st.sevMode==='build')return st.alt7?'+9th':st.sevForce==='other'?(st.s7?'other 7th':'6th'):'upright';
  if(st.sevMode==='twist'||st.sevMode==='twistE')return st.sevForce?twistTag():'upright';
  return st.alt7?(st.s7?'♭7':'add 9'):'upright';
}
const TWIST_OPTS=[['build','Right: 9th · left: 6th or other 7th'],['twist','Left maj7 · right 7'],['twistE','Eric style: minor right °7'],
  ['diatonic','Lean adds color · 7ths from the key'],['maj','Lean adds color · major 7ths'],['off','Nothing']];
$('twistSel').innerHTML=TWIST_OPTS.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
const MOVES=[   // the menus made here; 6 and 7, Fist, Lean and Back of hand use the page's own menus
  {id:'heightSel',get:()=>st.handInv?'on':'off',set:v=>fire('optHandInv','checked',v==='on')},
  {id:'rhSel',get:()=>st.rh?'on':'off',set:v=>fire('optRH','checked',v==='on')},
  {id:'thumbSel',get:()=>st.thumb7!==false?'on':'off',set:v=>{ st.thumb7=v==='on'; try{localStorage.setItem('vh-thumb7',st.thumb7?'1':'0')}catch(e){} }},
  {id:'twistSel',get:()=>st.leanColor?st.sevMode:'off',set:v=>{ if(v==='off'){ fire('optLeanColor','checked',false); return; } if(!st.leanColor)fire('optLeanColor','checked',true); fire('sevSel','value',v); }},
];
for(const m of MOVES)$(m.id).addEventListener('change',e=>{ audio.init(); m.set(e.target.value); handsRender(); render(); });
const NOW={nowFlip:()=>st.leftTwist==='off'?'':st.flip?'flipped':'as the key',nowShift:()=>st.palmShift==='off'?'':shiftAmt()<0?'♭':shiftAmt()>0?'♯':'natural',
  nowInv:()=>st.handInv?['root','1st inv','2nd inv','3rd inv'][effInv()]||'':'',nowVoicing:()=>st.rh?VOICINGS.find(v=>v.id===st.voicing)?.name||'':'',
  now7:()=>st.thumb7!==false?(st.s7?'7th':'triad'):'',nowTwist:()=>st.leanColor?twistNow():''};
// The switches in Chords, and the movement row each one jumps to while a hand plays it
const SWITCHES=[
  {name:'7th',lit:()=>st.s7,hand:()=>st.thumb7!==false,tap:()=>setSevenths(!st.s7),row:'thumbSel',by:'your right thumb'},
  {name:'Color',lit:()=>st.alt7||!!st.sevForce,hand:()=>st.leanColor,tap:()=>setAlt7(!st.alt7),row:'twistSel',by:'your right-hand twist'},
  {name:'Flip maj/min',lit:()=>st.flip,hand:()=>st.leftTwist!=='off',tap:()=>setFlip(!st.flip),row:'leftTwistSel',by:'your left-hand lean'},
];
const HAND_ICO='<svg class="hico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-7a1.5 1.5 0 0 1 3 0V12M14 5.5a1.5 1.5 0 0 1 3 0V12M17 7.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.2-3L4.3 14.6a1.6 1.6 0 0 1 2.6-1.8L8 14"/></svg>';
// Show a control in its panel and flash it
function pointAt(el){ if(!el)return; revealEl(el); el.scrollIntoView({block:'center',behavior:'smooth'}); el.classList.remove('lpoint'); void el.offsetWidth; el.classList.add('lpoint'); setTimeout(()=>el.classList.remove('lpoint'),2600); }
for(const w of SWITCHES){ const b=document.createElement('button'); b.type='button'; b.className='hled';
  b.innerHTML=`<span class="hdot" aria-hidden="true"></span><span class="hname">${w.name}</span>${HAND_ICO}`;
  b.addEventListener('click',()=>{ audio.init(); if(w.hand()){ pointAt($(w.row).closest('.mvrow')); return; } w.tap(); handsRender(); });
  w.el=b; $('swrow').appendChild(b); }
// What else each hand plays: every knob whose hand menu is set to one of its movements, with a way to get to it
const LEFT_IN=['lx'], MOVE_NAME={x:'Across',y:'Height',lean:'Lean',tilt:'Tilt',dist:'Push / pull',roll:'Palm roll',lx:'Across',speed:'Speed'};
function alsoPlays(box,left){
  const list=Object.keys(TARGETS).filter(k=>st.ctrl[k].src!=='none'&&LEFT_IN.includes(st.ctrl[k].src)===left);
  const key=list.map(k=>k+st.ctrl[k].src+st.ctrl[k].inv).join();
  if(box.dataset.key===key)return; box.dataset.key=key;
  box.innerHTML=`<span class="alsolab">Also plays</span>`+(list.length?'':`<span class="hint">no knobs yet: set any knob's hand menu to a ${left?'left':'right'}-hand movement</span>`);
  for(const k of list){ const b=document.createElement('button'); b.type='button'; b.className='chip also';
    b.textContent=`${MOVE_NAME[st.ctrl[k].src]||INPUTS[st.ctrl[k].src]||st.ctrl[k].src}${st.ctrl[k].inv?' (inv)':''} → ${KSHORT[k]||TARGETS[k].label}`;
    b.title=`Go to ${KSHORT[k]||TARGETS[k].label}`;
    b.addEventListener('click',()=>{ const s=$('cs-'+k); pointAt(s&&(s.closest('.knob,.fader')||s)); });
    box.appendChild(b); }
}
function handsRender(){
  for(const m of MOVES){ const s=$(m.id), v=m.get(); if(s.value!==v&&document.activeElement!==s)s.value=v; }
  for(const id in NOW){ const t=NOW[id](); if($(id).textContent!==t)$(id).textContent=t; }
  let n=0; for(const w of SWITCHES){ const hand=w.hand(); if(hand)n++;
    w.el.classList.toggle('hand',hand); w.el.classList.toggle('on',!!w.lit()); w.el.setAttribute('aria-pressed',!!w.lit());
    w.el.title=hand?`${w.name}: played by ${w.by}. Tap to see where`:`${w.name}: tap to switch`; }
  $('swhint').textContent=n?'A switch with a hand is played by your hand: tap it to see which movement.':'';
  $('invSel').disabled=st.handInv; $('invLab').classList.toggle('dim',st.handInv);
  alsoPlays($('alsoL'),true); alsoPlays($('alsoR'),false);
}
{ const r0=render; render=function(){ r0.apply(this,arguments); handsRender(); }; }
{ const l0=layoutSums; layoutSums=function(){ l0(); handsRender(); }; }
handsRender(); layoutSums();


/* Favorites: a star on every panel pins it to the first tab, in the order you pin them. The keyboard starts there.
   A pinned panel moves (there's only one of each); its home tab keeps a line that jumps to it. Pinned panels start open */
const STAR_SVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';
let favs=null; try{ favs=JSON.parse(localStorage.getItem('vh-favs')||'null'); }catch(e){}
if(!Array.isArray(favs))favs=['piano'];
favs=favs.filter(k=>folds.some(f=>f.k===k));
for(const f of folds){
  const name=f.el.querySelector('.ftitle').textContent;
  const star=document.createElement('button'); star.type='button'; star.className='fstar'; star.innerHTML=STAR_SVG;
  star.addEventListener('click',e=>{ e.stopPropagation(); favToggle(f.k); });
  f.el.querySelector('.fhead').after(star); f.star=star; f.name=name;
  const slot=document.createElement('button'); slot.type='button'; slot.className='favslot'; slot.hidden=true;
  slot.innerHTML=`${STAR_SVG}<span></span>`; slot.querySelector('span').textContent=`${name} · in Favorites`;
  slot.addEventListener('click',()=>{ showTab('favs',{scroll:true}); revealEl(f.el); f.el.scrollIntoView({block:'nearest'}); });
  f.el.before(slot); f.slot=slot;
}
function favApply(){
  const pane=$('tab-favs');
  for(const f of folds){ const on=favs.includes(f.k); f.slot.hidden=!on;
    f.star.setAttribute('aria-pressed',on); f.star.title=on?`Take ${f.name} out of Favorites`:`Keep ${f.name} in Favorites`; f.star.setAttribute('aria-label',f.star.title);
    if(!on&&f.el.parentElement===pane)f.slot.after(f.el); }
  for(const k of favs)pane.appendChild(folds.find(f=>f.k===k).el);
  $('favEmpty').hidden=favs.length>0;
  try{localStorage.setItem('vh-favs',JSON.stringify(favs))}catch(e){}
  layoutSums(); dispatchEvent(new Event('resize'));
}
function favToggle(k){ const f=folds.find(x=>x.k===k);
  if(favs.includes(k))favs=favs.filter(x=>x!==k); else { favs.push(k); setFold(f.el,true); }
  favApply(); }
favApply();
for(const k of favs)setFold(folds.find(f=>f.k===k).el,true);
showTab(startTab);
