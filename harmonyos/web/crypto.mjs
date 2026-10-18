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
export async function encryptFile(plaintext,key) {
  if(plaintext.length>MAX_FILE)throw Error('Plaintext size limit');
  const message=await openpgp.createMessage({binary:plaintext});
  return openpgp.encrypt({message,encryptionKeys:key.toPublic(),format:'binary',config});
}
