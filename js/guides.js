/* ---------- Guides on the camera view: what each hand is about to do, and where each hand-driven knob reads from ---------- */
st.guides=true; try{const v=localStorage.getItem('vh-guides');if(v!==null)st.guides=v==='1'}catch(e){}
const GCOL={L:'#d6ab52',R:'#83b9a9'};
// Hand inputs that have a place on screen, with the stretch of the (mirrored) frame each one reads
const X_RANGE=()=>st.rightOnly?[.1,.9]:[.45,.95], LX_RANGE=[.05,.5], Y_RANGE=[.9,.2];
const drivenBy=src=>Object.keys(TARGETS).filter(k=>st.ctrl[k].src===src);
const ctrlTxt=k=>`${KSHORT[k]} ${fmtVal(k)}`;
function drawGuides({cw,ch,vw,vh,sc,ox,oy,dpr}){
  // Screen position of a mirrored frame fraction (0 = left edge as you see it) and a frame height fraction
  // X and Y take fractions of what you can see (the view may be zoomed or cropped); P places a tracked point
  const Xf=mx=>cw-ox-(1-mx)*vw*sc, Yf=y=>oy+y*vh*sc, P=p=>[Xf(1-p.x),Yf(p.y)];
  const X=mx=>Xf(camWin.x0+mx*(camWin.x1-camWin.x0)), Y=y=>Yf(camWin.y0+y*(camWin.y1-camWin.y0));
  const fs=Math.round(11*dpr);
  g.save(); g.lineCap='round'; g.textBaseline='middle'; g.font=`500 ${fs}px "IBM Plex Mono", ui-monospace, monospace`;
  const chip=(t,x,y,col,align='center')=>{ const w=g.measureText(t).width+fs*.9, h=fs*1.7;
    let x0=align==='center'?x-w/2:align==='right'?x-w:x; x0=Math.max(4*dpr,Math.min(cw-w-4*dpr,x0));
    g.fillStyle='rgba(22,17,14,.8)'; g.beginPath(); g.roundRect(x0,y-h/2,w,h,h/2); g.fill();
    g.fillStyle=col; g.textAlign='left'; g.fillText(t,x0+fs*.45,y+dpr*.5); };
  const track=(x0,y0,x1,y1,t,col,label,labelSide)=>{
    g.strokeStyle='rgba(242,233,218,.18)'; g.lineWidth=4*dpr; g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1,y1); g.stroke();
    const mx=x0+(x1-x0)*t, my=y0+(y1-y0)*t;
    g.strokeStyle=col; g.globalAlpha=.85; g.beginPath(); g.moveTo(x0,y0); g.lineTo(mx,my); g.stroke(); g.globalAlpha=1;
    g.fillStyle=col; g.beginPath(); g.arc(mx,my,6*dpr,0,7); g.fill();
    // Across: the label rides above the marker. Up: it sits at the top of the track, clear of the hand
    if(labelSide==='above')chip(label,mx,my-fs*1.6,col); else chip(label,x1+fs*.4,y1-fs*1.6,col,'right');
  };
  const {L,R}=cam, sL=stab.L, sR=stab.R;
  // Nobody in view for a moment: say where hands go
  if(!L&&!R&&cam.ready&&performance.now()-(cam.handAt||0)>1500){
    chip(st.rightOnly?'Raise your right hand, palm toward the camera':'Raise your left hand on the left for chords, your right hand on the right for the sound',cw/2,ch*.45,'#f2e9da');
    if(!st.rightOnly){ chip('chords ✋',X(.25),ch*.56,GCOL.L); chip('✋ voicing & sound',X(.75),ch*.56,GCOL.R); }
  }
  // Left hand: inversion zones down the left half
  if(L&&st.handInv&&!st.rightOnly&&!looper.playing){
    const xa=X(0)+8*dpr, xb=X(.5), cur=sL.zone??0;
    g.setLineDash([6*dpr,6*dpr]); g.strokeStyle='rgba(214,171,82,.35)'; g.lineWidth=1.5*dpr;
    for(const y of [.33,.67]){g.beginPath();g.moveTo(xa,Y(y));g.lineTo(xb,Y(y));g.stroke()}
    g.setLineDash([]);
    [['1st inv',.165,1],['root',.5,0],['2nd inv',.835,2]].forEach(([t,y,z])=>chip(t,xa,Y(y),z===cur?GCOL.L:'rgba(169,154,139,.8)','left'));
  }
  // Knob tracks: right hand across and up, left hand across
  const xs=drivenBy('x');
  if(xs.length){ const [a,b]=X_RANGE(), y=Y(.955); track(X(a),y,X(b),y,st.inVals.x,GCOL.R,'✋ ↔ '+xs.map(ctrlTxt).join(' · '),'above'); }
  const ys=drivenBy('y');
  if(ys.length){ const x=X(.975); track(x,Y(Y_RANGE[0]),x,Y(Y_RANGE[1]),st.inVals.y,GCOL.R,'✋ ↕ '+ys.map(ctrlTxt).join(' · ')); }
  const lxs=drivenBy('lx');
  if(lxs.length&&!st.rightOnly){ const y=Y(.955); track(X(LX_RANGE[0]),y,X(LX_RANGE[1]),y,st.inVals.lx,GCOL.L,'Left ↔ '+lxs.map(ctrlTxt).join(' · '),'above'); }
  // Hands: a ring that fills while a gesture settles, with what it will play
  const ring=(h,s,col,label,need)=>{
    const [cx,cy]=P(h[9]), [wx,wy]=P(h[0]), r=Math.max(14*dpr,Math.hypot(cx-wx,cy-wy)*.55);
    g.lineWidth=3*dpr; g.strokeStyle='rgba(22,17,14,.55)'; g.beginPath(); g.arc(cx,cy,r,0,7); g.stroke();
    g.strokeStyle=col; g.beginPath(); g.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*(s.prog||0)); g.stroke();
    if(label)chip(label,cx,cy-r-fs*1.3,col);
    return {cx,cy,r,wx,wy};
  };
  if(L&&!st.rightOnly){
    const d=sL.cand, label=looper.playing?'loop':d===undefined?'':d===null?'stop':romanOf(d);
    ring(L,looper.playing?{prog:0}:sL,GCOL.L,label);
  }
  if(R){
    const v=st.rh&&sR.cand!==undefined?VOICINGS.find(x=>x.id===st.rhMap[sR.cand]):null;
    const {cx,cy,r,wx,wy}=ring(R,st.rh?sR:{prog:0},GCOL.R,v?v.name:'');
    // Lean and tilt: an arc over the wrist with a needle at the hand's angle
    const tl=drivenBy('tilt'), ln=drivenBy('lean');
    if(tl.length||ln.length){
      const rr=Math.hypot(cx-wx,cy-wy)*1.35, a0=-Math.PI/2+(tl.length?-Math.PI/4:0), a1=-Math.PI/2+Math.PI/4;
      g.lineWidth=3*dpr; g.strokeStyle='rgba(242,233,218,.22)'; g.beginPath(); g.arc(wx,wy,rr,a0,a1); g.stroke();
      const a=-Math.PI/2+Math.max(tl.length?-45:0,Math.min(45,st.leanDeg))*Math.PI/180;
      g.strokeStyle=GCOL.R; g.beginPath(); g.moveTo(wx+Math.cos(a)*rr*.82,wy+Math.sin(a)*rr*.82); g.lineTo(wx+Math.cos(a)*rr*1.08,wy+Math.sin(a)*rr*1.08); g.stroke();
      // Label at the arc's right end, clear of the voicing name above the hand
      chip([...tl,...ln].map(ctrlTxt).join(' · '),wx+Math.cos(a1)*rr+fs*.6,wy+Math.sin(a1)*rr,GCOL.R,'left');
    }
    // Push/pull and palm roll have no direction on screen: list them under the hand
    const rest=[...drivenBy('dist').map(k=>'Push '+ctrlTxt(k)),...drivenBy('roll').map(k=>'Palm '+ctrlTxt(k)),...drivenBy('speed').map(k=>'Speed '+ctrlTxt(k))];
    rest.forEach((t,i)=>chip(t,cx,cy+r+fs*(1.4+i*1.9),GCOL.R));
  }
  g.restore();
}
$('optGuides').checked=st.guides;
$('optGuides').addEventListener('change',e=>{st.guides=e.target.checked;try{localStorage.setItem('vh-guides',st.guides?'1':'0')}catch(err){}});
