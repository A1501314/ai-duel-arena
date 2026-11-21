'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {Match}=require('../public/js/engine.js'),CPU=require('../public/js/cpu.js'),P=require('../public/js/progression.js');
const {Store}=require('./store.cjs');
const {Rooms}=require('./rooms.cjs');
const {copyLegacySave}=require('./server.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');

test('mirror fighters keep their own costume voice and opening length on web and WeChat',()=>{
  const catalog={chatgpt:{intro:{duration:2},'extra-intro':{duration:4},'ultra-intro':{duration:3},ult:{duration:1}}};
  const ids=['chatgpt','chatgpt'],skins=['extra','ultra'];
  const durations=P.introDurations(catalog,ids,skins);
  assert.deepEqual(new Match(...ids,durations).state.opening.durations,[4,3]);
  const native={chatgpt:{intro:2,'extra-intro':4,'ultra-intro':3,ult:1}};
  assert.deepEqual(P.introDurations(native,ids,skins),durations);
  assert.equal(P.voiceKey(catalog.chatgpt,'ult','ultra'),'ult');
  assert.deepEqual(P.introDurations(catalog,ids,['base','eclipse']),{chatgpt:2});
});

function trialWin(profile,hero,opponent,level){
  const ticket=P.begin(profile,{hero,opponent,level,opening:false},{id:profile.soloWins+1,seed:1});
  return P.soloResult(profile,ticket,true);
}

test('all 36 matchups require five hard wins for Medium and three distinct opponents after promotion for High',()=>{
  const heroes=Object.keys(require('../public/js/engine.js').roster),firstGains={easy:new Set(),normal:new Set(),hard:new Set()};
  assert.equal(heroes.length,6);assert.equal(P.requiredHardWins,5);
  for(const hero of heroes)for(const opponent of heroes){
    for(const level of Object.keys(firstGains))firstGains[level].add(trialWin(P.fresh(),hero,opponent,level).growth);
    for(const initial of [0,100]){
      const p=P.fresh();p.mastery=initial;
      for(let win=1;win<=5;win++){
        const result=trialWin(p,hero,opponent,'hard');
        assert.equal(result.hardWins,win);
        if(win===4)assert.equal(result.tier,'Low');
        if(initial===100&&win<5)assert.equal(result.power,100);
        if(win===5)assert.equal(result.tier,'Medium');
      }
      assert.deepEqual(P.path(p).defeated,[]);assert.deepEqual(p.avatars,[opponent]);
      for(let i=0;i<10;i++)trialWin(p,hero,opponent,'hard');
      assert.equal(P.tier(p),'Medium');assert.equal(P.path(p).remaining,0);
      const [second,third]=heroes.filter(h=>h!==opponent);
      trialWin(p,hero,second,'normal');assert.deepEqual(p.hardOpponents,[opponent]);
      trialWin(p,hero,second,'hard');trialWin(p,hero,third,'hard');
      assert.deepEqual(p.hardOpponents,[opponent,second,third]);assert.equal(P.tier(p),'High');
    }
  }
  assert.deepEqual([...firstGains.easy].sort((a,b)=>a-b),[2,3,4]);
  assert.deepEqual([...firstGains.normal].sort((a,b)=>a-b),[8,9,10]);
  assert.deepEqual([...firstGains.hard].sort((a,b)=>a-b),[21,22,23]);
});

test('easy, standard and ranked victories cannot bypass the five-hard-win requirement',()=>{
  for(const level of ['easy','normal','ranked']){
    const p=P.fresh();
    for(let i=0;i<80;i++){
      if(level==='ranked')P.victory(p,'claude',2000,P.rankedGrowth);
      else trialWin(p,'claude','deepseek',level);
    }
    assert.equal(p.hardWins,0);assert.equal(P.power(p),100);assert.equal(P.tier(p),'Low');
    for(let win=1;win<=4;win++)assert.equal(trialWin(p,'claude','deepseek','hard').power,100);
    assert.equal(trialWin(p,'claude','deepseek','hard').tier,'Medium');
  }
});

