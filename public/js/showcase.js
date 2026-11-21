/* A move demonstration runs its own match so opening the archive during a round is safe. */
class ArenaShowcase {
  constructor(canvas, actor, sprites, background, battleFrames, battleEffects, onFinished, actorSkin=battleFrames.getSkin(actor,null)) {
    this.canvas=canvas;this.actor=actor;this.onFinished=onFinished;
    this.opponent=actor==='deepseek'?'claude':'deepseek';
    const ids=[actor,this.opponent];
    const skins=[actorSkin,battleFrames.getSkin(this.opponent,null)];
    this.frames=new ArenaSkins.FramePlayer(MEDIA.motion,MEDIA.sheet,(id,side)=>skins[side??ids.indexOf(id)]);
    this.ownsEffects=!ArenaEngine.roster[actor].skills.every(skill=>battleEffects.loaded.has(skill.kind));
    this.effects=this.ownsEffects?new ArenaEffects(MEDIA.cinema,MEDIA.fxSheet):battleEffects;
    this.ready=Promise.all([this.frames.prepare(ids,skins),this.ownsEffects&&this.effects.prepare([actor])]);
    this.renderer=new ArenaRenderer(canvas,{background,sprites,framePlayer:this.frames,cinema:this.effects});
  }
  async play(slot) {
    cancelAnimationFrame(this.raf);const ticket=this.ticket=(this.ticket||0)+1;
    await this.ready;if(this.closed||ticket!==this.ticket)return;
    const skill=ArenaEngine.roster[this.actor].skills[['skill1','skill2','ult'].indexOf(slot)];
    const match=new ArenaEngine.Match(this.actor,this.opponent),state=match.state;
    state.phase='fight';state.phaseTime=0;match.drainEvents();
    const [player,target]=state.fighters;
    const gap={counter:90,uppercut:91,ember:166,blink:175,crescent:174,gravity:198}[skill.kind]||326;
    player.x=600-gap/2;target.x=600+gap/2;player.energy=100;
    let used=false,answered=false,last=performance.now();
    const tick=now=>{
      if(this.closed||ticket!==this.ticket)return;
      const dt=document.hidden?0:Math.min(.05,(now-last)/1000);last=now;
      if(!used&&state.clock>=.18){match.input(0,slot,true);match.input(0,slot,false);used=true;}
      if(skill.kind==='counter'&&!answered&&state.clock>=.36){match.input(1,'attack',true);match.input(1,'attack',false);answered=true;}
      match.update(dt);this.renderer.render(state,dt);
      for(const e of match.drainEvents()){
        if(window.ArenaCombatSfx?.cueFor(e.type,e))ArcadeAudio.play(e.type,{...e,id:state.fighters[e.side]?.id,move:e.slot,kind:e.variant});
      }
      if(state.clock<2.7)this.raf=requestAnimationFrame(tick);else this.onFinished();
    };
    this.raf=requestAnimationFrame(tick);
  }
  close(){
    this.closed=true;cancelAnimationFrame(this.raf);
    if(this.ownsEffects)this.effects.reset();
    this.frames.loaded.clear();this.ready.then(()=>this.frames.loaded.clear(),()=>{});
  }
}
window.ArenaShowcase=ArenaShowcase;
