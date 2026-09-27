/* Optional spatial studies. No texture swaps: the six drawing surfaces retain
 * their identities while cameras, hinges and pigment assemblies move in 3D. */
window.createInkMotion = function ({scene,n,arrivals,duration,align}) {
  const kind=scene.motionVariant;
  if(!kind)return null;
  const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  const add=(a,b)=>a.map((v,i)=>v+b[i]),scale=(a,s)=>a.map(v=>v*s);
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const norm=a=>scale(a,1/Math.max(1e-9,Math.hypot(...a)));
  const ID=[1,0,0,0,1,0,0,0,1],ZERO=[0,0,0];
  const roles=['construction','warm-gesture','cool-shadow','pigment','graphite','features'];
  const hold=scene.alignedHoldSeconds??1.2;
  function rotate(v,yaw=0,pitch=0){
    const cp=Math.cos(pitch),sp=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw);
    const [x,y,z]=v,yy=y*cp-z*sp,zz=y*sp+z*cp;
    return [x*cy+zz*sy,yy,-x*sy+zz*cy];
  }
  function matrix(yaw,pitch=0,s=1){return [rotate([s,0,0],yaw,pitch),rotate([0,s,0],yaw,pitch),rotate([0,0,s],yaw,pitch)].flat();}
  const cube=[
    {center:[0,0,-3.6],yaw:0,pitch:0},
    {center:[3.6,0,0],yaw:-Math.PI/2,pitch:0},
    {center:[0,3.6,0],yaw:0,pitch:Math.PI/2},
    {center:[-3.6,0,0],yaw:Math.PI/2,pitch:0},
    {center:[0,-3.6,0],yaw:0,pitch:-Math.PI/2}
  ];
  const families=Array.from({length:n},(_,i)=>{
    let f;
    if(kind==='cube')f={...cube[i%5],center:add(cube[i%5].center,[0,0,-Math.floor(i/5)*14])};
    else if(kind==='fold')f={center:[i*3.65,0,0],yaw:0,pitch:0};
    else if(kind==='dive')f={center:[Math.sin(i*1.8)*.3,Math.sin(i*1.2)*.2,-i*9],yaw:0,pitch:0};
    else f={center:[Math.sin(i*1.5)*1.2,Math.sin(i*1.3)*.55,-i*6],yaw:Math.sin(i)*.16,pitch:0};
    return {...f,size:kind==='cube'?.94:1,normal:rotate([0,0,1],f.yaw,f.pitch),up:rotate([0,1,0],f.yaw,f.pitch)};
  });
  function segment(t){
    let i=0;while(i<n-1&&t>=arrivals[i+1])i++;
    const start=arrivals[i]+hold,end=i<n-1?arrivals[i+1]:duration;
    return {i,p:clamp((t-start)/Math.max(.001,end-start))};
  }
  function aligned(i){const f=families[i];return {eye:add(f.center,scale(f.normal,align)),target:f.center.slice(),up:f.up,roll:0};}
  function cameraAt(t){
    const {i,p}=segment(t),a=families[i],q=ease(p),wave=Math.sin(Math.PI*q);
    if(i===n-1){const c=aligned(i);c.eye=add(c.eye,scale(a.normal,.55*q));return c;}
    const b=families[i+1],center=mix(a.center,b.center,q),up=norm(mix(a.up,b.up,q));
    if(kind==='cube'){
      const normal=norm(mix(a.normal,b.normal,q));
      return {eye:scale(normal,align-3.6+wave*5.8),target:scale(normal,-3.6),up,roll:wave*(i%2?-.16:.16)};
    }
    if(kind==='fold')return {eye:add(center,[0,wave*1.2,align+wave*1.7]),target:center,up,roll:Math.sin(q*Math.PI*2)*.09};
    if(kind==='dive')return {eye:add(center,[Math.sin(q*Math.PI*2)*.30,wave*.26,align]),target:add(center,[0,0,-1]),up,roll:Math.sin(Math.PI*q)*(i%2?-.62:.62)};
    const normal=norm(mix(a.normal,b.normal,q));
    return {eye:add(add(center,scale(normal,align-wave*2.8)),[wave*.35,wave*.35,0]),target:center,up,roll:Math.sin(q*Math.PI*2)*.28};
  }
  function objectState(familyIndex,role,t){
    const {i,p}=segment(t),f=families[familyIndex],r=Math.max(0,roles.indexOf(role));
    const state={pivot:f.center,matrix:ID,shift:ZERO,opacity:1};
    if(kind==='cube')return state;
    if(familyIndex!==i&&familyIndex!==i+1)return {...state,opacity:0};
    if(i===n-1)return state;
    const incoming=familyIndex===i+1;
    if(kind==='fold'){
      const q=ease(clamp((p-r*.018)/(1-r*.018)));
      const angle=incoming?-(1-q)*Math.PI*.54:q*Math.PI*.84;
      state.pivot=add(f.center,[incoming?-1.82:1.82,0,0]);
      state.matrix=matrix(angle,(r-2.5)*.035*Math.sin(Math.PI*q));
      state.shift=[0,(r-2.5)*.07*Math.sin(Math.PI*q),0];
      state.opacity=incoming?ease(p/.22):1-ease((p-.66)/.34);
    }else if(kind==='dive'){
      const wave=Math.sin(Math.PI*ease(p)),theta=r*Math.PI/3;
      state.shift=incoming?ZERO:[Math.cos(theta)*wave*.20,Math.sin(theta)*wave*.20,(r-2.5)*wave*.10];
      state.opacity=incoming?ease((p-.16)/.38):1-ease((p-.52)/.24);
    }else{
      const q=ease(clamp((p-r*.016)/(1-r*.016))),spread=incoming?1-q:q;
      const theta=r*Math.PI/3+i*.7;
      state.shift=[Math.cos(theta)*spread*2.6,Math.sin(theta)*spread*2.3,(r-2.5)*spread*.35];
      state.matrix=matrix(Math.sin(theta)*spread*.65,Math.cos(theta)*spread*.5,1+spread*.22);
      state.opacity=incoming?ease((p-.12-r*.015)/.53):1-ease((p-.24-r*.018)/.58);
    }
    return state;
  }
  return {kind,families,cameraAt,objectState,dynamic:kind!=='cube'&&n>1,rotate,
    visible:(i,cam)=>{
      if(kind!=='cube')return true;
      const f=families[i],forward=norm(cam.target.map((v,k)=>v-cam.eye[k]));
      const front=f.normal.reduce((s,v,k)=>s+v*(cam.eye[k]-f.center[k]),0);
      const depth=forward.reduce((s,v,k)=>s+v*(f.center[k]-cam.eye[k]),0);
      // Do not let curved ink on a wall behind the camera clip through its lens.
      return front>.01&&depth>1.6;
    },
    snapshot:t=>families.map((_,i)=>({family:i,...objectState(i,'pigment',t)}))};
};
