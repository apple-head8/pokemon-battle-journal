const rows = [
  ['がんばりや','atk','atk'],['さみしがり','atk','def'],['ゆうかん','atk','spe'],['いじっぱり','atk','spa'],['やんちゃ','atk','spd'],
  ['ずぶとい','def','atk'],['すなお','def','def'],['のんき','def','spe'],['わんぱく','def','spa'],['のうてんき','def','spd'],
  ['おくびょう','spe','atk'],['せっかち','spe','def'],['まじめ','spe','spe'],['ようき','spe','spa'],['むじゃき','spe','spd'],
  ['ひかえめ','spa','atk'],['おっとり','spa','def'],['れいせい','spa','spe'],['てれや','spa','spa'],['うっかりや','spa','spd'],
  ['おだやか','spd','atk'],['おとなしい','spd','def'],['なまいき','spd','spe'],['しんちょう','spd','spa'],['きまぐれ','spd','spd']
];
export const statNames = {hp:'HP',atk:'攻撃',def:'防御',spa:'特攻',spd:'特防',spe:'素早さ'};
export const natures = rows.map(([name])=>name);
export function natureEffect(name) {
  const row = rows.find(row=>row[0]===name);
  return !row || row[1]===row[2] ? {up:null,down:null} : {up:row[1],down:row[2]};
}
export function natureLabel(name) {
  const {up,down}=natureEffect(name);
  return up ? `${name}（${statNames[up]}↑ ${statNames[down]}↓）` : `${name}（補正なし）`;
}
export function clampSP(value) {
  if(value==='') return '';
  const number=Number(value);
  return Number.isFinite(number) ? Math.min(32,Math.max(0,Math.trunc(number))) : 0;
}
