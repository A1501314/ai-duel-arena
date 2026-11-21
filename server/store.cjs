'use strict';
const {DatabaseSync}=require('node:sqlite');
const {randomBytes,randomUUID,randomInt,createHash,createDecipheriv,pbkdf2,scrypt,timingSafeEqual}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const local=file=>'../public/js/'+file;
const Progress=require(local('progression.js')),CPU=require(local('cpu.js'));
const indexFile=path.join(__dirname,'voice-index.json');
const {promisify}=require('node:util');
const derive=promisify(scrypt);
const lifetime=14*86400000;
const fingerprint=text=>createHash('sha256').update(text).digest('hex');
const userFields='id,name,points,wins,losses';
const rankedPlayers=`SELECT u.id,u.name,u.points,u.wins,u.losses,json_extract(g.profile,'$.avatar') AS avatar,
  RANK() OVER (ORDER BY u.points DESC,u.wins DESC) AS rank
  FROM users u JOIN growth g ON g.uid=u.id WHERE u.wins+u.losses>0`;
function rankedStake(winnerRating,loserRating){
  const upsetChance=1/(1+10**((winnerRating-loserRating)/400));
  return Math.max(4,Math.min(28,Math.round(32*upsetChance)));
}
function problem(status,code,message){return Object.assign(new Error(message),{status,code});}
function username(value){
  if(typeof value!=='string')throw problem(400,'name','请输入用户名');
  const display=value.normalize('NFKC').trim();
  if(!/^[\p{L}\p{M}\p{N}_-]{2,20}$/u.test(display))
    throw problem(400,'name','用户名可用 2 至 20 个汉字、字母、数字、下划线或短横线');
  return [display,display.toLowerCase()];
}
function password(value){
  if(typeof value!=='string'||[...value].length<8||Buffer.byteLength(value)>256)
    throw problem(400,'password','密码至少需要 8 个字符，最多 256 字节');
  return value;
}
class Store{
  constructor(file,voiceIndex=indexFile){
    this.voiceIndex=voiceIndex;
    this.db=new DatabaseSync(file);
    // One simulation must own a ledger, even when a second launcher selects another port.
    try{
      this.db.exec('PRAGMA busy_timeout=200; PRAGMA locking_mode=EXCLUSIVE; PRAGMA journal_mode=WAL; BEGIN EXCLUSIVE; COMMIT');
    }catch(error){
      this.db.close();
      if(error.errcode===5 || error.errcode===6)throw Object.assign(Error('这份存档已由另一个联机窗口打开。请使用该窗口，或为另一个服务指定单独的 --db。'),{code:'arena_locked'});
      throw error;
    }
    this.db.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,name_key TEXT NOT NULL UNIQUE,salt TEXT NOT NULL,
        secret TEXT NOT NULL,points INTEGER NOT NULL DEFAULT 0,wins INTEGER NOT NULL DEFAULT 0,losses INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,uid INTEGER NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);
      CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,code TEXT NOT NULL,p0 INTEGER NOT NULL REFERENCES users(id),
        p1 INTEGER NOT NULL REFERENCES users(id),started INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'playing',result TEXT,ended INTEGER,
        rating0 INTEGER,rating1 INTEGER);
      CREATE INDEX IF NOT EXISTS ranking ON users(points DESC,wins DESC,id);`);
    this.db.exec('CREATE TABLE IF NOT EXISTS growth(uid INTEGER PRIMARY KEY REFERENCES users(id),profile TEXT NOT NULL);'+
      'CREATE TABLE IF NOT EXISTS trials(id TEXT PRIMARY KEY,uid INTEGER NOT NULL REFERENCES users(id),ticket TEXT NOT NULL,result TEXT);'+
      'CREATE TABLE IF NOT EXISTS transfers(origin TEXT PRIMARY KEY,uid INTEGER NOT NULL UNIQUE REFERENCES users(id));'+
      'CREATE UNIQUE INDEX IF NOT EXISTS active_trial ON trials(uid) WHERE result IS NULL;'+
      "CREATE INDEX IF NOT EXISTS settled_request ON trials(uid,json_extract(ticket,'$.requestId')) WHERE result IS NOT NULL;");
    this.transaction(()=>{
      if(!this.db.prepare("SELECT 1 FROM pragma_table_info('matches') WHERE name='rating0'").get()){
        this.db.exec('ALTER TABLE matches ADD COLUMN rating0 INTEGER; ALTER TABLE matches ADD COLUMN rating1 INTEGER');
        // A player occupies only one ranked room, so its unfinished result has not changed either rating.
        this.db.exec("UPDATE matches SET rating0=(SELECT points FROM users WHERE id=matches.p0),rating1=(SELECT points FROM users WHERE id=matches.p1) WHERE status='playing'");
      }
      for(const row of this.db.prepare('SELECT * FROM users WHERE id NOT IN (SELECT uid FROM growth)').all())
        this.writeGrowth(row.id,Progress.fresh(Date.now(),row));
      const oldProfiles=this.db.prepare("SELECT uid,profile FROM growth WHERE json_type(profile,'$.formRank') IS NULL OR json_type(profile,'$.hardWins') IS NOT 'integer' OR json_extract(profile,'$.hardWins')<0").all();
      if(oldProfiles.length){
        const won=this.db.prepare("SELECT id,json_extract(ticket,'$.opponent') AS opponent,result FROM trials WHERE uid=? AND json_extract(ticket,'$.level')='hard' AND json_type(result,'$.won')='true'");
        for(const row of oldProfiles){
          const p=JSON.parse(row.profile);
          const history=won.all(row.uid).map(h=>({id:h.id,opponent:h.opponent,level:'hard',result:JSON.parse(h.result)}));
          Progress.upgrade(p,history);this.writeGrowth(row.uid,p);
        }
      }
      for(const row of this.db.prepare('SELECT id,uid,ticket FROM trials WHERE result IS NULL').all()){
        const ticket=JSON.parse(row.ticket);
        if(ticket.interrupted)continue;
        const profile=this.growth(row.uid);profile.wallet+=ticket.held;ticket.interrupted=true;
        this.writeGrowth(row.uid,profile);this.db.prepare('UPDATE trials SET ticket=? WHERE id=?').run(JSON.stringify(ticket),row.id);
      }
    });
    this.missingSalt=randomBytes(16).toString('hex');this.missing=Buffer.alloc(64);
    this.db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
  }
  async hash(value,salt){return derive(value,Buffer.from(salt,'hex'),64,{N:32768,r:8,p:1,maxmem:64*1024*1024});}
  async authenticate(action,name,value){
    const [display,key]=username(name);password(value);
    const record=this.db.prepare('SELECT * FROM users WHERE name_key=?').get(key);
    if(action==='register'){
      if(record)throw problem(409,'name_taken','这个用户名已被使用');
      const salt=randomBytes(16).toString('hex'),secret=(await this.hash(value,salt)).toString('hex');
      return this.transaction(()=>{
        const info=this.db.prepare('INSERT INTO users(name,name_key,salt,secret) VALUES(?,?,?,?) ON CONFLICT(name_key) DO NOTHING').run(display,key,salt,secret);
        if(!info.changes)throw problem(409,'name_taken','这个用户名已被使用');
        const id=Number(info.lastInsertRowid);this.writeGrowth(id,Progress.fresh());return this.user(id);
      });
    }
    const match=timingSafeEqual(await this.hash(value,record?.salt||this.missingSalt),record?Buffer.from(record.secret,'hex'):this.missing);
    if(!record||!match)throw problem(401,'credentials','用户名或密码有误');
    return this.user(record.id);
  }
  writeGrowth(uid,profile){this.db.prepare('INSERT INTO growth VALUES(?,?) ON CONFLICT(uid) DO UPDATE SET profile=excluded.profile').run(uid,JSON.stringify(profile));}
  createGuest(){
    return this.transaction(()=>{
      const name='旅人'+randomBytes(6).toString('hex');
      const result=this.db.prepare('INSERT INTO users(name,name_key,salt,secret) VALUES(?,?,?,?)')
        .run(name,name,randomBytes(16).toString('hex'),randomBytes(64).toString('hex'));
      const id=Number(result.lastInsertRowid);
      this.writeGrowth(id,Progress.fresh());return this.user(id);
    });
  }
  async importLocal(current,archive,pass){
    password(pass);
    if(!archive||archive.version!==1||!(/^[a-f0-9]{32}$/).test(archive.salt)||!(/^[a-f0-9]{24}$/).test(archive.iv)||
      typeof archive.sealed!=='string'||archive.sealed.length>8192||!(/^(?:[a-f0-9]{2}){17,}$/).test(archive.sealed))
      throw problem(400,'passport','请选择游戏导出的 .duelpass 凭证。');
    const key=await promisify(pbkdf2)(pass,Buffer.from(archive.salt,'hex'),165000,32,'sha256');
    const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(archive.iv,'hex')),data=Buffer.from(archive.sealed,'hex');
    let claim;try{
      cipher.setAuthTag(data.subarray(-16));
      claim=JSON.parse(Buffer.concat([cipher.update(data.subarray(0,-16)),cipher.final()]).toString('utf8'));
    }catch{throw problem(400,'passport','本机密码不符，或凭证文件不完整。');}
    if(!claim||typeof claim.id!=='string'||!(/^[a-f0-9-]{36}$/).test(claim.id)||!Array.isArray(claim.owned)||claim.owned.length>12)
      throw problem(400,'passport','档案内容无效。');
    const [display,nameKey]=username(claim.name);
    const existing=this.db.prepare('SELECT id FROM users WHERE name_key=?').get(nameKey);
    if(current&&existing?.id!==current)throw problem(409,'account','请退出当前账号，转入凭证中的同名档案。');
    let account;
    if(current)account=this.user(current);
    else if(existing){
      try{account=await this.authenticate('login',display,pass);}catch{throw problem(409,'account','大厅已有同名账号，请用联机密码登录该账号后再从账号页转入。');}
    }else account=await this.authenticate('register',display,pass);
    return this.transaction(()=>{
      const links=this.db.prepare('SELECT uid,origin FROM transfers WHERE uid=? OR origin=?').all(account.id,claim.id);
      if(links.length){
        if(links.length===1&&links[0].origin===claim.id&&links[0].uid===account.id)return this.user(account.id);
        throw problem(409,'transferred','该账号已转入其他本机档案。');
      }
      const p=this.growth(account.id);
      for(const item of claim.owned){
        if(typeof item!=='string'||item.length>40)throw problem(400,'passport','衣装记录无效。');
        const [hero,skin,extra]=item.split('.');
        if(extra!==undefined||!['deepseek','chatgpt','claude','gemini','grok','kimi'].includes(hero)||!['dawn','eclipse'].includes(skin))throw problem(400,'passport','衣装记录无效。');
        if(!p.owned.includes(item))p.owned.push(item);
        if(claim.equipped?.[hero]===skin)p.equipped[hero]=skin;
      }
      this.writeGrowth(account.id,p);this.db.prepare('INSERT INTO transfers VALUES(?,?)').run(claim.id,account.id);
      return this.user(account.id);
    });
  }
  growth(uid){return JSON.parse(this.db.prepare('SELECT profile FROM growth WHERE uid=?').get(uid).profile);}
  user(id){const row=this.db.prepare('SELECT '+userFields+' FROM users WHERE id=?').get(id);return row?{...row,progress:this.growth(id)}:null;}
  wardrobe(uid,data){
    return this.transaction(()=>{const p=this.growth(uid);Progress.wardrobe(p,data.hero,data.skin,data.buy);this.writeGrowth(uid,p);return this.user(uid);});
  }
  setAvatar(uid,hero){
    return this.transaction(()=>{const p=this.growth(uid);Progress.setAvatar(p,hero);this.writeGrowth(uid,p);return this.user(uid);});
  }
  openingFor(ids,skins){
    return Progress.introDurations(JSON.parse(fs.readFileSync(this.voiceIndex,'utf8')),ids,skins);
  }
  beginSolo(uid,data,currentVoice=true){
    return this.transaction(()=>{
      if(data.requestId!==undefined&&(typeof data.requestId!=='string'||!(/^[a-f0-9]{32}$/).test(data.requestId)))throw problem(400,'ticket','开局请求编号无效。');
      if(data.requestId){
        const done=this.db.prepare("SELECT result FROM trials WHERE uid=? AND json_extract(ticket,'$.requestId')=? AND result IS NOT NULL").get(uid,data.requestId);
        if(done)return {ticket:null,result:JSON.parse(done.result),user:this.user(uid)};
      }
      const active=this.db.prepare('SELECT id,ticket FROM trials WHERE uid=? AND result IS NULL').get(uid);
      if(active&&data.requestId){
        const prior=JSON.parse(active.ticket);
        if(prior.requestId===data.requestId)return {ticket:prior,user:this.user(uid)};
      }
      if(active)this.endSolo(uid,{id:active.id},true);
      const p=this.growth(uid),ticket=Progress.begin(p,data,{id:randomUUID(),seed:randomInt(0x100000000),requestId:data.requestId});
      if(ticket.opening){
        const ids=[ticket.hero,ticket.opponent];
        ticket.openingDurations=currentVoice?this.openingFor(ids,[Progress.skinFor(p,ticket.hero),ticket.promotion||'base']):
          Object.fromEntries(ids.map(id=>[id,Progress.originalIntros[id]]));
      }
      this.db.prepare('INSERT INTO trials(id,uid,ticket) VALUES(?,?,?)').run(ticket.id,uid,JSON.stringify(ticket));
      this.writeGrowth(uid,p);return {ticket,user:this.user(uid)};
    });
  }
  async verifySolo(uid,data){
    const row=this.db.prepare('SELECT ticket,result FROM trials WHERE id=? AND uid=?').get(data.id,uid);
    if(!row)throw problem(404,'no_trial','未找到此账号的试炼。');
    if(row.result)return {result:JSON.parse(row.result),user:this.user(uid)};
    const won=await Progress.replay(JSON.parse(row.ticket),data.trace,Progress.originalIntros,CPU);
    return this.transaction(()=>this.endSolo(uid,data,false,won));
  }
  endSolo(uid,data,abandon=false,won=false){
    const row=this.db.prepare('SELECT ticket,result FROM trials WHERE id=? AND uid=?').get(data.id,uid);
    if(!row)throw problem(404,'no_trial','未找到此账号的试炼。');
    if(row.result)return {result:JSON.parse(row.result),user:this.user(uid)};
    const ticket=JSON.parse(row.ticket),p=this.growth(uid);
    const result=abandon&&ticket.interrupted?{cancelled:true,delta:0,wallet:p.wallet,power:Progress.power(p),growth:0,tier:Progress.tier(p)}:Progress.soloResult(p,ticket,!abandon&&won);
    this.db.prepare('UPDATE trials SET result=? WHERE id=? AND result IS NULL').run(JSON.stringify(result),data.id);
    this.writeGrowth(uid,p);return {result,user:this.user(uid)};
  }
  issue(id,validFor=lifetime){
    const token=randomBytes(32).toString('base64url');
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(fingerprint(token),id,Date.now()+validFor);
    return token;
  }
  session(token){
    if(!token||!/^[\w-]{43}$/.test(token))return null;
    const row=this.db.prepare('SELECT uid FROM sessions WHERE token_hash=? AND expires>?').get(fingerprint(token),Date.now());
    return row?this.user(row.uid):null;
  }
  revoke(token){if(token)this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(fingerprint(token));}
  leaderboard(){
    return this.db.prepare(rankedPlayers+' ORDER BY u.points DESC,u.wins DESC,u.id LIMIT 100').all();
  }
  rank(id){return this.db.prepare('SELECT * FROM ('+rankedPlayers+') WHERE id=?').get(id)||null;}
  save(code,record){
    this.db.prepare('INSERT INTO rooms VALUES(?,?) ON CONFLICT(code) DO UPDATE SET payload=excluded.payload').run(code,JSON.stringify(record));
  }
  restore(){return this.db.prepare('SELECT payload FROM rooms').all().map(x=>JSON.parse(x.payload));}
  forget(code){this.db.prepare('DELETE FROM rooms WHERE code=?').run(code);}
  transaction(fn){
    this.db.exec('BEGIN IMMEDIATE');
    try{const v=fn();this.db.exec('COMMIT');return v;}
    catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  start(id,code,ids){
    const rating=this.db.prepare('SELECT points FROM users WHERE id=?');
    const ratings=ids.map(uid=>rating.get(uid).points);
    this.db.prepare('INSERT INTO matches(id,code,p0,p1,started,rating0,rating1) VALUES(?,?,?,?,?,?,?)').run(id,code,...ids,Date.now(),...ratings);
  }
  finish(id,winner,reason,wins,ids,fighters=['deepseek','claude'],played=true){
    const old=this.db.prepare('SELECT status,result,rating0,rating1,p0,p1 FROM matches WHERE id=?').get(id);
    if(old?.status==='finished')return JSON.parse(old.result);
    if(!old)throw Error('Missing match ledger');
    if(old.p0!==ids[0]||old.p1!==ids[1])throw Error('Match participants differ from the ledger');
    const ratings=[old.rating0,old.rating1],delta=[0,0],credits=[0,0];
    if(winner===0||winner===1){
      const profiles=ids.map(uid=>this.growth(uid)),other=1-winner;
      const stake=rankedStake(ratings[winner],ratings[other]);
      delta[winner]=played?stake:0;
      delta[other]=Math.max(-stake,-this.user(ids[other]).points)||0;
      this.db.prepare('UPDATE users SET wins=wins+?,points=points+? WHERE id=?').run(played?1:0,delta[winner],ids[winner]);
      this.db.prepare('UPDATE users SET losses=losses+1,points=points+? WHERE id=?').run(delta[other],ids[other]);
      credits[winner]=played?6:0;credits[other]=-Math.min(4,profiles[other].wallet);
      if(played)Progress.victory(profiles[winner],fighters[winner],Math.max(Progress.power(profiles[other]),Progress.basePower(fighters[other])),Progress.rankedGrowth);
      profiles.forEach((p,i)=>{p.wallet+=credits[i];this.writeGrowth(ids[i],p);});
    }
    const result={winner,reason,wins:[...wins],points:delta,ratingBefore:ratings,credits,matchId:id,players:ids.map(uid=>this.user(uid).name)};
    this.db.prepare("UPDATE matches SET status='finished',result=?,ended=? WHERE id=? AND status='playing'").run(JSON.stringify(result),Date.now(),id);
    return result;
  }
  close(){this.db.close();}
}
module.exports={Store,problem,lifetime};
