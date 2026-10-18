// Pure state transitions, shared by the browser store and regression tests.
(function(root){
const {validate,validateParty}=typeof module!=='undefined'&&module.exports?require('./validation.js'):root.JournalValidation;
function checkFile(input){
  if(!input||input.version!==1||!Array.isArray(input.records)||input.records.length>10000||!Array.isArray(input.parties??[])||(input.parties??[]).length>1000)throw new Error('ロトムログのバックアップJSONを選んでください。');
  const records=input.records.map(validate),parties=(input.parties??[]).map(validateParty);
  for(const list of [records,parties])if(new Set(list.map(x=>x.id)).size!==list.length)throw new Error('ファイル内のIDが重複しています。');
  if(new Set(parties.map(p=>p.name)).size!==parties.length)throw new Error('ファイル内の構築名が重複しています。');
  return {version:1,records,parties};
}
function change(current,route,input){
  const next=structuredClone(current);const {records,parties}=next;
  if(route==='parties'){
    const party=validateParty(input);
    if(parties.some(p=>p.id!==party.id&&p.name===party.name))throw new Error('同じ構築名があります。別の名前で保存してください。');
    const i=parties.findIndex(p=>p.id===party.id);if(i<0)parties.push(party);else parties[i]=party;
  }else if(route==='party-status'){
    const party=parties.find(p=>p.id===input?.id);
    if(!party||typeof input.archived!=='boolean')throw new Error('パーティーの状態を確認してください。');
    party.archived=input.archived;
  }else if(route==='records'){
    const record=validate(input),i=records.findIndex(r=>r.id===record.id);
    const party=parties.find(p=>record.partySnapshot?p.id===record.partySnapshot.id:p.name===record.team);
    if(i<0&&party?.archived)throw new Error('没にしたパーティーを復帰させてください。');
    for(const key of ['own','enemy']){const names=record[key].filter(Boolean);if(new Set(names).size!==names.length)throw new Error('選出が重複しています。');}
    if(i<0)records.push(record);else{record.createdAt=records[i].createdAt;records[i]=record;}
  }else if(route==='delete'){
    const i=records.findIndex(r=>r.id===input?.id);if(i<0)throw new Error('記録が見つかりません。');records.splice(i,1);
  }else if(route==='import'){
    const incoming=checkFile(input);
    const partyIds=new Set(parties.map(p=>p.id)),recordIds=new Set(records.map(r=>r.id));
    for(const p of incoming.parties){if(partyIds.has(p.id))continue;if(parties.some(x=>x.name===p.name))throw new Error('別IDの同名パーティーがあります。構築名を確認してください。');parties.push(p);partyIds.add(p.id);}
    for(const r of incoming.records)if(!recordIds.has(r.id)){records.push(r);recordIds.add(r.id);}
  }else throw new Error('対応していない操作です。');
  if(records.length>10000||parties.length>1000)throw new Error('記録件数の上限を超えています。別のバックアップに分けてください。');
  if(new TextEncoder().encode(JSON.stringify(next)).length>5_000_000)throw new Error('保存データの上限5MBを超えています。');
  return next;
}
const api={checkFile,change};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JournalCore=api;
})(globalThis);
