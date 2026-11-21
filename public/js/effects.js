/* Skill footage is composited in world coordinates around the owning hitboxes. */
(() => {
  'use strict';
  const FLOOR=490;
  const clamp=(n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
  const lerp=(a,b,p)=>a+(b-a)*p;
  const ease=(a,b,t)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u)};
  const noise=n=>{const v=Math.sin(n*81.26+2.981)*7394.572;return v-Math.floor(v)};
  const colors={tide:'#66caff',sonar:'#86e4ff',leviathan:'#59cfff',loop:'#78ffd2',counter:'#b3ffdb',
    recursion:'#81ffbf',pages:'#ffb86d',ember:'#ff8b49',finale:'#ffad50',blink:'#85caff',twins:'#b29bff',
    eclipse:'#afadff',crescent:'#e1c2ff',syncopation:'#dbb4ff',nocturne:'#d8ccff',gravity:'#ffab84',uppercut:'#fcba79',horizon:'#ffa25b'};
  // Width, height, elevation, time from skill release to its main scene accent.
  const ultimates={leviathan:[825,514,160,.73],recursion:[716,444,181,.76],finale:[796,494,160,.66],
    eclipse:[774,466,228,.57],nocturne:[716,465,195,.61],horizon:[758,458,174,.89]};
  const shared=['impact','deflect','splash'];
  const footprint={tide:[217,138],sonar:[207,322],loop:[151,151],counter:[171,207],pages:[118,76],ember:[211,239],
    blink:[229,143],twins:[148,116],crescent:[233,153],syncopation:[158,90],gravity:[215,202],uppercut:[183,253]};
  const matter={tide:'water',sonar:'water',leviathan:'water',loop:'jade',counter:'jade',recursion:'jade',
    pages:'ember',ember:'ember',finale:'ember',blink:'plasma',twins:'plasma',eclipse:'plasma',
    crescent:'silver',syncopation:'silver',nocturne:'silver',gravity:'iron',uppercut:'iron',horizon:'iron'};
  const glowCache=new Map();
  function lamp(c,x,y,w,h,color,power){
    if(power<=.002||w<1||h<1)return;
    let im=glowCache.get(color);
    if(!im){
      im=document.createElement('canvas');im.width=im.height=96;const g=im.getContext('2d');
      const gradient=g.createRadialGradient(48,48,0,48,48,48);
      gradient.addColorStop(0,color);gradient.addColorStop(.10,color+'cd');gradient.addColorStop(.30,color+'65');
      gradient.addColorStop(.63,color+'1f');gradient.addColorStop(1,color+'00');
      g.fillStyle=gradient;g.fillRect(0,0,96,96);glowCache.set(color,im);
    }
    c.save();c.globalCompositeOperation='screen';c.globalAlpha*=clamp(power);c.drawImage(im,x-w/2,y-h/2,w,h);c.restore();
  }
  function ground(c,x,width,color,intensity){
    lamp(c,x,FLOOR+6,width*2.18,40,color,intensity*.69);
    lamp(c,x,FLOOR+3,width*1.50,6,'#eff5ff',intensity*.56);
  }
  const grainCache=new Map();
  function grain(kind){
    if(grainCache.has(kind))return grainCache.get(kind);
    const im=document.createElement('canvas');im.width=48;im.height=32;
    const g=im.getContext('2d');
    if(kind==='smoke'){
      for(let i=0;i<8;i++){
        const x=13+noise(i+1)*23,y=9+noise(i+23)*14,r=6+noise(i+16)*7;
        const p=g.createRadialGradient(x,y,0,x,y,r);
        p.addColorStop(0,'#6b494657');p.addColorStop(.52,'#63575c3c');p.addColorStop(1,'#4b485300');
        g.fillStyle=p;g.fillRect(x-r,y-r,r*2,r*2);
      }
    }else{
      const palette={water:['#abedff','#307ea7'],jade:['#bdffe1','#398b72'],ember:['#fff6ba','#ff7636'],
        plasma:['#e2f5ff','#8079fb'],silver:['#fbf5ff','#9983b7'],iron:['#ffe7c8','#c96835']}[kind];
      const radial=g.createRadialGradient(24,16,0,24,16,20);
      radial.addColorStop(0,palette[0]);radial.addColorStop(.16,palette[1]+'df');radial.addColorStop(.52,palette[1]+'42');radial.addColorStop(1,palette[1]+'00');
      g.fillStyle=radial;g.fillRect(0,0,48,32);
      g.save();g.translate(24,16);g.rotate(-.22);g.scale(kind==='water'?12:16,kind==='water'?7.5:4.8);
      const body=g.createRadialGradient(-.23,-.36,.03,0,0,1);
      body.addColorStop(0,'#ffffed');body.addColorStop(.16,palette[0]);body.addColorStop(.45,palette[1]+'d9');
      body.addColorStop(.73,palette[1]+'64');body.addColorStop(1,palette[1]+'00');
      g.fillStyle=body;g.fillRect(-1,-1,2,2);g.restore();
    }
    grainCache.set(kind,im);return im;
  }
  function spray(c,kind,x,y,w,h,dir,clock,power,large,reduced){
    if(reduced||power<.06)return;
    const type=matter[kind],sprite=grain(type),count=large?14:6;
    const speed={water:1.18,jade:.64,ember:.76,plasma:1.08,silver:.74,iron:.90}[type];
    c.save();c.globalCompositeOperation='screen';
    for(let i=0;i<count;i++){
      const a=noise(4+i*5),b=noise(11+i*7),q=(clock*speed+b)%1,angle=6.283*(a+.07*q);
      const fade=Math.sin(Math.PI*q)*power,spin=dir*(a>.5?1:-1);
      let xx,yy,turn,size=(large?7.8:5.9)*(1+.65*a),aspect=1.67;
      if(type==='water'){
        xx=(a-.46)*w*(.31+.69*q);yy=h*(.24-(.58+.32*b)*q+(.67+.22*b)*q*q);
        turn=Math.atan2(h*(-.58-.32*b+2*(.67+.22*b)*q),dir*w*(a-.46));aspect=1.35;
      }else if(type==='ember'){
        xx=w*((a-.49)*(.27+.54*q)+.09*q*q);yy=h*(.26-q*(.48+.38*b));turn=-1.04-.36*Math.sin(q*5+a);aspect=2.13;
      }else if(type==='jade'||type==='plasma'){
        const coil=angle+q*(type==='jade'?2.05:3.9)*spin;
        xx=(type==='plasma'?-.31*q:0)*w+Math.cos(coil)*w*(.16+.23*q);
        yy=Math.sin(coil)*h*(.24+.10*q);turn=Math.atan2(Math.cos(coil)*h,-dir*Math.sin(coil)*w);aspect=type==='plasma'?2.8:1.72;
      }else if(type==='silver'){
        xx=(a-.25)*w*(.27+.74*q);yy=h*(.14+.21*Math.sin(angle)-q*(.36+.30*b));turn=angle+q*2.8;aspect=2.45;
      }else{
        const spiral=angle+q*(2.38+b),r=1-.84*q;
        xx=Math.cos(spiral)*w*(.32+.12*b)*r;yy=Math.sin(spiral)*h*.42*r;turn=spiral+1.45;aspect=2.14;
      }
      c.save();c.translate(x+dir*xx,y+yy);c.rotate(turn);
      c.globalAlpha*=fade*.82;c.drawImage(sprite,-size*aspect*.5,-size*.5,size*aspect,size);c.restore();
    }
    c.restore();
    if(type==='ember'&&large){
      const smoke=grain('smoke');c.save();
      for(let i=0;i<5;i++){
        const q=(clock*.39+noise(i+61))%1,sz=(.11+.13*q)*w;
        c.save();c.globalAlpha*=Math.sin(q*Math.PI)*power*.57;
        c.drawImage(smoke,x+dir*w*((i-2)*.10+.065*q)-sz*.5,y+h*(.22-.61*q)-sz*.31,sz,sz*.62);c.restore();
      }c.restore();
    }
  }
  function inFrontOfHead(o,state){
    if(!footprint[o.variant])return false;
    let [w,h]=footprint[o.variant],y=o.y;
    if(o.kind==='column'&&o.age<o.warmup){w=o.w*1.48;h=38;y=FLOOR-14}
    if(o.kind==='trap'&&!o.triggered){w=o.w*1.70;h=66;y=FLOOR-18}
    return state.fighters.some(f=>Math.abs(o.x-f.x)<w*.52+21&&Math.abs(y-(f.y-162))<h*.51+23);
  }
  function contact(c,x,y,col,size,age,reduced,dir=1,directed=false){
    const fade=(1-age)**1.5;if(fade<.01)return;
    lamp(c,x,y,(directed?1.8:2.8)*size,(directed?1.3:1.8)*size,col,(reduced?.50:.82)*fade);
    lamp(c,x,y,size*.86,size*.54,'#fff2de',.95*fade);
    const total=reduced?4:10;
    for(let i=0;i<total;i++){
      const a=directed?noise(i+19)*2.04-1.25:i*2.39996+.2,energy=(.4+noise(i+5)*.7)*size*(directed?1.45:1);
      const dx=dir*Math.cos(a),dy=Math.sin(a);
      const xx=x+dx*energy*(.19+age*1.28),yy=y+dy*energy*(.11+age*1.22)+age*age*14;
      c.save();c.translate(xx,yy);c.rotate(Math.atan2(dy,dx));
      lamp(c,0,0,(4+energy*.66)*fade,1.3+3.1*fade,col,fade*.88);
      lamp(c,1,0,energy*.36*fade,2.1,'#fff7e7',fade);c.restore();
    }
  }
  function floorSpray(c,x,span,phase,power){
    const bead=grain('water');
    c.save();c.globalCompositeOperation='screen';
    for(let i=0;i<5;i++){
      const progress=clamp((phase-.12*noise(i+17))*1.12);
      const depth=.42+.58*noise(i+11),side=i%2?1:-1;
      const fade=Math.sin(Math.PI*progress)*(1-progress)*power;
      if(fade<.01)continue;
      const size=(4+3*depth)*(1-.4*progress),px=x+side*span*depth*(.13+.46*progress);
      c.globalAlpha=fade*depth;c.drawImage(bead,px-size,FLOOR+3-17*depth*Math.sin(Math.PI*progress),size*2,size);
    }
    c.restore();
  }
  const melee=variant=>variant==='jab'||variant==='cross'||variant==='finisher';
  function objectProgress(o){
    if(o.kind==='trap'){
      if(!o.triggered)return .13+.26*ease(0,.9,o.age)+.10*ease(.9,4.3,o.age);
      if(o.age<o.warmup)return .48+.14*ease(o.warmup-.2,o.warmup,o.age);
      return .62+.32*ease(o.warmup,o.life,o.age);
    }
    if(o.age<o.warmup)return .12+.20*clamp(o.age/o.warmup);
    const flight=o.age-o.warmup,length=Math.max(.06,o.life-o.warmup);
    if(o.follow||o.kind==='column')return .32+.54*clamp(flight/length);
    // Source particles travel forward even when an orb turns around. Enter the
    // bright core early, then let its filaments continue to evolve during flight.
    const start=o.warmup?.32:.24;
    return start+(.73-start)*(1-Math.exp(-2.8*flight))+.18*ease(.62*length,length,flight);
  }
  class ArenaEffects {
    constructor(manifest,sheetURL){
      this.manifest=manifest;this.sheetURL=sheetURL;this.loaded=new Map();this.timelines=new WeakMap();this.generation=0;
      this.lights=[];this.blades=new ArenaBladeFX.BladeFX();
    }
    reset(){this.blades.reset();this.generation++;this.loaded.clear();this.timelines=new WeakMap();this.lights.length=0;this.waterPlanes=null}
    async prepare(actorIds){
      const generation=++this.generation;
      const wanted=new Set(actorIds.flatMap(id=>ArenaEngine.roster[id].skills.map(skill=>skill.kind)));
      if(!wanted.has('leviathan'))this.waterPlanes=null;
      for(const kind of shared)if(this.manifest?.clips[kind])wanted.add(kind);
      for(const kind of this.loaded.keys())if(!wanted.has(kind))this.loaded.delete(kind);
      const decoded=await Promise.all([...wanted].filter(kind=>!this.loaded.has(kind)).map(async kind=>{
        const clip=this.manifest.clips[kind];
        if(!clip?.frames?.length)throw Error('缺少招式动效 '+kind);
        if(typeof MEDIA!=='undefined'&&MEDIA.phone){
          // Warm the first frame of each selected move during the fighters' entrances.
          MEDIA.page(clip.sheets[clip.frames[0][0]]);
          return [kind,{clip}];
        }
        const images=await Promise.all(clip.sheets.map(async name=>{const im=new Image();im.src=this.sheetURL(name);await im.decode();return im}));
        return [kind,{clip,images}];
      }));
      if(generation!==this.generation)return;
      for(const [kind,assets] of decoded)this.loaded.set(kind,assets);
      this.timelines=new WeakMap();
    }
    waterPlane(image,index,clip,front){
      if(!this.waterPlanes)this.waterPlanes={layers:[],image:null,index:-1};
      const cache=this.waterPlanes;
      if(cache.image!==image||cache.index!==index){
        const [,sx,sy,w,h,dx,dy]=clip.frames[index];
        for(let side=0;side<2;side++){
          const layer=cache.layers[side]||document.createElement('canvas');
          if(layer.width!==w)layer.width=w;
          if(layer.height!==h)layer.height=h;
          const g=layer.getContext('2d');
          g.globalCompositeOperation='copy';g.drawImage(image,sx,sy,w,h,0,0,w,h);
          // The breaking lip rises toward the leading end of the wave.
          const mask=g.createLinearGradient(clip.w*.43-dx,clip.h*.32-dy,clip.w*.53-dx,clip.h*.77-dy);
          for(const [at,near] of [[0,.07],[.29,.17],[.62,.56],[.87,.91],[1,1]]){
            mask.addColorStop(at,'rgba(0,0,0,'+(side?near:1-near)+')');
          }
          g.globalCompositeOperation='destination-in';g.fillStyle=mask;g.fillRect(0,0,w,h);
          cache.layers[side]=layer;
        }
        cache.image=image;cache.index=index;
      }
      return cache.layers[Number(front)];
    }
    stamp(c,kind,time,x,y,width,height,dir=1,opacity=1,angle=0,front=null){
      const asset=this.loaded.get(kind);
      if(!asset||opacity<.004)return;
      const {clip,images}=asset;
      const n=Math.round(clamp(time)*(clip.frames.length-1)),[page,sx,sy,w,h,dx,dy]=clip.frames[n];
      const image=images?images[page]:MEDIA.page(clip.sheets[page]).image;
      if(!image)return;
      c.save();c.globalCompositeOperation=clip.blend||this.manifest.blend||'screen';c.globalAlpha*=clamp(opacity);c.translate(x,y);c.rotate(angle);
      c.scale(dir*width/clip.w,height/clip.h);
      if(front===null)c.drawImage(image,sx,sy,w,h,dx-clip.anchor[0],dy-clip.anchor[1],w,h);
      else c.drawImage(this.waterPlane(image,n,clip,front),dx-clip.anchor[0],dy-clip.anchor[1],w,h);
      c.restore();
    }
    reflect(c,kind,phase,x,y,w,h,dir,power,clock,large,reduced){
      // A rough floor scatters the incident light instead of mirroring a second spell.
      const weight=power*clamp(1-(FLOOR-y)/440)*(reduced?.54:1);
      if(weight<.022)return;
      const color=colors[kind]||'#b3d9ed',span=w*(large?.70:.59),cx=x+dir*w*.035;
      lamp(c,cx,FLOOR+6,span,large?27:15,color,weight*.68);
      if(large)lamp(c,cx+dir*span*.12,FLOOR+3,span*.49,6,'#ffefda',weight*.31);
    }
    wake(c,o,state,reduced){
      const kind=o.variant,dimensions=footprint[kind];if(!dimensions||!colors[kind]||kind==='uppercut')return;
      if(kind==='sonar'||kind==='ember'&&o.triggered)return;
      const waiting=o.age<o.warmup,phase=objectProgress(o),dir=o.facing||1;
      let [w,h]=dimensions,x=o.x,y=o.y;
      if(kind==='ember'&&!o.triggered){w=o.w*1.68;h=61;y=FLOOR-18}
      const energy=waiting?.26+.33*ease(0,o.warmup,o.age):.78;
      const color=colors[kind],altitude=clamp(1-(FLOOR-y)/290);
      lamp(c,x-dir*w*.08,y,w*1.52,h*1.22,color,energy*(reduced?.22:.43));
      if(!reduced&&altitude>.05)this.reflect(c,kind,phase,x,y,w,h,dir,altitude*.32,state.clock,false,false);
      if(altitude>.15)ground(c,x,w*.82,color,energy*altitude*.58);
      spray(c,kind,x,y,w,h,dir,o.age,energy,false,reduced);
    }
    tracks(state){
      let seq=this.timelines.get(state);
      if(!seq||seq.round!==state.round){
        seq={round:state.round,seen:new Set(),films:[],jets:new Map(),time:-1};this.timelines.set(state,seq);
      }
      if(seq.time===state.clock)return seq.films;
      seq.time=state.clock;
      for(const o of state.objects){
        const water=o.kind==='column'&&(o.variant==='sonar'||o.variant==='leviathan');
        const fire=o.kind==='column'&&o.variant==='finale'||o.kind==='trap'&&o.variant==='ember'&&o.triggered;
        if(water||fire){
          seq.jets.set(o.id,{kind:water?'sonar':'ember',x:o.x,y:FLOOR-o.h*.5,w:o.w,h:o.h,dir:o.facing,
            start:state.clock-o.age+o.warmup,duration:water?.69:.56});
        }
      }
      for(const [id,jet] of seq.jets)if(state.clock>jet.start+jet.duration)seq.jets.delete(id);
      for(const e of state.fx){
        if(e.kind!=='cast'||!ultimates[e.variant])continue;
        const owner=state.fighters[e.side],foe=state.fighters[1-e.side];
        // Network snapshots recreate effect objects. A cast's seat and move counter survive the trip.
        const castKey=e.side+'/'+e.variant+'/'+Math.round((state.clock-e.age)*120);
        if(seq.seen.has(castKey))continue;
        seq.seen.add(castKey);
        const move=ArenaEngine.roster[owner.id].skills.find(s=>s.kind===e.variant);
        const accent=move.windup+ultimates[e.variant][3];
        seq.films.push({kind:e.variant,owner:e.side,serial:owner.moveSerial,dir:e.facing,x:e.x,
          y:owner.y,start:state.clock-e.age,windup:move.windup,accent,end:accent+.65,target:foe.x,locked:false});
      }
      seq.films=seq.films.filter(film=>{
        if(state.clock-film.start>=film.end)return false;
        const owner=state.fighters[film.owner],age=state.clock-film.start;
        if(!film.locked){
          const o=state.objects.find(o=>o.owner===film.owner&&o.serial===film.serial&&o.slot==='ult');
          if(o||age>=film.windup){
            film.target=state.fighters[1-film.owner].x;film.locked=true;
            if(o&&['horizon','eclipse'].includes(film.kind))film.target=o.x;
          }else if(!owner.motion||owner.motion.serial!==film.serial)return false;
        }
        return true;
      });
      return seq.films;
    }
    blackHole(c,x,y,w,h,dir,phase,fade){
      const field=ease(.045,.23,phase)*(1-ease(.78,.995,phase))*fade;
      if(field<.015)return;
      const u=lerp(.589,.610,ease(.18,.52,phase))-.018*ease(.59,.82,phase);
      const v=lerp(.479,.500,ease(.25,.48,phase))-.010*ease(.72,.9,phase);
      if(!this.horizonShadow){
        const tile=document.createElement('canvas');tile.width=tile.height=96;
        const g=tile.getContext('2d'),shadow=g.createRadialGradient(48,48,0,48,48,48);
        shadow.addColorStop(0,'#020206');shadow.addColorStop(.63,'#060309');
        shadow.addColorStop(.82,'#0c0610dd');shadow.addColorStop(1,'#180d1800');
        g.fillStyle=shadow;g.fillRect(0,0,96,96);this.horizonShadow=tile;
      }
      const cx=x+dir*(u-.5)*w,cy=y+(v-.5)*h,rx=.089*w,ry=.154*h;
      c.save();c.globalAlpha*=field;c.drawImage(this.horizonShadow,cx-rx,cy-ry,2*rx,2*ry);c.restore();
    }
    surf(c,x,w,dir,phase,col,reduced){
      const energy=ease(.04,.28,phase)*(1-ease(.65,.99,phase));
      if(energy<.002)return;
      // Three crests enter from the tail at different times; every pool is pinned to the floor.
      for(let i=0;i<(reduced?2:4);i++){
        const t=((phase*2.3+i*.277)%1),wave=energy*Math.sin(t*Math.PI);
        const nx=x+dir*w*(-.31+.175*i+.055*t),span=w*(.23+.06*(i%2));
        this.stamp(c,'splash',t,nx,FLOOR+1,span,span*.54,dir*(i%2?1:-1),wave*(reduced?.47:.74));
        ground(c,nx,span*.74,col,wave*.71);
        for(let j=0;j<(reduced?2:5);j++){
          const clock=(t+noise(j*3+i)*.9)%1,bounce=Math.sin(clock*Math.PI);
          const side=j%2?-1:1,dropX=nx+side*(9+clock*span*(.16+.24*noise(i+j)));
          const dropY=FLOOR-bounce*span*(.12+.18*noise(j+31));
          lamp(c,dropX,dropY,2.3+2*wave,3.7+3*bounce,'#d0edff',wave*bounce*.8);
        }
      }
    }
    mainScene(c,state,f,reduced,front){
      if(f.kind==='finale'&&this.actorFilms?.claude?.book){
        this.phoenix(c,state,f,reduced,front);return;
      }
      const [width,height,elevation]=ultimates[f.kind],age=state.clock-f.start,col=colors[f.kind];
      const phase=age<f.windup?.24*clamp(age/f.windup):age<f.accent?
        .24+.37*clamp((age-f.windup)/(f.accent-f.windup)):.61+.39*clamp((age-f.accent)/(f.end-f.accent));
      const reach=ease(.15,.60,phase),release=1-ease(.75,1,phase),growth=.84+.16*ease(0,.46,phase);
      const goal=f.kind==='finale'?clamp(f.x+f.dir*310,100,1100):f.target;
      const from=f.kind==='horizon'||f.kind==='nocturne'?goal:f.x+f.dir*58;
      const x=lerp(from,goal,reduced?.82:reach);
      let y=FLOOR-elevation-(reduced?0:Math.sin(Math.PI*reach)*19);
      if(f.kind==='leviathan')y=FLOOR-height*growth*(.245+.025*ease(.35,.72,phase))-(reduced?2:8)*Math.sin(reach*Math.PI);
      if(f.kind==='finale')y=FLOOR-height*growth*.34-(reduced?22:66)*ease(.16,.65,phase);
      const alpha=(reduced?.74:1)*release;
      if(front){
        if(f.kind==='horizon')this.blackHole(c,x,y,width*growth,height*growth,f.dir,phase,release,reduced);
        const density=f.kind==='recursion'?.84:f.kind==='nocturne'?.82:1;
        this.stamp(c,f.kind,phase,x,y,width*growth,height*growth,f.dir,alpha*density,0,f.kind==='leviathan'?true:null);
        return;
      }
      this.lights.push({x,y,color:col,radius:width*.83,strength:.95*release*ease(0,.37,phase)});
      lamp(c,x,y,width*1.39,height*1.42,col,(reduced?.23:.44)*release*ease(0,.32,phase));
      spray(c,f.kind,x,y,width*growth,height*growth,f.dir,age,release*ease(.04,.31,phase),true,reduced);
      if(f.kind==='leviathan')this.stamp(c,f.kind,phase,x,y,width*growth,height*growth,f.dir,alpha,0,false);
      this.reflect(c,f.kind,phase,x,y,width*growth,height*growth,f.dir,.40*release,age,true,reduced);
      ground(c,x,width*.95,col,release*ease(0,.45,phase)*(reduced?.32:.67));
      if(f.kind==='leviathan')this.surf(c,x,width*growth,f.dir,phase,col,reduced);
    }
    phoenix(c,state,film,reduced,front){
      const age=state.clock-film.start,release=film.windup;
      const f=state.fighters[film.owner],sockets=this.actorFilms.claude.book.ult;
      const pose=clamp(Math.min(age,release)/ArenaEngine.roster.claude.skills[2].duration);
      const [dx,dy]=this.framePlayer?.socket?.(f,'ult',pose)||sockets[Math.round(pose*(sockets.length-1))];
      if(!film.page||age<=release){film.page=[f.x+film.dir*dx,f.y+dy];}
      const [originX,originY]=film.page;
      const flight=Math.max(0,age-release);
      const forward=clamp((flight-.03)/.95),rise=Math.sin(Math.PI*forward);
      const endX=clamp(film.x+film.dir*750,32,1168);
      const x=lerp(originX,endX,forward),y=lerp(originY,FLOOR-126,forward)-rise*(reduced?47:104);
      const birth=ease(.06,release+.22,age),expand=ease(release,release+.44,age);
      const w=12+birth*119+expand*379,h=w*.80;
      const alpha=birth*(1-ease(film.end-.37,film.end,age));
      if(front){
        const pageGlow=ease(.03,.23,age)*(1-ease(release+.04,release+.35,age));
        lamp(c,originX,originY,52,21,'#ff932c',pageGlow*.78);
        lamp(c,originX,originY,25,9,'#fff0ac',pageGlow*.9);
        this.stamp(c,'finale',clamp(age/film.end),x,y,w,h,film.dir,alpha);
      }else{
        this.lights.push({x,y,color:'#ff921e',radius:90+w*.62,strength:alpha*.93});
        lamp(c,x,y,w*.92,h*.72,'#ff5820',alpha*(reduced?.16:.32));
        if(flight>.13)this.reflect(c,'finale',clamp(age/film.end),x,y,w,h,film.dir,.35*alpha,age,true,reduced);
        if(expand>.06)spray(c,'finale',x-film.dir*w*.19,y,w,h,film.dir,age,alpha*.69,true,reduced);
      }
    }
    drawBack(c,state,dt,reduced){
      this.lights.length=0;
      this.blades.update(state,(f,key,phase)=>this.framePlayer?.socket?.(f,key,phase)||
        ArenaBladeFX.sampleTrack(this.actorFilms?.grok?.blade?.[key],phase));
      this.blades.draw(c,state,false,reduced,(...args)=>this.stamp(c,...args));
      const films=this.tracks(state);
      if(films.length){
        const shade=Math.max(...films.map(f=>{
          const age=state.clock-f.start;
          return ease(0,.22,age)*(1-ease(f.end-.30,f.end,age));
        }));
        c.save();c.globalAlpha*=shade*(reduced?.075:.19);c.fillStyle='#101522';c.fillRect(0,0,1200,600);c.restore();
      }
      for(const tr of films)this.mainScene(c,state,tr,reduced,false);
      for(const o of state.objects){
        const color=colors[o.variant];if(!color)continue;
        const waiting=o.age<o.warmup;
        if(!ultimates[o.variant]){
          this.lights.push({x:o.x,y:o.y,color,radius:Math.max(158,o.w*1.35),strength:waiting?.30:.73});
          this.wake(c,o,state,reduced);
          if(inFrontOfHead(o,state))this.projectile(c,o,reduced);
        }
        if(o.kind==='trap'||o.kind==='column'||o.field||o.kind==='beam'){
          const width=o.kind==='beam'?o.w:o.w*(waiting?1.05:1.13);
          const power=waiting?.22+.41*ease(0,o.warmup,o.age):.70;
          if(o.kind==='beam'&&waiting)lamp(c,o.x,o.y,width*1.31,o.h*.43,color,power*.80);
          ground(c,o.x,width,color,power*(reduced?.65:1));
          if(ultimates[o.variant]||waiting&&o.kind==='column'){
            const yFoot=o.y+(o.kind==='beam'?0:o.h*.40);
            lamp(c,o.x,yFoot,width*(o.kind==='beam'?1.2:1),waiting?14:34,color,power);
          }
        }else if(o.y>FLOOR-120)ground(c,o.x,o.w,color,(1-(FLOOR-o.y)/180)*.49);
      }
      this.jets(c,state,reduced,false);
      for(const e of state.fx){
        if(melee(e.variant)&&['hit','block','parry'].includes(e.kind)){
          const u=clamp(e.age/e.life),fade=1-u,guard=e.kind!=='hit',span=(guard?145:166)+64*e.power;
          const dir=e.facing||1;
          lamp(c,e.x,e.y,span,span*.71,guard?'#a7dbff':e.color||'#ffd6a2',.36*fade);
          const actor=state.fighters[e.side];
          spray(c,ArenaEngine.roster[actor.id].skills[0].kind,e.x+dir*14,e.y,span*.69,span*.55,dir,e.age*2.6,.63*fade,false,reduced);
        }
        if(e.variant!=='blink'||e.kind!=='teleport')continue;
        const departure=state.fx.find(old=>old.variant==='blink'&&old.kind==='afterimage'&&old.side===e.side);
        if(!departure)continue;
        const u=clamp(e.age/e.life),fade=(1-u)**1.17,dir=e.x>=departure.x?1:-1;
        const width=Math.max(172,Math.abs(e.x-departure.x)*1.12),cx=(e.x+departure.x)*.5,cy=e.y+7;
        lamp(c,cx,cy,width*1.14,65,colors.blink,fade*(reduced?.33:.66));
        this.stamp(c,'blink',.38+.53*u,cx,cy,width,Math.min(148,64+width*.31),dir,fade*(reduced?.68:.98));
        this.reflect(c,'blink',.38+.53*u,cx,cy,width,110,dir,.35*fade,state.clock,false,reduced);
        spray(c,'blink',cx,cy,width,87,dir,e.age,fade,false,reduced);
      }
      if(!reduced)for(const hit of state.fx){
        if(!matter[hit.variant]||!['hit','block','parry'].includes(hit.kind))continue;
        const age=clamp(hit.age/hit.life),size=60+90*age,energy=(1-age)*(hit.power||.7);
        spray(c,hit.variant,hit.x,hit.y,size*1.5,size,hit.facing||1,hit.age*2.6,energy,false,false);
      }
      for(const f of state.fighters)if(f.counterTime>0){
        const p=clamp(1-f.counterTime/.47),height=335,x=f.x+f.facing*50,y=f.y-.24*height;
        lamp(c,x,y-36,217,204,colors.counter,reduced?.25:.46);
        this.stamp(c,'counter',.32+.37*p,x,y,277,height,f.facing,reduced?.68:.98);
        this.reflect(c,'counter',.32+.37*p,x,y,277,height,f.facing,.37,state.clock,false,reduced);
        spray(c,'counter',x,y-32,180,210,f.facing,state.clock,.8,false,reduced);
      }
    }
    lightActor(c,f,framePlayer,time,reduced){
      let strength=.05,source;
      for(const l of this.lights){
        const distance=Math.hypot(l.x-f.x,l.y-(f.y-102));
        const amount=l.strength*Math.max(0,1-distance/l.radius)**1.4;
        if(amount>strength){strength=amount;source=l;}
      }
      if(!source)return;
      const dx=clamp((source.x-f.x)/112,-1,1),dy=clamp((source.y-f.y+100)/86,-1,1);
      lamp(c,f.x+dx*30,f.y-91+dy*27,66,99,source.color,strength*(reduced?.095:.16));
    }
    projectile(c,o,reduced){
      if(o.variant==='uppercut')return;
      const kind=o.variant,color=colors[kind];if(!color)return;
      const wait=o.age<o.warmup;
      if(ultimates[kind]){
        if(kind==='leviathan'&&o.kind==='wave'){
          this.stamp(c,'tide',objectProgress(o),o.x,o.y,269,185,o.facing,reduced?.66:.95);return;
        }
        if(!wait&&o.kind==='column'&&(kind==='leviathan'||kind==='finale'))return;
        const fade=wait?.20+.30*ease(0,o.warmup,o.age):.89;
        if(o.kind==='column'||o.kind==='beam'){
          const y=o.kind==='column'?FLOOR-o.h*.48:o.y;
          lamp(c,o.x,y,o.w*(o.kind==='beam'?1.4:.94),wait?Math.max(5,o.h*.11):o.h*1.28,color,fade*(reduced?.58:.80));
          if(!wait)lamp(c,o.x,y,o.kind==='beam'?o.w*1.14:o.w*.31,o.kind==='beam'?o.h*.34:o.h,'#ffefd7',.65);
        }else{
          lamp(c,o.x,o.y,o.w*1.67,o.h*1.23,color,fade);
          lamp(c,o.x,o.y,o.w*.77,o.h*.54,'#fff2d7',fade*.89);
        }return;
      }
      let [width,height]=footprint[kind],x=o.x,y=o.y,angle=0,alpha=reduced?.80:1;
      if((kind==='sonar'||kind==='ember'&&o.triggered)&&!wait)return;
      if(kind==='ember'&&!o.triggered){width=1.70*o.w;height=66;y=FLOOR-18}
      if(kind==='gravity'&&wait){width*=.68+.32*ease(0,o.warmup,o.age);height=width}
      if(o.kind==='column'&&wait){width=o.w*1.48;height=38;y=FLOOR-14;alpha*=.70}
      if(o.kind==='bolt')angle=Math.atan2(o.vy,Math.abs(o.vx))*(o.facing||1);
      if(kind==='twins')angle=Math.cos(o.age*9)*Math.sign(o.amp)*.31*(o.facing||1);
      if(o.kind==='slash'&&wait){alpha*=.30}
      this.stamp(c,kind,objectProgress(o),x,y,width,height,o.facing,alpha,angle);
      if(!reduced&&o.vx)lamp(c,x-o.facing*width*.19,y,width*.78,height*.38,color,.34);
    }
    jets(c,state,reduced,front){
      // Keep the thick shaft behind its target and the splash at the feet in front.
      // The source waterline is at 68% of the plate's height, above its transparent border.
      for(const jet of this.timelines.get(state)?.jets?.values()||[]){
        const age=state.clock-jet.start;if(age<0)continue;
        const t=clamp(age/jet.duration),water=jet.kind==='sonar',brightness=(1-ease(.72,1,t))*(reduced?.78:1);
        const width=jet.w*(water?2.88:2.28),height=jet.h*(water?3.56:2.88);
        if(!front){
          c.save();
          if(water){
            const lean=jet.dir*(.105+.035*Math.sin(t*Math.PI));
            c.translate(jet.x,FLOOR);c.rotate(lean);c.translate(-jet.x,-FLOOR);
          }
          this.stamp(c,jet.kind,.26+.71*t,jet.x,FLOOR-(water?.177:.17)*height,width,height,jet.dir,brightness);
          c.restore();
          this.reflect(c,jet.kind,.26+.71*t,jet.x,FLOOR-(water?.177:.17)*height,width,height,jet.dir,.35*brightness,age,true,reduced);
          spray(c,jet.kind,jet.x,FLOOR-height*.21,width*.80,height*.62,jet.dir,age,brightness,true,reduced);
          ground(c,jet.x,jet.w*1.65,colors[jet.kind],brightness*.85);
        }else if(water){
          this.stamp(c,'splash',t,jet.x,FLOOR+1,jet.w*1.68,jet.w*.76,jet.dir,brightness*.78);
          for(const side of [-1,1]){
            const spray=clamp(t*1.20-(side<0?.07:.13));
            this.stamp(c,'splash',spray,jet.x+side*jet.w*.29,FLOOR,jet.w*.88,jet.w*.71,side,brightness*.61);
          }
        }
      }
    }
    drawFront(c,state,dt,reduced){
      for(const film of this.tracks(state))this.mainScene(c,state,film,reduced,true);
      for(const f of state.fighters){

        const kind=f.pose,col=colors[kind];
        if(col&&f.motion&&!f.motion.fired){
          const p=clamp(f.motion.age/Math.max(.03,f.motion.windup)),x=f.x+f.facing*(22+6*p),y=f.y-112;
          lamp(c,x,y,26+40*p,21+38*p,col,(reduced?.52:.77)*p);
        }
        if(f.counterTime>0){
          const p=clamp(1-f.counterTime/.47);
          lamp(c,f.x+f.facing*51,f.y-96,40,74,colors.counter,(reduced?.30:.48)*(1-.5*p));
        }else if(f.action==='guard'){
          const x=f.x+f.facing*31,y=f.y-100,pulse=f.parry>0?1:.54;
          lamp(c,x,y,45,61,f.parry>0?'#bdf5ff':f.color,pulse*.45);
          lamp(c,x+4*f.facing,y-2,12,21,'#e3f9ff',pulse*.39);
        }
      }
      for(const o of state.objects)if(!inFrontOfHead(o,state))this.projectile(c,o,reduced);
      this.jets(c,state,reduced,true);
      for(const e of state.fx){
        const u=clamp(e.age/e.life),fade=1-u,col=colors[e.variant]||e.color||'#ffdb97';

        if(['hit','block','parry','burst'].includes(e.kind)){
          if(e.kind==='hit'&&footprint[e.variant]&&!ultimates[e.variant]&&e.variant!=='sonar'&&e.variant!=='ember'&&!inFrontOfHead(e,state)){
            const [w,h]=footprint[e.variant];
            this.stamp(c,e.variant,.70+.30*u,e.x,e.y,w*.85,h*.8,e.facing,(reduced?.44:.64)*fade);
          }
          if(e.kind!=='burst'){
            const deflect=e.kind==='block'||e.kind==='parry',p=e.power||.65;
            const close=melee(e.variant),span=close?63+40*p:(deflect?98:88)+(deflect?45:62)*p;
            this.stamp(c,deflect?'deflect':'impact',u,e.x,e.y,span,span*.7,e.facing,(reduced?.62:close?.65:.92)*fade);
          }
          contact(c,e.x,e.y,col,(e.kind==='block'?17:30)*(e.power||.65)+9,u,reduced,e.facing,melee(e.variant));
          if(matter[e.variant]){
            const p=(e.power||.62)*fade;
            ground(c,e.x,66+65*u,col,p*(reduced?.38:.69));
            if(!reduced&&e.kind==='hit'&&FLOOR-e.y<172){
              this.stamp(c,'splash',.10+.81*u,e.x,FLOOR+1,78+58*u,36+21*u,e.facing,.48*p);
            }
          }
        }else if(e.kind==='jump'||e.kind==='land'){
          const span=(e.kind==='land'?138:87)*(e.power+.60);
          this.stamp(c,'splash',u,e.x,FLOOR+1,span,span*.54,e.facing,(reduced?.61:.92)*fade);
          if(!reduced)floorSpray(c,e.x,span,u,e.kind==='land'?.82:.50);
          ground(c,e.x,20+u*63,col,.67*fade);
        }else if(e.kind==='dash'||e.kind==='teleport'){
          if(e.kind==='dash'&&state.fighters[e.side].y>FLOOR-5)this.stamp(c,'splash',u,e.x,FLOOR,76,37,-e.facing,(reduced?.52:.76)*fade);
          lamp(c,e.x-e.facing*u*18,e.y,63*fade+18,e.kind==='teleport'?76:12,col,fade*(reduced?.27:.49));
        }
      }
      this.blades.draw(c,state,true,reduced,(...args)=>this.stamp(c,...args));
    }
  }
  window.ArenaEffects=ArenaEffects;
})();
