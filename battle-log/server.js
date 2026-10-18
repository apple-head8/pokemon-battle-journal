const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.join(__dirname, 'public');
const {validate,validateParty}=require('./public/validation.js');
const {createStore}=require('./local-storage.cjs');
function createServer({dataDir=path.join(__dirname,'data')}={}) {
  fs.mkdirSync(dataDir,{recursive:true});
  const file=path.join(dataDir,'battles.json');
  const storage=createStore(dataDir);
  const read=()=>{const data=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{version:1,records:[]};return {...data,parties:(data.parties??[]).map(validateParty)};};
  const initial=read();
  if(initial.version!==1 || !Array.isArray(initial.records)) throw new Error('保存ファイルを読み込めません。元ファイルを保持して停止しました。');
  initial.records.forEach(validate);
  if(!Array.isArray(initial.parties))throw new Error('パーティーデータを読み込めません。');
  initial.parties.forEach(validateParty);
  function write(records,parties){
    storage.save({version:1,records,parties},storage.read().revision);
  }
  const server=http.createServer(async(req,res)=>{
    const host=req.headers.host;
    const expected=`127.0.0.1:${server.address().port}`;
    function json(code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
    if(host!==expected && host!==`localhost:${server.address().port}`) return json(403,{error:'ローカル接続のみ利用できます。'});
    if(req.headers.origin && ![`http://${expected}`,`http://localhost:${server.address().port}`].includes(req.headers.origin)) return json(403,{error:'外部ページからは操作できません。'});
    const url=new URL(req.url,`http://${expected}`);
    try{
      if(req.method==='GET' && url.pathname==='/api/records') return json(200,read());
      if(req.method==='POST' && ['/api/records','/api/import','/api/delete','/api/parties','/api/party-status'].includes(url.pathname)) {
        if(!req.headers['content-type']?.startsWith('application/json')) return json(415,{error:'JSON形式で送信してください。'});
        let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>5_000_000) return json(413,{error:'ファイルが大きすぎます（上限5MB）。'});}
        let input;try{input=JSON.parse(body);}catch{return json(400,{error:'JSONを読み込めません。'});}
        let {records,parties}=read();
        if(url.pathname==='/api/party-status'){
          const party=parties.find(p=>p.id===input.id);
          if(!party)return json(404,{error:'パーティーが見つかりません。'});
          if(typeof input.archived!=='boolean')throw new Error('パーティーの状態が正しくありません。');
          party.archived=input.archived;
        }else if(url.pathname==='/api/parties'){
          const party=validateParty(input);
          if(parties.some(p=>p.name===party.name && p.id!==party.id))return json(400,{error:'同じパーティー名が登録済みです。別の名前にしてください。'});
          const index=parties.findIndex(p=>p.id===party.id);if(index<0)parties.push(party);else parties[index]=party;
        }else if(url.pathname==='/api/records'){
          const record=validate(input);const old=records.find(r=>r.id===record.id);
          const selectedParty=parties.find(p=>record.partySnapshot?p.id===record.partySnapshot.id:p.name===record.team);
          if(!old && selectedParty?.archived)return json(400,{error:'没にしたパーティーです。復帰させるか、使用構築を変更してください。'});
          if(old) record.createdAt=old.createdAt;
          records=records.filter(r=>r.id!==record.id);records.push(record);
        }else if(url.pathname==='/api/delete'){
          if(typeof input.id!=='string'||!records.some(r=>r.id===input.id)) return json(404,{error:'記録が見つかりません。'});
          records=records.filter(r=>r.id!==input.id);
        }else{
          if(input.version!==1 || !Array.isArray(input.records) || input.records.length>10000) return json(400,{error:'このアプリのバックアップJSONを選んでください。'});
          const incoming=input.records.map(validate);const ids=new Set(records.map(r=>r.id));
          if(input.parties!==undefined && (!Array.isArray(input.parties)||input.parties.length>1000))throw new Error('パーティー一覧が正しくありません。');
          const incomingParties=(input.parties||[]).map(validateParty);
          for(const p of incomingParties){if(parties.some(existing=>existing.id===p.id))continue;if(parties.some(existing=>existing.name===p.name))throw new Error('別IDの同名パーティーがあります。名前を確認してください。');parties.push(p);}
          for(const record of incoming) if(!ids.has(record.id)){records.push(record);ids.add(record.id);}
        }
        write(records,parties);return json(200,{version:1,records,parties});
      }
      if(req.method!=='GET') return json(405,{error:'操作できません。'});
      const assets={'/':['index.html','text/html'],'/parties':['parties.html','text/html'],'/history':['history.html','text/html'],'/history.js':['history.js','text/javascript'],'/shared.js':['shared.js','text/javascript'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/theme.css':['theme.css','text/css'],'/management.css':['management.css','text/css']};
      let asset=assets[url.pathname];
      if(/^\/build\/[a-zA-Z0-9_.-]+\.js$/.test(url.pathname))asset=[url.pathname.slice(1),'text/javascript'];
      if(!asset || !fs.existsSync(path.join(ROOT,asset[0]))) return json(404,{error:'見つかりません。'});
      res.writeHead(200,{'Content-Type':asset[1]+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"});
      res.end(fs.readFileSync(path.join(ROOT,asset[0])));
    }catch(error){console.error(error.message);json(400,{error:'保存・読み込みに失敗しました。入力は残っています。'+error.message});}
  });
  return server;
}
if(require.main===module){const server=createServer();server.on('error',e=>{console.error('起動できません: '+e.message);process.exitCode=1;});server.listen(4318,'127.0.0.1',()=>console.log('ロトムログ: http://127.0.0.1:4318'));}
module.exports={createServer,validate};
