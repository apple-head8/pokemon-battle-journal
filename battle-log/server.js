const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.join(__dirname, 'public');
const fields = {team:150,date:10,leadWork:500,notes:20000,review:10000};
const defaultParty={id:'default-v2',name:'V2｜マスカーニャ入り',members:['カバルドン','ルカリオ','カイリュー','マスカーニャ','リザードンX','イダイトウ'].map(name=>({name,details:''}))};
function validateParty(input){
  if(!input || typeof input.name!=='string' || !input.name.trim() || input.name.length>150 || !Array.isArray(input.members) || input.members.length!==6) throw new Error('パーティー名と6匹を入力してください。');
  const members=input.members.map(m=>{
    if(!m || typeof m.name!=='string' || !m.name.trim() || m.name.length>100)throw new Error('ポケモン名を確認してください。');
    const member={name:m.name.trim()};
    for(const [key,max] of [['details',2000],['item',100],['ability',100],['nature',30]]){const v=m[key]??'';if(typeof v!=='string'||v.length>max)throw new Error('持ち物・特性・性格・旧メモを確認してください。');member[key]=v.trim();}
    const stats=['hp','atk','def','spa','spd','spe'];member.sp={};
    for(const key of stats){const value=m.sp?.[key]??0;if(!Number.isInteger(value)||value<0||value>32)throw new Error('配分は各能力0〜32の整数で入力してください。');member.sp[key]=value;}
    if(Object.values(member.sp).reduce((a,b)=>a+b,0)>66)throw new Error('配分の合計は66以下にしてください。');
    member.moves=m.moves??['','','',''];if(!Array.isArray(member.moves)||member.moves.length!==4||member.moves.some(v=>typeof v!=='string'||v.length>100))throw new Error('技は4枠で入力してください。');member.moves=member.moves.map(v=>v.trim());
    const filled=member.moves.filter(Boolean);if(new Set(filled).size!==filled.length)throw new Error('同じ技が重複しています。');
    return member;
  });
  if(new Set(members.map(m=>m.name)).size!==6)throw new Error('同じ名前が重複しています。');
  if(input.id && !/^[a-zA-Z0-9-]{1,80}$/.test(input.id))throw new Error('パーティーIDが正しくありません。');
  if(input.archived!==undefined && typeof input.archived!=='boolean')throw new Error('パーティーの状態が正しくありません。');
  return {id:input.id||crypto.randomUUID(),name:input.name.trim(),members,archived:input.archived??false};
}
function validate(input) {
  if (!input || typeof input !== 'object') throw new Error('記録の形式が正しくありません。');
  const out = {};
  for (const [key, max] of Object.entries(fields)) {
    if (typeof input[key] !== 'string' || input[key].length > max) throw new Error(`${key} の入力を確認してください。`);
    out[key] = input[key].trim();
  }
  if (!out.team || !/^\d{4}-\d{2}-\d{2}$/.test(out.date) || !Number.isFinite(Date.parse(out.date)) || new Date(out.date).toISOString().slice(0,10)!==out.date) throw new Error('構築名と対戦日を確認してください。');
  for (const [key, values] of Object.entries({result:['win','loss','draw'],rocks:['unknown','yes','prevented','none'],setup:['unknown','yes','no','unused']})) {
    if (!values.includes(input[key])) throw new Error('選択項目が正しくありません。');
    out[key] = input[key];
  }
  for (const [key, length] of Object.entries({opponents:6,own:3,enemy:3})) {
    if (!Array.isArray(input[key]) || input[key].length !== length || input[key].some(v=>typeof v!=='string'||v.length>100)) throw new Error('パーティの入力を確認してください。');
    out[key] = input[key].map(v=>v.trim());
  }
  if (input.id && !/^[a-zA-Z0-9-]{1,80}$/.test(input.id)) throw new Error('記録IDが正しくありません。');
  out.id = input.id || crypto.randomUUID();
  out.createdAt = typeof input.createdAt==='string' && Number.isFinite(Date.parse(input.createdAt)) ? input.createdAt : new Date().toISOString();
  out.updatedAt = new Date().toISOString();
  if(input.partySnapshot)out.partySnapshot=validateParty(input.partySnapshot);
  return out;
}
function createServer({dataDir=path.join(__dirname,'data')}={}) {
  fs.mkdirSync(dataDir,{recursive:true});
  const file=path.join(dataDir,'battles.json');
  const read=()=>{const data=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{version:1,records:[]};return {...data,parties:(data.parties??[defaultParty]).map(validateParty)};};
  const initial=read();
  if(initial.version!==1 || !Array.isArray(initial.records)) throw new Error('保存ファイルを読み込めません。元ファイルを保持して停止しました。');
  initial.records.forEach(validate);
  if(!Array.isArray(initial.parties))throw new Error('パーティーデータを読み込めません。');
  initial.parties.forEach(validateParty);
  function write(records,parties){
    const tmp=file+'.tmp';
    fs.writeFileSync(tmp,JSON.stringify({version:1,records,parties},null,2),'utf8');
    if(fs.existsSync(file)) fs.copyFileSync(file,file+'.bak');
    fs.renameSync(tmp,file);
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
      const assets={'/':['index.html','text/html'],'/parties':['parties.html','text/html'],'/shared.js':['shared.js','text/javascript'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/theme.css':['theme.css','text/css'],'/management.css':['management.css','text/css']};
      let asset=assets[url.pathname];
      if(/^\/build\/[a-zA-Z0-9_.-]+\.js$/.test(url.pathname))asset=[url.pathname.slice(1),'text/javascript'];
      if(!asset || !fs.existsSync(path.join(ROOT,asset[0]))) return json(404,{error:'見つかりません。'});
      res.writeHead(200,{'Content-Type':asset[1]+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"});
      res.end(fs.readFileSync(path.join(ROOT,asset[0])));
    }catch(error){console.error(error.message);json(400,{error:'保存・読み込みに失敗しました。入力は残っています。'+error.message});}
  });
  return server;
}
if(require.main===module){const server=createServer();server.on('error',e=>{console.error('起動できません: '+e.message);process.exitCode=1;});server.listen(4318,'127.0.0.1',()=>console.log('対戦ノート: http://127.0.0.1:4318'));}
module.exports={createServer,validate};
