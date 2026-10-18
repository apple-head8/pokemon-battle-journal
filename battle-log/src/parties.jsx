import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { natures, natureEffect, natureLabel, statNames, clampSP } from './natures.mjs';

const stats = [['hp','H'],['atk','A'],['def','B'],['spa','C'],['spd','D'],['spe','S']];
const normalizeMember = (m = {}) => ({ name: m.name || '', item: m.item || '', ability: m.ability || '', nature: m.nature || '', sp: Object.fromEntries(stats.map(([s]) => [s,m.sp?.[s] ?? 0])), moves: m.moves || ['','','',''], details: m.details || '' });
const normalizeParty = p => ({ id: p?.id || crypto.randomUUID(), name: p?.name || '', archived: p?.archived || false, members: Array.from({length:6},(_,i) => normalizeMember(p?.members[i])) });
async function api(route, body) { return window.journalAPI(route,body); }

function MemberCard({ member, index, onChange, onMove }) {
  const effect=natureEffect(member.nature);
  const total = Object.values(member.sp).reduce((sum,value) => sum + Number(value || 0),0);
  return <section className="build-card" aria-label={`${index+1}匹目の設定`}>
    <div className="build-top"><span className="build-number">POKÉMON {String(index+1).padStart(2,'0')}</span><div className="member-arrows">
      <button type="button" disabled={index===0} onClick={()=>onMove(-1)} aria-label={`${index+1}匹目を上へ`}>↑</button>
      <button type="button" disabled={index===5} onClick={()=>onMove(1)} aria-label={`${index+1}匹目を下へ`}>↓</button>
    </div></div>
    <label>ポケモン名<input aria-label={`${index+1}匹目のポケモン名`} required maxLength={100} value={member.name} onChange={e=>onChange({...member,name:e.target.value})} /></label>
    <label>特性<input aria-label={`${index+1}匹目の特性`} maxLength={100} placeholder="未設定" value={member.ability} onChange={e=>onChange({...member,ability:e.target.value})}/></label>
    <div className="row"><label>持ち物<input aria-label={`${index+1}匹目の持ち物`} maxLength={100} placeholder="未設定" value={member.item} onChange={e=>onChange({...member,item:e.target.value})}/></label>
      <label>性格<select aria-label={`${index+1}匹目の性格`} value={member.nature} onChange={e=>onChange({...member,nature:e.target.value})}><option value="">未設定</option>{member.nature&&!natures.includes(member.nature)&&<option>{member.nature}</option>}{natures.map(n=><option key={n} value={n}>{natureLabel(n)}</option>)}</select></label></div>
    <div className="nature-effect" aria-live="polite">{effect.up ? <><span className="nature-up">↑ {statNames[effect.up]} ×1.1</span><span className="nature-down">↓ {statNames[effect.down]} ×0.9</span></> : <span>{member.nature?'性格による能力補正なし':'性格を選ぶと能力補正を表示します'}</span>}</div>
    <div className="sp-heading"><span>能力ポイント（各0〜32）</span><output className={'sp-total'+(total>66?' invalid':'')} aria-label={`${index+1}匹目のSP合計`}>{total} / 66</output></div>
    <div className="sp-grid">{stats.map(([key,label])=><label key={key} className={effect.up===key?'nature-up':effect.down===key?'nature-down':''} title={statNames[key]}>{label}{effect.up===key?' ↑':effect.down===key?' ↓':''}<input type="number" aria-label={`${index+1}匹目の${label}`} min="0" max="32" step="1" required value={member.sp[key]} onChange={e=>onChange({...member,sp:{...member.sp,[key]:clampSP(e.target.value)}})}/></label>)}</div>
    <div className="moves-grid">{member.moves.map((move,i)=><label key={i}>技 {i+1}<input aria-label={`${index+1}匹目の技${i+1}`} maxLength={100} placeholder="未設定" value={move} onChange={e=>onChange({...member,moves:member.moves.map((m,j)=>j===i?e.target.value:m)})}/></label>)}</div>
    {member.details&&<details className="legacy-note"><summary>以前の型メモ（保持しています）</summary><p>{member.details}</p><p>上の項目に分けて入力できます。旧メモは自動変換せず残しています。</p></details>}
  </section>;
}

