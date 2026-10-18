function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
const $=id=>document.getElementById(id);
let records=[],parties=[],pending=false,ready=false;
const labels={win:'勝ち',loss:'負け',draw:'引き分け',rocks:{yes:'ステロあり',prevented:'ステロ阻止',none:'ステロなし'},setup:{yes:'積む機会あり',no:'積む機会なし',unused:'積まずに展開'}};
function notice(message){$('notice').textContent=message;$('notice').classList.add('show');clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('notice').classList.remove('show'),6000);}
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function battleNotes(record){return [...(record.turns||[]).map((text,i)=>text.trim()?`${i+1}T\n${text}`:'').filter(Boolean)].filter(Boolean).join('\n\n');}
function reviewText(record){return [record.notes,record.review].filter(Boolean).join('\n\n');}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function api(path,body){return window.journalAPI(path,body);}
function filtered(){return records.filter(r=>(!$('filterTeam').value||r.team===$('filterTeam').value)&&(!$('filterResult').value||r.result===$('filterResult').value)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));}
function render(){
  const selected=$('filterTeam').value;const teams=[...new Set([...records.map(r=>r.team)].filter(Boolean))];
  $('filterTeam').replaceChildren(new Option('すべての構築',''));for(const team of teams){$('filterTeam').add(new Option(team,team));}$('filterTeam').value=teams.includes(selected)?selected:'';
  const list=filtered();const wins=list.filter(r=>r.result==='win').length;const losses=list.filter(r=>r.result==='loss').length;
  $('count').replaceChildren(document.createTextNode(list.length),el('em','戦'));$('rate').textContent=list.length?Math.round(wins/list.length*100)+'%':'—';$('wl').textContent=`${wins} / ${losses}`;
  const observed=list.filter(r=>['yes','no'].includes(r.setup));$('setupStat').textContent=observed.length?`${observed.filter(r=>r.setup==='yes').length} / ${observed.length}`:'—';
  $('records').replaceChildren();if(!list.length){const box=el('div',undefined,'empty');box.append(el('div','＋'),el('strong',records.length?'条件に合う対戦がありません':'最初の一戦から、記録を。'),el('p',records.length?'絞り込みを変更してください。':'分かった範囲だけで大丈夫。\n保存した対戦がここに並びます。'));$('records').append(box);}
  for(const r of list){const card=el('article',undefined,'record');const top=el('div',undefined,'record-top');top.append(el('span',labels[r.result],'badge '+r.result),el('time',r.date));card.append(top,el('h3',r.team));const match=el('div',undefined,'matchup');match.append(document.createTextNode(r.own[0]||'先発未記録'),el('em','vs'),document.createTextNode(r.enemy[0]||'先発未記録'));card.append(match);
    const chips=el('div',undefined,'chips');if(labels.rocks[r.rocks])chips.append(el('span',labels.rocks[r.rocks]));if(labels.setup[r.setup])chips.append(el('span',labels.setup[r.setup]));card.append(chips);if(r.leadWork)card.append(el('p',r.leadWork));
    const details=el('details');details.append(el('summary','選出・対戦メモを開く'));const dl=el('dl');for(const [name,value]of [['相手パーティ',r.opponents.filter(Boolean).join(' / ')],['こちらの選出',r.own.filter(Boolean).join(' → ')],['相手の選出',r.enemy.filter(Boolean).join(' → ')],['対戦メモ（事実）',battleNotes(r)],['振り返り',reviewText(r)]]){dl.append(el('dt',name),el('dd',value||'未記録'));}details.append(dl);card.append(details);
    if(r.partySnapshot){dl.append(el('dt','記録時のパーティー'),el('dd',r.partySnapshot.members.map(formatPartyMember).join('\n')));}
    const actions=el('div',undefined,'record-actions');const edit=el('a','編集','button');edit.href='/?edit='+encodeURIComponent(r.id);const del=el('button','削除','delete');del.onclick=async()=>{if(pending||!confirm(`${r.date} の対戦を削除しますか？`))return;pending=true;try{records=(await api('delete',{id:r.id})).records;render();notice('対戦を削除しました。');}catch(e){notice(e.message);}finally{pending=false;}};actions.append(edit,del);card.append(actions);$('records').append(card);
  }
}

$('csv').onclick=()=>{if(!ready)return;const rows=[['日付','構築','勝敗','相手6匹','自分の選出','相手の選出','ステロ','積む機会','初手の仕事','対戦メモ','振り返り'],...filtered().map(r=>[r.date,r.team,labels[r.result],r.opponents.join(' / '),r.own.join(' / '),r.enemy.join(' / '),labels.rocks[r.rocks]||'不明',labels.setup[r.setup]||'不明',r.leadWork,battleNotes(r),reviewText(r)])];const cell=v=>'"'+(/^[\s]*[=+@-]/.test(v)?"'"+v:v).replaceAll('"','""')+'"';download('\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n'),`対戦集計-${today()}.csv`,'text/csv;charset=utf-8');};

for(const id of ['filterTeam','filterResult'])$(id).onchange=render;
(async()=>{try{const data=await api('records');records=data.records;parties=data.parties||[];ready=true;render();}catch(e){$('records').textContent='履歴を読み込めません。再読み込みしてください。';notice(e.message);}})();
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
