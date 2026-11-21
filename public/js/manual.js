(() => {
  "use strict";
  const order = ["deepseek", "chatgpt", "claude", "gemini", "grok", "kimi"];
  const tactics = {
    deepseek:"用破浪之刃逼对手起跳，再用潮鸣之泉压住落点。",
    chatgpt:"用翠龙回刃牵制远处的对手。对方贴身出招时，开六环龙印抓住反击机会。",
    claude:"在身前埋下烬印，用三张绯页封住接近路线。对方被逼退时，翻开禁书，放出火凰。",
    gemini:"双星逼对手格挡时，用星镜幻步绕到背后，接普攻连段。",
    grok:"把陨星放在对手的退路上。对方跳起脱身时，用裂空斧迎击。",
    kimi:"用错拍飞弦截住空中的对手，落地时用弦月连斩抢回近身距离。"
  };
  const style = `<style>
    .arc-manual{--line:#494854;--lime:#edcf91;color:#f4eddf;font-size:14px;text-align:left}
    .arc-manual *, .arc-manual *::before{box-sizing:border-box}
    .arc-manual p{margin:0;color:#c6c9c9;line-height:1.65}
    .arc-manual h3,.arc-manual h4{margin:0;line-height:1.3}
    .arc-manual .m-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 15px}
    .arc-manual .m-tabs button{font:700 12px var(--mono,monospace);padding:6px 9px;border:1px solid var(--line);background:#202329;color:#cdd2d2;cursor:pointer}
    .arc-manual .m-tabs button[aria-pressed="true"]{background:var(--lime);border-color:var(--lime);color:#13160f}
    .arc-manual button:focus-visible,.arc-manual a:focus-visible{outline:2px solid white;outline-offset:2px}
    .arc-manual .m-hero{display:flex;align-items:center;justify-content:space-between;position:relative;isolation:isolate;overflow:hidden;min-height:105px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:16px 18px;background:linear-gradient(110deg,#252b32,#15191e 82%)}
    .arc-manual .m-hero img{position:absolute;height:410px;right:4%;top:-21px;z-index:-1;object-fit:contain}
    .arc-manual .m-hero div{background:linear-gradient(90deg,#252b32 60%,transparent);padding-right:40px;max-width:75%}
    .arc-manual .m-hero strong{display:block;font:600 clamp(29px,4.4vw,38px)/1 Georgia,serif;letter-spacing:-1px}
    .arc-manual .m-hero span{color:var(--m-col);display:block;font-size:13px;font-weight:700;margin-top:6px}
    .arc-manual .m-hero small{display:block;color:#c9cbcd;margin-top:5px}
    .arc-manual .m-move{display:grid;grid-template-columns:92px minmax(0,1fr);column-gap:17px;padding:16px 0;border-bottom:1px solid var(--line)}
    .arc-manual .m-rank{color:#bfc1bc;font-size:12px}.arc-manual .m-move:last-child .m-rank{color:var(--lime)}
    .arc-manual .m-keys{font:600 10px var(--mono,monospace);color:#acaeb3;display:grid;gap:4px;margin-top:6px;white-space:nowrap}
    .arc-manual kbd{display:inline-block;margin-left:3px;min-width:19px;text-align:center;border:1px solid #60646b;border-bottom-width:2px;padding:1px 4px;border-radius:2px;background:#25282d;color:#f5f5ee;font:700 11px var(--mono,monospace)}
    .arc-manual .m-move h4{font-size:17px}.arc-manual .m-move h4 small{display:inline-block;color:#acb0b3;font-size:11px;font-weight:500;margin-left:10px}
    .arc-manual .m-move p{margin-top:5px}.arc-manual .m-counter{font-size:13px}
    .arc-manual .m-counter b{color:var(--m-col,var(--lime));font-size:12px;margin-right:7px}
    .arc-manual table{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0 14px;text-align:left}.arc-manual th,.arc-manual td{padding:6px 8px;border-bottom:1px solid var(--line)}.arc-manual th{color:var(--lime);font-size:12px}.arc-manual th:first-child,.arc-manual td:first-child{padding-left:0}
    .arc-manual .m-section{margin:14px 0 4px;font-size:16px}.arc-manual .m-notes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 22px;margin-top:10px}
    .arc-manual .m-notes b,.arc-manual .m-credit b{color:var(--lime);font-size:13px;display:block;margin-bottom:3px}
    .arc-manual .m-credit{padding:13px 0;border-bottom:1px solid var(--line)}.arc-manual .m-credit:first-child{padding-top:1px}
    .arc-manual a{color:#e3efbb;text-underline-offset:3px}
    @media(max-width:550px){.arc-manual{font-size:13px}.arc-manual .m-tabs{gap:4px}.arc-manual .m-tabs button{font-size:11px;padding:5px}
      .arc-manual .m-move{grid-template-columns:60px 1fr;gap:10px;padding:11px 0}.arc-manual .m-move h4 small{display:block;margin:2px 0}
      .arc-manual .m-notes{grid-template-columns:1fr}.arc-manual td,.arc-manual th{padding:5px 3px}.arc-manual .m-hero img{right:-28px;height:350px}.arc-manual .m-hero{padding:10px;min-height:93px}}
  </style>`;

  const outer = html => style + '<section class="arc-manual">' + html + '</section>';
  const key = label => '<kbd>' + label + '</kbd>';
  const pair = (p1, p2) => '<div class="m-keys"><span>1P ' + key(p1) + '</span><span>2P ' + key(p2) + '</span></div>';
  function replayPanel(id,fighter) {
    const skills=fighter.skills.map((skill,i)=>[['skill1','skill2','ult'][i],skill.name+(i===2?' · 奥义':'')]);
    const groups=[
      ['普攻',id==='grok'?[['jab','第一段 · 横扫'],['cross','第二段 · 斜劈'],['kick0','第三段 · 侧踢'],['kick1','第三段 · 低扫']]:[['jab','第一段 · 前手直击'],['cross','第二段 · 后手直击'],['kick0','第三段 · 侧踢'],['kick1','第三段 · 低扫']]],
      ['专属招式',skills],
      ['移动与防守',[['idle','待机'],['walk','步行'],['dash','前冲'],['dashBack','后撤'],['jump','起跳'],['doubleJump','二段跳'],['fall','下落'],['guard','格挡'],['hurt','受击'],['ko','回合落败']]]
    ];
    const options=groups.map(([group,items])=>'<optgroup label="'+group+'">'+items.map(([value,name])=>'<option value="'+value+'">'+name+'</option>').join('')+'</optgroup>').join('');
    return '<details class="m-replay" data-replay-id="'+id+'"><summary>动作回放</summary><div class="replay-area">'+
      '<div class="replay-stage"><canvas width="576" height="368" aria-label="'+fighter.name+' 动作预览"></canvas><span class="replay-status" role="status">载入动作…</span></div>'+
      '<div class="replay-controls"><label>动作<select class="replay-move">'+options+'</select></label>'+
      '<div class="replay-buttons"><button type="button" class="replay-play" disabled>播放</button><label>速度<select class="replay-rate"><option value="1">原速</option><option value=".5">半速</option><option value=".25">四分之一速</option></select></label></div>'+
      '<label class="replay-timeline">逐帧查看 <output></output><input class="replay-frame" type="range" min="0" max="0" value="0" disabled></label></div></div></details>';
  }
  function codex(requestedId,skin='base') {
    const roster = window.ArenaEngine.roster;
    const id = Object.hasOwn(roster, requestedId) ? requestedId : "deepseek";
    const fighter = roster[id];
    const tabs = order.filter(item => roster[item]).map(item =>
      '<button type="button" data-codex="'+item+'" aria-pressed="'+(item === id)+'">'+roster[item].name+'</button>').join("");
    const stats = fighter.stats;
    const impact=Math.round(100*ArenaEngine.armorMultiplier[stats.defense]);
    const ratings='<small>攻击 '+stats.attack+'/5　防御 '+stats.defense+'/5　速度 '+stats.speed+'/5</small><small>同一招承伤倍率 '+impact+'%</small>';
    const hero = '<div class="m-hero"><div><strong>'+fighter.name+'</strong><span>'+ArenaSkins.title(id,skin)+' <button class="m-listen" data-listen="'+id+'">试听台词</button></span>'+ratings+'</div>'+
      '<img alt="" src="'+ArenaSkins.portrait(id,skin)+'"></div>';
    const moves = fighter.skills.map((skill,i) => {
      const tag = ["秘技一","秘技二","奥义"][i];
      const resource = skill.cost ? '消耗 '+skill.cost+' 能量' : '冷却 '+skill.cooldown+' 秒';
      return '<div class="m-move"><div><b class="m-rank">'+tag+'</b>'+pair(["G","H","T"][i],["K","L","I"][i])+
        '</div><div><h4>'+skill.name+'<small>'+resource+'</small></h4><p>'+skill.description+
        '</p><p class="m-counter"><b>应对</b>'+skill.counter+'</p><button class="replay-link" data-showcase="'+id+'" data-slot="'+['skill1','skill2','ult'][i]+'" aria-label="实战试演'+skill.name+'">实战试演</button> <button class="replay-link" data-replay-move="'+['skill1','skill2','ult'][i]+'" aria-label="回放'+skill.name+'">回放动作</button></div></div>';
    }).join("");
    const cues=[['selection','选角'],['intro','登场'],['skill1',fighter.skills[0].name],['skill2',fighter.skills[1].name],
      ['ult',fighter.skills[2].name],['parry','精准格挡'],['win','胜利']];
    const lines=cues.map(([cue,name])=>{
      const listen=cue==='win'?'':'<button type="button" data-voice-id="'+id+'" data-voice-line="'+cue+'" aria-label="试听'+name+'台词">试听</button>';
      const clips=MEDIA.lines[id];
      return '<div><span>'+name+'</span><p>'+clips[ArenaProgress.voiceKey(clips,cue,skin)].text+'</p>'+listen+'</div>';
    }).join('');
    const voicebook='<details class="voicebook"><summary>角色台词</summary><div class="voice-lines">'+lines+'</div></details>';
    return outer('<div style="--m-col:'+fighter.color+'"><div class="m-tabs" role="group" aria-label="选择角色">'+tabs+'</div>'+hero+'<p class="m-fighter-tip">'+tactics[id]+'</p>'+voicebook+replayPanel(id,fighter)+moves+'</div>');
  }

  function guide(solo,online=false) {
    const rows = [
      ["移动","A / D","← / →","左摇杆 / 十字键"],
      ["跳跃","W","↑","A"],
      ["格挡","S","↓","B"],
      ["普攻","F","J","X"],
      ["技能一","G","K","Y"],
      ["技能二","H","L","RB"],
      ["奥义","T","I","RT"],
      [online?"房间":"暂停","Esc","Esc","Start"]
    ].map(([label,p1,p2,pad]) => '<tr><td>'+label+'</td><td>'+key(p1)+'</td><td>'+key(p2)+'</td><td>'+pad+'</td></tr>').join("");
    const modeText=online?'联机时两套键位都控制你的英雄，也可以使用第一只标准手柄。打开房间菜单时比赛继续。':solo?'单人试炼时，两套键位都控制玩家，第一只标准手柄也控制玩家。左右方向键可在大厅挑选电脑角色。':'同屏决斗时，2P 也可用小键盘 1、2、3、0 出招。一只标准手柄控制 2P，两只手柄按接入顺序分别控制 1P、2P。';
    const arena=document.getElementById('arena'),inBattle=document.getElementById('battle')?.hidden===false;
    const display=(MEDIA.phone?'手机轻量画质':'电脑高清画质')+(inBattle?' · 战场 '+arena.width+' × '+arena.height+' 像素':'');
    const qualitySwitch=!inBattle&&/^https?:$/.test(location.protocol)?' <button class="command" data-web-quality="'+(MEDIA.phone?'uhd':'lite')+'">'+(MEDIA.phone?'使用高清原图':'使用轻量画质')+'</button>':'';
    return outer('<div class="controls-choice guide-choice" role="group" aria-label="操控方式"><button data-controls-mode="keyboard">电脑 · 键盘与手柄</button><button data-controls-mode="touch">手机 · 双圆盘</button></div><p>'+display+qualitySwitch+'</p>'+
      '<div class="guide-touch"><h3 class="m-section">左手移步，右手出招</h3><p>左盘横拨进退，上拨跳跃，斜上可边移动边跳。回中后再次上拨可二段跳，连续两次拨向同侧可冲刺。下拨格挡。</p>'+
      '<p>右盘按住中心可打出普攻连段。轻点外圈招式即可释放，沿外圈滑选可更换招式，拖出圆盘后松手取消。两只手可以同时操作。</p></div>'+
      '<div class="guide-keyboard"><table aria-label="键盘与标准手柄键位"><thead><tr><th>动作</th><th>1P 键盘</th><th>'+(solo||online?'备用键位':'2P 键盘')+'</th><th>标准手柄</th></tr></thead><tbody>'+rows+
      '</tbody></table><p>'+modeText+'</p></div><div class="voice-tools"><button data-act="sound" data-panel-sound></button> <button data-act="combat-volume"></button> <button data-act="dialogue"></button> <button data-act="full">全屏切换</button></div>'+
      '<p>首局开场显示双方台词。设备安装本地中文语音时可朗读，交手后只播己方的关键台词。</p>'+
      (!solo&&!online?'<div class="controls-choice guide-choice" role="group" aria-label="同屏对战语音视角"><button data-voice-side="0">听 1P 台词</button><button data-voice-side="1">听 2P 台词</button></div>':'')+
      '<h3 class="m-section">对战技巧</h3><div class="m-notes">'+
      '<p><b>赢下两个回合</b>防御越高，每次受击掉血越少，格挡时也更省架势。每局 120 秒。击倒对手立即得分，时间结束时比较剩余生命。平局加赛。</p>'+
      '<p><b>移动与冲刺</b>连续两次轻点同一方向可冲刺。起跳后再按一次跳跃，可以二段跳过波峰或改变落点。</p>'+
      '<p><b>普攻连段</b>按住普攻打出三段连击。第三击出手时，朝对手按方向键出侧踢，按反方向出低扫，松开方向键时两种踢法自动轮换。普攻命中后可以接技能、跳跃或冲刺。</p>'+
      '<p><b>精准格挡</b>站在地面按住格挡可抵消大部分伤害。在命中前一瞬按下格挡能化解攻击，恢复能量和防御槽。</p>'+
      '<p><b>灵息解围</b>连续受击三次后，在受击硬直中再按格挡，花费 35 点能量震开对手。每 12 秒可用一次。</p><p><b>追击与反打</b>连击越长，后续伤害和硬直越低。用普攻抓住对手挥空后的收招，多造成 25% 伤害。</p><p><b>破防</b>连续承受攻击会消耗防御槽。松开格挡后逐渐恢复，防御槽耗尽时会短暂失去行动能力。</p>'+
      '<p><b>积攒奥义</b>每局从 40 能量开始，随时间恢复，命中和受击也会增加能量。攒满 100 即可释放奥义。</p></div>');
  }

  function credits() {
    return outer('<div class="m-credit"><b>游戏制作</b><p>《超智能决斗》由 <a href="https://github.com/A1501314" target="_blank" rel="noopener noreferrer">@A1501314</a> 发起并设计。本作为非官方同人游戏。</p></div>'+
      '<div class="m-credit"><b>基础角色形象</b><p>六名 AI 娘的角色设计与基础立绘取自 ZipZipPipe《AI娘化》。DeepSeek 鲸鱼娘原型「溟月」由上善无形创作，女仆版由 ZipZipPipe 二次设计。Kimi 使用同一图集的双手放低版。公开版素材经过裁切、抠图和动作处理。</p><a href="https://www.pixiv.net/artworks/148186519" target="_blank" rel="noopener noreferrer">ZipZipPipe 的图集与使用条件</a> · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans" target="_blank" rel="noopener noreferrer">DeepSeek 美术许可</a></div>'+
      '<div class="m-credit"><b>进阶形象与招式</b><p>项目制作人使用 ChatGPT 依照上述角色设定二次创作进阶造型。战斗使用透明动作图集、分层光效和程序合成的打击音效。</p></div>'+
      '<div class="m-credit"><b>原创角色声音</b><p>游戏人物声音为本项目原创设计。角色声音设计与台词由 @A1501314 创作。宣传片配音通过 BreezeBlue 合成，游戏对白由设备本地中文语音播放。</p></div>'+
      '<div class="m-credit"><b>使用条件</b><p>使用项目自有代码须署名 @A1501314，商业使用须另行取得书面许可。第三方美术、字体、二维码工具及其他第三方材料适用各自的许可和署名要求。各产品名称与商标属于相应权利人。</p></div>');
  }
  window.ArenaManual = Object.freeze({ codex, guide, credits });
})();