test('the three promotion brackets enforce their own schedule and can be retried for free from a zero wallet',()=>{
  const options={promotion:true,hero:'kimi',opponent:'kimi',level:'easy',opening:false};
  for(const [idx,id,goal,total,cpuLevel] of [[2,'extra',3,5,'hard'],[3,'max',4,5,'master'],[4,'ultra',5,6,'champion']]){
    const p=Object.assign(P.fresh(),{formRank:idx,mastery:P.forms[idx+1].min-1,wallet:0});
    assert.throws(()=>P.begin(p,options,{seed:1}),/未满足/);
    P.victory(p,'kimi',80,P.rankedGrowth);assert.equal(p.formRank,idx);
    const schedule=P.path(p).opponents;
    assert.equal(new Set(schedule).size,total);assert(P.path(p).ready);assert.equal(P.path(p).remaining,0);
    assert.throws(()=>P.wardrobe(p,'grok',id,true),/晋升/);
    for(let i=0;i<total-goal+1;i++){
      const t=P.begin(p,options,{id:i,seed:1});
      assert.equal(t.promotion,id);assert.equal(t.round,i);assert.equal(t.opponent,schedule[i]);assert.equal(t.cpuLevel,cpuLevel);
      assert.equal(t.level,'hard');assert.equal(t.held,0);assert.equal(t.recovery,false);
      const r=P.soloResult(p,t,false);
      assert.equal(r.seriesStatus,i===total-goal?'failed':'active');assert.equal(r.delta,0);assert.equal(p.wallet,0);
    }
    assert.equal(p.series,null);assert.equal(p.formRank,idx);
    // Finishing on the last allowed bout also exercises the one-loss buffer in the final.
    for(let i=0;i<total;i++){
      const t=P.begin(p,options,{id:20+i,seed:2}),won=i>=total-goal;
      assert.equal(t.opponent,schedule[i]);
      const r=P.soloResult(p,t,won);
      assert.equal(r.delta,won?5:0);assert.equal(r.avatar,won?t.opponent:null);
      assert.equal(r.seriesStatus,i+1===total?'passed':'active');
      assert.equal(r.promoted,i+1===total?id:null);
    }
    assert.equal(p.formRank,idx+1);assert.equal(p.wallet,5*goal);assert.equal(p.series,null);
    P.wardrobe(p,'grok',id,false);assert.equal(P.skinFor(p,'grok'),id);
    if(id==='ultra'){assert.equal(P.path(p).kind,'done');assert.throws(()=>P.begin(p,options,{}),/未满足/);}
  }
});

test('series results, first-win portraits and equipped avatar survive restarts without double awards',async t=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'duel-promotion-')),file=path.join(folder,'save.sqlite');
  let store=new Store(file);
  t.after(()=>{store.close();fs.rmSync(folder,{recursive:true,force:true});});
  const {id,progress}=await store.authenticate('register','晋级检验','tournament-check');
  Object.assign(progress,{formRank:2,mastery:501,wallet:0});store.writeGrowth(id,progress);
  const options={promotion:true,hero:'claude',opponent:'claude',level:'easy',opening:true,requestId:'c'.repeat(32)};
  const first=store.beginSolo(id,options).ticket;
  assert.deepEqual(first,store.beginSolo(id,options).ticket);
  assert.deepEqual(Object.keys(first.openingDurations).sort(),['claude',first.opponent].sort());
  assert.throws(()=>store.setAvatar(id,first.opponent),/首次/);
  const finish=ticket=>store.transaction(()=>store.endSolo(id,{id:ticket.id},false,true));
  const a=finish(first);assert.equal(a.result.avatar,first.opponent);assert.equal(a.result.delta,5);
  assert.deepEqual(a,finish(first));assert.equal(P.path(a.user.progress).series.wins,1);
  store.setAvatar(id,first.opponent);
  const second=store.beginSolo(id,{...options,requestId:'d'.repeat(32)}).ticket;
  const late=store.beginSolo(id,options);assert.equal(late.ticket,null);assert.deepEqual(late.result,a.result);
  assert.equal(store.growth(id).series.results.length,1);
  store.close();store=new Store(file);
  assert.equal(store.user(id).progress.avatar,first.opponent);
  assert.equal(P.path(store.growth(id)).nextOpponent,second.opponent);
  assert.equal(finish(second).result.seriesStatus,'active');
  const third=store.beginSolo(id,{...options,requestId:'e'.repeat(32)}).ticket;
  assert.equal(finish(third).result.promoted,'extra');
  assert.equal(finish(third).user.progress.wallet,15);
  const repeat=store.beginSolo(id,{hero:'claude',opponent:first.opponent,level:'hard',opening:false}).ticket;
  assert.equal(finish(repeat).result.avatar,null);
  assert.equal(store.setAvatar(id,null).progress.avatar,null);
});

