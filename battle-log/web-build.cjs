const fs=require('node:fs');const path=require('node:path');
const root=__dirname,out=path.join(root,'web-dist');
const base=process.env.WEB_BASE_PATH||'/';
if(!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base))throw new Error('WEB_BASE_PATHは / または /repository/ の形式にしてください。');
const csp="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
fs.mkdirSync(out,{recursive:true});
// Only retain the freshly generated Vite bundle; never ship old diagnostic files.
for(const entry of fs.readdirSync(out)){
  if(entry==='build')continue;
  const target=path.resolve(out,entry);
  if(!target.startsWith(path.resolve(out)+path.sep))throw Error('Invalid output path');
  fs.rmSync(target,{recursive:true,force:true});
}
const files=['shared.js','validation.js','journal-core.js','file-journal.js','web-storage.js','web-init.js','web-init.css','app.js','history.js','style.css','theme.css','management.css'];
for(const name of files){
  let text=fs.readFileSync(path.join(root,'public',name),'utf8');
  if(name==='shared.js')text=text.split('\n').filter(line=>!line.startsWith('window.journalAPI=')).join('\n');
  if(name==='style.css')text=text.replace(/^@import[^\n]+\n/,'');
  if(name==='app.js'){
    text=text.replace("'● このPCにファイル保存'","window.journalStorageLabel()").replace("notice('対戦をファイルに保存しました。')","notice(window.journalSaveMessage())");
    text=text.replace("$('records').append(el('p','起動スクリプトを開いてから、このページを再読み込みしてください。'));",'');
    // Storage failures must not silently promise draft recovery.
    text=text.replace("localStorage.setItem('battle-note-draft',JSON.stringify(getForm()));}catch{}", "localStorage.setItem('battle-note-draft',JSON.stringify(getForm()));}catch{notice('下書きを保存できません。入力を控えてからブラウザの保存設定を確認してください。');}");
    text+='\nwindow.addEventListener("beforeunload",event=>{if(isDirty()){event.preventDefault();event.returnValue="";}});\n';
  }
  if(name==='history.js')text=text.replace("edit.href='/?edit='",`edit.href='${base}?edit='`);
  // Separate accidental storage-key collisions, not a same-origin security boundary.
  if(base!=='/')text=text.replaceAll('battle-note-draft',`rotom:${base}:draft`).replaceAll('battle-color-theme',`rotom:${base}:theme`).replace("indexedDB.open('rotom-log',1)",`indexedDB.open('rotom:${base}:journal',1)`);
  fs.writeFileSync(path.join(out,name),text);
}
for(const [source,dest] of [['index.html','index.html'],['parties.html','parties/index.html'],['history.html','history/index.html']]){
  let text=fs.readFileSync(path.join(root,'public',source),'utf8');
  text=text.replace('<meta charset="utf-8">',`<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer">`);
  text=text.replace('<script src="shared.js"></script>','<script src="shared.js"></script><script src="validation.js"></script><script src="journal-core.js"></script><script src="file-journal.js"></script><script src="web-storage.js"></script><script src="web-init.js"></script><link rel="stylesheet" href="web-init.css">');
  text=text.replace(/(src|href)="((?!\/|https?:|data:|#)[^"]+\.(?:js|css))"/g,'$1="/$2"');
  text=text.replace(/(src|href)="\/(?!\/)([^"]*)"/g,(_,attr,value)=>`${attr}="${base}${['parties','history'].includes(value)?value+'/':value}"`);
  text=text.replace('</footer>',' · 非公式のファン制作アプリ。記録は端末内に保存されます。</footer>');
  const target=path.join(out,dest);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);
}
fs.appendFileSync(path.join(out,'management.css'),'\n.web-storage-note{display:flex;align-items:center;justify-content:space-between;gap:18px;border:1px solid var(--rl-border);border-left:3px solid var(--brand-bright);border-radius:12px;padding:16px 20px;margin-bottom:20px;background:var(--rl-panel)}.web-storage-note strong{font-size:12px}.web-storage-note p{font-size:11px;line-height:1.8;margin:6px 0 0}.web-storage-note button{white-space:nowrap}@media(max-width:600px){.web-storage-note{align-items:flex-start;flex-direction:column}}\n');
fs.appendFileSync(path.join(out,'management.css'),'\n.web-storage-note details{margin-top:10px;font-size:11px;color:var(--rl-muted)}.web-storage-note summary{cursor:pointer}.web-storage-note #webBackupStatus{color:var(--rl-accent)}.web-download-link{display:block;margin-top:8px;font-size:11px}.web-download-link[hidden]{display:none}\n');
fs.writeFileSync(path.join(out,'_headers'),`/*\n  Content-Security-Policy: ${csp}; frame-ancestors 'none'\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()\n  Strict-Transport-Security: max-age=31536000\n  Cache-Control: no-cache\n`);
fs.writeFileSync(path.join(out,'404.html'),`<!doctype html><html lang="ja"><meta charset="utf-8"><title>ページが見つかりません</title><p>ページが見つかりません。<a href="${base}">ロトムログへ戻る</a></p></html>`);
fs.writeFileSync(path.join(out,'.nojekyll'),'');
fs.writeFileSync(path.join(out,'build-info.json'),JSON.stringify({base}));
fs.appendFileSync(path.join(out,'management.css'),'\n.file-actions{display:flex;flex-wrap:wrap;gap:8px;max-width:420px}.file-actions button{font-size:12px}.file-actions [hidden]{display:none}\n');
console.log('Web版を web-dist に生成しました。公開対象はこのフォルダのみです。');
