(() => {
  'use strict';

  const directions = ['left', 'right', 'jump', 'guard'];
  const powers = ['skill1', 'skill2', 'ult'];
  const actionNames = {left:'向左', right:'向右', jump:'跳跃', guard:'格挡', attack:'普攻', skill1:'技能一', skill2:'技能二', ult:'奥义'};
  const glyphs = {
    left:'<path d="m15 5-7 7 7 7"/>',
    right:'<path d="m9 5 7 7-7 7"/>',
    jump:'<path d="m5 14 7-8 7 8m-11 2 4-4 4 4"/>',
    guard:'<path d="m12 3 7 3v5c0 4-2.7 7-7 10-4.3-3-7-6-7-10V6z"/>',
    attack:'<path d="m5 14 3 1-1-5.6c-.3-1.7 1.8-2.2 2.3-.6l.7 2.3-.2-5c0-1.7 2.4-1.8 2.5-.1l.3 4.2.3-4.7c.1-1.7 2.5-1.6 2.5.1l-.1 4.6.7-3.4c.4-1.6 2.6-1.1 2.4.5l-.6 6.7-2 5.2-6 .7-5.3-4c-1.1-.8-.7-2.2.5-2z"/>',
    skill1:'<path d="M4 18 17 4l-4.8 8.6L20 9 9 21l2.7-7.1z"/>',
    skill2:'<path d="m12 3 8 9-8 9-8-9zm0 5-3.5 4 3.5 4 3.5-4z"/>',
    ult:'<path d="m12 2 2.5 6.4 6.8-1.7-4.4 5.6 3.6 5.8-6.5-2L12 22l-2.2-5.9-6.4 2 3.6-5.8-4.4-5.6 6.8 1.7z"/>'
  };
  const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+glyphs[name]+'</svg>';

  function element(tag, className, parent) {
    const node = document.createElement(tag);
    node.className = className;
    parent.append(node);
    return node;
  }

  class ArenaTouch {
    constructor(container, {input, enabled}) {
      this.container = container;
      this.input = input;
      this.enabled = enabled;
      this.seats = new Map();
      this.pointers = new Map();
      this.counts = new Map();
      container.classList.add('arc-discs');
      container.addEventListener('contextmenu', e => e.preventDefault());
      container.addEventListener('pointerdown', e => this.down(e));
      container.addEventListener('pointermove', e => this.move(e));
      container.addEventListener('pointerup', e => this.end(e, true));
      container.addEventListener('pointercancel', e => this.end(e, false));
      container.addEventListener('lostpointercapture', e => {
        if (this.pointers.get(e.pointerId)?.pad===e.target) this.end(e, false);
      });
      container.addEventListener('click', e => {
        // Native keyboard and assistive activation follow this path. A physical tap has already fired.
        const button = e.target.closest('button[data-touch]');
        if (!button || e.detail !== 0 || !this.canPlay()) return;
        const seat = this.seats.get(Number(button.dataset.seat));
        if (seat && !button.classList.contains('is-cooling')) this.pulse(seat, button.dataset.touch);
      });
      window.addEventListener('blur', () => this.reset());
      // Mobile browser chrome can resize the playing surface while both thumbs are down.
      let portrait=matchMedia('(orientation: portrait)').matches;
      window.addEventListener('resize', () => {
        const next=matchMedia('(orientation: portrait)').matches;
        if (next!==portrait) this.reset();
        else for (const pointer of this.pointers.values()) pointer.rect=pointer.pad.getBoundingClientRect();
        portrait=next;
      });
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
    }

    canPlay() {
      return document.documentElement.dataset.controls === 'touch' && this.enabled();
    }

    configure(seats) {
      this.reset();
      this.seats.clear();
      this.container.replaceChildren();
      this.container.dataset.seats = String(seats.length);
      for (const {side, label, id, skills} of seats) {
        const row = element('section','disc-seat',this.container);
        row.setAttribute('aria-label',label+'触屏控制');
        row.dataset.controller = String(side);
        row.dataset.fighter = id;
        const seat = {side, label, buttons:{}, statuses:{}, names:{...actionNames}, energy:-1};
        this.seats.set(side,seat);
        const seatLabel = element('span','disc-seat-label',row);
        seatLabel.textContent = label;
        for (const kind of ['move','action']) {
          const pad = element('div','arc-disc disc-'+kind,row);
          pad.dataset.pad = kind;
          pad.dataset.seat = String(side);
          pad.setAttribute('role','group');
          pad.setAttribute('aria-label',label+(kind==='move'?'方向摇杆':'攻击圆盘'));
          if (kind==='move') {
            seat.stick = element('i','disc-stick',pad);
            seat.stick.setAttribute('aria-hidden','true');
          }
          for (const action of kind==='move' ? directions : ['attack',...powers]) {
            const powerIndex = powers.indexOf(action);
            const fullName = powerIndex < 0 ? actionNames[action] : skills[powerIndex] || actionNames[action];
            const button = element('button','disc-button disc-'+action,pad);
            button.type = 'button';
            button.dataset.touch = action;
            button.dataset.seat = String(side);
            button.title = fullName;
            button.setAttribute('aria-label',label+' '+fullName);
            button.innerHTML = icon(action);
            seat.names[action] = fullName;
            seat.buttons[action] = button;
            if (kind==='action') {
              const caption = element('span','disc-name',button);
              caption.textContent = fullName==='月下镇魂曲'?'镇魂':Array.from(fullName).slice(0,2).join('');
              if (powerIndex>=0) seat.statuses[action] = element('small','disc-state',button);
            }
          }
          if (kind==='action') seat.actionWheel=pad;
        }
      }
    }

    setHeld(pointer, next) {
      const {seat,held} = pointer;
      for (const action of new Set([...held,...next])) {
        const down = next.has(action);
        if (down===held.has(action)) continue;
        const key = seat.side+'/'+action, previous = this.counts.get(key)||0;
        const count = previous+(down?1:-1);
        if (count>0) this.counts.set(key,count); else this.counts.delete(key);
        if (Boolean(previous)!==Boolean(count)) {
          seat.buttons[action].classList.toggle('is-held',count>0);
          this.input(seat.side,action,count>0);
        }
      }
      pointer.held=next;
    }

    pulse(seat, action) {
      const contact={seat,held:new Set()};
      this.setHeld(contact,new Set([action]));
      this.setHeld(contact,new Set());
    }

    readPosition(p,e) {
      const r = p.rect;
      return {x:(e.clientX-r.left-r.width/2)/(r.width/2),
              y:(e.clientY-r.top-r.height/2)/(r.height/2)};
    }

    steer(p, x, y) {
      const magnitude = Math.hypot(x,y);
      const scale = p.rect.width*.206/Math.max(1,magnitude);
      p.seat.stick.style.transform = 'translate(calc(-50% + '+(x*scale).toFixed(1)+'px),calc(-50% + '+(y*scale).toFixed(1)+'px))';
      const next = new Set();
      for (const [action,axis,threshold] of [['left',-x,.31],['right',x,.31],['jump',-y,.46],['guard',y,.46]]) {
        if (axis>threshold-(p.held.has(action)?.09:0)) next.add(action);
      }
      this.setHeld(p,next);
    }

    select(p, x, y) {
      const distance = Math.hypot(x,y);
      if (distance>1.36) p.cancelled = true;
      let selected = null;
      if (!p.cancelled && distance>=.38) {
        const closest = x<0?'skill1':'skill2';
        selected = -y>Math.abs(x)*.866+y*.5?'ult':closest;
      }
      if (selected!==p.selected) {
        if (p.selected) p.seat.buttons[p.selected].classList.remove('is-aimed');
        if (selected) p.seat.buttons[selected].classList.add('is-aimed');
        p.selected=selected;
      }
      p.pad.classList.toggle('is-cancelled',p.cancelled || !selected);
    }

    down(e) {
      const pad=e.target.closest('[data-pad]');
      if (!pad || !this.canPlay() || e.button!==0 || this.pointers.has(e.pointerId)) return;
      if ([...this.pointers.values()].some(p=>p.pad===pad)) return;
      const seat=this.seats.get(Number(pad.dataset.seat));
      if (!seat) return;
      const p={seat,pad,id:e.pointerId,rect:pad.getBoundingClientRect(),held:new Set(),selected:null,cancelled:false};
      const {x,y}=this.readPosition(p,e);
      if (Math.hypot(x,y)>1.12) return;
      e.preventDefault();
      this.pointers.set(e.pointerId,p);
      if (e.isTrusted) pad.setPointerCapture?.(e.pointerId);
      pad.classList.add('is-touched');
      if (pad.dataset.pad==='move') {this.steer(p,x,y);return;}
      const target=e.target.closest('[data-touch]')?.dataset.touch;
      p.attack=target==='attack' || (!target && Math.hypot(x,y)<.34);
      p.tapped=powers.includes(target)?target:null;
      p.origin=[e.clientX,e.clientY];
      if (p.attack) this.setHeld(p,new Set(['attack']));
      else this.select(p,x,y);
    }

    move(e) {
      const p=this.pointers.get(e.pointerId);
      if (!p) return;
      if (!this.canPlay()) {this.release(p,false);return;}
      e.preventDefault();
      const {x,y}=this.readPosition(p,e);
      if (p.pad.dataset.pad==='move') this.steer(p,x,y);
      else if (!p.attack) this.select(p,x,y);
    }

    end(e,fire) {
      const p=this.pointers.get(e.pointerId);
      if (!p) return;
      if (fire && !p.attack && p.pad.dataset.pad==='action') {
        const {x,y}=this.readPosition(p,e);
        this.select(p,x,y);
        if (!p.cancelled && p.tapped && Math.hypot(e.clientX-p.origin[0],e.clientY-p.origin[1])<6) {
          if (p.selected) p.seat.buttons[p.selected].classList.remove('is-aimed');
          p.selected=p.tapped;
        }
      }
      this.release(p,fire && this.canPlay());
    }

    release(p, fire) {
      this.pointers.delete(p.id);
      this.setHeld(p,new Set());
      if (p.pad.dataset.pad==='move') p.seat.stick.style.removeProperty('transform');
      const chosen=p.selected;
      if (chosen) p.seat.buttons[chosen].classList.remove('is-aimed');
      p.pad.classList.remove('is-touched','is-cancelled');
      if (p.pad.hasPointerCapture?.(p.id)) p.pad.releasePointerCapture(p.id);
      if (fire && chosen && !p.cancelled && !p.seat.buttons[chosen].classList.contains('is-cooling')) {
        this.pulse(p.seat,chosen);
      }
    }

    reset() {
      for (const p of [...this.pointers.values()]) this.release(p,false);
    }

    update(side,fighter) {
      const seat=this.seats.get(side);
      if (!seat||!fighter) return;
      const energy=Math.max(0,Math.min(100,Math.floor(fighter.energy||0)));
      if (seat.energy!==energy) {
        seat.actionWheel.style.setProperty('--disc-charge',energy+'%');
        seat.energy=energy;
      }
      for (const action of powers) {
        const cd=Math.max(0,Math.ceil(fighter.cd?.[action]||0));
        const ultimate=action==='ult',waiting=cd>0 || (ultimate && energy<100);
        const status=cd?cd+'s':ultimate?(waiting?energy+'%':'就绪'):'';
        const button=seat.buttons[action],state=seat.statuses[action];
        if (state.textContent===status && button.hasAttribute('aria-disabled')) continue;
        state.textContent=status;
        button.classList.toggle('is-cooling',waiting);
        button.classList.toggle('is-ready',ultimate && !waiting);
        button.setAttribute('aria-disabled',String(waiting));
        button.setAttribute('aria-label',seat.label+' '+seat.names[action]+(status?' '+status:''));
      }
    }
  }
  window.ArenaTouch=ArenaTouch;
})();
