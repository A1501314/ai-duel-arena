(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const escape=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const stageName=id=>ArenaStages.list.find(s=>s.id===id)?.name||"雨夜天台";
  const button=(act,title,primary=false)=>'<button type="button" class="command'+(primary?' primary':'')+'" data-net="'+act+'">'+title+'</button>';
  function select(name,values,current,disabled=false){
    return '<select data-room-select="'+name+'" '+(disabled?'disabled':'')+'>'+values.map(([v,t])=>'<option value="'+v+'" '+(v===current?'selected':'')+'>'+escape(t)+'</option>').join('')+'</select>';
  }
  const heroName=id=>ArenaEngine.roster[id].name;
  const avatarFace=id=>'<span class="victor-face" data-hero="'+id+'"><img alt="" src="'+ArenaSkins.portrait(id,'extra')+'"></span>';
  const publicAvatar=id=>id&&Object.hasOwn(ArenaEngine.roster,id)?'<span class="public-avatar" role="img" aria-label="'+heroName(id)+' 首胜头像">'+avatarFace(id)+'</span>':'';
  const trialRules={
    base:'注册即解锁',medium:'累计赢 5 场高手试炼，可重复挑战同一对手',
    high:'升至 Medium 后，在高手试炼击败 3 位不同对手',
    extra:'5 位高手，赢 3 场',max:'5 位宗师，赢 4 场',ultra:'终末之战 · 6 位守关者，赢 5 场'
  };
  const rankedRule='开局时比较双方排位分。同分胜得 16 分、败扣 16 分，击败更强对手多得，输给更强对手少扣。每场调整 4 至 28 分，最低为 0。';
  function promotion(path){
    if(!path.next)return '已达最高等级';
    let record;
    if(path.kind==='hard')record='高手胜场 '+Math.min(path.hardWins,path.goal)+'/'+path.goal;
    else if(path.kind==='distinct')record='已胜对手 '+Math.min(path.defeated.length,path.goal)+'/'+path.goal;
    else record='晋级赛 '+(path.series?.wins||0)+'/'+path.goal+' 胜';
    const gap=path.remaining?'还差 '+path.remaining+' 力量':'力量已达标';
    return '升至 '+path.next.name+' · '+gap+' · '+record;
  }

  class RemoteMatch {
    constructor(id,network){
      this.id=id;this.network=network;this.state=null;this.events=[];this.lastEvent=0;this.positions=[];this.held=new Set();
    }
    receive(frame){
      const next=frame.state, old=this.state, same=old&&old.round===next.round;
      if(!old) this.state={};
      const fighters=next.fighters.map((src,i)=>{
        const prev=same?old.fighters[i]:null;
        const blend=prev && Math.abs(prev.x-src.x)<65 && Math.abs(prev.y-src.y)<65 && !next.paused && next.phase==='fight';
        this.positions[i]=[blend?prev.x:src.x,blend?prev.y:src.y,src.x,src.y];
        return Object.assign(prev||{},src);
      });
      Object.assign(this.state,next,{fighters,cpuSide:-1});
      this.arrived=performance.now();
      for(const e of frame.events||[]){
        if(e.seq>this.lastEvent){
          if(old || next.clock<2 || (e.type==='win'&&next.phase==='matchOver'))this.events.push(e);
          this.lastEvent=e.seq;
        }
      }
    }
    update(){
      const t=Math.min(1,(performance.now()-this.arrived)/42);
      this.state.fighters.forEach((f,i)=>{const [x,y,tx,ty]=this.positions[i];f.x=x+(tx-x)*t;f.y=y+(ty-y)*t;});
    }
    drainEvents(){return this.events.splice(0);}
    input(side,button,down){
      if(this.network.inputPaused||side!==this.network.room?.selfSide || this.held.has(button)===down)return;
      if(down)this.held.add(button);else this.held.delete(button);
      this.network.changeInput(button,down);
    }
    clearInput(){for(const key of [...this.held])this.input(this.network.room?.selfSide,key,false);}
    pause(){/* The host clock is authoritative. */}
  }

  class ArenaNetwork {
    constructor(hooks){
      this.hooks=hooks;this.dialog=$("guild");this.body=$("guild-body");this.notice=$("guild-status");
      this.room=null;this.user=null;this.remote=null;this.tab='rooms';this.auth='login';
      this.skinHero=null;this.previewForm=null;this.local=null;this.ready=null;
      this.stream=null;this.changes=[];this.sequence=0;this.sending=false;this.connection='';this.busy=false;
      this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close();});
      this.dialog.addEventListener('click',e=>{
        if(e.target!==this.dialog)return;
        const rect=this.dialog.getBoundingClientRect();
        if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)this.close();
      });
      document.addEventListener('click',e=>{
        const avatar=e.target.closest('[data-avatar-id]');
        if(avatar){this.previewAvatar=avatar.dataset.avatarId;this.render();this.body.querySelector('[data-avatar-id="'+this.previewAvatar+'"]')?.focus({preventScroll:true});return;}
        const preview=e.target.closest('[data-preview-form]');
        if(preview){
          this.previewForm=preview.dataset.previewForm;this.render();
          this.body.querySelector('[data-preview-form="'+this.previewForm+'"]')?.focus({preventScroll:true});
          void this.hooks.previewTier(this.skinHero,this.previewForm);
          return;
        }
        const choice=e.target.closest('[data-skin-action]');
        if(choice){this.chooseSkin(choice).catch(err=>this.message(err.message));return;}
        const b=e.target.closest('[data-net]');if(!b)return;
        this.act(b.dataset.net).catch(err=>this.message(err.message));
      });
      this.body.addEventListener('submit',e=>{
        e.preventDefault();this.submit(e.target).catch(err=>this.message(err.message));
      });
      this.body.addEventListener('change',e=>{
        if(e.target.matches('[data-skin-hero]')){
          this.skinHero=e.target.value;this.render();
          this.body.querySelector('[data-skin-hero]').focus({preventScroll:true});
          const chosen=this.body.querySelector('[data-preview-form][aria-pressed="true"]');
          if(chosen)void this.hooks.previewTier(this.skinHero,chosen.dataset.previewForm);
          return;
        }
        const field=e.target.dataset.roomSelect;
        if(field)this.mutate('/room/select',{[field]:e.target.value}).catch(err=>{this.render();this.message(err.message);});
      });
      window.addEventListener('storage',e=>{
        if(e.key!=='neural-clash:account-change'&&e.key!==this.local?.sessionKey)return;
        this.refreshAccount().catch(err=>this.message(err.message));
      });
    }
    async refreshAccount(){
      if(!this.server&&!this.local)return;
      const me=await this.api('/me');this.identity(me);if(this.dialog.open)this.render();
    }
    notifyAccount(){try{localStorage.setItem('neural-clash:account-change',Date.now()+'-'+Math.random());}catch{/* Local storage may be disabled in a server session. */}}
    async api(path,body){
      const expected=body&&this.user&&!['/login','/register'].includes(path)?this.user.id:null;
      if(this.local){
        try{return await this.local.call(path,body,expected);}catch(error){if(error.code==='account_changed')await this.refreshAccount();throw error;}
      }
      const headers=body===undefined?{}:{'Content-Type':'application/json'};
      if(path==='/trials')headers['X-Arena-Intro']='ticket';
      if(expected!=null)headers['X-Arena-Account']=String(expected);
      const response=await fetch('/api'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',
        cache:'no-store',headers,body:body===undefined?undefined:JSON.stringify(body)});
      if(!response.headers.get('Content-Type')?.includes('application/json'))throw Object.assign(new Error('此地址没有提供联机账号服务。'),{code:'no_service',status:response.status});
      const data=await response.json();
      if(!response.ok){const error=new Error(data.error||'服务暂时不可用，请重试。');error.status=response.status;error.code=data.code;if(error.code==='account_changed')await this.refreshAccount();throw error;}
      return data;
    }
    init(){return this.ready||=this.initialize();}
    async initialize(){
      if(location.protocol==='file:'||location.hostname.endsWith('.github.io'))return this.openLocalAccounts();
      try{
        const [server,me]=await Promise.all([this.api('/server'),this.api('/me')]);
        if(server.protocol!==5){this.olderServer=true;if(this.dialog.open)this.render();return;}
        this.server=server;this.identity(me);
        if(this.dialog.open)this.open(this.tab);
      }catch(error){
        this.server=null;
        if(window.isSecureContext&&error.code==='no_service'&&[200,404,405].includes(error.status))return this.openLocalAccounts();
        this.initError=error.message;if(this.dialog.open)this.render();
      }
    }
    async openLocalAccounts(){
      this.local=new ArenaLocalAccounts();
      try{await this.local.db;this.identity(await this.api('/me'));}
      catch(error){this.local=null;this.initError=error.message;}
      if(this.dialog.open)this.render();
    }
    identity(me){
      if(this.user?.id!==me.user?.id){this.stream?.close();this.stream=null;this.previewAvatar=null;}
      this.updateUser(me.user);this.setRoom(me.room);
      if(this.user&&this.server&&!this.stream)this.connect();
    }
    updateUser(user){
      this.user=user;
      $('guild-user').innerHTML=this.user?(this.user.progress.avatar?avatarFace(this.user.progress.avatar):'')+escape(this.user.name):'登录 / 注册';
      $('session-mode').textContent=this.user?(this.local?'本机档案':'已登录')+' · '+this.user.name+' · '+this.user.progress.wallet+' Token':'本地对战';
      const p=this.user?.progress;
      if(p){
        const points=ArenaProgress.power(p),path=ArenaProgress.path(p),{current,next}=path;
        const progress='<span class="standing-next"><span>'+promotion(path)+'</span>'+
          (next?'<progress aria-label="升至 '+next.name+' 的力量进度" max="'+next.min+'" value="'+Math.min(points,next.min)+'"></progress>':'')+'</span>';
        $('standing-values').innerHTML='<span>等级 <strong>'+current.name+'</strong></span><span>力量 <b>'+points+'</b></span><span>Token <b>'+p.wallet+'</b></span>'+progress;
      }else{
        $('standing-values').innerHTML='<strong>游客练习</strong><span>登录后记录等级、力量和 Token</span>';
      }
      $('standing-account').textContent=this.user?'晋级详情':'登录 / 注册';
      window.dispatchEvent(new Event('arena-wardrobe'));
    }
    updateCurrent(user){if(user&&user.id===this.user?.id)this.updateUser(user);}
    skinFor(hero){return ArenaProgress.skinFor(this.user?.progress,hero);}
    async chooseSkin(btn){
      if(this.busy)return;
      this.busy=true;
      try{
        const data={hero:this.skinHero,skin:btn.dataset.skinAction,buy:btn.dataset.purchase==='true'};
        const reply=await this.api('/skins',data);
        this.updateCurrent(reply.user);if(this.local)this.notifyAccount();this.render();
        this.message(data.buy?'已永久解锁并穿戴。':'已穿戴。');
      }finally{this.busy=false;}
    }
    async beginSolo(hero,opponent,level,opening,promotion=false){
      await this.init();if(!this.user)return null;
      await this.retryReceipt();
      const params={hero,opponent,level,opening,...(promotion?{promotion:true}:{})},signature=JSON.stringify([this.user.id,params]),key='neural-clash:opening-trial:'+this.user.id;
      if(!this.pendingStart)try{this.pendingStart=JSON.parse(sessionStorage.getItem(key));}catch{/* A ticket can also be retried in memory. */}
      if(this.pendingStart?.signature!==signature){
        const requestId=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
        this.pendingStart={signature,requestId};
      }
      try{sessionStorage.setItem(key,JSON.stringify(this.pendingStart));}catch{/* Some embedded browsers disable session storage. */}
      const reply=await this.api('/trials',{...params,requestId:this.pendingStart.requestId});
      this.pendingStart=null;
      try{sessionStorage.removeItem(key);}catch{}
      if(this.user?.id!==reply.user.id)throw new Error('账号已切换，请重新开始本账号的试炼。');
      this.updateCurrent(reply.user);if(this.local)this.notifyAccount();
      if(!reply.ticket)throw new Error('这场对决已结算，请按当前赛程重新进入。');
      return reply.ticket;
    }
    trackSolo(match,cpu,ticket){
      const driver=ArenaProgress.driver(match,cpu,ticket);driver.account=this.user.id;return this.activeDriver=driver;
    }
    receiptKey(){return 'neural-clash:trial-receipt:'+this.user.id;}
    async retryReceipt(){
      const key=this.receiptKey();let json;
      try{json=localStorage.getItem(key);}catch{return;}
      if(!json)return;
      let reply;
      try{reply=await this.api('/trials/finish',JSON.parse(json));}catch(error){
        if(error.status===400||error.status===404)try{localStorage.removeItem(key);}catch{}
        throw error;
      }
      try{localStorage.removeItem(key);}catch{}this.updateCurrent(reply.user);if(this.local)this.notifyAccount();
    }
    async finishSolo(driver){
      if(!driver)return '';
      if(driver.account!==this.user?.id)throw new Error('请登录开局时的账号结算这场试炼。');
      if(driver.match.state.phase!=='matchOver')throw new Error('整场试炼结束后结算 Token。');
      if(driver.receipt)return driver.receipt;
      if(driver.sending)return driver.sending;
      driver.sending=(async()=>{
        const data=this.local?{id:driver.ticket.id,won:driver.match.state.winner===0}:{id:driver.ticket.id,trace:driver.trace()};
        const key=this.receiptKey();
        try{localStorage.setItem(key,JSON.stringify(data));}catch{/* The live match still retains its receipt. */}
        const reply=await this.api('/trials/finish',data);
        try{localStorage.removeItem(key);}catch{}this.updateCurrent(reply.user);if(this.local)this.notifyAccount();
        const r=reply.result;
        const path=ArenaProgress.path(reply.user.progress),parts=[];
        if(r.promoted)parts.push('晋升 '+ArenaProgress.forms.find(f=>f.id===r.promoted).name+' · 六位角色的新形态已解锁');
        if(r.avatar)parts.push('首胜奖励 · '+heroName(r.avatar)+' 纪念头像');
        if(r.seriesStatus==='active'&&path.series&&path.next?.id===driver.ticket.promotion)parts.push('本轮 '+path.series.wins+' 胜 '+path.series.losses+' 负 · 下一位 '+heroName(path.nextOpponent));
        if(r.seriesStatus==='failed')parts.push('本轮晋级结束，保留当前等级，可立即重试');
        parts.push((driver.ticket.recovery?'返场试炼 · ':'')+'Token '+(r.delta>0?'+':'')+r.delta+'　余额 '+r.wallet+'　'+r.tier+' · 力量 '+r.power+(r.growth?'（+'+r.growth+'）':''));
        if(!r.seriesStatus&&driver.ticket.level==='hard'&&path.next)parts.push(promotion(path));
        driver.report=r;driver.receipt=parts.join('\n');
        return driver.receipt;
      })();
      try{return await driver.sending;}finally{driver.sending=null;}
    }
    async abandonSolo(driver){
      if(!driver||driver.account!==this.user?.id||driver.receipt)return;
      if(driver.match.state.phase==='matchOver')return this.finishSolo(driver);
      const reply=await this.api('/trials/abandon',{id:driver.ticket.id});this.updateCurrent(reply.user);
      if(this.local)this.notifyAccount();
      if(this.activeDriver===driver)this.activeDriver=null;
    }
    connect(){
      const stream=this.stream=new EventSource('/api/room/stream'),owner=this.user.id;
      const current=()=>this.stream===stream&&this.user?.id===owner;
      this.stream.onopen=()=>{if(current()){this.connection='';this.hooks.connection('');}};
      this.stream.onerror=()=>{if(!current())return;this.suspendInput();this.connection='连接中断，正在重连…';this.hooks.connection(this.connection);if(this.dialog.open)this.message(this.connection);};
      this.stream.onmessage=e=>{
        if(!current())return;
        const data=JSON.parse(e.data);
        if(data.type==='account'){
          this.updateCurrent(data.user);
          if(this.dialog.open&&(this.tab==='skins'||this.tab==='account'&&!this.body.querySelector('details[open]')))this.render();
          return;
        }
        if(data.type==='room'){this.setRoom(data.room);return;}
        if(data.type!=='frame'||!this.room||data.matchId!==this.room.matchId)return;
        if(!this.remote||this.remote.id!==data.matchId)this.remote=new RemoteMatch(data.matchId,this);
        if(data.state.paused)this.suspendInput();
        else if(this.inputPaused){
          this.sequence=data.inputSeq||0;this.inputPaused=false;
        }else this.sequence=Math.max(this.sequence,data.inputSeq||0);
        const first=!this.remote.state;this.remote.receive(data);
        if(first&&this.room.phase==='playing'){this.close();this.hooks.battle(this.remote,this.room);}
      };
    }
    setRoom(next){
      const prev=this.room;
      if(prev?.matchId!==next?.matchId||!next){
        this.remote=null;this.sequence=next?.inputSeq||0;this.changes=[];this.inputPaused=false;this.generation=(this.generation||0)+1;
      }
      this.room=next||null;
      const self=next?.players[next.selfSide];
      if(self&&self.id===this.user?.id&&self.progress)this.updateCurrent({...this.user,...self});
      if((prev?.phase==='playing'||prev?.phase==='finished')&&(!next||next.phase==='lobby'))this.hooks.exit();
      if(this.dialog.open&&this.tab==='rooms')this.render();
      if(next?.phase==='finished'&&prev?.phase!=='finished'){
        this.hooks.finished(next.result);
        if(!this.hooks.inBattle()&&!this.dialog.open)this.open('rooms');
      }
      const waiting=next?.phase==='playing'&&next.players.some(p=>p&&!p.online);
      if(waiting)this.suspendInput();
      this.hooks.connection(waiting?'对手掉线，等待重连…':this.connection);
    }
    suspendInput(){
      if(this.inputPaused)return;
      this.inputPaused=true;this.generation=(this.generation||0)+1;this.changes=[];
      this.remote?.held.clear();this.hooks.resetHeld();
    }
    changeInput(button,down){
      if(this.room?.phase!=='playing'||this.room.disconnectedAt?.some(t=>t!=null))return;
      this.changes.push({button,down});
      if(!this.sending)queueMicrotask(()=>this.flushInput());
    }
    async flushInput(){
      if(this.sending||!this.changes.length||this.room?.phase!=='playing')return;
      this.sending=true;
      const generation=this.generation,matchId=this.room.matchId;
      try{
        while(generation===this.generation&&this.changes.length&&this.room?.phase==='playing'){
          const seq=this.sequence+1,changes=this.changes.splice(0,16);
          let retry=0;
          while(generation===this.generation&&this.room?.phase==='playing'){
            try{
              const ack=await this.api('/room/input',{matchId,seq,changes});
              if(generation===this.generation)this.sequence=Math.max(this.sequence,ack.seq);
              break;
            }
            catch(error){
              if(generation!==this.generation)return;
              if(['match','paused','sequence'].includes(error.code)){this.suspendInput();return;}
              if(error.status&&error.status!==429){this.hooks.connection(error.message);return;}
              this.hooks.connection('正在恢复对战连接…');
              await new Promise(resolve=>setTimeout(resolve,Math.min(1800,120*2**Math.min(4,retry++))));
            }
          }
        }
      }finally{
        this.sending=false;
        if(this.changes.length&&this.room?.phase==='playing')queueMicrotask(()=>this.flushInput());
      }
    }
    message(text){this.notice.textContent=text||'';}
    open(tab){
      if(this.tab==='skins'&&tab!=='skins')this.hooks.stopSelectionPreview();
      this.tab=tab;this.message('');
      if(!this.dialog.open){this.hooks.enterDialog();this.dialog.showModal();}
      this.render();
      if(tab==='rank'&&this.server)this.loadRank().catch(e=>this.message(e.message));
    }
    close(){if(this.dialog.open){if(this.tab==='skins')this.hooks.stopSelectionPreview();this.dialog.close();this.hooks.leaveDialog();}}
    tabs(){
      return '<nav class="guild-tabs" aria-label="会馆">'+[['account','我的账号'],['skins','智慧圣殿'],['rooms','联机排位'],['rank','荣誉榜']].map(([id,title])=>'<button type="button" data-net="'+id+'" aria-current="'+(this.tab===id?'page':'false')+'">'+title+'</button>').join('')+'</nav>';
    }
    render(){
      if(!this.dialog.open)return;
      $('guild-title').textContent={account:'我的账号',skins:'智慧圣殿',rooms:'终末决斗',rank:'荣誉榜',phone:'手机扫码玩'}[this.tab];
      this.message('');
      let html=this.tabs();
      if(this.tab==='phone'){
        html=this.phoneInvite();
      }else if(this.olderServer){
        html+='<p class="guild-copy">游戏页面已更新，此地址仍在运行旧版账号服务。请房主在旧服务窗口按 Ctrl+C，再运行新版 npm start 或 npm run lan。刷新此页即可使用原账号。</p>';
      }else if(this.tab==='skins'){
        html+=this.wardrobe();
      }else if((!this.server&&!this.local)||(this.local&&['rank','rooms'].includes(this.tab))){
        html+='<p class="guild-copy">联机账号和荣誉榜由房主保存。房主在项目目录运行 npm start，跨设备对战时运行 npm run lan。手机在同一 Wi-Fi 下打开房间的网址。</p><div class="guild-buttons"><a class="command primary" href="http://127.0.0.1:8787/">进入本机联机大厅</a>'+button('account','本机账号')+'</div>';
      }else if(this.tab==='rank'){
        html+='<div id="rank-content" aria-live="polite">正在读取排名…</div>';
      }else if(!this.user&&this.server?.guestOnly){
        html+='<div class="guild-auth"><h3>免费联网对战</h3><p>领取本浏览器的访客身份即可加入排位。再次用这个浏览器打开相同地址，可继续本次进度。</p>'+button('guest','领取访客身份',true)+'</div>';
      }else if(!this.user){
        const register=this.auth==='register';
        const kind=this.local?'本机档案':'联机账号';
        html+='<div class="guild-auth"><h3>'+(register?'创建':'登录')+kind+'</h3><p>'+(this.local?'账号保存在当前浏览器，可通过试炼赚取 Token，解锁衣装。联机请使用房主大厅的账号。':'账号保存在本房主的大厅。同一地址可在电脑或手机登录。')+'</p><form data-form="auth"><label>账号名<input name="name" required minlength="2" maxlength="20" autocomplete="username" placeholder="2 至 20 个字符"></label><label>密码<input name="password" required minlength="8" type="password" autocomplete="'+(register?'new-password':'current-password')+'" placeholder="至少 8 个字符"></label><div class="guild-buttons"><button class="command primary" type="submit">'+(register?'注册并登录':'登录')+'</button>'+button(register?'login':'register',register?'已有账号，去登录':'创建账号')+'</div></form></div>';
      }else if(this.tab==='account'){
        const p=this.user.progress;
        const power=ArenaProgress.power(p),path=ArenaProgress.path(p),{current}=path;
        const stats='<dl class="profile-values"><div><dt>等级</dt><dd lang="en">'+current.name+'</dd></div>'+
          '<div><dt>力量</dt><dd>'+power+'</dd></div><div><dt>Token 余额</dt><dd>'+p.wallet+'</dd></div></dl>';
        const records='<p class="profile-records"><span>试炼 '+p.soloWins+' 胜 '+p.soloLosses+' 负</span>'+
          (this.server?'<span>排位 '+this.user.wins+' 胜 '+this.user.losses+' 负</span><span>排位分 '+this.user.points+'</span>':'')+'</p>';
        html+='<div class="guild-profile"><h3>'+(p.avatar?avatarFace(p.avatar):'')+escape(this.user.name)+'</h3>'+stats+records+'</div>'+
          this.challengePanel(path)+this.avatars(path.avatars,p.avatar)+this.rulebook(p)+
          '<div class="guild-buttons">'+button('skins','打开智慧圣殿')+(this.server?.guestOnly?'':button('logout','退出登录'))+'</div>';
      }else if(!this.room&&this.user.progress.wallet===0){
        html+='<p>Token 余额为零。赢下一场免费单人试炼得 1 Token，即可再次排位。</p>'+button('rescue','去免费返场试炼',true);
      }else if(!this.room){
        html+='<p class="guild-copy">每场三局两胜，胜方得 6 Token，负方最多扣 4 Token。'+rankedRule+'首局交战未满 30 秒即弃赛或掉线，胜方不领奖励。</p><div class="guild-entry"><section><h3>发起挑战</h3><p>创建房间后，将邀请码交给对手。</p>'+button('create','创建房间',true)+'</section><form data-form="join"><h3>应邀赴战</h3><label>房间邀请码<input name="code" maxlength="12" required autocomplete="off" spellcheck="false"></label><button class="command" type="submit">加入房间</button></form></div>'+this.hostAddresses();
      }else{
        const r=this.room,me=r.players[r.selfSide],owner=r.ownerId===this.user.id;
        html+='<div class="room-title"><span>房间邀请码</span><strong>'+escape(r.code)+'</strong>'+button('copy','复制邀请')+'</div><div class="room-seats">'+r.players.map((p,i)=>
          '<div>'+(p?'<img class="seat-art" alt="" src="'+ArenaSkins.portrait(p.fighter,p.skin)+'">':'')+
          '<small>'+(i===r.selfSide?'你':'对手')+(p?' · '+escape(p.tier):'')+'</small><strong>'+publicAvatar(p?.avatar)+escape(p?.name||'等待应战者')+'</strong><span>'+
          escape(p?ArenaEngine.roster[p.fighter]?.name+' · '+(p.ready?'已准备':p.online?'已就位':'已断线'):'尚未入席')+'</span>'+(p?'<small>排位分 '+p.points+'</small>':'')+'</div>').join('')+'</div>';
        if(r.phase==='lobby'){
          html+='<div class="room-choices"><label>出战英雄'+select('fighter',Object.values(ArenaEngine.roster).map(p=>[p.id,p.name+' · '+ArenaSkins.title(p.id,this.skinFor(p.id))]),me.fighter)+'</label><label>决斗战场'+select('stage',ArenaStages.list.map(s=>[s.id,s.name]),r.stage,!owner)+'</label></div><div class="guild-buttons">'+button('ready',me.ready?'取消准备':'准备就绪',true)+button('leave','离开房间')+'</div>'+this.hostAddresses();
        }else if(r.phase==='playing'){
          html+='<p>正在'+escape(stageName(r.stage))+'交战。双方各用自己的键盘或手柄。</p><div class="guild-buttons">'+button('return','返回战斗',true)+button('surrender','认输离场')+'</div>';
        }else{
          const result=r.result,win=result.winner,delta=result.points[r.selfSide];
          const rematchText=me.ready?'已邀战，等待对手':r.players[1-r.selfSide]?'邀战下一场':'回到房间等待对手';
          const credit=result.credits?.[r.selfSide]||0;
          const onward=me.progress.wallet===0?button('rescue','去免费返场试炼',true):button('again',rematchText,true);
          const ratings=result.ratingBefore?'<p>开局排位分　我方 '+result.ratingBefore[r.selfSide]+' · 对手 '+result.ratingBefore[1-r.selfSide]+'</p>':'';
          html+='<div class="guild-result"><h3>'+(win<0?'本场取消':win===r.selfSide?'决斗胜利':'决斗落败')+'</h3><p>回合 '+result.wins.join(' 比 ')+'　排位分 '+(delta>0?'+':'')+delta+'　Token '+(credit>0?'+':'')+credit+'　余额 '+me.progress.wallet+'</p>'+ratings+'</div><div class="guild-buttons">'+onward+button('leave','离开房间')+'</div>';
        }
      }
      if(this.local&&this.tab==='account')html+='<p class="guild-copy">已有联机账号？电脑运行 npm start 后，<a href="http://127.0.0.1:8787/">进入联机大厅登录</a>。手机请打开房主的局域网地址。</p>';
      if(this.initError)html+='<p class="guild-copy">'+escape(this.initError)+'</p>';
      if(this.tab==='account'&&!this.user&&!this.olderServer&&(this.server||this.local))html+=this.rulebook();
      if(this.tab==='account'&&!this.server?.guestOnly&&(this.server||this.local&&this.user))html+=this.portablePass();
      this.body.innerHTML=html;
    }
    portablePass(){
      const output=Boolean(this.local),action=output?'导出':'转入';
      return '<details class="duel-rules"><summary>'+action+'本机档案</summary><p>'+
        (output?'将同名账号和已永久解锁的衣装带到联机大厅。导出凭证后，在完整版账号页选择「转入本机档案」。':'选择从本机档案导出的凭证，输入本机密码。第一次联机将以相同的账号名和密码创建账号。已有同名账号时须验证该联机账号。')+
        ' 每个联机账号可转入一次。联机余额、力量、排名独立结算，原档案仍可继续玩。</p><form data-form="'+(output?'export-pass':'import-pass')+'">'+
        (output?'':'<label>档案凭证<input required type="file" name="passport" accept=".duelpass,application/json"></label>')+
        '<label>本机密码<input required name="localPassword" type="password" minlength="8" autocomplete="off"></label><button class="command" type="submit">'+action+'凭证</button></form></details>';
    }
    challengePanel(path){
      if(!path.next)return '<section class="challenge-panel"><h4>终末之战已通关</h4><p>六位角色的 Ultra 形态和专属神环已解锁。</p>'+button('skins','查看终极形态')+'</section>';
      const series=path.kind==='series',current=path.series;
      const name=path.next.id==='ultra'?'终末之战':path.next.name+' 晋级试炼';
      let content='<section class="challenge-panel" aria-label="当前晋级挑战"><h4>'+name+'</h4><p>'+promotion(path)+'</p>';
      if(series){
        content+='<p>'+trialRules[path.next.id]+'。每位对手打一场三局两胜，按下列顺序应战。</p>'+
          '<ol class="challenge-opponents">'+path.opponents.map((id,i)=>{
            const result=current?.results[i],state=result===true?'胜':result===false?'负':id===path.nextOpponent?'下一位':'待战';
            return '<li data-state="'+state+'"><span>'+heroName(id)+'</span><small>'+state+'</small></li>';
          }).join('')+'</ol><p>本轮 '+(current?.wins||0)+' 胜 '+(current?.losses||0)+' 负。胜得 5 Token，落败保留 Token，结束后可立即重试。</p>';
      }else{
        const qualified=path.kind==='distinct'&&path.defeated.length>=path.goal;
        const options=path.opponents.filter(id=>qualified||path.kind!=='distinct'||!path.defeated.includes(id));
        if(path.kind==='distinct')content+='<p>本阶已击败 '+(path.defeated.map(heroName).join('、')||'0 位')+'。'+(qualified?'对手条件已完成，继续积攒力量即可。':'任选 '+path.goal+' 位不同对手。')+'</p>';
        else content+='<p>任选高手对手累计取胜，可以重复挑战同一位。五胜前力量最多积至 100。</p>';
        if(options.length)content+='<label>试炼对手 <select data-path-opponent>'+options.map(id=>'<option value="'+id+'">'+heroName(id)+'</option>').join('')+'</select></label>';
      }
      if(this.room)content+='<p>离开联机房间后可以进入单人试炼。</p>';
      else if(this.hooks.hasActiveBattle())content+='<p>结束当前对决后可开始下一场。</p>';
      else if(!series||path.ready)content+='<div class="guild-buttons">'+button('path-battle',series?(current?'继续晋级赛':'开始晋级赛'):'挑战高手',true)+'</div>';
      else content+='<p>力量达到 '+path.next.min+' 时可进入晋级赛。</p>';
      return content+'</section>';
    }
    avatars(owned,worn){
      const selected=this.previewAvatar||worn||owned[0];
      const cards=Object.keys(ArenaEngine.roster).map(id=>'<button type="button" data-avatar-id="'+id+'" aria-pressed="'+(id===selected)+'" class="'+(owned.includes(id)?'earned':'locked')+'">'+avatarFace(id)+'<b>'+heroName(id)+'</b><small>'+(worn===id?'已佩戴':owned.includes(id)?'已收藏':'待解锁')+'</small></button>').join('');
      let detail='';
      if(selected){
        const action=worn===selected?button('clear-avatar','卸下头像'):owned.includes(selected)?button('wear-avatar','佩戴头像'):'<span>高手首胜后解锁</span>';
        detail='<div class="avatar-detail">'+avatarFace(selected)+'<div><strong>'+heroName(selected)+' · '+ArenaSkins.title(selected,'base')+'</strong><small>首胜纪念头像</small></div>'+action+'</div>';
      }
      return '<section class="avatar-album" aria-label="首胜头像收藏"><h4>首胜头像 <small>'+owned.length+' / 6</small></h4><p>首次在高手试炼或晋级赛击败她，即可永久收藏并佩戴头像。</p><div class="avatar-cards">'+cards+'</div>'+detail+'</section>';
    }
    rulebook(p=null){
      const {levels,forms,dyes,rankedGrowth}=ArenaProgress;
      const trials=[['入门试炼',levels.easy],['标准试炼',levels.normal],['高手试炼',levels.hard]];
      const rows=[...trials,['联机排位',{reward:6,loss:4,growth:rankedGrowth}]].map(([name,rule])=>
        '<tr><th scope="row">'+name+'</th><td>+'+rule.reward+'</td><td>−'+rule.loss+'</td><td>'+rule.growth+'</td></tr>').join('');
      const tier=p?ArenaProgress.path(p).current:forms[0],power=p?ArenaProgress.power(p):0;
      const tiers=forms.map(form=>{
        const opponents=form.min?ArenaProgress.opponentsFor(form.id).map(heroName).join('、'):'';
        const status=p?(form.min<=tier.min?'已晋级':power<form.min?'还差 '+(form.min-power):'已达标'):'';
        return '<tr><th scope="row" lang="en">'+form.name+'</th><td>'+form.min+(status?'<small>'+status+'</small>':'')+'</td><td>'+trialRules[form.id]+(opponents?'<small>'+opponents+'</small>':'')+'</td></tr>';
      }).join('');
      return '<details class="duel-rules account-rules"><summary>力量与 Token 规则</summary><div class="rules-body">'+
        '<p>新账号从 <b>Low</b> 起步，初始力量为 <b>0</b>，获赠 <b>30 Token</b>。赢得对战可以积攒 Token、提升力量。游客和同屏对战可自由练习。</p>'+
        '<section class="rules-section"><h4>对战结算</h4>'+
        '<p>单人试炼和联机排位都由先赢两局的一方取胜，Token 在整场结束时结算。</p>'+
        '<table class="rules-rewards" aria-label="各模式的 Token 奖惩和胜场基础力量"><thead><tr><th scope="col">对战</th><th scope="col">胜场 Token</th><th scope="col">败场 Token</th><th scope="col">胜场力量</th></tr></thead><tbody>'+rows+'</tbody></table>'+
        '<p>表中力量按双方实力相当计算。胜场增长力量，败场保留已有力量。Token 单独结算。</p>'+
        '<p>单人试炼开场暂扣本场可能损失的 Token，余额不足时只暂扣现有余额。胜利时先返还，再发放胜场奖励。主动弃赛按败场结算。</p>'+
        '<p><b>Token 归零</b>后可免费参加任何难度的返场试炼，获胜得 1 Token。双方账号各有至少 1 Token 即可开始联机排位。</p></section>'+
        '<section class="rules-section"><h4>等级与衣装</h4>'+
        '<p>各阶同时考核力量与实战。Low 力量最多积至 100，第五场高手胜利可跨过门槛。升入 Medium 后开始记录 High 所需的不同对手。Extra、Max、Ultra 均须在达到力量门槛后进入专属晋级赛。</p>'+
        '<table class="rules-tiers" aria-label="六阶力量门槛与晋级对手"><thead><tr><th scope="col">等级</th><th scope="col">力量门槛</th><th scope="col">实战要求与对手</th></tr></thead><tbody>'+tiers+'</tbody></table>'+
        '<p>晋级赛每场三局两胜，达到规定胜场即可晋级。普通试炼和排位可以积攒力量，晋级赛免费参赛，失败后保留原有等级、力量与衣装。</p>'+
        '<p>每次晋级，六位角色同时解锁对应的衣装，可在智慧圣殿免费穿戴。达到 <b>Ultra</b> 后，每位角色都拥有专属神环。衣装与账号等级均不改变战斗属性。</p>'+
        '<p>晨曦、月蚀染色可在注册后 24 小时内试穿。永久解锁按角色分别计价，晨曦 '+dyes.dawn.cost+' Token，月蚀 '+dyes.eclipse.cost+' Token。</p></section>'+
        '<details class="rules-section"><summary>力量成长</summary>'+
        '<p>单人试炼比较双方的出战角色。角色实力按攻击 40%、防御 35%、速度 25% 加权，乘以 20 后四舍五入。联机排位中，每方取角色实力和结算前的账号力量中较高的数值。</p>'+
        '<p>对手实力比你高 10 点或以上，本场多得 1 力量。低 10 点或以上，少得 1 力量。相差不足 10 点按表中数值结算。每场所得直接累加到已有账号力量。</p></details>'+
        '<details class="rules-section"><summary>排位分</summary>'+
        '<p>'+rankedRule+'Token 余额与排位分各自结算。荣誉榜先按排位分排序，同分时比较联机胜场数。</p>'+
        '<p>首局交战前 30 秒内弃赛或掉线判负，负方照常扣分。胜方本场的 Token、排位分、力量与胜场均不增加。</p></details></div></details>';
    }
    wardrobe(){
      const p=this.user?.progress,id=this.skinHero||this.hooks.pick().fighter;this.skinHero=id;
      const forms=ArenaProgress.forms,worn=this.skinFor(id),power=p?ArenaProgress.power(p):0,path=p?ArenaProgress.path(p):null;
      const preview=forms.find(f=>f.id===(this.previewForm||worn))||(path?.current||forms[0]);
      const formTitle=ArenaSkins.title(id,preview.id),trial=p&&p.trialUntil>Date.now();
      const options=Object.entries(ArenaEngine.roster).map(([key,r])=>'<option value="'+key+'"'+(key===id?' selected':'')+'>'+r.name+'</option>').join('');
      let body='<div class="closet-head"><label>试衣角色 <select data-skin-hero>'+options+'</select></label><strong>'+
        (p?ArenaProgress.tier(p)+' · 力量 '+power+' · '+p.wallet+' Token':'游客预览')+'</strong></div>';
      body+='<div class="form-fitting"><figure class="form-art" data-form="'+preview.id+'"><img src="'+ArenaSkins.portrait(id,preview.id)+'" alt="'+ArenaEngine.roster[id].name+' '+preview.name+' '+formTitle+' 全身形态'+(preview.id==='ultra'?'与专属神环':'')+'"></figure>'+
        '<div class="form-pick"><div class="form-title"><small>'+ArenaEngine.roster[id].name+' / '+preview.name+'</small><h3>'+formTitle+'</h3></div>'+
        '<div class="form-tiers" role="group" aria-label="预览等级形态">'+forms.map(f=>
          '<button type="button" data-preview-form="'+f.id+'" aria-pressed="'+(f===preview)+'"><strong lang="en">'+f.name+'</strong><span>'+ArenaSkins.title(id,f.id)+'</span></button>'
        ).join('')+'</div>';
      if(!p)body+='<div class="form-state"><span>'+preview.name+' · '+preview.min+' 力量 · '+trialRules[preview.id]+'</span>'+button('account','登录账号')+'</div>';
      else if(worn===preview.id)body+='<div class="form-state"><strong>已穿戴</strong></div>';
      else if(path.current.min>=preview.min)body+='<div class="form-state"><button type="button" class="command primary" data-skin-action="'+preview.id+'">穿戴形态</button></div>';
      else{
        const needed=preview===path.next?promotion(path):(power<preview.min?'还差 '+(preview.min-power)+' 力量':'力量已达标')+' · '+trialRules[preview.id];
        body+='<div class="form-state"><strong>升至 '+preview.name+' 解锁</strong><span>'+needed+'</span>'+button('account','查看晋级条件')+'</div>';
      }
      body+='</div></div>';
      if(!p)return body;
      body+='<details class="closet-dyes duel-rules"'+(Object.hasOwn(ArenaProgress.dyes,worn)?' open':'')+'><summary>经典染色 · 晨曦 / 月蚀</summary>'+
        '<p class="guild-copy">'+(trial?'试穿至 '+escape(new Date(p.trialUntil).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}))+'。':'试穿已结束。')+' 使用 Token 可永久解锁染色。</p><div class="closet-list">';
      for(const [key,item] of Object.entries(ArenaProgress.dyes)){
        const owned=p.owned.includes(id+'.'+key);
        body+='<section class="closet-card"><img loading="lazy" alt="'+item.name+'衣装" src="'+ArenaSkins.portrait(id,key)+'"><h3>'+item.name+'</h3><div class="guild-buttons">';
        if(worn===key)body+='<span>已穿戴</span>';
        else if(owned||trial)body+='<button type="button" class="command" data-skin-action="'+key+'">'+(owned?'穿戴':'试穿')+'</button>';
        if(!owned)body+='<button type="button" class="command" data-skin-action="'+key+'" data-purchase="true"'+(p.wallet<item.cost?' disabled':'')+'>'+item.cost+' Token 解锁</button>';
        body+='</div></section>';
      }
      return body+'</div></details>';
    }
    hostAddresses(){
      if(this.server?.mobileUrl?.startsWith('https://')){
        const url=escape(this.server.mobileUrl);
        return '<p class="guild-copy">让队友打开 <a href="'+url+'">'+url+'</a>，登录后输入房间邀请码。两部手机可以使用各自的流量或 Wi-Fi。</p>'+button('phone','显示手机二维码');
      }
      const [url,...others]=this.inviteAddresses();
      if(!this.server?.lan||!url)return button('phone','用手机加入');
      const choices=others.length?'<details class="room-addresses"><summary>房主的其他网卡地址</summary>'+others.map(u=>'<p>'+escape(u)+'</p>').join('')+'</details>':'';
      return '<p class="guild-copy">同一网络的队友打开 <a href="'+escape(url)+'">'+escape(url)+'</a>，再输入邀请码。</p>'+button('phone','显示手机二维码')+choices;
    }
    phoneInvite(){
      if(!this.server)return '<p class="guild-copy">同一 Wi-Fi 内可在电脑项目目录运行 npm run lan，再在联机大厅点「手机扫码玩」。</p>';
      const url=this.server.mobileUrl;
      if(!url){
        if(this.server.lan)return '<p class="guild-copy">请将电脑连上 Wi-Fi，再刷新连接地址。</p>'+button('phone-refresh','刷新地址');
        return '<p class="guild-copy">开启后，连着同一 Wi-Fi 的手机就能扫码进入这台电脑的游戏。</p>'+button('phone-open','开启手机连接',true);
      }
      const qr=qrcode(0,'M');qr.addData(url,'Byte');qr.make();
      const code=this.room?.code?'<p>房间邀请码 <strong>'+escape(this.room.code)+'</strong></p>':'';
      const instructions=url.startsWith('https://')?'用微信扫一扫进入游戏，手机可使用流量或 Wi-Fi。':'手机连上电脑所在的 Wi-Fi，用相机扫码。';
      return '<div class="phone-invite">'+qr.createSvgTag({cellSize:6,scalable:true,alt:'手机游戏网址的二维码'})+
        '<p>'+instructions+'</p><a href="'+escape(url)+'">'+escape(url)+'</a>'+code+
        '<div class="guild-buttons">'+button('phone-copy','复制手机链接')+button('phone-refresh','刷新地址')+'</div></div>';
    }
    inviteAddresses(){
      const urls=(this.server?.urls||[]).filter(u=>!['127.0.0.1','localhost','[::1]'].includes(new URL(u).hostname));
      return urls.sort((a,b)=>Number(new URL(b).origin===location.origin)-Number(new URL(a).origin===location.origin));
    }
    async loadRank(){
      const {players,me}=await this.api('/leaderboard');
      const el=$('rank-content');if(!el)return;
      el.innerHTML=(me?'<p>我的名次　<strong>第 '+me.rank+' 名</strong>　'+me.points+' 排位分</p>':'')+
        (players.length?'<table><thead><tr><th>名次</th><th>玩家</th><th>排位分</th><th>胜 / 负</th></tr></thead><tbody>'+players.map(p=>'<tr'+(p.id===this.user?.id?' class="my-rank"':'')+'><td>'+p.rank+'</td><td>'+publicAvatar(p.avatar)+escape(p.name)+'</td><td>'+p.points+'</td><td>'+p.wins+' / '+p.losses+'</td></tr>').join('')+'</tbody></table>':'<p>荣誉榜尚无人留名。</p>');
    }
    async mutate(path,data){
      if(this.busy)return;
      this.busy=true;const owner=this.user?.id;
      try{const response=await this.api(path,data);if('room' in response&&owner===this.user?.id)this.setRoom(response.room);}
      finally{this.busy=false;}
    }
    async submit(form){
      if(this.busy)return;
      if(this.server?.guestOnly&&form.dataset.form!=='join')return;
      const fields=Object.fromEntries(new FormData(form));
      if(form.dataset.form==='join'){await this.mutate('/rooms/join',{code:fields.code.trim().toUpperCase(),fighter:this.hooks.pick().fighter});return;}
      this.busy=true;
      try{
        if(form.dataset.form==='export-pass'){
          const file=await this.local.exportPass(fields.localPassword),url=URL.createObjectURL(new Blob([JSON.stringify(file)],{type:'application/json'}));
          const link=document.createElement('a');link.href=url;link.download=this.user.name+'.duelpass';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
          form.reset();this.message('凭证已导出，前往联机大厅账号页即可转入。');return;
        }
        if(form.dataset.form==='import-pass'){
          if(!fields.passport||fields.passport.size>12000)throw new Error('请选择有效的游戏档案凭证。');
          let archive;try{archive=JSON.parse(await fields.passport.text());}catch{throw new Error('无法读取凭证，请选择游戏导出的 .duelpass 文件。');}
          const me=await this.api('/import-local',{archive,password:fields.localPassword});
          this.stream?.close();this.stream=null;this.identity(me);this.notifyAccount();this.render();this.message('同名账号与永久衣装已转入。');return;
        }
        const action=this.auth,me=await this.api('/'+action,fields);
        this.auth='login';this.identity(me);this.notifyAccount();this.render();if(action==='register')this.message('已注册。初始等级 Low，获得 30 Token 和 24 小时染色试穿。');
      }
      finally{this.busy=false;}
    }
    async act(action){
      if(action==='guest'){
        if(this.busy||this.user||!this.server?.guestOnly)return;
        this.busy=true;
        try{
          this.identity(await this.api('/guest',{}));this.notifyAccount();this.render();
        }finally{this.busy=false;}
        return;
      }
      if(action==='path-battle'){
        if(!this.user||this.room||this.hooks.hasActiveBattle())return;
        const path=ArenaProgress.path(this.user.progress),series=path.kind==='series';
        if(!path.next||series&&!path.ready)return;
        const opponent=series?path.nextOpponent:this.body.querySelector('[data-path-opponent]')?.value||path.opponents[0];
        this.close();await this.hooks.challenge({opponent,series});return;
      }
      if(action==='wear-avatar'||action==='clear-avatar'){
        if(this.busy)return;
        this.busy=true;
        try{
          const hero=action==='clear-avatar'?null:(this.previewAvatar||this.user.progress.avatars[0]);
          const reply=await this.api('/avatar',{hero});this.updateCurrent(reply.user);
          if(this.local)this.notifyAccount();this.render();this.message(hero?'头像已佩戴。':'头像已卸下。');
        }finally{this.busy=false;}
        return;
      }
      if(action==='phone'||action==='phone-refresh'){
        this.open('phone');await this.init();
        if(this.server)this.server=await this.api('/server');
        if(this.tab==='phone')this.render();return;
      }
      if(action==='phone-open'){
        if(this.busy)return;this.busy=true;
        try{
          const reply=await fetch('/api/phone/open',{method:'POST',headers:{'X-Arena-Local':'phone','Content-Type':'application/json'},body:'{}'});
          const info=await reply.json();
          if(!reply.ok)throw new Error(info.error||'手机连接开启失败');
          this.server=info;this.render();
        }finally{this.busy=false;}return;
      }
      if(action==='phone-copy'){
        const url=this.server?.mobileUrl;if(!url)return;
        try{await navigator.clipboard.writeText(url);this.message('手机链接已复制。');}
        catch{this.message('长按或选中上方网址即可复制。');}return;
      }
      if(['account','skins','rooms','rank'].includes(action)){
        if(action==='skins'){
          this.hooks.stopSelectionPreview();
          this.skinHero=this.room?.players[this.room.selfSide]?.fighter||this.hooks.wardrobeFighter();
          this.previewForm=null;
        }
        this.open(action);return;
      }
      if(action==='rescue'){
        if(this.room?.phase==='playing')return;
        if(this.room){await this.mutate('/room/leave',{});this.hooks.exit();}
        this.close();document.querySelector('#lobby [data-mode="solo"]')?.click();return;
      }
      if(action==='close'||action==='return'){this.close();return;}
      if(action==='login'||action==='register'){this.auth=action;this.render();return;}
      if(action==='create'){await this.mutate('/rooms',this.hooks.pick());return;}
      if(action==='ready'){
        const room=this.room,ready=!room.players[room.selfSide].ready;
        if(ready){
          const ids=room.players.map(p=>p?.fighter);
          await this.hooks.prepare(room.players.filter(Boolean),room.stage);
          if(this.room?.stage!==room.stage||ids.some((id,i)=>this.room?.players[i]?.fighter!==id))return;
        }
        if(this.room?.code===room.code&&this.room.phase==='lobby')await this.mutate('/room/ready',{ready});
        return;
      }
      if(action==='again'){await this.mutate('/room/rematch',{});return;}
      if(action==='surrender'){this.body.innerHTML='<h3>认输离场？</h3><p>本场将按落败结算 Token。</p><div class="guild-buttons">'+button('leave','确认认输')+button('rooms','继续对战',true)+'</div>';return;}
      if(action==='leave'){await this.mutate('/room/leave',{});this.hooks.exit();this.identity(await this.api('/me'));this.render();return;}
      if(action==='logout'){
        if(this.room){this.message('请先在联机排位中离开当前房间。');return;}
        if(this.activeDriver&&!this.activeDriver.receipt&&this.activeDriver.match.state.phase!=='matchOver'){this.message('请先结束或退出当前试炼，再切换账号。');return;}
        await this.api('/logout',{});this.stream?.close();this.stream=null;this.identity({user:null,room:null});this.notifyAccount();this.render();return;
      }
      if(action==='copy'){
        const r=this.room;if(!r)return;
        const url=this.inviteAddresses()[0]||location.origin+'/';
        try{await navigator.clipboard.writeText(url+'　房间 '+r.code);this.message('房间地址和邀请码已复制。');}
        catch{this.message('房间 '+r.code+'　'+url);}
      }
    }
  }
  window.ArenaNetwork=ArenaNetwork;
})();
