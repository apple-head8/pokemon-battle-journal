// Static-only local preview. No record API, uploads, or file writes.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'web-dist');
const headers={};for(const line of fs.readFileSync(path.join(root,'_headers'),'utf8').split('\n')){const m=line.match(/^  ([^:]+): (.+)$/);if(m&&m[1]!=='Strict-Transport-Security')headers[m[1]]=m[2];}
http.createServer((req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
  let route;try{route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
  if(route==='/'||route==='/parties'||route==='/parties/'||route==='/history'||route==='/history/')route=route.replace(/\/$/,'')+'/index.html';
  const file=path.resolve(root,'.'+route);
  if(!file.startsWith(root+path.sep)||!['.html','.css','.js'].includes(path.extname(file))||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404,headers);return res.end('Not found');}
  res.writeHead(200,{...headers,'Content-Type':({'.html':'text/html','.css':'text/css','.js':'text/javascript'})[path.extname(file)]+'; charset=utf-8'});res.end(req.method==='HEAD'?undefined:fs.readFileSync(file));
}).listen(4319,'127.0.0.1',()=>console.log('Web版プレビュー: http://127.0.0.1:4319/'));
