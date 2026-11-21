(() => {
  'use strict';
  const engine=typeof module!=='undefined'&&module.exports?require('./engine.js'):window.ArenaEngine;
  const levels={easy:{reward:1,loss:1,growth:3},normal:{reward:3,loss:2,growth:9},hard:{reward:5,loss:3,growth:22}};
  const rankedGrowth=12,requiredHardWins=5;
  const forms=[
    {id:'base',name:'Low',min:0},{id:'medium',name:'Medium',min:101},
    {id:'high',name:'High',min:251},{id:'extra',name:'Extra',min:501},
    {id:'max',name:'Max',min:901},{id:'ultra',name:'Ultra',min:1501}
  ];
  const opponents=Object.keys(engine.roster);
  const challenges={
    extra:{goal:3,cpuLevel:'hard',opponents:['deepseek','grok','gemini','kimi','claude']},
    max:{goal:4,cpuLevel:'master',opponents:['kimi','gemini','grok','claude','chatgpt']},
    ultra:{goal:5,cpuLevel:'champion',opponents:['deepseek','grok','gemini','kimi','chatgpt','claude']}
  };
  const dyes={dawn:{name:'晨曦',cost:18},eclipse:{name:'月蚀',cost:45}};
  const skins={...Object.fromEntries(forms.map(f=>[f.id,f])),...dyes};
  const tiers=forms.map(f=>[f.min,f.name]);
  const buttons=['left','right','jump','guard','attack','skill1','skill2','ult'];
  // Exact 24 kHz PCM lengths from the release that issued trials without a timing snapshot.
  const originalIntros=Object.freeze(Object.fromEntries(Object.entries({
    deepseek:59520,chatgpt:72310,claude:50333,gemini:54380,grok:71040,kimi:51550
  }).map(([id,samples])=>[id,samples/24000])));
  function voiceKey(clips,cue,skin){
    const variant=skin+'-'+cue;
    return clips && Object.hasOwn(clips,variant)?variant:cue;
  }
  function introDurations(lines,ids,skins=[]){
    const seats=ids.map((id,side)=>{
      const actor=lines[id],entry=actor?.[voiceKey(actor,'intro',skins[side])];
      const duration=typeof actor==='number'?actor:typeof entry==='number'?entry:entry?.duration;
      if(!(Number.isFinite(duration)&&duration>0))throw new Error('角色登场录音时长无效。');
      return duration;
    });
    const result=Object.fromEntries(ids.map((id,side)=>[id,seats[side]]));
    if(ids[0]===ids[1]&&seats[0]!==seats[1])result.seats=seats;
    return result;
  }
  function trialOpening(ticket,fallback=originalIntros){
    return ticket.opening?(ticket.openingDurations||fallback):null;
  }
  const tick=1/60;
  function fail(message){throw Object.assign(new Error(message),{status:400,code:'progress'});}
  const fighter=id=>typeof id==='string'&&Object.hasOwn(engine.roster,id);
  function basePower(id){
    const s=engine.roster[id].stats;
    return Math.round(20*(.4*s.attack+.35*s.defense+.25*s.speed));
  }
  function fresh(now=Date.now(),legacy={}){
    const mastery=12*(legacy.wins||0);
    return {wallet:30+(legacy.points||0),mastery,basePower:0,formRank:forms.findLastIndex(f=>mastery>=f.min),
      soloWins:0,soloLosses:0,hardWins:0,hardOpponents:[],avatars:[],avatar:null,series:null,
      trialUntil:now+86400000,owned:[],equipped:{}};
  }
  const power=p=>p.basePower+p.mastery;
  function standing(points){
    const index=forms.findLastIndex(form=>points>=form.min);
    return {current:forms[index],next:forms[index+1]};
  }
  const rank=p=>p.formRank??forms.findLastIndex(f=>power(p)>=f.min);
  const tier=p=>forms[rank(p)].name;
  function upgrade(p,history=[]){
    const needsHardWins=!Number.isInteger(p.hardWins)||p.hardWins<0;
    if(!needsHardWins&&p.formRank!=null)return false;
    // Older local receipts omit difficulty; five wallet points uniquely identify a hard win.
    const wins=new Map(history.filter(h=>h.id&&h.result?.won===true&&
      (h.level==='hard'||(h.level==null&&h.result.delta===5))).map(h=>[h.id,h]));
    if(needsHardWins)p.hardWins=wins.size;
    if(p.formRank==null){
      p.formRank=rank(p);p.hardOpponents=[];p.avatars=[];p.avatar=null;p.series=null;
      for(const h of wins.values()){
        if(!fighter(h.opponent))continue;
        if(!p.avatars.includes(h.opponent))p.avatars.push(h.opponent);
        const before=h.result.power-h.result.growth;
        if(p.formRank===1&&before>=forms[1].min&&!p.hardOpponents.includes(h.opponent))
          p.hardOpponents.push(h.opponent);
      }
    }
    return true;
  }
  function opponentsFor(target){return [...(challenges[target]?.opponents||opponents)];}
  function path(p){
    const current=forms[rank(p)],next=forms[rank(p)+1]||null,challenge=challenges[next?.id];
    const kind=!next?'done':challenge?'series':next.id==='medium'?'hard':'distinct';
    const remaining=next?Math.max(0,next.min-power(p)):0;
    const series=p.series?{...p.series,wins:p.series.results.filter(Boolean).length,
      losses:p.series.results.filter(won=>!won).length}:null;
    const order=series?.opponents||(next?opponentsFor(next.id):[]);
    return {current,next,remaining,kind,goal:challenge?.goal??(kind==='hard'?requiredHardWins:kind==='distinct'?3:0),
      opponents:order,defeated:p.hardOpponents||[],hardWins:p.hardWins||0,series,
      ready:kind==='series'&&remaining===0,nextOpponent:challenge?order[series?.results.length||0]:null,avatars:p.avatars||[]};
  }
  function setAvatar(p,hero){
    if(hero!==null&&(!fighter(hero)||!p.avatars?.includes(hero)))fail('首次在高手试炼或晋级赛击败她，即可佩戴她的头像。');
    p.avatar=hero;
  }
  function victory(p,id,opponent,strength,ranked=true){
    const before=power(p),hero=basePower(id);
    const own=ranked?Math.max(before,hero):hero;
    const adjustment=Math.max(-1,Math.min(1,Math.trunc((opponent-own)/10)));
    const gain=strength+adjustment,medium=forms[1].min;
    const qualifying=p.formRank===0&&(p.hardWins??0)<requiredHardWins;
    p.mastery+=qualifying?Math.min(gain,medium-1-before):gain;
    if(p.formRank===0&&p.hardWins>=requiredHardWins&&power(p)>=medium)p.formRank=1;
    else if(p.formRank===1&&p.hardOpponents.length>=3&&power(p)>=forms[2].min)p.formRank=2;
  }
  function skinFor(p,id,now=Date.now()){
    const item=p?.equipped[id];
    if(!item||!Object.hasOwn(skins,item))return 'base';
    if(skins[item].min!=null)return rank(p)>=forms.indexOf(skins[item])?item:'base';
    return now<p.trialUntil||p.owned.includes(id+'.'+item)?item:'base';
  }
  function wardrobe(p,id,skin,buy,now=Date.now()){
    if(!fighter(id)||typeof skin!=='string'||!Object.hasOwn(skins,skin)||typeof buy!=='boolean')fail('请选择有效的角色和外观。');
    const form=skins[skin];
    if(form.min!=null){
      if(rank(p)<forms.indexOf(form))fail('达到 '+form.min+' 力量并晋升 '+form.name+' 后即可穿戴。');
      p.equipped[id]=skin;
      return;
    }
    const key=id+'.'+skin,owned=p.owned.includes(key);
    if(buy&&!owned){
      if(p.wallet<skins[skin].cost)fail('Token 余额不足。赢得试炼或联机对战可获得 Token。');
      p.wallet-=skins[skin].cost;p.owned.push(key);
    }else if(!owned&&now>=p.trialUntil)fail('这件外观的试穿已结束，永久解锁后即可穿戴。');
    p.equipped[id]=skin;
  }
  function begin(p,parameters,entropy,now=Date.now()){
    const {hero,opening,promotion=false}=parameters;
    let {opponent,level}=parameters;
    if(typeof promotion!=='boolean')fail('晋级赛模式无效。');
    if(promotion){
      const info=path(p);
      if(!info.ready)fail('当前等级或力量尚未满足本轮晋级赛条件。');
      if(!fighter(hero)||typeof opening!=='boolean')fail('试炼阵容无效。');
      if(!p.series)p.series={target:info.next.id,opponents:info.opponents,results:[]};
      return {...entropy,hero,opponent:info.nextOpponent,level:'hard',cpuLevel:challenges[info.next.id].cpuLevel,
        promotion:info.next.id,round:p.series.results.length,opening,held:0,recovery:false,started:now};
    }
    if(!fighter(hero)||!fighter(opponent)||typeof level!=='string'||!Object.hasOwn(levels,level)||typeof opening!=='boolean')fail('试炼阵容或难度无效。');
    const recovery=p.wallet===0,held=Math.min(p.wallet,levels[level].loss);
    p.wallet-=held;
    return {...entropy,hero,opponent,level,opening,held,recovery,started:now};
  }
  function soloResult(p,ticket,won){
    const rules=levels[ticket.level],beforePower=power(p),beforeRank=p.formRank,reward=ticket.recovery?1:rules.reward;
    const loss=ticket.interrupted?Math.min(ticket.held,p.wallet):ticket.held;
    let avatar=null,seriesStatus=null;
    if(ticket.promotion&&(!p.series||p.series.target!==ticket.promotion||
        p.series.results.length!==ticket.round||p.series.opponents[ticket.round]!==ticket.opponent))
      fail('晋级赛轮次已变更，请刷新账号查看当前赛程。');
    if(won){
      p.soloWins++;p.wallet+=(ticket.interrupted?0:ticket.held)+reward;
      if(ticket.level==='hard'){
        p.hardWins++;
        if(!p.avatars.includes(ticket.opponent)){avatar=ticket.opponent;p.avatars.push(avatar);}
        if(beforeRank===1&&!p.hardOpponents.includes(ticket.opponent))p.hardOpponents.push(ticket.opponent);
      }
      victory(p,ticket.hero,basePower(ticket.opponent),rules.growth,false);
    }else{p.soloLosses++;if(ticket.interrupted)p.wallet-=loss;}
    if(ticket.promotion){
      const series=p.series,goal=challenges[ticket.promotion].goal;
      series.results.push(won);
      const wins=series.results.filter(Boolean).length,left=series.opponents.length-series.results.length;
      if(wins>=goal){p.formRank++;seriesStatus='passed';p.series=null;}
      else if(wins+left<goal){seriesStatus='failed';p.series=null;}
      else seriesStatus='active';
    }
    return {won,delta:won?reward:0-loss,wallet:p.wallet,power:power(p),growth:power(p)-beforePower,tier:tier(p),
      hardWins:p.hardWins,avatar,promoted:p.formRank>beforeRank?forms[p.formRank].id:null,seriesStatus};
  }
  // Each pair is a tick and an input transition. The server supplies the AI seed and the combat rules.
  function driver(match,cpu,ticket){
    const moves=[],input=match.input.bind(match),clear=match.clearInput.bind(match),skip=match.skipOpening.bind(match);
    let ticks=0,carry=0,inside=false;
    function record(code){if(!inside&&match.state.phase!=='matchOver')moves.push([ticks,code]);}
    match.input=function(side,key,down){
      if(!inside&&!match.state.paused&&side===0&&buttons.includes(key)&&Boolean(match.state.fighters[0].holds[key])!==Boolean(down))record(buttons.indexOf(key)*2+Number(down));
      return input(side,key,down);
    };
    match.clearInput=function(){record(16);return clear();};
    match.skipOpening=function(){
      if(!match.state.opening||match.state.paused)return false;
      record(17);inside=true;try{return skip();}finally{inside=false;}
    };
    return {ticket,match,trace:()=>({ticks,moves}),advance(dt){
      if(match.state.paused)return;
      if(match.state.phase==='matchOver'){match.update(dt);return;}
      carry+=Math.min(dt,.25);inside=true;
      try{
        while(carry+1e-9>=tick&&match.state.phase!=='matchOver'){
          cpu.update(tick);match.update(tick);ticks++;carry-=tick;
        }
      }finally{inside=false;}
    }};
  }
  async function replay(ticket,trace,openingDurations,CPU,now=Date.now()){
    const {ticks,moves}=trace||{};
    if(!Number.isInteger(ticks)||ticks<1||ticks>180000||ticks>(now-ticket.started+3000)*.06||!Array.isArray(moves)||moves.length>30000)
      fail('试炼记录的时长或动作数量无效。');
    const m=new engine.Match(ticket.hero,ticket.opponent,trialOpening(ticket,openingDurations));
    const cpu=new CPU(m,ticket.cpuLevel||ticket.level,ticket.seed);
    let last=-1,pos=0;
    for(const entry of moves){
      if(!Array.isArray(entry)||entry.length!==2)fail('动作记录无效。');
      const [at,code]=entry;
      if(!Number.isInteger(at)||at<last||at<0||at>=ticks||!Number.isInteger(code)||code<0||code>17)fail('动作记录无效。');
      last=at;
    }
    for(let t=0;t<ticks;t++){
      if(t&&t%240===0)await new Promise(resolve=>typeof setImmediate==='function'?setImmediate(resolve):setTimeout(resolve,0));
      while(pos<moves.length&&moves[pos][0]===t){
        const code=moves[pos++][1];
        if(code===16)m.clearInput();else if(code===17)m.skipOpening();
        else m.input(0,buttons[code>>1],Boolean(code&1));
      }
      cpu.update(tick);m.update(tick);m.drainEvents();
      if(m.state.phase==='matchOver'&&t!==ticks-1)fail('试炼结算时刻无效。');
    }
    if(m.state.phase!=='matchOver')fail('整场试炼尚未分出胜负。');
    return m.state.winner===0;
  }
  const api={levels,rankedGrowth,requiredHardWins,tiers,forms,dyes,skins,basePower,fresh,power,tier,standing,
    upgrade,path,opponentsFor,setAvatar,victory,skinFor,wardrobe,begin,soloResult,driver,replay,voiceKey,introDurations,trialOpening,originalIntros};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.ArenaProgress=api;
})();

