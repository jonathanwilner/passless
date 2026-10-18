import test from 'node:test';
import assert from 'node:assert/strict';
import {GitHubStore,encodeBytes} from '../web/github.mjs';
const sha=n=>String(n).repeat(40);
function server(){
 const calls=[];let head=sha(1),race=false;
 const files={'folder/password.gpg':{sha:sha(3),bytes:new Uint8Array([1,2,3])},'.gpg-id':{sha:sha(4),bytes:new TextEncoder().encode('root policy')},'folder/.gpg-id':{sha:sha(5),bytes:new TextEncoder().encode('nested policy')},'recipients/host.asc':{sha:sha(6),bytes:new TextEncoder().encode('public key')}};
 const request=async(method,path,body)=>{
  calls.push({method,path,body});
  if(path==='ref/heads/main')return {object:{type:'commit',sha:head}};
  if(path===`commits/${sha(1)}`)return {tree:{sha:sha(2)}};
  if(path===`trees/${sha(2)}?recursive=1`)return {truncated:false,tree:Object.entries(files).map(([path,f])=>({path,type:'blob',mode:'100644',sha:f.sha,size:f.bytes.length}))};
  if(method==='GET'&&path.startsWith('blobs/')){const f=Object.values(files).find(f=>path.endsWith(f.sha));return {content:encodeBytes(f.bytes),encoding:'base64',size:f.bytes.length};}
  if(method==='POST')return {sha:sha(path==='blobs'?7:path==='trees'?8:9)};
  if(method==='PATCH'){assert.equal(body.force,false);if(race)throw Error('422 divergent');head=body.sha;return {};}
  throw Error('Unexpected request');
 };
 return {request,calls,setHead:v=>{head=v;},race:()=>{race=true;}};
}
test('pinned encrypted fetch resolves nearest policy and recipient keys',async()=>{
 const s=server(),store=new GitHubStore(s.request);assert.deepEqual(await store.fetch(),['folder/password.gpg']);const opened=await store.open('folder/password.gpg');assert.equal(opened.policy,'nested policy');assert.equal(opened.publicKeys,'public key');assert.deepEqual(opened.encrypted,new Uint8Array([1,2,3]));
});
test('commit uses base tree, encrypted blob, exact parent and non-force ref update',async()=>{
 const s=server(),store=new GitHubStore(s.request);await store.fetch();const opened=await store.open('folder/password.gpg');await store.commit(opened,new Uint8Array([7,8]));
 assert.deepEqual(s.calls.find(x=>x.path==='blobs'&&x.method==='POST').body,{encoding:'base64',content:'Bwg='});
 assert.equal(s.calls.find(x=>x.path==='trees'&&x.method==='POST').body.base_tree,sha(2));
 assert.deepEqual(s.calls.find(x=>x.path==='commits'&&x.method==='POST').body.parents,[sha(1)]);
 assert.equal(store.snapshot,null);await assert.rejects(store.commit(opened,new Uint8Array([9])));
});
test('changed head fails before writes; concurrent divergent update is never forced',async()=>{
 for(const racing of [false,true]){const s=server(),store=new GitHubStore(s.request);await store.fetch();const opened=await store.open('folder/password.gpg');if(racing)s.race();else s.setHead(sha(0));await assert.rejects(store.commit(opened,new Uint8Array([7])));if(!racing)assert.ok(s.calls.every(x=>x.method==='GET'));else assert.equal(s.calls.at(-1).body.force,false);}
});
test('truncated trees and traversal paths fail closed',async()=>{
 const s=server();for(const tree of [{truncated:true,tree:[]},{tree:[{path:'../secret.gpg',sha:sha(3)}]}]){const store=new GitHubStore((m,p,b)=>p.startsWith('trees/')?Promise.resolve(tree):s.request(m,p,b));await assert.rejects(store.fetch());assert.equal(store.snapshot,null);}
});
test('commit refuses policy/public-key paths and traversal before requests',async()=>{
 const s=server(),store=new GitHubStore(s.request);await store.fetch();const opened=await store.open('folder/password.gpg');const count=s.calls.length;
 for(const path of ['.gpg-id','recipients/host.asc','../outside.gpg'])await assert.rejects(store.commit({...opened,path},new Uint8Array([7])));
 assert.equal(s.calls.length,count);
});
