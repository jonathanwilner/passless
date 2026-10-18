# Validation record: 18 Oct 2026

## Passed

- Host suite: 23 tests, 23 passed, 0 failed.
- Two upstream Android Password Store binary CBOR fixtures decode correctly.
- Canonical and legacy backup-state formats pass; conflicting states fail.
- GnuPG decrypts this companion's OpenPGP ciphertext; the companion decrypts
  GnuPG ciphertext. Tests use synthetic Curve25519 keys and a private temporary
  GnuPG home. Wrong passphrase, wrong recipient key, tampering, and oversized
  decompressed plaintext are rejected.
- CBOR duplicate map keys, trailing data, truncation, indefinite lengths, and
  oversized input are rejected.
- In-flight key unlock and decryption are invalidated by lock. Decryption
  buffers are wiped even when the lock occurs before completion.
- DevEco 26 on Monaco compiled ArkTS and packaged an unsigned HAP with the
  installed HarmonyOS API26 Beta1 SDK `26.0.0.23`.
- Retrieved HAP manifest: bundle `com.thewilners.passless`, target API26,
  minimum API24, phone/tablet/2in1, INTERNET permission for the native GitHub bridge.
- The HAP's `app.js` SHA-256 equals the locally generated and tested bundle.

Tracked sessions:

- `test-passless-harmony-github-transport`
- `build-passless-harmony-github-release`
- `test-passless-harmony-github-read`

Dashboard: https://nix.thewilners.com/dashboard.html
The commands run from Armstrong; the build invokes the Monaco toolchain over
SSH. Their published logs therefore appear under `machines/armstrong/`.

Unsigned HAP (ignored build output):
`build/passless-0.1.0-api26-github-unsigned.hap`

SHA-256:
`bc73e36e30208a7f36de83929eb30a7dc041ae7055ce5432eae97748a745b4c1`

## Recipient-policy followup

Password editing requires an explicit effective `.gpg-id` policy and public
keys. The tests verify three original recipients retain exact encryption key
IDs, a fourth policy recipient can decrypt, and omitted recipients, missing
keys, private-key bundles, invalid policy forms and hidden recipients fail.
Original ciphertext export remains byte-preserving. A lock during encryption
prevents export and wipes generated buffers. Imports and inspection clear prior
plaintext and invalidate pending operations. GitHub-specific sync fetches encrypted objects and creates optimistic commits.

## GitHub acceptance boundaries

Synthetic API tests verify pinned-tree reads, nearest inherited policy lookup,
encrypted blob creation, exact commit parent, non-force ref update, changed-head
and concurrent divergence rejection, malformed/truncated trees, and refusal of
policy/public-key/traversal writes. Lifecycle tests verify background clearing
calls the native session clear operation and empties the token input. Host execution of the actual native bridge source with mocked Huawei HTTP
verifies fixed origin, redirects disabled, token/error-body exclusion from
callbacks, pending-request destruction/invalidation, and native refusal of
external routes, force updates and policy/public-key/traversal tree changes.
Source review found no credential logging. Device evidence for actual Huawei
HTTP and lifecycle behavior remains pending.

A live **read-only host** check through authenticated `gh` fetched the private
fleet repository: one encrypted readiness entry, 401-byte ciphertext, inherited
policy, and recipient public keys. The check performed no writes. This proves
the client read model against GitHub; it does not prove the HarmonyOS HTTP bridge.
Live commit/push and device transport acceptance remain untested.

## Physical-device acceptance

After the user enabled HDC forwarding, Armstrong reached the Pura X Max at
`100.96.211.107:37091`. Monaco used an authenticated SSH reverse relay on
`127.0.0.1:37996`. The live device reported HOP-AL10,
OpenHarmony-7.0.0.105, foreground verified admin user 100.

The existing Huawei developer account's DE region authenticated successfully.
A development profile was issued for `com.thewilners.passless` and the registered
Pura X Max, using an existing matching developer certificate and protected local
signing key. Signature verification succeeded. HDC installation explicitly to
user 100 and EntryAbility launch both succeeded.

Signed artifact: `build/passless-0.1.0-api26-enrollment-signed.hap`

SHA-256: `99a3fcf614bf56fb968c9407b0034d506e2f50ad9a5f7e20906f6790a759defc`

The installed UI renders its enrollment, unlock and file workflows and scrolls.
Published physical-device evidence:

- [Initial installed UI](https://debug.thewilners.com/#shot=20261018T224433Z-armstrong-passless-harmony-d64129cb5b-a7917429)
- [Scrolled enrollment and unlock UI](https://debug.thewilners.com/#shot=20261018T224540Z-armstrong-passless-harmony-f9bfe0e921-e3a0439f)

Runtime interaction stopped at the user's request to leave the phone available.
An attempted synthetic enrollment did not establish key-generation success.
Actual ArkWeb WebCrypto, key generation, native file selection/export,
decryption/editing, Huawei HTTP GitHub reads, background lock and token clearing
remain unverified on the physical device. No fleet private keys were copied,
no phone key was enrolled, and no repository writes were performed.

Host enrollment validation passed all 25 tests, including encrypted recovery
armor, wrong-passphrase refusal, matching public fingerprint, and decrypting a
message addressed to the generated key. Lifecycle tests cover generation
cancellation and passphrase clearing. DevEco API26 assembleHap succeeded.
Tracked sessions: `test-passless-harmony-enrollment-v3` and
`build-passless-harmony-enrollment`.

This HAP remains a hybrid companion preview. Generic Git/SSH transport,
hardware-backed persistent key custody and native system passkey-provider
integration remain pending. Host tests and successful installation do not prove
those capabilities or the remaining physical-device behaviors.

The SDK emits previewer ICU-file warnings, a module SemVer warning, duplicate
resource-name warnings, and an ArkTS deprecated-context warning. Packaging
succeeded; the warnings remain in the tracked build logs.