test('Max and Ultra tickets replay the same complete encounter as the playable master and champion controllers',async()=>{
  for(const [formRank,mastery,cpuLevel] of [[3,901,'master'],[4,1501,'champion']]){
    const p=Object.assign(P.fresh(),{formRank,mastery});
    const ticket=P.begin(p,{hero:'claude',opening:false,promotion:true},{id:'replay',seed:123456});
    assert.equal(ticket.cpuLevel,cpuLevel);
    const m=new Match(ticket.hero,ticket.opponent),player=new CPU(m,'hard',21207,0);
    const driver=P.driver(m,new CPU(m,cpuLevel,ticket.seed),ticket);
    for(let i=0;i<120000&&m.state.phase!=='matchOver';i++){player.update(1/60);driver.advance(1/60);m.drainEvents();}
    assert.equal(m.state.phase,'matchOver');
    const trace=driver.trace(),finish=ticket.started+Math.ceil(trace.ticks*1000/60);
    assert.equal(await P.replay(ticket,trace,null,CPU,finish),m.state.winner===0);
  }
});

test('a starting purse, trial expiry, permanent unlock and rescue have separate ranking and power',()=>{
  const now=1700000000000,p=P.fresh(now);
  assert.equal(p.wallet,30);assert.equal(P.power(p),0);assert.equal(P.tier(p),'Low');
  P.wardrobe(p,'grok','eclipse',false,now);assert.equal(P.skinFor(p,'grok',now+86399999),'eclipse');
  assert.equal(P.skinFor(p,'grok',now+86400000),'base');assert.throws(()=>P.wardrobe(p,'grok','eclipse',true,now),/不足/);
  P.wardrobe(p,'grok','dawn',true,now);P.wardrobe(p,'grok','dawn',true,now);assert.equal(p.wallet,12);
  assert.equal(P.skinFor(p,'grok',now+86400001),'dawn');assert.equal(P.skinFor(p,'claude',now),'base');
  const data={hero:'grok',opponent:'kimi',level:'hard',opening:false};
  for(let i=0;i<4;i++)P.soloResult(p,P.begin(p,data,{id:i,seed:i},now),false);
  assert.equal(p.wallet,0);const free=P.begin(p,data,{id:'rescue',seed:33},now);
  assert(free.recovery);assert.equal(P.soloResult(p,free,true).delta,1);assert.equal(p.wallet,1);
  assert.equal(P.power(p),22);assert.equal(p.hardWins,1);
  for(const [min,name] of P.tiers)assert.equal(P.tier({basePower:0,mastery:min}),name);
});

test('six fighter wardrobes require the attained tier even after crossing its power threshold',()=>{
  const now=1700000000000,heroes=Object.keys(require('../public/js/engine.js').roster);
  const names=['Low','Medium','High','Extra','Max','Ultra'],thresholds=[0,101,251,501,901,1501];
  assert.equal(heroes.length,6);
  assert.deepEqual(P.forms.map(f=>f.name),names);
  assert.deepEqual(P.forms.map(f=>f.min),thresholds);
  for(const [index,form] of P.forms.entries()){
    const p=P.fresh(now);
    for(const hero of heroes){
      if(form.min){
        p.mastery=form.min+100;p.formRank=index-1;
        assert.equal(P.tier(p),names[index-1]);
        for(const buy of [false,true])assert.throws(()=>P.wardrobe(p,hero,form.id,buy,now),/力量/);
        p.equipped[hero]=form.id;
        assert.equal(P.skinFor(p,hero,now),'base');
      }
      p.mastery=form.min;p.formRank=index;
      assert.equal(P.tier(p),form.name);
      P.wardrobe(p,hero,form.id,false,now+86400001);
      assert.equal(P.skinFor(p,hero,now+86400001),form.id);
    }
    assert.equal(p.wallet,30);
    assert.deepEqual(p.owned,[]);
  }
  assert.equal(P.standing(4000).next,undefined);
});

