/* Weapon emission is anchored to the painted blade. The projectile and contact plates supply their own depth and highlights. */
((root,factory)=>{
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ArenaBladeFX=factory();
})(typeof window==='undefined'?globalThis:window,()=>{
  'use strict';
  const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const striking=new Set(['jab','cross','finisher']);
  const material={deepseek:'tide',chatgpt:'loop',claude:'pages',gemini:'blink',grok:'uppercut',kimi:'crescent'};

  function sampleTrack(points,p){
    if(!points?.length)return null;
    const at=clamp(p)*(points.length-1),i=Math.floor(at),j=Math.min(i+1,points.length-1);
    return [mix(points[i][0],points[j][0],at-i),mix(points[i][1],points[j][1],at-i)];
  }

  class BladeFX {
    constructor(){this.reset();}
    reset(){this.time=-1;this.round=-1;this.axe=[null,null];}
    update(state,socket){
      const now=state.clock;
      if(state.round!==this.round||now<this.time)this.reset();
      if(now===this.time)return;
      this.time=now;this.round=state.round;
      for(const f of state.fighters){
        const move=f.action==='cast'?f.move:f.action==='attack'?['','jab','cross'][f.chain]:null;
        const phase=f.progress||0;
        if(f.id!=='grok'||!f.motion||f.stun>0||!move||phase<.045||phase>.76){
          this.axe[f.side]=null;continue;
        }
        const pos=socket(f,move,phase);
        if(!pos){this.axe[f.side]=null;continue;}
        const tipX=f.x+pos[0]*f.facing,tipY=f.y+pos[1],last=this.axe[f.side];
        const dt=last?now-last.time:0;
        const same=last&&last.serial===f.motion.serial&&last.dir===f.facing&&dt>0&&dt<.12;
        const speed=same?Math.hypot(tipX-last.x,tipY-last.y)/dt:0;
        const heat=clamp((speed-55)/410);
        this.axe[f.side]={x:tipX,y:tipY,dir:f.facing,front:pos[0]>-12,time:now,phase,move,
          heat:same?Math.max(heat,last.heat*Math.exp(-dt*14)):heat,serial:f.motion.serial};
      }
    }
    draw(ctx,state,front,reduced,stamp){
      if(!stamp)return;
      for(const blade of this.axe){
        if(!blade||blade.front!==front)continue;
        const lifting=blade.move==='skill2';
        const heat=blade.heat*(reduced?.72:1);
        if(heat<.045)continue;
        // The dark root and white-hot flakes belong to a single moving plume.
        const width=(lifting?146:57)*(.56+.44*heat),height=width*(lifting?1.25:.80);
        stamp('uppercut',.20+.65*blade.phase,blade.x-blade.dir*width*.06,blade.y-height*.10,
          width,height,blade.dir,heat*(lifting?.98:.76));
      }
      if(!front)return;
      for(const o of state.objects){
        if(!striking.has(o.variant))continue;
        const hero=state.fighters[o.owner]?.id;
        if(!material[hero]||(hero==='grok'&&this.axe[o.owner]))continue;
        const u=clamp(o.age/o.life),kick=o.variant==='finisher',dir=o.facing||1;
        const force=(kick?1:o.variant==='cross'?.78:.55)*(reduced?.76:1);
        const width=(kick?105:63)*(.72+.36*u),height=width*(hero==='grok'?.78:.53);
        stamp(material[hero],.27+.52*u,o.x+dir*(.20+.18*u)*o.w,o.y,
          width,height,dir,force*Math.sin(Math.PI*(.10+.86*u)));
      }
    }
  }
  return {BladeFX,sampleTrack};
});
