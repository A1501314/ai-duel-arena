/* Canvas artwork uses the same stage coordinates as the combat simulation. */
(() => {
  'use strict';
  const W = 1200, H = 600, FLOOR = 490, TAU = Math.PI * 2;
  function line(c, points, color, width = 1) {
    c.beginPath(); c.moveTo(points[0][0],points[0][1]);
    for (let i=1;i<points.length;i++) c.lineTo(points[i][0],points[i][1]);
    c.strokeStyle=color; c.lineWidth=width; c.stroke();
  }
  function poly(c, points, color, edge, width=1) {
    c.beginPath(); c.moveTo(...points[0]);
    for(let i=1;i<points.length;i++) c.lineTo(...points[i]);
    c.closePath(); if(color){c.fillStyle=color;c.fill();}
    if(edge){c.strokeStyle=edge;c.lineWidth=width;c.stroke();}
  }
  function ellipse(c,x,y,rx,ry,fill,stroke,width=1,angle=0) {
    if(rx<=0 || ry<=0) return;
    c.beginPath(); c.ellipse(x,y,rx,ry,angle,0,TAU);
    if(fill){c.fillStyle=fill;c.fill();}
    if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
  }
  function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
  function glow(c,x,y,r,color,alpha=.3) {
    if(r<=0) return;
    const g=c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,color);g.addColorStop(1,'transparent');
    c.save();c.globalAlpha*=alpha;c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();
  }
  function rand(n){const x=Math.sin(n*912.7+82.12)*9137.336;return x-Math.floor(x);}
  function backdrop(c) {
    const sky=c.createLinearGradient(0,0,0,FLOOR);sky.addColorStop(0,'#090f22');sky.addColorStop(.53,'#18283e');sky.addColorStop(1,'#566172');
    rect(c,0,0,W,H,sky);
    glow(c,830,240,370,'#5377ad',.35);glow(c,150,385,280,'#aa725d',.28);
    for(let i=0;i<88;i++) ellipse(c,rand(i+9)*W,rand(i+2)*275,rand(i+7)*.85+.2,.65,'#92a2bc');
    for(let layer=0;layer<3;layer++){
      let x=-30; const base=464+layer*5;
      for(let i=0;x<W;i++){
        const n=i+layer*71, w=21+rand(n+5)*(31+layer*24);
        const h=45+rand(n+13)*(110+layer*44);
        const y=base-h, shade=['#263749','#172b3d','#101d30'][layer];
        rect(c,x,y,w,h,shade);
        if(n%3===0) rect(c,x+w*.23,y-6-rand(n)*13,w*.5,18,shade);
        if(n%5===1) line(c,[[x+w*.43,y-1],[x+w*.43,y-26]],shade,2);
        for(let xx=5;xx<w-4;xx+=7+layer)for(let yy=7;yy<h-5;yy+=9+layer) {
          if(rand(n+xx*4+yy*6)<.22) rect(c,x+xx,y+yy,2+layer,1.5,rand(xx+yy+n)>.38?'#667886':'#9b7a69');
        }
        x+=w+rand(n+15)*9;
      }
    }
    for(const x of [-44,1100]){
      rect(c,x,332,67,148,'#0a1524');rect(c,x+4,323,52,11,'#24374a');
      for(let yy=340;yy<475;yy+=12) rect(c,x+9,yy,45,2,'#334350');
      line(c,[[x+25,323],[x+25,270],[x+49,248]],'#1b2b40',4);
    }
    for(let i=0;i<8;i++) {
      const x=i*176-35;
      c.beginPath();c.moveTo(x,409);c.quadraticCurveTo(x+88,426,x+176,409);c.strokeStyle='#263747';c.lineWidth=1.8;c.stroke();
      rect(c,x,403,4,77,'#263543');
    }
  }
  function platform(c,t) {
    rect(c,0,485,W,5,'#142131');rect(c,0,488,W,2,'#82919a');
    const g=c.createLinearGradient(0,490,0,H);
    g.addColorStop(0,'#293b48');g.addColorStop(.13,'#1a2836');g.addColorStop(1,'#101923');
    rect(c,0,490,W,110,g);
    for(let i=-10;i<=10;i++) {
      const x=600+i*125;
      line(c,[[x,490],[600+(x-600)*1.89,H]],'#101a26',1.35);
    }
    for(const y of [498,519,558,596]){
      line(c,[[0,y],[W,y]],'#111c28',1.3);
      line(c,[[0,y+1.5],[W,y+1.5]],'#2a3944',.8);
    }
    for(let i=0;i<70;i++){
      const x=rand(i+15)*W,y=491+Math.pow(rand(i+72),1.8)*107;
      c.save(); c.globalAlpha=.05+.09*rand(i+2)+Math.sin(t*.65+i)*.025;
      rect(c,x,y,5+rand(i)*45,.65+rand(i+2),i%5===0?'#f1af8d':'#a8d6dc');c.restore();
    }
    for(let i=0;i<9;i++){
      const x=i*162-46;
      rect(c,x,486.5,41,1.4,'#a3c4cc');rect(c,x+44,486.5,4,1.4,'#dba36e');
    }
  }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  // The illustration is one continuous texture. Region weights move its hands, hem and feet
  // together at the joints while every vertex above the neck shares one rigid transform.
  const rigs = {
    deepseek: {height:184, hands:[[.20,.45],[.77,.29]], feet:[.44,.55], neck:.24,sole:.985},
    chatgpt: {height:194, hands:[[.35,.24],[.81,.24]], feet:[.43,.59], neck:.23,sole:.991},
    claude: {height:192, hands:[[.28,.31],[.73,.51]], feet:[.43,.51], neck:.21,sole:1},
    gemini: {height:185, hands:[[.39,.25],[.83,.32]], feet:[.42,.60], neck:.23,sole:.965},
    kimi: {height:194, hands:[[.40,.17],[.83,.46]], feet:[.46,.58], neck:.23,sole:.994},
    grok: {height:193, hands:[[.21,.39],[.82,.46]], feet:[.46,.59], neck:.27,sole:.954}
  };
  const smooth=(a,b,x)=>{const p=clamp((x-a)/(b-a),0,1);return p*p*(3-2*p);};
  function motion(f,t) {
    const a=f.action,p=clamp(f.progress||0,0,1),w=Math.sin(t*13+f.side*2);
    const breath=Math.sin(t*3+f.side),curve=Math.sin(p*Math.PI);
    const m={dx:0,dy:breath*.8,angle:breath*.004,stretch:1,leg:0,lift:0,
      frontX:0,frontY:0,backX:0,backY:0,drag:breath*1.2,flash:0};
    if(a==='walk'){
      const dir=Math.sign((f.vx||f.facing)*f.facing);
      Object.assign(m,{dy:-Math.abs(w)*3.3,angle:dir*.07,leg:w*13*dir,lift:w*6,
        frontX:-w*6,frontY:w*3,backX:w*7,backY:-w*3,drag:-dir*6+w*3});
    }else if(a==='dash'){
      const d=(f.dashDir||f.facing)*f.facing;
      Object.assign(m,{dy:4,dx:4*d,angle:.29*d,stretch:.85,leg:16*d,lift:5,
        frontX:11*d,frontY:-7,backX:-14*d,backY:4,drag:-21*d});
    }else if(a==='jump'||a==='fall'){
      const up=a==='jump';
      Object.assign(m,{angle:up?-.11:.12,stretch:up?.94:1.035,leg:up?11:-7,
        lift:up?13:-7,frontX:7,frontY:up?-14:-8,backX:-11,backY:up?6:-5,drag:up?-10:9});
    }else if(a==='guard'){
      Object.assign(m,{dx:-3,dy:3,angle:-.085,stretch:.91,leg:5,frontX:-5,frontY:-21,
        backX:13,backY:-14,drag:4});
    }else if(a==='hurt'){
      Object.assign(m,{dx:-5,dy:2,angle:-.20,stretch:.95,leg:7,frontX:8,frontY:6,
        backX:-13,backY:2,drag:9,flash:Math.min(.3,(f.hurtTime||0)*1.8)});
    }else if(a==='ko'){
      Object.assign(m,{dx:-8,dy:1,angle:-.48,stretch:.79,leg:14,lift:5,
        frontX:-4,frontY:11,backX:-8,backY:13,drag:10});
    }else if(a==='attack'){
      const wind=Math.sin(Math.min(p/.28,1)*Math.PI);
      const strike=Math.sin(clamp((p-.15)/.85,0,1)*Math.PI);
      const n=f.chain||1;
      Object.assign(m,{dx:-3*wind+9*strike,angle:-.09*wind+.19*strike,
        stretch:1-.025*wind,leg:n===3?29*strike:6*strike,lift:n===3?21*strike:2,
        frontX:n===2?-4*strike:25*strike,frontY:n===3?-14*strike:-7*strike,
        backX:n===2?31*strike:-8*strike,backY:n===2?-11*strike:0,drag:-13*strike});
    }else if(a==='cast'){
      const k=f.pose,wind=Math.sin(clamp(p/.38,0,1)*Math.PI);
      const strike=Math.sin(clamp((p-.2)/.8,0,1)*Math.PI),rush=['blink','crescent'].includes(k);
      const rise=k==='uppercut',counter=k==='counter',ult=f.move==='ult';
      Object.assign(m,{dx:-2*wind+strike*(rush?12:4),dy:ult?-4*curve:0,
        angle:-.07*wind+strike*(rise?-.14:rush?.26:counter?-.065:.105),
        stretch:1-wind*.05,leg:rush?16*strike:4*curve,lift:rise?15*strike:2*curve,
        frontX:counter?-7:23*curve,frontY:rise?-38*curve:ult?-25*curve:-14*curve,
        backX:ult?-19*curve:counter?13:-8*curve,backY:ult?-17*curve:counter?-13:5*curve,drag:-12*curve});
    }
    return m;
  }
  function bell(u,v,x,y,rx,ry){return Math.exp(-(((u-x)/rx)**2)-((v-y)/ry)**2);}
  function meshFor(f,img,t,dx=0) {
    const rig=rigs[f.id]||rigs.deepseek, h=rig.height,w=h*(img.naturalWidth||img.width)/(img.naturalHeight||img.height);
    const m=motion(f,t), points=[], cols=12,rows=16;
    const angle=m.angle,ca=Math.cos(angle),sa=Math.sin(angle);
    for(let j=0;j<=rows;j++){
      const v=j/rows,lower=smooth(.50,1,v),notHead=smooth(rig.neck-.025,rig.neck+.10,v);
      for(let i=0;i<=cols;i++){
        const u=i/cols, sx=(u-.5)*w,sy=(v-1)*h;
        const far=Math.abs(u-.5), outer=smooth(.16,.45,far),headBlend=Math.max(outer,notHead);
        const hands=rig.hands;
        const bf=bell(u,v,hands[0][0],hands[0][1],.15,.13)*headBlend;
        const ff=bell(u,v,hands[1][0],hands[1][1],.17,.14)*headBlend;
        const feetDiff=clamp((u-(rig.feet[0]+rig.feet[1])*.5)*8,-1,1);
        const cloth=outer*smooth(.16,.55,v)*(1-smooth(.82,1,v));
        // The root pivot lies at the hips. Feet keep contact through leaning and breathing.
        const bind=1-smooth(.46,1,v),rootY=-h*.47;
        let xx=sx+(ca*sx-sa*(sy-rootY)-sx)*bind;
        let yy=sy+(sa*sx+ca*(sy-rootY)+rootY-sy)*bind;
        xx+=m.dx*(1-lower)+m.leg*feetDiff*lower+bf*m.backX+ff*m.frontX+m.drag*cloth;
        yy=yy*m.stretch+m.dy*(1-lower)-Math.max(0,m.lift*feetDiff)*lower+bf*m.backY+ff*m.frontY;
        if(v>rig.neck) yy+=Math.sin(t*3+u*3)*cloth*1.3;
        points.push([f.x+dx+xx*(f.facing||1), f.y+yy+(1-rig.sole)*h*m.stretch,u,v]);
      }
    }
    return {points,cols,rows,flash:m.flash};
  }
  // Every segment samples its own piece of the original painting; the facial artwork
  // follows a single rigid transform. Coordinates are in the source drawing's 320 × 574 grid.
  const paperRigs = {"deepseek":{"joints":[[[129,149],[124,207],[89,233],[58,249]],[[204,143],[219,189],[251,152],[278,132]],[[150,255],[143,367],[134,514],[136,546]],[[177,256],[181,379],[180,529],[174,559]]],"frames":{"body":[2,2,8,8,288,553],"l11":[294,2,164,371,34,164],"l01":[332,2,120,359,38,161],"acc0":[374,2,240,259,79,156],"l10":[457,2,156,235,44,153],"l00":[505,2,128,234,44,142],"a00":[553,2,110,123,37,98],"a10":[594,2,199,127,30,78],"a11":[628,2,211,141,51,57],"a01":[683,2,78,199,56,51],"a02":[743,2,49,214,49,48],"l02":[796,2,119,509,33,44],"l12":[2,559,160,524,32,44],"a12":[38,559,244,124,48,40]},"acc":[[244,315]],"prop":-1},"chatgpt":{"joints":[[[124,145],[108,190],[110,150],[124,133]],[[186,138],[208,179],[243,148],[266,134]],[[145,264],[140,395],[139,522],[140,561]],[[169,264],[171,383],[164,508],[169,543]]],"frames":{"body":[2,2,7,1,313,571],"l00":[319,2,116,243,51,161],"l10":[374,2,148,243,43,149],"l01":[421,2,118,387,39,141],"l11":[464,2,146,375,40,139],"acc1":[508,2,219,180,99,136],"acc0":[611,2,15,194,88,117],"a10":[703,2,180,125,37,107],"a00":[744,2,100,140,29,65],"a01":[777,2,100,145,17,54],"a11":[798,2,200,136,49,52],"l02":[2,577,124,517,34,52],"prop":[40,577,253,77,50,47],"l12":[94,577,151,503,34,45],"a02":[132,577,104,124,27,32],"a12":[163,577,236,124,45,30]},"acc":[[98,202],[226,191]],"prop":1},"claude":{"joints":[[[138,106],[107,202],[106,172],[108,153]],[[198,113],[208,204],[224,279],[240,310]],[[150,261],[155,401],[158,539],[142,568]],[[175,261],[180,398],[177,536],[176,558]]],"frames":{"body":[2,2,8,3,312,528],"l00":[318,2,129,240,44,170],"l10":[366,2,154,240,44,167],"l01":[414,2,140,393,36,154],"l11":[454,2,163,390,33,152],"acc0":[491,2,19,199,84,117],"a00":[579,2,85,109,58,110],"a10":[641,2,187,103,45,110],"a11":[690,2,194,196,44,91],"prop":[738,2,79,113,59,75],"a12":[801,2,211,274,35,45],"a01":[2,534,82,167,34,44],"l02":[40,534,129,534,42,40],"l12":[86,534,148,531,42,40],"a02":[132,534,91,143,25,35]},"acc":[[96,212]],"prop":0},"gemini":{"joints":[[[137,159],[88,201],[116,148],[143,134]],[[197,146],[227,218],[264,185],[288,183]],[[137,268],[129,372],[142,489],[150,543]],[[169,268],[148,357],[193,449],[207,493]]],"frames":{"body":[2,2,0,20,320,536],"a10":[326,2,184,127,90,144],"acc0":[420,2,261,147,59,144],"l00":[483,2,109,247,50,134],"l01":[537,2,113,364,43,131],"l10":[584,2,130,247,63,119],"l11":[651,2,132,349,80,106],"a11":[735,2,219,176,55,94],"a01":[794,2,75,135,49,75],"l02":[2,542,116,484,54,73],"a00":[60,542,73,151,67,71],"l12":[131,542,181,443,44,70],"a02":[179,542,110,117,41,39],"a12":[224,542,259,164,45,33]},"acc":[[265,160]],"prop":-1},"kimi":{"joints":[[[134,133],[102,184],[113,115],[127,93]],[[208,139],[220,210],[249,249],[274,269]],[[145,257],[141,394],[150,521],[147,561]],[[170,265],[176,411],[189,499],[181,542]]],"frames":{"body":[2,2,1,17,319,532],"l10":[325,2,149,244,44,176],"l00":[373,2,123,236,44,167],"l01":[421,2,126,386,35,141],"l11":[460,2,153,403,52,102],"a10":[516,2,197,124,47,96],"acc0":[567,2,22,191,75,96],"a00":[646,2,85,122,51,83],"a01":[701,2,86,110,40,83],"a11":[745,2,207,201,51,62],"l02":[800,2,139,516,20,53],"l12":[2,538,166,494,37,53],"a12":[43,538,238,241,40,37],"a02":[87,538,108,88,28,33]},"acc":[[89,204]],"prop":-1},"grok":{"joints":[[[150,190],[117,236],[88,232],[79,222]],[[224,197],[244,247],[272,251],[295,266]],[[174,296],[174,388],[170,484],[168,531]],[[184,297],[186,393],[183,488],[176,531]]],"frames":{"prop":[2,2,2,13,151,536],"body":[157,2,20,51,300,497],"l00":[461,2,153,275,49,122],"l10":[514,2,163,276,49,122],"l01":[567,2,156,380,41,110],"l11":[612,2,168,385,41,110],"a10":[657,2,213,185,41,86],"a00":[702,2,109,179,46,77],"l02":[752,2,156,479,36,68],"l12":[792,2,169,483,36,68],"acc0":[2,542,41,247,53,68],"a01":[59,542,79,217,47,45],"a11":[110,542,236,235,42,35],"a02":[156,542,69,211,27,30],"a12":[187,542,267,245,33,26]},"acc":[[77,261]],"prop":0}};
  const mix=(a,b,p)=>a+(b-a)*p;
  // Local wrist coordinates are measured in arm lengths. Each spell has a loaded,
  // contact and follow-through silhouette; contact aligns with the engine's windup.
  const readyArms={
    deepseek:[[-.34,.55,-.12],[.56,.14,-.22]],chatgpt:[[-.15,.23,-.12],[.62,.02,-.17]],
    claude:[[-.26,.50,0],[.49,.48,-.15]],gemini:[[-.08,.10,-.32],[.54,.28,-.30]],
    grok:[[-.61,.55,-.05],[.52,.36,-.25]],kimi:[[-.13,.13,-.12],[.42,.55,-.24]]
  };
  const gesture=(x,y,lean,backX,backY,frontX,frontY)=>[x,y,lean,backX,backY,frontX,frontY];
  const spellPoses={
    tide:[gesture(-13,26,-.13,-.45,.13,.16,.76),gesture(23,45,.23,-.5,-.08,.95,.39),gesture(28,32,.16,-.61,.29,.92,.05)],
    sonar:[gesture(-8,27,-.05,-.1,-.39,.65,.68),gesture(10,22,.15,-.28,-.53,.33,.94),gesture(0,1,-.10,-.41,.32,.49,-.75)],
    leviathan:[gesture(-13,30,-.14,-.64,.67,.42,.82),gesture(4,0,-.12,-.61,-.66,.48,-.86),gesture(23,38,.18,-.24,.26,.91,.52)],
    loop:[gesture(-7,9,-.15,-.12,.20,.24,-.62),gesture(13,12,.11,.41,.29,.98,-.14),gesture(-4,8,-.08,.56,.07,.62,-.51)],
    counter:[gesture(-5,31,-.07,.57,-.30,.34,-.65),gesture(-14,42,-.17,.47,-.43,.44,-.65),gesture(13,23,.13,.86,-.06,.94,-.17)],
    recursion:[gesture(-8,17,-.17,-.53,-.55,.54,.64),gesture(2,6,-.06,-.68,.44,.52,-.84),gesture(19,28,.13,.81,-.01,.86,-.12)],
    pages:[gesture(-9,13,-.08,-.18,.50,-.44,.10),gesture(17,17,.16,-.13,.48,.95,-.15),gesture(11,11,.06,-.20,.45,.72,-.56)],
    ember:[gesture(-8,20,-.07,-.15,.54,.15,.45),gesture(20,52,.27,-.09,.49,.71,.72),gesture(17,30,.13,-.19,.47,.67,.16)],
    finale:[gesture(-12,23,-.12,-.23,.54,-.55,.06),gesture(4,4,-.09,-.25,.42,.30,-.82),gesture(23,29,.19,-.19,.47,.98,-.04)],
    blink:[gesture(-15,44,-.16,.21,-.13,-.51,.27),gesture(28,35,.26,-.66,.32,.92,-.32),gesture(21,41,.16,-.72,.46,.81,.35)],
    twins:[gesture(-9,16,-.10,-.26,.16,.18,.27),gesture(11,15,.08,.64,.50,.65,-.71),gesture(18,20,.14,.92,.20,.34,-.80)],
    eclipse:[gesture(-12,23,-.15,-.49,-.57,.27,-.73),gesture(14,5,.09,.08,-.64,.93,-.43),gesture(20,60,.24,.87,.49,.25,.18)],
    gravity:[gesture(-9,18,-.10,-.65,.50,.31,.25),gesture(14,27,.11,-.62,.46,.98,.03),gesture(-12,27,-.18,-.68,.57,.31,-.19)],
    uppercut:[gesture(-7,61,.16,-.68,.48,.12,.80),gesture(12,26,.03,-.64,.49,.81,-.28),gesture(15,0,-.18,-.65,.52,.31,-.91)],
    horizon:[gesture(-14,30,-.09,-.65,.65,.47,.67),gesture(-3,8,-.12,-.65,.27,.94,-.19),gesture(12,42,.19,-.68,.55,.31,.07)],
    crescent:[gesture(-13,37,-.15,.36,.06,-.39,.42),gesture(25,28,.21,-.46,.32,.92,.29),gesture(20,13,-.02,.82,-.49,-.40,-.11)],
    syncopation:[gesture(-7,17,-.10,-.19,.15,.22,.31),gesture(15,16,.10,-.20,.08,.94,.05),gesture(7,7,-.05,.69,-.68,.28,.26)],
    nocturne:[gesture(-8,23,-.12,-.51,.08,.40,-.52),gesture(0,3,-.12,-.37,-.69,.52,-.71),gesture(16,35,.13,.27,.44,.84,.46)]
  };
  function valuesBetween(first,last,u) {return first.map((value,i)=>mix(value,last[i],u));}
  function handBetween(a,b,u){
    const start=Math.atan2(a[1],a[0]),end=Math.atan2(b[1],b[0]);
    const angle=start+Math.atan2(Math.sin(end-start),Math.cos(end-start))*u;
    // Interpolating opposite reaches on a straight line sends the wrist through its
    // shoulder. Follow an arc around the chest and flex the elbow along that arc.
    const length=mix(Math.max(.28,Math.hypot(a[0],a[1])),Math.max(.28,Math.hypot(b[0],b[1])),u);
    return [length*Math.cos(angle),length*Math.sin(angle),mix(a[2]||0,b[2]||0,u)];
  }
  function samplePoses(stops,time){
    for(let i=1;i<stops.length;i++){
      const [end,b]=stops[i];
      if(time<=end){
        const [start,a]=stops[i-1];
        const u=smooth(start,end,time),pose=valuesBetween(a,b,u);
        for(const j of [3,5]){
          const wrist=handBetween([a[j],a[j+1]],[b[j],b[j+1]],u);
          pose[j]=wrist[0];pose[j+1]=wrist[1];
        }
        return pose;
      }
    }
    return stops[stops.length-1][1];
  }
  function arc(start,peak,end,p){return smooth(start,peak,p)*(1-smooth(peak,end,p));}
  function actSpell(f,p,q){
    const beats=spellPoses[f.pose];
    if(!beats)return;
    const skill=ArenaEngine.roster[f.id].skills.find(move=>move.kind===f.pose);
    const hit=skill.windup/skill.duration,follow=hit+(1-hit)*.47;
    const rest=gesture(q.x,q.y,q.lean,q.hands[0][0],q.hands[0][1],q.hands[1][0],q.hands[1][1]);
    let stops=[[0,rest],[hit*.54,beats[0]],[hit,beats[1]],[follow,beats[2]],[1,rest]];
    if(hit<.16){
      // A fast parry or rising strike triggers before the arm has finished moving:
      // let the shoulder initiate on the trigger and continue the follow-through.
      const early=samplePoses([[0,rest],[1,beats[0]]],.27);
      stops=[[0,rest],[hit,early],[hit+.13,beats[0]],[hit+.27,beats[1]],[hit+.48,beats[2]],[1,rest]];
    }
    const pose=samplePoses(stops,p);
    const power=arc(0,hit,.98,p),push=arc(hit*.55,follow,.98,p);
    [q.x,q.y,q.lean]=pose;q.hands=[[pose[3],pose[4],-.32*power],[pose[5],pose[6],-.59*power+.26*push]];
    q.headX=-q.lean*24+4*power;q.skirt=-.9*q.x+14*arc(follow,follow+.09,1,p);
    q.hemLeft=6*power;q.hemRight=13*power+22*push;
    q.feet[1][0]+=23*power;q.feet[0][1]+=12*push;
    q.accent=(q.lean*1.35-.12*arc(0,hit*.55,hit,p));
    if(f.pose==='counter'||f.pose==='recursion')q.accent=-.52*power+.15*push;
    if(f.pose==='leviathan')q.accent=-.52*power+.54*push;
    if(f.pose==='pages'){
      const flick=Math.sin(clamp((p-hit*.58)/(follow-hit*.58),0,1)*Math.PI*4)*power;
      q.hands[1][1]+=.11*flick;q.hands[1][2]+=.31*flick;
    }
    if(f.pose==='nocturne'){
      const beat=Math.sin(clamp(p/hit,0,1)*Math.PI*4)*power;
      q.hands[1][1]+=.14*beat;q.hands[0][2]+=.24*beat;
    }
    if(f.pose==='uppercut'||f.pose==='blink'||f.pose==='crescent'){
      q.feet[0]=[-22-46*power,1+(f.pose==='uppercut'?84:43)*push,.48*push];
      q.feet[1]=[23+46*power,3+(f.pose==='uppercut'?72:6)*push,-.34*power];
      q.hemRight+=40*push;
    }
  }
  function actKick(f,p,q){
    const sweep=f.kickVariant??(f.moveSerial%2),leg=sweep?1:0;
    const load=arc(0,.24,.52,p),extension=smooth(.22,.40,p)*(1-smooth(.53,.75,p));
    const raised=smooth(.04,.27,p)*(1-smooth(.74,.99,p));
    const moving=arc(0,.43,1,p),recoil=arc(.54,.73,.96,p);
    q.frontKick=leg;q.legOrder=[1-leg,leg];
    q.x+=-13*load+(sweep?19:-10)*extension+4*recoil;
    q.y+=(sweep?40:18)*load+(sweep?60:9)*extension+9*recoil;
    q.lean+=-.08*load+(sweep?.17:-.205)*extension+.065*recoil;
    q.headX+=-q.lean*25;q.accent=.34*extension-.18*recoil;
    q.feet[1-leg]=[leg?-22:23,1,.07*extension];
    // Preserve the actual standing ankle at the two ends of the motion.
    q.kicking={leg,blend:raised,angle:(sweep?-.82:-1.24)*extension-.29*raised};
    q.ankleTargets[leg]=sweep?
      [.07+.76*extension-.15*recoil,.64-.17*extension-.15*load]:
      [.16+.82*extension-.07*recoil,.29-.40*extension-.11*load];
    q.hemLeft=raised*(sweep?20:36);q.hemRight=raised*(sweep?62:111)+22*extension;
    q.skirt=(sweep?-30:-35)*extension+20*recoil;
    const guard=sweep?[[.15,-.18],[.82,-.18]]:[[-.53,.01],[.51,-.37]];
    q.hands=q.hands.map((hand,i)=>handBetween(hand,[...guard[i],i?-.45:.18],moving));
    if(f.id==='claude'||f.id==='grok'){
      const carrying=readyArms[f.id][0];
      q.hands[0]=[carrying[0]-.07*moving,carrying[1]-.04*moving,0];
    }
  }
  function poseFor(f,t) {
    const a=f.action,p=clamp(f.progress||0,0,1);
    const breath=['idle','guard','walk'].includes(a)?Math.sin(t*Math.PI+f.side*1.7):0;
    // Wrist targets are expressed as fractions of arm reach. Feet target the floor
    // unless an animation explicitly raises one; this keeps contact while the hips move.
    const q={x:0,y:7+breath*2,lean:.015+.012*breath,skirt:2*breath,
      hands:readyArms[f.id].map(hand=>hand.slice()),feet:[[-22,1,-.05],[23,3,-.08]],
      legOrder:[0,1],ankleTargets:[null,null],hemLeft:0,hemRight:0,frontKick:-1,flash:0,
      headX:1.8*Math.sin(t*Math.PI-.38),headY:1.4*Math.cos(t*Math.PI),accent:0,armDrive:[0,0],armCapture:[null,null]};
    q.hands[0][1]+=.06*breath;q.hands[1][1]-=.07*breath;
    if(a==='walk'){
      const dir=Math.sign((f.vx||f.facing)*f.facing),phase=t*13.7+f.side*1.8;
      const stride=Math.sin(phase)*dir,step=Math.cos(phase);
      q.x=5*stride;q.y=12-12*Math.abs(stride);q.lean=.075*dir+.025*stride;q.skirt=-9*dir+13*Math.sin(phase-.65)*dir;
      q.headX=-4*stride;q.headY=2.2*Math.cos(2*phase);q.accent=.12*Math.sin(phase-.64)*dir;
      q.hemLeft=6+32*Math.max(0,-step);q.hemRight=6+32*Math.max(0,step);
      for(let i=0;i<2;i++){
        const sign=i?1:-1,up=Math.max(0,step*sign);
        q.feet[i]=[(i?14:-14)+sign*77*stride,up*48,-sign*.27*stride+.24*up];
        const arm=readyArms[f.id][i],swing=f.id==='claude'&&i===0?.18:f.id==='grok'&&i===0?.22:.54;
        q.hands[i]=[arm[0]-.72*sign*swing*stride,arm[1]+.24-.22*Math.max(0,-sign*stride),arm[2]-sign*swing*.62*stride];
      }
    }else if(a==='dash'){
      const dir=(f.dashDir||f.facing)*f.facing,r=clamp((.15-(f.dash||0))/.15,0,1);
      const push=arc(0,.31,.99,r),brake=arc(.52,.79,1,r),launch=arc(0,.38,.71,r);
      q.x=3+dir*(22*push-8*brake);q.y+=34*launch+17*brake;q.lean+=dir*(.31*push-.12*brake);
      q.headX=-q.lean*25;q.skirt=-41*dir*push+18*dir*brake;q.accent=-.30*dir*push;
      q.hemLeft=56*push;q.hemRight=43*push;
      if(dir<0){
        const guard=arc(0,.46,1,r);
        q.hands=q.hands.map((hand,i)=>handBetween(hand,i?[.58,-.10,-.29]:[hand[0]-.09,hand[1]-.12,.02],guard));
      }else q.hands=q.hands.map((hand,i)=>handBetween(hand,i?[.94,-.24,-.50]:[-.81,.27,.25],push));
      q.feet[0]=[-22-81*dir*push,1+(29+36*r)*push,.51*dir*push];q.feet[1]=[23+48*dir*push,3+21*launch,-.33*dir*push];
    }else if(a==='jump'||a==='fall'){
      const lift=clamp(-(f.vy||0)/770,-1,1),twice=f.jumps>1;
      const airborne=a==='jump'?1:1-smooth(.24,1,-lift);
      const phase=1-Math.abs(lift),knee=twice?1:0;
      q.y+=-9*airborne+19*(1-airborne);q.lean=(-.08*lift+(twice?.12:-.02)*phase)*airborne;
      q.skirt=(-23*lift+8*Math.sin(t*9))*airborne;q.headX=-q.lean*24;q.accent=-.25*lift;
      q.hands=q.hands.map((hand,i)=>handBetween(hand,i?[.60,-.43-.29*lift,-.5]:[-.68,-.11-.35*lift,.28],airborne));
      q.hemLeft=58*airborne;q.hemRight=73*airborne;
      q.ankleTargets[knee]=[-.52-.12*phase,.63-.25*phase];
      q.ankleTargets[1-knee]=[.49+.13*phase,.80-.10*phase];
      q.airBlend=airborne;q.feet=[[-23,2,.51*airborne],[27,3,-.47*airborne]];
    }else if(a==='guard'){
      q.x=-8+breath*2;q.y=33+breath*4;q.lean=-.085-.011*breath;q.skirt=-8+3*breath;
      q.hands=[[.64,-.34+breath*.06,-.75],[.38,-.68-breath*.05,-.50]];
      if(f.id==='grok')q.hands[0]=[-.39,.40,.12];
      if(f.id==='claude')q.hands[0]=[-.13,.49,-.04];
      q.feet=[[-54,1,.04],[45,4,-.13]];
    }else if(a==='attack'){
      const n=f.chain||1,j=n===1?1:0;
      if(n===3){
        actKick(f,p,q);
      }else{
        const hit=n===1?.35:.40,punch=smooth(hit*.34,hit,p)*(1-smooth(hit+.025,.90,p));
        const chamber=arc(0,hit*.48,hit,p),carry=arc(hit,hit+.19,.98,p);
        const shoulderLead=arc(hit*.14,hit*.79,.80,p);
        q.armDrive[j]=shoulderLead;q.armDrive[1-j]=-.38*shoulderLead;
        q.x+=-8*chamber+(n===1?20:25)*shoulderLead;q.y+=10*chamber+5*punch;
        q.lean+=-.075*chamber+(n===1?.10:.16)*shoulderLead;q.headX=-q.lean*23;
        q.skirt=-21*punch+12*carry;q.accent=-.17*punch+.10*carry;
        const guard=q.hands[j],preshape=[guard[0]-.19*chamber,guard[1]+(j?-.09:.07)*chamber,guard[2]-.06*chamber];
        q.hands[j]=handBetween(preshape,[.99,n===1?.04:-.10,-.08],punch);
        q.hands[j][1]+=.09*arc(hit+.025,.63,.92,p);
        q.hands[1-j]=handBetween(q.hands[1-j],[.29,-.03,-.18],shoulderLead);
        if((f.id==='claude'||f.id==='grok')&&n===1)q.hands[0]=readyArms[f.id][0].slice();
        if(f.id==='grok'&&n===2)q.hands[0]=handBetween(readyArms.grok[0],[.63,.35,.12],punch);
        if(f.id==='claude'&&n===2)q.hands[0]=handBetween(readyArms.claude[0],[.17,.48,-.03],punch);
        q.feet[0]=[-22-9*punch,1+15*punch,.22*punch];q.feet[1]=[23+24*punch,3+10*chamber,-.13*punch];
      }
    }else if(a==='cast'){
      actSpell(f,p,q);
    }else if(a==='hurt'||a==='ko'){
      const down=a==='ko',amount=down?smooth(0,.82,p):1-smooth(.12,.96,p);
      q.y=down?9+117*amount:8+28*amount;q.x=down?-34*amount:-22*amount;
      q.lean=down?-.60*amount:-.25*amount;q.skirt=17*amount;
      q.hands=[[-.32-.50*amount,.53-.58*amount,.65*amount],[.58+.08*amount,.18-.62*amount,-.37*amount]];
      q.feet=[[-21-22*amount,down?18*amount:4*amount,.32*amount],[20+25*amount,(down?8:31)*amount,-.33*amount]];
      q.flash=down?0:Math.min(.35,(f.hurtTime||0)*1.6);
    }
    if(window.ArenaHumanMotion)window.ArenaHumanMotion.apply(f,t,q);
    return q;
  }
  function torsoPoint(p,q) {
    const cx=161,cy=267,c=Math.cos(q.lean),s=Math.sin(q.lean),x=p[0]-cx,y=p[1]-cy;
    return [cx+q.x+c*x-s*y,cy+q.y+s*x+c*y];
  }
  function aimTwoBones(a,target,l1,l2,bend){
    const dx=target[0]-a[0],dy=target[1]-a[1],dist=Math.max(.01,Math.hypot(dx,dy));
    const d=clamp(dist,Math.abs(l1-l2)+.02,l1+l2-.02),ux=dx/dist,uy=dy/dist;
    const along=(l1*l1-l2*l2+d*d)/(2*d), high=Math.sqrt(Math.max(0,l1*l1-along*along))*bend;
    return [[a[0]+ux*along-uy*high,a[1]+uy*along+ux*high],[a[0]+ux*d,a[1]+uy*d]];
  }
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const direction=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0]);
  const radians=deg=>deg*Math.PI/180;
  const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const unit3=a=>{const d=Math.hypot(...a)||1;return a.map(x=>x/d);};
  const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const relative3=(a,b)=>a.map((v,i)=>v-b[i]);
  function boneBlend(from,to,weight,start){
    const a=unit3(from),b=unit3(to);
    if(!start)return unit3(a.map((v,i)=>mix(v,b[i],weight)));
    const heading=v=>Math.atan2(v[1],v[0]),initial=heading(start),art=heading(a);
    // Use the recorded guard as a fixed angular reference through the entire
    // punch. The far hand then returns by the same arc on either side of contact.
    const angle=art+weight*(wrapAngle(initial-art)+wrapAngle(heading(b)-initial));
    const pitch=mix(Math.asin(a[2]),Math.asin(b[2]),weight),length=Math.cos(pitch);
    return [length*Math.cos(angle),length*Math.sin(angle),Math.sin(pitch)];
  }
  const grips={claude:[105,161],grok:[81,225]};
  function carriedAngle(f,q){
    const p=f.progress||0;
    if(f.id==='claude')return .64*q.lean+.24*(f.action==='attack'&&f.chain===2?arc(.12,.42,.84,p):0);
    let tilt=.53*q.lean;
    if(f.action==='attack'&&f.chain===2)tilt-=.40*arc(.12,.40,.87,p);
    if(f.action==='cast'){
      if(f.pose==='gravity')tilt-=.22*arc(.04,.43,.93,p);
      if(f.pose==='uppercut')tilt+=.34*arc(.04,.35,.93,p);
      if(f.pose==='horizon')tilt+=-.35*arc(0,.20,.48,p)+.53*arc(.21,.52,.98,p);
    }
    return tilt;
  }
  function armSolution(f,q,rig,n){
    const src=rig.joints[n],near=n===1,held=n===0&&grips[f.id],capture=q.armCapture[n];
    const rest=readyArms[f.id][n],drive=q.armDrive[n],sign=near?1:-1;
    const recordedPunch=capture&&!held&&f.action==='attack'&&f.chain<3;
    const hand=recordedPunch?rest:q.hands[n];
    const arm=distance(src[0],src[1]),fore=distance(src[1],src[2]);
    // A hand facing the camera has a short painted forearm. Reconstruct its depth
    // before rotating it, and project the rigid bones back onto the plane of the art.
    const humerus=Math.max(arm,fore*.98),radius=Math.max(fore,humerus*.78),reach=humerus+radius;
    const wristBindZ=Math.sqrt(Math.max(0,radius*radius-fore*fore))-Math.sqrt(Math.max(0,humerus*humerus-arm*arm));
    const drawnReach=arm+fore,punch=f.action==='attack'&&f.chain===(near?1:2);
    const extent=hand[0]-rest[0],raise=rest[1]-hand[1],sb=torsoPoint(src[0],q);
    const clavicle=clamp(3.9*extent+3.2*drive,-6.4,7.2),elevation=clamp(3.5*raise+2.3*drive,-3.5,5.5);
    const shoulder=[sb[0]+clavicle,sb[1]-elevation,sign*6+drive*4.2];
    const z=held?wristBindZ+reach*(.05+.07*clamp(extent,0,1)):
          Math.max(0,wristBindZ)*.38+reach*(.28+.045*clamp(raise,0,1)-.12*clamp(drive,0,1));
    const aim=[hand[0]*drawnReach,hand[1]*drawnReach,z];
    let weight=clamp(capture?.weight??0,0,1)*(held?.10:1);
    if(recordedPunch){
      const p=f.progress||0;
      weight*=punch?smooth(0,.29,p):.32;
    }
    // A swivelled arm plane keeps the illustrated sleeve wide enough to read even
    // when the real forearm points toward the camera. Its two axes are orthonormal.
    const desire=clamp(aim[2]/reach,-.35,.82);
    const yaw=clamp(.17*sign+.30*desire+.15*drive,-.62,.69);
    const pitch=clamp(.20+.26*desire-.08*raise,-.47,.64);
    const cx=Math.cos(yaw),sx=Math.sin(yaw),cy=Math.cos(pitch),sy=Math.sin(pitch);
    const bx=[cx,0,sx],by=[-sx*sy,cy,cx*sy];
    const v=aim[1]/cy,u=(aim[0]+sx*sy*v)/cx;
    const minFlex=radians(8),maxFlex=radians(143);
    const span=angle=>Math.sqrt(humerus*humerus+radius*radius+2*humerus*radius*Math.cos(angle));
    const d0=Math.hypot(u,v),targetDist=clamp(d0,span(maxFlex),span(minFlex));
    const theta=Math.atan2(v,u);
    const ux=Math.cos(theta),uy=Math.sin(theta),bendSide=near?1:-1;
    const along=(humerus*humerus-radius*radius+targetDist*targetDist)/(2*targetDist);
    const bend=Math.sqrt(Math.max(0,humerus*humerus-along*along))*bendSide;
    const point=(x,y)=>shoulder.map((value,i)=>value+bx[i]*x+by[i]*y);
    let elbow=point(ux*along-uy*bend,uy*along+ux*bend),wrist=point(ux*targetDist,uy*targetDist);
    let flex=Math.acos(clamp((targetDist*targetDist-humerus*humerus-radius*radius)/(2*humerus*radius),-1,1));
    if(weight&&capture?.elbow&&capture?.wrist){
      // The capture gives both bone directions, including which side of the wrist
      // the real elbow occupied. Preserve those directions on the actor's own bones.
      const first=recordedPunch?window.ArenaCaptureTracks[f.chain===1?'jab':'cross'].poses[0]:null;
      const startUpper=first?.slice(n*6,n*6+3),startWrist=first?.slice(n*6+3,n*6+6);
      const upper=boneBlend(relative3(elbow,shoulder),capture.elbow,weight,startUpper);
      let lower=boneBlend(relative3(wrist,elbow),relative3(capture.wrist,capture.elbow),weight,startWrist&&relative3(startWrist,startUpper));
      const cosine=clamp(dot3(upper,lower),-1,1),raw=Math.acos(cosine);
      flex=clamp(raw,minFlex,maxFlex);
      if(Math.abs(flex-raw)>.000001){
        const outside=[0,0,sign],parallel=dot3(outside,upper);
        const nearFold=smooth(radians(146),radians(176),raw)*.80;
        const perpendicular=unit3(lower.map((v,i)=>v-cosine*upper[i]+nearFold*(outside[i]-parallel*upper[i])));
        lower=upper.map((v,i)=>v*Math.cos(flex)+perpendicular[i]*Math.sin(flex));
      }
      elbow=shoulder.map((v,i)=>v+humerus*upper[i]);wrist=elbow.map((v,i)=>v+radius*lower[i]);
    }
    const foreHeading=direction(elbow,wrist),bindPalm=direction(src[2],src[3]),bindFore=direction(src[1],src[2]);
    const strike=punch?arc(.13,near?.35:.40,.81,f.progress||0):0;
    const restingBend=clamp(wrapAngle(bindPalm-bindFore),-.57,.62);
    let wristFlex=clamp((restingBend+.50*hand[2])*(1-.94*strike),-.76,.73);
    if(held){
      const turn=bindPalm+carriedAngle(f,q)-foreHeading;
      wristFlex=clamp(Math.atan2(Math.sin(turn),Math.max(.35,Math.cos(turn))),-.86,.88);
    }
    const palmAngle=foreHeading+wristFlex,endAngle=wrapAngle(palmAngle-bindPalm);
    const roll=clamp((near?-.12:.10)+hand[2]*.42+(near?-.72:.65)*strike,-1.10,1.05);
    const dz=held?0:clamp((wrist[2]-elbow[2])/radius*.48+.1*Math.sin(roll),-.63,.63);
    const length=distance(src[2],src[3]),projected=length*Math.sqrt(1-dz*dz);
    const tip=[wrist[0]+projected*Math.cos(palmAngle),wrist[1]+projected*Math.sin(palmAngle),wrist[2]+length*dz];
    const xyz=[shoulder,elbow,wrist,tip],joints=xyz.map(b=>b.slice(0,2));
    const limb={xyz,joints,lengths:[humerus,radius],flex,wristFlex,roll,
      angles:[direction(shoulder,elbow)-direction(src[0],src[1]),foreHeading-bindFore,endAngle]};
    if(held){
      const dx=held[0]-src[2][0],dy=held[1]-src[2][1],cs=Math.cos(endAngle),sn=Math.sin(endAngle);
      limb.grip=[wrist[0]+cs*dx-sn*dy,wrist[1]+sn*dx+cs*dy];
    }
    return limb;
  }
  function solveFighter(f,t) {
    const rig=paperRigs[f.id], actor=rigs[f.id], q=poseFor(f,t), limbs=[];
    for(let n=0;n<2;n++)limbs[n]=armSolution(f,q,rig,n);
    for(let n=2;n<4;n++){
      const i=n%2,j=rig.joints[n],anchor=torsoPoint(j[0],q);
      const l1=distance(j[0],j[1]),l2=distance(j[1],j[2]),reach=l1+l2;
      const v=q.feet[i],kick=q.kicking?.leg===i?q.kicking:null;
      const tilt=kick?v[2]+kick.angle:v[2];
      const sole=distance(j[2],j[3])*Math.sin(direction(j[2],j[3])+tilt);
      let target=[j[2][0]+v[0],actor.sole*574-sole-v[1]];
      const targetInReach=q.ankleTargets[i];
      if(targetInReach){
        const next=[anchor[0]+targetInReach[0]*reach,anchor[1]+targetInReach[1]*reach];
        target=valuesBetween(target,next,kick?.blend??q.airBlend??1);
      }
      const [middle,end]=aimTwoBones(anchor,target,l1,l2,-1);
      const originalHand=direction(j[2],j[3]),endAngle=tilt;
      const terminal=[end[0]+Math.cos(originalHand+endAngle)*distance(j[2],j[3]),end[1]+Math.sin(originalHand+endAngle)*distance(j[2],j[3])];
      limbs[n]={joints:[anchor,middle,end,terminal],angles:[direction(anchor,middle)-direction(j[0],j[1]),direction(middle,end)-direction(j[1],j[2]),endAngle]};
    }
    return {rig,q,limbs};
  }
  function paintFighter(c,img,f,at,offset=0,opacity=1) {
    const {rig,q,limbs}=solveFighter(f,at), world=rigs[f.id], sz=world.height/574;
    c.save();c.globalAlpha*=opacity;c.translate(f.x+offset,f.y);
    c.scale(sz*(f.facing||1),sz);c.translate(-160,-574*world.sole);
    function drawRect(key){
      const r=rig.frames[key];if(!r)return;
      c.drawImage(img,r[0],r[1],r[4],r[5],r[2],r[3],r[4],r[5]);
    }
    function segment(n,k){
      const j=rig.joints[n][k],dest=limbs[n].joints[k];
      c.save();c.translate(dest[0],dest[1]);
      if(n<2){
        const srcEnd=rig.joints[n][k+1],end=limbs[n].joints[k+1];
        c.rotate(direction(dest,end));c.scale(distance(dest,end)/distance(j,srcEnd),1);
        c.rotate(-direction(j,srcEnd));
      }else c.rotate(limbs[n].angles[k]);
      c.translate(-j[0],-j[1]);
      drawRect((n<2?'a':'l')+(n%2)+k);c.restore();
    }
    function limb(n){for(let k=0;k<3;k++)segment(n,k);}
    for(let i=0;i<rig.acc.length;i++){
      const joint=rig.acc[i],pivot=torsoPoint(joint,q),sign=i===1?-1:1;
      const arcing=f.action==='attack'||f.action==='cast'?Math.sin(Math.PI*clamp(f.progress||0,0,1)):0;
      const drift=f.action==='walk'?.10*Math.sin(at*13.7-.65):f.action==='dash'?.19:
        f.action==='jump'||f.action==='fall'?.13*clamp(-(f.vy||0)/770,-1,1):0;
      c.save();c.translate(pivot[0],pivot[1]);c.rotate(q.lean+sign*(.034*Math.sin(at*Math.PI-.6+i)+.012*Math.sin(at*2*Math.PI-.8+i)+drift+.145*arcing+q.accent));
      c.translate(-joint[0],-joint[1]);drawRect('acc'+i);c.restore();
    }
    q.legOrder.forEach(i=>limb(2+i));
    // Sleeve and leg motion is independent of the dress. Only its hem trails the hips.
    c.save();c.translate(161+q.x,267+q.y);c.rotate(q.lean);c.translate(-161,-267);
    const body=rig.frames.body, end=body[3]+body[5],pivot=Math.min(end,286);
    const neck=Math.round(world.neck*574);
    // Keep eyes and features on one rigid piece; only the short neck-to-shoulder
    // band absorbs a delayed nod, with an exactly continuous seam at both ends.
    const top=body[3],upperEnd=Math.min(pivot,neck-15),lowerEnd=Math.min(pivot,neck+20);
    if(top<upperEnd)c.drawImage(img,body[0],body[1],body[4],upperEnd-top,body[2]+q.headX,top+q.headY,body[4],upperEnd-top+.28);
    for(let y=upperEnd;y<lowerEnd;y+=5){
      const h=Math.min(5,lowerEnd-y),v=1-smooth(upperEnd,lowerEnd,y),v2=1-smooth(upperEnd,lowerEnd,y+h);
      const skew=(v2-v)*q.headX/h,squeeze=1+(v2-v)*q.headY/h;
      c.save();c.transform(1,0,skew,squeeze,q.headX*v-skew*y,q.headY*v+(1-squeeze)*y);
      c.drawImage(img,body[0],body[1]+y-top,body[4],h,body[2],y,body[4],h+.3);c.restore();
    }
    if(lowerEnd<pivot)c.drawImage(img,body[0],body[1]+lowerEnd-top,body[4],pivot-lowerEnd,body[2],lowerEnd,body[4],pivot-lowerEnd+.4);
    if(q.hemLeft||q.hemRight){
      const extent=end-pivot,skew=q.skirt/extent;
      // One uninterrupted strip from waist to hem avoids seams across fine embroidery.
      for(let x=0;x<body[4];x+=10){
        const ww=Math.min(10,body[4]-x),u=(x+.5*ww)/body[4];
        const squeeze=1-mix(q.hemLeft,q.hemRight,u)/extent;
        c.save();c.transform(1,0,skew,squeeze,-pivot*skew,pivot*(1-squeeze));
        c.drawImage(img,body[0]+x,body[1]+pivot-body[3],ww,extent,body[2]+x,pivot,ww+.85,extent);
        c.restore();
      }
    }else{
      for(let y=pivot;y<end;y+=24){
        const hh=Math.min(24,end-y),shift=q.skirt*smooth(pivot,end,y),next=q.skirt*smooth(pivot,end,y+hh);
        c.save();c.transform(1,0,(next-shift)/hh,1,shift-(next-shift)*y/hh,0);
        c.drawImage(img,body[0],body[1]+y-body[3],body[4],hh,body[2],y,body[4],hh+.8);c.restore();
      }
    }
    c.restore();
    for(let n=0;n<2;n++){
      segment(n,0);
      let propTilt;
      if(rig.prop===n){
        const held=limbs[n].grip,orig=held?grips[f.id]:rig.joints[n][2],dest=held||limbs[n].joints[2];
        const tilt=held?limbs[n].angles[2]:.09*limbs[n].angles[2];
        if(held)propTilt=tilt;
        c.save();c.translate(dest[0],dest[1]);c.rotate(tilt);c.translate(-orig[0],-orig[1]);
        if(held)window.ArenaHands?.gripUnderlay?.(c,f.id);
        drawRect('prop');c.restore();
      }
      segment(n,1);
      if(window.ArenaHands)window.ArenaHands.draw(c,f,at,q,rig,n,limbs[n],propTilt);
      else segment(n,2);
    }
    c.restore();
  }

  const hasImage=img=>img&&(img.naturalWidth||img.width)>0&&(typeof img.complete==='undefined'||img.complete);
  function triangles(mesh,visit) {
    const {cols,rows,points}=mesh;
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++) {
      const a=j*(cols+1)+i,b=a+1,d=a+cols+1,e=d+1;
      visit(points[a],points[b],points[d]);visit(points[b],points[e],points[d]);
    }
  }
  class SpriteStage {
    constructor() {
      this.canvas=document.createElement('canvas');this.textures=new Map();
      const gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
      if(!gl)return;
      const program=gl.createProgram();
      const shaders=[[gl.VERTEX_SHADER,'attribute vec4 point; varying vec2 uv; void main(){uv=point.zw;gl_Position=vec4(point.x/600.-1.,1.-point.y/300.,0.,1.);}'],
        [gl.FRAGMENT_SHADER,'precision mediump float; varying vec2 uv; uniform sampler2D sheet; uniform float opacity;uniform float flash; void main(){vec4 p=texture2D(sheet,uv);gl_FragColor=vec4(mix(p.rgb,vec3(p.a),flash),p.a)*opacity;}']];
      for(const [type,src] of shaders) {
        const shader=gl.createShader(type);gl.shaderSource(shader,src);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))return;
        gl.attachShader(program,shader);
      }
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return;
      gl.useProgram(program);this.gl=gl;
      this.attr=gl.getAttribLocation(program,'point');
      this.opacity=gl.getUniformLocation(program,'opacity');this.flash=gl.getUniformLocation(program,'flash');
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.enableVertexAttribArray(this.attr);gl.vertexAttribPointer(this.attr,4,gl.FLOAT,false,0,0);
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
      this.vertices=new Float32Array(12*16*6*4);
    }
    begin(ratio) {
      if(!this.gl||this.gl.isContextLost())return false;
      const width=Math.round(W*ratio),height=Math.round(H*ratio),gl=this.gl;
      if(width!==this.canvas.width||height!==this.canvas.height){this.canvas.width=width;this.canvas.height=height;}
      gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT);return true;
    }
    draw(img,mesh,opacity) {
      const gl=this.gl;
      if(!this.textures.has(img)) {
        const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
        for(const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,axis,gl.CLAMP_TO_EDGE);
        for(const filter of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,filter,gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);this.textures.set(img,texture);
      }else gl.bindTexture(gl.TEXTURE_2D,this.textures.get(img));
      let n=0;triangles(mesh,(a,b,c)=>{for(const p of [a,b,c])for(const val of p)this.vertices[n++]=val;});
      gl.bufferData(gl.ARRAY_BUFFER,this.vertices,gl.DYNAMIC_DRAW);
      gl.uniform1f(this.opacity,opacity);gl.uniform1f(this.flash,mesh.flash);gl.drawArrays(gl.TRIANGLES,0,n/4);
    }
  }
  // A small CPU mesh preserves animation on browsers that disable hardware graphics.
  function canvasMesh(c,img,mesh,opacity) {
    const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
    c.save();c.globalAlpha*=opacity;
    const {cols,rows,points}=mesh, du=3,dv=2;
    const draw=(a,b,d)=>{
      const sx=a[2]*iw,sy=a[3]*ih,xx=b[2]*iw-sx,xy=b[3]*ih-sy,yx=d[2]*iw-sx,yy=d[3]*ih-sy;
      const det=xx*yy-yx*xy;
      const x1=b[0]-a[0],y1=b[1]-a[1],x2=d[0]-a[0],y2=d[1]-a[1];
      const A=(x1*yy-x2*xy)/det,B=(y1*yy-y2*xy)/det,C=(x2*xx-x1*yx)/det,D=(y2*xx-y1*yx)/det;
      c.save();c.beginPath();
      const cx=(a[0]+b[0]+d[0])/3,cy=(a[1]+b[1]+d[1])/3;
      [a,b,d].forEach((p,i)=>{const dx=p[0]-cx,dy=p[1]-cy,k=.65/(Math.hypot(dx,dy)||1);
        if(i===0)c.moveTo(p[0]+dx*k,p[1]+dy*k);else c.lineTo(p[0]+dx*k,p[1]+dy*k);});
      c.closePath();c.clip();c.transform(A,B,C,D,a[0]-A*sx-C*sy,a[1]-B*sx-D*sy);
      c.drawImage(img,0,0);c.restore();
    };
    for(let j=0;j<rows;j+=dv)for(let i=0;i<cols;i+=du){
      const a=j*(cols+1)+i,b=a+du,d=a+dv*(cols+1),e=d+du;
      draw(points[a],points[b],points[d]);draw(points[b],points[e],points[d]);
    }
    c.restore();
  }
  class ArenaRenderer {
    static sizeCanvas(canvas,width,height,mobile){
      const dpr=Math.min(window.devicePixelRatio||1,mobile?2:Infinity,Math.sqrt((mobile?1572864:9437184)/(width*height)));
      const pw=Math.max(1,Math.round(width*dpr)),ph=Math.max(1,Math.round(height*dpr));
      const changed=canvas.width!==pw||canvas.height!==ph;
      if(canvas.width!==pw)canvas.width=pw;
      if(canvas.height!==ph)canvas.height=ph;
      return changed;
    }
    constructor(canvas, options={}) {
      this.framePlayer=options.framePlayer||null;
      this.cinema=options.cinema||null;
      this.canvas=canvas;
      const live=canvas.id==='arena'&&canvas.parentElement?.classList.contains('arena-wrap');
      this.ctx=canvas.getContext('2d',{alpha:!!live});
      if(live&&typeof ResizeObserver==='function'){
        this.sizeObserver=new ResizeObserver(([entry])=>{
          const size=entry.contentRect;
          this.renderSize=size.width&&size.height?size:null;
        });
        this.sizeObserver.observe(canvas);
      }
      if(live&&this.ctx.getContextAttributes?.().alpha!==false){
        this.matte=document.createElement('img');
        this.matte.className='battle-matte';this.matte.alt='';this.matte.hidden=true;
        canvas.before(this.matte);
      }
      this.background=options.background||null;
      this.stageId=window.ArenaStages?.valid(options.stageId)?options.stageId:'rooftop';
      this.layer=null;this.layerImage=undefined;this.layerW=0;
      this.sprites=options.sprites||{};
      this.paperSheets=options.rigs||{};
      this.playableSheets=new WeakMap();
      this.stage=null;
      this.reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
      this.camera={zoom:1,left:0,top:0,last:0};
      this.battleView=null;
      this.actorBounds=new Map();
    }
    setBackground(image){this.background=image;this.layer=null;}
    setStage(id){
      const next=window.ArenaStages?.valid(id)?id:'rooftop';
      if(next!==this.stageId){this.stageId=next;this.layer=null;}
      return next;
    }
    frameFighters(c,state,reduced) {
      const cam=this.camera,t=state.clock||0,fs=state.fighters||[];
      if(reduced||fs.length!==2||state.phase==='intro'||t<cam.last){
        cam.zoom=1;cam.left=0;cam.top=0;cam.last=t;return;
      }
      const dt=clamp(t-cam.last,0,.06);
      cam.last=t;
      const blend=1-Math.exp(-dt*4.4),leftmost=Math.min(fs[0].x,fs[1].x);
      const rightmost=Math.max(fs[0].x,fs[1].x),distance=rightmost-leftmost;
      const target=1+.115*(1-smooth(115,535,distance));
      cam.zoom+=(target-cam.zoom)*blend;
      const vw=W/cam.zoom,vh=H/cam.zoom;
      const head=Math.min(...fs.map(f=>f.y-(rigs[f.id]?.height||190)-18));
      const leftLimit=Math.max(0,Math.min(W-vw,rightmost+68-vw));
      const rightLimit=Math.max(leftLimit,Math.min(W-vw,Math.max(0,leftmost-68)));
      const aimX=clamp((leftmost+rightmost-vw)*.5,0,W-vw);
      const aimY=clamp((FLOOR+head)*.5-vh*.5,0,H-vh);
      cam.left=clamp(cam.left+(aimX-cam.left)*blend,leftLimit,rightLimit);
      cam.top=clamp(cam.top+(aimY-cam.top)*blend,0,Math.min(H-vh,Math.max(0,head-16)));
      c.scale(cam.zoom,cam.zoom);c.translate(-cam.left,-cam.top);
    }
    bodyBounds(f) {
      const frames=this.framePlayer,actor=frames?.manifest?.actors[f.id];
      const clip=actor&&frames.clip(f),key=f.id+'/'+clip;
      if(this.actorBounds.has(key))return this.actorBounds.get(key);
      let bounds={left:-106,right:146,head:-203,foot:6};
      if(actor?.clips[clip]){
        const [first,count]=actor.clips[clip],scale=actor.nativeScale?.[clip]||frames.manifest.scale;
        bounds={left:Infinity,right:-Infinity,head:Infinity,foot:-Infinity};
        for(let i=first;i<first+count;i++){
          const [, , ,w,h,x,y]=actor.frames[i];
          bounds.left=Math.min(bounds.left,x/scale);bounds.right=Math.max(bounds.right,(x+w)/scale);
          bounds.head=Math.min(bounds.head,y/scale);bounds.foot=Math.max(bounds.foot,(y+h)/scale);
        }
      }
      this.actorBounds.set(key,bounds);return bounds;
    }
    battleCamera(state,aspect,reduced) {
      const actors=state.fighters;
      let left=Infinity,right=-Infinity,head=Infinity,feet=-Infinity;
      for(const actor of actors){
        const b=this.bodyBounds(actor);
        left=Math.min(left,actor.x+(actor.facing<0?-b.right:b.left));
        right=Math.max(right,actor.x+(actor.facing<0?-b.left:b.right));
        head=Math.min(head,actor.y+b.head);feet=Math.max(feet,actor.y+b.foot);
      }
      const distance=Math.abs(actors[1].x-actors[0].x);
      const safeHeight=Math.max((right-left+28)/aspect,(feet-head+12)/.70);
      const composedHeight=reduced?465:378+92*smooth(110,720,distance);
      const desired=Math.max(safeHeight,Math.min(composedHeight,(W+110)/aspect));
      const clock=state.clock||0,old=this.battleView;
      const reset=!old||Math.abs(old.aspect-aspect)>.015||clock<old.clock||state.round!==old.round;
      const blend=reset?1:1-Math.exp(-Math.min(.08,Math.max(0,clock-old.clock))*3.6);
      // Zoom back immediately only when a hand, weapon or airborne head would leave the picture.
      const h=reset?desired:Math.max(safeHeight,old.h+(desired-old.h)*blend),w=h*aspect;
      const subject=(actors[0].x+actors[1].x)/2;
      const center=clamp(subject,Math.min(w/2,W/2),Math.max(W-w/2,W/2));
      const previous=reset?center:old.x+old.w/2;
      const aimX=reduced&&!reset?previous:previous+(center-previous)*blend;
      const x=clamp(aimX-w/2,right+12-w,left-12);
      const bottom=Math.max(feet,FLOOR-32);
      const targetTop=clamp(bottom-h*.81,feet+4-h*.87,head-4-h*.13);
      const previousTop=reset?targetTop:old.y;
      const y=clamp(previousTop+(targetTop-previousTop)*blend,feet+4-h*.87,head-4-h*.13);
      return (this.battleView={x,y,w,h,aspect,clock,round:state.round});
    }
    skyAboveStage(){
      if(this.skyRim)return;
      const src=this.layer;
      // Keep the colour and brushwork at the join, then carry it into soft sky.
      // Stretching one bright rim pixel upward draws conspicuous vertical lines from stars.
      this.skyTone=document.createElement('canvas');this.skyTone.width=1;this.skyTone.height=1;
      this.skyTone.getContext('2d').drawImage(src,0,0,src.width,src.height*.075,0,0,1,1);
      const rim=document.createElement('canvas');rim.width=W;rim.height=72;
      const r=rim.getContext('2d');r.translate(0,72);r.scale(1,-1);
      r.drawImage(src,0,0,src.width,src.height*.12,0,0,W,72);
      r.globalCompositeOperation='destination-in';
      const g=r.createLinearGradient(0,0,0,72);
      g.addColorStop(0,'#fff');g.addColorStop(1,'transparent');r.fillStyle=g;r.fillRect(0,0,W,72);
      this.skyRim=rim;
    }
    paintBattleMatte(c,view){
      const src=this.layer,sw=src.width,sh=src.height;
      const top=Math.min(0,view.y-8),bottom=Math.max(H,view.y+view.h+8);
      // Continue the painted sky and floor at the same physical ground line for very tall viewports.
      // Reflection is limited to out-of-bounds artwork. Fighters and collision coordinates never repeat.
      const strip=sh*.10;
      for(let panel=Math.floor((view.x-8)/W);panel<=Math.floor((view.x+view.w+8)/W);panel++){
        c.save();c.translate(panel*W,0);
        if(Math.abs(panel)%2){c.translate(W,0);c.scale(-1,1);}
        c.drawImage(src,-.25,0,W+.5,H);
        if(top<0){
          this.skyAboveStage();c.drawImage(this.skyTone,-.25,top,W+.5,-top+.5);
          if(this.stageId==='astral'||this.stageId==='rooftop'){
            for(let i=0;i<95;i++){
              const y=-35-rand(i+96)*570;
              if(y>top)rect(c,rand(i+42)*W,y,1.4,1,'rgba(205,219,255,'+(.14+.30*rand(i+277))+')');
            }
          }
          c.drawImage(this.skyRim,-.25,-72,W+.5,72);
        }
        if(bottom>H){
          c.save();c.translate(0,H);c.scale(1,-1);
          c.drawImage(src,0,sh-strip,sw,strip,-.25,H-bottom,W+.5,bottom-H+.5);c.restore();
        }
        c.restore();
      }
    }
    compositeMatte(view,scale,dprX,dprY,shakeX,shakeY){
      const matte=this.matte;
      if(!matte)return false;
      const image=this.layer;
      // The extension above the horizon and outside the stage uses the painted canvas path.
      if(!view||!image?.src||view.x-shakeX<0||view.y-shakeY<0||
         view.x+view.w-shakeX>W||view.y+view.h-shakeY>H){
        matte.hidden=true;return false;
      }
      if(matte.src!==image.src)matte.src=image.src;
      if(!matte.complete||!matte.naturalWidth){matte.hidden=true;return false;}
      const sx=scale/dprX,sy=scale/dprY;
      // Only the camera matrix changes. Edge can keep the full-resolution bitmap in the compositor.
      matte.style.transform='matrix('+[W*sx/matte.naturalWidth,0,0,H*sy/matte.naturalHeight,
        (shakeX-view.x)*sx,(shakeY-view.y)*sy].join(',')+')';
      matte.hidden=false;return true;
    }
    setSprites(sprites){this.sprites=sprites||{};}
    sheet(id){
      const source=this.sprites[id];
      if(!hasImage(source))return null;
      if(this.playableSheets.has(source))return this.playableSheets.get(source);
      const h=source.naturalHeight||source.height,w=source.naturalWidth||source.width;
      const sheet=document.createElement('canvas');
      sheet.height=Math.min(560,h);sheet.width=Math.max(1,Math.round(sheet.height*w/h));
      const sc=sheet.getContext('2d');sc.imageSmoothingQuality='high';sc.drawImage(source,0,0,sheet.width,sheet.height);
      this.playableSheets.set(source,sheet);return sheet;
    }
    buildLayer(ratio) {
      const scene=window.ArenaStages?.image(this.stageId);
      const img=scene||this.background;
      const loaded=img && (img.naturalWidth||img.videoWidth||img.width)>0 &&
        (typeof img.complete==='undefined'||img.complete);
      const source=loaded?img:null,bw=source?(source.naturalWidth||source.width):Math.round(W*ratio);
      if(this.layer && this.layerImage===source && this.layerW===bw)return;
      if(source){
        this.layer=source;this.layerImage=source;this.layerW=bw;this.skyRim=null;return;
      }
      const buffer=document.createElement('canvas');
      buffer.width=bw;buffer.height=source?(source.naturalHeight||source.height):Math.round(H*ratio);
      const c=buffer.getContext('2d');c.scale(buffer.width/W,buffer.height/H);
      backdrop(c);platform(c,0);
      this.layer=buffer;this.layerImage=source;this.layerW=bw;this.skyRim=null;
    }
    render(state,dt=0) {
      if(!state)return;
      this.framePlayer?.setRoundResult?.(state);
      if(this.cinema&&this.framePlayer){this.cinema.actorFilms=this.framePlayer.manifest.actors;this.cinema.framePlayer=this.framePlayer;}
      const c=this.ctx,canvas=this.canvas;
      const bounds=this.renderSize||canvas.getBoundingClientRect();
      const width=Math.max(1,bounds.width||W),height=Math.max(1,bounds.height||H);
      const mobile=typeof MEDIA!=='undefined'&&MEDIA.phone;
      ArenaRenderer.sizeCanvas(canvas,width,height,mobile);
      const pw=canvas.width,ph=canvas.height;
      c.imageSmoothingEnabled=true;c.imageSmoothingQuality=mobile?'low':'high';
      const reduced=this.reducedMotion.matches;
      const fighters=state.fighters||[];
      const adaptive=canvas.id==='arena'&&fighters.length===2;
      const view=adaptive?this.battleCamera(state,pw/ph,reduced):null;
      const scale=view?ph/view.h:Math.min(pw/W,ph/H);
      const offsetX=view?-view.x*scale:(pw-W*scale)/2,offsetY=view?-view.y*scale:(ph-H*scale)/2;
      const textureScale=view?ph/378:scale;
      this.buildLayer(Math.min(1.55,Math.max(1,Math.round(textureScale*10)/10)));
      const t=state.clock||0,mag=Math.max(0,state.shake||0),shake=reduced?0:Math.min(5,mag*4.5);
      const shakeX=Math.sin(t*183)*shake,shakeY=Math.cos(t*147)*shake*.58;
      const composited=this.compositeMatte(view,scale,pw/width,ph/height,shakeX,shakeY);
      c.setTransform(1,0,0,1,0,0);
      if(composited)c.clearRect(0,0,pw,ph);else rect(c,0,0,pw,ph,'#101621');
      c.setTransform(scale,0,0,scale,offsetX,offsetY);
      c.save();
      if(!view){c.beginPath();c.rect(0,0,W,H);c.clip();this.frameFighters(c,state,reduced);}
      if(shake)c.translate(shakeX,shakeY);
      if(!composited){
        if(view)this.paintBattleMatte(c,view);else c.drawImage(this.layer,-2,-2,W+4,H+4);
      }
      c.lineCap='round';c.lineJoin='round';
      c.save();c.translate(-2,-2);c.scale((W+4)/W,(H+4)/H);
      window.ArenaStages?.draw(c,this.stageId,t,reduced);c.restore();
      this.cinema?.drawBack(c,state,dt,reduced);
      for(const f of fighters){
        const altitude=clamp((FLOOR-f.y)/180,0,.85),tone=f.color||'#a9cdeb';
        c.save();c.translate(f.x,FLOOR+2);c.scale(1,.145);
        glow(c,0,0,40-altitude*17,'#030919',.85-altitude*.18);c.restore();
        c.save();c.globalAlpha=.21*(1-altitude);ellipse(c,f.x,FLOOR+3,20,1.5,tone);c.restore();
      }
      const localFile=location.protocol==='file:'&&fighters.some(f=>{
        const url=this.sprites[f.id]?.src;return url&&url.startsWith('file:');
      });
      const fallback=!this.framePlayer&&fighters.some(f=>!hasImage(this.paperSheets[f.id]));
      if(fallback&&!localFile&&!this.stage)this.stage=new SpriteStage();
      const hardware=fallback&&!localFile&&this.stage.begin(Math.min(1.75,Math.max(1,textureScale)));
      for(const f of fighters)this.framePlayer?.paintHalo?.(c,f,t,reduced);
      for(const f of fighters){
        const img=this.framePlayer?this.sprites[f.id]:this.sheet(f.id);
        if(!this.framePlayer&&!hasImage(img))continue;
        if(this.framePlayer)this.framePlayer.paint(c,f,t);
        else if(hasImage(this.paperSheets[f.id]))paintFighter(c,this.paperSheets[f.id],f,t);
        else{
          const mesh=meshFor(f,img,t,0);
          if(hardware)this.stage.draw(img,mesh,1);
          else canvasMesh(c,img,mesh,1);
        }
        if(this.framePlayer)this.cinema?.lightActor(c,f,this.framePlayer,t,reduced);
      }
      if(hardware)c.drawImage(this.stage.canvas,0,0,W,H);
      this.cinema?.drawFront(c,state,dt,reduced);
      if(!adaptive || fighters[0].id===fighters[1].id){
        for(const f of fighters){
          const baseHeight=(rigs[f.id]||rigs.deepseek).height;
          const labelX=f.x,labelY=Math.max(13,f.y-baseHeight*(f.action==='ko'?.77:f.action==='guard'?.92:1)-10);
          const accent=f.side===0?'#60e3ff':'#ff8998';
          c.save();c.translate(labelX,labelY);poly(c,[[-13,-7],[13,-7],[10,5],[2,5],[0,8],[-2,5],[-15,5]],'#17212be0',accent,.9);
          c.font='bold 9px Consolas, monospace';c.fillStyle=accent;c.textAlign='center';c.textBaseline='middle';c.fillText(f.side===state.cpuSide?'CPU':f.side===0?'1P':'2P',-.5,-.6);c.restore();
        }
      }
      c.restore();
    }
  }
  ArenaRenderer.paintFighter=paintFighter;
  ArenaRenderer.measureWalkTravel=(id,count)=>{
    const f={id,action:'walk',side:0,facing:1,vx:282,x:0,y:0},mark=[0];
    const stride=2*Math.PI/13.7,ratio=rigs[id].height/574;
    const at=t=>solveFighter(f,t).limbs.slice(2).map(bone=>bone.joints[3][0]);
    let previous=at(0),total=0;
    for(let i=0;i<count;i++){
      // The foot which is sweeping backwards is planted. Measure its toe displacement,
      // including ankle rotation and knee flexion, across changes in the stance foot.
      for(let sub=1;sub<=12;sub++){
        const phase=(i+sub/12)/count,mid=phase-.5/(12*count);
        const feet=at(phase*stride),support=Math.cos(mid*TAU)>0?0:1;
        total+=Math.max(0,previous[support]-feet[support])*ratio;previous=feet;
      }
      mark.push(Math.round(total*1000)/1000);
    }
    return mark;
  };
  window.ArenaRenderer=ArenaRenderer;
})();