test('saved power and legacy dye purchases restore with new tier names and without granting the purse again',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'duel-wardrobe-')),file=path.join(folder,'arena.sqlite');
  let db=new Store(file);
  try{
    const {id,progress}=await db.authenticate('register','旅者云','existing-campaign');
    for(const key of ['formRank','hardOpponents','avatars','avatar','series'])delete progress[key];
    Object.assign(progress,{basePower:71,mastery:433,wallet:17,trialUntil:0,owned:['grok.eclipse'],equipped:{grok:'eclipse'}});
    db.writeGrowth(id,progress);
    db.close();db=new Store(file);
    const stored=db.user(id).progress;
    assert.deepEqual(stored,{...progress,formRank:3,hardOpponents:[],avatars:[],avatar:null,series:null});assert.equal(P.tier(stored),'Extra');
    assert.equal(P.skinFor(stored,'grok'),'eclipse');
    db.wardrobe(id,{hero:'grok',skin:'extra',buy:false});
    db.wardrobe(id,{hero:'grok',skin:'eclipse',buy:false});
    assert.equal(db.user(id).progress.wallet,17);
    assert.throws(()=>db.wardrobe(id,{hero:'grok',skin:'max',buy:true}),/901/);
  }finally{db.close();for(const name of fs.readdirSync(folder))fs.unlinkSync(path.join(folder,name));fs.rmdirSync(folder);}
});

test('actual controller inputs replay to matchOver, paused inputs and duplicate settlement included',async()=>{
  const store=new Store(':memory:');
  try{
    const user=await store.authenticate('register','实战测试','local-test-password'),uid=user.id;
    const data={hero:'claude',opponent:'chatgpt',level:'easy',opening:true};
    const {ticket}=store.beginSolo(uid,data),durations=Object.fromEntries(Object.entries(require('./voice-index.json')).map(([id,v])=>[id,v.intro.duration]));
    const m=new Match(data.hero,data.opponent,durations),cpu=new CPU(m,data.level,ticket.seed),driver=P.driver(m,cpu,ticket);
    const p0=new CPU(m,'hard',710356,0);
    m.skipOpening();
    for(let i=0;i<100000&&m.state.phase!=='matchOver';i++){
      if(i===30){m.pause(true);m.input(0,'right',true);m.pause(false);}
      p0.update(1/60);driver.advance(1/60);m.drainEvents();
    }
    assert.equal(m.state.phase,'matchOver');
    const trace=driver.trace(),won=m.state.winner===0;
    assert(trace.moves.length>100);
    const replayClock=ticket.started+Math.ceil(trace.ticks*1000/60);
    assert.equal(await P.replay(ticket,trace,durations,CPU,replayClock),won);
    await assert.rejects(P.replay(ticket,{ticks:6,moves:[]},durations,CPU,replayClock),/未分出/);
    const older={...ticket,started:Date.now()-Math.ceil(trace.ticks*1000/60)};
    store.db.prepare('UPDATE trials SET ticket=? WHERE id=?').run(JSON.stringify(older),ticket.id);
    const [one,two]=await Promise.all([store.verifySolo(uid,{id:ticket.id,trace}),store.verifySolo(uid,{id:ticket.id,trace})]);
    assert.deepEqual(one,two);assert.equal(one.result.won,won);
    const after=store.user(uid);assert.equal(after.points,0);assert.equal(after.progress.soloWins+after.progress.soloLosses,1);
    assert.equal(after.progress.wallet,30+(won?1:-1));
  }finally{store.close();}
});

test('first open of an existing season carries over ranks and grants the purse only once',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'duel-migration-')),file=path.join(folder,'arena.sqlite');
  try{
    const legacy=new DatabaseSync(file);
    legacy.exec("CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,name_key TEXT UNIQUE,salt TEXT,secret TEXT,points INTEGER,wins INTEGER,losses INTEGER); INSERT INTO users VALUES(1,'旧玩家','旧玩家','aa','bb',40,3,2)");
    legacy.close();
    for(let i=0;i<2;i++){const store=new Store(file);try{const u=store.user(1);assert.equal(u.progress.wallet,70);assert.equal(u.points,40);assert.equal(u.wins,3);}finally{store.close();}}
  }finally{for(const name of fs.readdirSync(folder))fs.unlinkSync(path.join(folder,name));fs.rmdirSync(folder);}
});

