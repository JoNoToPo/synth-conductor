/* ---------- Lo-fi: bit crush, lower sample rate, tape wobble and a noise bed ----------
   It works on the whole mix, reverb and delay included, just before the tone controls.
   Crush and Rate run in a small audio processor; until it loads (or where a browser can't run one) they're skipped */
const LOFI_WORKLET=`class VhLofi extends AudioWorkletProcessor{
  static get parameterDescriptors(){return [{name:'bits',defaultValue:16,minValue:2,maxValue:16},{name:'hold',defaultValue:1,minValue:1,maxValue:64}]}
  constructor(){super();this.h=[0,0];this.c=[0,0]}
  process(ins,outs,p){const i=ins[0],o=outs[0];if(!i||!i.length)return true;
    const bits=p.bits[0],hold=Math.max(1,Math.round(p.hold[0])),q=Math.pow(2,bits-1),crush=bits<15.9;
    for(let ch=0;ch<o.length;ch++){const x=i[ch]||i[0],y=o[ch];let c=this.c[ch]||0,h=this.h[ch]||0;
      for(let n=0;n<y.length;n++){if(c<=0){h=crush?Math.round(x[n]*q)/q:x[n];c=hold}y[n]=h;c--}
      this.c[ch]=c;this.h[ch]=h}
    return true}}
registerProcessor('vh-lofi',VhLofi);`;
const lofi={node:null,ready:false,noise:null,noiseGain:null,noiseSrc:null,wob:null,wobGain:null,wobFl:null};
// Called once the audio graph exists: a pass-through point for Crush and Rate, the wobble LFOs and the noise bed
function lofiInit(){
  const c=audio.ctx; if(!c||lofi.inp)return;
  lofi.inp=c.createGain(); lofi.out=c.createGain();
  audio.pumpGain.disconnect(audio.bassEq); audio.pumpGain.connect(lofi.inp); lofi.inp.connect(lofi.out); lofi.out.connect(audio.bassEq);
  // Wobble: a slow wow and a quicker flutter on every oscillator's pitch, in cents
  lofi.wob=c.createGain(); lofi.wob.gain.value=0;
  const wow=c.createOscillator(); wow.frequency.value=.55; const fl=c.createOscillator(); fl.frequency.value=6.3;
  const wowG=c.createGain(); wowG.gain.value=1; const flG=c.createGain(); flG.gain.value=.22;
  wow.connect(wowG); fl.connect(flG); wowG.connect(lofi.wob); flG.connect(lofi.wob); wow.start(); fl.start();
  audio.wobble=lofi.wob;
  { const sink=c.createGain(); sink.gain.value=0; lofi.wob.connect(sink); sink.connect(lofi.out); }   // keeps it running between notes, so its level moves smoothly
  // Noise bed, crushed along with everything else
  lofi.noiseGain=c.createGain(); lofi.noiseGain.gain.value=0; lofi.noiseGain.connect(lofi.inp); lofiNoiseType(st.fx.noiseType);
  // The processor itself
  if(c.audioWorklet&&window.Blob&&window.URL){
    const url=URL.createObjectURL(new Blob([LOFI_WORKLET],{type:'application/javascript'}));
    c.audioWorklet.addModule(url).then(()=>{ lofi.node=new AudioWorkletNode(c,'vh-lofi',{outputChannelCount:[2]}); lofi.ready=true;
      lofi.inp.disconnect(lofi.out); lofi.inp.connect(lofi.node); lofi.node.connect(lofi.out); lofiApply(); }).catch(()=>{}).finally(()=>URL.revokeObjectURL(url));
  }
  lofiApply(); applyCtrl('wobble'); applyCtrl('noise');
}
// Two seconds of noise, looped: hiss is bright and even; vinyl is a soft rumble with sparse crackles
function lofiNoiseBuf(type){ const c=audio.ctx, n=c.sampleRate*2, b=c.createBuffer(2,n,c.sampleRate);
  for(let ch=0;ch<2;ch++){ const d=b.getChannelData(ch); let lp=0;
    for(let i=0;i<n;i++){ const w=Math.random()*2-1;
      if(type==='vinyl'){ lp+=(w-lp)*.02; let x=lp*.6; if(Math.random()<.00035)x+=(Math.random()<.5?-1:1)*(.4+Math.random()*.6); d[i]=x; }
      else d[i]=w*.5; } }
  return b; }
function lofiNoiseType(type){ if(!audio.ctx||!lofi.noiseGain)return;
  if(lofi.noiseSrc){ try{lofi.noiseSrc.stop();lofi.noiseSrc.disconnect()}catch(e){} }
  const s=audio.ctx.createBufferSource(); s.buffer=lofiNoiseBuf(type==='vinyl'?'vinyl':'hiss'); s.loop=true;
  let out=s; if(type!=='vinyl'){ const hp=audio.ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=2500; s.connect(hp); out=hp; }
  out.connect(lofi.noiseGain); s.start(); lofi.noiseSrc=s; }
// Crush: 16 bits (clean) down to 4. Rate: every sample held for up to 32, so 48 kHz down to about 1.5 kHz
const lofiBits=v=>v<.02?16:16-v*12, lofiHold=v=>v<.02?1:1+Math.round(v*v*31);
function lofiApply(){ if(!lofi.ready)return; const t=audio.ctx.currentTime;
  lofi.node.parameters.get('bits').setValueAtTime(lofiBits(effV('crush')),t); lofi.node.parameters.get('hold').setValueAtTime(lofiHold(effV('rate')),t); }
function lofiWobble(v){ if(lofi.wob)audio.ramp(lofi.wob.gain,v*28,.05); }   // up to about ±28 cents of wow
function lofiNoise(v){ if(lofi.noiseGain)audio.ramp(lofi.noiseGain.gain,v*v*.08,.05); }

$('noiseType').value=st.fx.noiseType||'hiss';
$('noiseType').addEventListener('change',e=>{ st.fx.noiseType=e.target.value; saveFx(); lofiNoiseType(st.fx.noiseType); });
// The audio graph is made on the first tap; hook in as soon as it exists
{ const i0=audio.init.bind(audio); audio.init=function(){ const fresh=!this.ctx; i0(); if(fresh||!lofi.inp)lofiInit(); }; }
