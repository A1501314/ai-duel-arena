/* Environmental motion is sampled from the match clock, including on replay. */
(() => {
  'use strict';
  const W=1200,H=600,TAU=Math.PI*2;
  const list=Object.freeze([
    {id:'rooftop',name:'雨夜天台',accent:'#8ac9ec'},
    {id:'astral',name:'星空对决',accent:'#b8b7ff'},
    {id:'bloom',name:'樱谷晨风',accent:'#f6a599'},
    {id:'caldera',name:'熔火铸庭',accent:'#ffa467'}
  ].map(Object.freeze));
  const scenes=new Map(),jobs=new Map(),sprites=new Map();
  const valid=id=>list.some(item=>item.id===id);
  const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
  const mod=(x,m)=>((x%m)+m)%m;
  function random(seed){
    const n=Math.sin(seed*127.1+311.7)*43758.5453;
    return n-Math.floor(n);
  }
  const particles=Array.from({length:154},(_,i)=>Array.from({length:7},(_,n)=>random(i*17+n*3.3)));
  function surface(w,h){
    const c=document.createElement('canvas');
    c.width=w;c.height=h;return c;
  }
  function glowSprite(rgb){
    if(sprites.has(rgb))return sprites.get(rgb);
    const tile=surface(96,96),ctx=tile.getContext('2d');
    const g=ctx.createRadialGradient(48,48,0,48,48,47);
    for(const [p,a] of [[0,.82],[.16,.58],[.42,.23],[.72,.065],[1,0]])g.addColorStop(p,'rgba('+rgb+','+a+')');
    ctx.fillStyle=g;ctx.fillRect(0,0,96,96);sprites.set(rgb,tile);
    return tile;
  }
  function glow(c,color,x,y,rx,ry,a){
    c.globalAlpha=a;c.drawImage(glowSprite(color),x-rx,y-ry,rx*2,ry*2);
  }
  // Movable planes keep the brushwork of the original matte. Feathering blends
  // their silhouettes against stationary architecture and the platform.
  function plane(img,box,polygon,feather){
    const [x,y,w,h]=box,density=Math.min(img.naturalWidth/W,img.naturalHeight/H);
    const tile=surface(Math.ceil(w*density),Math.ceil(h*density)),c=tile.getContext('2d');
    c.setTransform(tile.width/w,0,0,tile.height/h,0,0);
    c.drawImage(img,x*img.naturalWidth/W,y*img.naturalHeight/H,w*img.naturalWidth/W,h*img.naturalHeight/H,0,0,w,h);
    const mask=surface(tile.width,tile.height),m=mask.getContext('2d');
    m.scale(tile.width/w,tile.height/h);
    m.filter='blur('+feather*density+'px)';m.fillStyle='#fff';m.beginPath();
    polygon.forEach(([px,py],i)=>i?m.lineTo(px-x,py-y):m.moveTo(px-x,py-y));
    m.closePath();m.fill();c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='destination-in';c.drawImage(mask,0,0);
    return {tile,x,y,w,h};
  }
  function drift(c,p,dx,dy,a=1){
    c.globalAlpha=a;c.drawImage(p.tile,p.x+dx,p.y+dy,p.w,p.h);
  }
  async function lavaFrames(im,x,y,w,h){
    const sheet=surface(w,h),ctx=sheet.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(im,-x,-y,W,H);
    const src=ctx.getImageData(0,0,w,h).data,frames=[];
    const N=32,visible=[];
    for(let j=0;j<h;j++)for(let i=0;i<w;i++){
      const a=(j*w+i)*4,r=src[a],g=src[a+1],b=src[a+2];
      const hot=clamp((r-150)/80)*clamp((r-b-39)/80)*clamp((g-26)/60);
      const fade=clamp(j/8)*clamp((h-j)/10)*clamp(i/3)*clamp((w-i)/3);
      const alpha=Math.round(255*hot*fade);
      if(alpha)visible.push({a,i,j,alpha});
    }
    const shift=Array.from({length:w},(_,i)=>.06*Math.sin(i*.77));
    let lastYield=performance.now();
    for(let k=0;k<N;k++){
      const out=surface(w,h),c=out.getContext('2d'),frame=c.createImageData(w,h);
      const d=frame.data,t=k/N,theta=t*TAU;
      const columns=shift.map(offset=>{
        const phase=mod(t+offset,1);
        return {phase,other:(phase+.5)%1,w1:Math.sin(phase*Math.PI)**2};
      });
      for(const {a,i,j,alpha} of visible){
        const r=src[a],g=src[a+1],b=src[a+2],{phase,other,w1}=columns[i];
        const A=4*(Math.round(clamp(j-(phase-.5)*54,0,h-1))*w+i);
        const B=4*(Math.round(clamp(j-(other-.5)*54,0,h-1))*w+i);
        const streak=.56*Math.sin(i*1.17+j*.161-theta*2)+.44*Math.sin(i*.43+j*.0805-theta);
        d[a]=r*.55+(src[A]*w1+src[B]*(1-w1))*.45+streak*9;
        d[a+1]=g*.33+(src[A+1]*w1+src[B+1]*(1-w1))*.67+streak*33;
        d[a+2]=b*.32+(src[A+2]*w1+src[B+2]*(1-w1))*.68+streak*24;
        d[a+3]=alpha;
      }
      c.putImageData(frame,0,0);frames.push(out);
      if(k+1<N&&performance.now()-lastYield>=6){
        await new Promise(resolve=>setTimeout(resolve,0));
        lastYield=performance.now();
      }
    }
    return {frames,x,y};
  }
  async function prepare(id,img){
    const env={img};
    if(id==='astral'){
      env.belt=plane(img,[140,0,921,301],[[235,-40],[1010,-40],[1030,50],[730,185],[478,250],[154,291],[177,220],[418,121]],13);
      env.clouds=plane(img,[82,313,920,126],[[139,352],[487,371],[782,320],[952,327],[968,412],[574,426],[242,419],[111,394]],11);
    }else if(id==='bloom'){
      env.canopyL=plane(img,[0,0,576,206],[[-24,-20],[580,-20],[508,49],[447,117],[330,165],[213,110],[69,135],[-20,191]],9);
      env.canopyR=plane(img,[689,0,511,189],[[677,-23],[1221,-20],[1222,131],[1120,119],[1021,114],[868,147],[726,81]],9);
      env.mist=plane(img,[112,263,865,163],[[153,333],[400,283],[572,324],[780,288],[941,276],[957,348],[810,377],[600,396],[271,409],[122,383]],12);
    }else if(id==='caldera'){
      env.lava=[await lavaFrames(img,125,215,26,172),await lavaFrames(img,990,67,49,363)];
      env.vapor=plane(img,[186,180,711,210],[[235,242],[475,208],[620,256],[846,193],[866,303],[658,369],[379,378],[209,335]],15);
    }
    return env;
  }
  function preload(urls={}){
    return Promise.all(list.filter(x=>x.id!=='rooftop'&&urls[x.id]).map(({id})=>{
      const src=urls[id],job=jobs.get(id);
      if(job?.src===src)return job.promise;
      const img=typeof src==='string'?new Image():src;
      if(typeof src==='string')img.src=src;
      const promise=img.decode().then(async()=>{
        if(jobs.get(id)?.promise!==promise)return;
        const env=await prepare(id,img);
        if(jobs.get(id)?.promise===promise)scenes.set(id,env);
      }).catch(err=>{if(jobs.get(id)?.promise===promise)jobs.delete(id);throw err});
      jobs.set(id,{src,promise});return promise;
    }));
  }

  function rain(c,t){
    c.lineCap='round';
    for(let depth=0;depth<3;depth++){
      const count=[68,51,27][depth],height=H+32;
      c.beginPath();c.lineWidth=[.65,.86,1.02][depth];
      c.strokeStyle=['rgba(157,203,242,.19)','rgba(179,205,237,.28)','rgba(213,233,253,.37)'][depth];
      for(let i=0;i<count;i++){
        const [a,b,v,l,w]=particles[i+depth*28],speed=(223+depth*155)*(1+v*.57);
        const travel=t*speed+b*height,y=mod(travel,height)-15;
        const x=mod(a*(W+40)-y*(.12+w*.12)+Math.floor(travel/height)*119,W+40)-20;
        const len=4+depth*4+l*6;c.moveTo(x,y);c.lineTo(x-len*(.12+w*.12),y+len);
      }
      c.stroke();
    }
    c.lineWidth=.72;
    for(let i=0;i<33;i++){
      const [a,b,v,w,n]=particles[i+11],phase=mod(t*(.91+v*.72)+a,1);
      const x=12+b*(W-24),y=475+Math.pow(w,.85)*106;
      const r=(1+phase*(4.2+9*n))*(.37+(y-475)/125);
      c.globalAlpha=Math.sin(Math.PI*phase)*(.22+n*.28);c.strokeStyle=i%3?'#9cb5d4':'#e79cab';
      c.beginPath();c.ellipse(x,y,r,r*.23,0,Math.PI*.12,Math.PI*1.85);c.stroke();
    }
    c.globalAlpha=1;
  }
  function train(c,t){
    const p=mod(t+2,13.4)/5.8;if(p>1)return;
    const x=65+p*1030,y=343;
    c.save();c.beginPath();c.rect(148,y-13,795,14);c.clip();
    c.globalAlpha=.62*Math.min(1,p*8,(1-p)*8);
    c.fillStyle='#24323d';c.beginPath();c.moveTo(x-145,y-8);c.lineTo(x-4,y-8);c.lineTo(x+8,y-4);c.lineTo(x+12,y-1);c.lineTo(x-145,y-1);c.fill();
    c.fillStyle='#678197';c.fillRect(x-145,y-7,139,.9);
    for(let j=0;j<18;j++){
      c.fillStyle=j%5===4?'#597282':j%3?'#9ca59c':'#d6c196';c.fillRect(x-140+j*7.5,y-5.7,3.7,2.3);
    }
    c.fillStyle='#ffe2b1';c.fillRect(x+6,y-3,4,1.3);c.restore();
  }
  function rooftop(c,t){
    train(c,t);
    c.globalCompositeOperation='screen';
    const pulse=.5+.5*Math.sin(t*.85+.8*Math.sin(t*1.4));
    glow(c,'255,74,81',899,180,36,45,.12+.14*pulse);
    glow(c,'114,233,250',329,176,16,43,.14+.12*(1-pulse));
    glow(c,'246,88,106',950,531,75,9,.05+.13*pulse);
    glow(c,'91,197,226',328,498,38,5,.04+.09*(1-pulse));
    c.globalCompositeOperation='source-over';c.globalAlpha=1;rain(c,t);
  }
  function meteor(c,t){
    const k=Math.floor((t+2.55)/7.15),p=mod(t+2.55,7.15)/.82;
    if(p>=1)return;
    const start=165+random(k+122)*755,y0=17+random(k+19)*94;
    const x=start+p*205,y=y0+p*(55+random(k+63)*28),length=54+Math.sin(p*Math.PI)*55;
    const x0=x-length,y1=y-length*.36,g=c.createLinearGradient(x0,y1,x,y);
    g.addColorStop(0,'rgba(155,183,255,0)');g.addColorStop(.72,'rgba(157,201,255,.40)');g.addColorStop(1,'#f0f6ff');
    c.globalAlpha=Math.sin(p*Math.PI)*.87;c.strokeStyle=g;c.lineWidth=1.4;
    c.beginPath();c.moveTo(x0,y1);c.lineTo(x,y);c.stroke();glow(c,'199,222,255',x,y,3.8,2.8,c.globalAlpha*.92);
  }
  function astral(c,t,env){
    const dx=19*Math.sin(t*.077),dy=4*Math.sin(t*.089);
    drift(c,env.belt,dx,dy);drift(c,env.clouds,-28*Math.sin(t*.108),2*Math.sin(t*.207),.95);
    c.globalCompositeOperation='screen';
    for(let i=0;i<107;i++){
      const [a,b,v,d,k]=particles[i];
      const x=mod(a*(W+16)+dx*(.5+k*.5),W+16)-8,y=5+b*252+dy*.5;
      if((x<225&&y<142-x*.32)||(x>1048&&y>139))continue;
      const bright=.5+.5*Math.cos(t*(.8+v*1.2)+d*TAU),r=(.48+k*.95)*(.62+.38*bright);
      c.globalAlpha=.16+.70*bright;c.fillStyle=k>.84?'#f2d3ba':k>.4?'#c6dbff':'#9cabef';
      c.fillRect(x-r*.5,y-r*.5,r,r);
      if(k>.925&&bright>.71){
        c.fillRect(x-r*2.1,y-.35,r*4.2,.7);c.fillRect(x-.35,y-r*1.8,.7,r*3.6);
      }
    }
    meteor(c,t);
  }
  function petalSprite(index){
    const key='petal'+index;
    if(sprites.has(key))return sprites.get(key);
    const tile=surface(28,18),c=tile.getContext('2d');
    const palette=[['#ffe1d1','#e48389'],['#ffc8bb','#c26179'],['#ffd6bf','#c97b85']][index];
    const g=c.createLinearGradient(2,3,24,17);g.addColorStop(0,palette[0]);g.addColorStop(1,palette[1]);
    c.fillStyle=g;c.beginPath();c.moveTo(2,13);c.bezierCurveTo(5,7,11,1,20,2);c.quadraticCurveTo(22,3,20,5);c.quadraticCurveTo(26,3,26,7);c.bezierCurveTo(24,13,13,15,2,13);c.fill();
    c.strokeStyle='rgba(192,101,117,.6)';c.lineWidth=.7;c.beginPath();c.moveTo(4,12);c.quadraticCurveTo(12,11,19,6);c.stroke();
    sprites.set(key,tile);return tile;
  }
  function bloom(c,t,env){
    drift(c,env.mist,17*Math.sin(t*.175),2*Math.cos(t*.21),.93);
    const gust=Math.sin(t*1.05)+.48*Math.sin(t*.47+.5),breeze=Math.sin(t*.48);
    drift(c,env.canopyL,gust*1.6,Math.sin(t*1.05+.4)*1.4);
    drift(c,env.canopyR,gust*2.0,Math.sin(t*1.05+1.2)*1.6);
    for(let i=0;i<47;i++){
      const [a,b,v,d,k,h]=particles[i],near=i>=33,fall=(near?34:20)+v*24;
      const dist=t*fall+b*631,y=mod(dist,631)-22;
      const wind=t*(near?29:15)+t*v*12+12*Math.sin(t*(.67+v*.6)+a*TAU)+14*breeze;
      const x=mod(a*1320+wind+Math.floor(dist/631)*131,1320)-60;
      const settle=clamp((y-475)/83),r=(near?4.9:2.4)*(1+k*.52);
      c.save();c.translate(x,y);c.rotate(t*(near?.97:.6)+d*TAU+Math.sin(t*1.43+h*5)*.67);
      const fold=.28+.72*Math.abs(Math.sin(t*(1.2+v)+a*TAU));
      c.scale(1,fold);c.globalAlpha=(near?.83:.66)*(1-settle*.9);
      c.drawImage(petalSprite(i%3),-r,-r*.55,r*2,r*1.1);c.restore();
    }
  }
  function caldera(c,t,env){
    drift(c,env.vapor,12*Math.sin(t*.28),-5*Math.sin(t*.5),.95);
    for(let j=0;j<env.lava.length;j++){
      const flow=env.lava[j],k=Math.floor(t*24+j*6)%flow.frames.length;
      c.globalAlpha=1;c.drawImage(flow.frames[k],flow.x,flow.y);
    }
    c.globalCompositeOperation='screen';
    const pulse=.52+.25*Math.sin(t*2.1)+.18*Math.sin(t*4.3);
    glow(c,'255,117,38',1014,429,75,16,.15+.17*pulse);
    glow(c,'253,107,40',138,424,42,12,.13+.11*(1-pulse));
    glow(c,'242,113,47',1015,534,59,4,.04+.10*pulse);
    for(let i=0;i<56;i++){
      const [a,b,v,w,k,n]=particles[i],right=i%2===0,period=2.5+4.5*w,phase=mod(t/period+a,1);
      const ground=right?1014:137,spread=right?79:50;
      const x=ground+(b-.5)*spread*2+(right?-1:1)*phase*(21+48*n)+Math.sin(phase*6.1+k*8)*phase*18;
      const y=(right?428:419)-phase*(50+v*265);
      const alpha=Math.sin(phase*Math.PI)*(.41+.55*k),r=.65+v*1.65;
      c.globalAlpha=alpha;c.strokeStyle=i%4?'#ff9e50':'#ffe6ad';c.lineWidth=r*.75;
      c.beginPath();c.moveTo(x,y+r*1.8);c.lineTo(x+r*.4,y);c.stroke();
      if(v>.78)glow(c,'255,113,43',x,y,r*2.3,r*2.3,alpha*.55);
    }
  }
  function draw(c,id,t,reduced){
    if(reduced)return;
    const env=scenes.get(id);
    c.save();
    if(id==='astral'&&env)astral(c,t,env);
    else if(id==='bloom'&&env)bloom(c,t,env);
    else if(id==='caldera'&&env)caldera(c,t,env);
    else rooftop(c,t);
    c.restore();
  }
  window.ArenaStages=Object.freeze({list,valid,preload,image:id=>scenes.get(id)?.img||null,draw});
})();
