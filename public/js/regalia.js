(() => {
  'use strict';
  const tiers=['base','medium','high','extra','max','ultra'];
  const characters={
    deepseek:{jewel:'#91e5ff',metal:'#cbd8ec'},
    chatgpt:{jewel:'#bbfff0',metal:'#e9dbab'},
    claude:{jewel:'#96ddff',metal:'#d4e6f3'},
    gemini:{jewel:'#e1bbff',metal:'#d4baf0'},
    grok:{jewel:'#ff8299',metal:'#d3a76e'},
    kimi:{jewel:'#d3c3ff',metal:'#e6dcf5'}
  };
  const images=new Map();
  function prepare(id){
    const name=id+'-aureole';
    if(!images.has(name)){
      const image=new Image();
      image.src=MEDIA.formPicture(name);
      const ready=image.decode().catch(error=>{images.delete(name);throw error;});
      images.set(name,{image,ready});
    }
    return images.get(name).ready;
  }
  function halo(c,id,x,y,r,t,reduced,flare=0){
    const spec=characters[id],picture=images.get(id+'-aureole')?.image;if(!picture?.naturalWidth)return;
    c.save();c.translate(x,y+(reduced?0:1.4*Math.sin(t*1.6)));c.rotate(reduced?0:.028*Math.sin(t*.55));
    c.scale(1+flare*.075,1+flare*.075);
    const glow=c.createRadialGradient(0,0,r*.38,0,0,r*1.06);
    glow.addColorStop(0,'transparent');glow.addColorStop(.45,spec.jewel+'35');glow.addColorStop(.69,spec.metal+'68');glow.addColorStop(1,'transparent');
    c.fillStyle=glow;c.fillRect(-r*1.08,-r*1.08,r*2.16,r*2.16);
    c.drawImage(picture,-r,-r,r*2,r*2);
    if(!reduced){
      c.fillStyle='#fff7dc';
      for(let i=0;i<5;i++){
        const a=t*.31+i*2.4,rx=Math.cos(a)*r*.78,ry=Math.sin(a)*r*.78;
        const size=.35+Math.pow(Math.max(0,Math.cos(a*2.1)),5)*1.8;
        c.beginPath();c.moveTo(rx,ry-size*2);c.quadraticCurveTo(rx,ry,rx+size,ry);c.quadraticCurveTo(rx,ry,rx,ry+size*2);
        c.quadraticCurveTo(rx,ry,rx-size,ry);c.quadraticCurveTo(rx,ry,rx,ry-size*2);c.fill();
      }
    }
    c.restore();
  }
  function placement(anchor,down){
    return {x:anchor.nx-5,y:anchor.ny+(down?0:8),r:Math.min(108,Math.max(88,anchor.len*2.48))};
  }
  window.ArenaRegalia={rank:skin=>tiers.indexOf(skin),halo,placement,prepare};
})();
