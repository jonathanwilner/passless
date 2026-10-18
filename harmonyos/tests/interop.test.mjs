import test from 'node:test';
import assert from 'node:assert/strict';
import * as openpgp from 'openpgp';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {unlockKey,decryptFile,encryptFile,MAX_FILE} from '../web/crypto.mjs';
import {credentialMetadata,decodeCbor} from '../web/credential.mjs';
for(const name of ['07b36924d8924098bb427039d7d0f43b86b4cb52a9dec9aab04bf47472e02d7b','1381816530c267f00fb7d8a844b65f765cbbc059d8d7c695a40b7a1dea48f139']) {
 test(`APS shared credential fixture ${name.slice(0,8)}`,async()=>{const bytes=new Uint8Array(await readFile(new URL(`fixtures/${name}.bin`,import.meta.url)));const original=bytes.slice();const result=credentialMetadata(bytes);assert.equal(result.rp,'webauthn.io');assert.equal(result.backupState,'eligible');assert.deepEqual(bytes,original);});
}
test('reject duplicate keys, trailing bytes, oversized and truncated CBOR',()=>{
 for(const bytes of [[0xa2,0x61,0x61,1,0x61,0x61,2],[0xa0,0],[0x5a,0,0,0,50],[0x9f]])assert.throws(()=>decodeCbor(new Uint8Array(bytes)));
 assert.throws(()=>decodeCbor(new Uint8Array(MAX_FILE+1)));
});
test('OpenPGP protected key, GnuPG cross-decryption, tamper and wrong-key rejection',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'passless-test-'));
 try {
  const generated=await openpgp.generateKey({type:'ecc',curve:'curve25519Legacy',userIDs:[{name:'Synthetic test',email:'fixture@example.invalid'}],passphrase:'test-only-passphrase',format:'armored'});
  await assert.rejects(unlockKey(generated.privateKey,'wrong'));
  const key=await unlockKey(generated.privateKey,'test-only-passphrase');
  const bytes=new TextEncoder().encode('synthetic password\nusername: test\n');
  const encrypted=await encryptFile(bytes,[key.toPublic()]);
  assert.deepEqual(await decryptFile(encrypted,key),bytes);
  const env={...process.env,GNUPGHOME:dir};
  await writeFile(join(dir,'key.asc'),generated.privateKey,{mode:0o600});
  execFileSync('gpg',['--batch','--import',join(dir,'key.asc')],{env,stdio:'pipe'});
  await writeFile(join(dir,'credential.gpg'),encrypted);
  const plain=execFileSync('gpg',['--batch','--pinentry-mode','loopback','--passphrase','test-only-passphrase','--decrypt',join(dir,'credential.gpg')],{env,stdio:['pipe','pipe','pipe']});
  assert.deepEqual(new Uint8Array(plain),bytes);
  await writeFile(join(dir,'plain'),bytes);
  execFileSync('gpg',['--batch','--yes','--trust-model','always','--recipient','fixture@example.invalid','--output',join(dir,'gnu.gpg'),'--encrypt',join(dir,'plain')],{env,stdio:'pipe'});
  assert.deepEqual(await decryptFile(new Uint8Array(await readFile(join(dir,'gnu.gpg'))),key),bytes);
  const other=await openpgp.generateKey({type:'ecc',curve:'curve25519Legacy',userIDs:[{name:'Other synthetic key'}],format:'object'});
  await assert.rejects(decryptFile(encrypted,other.privateKey));
  const oversized=await openpgp.encrypt({message:await openpgp.createMessage({binary:new Uint8Array(MAX_FILE+1)}),encryptionKeys:key.toPublic(),format:'binary',config:{preferredCompressionAlgorithm:openpgp.enums.compression.zlib}});
  await assert.rejects(decryptFile(oversized,key));
  encrypted[encrypted.length-5]^=1;await assert.rejects(decryptFile(encrypted,key));
  await assert.rejects(decryptFile(new Uint8Array(MAX_FILE+1),key));
 }finally{try{execFileSync('gpgconf',['--homedir',dir,'--kill','gpg-agent'],{stdio:'ignore'});}catch{}await rm(dir,{recursive:true,force:true});}
});
function encode(v) {
 const head=(type,n)=> n<24?[type*32+n]:n<256?[type*32+24,n]:[type*32+25,n>>8,n&255];
 if(v===true)return [245];if(v===false)return [244];if(v===null)return [246];
 if(typeof v==='number')return v<0?head(1,-1-v):head(0,v);
 if(typeof v==='string'){const b=[...new TextEncoder().encode(v)];return [...head(3,b.length),...b];}
 if(v instanceof Uint8Array)return [...head(2,v.length),...v];
 if(Array.isArray(v))return [...head(4,v.length),...v.flatMap(encode)];
 return [...head(5,v.size),...[...v].flatMap(([k,value])=>[...encode(k),...encode(value)])];
}
test('backup state canonical and legacy migration rules',async()=>{
 const base=decodeCbor(new Uint8Array(await readFile(new URL('fixtures/07b36924d8924098bb427039d7d0f43b86b4cb52a9dec9aab04bf47472e02d7b.bin',import.meta.url))));
 for(const state of ['notEligible','eligible','backedUp']){const map=new Map(base);map.delete('backup_eligible');map.set('backup_state',state);assert.equal(credentialMetadata(new Uint8Array(encode(map))).backupState,state);}
 for(const [eligible,state,expected] of [[false,false,'notEligible'],[true,false,'eligible'],[true,true,'backedUp']]){const map=new Map(base);map.set('backup_eligible',eligible);map.set('backup_state',state);assert.equal(credentialMetadata(new Uint8Array(encode(map))).backupState,expected);}
 for(const [eligible,state] of [[false,true],[true,'eligible'],[true,'unknown'],[1,false]]){const map=new Map(base);map.set('backup_eligible',eligible);map.set('backup_state',state);assert.throws(()=>credentialMetadata(new Uint8Array(encode(map))));}
});
test('encryption helper requires explicit recipients and preserves both recipients',async()=>{
 const make=name=>openpgp.generateKey({type:'ecc',curve:'curve25519Legacy',userIDs:[{name}],format:'object'});
 const first=await make('Synthetic host A'),second=await make('Synthetic host B');
 const plain=new TextEncoder().encode('synthetic shared password');
 await assert.rejects(encryptFile(plain,first.privateKey));await assert.rejects(encryptFile(plain,[]));
 const cipher=await encryptFile(plain,[first.publicKey,second.publicKey]);
 assert.deepEqual(await decryptFile(cipher,first.privateKey),plain);assert.deepEqual(await decryptFile(cipher,second.privateKey),plain);
});
