const MEDIA = (() => {
  const data=ARENA_MEDIA;
  const pages=new Map(),palettes=new Map();
  let pixels=0;
  const url=name=>(data.assetRoot||'assets/')+name;
  function page(name) {
    const hit=pages.get(name);
    if(hit){
      pages.delete(name);pages.set(name,hit);
      return hit;
    }
    const item={};
    pages.set(name,item);
    const image=new Image();
    image.src=url(name);
    item.ready=image.decode().then(()=>{
      item.image=image;
      pixels+=image.width*image.height;
      for(const [key,old] of pages){
        if(pixels<=12*1024*1024)break;
        if(old.image&&old!==item){pixels-=old.image.width*old.image.height;pages.delete(key);}
      }
      return image;
    }).catch(error=>{
      if(pages.get(name)===item)setTimeout(()=>{if(pages.get(name)===item)pages.delete(name);},3000);
      throw error;
    });
    // A rendering pass may request a page without awaiting it. Preparation still sees failures.
    item.ready.catch(error=>console.warn('动作纹理读取失败',name,error));
    return item;
  }
  function palette(id,skin) {
    const key=id+'-'+skin;
    if(!palettes.has(key)){
      palettes.set(key,null);
      fetch(url(key+'.bin')).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();})
        .then(buffer=>{palettes.set(key,new Int8Array(buffer));})
        .catch(error=>{console.warn('衣装颜色读取失败',key,error);setTimeout(()=>palettes.delete(key),3000);});
    }
    return palettes.get(key);
  }
  const formPicture=name=>url(name+'.webp');
  const phone=matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints>1;
  return {...data,phone,page,palette,sheet:url,fxSheet:url,formPicture,bodyArt:formPicture};
})();
