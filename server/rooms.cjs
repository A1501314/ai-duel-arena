'use strict';
const {randomInt,randomUUID}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const {problem}=require('./store.cjs');
const {Match,roster}=require('../public/js/engine.js');
const Progress=require('../public/js/progression.js');
const choices=new Set(Object.keys(roster));
const stages=new Set(['rooftop','astral','bloom','caldera']);
const buttons=new Set(['left','right','jump','guard','attack','skill1','skill2','ult']);
const invitation='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GRACE=45000,IDLE=30*60000;
const deny=(status,code,message)=>{throw problem(status,code,message)};
const chosen=f=>{if(!choices.has(f))deny(400,'fighter','未找到这个角色');return f};
const stageValue=v=>{if(!stages.has(v))deny(400,'stage','未找到这个舞台');return v};
const member=(uid,fighter)=>({uid,fighter,ready:false});
const seats=[0,1];
class Rooms{
  constructor(store){
    this.store=store;this.byCode=new Map();this.byUser=new Map();this.peers=new Map();
    const now=Date.now();
    for(const record of store.restore()){
      const room={...record,queue:[new Map(),new Map()],history:[],eventSeq:record.eventSeq||0,dirty:false,lastBackup:now,
        absent:record.players.map(p=>p?now:null),touched:now,match:null};
      if(record.engine){
        const m=new Match(...record.engine.ids);Object.assign(m,record.engine);m.events=[];
        // JSON snapshots copy the shared damage budget of a multi-pillar ultimate.
        const budgets=new Map();
        for(const object of m.state.objects){
          if(!object.score)continue;
          const key=object.owner+':'+object.serial;
          if(budgets.has(key))object.score=budgets.get(key);
          else budgets.set(key,object.score);
        }
        if(room.phase==='playing')m.pause(true);
        room.match=m;
      }
      this.byCode.set(room.code,room);room.players.forEach(p=>{if(p)this.byUser.set(p.uid,room)});
    }
  }
  online(uid){return Boolean(this.peers.get(uid)?.size);}
  room(uid){return this.byUser.get(uid)||null;}
  requireRoom(uid){return this.room(uid)||deny(404,'no_room','请先创建或加入房间');}
  side(r,uid){return r.players.findIndex(p=>p?.uid===uid);}
  public(r,uid){
    if(!r)return null;
    const side=this.side(r,uid);
    return {code:r.code,ownerId:r.ownerId,stage:r.stage,phase:r.phase,selfSide:side,inputSeq:r.inputSeq[side]??0,
      graceSeconds:GRACE/1000,disconnectedAt:[...r.absent],matchId:r.matchId,result:r.result,
      players:r.players.map(p=>{
        if(!p)return null;
        const {progress,...user}=this.store.user(p.uid);
        return {...user,...(p.uid===uid?{progress}:{}),avatar:progress.avatar,tier:Progress.tier(progress),fighter:p.fighter,skin:r.phase==='playing'&&p.matchSkin?p.matchSkin:Progress.skinFor(progress,p.fighter),ready:p.ready,online:this.online(p.uid)};
      })};
  }
  record(r){
    const m=r.match;
    return {code:r.code,ownerId:r.ownerId,stage:r.stage,phase:r.phase,players:r.players,matchId:r.matchId,result:r.result,
      inputSeq:r.inputSeq,eventSeq:r.eventSeq,engine:m?{ids:m.ids,state:m.state,acc:m.acc,objectId:m.objectId}:null};
  }
  save(r){this.store.save(r.code,this.record(r));r.lastBackup=Date.now();r.dirty=false;}
  create(uid,{fighter='deepseek',stage='rooftop'}){
    if(this.room(uid))deny(409,'in_room','请先离开当前房间');
    chosen(fighter);stageValue(stage);
    let code;do{code=Array.from({length:6},()=>invitation[randomInt(invitation.length)]).join('')}while(this.byCode.has(code));
    const now=Date.now(),r={code,ownerId:uid,stage,phase:'lobby',players:[member(uid,fighter),null],matchId:null,result:null,match:null,
      inputSeq:[0,0],absent:[this.online(uid)?null:now,null],queue:[new Map(),new Map()],history:[],eventSeq:0,dirty:false,lastBackup:now,touched:now};
    this.byCode.set(code,r);this.byUser.set(uid,r);this.changed(r);return r;
  }
  join(uid,{code,fighter='claude'}){
    if(typeof code!=='string'||!/^\s*[A-Za-z2-9]{6}\s*$/.test(code))deny(400,'invite','请输入六位房间邀请码');
    chosen(fighter);const r=this.byCode.get(code.trim().toUpperCase());
    if(!r)deny(404,'no_invite','未找到这个房间');
    if(this.room(uid)===r)return r;
    if(this.room(uid))deny(409,'in_room','请先离开当前房间');
    if(r.phase!=='lobby'||r.players.every(Boolean))deny(409,'full','房间已满或对局已开始');
    const n=r.players.findIndex(p=>!p);r.players[n]=member(uid,fighter);r.absent[n]=this.online(uid)?null:Date.now();
    this.byUser.set(uid,r);this.changed(r);return r;
  }
  select(uid,data){
    const r=this.requireRoom(uid),p=r.players[this.side(r,uid)];
    if(r.phase!=='lobby')deny(409,'phase','当前阶段无法更改选择');
    if(data.stage!==undefined&&uid!==r.ownerId)deny(403,'owner','只有房主可以选择舞台');
    if(data.fighter!==undefined)chosen(data.fighter);if(data.stage!==undefined)stageValue(data.stage);
    if(data.fighter!==undefined&&p.fighter!==data.fighter){p.fighter=data.fighter;p.ready=false;}
    if(data.stage!==undefined&&r.stage!==data.stage){r.stage=data.stage;for(const s of r.players)if(s)s.ready=false;}
    this.changed(r);return r;
  }
  ready(uid,value){
    const r=this.requireRoom(uid);
    if(typeof value!=='boolean')deny(400,'ready','请指定准备状态');
    if(r.phase!=='lobby')deny(409,'phase','房间已开始对局');
    if(value&&this.store.growth(uid).wallet===0)deny(409,'empty_wallet','Token 已用完。先赢一场免费单人返场试炼即可重返排位。');
    r.players[this.side(r,uid)].ready=value;
    if(r.players.every(p=>p?.ready))this.start(r);else this.changed(r);
    return r;
  }
  start(r){
    const fighters=r.players.map(p=>p.fighter);
    for(const p of r.players){
      const progress=this.store.growth(p.uid);
      if(progress.wallet===0)deny(409,'empty_wallet','双方都需要至少 1 Token 才能开始排位。');
      p.matchSkin=Progress.skinFor(progress,p.fighter);
    }
    const durations=this.store.openingFor(fighters,r.players.map(p=>p.matchSkin));
    const now=Date.now();r.phase='playing';r.result=null;r.matchId=randomUUID();r.inputSeq=[0,0];r.queue=[new Map(),new Map()];
    r.history=[];r.eventSeq=0;r.match=new Match(...fighters,durations);
    r.absent=r.players.map(p=>this.online(p.uid)?null:now);
    if(r.absent.some(t=>t!==null))r.match.pause(true);
    this.collect(r);this.store.transaction(()=>{this.store.start(r.matchId,r.code,r.players.map(p=>p.uid));this.save(r)});
    this.roomUpdate(r);this.sendFrames(r);
  }
  rematch(uid){
    const r=this.requireRoom(uid),n=this.side(r,uid);
    if(r.phase!=='finished')deny(409,'phase','请在整场结束后请求再战');
    if(!r.players[1-n]){
      r.phase='lobby';r.match=null;r.matchId=null;r.result=null;r.inputSeq=[0,0];r.history=[];r.players[n].ready=false;
      this.changed(r);return r;
    }
    r.players[n].ready=true;
    if(r.players.every(p=>p.ready))this.start(r);else this.changed(r);return r;
  }
  finish(r,winner,reason){
    if(r.phase!=='playing')return;
    const s=r.match.state;
    if(reason==='forfeit'||reason==='disconnect'||winner===-1){
      s.phase='matchOver';s.winner=winner;s.paused=false;s.objects=[];s.hitstop=0;
      if(winner>=0)s.wins[winner]=2;
      r.match.clearInput();
      if(winner>=0)r.match.emit('win',{side:winner,match:true});
    }
    r.phase='finished';r.touched=Date.now();for(const p of r.players)if(p)p.ready=false;
    this.collect(r);
    const played=reason==='ko'||reason==='timeout'||s.round>1||s.time<90;
    this.store.transaction(()=>{r.result=this.store.finish(r.matchId,winner,reason,s.wins,r.players.map(p=>p.uid),r.players.map(p=>p.fighter),played);this.save(r)});
    this.sendFrames(r);this.roomUpdate(r);
  }
  leave(uid){
    const r=this.room(uid);if(!r)return null;const n=this.side(r,uid);
    if(r.phase==='playing')this.finish(r,1-n,'forfeit');
    this.byUser.delete(uid);r.players[n]=null;r.absent[n]=null;
    const remaining=r.players.find(Boolean);
    if(remaining){if(r.ownerId===uid)r.ownerId=remaining.uid;remaining.ready=false;this.changed(r)}
    else this.erase(r);
    this.eachPeer(uid,p=>p.send({type:'room',room:null}));return null;
  }
  erase(r){
    for(const p of r.players)if(p)this.byUser.delete(p.uid);
    this.byCode.delete(r.code);this.store.forget(r.code);
  }
  changed(r){r.touched=Date.now();this.save(r);this.roomUpdate(r);}
  eachPeer(uid,fn){for(const peer of this.peers.get(uid)||[])fn(peer);}
  accountUpdate(user){this.eachPeer(user.id,peer=>peer.send({type:'account',user}));}
  roomUpdate(r){for(const p of r.players)if(p)this.eachPeer(p.uid,peer=>peer.send({type:'room',room:this.public(r,p.uid)}));}
  collect(r){
    for(const e of r.match.drainEvents())r.history.push({...e,seq:++r.eventSeq});
    if(r.history.length>300)r.history.splice(0,r.history.length-300);
  }
  frame(r,peer,n){
    if(!r.match)return;
    if(peer.matchId!==r.matchId){peer.matchId=r.matchId;peer.seen=0;}
    const events=r.history.filter(e=>e.seq>peer.seen);
    if(peer.send({type:'frame',matchId:r.matchId,state:r.match.state,events,inputSeq:r.inputSeq[n]},r.matchId+':'+r.eventSeq))peer.seen=r.eventSeq;
  }
  sendFrames(r){for(const n of seats){const p=r.players[n];if(p)this.eachPeer(p.uid,peer=>this.frame(r,peer,n))}}
  subscribe(uid,peer,lastId){
    if(!this.peers.has(uid))this.peers.set(uid,new Set());this.peers.get(uid).add(peer);
    const r=this.room(uid);
    if(!r){peer.send({type:'account',user:this.store.user(uid)});peer.send({type:'room',room:null});return;}
    const n=this.side(r,uid);r.absent[n]=null;r.touched=Date.now();
    if(lastId){const [id,seen]=String(lastId).split(':');if(r.matchId===id&&Number.isSafeInteger(Number(seen))){peer.matchId=id;peer.seen=Math.min(r.eventSeq,Math.max(0,Number(seen)))}}
    else if(r.match){peer.matchId=r.matchId;peer.seen=r.eventSeq;}
    if(r.phase==='playing'&&r.absent.every(t=>t===null)&&r.match.state.paused)r.match.pause(false);
    this.changed(r);if(r.match)this.frame(r,peer,n);
  }
  unsubscribe(uid,peer){
    const links=this.peers.get(uid);if(!links)return;links.delete(peer);
    if(links.size)return;this.peers.delete(uid);
    const r=this.room(uid);if(!r)return;const n=this.side(r,uid);r.absent[n]=Date.now();
    for(const queue of r.queue)queue.clear();
    if(r.phase==='playing'&&!r.match.state.paused)r.match.pause(true);
    this.changed(r);
  }
  input(uid,data){
    const r=this.requireRoom(uid),n=this.side(r,uid),seq=data.seq;
    if(data.matchId!==r.matchId||r.phase!=='playing')deny(409,'match','对局已更换或结束');
    if(!Number.isSafeInteger(seq)||seq<1)deny(400,'sequence','输入序号无效');
    if(!Array.isArray(data.changes)||data.changes.length>32||!data.changes.every(c=>c&&buttons.has(c.button)&&typeof c.down==='boolean'&&Object.keys(c).every(k=>k==='button'||k==='down')))
      deny(400,'input','按键输入无效');
    if(seq<=r.inputSeq[n])return {ok:true,seq:r.inputSeq[n]};
    if(r.match.state.paused||!this.online(uid))deny(409,'paused','等待双方重新连接');
    if(seq>r.inputSeq[n]+32)deny(409,'sequence','请以当前确认序号重新发送按键');
    if(!r.queue[n].has(seq))r.queue[n].set(seq,data.changes);
    while(r.queue[n].has(r.inputSeq[n]+1)){
      const id=++r.inputSeq[n];for(const c of r.queue[n].get(id))r.match.input(n,c.button,c.down);
      r.queue[n].delete(id);
    }
    r.dirty=true;return {ok:true,seq:r.inputSeq[n]};
  }
  advance(dt,now,deliver){
    for(const r of [...this.byCode.values()]){
      if(r.phase==='playing'){
        const expired=r.absent.map(t=>t!==null&&now-t>=GRACE);
        if(expired.some(Boolean)){
          if(r.absent.every(t=>t!==null)){
            if(expired.every(Boolean))this.finish(r,-1,'abandoned');
          }else this.finish(r,expired[0]?1:0,'disconnect');
          continue;
        }
        r.match.update(dt);this.collect(r);
        if(r.match.state.phase==='matchOver'){this.finish(r,r.match.state.winner,r.match.state.time<=0?'timeout':'ko');continue}
        if(deliver)this.sendFrames(r);
        if(now-r.lastBackup>=2000&&(r.dirty||!r.match.state.paused))this.save(r);
      }else if(now-r.touched>IDLE&&r.players.every(p=>!p||!this.online(p.uid)))this.erase(r);
    }
  }
}
module.exports={Rooms,GRACE};