test('voice updates preserve active trials and rounds; the next room and trial read the new recordings',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'duel-voices-')),file=path.join(folder,'voices.json');
  const bank=(claude,grok)=>fs.writeFileSync(file,JSON.stringify({claude:{intro:{duration:claude}},grok:{intro:{duration:grok}}}));
  const store=new Store(':memory:',file);
  try{
    bank(2.25,1.75);
    const first=(await store.authenticate('register','冒险客','voice-upgrade')).id;
    const other=(await store.authenticate('register','吟游者','voice-upgrade')).id;
    const params={hero:'claude',opponent:'grok',opening:true,level:'easy',requestId:'e'.repeat(32)};
    const trial=store.beginSolo(first,params).ticket;
    const rooms=new Rooms(store),room=rooms.create(first,{fighter:'claude'});
    rooms.join(other,{code:room.code,fighter:'grok'});rooms.ready(first,true);rooms.ready(other,true);
    bank(4.8,3.1);
    assert.deepEqual(room.match.state.opening.durations,[2.25,1.75]);
    assert.deepEqual(store.beginSolo(first,params).ticket.openingDurations,{claude:2.25,grok:1.75});
    rooms.finish(room,-1,'disconnect');rooms.rematch(first);rooms.rematch(other);
    assert.deepEqual(room.match.state.opening.durations,[4.8,3.1]);
    async function finish(ticket){
      const m=new Match(ticket.hero,ticket.opponent,P.trialOpening(ticket));
      const driver=P.driver(m,new CPU(m,ticket.level,ticket.seed),ticket);
      for(let i=0;i<60000&&m.state.phase!=='matchOver';i++){driver.advance(1/60);m.drainEvents();}
      assert.equal(m.state.phase,'matchOver');
      const trace=driver.trace();
      const previous={...ticket,started:Date.now()-Math.ceil(trace.ticks*1000/60)};
      store.db.prepare('UPDATE trials SET ticket=? WHERE id=?').run(JSON.stringify(previous),ticket.id);
      assert.equal((await store.verifySolo(first,{id:ticket.id,trace})).result.won,m.state.winner===0);
    }
    await finish(trial);
    const legacy=store.beginSolo(first,{...params,requestId:'a'.repeat(32)},false).ticket;
    assert.deepEqual(legacy.openingDurations,{claude:P.originalIntros.claude,grok:P.originalIntros.grok});
    delete legacy.openingDurations;
    await finish(legacy);
    const later=store.beginSolo(first,{...params,requestId:'b'.repeat(32)}).ticket;
    assert.deepEqual(later.openingDurations,{claude:4.8,grok:3.1});
  }finally{store.close();fs.unlinkSync(file);fs.rmdirSync(folder);}
});

test('retried start reserves once, restarted host refunds it once, abandoning interrupted play costs nothing',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'duel-restart-')),file=path.join(folder,'arena.sqlite');
  let s=new Store(file);
  try{
    const u=await s.authenticate('register','恢复试炼','account-password');
    const params={hero:'kimi',opponent:'grok',opening:false,level:'hard',requestId:'a'.repeat(32)};
    const a=s.beginSolo(u.id,params),b=s.beginSolo(u.id,params);
    assert.equal(a.ticket.id,b.ticket.id);assert.equal(b.user.progress.wallet,27);
    s.close();s=new Store(file);assert.equal(s.user(u.id).progress.wallet,30);
    s.close();s=new Store(file);assert.equal(s.user(u.id).progress.wallet,30);
    const done=s.transaction(()=>s.endSolo(u.id,{id:a.ticket.id},true));
    assert(done.result.cancelled);assert.equal(done.user.progress.soloLosses,0);
    assert.equal(s.beginSolo(u.id,{...params,requestId:'b'.repeat(32)}).user.progress.wallet,27);
  }finally{s.close();for(const name of fs.readdirSync(folder))fs.unlinkSync(path.join(folder,name));fs.rmdirSync(folder);}
});

