import * as openpgp from 'openpgp';
export const MAX_FILE = 1024 * 1024;
const config = { allowUnauthenticatedMessages: false, allowUnauthenticatedStream: false, maxDecompressedMessageSize: MAX_FILE };
export async function unlockKey(armoredKey, passphrase) {
  if(armoredKey.length>MAX_FILE)throw Error('Key size limit');
  const key=await openpgp.readPrivateKey({armoredKey});
  return key.isDecrypted()?key:openpgp.decryptKey({privateKey:key,passphrase});
}
export async function decryptFile(ciphertext,key) {
  if(ciphertext.length>MAX_FILE)throw Error('Encrypted file size limit');
  const message=await openpgp.readMessage({binaryMessage:ciphertext,config});
  const result=await openpgp.decrypt({message,decryptionKeys:key,format:'binary',config});
  if(result.data.length>MAX_FILE){result.data.fill(0);throw Error('Decrypted file size limit');}
  return result.data;
}
export async function encryptFile(plaintext,recipients) {
  if(!Array.isArray(recipients)||recipients.length===0)throw Error('Explicit recipients required');
  if(plaintext.length>MAX_FILE)throw Error('Plaintext size limit');
  const message=await openpgp.createMessage({binary:plaintext});
  return openpgp.encrypt({message,encryptionKeys:recipients,format:'binary',config});
}
// Only full primary fingerprints are accepted. GnuPG groups, email lookup and
// short IDs need a real store resolver and must never silently select a key.
export async function encryptPreservingRecipients(plaintext, ciphertext, policy, armoredPublicKeys) {
  if(policy.length>MAX_FILE||armoredPublicKeys.length>MAX_FILE||ciphertext.length>MAX_FILE)throw Error('Input size limit');
  const fingerprints=[...new Set(policy.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')).map(x=>x.toLowerCase()))];
  if(!fingerprints.length||fingerprints.length>64||fingerprints.some(x=>!/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(x)))throw Error('Full primary fingerprints required');
  const blocks=armoredPublicKeys.match(/-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]*?-----END PGP PUBLIC KEY BLOCK-----/g);
  if(!blocks||blocks.length>64||armoredPublicKeys.replace(/-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]*?-----END PGP PUBLIC KEY BLOCK-----/g,'').trim())throw Error('Public key armor required');
  const keys=(await Promise.all(blocks.map(armoredKeys=>openpgp.readKeys({armoredKeys})))).flat();
  if(keys.some(k=>k.isPrivate()))throw Error('Public keys required');
  const selected=fingerprints.map(f=>{const matches=keys.filter(k=>k.getFingerprint()===f);if(matches.length!==1)throw Error('Missing or duplicate policy key');return matches[0];});
  const message=await openpgp.readMessage({binaryMessage:ciphertext,config});
  const original=message.getEncryptionKeyIDs();
  if(!original.length||original.length>64)throw Error('Explicit original recipients required');
  const encryptionKeys=[],encryptionKeyIDs=[];
  for(const id of original){
    if(/^0+$/.test(id.toHex()))throw Error('Hidden recipients unsupported');
    const matches=selected.filter(k=>k.getKeyIDs().some(x=>x.equals(id)));
    if(matches.length!==1)throw Error('Original recipient missing from policy or ambiguous');
    if(!encryptionKeyIDs.some(x=>x.equals(id))){encryptionKeys.push(matches[0]);encryptionKeyIDs.push(id);}
  }
  for(const k of selected)if(!encryptionKeys.includes(k)){encryptionKeys.push(k);encryptionKeyIDs.push((await k.getEncryptionKey()).getKeyID());}
  if(plaintext.length>MAX_FILE)throw Error('Plaintext size limit');
  const result=await openpgp.encrypt({message:await openpgp.createMessage({binary:plaintext}),encryptionKeys,encryptionKeyIDs,format:'binary',config});
  const actual=(await openpgp.readMessage({binaryMessage:result,config})).getEncryptionKeyIDs();
  if(actual.length!==encryptionKeyIDs.length||encryptionKeyIDs.some(id=>!actual.some(x=>x.equals(id)))){result.fill(0);throw Error('Recipient verification failed');}
  return result;
}
