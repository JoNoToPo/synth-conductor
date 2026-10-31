/* ---------- Bow dial: the up or down bow character of each chord ----------
   The middle is plain (no bow character). Left of it is an up bow (from the tip: a light, slightly darker start that swells), right is a down bow
   (from the frog: a firm, bright bite that settles). Every chord comes in with the side the dial is on, and crossing
   the middle re-strikes the sounding chord in the new direction, so a hand or an LFO on the dial can saw back and forth.
   It shapes the chord voices only; the drone and percussion are left alone */
const bow={dir:null,side:null,at:0,timer:null,seq:-1};
const bowDir=()=>{ const v=effV('bow'); return v<.45?'up':v>.55?'down':null; };   // null: the plain middle
// The stroke's shape t seconds in: a level multiplier and a treble tilt in dB. Both settle to neutral after a few seconds
function bowShape(t){
  if(bow.dir==='down')return {amp:1+.45*Math.exp(-t/.16), db:4.5*Math.exp(-t/.3)};
  return {amp:Math.min(1,.4+.6*t/.28), db:-2.5*Math.exp(-t/1.6)};
}
function bowTick(){ if(!audio.voiceBus)return; const t=(performance.now()-bow.at)/1000, c=audio.ctx.currentTime, s=bowShape(t);
  audio.voiceBus.gain.setTargetAtTime(s.amp,c,.015); audio.bowTone.gain.setTargetAtTime(s.db,c,.03);
  if(t>4){ clearInterval(bow.timer); bow.timer=null; audio.voiceBus.gain.setTargetAtTime(1,c,.05); audio.bowTone.gain.setTargetAtTime(0,c,.05); } }
function bowStroke(restrike){ if(!audio.ctx||!audio.voiceBus)return;
  bow.dir=bowDir(); bow.at=performance.now();
  if(!bow.dir){ bow.at-=1e5; bowTick(); return; }   // plain: straight back to neutral
  if(restrike&&st.sounding&&st.degree!==null){ const all=st.bassNote!==null?[st.bassNote,...st.upper]:st.upper; audio.setNotes(all,{retrigger:true}); }
  bowTick(); if(!bow.timer)bow.timer=setInterval(bowTick,30); }
// The knob moved: going from one side to the other is a new stroke
function bowMoved(){ const d=bowDir(); if(d===null){ if(bow.dir!==null){ bow.dir=null; bowStroke(false); } return; }
  if(bow.side!==null&&d!==bow.side)bowStroke(true); else bow.dir=d; bow.side=d; }
// Each new chord takes the character of the side the dial is on
{ const r0=render; render=function(){ r0.apply(this,arguments); if(st.sounding&&st.chordSeq!==bow.seq){ bow.seq=st.chordSeq; if(bowDir())bowStroke(false); } }; }