if(typeof window!=='undefined'){
  window.ArenaLocalAccounts=class {
    constructor(){
      this.db=new Promise((resolve,reject)=>{
        const open=indexedDB.open('superduel-local-accounts',1);
        open.onupgradeneeded=()=>open.result.createObjectStore('accounts',{keyPath:'id'});
        open.onsuccess=()=>resolve(open.result);
        open.onerror=()=>reject(new Error('浏览器未能打开本机存档。请允许此文件保存数据，或用联机版注册。'));
      });
      this.sessionKey='neural-clash:local-account';
    }
    async record(key,edit){
      const db=await this.db;
      return new Promise((resolve,reject)=>{
        const tx=db.transaction('accounts','readwrite'),store=tx.objectStore('accounts'),read=store.get(key);
        let record,issue;
        read.onsuccess=()=>{
          record=read.result;
          try{
            const upgrade=record&&ArenaProgress.upgrade(record.progress,record.settled);
            if(edit)record=edit(record);
            if(edit||upgrade)store.put(record);
          }catch(e){issue=e;tx.abort();}
        };
        tx.oncomplete=()=>resolve(record);
        tx.onabort=()=>reject(issue||tx.error||new Error('本机存档写入失败。'));
        tx.onerror=()=>reject(tx.error);
      });
    }
    user(record){
      if(!record)return null;
      const {id,name,progress}=record;return {id,name,progress,local:true,points:0,wins:0,losses:0};
    }
    async active(){const id=localStorage.getItem(this.sessionKey);return id?this.user(await this.record(id)):null;}
    async key(password,salt){
      if(!globalThis.crypto?.subtle)throw new Error('浏览器未开放安全存档功能。请用本机启动程序或 Edge、Chrome 打开这个文件。');
      const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
      const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:165000},key,256);
      return Array.from(new Uint8Array(bits),v=>v.toString(16).padStart(2,'0')).join('');
    }
    async authenticate(action,{name,password}){
      const display=name.normalize('NFKC').trim(),id=display.toLowerCase();
      if(!/^[\p{L}\p{M}\p{N}_-]{2,20}$/u.test(display))throw new Error('账号名可用 2 至 20 个汉字、字母、数字、下划线或短横线。');
      if([...password].length<8||new TextEncoder().encode(password).length>256)throw new Error('密码至少 8 个字符，最多 256 字节。');
      let record;
      if(action==='register'){
        const salt=crypto.getRandomValues(new Uint8Array(16)),digest=await this.key(password,salt);
        record=await this.record(id,old=>{
          if(old)throw new Error('此浏览器已有同名档案，请直接登录。');
          return {id,name:display,salt,digest,progress:ArenaProgress.fresh(),settled:[]};
        });
      }else{
        record=await this.record(id);
        if(!record||record.digest!==await this.key(password,record.salt))throw new Error('账号名或密码有误。');
      }
      localStorage.setItem(this.sessionKey,id);return {user:this.user(record),room:null};
    }
    async exportPass(password){
      const id=localStorage.getItem(this.sessionKey),source=id&&await this.record(id);
      if(!source||source.digest!==await this.key(password,source.salt))throw new Error('请输入当前本机档案的正确密码。');
      const row=await this.record(id,r=>{r.originId||=crypto.randomUUID();return r;});
      const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
      const input=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
      const secret=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:165000},input,{name:'AES-GCM',length:256},false,['encrypt']);
      const data={id:row.originId,name:row.name,owned:row.progress.owned,equipped:row.progress.equipped};
      const sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv},secret,new TextEncoder().encode(JSON.stringify(data)));
      const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
      return {version:1,salt:hex(salt),iv:hex(iv),sealed:hex(sealed)};
    }
    async call(path,data,expected){
      if(path==='/login'||path==='/register')return this.authenticate(path.slice(1),data);
      if(path==='/me')return {user:await this.active(),room:null};
      const id=localStorage.getItem(this.sessionKey);
      if(expected&&id!==expected)throw Object.assign(new Error('此浏览器已切换本机档案，请核对当前玩家。'),{code:'account_changed',status:409});
      if(path==='/logout'){localStorage.removeItem(this.sessionKey);return {ok:true};}
      if(!id)throw new Error('请先登录本机档案。');
      let result,ticket;
      const record=await this.record(id,r=>{
        if(!r)throw new Error('本机档案已移除，请重新注册。');
        if(path==='/skins')ArenaProgress.wardrobe(r.progress,data.hero,data.skin,data.buy);
        else if(path==='/avatar')ArenaProgress.setAvatar(r.progress,data.hero);
        else if(path==='/trials'){
          const done=data.requestId&&r.settled.find(entry=>entry.requestId===data.requestId);
          if(done){result=done.result;ticket=null;return r;}
          if(data.requestId&&r.active?.requestId===data.requestId){ticket=r.active;return r;}
          if(r.active){this.settle(r,r.active,false);}
          const seed=crypto.getRandomValues(new Uint32Array(1))[0];
          ticket=r.active=ArenaProgress.begin(r.progress,data,{id:crypto.randomUUID(),seed,requestId:data.requestId});
          if(ticket.opening)ticket.openingDurations=ArenaProgress.introDurations(MEDIA.lines,[ticket.hero,ticket.opponent],
            [ArenaProgress.skinFor(r.progress,ticket.hero),ticket.promotion||'base']);
        }else if(path==='/trials/finish'||path==='/trials/abandon'){
          result=r.settled.find(x=>x.id===data.id)?.result;
          if(!result){
            if(r.active?.id!==data.id)throw new Error('本账号的有效试炼记录已变更。');
            result=this.settle(r,r.active,path==='/trials/finish'&&data.won===true);
          }
        }else throw new Error('此操作需通过联机大厅完成。');
        return r;
      });
      return {user:this.user(record),result,ticket};
    }
    settle(record,ticket,won){
      const result=ArenaProgress.soloResult(record.progress,ticket,won);
      record.settled.push({id:ticket.id,requestId:ticket.requestId,level:ticket.level,opponent:ticket.opponent,result});
      record.settled=record.settled.slice(-24);record.active=null;return result;
    }
  };
}