test('first portable launch clones the previous account database without overwriting a newer balance',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'duel-copy-')),source=path.join(folder,'before.sqlite'),dest=path.join(folder,'after.sqlite');
  let uid;
  try{
    const first=new Store(source);try{uid=(await first.authenticate('register','旧档用户','password-preserved')).id;}finally{first.close();}
    await copyLegacySave(source,dest);
    const next=new Store(dest);try{assert.equal((await next.authenticate('login','旧档用户','password-preserved')).id,uid);next.wardrobe(uid,{hero:'grok',skin:'dawn',buy:true});}finally{next.close();}
    await copyLegacySave(source,dest);
    const original=new Store(source),updated=new Store(dest);
    try{assert.equal(original.user(uid).progress.wallet,30);assert.equal(updated.user(uid).progress.wallet,12);}finally{original.close();updated.close();}
  }finally{for(const name of fs.readdirSync(folder))fs.unlinkSync(path.join(folder,name));fs.rmdirSync(folder);}
});

test('old growth counts recorded hard victories once, preserves existing tiers and settles an interrupted fifth win',async t=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'duel-hard-wins-')),file=path.join(folder,'arena.sqlite');
  let db=new Store(file);
  t.after(()=>{db.close();fs.rmSync(folder,{recursive:true,force:true});});
  const low=await db.authenticate('register','旧试炼档','legacy-purse-test'),veteran=await db.authenticate('register','旧晋阶档','legacy-purse-test');
  Object.assign(low.progress,{mastery:31,basePower:69,soloWins:12,wallet:17});
  Object.assign(veteran.progress,{mastery:433,basePower:71,equipped:{claude:'extra'},wallet:12});
  for(const u of [low,veteran]){
    for(const key of ['hardWins','formRank','hardOpponents','avatars','avatar','series'])delete u.progress[key];
    db.writeGrowth(u.id,u.progress);
  }
  const insert=db.db.prepare('INSERT INTO trials(id,uid,ticket,result) VALUES(?,?,?,?)');
  const archived={won:true,delta:1,power:78,growth:4,tier:'Low'};
  for(const [i,[level,result]] of [
    ['hard',archived],['hard',archived],['hard',archived],['hard',archived],
    ['easy',archived],['normal',archived],['hard',{won:false}],['hard',{cancelled:true}],[null,archived]
  ].entries())insert.run('history-'+i,low.id,JSON.stringify({level}),JSON.stringify(result));
  const pending=db.beginSolo(low.id,{hero:'claude',opponent:'deepseek',opening:false,level:'hard'}).ticket;
  assert.equal(db.user(low.id).progress.wallet,14);
  db.close();db=new Store(file);
  assert.equal(db.growth(low.id).hardWins,4);assert.equal(db.growth(low.id).wallet,17);assert.equal(P.power(db.growth(low.id)),100);
  assert.equal(db.growth(veteran.id).hardWins,0);assert.equal(P.skinFor(db.growth(veteran.id),'claude'),'extra');assert.equal(db.growth(veteran.id).wallet,12);
  assert.deepEqual((await db.verifySolo(low.id,{id:'history-0'})).result,archived);
  db.transaction(()=>{db.start('old-room','ABC456',[low.id,veteran.id]);db.finish('old-room',0,'ko',[2,0],[low.id,veteran.id],['claude','claude']);});
  assert.equal(db.growth(low.id).hardWins,4);assert.equal(P.power(db.growth(low.id)),100);
  const completed=db.transaction(()=>db.endSolo(low.id,{id:pending.id},false,true));
  assert.equal(completed.result.hardWins,5);assert.equal(completed.result.tier,'Medium');assert.equal(completed.result.power,122);
  assert.equal(completed.user.progress.wallet,28);
  db.close();db=new Store(file);
  assert.deepEqual(await db.verifySolo(low.id,{id:pending.id}),completed);
  assert.equal((await db.authenticate('login',veteran.name,'legacy-purse-test')).progress.hardWins,0);
  assert.equal(P.power(db.growth(veteran.id)),504);
});
