/* ---------- Camera + hand tracking ---------- */
const MP='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const cam={on:false,ready:false,stream:null,lm:null,lastT:-1};
const video=$('video'),cv=$('cv'),g=cv.getContext('2d');
const CONN=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

function camMsg(t){const el=$('camMsg');el.hidden=!t;el.textContent=t||''}
$('camBtn').addEventListener('click',async()=>{
  audio.init();
  if(cam.on){stopCamera();return}
  const btn=$('camBtn');btn.disabled=true;btn.textContent='Starting camera…';camMsg('');
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('nomedia');
    // 60 fps where the camera allows: frames arrive twice as often. The tracker shrinks every frame to ~200 px,
    // so 640×360 loses no accuracy and is cheaper to copy to the background tracker than a bigger picture
    cam.stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:360},frameRate:{ideal:60},facingMode:'user'},audio:false});
  }catch(e){
    btn.disabled=false;btn.textContent='Play with your hands';
    camMsg('The camera isn’t available in this view. Open this page as its own file in Chrome (or host it on a site) and allow camera access. The pads and keyboard work here in the meantime.');
    return;
  }
  if(typeof spkDetect==='function')spkDetect();   // with camera access the browser names the sound output too
  video.srcObject=cam.stream;await video.play();cam.on=true;status();
  fitView(); video.addEventListener('resize',fitView);
  btn.textContent='Loading hand tracking…';
  try{
    await loadTracker();
  }catch(e){
    camMsg('The camera started, but the hand-tracking model couldn’t load. Check your connection, or host the page on a normal web address.');
  }
  btn.disabled=false;btn.textContent='Stop camera';status();
  requestAnimationFrame(loop);
});
/* Stall recorder: finds moments the page stops updating and what was running */
const diag={building:0,stutters:0,pageFrames:0,log:[],stalls:0,appMs:0,frameTop:null,last:performance.now(),held:new Set()};
function timed(name,fn){
  const t=performance.now();
  try{ return fn(); }
  finally{ const d=performance.now()-t; diag.appMs+=d; if(!diag.frameTop||d>diag.frameTop.ms)diag.frameTop={name,ms:d}; }
}
function diagContext(){
  const keys=[...diag.held].map(k=>k===' '?'Space':k.length===1?k.toUpperCase():k[0].toUpperCase()+k.slice(1));
  const n=(cam.hands||[]).length;
  return `${n?n+' hand'+(n>1?'s':'')+' on screen':'no hands'}${keys.length?' · holding '+keys.join('+'):''}${audio.arpTimer?' · arp on':''}`;
}
function diagAdd(msg,bad){
  diag.log.unshift({time:new Date().toLocaleTimeString(),msg,ctx:diagContext(),bad});
  if(diag.log.length>40)diag.log.length=40; renderDiag();
}
function renderDiag(){
  const ol=document.getElementById('diagLog'); if(!ol)return; ol.innerHTML='';
  for(const e of diag.log.slice(0,12)){const li=document.createElement('li');if(e.bad)li.className='bad';li.textContent=`${e.time} · ${e.msg} · ${e.ctx}`;ol.appendChild(li);}
  const sm=document.getElementById('diagSummary');
  if(sm)sm.textContent=(diag.stalls?`${diag.stalls} freeze${diag.stalls>1?'s':''} recorded. `:'No freezes recorded yet. ')+(diag.stutters?`${diag.stutters} stutter${diag.stutters>1?'s':''} (100–250 ms). `:'')+`Tracking on ${cam.delegate||trackDelegate}${cam.inWorker?' in the background':cam.ready?' on the page':''}${cam.numHands?', looking for '+cam.numHands+' hand'+(cam.numHands>1?'s':''):''}.`;
}
(function watch(){
  const now=performance.now(), gap=now-diag.last;
  diag.pageFrames++;
  if(gap>100&&gap<=250&&!document.hidden&&!diag.building){
    diag.stutters++;
    const top=diag.frameTop;
    if(gap>160) diagAdd(top&&top.ms>gap*.5?`Stutter ${Math.round(gap)} ms: ${top.name} took ${Math.round(top.ms)} ms`:`Stutter ${Math.round(gap)} ms outside Synth Conductor's own code`,false);
  }
  if(gap>250&&gap<15000&&!document.hidden&&!diag.building){
    diag.stalls++;
    const top=diag.frameTop;
    if(top&&top.ms>gap*.5) diagAdd(`Froze ${Math.round(gap)} ms: ${top.name} took ${Math.round(top.ms)} ms`,true);
    else diagAdd(`Froze ${Math.round(gap)} ms outside Synth Conductor's own code (browser or graphics). Our code ran ${Math.round(diag.appMs)} ms`,true);
  }
  diag.last=now; diag.appMs=0; diag.frameTop=null;
  requestAnimationFrame(watch);
})();
// Key handlers: time them, and remember which keys are held for the report
let keyT0=0;
for(const type of ['keydown','keyup']){
  addEventListener(type,()=>{keyT0=performance.now()},true);
  addEventListener(type,e=>{const d=performance.now()-keyT0; diag.appMs+=d; if(!diag.frameTop||d>diag.frameTop.ms)diag.frameTop={name:'handling a key press',ms:d};
    const k=e.code==='Comma'?',':e.code==='Period'?'.':(e.key||'').toLowerCase();
    if(type==='keydown')diag.held.add(k); else diag.held.delete(k);},false);
}
addEventListener('blur',()=>diag.held.clear());
// Size the view to the camera's real shape so the whole picture shows, never cropped
const lat={frames:0,track:0,cam:0,lastT:-1,delay:0};
setInterval(()=>{
  const parts=[];
  if(audio.ctx){const a=((audio.ctx.baseLatency||0)+(audio.ctx.outputLatency||0))*1000; parts.push('Audio '+(a?Math.round(a)+' ms':'n/a'));}
  parts.push('Page '+diag.pageFrames+' fps'); diag.pageFrames=0;
  if(cam.on&&lat.cam)parts.push('Camera '+lat.cam+' fps');
  if(cam.on&&lat.frames)parts.push('Tracking '+Math.round(lat.track/lat.frames)+' ms'+(cam.inWorker?' (hand delay '+Math.round(lat.delay/lat.frames)+' ms)':''));
  const el=document.getElementById('latency'); if(el){el.textContent=parts.join(' · ');
    if(diag.stalls||diag.stutters){const w=document.createElement('span');w.className='warn';w.textContent=' · '+[diag.stalls?diag.stalls+' freeze'+(diag.stalls>1?'s':''):'',diag.stutters?diag.stutters+' stutter'+(diag.stutters>1?'s':''):''].filter(Boolean).join(', ');el.appendChild(w);}}
  lat.frames=0;lat.track=0;lat.cam=0;lat.delay=0;
},1000);
/* Camera view: its shape (the camera's own, square or 2:1) and a zoom. The picture fills the view and the edges
   that don't fit are cropped; left/right and up/down are then measured across what you can see (camWin), so a hand
   reaches the end of a range at the visible edge and is still tracked a little past it */
