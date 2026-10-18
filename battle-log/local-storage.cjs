const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {checkFile,change}=require('./public/journal-core');
const blank=()=>({version:1,records:[],parties:[]});
function parse(text){if(Buffer.byteLength(text)>5_000_000)throw Error('JSONは5MBまでです。');return checkFile(JSON.parse(text));}
function createStore(directory){
  fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'battles.json'),backups=path.join(directory,'backups');fs.mkdirSync(backups,{recursive:true});
  const raw=()=>fs.existsSync(file)?fs.readFileSync(file,'utf8'):null;
  const hash=text=>crypto.createHash('sha256').update(text??'').digest('hex');
  function read(){const text=raw();return {data:text===null?blank():parse(text),revision:hash(text)};}
  function save(data,expected,{recover=false}={}){
    const old=raw();if(hash(old)!==expected)throw Error('別の操作で記録が変更されました。再読み込みしてください。');
    const checked=checkFile(data),text=JSON.stringify(checked,null,2);if(Buffer.byteLength(text)>5_000_000)throw Error('保存上限5MBを超えています。');
    if(old!==null){if(!recover)parse(old);fs.writeFileSync(path.join(backups,`${Date.now()}-${crypto.randomUUID()}.json`),old,{flag:'wx'});fs.writeFileSync(file+'.bak',old);}
    const tmp=file+'.'+crypto.randomUUID()+'.tmp';let fd;
    try{fd=fs.openSync(tmp,'wx');fs.writeFileSync(fd,text,'utf8');fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(tmp,file);}
    finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
    // Pruning failure must not report a successfully committed journal as unsaved.
    try{const names=fs.readdirSync(backups).filter(n=>/^\d+-[a-f0-9-]+\.json$/.test(n)).sort().reverse();for(const n of names.slice(30))fs.unlinkSync(path.join(backups,n));}catch{}
    return read();
  }
  return {file,backups,read,save,change(route,input,revision){const current=read();if(current.revision!==revision)throw Error('記録が更新されています。再読み込みしてください。');return save(change(current.data,route,input),revision);},restore(data){return save(data,hash(raw()),{recover:true});}};
}
module.exports={createStore,parse};
