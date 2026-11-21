'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {once}=require('node:events');
const {createArena}=require('./server.cjs');

test('public client, account and cross-account room share the same server',async()=>{
  const opts={db:':memory:',host:'127.0.0.1',html:path.resolve(__dirname,'../public/index.html')};
  const app=createArena(opts);
  try {
    app.server.listen(0,opts.host);
    await once(app.server,'listening');
    const origin='http://127.0.0.1:'+app.server.address().port;
    const post=async(route,body,cookie)=>{
      const res=await fetch(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
      const data=await res.json();
      assert.ok(res.ok,route+' '+res.status+' '+JSON.stringify(data));
      return {data,cookie:res.headers.get('set-cookie')?.split(';')[0]};
    };
    const page=await fetch(origin+'/');
    assert.ok((await page.text()).includes('js/app.js'));
    const asset=await fetch(origin+'/assets/kimi.webp',{headers:{Range:'bytes=0-11'}});
    assert.equal(asset.status,206);
    assert.equal(Buffer.from(await asset.arrayBuffer()).subarray(8,12).toString(),'WEBP');
    const first=await post('/api/register',{name:'TestAlpha',password:'TestPassA18'});
    const second=await post('/api/register',{name:'TestBravo',password:'TestPassB29'});
    const host=await post('/api/rooms',{stage:'astral',fighter:'claude'},first.cookie);
    assert.equal(host.data.room.players[0].fighter,'claude');
    const join=await post('/api/rooms/join',{code:host.data.room.code,fighter:'kimi'},second.cookie);
    assert.equal(join.data.room.players[1].fighter,'kimi');
    await post('/api/room/ready',{ready:true},first.cookie);
    const started=await post('/api/room/ready',{ready:true},second.cookie);
    assert.ok(started.data.room.matchId);
  } finally {await app.stop();}
});
