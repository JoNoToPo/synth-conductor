/* ---------- Percussion: a rhythmic drone locked to the tempo ----------
   A shaker, rattle or click playing a steady pattern under everything, or played by the Level dial.
   Off until you turn it on; a hidden panel is silent */
const PERC_PATTERNS={q:{step:1,label:'1/4 notes'},e:{step:.5,label:'1/8 notes'},s:{step:.25,label:'1/16 notes'},off:{step:1,off:.5,label:'Off-beats'},t:{step:1/3,label:'Triplets'},dial:{label:'Played by the dial'}};
const PERC_SOUNDS=['shaker','rattle','click'];   // the hurdy-gurdy buzz lives in the Drone now
const PERC_DEFAULT=()=>({on:false,sound:'shaker',pattern:'e',when:'always'});
let perc=PERC_DEFAULT();
function percClean(d){ const x=PERC_DEFAULT(); if(!d||typeof d!=='object')return x;
  return {on:d.on===true,sound:PERC_SOUNDS.includes(d.sound)?d.sound:x.sound,pattern:PERC_PATTERNS[d.pattern]?d.pattern:x.pattern,when:d.when==='chord'?'chord':'always'}; }
try{ perc=percClean(JSON.parse(localStorage.getItem('vh-perc')||'null')); }catch(e){}
const percSave=()=>{ try{localStorage.setItem('vh-perc',JSON.stringify(perc))}catch(e){} };
const percCapture=()=>({...perc});
function percApply(d){ perc=percClean(d); percSave(); percUI(); percRun(); }
const pq={timer:null,next:0,out:null,noise:null};

const percActive=()=>perc.on&&(typeof panelShown!=='function'||panelShown('perc'))&&(perc.when==='always'||st.sounding);
// One hit at audio time t; acc is 1 on the bar's downbeat, a little less elsewhere
function percHit(t,acc,vel){
  const c=audio.ctx, lvl=vel??effV('perc')*acc; if(lvl<.005)return;   // vel: a hit played by the dial brings its own strength
  if(!pq.out){ pq.out=c.createGain(); pq.out.connect(audio.bus); }
  if(!pq.noise){ const n=c.sampleRate, b=c.createBuffer(1,n,n), d=b.getChannelData(0); for(let i=0;i<n;i++)d[i]=Math.random()*2-1; pq.noise=b; }
  const g=c.createGain(); g.connect(pq.out); const env=(peak,dec)=>{ g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak*lvl,t+.003); g.gain.setTargetAtTime(0,t+.004,dec); };
  const noise=()=>{ const s=c.createBufferSource(); s.buffer=pq.noise; s.playbackRate.value=.8+Math.random()*.4; return s; };
  const stop=(nodes,len)=>{ for(const x of nodes){ x.start(t); x.stop(t+len); } setTimeout(()=>{ try{g.disconnect()}catch(e){} },(t-c.currentTime+len)*1000+100); };
  if(perc.sound==='shaker'){ const s=noise(), hp=c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=5500; s.connect(hp); hp.connect(g);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.22*lvl,t+.02); g.gain.setTargetAtTime(0,t+.025,.03); stop([s],.2);
  } else if(perc.sound==='rattle'){ const s=noise(), bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=900; bp.Q.value=2.5; s.connect(bp); bp.connect(g);
    g.gain.setValueAtTime(0,t); for(let k=0;k<3;k++){ const tk=t+k*.022; g.gain.linearRampToValueAtTime(.5*lvl*(1-k*.25),tk+.003); g.gain.setTargetAtTime(0,tk+.004,.008); } stop([s],.25);
  } else { const o=c.createOscillator(); o.type='sine'; o.frequency.value=acc>.95?1800:1400; o.connect(g); env(.35,.012); stop([o],.08); }
}
// Look-ahead scheduler on the beat grid, the same one the click and arpeggio use
// Played by the dial: each time the Level dial rises past the middle it's one hit, and how fast it rose sets how hard.
// It re-arms once the dial drops back below. A hand movement or a mod matrix row on the dial plays the percussion
const pd={v:null,t:0,armed:true,peak:0};
function percDial(){ const c=audio.ctx, v=effV('perc'), now=performance.now();
  if(pd.v!==null){ const rate=(v-pd.v)/Math.max(.001,(now-pd.t)/1000); if(rate>0)pd.peak=Math.max(pd.peak*.7,rate); }
  if(pd.armed&&v>=.5&&(pd.v??v)<.5){ pd.armed=false; if(percActive())percHit(c.currentTime+.005,1,.25+.75*Math.min(1,pd.peak/6)); }
  else if(!pd.armed&&v<.4){ pd.armed=true; pd.peak=0; }
  pd.v=v; pd.t=now; }
function percTick(){ const c=audio.ctx; if(!c)return; if(perc.pattern==='dial'){ percDial(); return; } const P=PERC_PATTERNS[perc.pattern], step=beatSec()*P.step, off=(P.off||0)*beatSec(), m=meterOf(), bar=beatSec()*m.bar;
  if(!pq.next||pq.next<c.currentTime-.05){ const k=Math.ceil((c.currentTime+.03-audio.t0-off)/step); pq.next=audio.t0+off+k*step; }
  while(pq.next<c.currentTime+.12){ const t=pq.next, inBar=((t-audio.t0)%bar+bar)%bar;
    if(percActive())percHit(t,inBar<.01||bar-inBar<.01?1:.72);
    pq.next+=step; } }
function percRun(){ if(perc.on&&audio.ctx){ if(!pq.timer){ pq.next=0; pq.timer=setInterval(percTick,16); } } else if(pq.timer){ clearInterval(pq.timer); pq.timer=null; } }

/* Panel */
function percUI(){ $('percOn').checked=perc.on; $('percSound').value=perc.sound; $('percPattern').value=perc.pattern; $('percWhen').value=perc.when; $('percDialNote').hidden=perc.pattern!=='dial'; }
$('percOn').addEventListener('change',e=>{ audio.init(); perc.on=e.target.checked; percSave(); percRun(); });
$('percSound').addEventListener('change',e=>{ perc.sound=e.target.value; percSave(); });
$('percPattern').addEventListener('change',e=>{ perc.pattern=e.target.value; pq.next=0; pd.v=null; pd.armed=true; percSave(); percUI(); });
$('percWhen').addEventListener('change',e=>{ perc.when=e.target.value; percSave(); });
percUI();
{ const i0=audio.init.bind(audio); audio.init=function(){ i0(); percRun(); }; }