st.camZoom=1.15; st.camShape='cam';
try{ const v=JSON.parse(localStorage.getItem('vh-camview')||'null'); if(v){ if(v.z>=1&&v.z<=1.6)st.camZoom=v.z; if(['cam','square','wide'].includes(v.s))st.camShape=v.s; } }catch(e){}
// Where across the visible picture the right hand's left/right range runs (0 = left edge, 1 = right edge), one per mode
st.xSpan={r:[.1,.9],b:[.45,.95]};
try{ const v=JSON.parse(localStorage.getItem('vh-xspan')||'null'); for(const m of ['r','b'])if(v&&Array.isArray(v[m])&&v[m][0]>=0&&v[m][1]<=1&&v[m][1]-v[m][0]>=.15)st.xSpan[m]=v[m]; }catch(e){}
const xSpanNow=()=>st.xSpan[st.rightOnly?'r':'b'];
// Up/down the same way, as heights from the bottom of the picture (0 = bottom edge, 1 = top), one span for both modes
st.ySpan=[.1,.8];
try{ const v=JSON.parse(localStorage.getItem('vh-yspan')||'null'); if(Array.isArray(v)&&v[0]>=0&&v[1]<=1&&v[1]-v[0]>=.15)st.ySpan=v; }catch(e){}
const camViewSave=()=>{ try{localStorage.setItem('vh-camview',JSON.stringify({z:st.camZoom,s:st.camShape}))}catch(e){} };
const camWin={x0:0,x1:1,y0:0,y1:1};   // the part of the camera frame on screen, as frame fractions
const fvx=x=>(x-camWin.x0)/(camWin.x1-camWin.x0), fvy=y=>(y-camWin.y0)/(camWin.y1-camWin.y0);   // frame → what you see
function fitView(){ const v=$('view');
  if(st.camShape==='square')v.style.setProperty('--cam-ar','1 / 1'); else if(st.camShape==='wide')v.style.setProperty('--cam-ar','2 / 1');
  else if(video.videoWidth&&video.videoHeight)v.style.setProperty('--cam-ar',`${video.videoWidth} / ${video.videoHeight}`); else v.style.removeProperty('--cam-ar'); }
// Hand tracking can run on the graphics chip (default) or the processor; switching rebuilds it
let trackDelegate='GPU'; try{const v=localStorage.getItem('vh-delegate');if(v==='GPU'||v==='CPU')trackDelegate=v}catch(e){}
// Each tracker (GPU/CPU × one/two hands) is built once and kept, so switching back is instant.
// Building one briefly blocks the page; that's expected, so it's logged as a note, not a freeze.
cam.trackers={};
/* Hand tracking runs in a background worker, so a slow or stalled tracking frame (the graphics chip
   can stall while a key auto-repeats) only delays hand updates: the video, keys and arpeggio keep going.
   If the worker can't start, tracking falls back to running on the page as before. */
