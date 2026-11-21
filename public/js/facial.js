/* HUD expressions use intact video frames, including the hair and face around each expression. */
const ArenaFacial=(()=>{
  function moodFor(face,f,state){
    if(state.phase==='roundOver'||state.phase==='matchOver')return f.side===state.winner?'smile':'wince';
    if(f.action==='ko'||f.action==='hurt'){
      face.hitUntil=state.clock+.30;
      return 'wince';
    }
    if(state.clock<face.hitUntil)return 'wince';
    if(f.action==='attack'||f.action==='cast'){
      face.castUntil=state.clock+.14;
      return 'cry';
    }
    if(state.clock<face.castUntil)return 'cry';
    return state.phase==='intro'?'smile':'focus';
  }
  function update(face,target,dt){
    if(!face.to&&face.from!==target){face.to=target;face.progress=0;}
    if(!face.to)return;
    // Direct transitions in the footage meet at their painted endpoints.
    const forward=target===face.to||(target!==face.from&&face.progress>=.5);
    face.progress=Math.max(0,Math.min(1,face.progress+(forward?1:-1)*dt/.30));
    if(face.progress===1){face.from=face.to;face.to=null;}
    else if(face.progress===0&&!forward)face.to=null;
  }
  function paintFace(player,canvas,f,state){
    const bundle=player.loaded.get(f.id),actor=bundle?.actor;
    if(!canvas)return;
    const skin=player.getSkin?.(f.id,f.side)||'base';
    canvas.hidden=['medium','high','extra','max','ultra'].includes(skin);
    if(canvas.hidden||!actor?.faceTracks||!actor.clips.expression)return;
    let face=player.facePlayers.get(canvas);
    if(!face||face.id!==f.id||state.clock<face.last){
      face={id:f.id,last:state.clock,from:'focus',to:null,progress:0,hitUntil:-1,castUntil:-1,stamp:''};
      player.facePlayers.set(canvas,face);
      canvas.width=canvas.height=MEDIA.phone?220:352;
    }
    const dt=Math.min(.10,state.clock-face.last);face.last=state.clock;
    update(face,moodFor(face,f,state),dt);
    let from=face.from,to=face.to,t=face.progress;
    if(!to){to=from==='focus'?'smile':'focus';t=0;}
    const direct=actor.faceTracks[from+'-'+to],track=direct||actor.faceTracks[to+'-'+from];
    const index=track[0]+Math.round((direct?t:1-t)*(track[1]-1));
    const stamp=skin+'/'+index;
    if(face.stamp===stamp)return;
    const [page,x,y,w,h]=actor.frames[actor.clips.expression[0]+index];
    const image=player.page(bundle,page);
    if(!image)return;
    const ctx=canvas.getContext('2d'),size=canvas.width;
    ctx.clearRect(0,0,size,size);
    player.drawFaceRegion(ctx,f,index,image,x,y,w,h,0,0,size,size);
    face.stamp=stamp;
  }
  return {paintFace};
})();
