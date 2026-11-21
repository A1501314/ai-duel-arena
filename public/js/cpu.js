/* The computer is a second controller. All movement and combat use Match.input. */
(() => {
  'use strict';

  const LEVELS = {
    easy:   {reaction:.36, interval:.27, defend:.38, skill:.52, pressure:.56, dash:.16},
    normal: {reaction:.22, interval:.18, defend:.68, skill:.72, pressure:.72, dash:.39},
    hard:   {reaction:.13, interval:.11, defend:.86, skill:.91, pressure:.88, dash:.60},
    master: {reaction:.115,interval:.09, defend:.91, skill:.94, pressure:.92, dash:.70, punish:.77},
    champion:{reaction:.095,interval:.075,defend:.96, skill:.97, pressure:.96, dash:.78, punish:.94}
  };
  const STYLES = {
    deepseek:{range:265, rush:.46}, chatgpt:{range:225, rush:.32},
    claude:{range:260, rush:.56}, gemini:{range:205, rush:.56},
    kimi:{range:190, rush:.64}, grok:{range:125, rush:.86}
  };
  const FLOOR = 490;

  function seeded(seed) {
    if (typeof seed === 'function') return seed;
    if (!Number.isFinite(seed)) return Math.random;
    let value = seed >>> 0;
    return () => {
      value = (Math.imul(value,1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  // Only read visible enemy posture and hazards. Player input buffers are private.
  function sight(state, own, enemy) {
    let threat = null, closest = Infinity;
    for (const obj of state.objects) {
      if (obj.owner !== enemy.side) continue;
      const waiting = Math.max(0,obj.warmup - obj.age);
      if (waiting > .50) continue;
      const hw = obj.w / 2 + 34, hh = obj.h / 2;
      if (own.y - 175 > obj.y + hh + 15 || own.y < obj.y - hh - 10) continue;
      let impact = waiting;
      const dx = own.x - obj.x;
      if (Math.abs(dx) > hw) {
        if (!obj.vx || Math.sign(dx) !== Math.sign(obj.vx)) continue;
        impact += (Math.abs(dx) - hw) / Math.abs(obj.vx);
      }
      if (impact > .42 || impact >= closest) continue;
      let kind = 'shot';
      if (obj.kind === 'wave' || (obj.kind === 'beam' && obj.y > FLOOR-90)) kind='low';
      else if (obj.kind === 'column' || obj.kind === 'trap' || obj.field) kind='zone';
      else if (obj.kind === 'slash') kind='melee';
      threat={kind,x:obj.x}; closest=impact;
    }
    if (!threat && Math.abs(enemy.x-own.x)<145 && Math.abs(enemy.y-own.y)<125 &&
        (enemy.action==='attack' || enemy.action==='cast')) threat={kind:'melee',x:enemy.x,posture:true};
    return {x:enemy.x,y:enemy.y,vx:enemy.vx,action:enemy.action,combo:enemy.combo,threat,
      move:enemy.move,serial:enemy.moveSerial,progress:enemy.progress};
  }

  function moveWeights(id,gap,above,foe) {
    const air = above > 50, onGround = foe.y > FLOOR-90;
    switch(id) {
      case 'deepseek': return [onGround && gap<890 ? 1.15 : .18, onGround ? 1 : .42];
      case 'chatgpt': return [gap<565 && Math.abs(above)<120 ? 1.12 : .12,
        gap<126 && (foe.action==='attack' || foe.action==='walk') ? .32 : 0];
      case 'claude': return [gap<810 ? 1 : 0, gap<330 && onGround ? 1.18 : .09];
      case 'gemini': return [gap<228 && Math.abs(above)<112 ? 1.65 : 0,
        gap<860 ? 1.20 : .12];
      case 'kimi': return [gap<270 && Math.abs(above)<120 ? 1.65 : 0,
        gap<850 ? (air ? 1.72 : .87) : .1];
      case 'grok': return [gap<330 ? 1.20 : 0, gap<140 && Math.abs(above)<175 ? 1.8 : 0];
      default: return [1,1];
    }
  }

  class ArenaCPU {
    constructor(match,difficulty='normal',seed,side=1) {
      this.side=side;
      this.match=match;
      this.level=LEVELS[difficulty] || LEVELS.normal;
      this.random=seeded(seed);
      this.held=new Set();
      this.reset();
    }
    reset() {
      for (const key of this.held) this.match.input(this.side,key,false);
      this.held.clear();
      this.body=null; this.now=0; this.nextSample=0; this.nextPlan=0;
      this.nextStance=0; this.rush=false; this.history=[]; this.dashPress=null;
      this.lastMove=null; this.seenSerial=-1; this.repeatCount=0; this.lastMoveAt=-Infinity;
    }
    button(key,down) {
      if (this.held.has(key)===down) return;
      this.match.input(this.side,key,down);
      if (down) this.held.add(key); else this.held.delete(key);
    }
    tap(key) {
      this.button(key,true); this.button(key,false);
    }
    apply(plan) {
      if (plan.action==='escape') this.button('guard',false);
      this.button('guard',plan.action==='guard' || plan.action==='escape'); this.button('attack',plan.action==='attack');
      const dir=plan.dir || 0, movement=dir<0?'left':'right';
      this.button('left',plan.action!=='dash' && dir<0);
      this.button('right',plan.action!=='dash' && dir>0);
      if (plan.action==='dash') {
        // Two distinct direction presses leave the same double-tap window as a keyboard.
        this.button(movement,false); this.tap(movement);
        this.dashPress={key:movement,at:this.now+.075};
      } else if (plan.action && !['attack','guard','escape'].includes(plan.action)) this.tap(plan.action);
      this.nextPlan=this.now+(plan.hold || this.level.interval)*(.86+this.random()*.28);
    }
    update(dt) {
      const state=this.match.state;
      if (state.phase!=='fight' || state.paused) {
        if (this.body) this.reset();
        return;
      }
      if (!Number.isFinite(dt) || dt<=0) return;
      const own=state.fighters[this.side],enemy=state.fighters[1-this.side];
      if (this.body!==own) {this.reset();this.body=own;}
      this.now+=Math.min(.25,dt);
      if (this.dashPress && this.now>=this.dashPress.at) {
        this.button(this.dashPress.key,true); this.dashPress=null;
      }
      if (this.now>=this.nextSample) {
        this.history.push({at:this.now,foe:sight(state,own,enemy)});
        this.nextSample=this.now+.045;
      }
      const lastVisible=this.now-this.level.reaction;
      while (this.history.length>1 && this.history[1].at<=lastVisible) this.history.shift();
      const sample=this.history[0];
      if (!sample || sample.at>lastVisible || this.now<this.nextPlan || state.hitstop>0) return;
      this.apply(this.plan(own,sample.foe));
    }
    plan(f,foe) {
      const level=this.level, style=STYLES[f.id], rand=this.random;
      const dx=foe.x-f.x, toward=Math.sign(dx)||f.facing, gap=Math.abs(dx), above=f.y-foe.y;
      const grounded=f.y>=FLOOR-1, atWall=f.x<115 || f.x>1085;
      if (this.now>=this.nextStance) {
        this.rush=rand()<style.rush;
        this.nextStance=this.now+1.25+rand()*2.3;
      }
      const cancel=f.motion?.slot==='attack' && f.confirmed && f.progress>=.48;
      if (f.stun && foe.combo>=3 && f.energy>=35 && !f.escapeCd && rand()<level.defend)
        return {action:'escape',hold:.18};
      if (f.stun>.09 || f.dash || (f.motion && !cancel)) {
        return {dir:f.y<FLOOR-1?toward:0,hold:level.interval};
      }
      if (level.punish) {
        // Track repeated attacks only after the delayed animation is visible to this controller.
        if (foe.move && foe.serial!==this.seenSerial) {
          this.repeatCount=foe.move===this.lastMove && this.now-this.lastMoveAt<=3.8 ? this.repeatCount+1 : 1;
          this.lastMove=foe.move; this.seenSerial=foe.serial; this.lastMoveAt=this.now;
        }
        const recovering=foe.move && foe.progress>=.62 && (!foe.threat || foe.threat.posture);
        if (recovering && Math.abs(above)<115 && rand()<level.punish) {
          if (gap<121) return {action:'attack',dir:toward,hold:.26};
          if (gap<290 && !f.cd.skill1 && moveWeights(f.id,gap,above,foe)[0]>=1)
            return {action:'skill1',hold:.19};
        }
        const repeated=this.repeatCount>=2 && this.now-this.lastMoveAt<1;
        if (repeated && grounded && gap<141 && foe.threat?.kind==='melee' && !recovering && f.guardMeter>24)
          return {action:'guard',hold:.10};
        if (repeated && recovering && foe.move!=='attack' && gap>180 && gap<580 && !f.dashCd)
          return {action:'dash',dir:toward,hold:.24};
      }
      if (foe.threat && rand()<level.defend) {
        const threat=foe.threat;
        if (f.id==='chatgpt' && !f.cd.skill2 && rand()<.72) return {action:'skill2'};
        if (f.id==='gemini' && !f.cd.skill1 && gap<228 && rand()<.72)
          return {action:'skill1'};
        if (f.id==='grok' && !f.cd.skill2 && gap<132 && above>30 && above<170 && rand()<.70)
          return {action:'skill2'};
        if (threat.kind==='zone' && !f.dashCd) {
          let escape=Math.sign(f.x-threat.x)||toward;
          if ((escape<0 && f.x<158) || (escape>0 && f.x>1042)) escape=-escape;
          return {action:'dash',dir:escape,hold:.29};
        }
        if (threat.kind==='low' && f.jumps<2 && rand()<.80) return {action:'jump',dir:toward,hold:.25};
        if (grounded && f.guardMeter>19) return {action:'guard',hold:.19+rand()*.19};
        if (f.jumps<2) return {action:'jump',dir:atWall?toward:-toward,hold:.28};
      }
      if (f.energy>=100 && (f.id!=='claude' || gap<720) && rand()<level.skill) {
        return {action:'ult',hold:.30};
      }
      const close=gap<117 && Math.abs(above)<125;
      const weights=moveWeights(f.id,gap,above,foe);
      if (f.cd.skill1>0) weights[0]=0;
      if (f.cd.skill2>0) weights[1]=0;
      const sum=weights[0]+weights[1];
      const odds=level.skill*Math.min(1,sum)*(close && this.rush && !cancel ? .60 : 1);
      if (sum>0 && rand()<odds) {
        return {action:rand()*sum<weights[0]?'skill1':'skill2',hold:level.interval+.06};
      }
      if (close && rand()<level.pressure) return {action:'attack',dir:toward,hold:.25+rand()*.27};
      const orbit=this.rush || (!weights[0] && !weights[1]) ? 89 : style.range;
      if (gap<orbit-48 && !atWall) return {dir:-toward,hold:.16+rand()*.17};
      if (gap>orbit+20) {
        if (gap>235 && !f.dashCd && rand()<level.dash) return {action:'dash',dir:toward,hold:.26};
        if (grounded && gap>140 && gap<450 && rand()<.17) return {action:'jump',dir:toward,hold:.37};
        return {dir:toward};
      }
      if (!grounded && f.vy>0 && f.jumps<2 && above>55 && rand()<level.dash) return {action:'jump',dir:toward};
      return {dir:close ? -toward : 0,hold:level.interval};
    }
  }
  if (typeof window!=='undefined') window.ArenaCPU=ArenaCPU;
  if (typeof module!=='undefined' && module.exports) module.exports=ArenaCPU;
})();