const WORKER_SRC=`
self.exports={};self.module={exports:self.exports};
// Names prefixed vhw so they can't collide with the tracking library's own top-level names
let vhwLib=null,vhwFiles=null,vhwCur=null,vhwHow='';const vhwLms={},vhwTexts={};
// Some sites (the published page included) won't let a background worker load scripts straight from
// the library's website. The page fetches the two script files itself and hands their text over, and
// loading falls back: direct link → local copy → run the text.
const vhwImport=self.importScripts.bind(self);
function vhwLoad(url){
  const errs=[];
  if(!self.vhwSkip||self.vhwSkip<1){try{vhwImport(url);vhwHow=vhwHow||'direct';return}catch(e){errs.push('direct: '+(e&&e.message||e))}}
  const txt=vhwTexts[url];
  if(txt!=null){
    if(!self.vhwSkip||self.vhwSkip<2){try{vhwImport(URL.createObjectURL(new Blob([txt],{type:'text/javascript'})));vhwHow='local copy';return}catch(e){errs.push('copy: '+(e&&e.message||e))}}
    try{(0,eval)(txt);vhwHow='run text';return}catch(e){errs.push('run: '+(e&&e.message||e))}
  }
  throw new Error(errs.join(' | '));
}
self.importScripts=(...urls)=>urls.forEach(u=>vhwLoad(String(u)));   // the library loads its engine this way too
async function vhwSetup(mp,model,del,hands){
  if(!vhwLib){vhwLoad(mp+'/vision_bundle.cjs');vhwLib=self.module.exports.FilesetResolver?self.module.exports:self.exports;vhwFiles=await vhwLib.FilesetResolver.forVisionTasks(mp+'/wasm');}
  const key=del+'/'+hands;
  if(!vhwLms[key])vhwLms[key]=await vhwLib.HandLandmarker.createFromOptions(vhwFiles,{baseOptions:{modelAssetPath:model,delegate:del},runningMode:'VIDEO',numHands:hands,minHandDetectionConfidence:.6,minTrackingConfidence:.5});
  vhwCur=vhwLms[key];
}
onmessage=async e=>{const m=e.data;
  if(m.type==='setup'){const t=performance.now();
    if(m.texts)Object.assign(vhwTexts,m.texts); if(m.skip)self.vhwSkip=m.skip;
    try{await vhwSetup(m.mp,m.model,m.del,m.hands);postMessage({type:'ready',id:m.id,how:vhwHow,ms:performance.now()-t});}
    catch(err){postMessage({type:'failed',id:m.id,msg:String(err&&err.message||err)});}}
  else if(m.type==='frame'){const t=performance.now();let lm=[];
    try{lm=vhwCur?vhwCur.detectForVideo(m.bmp,m.ts).landmarks||[]:[];}catch(err){}
    // the picture goes back too, so the page shows the exact frame the hand was found in
    try{postMessage({type:'result',lm,ts:m.ts,ms:performance.now()-t,bmp:m.bmp},[m.bmp]);}catch(err){try{m.bmp.close()}catch(e){}postMessage({type:'result',lm,ts:m.ts,ms:performance.now()-t});}}
};`;
cam.useWorker=true; cam.inflight=false; cam.setupId=0; cam.pending={};
// One frame in flight at a time. Called every screen refresh, the moment a new camera frame arrives,
// and as soon as the worker hands back a result, so no frame waits longer than it has to.
function sendFrame(){
  if(!cam.ready||!cam.inWorker||cam.inflight||!cam.on||!cam.worker||video.readyState<2||video.currentTime===cam.lastT)return;
  cam.lastT=video.currentTime; cam.inflight=true; const t0=performance.now();
  createImageBitmap(video).then(bmp=>{ if(!cam.worker||!cam.on){bmp.close();cam.inflight=false;return;}
    cam.worker.postMessage({type:'frame',bmp,ts:t0},[bmp]); }).catch(()=>{cam.inflight=false});
}
function watchFrames(){   // new camera frames, without waiting for the screen refresh where supported
  if(cam.rvfc||!video.requestVideoFrameCallback)return; cam.rvfc=true;
  const f=()=>{sendFrame();video.requestVideoFrameCallback(f)}; video.requestVideoFrameCallback(f);
}
function startWorker(){
  if(cam.worker)return cam.worker;
  const w=new Worker(URL.createObjectURL(new Blob([WORKER_SRC],{type:'text/javascript'})));
  w.onmessage=e=>{const m=e.data;
    if(m.type==='result'){ if(m.bmp){ if(cam.on){try{cam.shown&&cam.shown.close()}catch(e){} cam.shown=m.bmp;} else m.bmp.close(); }
      cam.hands=m.lm;cam.inflight=false;cam.fresh=true;lat.frames++;lat.track+=m.ms;lat.delay+=performance.now()-m.ts;noteTrackTime(m.ms);
      sendFrame();    // the worker is free again: hand it the newest picture now rather than at the next screen refresh
      onHands();}     // and act on the result right away instead of waiting for the screen
    else if(cam.pending[m.id]){cam.pending[m.id](m);delete cam.pending[m.id];}};
  w.onerror=()=>{cam.inflight=false};
  return cam.worker=w;
}
async function workerTexts(){   // fetched by the page, where the library's website is allowed
  if(cam.wTexts)return cam.wTexts;
  const urls=[MP+'/vision_bundle.cjs',MP+'/wasm/vision_wasm_internal.js'], texts={};
  await Promise.all(urls.map(async u=>{try{const r=await fetch(u);if(r.ok)texts[u]=await r.text();}catch(e){}}));
  return cam.wTexts=texts;
}
async function workerSetup(del,hands){
  const id=++cam.setupId, texts=cam.wSent?null:await workerTexts(); cam.wSent=true;
  return new Promise(res=>{cam.pending[id]=res;cam.worker.postMessage({type:'setup',id,mp:MP,model:MODEL,del,hands,texts,skip:window.__vhwSkip||0});});
}
const handsWanted=()=>st.rightOnly&&st.pedalHand!=='fist'?1:2;
async function loadTracker(){
  if(cam.useWorker){
    const hands=handsWanted(), key=trackDelegate+'/'+hands, t=performance.now();
    try{
      startWorker(); cam.ready=false;
      const r=await workerSetup(trackDelegate,hands);
      if(r.type!=='ready')throw new Error(r.msg);
      cam.numHands=hands; cam.delegate=trackDelegate; cam.inflight=false; cam.ready=true; cam.inWorker=true; watchFrames();
      if(!cam.seen)cam.seen={}; if(!cam.seen[key]){cam.seen[key]=1;diagAdd(`Set up hand tracking for ${hands} hand${hands>1?'s':''} on ${trackDelegate} in the background (${Math.round(performance.now()-t)} ms${r.how&&r.how!=='direct'?', loaded via '+r.how:''})`,false);}
      renderDiag(); return;
    }catch(err){
      try{cam.worker&&cam.worker.terminate()}catch(e){} cam.worker=null; cam.wSent=false; cam.useWorker=false; cam.inWorker=false;
      diagAdd('Background hand tracking isn’t available in this browser ('+String(err&&err.message||err).slice(0,240)+'), so it runs on the page',true);
    }
  }
  return loadTrackerOnPage();
}
async function loadTrackerOnPage(){
  const hands=handsWanted(), key=trackDelegate+'/'+hands;   // looking for a second hand costs a full search every frame
  if(cam.trackers[key]){ cam.lm=cam.trackers[key]; cam.numHands=hands; cam.delegate=trackDelegate; cam.lastT=-1; cam.ready=true; renderDiag(); return; }
  cam.ready=false; diag.building++; const t=performance.now();
  try{
    if(!cam.vision){cam.vision=await import(MP);cam.files=await cam.vision.FilesetResolver.forVisionTasks(MP+'/wasm');}
    cam.trackers[key]=await cam.vision.HandLandmarker.createFromOptions(cam.files,{baseOptions:{modelAssetPath:MODEL,delegate:trackDelegate},runningMode:'VIDEO',numHands:hands,
      minHandDetectionConfidence:.6,minTrackingConfidence:.5});
    cam.lm=cam.trackers[key]; cam.numHands=hands; cam.delegate=trackDelegate; cam.lastT=-1; cam.ready=true;
    diagAdd(`Set up hand tracking for ${hands} hand${hands>1?'s':''} on ${trackDelegate} (${Math.round(performance.now()-t)} ms, first time only)`,false);
  } finally { setTimeout(()=>{diag.building=Math.max(0,diag.building-1)},400); }
}
// On the processor, tracking gets an exact-size copy of the frame: reading the video element directly
// there can report points at the wrong scale (the skeleton drifts down and to the side).
const trackCv=document.createElement('canvas'), trackG=trackCv.getContext('2d');
function trackInput(){
  if(cam.delegate!=='CPU')return video;
  const vw=video.videoWidth,vh=video.videoHeight;
  if(trackCv.width!==vw||trackCv.height!==vh){trackCv.width=vw;trackCv.height=vh}
  trackG.drawImage(video,0,0,vw,vh); return trackCv;
}
// Rebuild the tracker when the number of hands it should look for changes
async function ensureTrackerHands(){
  if(!cam.on||!cam.ready||(!cam.vision&&!cam.worker))return;
  if(cam.numHands!==handsWanted()){try{await loadTracker()}catch(e){}}
}
// If tracking keeps stalling on the graphics chip, move it to the processor
const gpuSpikes=[];
function noteTrackTime(ms){
  if(trackDelegate!=='GPU'||ms<250)return;
  const now=performance.now(); gpuSpikes.push(now); while(gpuSpikes.length&&now-gpuSpikes[0]>120000)gpuSpikes.shift();
  // (The processor is usually slower overall, so we don't switch automatically; the menu is there to try it.)
}
function stopCamera(){
  cam.on=false;cam.ready=false;cam.inflight=false;cam.hands=[];cam.L=cam.R=null;cam.lastRes=0;try{cam.shown&&cam.shown.close()}catch(e){}cam.shown=null;cam.stream?.getTracks().forEach(t=>t.stop());cam.stream=null;
  $('camBtn').textContent='Play with your hands';
  g.clearRect(0,0,cv.width,cv.height);$('hudL').textContent='Left hand · chord';$('hudR').textContent='Right hand · voicing';status();
}

