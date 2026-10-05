// Shared appearance and display helpers for the journal and party editor.
function applyColorTheme(theme){
  document.documentElement.dataset.theme=theme;
  const button=document.getElementById('themeToggle');
  if(button){button.textContent=theme==='dark'?'☀ ライト':'☾ ダーク';button.setAttribute('aria-label',theme==='dark'?'ライトモードに切り替え':'ダークモードに切り替え');button.setAttribute('aria-pressed',String(theme==='dark'));}
}
let savedColorTheme;try{savedColorTheme=localStorage.getItem('battle-color-theme');}catch{}
applyColorTheme(savedColorTheme|| (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
document.addEventListener('DOMContentLoaded',()=>{
  applyColorTheme(document.documentElement.dataset.theme);
  document.getElementById('themeToggle')?.addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';applyColorTheme(theme);try{localStorage.setItem('battle-color-theme',theme);}catch{}});
});
window.addEventListener('storage',event=>{if(event.key==='battle-color-theme')applyColorTheme(event.newValue||'light');});
function formatPartyMember(member){
  const stats=['hp','atk','def','spa','spd','spe'];const labels=['H','A','B','C','D','S'];
  const distribution=stats.map((s,i)=>member.sp?.[s]?labels[i]+member.sp[s]:'').filter(Boolean).join(' ');
  return [member.name,member.item?'＠'+member.item:'',member.nature,distribution,member.moves?.filter(Boolean).join(' / '),member.details?'旧メモ：'+member.details:''].filter(Boolean).join(' · ');
}
