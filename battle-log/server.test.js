const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer}=require('./server');
test('保存・再起動・編集・重複読み込み・入力検証・削除',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'battle-note-test-'));
  let server=createServer({dataDir:dir});
  async function start(){await new Promise(r=>server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${server.address().port}`;}
  let url=await start();
  const post=(route,data,origin)=>fetch(url+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(data)});
  const sample={id:'test-1',team:'検証用',date:'2026-10-05',result:'win',opponents:['アシレーヌ','','','','',''],own:['マスカーニャ','ルカリオ','イダイトウ'],enemy:['アシレーヌ','',''],rocks:'none',setup:'yes',leadWork:'初手の仕事',notes:'1T\n2T',review:'検証'};
  try{
    assert.equal((await fetch(url)).status,200);
    assert.equal((await post('records',sample)).status,200);
    await new Promise(r=>server.close(r));server=createServer({dataDir:dir});url=await start();
    let saved=await(await fetch(url+'/api/records')).json();assert.equal(saved.records[0].notes,'1T\n2T');
    const original=saved.records[0].createdAt;
    saved=await(await post('records',{...sample,result:'loss'})).json();assert.equal(saved.records.length,1);assert.equal(saved.records[0].result,'loss');assert.equal(saved.records[0].createdAt,original);
    saved=await(await post('import',{version:1,records:[sample,{...sample,id:'test-2'}]})).json();assert.equal(saved.records.length,2);assert.equal(saved.records[0].result,'loss');
    assert.equal((await post('records',{...sample,date:'2026-02-31'})).status,400);
    assert.equal((await post('import',{version:1,records:[{...sample,id:'test-3'},{bad:true}]})).status,400);
    assert.equal((await(await fetch(url+'/api/records')).json()).records.length,2);
    assert.equal((await post('records',sample,'https://untrusted.example')).status,403);
    const party={id:'party-1',name:'カスタム構築',members:['マスカーニャ','ルカリオ','カイリュー','カバルドン','リザードンX','イダイトウ'].map(name=>({name,details:name==='ルカリオ'?'臆病 / 悪巧み':''}))};
    let partyResult=await(await post('parties',party)).json();
    assert.equal(partyResult.parties.find(p=>p.id===party.id).members[0].name,'マスカーニャ');
    assert.equal(partyResult.records.length,2);
    await post('records',{...sample,id:'test-2',partySnapshot:party});
    const reordered={...party,members:[...party.members].reverse()};
    partyResult=await(await post('parties',reordered)).json();
    assert.equal(partyResult.parties.find(p=>p.id===party.id).members[0].name,'イダイトウ');
    assert.equal(partyResult.records.find(r=>r.id==='test-2').partySnapshot.members[0].name,'マスカーニャ');
    assert.equal((await post('parties',{...party,id:'duplicate'})).status,400);
    assert.equal((await post('parties',{...party,members:party.members.slice(0,5)})).status,400);
    await new Promise(r=>server.close(r));server=createServer({dataDir:dir});url=await start();
    const restored=await(await fetch(url+'/api/records')).json();
    assert.deepEqual(restored.parties.find(p=>p.id===party.id).members,reordered.members);
    assert.equal((await post('import',restored)).status,200);
    assert.equal((await(await fetch(url+'/api/records')).json()).parties.length,2);
    assert.equal((await post('delete',{id:'test-1'})).status,200);
    assert.equal((await(await fetch(url+'/api/records')).json()).records.length,1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'battles.json.bak'),'utf8')).records.length,2);
  }finally{await new Promise(r=>server.close(r));for(const name of ['battles.json','battles.json.bak','battles.json.tmp']){const p=path.join(dir,name);if(fs.existsSync(p))fs.unlinkSync(p);}fs.rmdirSync(dir);}
});
