/* Logical coordinates are shared with the canvas. Positions use the fighters' feet. */
(() => {
  'use strict';

  const ROUND_SECONDS = 120;
  const armorMultiplier = [0,1.15,1.06,.95,.82,.69];
  const vitalityScale = {attack:.18,skill1:.215,skill2:.215,ult:.32};
  const tenth = n => Math.round(n*10)/10;
  const FLOOR = 490;
  const STEP = 1 / 120;
  const WALL = 54, LIMIT = 1200 - WALL;
  const BODY_HEIGHT = 180, BODY_RADIUS = 27, BODY_GAP = 66, CHEST = 102;
  const GRAVITY = 1950;
  const SLOTS = ['skill1', 'skill2', 'ult'];
  const BUTTONS = ['left', 'right', 'jump', 'guard', 'attack', ...SLOTS];
  // Toe positions in stage units at the contact pose, measured from the fighter's root and floor.
  const kickContact = {
    deepseek:[[83,104],[91,30]], chatgpt:[[88,108],[88,38]], claude:[[115,140],[143,26]],
    gemini:[[75,96],[74,38]], kimi:[[90,109],[87,34]], grok:[[79,87],[77,21]]
  };
  const CLAMP = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const skill = (name, kind, cooldown, windup, duration, description, counter, cost = 0) =>
    ({name, kind, cooldown, windup, duration, description, counter, cost});

  const roster = {
    deepseek: {
      name: 'DeepSeek', title: '听潮侍女', color: '#58baff', stats:{attack:4,defense:4,speed:3},
      skills: [
        skill('破浪之刃', 'tide', 2.35, .15, .40, '向前推出贴地鲸鳍波，压制远处的对手。', '跳过低矮的波峰，落地时靠近。'),
        skill('潮鸣之泉', 'sonar', 4.25, .16, .38, '对手脚下泛起蓝光，片刻后涌出水柱。', '脚下亮起蓝光时，横移或冲刺离开。'),
        skill('鲸落归墟', 'leviathan', 0, .36, 1, '唤起深海巨浪，巨鲸随浪从对手脚下跃出。', '越过前浪，离开巨鲸现身的位置。', 100)
      ]
    },
    chatgpt: {
      name: 'ChatGPT', title: '白鳞龙姬', color: '#55edb4', stats:{attack:3,defense:5,speed:2},
      skills: [
        skill('翠龙回刃', 'loop', 3.15, .14, .37, '掷出一个飞环，在远端折返，去回均可命中。', '跳过第一圈，留意飞环的返程。'),
        skill('六环龙印', 'counter', 4.2, .045, .66, '展开龙鳞结界，接住一次命中后立即反击。', '等结界消散后再出手。'),
        skill('龙域天锁', 'recursion', 0, .32, .86, '从对手两侧降下两道龙纹锁环，再引爆交点。', '跳过两侧结环，远离中心。', 100)
      ]
    },
    claude: {
      name: 'Claude', title: '守卷魔女', color: '#ff986c', stats:{attack:5,defense:2,speed:3},
      skills: [
        skill('绯羽飞笺', 'pages', 2.8, .17, .44, '向前散射三枚绯页，分别覆盖地面、平身与空中。', '拉开距离后穿过各页间隙，或格挡。'),
        skill('余烬咒印', 'ember', 4.1, .12, .37, '在前方留下灼热的咒印，对手靠近后延时爆燃。', '诱发烬印后迅速离开，或从上方跳过。'),
        skill('烬书·不死凰', 'finale', 0, .32, .77, '翻开禁书唤出火凰。火凰掠过前方，沿途燃起六道业火。', '向施术者身后移动，或在预警结束前离开。', 100)
      ]
    },
    gemini: {
      name: 'Gemini', title: '逐星使者', color: '#a795ff', stats:{attack:3,defense:2,speed:5},
      skills: [
        skill('星镜幻步', 'blink', 3.40, .16, .47, '近距离瞬移至敌后挥斩，远距离向前折跃。', '看见镜闪时跳起，或等落点出现后反击。'),
        skill('双曜追魂', 'twins', 2.85, .19, .42, '两颗星核一升一落，交错追向对手。', '连续格挡两颗星核，或二段跳越过。'),
        skill('双子蚀日', 'eclipse', 0, .31, .9, '两道星束先后横扫锁定处的高、低空。', '留在地面避开高束，看到第二道预警后跳起。', 100)
      ]
    },
    kimi: {
      name: 'Kimi', title: '月影琴姬', color: '#c6b5ff', stats:{attack:3,defense:3,speed:4},
      skills: [
        skill('弦月连斩', 'crescent', 3.25, .12, .55, '疾步向前，以两道弦月接连扫击。', '跃过弦月，或格挡两拍后还击。'),
        skill('错拍飞弦', 'syncopation', 2.7, .12, .38, '弹出一平一斜两枚音符，截击腾空的对手。', '看清两枚音符的轨迹，从间隙接近。'),
        skill('月下镇魂曲', 'nocturne', 0, .33, .83, '向锁定位置奏出五道琴弦光柱，中心的重音最后落下。', '看到五线谱预警后向阵外冲刺。', 100)
      ]
    },
    grok: {
      name: 'Grok', title: '猩红魅姬', color: '#e2f381', stats:{attack:4,defense:3,speed:2},
      skills: [
        skill('陨星之握', 'gravity', 4.2, .16, .38, '投出缓行的陨星，牵引附近对手后爆开。', '用冲刺摆脱牵引，在球体爆开前远离。'),
        skill('裂空斧', 'uppercut', 3.1, .085, .77, '持斧上挑，跃起时可穿过来袭的攻击。', '避开斧刃，趁她落地收招时还击。'),
        skill('噬光深渊', 'horizon', 0, .36, .95, '在目标处制造吞光深渊，收拢对手后以星火引爆。', '沿远离场心的方向移动，以冲刺脱离。', 100)
      ]
    }
  };
  for (const [id, entry] of Object.entries(roster)) entry.id = id;

  function fighter(id, side) {
    const meta = roster[id];
    if (!meta) throw new Error('未知角色 ' + id);
    const offense = meta.stats.attack - 3;
    const defense = meta.stats.defense - 3;
    const mobility = meta.stats.speed - 3;
    return {
      id, side, color: meta.color, x: side ? 838 : 362, y: FLOOR, facing: side ? -1 : 1,
      powerFactor:1+.13*offense, damageTaken:armorMultiplier[meta.stats.defense],
      guardCost:1-.15*defense, guardRecovery:25+3.5*defense, mobility:1+.08*mobility,
      hp: 100, energy: 40, guardMeter: 100, guardDelay: 0, cd: {skill1: 0, skill2: 0, ult: 0},
      action: 'idle', move: '', pose: '', progress: 0, chain: 0, kickVariant: 0, nextKick: 0, combo: 0, comboTime: 0,
      vx: 0, vy: 0, knock: 0, jumps: 0, stun: 0, invuln: 0, parry: 0, armor: 0,
      dash: 0, dashCd: 0, dashDir: 1, parryCd: 0, blockLag: 0, chainTime: 0,
      counterTime: 0, escapeCd:0, motion: null, hurtTime: 0, moveSerial: 0, confirmed: false,
      lastTap: {left: -10, right: -10}, holds: {}, buffer: {}
    };
  }

  class Match {
    constructor(first = 'deepseek', second = 'claude', openingDurations = null) {
      this.ids = [first, second];
      this.openingDurations = openingDurations;
      this.rematch();
    }
    rematch() {
      this.acc = 0;
      this.events = [];
      this.objectId = 0;
      this.state = {
        phase: 'intro', paused: false, round: 1, time: ROUND_SECONDS, phaseTime: 1.65,
        winner: -1, wins: [0, 0], fighters: [], objects: [], fx: [],
        clock: 0, shake: 0, hitstop: 0
      };
      this.startRound();
    }
    startRound() {
      const s = this.state;
      s.phase = 'intro'; s.phaseTime = 1.65; s.time = ROUND_SECONDS; s.winner = -1;
      s.opening = null;
      if (s.round === 1 && this.openingDurations) {
        const durations = this.ids.map((id,side) => this.openingDurations.seats?.[side] ?? this.openingDurations[id]);
        if (durations.every(value => Number.isFinite(value) && value > 0)) {
          const starts = [.32, .32 + durations[0] + .35];
          const length = starts[1] + durations[1] + .45;
          s.opening = {starts, durations, length};
          s.phaseTime = length;
        }
      }
      s.fighters = this.ids.map(fighter);
      s.objects = []; s.fx = []; s.shake = 0; s.hitstop = 0;
      this.emit('round', {round: s.round});
    }
    clearInput() {
      for (const f of this.state.fighters) {
        f.holds = {}; f.buffer = {}; f.lastTap = {left: -10, right: -10};
      }
    }
    pause(value = true) {
      this.state.paused = Boolean(value);
      this.acc = 0;
      this.clearInput();
    }
    beginFight() {
      const s = this.state;
      s.phase = 'fight'; s.phaseTime = 0; s.opening = null;
      this.emit('fight');
    }
    skipOpening() {
      const s = this.state;
      if (s.paused || s.phase !== 'intro' || !s.opening) return false;
      this.clearInput();
      this.beginFight();
      return true;
    }
    drainEvents() {
      return this.events.splice(0);
    }
    emit(type, details = {}) {
      this.events.push({type, ...details});
      if (this.events.length > 160) this.events.shift();
    }
    input(side, button, down) {
      const s = this.state, f = s.fighters[side];
      if (!f || !BUTTONS.includes(button) || s.paused) return;
      if (!down) { f.holds[button] = false; return; }
      if (f.holds[button]) return;
      f.holds[button] = true;
      if (s.phase !== 'fight') return;
      if (button === 'left' || button === 'right') {
        const direction = button === 'left' ? -1 : 1;
        if (s.clock - f.lastTap[button] <= .255) {
          f.buffer.dash = {until: s.clock + .105, direction};
          f.lastTap[button] = -10;
        } else f.lastTap[button] = s.clock;
      } else {
        f.buffer[button] = {until: s.clock + (button === 'attack' ? .19 : .15)};
      }
    }
    update(dt) {
      if (this.state.paused || !Number.isFinite(dt) || dt <= 0) return;
      this.acc += Math.min(dt, .25);
      while (this.acc >= STEP - 1e-10) { this.step(STEP); this.acc -= STEP; }
    }
    fx(kind, f, variant = '', extra = {}) {
      const life = {hit:.29, block:.24, parry:.45, dash:.25, jump:.28, cast:.34, burst:.4,
        afterimage:.22, land:.24, teleport:.40, whiff:.18}[kind] || .28;
      this.state.fx.push({kind, variant, side: f.side, facing: f.facing, color: f.color,
        x: f.x, y: f.y - CHEST, age: 0, life, power:.55, ...extra});
    }
    step(dt) {
      const s = this.state;
      s.clock += dt;
      s.shake = Math.max(0, s.shake - dt * 4);
      for (const effect of s.fx) effect.age += dt;
      s.fx = s.fx.filter(effect => effect.age < effect.life);
      if (s.phase === 'matchOver') return;
      if (s.phase !== 'fight') {
        s.phaseTime = Math.max(0, s.phaseTime - dt);
        if (!s.phaseTime) {
          if (s.phase === 'intro') this.beginFight();
          else { s.round++; this.startRound(); }
        }
        return;
      }
      if (s.hitstop > 0) { s.hitstop = Math.max(0, s.hitstop - dt); return; }
      const [a,b] = s.fighters;
      s.time = Math.max(0, s.time - dt);
      this.tickFighter(a, b, dt);
      this.tickFighter(b, a, dt);
      this.pushBodies(a,b);
      this.tickObjects(dt);
      if (!a.hp || !b.hp || !s.time) this.endRound();
    }
    endRound() {
      const s = this.state, [a,b] = s.fighters;
      s.winner = a.hp === b.hp ? -1 : Number(b.hp > a.hp);
      if (s.winner >= 0) s.wins[s.winner]++;
      s.phase = s.wins.includes(2) ? 'matchOver' : 'roundOver';
      s.phaseTime = s.phase === 'roundOver' ? 2.15 : 0;
      s.hitstop = 0;
      s.objects = [];
      for (const f of s.fighters) {
        f.action = f.hp > 0 ? 'idle' : 'ko';
        f.motion = null; f.progress = 1; f.move = ''; f.pose = '';
      }
      this.clearInput();
      this.emit('win', {side: s.winner, match: s.phase === 'matchOver'});
    }
    pushBodies(a, b) {
      if (Math.abs(a.y - b.y) > 130) return;
      const dx = b.x - a.x;
      if (Math.abs(dx) >= BODY_GAP) return;
      const sign = dx === 0 ? a.facing : Math.sign(dx);
      const gap = BODY_GAP - Math.abs(dx);
      const roomA = sign > 0 ? a.x - WALL : LIMIT - a.x;
      const roomB = sign > 0 ? LIMIT - b.x : b.x - WALL;
      const shiftA = Math.min(roomA, Math.max(gap / 2, gap - roomB));
      a.x -= shiftA * sign; b.x += Math.min(roomB, gap - shiftA) * sign;
    }
    tickFighter(f, target, dt) {
      const s = this.state;
      for (const timer of ['stun','invuln','armor','parry','dash','dashCd','parryCd',
        'escapeCd','blockLag','chainTime','comboTime','counterTime','guardDelay','hurtTime'])
        f[timer] = Math.max(0, f[timer] - dt);
      for (const slot of SLOTS) f.cd[slot] = Math.max(0, f.cd[slot] - dt);
      if (!f.comboTime) f.combo = 0;
      if (!f.chainTime && !f.motion) f.chain = 0;
      f.energy = Math.min(100, f.energy + dt * 2.5);
      if (!f.guardDelay && !f.holds.guard) f.guardMeter = Math.min(100, f.guardMeter + dt * f.guardRecovery);
      for (const [button, item] of Object.entries(f.buffer)) {
        if (item.until < s.clock) delete f.buffer[button];
      }
      let grounded = f.y >= FLOOR - .1;
      const canAct = !f.stun && !f.blockLag && !f.dash;
      if (!f.motion && !f.dash && !f.stun) f.facing = target.x >= f.x ? 1 : -1;
      if (f.stun) this.breakPressure(f,target);
      if (canAct) this.takeInput(f, target, grounded);
      if (f.motion) {
        const m = f.motion;
        m.age += dt;
        f.progress = Math.min(1, m.age / m.duration);
        if (!m.fired && m.age + 1e-8 >= m.windup) {
          m.fired = true;
          this.release(f, target, m);
        }
        if (m.age >= m.duration) this.cancelMotion(f);
      }
      // Run ground motion separately from knockback so moving cannot cancel a hit's push.
      let walk = Number(Boolean(f.holds.right)) - Number(Boolean(f.holds.left));
      const guard = this.guarding(f);
      let speed = (grounded ? 282 : 248) * f.mobility;
      if (f.motion) {
        if (grounded || f.motion.kind === 'uppercut') walk = 0;
        else speed *= .42;
      }
      if (f.stun || f.blockLag || guard) walk = 0;
      if (f.dash) { walk = f.dashDir; speed = 720*f.mobility; }
      if (f.motion?.kind === 'crescent' && f.motion.fired && f.motion.age < .40) { walk = f.facing; speed = 650; }
      f.vx = speed * walk + f.knock;
      f.x = CLAMP(f.x + f.vx * dt, WALL, LIMIT);
      f.knock *= Math.exp(-dt * 9);
      if (f.y < FLOOR || f.vy < 0) {
        f.vy += GRAVITY * dt;
        f.y += f.vy * dt;
        if (f.y >= FLOOR) {
          f.y = FLOOR; f.vy = 0; f.jumps = 0;
          this.fx('land', f, '', {y:FLOOR, power:.35});
        }
      }
      grounded = f.y >= FLOOR - .1;
      if (f.stun) f.action = 'hurt';
      else if (f.dash) f.action = 'dash';
      else if (f.motion) f.action = f.motion.slot === 'attack' ? 'attack' : 'cast';
      else if (guard || f.blockLag) f.action = 'guard';
      else if (!grounded) f.action = f.vy < 0 ? 'jump' : 'fall';
      else f.action = walk ? 'walk' : 'idle';
    }
    breakPressure(f,opponent) {
      if(!f.buffer.guard || !f.stun || opponent.combo<3 || opponent.comboTime<=0 || f.energy<35 || f.escapeCd>0)return;
      delete f.buffer.guard;
      f.energy-=35;f.escapeCd=12;f.stun=0;f.hurtTime=0;f.invuln=.44;
      const away=f.x<opponent.x?-1:1;
      f.knock=away*360;opponent.knock=-away*530;opponent.combo=0;opponent.comboTime=0;
      this.fx('burst',f,'escape',{power:.75});
      this.emit('escape',{side:f.side});
    }
    guarding(f) {
      return f.holds.guard && f.y >= FLOOR - .1 && !f.motion && !f.dash && !f.stun;
    }
    takeInput(f, target, grounded) {
      const b = f.buffer;
      const cancel = f.motion?.slot === 'attack' && f.confirmed && f.progress >= .48;
      const special = ['ult','skill2','skill1'].find(slot => b[slot]);
      if (special && (!f.motion || cancel) && !f.holds.guard) {
        const def = roster[f.id].skills[SLOTS.indexOf(special)];
        if (!f.cd[special] && f.energy >= def.cost) {
          this.startMove(f, special, def);
          f.cd[special] = def.cooldown; f.energy -= def.cost;
          delete b[special];
          return;
        }
      }
      if (cancel && ((b.jump && f.jumps<2) || (b.dash && !f.dashCd))) this.cancelMotion(f);
      if (f.motion) return;
      if (b.jump && f.jumps < 2) {
        f.jumps++;
        f.vy = f.jumps === 1 ? -770 : -635;
        this.fx('jump', f, '', {y:f.y, power:f.jumps === 1 ? .45 : .72});
        this.emit('jump', {side:f.side});
        delete b.jump; return;
      }
      if (b.dash && !f.dashCd) {
        f.dash = .15; f.dashCd = .48; f.invuln = .07; f.dashDir = b.dash.direction;
        this.fx('dash', f, '', {facing:f.dashDir}); this.emit('dash', {side:f.side});
        delete b.dash; return;
      }
      if (f.holds.guard && grounded) {
        if (b.guard && !f.parryCd) { f.parry = .115; f.parryCd = .33; }
        delete b.guard; return;
      }
      if (b.attack || f.holds.attack) {
        f.chain = f.chainTime ? f.chain % 3 + 1 : 1;
        const index = f.chain - 1;
        if (f.chain === 3) {
          const direction = (Number(Boolean(f.holds.right)) - Number(Boolean(f.holds.left))) * f.facing;
          f.kickVariant = direction ? Number(direction < 0) : f.nextKick;
          f.nextKick = 1 - f.kickVariant;
        }
        this.startMove(f, 'attack', {
          kind: ['jab','cross','finisher'][index], windup: [.075,.10,.15][index],
          duration: [.215,.255,.375][index]
        });
        f.chainTime = .76;
        delete b.attack;
      }
    }
    startMove(f, slot, def) {
      f.move = slot; f.pose = def.kind; f.progress = 0; f.confirmed = false;
      f.motion = {slot, kind:def.kind, age:0, duration:def.duration, windup:def.windup,
        fired:false, serial:++f.moveSerial};
      if (slot === 'ult') f.armor = def.windup + .06;
      if (def.kind === 'blink') f.invuln = def.windup;
      this.fx('cast', f, def.kind, {power:slot === 'ult' ? 1 : slot === 'attack' ? .22 : .65});
      this.emit('cast', {side:f.side, slot, variant:def.kind});
    }
    cancelMotion(f) {
      f.motion = null; f.move = ''; f.pose = ''; f.progress = 0; f.confirmed = false;
      f.counterTime = 0;
    }
    spawn(f, kind, spec = {}) {
      const obj = {
        id:++this.objectId, owner:f.side, kind, variant:f.pose, color:f.color, facing:f.facing,
        x:f.x + 42 * f.facing, y:f.y - CHEST, w:56, h:44, vx:0, vy:0, baseY:f.y - CHEST,
        age:0, life:1.6, warmup:0, active:true, damage:10, stun:.22, force:200, launch:0,
        maxHits:1, interval:.2, hits:0, nextHit:0, power:.6, dead:false,
        serial:f.moveSerial, slot:f.move, ...spec
      };
      obj.baseY = obj.y; obj.active = obj.warmup <= 0;
      this.state.objects.push(obj);
      return obj;
    }
    strike(f, spec = {}) {
      return this.spawn(f, 'slash', {follow:true, offsetX:58, offsetY:-CHEST, w:102, h:90, life:.1, ...spec});
    }
    zone(f, targetX, w, h, warmup, spec = {}) {
      return this.spawn(f, 'column', {x:CLAMP(targetX,27,1173), y:FLOOR - h / 2, w, h,
        warmup, life:warmup + .19, power:.76, ...spec});
    }
    release(f, target, m) {
      const d = f.facing, x = f.x, tx = target.x;
      if (m.slot === 'attack') {
        const n = f.chain - 1;
        const kick = n === 2;
        const [toeX,toeHeight] = kickContact[f.id][f.kickVariant];
        // Cover the extending shin and foot as well as the toe. A jumping target can clear a low sweep.
        const heelX = 34;
        this.strike(f, {offsetX:kick ? (toeX+heelX)/2 : 54+4*n, w:kick ? toeX-heelX+12 : 90+7*n,
          offsetY:kick ? -toeHeight : -CHEST, h:kick ? 34 : 90, damage:[5,6,9][n],
          force:[115,145,385][n], stun:[.168,.18,.27][n], power:[.3,.43,.68][n]});
        return;
      }
      switch (m.kind) {
        case 'tide':
          this.spawn(f,'wave',{vx:715*d, y:f.y-30, w:90, h:60, damage:10.5, force:285, life:1.65}); break;
        case 'sonar':
          this.zone(f,tx,108,195,.42,{damage:14.5,launch:-390,force:110}); break;
        case 'leviathan':
          this.spawn(f,'wave',{vx:775*d, w:135, h:102, y:f.y-51, damage:13, launch:-235,
            power:1, force:105, life:1.65});
          this.zone(f,tx,220,320,.74,{damage:20,launch:-520,power:1,force:350}); break;
        case 'loop':
          this.spawn(f,'orb',{vx:600*d, w:58, h:58, returnAt:.72, life:1.92,
            damage:7,force:115,maxHits:2,interval:.32}); break;
        case 'counter':
          f.counterTime = .47; break;
        case 'recursion':
          for (const sign of [-1,1]) {
            this.spawn(f,'orb',{x:tx+sign*270,y:FLOOR-83,w:58,h:132,vx:-sign*490,
              facing:-sign,warmup:.17,life:.72,damage:9,force:55,power:.82});
          }
          this.zone(f,tx,158,215,.78,{damage:17,launch:-390,power:1}); break;
        case 'pages':
          for (const angle of [-.34,-.09,.08]) {
            this.spawn(f,'bolt',{vx:610*d,vy:610*angle,w:43,h:21,life:1.7,
              damage:6,stun:.14,force:85,power:.48});
          } break;
        case 'ember':
          this.spawn(f,'trap',{x:CLAMP(x+d*160,48,1152),y:FLOOR-12,w:114,h:24,
            warmup:.24,life:4.3,damage:16,power:.8,force:220,launch:-220}); break;
        case 'finale': {
          // Overlapping pillars share a damage allowance even when a wall prevents knockback.
          const score = {remaining: 35};
          for (let i=0;i<6;i++) {
            const colX = x+d*(105+i*115);
            if (colX >= -35 && colX <= 1235) this.zone(f,colX,132,175+i*8,.18+i*.135,
              {damage:23,force:315,launch:-170,power:.89,score});
          } break;
        }
        case 'blink': {
          this.fx('afterimage',f,m.kind);
          const near = Math.abs(tx-x) < 230;
          const behind = tx+d*74;
          const arrival = behind<WALL || behind>LIMIT ? tx-d*BODY_GAP : behind;
          f.x = CLAMP(near ? arrival : x+d*196,WALL,LIMIT);
          f.facing = tx>=f.x ? 1 : -1; f.invuln = .10;
          this.fx('teleport',f,m.kind,{power:.85});
          this.strike(f,{w:106,h:100,life:.12,damage:17,force:230,stun:.26}); break;
        }
        case 'twins':
          for (const sign of [-1,1]) this.spawn(f,'orb',{vx:490*d, amp:48*sign,
            w:39,h:38,life:2.4,damage:10,force:115,stun:.15});
          break;
        case 'eclipse':
          this.spawn(f,'beam',{x:tx,y:FLOOR-229,w:585,h:76,warmup:.27,life:.44,
            damage:22,force:105,power:.94});
          this.spawn(f,'beam',{x:tx,y:FLOOR-46,w:650,h:89,warmup:.64,life:.86,
            damage:33,force:325,power:1}); break;
        case 'crescent':
          this.strike(f,{damage:8,force:130,life:.17,stun:.22,power:.57});
          this.strike(f,{damage:10,w:127,warmup:.185,life:.30,force:295,stun:.23}); break;
        case 'syncopation':
          this.spawn(f,'bolt',{vx:720*d,vy:-25,w:66,h:18,damage:8,force:125,life:1.65});
          this.spawn(f,'bolt',{vx:550*d,vy:-410,w:58,h:24,damage:11,stun:.21,force:170,life:1.35}); break;
        case 'nocturne': {
          const score = {remaining: 35};
          [-186,186,-93,93,0].forEach((offset,i) => {
            const noteX = tx+offset;
            if (noteX < -20 || noteX > 1220) return;
            this.zone(f,noteX,i===4 ? 117 : 95,365,.23+.105*i,
              {damage:i===4 ? 27 : 17,force:135,stun:.18,launch:-135,power:.89,score});
          });
          break;
        }
        case 'gravity': {
          // Aim once at release. A nearby opponent can retreat before the orb opens.
          const travel = CLAMP((tx-x)*d-42,0,210);
          this.spawn(f,'orb',{vx:d*travel/.68,w:97,h:98,field:142,pull:380,warmup:.68,
            life:1.18,damage:18,force:280,power:.78}); break;
        }
        case 'uppercut':
          f.invuln = .14; f.vy = -610; f.jumps = Math.max(1,f.jumps);
          f.knock = d*410;
          this.strike(f,{offsetX:53,offsetY:-116,w:99,h:150,life:.235,damage:19,launch:-590,force:185}); break;
        case 'horizon':
          this.spawn(f,'orb',{x:tx,y:FLOOR-75,w:220,h:200,field:260,pull:510,warmup:.94,
            life:1.15,damage:33,force:470,launch:-490,power:1}); break;
      }
    }
    tickObjects(dt) {
      const s = this.state;
      // Resolve both fighters' already active strikes in the same simulation frame.
      const batch = s.objects.slice();
      const valid = new Set(batch.filter(o => !o.follow || s.fighters[o.owner].motion?.serial === o.serial));
      for (const o of batch) {
        if (o.dead || !valid.has(o)) { o.dead = true; continue; }
        o.age += dt;
        const f = s.fighters[o.owner], target = s.fighters[1-o.owner];
        if (o.age >= o.life) { o.dead = true; continue; }
        o.active = o.age + 1e-9 >= o.warmup;
        if (o.follow) {
          o.x = f.x + o.offsetX * o.facing; o.y = f.y + o.offsetY;
        } else if (o.active || o.field) {
          if (o.returnAt && !o.returned && (o.age >= o.returnAt || o.x < 30 || o.x > 1170)) {
            o.returned = true; o.facing *= -1; o.vx *= -1; o.nextHit = 0;
          }
          o.x += o.vx*dt;
          o.y = o.amp ? o.baseY + Math.sin(o.age*9)*o.amp : o.y + o.vy*dt;
        }
        if (o.x < -340 || o.x > 1540 || o.y < -250 || o.y > FLOOR+57) { o.dead = true; continue; }
        if (o.field && !o.active && !target.invuln && !target.dash) {
          const dx = o.x-target.x;
          const dist = Math.hypot(dx, (target.y-CHEST)-o.y);
          if (dist < o.field && Math.abs(dx)>3) {
            const strength = o.pull*(1-dist/o.field);
            target.x = CLAMP(target.x + Math.sign(dx)*Math.min(Math.abs(dx),strength*dt),WALL,LIMIT);
          }
        }
        if (!o.active || o.age < o.nextHit) continue;
        if (o.kind === 'trap' && !o.triggered) {
          if (Math.abs(target.x-o.x)<88 && target.y>FLOOR-89) {
            o.triggered = true; o.warmup = o.age + .2; o.active = false; o.life = o.warmup+.17;
            o.y = FLOOR-62; o.h = 124; o.w = 142;
            this.fx('cast',f,o.variant,{x:o.x,y:FLOOR-15,power:.8});
          }
          continue;
        }
        if (!o.announced && o.warmup>0) {
          o.announced = true;
          this.fx('burst',f,o.variant,{x:o.x,y:o.y,power:o.power,life:.35});
        }
        if (o.returnAt && o.hits && !o.returned) continue;
        if (o.score?.remaining === 0 || target.invuln || Math.abs(target.x-o.x) > o.w/2+BODY_RADIUS ||
            target.y-BODY_HEIGHT > o.y+o.h/2 || target.y-3 < o.y-o.h/2) continue;
        this.hit(o,f,target);
        o.hits++; o.nextHit = o.age + o.interval;
        // A returning projectile can hit only once on each pass.
        if (o.hits >= o.maxHits || (o.returnAt && o.returned)) o.dead = true;
      }
      s.objects = s.objects.filter(o=>!o.dead);
    }
    hit(o, attacker, target) {
      const s = this.state;
      const x = CLAMP(o.x,target.x-BODY_RADIUS,target.x+BODY_RADIUS), y = CLAMP(o.y,target.y-BODY_HEIGHT+12,target.y-11);
      const detail = {x,y,target:target.side,side:attacker.side,power:o.power,facing:o.facing};
      const emitImpact = (type, extras = {}) => {
        this.fx(type,attacker,o.variant,{...detail,...extras});
        this.emit(type,{...detail,variant:o.variant,slot:o.slot,...extras});
      };
      const dir = o.follow || Math.abs(o.vx)>10 ? o.facing : (target.x >= attacker.x ? 1 : -1);
      if (target.counterTime > 0) {
        target.counterTime = 0; target.invuln = .22; target.energy = Math.min(100,target.energy+11);
        this.fx('parry',target,'counter',{x:target.x,y:target.y-CHEST,power:1,target:attacker.side});
        this.emit('parry',{side:target.side,defenderSide:target.side,target:attacker.side,variant:'counter'});
        // The reply materialises at the source of the caught attack, including ranged hits.
        this.spawn(target,'column',{x:attacker.x,y:attacker.y-CHEST,w:108,h:164,warmup:.08,life:.22,
          damage:14,force:305,stun:.30,variant:'counter',slot:'skill2',power:.86});
        s.hitstop = .045;
        return;
      }
      if (this.guarding(target)) {
        if (target.parry>0) {
          target.parry = 0; target.invuln = .15; target.energy = Math.min(100,target.energy+12);
          target.guardMeter = Math.min(100,target.guardMeter+18);
          if (o.follow) {
            this.cancelMotion(attacker); attacker.stun = Math.max(attacker.stun,.29);
          }
          emitImpact('parry', {color:target.color,defenderSide:target.side});
          s.hitstop = Math.max(s.hitstop,.055); s.shake = Math.max(s.shake,.24);
          return;
        }
        const impact = o.damage*attacker.powerFactor;
        target.guardMeter = Math.max(0,target.guardMeter-Math.max(8,impact*1.55)*target.guardCost);
        target.guardDelay = .55;
        if (target.guardMeter > 0) {
          target.hp = Math.max(Math.min(target.hp,1),tenth(target.hp-impact*target.damageTaken*(vitalityScale[o.slot]??.215)*.10));
          target.knock = dir*o.force*.44; target.blockLag = Math.max(target.blockLag,.105);
          target.energy = Math.min(100,target.energy+3);
          attacker.energy = Math.min(100,attacker.energy+(o.slot==='ult' ? 0 : 2));
          emitImpact('block'); s.hitstop = Math.max(s.hitstop,.027);
          return;
        }
        target.guardMeter = 33; target.guardDelay = .8; target.stun = .49;
        this.fx('burst',target,'break',{power:1});
        this.emit('break',{side:target.side});
      }
      const hits = attacker.comboTime ? attacker.combo : 0;
      const scaled = o.damage*Math.max(.48,1-hits*.095);
      const baseDamage = Math.min(scaled,o.score?.remaining ?? scaled);
      if (o.score) o.score.remaining -= baseDamage;
      const punish=o.slot==='attack' && target.motion?.fired && !target.confirmed && target.progress>=.60 && !hits;
      const damage=tenth(baseDamage*attacker.powerFactor*target.damageTaken*(vitalityScale[o.slot]??.215)*(punish?1.25:1));
      target.hp = Math.max(0,tenth(target.hp-damage));
      attacker.combo = hits+1; attacker.comboTime = .92;
      if (o.slot === 'attack' && attacker.motion?.serial === o.serial) attacker.confirmed = true;
      attacker.energy = Math.min(100,attacker.energy+(o.slot === 'ult' ? 0 : 3+damage*.44));
      target.energy = Math.min(100,target.energy+damage*.42);
      if (target.armor <= 0) {
        this.cancelMotion(target);
        target.stun = Math.max(target.stun,o.stun*Math.max(.56,1-.10*hits)); target.dash = 0; target.hurtTime = .21;
        target.action = 'hurt'; target.knock = dir*o.force;
        if (o.launch<0) { target.vy = o.launch; target.jumps = Math.max(target.jumps,1); }
      }
      emitImpact('hit',{damage,punish:Boolean(punish)});
      s.shake = Math.max(s.shake,o.power*.66);
      s.hitstop = Math.max(s.hitstop,o.slot === 'ult' ? .075 : o.slot === 'attack' ? .038 : .053);
    }
  }
  const api = {roster, Match, roundSeconds:ROUND_SECONDS, armorMultiplier, width:1200, height:600, floor:FLOOR};
  if (typeof window !== 'undefined') window.ArenaEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
