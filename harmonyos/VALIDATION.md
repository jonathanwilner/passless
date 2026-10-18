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

## Device and acceptance gates still open

Both the canonical `C:\Program Files\Huawei\DevEco Studio` HDC and the resolved
DevEco 26 HDC returned `[Empty]` when listing targets. No device was installed,
launched, or captured. The current preview has no signed HAP or device-specific
profile for `com.thewilners.passless`.

Required next acceptance sequence:

1. Connect and identify the intended HarmonyOS target and active user.
2. Obtain a Huawei development profile for this bundle and that device; sign
   and verify with the existing DevEco signer.
3. Install and launch. Verify native file picking and saving, ArkWeb WebCrypto
   availability on the rawfile origin, OpenPGP interoperability, background
   lock, GitHub token clearing and no-redirect transport, conflict rejection, and rejection of navigation away from bundled resources.
4. Publish screenshot evidence to the authenticated debug gallery.

The host tests exercise the bundled implementation. They do not establish
ArkWeb/device runtime behavior. This HAP is a hybrid companion preview, not a
complete Android Password Store feature port or a system passkey provider.

The SDK emits previewer ICU-file warnings, a module SemVer warning, duplicate
resource-name warnings, and an ArkTS deprecated-context warning. Packaging
succeeded. These warnings are preserved in the tracked build log and are not
runtime proof.

Phone enrollment follow-up: synthetic test checks encrypted recovery armor,
wrong-passphrase refusal, matching public fingerprint and decrypting a message
addressed to the new key. Lifecycle test checks background cancellation of
pending generation and clearing the recovery passphrase. Device key generation
and document-picker export still require physical acceptance.

Monaco HDC connection attempts to both Pura X Max Tailscale peers
`100.69.83.125:37091` and `100.96.211.107:37091` failed. HDC reported both
TCP Offline with unknown identity. Installation cannot proceed until a live
shell identifies the device and active user, followed by a matching bundle/device
signing profile. No private fleet keys were transferred.

Enrollment follow-up validation: all 25 host tests passed; DevEco API 26
assembleHap succeeded. Artifact `build/passless-0.1.0-api26-enrollment-unsigned.hap`.
Pura X Max peer `100.96.211.107` subsequently became online in Tailscale, but
Monaco HDC connection still failed and a direct TCP check timed out on port 37091.
