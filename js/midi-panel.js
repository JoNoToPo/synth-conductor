// Pedal button: click to latch the pedal down, click again to lift it
$('pedalBtn').addEventListener('click',()=>{audio.init();setPedal('btn',!pedalSrc.btn)});
// MIDI foot pedal: sustain (controller 64) from any connected device
$('midiBtn').addEventListener('click',async()=>{
  const hint=$('midiHint');
  if(!navigator.requestMIDIAccess){hint.textContent='This browser doesn’t support MIDI. Chrome, Edge and Brave do (in Brave, allow MIDI for this page).';return}
  try{
    const acc=await midiOut.access();
    // Skip the port MIDI out sends to: a virtual loopback port would otherwise echo our own pedal back and latch it
    const hook=()=>{const names=[];acc.inputs.forEach(inp=>{names.push(inp.name);inp.onmidimessage=ev=>{const [st0,cc,val]=ev.data;
      if(midiOut.port&&inp.name===midiOut.port.name)return;
      if((st0&0xf0)===0xb0&&cc===64){audio.init();setPedal('midi',val>=64);}}});
      hint.textContent=names.length?'Listening to '+names.join(', ')+'. Press the pedal to try it.':'No MIDI devices found. Plug one in; it’s picked up automatically.';};
    acc.addEventListener('statechange',hook); hook(); $('midiBtn').textContent='MIDI connected';
  }catch(e){hint.textContent='MIDI access was blocked. Open the downloaded file in Chrome or Brave and allow MIDI when asked.';}
});
// MIDI out panel
{ const M=midiOut, sel=$('midiPort'), msg=$('midiOutMsg'), btn=$('midiOutBtn');
  let saved={}; try{saved=JSON.parse(localStorage.getItem('vh-midi')||'{}')||{}}catch(e){}
  const chOk=c=>Number.isInteger(c)&&c>=0&&c<16;
  M.ch=chOk(saved.ch)?saved.ch:0; M.bassCh=chOk(saved.bassCh)?saved.bassCh:null;
  M.vel=Math.min(127,Math.max(1,Math.round(+saved.vel)||100)); M.cc=saved.cc!==false; M.clock=!!saved.clock; M.mute=!!saved.mute;
  M.velMode=['fixed','speed','volume'].includes(saved.velMode)?saved.velMode:saved.velVol?'volume':'fixed';
  M.sens=typeof saved.sens==='number'?clamp01(saved.sens):.5; M.bendRange=[1,2,7,12].includes(saved.bendRange)?saved.bendRange:2;
  let wantPort=saved.port||'';   // remembered by name, so it reconnects when the device is plugged back in
  const save=()=>{try{localStorage.setItem('vh-midi',JSON.stringify({port:wantPort,ch:M.ch,bassCh:M.bassCh,vel:M.vel,velMode:M.velMode,sens:M.sens,bendRange:M.bendRange,cc:M.cc,clock:M.clock,mute:M.mute}))}catch(e){}};
  const VEL_NOTE={fixed:'Every note at the same velocity.',volume:'The Volume knob, or the hand driving it, sets velocity.',
    speed:'Strike harder by moving the chord hand faster as the chord changes. Also changes the built-in sound’s loudness.'};
  const syncVelUI=()=>{ $('midiVelMode').value=M.velMode; $('midiSensRow').hidden=M.velMode!=='speed'; $('midiVelNote').textContent=VEL_NOTE[M.velMode]; };
  const chOpts=()=>Array.from({length:16},(_,i)=>new Option(String(i+1),String(i)));
  $('midiCh').replaceChildren(...chOpts()); $('midiBassCh').replaceChildren(new Option('Same',''),...chOpts());
  $('midiCh').value=String(M.ch); $('midiBassCh').value=M.bassCh===null?'':String(M.bassCh);
  $('midiVel').value=M.vel; $('midiSens').value=M.sens; $('midiBendRange').value=String(M.bendRange); syncVelUI(); $('midiCC').checked=M.cc; $('midiClock').checked=M.clock; $('midiMute').checked=M.mute;
  $('midiCCMap').textContent='Controllers: '+Object.entries(MIDI_CC).map(([k,n])=>`${KSHORT[k]} ${n}`).join(' · ')+' (as the mod wheel). Pedal 64. The Bend knob goes out as pitch bend, even with Knobs as CC off.';
  const showMsg=()=>{ msg.textContent=!M.acc?'Off':M.port?`Sending to ${M.port.name} · channel ${M.ch+1}${M.bassCh!==null&&M.bassCh!==M.ch?`, bass on ${M.bassCh+1}`:''}`:
    M.acc.outputs.size?'Pick where to send':'No MIDI outputs found. Plug one in; it’s picked up automatically.'; };
  const setPort=o=>{ if(M.port===o)return; M.stopClock(); M.panic(); M.port=o||null;
    if(M.port){ M.sync(); if(M.clock)M.startClock(); } sel.value=M.port?M.port.id:''; showMsg(); };
  const fill=()=>{ const outs=[...M.acc.outputs.values()].filter(o=>o.state!=='disconnected');
    sel.replaceChildren(new Option('Nothing (off)',''),...outs.map(o=>new Option(o.name,o.id))); sel.disabled=false;
    if(M.port&&!outs.some(o=>o.id===M.port.id))M.port=null;            // unplugged: nothing left to release
    if(!M.port&&wantPort)setPort(outs.find(o=>o.name===wantPort));
    sel.value=M.port?M.port.id:''; showMsg(); };
  const connect=async()=>{
    if(!navigator.requestMIDIAccess){msg.textContent='This browser doesn’t support MIDI. Chrome, Edge and Brave do.';return}
    try{ M.acc=await M.access(); M.acc.addEventListener('statechange',fill); fill(); btn.hidden=true; }
    catch(e){ msg.textContent='MIDI access was blocked. Allow MIDI for this page and try again.'; }
  };
  btn.addEventListener('click',()=>{audio.init();connect()});
  // Reconnect on load only if MIDI is already allowed, so opening the page never pops up a permission request
  if(wantPort&&navigator.permissions)navigator.permissions.query({name:'midi'}).then(p=>{if(p.state==='granted')connect()}).catch(()=>{});
  sel.addEventListener('change',()=>{ audio.init(); const o=M.acc&&M.acc.outputs.get(sel.value); wantPort=o?o.name:''; setPort(o); save(); });
  $('midiCh').addEventListener('change',e=>{ M.panic(); M.ch=+e.target.value; M.sync(); showMsg(); save(); });
  $('midiBassCh').addEventListener('change',e=>{ M.panic(); M.bassCh=e.target.value===''?null:+e.target.value; M.sync(); showMsg(); save(); });
  $('midiVel').addEventListener('change',e=>{ M.vel=Math.min(127,Math.max(1,Math.round(+e.target.value)||100)); e.target.value=M.vel; save(); });
  $('midiVelMode').addEventListener('change',e=>{ M.velMode=e.target.value; syncVelUI(); M.sync(); save(); });
  $('midiSens').addEventListener('input',e=>{ M.sens=+e.target.value; save(); });
  $('midiBendRange').addEventListener('change',e=>{ M.bendRange=+e.target.value; M.sendBendRange(); applyCtrl('bend'); showRouteVals(); save(); });
  $('midiCC').addEventListener('change',e=>{ M.cc=e.target.checked; M.sync(); save(); });
  $('midiClock').addEventListener('change',e=>{ M.clock=e.target.checked; audio.init(); if(M.clock)M.startClock(); else M.stopClock(); save(); });
  $('midiMute').addEventListener('change',e=>{ M.setMute(e.target.checked); save(); });
  // Recording
  const rb=$('recBtn'), rm=$('recMsg'); let recTimer=null;
  const fmtT=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  rb.addEventListener('click',()=>{
    if(!M.rec){ audio.init(); M.startRec(); rb.textContent='■ Stop & save'; rb.classList.add('recording');
      const t0=performance.now(); rm.textContent='Recording · 0:00';
      recTimer=setInterval(()=>{rm.textContent='Recording · '+fmtT((performance.now()-t0)/1000)},500); return; }
    clearInterval(recTimer); rb.textContent='● Record .mid'; rb.classList.remove('recording');
    const r=M.stopRec(); if(!r||!r.notes){rm.textContent='Nothing was played, so nothing was saved.';return}
    const d=new Date(), p=n=>String(n).padStart(2,'0');
    const name=`synth-conductor-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.mid`;
    const a=document.createElement('a'); a.href=URL.createObjectURL(r.blob); a.download=name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    rm.textContent=`Saved ${name} · ${r.notes} notes, ${fmtT(r.sec)}`;
  });
  // Never leave an external instrument hanging when the page closes
  addEventListener('pagehide',()=>{M.stopClock();M.panic()});
}