const stab={L:{cand:undefined,thumb:false,flip:false,flipCand:undefined,flipN:0,prog:0},
            R:{cand:undefined,thumb:false,prog:0}};
// Thumb uses hysteresis: it opens at a modest spread and only closes once it's clearly tucked,
// so a relaxed, slightly-open thumb counts as open.
function fingers(lm,side){
  const ar=(video.videoWidth||16)/(video.videoHeight||9);
  const d=(a,b)=>Math.hypot((lm[a].x-lm[b].x)*ar,lm[a].y-lm[b].y);
  const palm=d(0,9);
  const spread=d(4,5)/palm;                 // thumb tip to index knuckle
  const across=d(4,17)<d(2,17)*0.95;        // tip folded toward the pinky side
  const s=stab[side];
  if(s.thumb){ if(spread<0.30||across) s.thumb=false; }
  else if(spread>0.40&&!across) s.thumb=true;
  const f=[[8,6],[12,10],[16,14],[20,18]].map(([tip,pip])=>d(tip,0)>d(pip,0)*1.12);
  return [s.thumb,...f];
}
// Lean of the hand as seen on screen (mirrored): 0° = fingers straight up, + = leaning right.
function lean(lm){
  const ar=(video.videoWidth||16)/(video.videoHeight||9);
  const dx=-(lm[9].x-lm[0].x)*ar, dy=lm[0].y-lm[9].y;
  return Math.atan2(dx,dy)*180/Math.PI;
}
// Which way the left palm faces, from the raw (unmirrored) camera image.
// > 0: palm toward the camera; < 0: back of the hand toward the camera; near 0: edge-on.
// How near the hand is: the size of the palm's wrist–index knuckle–pinky knuckle triangle, measured with the
// tracker's depth guess too. That triangle doesn't bend, so tipping the knuckles toward the camera at the wrist
// (or rolling the hand) barely changes it; only bringing the whole hand closer does. Scaled to read like the old wrist-to-knuckle length
function palmNear(lm,ar){ const p=i=>[lm[i].x*ar,lm[i].y,(lm[i].z||0)*ar], d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const w=p(0),i=p(5),k=p(17); return (d(w,i)+d(w,k)+d(i,k))/3/.82; }
function palmFacing(lm){
  const ar=(video.videoWidth||16)/(video.videoHeight||9);
  const ix=(lm[5].x-lm[0].x)*ar, iy=lm[5].y-lm[0].y, px=(lm[17].x-lm[0].x)*ar, py=lm[17].y-lm[0].y;
  const size=((lm[9].x-lm[0].x)*ar)**2+(lm[9].y-lm[0].y)**2;
  return (ix*py-iy*px)/(size||1);
}
// How long a gesture must hold before it counts, as a number of tracking results. Written as screen frames
// (n × 1/60 s) so the feel doesn't depend on how fast tracking runs; Fast response halves it.
// Normal mode always wants two agreeing results, so a single misread frame never plays a chord.
cam.stepMs=33; cam.lastRes=0;
const nF=n=>Math.max(st.fast?1:2,Math.round(n*16.7*(st.fast?.5:1)/cam.stepMs));
/* One Euro filter for the hand-driven knobs: smooths hard while the hand is still (no jitter) and
   hardly at all while it moves fast (no lag). Restarts from the hand's real position after it's been away. */
