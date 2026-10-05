const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.join(__dirname, 'public');
const fields = {team:150,date:10,leadWork:500,notes:20000,review:10000};
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
  return out;
}
function createServer({dataDir=path.join(__dirname,'data')}={}) {
  fs.mkdirSync(dataDir,{recursive:true});
  const file=path.join(dataDir,'battles.json');
  const read=()=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{version:1,records:[]};
  const initial=read();
  if(initial.version!==1 || !Array.isArray(initial.records)) throw new Error('保存ファイルを読み込めません。元ファイルを保持して停止しました。');
  initial.records.forEach(validate);
  function write(records){
    const tmp=file+'.tmp';
    fs.writeFileSync(tmp,JSON.stringify({version:1,records},null,2),'utf8');
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
      if(req.method==='POST' && ['/api/records','/api/import','/api/delete'].includes(url.pathname)) {
        if(!req.headers['content-type']?.startsWith('application/json')) return json(415,{error:'JSON形式で送信してください。'});
        let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>5_000_000) return json(413,{error:'ファイルが大きすぎます（上限5MB）。'});}
        let input;try{input=JSON.parse(body);}catch{return json(400,{error:'JSONを読み込めません。'});}
        let records=read().records;
        if(url.pathname==='/api/records'){
          const record=validate(input);const old=records.find(r=>r.id===record.id);
          if(old) record.createdAt=old.createdAt;
          records=records.filter(r=>r.id!==record.id);records.push(record);
        }else if(url.pathname==='/api/delete'){
          if(typeof input.id!=='string'||!records.some(r=>r.id===input.id)) return json(404,{error:'記録が見つかりません。'});
          records=records.filter(r=>r.id!==input.id);
        }else{
          if(input.version!==1 || !Array.isArray(input.records) || input.records.length>10000) return json(400,{error:'このアプリのバックアップJSONを選んでください。'});
          const incoming=input.records.map(validate);const ids=new Set(records.map(r=>r.id));
          for(const record of incoming) if(!ids.has(record.id)){records.push(record);ids.add(record.id);}
        }
        write(records);return json(200,{version:1,records});
      }
      if(req.method!=='GET') return json(405,{error:'操作できません。'});
      const assets={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css']};
      const asset=assets[url.pathname];if(!asset) return json(404,{error:'見つかりません。'});
      res.writeHead(200,{'Content-Type':asset[1]+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"});
      res.end(fs.readFileSync(path.join(ROOT,asset[0])));
    }catch(error){console.error(error.message);json(400,{error:'保存・読み込みに失敗しました。入力は残っています。'+error.message});}
  });
  return server;
}
if(require.main===module){const server=createServer();server.on('error',e=>{console.error('起動できません: '+e.message);process.exitCode=1;});server.listen(4318,'127.0.0.1',()=>console.log('対戦ノート: http://127.0.0.1:4318'));}
module.exports={createServer,validate};
