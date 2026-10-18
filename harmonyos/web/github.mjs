const SHA=/^[a-f0-9]{40}$/;
const pathOK=p=>typeof p==='string'&&p.length<1024&&!p.split('/').some(s=>!s||s==='.'||s==='..'||/[\x00-\x1f\\]/.test(s));
const checkSha=s=>{if(!SHA.test(s))throw Error('Invalid Git object');return s;};
export const encodeBytes=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);};
export class GitHubStore {
 constructor(request){this.request=request;this.snapshot=null;}
 async fetch(){
  this.snapshot=null;
  const ref=await this.request('GET','ref/heads/main');
  if(ref.object?.type!=='commit')throw Error('Invalid branch');
  const commit=checkSha(ref.object.sha);
  const obj=await this.request('GET',`commits/${commit}`);
  const tree=checkSha(obj.tree?.sha);
  const result=await this.request('GET',`trees/${tree}?recursive=1`);
  if(result.truncated||!Array.isArray(result.tree)||result.tree.length>10000)throw Error('Incomplete tree');
  const entries=new Map();
  for(const item of result.tree){
   if(!pathOK(item.path)||entries.has(item.path))throw Error('Invalid path');
   checkSha(item.sha);entries.set(item.path,item);
  }
  this.snapshot={commit,tree,entries};
  return [...entries].filter(([p,e])=>p.endsWith('.gpg')&&e.type==='blob'&&e.mode==='100644').map(([p])=>p).sort();
 }
 async blob(path,snapshot=this.snapshot){
  const item=snapshot?.entries.get(path);
  if(!item||item.type!=='blob'||item.mode!=='100644'||item.size>1048576)throw Error('Unsupported file');
  const result=await this.request('GET',`blobs/${checkSha(item.sha)}`);
  if(result.encoding!=='base64'||typeof result.content!=='string'||result.content.length>1500000)throw Error('Unsupported blob');
  const bytes=Uint8Array.from(atob(result.content.replace(/\s/g,'')),c=>c.charCodeAt(0));
  if(bytes.length>1048576||bytes.length!==result.size)throw Error('Blob size mismatch');
  return bytes;
 }
 async open(path){
  const snapshot=this.snapshot;
  if(!snapshot||!pathOK(path)||!path.endsWith('.gpg'))throw Error('Select a credential');
  const encrypted=await this.blob(path,snapshot);
  const parts=path.split('/');parts.pop();let policyPath;
  while(true){const candidate=[...parts,'.gpg-id'].join('/');if(snapshot.entries.has(candidate)){policyPath=candidate;break;}if(!parts.length)throw Error('Recipient policy absent');parts.pop();}
  const policyBytes=await this.blob(policyPath,snapshot);
  const policy=new TextDecoder('utf-8',{fatal:true}).decode(policyBytes);
  const keyPaths=[...snapshot.entries.keys()].filter(p=>/^recipients\/[^/]+\.asc$/.test(p));
  if(!keyPaths.length||keyPaths.length>64)throw Error('Recipient keys absent or excessive');
  const publicKeys=[];
  for(const p of keyPaths)publicKeys.push(new TextDecoder('utf-8',{fatal:true}).decode(await this.blob(p,snapshot)));
  return {path,encrypted,policy,publicKeys:publicKeys.join('\n'),snapshot};
 }
 async commit(opened,ciphertext){
  if(!opened||opened.snapshot!==this.snapshot||!pathOK(opened.path)||!opened.path.endsWith('.gpg')||!ciphertext.length||ciphertext.length>1048576)throw Error('Stale or invalid edit');
  const base=opened.snapshot;
  const head=await this.request('GET','ref/heads/main');
  if(head.object?.sha!==base.commit)throw Error('Remote changed. Fetch and reopen before editing.');
  const blob=await this.request('POST','blobs',{encoding:'base64',content:encodeBytes(ciphertext)});
  const tree=await this.request('POST','trees',{base_tree:base.tree,tree:[{path:opened.path,mode:'100644',type:'blob',sha:checkSha(blob.sha)}]});
  const commit=await this.request('POST','commits',{message:'Update encrypted password from HarmonyOS',tree:checkSha(tree.sha),parents:[base.commit]});
  // GitHub rejects a divergent head when force=false, including races after GET.
  await this.request('PATCH','refs/heads/main',{sha:checkSha(commit.sha),force:false});
  this.snapshot=null;
  return commit.sha;
 }
}
