/* ---------- Theory ---------- */
// Modes: scale steps from the tonic, plus where the tonic sits in its relative major (for sharps vs flats)
const MODES={
  ionian:    {name:'Major (Ionian)',  steps:[0,2,4,5,7,9,11], rel:0},
  dorian:    {name:'Dorian',          steps:[0,2,3,5,7,9,10], rel:2},
  phrygian:  {name:'Phrygian',        steps:[0,1,3,5,7,8,10], rel:4},
  lydian:    {name:'Lydian',          steps:[0,2,4,6,7,9,11], rel:5},
  mixolydian:{name:'Mixolydian',      steps:[0,2,4,5,7,9,10], rel:7},
  aeolian:   {name:'Minor (Aeolian)', steps:[0,2,3,5,7,8,10], rel:9},
  locrian:   {name:'Locrian',         steps:[0,1,3,5,6,8,10], rel:11},
  harmonic:  {name:'Harmonic minor',  steps:[0,2,3,5,7,8,11], rel:9},
  melodic:   {name:'Melodic minor',   steps:[0,2,3,5,7,9,11], rel:9},
};
const MAJOR_STEPS=[0,2,4,5,7,9,11];
let SCALE=MODES.ionian.steps;
const SHARP=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const FLAT =['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
const KEYS=[[0,'C',0],[1,'D♭',1],[2,'D',0],[3,'E♭',1],[4,'E',0],[5,'F',1],[6,'F♯',0],[7,'G',0],[8,'A♭',1],[9,'A',0],[10,'B♭',1],[11,'B',0]];
const FN={0:'R',1:'♭9',2:'9',3:'♭3',4:'3',5:'11',6:'♭5',7:'5',8:'♭13',9:'13',10:'♭7',11:'7'};

const degInt=(d,k)=>{const i=d+k;return SCALE[i%7]+12*Math.floor(i/7)-SCALE[d]};
// Flipped chords keep the root and swap major/minor. Flipped major chords become dominant 7ths
// (II7, III7, VI7 = secondary dominants); flipped minor chords become m7.
// Diminished and augmented chords flip to plain minor.
// Chromatic shift: -1 flat, +1 sharp, 0 none. A held key wins over the palm-roll gesture.
// While the chord loop plays a recorded chord, its flat/sharp wins until you play one yourself
const shiftAmt=()=>st.loopOv?st.loopOv.shift:(st.shiftKey??st.shiftPalm??0);
const rootPcOf=d=>((KEYS[st.key][0]+SCALE[d]+shiftAmt())%12+12)%12;
// "Twist picks 7th": right-hand twist left = maj7, twist right = 7 (thumb out). Upright = the usual 7th.
function force7(c){
  // Eric style, minor chords: upright / twist left = m7, twist right = °7 (Color also gives °7)
  if(st.sevMode==='twistE'&&st.s7&&c.t===3&&c.f===7){
    const dim=st.sevForce?st.sevForce==='dom':c.s===11;
    if(dim){c.f=6;c.s=9}else c.s=10;
    return c;
  }
  if((st.sevMode==='twist'||st.sevMode==='twistE')&&st.s7&&st.sevForce&&c.f!==6) c.s=st.sevForce==='maj'?11:10;
  return c;
}
function tonesOf(d,flip=st.flip,alt7=st.alt7){
  let c={t:degInt(d,2),f:degInt(d,4),s:degInt(d,6),n:degInt(d,8),six:degInt(d,5)};
  const sh=shiftAmt();
  if(st.pure){
    // Pure major/minor: every degree is a plain major chord; flip makes it minor. No diminished chords.
    c={t:flip?3:4,f:7,s:flip?10:11,n:14,six:9};
    if(st.s7&&alt7) c.s = c.s===11?10:11;   // color swaps to the other 7th (maj7 ↔ 7, m7 ↔ m(maj7))
    return force7(c);
  }
  if(sh&&st.shiftQual==='common'){
    // Common usage: flat → borrowed major chords (♭II ♭III ♭VI maj7, ♭VII7 "backdoor" dominant)
    //               sharp → passing diminished chords (♯i°7, ♯iv°7 …)
    if(sh<0) c=flip?{t:3,f:7,s:10,n:14,six:9}:{t:4,f:7,s:d===6?10:11,n:14,six:9};
    else     c=flip?{t:3,f:7,s:10,n:14,six:9}:{t:3,f:6,s:9,n:14,six:8};
    if(st.s7&&alt7) c.s = c.s===9?10:c.s===11?10:11;   // color swaps to the other 7th
    return force7(c);
  }
  if(flip){ const toMajor=c.t===3&&c.f===7; c={t:toMajor?4:3,f:7,s:10,n:14,six:9}; }
  // "Other 7th": swap major 7th <-> flat 7th (IVmaj7 -> IV7, V7 -> Vmaj7, iim7 -> iim(maj7))
  // Only when 7ths are on; with 7ths off the same gesture adds a 9th instead (see realize)
  if(st.s7){
    if((st.sevMode==='twist'||st.sevMode==='twistE')){ // upright: natural 7th by chord type (maj → maj7, minor → m7, dim → m7♭5)
      c.s = c.t===4&&c.f===7 ? 11 : 10;
      if(alt7) c.s = c.s===11?10:11;              // Color (A key) still swaps it
    }
    else if(majMode()) c.s = alt7?10:11;          // thumb = maj7, lean + thumb = ♭7
    else if(alt7) c.s = c.s===11?10:11;           // diatonic 7th, lean swaps it
  }
  return force7(c);
}
const has7=()=>st.s7;
// "Major 7th everywhere" only makes sense while lean can reach the ♭7; with the lean switch off, 7ths follow the key
const majMode=()=>st.sevMode==='maj'&&st.leanColor!==false;
const addNine=()=>st.alt7&&!st.s7;
// Roman numeral from the chord's real quality, with ♭/♯ relative to the major scale (Phrygian ♭II, etc.)
const NUMS=['I','II','III','IV','V','VI','VII'];
const voicingNow=()=>st.loopOv?.voicing||st.voicing;   // a loop chord can carry its own voicing
function romanOf(d){
  const c=tonesOf(d), off=SCALE[d]-MAJOR_STEPS[d]+shiftAmt();
  const acc=off<0?'♭'.repeat(-off):off>0?'♯'.repeat(off):'';
  const n=NUMS[d];
  if(voicingNow()==='dim') return acc+n.toLowerCase()+'°';
  if(c.t===4) return acc+n+(c.f===8?'+':'');
  return acc+n.toLowerCase()+(c.f===6?'°':'');
}
const modeLabel=()=>`${pcName(KEYS[st.key][0])} ${MODES[st.mode].name.replace(/ \(.*\)/,'').replace('Major','major').replace('Minor','minor')}`;
// Spell with flats when the mode's relative major is a flat key
const names=()=>{ if(st.shiftKey??st.shiftPalm){return (st.shiftKey??st.shiftPalm)<0?FLAT:SHARP} // ♭ chords spelled with flats, ♯ with sharps
  // Diminished chords stack minor 3rds, so they read best in flats (B D F A♭) unless the root itself is a black key
  // ♭5 chords read best in flats too (C E G♭), unless the root is a black key
  if(st.voicing==='flat5'&&st.degree!==null&&![1,3,6,8,10].includes((KEYS[st.key][0]+SCALE[st.degree])%12))return FLAT;
  if(st.degree!==null&&(st.voicing==='dim'||tonesOf(st.degree).f===6)&&![1,3,6,8,10].includes((KEYS[st.key][0]+SCALE[st.degree])%12)&&st.sevMode==='twistE'&&st.s7||st.voicing==='dim'&&st.degree!==null&&![1,3,6,8,10].includes((KEYS[st.key][0]+SCALE[st.degree])%12))return FLAT;
  const rel=(KEYS[st.key][0]-MODES[st.mode].rel+12)%12;return [1,3,5,8,10].includes(rel)?FLAT:SHARP};
const pcName=pc=>names()[((pc%12)+12)%12];
const midiName=m=>pcName(m)+(Math.floor(m/12)-1);

function inversions(t){const out=[];let cur=[...t].sort((a,b)=>a-b);for(let i=0;i<cur.length;i++){out.push(cur.slice());cur.push(cur.shift()+12)}return out}
function drop(v,n){const a=v.slice();a[a.length-n]-=12;return a.sort((x,y)=>x-y)}

const VOICINGS=[
 {id:'close',name:'Close',key:'Q',blurb:'Chord tones packed as tightly as they go.',
  shapes:(c,s7)=>inversions(s7?[0,c.t,c.f,c.s]:[0,c.t,c.f])},
 {id:'open',name:'Open',key:'W',blurb:'Root and 5th low, 3rd and 7th lifted an octave. Wide and cinematic.',
  shapes:(c,s7)=>[s7?[0,c.f,c.t+12,c.s+12]:[0,c.f,c.t+12,24]]},
 {id:'sus2',name:'Sus 2',key:'E',blurb:'The 3rd replaced by the 2nd. Open and airy, neither major nor minor.',
  shapes:(c,s7)=>inversions(s7?[0,c.n-12,c.f,c.s]:[0,c.n-12,c.f])},
 {id:'sus4',name:'Sus 4',key:'R',blurb:'The 3rd replaced by the 4th. Unresolved, wants to fall back to the 3rd. With 7ths: 7sus4.',
  shapes:(c,s7)=>inversions(s7?[0,5,c.f,c.s]:[0,5,c.f])},
 {id:'six',name:'6',key:'T',blurb:'Triad plus the major 6th. Sweet and settled, the old-school ending chord. With 7ths: a 13 voicing.',
  shapes:(c,s7)=>s7?[[0,c.s,c.t+12,21],[0,c.t,c.s,21]]:inversions([0,c.t,c.f,9])},
 {id:'flat6',name:'♭6',key:'Y',blurb:'Triad plus the flat 6th. Bittersweet and cinematic. With 7ths: a ♭13 voicing.',
  shapes:(c,s7)=>s7?[[0,c.s,c.t+12,20],[0,c.t,c.s,20]]:inversions([0,c.t,c.f,8])},
 {id:'drop2',name:'Drop 2',key:'U',blurb:'Second voice from the top dropped an octave. The jazz guitar sound.',
  shapes:(c,s7)=>inversions(s7?[0,c.t,c.f,c.s]:[0,c.t,c.f,12]).map(v=>drop(v,2))},
 {id:'drop3',name:'Drop 3',key:'I',blurb:'Third voice from the top dropped. Big spread with a gap in the middle.',
  shapes:(c,s7)=>inversions(s7?[0,c.t,c.f,c.s]:[0,c.t,c.f,12]).map(v=>drop(v,3))},
 {id:'shell',name:'Shell',key:'O',blurb:'Root with only the 3rd and 7th. Lean and clear. Without 7ths it plays root, 3rd and 5th.',
  shapes:(c,s7)=>s7?[[0,c.t,c.s],[0,c.s,c.t+12]]:[[0,c.t,c.f],[0,c.f,c.t+12]]},
 {id:'rootless',name:'Rootless',key:'P',blurb:'3-5-7-9 or 7-9-3-5 with no root on top. The Bill Evans piano sound.',
  shapes:(c,s7)=>s7?[[c.t,c.f,c.s,c.n],[c.s,c.n,c.t+12,c.f+12]]:[[c.t,c.f,c.n],[c.f,c.n,c.t+12]]},
 {id:'quartal',name:'Quartal',key:'K',blurb:'Stacked 4ths built from the chord. Open and modern, a bit ambiguous.',
  shapes:c=>[[c.t,c.six,c.n,c.f+12],[c.s-12,c.t,c.six,c.n]]},
 {id:'add9',name:'Add 9',key:'L',blurb:'Triad with the 9th floating on top. Bright and open.',
  shapes:c=>[[0,c.t,c.f,c.n],[0,c.f,c.n,c.t+12]]},
 {id:'guitar',name:'Guitar',key:'G',blurb:'Barre-chord shapes spread over two octaves, like an E- or A-shape on guitar. Try it with Strum.',
  shapes:(c,s7)=>[[0,c.f,s7?c.s:12,c.t+12,c.f+12,24],[0,c.f,s7?c.s:12,c.t+12,c.f+12]]},
 {id:'power',name:'Power chord',key:'H',blurb:'Root, 5th and octave with no 3rd: neither major nor minor. Great with Drive.',
  shapes:c=>[[0,c.f,12],[0,c.f,12,c.f+12]]},
 {id:'ninesus',name:'9sus4',key:'J',blurb:'Root, 4th, 7th and 9th. The warm suspended sound of neo-soul and modern R&B.',
  shapes:c=>[[0,5,c.s,c.n],[0,c.s,c.n,17]]},
 {id:'sowhat',name:'So What',key:'B',blurb:'Three stacked 4ths with a 3rd on top, from Kind of Blue. Minor chords sound as m11, major chords as 13.',
  shapes:(c,s7,d)=>{const minor=c.t===3;
    if(st.flip)return [minor?[0,5,10,15,19]:[c.t,c.t+5,c.t+10,c.t+15,c.t+19]];
    const k=minor?0:2;return [[k,k+3,k+6,k+9,k+11].map(i=>degInt(d,i))];}},
 {id:'dim',name:'Dim',key:'D',blurb:'Makes the chord diminished: root, ♭3 and ♭5. With 7ths it plays °7 (fully diminished); Color swaps to m7♭5. Works in Pure maj/min too.',
  shapes:(c,s7)=>inversions(s7?[0,3,6,st.alt7?10:9]:[0,3,6])},
 {id:'flat5',name:'♭5',key:'M',blurb:'Lowers the 5th a semitone: C E G♭. Tense and jazzy (7♭5, the French-sixth sound). Minor chords become ° without 7ths, or half-diminished m7♭5 when the 7th is ♭7.',
  shapes:(c,s7)=>inversions(s7?[0,c.t,6,c.s]:[0,c.t,6])},
 {id:'upper',name:'Upper structure',key:'N',blurb:'A second triad stacked above the chord. Major chords get the shimmering ♯11 Lydian sound, minor chords a lush m11.',
  shapes:(c,s7)=>c.t===4?[[0,c.t,...(s7?[c.s]:[]),14,18,21]]:[[0,c.t,10,14,17]]},
];
const RH_DEFAULT=['close','open','sus2','sus4','six']; // index = fingers up (0–4, thumb not counted)

function chordName(d,rel){
  const c=tonesOf(d), root=pcName(rootPcOf(d));
  if(st.voicing==='dim') return root+(has7()?(st.alt7?'m7♭5':'°7'):'°');
  const minor=c.t===3, dim=c.f===6, aug=c.t===4&&c.f===8, s=c.s%12, n9=c.n%12, six=c.six%12;
  const h7=rel.has(s), h9=rel.has(n9), h6=rel.has(six);
  let q;
  if(h7){
    if(aug) q=s===11?'maj7♯5':'7♯5';
    else if(dim&&s===9) q='°7';
    else q=!minor?(s===11?'maj7':'7'):(s===11?(dim?'m(maj7)♭5':'m(maj7)'):(dim?'m7♭5':'m7'));
    if(h9){ if(n9===2){q=q.replace('7',h6?'13':'9')} else q+='(♭9)'; }
  } else {
    q=aug?'+':minor?(dim?'°':'m'):'';
    if(h6&&h9) q+='6/9'; else if(h9) q+=q?'(add9)':'add9';
  }
  return root+q;
}
