// Verify synthetic registration responses exported by Rust tests using an
// independent relying-party implementation. Input contains public data only.
import assert from 'node:assert/strict';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import { readFileSync } from 'node:fs';
import { verifyRegistrationResponse } from '@simplewebauthn/server';

const file = process.argv[2];
if (!file) throw new Error('Usage: node verify-agent-registration.mjs FIXTURES.json');
const fixtures = JSON.parse(readFileSync(file, 'utf8'));
if (!Array.isArray(fixtures) || fixtures.length === 0) throw new Error('No fixtures');
for (const fixture of fixtures) {
  const data = fixture.response ?? fixture;
  const options = {
    response: {
      id: data.credential_id_b64u,
      rawId: data.credential_id_b64u,
      type: 'public-key',
      authenticatorAttachment: 'platform',
      clientExtensionResults: {},
      response: {
        clientDataJSON: data.client_data_json_b64u,
        attestationObject: data.attestation_object_b64u,
        transports: ['internal'],
      },
    },
    expectedChallenge: 'dGVzdA',
    expectedOrigin: 'https://example.com',
    expectedRPID: 'example.com',
    requireUserVerification: true,
    supportedAlgorithmIDs: [-7, -8, -19],
  };
  const result = await verifyRegistrationResponse(options);
  if (!result.verified) throw new Error('Registration rejected');
  const attestation = isoCBOR.decodeFirst(Buffer.from(data.attestation_object_b64u, 'base64url'));
  const auth = Buffer.from(attestation.get('authData'));
  const keyOffset = 55 + auth.readUInt16BE(53);
  const key = isoCBOR.decodeFirst(auth.subarray(keyOffset));
  const raw = data.public_key_algorithm === -7
    ? Buffer.concat([Buffer.from([4]), Buffer.from(key.get(-2)), Buffer.from(key.get(-3))])
    : Buffer.from(key.get(-2));
  attestation.set('authData', new Uint8Array(Buffer.concat([auth.subarray(0, keyOffset), raw])));
  const malformed = structuredClone(options);
  malformed.response.response.attestationObject = Buffer.from(isoCBOR.encode(attestation)).toString('base64url');
  await assert.rejects(verifyRegistrationResponse(malformed));
  console.log(`Verified algorithm ${data.public_key_algorithm}: corrected registration accepted; original raw-key encoding rejected`);
}
