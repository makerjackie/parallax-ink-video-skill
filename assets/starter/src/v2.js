(() => {
  "use strict";
  const data = window.INK_V2_DATA, renderParams = new URLSearchParams(window.INK_RENDER_PARAMS || location.search.slice(1));
  const visibleCount=data.mode==="preview"?3:data.portraits.length;
  const renderMode = renderParams.get("render") === "1";
  if (renderMode) document.body.classList.add("render");
  const art = document.getElementById("art");
  art.width = Number(renderParams.get("w")) || 1080;
  art.height = Number(renderParams.get("h")) || 1920;
  const ctx = art.getContext("2d", {alpha:false});
  const sceneCanvas = document.createElement("canvas");
  sceneCanvas.width = art.width; sceneCanvas.height = art.height;
  const gl = sceneCanvas.getContext("webgl2", {alpha:true,preserveDrawingBuffer:true,antialias:true,premultipliedAlpha:false});
  if (!gl) { window.__error = "WebGL2 is required to render V2"; return; }
  const W=1080,H=1920,FOV=48*Math.PI/180, F=1/Math.tan(FOV/2), ASPECT=W/H, ALIGN=6.2;
  const $=id=>document.getElementById(id);
  const add=(a,b)=>a.map((v,i)=>v+b[i]), sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const scale=(a,s)=>a.map(v=>v*s), dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm=a=>scale(a,1/Math.max(1e-9,Math.hypot(...a)));
  const mix=(a,b,t)=>a+(b-a)*t, mixV=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  // The original fixed-volume path remains the default. Optional motion
  // studies add kinetic hinges, depth passages and pigment dispersal.
  const palette=["#d66b31","#294f96","#d96c39","#436dab","#d16b33"];
  const n=data.portraits.length,scene=data.scene||{};
  const motion=window.createInkMotion?.({scene,n,arrivals:data.arrivals,duration:data.duration,align:ALIGN});
  // Orthogonal folds along a zigzag passage, rather than portraits arranged
  // around the camera. Each arriving face is already inside the preceding view.
  const layout=[
    {center:[0,.1,0],yaw:0,size:1},
    {center:[-2.75,.55,-3.1],yaw:Math.PI/2,size:1.12},
    {center:[-4.10,-.45,-6.6],yaw:0,size:.82},
    {center:[2.25,.35,-8.4],yaw:-Math.PI/2,size:1.04},
    {center:[.15,-.10,-12.2],yaw:0,size:1.06}
  ];
  const families=data.portraits.map((_,i)=>{
    const base=motion?.families[i]||scene.families?.[i]||layout[i%5],cycle=(motion||scene.families)?0:Math.floor(i/5);
    return {...base,center:add(base.center,[cycle*2,0,-cycle*15.5]),color:palette[i%5]};
  });
  const BLOCK=data.blockSeconds||3.5;
  const arrivals=data.arrivals||Array.from({length:n},(_,i)=>i*BLOCK);
  const motionEnd=arrivals[n-1]+BLOCK;
  function pose(i,d=ALIGN,orbit=0,dy=0,side=0){
    const f=families[i],a=f.yaw+orbit,n=[Math.sin(a),0,Math.cos(a)],r=[Math.cos(a),0,-Math.sin(a)];
    return {eye:add(add(add(f.center,scale(n,d)),scale(r,side)),[0,dy,0]),target:f.center.slice(),roll:0};
  }
  function localPoint(i,p){const f=families[i],c=Math.cos(f.yaw),s=Math.sin(f.yaw);return add(f.center,[p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c]);}
  function accentedPose(i,d,orbit,dy,side,weight=1){
    const accent=scene.accents?.[i]||{},v=pose(i,d,orbit,dy+(accent.lift||0)*weight,side);
    if(accent.focus)v.target=mixV(v.target,localPoint(i,[...accent.focus,0]),weight);
    return v;
  }
  const keys=[];
  // Optional calibrated hold: zero endpoint velocity prevents Hermite tangents
  // from pulling the layers apart during the reading interval. Retiming only
  // the exit preserves measured musical arrivals and the original spatial path.
  for(let i=0;i<n;i++){
    const base=arrivals[i],span=i<n-1?arrivals[i+1]-base:BLOCK;
    const hold=scene.alignedHoldSeconds||0;
    const phase=f=>base+(hold?hold+(span-hold)*(f-.18)/.82:span*f);
    const dir=[1,-1,-1,1,-1][i%5];
    keys.push({t:base,...pose(i,6.2,0,0,0),stop:hold>0});
    if(hold) keys.push({t:base+hold,...pose(i,6.2,0,0,0),stop:true});
    else keys.push({t:base+span*.18,...pose(i,5.95,.025,0,0),roll:dir*.015});
    keys.push({t:phase(.39),...accentedPose(i,4.55,dir*.38,dir*.2,dir*.40,.50),roll:dir*.11});
    if(i<n-1){
      keys.push({t:phase(.52),...accentedPose(i,i%2?2.70:1.90,dir*.90,dir*.35,dir*.33),roll:dir*.22+(scene.accents?.[i]?.bank||0)});
      // Read the corner before completing the turn: the previous drawing is
      // seen edge-on beside the next face. This is essential spatial evidence,
      // not an image swap hidden by the foreground wipe.
      const nextFamily=families[i+1],corner=mixV(families[i].center,nextFamily.center,.48);
      const outward=[Math.sin(nextFamily.yaw),0,Math.cos(nextFamily.yaw)];
      keys.push({t:phase(.71),eye:add(add(corner,scale(outward,7.0)),[0,dir*.55,0]),target:corner,roll:-dir*.15});
      const next=pose(i+1,5.8,-dir*.14,-dir*.08,-dir*.10);
      keys.push({t:phase(.89),...next,roll:-dir*.035});
    }else{
      keys.push({t:phase(.60),...accentedPose(i,2.20,-.70,.48,-.5),roll:-.20});
      keys.push({t:phase(.90),eye:[-8.5,1.8,-3.4],target:[-1.9,0,-9.5],roll:.14});
    }
  }
  const endCenter=families[n-1].center;
  if(n!==5){for(const key of keys){if(key.t>arrivals[n-1]+BLOCK*.8){key.eye=add(endCenter,[-4,2.8,7.5]);key.target=endCenter.slice();}}}
  keys.push({t:motionEnd,eye:[-8.7,1.6,-3.2],target:[-1.9,0,-9.5],roll:.07});
  keys.push({t:data.duration,eye:[-8.9,1.5,-3.0],target:[-1.9,0,-9.5],roll:.03});
  if(n!==5){for(const key of keys.slice(-2)){key.eye=add(endCenter,[-4+(key.t-motionEnd)*.15,2.0,8.0]);key.target=endCenter.slice();}}
  if(scene.ending){for(let i=0;i<3;i++){const key=keys[keys.length-3+i],e=scene.ending[i];if(e)Object.assign(key,e);}}
  // Hermite interpolation keeps velocity continuous across internal keys;
  // each key's tangent uses its real neighbouring time spans.
  function hermite(a,b,va,vb,u,dt){const u2=u*u,u3=u2*u;return (2*u3-3*u2+1)*a+(u3-2*u2+u)*va*dt+(-2*u3+3*u2)*b+(u3-u2)*vb*dt;}
  function cameraAt(t){
    if(motion)return motion.cameraAt(t);
    let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;
    const a=keys[i],b=keys[i+1],p=keys[Math.max(0,i-1)],q=keys[Math.min(keys.length-1,i+2)];
    const dt=b.t-a.t,u=Math.max(0,Math.min(1,(t-a.t)/dt));
    const calc=(field,k)=>{
      const get=v=>k==null?(v[field]||0):v[field][k];
      const va=a.stop?0:(get(b)-get(p))/Math.max(.001,b.t-p.t)*.68;
      const vb=b.stop?0:(get(q)-get(a))/Math.max(.001,q.t-a.t)*.68;
      return hermite(get(a),get(b),va,vb,u,dt);
    };
    return {eye:[0,1,2].map(k=>calc('eye',k)),target:[0,1,2].map(k=>calc('target',k)),roll:calc('roll')};
  }
  let program,quad,loc,objects=[];
  function shader(type,src){
    const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;
  }
  function setup(){
    const vs=`#version 300 es
    precision highp float;
    layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUV;
    uniform vec3 uEye,uRight,uUp,uForward; uniform float uF,uAspect;
    out vec2 vUV; out float vZ;
    ${motion?'uniform mat3 uModel; uniform vec3 uPivot,uShift;':''}
    void main(){vec3 v=${motion?'uModel*(aPos-uPivot)+uPivot+uShift':'aPos'}-uEye;float x=dot(v,uRight),y=dot(v,uUp),z=dot(v,uForward);vZ=z;vUV=aUV;
      gl_Position=vec4(x*uF/uAspect,y*uF,z*1.004-.2004,z);}
    `;
    const fs=`#version 300 es
    precision highp float;in vec2 vUV;in float vZ;uniform sampler2D uTex;uniform float uOpacity;out vec4 frag;
    void main(){vec4 c=texture(uTex,vUV);if(c.a<.012||vZ<.11)discard;
      float fog=clamp((vZ-2.0)/14.0,0.0,1.0);c.rgb=mix(c.rgb,vec3(.90,.88,.84),fog*.12);
      frag=vec4(c.rgb,c.a*uOpacity);}
    `;
    program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    loc={eye:gl.getUniformLocation(program,"uEye"),right:gl.getUniformLocation(program,"uRight"),up:gl.getUniformLocation(program,"uUp"),
      opacity:gl.getUniformLocation(program,"uOpacity"),forward:gl.getUniformLocation(program,"uForward"),f:gl.getUniformLocation(program,"uF"),aspect:gl.getUniformLocation(program,"uAspect")};
    if(motion)Object.assign(loc,{model:gl.getUniformLocation(program,'uModel'),pivot:gl.getUniformLocation(program,'uPivot'),shift:gl.getUniformLocation(program,'uShift')});
    gl.useProgram(program);gl.uniform1i(gl.getUniformLocation(program,"uTex"),0);
    gl.uniform1f(loc.f,F);gl.uniform1f(loc.aspect,ASPECT);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);gl.disable(gl.DEPTH_TEST);
  }
  function makePlacedPlane(id,familyIndex,role,depth,center,yaw,sz,image){
    const c=Math.cos(yaw),s=Math.sin(yaw);
    const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>[center[0]+x*sz/2*c,center[1]+y*sz/2,center[2]-x*sz/2*s]);
    const uv=[[0,0],[1,0],[1,1],[0,1]],verts=[],tri=[0,1,2,0,2,3];
    for(const k of tri)verts.push(...corners[k],...uv[k]);
    const vao=gl.createVertexArray(),vbo=gl.createBuffer();
    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,20,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,12);gl.bindVertexArray(null);
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    return {id,familyIndex,role,depth,center,vao,vbo,texture};
  }
  function makePlane(familyIndex,layer,image){
    const f=families[familyIndex],role=data.portraits[familyIndex].layers.indexOf(layer);
    const baseDepth=layer.depth*2.5,sz=3.46*f.size;
    // Six distinct drawing roles sit on tilted, shallow curved surfaces.
    // Back-projecting every vertex from the fixed alignment view preserves the
    // recognizable face at that view while exposing a 3D volume on side views.
    const slopes=[[-.45,.22],[.32,-.16],[-.28,-.22],[.12,.18],[.22,.10],[-.13,.15]][role%6];
    const c=Math.cos(f.yaw),sn=Math.sin(f.yaw),N=4;
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);
    function vertex(u,v){
      const x=(u-.5)*sz,y=(v-.5)*sz;
      const d=baseDepth+slopes[0]*x+slopes[1]*y+.10*Math.sin(x*1.8)*Math.sin(y*1.5);
      const k=(ALIGN-d)/ALIGN,xx=x*k,yy=y*k;
      if(f.pitch){const xyz=motion.rotate([xx,yy,d],f.yaw,f.pitch);return [...add(f.center,xyz),u,v];}
      return [f.center[0]+xx*c+d*sn,f.center[1]+yy,f.center[2]-xx*sn+d*c,u,v];
    }
    const pieces=[];
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const verts=[];
      for(let sy=0;sy<2;sy++)for(let sx=0;sx<2;sx++){
        const u=(x+sx/2)/N,v=(y+sy/2)/N,step=.5/N;
        for(const [du,dv] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]])verts.push(...vertex(u+du*step,v+dv*step));
      }
      const vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,12);gl.bindVertexArray(null);
      pieces.push({id:`${familyIndex}:${layer.role}:${x}:${y}`,familyIndex,role:layer.role,depth:baseDepth,
        center:vertex((x+.5)/N,(y+.5)/N).slice(0,3),vao,vbo,texture,count:verts.length/5});
    }
    return pieces;
  }
  function makeThread(){
    const canvas=document.createElement("canvas");canvas.width=4;canvas.height=32;
    const c=canvas.getContext("2d"),g=c.createLinearGradient(0,0,0,32);
    g.addColorStop(0,"#d8723500");g.addColorStop(.30,"#d87235aa");g.addColorStop(.7,"#be562bd0");g.addColorStop(1,"#d8723500");c.fillStyle=g;c.fillRect(0,0,4,32);
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    const result=[];
    for(let i=0;i<n-1;i++){
      const a=localPoint(i,[-1.12,-1.15,.8]),b=localPoint(i+1,[1.10,-.90,.8]);
      const points=[];
      for(let k=0;k<=64;k++){
        const u=k/64,base=mixV(a,b,u),loop=Math.sin(Math.PI*u),theta=u*Math.PI*4;
        points.push(add(base,[Math.sin(theta)*.38*loop,-.6*loop+Math.cos(theta)*.30*loop,Math.sin(theta)*.28*loop]));
      }
      for(let start=0;start<64;start+=8){
        const vertices=[];
        for(let k=start;k<start+8;k++){
          const a=points[k],b=points[k+1],side=scale(norm(cross(norm(sub(b,a)),[0,0,1])),.009);
          const v=[sub(a,side),add(a,side),add(b,side),sub(b,side)];
          for(const [j,u,vv] of [[0,0,0],[1,0,1],[2,1,1],[0,0,0],[2,1,1],[3,1,0]])vertices.push(...v[j],u,vv);
        }
        const vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,12);gl.bindVertexArray(null);
        result.push({id:`thread:${i}:${start}`,familyIndex:i,role:"thread",depth:0,center:points[start+4],vao,vbo,texture,count:vertices.length/5});
      }
    }
    return result;
  }
  function load(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error("Layer image failed to decode"));im.src=src;});}
  const paper=document.createElement("canvas");paper.width=270;paper.height=480;
  function makePaper(){
    const p=paper.getContext("2d"),im=p.createImageData(paper.width,paper.height);let seed=58291;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
    for(let y=0;y<paper.height;y++)for(let x=0;x<paper.width;x++){
      const i=(y*paper.width+x)*4,n=(random()-.5)*8,w=Math.sin(y*.013+x*.006)*1.6;
      im.data[i]=248+n+w;im.data[i+1]=241+n+w;im.data[i+2]=228+n+w;im.data[i+3]=255;
    }p.putImageData(im,0,0);
  }
  function basis(cam){
    const forward=norm(sub(cam.target,cam.eye)),right=norm(cross(forward,cam.up||[0,1,0]));
    const up=norm(cross(right,forward)),c=Math.cos(cam.roll),s=Math.sin(cam.roll);
    return {forward,right:add(scale(right,c),scale(up,s)),up:add(scale(up,c),scale(right,-s))};
  }
  let debug=false,roleFilter=null,explore=null,playing=false,t=0,lastWall=0;
  const audio=new Audio(data.audio);audio.preload="auto";let muted=false;
  function project(p,cam,b){
    const v=sub(p,cam.eye),z=dot(v,b.forward);
    return [W/2+dot(v,b.right)*F/z*W/(2*ASPECT),H/2-dot(v,b.up)*F/z*H/2,z];
  }
  function drawBackground(){
    ctx.drawImage(paper,0,0,art.width,art.height);
    const wash=ctx.createRadialGradient(art.width*.52,art.height*.46,art.width*.06,art.width*.52,art.height*.46,art.height*.8);
    wash.addColorStop(0,"#fffdfa50");wash.addColorStop(1,"#d8cab428");ctx.fillStyle=wash;ctx.fillRect(0,0,art.width,art.height);
  }
  function drawOverlay(time,cam,b){
    // Full-bleed artwork; no slide furniture or large portrait name cards.
    ctx.save();ctx.scale(art.width/W,art.height/H);
    if(time>data.duration-.85){
      ctx.globalAlpha=smooth((time-data.duration+.85)/.35);
      ctx.textAlign="center";ctx.font='500 22px ui-sans-serif,sans-serif';ctx.fillStyle="#40352c";
      ctx.fillText(scene.outroTitle||"线 的 另 一 面",W/2,1740);
      ctx.font='13px ui-sans-serif,sans-serif';ctx.fillStyle="#887462";ctx.fillText(scene.outroSubtitle||"PARALLAX INK / MAKERJACKIE",W/2,1777);
    }
    ctx.restore();
  }
  const blurCanvas=document.createElement("canvas");blurCanvas.width=art.width;blurCanvas.height=art.height;
  const blurCtx=blurCanvas.getContext("2d",{alpha:false});
  function renderAt(seconds){
    t=Math.max(0,Math.min(data.duration,seconds));
    const cam=explore||cameraAt(t),b=basis(cam);
    const samples=renderMode?3:1;
    for(let sample=0;sample<samples;sample++){
      const sampleTime=Math.max(0,Math.min(data.duration,t+(sample-(samples-1)/2)/180));
      const sampleCam=explore||cameraAt(sampleTime),sampleBasis=basis(sampleCam);
      gl.viewport(0,0,sceneCanvas.width,sceneCanvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);gl.uniform3fv(loc.eye,sampleCam.eye);gl.uniform3fv(loc.right,sampleBasis.right);gl.uniform3fv(loc.up,sampleBasis.up);gl.uniform3fv(loc.forward,sampleBasis.forward);
      const states=new Map();
      const staged=objects.map(o=>{
        if(!motion)return {o,center:o.center,opacity:o.role==="bridge"?(scene.bridgeOpacity??1):1};
        const key=`${o.familyIndex}:${o.role}`;
        if(!states.has(key))states.set(key,motion.objectState(o.familyIndex,o.role,sampleTime));
        const state=states.get(key),v=sub(o.center,state.pivot),m=state.matrix;
        const rotated=[0,1,2].map(k=>m[k]*v[0]+m[k+3]*v[1]+m[k+6]*v[2]);
        return {o,state,center:add(add(rotated,state.pivot),state.shift),opacity:state.opacity};
      }).filter(s=>s.opacity>.001&&(!motion||motion.visible(s.o.familyIndex,sampleCam)));
      staged.sort((a,c)=>dot(sub(c.center,sampleCam.eye),sampleBasis.forward)-dot(sub(a.center,sampleCam.eye),sampleBasis.forward));
      for(const {o,state,opacity} of staged){
        if(roleFilter&&!roleFilter.has(o.role))continue;
        if(state){gl.uniformMatrix3fv(loc.model,false,state.matrix);gl.uniform3fv(loc.pivot,state.pivot);gl.uniform3fv(loc.shift,state.shift);}
        gl.uniform1f(loc.opacity,opacity);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,o.texture);gl.bindVertexArray(o.vao);gl.drawArrays(gl.TRIANGLES,0,o.count||6);
      }
      gl.bindVertexArray(null);drawBackground();ctx.drawImage(sceneCanvas,0,0,art.width,art.height);
      if(samples>1){blurCtx.globalAlpha=1/(sample+1);blurCtx.drawImage(art,0,0);}
    }
    if(samples>1)ctx.drawImage(blurCanvas,0,0);
    if(debug){
      ctx.save();ctx.scale(art.width/W,art.height/H);
      for(let i=0;i<visibleCount;i++){
        const p=project(families[i].center,cam,b);if(p[2]<.2)continue;
        ctx.fillStyle=families[i].color;ctx.fillRect(p[0]-5,p[1]-5,10,10);
        ctx.font="20px sans-serif";ctx.fillText(`${i+1} ${data.portraits[i].id}`,p[0]+14,p[1]);
      }ctx.restore();
    }
    drawOverlay(t,cam,b);
    $("seek").value=t;$("clock").textContent=`${t.toFixed(2)} / ${data.duration.toFixed(2)} s`;
    window.__lastFrame={time:t,eye:cam.eye,target:cam.target,objects:objects.length};
    return window.__lastFrame;
  }
  window.__cameraKeys=keys;window.__renderAt=renderAt;window.__getDuration=()=>data.duration;
  // Export may reuse these truly still intervals; exclude the shutter edges.
  window.__constantIntervals=(scene.alignedHoldSeconds>0?arrivals.map(a=>({start:a+.012,end:a+scene.alignedHoldSeconds-.012})):[]);
  window.__motionSnapshot=(time=t)=>motion?motion.snapshot(time):null;
  window.__sceneSnapshot=()=>({families:families.slice(0,visibleCount).map((f,i)=>({id:data.portraits[i].id,center:f.center,yaw:f.yaw})),objects:objects.map(o=>({id:o.id,center:o.center,depth:o.depth}))});
  window.__setDebug=v=>{debug=!!v;renderAt(t);};
  window.__setLayerVisibility=roles=>{roleFilter=roles==null?null:new Set(Array.isArray(roles)?roles:[roles]);renderAt(t);};
  function pause(){playing=false;audio.pause();$("play").textContent="▶ 播放";}
  function play(){if(t>=data.duration-.05)t=0;explore=null;playing=true;lastWall=performance.now();audio.currentTime=t;audio.muted=muted;audio.play().catch(()=>{});$("play").textContent="Ⅱ 暂停";}
  function tick(now){if(playing){t=Math.min(data.duration,t+(now-lastWall)/1000);if(t>=data.duration)pause();renderAt(t);}lastWall=now;requestAnimationFrame(tick);}
  $("play").onclick=()=>playing?pause():play();
  $("sound").onclick=()=>{muted=!muted;audio.muted=muted;$("sound").textContent=muted?"♪ 声音关":"♪ 声音开";};
  $("seek").max=data.duration;$("seek").oninput=e=>{pause();explore=null;renderAt(Number(e.target.value));};
  let pointer=null;
  art.addEventListener("pointerdown",e=>{pause();const base=explore||cameraAt(t);explore={eye:base.eye.slice(),target:base.target.slice(),roll:0,...(base.up?{up:base.up.slice()}: {})};pointer={x:e.clientX,y:e.clientY};art.setPointerCapture(e.pointerId);});
  art.addEventListener("pointermove",e=>{if(!pointer)return;const dx=(e.clientX-pointer.x)*W/art.getBoundingClientRect().width,dy=(e.clientY-pointer.y)*H/art.getBoundingClientRect().height;
    const offset=sub(explore.eye,explore.target),rad=Math.hypot(offset[0],offset[2]),ang=Math.atan2(offset[0],offset[2])-dx*.0022;
    if(motion){const b=basis(explore),v=add(offset,add(scale(b.right,-dx*.007),scale(b.up,dy*.007)));explore.eye=add(explore.target,scale(norm(v),Math.hypot(...offset)));}
    else explore.eye=[explore.target[0]+Math.sin(ang)*rad,explore.eye[1]+dy*.007,explore.target[2]+Math.cos(ang)*rad];
    pointer={x:e.clientX,y:e.clientY};renderAt(t);});
  art.addEventListener("pointerup",()=>pointer=null);art.addEventListener("pointercancel",()=>pointer=null);
  art.addEventListener("dblclick",()=>{explore=null;renderAt(t);});
  art.addEventListener("wheel",e=>{if(!explore)return;e.preventDefault();const v=sub(explore.eye,explore.target),factor=Math.max(.7,Math.min(1.35,1+e.deltaY*.001));explore.eye=add(explore.target,scale(v,factor));renderAt(t);},{passive:false});
  async function init(){
    try{
      setup();makePaper();
      const needed=visibleCount;
      for(let i=0;i<needed;i++){
        const layers=data.portraits[i].layers;
        for(const layer of layers){const im=await load(layer.image);objects.push(...makePlane(i,layer,im));}
      }
      for(let i=0;!motion&&i<needed-1;i++){
        const a=families[i],b=families[i+1],mid=mixV(a.center,b.center,.5),angle=Math.atan2(Math.sin(a.yaw)+Math.sin(b.yaw),Math.cos(a.yaw)+Math.cos(b.yaw));
        const tangent=[Math.cos(angle),0,-Math.sin(angle)];
        const imageA=await load(data.portraits[i].bridge),imageB=await load(data.portraits[i+1].bridge);
        objects.push(makePlacedPlane(`bridge:${i}:warm`,i,"bridge",0,add(mid,scale(tangent,-.32)),angle+.65,5.35,imageA));
        objects.push(makePlacedPlane(`bridge:${i}:cool`,i+1,"bridge",0,add(mid,scale(tangent,.32)),angle-.65,5.35,imageB));
      }
      if(scene.thread&&!motion)objects.push(...makeThread());
      window.__statistics={renderer:motion?.dynamic?"WebGL2 kinetic semantic surfaces, transformed tile depth sorting":"WebGL2 fixed curved semantic surfaces, tile depth sorting",motionVariant:motion?.kind||'original',animatedSurfaces:motion?.dynamic||false,portraits:needed,semanticLayers:needed*6,renderPatches:objects.length,simultaneousObjects:objects.length,version:data.version};
      $("status").textContent=`${needed} 组彩色手绘已就绪。拖动探索，双击返回影片。`;
      window.__ready=true;renderAt(.05);requestAnimationFrame(tick);
    }catch(e){window.__error=String(e.stack||e);$("status").textContent=window.__error;}
  }
  init();
})();
