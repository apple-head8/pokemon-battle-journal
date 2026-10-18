const {test}=require('node:test'),assert=require('node:assert/strict');
const {change,checkFile}=require('./public/journal-core.js');
const empty=()=>({version:1,records:[],parties:[]});
const party={id:'party',name:'テスト',members:Array.from({length:6},(_,i)=>({name:'ポケモン'+i}))};
const record={id:'record',team:'テスト',date:'2026-10-08',result:'win',opponents:Array(6).fill(''),own:['','',''],enemy:['','',''],rocks:'unknown',setup:'unknown',leadWork:'',notes:'',review:'',partySnapshot:party};
test('Web保存・編集・複製・没・削除とJSON復元',()=>{
  let state=change(empty(),'parties',party);state=change(state,'records',record);
  const stamp=state.records[0].createdAt;
  state=change(state,'records',{...record,review:'変更'});assert.equal(state.records[0].createdAt,stamp);
  const source=structuredClone(state);state=change(state,'party-status',{id:'party',archived:true});
  assert.equal(source.parties[0].archived,false);
  assert.throws(()=>change(state,'records',{...record,id:'new'}),/没/);
  state=change(state,'records',{...record,review:'過去の編集'});
  const restored=change(empty(),'import',JSON.parse(JSON.stringify(state)));
  assert.equal(restored.records[0].review,'過去の編集');assert.equal(restored.parties[0].archived,true);
  assert.equal(change(restored,'import',restored).records.length,1);
  assert.equal(change(restored,'delete',{id:'record'}).records.length,0);
  assert.equal(restored.records.length,1);
});
test('壊れたファイル・重複ID・不正配分を全件検証し部分反映しない',()=>{
  const state=change(empty(),'parties',party),before=structuredClone(state);
  assert.throws(()=>change(state,'import',{version:1,records:[record,{bad:true}]}));
  assert.deepEqual(state,before);
  assert.throws(()=>checkFile({version:1,records:[record,record]}),/重複/);
  assert.throws(()=>checkFile({version:2,records:[]}));
  assert.throws(()=>change(state,'parties',{...party,members:party.members.map(m=>({...m,sp:{hp:33}}))}));
  assert.throws(()=>change(state,'records',{...record,own:['同じ','同じ','']}),/重複/);
  assert.throws(()=>change(state,'import',{version:1,records:[],parties:[{...party,id:'other'}]}),/同名/);
});
test('JSON中のHTMLは文字列のまま、未知のフィールドを保持しない',()=>{
  const payload='<img src=x onerror=alert(1)>';
  const state=change(empty(),'import',JSON.parse(JSON.stringify({version:1,records:[{...record,review:payload,unexpected:'drop'}],parties:[]})));
  assert.equal(state.records[0].review,payload);assert.equal(state.records[0].unexpected,undefined);
  assert.equal({}.polluted,undefined);
});
test('IndexedDBの再接続・競合拒否・出力JSON・書き出し後の競合保護',async()=>{
  const {IDBFactory}=require('fake-indexeddb');const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const indexedDB=new IDBFactory();
  function page(){
    const elements=[],events={},blobs=[];
    const document={
      addEventListener:(name,fn)=>events[name]=fn,
      createElement:tag=>{const element={tag,children:[],textContent:'',append(...nodes){this.children.push(...nodes);},prepend(){},setAttribute(){},addEventListener(name,fn){this[name]=fn;},click(){this.clicked=true;}};elements.push(element);return element;},
      getElementById:id=>elements.find(e=>e.id===id),querySelector:()=>({prepend(){}})
    };
    const context=vm.createContext({indexedDB,document,JournalCore:{change},structuredClone,Blob,URL:{createObjectURL:blob=>{blobs.push(blob);return 'blob:test';},revokeObjectURL(){}},setTimeout,console});context.window=context;
    vm.runInContext(fs.readFileSync(path.join(__dirname,'public/web-storage.js'),'utf8'),context);
    events.DOMContentLoaded();return {api:context.journalAPI,elements,blobs,export:()=>elements.find(e=>e.tag==='button').click()};
  }
  const a=page(),b=page();await a.api('records');await b.api('records');
  await a.api('parties',party);
  await assert.rejects(()=>b.api('parties',{...party,name:'古いタブ'}),/別のタブ/);
  // Export from a stale editor must use the latest state, and must not permit a stale write.
  await b.export();assert.equal(b.blobs.length,1);
  const exported=JSON.parse(await b.blobs[0].text());assert.equal(exported.parties[0].name,party.name);
  await assert.rejects(()=>b.api('parties',{...party,name:'古いタブ'}),/別のタブ/);
  const c=page();assert.equal((await c.api('records')).parties[0].name,party.name);
  await assert.rejects(()=>c.api('import',{version:1,records:[record,{bad:true}]}));
  assert.equal((await c.api('records')).records.length,0);
  await c.api('records',record);await c.export();
  const restored=checkFile(JSON.parse(await c.blobs.at(-1).text()));assert.equal(restored.records.length,1);
  assert.equal(c.elements.find(e=>e.id==='webDownloadLink').hidden,false);
});
test('Web配信ファイルに個人データ・API・外部フォントを含めない',()=>{
  const fs=require('node:fs'),path=require('node:path');const dir=path.join(__dirname,'web-dist');
  assert.ok(fs.existsSync(path.join(dir,'index.html')),'先に npm run build:web を実行してください');
  const {base}=JSON.parse(fs.readFileSync(path.join(dir,'build-info.json'),'utf8'));
  const allowed=['.nojekyll','404.html','_headers','app.js','build','build-info.json','file-journal.js','history','history.js','index.html','journal-core.js','management.css','parties','shared.js','style.css','theme.css','validation.js','web-init.css','web-init.js','web-storage.js'];
  assert.deepEqual(fs.readdirSync(dir).sort(),allowed.sort(),'公開対象に想定外のファイルを含めない');
  for(const forbidden of ['data','server.js','node_modules','.env'])assert.equal(fs.existsSync(path.join(dir,forbidden)),false);
  for(const name of ['app.js','history.js','shared.js','web-storage.js'])assert.doesNotMatch(fs.readFileSync(path.join(dir,name),'utf8'),/fetch\(/);
  assert.doesNotMatch(fs.readFileSync(path.join(dir,'style.css'),'utf8'),/https?:/);
  const headers=fs.readFileSync(path.join(dir,'_headers'),'utf8');assert.match(headers,/connect-src 'none'/);assert.match(headers,/frame-ancestors 'none'/);assert.doesNotMatch(headers,/unsafe-inline|unsafe-eval/);
  for(const name of ['index.html','parties/index.html','history/index.html']){
    const html=fs.readFileSync(path.join(dir,name),'utf8');assert.ok(html.includes(`src="${base}web-storage.js"`));assert.match(html,/Content-Security-Policy/);assert.doesNotMatch(html,/<script(?![^>]*src=)[^>]*>[^<]+/);
    for(const match of html.matchAll(/(?:src|href)="(\/[^" ]*)"/g))assert.ok(match[1].startsWith(base),match[1]);
  }
  assert.ok(fs.readFileSync(path.join(dir,'history.js'),'utf8').includes(`edit.href='${base}?edit='`));
  assert.ok(fs.readFileSync(path.join(dir,'index.html'),'utf8').includes(`href="${base}parties/"`));
});

test('指定JSONの書込み・外部変更拒否・失敗後の再試行',async()=>{
  const {read,write}=require('./public/file-journal.js');let text='',fail=false,closes=0,aborts=0;
  const handle={getFile:async()=>({size:Buffer.byteLength(text),text:async()=>text}),createWritable:async options=>{
    assert.equal(options.mode,'exclusive');let staged;
    return {write:async value=>{if(fail)throw new Error('disk full');staged=value;},close:async()=>{text=staged;closes++;},abort:async()=>{aborts++;}};
  }};
  const first=await write(handle,'',empty());assert.equal(await read(handle),first);assert.equal(closes,1);
  await write(handle,'',empty());assert.equal(closes,1);
  const next=change(empty(),'parties',party);fail=true;
  await assert.rejects(()=>write(handle,first,next),/disk full/);assert.equal(text,first);assert.equal(aborts,1);
  fail=false;await write(handle,first,next);assert.equal(closes,2);
  text='external edit';await assert.rejects(()=>write(handle,first,empty()),/外部で変更/);assert.equal(text,'external edit');
  text='x'.repeat(5_000_001);await assert.rejects(()=>read(handle),/5MB/);
});

test('ファイル連携：失敗時は退避、再保存で復旧、古いタブは拒否',async()=>{
  const {IDBFactory}=require('fake-indexeddb'),vm=require('node:vm'),fs=require('node:fs');
  const indexedDB=new IDBFactory();let text='',fail=false,permission='granted';
  const handle={name:'test.json',queryPermission:async()=>permission,requestPermission:async()=>permission,
    getFile:async()=>({size:Buffer.byteLength(text),text:async()=>text}),createWritable:async()=>{let staged;return {write:async value=>{if(fail)throw new Error('disk full');staged=value;},close:async()=>{text=staged;},abort:async()=>{}};}};
  // Browsers clone FileSystemFileHandle natively; fake-indexeddb needs a test double.
  const clone=global.structuredClone;
  global.structuredClone=value=>value?.file?.handle===handle?{...clone({...value,file:{...value.file,handle:null}}),file:{...value.file,handle}}:clone(value);
  let queue=Promise.resolve();
  function page(){
    const elements=[],events={},confirmations=[];
    const document={addEventListener:(k,v)=>events[k]=v,createElement:tag=>{const e={tag,append(){},prepend(){},setAttribute(){},addEventListener(k,v){this[k]=v;},click(){}};elements.push(e);return e;},getElementById:id=>elements.find(e=>e.id===id),querySelector:()=>({prepend(){}})};
    const context=vm.createContext({indexedDB,document,JournalCore:{change,checkFile},JournalFile:require('./public/file-journal.js'),structuredClone:clone,Blob,URL,console,
      navigator:{locks:{request:(_,fn)=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;}}},showSaveFilePicker:async()=>handle,showOpenFilePicker:async()=>[handle],confirm:text=>{confirmations.push(text);return true;},location:{reload(){}}});context.window=context;
    vm.runInContext(fs.readFileSync('public/web-storage.js','utf8'),context);events.DOMContentLoaded();
    return {confirmations,setDirty:value=>{context.journalHasUnsavedDraft=()=>value;},setup:context.journalSetup,api:context.journalAPI,click:label=>elements.find(e=>e.textContent===label).click(),status:()=>elements.find(e=>e.id==='webBackupStatus').textContent};
  }
  try{
    const a=page();await a.api('records');assert.equal((await a.setup.state()).mode,'unset');await a.setup.browser();assert.equal((await a.setup.state()).mode,'browser');await a.api('parties',party);await a.click('今の記録を別ファイルに保存');assert.equal(JSON.parse(text).parties.length,1);
    const b=page();await b.api('records');assert.equal((await b.setup.state()).mode,'file');assert.equal((await b.setup.state()).permission,'granted');
    permission='prompt';await assert.rejects(()=>a.setup.resume(),/確認が完了/);permission='granted';
    fail=true;await assert.rejects(()=>a.api('records',record),/未保存/);assert.equal(JSON.parse(text).records.length,0);
    assert.equal((await a.api('records')).records.length,1);
    await assert.rejects(()=>b.api('parties',{...party,name:'stale'}),/別のタブ/);
    await assert.rejects(()=>a.api('records',{...record,id:'duplicate'}),/前回/);
    permission='denied';await a.click('許可して再保存');assert.match(a.status(),/書き込み許可を取得できません/);
    fail=false;permission='granted';await a.click('許可して再保存');assert.equal(JSON.parse(text).records.length,1);
    text='external';await assert.rejects(()=>a.api('parties',{...party,name:'変更'}),/外部で変更/);assert.equal(text,'external');
    await a.click('別の記録ファイルを開く');assert.equal((await a.api('records')).parties[0].name,'変更');
    text=JSON.stringify(change(empty(),'parties',{...party,name:'別ファイル'}));
    const incoming=text;a.setDirty(true);await assert.rejects(()=>a.setup.connect(true),/入力中の未保存/);a.setDirty(false);await a.click('別の記録ファイルを開く');assert.ok(a.confirmations.some(t=>t.includes('現在の変更はファイルに未保存')));assert.equal(text,incoming);
    assert.equal((await a.api('records')).parties[0].name,'別ファイル');
    await a.click('今の記録を別ファイルに保存');assert.match(a.status(),/空でない/);assert.equal(text,incoming);

  }finally{global.structuredClone=clone;}
});
