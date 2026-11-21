'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {performance}=require('node:perf_hooks');
const {pipeline}=require('node:stream/promises');
const {createGzip,constants:zlibConstants}=require('node:zlib');
const {randomBytes,createHmac,timingSafeEqual}=require('node:crypto');
const {isIP}=require('node:net');
const {Store,problem,lifetime}=require('./store.cjs');
const {Rooms}=require('./rooms.cjs');
const protocol=5;

const keys={
  '/api/register':['name','password'],'/api/login':['name','password'],'/api/import-local':['archive','password'],'/api/logout':[],
  '/api/rooms':['stage','fighter'],'/api/rooms/join':['code','fighter'],
  '/api/room/select':['stage','fighter'],'/api/room/ready':['ready'],'/api/room/rematch':[],
  '/api/room/leave':[],'/api/room/input':['matchId','seq','changes'],
  '/api/skins':['hero','skin','buy'],'/api/avatar':['hero'],
  '/api/trials':['hero','opponent','level','opening','requestId','promotion'],
  '/api/trials/finish':['id','trace'],'/api/trials/abandon':['id']
};
const cookieName='arena_session';
const cookie=(token,maxAge,secure)=>cookieName+'='+token+'; HttpOnly; Path=/; SameSite=Strict; Max-Age='+maxAge+(secure?'; Secure':'');
const nativeClient=req=>req.headers['x-arena-client']==='wechat-game';
function tokenOf(req){
  if(nativeClient(req))return /^Bearer ([\w-]{43})$/.exec(req.headers.authorization||'')?.[1]||null;
  const match=(req.headers.cookie||'').match(/(?:^|;\s*)arena_session=([\w-]{43})(?:;|$)/);return match?.[1]||null;
}
function send(res,status,data){
  if(res.destroyed||res.headersSent)return;
  const json=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(json),'Cache-Control':'no-store'});res.end(json);
}
async function serveGame(req,res,html,type='text/html; charset=utf-8',ranges=false){
  const handle=await fs.promises.open(html,'r');
  try{
    // Stat the open file so a simultaneous update cannot label new bytes with the old tag.
    const stat=await handle.stat({bigint:true});
    const tag='"'+stat.size.toString(16)+'-'+stat.mtimeNs.toString(16)+'"';
    const headers={'Cache-Control':'no-cache',ETag:'W/'+tag};
    if(ranges)headers['Accept-Ranges']='bytes';
    const tags=(req.headers['if-none-match']||'').split(',').map(s=>s.trim().replace(/^W\//,''));
    if(tags.includes(tag)||tags.includes('*')){res.writeHead(304,headers);res.end();return;}
    const size=Number(stat.size);
    let start=0,end=size-1,partial=false;
    if(ranges&&req.headers.range&&!req.headers['if-range']){
      const parts=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(parts&&(parts[1]||parts[2])){
        start=parts[1]?Number(parts[1]):Math.max(0,size-Number(parts[2]));
        end=parts[1]&&parts[2]?Math.min(end,Number(parts[2])):end;
        if(start>end||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)){
          res.writeHead(416,{...headers,'Content-Range':'bytes */'+size});res.end();return;
        }
        headers['Content-Range']='bytes '+start+'-'+end+'/'+size;partial=true;
      }
    }
    res.writeHead(partial?206:200,{...headers,'Content-Type':type,'Content-Length':Math.max(0,end-start+1)});
    if(req.method==='HEAD'||!size){res.end();return;}
    try{await pipeline(handle.createReadStream({start,end}),res);}
    catch(error){if(error.code!=='ERR_STREAM_PREMATURE_CLOSE'&&error.code!=='ECONNRESET')throw error;}
  }finally{await handle.close();}
}
async function payload(req,allowed,maxLength=8192){
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw problem(415,'json','请使用 JSON 请求');
  const pieces=[];let length=0;
  for await(const chunk of req){
    length+=chunk.length;if(length>maxLength)throw problem(413,'size','请求过大');pieces.push(chunk);
  }
  let data;try{data=JSON.parse(Buffer.concat(pieces).toString('utf8'))}catch{throw problem(400,'json','JSON 数据无效')}
  if(!data||Array.isArray(data)||typeof data!=='object'||Object.keys(data).some(k=>!allowed.includes(k)))throw problem(400,'fields','请求包含不适用的字段');
  return data;
}
const clientTypes={'.webp':'image/webp','.wav':'audio/wav','.woff2':'font/woff2','.bin':'application/octet-stream'};
async function serveAsset(req,res,folder,name,type,ranges=false){
  try{
    const real=await fs.promises.realpath(path.join(folder,name));
    if(path.dirname(real)!==await fs.promises.realpath(folder))throw problem(404,'asset','未找到游戏素材。');
    await serveGame(req,res,real,type,ranges);
  }catch(error){if(error.code==='ENOENT'||error.code==='ENOTDIR')throw problem(404,'asset','未找到游戏素材。');throw error;}
}
function localAddresses(){
  const priority=name=>/vmware|vbox|hyper-v|vethernet|virtual|tap|vpn|wireguard|wsl|tun\d/i.test(name)?3:
    /wlan|wi-?fi|wireless|无线|^wl\w*$/i.test(name)?0:/ethernet|以太网|^(en|eth)\w*$/i.test(name)?1:2;
  const devices=Object.entries(os.networkInterfaces()).sort(([a],[b])=>priority(a)-priority(b));
  return [...new Set(devices.flatMap(([,v])=>v||[]).filter(v=>!v.internal&&v.family==='IPv4'&&!v.address.startsWith('169.254.')).map(v=>v.address))];
}
function config(argv){
  const p={port:8787,host:'127.0.0.1',open:false,db:path.resolve(__dirname,'../data/arena.sqlite'),
    html:path.resolve(__dirname,'../public/index.html')};
  for(let i=0;i<argv.length;i++){
    const k=argv[i];
    if(k==='--lan')p.host='0.0.0.0';
    else if(k==='--loopback-proxy')p.loopbackProxy=true;
    else if(k==='--wechat')p.wechat=true;
    else if(k==='--open')p.open=true;
    else if(k==='--no-open')p.open=false;
    else if(k==='--public-origin'&&i+1<argv.length)p.publicOrigin=publicOrigin(argv[++i]).origin;
    else if(['--port','--html','--db'].includes(k)&&i+1<argv.length){
      const v=argv[++i];if(k==='--port'){p.port=Number(v);if(!Number.isInteger(p.port)||p.port<0||p.port>65535)throw Error('端口无效');}
      else{
        p[k.slice(2)]=path.resolve(v);
        if(k==='--html')p.customHtml=!['index.html','超智能决斗.html'].includes(path.basename(v));
      }
    }else throw Error('不支持的启动参数：'+k);
  }
  return p;
}
function publicOrigin(value){
  let url;
  try{url=new URL(value);}catch{}
  if(!url||url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)
    throw Error('--public-origin 需要填写反向代理的 HTTPS 域名，例如 https://arena.example.com');
  return url;
}
function createArena(opts){
  const publicUrl=opts.publicOrigin?publicOrigin(opts.publicOrigin):null;
  fs.mkdirSync(path.dirname(opts.db),{recursive:true});const store=new Store(opts.db),rooms=new Rooms(store);
  const wildcard=opts.host==='0.0.0.0',listeners=new Map();
  const loopHosts=['localhost','127.0.0.1','[::1]'];
  const localPeer=req=>['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress);
  const webRoot=path.dirname(opts.html);
  let activation;
  const isLan=()=>wildcard||listeners.size>0;
  const addresses=()=>isLan()?localAddresses().filter(ip=>wildcard||listeners.has(ip)):[];
  function connectionInfo(){
    const port=server.address().port,others=addresses().map(a=>'http://'+a+':'+port);
    const mobileUrls=opts.wechat?[]:others.map(u=>u+'/mobile/');
    return {lan:isLan(),port,protocol,urls:['http://127.0.0.1:'+port,...others],mobileUrls,mobileUrl:mobileUrls[0]||null};
  }
  async function enablePhone(){
    if(wildcard)return connectionInfo();
    if(activation)return activation;
    activation=(async()=>{
      // Keep the loopback listener, live rooms and database intact. One extra socket per local address shares the handler.
      const port=server.address().port;
      for(const ip of localAddresses()){
        if(listeners.has(ip))continue;
        const listener=makeServer();
        try{
          await new Promise((resolve,reject)=>{
            listener.once('error',reject);listener.listen(port,ip,()=>{listener.removeListener('error',reject);resolve();});
          });
        }catch(error){
          if(['EADDRINUSE','EADDRNOTAVAIL','EACCES'].includes(error.code))continue;
          throw error;
        }
        listeners.set(ip,listener);
      }
      if(!addresses().length)throw problem(409,'lan_offline','请先让电脑连接 Wi-Fi 或网线，再点开启手机连接。');
      return connectionInfo();
    })();
    try{return await activation;}finally{activation=null;}
  }
  const limits=new Map(),streams=new Set(),replays=new Map();let hashing=0;let stopped=false;
  function limit(key,maximum,windowMs){
    const now=Date.now();let b=limits.get(key);
    if(!b||now>=b.until){b={n:0,until:now+windowMs};limits.set(key,b);}
    if(++b.n>maximum)throw problem(429,'rate','请求过于频繁，请稍后再试');
  }
  function unlink(token){for(const s of streams)if(s.token===token)s.end();}
  function verifyHost(req){
    if(publicUrl&&req.headers.host?.toLowerCase()===publicUrl.host)return publicUrl;
    let url;try{url=new URL('http://'+req.headers.host)}catch{}
    if(!url||url.username||url.password||url.pathname!=='/'||
       !(loopHosts.includes(url.hostname)||isLan()&&(url.hostname===os.hostname().toLowerCase()||url.hostname===req.socket.localAddress)))
      throw problem(403,'host','请使用服务窗口显示的本机或局域网地址');
    return url;
  }
  function stream(req,res,user,token){
    if((rooms.peers.get(user.id)?.size||0)>=6||streams.size>=512)throw problem(429,'streams','打开的对局窗口过多');
    const compress=opts.compressedStreams && /\bgzip\b/.test(req.headers['accept-encoding']||'');
    const output=compress?createGzip({level:1,flush:zlibConstants.Z_SYNC_FLUSH}):res;
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no',...(compress?{'Content-Encoding':'gzip',Vary:'Accept-Encoding'}:{})});
    res.flushHeaders();
    if(compress){output.on('error',error=>res.destroy(error));output.pipe(res);}
    output.write('retry: 1200\n\n');
    const peer={token,matchId:null,seen:0,end:()=>output.end(),
      send(data,id){
        if(res.destroyed||res.writableEnded)return false;
        if(res.writableLength>1048576){res.destroy();return false;}
        if(data.type==='frame'&&(res.writableNeedDrain||output.writableNeedDrain))return false;
        output.write((id?'id: '+id+'\n':'')+'data: '+JSON.stringify(data)+'\n\n');return true;
      },ping(){if(!res.destroyed&&!output.writableEnded)output.write(': keepalive\n\n');}};
    streams.add(peer);
    res.once('close',()=>{if(compress)output.destroy();streams.delete(peer);if(!stopped)rooms.unsubscribe(user.id,peer);});
    rooms.subscribe(user.id,peer,req.headers['last-event-id']);
  }
  async function handle(req,res){
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    try{
      const origin=verifyHost(req),url=new URL(req.url,origin),route=url.pathname;
      if(req.method==='GET'||req.method==='HEAD'){
        if(route==='/'||route==='/index.html'||route==='/offline.html'){
          await serveGame(req,res,opts.html);return;
        }
        if(/^\/(?:mobile|pc)\/?(?:index\.html)?$/.test(route)){
          res.writeHead(302,{Location:'/'+url.search});res.end();return;
        }
        const match=/^\/(assets|js|css)\/([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)$/.exec(route);
        const types={assets:clientTypes,js:{'.js':'text/javascript; charset=utf-8'},css:{'.css':'text/css; charset=utf-8'}};
        if(match){
          const type=types[match[1]][path.extname(match[2])];
          if(type){await serveAsset(req,res,path.join(webRoot,match[1]),match[2],type,match[1]==='assets');return;}
        }
      }
      if(route==='/favicon.ico'){res.writeHead(204);res.end();return;}
      if(!route.startsWith('/api/'))throw problem(404,'route','页面不存在');
      const token=tokenOf(req),user=store.session(token),auth=()=>{if(!user)throw problem(401,'auth','请先登录账号');return user.id;};
      if(req.method==='GET'){
        if(route==='/api/launcher'&&opts.launchKey&&localPeer(req)&&origin!==publicUrl&&loopHosts.includes(origin.hostname)){
          const challenge=url.searchParams.get('challenge');
          if(!/^[a-f0-9]{32}$/.test(challenge||''))throw problem(400,'challenge','启动校验无效');
          const lan=isLan();send(res,200,{lan,protocol,phoneSupport:true,publicOrigin:publicUrl?.origin,proof:launcherProof(opts.launchKey,challenge,lan)});return;
        }
        if(route==='/api/server'){
          const info=origin===publicUrl?{protocol,urls:[publicUrl.origin],mobileUrl:publicUrl.origin+'/mobile/'}:connectionInfo();
          if(opts.guestOnly)info.guestOnly=true;
          send(res,200,info);return;
        }
        if(route==='/api/me'){send(res,200,{user,room:user?rooms.public(rooms.room(user.id),user.id):null});return;}
        if(route==='/api/leaderboard'){send(res,200,{players:store.leaderboard(),me:user?store.rank(user.id):null});return;}
        if(route==='/api/room'){const uid=auth();send(res,200,{room:rooms.public(rooms.room(uid),uid)});return;}
        if(route==='/api/room/stream'){auth();stream(req,res,user,token);return;}
        throw problem(404,'route','接口不存在');
      }
      if(req.method!=='POST')throw problem(405,'method','请求方式不支持');
      const wxOrigin=nativeClient(req)&&req.headers.origin==='https://servicewechat.com';
      if(req.headers.origin&&req.headers.origin!==origin.origin&&!wxOrigin)throw problem(403,'origin','请从同一游戏地址发起操作');
      if(req.headers['sec-fetch-site']==='cross-site'&&!wxOrigin)throw problem(403,'origin','请从游戏页面发起操作');
      if(opts.guestOnly){
        if(['/api/register','/api/login','/api/import-local'].includes(route))throw problem(404,'route','接口不存在');
        if(route==='/api/guest'){
          await payload(req,[],128);
          if(user){send(res,200,{user,room:rooms.public(rooms.room(user.id),user.id),session:nativeClient(req)?token:undefined});return;}
          limit('guests',60,60000);
          const guest=store.createGuest(),day=86400000,fresh=store.issue(guest.id,day);
          res.setHeader('Set-Cookie',cookie(fresh,day/1000,true));
          send(res,200,{user:guest,room:null,session:nativeClient(req)?fresh:undefined});return;
        }
      }
      if(route==='/api/phone/open'){
        const browser=req.headers.origin===origin.origin&&req.headers['x-arena-local']==='phone';
        const supplied=req.headers['x-arena-launcher']||'';
        const signed=opts.launchKey&&/^[a-f0-9]{64}$/.test(supplied)&&
          timingSafeEqual(Buffer.from(supplied,'hex'),Buffer.from(launcherProof(opts.launchKey,'open-phone',true),'hex'));
        if(!localPeer(req)||origin===publicUrl||!loopHosts.includes(origin.hostname)||!(browser||signed))throw problem(403,'host','请从房主电脑的本机游戏页面开启手机连接。');
        await payload(req,[]);send(res,200,await enablePhone());return;
      }
      if(!Object.hasOwn(keys,route))throw problem(404,'route','接口不存在');
      if(req.headers['x-arena-account']!==undefined&&String(user?.id)!==req.headers['x-arena-account'])
        throw problem(409,'account_changed','此浏览器已切换账号，请核对当前玩家后再操作。');
      if(!['/api/register','/api/login','/api/import-local','/api/logout'].includes(route))auth();
      const data=await payload(req,keys[route],route==='/api/trials/finish'?524288:8192);
      if(route==='/api/register'||route==='/api/login'||route==='/api/import-local'){
        const forwarded=req.headers['x-forwarded-for'];
        const trusted=opts.loopbackProxy&&origin===publicUrl&&localPeer(req)&&typeof forwarded==='string'&&isIP(forwarded);
        const ip=trusted?forwarded:req.socket.remoteAddress||'local';
        limit('auth:'+ip,60,60000);
        limit('name:'+ip+':'+String(data.name).normalize('NFKC').trim().toLowerCase(),14,300000);
        if(hashing>=8)throw problem(429,'busy','登录服务繁忙，请稍后重试');
        hashing++;let account;try{
          account=route==='/api/import-local'?await store.importLocal(user?.id,data.archive,data.password):await store.authenticate(route.slice(5),data.name,data.password);
        }finally{hashing--;}
        if(token){store.revoke(token);unlink(token);}
        const fresh=store.issue(account.id);res.setHeader('Set-Cookie',cookie(fresh,lifetime/1000,origin===publicUrl||Boolean(req.socket.encrypted)));
        const session=nativeClient(req)?fresh:undefined;
        send(res,200,{user:account,room:rooms.public(rooms.room(account.id),account.id),session});return;
      }
      if(route==='/api/logout'){
        store.revoke(token);if(token)unlink(token);res.setHeader('Set-Cookie',cookie('',0,origin===publicUrl||Boolean(req.socket.encrypted)));send(res,200,{ok:true});return;
      }
      const uid=auth();
      limit('actions:'+uid,route==='/api/room/input'?200:120,1000);
      if(route==='/api/avatar'){
        const user=store.setAvatar(uid,data.hero);
        send(res,200,{user});rooms.accountUpdate(user);
        const room=rooms.room(uid);if(room)rooms.roomUpdate(room);return;
      }
      if(route==='/api/skins'){
        const room=rooms.room(uid);
        if(room&&(room.phase==='playing'||room.phase==='lobby'&&room.players.find(p=>p?.uid===uid)?.ready))throw problem(409,'playing','取消准备或完成本场比赛后可换装。');
        const user=store.wardrobe(uid,data);
        send(res,200,{user});rooms.accountUpdate(user);if(room)rooms.roomUpdate(room);return;
      }
      if(route==='/api/trials'){
        if(rooms.room(uid))throw problem(409,'in_room','请先离开联机房间再开始单人试炼。');
        const result=store.beginSolo(uid,data,req.headers['x-arena-intro']==='ticket');
        send(res,200,result);rooms.accountUpdate(result.user);return;
      }
      if(route==='/api/trials/finish'||route==='/api/trials/abandon'){
        if(typeof data.id!=='string'||data.id.length>64)throw problem(400,'trial','试炼编号无效。');
        limit('settle:'+uid,12,60000);
        let result;
        if(route.endsWith('abandon'))result=store.transaction(()=>store.endSolo(uid,data,true));
        else{
          const running=replays.get(uid);
          if(running&&running.id!==data.id)throw problem(409,'settling','上一场试炼正在结算。');
          if(!running&&replays.size>=4)throw problem(429,'busy','房主正在核对其他对局，请稍后重试。');
          const task=running?.task||store.verifySolo(uid,data);
          if(!running)replays.set(uid,{id:data.id,task});
          try{result=await task;}finally{if(replays.get(uid)?.task===task)replays.delete(uid);}
        }
        send(res,200,result);rooms.accountUpdate(result.user);return;
      }
      if(route==='/api/room/input'){send(res,200,rooms.input(uid,data));return;}
      let room;
      switch(route){
        case '/api/rooms':room=rooms.create(uid,data);break;
        case '/api/rooms/join':room=rooms.join(uid,data);break;
        case '/api/room/select':room=rooms.select(uid,data);break;
        case '/api/room/ready':room=rooms.ready(uid,data.ready);break;
        case '/api/room/rematch':room=rooms.rematch(uid);break;
        case '/api/room/leave':room=rooms.leave(uid);break;
      }
      send(res,200,{room:rooms.public(room,uid)});
    }catch(e){
      if(!e.status)console.error(e);
      if(!res.headersSent)send(res,e.status||500,{error:e.status?e.message:'服务暂时无法完成请求',code:e.code&&e.status?e.code:'server'});
      else if(!res.writableEnded)res.destroy();
    }
  }
  function makeServer(){
    const listener=http.createServer(handle);
    listener.headersTimeout=15000;listener.requestTimeout=20000;listener.keepAliveTimeout=5000;
    return listener;
  }
  const server=makeServer();
  let last=performance.now(),broadcast=last;
  const clock=setInterval(()=>{
    const now=performance.now(),dt=Math.min(.25,(now-last)/1000);last=now;
    const deliver=now-broadcast>=1000/24;
    if(deliver)broadcast=now-(now-broadcast)%(1000/24);
    rooms.advance(dt,Date.now(),deliver);
  },1000/120);
  const heartbeat=setInterval(()=>{
    for(const p of streams){if(!store.session(p.token))p.end();else p.ping();}
    const now=Date.now();for(const [key,b] of limits)if(b.until<=now)limits.delete(key);
    store.db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);
  },15000);
  const stop=()=>new Promise(resolve=>{
    if(stopped){resolve();return;}stopped=true;clearInterval(clock);clearInterval(heartbeat);
    for(const r of rooms.byCode.values())rooms.save(r);
    for(const p of streams)p.end();
    (async()=>{
      await Promise.allSettled([activation]);
      await Promise.all([server,...listeners.values()].map(s=>new Promise(done=>{s.close(done);s.closeAllConnections();})));
      await Promise.allSettled([...replays.values()].map(x=>x.task));store.close();resolve();
    })();
  });
  return {server,store,rooms,stop,connectionInfo};
}
function launcherProof(key,challenge,lan){return createHmac('sha256',key).update(challenge+' '+lan).digest('hex');}
async function existingHost(file){
  let record;
  try{record=JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){
    if(error.code==='ENOENT'||error instanceof SyntaxError)return null;
    throw error;
  }
  if(!Number.isInteger(record.port)||record.port<1||record.port>65535||!/^[a-f0-9]{64}$/.test(record.key))return null;
  const address='http://127.0.0.1:'+record.port,challenge=randomBytes(16).toString('hex');
  try{
    const response=await fetch(address+'/api/launcher?challenge='+challenge,{redirect:'error',signal:AbortSignal.timeout(500)});
    if(!response.ok)return null;
    const reply=await response.json();
    return reply.proof===launcherProof(record.key,challenge,reply.lan)?{address,lan:reply.lan,html:record.html,protocol:reply.protocol,
      phoneSupport:reply.phoneSupport,publicOrigin:reply.publicOrigin,openProof:launcherProof(record.key,'open-phone',true)}:null;
  }catch{return null;}
}
function openGame(url,enabled){
  if(enabled&&process.platform==='win32')require('node:child_process').spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],
    {detached:true,stdio:'ignore',windowsHide:true}).unref();
}
async function reuse(host,opts){
  if(!host)return false;
  if(host.protocol!==protocol)throw Error('旧版账号服务仍在运行。请在旧服务窗口按 Ctrl+C，再运行新版 npm start 或 npm run lan，原账号会接续。');
  if(host.html!==opts.html)throw Error('此存档正由另一份游戏页面使用：'+host.address+'。请在原窗口按 Ctrl+C 结束服务后再启动这份游戏。');
  if(opts.publicOrigin&&host.publicOrigin!==opts.publicOrigin)throw Error('请先结束当前服务，再以指定的 HTTPS 域名启动。');
  if(!host.phoneSupport)throw Error('升级手机功能需要重开旧服务。请在旧游戏窗口按 Ctrl+C，再双击新版启动器。账号和 Token 余额会保留。');
  if(opts.host==='0.0.0.0'){
    const answer=await fetch(host.address+'/api/phone/open',{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),
      headers:{'Content-Type':'application/json','X-Arena-Launcher':host.openProof},body:'{}'});
    const settings=await answer.json();
    if(!answer.ok)throw Error(settings.error||'手机连接未能开启。');
    if(settings.mobileUrl)console.log('同一 Wi-Fi 手机打开　'+settings.mobileUrl);
  }
  console.log('正在打开已运行的超智能决斗　'+host.address);
  openGame(host.address,opts.open);return true;
}
async function copyLegacySave(source,dest){
  if(source===dest||fs.existsSync(dest)||!fs.existsSync(source))return;
  if(await existingHost(source+'.host.json'))throw Error('旧版联机大厅仍在运行。请先在旧服务窗口按 Ctrl+C，再启动新版以接续账号。');
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  const pending=dest+'.import-'+randomBytes(8).toString('hex');
  const {DatabaseSync,backup}=require('node:sqlite');
  const db=new DatabaseSync(source,{readOnly:true});
  try{
    await backup(db,pending);
    try{
      // Publish a complete snapshot only if no other launcher has already installed it.
      try{fs.linkSync(pending,dest);}
      catch(error){if(!['ENOSYS','ENOTSUP','EPERM'].includes(error.code))throw error;fs.copyFileSync(pending,dest,fs.constants.COPYFILE_EXCL);}
    }catch(error){if(error.code!=='EEXIST')throw error;}
  }finally{db.close();fs.rmSync(pending,{force:true});}
}
async function main(){
  const opts=config(process.argv.slice(2));
  if(!fs.existsSync(opts.html))throw Error('找不到游戏文件：'+opts.html);
  opts.html=fs.realpathSync.native(opts.html);
  opts.launchKey=randomBytes(32).toString('hex');
  const info=opts.db+'.host.json';
  if(await reuse(await existingHost(info),opts))return;
  let app;
  try{app=createArena(opts);}catch(error){
    if(error.code!=='arena_locked')throw error;
    // A second double-click can precede the first listener by a few milliseconds.
    for(let retry=0;retry<4;retry++){
      await new Promise(resolve=>setTimeout(resolve,100));
      if(await reuse(await existingHost(info),opts))return;
    }
    throw error;
  }
  try{
    await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(opts.port,opts.host,resolve);});
    const port=app.server.address().port,address='http://127.0.0.1:'+port;
    const staging=info+'.'+process.pid+'.tmp';
    fs.writeFileSync(staging,JSON.stringify({port,key:opts.launchKey,html:opts.html,pid:process.pid}),{mode:0o600});
    fs.renameSync(staging,info);
    console.log('超智能决斗　'+address);
    const phone=app.connectionInfo();
    if(opts.wechat&&phone.urls[1])console.log('微信小游戏联机地址　'+phone.urls[1]);
    if(phone.mobileUrl)console.log('同一 Wi-Fi 手机打开　'+phone.mobileUrl);
    console.log('账号和 Token 余额保存到 '+opts.db+'。按 Ctrl+C 结束服务。');
    openGame(address,opts.open);
  }catch(error){
    await app.stop();
    if(error.code==='EADDRINUSE')throw Error('端口已被占用。可指定 --port 8788 启动。');
    throw error;
  }
  const shutdown=async()=>{fs.rmSync(info,{force:true});await app.stop();};
  for(const signal of process.platform==='win32'?['SIGINT','SIGTERM','SIGBREAK']:['SIGINT','SIGTERM'])process.once(signal,shutdown);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={createArena,config,copyLegacySave};
