(function(root){
const limit=5_000_000;
async function read(handle){const file=await handle.getFile();if(file.size>limit)throw new Error('記録ファイルは5MBまでです。');return file.text();}
async function write(handle,baseline,data){
  const next=JSON.stringify(data,null,2);
  if(new TextEncoder().encode(next).length>limit)throw new Error('記録ファイルは5MBまでです。');
  const current=await read(handle);
  // A previous close may have succeeded before browser metadata was committed.
  if(current===next)return next;
  if(current!==baseline)throw new Error('記録ファイルが外部で変更されています。上書きを中止しました。JSONをダウンロードして退避し、「既存ファイルを開く」で内容を確認してください。');
  let stream;
  try{stream=await handle.createWritable({mode:'exclusive'});await stream.write(next);await stream.close();}
  catch(e){if(stream)try{await stream.abort();}catch{}throw e;}
  return next;
}
const api={read,write};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JournalFile=api;
})(globalThis);
