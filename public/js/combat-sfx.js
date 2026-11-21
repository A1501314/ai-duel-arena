// Original Foley synthesized from filtered air, resonant materials and damped strings.
(() => {
  'use strict';
  const rate=32000, tau=2*Math.PI;
  const moves={
    grok:['gravity','uppercut','horizon'],deepseek:['tide','sonar','leviathan'],
    chatgpt:['loop','counter','recursion'],claude:['pages','ember','finale'],
    gemini:['blink','twins','eclipse'],kimi:['crescent','syncopation','nocturne']
  };
  const families=Object.fromEntries(Object.entries(moves).flatMap(([hero,skills])=>skills.map((skill,i)=>[skill,[hero,i]])));
  const contact={grok:'iron',chatgpt:'iron',deepseek:'water',gemini:'glass',claude:'cinder',kimi:'string'};
  const lengths={swish:.19,'axe-swing':.32,body:.29,iron:.50,'heavy-hit':.71,water:.35,glass:.42,cinder:.36,string:.44,
    block:.42,parry:.61,break:.49,land:.19,dash:.23,jump:.17};
  for(const key of Object.keys(families))lengths[key]=[.69,.70,1.38][families[key][1]];
  lengths.uppercut=.59;
  const keys=Object.keys(lengths);
  function cueFor(type,data={}){
    const kind=data.variant||data.kind,slot=data.slot||data.move;
    if(type==='cast'){
      if(families[kind])return kind;
      if(slot==='attack')return data.id==='grok'?'axe-swing':'swish';
      const i=['skill1','skill2','ult'].indexOf(slot);
      return i>=0?moves[data.id]?.[i]||null:null;
    }
    if(type==='hit'){
      if(slot==='ult')return 'heavy-hit';
      return families[kind]||data.id==='grok'?contact[families[kind]?.[0]||data.id]:'body';
    }
    if(['block','parry','break','land','jump','dash'].includes(type))return type;
    return null;
  }
  function gainFor(type,data={}){
    if(type==='cast')return data.slot==='ult'?.76:data.slot==='attack'?.54:.78;
    if(type==='hit')return .74+.16*Math.min(1,Math.max(0,data.power||.4));
    return ({block:.77,parry:.82,break:.75,land:.34,jump:.27,dash:.48})[type]||.7;
  }
  function render(key){
    if(!Object.hasOwn(lengths,key))throw Error('Unknown sound: '+key);
    const out=new Float32Array(Math.ceil(lengths[key]*rate));
    let seed=17041;
    for(const ch of key)seed=(Math.imul(seed,31)+ch.charCodeAt(0))>>>0;
    function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    function span(start,duration,fn){
      const index=Math.round(start*rate),count=Math.min(Math.ceil(rate*duration),out.length-index);
      for(let n=0;n<count;n++)out[index+n]+=fn(n/rate,n,n/(rate*duration));
    }
    function sweep(start,duration,from,to,level,peak=.22,resonance=.8){
      let band=0,low=0,g=0,scale=0;
      const ratio=to/from, damping=1/resonance;
      span(start,duration,(t,n,p)=>{
        if(n%16===0){g=Math.tan(Math.PI*from*Math.pow(ratio,p)/rate);scale=1/(1+g*(g+damping));}
        const drive=random()*2-1;
        const v=(band+g*(drive-low))*scale, l=low+g*v;
        band=2*v-band;low=2*l-low;
        const env=p<peak?Math.sin(Math.PI*.5*p/peak)**1.5:Math.pow((1-p)/(1-peak),1.75);
        return level*env*v;
      });
    }
    function ring(start,duration,from,to,level,decay=5,attack=.002){
      let ph=0;
      const ratio=to/from;
      span(start,duration,(t,n,p)=>{
        ph+=tau*from*Math.pow(ratio,p)/rate;
        return level*Math.sin(ph)*Math.min(1,t/attack)*Math.exp(-decay*p)*(1-p);
      });
    }
    function metal(start,root,level,tail=.45){
      [[1,1],[2.73,.48],[4.17,.29],[6.81,.18],[9.42,.09]].forEach(([k,v],i)=>{
        ring(start+i*.0008,tail/(1+i*.16),root*k,root*k*(1-.006/(i+1)),level*v,3.5+i*.25);
      });
    }
    function string(start,freq,level,tail=.52){
      const line=new Float32Array(Math.max(2,Math.round(rate/freq)));
      for(let i=0;i<line.length;i++)line[i]=(random()*2-1)*.68;
      let pos=0;
      span(start,tail,(t,n,p)=>{
        const read=line[pos],next=(pos+1)%line.length;
        line[pos]=.498*(read+line[next]);pos=next;
        return level*read*Math.min(1,t/.0025)*(1-p);
      });
    }
    function crackle(start,duration,level,count){
      for(let i=0;i<count;i++){
        const delay=start+(i+.6*random())/count*duration,freq=1200+random()*3300;
        sweep(delay,.012+random()*.035,freq,freq*.65,level*(.38+.62*random())*(1-i/(count*1.2)),.055,1.35);
      }
    }
    function thud(start,pitch,level,tail=.19){
      ring(start,tail,pitch,pitch*.32,level,4.3,.0015);
      sweep(start,tail*.63,640,105,level*1.4,.04,.80);
    }
    function axe(big){
      const strike=big?.085:.057;
      sweep(0,strike+.082,440,2580,.58,.58);
      sweep(.019,big?.34:.23,4100,480,.85,.34,.78);
      sweep(strike,.20,890,130,.70,.13);
      ring(strike-.012,.14,1460,880,.072,6,.023);
      // A light blade whistle follows the hand. The impact belongs to a separate event.
      ring(strike+.028,big?.34:.16,700,350,.061,4,.026);
    }
    function impact(kind){
      const heavy=kind==='heavy-hit';
      thud(0,heavy?165:190,heavy?.77:.58,heavy?.37:.19);
      sweep(.001,.075,4600,740,.95,.05,1.1);
      if(kind==='iron'||heavy){metal(.004,heavy?239:347,heavy?.33:.39,heavy?.64:.41);crackle(.012,.16,.34,7);}
      if(kind==='glass'){metal(.006,805,.24,.33);metal(.023,1320,.18,.24);}
      if(kind==='water'){sweep(.014,.25,2300,780,.89,.19);ring(.047,.13,890,440,.14);}
      if(kind==='cinder'){sweep(.019,.26,720,195,.90,.18);crackle(.018,.29,.52,13);}
      if(kind==='string'){string(.003,442,.85,.40);string(.029,662,.39,.29);}
    }
    if(key==='uppercut'||key==='axe-swing')axe(key==='uppercut');
    else if(['body','iron','glass','water','cinder','string','heavy-hit'].includes(key))impact(key);
    else if(key==='block'||key==='parry'){
      const bright=key==='parry';
      sweep(0,.067,5100,760,.95,.045);metal(.002,bright?633:419,.47,bright?.56:.39);
      if(bright)metal(.026,1056,.15,.45);
      thud(0,245,.25,.16);
    }else if(key==='land'||key==='break'){
      thud(.001,key==='land'?179:154,key==='land'?.6:.81,key==='land'?.15:.32);
      sweep(.004,.12,1500,290,.57,.1);if(key==='break')crackle(.015,.26,.64,11);
    }else if(['jump','swish','dash'].includes(key)){
      sweep(0,lengths[key],key==='jump'?500:1350,key==='dash'?320:3000,.93,.34);
    }else{
      const [hero,rank]=families[key],ult=rank===2;
      if(hero==='grok'){
        sweep(0,ult?.64:.37,2100,235,1.11,.52,1.1);ring(.06,ult?.83:.47,205,65,.30,2,.08);
        metal(ult?.34:.13,ult?153:248,.22,ult?.69:.38);
        if(ult){thud(.36,140,.55,.43);crackle(.36,.65,.42,17);}
      }else if(hero==='deepseek'){
        const span=ult?.91:.42;
        sweep(0,span,rank===1?340:1700,rank===1?2500:330,1.24,.30,.78);
        ring(.03,span,rank===1?322:172,rank===1?572:84,.26,2,.07);
        const count=ult?16:8;
        for(let i=0;i<count;i++){const f=330+random()*720;ring(.08+i*.027,.071,f,f*1.49,.082,2.6,.006);}
        if(ult)sweep(.43,.74,2700,220,.96,.21);
      }else if(hero==='chatgpt'){
        const count=[2,3,6][rank];
        for(let i=0;i<count;i++)metal(.023+i*(ult?.068:.052),[421,654,392,526,733,588][i],.17+.045*(i===0),ult?.63:.39);
        sweep(0,ult?.56:.28,2480,310,.64,.34);
        if(ult)thud(.355,143,.38,.40);
      }else if(hero==='claude'){
        for(let j=0;j<(rank===1?1:3);j++)sweep(j*.044,.089,1700,5100,.73,.35,.85);
        sweep(ult?.19:.079,ult?.80:.31,ult?375:670,ult?1800:310,.99,.35,.71);
        crackle(ult?.23:.093,ult?.85:.39,ult?.54:.38,ult?27:12);
        if(ult){ring(.32,.56,895,520,.10,2,.105);thud(.32,158,.33,.32);}
      }else if(hero==='gemini'){
        const delay=[.103,.171,.287][rank],note=[852,676,490][rank];
        [0,delay].forEach((t,i)=>{
          sweep(t,ult?.47:.23,i?4200:740,i?700:4900,.68,.45,1.45);
          metal(t+.021,note*(i?1.49:1),.17,ult?.67:.31);
        });
        if(ult)sweep(.45,.49,1720,380,.74,.26);
      }else if(hero==='kimi'){
        const beats=ult?[0,.16,.34,.48,.70]:rank===1?[0,.12,.167]:[0,.147];
        beats.forEach((t,i)=>{const f=[391.99,587.33,523.25,783.99,293.66][i];
          string(t,f,1.4,ult?.62:.46);ring(t,.34,f,f*.997,.24,3);});
        sweep(.02,ult?.69:.34,2200,550,.39,.28);
      }
    }
    // A few early room reflections, then a continuous fade to keep overlapping tails quiet.
    const delay=Math.round(rate*.032),delay2=Math.round(rate*.063);
    let peak=.001,sum=0;
    for(let i=out.length-1;i>=0;i--){
      const sample=out[i]+(i>=delay?.11*out[i-delay]:0)+(i>=delay2?.047*out[i-delay2]:0);
      out[i]=sample*Math.min(1,i/(rate*.001),(out.length-1-i)/(rate*.018));
      peak=Math.max(peak,Math.abs(out[i]));sum+=out[i]*out[i];
    }
    const trim=Math.min(.84/peak,.18/Math.sqrt(sum/out.length),2.2);
    for(let i=0;i<out.length;i++)out[i]*=trim;
    return out;
  }
  const api={rate,keys,moves,cueFor,gainFor,render};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else window.ArenaCombatSfx=api;
})();