const euroF={};
function euro(key,x,now,scale=1){
  let f=euroF[key]; if(!f||now-f.t>300){euroF[key]={t:now,x,dx:0};return x}
  const dt=Math.max(.004,(now-f.t)/1000), a=c=>1/(1+1/(2*Math.PI*c*dt)); f.t=now;
  f.dx+=((x-f.x)/dt-f.dx)*a(1);
  const cut=(st.fast?3:1.2)+6*Math.abs(f.dx)/scale;     // Hz: higher = follows faster
  return f.x+=(x-f.x)*a(cut);
}
function leftDegree(fs,lm){
  const [t,i,m,r,p]=fs;
  if(st.left67==='horns'){            // horns 🤘 (index + pinky) = 6, ILY 🤟 (add the thumb) = 7
    if(i&&p&&!m&&!r) return t?6:5;
  } else if(st.left67==='asl'){       // ASL: thumb tip touching the pinky tip = 6, the ring-finger tip = 7
    if(lm){const ar=(video.videoWidth||16)/(video.videoHeight||9),d=(a,b)=>Math.hypot((lm[a].x-lm[b].x)*ar,lm[a].y-lm[b].y),palm=d(0,9);
      if(i&&m&&r&&!p&&d(4,20)<palm*.38) return 5;
      if(i&&m&&p&&!r&&d(4,16)<palm*.38) return 6;}
  } else {                            // Chinese hand-counting: thumb + pinky (🤙) = 6, thumb + index (L) = 7
    if(t&&p&&!i&&!m&&!r) return 5;
    if(t&&i&&!m&&!r&&!p) return 6;
  }
  const n=fs.filter(Boolean).length;
  return n===0?null:Math.min(n,5)-1;
}
function loop(){
  if(!cam.on)return;
  requestAnimationFrame(loop);
  const rect=cv.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  const cw=Math.round(rect.width*dpr),ch=Math.round(rect.height*dpr);
  if(cv.width!==cw||cv.height!==ch){cv.width=cw;cv.height=ch}
  const vw=video.videoWidth,vh=video.videoHeight; if(!vw)return;
  // The picture's box: the whole view, or in full screen with 2:1, the biggest 2:1 box that fits (Square isn't kept in full
  // screen: the left/right span does that job). The picture fills its box (otherwise full screen shows all of it), then zooms
  const full=document.body.classList.contains('full'), A=st.camShape==='wide'?2:0;
  let rx=0,ry=0,rw=cw,rh=ch; if(full&&A){ if(cw/ch>A){rw=ch*A;rx=(cw-rw)/2}else{rh=cw/A;ry=(ch-rh)/2} }
  const fit=full&&!A?Math.min(rw/vw,rh/vh):Math.max(rw/vw,rh/vh);
  const sc=fit*st.camZoom,ox=rx+(rw-vw*sc)/2,oy=ry+(rh-vh*sc)/2;
  { const wx=Math.min(1,rw/(vw*sc)), wy=Math.min(1,rh/(vh*sc)); camWin.x0=(1-wx)/2; camWin.x1=1-camWin.x0; camWin.y0=(1-wy)/2; camWin.y1=1-camWin.y0; }
  g.save();g.clearRect(0,0,cw,ch);g.translate(cw,0);g.scale(-1,1);
  if(rw<cw||rh<ch){ g.beginPath(); g.rect(rx,ry,rw,rh); g.clip(); }
  // In the background mode, show the frame the hand was found in so the skeleton stays on the hand
  const pic=cam.inWorker&&cam.shown&&cam.shown.width?cam.shown:video;
  g.globalAlpha=.55;g.drawImage(pic,ox,oy,vw*sc,vh*sc);g.globalAlpha=1;
  if(video.currentTime!==lat.lastT){lat.lastT=video.currentTime;lat.cam++}
  if(cam.ready&&cam.inWorker) sendFrame();
  else if(cam.ready&&video.currentTime!==cam.lastT){cam.lastT=video.currentTime;
    const t0=performance.now(); let hands=[]; try{hands=timed('hand tracking',()=>cam.lm.detectForVideo(trackInput(),performance.now())).landmarks||[]}catch(e){}
    const tt=performance.now()-t0; lat.frames++; lat.track+=tt; noteTrackTime(tt);
    cam.hands=hands; onHands();
  }
  const {L,R}=cam, P=p=>[ox+p.x*vw*sc,oy+p.y*vh*sc];
  [[L,'#d6ab52'],[R,'#83b9a9']].forEach(([h,col])=>{ if(!h)return;
    g.strokeStyle=col;g.lineWidth=3*dpr;g.lineCap='round';
    CONN.forEach(([a,b])=>{const[x1,y1]=P(h[a]),[x2,y2]=P(h[b]);g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke()});
    g.fillStyle=col;h.forEach(p=>{const[x,y]=P(p);g.beginPath();g.arc(x,y,3.5*dpr,0,7);g.fill()});
  });
  g.restore();
  if(st.guides)timed('drawing guides',()=>drawGuides({cw,ch,vw,vh,sc,ox,oy,dpr}));
}
// Every new tracking result: decide which hand is which, then act on it
function onHands(){
  const now=performance.now(), hands=cam.hands||[];
  if(cam.lastRes){const dt=now-cam.lastRes; if(dt<250)cam.stepMs+=(Math.max(8,dt)-cam.stepMs)*.1;} cam.lastRes=now;
  let L=null,R=null;
  if(st.rightOnly){
    // Any single hand is the right hand; with two, the one further right on screen (smaller raw x)
    if(hands.length){const s=[...hands].sort((a,b)=>a[0].x-b[0].x);R=s[0];if(st.pedalHand==='fist'&&s[1])L=s[1];}
  }
  else if(hands.length>=2){const s=[...hands].sort((a,b)=>b[0].x-a[0].x);L=s[0];R=s[1]}
  else if(hands.length===1){hands[0][0].x>.5?L=hands[0]:R=hands[0]}
  cam.L=L; cam.R=R; if(L||R)cam.handAt=now;
  if(cam.ready)timed('reading hands',()=>handleHands(L,R));
}
// Hand speed, for velocity: how fast the palm moved over the last ~⅓ second, in frame heights per second
const motion={L:{p:null,t:0,hist:[]},R:{p:null,t:0,hist:[]}};
function trackSpeed(side,lm){
  const m=motion[side],now=performance.now(),ar=(video.videoWidth||16)/(video.videoHeight||9);
  const x=(lm[0].x+lm[9].x)/2*ar, y=(lm[0].y+lm[9].y)/2;
  if(m.p&&now-m.t<200){ const sp=Math.hypot(x-m.p[0],y-m.p[1])/((now-m.t)/1000);
    if(sp<15)m.hist.push([now,sp]); }   // bigger jumps are the tracker swapping hands, not real movement
  m.p=[x,y]; m.t=now; m.hist=m.hist.filter(h=>now-h[0]<350);
}
// Peak speed just before now, or null when that hand hasn't been seen recently
function handPeak(side){ const m=motion[side]; if(!cam.on||performance.now()-m.t>300)return null;
  return m.hist.reduce((a,h)=>Math.max(a,h[1]),0); }
