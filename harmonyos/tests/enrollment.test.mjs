import test from 'node:test';
import assert from 'node:assert/strict';
import * as openpgp from 'openpgp';
import {generatePhoneKey} from '../web/enrollment.mjs';
test('phone enrollment exports encrypted recovery and matching public recipient',async()=>{
 await assert.rejects(generatePhoneKey('short'));
 const passphrase='disposable test recovery passphrase';
 const result=await generatePhoneKey(passphrase);
 const secret=await openpgp.readPrivateKey({armoredKey:result.recoveryKey});
 assert.equal(secret.isDecrypted(),false);
 const publicKey=await openpgp.readKey({armoredKey:result.publicKey});
 assert.equal(publicKey.isPrivate(),false);
 assert.equal(publicKey.getFingerprint().toUpperCase(),result.fingerprint);
 await assert.rejects(openpgp.decryptKey({privateKey:secret,passphrase:'incorrect'}));
 const unlocked=await openpgp.decryptKey({privateKey:secret,passphrase});
 const ciphertext=await openpgp.encrypt({message:await openpgp.createMessage({text:'phone fixture'}),encryptionKeys:publicKey});
 const resultPlain=await openpgp.decrypt({message:await openpgp.readMessage({armoredMessage:ciphertext}),decryptionKeys:unlocked});
 assert.equal(resultPlain.data,'phone fixture');
});
