# Passless HarmonyOS companion preview

This is a HarmonyOS Stage app with an ArkUI shell, native document
pickers, a native GitHub HTTPS bridge, and an ArkWeb interface. OpenPGP.js performs credential decryption.
It reads the portable CBOR schema used by Android Password Store
(APS) and soft-fido2. It does not register as a system passkey provider.

## Implemented

- Import an ASCII-armored OpenPGP secret key through the system document picker.
  Unlock the key with its passphrase in memory.
- Import a binary OpenPGP `.gpg` credential produced by `pass`, APS, or Passless.
- Decrypt and edit password text in memory. Import the effective `.gpg-id`
  policy and an armored bundle of recipient public keys before edited export.
  Every original encryption key ID must resolve uniquely to a policy key.
  Export preserves those exact key IDs and includes all additional policy keys.
- Decrypt passkey CBOR and show relying-party ID, user name, signature counter,
  and backup state. Private key scalars are never rendered.
- Export the original encrypted credential without decoding or rewriting it.
- Lock after 60 seconds and when the Ability enters the background. Pending
  unlock/decrypt operations cannot reveal results after lock. Imports and new
  inspections clear prior plaintext and invalidate pending decryption.
- Reject oversized inputs, malformed CBOR, duplicate map keys, conflicting
  backup representations, and unauthenticated/tampered OpenPGP messages.

The two upstream APS fixtures cover Ed25519 and ES256 credential metadata.
Canonical `backup_state` strings and the legacy APS boolean representation are
accepted. This preview never changes passkey signature counters or backup state.

## Security and compatibility boundary

INTERNET permission is used only by the fixed GitHub native bridge. The content security policy forbids network
connections, external frames, forms, and inline scripts. The document bridge
accepts only fixed operation names. Local storage and Web SQL are disabled.
Input and decompressed OpenPGP output are bounded to 1 MiB. Decoded private bytes
are wiped after metadata inspection. Managed JavaScript strings and OpenPGP key
objects are garbage-collected and cannot promise deterministic zeroization.
This is a development preview, not hardware-backed key custody.

Only import secret keys on a device you intend to trust. HUKS wrapping,
biometric unlock, secure clipboard behavior, a persistent encrypted vault, generic
Git/SSH sync, passkey
creation/signing, CTAP/BLE transport,
and third-party credential-provider integration remain unimplemented.

Original encrypted exports preserve bytes. Edited passwords export to
`updated-password.gpg`; the imported ciphertext remains unchanged. Policies
accept only full primary fingerprints, one per line, plus blank/comment lines.
Hidden recipients, missing/ambiguous keys, private-key bundles, and unsupported
GnuPG policy forms fail closed. The user must select the effective policy for
that password: manual imports require this explicit selection. GitHub reads resolve the nearest
ancestor policy from the pinned tree. Original
recipients cannot be removed by supplying an incomplete policy.

GitHub-specific encrypted repository sync targets `jonathanwilner/passless-store`
on `main`. The session-only token is held by the native bridge. Fetch resolves
recipient policies and public keys from the pinned tree; edits create encrypted
Git objects and a non-force commit update. See `GIT-SYNC.md` for conflict handling,
permission scope and device acceptance gates. Generic Git/SSH is unimplemented.

## Build

From this directory on a Node.js host:

```sh
npm ci --ignore-scripts
nom-tmux test-passless-harmony -- npm test
nom-tmux bundle-passless-harmony -- npm run bundle
```

Copy this directory, including the generated `entry/src/main/resources/rawfile/web`
assets, to `C:\Users\jonathan\src\passless-harmony\harmonyos` on Monaco. Exclude
`node_modules`, `.hvigor`, and build outputs. Build through the tracked wrapper:

```sh
nom-tmux build-passless-harmony -- ssh -p 2222 monaco.local powershell -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\jonathan\src\passless-harmony\harmonyos\scripts\Build-Monaco.ps1'
```

`Build-Monaco.ps1` uses the existing DevEco 26 installation and SDK root. It does
not update SDKs, emulator roots, or signing profiles. Hvigor requires the SDK
**parent** directory, which contains `HarmonyOS-26.0.0`, rather than the
`default/openharmony` component tree.

Expected output: `entry/build/default/outputs/default/entry-default-unsigned.hap`.
The project intentionally has no signing configuration. A Huawei profile for
`com.thewilners.passless` and the exact target device is required before install.
Never reuse a profile belonging to another bundle.

## HarmonyOS 7 and provider evidence

Huawei's official Chinese documentation identifies HarmonyOS 7 as API 26:
https://developer.huawei.com/consumer/cn/activity/developerbeta/harmonyos-developer-beta-7-1

The local SDK was read directly on 18 Oct 2026:

- `C:\Huawei\DevEcoStudio\DevEco Studio 26.0.0\sdk\default\sdk-pkg.json`
- API 26, platform `26.0.0`, SDK `26.0.0.23`, release `Beta1`.
- The project compiles and targets API 26; minimum compatibility is API 24.
- The CN DevEco release and beta update checks returned HTTP 200 with no
  actionable update metadata. This does not establish that the SDK is current.

Huawei Online Authentication Kit's public passkey API describes registration
and authentication for relying-party applications:
https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/api/onlineauthentication-passkey-api

That consumer API does not establish the ability to register this app as an
arbitrary third-party passkey provider. Android's `CredentialProviderService`
cannot be carried into HarmonyOS by renaming APIs. Provider parity remains
unverified, and this preview exposes no system provider or WebAuthn endpoint.

## Validation

See `VALIDATION.md` for the current source, cryptography, build, and device gates.
Host tests use synthetic OpenPGP keys and temporary private GnuPG homes. Tests
never read the user's password store or GnuPG keyring.

Source reference: `pando85/Android-Password-Store` commit
`7dc489ec57c9c19e5373fe602aba21f8069b5eff`, particularly
`passkeys/core/.../model/StoredCredential.kt` and `passkeys/CREDENTIAL_FORMAT.md`.
See `NOTICE.md` for fixture and library attribution.

Phone enrollment: generate a separate OpenPGP key in the app with a recovery
passphrase of at least 16 characters. Export `passless-phone-public.asc` for
fleet enrollment and `passless-phone-recovery.asc` to a user-chosen recovery
location. The latter contains only passphrase-encrypted secret key armor.
Import that recovery file to unlock each session. Public and encrypted recovery
armor remain in memory across lock so both exports can use the system picker;
plaintext key state and passphrase inputs are cleared. Closing the app loses
unexported enrollment material. Compare the displayed public fingerprint before
adding the public key to the store policy. Re-encrypt entries for the expanded
policy on a trusted fleet host. Never copy a fleet host's private key to the phone.
