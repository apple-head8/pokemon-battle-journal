const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createStore}=require('./local-storage.cjs');
test('ファイル保存・再起動・30世代バックアップ・競合拒否・破損から復元',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rotom-storage-'));const store=createStore(dir);
  let current=store.read();const party={id:'test',name:'テスト',members:Array.from({length:6},(_,i)=>({name:'テスト'+i}))};
  current=store.change('parties',party,current.revision);const oldRevision=current.revision;
  for(let i=0;i<35;i++)current=store.change('parties',{...party,name:'構築'+i},current.revision);
  assert.equal(createStore(dir).read().data.parties[0].name,'構築34');
  assert.equal(fs.readdirSync(store.backups).length,30);
  assert.throws(()=>store.change('parties',party,oldRevision),/更新/);
  const before=fs.readFileSync(store.file,'utf8');assert.throws(()=>store.change('parties',{...party,members:[]},current.revision));assert.equal(fs.readFileSync(store.file,'utf8'),before);
  fs.writeFileSync(store.file,'broken');assert.throws(()=>store.read());store.restore(JSON.parse(before));assert.equal(store.read().data.parties[0].name,'構築34');
  assert.ok(fs.readdirSync(store.backups).some(n=>fs.readFileSync(path.join(store.backups,n),'utf8')==='broken'));
});
