(() => {
  'use strict';
  const frames=new Map(),tables=new Map();
  const titles={
    deepseek:{medium:'唤浪歌姬',high:'深海公主',extra:'巨鲸先知',max:'沧溟女皇',ultra:'沧海之主'},
    chatgpt:{medium:'霜翼骑士',high:'圣银龙骑',extra:'苍穹龙将',max:'辉光古龙',ultra:'太初龙神'},
    claude:{medium:'烈焰司主',high:'禁典术师',extra:'秘阁大贤者',max:'真理仲裁者',ultra:'全知之主'},
    gemini:{medium:'窥星术士',high:'织星魔女',extra:'星界大魔导',max:'双曜圣女',ultra:'穹宇星神'},
    grok:{medium:'血棘猎手',high:'绯红处刑官',extra:'蔷薇女伯爵',max:'血月大公',ultra:'血之魔王'},
    kimi:{medium:'银弦乐师',high:'镇魂咏唱者',extra:'秘曲大祭司',max:'苍月琴圣',ultra:'永夜月神'}
  };
  function title(id,skin){
    return titles[id][skin] || ArenaEngine.roster[id].title;
  }
  function portrait(id,skin){
    return ArenaRegalia.rank(skin)>0?MEDIA.formPicture(id+'-'+skin):MEDIA.portraits[id]?.[skin]||MEDIA.sprites[id];
  }
  function dyed(key,skin,id,source,sx,sy,w,h){
    const cached=frames.get(key);
    if(cached?.image){return cached.image;}
    const tag=id+skin;
    if(!tables.has(tag)){
      const table=MEDIA.palette(id,skin);
      if(!table)return null;
      tables.set(tag,table);
    }
    const table=tables.get(tag),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(source,sx,sy,w,h,0,0,w,h);
    const block=ctx.getImageData(0,0,w,h),p=block.data;
    for(let i=0;i<p.length;i+=4){
      if(!p[i+3])continue;
      const j=(((p[i]>>3)<<10)|((p[i+1]>>3)<<5)|(p[i+2]>>3))*3;
      p[i]+=table[j];p[i+1]+=table[j+1];p[i+2]+=table[j+2];
    }
    ctx.putImageData(block,0,0);frames.set(key,{image:canvas}); if(frames.size>72)frames.delete(frames.keys().next().value);return canvas;
  }
  class DressedFramePlayer extends ArenaFramePlayer {
    constructor(manifest,sheets,getSkin){super(manifest,sheets);this.getSkin=getSkin;this.side=null;}
    async prepare(ids,skins=ids.map((id,side)=>this.getSkin(id,side))){
      const base=new Set(ids.filter((id,side)=>ArenaRegalia.rank(skins[side])<=0));
      await Promise.all([super.prepare(ids,id=>base.has(id)),...ids.map((id,side)=>
        ArenaRegalia.rank(skins[side])>0?ArenaFullBody.prepare(id,skins[side]):null),
        ...ids.filter((id,side)=>skins[side]==='ultra').map(id=>ArenaRegalia.prepare(id))]);
    }
    socket(f,move,phase){
      const skin=this.getSkin(f.id,f.side);
      if(ArenaRegalia.rank(skin)<=0)return null;
      const count=this.manifest.actors[f.id].clips[move][1];
      return ArenaFullBody.socket(f.id,skin,move,phase*(count-1),count);
    }
    paintHalo(ctx,f,time,reduced){
      if(this.getSkin(f.id,f.side)!=='ultra')return;
      const {key,count,index,fraction}=this.frameAt(f,time);
      const g=ArenaFullBody.anchor(f.id,'ultra',key,index,count,fraction);
      const resting=key==='ko';
      const h=ArenaRegalia.placement(g,resting);
      ctx.save();ctx.globalAlpha*=resting?.63:1;
      ArenaRegalia.halo(ctx,f.id,f.x+f.facing*h.x,f.y+h.y,h.r,time,reduced,key==='ult'?Math.sin(Math.PI*index/Math.max(1,count-1)):0);
      ctx.restore();
    }
    paint(ctx,f,...args){
      this.side=f.side;
      try{return super.paint(ctx,f,...args);}finally{this.side=null;}
    }
    drawFaceRegion(ctx,f,key,image,x,y,w,h,dx,dy,dw,dh){
      const skin=this.getSkin(f.id,f.side);
      if(skin==='base'||ArenaRegalia.rank(skin)>0){super.drawFaceRegion(ctx,f,key,image,x,y,w,h,dx,dy,dw,dh);return;}
      const frame=dyed(['face',f.id,key,skin].join('/'),skin,f.id,image,x,y,w,h);
      if(frame)ctx.drawImage(frame,dx,dy,dw,dh);
      else super.drawFaceRegion(ctx,f,key,image,x,y,w,h,dx,dy,dw,dh);
    }
    drawFrame(ctx,id,move,index,fraction){
      const {actor}=this.loaded.get(id),skin=this.getSkin(id,this.side);
      if(ArenaRegalia.rank(skin)>0){
        ArenaFullBody.draw(ctx,id,skin,move,index,actor.clips[move][1],fraction);
        return;
      }
      const pose=this.frameSource(id,move,index);
      if(!pose)return;
      const [,x,y,w,h,left,top]=pose.frame;
      const scale=actor.nativeScale?.[pose.move]||this.manifest.scale;
      const tint=skin==='dawn'||skin==='eclipse'
        ?dyed([id,pose.move,pose.index,skin].join('/'),skin,id,pose.image,x,y,w,h):null;
      if(tint)ctx.drawImage(tint,left/scale,top/scale,w/scale,h/scale);
      else ctx.drawImage(pose.image,x,y,w,h,left/scale,top/scale,w/scale,h/scale);
    }
  }
  window.ArenaSkins={title,portrait,FramePlayer:DressedFramePlayer};
})();
