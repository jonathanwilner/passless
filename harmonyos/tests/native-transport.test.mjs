import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import vm from 'node:vm';
async function harness(){
 const text=await readFile('entry/src/main/ets/pages/GitHubBridge.ets','utf8');
 const result=await build({stdin:{contents:text,loader:'ts'},bundle:true,write:false,format:'iife',globalName:'Native',plugins:[{name:'native-mocks',setup(b){b.onResolve({filter:/^@ohos/},args=>({path:args.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export default globalThis.mockHttp;'}));}}]});
 const requests=[],callbacks=[];let resolve,destroyed=0;
 const context={mockHttp:{RequestMethod:{GET:'GET',POST:'POST'},HttpDataType:{STRING:0},createHttp:()=>({request:(url,options)=>{requests.push({url,options});return new Promise(r=>{resolve=r;});},destroy:()=>{destroyed++;}})}};
 vm.runInNewContext(result.outputFiles[0].text,context);
 const bridge=new context.Native.GitHubBridge({runJavaScript:async s=>{callbacks.push(s);}});
 return {bridge,requests,callbacks,resolve:r=>resolve(r),destroyed:()=>destroyed};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('native transport bounds origin, disables redirects and never returns token/error body',async()=>{
 const h=await harness();const token='synthetic_test_token_123456789';h.bridge.setSession(token);h.bridge.request(1,'GET','ref/heads/main','');assert.equal(h.requests[0].url,'https://api.github.com/repos/jonathanwilner/passless-store/git/ref/heads/main');assert.equal(h.requests[0].options.maxRedirects,0);assert.equal(h.requests[0].options.usingCache,false);assert.equal(h.requests[0].options.header.Authorization,'Bearer '+token);h.resolve({responseCode:403,result:'sensitive server error '+token});await tick();assert.equal(h.callbacks.length,1);assert.ok(!h.callbacks[0].includes(token));assert.ok(!h.callbacks[0].includes('sensitive'));assert.ok(h.destroyed()>0);
});
test('native session clear cancels request, invalidates response and refuses further calls',async()=>{
 const h=await harness();h.bridge.setSession('synthetic_test_token_123456789');h.bridge.request(1,'GET','ref/heads/main','');h.bridge.clearSession();h.resolve({responseCode:200,result:'{}'});await tick();assert.equal(h.callbacks.length,0);h.bridge.request(2,'GET','ref/heads/main','');await tick();assert.equal(h.requests.length,1);assert.match(h.callbacks[0],/\(2,0,/);
});
test('native bridge refuses external paths, force updates and policy writes',async()=>{
 const h=await harness();h.bridge.setSession('synthetic_test_token_123456789');let id=1;
 for(const [method,path,body] of [['GET','https://evil.invalid',''],['PATCH','refs/heads/main',JSON.stringify({sha:'a'.repeat(40),force:true})],...['.gpg-id','recipients/host.asc','../secret.gpg'].map(path=>['POST','trees',JSON.stringify({base_tree:'a'.repeat(40),tree:[{path,mode:'100644',type:'blob',sha:'b'.repeat(40)}]})])])h.bridge.request(id++,method,path,body);
 await tick();assert.equal(h.requests.length,0);assert.equal(h.callbacks.length,5);
});
