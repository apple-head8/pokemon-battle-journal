(function(){
document.addEventListener('DOMContentLoaded',()=>{
  const modal=document.createElement('dialog');modal.className='journal-init';modal.setAttribute('aria-labelledby','initTitle');
  const label=document.createElement('p');label.className='init-eyebrow';label.textContent='ROTOM LOG / SETUP';
  const title=document.createElement('h1');title.id='initTitle';title.textContent='記録を、ここから。';
  const intro=document.createElement('p');intro.textContent='保存先を一度設定すると、次回から同じ記録を読み込みます。パーティーと対戦履歴は、1つのJSONにまとめて保存します。';
  const summary=document.createElement('p');summary.className='init-summary';
  const status=document.createElement('p');status.setAttribute('role','status');
  const actions=document.createElement('div');actions.className='init-actions';
  const note=document.createElement('p');note.className='init-note';note.textContent='記録はサーバーに送信しません。保存先の許可を、ブラウザが再度求める場合があります。';
  let busy=false,state,settingsMode=false;
  const buttons=[];
  function add(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=async()=>{if(busy)return;busy=true;buttons.forEach(x=>x.disabled=true);status.textContent='';try{await fn();}catch(e){if(e.name!=='AbortError')status.textContent=e.message;}finally{busy=false;buttons.forEach(x=>x.disabled=false);}};buttons.push(b);actions.append(b);return b;}
  const resume=add('この記録で始める',async()=>{state=await window.journalSetup.resume();modal.close();});resume.className='primary';
  const create=add('新しく始める',async()=>{await window.journalSetup.connect(false);await refresh();if(state?.mode==='file'&&!state.pending&&state.permission==='granted'&&!state.conflict&&!state.error)modal.close();});
  const open=add('記録ファイルから再開',async()=>{await window.journalSetup.connect(true);});
  const browser=add('ブラウザ保存で始める',async()=>{await window.journalSetup.browser();modal.close();});
  const recovery=add('復旧用JSONをダウンロード',()=>window.journalSetup.export());
  const advanced=document.createElement('details');const advancedTitle=document.createElement('summary');advancedTitle.textContent='詳細操作';advanced.append(advancedTitle,recovery);actions.append(advanced);
  const close=add('設定を閉じる',async()=>modal.close());
  async function refresh(){
    state=await window.journalSetup.state();
    const file=state.mode==='file';title.textContent=settingsMode?'保存設定':file?'おかえりなさい。':'記録を、ここから。';
    label.textContent=settingsMode?'ROTOM LOG / SETTINGS':'ROTOM LOG / SETUP';
    actions.hidden=settingsMode;intro.hidden=settingsMode;note.hidden=settingsMode;summary.hidden=settingsMode;
    summary.textContent=file?state.name+' · 対戦 '+state.records+'件 / パーティー '+state.parties+'件':'このブラウザの記録：対戦 '+state.records+'件 / パーティー '+state.parties+'件';
    resume.hidden=!file;create.hidden=open.hidden=!state.supported;
    browser.textContent=file?'退避内容を確認する':'ブラウザ保存で始める';
    note.textContent=!state.supported?'このブラウザではファイルへの直接保存ができません。ブラウザ保存とJSONダウンロードを利用するか、PCのChrome・Edgeをお使いください。':file?'保存先の設定を読み込みました。許可が必要な場合は「この記録で始める」を押してください。':'既存の記録も新しい保存先へ引き継ぎます。ブラウザ保存を選ぶ場合は、定期的にJSONをダウンロードしてください。';
    if(state.error)status.textContent='保存先を確認できません：'+state.error;
    else if(state.conflict)status.textContent='ファイルと退避内容が異なります。記録ファイルを開き直すか、退避内容を確認してください。自動で上書きしません。';
    else if(state.pending)status.textContent='ファイルに未保存の変更があります。「この記録で始める」で許可を確認し、再保存します。';
  }
  const panel=document.getElementById('storageSettingsPanel');
  const done=document.createElement('button');done.type='button';done.className='init-done';done.textContent='閉じる';done.hidden=true;done.onclick=()=>modal.close();
  modal.append(label,title,intro,summary,status,actions,note);if(panel)modal.append(panel);modal.append(done);document.body.append(modal);
  const settings=document.createElement('button');settings.type='button';settings.textContent='保存設定';settings.setAttribute('aria-haspopup','dialog');settings.onclick=()=>window.journalShowSetup();document.querySelector('header .tools').append(settings);
  modal.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  window.journalShowSetup=async()=>{settingsMode=true;status.textContent='';if(panel)panel.hidden=false;done.hidden=false;if(!modal.open)modal.showModal();try{await refresh();}catch(e){status.textContent=e.message;}};
  // Verify saved configuration on every entry, including direct party/history links.
  refresh().then(()=>{if(state.mode==='unset'||state.mode==='file'&&(state.permission!=='granted'||state.pending||state.conflict||state.error)){close.hidden=state.mode==='unset';modal.showModal();}}).catch(e=>{status.textContent=e.message;modal.showModal();});
});
})();
