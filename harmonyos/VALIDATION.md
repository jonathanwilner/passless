# Validation record: 18 Oct 2026

## Passed

- Host suite: 14 tests, 14 passed, 0 failed.
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
  minimum API24, phone/tablet/2in1, no requested permissions.
- The HAP's `app.js` SHA-256 equals the locally generated and tested bundle.

Tracked sessions:

- `test-passless-harmony-policy-final`
- `build-passless-harmony-policy`

Dashboard: https://nix.thewilners.com/dashboard.html
Both commands run from Armstrong; the build invokes the Monaco toolchain over
SSH. Their published logs therefore appear under `machines/armstrong/`.

Unsigned HAP (ignored build output):
`build/passless-0.1.0-api26-policy-unsigned.hap`

SHA-256:
`a28cc4fd3cd52be07f96f443b9da10710a07e81914ba5a1b0c797a4de00726c3`

## Recipient-policy followup

Password editing requires an explicit effective `.gpg-id` policy and public
keys. The tests verify three original recipients retain exact encryption key
IDs, a fourth policy recipient can decrypt, and omitted recipients, missing
keys, private-key bundles, invalid policy forms and hidden recipients fail.
Original ciphertext export remains byte-preserving. A lock during encryption
prevents export and wipes generated buffers. Imports and inspection clear prior
plaintext and invalidate pending operations. There is no native Git sync.

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
   lock, and rejection of navigation away from bundled resources.
4. Publish screenshot evidence to the authenticated debug gallery.

The host tests exercise the bundled implementation. They do not establish
ArkWeb/device runtime behavior. This HAP is a hybrid companion preview, not a
complete Android Password Store feature port or a system passkey provider.

The SDK emits previewer ICU-file warnings, a module SemVer warning, duplicate
resource-name warnings, and an ArkTS deprecated-context warning. Packaging
succeeded. These warnings are preserved in the tracked build log and are not
runtime proof.