function PartyManager() {
  const [parties,setParties]=useState([]);
  const [draft,setDraft]=useState(null);
  const [baseline,setBaseline]=useState('');
  const [filter,setFilter]=useState('active');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [confirmArchive,setConfirmArchive]=useState(false);
  const dirty = draft && JSON.stringify(draft)!==baseline;
  const saved = parties.find(p=>p.id===draft?.id);
  const selectParty = party => {const next=normalizeParty(party);setDraft(next);setBaseline(JSON.stringify(next));setConfirmArchive(false);};
  async function load(){
    setLoading(true);
    try{const data=await api('records');setParties(data.parties);const id=new URLSearchParams(location.search).get('party');const selected=data.parties.find(p=>p.id===id)||data.parties.find(p=>!p.archived)||data.parties[0];selectParty(selected);if(selected?.archived)setFilter('archived');setMessage('');}
    catch(e){setMessage('読み込みに失敗しました。'+e.message);}finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);
  useEffect(()=>{const protect=e=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[dirty]);
  useEffect(()=>{window.journalHasUnsavedDraft=()=>Boolean(dirty);return()=>{delete window.journalHasUnsavedDraft;};},[dirty]);
  const discardOK=()=>!dirty||window.confirm('未保存の変更を破棄して切り替えますか？');
  const changeMember=(index,member)=>{setDraft({...draft,members:draft.members.map((m,i)=>i===index?member:m)});setMessage('');};
  const move=(index,delta)=>{const members=[...draft.members];[members[index],members[index+delta]]=[members[index+delta],members[index]];setDraft({...draft,members});};
  async function save(event){
    event.preventDefault();if(busy)return;
    if(draft.members.some(m=>Object.values(m.sp).reduce((a,b)=>a+Number(b),0)>66)){setMessage('SPの合計は、各ポケモン66以下にしてください。');return;}
    setBusy(true);
    try{const result=await api('parties',draft);setParties(result.parties);selectParty(result.parties.find(p=>p.id===draft.id));setFilter(draft.archived?'archived':'active');setMessage(window.journalSaveMessage ? window.journalSaveMessage() : 'パーティーを保存しました。対戦記録の選択肢にも反映されます。');}
    catch(e){setMessage(e.message);}finally{setBusy(false);}
  }
  async function archive(){
    if(!saved||busy)return;
    const archived=!saved.archived;
    setBusy(true);
    try{const result=await api('party-status',{id:saved.id,archived});setParties(result.parties);selectParty(result.parties.find(p=>p.id===saved.id));setFilter(archived?'archived':'active');setMessage(archived?'没にした構築へ移動しました。過去の対戦履歴は保持しています。':'使用中に戻しました。');}
    catch(e){setMessage(e.message);}finally{setBusy(false);}
  }
  const visible=parties.filter(p=>filter==='all'||(filter==='archived'?p.archived:!p.archived));
  if(loading)return <section className="panel">パーティーを読み込んでいます…</section>;
  if(!draft)return <section className="panel"><p role="alert">{message}</p><button onClick={load}>再読み込み</button></section>;
  return <>
    <div className="management-layout"><aside className="panel party-library"><div className="section-head"><h2>パーティー</h2><button disabled={busy} onClick={()=>{if(discardOK()){selectParty(null);setMessage('');}}}>＋ 新規</button></div>
      <label>表示するパーティー<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="active">使用中 ({parties.filter(p=>!p.archived).length})</option><option value="archived">没にした構築 ({parties.filter(p=>p.archived).length})</option><option value="all">すべて ({parties.length})</option></select></label>
      {visible.map(p=><button key={p.id} disabled={busy} className={'party-list-button'+(p.id===draft.id?' selected':'')} onClick={()=>{if(p.id!==draft.id&&discardOK()){selectParty(p);setMessage('');}}}><strong>{p.name}</strong><small>{p.archived?'没にした構築':'使用中'} · {p.members.map(m=>m.name).join(' / ')}</small></button>)}
      {!visible.length&&<p className="library-empty">この分類のパーティーはありません。</p>}<p className="muted">没にしても対戦履歴は残ります。</p></aside>
      <section className="party-workspace"><form onSubmit={save}><fieldset disabled={busy} className="editor-fieldset"><div className="panel editor-heading"><div className="section-head"><h2>{saved?'パーティーを編集':'新しいパーティー'}</h2><span className={'badge'+(draft.archived?' archived':'')}>{draft.archived?'没にした構築':'使用中'}</span></div>
        <label>パーティー名<input required maxLength={150} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="例：V3｜マスカーニャ入り"/></label>
        <div className="editor-actions"><button type="button" onClick={()=>{setDraft({...structuredClone(draft),id:crypto.randomUUID(),name:draft.name+'（コピー）',archived:false});setBaseline('');setConfirmArchive(false);setMessage('複製した内容です。名前を変更して保存してください。');}}>複製して変更</button><button type="button" className="delete" disabled={!saved} onClick={()=>setConfirmArchive(true)}>{draft.archived?'復帰させる':'没にする'}</button></div>
        {confirmArchive&&<div className="editor-message" role="group" aria-label="パーティー状態変更の確認"><p>{draft.archived?'このパーティーを使用中に戻します。':'このパーティーを没にします。対戦履歴は残り、あとから復帰できます。'}{dirty?' 未保存の変更は破棄されます。':''}</p><div className="editor-actions"><button type="button" onClick={archive}>{draft.archived?'使用中に戻す':'この構築を没にする'}</button><button type="button" onClick={()=>setConfirmArchive(false)}>キャンセル</button></div></div>}
        <p className="muted">↑↓で選択肢の順番を変更。型を比較するときは複製して別名で保存。</p></div>
        {message&&<div className="editor-message" role="status">{message}</div>}
        <div className="member-grid">{draft.members.map((m,i)=><MemberCard key={i} member={m} index={i} onChange={member=>changeMember(i,member)} onMove={delta=>move(i,delta)}/>)}</div>
        <div className="save-bar"><span>{busy?'保存しています…':dirty?'未保存の変更があります':'保存済みの内容です'}</span><button className="primary" type="submit" disabled={busy}>{busy?'保存中…':'パーティーを保存 ↗'}</button></div></fieldset></form></section>
    </div>
  </>;
}
createRoot(document.getElementById('partyApp')).render(<PartyManager/>);
