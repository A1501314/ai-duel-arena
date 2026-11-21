/* Each skin is animated entirely from its own registered, transparent figure paintings. */
(() => {
  'use strict';
  const FW=176, FH=120;
  const sets=new Map(), matchSets=new Set(), turnCache=new Map();
  let turnPixels=0;
  function keepMatch(ids,skins){
    matchSets.clear();
    ids.forEach((id,side)=>{if(skins[side])matchSets.add(id+'-'+skins[side]);});
  }
  const core=['ready','guard','run','jab','kick','cast'];
  const clamp=(a,l,h)=>Math.max(l,Math.min(h,a));
  const mix=(a,b,t)=>a+(b-a)*t;
  const smooth=t=>t*t*(3-2*t);
  const phase=(move,i,count)=>clamp(i/(count-(move==='walk'||move==='guard'||move==='idle'?0:1)||1),0,1);
  const timelines={
    idle:[[0,'ready'],[1,'ready']],
    walk:[[0,'walk'],[1,'walk']],
    dash:[[0,'run'],[1,'run']],
    dashBack:[[0,'ready'],[.42,'guard'],[.72,'guard'],[1,'ready']],
    jump:[[0,'guard'],[.37,'ready'],[.75,'air'],[1,'air']],
    doubleJump:[[0,'ready'],[.40,'air'],[1,'fall']],
    fall:[[0,'fall'],[.67,'fall'],[1,'ready']],
    guard:[[0,'guard'],[1,'guard']],
    jab:[[0,'ready'],[.14,'guard'],[.34,'jab'],[.49,'jab'],[.83,'ready'],[1,'ready']],
    cross:[[0,'ready'],[.19,'jab'],[.43,'cross'],[.56,'cross'],[.91,'ready'],[1,'ready']],
    kick0:[[0,'ready'],[.21,'guard'],[.48,'kick'],[.59,'kick'],[.80,'guard'],[1,'ready']],
    kick1:[[0,'ready'],[.28,'guard'],[.54,'sweep'],[.72,'sweep'],[.94,'ready'],[1,'ready']],
    skill1:[[0,'ready'],[.18,'guard'],[.43,'cast'],[.70,'cast'],[1,'ready']],
    skill2:[[0,'ready'],[.27,'guard'],[.54,'cast'],[.76,'cast'],[1,'ready']],
    ult:[[0,'ready'],[.25,'cast'],[.52,'ult'],[.79,'ult'],[1,'ready']],
    hurt:[[0,'ready'],[.29,'hurt'],[.54,'hurt'],[1,'ready']],
    ko:[[0,'ready'],[.20,'hurt'],[.82,'ko'],[1,'ko']],
    victory:[[0,'ready'],[.36,'cast'],[.70,'victory'],[1,'victory']]
  };
  const substitutes={cross:'jab',air:'run',fall:'run',hurt:'guard',ult:'cast',victory:'cast',walk:'run',sweep:'kick',ko:'hurt'};
  function poseAt(bank,id,move,p){
    const sequence=timelines[move]||timelines.idle;
    let i=0;while(i<sequence.length-2&&sequence[i+1][0]<p)i++;
    const [[t0,key0],[t1,key1]]=sequence.slice(i,i+2);
    function variant(key){
      if(move==='skill1'&&id==='grok'&&key==='cast')return 'jab';
      if(move==='skill2'&&id==='grok'&&key==='cast')return 'cast';
      while(!bank.poses[key])key=substitutes[key];
      return key;
    }
    return [variant(key0),variant(key1),smooth(clamp((p-t0)/(t1-t0),0,1))];
  }
  function acting(move,p){
    const s=Math.sin(2*Math.PI*p), pulse=Math.sin(Math.PI*p);
    let bend=0,hem=0,hand=0,nod=0,angle=0,sx=1,sy=1,dx=0,dy=0,stride=0;
    switch(move){
      case 'idle':bend=.76*s;hem=2.1*s;hand=-1.3*s;nod=-1.4*s;break;
      case 'guard':bend=.72*s;hand=1.7*s;hem=1.25*s;nod=-.9*s;break;
      case 'walk':stride=s;bend=2.3*s;hem=3.4*s;hand=-3.3*s;nod=-1.8*s*s;sy=1-.018*s*s;break;
      case 'dash':stride=.75*s;angle=-.035+.12*pulse;bend=3*pulse;hem=-5*pulse;dx=5*pulse;dy=-4*pulse;break;
      case 'dashBack':angle=-.12*pulse;dx=-4*pulse;hem=4*pulse;break;
      case 'jump':case 'doubleJump':angle=(move==='jump'?.055:.11)*s;hem=-4*pulse;hand=2*s;dy=-4*pulse;break;
      case 'fall':angle=-.048*s;hem=3.5*pulse;hand=-2*s;break;
      case 'jab':angle=.035*pulse;hand=2*s;dx=3*pulse;break;
      case 'cross':angle=.100*pulse;dx=6*pulse;sy=1-.035*pulse;hand=-2*s;break;
      case 'kick0':angle=-.036*pulse;hem=-2.7*s;break;
      case 'kick1':angle=.085*pulse;sy=1-.14*pulse;hem=4.2*s;dx=4*pulse;break;
      case 'skill1':angle=.048*pulse;hem=3.5*s;hand=1.8*s;break;
      case 'skill2':angle=-.063*pulse;hem=-4.3*s;nod=-1.9*s;break;
      case 'ult':sx=1+.019*pulse;hem=5.2*s;hand=-2.2*s;nod=-2*pulse;break;
      case 'hurt':angle=-.15*pulse;dx=-6*pulse;hem=4*s;break;
      case 'ko':{
        const down=smooth(clamp((p-.06)/.80,0,1));angle=-1.34*down;
        dx=-12*down;sy=1-.11*down;hem=4*pulse;dy=2*down;break;
      }
      case 'victory':angle=-.045*pulse;hem=3.4*s;hand=-2.1*pulse;nod=-2*pulse;break;
    }
    return {bend,hem,hand,nod,angle,sx,sy,dx,dy,stride};
  }
  function locally(point,act){
    const [x,y]=point;
    const rise=clamp(-y/180,0,1),foot=clamp(-y/15,0,1);
    const legs=clamp(1+y/76,0,1)**2;
    return [x+(clamp(x/40,-1,1)*6+2)*legs*act.stride+act.bend*rise+act.hem*Math.sin(Math.PI*rise)*(.35+.65*clamp(Math.abs(x)/53,0,1))*foot,
      y+act.nod*rise*rise+act.hand*Math.exp(-((y+108)**2)/440)*clamp((Math.abs(x)-6)/43,0,1)];
  }
  function toWorld(point,act){
    const [x,y]=locally(point,act),ca=Math.cos(act.angle),sa=Math.sin(act.angle);
    return [act.dx+ca*x*act.sx-sa*y*act.sy,act.dy+sa*x*act.sx+ca*y*act.sy];
  }
  const sourcePoint=(box,uv)=>[box[0]+box[2]*uv[0],box[1]+box[3]*uv[1]];
  function middleTravel(from,to){
    if(!from.center||!to.center||from===to)return [0,0];
    const part=clamp(from.center[1]/Math.min(-35,from.face[1]),0,1),wave=Math.max(.3,Math.sin(Math.PI*part));
    return [0,1].map(axis=>clamp((to.center[axis]-from.center[axis]-(to.face[axis]-from.face[axis])*part)/wave,axis?-12:-30,axis?12:30));
  }
  function resolve(id,skin,move,index,count,fraction){
    const name=id+'-'+skin,bank=MEDIA.bodyMotion?.[name];if(!bank)return null;
    const p=fraction??phase(move,index,count),[a,b,t]=poseAt(bank,id,move,p),act=acting(move,p);
    if(move==='ko'&&bank.poses.ko){act.angle*=.07;act.dx*=.22;act.dy=0;}
    if(move==='kick1'&&bank.poses.sweep){act.sy=mix(1,act.sy,.30);act.angle*=.40;}
    const A=bank.poses[a],B=bank.poses[b];
    if(move==='ko'&&p>.12){
      const pose=t>=.5?B:A;
      if(pose.hull){
        let lowest=-Infinity;
        for(let i=0;i<pose.hull.length;i+=2)lowest=Math.max(lowest,toWorld([pose.hull[i]*.5,pose.hull[i+1]*.5],act)[1]);
        act.dy-=Math.max(0,lowest)*smooth(clamp((p-.12)/.22,0,1));
      }
    }
    const coordinates=MEDIA.bodySockets?.[name];
    let pa=null,pb=null;
    if(coordinates?.[a]&&coordinates?.[b]){
      pa=sourcePoint(A.box,coordinates[a]);pb=sourcePoint(B.box,coordinates[b]);
    }
    return {name,bank,a,b,t,act,A,B,pa,pb,middleA:middleTravel(A,B),middleB:middleTravel(B,A)};
  }
  function socket(id,skin,move,index,count){
    const q=resolve(id,skin,move,index,count);if(!q?.pa)return null;
    const swap=q.t>=.5,src=swap?q.pb:q.pa,dst=swap?q.pa:q.pb;
    const from=swap?q.B.face:q.A.face,to=swap?q.A.face:q.B.face,amount=swap?1-q.t:q.t;
    const weight=clamp(-src[1]/Math.max(35,-from[1]),0,1);
    const mid=swap?q.middleB:q.middleA,wave=Math.sin(Math.PI*weight);
    const dx=(to[0]-from[0])*weight+mid[0]*wave,dy=(to[1]-from[1])*weight+mid[1]*wave;
    return toWorld([src[0]+amount*(dx+clamp(dst[0]-src[0]-dx,-8,8)),src[1]+amount*(dy+clamp(dst[1]-src[1]-dy,-8,8))],q.act);
  }
  function resolvedAnchor(q){
    if(!q)return null;
    const [x,y]=toWorld(q.A.face.map((v,i)=>mix(v,q.B.face[i],q.t)),q.act);
    return {nx:x,ny:y+16,len:40};
  }
  function anchor(id,skin,move,index,count,fraction){return resolvedAnchor(resolve(id,skin,move,index,count,fraction));}
  async function load(name){
    const im=new Image();im.src=MEDIA.bodyArt(name);await im.decode();return im;
  }
  function prepare(id,skin){
    const name=id+'-'+skin;
    if(sets.has(name)){
      const hit=sets.get(name);sets.delete(name);sets.set(name,hit);return hit.ready;
    }
    const bank=MEDIA.bodyMotion?.[name];
    if(!bank)return Promise.reject(new Error('缺少完整衣装动作：'+name));
    const entry={pictures:{},cpuPixels:{},motion:null,lastMove:null};
    const labels=Object.keys(bank.poses);
    if(!core.every(k=>labels.includes(k)))return Promise.reject(new Error('衣装动作图不完整：'+name));
    entry.ready=Promise.all([...labels,'motion'].map(async k=>{entry.pictures[k]=await load(name+'-'+k);}))
      .then(()=>{
        entry.motion=entry.pictures.motion;
        for(const [old,value] of sets){
          if(sets.size<=4)break;
          if(old!==name&&!matchSets.has(old)&&value.motion){
            sets.delete(old);
          }
        }
        const openers=['ready/guard','guard/jab','ready/jab'];
        return Promise.all(openers.map(key=>sheet(name,key)?.ready)).then(()=>entry);
      }).catch(error=>{sets.delete(name);throw error;});
    sets.set(name,entry);
    return entry.ready;
  }
  function texturePixels(image){
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);
    return {p:c.getImageData(0,0,canvas.width,canvas.height).data,w:canvas.width,h:canvas.height};
  }
  function pair(q){
    if(q.a===q.b)return -1;
    const direct=q.bank.pairs.indexOf(q.a+'/'+q.b);
    if(direct!==-1)return direct*2;
    const reverse=q.bank.pairs.indexOf(q.b+'/'+q.a);
    if(reverse!==-1)return reverse*2+1;
    throw new Error('缺少完整动作过渡：'+q.name+'/'+q.a+'/'+q.b);
  }
  function sheet(name,key){
    const layout=MEDIA.bodyTurns?.[name]?.[key];
    if(!layout)return null;
    const tag=name+'/'+key;
    let entry=turnCache.get(tag);
    if(entry){
      turnCache.delete(tag);turnCache.set(tag,entry);
      return entry;
    }
    entry={image:null,ready:null};
    turnCache.set(tag,entry);
    const image=new Image();
    image.src=MEDIA.bodyTurnRoot+'turn-'+name+'-'+key.replace('/','-')+'.webp';
    entry.ready=image.decode().then(()=>{
      if(turnCache.get(tag)!==entry)return;
      if(image.width!==2*(layout[4]+2)||image.height!==2*(layout[5]+2))throw Error('动作图集尺寸有误：'+tag);
      entry.image=image;turnPixels+=image.width*image.height;
      const budget=(MEDIA.phone?10:24)*1024*1024;
      for(const [old,item] of turnCache){
        if(turnPixels<=budget)break;
        if(old===tag||!item.image)continue;
        turnPixels-=item.image.width*item.image.height;turnCache.delete(old);
      }
    }).catch(error=>{
      console.warn('衣装衔接采用原画绘制',tag,error);
      // A loose single-file copy still carries the registered original paintings.
      if(location.protocol!=='file:')setTimeout(()=>{if(turnCache.get(tag)===entry)turnCache.delete(tag);},5000);
    });
    return entry;
  }
  function transition(ctx,q){
    if(q.a===q.b)return false;
    const bank=MEDIA.bodyTurns?.[q.name];if(!bank)return false;
    const direct=q.a+'/'+q.b,forward=Object.hasOwn(bank,direct);
    const key=forward?direct:q.b+'/'+q.a,layout=bank[key];
    if(!layout)return false;
    const phase=forward?q.t:1-q.t,frame=Math.round(phase*5);
    const page=sheet(q.name,key);
    if(!page?.image||frame===0||frame===5)return false;
    const [x,y,w,h,pw,ph]=layout,ix=frame-1,t=q.t;
    const sampled=forward?frame/5:1-frame/5;
    const act=q.act;
    ctx.save();
    ctx.translate(act.dx+(q.B.face[0]-q.A.face[0])*(t-sampled)*.55,
                  act.dy+(q.B.face[1]-q.A.face[1])*(t-sampled)*.55);
    ctx.rotate(act.angle);ctx.scale(act.sx,act.sy);
    ctx.drawImage(page.image,(ix%2)*(pw+2)+1,(ix>>1)*(ph+2)+1,pw,ph,x,y,w,h);
    ctx.restore();
    return true;
  }
  function replayTimes(id,skin,move,count){
    const bank=MEDIA.bodyMotion?.[id+'-'+skin];
    const sequence=timelines[move];
    if(!bank||!sequence)return null;
    const times=new Set(Array.from({length:count},(_,i)=>i/Math.max(1,count-1)));
    for(let i=1;i<sequence.length;i++){
      const from=sequence[i-1][0],to=sequence[i][0];
      const [a,b]=poseAt(bank,id,move,(from+to)*.5);
      if(a===b)continue;
      for(let step=0;step<=5;step++){
        const linear=.5-Math.sin(Math.asin(1-2*step/5)/3);
        times.add(from+(to-from)*linear);
      }
    }
    return [...new Set([...times].map(t=>Number(t.toFixed(6))))].sort((a,b)=>a-b);
  }
  async function readyAt(id,skin,move,fraction){
    const q=resolve(id,skin,move,0,1,fraction);
    if(q&&q.a!==q.b)await (sheet(q.name,q.a+'/'+q.b)||sheet(q.name,q.b+'/'+q.a))?.ready;
  }
  function nativeDraw(ctx,q,entry){
    // Native image sampling retains the linework on software GPUs and low-memory phones.
    // Adjacent horizontal strips form one continuous affine surface from the feet up.
    const swap=q.t>=.5,from=swap?q.B:q.A,to=swap?q.A:q.B,amount=q.a===q.b?0:(swap?1-q.t:q.t);
    const picture=entry.pictures[swap?q.b:q.a],box=from.box,act=q.act;
    const travelled=[to.face[0]-from.face[0],to.face[1]-from.face[1]],height=Math.max(35,-from.face[1]);
    const idx=amount>0?pair(q):-1,slot=swap?idx^1:idx;
    let field;
    if(idx>=0)field=entry.cpuPixels.motion||(entry.cpuPixels.motion=texturePixels(entry.motion));
    const grip=swap?q.pb:q.pa,other=swap?q.pa:q.pb;
    function at(y){
      const weight=clamp(-y/height,0,1),x=clamp(from.face[0]*weight,box[0],box[0]+box[2]);
      const mid=swap?q.middleB:q.middleA,wave=Math.sin(Math.PI*weight);
      let dx=travelled[0]*weight+mid[0]*wave,dy=travelled[1]*weight+mid[1]*wave;
      if(field){
        const ix=clamp(Math.floor((x+167)*.5),0,FW-1)+(slot%4)*FW;
        const iy=clamp(Math.floor((y+225)*.5),0,FH-1)+Math.floor(slot/4)*FH;
        const offset=(iy*field.w+ix)*4;
        let mx=(field.p[offset]-128)*176/127,my=(field.p[offset+1]-128)*176/127;
        const f=(y-from.face[1])/13,head=Math.exp(-f*f);
        mx=mix(mx,travelled[0],head);my=mix(my,travelled[1],head);
        if(grip){
          const g=(grip[1]-y)/12,n=Math.exp(-g*g);
          mx=mix(mx,other[0]-grip[0],n);my=mix(my,other[1]-grip[1],n);
        }
        dx+=clamp(mx-dx,-8,8);dy+=clamp(my-dy,-8,8);
      }
      const f=clamp(-y/180,0,1);
      const leg=clamp(1+y/76,0,1)**2;
      return [amount*dx+act.bend*f+act.hem*.74*Math.sin(Math.PI*f)*clamp(-y/15,0,1)+2*leg*act.stride,
        y+amount*dy+act.nod*f*f+.52*act.hand*Math.exp(-((y+108)**2)/440)];
    }
    ctx.save();ctx.translate(act.dx,act.dy);ctx.rotate(act.angle);ctx.scale(act.sx,act.sy);
    const bands=10;let top=box[1],first=at(top);
    for(let i=1;i<=bands;i++){
      const sy=Math.round(picture.height*(i-1)/bands),end=Math.round(picture.height*i/bands);
      const bottom=box[1]+box[3]*end/picture.height,last=at(bottom);
      const overlap=i<bands?.25:0,stretch=(last[1]-first[1])/(bottom-top);
      const stride=1+act.stride*.095*clamp(1+(top+bottom)/152,0,1)**2;
      ctx.save();ctx.translate(first[0],first[1]);ctx.transform(stride,0,(last[0]-first[0])/(bottom-top),stretch,0,0);
      ctx.drawImage(picture,0,sy,picture.width,end-sy+overlap,box[0],0,box[2],bottom-top+overlap*box[3]/picture.height);
      ctx.restore();top=bottom;first=last;
    }
    ctx.restore();
  }
  function draw(ctx,id,skin,move,index,count,fraction){
    const q=resolve(id,skin,move,index,count,fraction),entry=sets.get(id+'-'+skin);
    if(!q||!entry?.motion)return null;
    if(entry.lastMove!==move){
      entry.lastMove=move;
      const changes=timelines[move]||timelines.idle;
      for(let i=1;i<changes.length;i++){
        const [a,b]=poseAt(q.bank,id,move,(changes[i-1][0]+changes[i][0])*.5);
        if(a!==b&&(MEDIA.bodyTurns?.[q.name]))sheet(q.name,a+'/'+b)||sheet(q.name,b+'/'+a);
      }
    }
    if(!transition(ctx,q))nativeDraw(ctx,q,entry);
    return resolvedAnchor(q);
  }
  window.ArenaFullBody={prepare,draw,socket,anchor,keepMatch,replayTimes,readyAt};
})();
