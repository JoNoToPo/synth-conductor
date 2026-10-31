/* ---------- Playing through: laptop speakers or headphones ----------
   Auto reads the name of the browser's sound output (Chrome and Edge give it once camera access is allowed) and
   guesses from it: "Speakers (Realtek…)" is a laptop's, "Headphones…", Bluetooth, HDMI or USB are full-range.
   Laptop speakers get the whole Low notes lift, everything else a third of it. Choosing one yourself overrides the guess */
const spk={pick:'auto',seen:null,label:''};
try{ const v=localStorage.getItem('vh-spk'); if(['auto','laptop','full'].includes(v))spk.pick=v; }catch(e){}
const SPK_FULL=/head(phone|set)|earphone|earbud|airpods|buds|bluetooth|hands-free|hdmi|display ?audio|displayport|monitor|\btv\b|usb|line ?out|s\/?pdif|optical|digital|receiver|soundbar|airplay|external/i;
const SPK_LAPTOP=/speaker|built-in|internal/i;
function spkGuess(label){ return !label?null:SPK_FULL.test(label)?'full':SPK_LAPTOP.test(label)?'laptop':null; }
async function spkDetect(){
  try{ const list=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audiooutput');
    const d=list.find(x=>x.deviceId==='default')||list[0];
    spk.label=(d?.label||'').replace(/^Default\s*-\s*/i,''); spk.seen=spkGuess(spk.label);
  }catch(e){ spk.label=''; spk.seen=null; }
  spkSet(); }
function spkSet(){
  const full=(spk.pick==='auto'?spk.seen||'laptop':spk.pick)==='full';
  const what=spk.seen==='full'?'headphones or full-range':spk.seen==='laptop'?'laptop speakers':null;
  $('spkSel').value=spk.pick;
  $('spkSel').options[0].textContent=what?`Auto: ${what}`:'Auto';
  $('spkNote').textContent=spk.pick!=='auto'?'':spk.label?(what?`Sound is going to ${spk.label}.`:`Sound is going to ${spk.label}; treating it as laptop speakers.`)
    :'Can’t see the sound output yet (the browser names it once the camera is allowed), so it’s treated as laptop speakers.';
  if(full===spkFull)return; spkFull=full;
  if(typeof dr!=='undefined'&&dr.voices.length){ dr.sig=''; droneSync(); }   // the drone rebuilds with its new lift; chords take it from their next notes
}
$('spkSel').addEventListener('change',e=>{ spk.pick=e.target.value; try{localStorage.setItem('vh-spk',spk.pick)}catch(err){} spkSet(); });
navigator.mediaDevices?.addEventListener?.('devicechange',spkDetect);   // headphones plugged in or out
spkDetect();