// Hand speed as 0 (still) to 1 (fast); Speed sensitivity in MIDI out sets how fast counts as full
function handSpeed01(side){ const s=handPeak(side); return s===null?null:Math.pow(clamp01((s-.1)/(3*Math.pow(.2,midiOut.sens))),.75); }
function showVel(v){ const el=document.getElementById('midiVelNote'); if(el&&midiOut.velMode==='speed')el.textContent=`Last chord struck at velocity ${v}`; }
// A hand counts as gone after it's been out of view this long (ms); the "gone" actions run once
const GONE_MS=200;
const seen=(s,now)=>{s.seen=now;s.goneDone=false};
const goneOnce=(s,now,ms=GONE_MS)=>{ if(s.goneDone||now-(s.seen||0)<ms)return false; s.goneDone=true; return true; };
// Counts agreeing results for a gesture; true once, the moment it has held long enough
function steady(s,k,val,need){
  if(val===s[k+'C'])s[k+'N']++; else{s[k+'C']=val;s[k+'N']=1;s[k+'F']=false}
  if(!s[k+'F']&&s[k+'N']>=need){s[k+'F']=true;return true} return false;
}
function handleHands(L,R){
  const now=performance.now();
  if(L)trackSpeed('L',L); if(R)trackSpeed('R',R);
  // Left: chord
  const sL=stab.L;
  if(st.rightOnly){
    if(st.pedalHand==='fist'&&L){ seen(sL,now); const fist=!fingers(L,'L').slice(1).some(Boolean);
      if(fist===sL.pedCand)sL.pedN++;else{sL.pedCand=fist;sL.pedN=1}
      if(sL.pedN>=nF(3)&&fist!==pedalSrc.hand){audio.init();setPedal('hand',fist)}
      $('hudL').textContent='Left · '+(pedalSrc.hand?'fist → pedal down':'open → pedal up'); }
    else { if(goneOnce(sL,now)&&pedalSrc.hand)setPedal('hand',false); $('hudL').textContent=st.pedalHand==='fist'?'Left hand · fist for pedal':'Left hand · number keys'; }
  }
  else if(L&&looper.playing){
    // The loop owns the chord: the left hand only steers Position until the loop stops
    seen(sL,now); st.inVals.lx=euro('lx',clamp01((fvx(1-L[0].x)-.05)/.45),now); driveCtrls(['lx']); showRouteVals();
    sL.cand=undefined; $('hudL').textContent='Left · loop is playing the chords (C or Space stops it)';
  }
  else if(L){
    seen(sL,now);const fs=fingers(L,'L'),deg=leftDegree(fs,L);
    // Palm roll: back of the left hand toward the camera → shift (with hysteresis + a few steady frames)
    let palmTxt='';
    if(st.palmShift!=='off'){
      const pc=palmFacing(L); let back=sL.back??false;
      if(!back&&pc<-.12)back=true; else if(back&&pc>.04)back=false;
      if(back===sL.backCand)sL.backN++;else{sL.backCand=back;sL.backN=1}
      if(sL.backN>=nF(4)&&back!==sL.back){sL.back=back;setShift('palm',back?(st.palmShift==='flat'?-1:1):null)}
      palmTxt=sL.back?(st.palmShift==='flat'?' · back ♭':' · back ♯'):' · palm';
    }
    // Twist: lean right past TURN degrees flips major/minor; back under ~10° returns to normal
    const a=lean(L);
    let want=st.flip;
    if(st.leftTwist==='dir'){ if(a<-15)want=true; else if(a>15)want=false; }   // right = major, left = minor; upright keeps the last choice
    else { if(!st.flip&&a>TURN)want=true; else if(st.flip&&a<10)want=false; }   // lean right flips, upright returns
    if(want===sL.flipCand)sL.flipN++;else{sL.flipCand=want;sL.flipN=1}
    if(sL.flipN>=nF(4)&&want!==st.flip)setFlip(want);
    // Left/right across the left half of the frame (mirrored) → Position input
    st.inVals.lx=euro('lx',clamp01((fvx(1-L[0].x)-.05)/.45),now); driveCtrls(['lx']); showRouteVals();
    // Height zones for the bass note, with a dead band so it doesn't flicker between zones
    if(st.handInv){
    const y=fvy(L[9].y); let zone=sL.zone??0;
    if(zone===0){ if(y<0.30)zone=1; else if(y>0.70)zone=2; }
    else if(zone===1){ if(y>0.36)zone=y>0.70?2:0; }
    else if(zone===2){ if(y<0.64)zone=y<0.30?1:0; }
    if(zone===sL.zoneCand)sL.zoneN++;else{sL.zoneCand=zone;sL.zoneN=1}
    if(sL.zoneN>=nF(4)&&zone!==sL.zone){sL.zone=zone;setInvSource('hand',zone)}
    } else if(sL.zone!==undefined){sL.zone=undefined;sL.zoneCand=undefined;setInvSource('hand',null)}
    sL.cand=deg; const fire=steady(sL,'deg',deg,nF(4)); sL.prog=Math.min(1,sL.degN/nF(4));
    $('hudL').textContent=`Left · ${fs.filter(Boolean).length} up → ${deg===null?'stop':romanOf(deg)} · lean ${Math.round(a)}°${palmTxt}${st.handInv?' · '+['root','1st inv','2nd inv'][sL.zone??0]:''}${posTarget()!==null&&st.ctrl.position.src.startsWith('lx')?' · pos '+midiName(Math.round(posTarget())):''}`;
    // With "Left fist holds the pedal", a fist lets the chord go but keeps it ringing under the pedal
    if(fire&&st.pedalHand==='fist'&&(deg===null)!==pedalSrc.hand){audio.init();setPedal('hand',deg===null);}
    // Compare with the chord that's coming: a queued one if chord changes wait for the beat, otherwise the one sounding
    if(fire){ handOwnsChord=true; const next=chordQ.timer!==null?chordQ.d:st.sounding?st.degree:null;
      if(deg!==next)play(deg); }
  } else {
    $('hudL').textContent='Left hand · chord';
    if(goneOnce(sL,now)){
      if(pedalSrc.hand)setPedal('hand',false);
      if(sL.back){sL.back=false;sL.backCand=undefined;setShift('palm',null)}
      if(sL.zone!==undefined){sL.zone=undefined;sL.zoneCand=undefined;setInvSource('hand',null)}
      sL.cand=sL.degC=undefined;
      // Only silence a chord the left hand started, never one played from the keys, pads or the loop
      if(st.sounding&&!looper.playing&&handOwnsChord)play(null);
    }
  }
  // Right: voicing, volume, tone
  const sR=stab.R;
  if(R){
    seen(sR,now);
    const fs=fingers(R,'R'),thumb=fs[0],n=fs.slice(1).filter(Boolean).length; // thumb not counted
    // Expression inputs, smoothed, then sent through the routing panel
    const ar=(video.videoWidth||16)/(video.videoHeight||9), mx=1-R[0].x, a=lean(R); // left/right from the wrist, so twisting the hand doesn't move it
    st.leanDeg=euro('leanDeg',a,now,45);
    const raw={
      x: (([a,b])=>clamp01((fvx(mx)-a)/(b-a)))(xSpanNow()),   // measured across what you can see, over the span you set
      y: (([a,b])=>clamp01((1-fvy(R[9].y)-a)/(b-a)))(st.ySpan),   // height in what you can see, over the span you set
      lean: clamp01(a/45),
      tilt: clamp01(.5+a/90),            // upright = ½, 45° either way = the ends
      dist: clamp01((palmNear(R,ar)-.09)/.22),   // push the whole hand toward the camera
      roll: clamp01(.5+palmFacing(R)),   // palm to the camera = 1, side-on = ½, back of the hand = 0
      speed: handSpeed01('R')??0,
    };
    for(const k in raw)st.inVals[k]=euro(k,raw[k],now);
    driveCtrls(); showRouteVals();
    let label='';
    if(st.rh){
      sR.cand=n; if(steady(sR,'v',n,nF(5)))setVoicing(st.rhMap[n]); sR.prog=Math.min(1,sR.vN/nF(5));
      label=` → ${VOICINGS.find(v=>v.id===st.rhMap[n]).name}`;
      if(steady(sR,'s7',thumb,nF(5)))setSevenths(thumb);
    }
    label+=` · lean ${Math.round(a)}°${st.sevForce?` (${twistTag()})`:st.alt7?(st.s7?' (♭7)':' (add9)'):''}`;
    $('hudR').textContent=`Right · ${n} up${label} · thumb ${thumb?(majMode()?'out (maj7)':'out (key 7th)'):'in'}`;
  } else { $('hudR').textContent='Right hand · voicing';
    if(st.inVals.speed){ st.inVals.speed=0; driveCtrls(['speed']); }   // no hand, no speed
    // A hand-driven pitch bend springs back to in tune once the hand is gone, like letting go of a bend wheel
    if(goneOnce(sR,now,100)){ sR.cand=sR.vC=sR.s7C=undefined;
      if(st.ctrl.bend.src!=='none'&&st.ctrl.bend.v!==.5){ st.inVals.tilt=.5; lastDriven.bend=undefined; setCtrl('bend',.5); } }
  }
}
