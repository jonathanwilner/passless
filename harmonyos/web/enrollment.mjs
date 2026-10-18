import * as openpgp from 'openpgp';
export async function generatePhoneKey(passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 16) throw new Error('Recovery passphrase too short');
  const generated = await openpgp.generateKey({ type: 'ecc', curve: 'curve25519Legacy',
    userIDs: [{ name: 'Passless HarmonyOS phone' }], passphrase, format: 'armored' });
  const secret = await openpgp.readPrivateKey({ armoredKey: generated.privateKey });
  if (secret.isDecrypted()) throw new Error('Recovery key must be encrypted');
  const publicKey = await openpgp.readKey({ armoredKey: generated.publicKey });
  return { publicKey: generated.publicKey, recoveryKey: generated.privateKey,
    fingerprint: publicKey.getFingerprint().toUpperCase() };
}
