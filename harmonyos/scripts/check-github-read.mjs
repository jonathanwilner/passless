// Optional read-only acceptance against the configured fleet repository.
// Uses the host's authenticated gh session; never prints tokens or blob contents.
import {execFileSync} from 'node:child_process';
import {GitHubStore} from '../web/github.mjs';
const store=new GitHubStore(async(method,path)=>{
 if(method!=='GET')throw Error('Read-only check');
 return JSON.parse(execFileSync('gh',['api','--method','GET',`repos/jonathanwilner/passless-store/git/${path}`],{encoding:'utf8',maxBuffer:4194304,stdio:['ignore','pipe','pipe']}));
});
const paths=await store.fetch();
if(!paths.includes('checks/encryption.gpg'))throw Error('Readiness fixture missing');
const opened=await store.open('checks/encryption.gpg');
if(!opened.policy.trim()||!opened.publicKeys.includes('BEGIN PGP PUBLIC KEY BLOCK'))throw Error('Recipient inputs missing');
console.log(`Read-only GitHub check passed: ${paths.length} encrypted entries; readiness ciphertext ${opened.encrypted.length} bytes; inherited policy and public keys fetched.`);
