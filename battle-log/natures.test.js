const {test}=require('node:test');
const assert=require('node:assert/strict');
test('性格25種の補正と無補正5種を区別する',async()=>{
  const {natures,natureEffect,natureLabel}=await import('./src/natures.mjs');
  assert.equal(new Set(natures).size,25);
  assert.equal(natures.filter(n=>!natureEffect(n).up).length,5);
  assert.deepEqual(natureEffect('いじっぱり'),{up:'atk',down:'spa'});
  assert.deepEqual(natureEffect('おくびょう'),{up:'spe',down:'atk'});
  assert.deepEqual(natureEffect('むじゃき'),{up:'spe',down:'spd'});
  assert.deepEqual(natureEffect('しんちょう'),{up:'spd',down:'spa'});
  assert.deepEqual(natureEffect(''),{up:null,down:null});
  assert.equal(natureLabel('ひかえめ'),'ひかえめ（特攻↑ 攻撃↓）');
});
test('SPは空欄編集を許容しつつ整数0〜32に制限する',async()=>{
  const {clampSP}=await import('./src/natures.mjs');
  for(const [value,expected] of [['', ''],['33',32],['320',32],['-1',0],['11',11],['2.9',2],['invalid',0]])assert.equal(clampSP(value),expected);
});
