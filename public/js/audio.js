(() => {
  "use strict";
  let context, master, effects, music, noise, timer;
  let combatBus, combatVolume=1;
  const samples=new Map();
  let enabled = true;
  let scene = "menu";
  let beat = 0;
  let nextNote = 0;
  const lastCue = new Map();
  let activeVoice, pendingVoice=null, voiceEpoch=0, dialogue=true;
  let quietUntil=0, commentary=null;
  const announcedMatches = new WeakSet();
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  function gainNode(target, value) {
    const node = context.createGain();
    node.gain.value = value;
    node.connect(target);
    return node;
  }

  function prepare() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    context = new Audio();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -13;
    compressor.knee.value = 12;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;
    compressor.connect(context.destination);
    master = gainNode(compressor, enabled ? 0.66 : 0);
    effects = gainNode(master, 0.94);
    combatBus = gainNode(effects,combatVolume);
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = noise.getChannelData(0);
    let seed = 30011;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = seed / 2147483648 - 1;
    }
    document.addEventListener("visibilitychange", () => {
      if(document.hidden){stopVoice();if(commentary)commentary.openingSide=-1;}
      updateMusic();
    });
    context.addEventListener("statechange", updateMusic);
    return true;
  }

  async function unlock() {
    try {
      if (!context && !prepare()) return false;
      if (context.state === "suspended" || context.state === "interrupted") await context.resume();
      updateMusic();
      return context.state === "running";
    } catch (error) {
      if (error.name === "NotAllowedError" || error.name === "NotSupportedError") return false;
      throw error;
    }
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if(!enabled)stopVoice();
    if (!context) return;
    master.gain.setTargetAtTime(enabled ? 0.66 : 0, context.currentTime, 0.009);
    updateMusic();
  }

  function setCombatVolume(value){
    combatVolume=Math.max(0,Math.min(1,value));
    if(combatBus)combatBus.gain.setTargetAtTime(combatVolume,context.currentTime,.012);
  }

  function materialSound(cue,type,data,t,pan){
    if(!combatVolume)return;
    const studio=window.ArenaCombatSfx;
    if(!samples.has(cue)){
      const pcm=studio.render(cue),audio=context.createBuffer(1,pcm.length,studio.rate);
      audio.getChannelData(0).set(pcm);samples.set(cue,audio);
    }
    const source=context.createBufferSource(),level=context.createGain(),position=context.createStereoPanner();
    source.buffer=samples.get(cue);level.gain.value=studio.gainFor(type,data);position.pan.value=pan;
    source.connect(level).connect(position).connect(combatBus);
    source.onended=()=>{source.disconnect();level.disconnect();position.disconnect();};
    source.start(t);
  }

  function silenceMusic() {
    if (timer !== undefined) window.clearInterval(timer);
    timer = undefined;
    if (music) {
      const oldBus = music;
      oldBus.gain.setTargetAtTime(0, context.currentTime, 0.016);
      window.setTimeout(() => oldBus.disconnect(), 130);
      music = null;
    }
  }

  function setScene(value) {
    if (!["menu", "fight", "pause"].includes(value) || value === scene) return;
    if(value==="menu"){commentary=null;quietUntil=0;}
    if(commentary&&value==="pause")commentary.openingSide=-1;
    scene = value;
    if ((activeVoice?.key!=="win" && pendingVoice!=="win") || value!=="pause") stopVoice();
    silenceMusic();
    updateMusic();
  }

  function duck(playing){
    if(!context)return;
    const when=context.currentTime;
    effects.gain.setTargetAtTime(playing?.52:.94,when,playing?.016:.09);
    if(music)music.gain.setTargetAtTime((scene==='menu'?.18:.215)*(playing?.40:1),when,.05);
  }
  function stopVoice() {
    voiceEpoch++;pendingVoice=null;
    if(activeVoice){
      activeVoice=null;
      window.speechSynthesis?.cancel();
    }
    duck(false);
  }
  function setDialogue(value) {
    dialogue=Boolean(value);
    if(!dialogue&&activeVoice?.key!=="win"&&pendingVoice!=="win")stopVoice();
  }
  async function previewTier(id,skin) {
    if(!enabled||!dialogue||document.hidden)return;
    stopVoice();
    const reservation=voiceEpoch;
    pendingVoice="tier-preview";
    const ready=await unlock();
    if(reservation!==voiceEpoch)return;
    pendingVoice=null;
    if(ready&&enabled&&dialogue&&!document.hidden)await speak(id,"selection",0,null,true,0,skin);
  }
  function stopSelectionPreview() {
    if(pendingVoice==="tier-preview"||pendingVoice==="selection"||(activeVoice?.preview&&activeVoice.key==="selection"))stopVoice();
  }
  function warmVoices(){window.speechSynthesis?.getVoices();}
  function mouth(){return null;}
  function speak(id,key,side,bout,preview=false,elapsed=0,skin=bout?.voiceSkins?.[side]){
    if(!enabled||!context||context.state!=='running'||document.hidden)return;
    const clips=MEDIA.lines[id], entry=clips[ArenaProgress.voiceKey(clips,key,skin)];
    if(!entry||(!dialogue&&!preview&&key!=='win'))return;
    if(key==='win'){
      if(!bout||announcedMatches.has(bout))return;
      announcedMatches.add(bout);
    }else if(!preview && key!=='intro' && (activeVoice||context.currentTime<quietUntil))return;
    stopVoice();
    const sys=window.speechSynthesis;
    const voice=sys?.getVoices().find(v=>v.localService&&/^zh(?:-|_)/i.test(v.lang));
    if(!voice)return;
    const utterance=new SpeechSynthesisUtterance(entry.text);
    utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=1;
    utterance.pitch={deepseek:1.09,chatgpt:.97,claude:1.01,gemini:1.2,grok:1.06,kimi:1.12}[id];
    activeVoice={key,id,side,preview,utterance};duck(true);
    utterance.onend=utterance.onerror=()=>{
      if(activeVoice?.utterance!==utterance)return;
      activeVoice=null;quietUntil=context.currentTime+.22;duck(false);
    };
    sys.speak(utterance);
  }

  function openingSeat(state) {
    const opening=state.opening;
    if(state.phase!=="intro"||!opening)return -1;
    const elapsed=opening.length-state.phaseTime;
    for(let side=0;side<2;side++){
      const offset=elapsed-opening.starts[side];
      if(offset>=0&&offset<opening.durations[side])return side;
    }
    return -1;
  }
  function syncMatch(bout,side) {
    const state=bout.state;
    if(commentary?.bout!==bout || (state.round===1&&commentary.round>1)){
      stopVoice();quietUntil=0;
      commentary={bout,side,round:0,phase:"",openingSide:-1,spoken:new Set(),nextAt:0};
    }
    const voice=commentary;
    if(voice.side!==side){
      voice.side=side;
      if(state.phase==="fight" && (activeVoice||pendingVoice))stopVoice();
    }
    if(voice.round!==state.round){
      voice.round=state.round;voice.minorUsed=false;voice.openingSide=-1;
    }
    if(state.paused||scene!=="fight"){
      if(!voice.paused&&(activeVoice||pendingVoice)&&activeVoice?.key!=="win"&&pendingVoice!=="win")stopVoice();
      voice.paused=true;voice.openingSide=-1;return;
    }
    voice.paused=false;
    if(voice.phase!==state.phase){
      if(voice.phase==="intro"&&(activeVoice?.key==="intro"||pendingVoice==="intro"))stopVoice();
      voice.phase=state.phase;
      if(state.phase==="fight")voice.nextAt=Math.max(voice.nextAt,state.clock+6);
    }
    if(state.phase!=="intro"||!state.opening||!dialogue||!enabled||document.hidden||context?.state!=="running")return;
    const seat=openingSeat(state);
    if(seat<0||voice.openingSide===seat)return;
    const opening=state.opening;
    const elapsed=opening.length-state.phaseTime-opening.starts[seat];
    if(opening.durations[seat]-elapsed<.20)return;
    if(activeVoice||pendingVoice)return;
    voice.openingSide=seat;
    void speak(state.fighters[seat].id,"intro",seat,bout,false,elapsed<.12?0:elapsed);
  }
  function combatVoice(type,data) {
    const voice=commentary;
    if(!dialogue||!voice||data.bout!==voice.bout||data.side!==voice.side||scene!=="fight")return;
    const state=voice.bout.state;
    if(state.phase!=="fight"||state.paused)return;
    if(type==="cast"&&data.slot==="ult"){
      if(activeVoice?.key==="ult"||pendingVoice==="ult")return;
      stopVoice();quietUntil=0;voice.nextAt=state.clock+15;
      void speak(data.id,"ult",data.side,data.bout);return;
    }
    if(state.clock<voice.nextAt||voice.minorUsed||activeVoice||pendingVoice||context.currentTime<quietUntil)return;
    let key;
    if(type==="hit"&&(data.slot==="skill1"||data.slot==="skill2"))key=data.slot;
    else if(type==="parry")key="parry";
    else return;
    const clips=MEDIA.lines[data.id],entry=clips?.[ArenaProgress.voiceKey(clips,key,data.bout.voiceSkins?.[data.side])],tag=data.id+"."+key;
    if(!entry||voice.spoken.has(tag))return;
    voice.spoken.add(tag);voice.minorUsed=true;
    voice.nextAt=state.clock+entry.duration+15;
    void speak(data.id,key,data.side,data.bout);
  }

  function deleteVoice(source, nodes) {
    source.onended = () => {
      source.disconnect();
      for (const node of nodes) node.disconnect();
    };
  }

  function wire(source, target, time, duration, level, attack, pan, filter) {
    const envelope = context.createGain();
    const rise = Math.min(attack, duration * 0.4);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(level, time + rise);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    const nodes = [envelope];
    if (filter) {
      source.connect(filter);
      filter.connect(envelope);
      nodes.push(filter);
    } else source.connect(envelope);
    if (pan && context.createStereoPanner) {
      const stereo = context.createStereoPanner();
      stereo.pan.value = Math.max(-1, Math.min(1, pan));
      envelope.connect(stereo);
      stereo.connect(target);
      nodes.push(stereo);
    } else envelope.connect(target);
    deleteVoice(source, nodes);
    source.start(time);
    source.stop(time + duration + 0.012);
  }

  function tone(target, t, wave, a, b, d, gain, pan = 0, attack = 0.006) {
    const osc = context.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(a, t);
    if (a !== b) osc.frequency.exponentialRampToValueAtTime(b, t + d * 0.9);
    wire(osc, target, t, d, gain, attack, pan);
  }

  function rush(target, t, mode, start, end, d, gain, pan = 0, resonance = 0.8) {
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = mode;
    filter.Q.value = resonance;
    filter.frequency.setValueAtTime(start, t);
    filter.frequency.exponentialRampToValueAtTime(end, t + d * 0.95);
    wire(source, target, t, d, gain, 0.005, pan, filter);
  }

  function kick(t, strength) {
    tone(music, t, "sine", 114, 38, 0.21, strength);
    rush(music, t, "lowpass", 1500, 300, 0.035, strength * 0.19);
  }

  // Sixteenth-note groove. Pauses between phrases leave room for hit and guard cues.
  const bass = [38, 38, 34, 36, 38, 41, 34, 36];
  const fightLead = [74, 77, 81, 79, 77, 72, 70, 72];
  const menuLead = [74, 69, 65, 72, 77, 69, 70, 72];
  function musicStep(t) {
    const i = beat % 16;
    const bar = Math.floor(beat / 16) % 8;
    const fight = scene === "fight";
    const root = bass[bar];
    const f = midi(root);
    if (i === 0 || (fight && (i === 6 || i === 10)) || (!fight && i === 10 && bar % 2)) {
      kick(t, fight ? 0.64 : 0.38);
    }
    if (i === 4 || i === 12) {
      rush(music, t, "bandpass", 2600, 900, fight ? 0.115 : 0.085, fight ? 0.48 : 0.25);
      tone(music, t, "triangle", 169, 93, 0.09, 0.23);
    }
    if ((fight && i % 2 === 0) || (!fight && i % 4 === 2)) {
      rush(music, t, "highpass", 6800, 4200, i === 14 ? 0.1 : 0.045, i % 4 ? 0.18 : 0.105, 0.25);
    }
    if (i === 0 || i === 8 || (fight && (i === 3 || i === 11 || i === 14))) {
      const note = f * ((i === 11 || i === 14) ? 1.5 : 1);
      tone(music, t, "triangle", note, note, fight ? 0.23 : 0.58, 0.61);
    }
    if (i === 0 && bar % 2 === 0) {
      for (const [j, interval] of [12, 19, 22].entries()) {
        const hz = midi(root + interval);
        tone(music, t + j * 0.055, "sine", hz, hz, fight ? 0.75 : 1.4, 0.17, (j - 1) * 0.35, 0.085);
      }
    }
    if ((fight && (i === 2 || i === 7 || i === 14)) || (!fight && (i === 6 || i === 14))) {
      const pitch = (fight ? fightLead : menuLead)[(bar * 2 + (i === 14 ? 1 : 0)) % 8] + (i === 7 ? -12 : 0);
      const hz = midi(pitch);
      tone(music, t, "triangle", hz, hz, fight ? 0.17 : 0.48, 0.22, i === 14 ? -0.36 : 0.36);
      tone(music, t + 0.13, "sine", hz, hz, 0.25, 0.068, i === 14 ? 0.5 : -0.5);
    }
    beat++;
  }

  function schedule() {
    if (!music || !context || context.state !== "running") return;
    const now = context.currentTime;
    if (nextNote < now) nextNote = now + 0.012;
    const step = 60 / (scene === "fight" ? 128 : 88) / 4;
    while (nextNote < now + 0.115) {
      musicStep(nextNote);
      nextNote += step;
    }
  }

  function updateMusic() {
    if (!context || context.state !== "running" || document.hidden || scene === "pause" || !enabled) {
      silenceMusic();
      return;
    }
    if (music) return;
    music = gainNode(master, scene === "menu" ? 0.18 : 0.215);
    beat = 0;
    nextNote = context.currentTime + 0.025;
    schedule();
    timer = window.setInterval(schedule, 42);
  }

  function play(type, data = {}) {
    if (!enabled || !context || context.state !== "running" || document.hidden) return;
    if (type === "win" && data.match === true && (data.side === 0 || data.side === 1)) {
      void speak(data.id,"win",data.side,data.bout);
    }
    if(type==="cast"||type==="parry"||type==="hit")combatVoice(type,data);
    const t = context.currentTime + 0.004;
    const side = data.side;
    const seatPan = side === 0 || side === "p1" ? -0.26 : side === 1 || side === "p2" ? 0.26 : 0;
    const p = Number.isFinite(data.x) ? 0.52 * (Math.max(0, Math.min(1, data.x / 1200)) - 0.5) : seatPan;
    const lastKey = type + ":" + (side ?? "") + ":" + (data.id || "");
    const last = lastCue.get(lastKey);
    if (last !== undefined && t - last < 0.035) return;
    lastCue.set(lastKey, t);
    const material=window.ArenaCombatSfx?.cueFor(type,data);
    if(material){materialSound(material,type,data,t,p);return;}
    const osc = (wave, a, b, d, gain, delay = 0) => tone(effects, t + delay, wave, a, b, d, gain, p);
    const crack = (mode, a, b, d, gain, delay = 0) => rush(effects, t + delay, mode, a, b, d, gain, p);
    switch (type) {
      case "choose":
        osc("triangle", 528, 792, 0.074, 0.28);
        osc("sine", 1056, 1056, 0.14, 0.15, 0.054);
        break;
      case "round":
        osc("sine", 622, 622, 0.23, 0.34);
        osc("sine", 932, 932, 0.3, 0.21, 0.09);
        break;
      case "start":
        [50, 57, 62].forEach((n, i) => osc("triangle", midi(n), midi(n), 0.21, 0.35, i * 0.081));
        crack("bandpass", 820, 3600, 0.22, 0.28);
        break;
      case "fight":
        osc("sine", 130, 52, 0.21, 0.58);
        osc("triangle", 524, 784, 0.16, 0.32);
        break;
      case "win": {
        if (data.side === -1) {
          osc("triangle", 349, 330, 0.29, 0.35);
          osc("triangle", 294, 294, 0.37, 0.31, 0.25);
          break;
        }
        [62, 69, 74, 77, 81].forEach((n, i) => {
          osc("triangle", midi(n), midi(n), i === 4 ? 0.64 : 0.24, 0.38, i * 0.09);
          osc("sine", midi(n - 12), midi(n - 12), 0.36, 0.32, i * 0.09);
        });
        break;
      }
    }
  }

  window.ArcadeAudio = Object.freeze({ unlock, setEnabled, setCombatVolume, setScene, setDialogue, warmVoices, syncMatch, openingSeat, speak, previewTier, stopSelectionPreview, mouth, play });
})();
