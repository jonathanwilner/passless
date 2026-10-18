# Validation record: 18 Oct 2026

## Passed

- Host suite: 12 tests, 12 passed, 0 failed.
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

- `test-passless-harmony-recipient-final`
- `build-passless-harmony-readonly`

Dashboard: https://nix.thewilners.com/dashboard.html
Both commands run from Armstrong; the build invokes the Monaco toolchain over
SSH. Their published logs therefore appear under `machines/armstrong/`.

Unsigned HAP (ignored build output):
`build/passless-0.1.0-api26-readonly-unsigned.hap`

SHA-256:
`b3b2d6b0309d316a23b3e198a090ee761c21fe24b757c662e7d1f3fed571327d`

## Recipient-policy followup

Password text is read-only. The app does not import the complete inherited
`.gpg-id` policy, so editing and re-encryption are disabled. The native bridge
accepts only original encrypted credential exports. Tests verify byte-preserving
export, explicit multi-recipient encryption in the standalone helper, and
clearing/invalidation of prior plaintext on file/key import and inspection.
The helper is not called by the app. There is no native Git sync.

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
