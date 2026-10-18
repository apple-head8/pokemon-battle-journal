// Records never leave the device. IndexedDB retains a recovery copy before file writes.
(function(){
const dbPromise=new Promise((resolve,reject)=>{
  const r=indexedDB.open('rotom-log',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('journal');
  r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};
  r.onerror=()=>reject(new Error('ブラウザ内の退避領域を開けません。保存設定を確認してください。'));
  r.onblocked=()=>reject(new Error('他のタブを閉じて再読み込みしてください。'));
});dbPromise.catch(()=>{});
const empty=()=>({revision:0,data:{version:1,records:[],parties:[]}});
let revision=null,latest=null,message='',downloadUrl,busy=false;
const supported=!!(window.showSaveFilePicker&&window.showOpenFilePicker&&window.navigator?.locks);
function locked(fn){return window.navigator?.locks?window.navigator.locks.request('rotom-journal-file',fn):fn();}
async function storage(fn,writing=false){
  const db=await dbPromise;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('journal',writing?'readwrite':'readonly'),s=tx.objectStore('journal');let value,error;
    const r=s.get('current');r.onsuccess=()=>{try{value=fn(r.result||empty(),s);}catch(e){error=e;tx.abort();}};
    tx.oncomplete=()=>resolve(value);tx.onabort=tx.onerror=()=>reject(error||new Error('ブラウザ内に退避できません。入力を控えて保存設定を確認してください。'));
  });
}
function updateStatus(){
  const status=document.getElementById('webBackupStatus');
  const f=latest?.file;
  const hint=document.getElementById('storageHelp');if(hint)hint.textContent=f?'普段の「保存」で、このファイルを更新します。AIへの添付にも同じファイルを使えます。':'ブラウザ内に保存しています。「詳細操作」からJSONを保存できます。';
  const fileName=document.getElementById('currentStorageFile');if(fileName)fileName.textContent=f?'現在の保存先：'+f.handle.name:'現在の保存先：このブラウザ';
  const badge=document.getElementById('storage');if(badge)badge.textContent=f?'● 保存先：JSONファイル':'● このブラウザに保存';
  if(status)status.textContent=message||(revision===null?'記録を確認しています…':f?f.synced===latest.revision?`${f.handle.name} に保存済み`:`${f.handle.name} に未保存です。入力内容はブラウザに退避しています。`:'保存先はこのブラウザです。ファイルへの直接保存は未設定です。');
  const alert=document.getElementById('storageAttention');if(alert)alert.hidden=!(f&&f.synced!==latest.revision||message&&!message.includes('完了しました'));
  const retry=document.getElementById('fileRetry');if(retry)retry.hidden=!f;
}
function accept(e){latest=e;updateStatus();}
async function flush(e){
  if(!e.file)return;
  if(await e.file.handle.queryPermission({mode:'readwrite'})!=='granted')throw new Error('記録ファイルへのアクセス許可が必要です。「許可して再保存」を押してください。');
  const baseline=await JournalFile.write(e.file.handle,e.file.baseline,e.data);
  e.file={...e.file,baseline,synced:e.revision};
  await storage((current,s)=>{if(current.revision!==e.revision)throw new Error('別のタブで更新されました。再読み込みしてください。');s.put(e,'current');},true);
  accept(e);
}
async function transact(route,input){return locked(async()=>{
  let e=await storage(x=>x);
  if(input===undefined){
    revision=e.revision;accept(e);
    if(e.file){try{
      if(await e.file.handle.queryPermission({mode:'readwrite'})!=='granted')message='保存先の確認にアクセス許可が必要です。「許可して再保存」を押してください。';
      else if(await JournalFile.read(e.file.handle)!==e.file.baseline)message='ファイルに外部変更があります。ブラウザの記録を表示しています。JSONを退避してから「既存ファイルを開く」で読み直してください。';
    }catch{message='記録ファイルを確認できません。ブラウザの退避内容を表示しています。';}updateStatus();}
    return structuredClone(e.data);
  }
  if(revision===null||revision!==e.revision)throw new Error('別のタブで記録が更新されています。入力内容を控え、再読み込みしてから保存してください。');
  if(e.file&&e.file.synced!==e.revision)throw new Error('前回の変更がファイルに未保存です。「許可して再保存」で保存を完了してから、画面を再読み込みしてください。');
  const data=JournalCore.change(e.data,route,input);
  e=await storage((current,s)=>{if(current.revision!==revision)throw new Error('別のタブで記録が更新されています。再読み込みしてください。');const next={...current,revision:current.revision+1,data};s.put(current,'previous');s.put(next,'current');return next;},true);
  revision=e.revision;message='';accept(e);
  try{await flush(e);}catch(err){message='ファイルに未保存です。変更はブラウザに退避しました。'+err.message;updateStatus();throw new Error(message);}
  return structuredClone(e.data);
});}
window.journalAPI=transact;
window.journalStorageLabel=()=>latest?.file?'● 保存先：JSONファイル':'● このブラウザに保存';
window.journalSaveMessage=()=>latest?.file?'記録ファイルに保存しました。':'このブラウザに保存しました。ファイル保存は未設定です。';
function download(data,name){
  if(downloadUrl)URL.revokeObjectURL(downloadUrl);
  downloadUrl=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.getElementById('webDownloadLink');a.href=downloadUrl;a.download=name;a.hidden=false;a.click();
}
async function exportFile(){const e=await storage(x=>x);download(e.data,'ロトムログ-'+new Date().toISOString().slice(0,10)+'.json');}
const types=[{description:'ロトムログの記録',accept:{'application/json':['.json']}}];
async function connect(existing){
  if(existing&&(window.journalHasUnsavedDraft?.()||window.isDirty?.()))throw new Error('入力中の未保存の変更があります。設定を閉じて保存するか、入力をクリアしてから記録ファイルを切り替えてください。');
  // Launch picker synchronously from the user's click, before awaiting storage.
  const handle=existing?(await window.showOpenFilePicker({types,multiple:false}))[0]:await window.showSaveFilePicker({types,suggestedName:'ロトムログ.json'});
  await locked(async()=>{
    const baseline=await JournalFile.read(handle),e=await storage(x=>x);
    if(revision!==e.revision)throw new Error('別のタブで更新されています。再読み込みしてください。');
    if(!existing&&baseline.length)throw new Error('空でないファイルは上書きしません。「既存ファイルを開く」を使ってください。');
    const data=existing?JournalCore.checkFile(JSON.parse(baseline)):e.data;
    if(existing&&e.file&&e.file.synced!==e.revision&&!window.confirm('現在の変更はファイルに未保存です。キャンセルして再保存するか、「復旧用JSONをダウンロード」で退避してください。未保存のまま別の記録に切り替えますか？'))return;
    if(existing&&!window.confirm(`このファイルの対戦${data.records.length}件・パーティー${data.parties.length}件を開きます。現在の対戦${e.data.records.length}件・パーティー${e.data.parties.length}件とは統合せず、表示する記録を切り替えます。続けますか？`))return;
    const next={revision:e.revision+1,data,file:{handle,baseline,synced:existing?e.revision+1:-1}};
    await storage((current,s)=>{if(current.revision!==e.revision)throw new Error('別のタブで更新されています。');s.put(current,'before-file-switch');s.put(next,'current');},true);
    revision=next.revision;accept(next);
    if(existing){revision=null;window.location.reload();}
    else {try{await flush(next);}catch(e){throw new Error('ファイルに未保存です。変更はブラウザに退避しています。'+e.message);}}
  });
}
async function retry(){
  const handle=latest?.file?.handle;if(!handle)return;
  // Request immediately in the click handler, before IndexedDB or locks.
  const permission=await handle.requestPermission({mode:'readwrite'});
  if(permission!=='granted')throw new Error(permission==='prompt'?'書き込み許可の確認が完了していません。ブラウザの確認画面を確認してください。':'書き込み許可を取得できませんでした。ブラウザのサイト設定を確認してください。');
  const e=await storage(x=>x);if(!e.file||!(handle.isSameEntry?await handle.isSameEntry(e.file.handle):handle===e.file.handle))throw new Error('保存先が変更されました。再読み込みしてください。');
  await locked(async()=>{const current=await storage(x=>x);if(current.revision!==e.revision)throw new Error('別のタブで更新されました。再読み込みしてください。');await flush(current);});
  message='ファイルへの保存が完了しました。入力内容を控え、画面を再読み込みして続けてください。';
}

