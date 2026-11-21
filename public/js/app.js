(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const roster = ArenaEngine.roster;
  const order = ['deepseek','chatgpt','claude','gemini','grok','kimi'];
  const paint = {
    deepseek:['#1852a3','#142444','#599ce8','均衡','wave'],
    chatgpt:['#7762ab','#211d3e','#b5a0dc','防守','loop'],
    claude:['#bd4d28','#421c22','#e48745','强攻','sun'],
    gemini:['#774ab6','#271d49','#bb8fe2','幻术','star'],
    grok:['#97722e','#352b27','#ccb76c','突击','axe'],
    kimi:['#52658b','#262a43','#9cadd1','游击','moon']
  };
  const motifs = {
    wave:'<path d="M6 27q15-4 23 16Q48 16 71 15 62 30 46 31 66 34 78 28 69 49 49 44 42 57 20 62q15-12 15-20Q16 43 6 27z"/>',
    loop:'<g fill="none" stroke="currentColor" stroke-width="2">'+Array.from({length:6},(_,i)=>'<ellipse cx="40" cy="28" rx="12" ry="22" transform="rotate('+i*60+' 40 40)"/>').join('')+'</g>',
    sun:'<g fill="currentColor">'+Array.from({length:16},(_,i)=>'<path d="M38 6h4l-1 24h-2z" transform="rotate('+i*22.5+' 40 40)"/>').join('')+'</g>',
    star:'<path d="M42 3q2 27 30 33-27 7-30 35-7-28-33-35Q35 31 42 3zm22 45 2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/>',
    axe:'<path d="m12 9 28 22L68 9 51 36l13 20-24-13-24 13 13-20z"/>',
    moon:'<path d="M61 7A34 34 0 1 0 74 56Q35 71 29 39 27 17 61 7z"/>'
  };
  const selected = ['deepseek','claude'];
  const keymaps=[
    {KeyA:'left',KeyD:'right',KeyW:'jump',KeyS:'guard',KeyF:'attack',KeyG:'skill1',KeyH:'skill2',KeyT:'ult'},
    {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'jump',ArrowDown:'guard',KeyJ:'attack',KeyK:'skill1',KeyL:'skill2',KeyI:'ult',Numpad1:'attack',Numpad2:'skill1',Numpad3:'skill2',Numpad0:'ult'}
  ];
  const keyboardLabels = [['F','G','H','T'],['J','K','L','I']];
  const sprites = Object.fromEntries(order.map(id=>[id,new Image()]));
  let network=null,soloDriver=null,receiptState=null,matchSkins=null;
  function equipped(id,side){
    if(!network)return 'base';
    if(game&&matchSkins&&side!=null&&selected[side]===id)return matchSkins[side];
    if(game?.network&&side!=null)return network.room?.players[side]?.skin||'base';
    if(side===1&&solo())return 'base';
    return network.skinFor(id);
  }
  const portrait=(id,side=null)=>ArenaSkins.portrait(id,equipped(id,side));
  const framePlayer=new ArenaSkins.FramePlayer(MEDIA.motion,MEDIA.sheet,equipped);
  const cinema=new ArenaEffects(MEDIA.cinema,MEDIA.fxSheet);
  const levels={easy:'入门',normal:'标准',hard:'高手'};
  function trialLabel(ticket){
    if(!ticket?.promotion)return '单人试炼 · '+levels[ticket?.level||level];
    const form=ArenaProgress.forms.find(f=>f.id===ticket.promotion);
    return form.id==='ultra'?'终末之战':form.name+' 晋级赛';
  }
  function preference(key,values,initial){
    try{const value=localStorage.getItem('neural-clash:'+key);return values.includes(value)?value:initial}catch{return initial}
  }
  function remember(key,value){try{localStorage.setItem('neural-clash:'+key,value)}catch{}}
  let mode=preference('mode',['solo','versus'],'solo'),level=preference('level',Object.keys(levels),'normal'),cpu=null;
  let dialogue=preference("dialogue",["full","ko"],"full")==="full";
  let localVoiceSide=Number(preference('voiceSide',['0','1'],'0'));
  let stageId=preference('stage',ArenaStages.list.map(s=>s.id),'astral');
  const stageTitle=()=>ArenaStages.list.find(s=>s.id===stageId).name;
  const isOnline=()=>Boolean(game&&game.network);
  const solo=()=>mode==='solo'&&!isOnline();
  const voiceSide=()=>isOnline()?(network.room?.selfSide??-1):solo()?0:localVoiceSide;
  const seat=side=>isOnline()?(side===network.room?.selfSide?'我方':'对手'):side===1&&solo()?'CPU':(side+1)+'P';
  let editSide=0, game=null, showing='lobby', panel='', guideReturn='', lastFrame=0, sound=true, renderer=null;
  let previousFocus=null, roundUntil=0, victorySince=0, startPending=false, matchToken=0, tabNavigation=false;
  const toasts=[{until:0},{until:0}], lastHud={}, padHeld=[new Set(),new Set()], keyboardHeld=[new Map(),new Map()];
  const touchHeld=[new Set(),new Set()];
  const touchDevice=matchMedia('(pointer: coarse)');
  const preferredControls=()=>preference('controls',['keyboard','touch'],touchDevice.matches?'touch':'keyboard');
  let controlMode=preferredControls();
  function showControlMode(){
    document.documentElement.dataset.controls=controlMode;
    document.querySelectorAll('[data-controls-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.controlsMode===controlMode)));
  }
  showControlMode();
  const icon = name => '<svg aria-hidden="true"><use href="#i-'+name+'"/></svg>';
  function readSound(){try{return localStorage.getItem('neural-clash:sound')!=='off'}catch{return true}}
  const effectLevels=[100,65,35,0];
  let effectLevel=Number(preference('combatVolume',effectLevels.map(String),'100'));
  ArcadeAudio.setCombatVolume(effectLevel/100);
  function displayDialogue(){
    const btn=document.querySelector('[data-act="dialogue"]');
    if(btn){btn.textContent=dialogue?'本机朗读 · 开场与关键招式':'本机朗读 · 仅胜利 K.O.';btn.setAttribute('aria-pressed',String(dialogue));}
    document.querySelectorAll('[data-voice-side]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.voiceSide)===localVoiceSide)));
  }
  function showSound(){
    const fx=document.querySelector('[data-act="combat-volume"]');
    if(fx)fx.textContent='战斗音效 · '+(effectLevel?effectLevel+'%':'关');
    $('sound').innerHTML=icon(sound?'audio':'mute')+'<span>声音'+(sound?'开':'关')+'</span>';
    $('sound').setAttribute('aria-label',sound?'关闭声音':'开启声音'); $('sound').setAttribute('aria-pressed',String(sound));
    const extra=document.querySelector('[data-panel-sound]');
    if(extra){extra.textContent='游戏声音 · '+(sound?'开':'关');extra.setAttribute('aria-pressed',String(sound));}
  }
  function unlock(){void ArcadeAudio.unlock().then(ready=>{if(ready)ArcadeAudio.warmVoices()})}
  function theme(id){
    const [art,dark,light]=paint[id];return '--art:'+art+';--dark:'+dark+';--light:'+light;
  }
  const backdrop=new Image();
  function prepareImages(ids,stage){
    function load(image,src){
      if(!image.getAttribute('src') || (image.complete && !image.naturalWidth))image.src=src;
      return image.decode();
    }
    const jobs=[...new Set(ids)].map(id=>load(sprites[id],MEDIA.sprites[id]));
    jobs.push(stage==='rooftop'?load(backdrop,MEDIA.roof):ArenaStages.preload({[stage]:MEDIA.stages[stage]}));
    return Promise.all(jobs).catch(error=>{
      if(error.name!=='EncodingError'&&error.name!=='NetworkError')throw error;
      throw new Error('角色或战场图像未载入。连接恢复后，可返回选角重新进入。',{cause:error});
    });
  }
  const gallery=$('stage-gallery');
  const stageUrl=id=>new URL(MEDIA.stageThumbs?.[id]||(id==='rooftop'?MEDIA.roof:MEDIA.stages[id]),document.baseURI).href;
  for(const item of ArenaStages.list){
    const card=document.createElement('button');card.type='button';card.dataset.stage=item.id;
    card.style.setProperty('--field','url("'+stageUrl(item.id)+'")');
    card.innerHTML='<span>'+item.name+'</span>';gallery.append(card);
  }
  function displayStage(){
    const title=stageTitle();
    $('battle').style.setProperty('--portrait-scene','url("'+stageUrl(stageId)+'")');
    $('stage-caption').textContent='已选 · '+title;
    document.querySelector('.stage-slug').textContent=title;
    gallery.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.stage===stageId)));
  }
  const arenaWrap=$('arena').parentElement;
  const superBanners=[0,1].map(side=>{
    const el=document.createElement('div');el.className='super-banner side'+side;el.hidden=true;el.setAttribute('aria-hidden','true');
    arenaWrap.append(el);return el;
  });
  const superTimers=[0,0];
  function superCutin(f,skill){
    const el=superBanners[f.side];clearTimeout(superTimers[f.side]);
    el.style.cssText=theme(f.id);el.innerHTML='<img alt="" src="'+portrait(f.id,f.side)+'"><div><small>奥义解放</small><b>'+skill.name+'</b></div>';
    el.hidden=false;el.getAnimations().forEach(a=>a.cancel());
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      const offset=f.side?'30%':'-30%';
      el.animate([{opacity:0,transform:'translateX('+offset+')'},{opacity:1,transform:'none',offset:.17},{opacity:1,transform:'none',offset:.78},{opacity:0,transform:'none'}],{duration:940,easing:'ease-out'});
    }
    superTimers[f.side]=setTimeout(()=>{el.hidden=true},920);
  }
  displayStage();
  function stars(stats){
    const damage=Math.round(ArenaEngine.armorMultiplier[stats.defense]*100);
    return ['attack','defense','speed'].map((k,i)=>{
      const label=['攻击','防御','速度'][i]+' '+stats[k]+'/5'+(k==='defense'?'，同一招承伤倍率 '+damage+'%':'');
      return '<span class="rating" title="'+label+'" aria-label="'+label+'">'+['攻','防','速'][i]+' <span class="meter5"><i style="width:'+stats[k]*20+'%"></i></span><b>'+stats[k]+'</b></span>';
    }).join('');
  }
  function updateHero(side){
    const id=selected[side],r=roster[id], el=$('hero'+side), deco=paint[id][4],skin=equipped(id,side);
    el.setAttribute('style',theme(id));el.dataset.fighter=id;el.dataset.form=skin;
    el.innerHTML='<div class="speedlines"></div><svg class="art-mark" aria-hidden="true" viewBox="0 0 80 80" fill="currentColor" style="fill:currentColor">'+motifs[deco]+'</svg>'+
       '<img class="hero-img" alt="'+r.name+(skin==='ultra'?' Ultra 形态与专属神环':'原画')+'" src="'+ArenaSkins.portrait(id,skin)+'"><div class="hero-shade"></div>'+
       '<div class="hero-tag"><b>'+seat(side)+'</b> '+(side===1&&solo()?'试炼对手':'出战英雄')+'</div>'+
       '<div class="hero-copy"><strong>'+r.name+'</strong><div class="hero-title"><i></i>'+ArenaSkins.title(id,skin)+'<button class="hero-guide" data-codex="'+id+'" data-codex-side="'+side+'">秘技</button></div><div class="ratings">'+stars(r.stats)+'</div></div>';
  }
  function drawSelection(){
    const isSolo=solo();
    document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
    document.querySelectorAll('[data-level]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.level===level)));
    $('cpu-level').hidden=!isSolo;
    $('launch-rule').hidden=false;
    $('lobby-format').textContent=isSolo?'单人试炼':'同屏决斗';
    document.querySelector('.pick-hint').textContent=isSolo?'A / D 切换玩家，← / → 切换电脑':'1P 用 A / D 切换，2P 用 ← / → 切换';
    selected.forEach((_,s)=>updateHero(s));
    document.querySelectorAll('[data-side]').forEach((b,s)=>{
      b.classList.toggle('active',s===editSide);b.textContent=seat(s)+' 选角';b.setAttribute('aria-pressed',String(s===editSide));
    });
    const list=$('roster');
    if(!list.children.length){
      list.innerHTML=order.map(id=>'<button class="card" style="'+theme(id)+'" data-fighter="'+id+'"><div class="card-pic"><img src="'+MEDIA.sprites[id]+'" alt=""></div><span class="tags"></span><span class="card-name">'+roster[id].name+'<small>'+paint[id][3]+'</small></span></button>').join('');
    }
    list.querySelectorAll('.card').forEach((card)=>{
      const id=card.dataset.fighter;let labels='';
      const image=card.querySelector('.card-pic img'),url=portrait(id,editSide);if(image.src!==url)image.src=url;
      selected.forEach((pick,s)=>{card.classList.toggle('owns'+s,pick===id);if(pick===id)labels+='<b class="mini-tag" style="--player:var(--p'+(s+1)+')">'+seat(s)+'</b>'});
      card.querySelector('.tags').innerHTML=labels;card.setAttribute('aria-label','为 '+seat(editSide)+' 选择 '+roster[id].name);
      card.setAttribute('aria-pressed',String(selected[editSide]===id));
    });
  }
  function cyclePick(side,direction){
    editSide=side;const index=order.indexOf(selected[side]);
    selectHero(side,order[(index+direction+order.length)%order.length]);
  }
  let pickToken=0,lastPick='',lastPickedAt=-10000;
  function selectHero(side,id){
    selected[side]=id;drawSelection();ArcadeAudio.play('choose',{id,side});
    const now=performance.now(),token=++pickToken;
    if(!sound||!dialogue||game||startPending)return;
    const skin=equipped(id,side),pick=id+'.'+skin,clips=MEDIA.lines[id];
    if(lastPick===pick&&now-lastPickedAt<1000*clips[ArenaProgress.voiceKey(clips,'selection',skin)].duration+650)return;
    window.setTimeout(async()=>{
      if(token!==pickToken||!sound||!dialogue||game||startPending||modal.open||$('guild').open)return;
      if(!await ArcadeAudio.unlock()||token!==pickToken||!sound||!dialogue||game||startPending)return;
      lastPick=pick;lastPickedAt=performance.now();
      void ArcadeAudio.speak(id,'selection',side,null,true,0,skin);
    },90);
  }
  const modal=$('modal');
  let showcase=null,manualSide=null;
  function manualSkin(id){
    return equipped(id,manualSide!==null&&selected[manualSide]===id?manualSide:null);
  }
  function leaveShowcase(){if(showcase){showcase.close();showcase=null}}
  function previewSkill(id,slot){
    const slots=['skill1','skill2','ult'],fighter=roster[id];
    const skill=fighter.skills[slots.indexOf(slot)];
    if(!showcase||showcase.actor!==id){
      const tabs=fighter.skills.map((s,i)=>'<button class="command" data-showcase="'+id+'" data-slot="'+slots[i]+'">'+s.name+'</button>').join('');
      openPanel('showcase','',skill.name,'<canvas class="showcase-stage" width="1200" height="600" aria-label="雨夜天台招式试演"></canvas><div class="showcase-toolbar">'+tabs+'</div><div class="showcase-footer"><button class="command" data-codex="'+id+'">返回秘技典籍</button><button class="command" data-show-again>重播</button></div><p class="showcase-status" role="status"></p>');
      const canvas=modal.querySelector('.showcase-stage'); canvas.setAttribute('aria-label',stageTitle()+'招式试演');
      showcase=new ArenaShowcase(canvas,id,sprites,backdrop,framePlayer,cinema,()=>{canvas.dataset.playing='false'},manualSkin(id));showcase.renderer.setStage(stageId);
    }
    const current=showcase,canvas=current.canvas,status=modal.querySelector('.showcase-status');
    current.slot=slot;canvas.dataset.playing='loading';$('modal-title').textContent=skill.name;
    modal.querySelectorAll('.showcase-toolbar button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.slot===slot)));
    status.textContent='载入招式…';
    prepareImages([id,current.opponent],stageId).then(()=>{if(showcase!==current||current.slot!==slot)return;return current.play(slot)})
      .then(()=>{if(showcase===current&&current.slot===slot){status.textContent='';canvas.dataset.playing='true'}})
      .catch(e=>{if(showcase===current){status.textContent='招式素材读取失败，请重新打开游戏。';console.error(e)}});
  }
  let replay=null,replayQueue=Promise.resolve(),replayMove='kick0',replaySpeed=1;
  function disposeReplay(){
    if(!replay)return;
    cancelAnimationFrame(replay.raf);
    replay.resize?.disconnect();
    if(replay.privatePlayer)replay.player.loaded.clear();
    replay=null;
  }
  function setupReplay(view){
    const id=view.dataset.replayId,actor=MEDIA.motion.actors[id];
    const choice=view.querySelector('.replay-move'),speed=view.querySelector('.replay-rate');
    const slider=view.querySelector('.replay-frame'),output=view.querySelector('output'),button=view.querySelector('.replay-play');
    const canvas=view.querySelector('canvas'),ctx=canvas.getContext('2d'),status=view.querySelector('.replay-status');
    choice.value=replayMove;speed.value=String(replaySpeed===1?1:replaySpeed===.5?'.5':'.25');
    const skin=manualSkin(id);
    const state={player:new ArenaSkins.FramePlayer(MEDIA.motion,MEDIA.sheet,()=>skin),privatePlayer:true,
      ready:false,playing:!matchMedia('(prefers-reduced-motion: reduce)').matches,index:0,carry:0,last:0,raf:0};
    replay=state;
    let zoom=1,center=canvas.width*.5,floor=canvas.height-13;
    function fitMove(){
      const move=choice.value,[start,length]=actor.clips[move];
      const density=actor.nativeScale?.[move]||MEDIA.motion.scale;
      let left=0,right=0,top=0,bottom=0;
      const body=MEDIA.bodyMotion?.[id+'-'+skin];
      if(body){
        for(const pose of Object.values(body.poses)){
          const [x,y,w,h]=pose.box;
          left=Math.min(left,x-10);right=Math.max(right,x+w+10);
          top=Math.min(top,y-10);bottom=Math.max(bottom,y+h+5);
          if(skin==='ultra'){
            const [fx,fy]=pose.face;
            const halo=ArenaRegalia.placement({nx:fx,ny:fy+16,len:40},false),margin=halo.r*1.15;
            left=Math.min(left,halo.x-margin);right=Math.max(right,halo.x+margin);
            top=Math.min(top,halo.y-margin);bottom=Math.max(bottom,halo.y+margin);
          }
        }
      }else if(painted){
        for(const [,key] of painted.clips[move]){
          const [x,y,w,h]=painted.poses[key];
          left=Math.min(left,x-3);right=Math.max(right,x+w+3);
          top=Math.min(top,y-3);bottom=Math.max(bottom,y+h+3);
        }
      }else{
        for(let i=start;i<start+length;i++){
          const [,,,w,h,x,y]=actor.frames[i];
          left=Math.min(left,x/density);right=Math.max(right,(x+w)/density);
          top=Math.min(top,y/density);bottom=Math.max(bottom,(y+h)/density);
        }
      }
      zoom=Math.min((canvas.width-26)/Math.max(1,right-left),(canvas.height-26)/Math.max(1,bottom-top));
      center=(canvas.width-zoom*(left+right))*.5;
      floor=canvas.height-13-zoom*bottom;
    }
    const painted=state.player.painted&&ArenaRegalia.rank(skin)<=0?MEDIA.painted?.[id]:null;
    let times=[0,1];
    function count(){return times.length}
    function refreshStill(){
      if(!state.ready||state.playing)return;
      const move=choice.value,t=times[state.index];
      const job=painted?state.player.painted.readyAt(id,move,t):ArenaFullBody.readyAt(id,skin,move,t);
      job.then(()=>{if(replay===state&&!state.playing&&choice.value===move&&times[state.index]===t)draw();})
         .catch(error=>{if(replay===state){status.hidden=false;status.textContent='此帧素材读取失败';}console.error(error);});
    }
    function draw(){
      if(!state.ready)return;
      const width=canvas.getBoundingClientRect().width;
      if(width>0&&ArenaRenderer.sizeCanvas(canvas,width,width*368/576,MEDIA.phone))fitMove();
      ctx.imageSmoothingQuality=MEDIA.phone?'low':'high';
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#79818e';ctx.fillRect(0,Math.round(floor),canvas.width,1);
      ctx.setTransform(zoom,0,0,zoom,center,floor);
      const t=times[state.index],n=actor.clips[choice.value][1];
      if(skin==='ultra'){
        const move=choice.value,anchor=ArenaFullBody.anchor(id,skin,move,state.index,count(),t);
        const h=ArenaRegalia.placement(anchor,move==='ko');
        const seconds=t*n/MEDIA.motion.fps;
        ArenaRegalia.halo(ctx,id,h.x,h.y,h.r,seconds,matchMedia('(prefers-reduced-motion: reduce)').matches,move==='ult'?Math.sin(Math.PI*t):0);
      }
      state.player.drawFrame(ctx,id,choice.value,Math.round(t*(n-1)),t);
      slider.value=String(state.index);output.value=(state.index+1)+' / '+count();
      slider.setAttribute('aria-valuetext','第 '+(state.index+1)+' 帧，共 '+count()+' 帧');
    }
    function tick(now){
      if(replay!==state||!state.playing||!state.ready)return;
      if(state.last)state.carry=(state.carry+Math.min(.1,(now-state.last)/1000)*MEDIA.motion.fps*replaySpeed/actor.clips[choice.value][1])%1;
      state.last=now;
      let next=state.index;
      if(times[next]>state.carry)next=0;
      while(next+1<count()&&state.carry>=(times[next+1]+times[next])*.5)next++;
      if(next!==state.index){state.index=next;draw()}
      state.raf=requestAnimationFrame(tick);
    }
    function setPlaying(on){
      cancelAnimationFrame(state.raf);state.playing=on;state.last=0;
      button.textContent=on?'暂停':'播放';
      if(on&&state.ready){state.carry=times[state.index];state.raf=requestAnimationFrame(tick);}
      else refreshStill();
    }
    function choose(){
      const n=actor.clips[choice.value][1];
      times=painted?.clips[choice.value]?.map(([t])=>t)??ArenaFullBody.replayTimes(id,skin,choice.value,n)??Array.from({length:n},(_,i)=>i/Math.max(1,n-1));
      replayMove=choice.value;state.index=0;state.carry=0;state.last=0;slider.max=String(count()-1);fitMove();draw();refreshStill();
    }
    if(typeof ResizeObserver==='function'){
      state.resize=new ResizeObserver(draw);state.resize.observe(canvas);
    }
    choice.onchange=choose;speed.onchange=()=>{replaySpeed=Number(speed.value);state.last=0;};
    slider.oninput=()=>{setPlaying(false);state.index=Number(slider.value);state.carry=times[state.index];draw();refreshStill()};
    button.onclick=()=>setPlaying(!state.playing);
    // Decode at most one extra character while rapidly changing tabs. A paused match
    // keeps ownership of its two live fighters and can lend them to the preview.
    replayQueue=replayQueue.then(async()=>{
      if(replay!==state)return;
      try{
        if(state.privatePlayer)await state.player.prepare([id]);
        if(replay!==state){if(state.privatePlayer)state.player.loaded.clear();return}
        state.ready=true;button.disabled=false;slider.disabled=false;status.hidden=true;
        choose();setPlaying(state.playing);
      }catch(error){if(replay===state){status.textContent='读取失败，请收起后重开';console.error(error)}}
    });
  }
  function bindReplay(expanded){
    const view=modal.querySelector('.m-replay');
    view.ontoggle=()=>{
      if(!view.isConnected)return;
      if(view.open){disposeReplay();setupReplay(view)}else disposeReplay();
    };
    view.open=expanded;
  }
  function openPanel(kind,en,title,body){
    leaveShowcase();
    disposeReplay();
    if(!modal.open) previousFocus=document.activeElement;
    if(game&&!isOnline()&&!game.state.paused){game.pause(true);resetInput();ArcadeAudio.setScene('pause')}
    if(isOnline())resetInput();
    panel=kind;$('modal-en').textContent=en;$('modal-title').textContent=title;$('modal-body').innerHTML=body;displayDialogue();showSound();
    showControlMode();
    $('nav-codex').classList.toggle('selected',kind==='codex');
    $('nav-lobby').classList.toggle('selected',kind!=='codex');
    if(!modal.open)modal.showModal();modal.scrollTop=0;
  }
  function closePanel(resume=true){
    leaveShowcase();
    disposeReplay();
    if(modal.open)modal.close();panel='';guideReturn='';
    $('nav-codex').classList.remove('selected');$('nav-lobby').classList.add('selected');
    if(game&&resume&&!isOnline()){game.pause(false);resetInput();ArcadeAudio.setScene('fight');lastFrame=performance.now()}
    if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});previousFocus=null;
  }
  function routeClose(){
    if(panel==='showcase'&&showcase)return showManual('codex',showcase.actor);
    if(panel==='result')return lobby();
    if(panel==='pause')return closePanel();
    if(guideReturn==='pause'&&game)return pauseMenu();
    if(guideReturn==='result'&&game)return results();
    closePanel();
  }
  function showManual(kind,id,side){
    if(panel==='pause'||panel==='result')guideReturn=panel;
    else if(!modal.open&&game)guideReturn=game.state.phase==='matchOver'?'result':'';
    if(kind==='codex'){
      const expanded=Boolean(modal.querySelector('.m-replay')?.open&&panel==='codex');
      if(side!==undefined)manualSide=side;
      else if(panel!=='codex'&&panel!=='showcase')manualSide=null;
      const hero=id||selected[editSide];
      openPanel('codex','','秘技典籍',ArenaManual.codex(hero,manualSkin(hero)));bindReplay(expanded);
    }
    else if(kind==='guide')openPanel('guide','','操作说明',ArenaManual.guide(solo(),isOnline()));
    else openPanel('credits','','制作名单',ArenaManual.credits());
  }
  function resetInput(){
    releaseLocalHolds();game?.clearInput();cpu?.reset();
  }
  function releaseLocalHolds(){
    keyboardHeld.forEach(h=>h.clear());padHeld.forEach(h=>h.clear());
    padControls.reset();touchHeld.forEach(h=>h.clear());
  }
  const padControls=new ArenaTouch($('touch-controls'),{
    enabled:()=>controlMode==='touch'&&Boolean(game)&&!game.state.paused&&!modal.open&&!$('guild').open&&(!isOnline()||!network.inputPaused),
    input(side,action,down){
      if(down){unlock();touchHeld[side].add(action);}else touchHeld[side].delete(action);
      sendInput(side,action);
    }
  });
  function drawTouchControls(){
    const sides=isOnline()?(network.room?[network.room.selfSide]:[]):solo()?[0]:[0,1];
    padControls.configure(sides.map(side=>({side,label:seat(side),id:selected[side],skills:roster[selected[side]].skills.map(s=>s.name)})));
  }
  function useControls(value,persist=true){
    if(value!==controlMode){
      resetInput();controlMode=value;
      if(game)drawTouchControls();
    }
    if(persist)remember('controls',value);
    showControlMode();
  }
  touchDevice.addEventListener('change',()=>useControls(preferredControls(),false));
  function pauseMenu(){
    if(!game)return;
    if(isOnline())return network.open('rooms');
    if(game.state.phase==='matchOver')return results();
    guideReturn='';
    openPanel('pause','','对战暂停','<p class="modal-copy">'+roster[selected[0]].name+' 对 '+roster[selected[1]].name+' · 第 '+game.state.round+' 局</p>'+(soloDriver?'<p class="modal-copy">中途退出试炼按落败结算。</p>':'')+'<div class="modal-actions"><button class="command primary" data-act="resume">继续对战</button><button class="command" data-act="guide">操作说明</button><button class="command" data-act="codex">秘技典籍</button><button class="command" data-act="quit">返回选角</button></div>');
  }
  function drawReceipt(){
    const node=$('trial-result');if(!node||!receiptState)return;
    node.textContent=receiptState.text;
    const retry=$('trial-retry');if(retry)retry.hidden=!receiptState.failed;
    const onward=$('promotion-next');
    if(onward){
      const path=network.user&&ArenaProgress.path(network.user.progress);
      onward.disabled=receiptState.pending||receiptState.failed;
      onward.textContent=soloDriver?.report?.seriesStatus==='failed'?'重试晋级赛':path?.ready&&path?.kind==='series'?'迎战 '+roster[path.nextOpponent].name:'查看晋级进度';
    }
  }
  function settleTrial(){
    if(!soloDriver||receiptState?.pending)return;
    const receipt=receiptState={pending:true,failed:false,text:'正在结算 Token…'};
    drawReceipt();
    network.finishSolo(soloDriver).then(text=>{receipt.text=text;}).catch(error=>{
      receipt.text=error.message;receipt.failed=true;
    }).finally(()=>{receipt.pending=false;if(receipt===receiptState)drawReceipt();});
  }
  function results(){
    if(!game)return;
    if(isOnline()){closePanel(false);network.open('rooms');return;}
    const s=game.state,w=s.winner;guideReturn='';
    const onward=soloDriver?.ticket.promotion?'<button id="promotion-next" class="command primary" data-act="promotion-next">继续晋级</button>':'<button class="command primary" data-act="rematch">原阵容再战</button>';
    openPanel('result','', seat(w)+' · '+roster[selected[w]].name+' 获胜','<p class="result-score">'+s.wins[0]+' <span>:</span> '+s.wins[1]+'</p><p class="modal-copy">'+(solo()?trialLabel(soloDriver?.ticket):'本地双人')+' · '+stageTitle()+' · 共 '+s.round+' 局</p><p id="trial-result" class="modal-copy" role="status"></p><div class="modal-actions"><button id="trial-retry" class="command" data-act="retry-trial" hidden>重试结算</button>'+onward+'<button class="command" data-act="quit">返回选角</button></div>');drawReceipt();
  }
  const launch=document.querySelector('[data-act="start"]'),defaultLaunchText=launch.innerHTML;
  function lobby(){
    matchSkins=null;
    ArenaFullBody.keepMatch([],[]);
    matchToken++;startPending=false;closePanel(false);cpu=null;game=null;soloDriver=null;receiptState=null;cinema.reset();showing='lobby';$('battle').hidden=true;$('lobby').hidden=false;
    $('lobby').inert=false;$('lobby').removeAttribute('aria-busy');launch.innerHTML=defaultLaunchText;
    ArcadeAudio.setScene('menu');drawSelection();resetInput();window.scrollTo(0,0);
  }
  function hudTemplate(side){
    const id=selected[side],r=roster[id];
    return '<div class="avatar" style="'+theme(id)+'"><img src="'+portrait(id,side)+'" alt=""><canvas class="face-film" width="256" height="256" aria-hidden="true"></canvas></div>'+
      '<div class="hud-track"><div class="hud-name"><b>'+seat(side)+'</b><strong>'+r.name+'</strong><span class="duelist"></span>'+
      '<span class="round-dots" aria-label="本场回合胜数"><i></i><i></i></span></div>'+
      '<div class="life" role="meter" aria-label="生命" aria-valuemin="0" aria-valuemax="100"><span></span><i></i></div>'+
      '<div class="hud-resources"><div class="power" title="奥义能量"><span></span></div>'+
      '<div class="guard-meter" title="架势"><span></span></div><span class="life-number"></span></div><span class="escape-hint" hidden></span></div>';
  }
  function continuePromotion(){
    if(receiptState?.pending||receiptState?.failed)return;
    const path=network.user&&ArenaProgress.path(network.user.progress);
    if(path?.kind==='series'&&path.ready)return start(null,null,{series:true,opponent:path.nextOpponent});
    lobby();network.open('account');
  }
  async function start(remote=null,room=null,challenge=null){
    if(startPending&&!remote)return;
    if(challenge){mode='solo';level='hard';selected[1]=challenge.opponent;editSide=0;}
    if(remote){
      game=null;cpu=null;
      room.players.forEach((p,i)=>{selected[i]=p.fighter;});stageId=room.stage;displayStage();
    }
    startPending=true;const token=++matchToken;pickToken++;unlock();ArcadeAudio.play('start');
    $('lobby').inert=true;$('lobby').setAttribute('aria-busy','true');
    launch.textContent='载入动作…';
    try{
      const guardForm=challenge?.series&&network.user?ArenaProgress.path(network.user.progress).next?.id:null;
      const skins=remote?room.players.map(p=>p.skin||'base'):selected.map((id,side)=>
        mode==='solo'&&side===1?(guardForm||'base'):network.skinFor(id));
      ArenaFullBody.keepMatch(selected,skins);
      const original=selected.filter((_,side)=>ArenaRegalia.rank(skins[side])<=0);
      const warm=(heroes,originals)=>Promise.all([prepareImages(originals,stageId),framePlayer.prepare(heroes,skins),cinema.prepare(heroes)]);
      await warm(selected,original);if(token!==matchToken)return;
      if(soloDriver?.sending)await soloDriver.sending;
      const ticket=!remote&&mode==='solo'?await network.beginSolo(selected[0],selected[1],level,Boolean(sound&&dialogue),Boolean(challenge?.series)):null;
      if(challenge&&!ticket)throw new Error('请登录账号后参加晋级挑战。');
      if(ticket&&(ticket.hero!==selected[0]||ticket.opponent!==selected[1]||skins[1]!== (ticket.promotion||'base')||skins[0]!==network.skinFor(ticket.hero))){
        selected[0]=ticket.hero;selected[1]=ticket.opponent;skins[0]=network.skinFor(ticket.hero);skins[1]=ticket.promotion||'base';
        ArenaFullBody.keepMatch(selected,skins);
        await warm(selected,selected.filter((id,i)=>ArenaRegalia.rank(skins[i])<=0));
      }
      if(token!==matchToken)return;
      closePanel(false);showing='fight';$('lobby').hidden=true;$('battle').hidden=false;
      matchSkins=skins;
      game=remote||new ArenaEngine.Match(...selected,ticket?ArenaProgress.trialOpening(ticket):
        (sound&&dialogue?ArenaProgress.introDurations(MEDIA.lines,selected,skins):null));
      game.voiceSkins=skins;
      game.state.cpuSide=solo()?1:-1;
      cpu=solo()?new ArenaCPU(game,ticket?.cpuLevel||ticket?.level||level,ticket?.seed):null;
      soloDriver=ticket?network.trackSolo(game,cpu,ticket):null;receiptState=null;
      const menu=document.querySelector('[data-act="pause"]');menu.innerHTML=icon('pause')+'<span>'+(isOnline()?'房间':'暂停')+'</span>';menu.setAttribute('aria-label',isOnline()?'对战房间':'暂停对战');
      $('battle-format').textContent=isOnline()?'誓约排位 · '+room.code:solo()?trialLabel(ticket):'同屏决斗';
      document.querySelector('.movement-help span:first-child b').textContent=isOnline()?'我方':'1P';
      $('other-controls').innerHTML=isOnline()?'F 普攻 · G / H 秘技 · T 奥义':solo()?'<b>CPU</b> '+({master:'宗师',champion:'守关者'}[ticket?.cpuLevel]||levels[ticket?.level||level])+' · '+roster[selected[1]].name:'<b>2P</b> ← / → 移动 · ↑ 跳跃 · ↓ 格挡';
      superBanners.forEach(el=>el.hidden=true);
      if(!renderer)renderer=new ArenaRenderer($('arena'),{background:backdrop,sprites,framePlayer,cinema,stageId});
      renderer.setStage(stageId);
      resetInput();selected.forEach((id,s)=>{
        const hud=$('hud'+s);hud.innerHTML=hudTemplate(s);
        hud.querySelector('.duelist').textContent=isOnline()?room.players[s].name:ticket?.promotion&&s===1?ArenaSkins.title(id,skins[1]):'';
        toasts[s].until=0;
      });
      drawTouchControls();
      Object.keys(lastHud).forEach(k=>delete lastHud[k]);victorySince=0;roundUntil=0;
      ArcadeAudio.setScene('fight');ArcadeAudio.syncMatch(game,voiceSide());
      lastFrame=performance.now();window.scrollTo(0,0);updateHud(game.state);renderer.render(game.state,0);
    }catch(error){console.error(error);lobby();openPanel('error','','未能进入战场','<p class="modal-copy" id="launch-error"></p>');$('launch-error').textContent=error.message;}
    finally{if(token===matchToken){startPending=false;$('lobby').inert=false;$('lobby').removeAttribute('aria-busy');launch.innerHTML=defaultLaunchText;}}
  }
  function changeText(key,value){
    if(lastHud[key]===value)return;lastHud[key]=value;$(key).textContent=value;
  }
  function updateHud(s){
    changeText('round-text','第 '+s.round+' 局');changeText('timer',String(Math.ceil(s.time)).padStart(2,'0'));
    for(const f of s.fighters){
      const root=$('hud'+f.side), bars=[['life',f.hp],['power',f.energy],['guard-meter',f.guardMeter]];
      framePlayer.paintFace(root.querySelector('.face-film'),f,s);
      for(const [key,value] of bars){
        const rounded=Math.round(value*10)/10, cache=f.side+key;
        if(lastHud[cache]===rounded)continue;lastHud[cache]=rounded;
        const bar=root.querySelector('.'+key);bar.firstElementChild.style.transform='scaleX('+Math.max(0,rounded)/100+')';
        if(key==='life'){
          bar.setAttribute('aria-valuenow',String(rounded));
          bar.lastElementChild.style.transform='scaleX('+Math.max(0,rounded)/100+')';
          root.querySelector('.life-number').textContent=String(rounded);
        }
      }
      if(controlMode==='touch')padControls.update(f.side,f);
      root.querySelectorAll('.round-dots i').forEach((d,i)=>d.classList.toggle('won',s.wins[f.side]>i));
      const escapeHint=root.querySelector('.escape-hint');
      const canEscape=f.stun>0 && s.fighters[1-f.side].combo>=3 && f.energy>=35 && f.escapeCd<=0;
      if(escapeHint.hidden===canEscape){
        escapeHint.hidden=!canEscape;
        escapeHint.textContent=(controlMode==='touch'?'下拨':isOnline()?'S':f.side?'↓':'S')+' 解围';
      }
      const info=roster[f.id],labels=keyboardLabels[isOnline()?0:f.side];
      const skills=['attack','skill1','skill2','ult'].map((slot,i)=>{
        const remaining=i>0&&i<3?Math.ceil(f.cd[slot]):0;
        const status=i===3?(f.energy>=100?'ready':'wait'):remaining?'wait':'';
        const txt=i===0?'普攻':info.skills[i-1].name;
        const value=i===3?' '+Math.floor(f.energy)+'%':remaining?' '+remaining+'s':'';
        const keyHint=(isOnline()?f.side!==network.room?.selfSide:solo()&&f.side===1)?'':'<kbd>'+labels[i]+'</kbd>';
        return '<span class="skill-key '+status+'">'+keyHint+txt+value+'</span>';
      }).join('');
      const key='skills'+f.side;if(lastHud[key]!==skills){lastHud[key]=skills;$(key).innerHTML=skills}
      const toast=toasts[f.side];changeText('toast'+f.side,toast.until>s.clock?toast.text:'');
      changeText('combo'+f.side,f.combo>1&&f.comboTime>0?f.combo+' 连击':'');
    }
    let line='',sub='';
    const entrance=s.phase==='intro'&&Boolean(s.opening);
    const speaker=entrance&&dialogue&&sound?ArcadeAudio.openingSeat(s):-1;
    if(lastHud.speaker!==speaker){
      lastHud.speaker=speaker;
      const caption=$('entrance-caption');caption.hidden=speaker<0;
      if(speaker>=0){
        const id=s.fighters[speaker].id;
        caption.firstElementChild.textContent=roster[id].name;
        const clips=MEDIA.lines[id];
        caption.lastElementChild.textContent=clips[ArenaProgress.voiceKey(clips,'intro',matchSkins?.[speaker])].text;
      }
    }
    const canSkip=entrance&&!isOnline();
    if(lastHud.canSkip!==canSkip){lastHud.canSkip=canSkip;$('skip-opening').hidden=!canSkip;}
    if(s.phase==='intro'&&(!entrance||s.phaseTime<=.45)){line='第 '+s.round+' 局';sub=stageTitle()}
    else if(s.phase==='fight'&&s.clock<roundUntil){line='开战';sub=''}
    else if(s.phase==='roundOver'||s.phase==='matchOver'){
      line=s.winner<0?'平局':!s.time?'时限已至':'K.O.';sub=s.winner<0?'平局 · 加赛':seat(s.winner)+' 回合胜利';
    }
    const html=line?'<div class="callout">'+line+'<small>'+sub+'</small></div>':'';
    if(lastHud.announcement!==html){lastHud.announcement=html;$('announcement').innerHTML=html}
  }
  function handleEvents(s){
    for(const e of game.drainEvents()){
      const actingSide=e.type==='parry'?e.defenderSide:e.side;
      const f=s.fighters[actingSide];
      ArcadeAudio.play(e.type,{...e,side:actingSide,id:f?.id,move:e.slot,kind:e.variant,bout:game});
      if(e.type==='fight')roundUntil=s.clock+.45;
      if(e.type==='round')toasts.forEach(t=>{t.until=0});
      if(e.type==='cast'&&f&&['skill1','skill2','ult'].includes(e.slot)){
        const skill=roster[f.id].skills[['skill1','skill2','ult'].indexOf(e.slot)];
        if(e.slot==='ult')superCutin(f,skill);
        toasts[f.side]={text:(e.slot==='ult'?'奥义 · ':'')+skill.name,until:s.clock+(e.slot==='ult'?1.5:.85)};
      }
      if(e.type==='escape'&&f)toasts[f.side]={text:'灵息解围',until:s.clock+.8};
      if(e.type==='hit'&&e.punish&&f)toasts[f.side]={text:'破绽反击',until:s.clock+.65};
      if((e.type==='parry'||e.type==='break')&&f)toasts[f.side]={text:e.type==='parry'?'精准格挡':'架势击破',until:s.clock+.75};
    }
  }
  const actions=['left','right','jump','guard','attack','skill1','skill2','ult'];
  let padStart=false;
  const menuDirections=[0,0];
  function sendInput(s,action){
    if((s===1&&cpu)||(isOnline()&&s!==network.room?.selfSide))return;
    game?.input(s,action,padHeld[s].has(action)||Array.from(keyboardHeld[s].values()).includes(action)||
      touchHeld[s].has(action));
  }
  function padFor(pads,side){
    if(isOnline())return side===network.room?.selfSide?pads[0]:undefined;
    if(solo())return side===0?pads[0]:undefined;
    if(pads.length>1)return pads[side];
    return side===1?pads[0]:undefined;
  }
  function pollPads(){
    if($('guild').open)return;
    let pads;try{pads=Array.from(navigator.getGamepads?.()||[]).filter(p=>p&&p.connected&&p.mapping==='standard')}catch{return}
    const startDown=(solo()?pads.slice(0,1):pads).some(p=>p.buttons[9]?.pressed);
    if(startDown&&!padStart){unlock();if(panel==='pause')closePanel();else if(panel==='result'){if(soloDriver?.ticket.promotion)continuePromotion();else start();}else if(!panel&&game)pauseMenu();else if(!panel)start()}
    padStart=startDown;
    if(!game){
      if(startPending)return;
      for(let side=0;side<2;side++){
        const p=padFor(pads,side);
        const dir=Number(!!(p?.buttons[15]?.pressed||p?.axes[0]>.6))-Number(!!(p?.buttons[14]?.pressed||p?.axes[0]<-.6));
        if(!panel&&dir&&dir!==menuDirections[side])cyclePick(side,dir);menuDirections[side]=dir;
      }
      return;
    }
    if(game.state.paused)return;
    for(let side=0;side<2;side++){
      const p=padFor(pads,side);
      const b=i=>!!p?.buttons[i]?.pressed;
      const axis=p?.axes[0]||0;
      const keys=[axis<-.42||b(14),axis>.42||b(15),b(0)||b(12),b(1)||b(13),b(2),b(3),b(5),b(7)];
      actions.forEach((a,i)=>{if(keys[i]===padHeld[side].has(a))return;if(keys[i])padHeld[side].add(a);else padHeld[side].delete(a);sendInput(side,a)});
    }
  }
  function loop(now){
    pollPads();
    if(game&&showing==='fight'&&!game.state.paused){
      const dt=Math.min(.06,Math.max(0,(now-lastFrame)/1000));
      if(soloDriver)soloDriver.advance(dt);else{cpu?.update(dt);game.update(dt);}
      const state=game.state;ArcadeAudio.syncMatch(game,voiceSide());handleEvents(state);renderer.render(state,dt);updateHud(state);
      if(state.phase==='matchOver'){
        if(!victorySince){victorySince=now;if(soloDriver)settleTrial();}
        else if(now-victorySince>1650&&(!isOnline()||(!game.shownResult&&network.room?.phase==='finished'))){if(isOnline())game.shownResult=true;results();}
      }
    }else if(game&&game.state.paused)ArcadeAudio.syncMatch(game,voiceSide());
    lastFrame=now;requestAnimationFrame(loop);
  }
  function keyEvent(e,down){
    if($('guild').open)return;
    if(down&&!e.repeat)unlock();
    if(down&&e.key==='Tab')tabNavigation=true;
    if(e.code==='Escape'&&down&&!e.repeat){
      e.preventDefault();if(modal.open)routeClose();else if(game)pauseMenu();return;
    }
    if(modal.open)return;
    if(startPending)return;
    if(!game){
      if(!down||e.repeat)return;
      const pick={KeyA:[0,-1],KeyD:[0,1],ArrowLeft:[1,-1],ArrowRight:[1,1]}[e.code];
      if(pick){e.preventDefault();tabNavigation=false;cyclePick(...pick);return}
      if(e.code==='Enter'&&(!tabNavigation||!document.activeElement?.closest('button')||document.activeElement.matches('[data-act="start"]'))){e.preventDefault();start()}
      return;
    }
    keymaps.forEach((map,seatIndex)=>{
      const a=map[e.code];if(!a)return;e.preventDefault();if(e.repeat)return;
      const s=isOnline()?network.room?.selfSide:solo()?0:seatIndex;
      if(s==null)return;
      if(down)keyboardHeld[s].set(e.code,a);else keyboardHeld[s].delete(e.code);sendInput(s,a);
    });
  }
  document.addEventListener('keydown',e=>keyEvent(e,true));document.addEventListener('keyup',e=>keyEvent(e,false));
  document.addEventListener('pointerdown',()=>{tabNavigation=false});
  document.addEventListener('click',e=>{
    const btn=e.target.closest('button');if(!btn)return;unlock();
    if(btn.dataset.webQuality&&!game){
      const url=new URL(location.href),quality=btn.dataset.webQuality;
      url.pathname=quality==='uhd'?'/pc/':'/mobile/';url.searchParams.set('quality',quality);
      location.assign(url.href);return;
    }
    if(btn.dataset.controlsMode){useControls(btn.dataset.controlsMode);return;}
    if(btn.dataset.stage){stageId=btn.dataset.stage;remember('stage',stageId);displayStage();ArcadeAudio.play('choose');return;}
    if(btn.dataset.voiceSide!==undefined){localVoiceSide=Number(btn.dataset.voiceSide);remember('voiceSide',String(localVoiceSide));displayDialogue();if(game)ArcadeAudio.syncMatch(game,voiceSide());return;}
    if(btn.dataset.act==='skip-opening'){if(game&&!isOnline()&&game.skipOpening()){resetInput();ArcadeAudio.syncMatch(game,voiceSide());updateHud(game.state);}return;}
    if(btn.dataset.voiceLine){if(sound)void ArcadeAudio.speak(btn.dataset.voiceId,btn.dataset.voiceLine,0,null,true,0,manualSkin(btn.dataset.voiceId));return;}
    if(btn.dataset.listen){if(sound)void ArcadeAudio.speak(btn.dataset.listen,'intro',0,null,true,0,manualSkin(btn.dataset.listen));return;}
    if(btn.dataset.mode){mode=btn.dataset.mode;remember('mode',mode);editSide=0;drawSelection();ArcadeAudio.play('choose');return}
    if(btn.dataset.level){level=btn.dataset.level;remember('level',level);drawSelection();ArcadeAudio.play('choose');return}
    if(btn.dataset.codex){showManual('codex',btn.dataset.codex,btn.hasAttribute('data-codex-side')?Number(btn.dataset.codexSide):undefined);return}
    if(btn.dataset.showcase){previewSkill(btn.dataset.showcase,btn.dataset.slot);return}
    if(btn.hasAttribute('data-show-again')&&showcase){previewSkill(showcase.actor,showcase.slot);return}
    if(btn.dataset.replayMove){
      const view=modal.querySelector('.m-replay');
      replayMove=btn.dataset.replayMove;view.open=true;
      const select=view.querySelector('.replay-move');select.value=replayMove;
      select.dispatchEvent(new Event('change'));view.scrollIntoView({block:'nearest'});return;
    }
    if(btn.dataset.side!==undefined){editSide=Number(btn.dataset.side);drawSelection();ArcadeAudio.play('choose',{side:editSide});return}
    if(btn.dataset.fighter){selectHero(editSide,btn.dataset.fighter);return}
    switch(btn.dataset.act){
      case 'lobby':if(game)pauseMenu();else lobby();break;
      case 'quit':if(soloDriver&&game?.state.phase!=='matchOver'){
        const exiting=soloDriver;btn.disabled=true;
        network.abandonSolo(exiting).then(()=>{if(soloDriver===exiting)lobby();}).catch(error=>{btn.disabled=false;const n=document.createElement('p');n.setAttribute('role','alert');n.textContent=error.message;$('modal-body').append(n);});
      }else lobby();break;
      case 'retry-trial':settleTrial();break;
      case 'promotion-next':continuePromotion();break;
      case 'start':case 'rematch':start();break;
      case 'combat-volume':effectLevel=effectLevels[(effectLevels.indexOf(effectLevel)+1)%effectLevels.length];remember('combatVolume',String(effectLevel));ArcadeAudio.setCombatVolume(effectLevel/100);showSound();break;
      case 'dialogue':dialogue=!dialogue;remember('dialogue',dialogue?'full':'ko');ArcadeAudio.setDialogue(dialogue);displayDialogue();break;
      case 'sound':sound=!sound;try{localStorage.setItem('neural-clash:sound',sound?'on':'off')}catch{}ArcadeAudio.setEnabled(sound);showSound();break;
      case 'guide':case 'codex':case 'credits':showManual(btn.dataset.act);break;
      case 'pause':pauseMenu();break;
      case 'resume':closePanel();break;
      case 'close':routeClose();break;
      case 'full':if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>{});break;
    }
  });
  modal.addEventListener('cancel',e=>{e.preventDefault();routeClose()});
  modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)routeClose()}});
  function loseFocus(){if(game&&!isOnline()&&!game.state.paused&&!modal.open&&!$('guild').open)pauseMenu();resetInput()}
  window.addEventListener('blur',loseFocus);document.addEventListener('visibilitychange',()=>{if(document.hidden)loseFocus()});
  const netHealth=document.createElement('span');netHealth.className='net-health';netHealth.setAttribute('role','status');arenaWrap.append(netHealth);
  let guildPaused=false;
  network=new ArenaNetwork({
    pick:()=>({fighter:selected[0],stage:stageId}),
    challenge:selection=>start(null,null,selection),
    hasActiveBattle:()=>Boolean(game&&game.state.phase!=='matchOver'),
    wardrobeFighter:()=>selected[solo()?0:editSide],
    previewTier:ArcadeAudio.previewTier,
    stopSelectionPreview:ArcadeAudio.stopSelectionPreview,
    prepare:(players,stage)=>{
      const ids=players.map(p=>p.fighter),skins=players.map(p=>p.skin||'base');
      return Promise.all([prepareImages(ids.filter((_,i)=>ArenaRegalia.rank(skins[i])<=0),stage),framePlayer.prepare(ids,skins),cinema.prepare(ids)]);
    },
    resetHeld:releaseLocalHolds,
    enterDialog(){pickToken++;guildPaused=Boolean(game&&!isOnline()&&!game.state.paused&&!modal.open);if(guildPaused){game.pause(true);ArcadeAudio.setScene('pause');}resetInput();},
    leaveDialog(){if(guildPaused&&game&&!isOnline()&&!modal.open){game.pause(false);ArcadeAudio.setScene('fight');lastFrame=performance.now();}guildPaused=false;},
    battle:(remote,room)=>start(remote,room),
    inBattle:()=>isOnline(),
    exit(){if(isOnline()||startPending&&network.remote===null){lobby();stageId=preference('stage',ArenaStages.list.map(s=>s.id),'astral');displayStage();}netHealth.textContent='';},
    finished(){if(isOnline()&&game.state.phase==='matchOver'&&$('guild').open)network.render();},
    connection:text=>{netHealth.textContent=text;}
  });
  window.addEventListener('arena-wardrobe',()=>{if(!game)drawSelection();});
  void network.init();
  sound=readSound();ArcadeAudio.setEnabled(sound);ArcadeAudio.setDialogue(dialogue);showSound();drawSelection();requestAnimationFrame(loop);
})();
