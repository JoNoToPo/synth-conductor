/* ---------- Sharing by link: a chord loop, sound preset or hand setup ----------
   It rides in the part of the link after #, which browsers never send to the site, so nothing is uploaded.
   Opening a link shows a card saying what was sent; nothing changes until you choose to try or keep it. */
const b64url={enc:t=>btoa(String.fromCharCode(...new TextEncoder().encode(t))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
  dec:t=>new TextDecoder().decode(Uint8Array.from(atob(t.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))};
const LOOP_KEYS=['beat','deg','flip','alt7','s7','sevForce','shift','inv','roman','name'];
const shareKeyName=(k,m)=>`${pcName(KEYS[k]?.[0]??0)} ${(MODES[m]?.name||'').replace(/ \(.*\)/,'')}`.trim();
const pickTyped=(src,keys,test)=>{const o={};for(const k of keys)if(src&&test(src[k],k))o[k]=src[k];return o};

// The loop playing now, in the same shape as a saved one
const loopNow=()=>({bars:looper.bars,snap:looper.snap,meter:st.meter,bpm:st.bpm,key:st.key,mode:st.mode,events:JSON.parse(JSON.stringify(looper.events))});
function loopCleanEvents(list){
  return (Array.isArray(list)?list:[]).filter(e=>e&&typeof e.beat==='number'&&(e.deg===null||(Number.isInteger(e.deg)&&e.deg>=0&&e.deg<7)))
    .map(e=>({beat:Math.max(0,e.beat),deg:e.deg,flip:!!e.flip,alt7:!!e.alt7,s7:e.s7===null||e.s7===undefined?null:!!e.s7,
      sevForce:['maj','dom'].includes(e.sevForce)?e.sevForce:null,shift:[-1,0,1].includes(e.shift)?e.shift:0,
      inv:Number.isInteger(e.inv)&&e.inv>=0&&e.inv<4?e.inv:0,roman:String(e.roman||'').slice(0,12),name:String(e.name||'').slice(0,24)}))
    .sort((a,b)=>a.beat-b.beat);
}
const SHARE={
  loop:{noun:'chord loop',bank:'vh-loops',builtins:()=>BUILTIN_LOOPS,panel:'loop',tryLabel:'▶ Play it',verb:'play it',
    pack:(n,c)=>({n,b:c.bars,s:c.snap,m:c.meter,t:c.bpm,k:c.key,o:c.mode,e:c.events.map(e=>LOOP_KEYS.map(k=>e[k]))}),
    unpack:p=>({name:p.n,data:{bars:p.b,snap:p.s,meter:p.m,bpm:p.t,key:p.k,mode:p.o,
      events:loopCleanEvents((Array.isArray(p.e)?p.e:[]).filter(Array.isArray).map(a=>Object.fromEntries(LOOP_KEYS.map((k,i)=>[k,a[i]===undefined?null:a[i]]))))}}),
    ok:d=>d.events.some(e=>e.deg!==null),
    describe:c=>{ const r=[]; for(const e of c.events){ const x=e.deg===null?null:e.roman||romanOf(e.deg); if(x&&r[r.length-1]!==x)r.push(x); }
      return [r.slice(0,8).join(' – ')+(r.length>8?' …':''),`${c.bars} bar${c.bars===1?'':'s'}`,c.bpm?c.bpm+' BPM':'',shareKeyName(c.key,c.mode)].filter(Boolean).join(' · ') },
    msg:t=>{$('loopBankMsg').textContent=t},
    apply:c=>applyLoop(c), setActive:n=>{loopActive=n;$('loopName').value=n}, render:()=>renderLoops()},
  sound:{noun:'sound',bank:'vh-presets',builtins:()=>BUILTIN_PRESETS,panel:'presets',tryLabel:'Try it',verb:'hear it',
    pack:(n,c)=>({n,d:c}), unpack:p=>({name:p.n,data:cleanSound(p.d)}), ok:d=>d.key!==undefined,
    describe:c=>soundSummary(c), msg:t=>presetMsg(t),
    capture:captureSound, apply:c=>applySound(c), setActive:n=>{activePreset=n}, render:()=>renderPresets()},
  hands:{noun:'hand setup',bank:'vh-hands',builtins:()=>BUILTIN_HANDS,panel:'presets',tryLabel:'Try it',verb:'try it',
    pack:(n,c)=>({n,d:c}), unpack:p=>({name:p.n,data:cleanHands(p.d)}), ok:d=>Array.isArray(d.rhMap),
    describe:h=>handSummary(h), msg:t=>presetMsg(t),
    capture:captureHands, apply:h=>applyHands(h), setActive:n=>{activeHands=n}, render:()=>renderHands()},
};
// Only the settings a preset can hold, each of the right kind, so a hand-edited link can't put anything odd in
function cleanSound(d){ if(!d||typeof d!=='object')return {};
  const o=pickTyped(d,['key','mode','sound','voicing','sevMode','invBase','shiftQual','arpPattern','strumDir','bendRange','bpm','meter','vibDiv'],v=>typeof v==='number'||typeof v==='string');
  Object.assign(o,pickTyped(d,[...SOUND_BOOLS,'sync'],v=>typeof v==='boolean'));
  if(d.ctrl&&typeof d.ctrl==='object'){o.ctrl={};for(const k in TARGETS)if(d.ctrl[k]&&typeof d.ctrl[k].v==='number')o.ctrl[k]={v:d.ctrl[k].v}}
  if(d.fx&&typeof d.fx==='object')o.fx=pickTyped(d.fx,Object.keys(st.fx),(v,k)=>typeof v===typeof st.fx[k]);
  return o; }
function cleanHands(d){ if(!d||typeof d!=='object')return {};
  const o=pickTyped(d,['pedalHand','left67','leftTwist','palmShift','sevMode'],v=>typeof v==='string');
  Object.assign(o,pickTyped(d,['leanColor','holdKeys','pure',...HAND_BOOLS],v=>typeof v==='boolean'));
  if(typeof d.posV==='number')o.posV=d.posV;
  if(Array.isArray(d.rhMap))o.rhMap=d.rhMap.slice(0,5).map(String);
  if(d.holds&&typeof d.holds==='object')o.holds=pickTyped(d.holds,Object.keys(HOLD_DEFAULT),v=>typeof v==='string'&&v.length<=12);
  if(d.src&&typeof d.src==='object'){o.src={};for(const k in TARGETS){const x=d.src[k];if(x&&typeof x.src==='string')o.src[k]={src:x.src,inv:!!x.inv}}}
  return o; }

const shareURL=(kind,name,data)=>location.origin+location.pathname+'#'+kind+'='+b64url.enc(JSON.stringify(SHARE[kind].pack(name,data)));
// Send: the phone's share sheet where there is one, otherwise copy the link
async function shareSend(kind,name,data){
  const K=SHARE[kind]; if(!K.ok(data)){K.msg(kind==='loop'?'Record a loop with at least one chord first.':`That ${K.noun} can’t be shared.`);return}
  const url=shareURL(kind,name,data), text=`${K.noun[0].toUpperCase()+K.noun.slice(1)} "${name}": ${K.describe(data)}. Open the link to ${K.verb} on Synth Conductor.`;
  if(navigator.share){ try{ await navigator.share({title:`${name} · Synth Conductor`,text,url}); K.msg(`Shared "${name}".`); return; }
    catch(e){ if(e&&e.name==='AbortError')return; } }
  try{ await navigator.clipboard.writeText(url); K.msg(`Link to "${name}" copied. Whoever opens it can try it and keep it.`); }
  catch(e){ K.msg(''); const box=kind==='loop'?$('loopBankMsg'):$('presetMsg'), inp=document.createElement('input');
    inp.className='lshare'; inp.readOnly=true; inp.value=url; box.append('Copy this link: ',inp); inp.focus(); inp.select(); }
}
$('loopShare').addEventListener('click',()=>shareSend('loop',loopActive||$('loopName').value.trim()||'Chord loop',loopNow()));

/* Receive: a card at the top of the page says what arrived */
const sharedAtStart=/^#(loop|sound|hands)=/.test(location.hash);
let arrival=null;   // {kind,name,data,before}: before is what to go back to while trying a sound or hand setup
function saveShared(kind,name,data){
  // Keep the sender's name; if a different one here has it already, number it
  const K=SHARE[kind], bank=loadBank(K.bank), base=String(name||'Shared '+K.noun).slice(0,40).trim()||'Shared '+K.noun, same=x=>JSON.stringify(x)===JSON.stringify(data);
  let n=base; for(let i=2;(bank[n]&&!same({...bank[n],saved:undefined}))||(!bank[n]&&K.builtins()[n]);i++)n=`${base} (${i})`;
  bank[n]={...data,saved:Date.now()}; storeBank(K.bank,bank); return n;
}
function shareClose(){ $('shareCard').hidden=true; arrival=null; if(firstVisit&&$('lesson').hidden&&typeof lessonOpen==='function')lessonOpen(false); }
function shareShow(){
  const a=arrival, K=SHARE[a.kind], trying=!!a.before;
  $('shareKind').textContent=trying?`Trying the ${K.noun} you were sent`:`Someone shared a ${K.noun} with you`;
  $('shareName').textContent=a.name; $('shareInfo').textContent=K.describe(a.data);
  $('shareTry').textContent=K.tryLabel; $('shareTry').hidden=trying;
  $('shareKeep').textContent=a.kind==='loop'?'Add to my loops':'Keep it';
  $('shareNo').textContent=trying?'Go back':'No thanks';
  $('shareNote').textContent=trying?'Play a few chords to hear it. Keep it to add it to your presets, or go back to how things were.'
    :a.kind==='loop'?'Playing it switches to its key and tempo and adds it to your Loops.':'Trying it changes your settings until you keep it or go back.';
  const c=$('shareCard'); c.hidden=false; c.scrollIntoView({block:'nearest'});
}
function shareFromLink(){
  const m=/^#(loop|sound|hands)=([\w-]+)$/.exec(location.hash); if(!m)return;
  history.replaceState(null,'',location.pathname+location.search);   // tidy the address so a reload doesn't offer it again
  if(arrival&&arrival.before)SHARE[arrival.kind].apply(arrival.before);
  const kind=m[1], K=SHARE[kind]; let got;
  try{ got=K.unpack(JSON.parse(b64url.dec(m[2]))); }catch(e){ got=null; }
  if(!got||!got.data||!K.ok(got.data)){ arrival=null; $('shareKind').textContent='This link didn’t work';
    $('shareName').textContent='Part of it may be missing'; $('shareInfo').textContent='Try copying the whole link again.';
    $('shareTry').hidden=true; $('shareKeep').hidden=true; $('shareNo').textContent='Close'; $('shareNote').textContent=''; $('shareCard').hidden=false; return; }
  $('shareKeep').hidden=false;
  arrival={kind,name:String(got.name||'').slice(0,40).trim()||'Shared '+K.noun,data:got.data,before:null}; shareShow();
}
$('shareTry').addEventListener('click',()=>{ const a=arrival; if(!a)return; const K=SHARE[a.kind]; audio.init();
  if(a.kind==='loop'){ const n=saveShared('loop',a.name,a.data); setPanel('loop',true); K.apply(a.data); K.setActive(n); K.render();
    K.msg(`Added "${n}" to your Loops.`); shareClose(); looper.playLoop(); $('loopCard').scrollIntoView({block:'nearest',behavior:'smooth'}); return; }
  a.before=K.capture(); K.apply(a.data); shareShow(); });
$('shareKeep').addEventListener('click',()=>{ const a=arrival; if(!a)return; const K=SHARE[a.kind], n=saveShared(a.kind,a.name,a.data);
  setPanel(K.panel,true);
  if(a.kind!=='loop'){ if(!a.before)K.apply(a.data); K.setActive(n); }   // a kept sound or hand setup is what you're using now
  K.render(); K.msg(a.kind==='loop'?`Added "${n}" to your Loops. Tap it to load it.`:`Kept the ${K.noun} "${n}".`); shareClose(); });
$('shareNo').addEventListener('click',()=>{ const a=arrival; if(a&&a.before)SHARE[a.kind].apply(a.before); shareClose(); });
addEventListener('DOMContentLoaded',shareFromLink); addEventListener('hashchange',shareFromLink);