async function setupState(){
  const e=await storage(x=>x);
  const state={mode:e.file?'file':e.setupMode||'unset',name:e.file?.handle.name||'',records:e.data.records.length,parties:e.data.parties.length,pending:!!e.file&&e.file.synced!==e.revision,supported};
  if(e.file){try{state.permission=await e.file.handle.queryPermission({mode:'readwrite'});if(state.permission==='granted')state.conflict=await JournalFile.read(e.file.handle)!==e.file.baseline;}catch(err){state.error=err.message;}}
  return state;
}
window.journalSetup={
  state:setupState,
  connect,
  async resume(){
    const handle=latest?.file?.handle;if(!handle)throw new Error('保存先を確認中です。少し待って再度お試しください。');
    const permission=await handle.requestPermission({mode:'readwrite'});
    if(permission!=='granted')throw new Error(permission==='prompt'?'許可の確認が完了していません。ブラウザの確認画面を確認するか、Chrome・Edgeでお試しください。':'書き込み許可が得られませんでした。ブラウザのサイト設定を確認してください。');
    await locked(async()=>{const e=await storage(x=>x);if(e.revision!==revision)throw new Error('別の画面で更新されています。再読み込みしてください。');if(!e.file||!(handle.isSameEntry?await handle.isSameEntry(e.file.handle):handle===e.file.handle))throw new Error('保存先が変更されました。再読み込みしてください。');if(e.file.synced!==e.revision)await flush(e);else if(await JournalFile.read(handle)!==e.file.baseline)throw new Error('ファイルに外部変更があります。「既存の記録を開く」から読み直すか、退避内容を確認してください。');});
    message='';updateStatus();return setupState();
  },
  async browser(){await locked(()=>storage((e,s)=>{if(e.file)return; s.put({...e,setupMode:'browser'},'current');},true));},
  export:exportFile
};
document.addEventListener('DOMContentLoaded',()=>{
  const section=document.createElement('section');section.id='storageSettingsPanel';section.hidden=true;section.className='web-storage-note';section.setAttribute('aria-label','記録の保存先');
  const text=document.createElement('div'),title=document.createElement('strong'),status=document.createElement('p'),hint=document.createElement('p');status.id='webBackupStatus';status.setAttribute('role','status');
  hint.id='storageHelp';title.id='currentStorageFile';title.textContent='記録の保存先';hint.textContent='普段の「保存」で、このファイルを更新します。AIへの添付にも同じファイルを使えます。';
  const actions=document.createElement('div');actions.className='file-actions';
  const advanced=document.createElement('details');advanced.className='storage-advanced';const advancedTitle=document.createElement('summary');advancedTitle.textContent='詳細操作';advanced.append(advancedTitle);
  const advancedActions=document.createElement('div');advancedActions.className='file-actions';advanced.append(advancedActions);
  function button(label,fn,id){const b=document.createElement('button');b.type='button';b.textContent=label;if(id)b.id=id;const run=async()=>{if(busy)return;busy=true;b.disabled=true;message='';try{await fn();}catch(e){if(e.name!=='AbortError')message=e.message;}finally{busy=false;b.disabled=false;updateStatus();}};b.addEventListener('click',run);actions.append(b);run.element=b;return run;}
  // Keep export first for compatibility with older test harnesses and header action.
  const save=button('復旧用JSONをダウンロード',exportFile);advancedActions.append(save.element);
const old=document.getElementById('export');if(old){old.hidden=true;old.onclick=save;}
  if(supported){const copy=button('今の記録を別ファイルに保存',()=>connect(false));advancedActions.prepend(copy.element);button('別の記録ファイルを開く',()=>connect(true));button('許可して再保存',retry,'fileRetry');}
  else hint.textContent+=' このブラウザは直接保存に未対応です。PCのChrome・Edgeをご利用いただくか、JSONをダウンロードしてください。';
  const link=document.createElement('a');link.id='webDownloadLink';link.hidden=true;link.textContent='ダウンロードされない場合はこちら';link.className='web-download-link';
  const details=document.createElement('details'),summary=document.createElement('summary'),explanation=document.createElement('p');summary.textContent='保存のしくみ';explanation.textContent='記録はサーバーやAIに送信しません。指定ファイルとブラウザの退避領域に保存します。再訪時に許可が必要な場合があります。ファイルが外部で変更された場合は上書きを止めます。別のファイルを開くと表示する記録が切り替わります。統合は対戦画面のJSON読み込みから行ってください。上書き保存は過去の版を残すバックアップではありません。入力途中のフォームはファイルに含まれません。';details.append(summary,explanation);
  const help=document.createElement('p');help.textContent='「別ファイルに保存」は今の記録を引き継ぎ、以後の保存先も切り替えます。「復旧用JSON」はブラウザにある記録のコピーをダウンロードします。保存先は変えません。';advanced.append(help,details);
  text.append(title,status,hint,link);section.append(text,actions,advanced);document.querySelector('main').prepend(section);
  const alert=document.createElement('button');alert.id='storageAttention';alert.type='button';alert.className='storage-attention';alert.hidden=true;alert.textContent='保存の確認が必要です · 保存設定を開く';alert.onclick=()=>window.journalShowSetup?.();document.querySelector('main').prepend(alert);updateStatus();
});
})();
