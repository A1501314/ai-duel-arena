/* A clip stores complete transparent poses and a foot anchor for every frame.
   Combat runs at its own tick rate; the clock only selects which pose to display. */
class ArenaFramePlayer {
  constructor(manifest,sheetURL){
    this.manifest=manifest;
    this.sheetURL=sheetURL;
    this.loaded=new Map();
    this.tracks=new WeakMap();
    this.victors=new WeakSet();
    this.facePlayers=new WeakMap();
  }
  async prepare(ids,needsBase=()=>true){
    const wanted=new Set(ids);
    for(const id of this.loaded.keys())if(!wanted.has(id))this.loaded.delete(id);
    await Promise.all([...wanted].map(async id=>{
      const actor=this.manifest.actors[id];
      if(!needsBase(id)){
        this.loaded.set(id,{actor,bodyOnly:true});return;
      }
      if(this.loaded.has(id)&&!this.loaded.get(id).bodyOnly)return;
      if(typeof MEDIA!=='undefined'&&MEDIA.phone){
        const [first,count]=actor.clips.idle;
        const pages=new Set(MEDIA.painted?[actor.frames[first][0]]:actor.frames.slice(first,first+count).map(frame=>frame[0]));
        const face=actor.clips.expression?.[0];
        if(face!==undefined)pages.add(actor.frames[face][0]);
        await Promise.all([...pages].map(n=>MEDIA.page(actor.sheets[n]).ready));
        const idle=actor.frames[first],image=await MEDIA.page(actor.sheets[idle[0]]).ready;
        this.loaded.set(id,{actor,idle:{frame:idle,image,move:'idle'}});
        if(!MEDIA.painted)for(const move of ['walk','jab'])MEDIA.page(actor.sheets[actor.frames[actor.clips[move][0]][0]]);
        return;
      }
      const idle=actor.frames[actor.clips.idle[0]];
      const pinned=new Set([idle[0]]);
      if(actor.clips.expression)pinned.add(actor.frames[actor.clips.expression[0]][0]);
      const bundle={actor,pinned,images:[],extraPages:new Map(),extraPixels:0,pending:new Map(),retryAfter:new Map()};
      const firstPages=new Set(pinned);
      for(const move of (typeof MEDIA!=='undefined'&&MEDIA.painted?[]:['walk','jab'])){
        firstPages.add(actor.frames[actor.clips[move][0]][0]);
      }
      await Promise.all([...firstPages].map(n=>this.desktopPage(bundle,n)));
      bundle.idle={frame:idle,image:bundle.images[idle[0]],move:'idle',index:0};
      this.loaded.set(id,bundle);
    }));
    this.tracks=new WeakMap();
  }
  clip(f){
    if(this.victors.has(f)&&this.manifest.actors[f.id]?.clips.victory)return 'victory';
    switch(f.action){
      case 'attack':return f.chain===3?'kick'+(f.kickVariant??(f.moveSerial%2)):(f.chain===2?'cross':'jab');
      case 'cast':return f.move;
      case 'dash':return f.dashDir===f.facing?'dash':'dashBack';
      case 'jump':return f.jumps>1?'doubleJump':'jump';
      case 'walk':case 'fall':case 'guard':case 'hurt':case 'ko':return f.action;
      default:return 'idle';
    }
  }
  sampleTime(f,key,count,elapsed){
    const fps=this.manifest.fps;
    let normalized;
    switch(key){
      case 'jab':case 'cross':case 'kick0':case 'kick1':case 'skill1':case 'skill2':case 'ult':
        normalized=f.progress;break;
      case 'dash':case 'dashBack':normalized=1-f.dash/.15;break;
      case 'jump':case 'doubleJump':normalized=1+f.vy/(key==='jump'?770:635);break;
      case 'fall':normalized=f.vy/770;break;
      case 'hurt':case 'ko':case 'victory':{
        const position=Math.min(count-1,elapsed*fps);
        return {index:Math.floor(position),fraction:position/Math.max(1,count-1)};
      }
      default:{
        const step=(elapsed*fps)%count;
        if(key==='walk'&&f.vx*f.facing<0)return {index:(count-Math.floor(step))%count,fraction:(count-step)%count/count};
        return {index:Math.floor(step),fraction:step/count};
      }
    }
    const fraction=Math.max(0,Math.min(1,normalized||0));
    return {index:Math.round(fraction*(count-1)),fraction};
  }
  index(f,key,count,elapsed){
    return this.sampleTime(f,key,count,elapsed).index;
  }
  frameAt(f,clock){
    const {actor}=this.loaded.get(f.id);
    const key=this.clip(f),count=actor.clips[key][1];
    let track=this.tracks.get(f);
    if(!track||key!==track.key){
      track={key,since:clock,lastClock:clock,x:f.x,travel:0};this.tracks.set(f,track);
    }
    let index,fraction;
    if(key==='walk'&&actor.walkTravel){
      if(clock>=track.lastClock){
        track.travel+=(f.x-track.x)*f.facing;track.x=f.x;track.lastClock=clock;
      }
      const positions=actor.walkTravel, cycle=positions[count];
      const position=((track.travel%cycle)+cycle)%cycle;
      index=0;
      while(index+1<count&&positions[index+1]<=position)index++;
      const stride=positions[index+1]-positions[index];
      fraction=(index+(stride>0?(position-positions[index])/stride:0))/count;
    }else{
      ({index,fraction}=this.sampleTime(f,key,count,Math.max(0,clock-track.since)));
    }
    return {key,count,index,fraction};
  }
  paint(ctx,f,clock,dx=0,opacity=1){
    const {key,index,fraction}=this.frameAt(f,clock);
    ctx.save();ctx.globalAlpha*=opacity;ctx.translate(f.x+dx,f.y);ctx.scale(f.facing,1);
    this.drawFrame(ctx,f.id,key,index,fraction);
    ctx.restore();
  }
  drawFrame(ctx,id,key,index){
    const pose=this.frameSource(id,key,index);
    if(!pose)return;
    const [,sx,sy,w,h,left,top]=pose.frame;
    const scale=this.loaded.get(id).actor.nativeScale?.[pose.move]||this.manifest.scale;
    ctx.drawImage(pose.image,sx,sy,w,h,left/scale,top/scale,w/scale,h/scale);
  }
  page(bundle,index){
    if(!bundle.images)return MEDIA.page(bundle.actor.sheets[index]).image;
    if(bundle.images[index])return bundle.images[index];
    const image=bundle.extraPages.get(index);
    if(image){bundle.extraPages.delete(index);bundle.extraPages.set(index,image);return image;}
    if(!image&&!bundle.pending.has(index)&&performance.now()>=(bundle.retryAfter.get(index)||0)){
      this.desktopPage(bundle,index).catch(()=>bundle.retryAfter.set(index,performance.now()+1500));
    }
    return image;
  }
  desktopPage(bundle,index){
    if(bundle.pending.has(index))return bundle.pending.get(index);
    const name=bundle.actor.sheets[index],image=new Image();image.src=this.sheetURL(name);
    const job=image.decode().then(()=>{
      bundle.retryAfter.delete(index);
      if(!bundle.pinned.has(index)){
        bundle.extraPixels+=image.width*image.height;
        bundle.extraPages.set(index,image);
        for(const [key,old] of bundle.extraPages){
          if(bundle.extraPixels<=12*1024*1024||key===index)break;
          bundle.extraPages.delete(key);bundle.extraPixels-=old.width*old.height;
        }
      }else bundle.images[index]=image;
      return image;
    }).finally(()=>bundle.pending.delete(index));
    bundle.pending.set(index,job);return job;
  }
  frameSource(id,move,index,side=this.side??0){
    const bundle=this.loaded.get(id),actor=bundle.actor,frame=actor.frames[actor.clips[move][0]+index];
    const image=this.page(bundle,frame[0]);
    if(image){
      const pose={image,frame,move,index};
      if(move!=='eyelids')(bundle.lastPoses||=[])[side]=pose;
      return pose;
    }
    if(index%2===1&&actor.sheets[frame[0]].includes('between-')){
      const previous=actor.frames[actor.clips[move][0]+index-1],keyImage=this.page(bundle,previous[0]);
      if(keyImage)return {frame:previous,image:keyImage,move,index:index-1};
    }
    if(move==='eyelids')return null;
    const last=bundle.lastPoses?.[side];
    if(last?.move===move)return last;
    const first=actor.frames[actor.clips[move][0]],opening=this.page(bundle,first[0]);
    return opening?{image:opening,frame:first,move,index:0}:last||bundle.idle;
  }
  setRoundResult(state){
    const finished=state.phase==='roundOver'||state.phase==='matchOver';
    for(const f of state.fighters||[]){
      if(finished&&f.side===state.winner)this.victors.add(f);else this.victors.delete(f);
    }
  }
  drawFaceRegion(ctx,f,key,image,x,y,w,h,dx,dy,dw,dh){
    ctx.drawImage(image,x,y,w,h,dx,dy,dw,dh);
  }
  paintFace(canvas,f,state){ArenaFacial.paintFace(this,canvas,f,state);}
}
window.ArenaFramePlayer=ArenaFramePlayer;
