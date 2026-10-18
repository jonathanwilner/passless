import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
async function harness(){
 const bundled=await build({entryPoints:['web/app.mjs'],bundle:true,write:false,format:'iife',plugins:[{name:'mock-crypto',setup(b){b.onResolve({filter:/crypto.mjs$/},()=>({path:'crypto',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const unlockKey = (...args) => globalThis.mockUnlock(...args); export const decryptFile = (...args) => globalThis.mockDecrypt(...args); export const encryptFile = (...args) => globalThis.mockEncrypt(...args);'}));}}]});
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:''});return elements.get(id);};
 let resolveUnlock,resolveDecrypt,resolveEncrypt;
 const context={document:{getElementById:element,addEventListener:()=>{}},Uint8Array,TextDecoder,TextEncoder,atob,btoa,setTimeout:()=>1,clearTimeout:()=>{},mockUnlock:()=>new Promise(r=>{resolveUnlock=r;}),mockDecrypt:()=>new Promise(r=>{resolveDecrypt=r;}),mockEncrypt:()=>new Promise(r=>{resolveEncrypt=r;})};context.window=context;
 vm.runInNewContext(bundled.outputFiles[0].text,context);
 return {context,element,unlock:r=>resolveUnlock(r),decrypt:r=>resolveDecrypt(r),encrypt:r=>resolveEncrypt(r)};
}
test('locking invalidates an in-flight key unlock',async()=>{const h=await harness();const pending=h.element('unlock').onclick();h.context.passlessLock();h.unlock({});await pending;assert.match(h.element('status').textContent,/Locked/);});
test('locking invalidates in-flight decryption and wipes plaintext',async()=>{const h=await harness();const unlocked=h.element('unlock').onclick();h.unlock({});await unlocked;await h.context.passlessReceive('credential',btoa('fake encrypted data'));h.element('kind').value='password';const pending=h.element('inspect').onclick();h.context.passlessLock();const plaintext=new TextEncoder().encode('sensitive');h.decrypt(plaintext);await pending;assert.equal(h.element('secret').value,'');assert.ok(plaintext.every(x=>x===0));});
