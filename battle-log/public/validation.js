// Shared validation: only explicitly allowed fields are retained.
(function(root){
const crypto=root.crypto||(typeof require==='function'?require('node:crypto'):null);
const fields = {team:150,date:10,leadWork:500,notes:20000,review:30002};
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
  if(input.turns!==undefined){
    if(!Array.isArray(input.turns)||input.turns.length>100||input.turns.some(v=>typeof v!=='string'||v.length>2000)||input.turns.join('').length>20000)throw new Error('ターンメモは100ターン以内、各2000文字・合計20000文字以内で入力してください。');
    out.turns=input.turns.map(v=>v.trim());
  }
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

const api={validate,validateParty};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JournalValidation=api;
})(globalThis);
