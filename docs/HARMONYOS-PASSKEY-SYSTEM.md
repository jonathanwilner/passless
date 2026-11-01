# Passless across Linux, Android and HarmonyOS: evidence and status

Status: 1 November 2026. This is the consolidated record for the shared-passkey investigation. Historical logs remain linked below. Proposals are in [five implementation options](plans/cross-platform-passkey-options.md). This document records existing work; it does not authorize or claim deployment of those proposals.

## Objective and current conclusion

The objective is to register one passkey and use that same credential from Linux, Android and HarmonyOS, ideally with encrypted local copies and offline signing like a synchronized keychain. “Same passkey” means the same credential ID and public/private key, not separate credentials attached to the same account.

**Huawei Browser and Huawei Password Vault successfully registered and used passkeys on the physical HarmonyOS phone.** Both our controlled HTTPS relying party (RP) and the independent WebAuthn.io website worked. Those credentials were created by Huawei Password Vault, not Passless. Cross-platform use of one Passless credential remains unproved.

Native RP access is a separate issue. The diagnostic native app registered successfully, but authentication failed at an app/domain association check. Completing that association would establish native RP access; it would not make Passless a system credential provider.

## Components already implemented

| Component | Implemented | Acceptance boundary |
|---|---|---|
| Linux Passless | Software FIDO2 authenticator through UHID; encrypted `pass`/Git storage; configurable backup and counter policies; local agent broker | Existing implementation does not establish Harmony browser integration or uniform current fleet settings |
| Harmony companion `com.thewilners.passless` | ArkUI/ArkWeb interface, native document pickers, OpenPGP decryption, portable APS/soft-fido2 CBOR inspection, original ciphertext export | Companion does not create/sign passkeys or register as a system provider |
| Companion password editing | Recipient-policy-aware encryption, preservation of original recipient key IDs, additional policy recipients, rejection of missing/ambiguous/hidden recipients | Host tests passed; physical-device crypto workflow remains unverified |
| Companion enrollment | Separate phone OpenPGP key and passphrase-encrypted recovery export; no host private-key copy required | Host tests passed; phone enrollment was not completed |
| Companion GitHub bridge | Fixed `jonathanwilner/passless-store` repository on `main`, session-only token, bounded fixed HTTPS operations, pinned-tree recipient policy, encrypted commits with non-force compare-and-swap | Device reads/writes and lifecycle handling remain unverified; no generic Git/SSH transport |
| Controlled WebAuthn lab | Strict challenge, RP ID, origin, user-verification and signature verification; authenticated TLS mode | Temporary test server, not a production credential service |
| Native probe `com.thewilners.passless.probe` | Capability queries, registration/authentication, structured timing/error logs, native registration verifier | Diagnostic RP app, not the companion and not a provider |
| Native domain association configuration | Disabled-by-default Nix module in an isolated Nix branch | Syntax checked; not enabled, built or deployed |

The companion locks after 60 seconds and on background entry. Pending operations are invalidated. Managed JavaScript cannot promise deterministic memory zeroization. Persistent encrypted caching, HUKS key wrapping, biometric persistent unlock, passkey signing, CTAP/BLE and provider integration are absent. See [companion README](../harmonyos/README.md), [Git synchronization](../harmonyos/GIT-SYNC.md) and [validation](../harmonyos/VALIDATION.md).

The companion was signed, installed and visually checked on **18 October on HOP-AL10 Pura X Max**, OpenHarmony 7.0.0.105, user 100. This is a different device from the November tests. Host enrollment validation passed 25 tests and API26 packaging succeeded. Phone crypto, file export, GitHub operations, background lock and token clearing were not accepted before the user stopped testing. Signed companion SHA-256: `99a3fcf614bf56fb968c9407b0034d506e2f50ad9a5f7e20906f6790a759defc`.

## November test environment

- Physical device: **LAP-AL10**, HarmonyOS **7.0.0.111(SP12C14E111R6P4)**; wireless debugging endpoint supplied by the user: `192.168.84.138:35891`. Debug endpoints can change.
- Browser: Huawei Browser **6.1.9.323**, ArkWeb **7.0.0.111**.
- Tooling host: Monaco over SSH `monaco.local:2222`; HDC at `C:\Program Files\Huawei\DevEco Studio\sdk\default\openharmony\toolchains\hdc.exe`.
- SDKs inspected: Monaco **6.1.1.125 Release/API24**; Dropshot **26.0.0.23 Beta1/API26**, under `/Users/jonathan/Library/Huawei/Sdk/HarmonyOS-26.0.0`.
- Emulators inspected read-only: Monaco `127.0.0.1:15557`, Dropshot `127.0.0.1:15556`, OpenHarmony 7.0.0.105/API26. The physical phone supplied decisive authentication evidence. No emulator repair is a prerequisite for these results.

## Test chronology and strength of evidence

### 1. Localhost browser: registration passed, authentication unresolved

Synthetic `testuser` registration succeeded. Authentication returned `NotAllowedError`. One attempt involved a PIN prompt and a timeout report. Later attempts configured for three minutes returned in approximately 0.3 seconds without a prompt, including discoverable authentication. A locked-device/HDC interruption was also resolved by unlocking.

No localhost authentication signature was verified. The exact cause remains unresolved; a configured timeout does not prove that timeout elapsed. This result does not establish a general HarmonyOS passkey limitation. Forwarding was removed after testing. See [local result](../tools/agent-uhid-feasibility/controlled-rp/results/2026-11-01-harmony-real-device.json).

### 2. Trusted HTTPS browser: registration and authentication verified

The temporary RP used `https://tv.thewilners.com:8443`, RP ID `tv.thewilners.com`, existing LAN DNS to Armstrong and an existing trusted ACME certificate. It did not change TV services, Cloudflare routes or DNS. The user confirmed both operations with PIN.

- Registration verified at **17:36:20.359 UTC** on 1 November.
- Authentication verified at **17:37:01.336 UTC**, same credential ID `bt4Ex_dKi8wtrLORTKGdAQ75-IsTd90IsrHQsZRMRKM`.
- User verification was true; signature counter advanced **1 → 2**.
- AAGUID: `e304172b-ced4-54da-89b1-a8c1d007cd70`; reported `singleDevice`, `credentialBackedUp=false`. These flags alone do not establish Huawei's cloud-storage behavior.

The server checked the exact origin, challenge, RP ID, user verification and signature. See [structured result](../tools/agent-uhid-feasibility/controlled-rp/results/2026-11-01-harmony-real-https.json) and [published evidence](https://debug.thewilners.com/#shot=20261101T173726Z-armstrong-harmony-passkey-compatibility-d8062d9ddc-d21c581d).

The server was stopped. Its in-memory challenges and credential records are gone. TLS mode requires token authentication, rejects foreign Origins, limits request bodies to 64 KiB, uses a secure HttpOnly SameSite cookie or bearer authentication, and drops privilege after certificate loading. The verification policy was not relaxed. **44 tests passed**, tracked as `test-harmony-https-rp`. See [lab instructions](../tools/agent-uhid-feasibility/controlled-rp/HARMONYOS.md).

### 3. Native app: verified registration, association-blocked authentication

The probe was built, signed, installed and launched after the phone was unlocked. An expired certificate, `xiaobai-debug-zeroport-20260926`, was removed with explicit user approval to resolve Huawei's certificate quota. A dedicated development profile/certificate was obtained for `PasslessNativeProbeUltimate20261101`; the certificate expires **15 November 2026**. Signing secrets remain outside Git.

Capability results were true for conditional create/get, hybrid transport, platform authenticator, user-verifying platform authenticator, largeBlob and authTypeList. Related-origin and signal capabilities were false. PIN was available; fingerprint/face were unavailable in that device state. These are capability reports, not transport acceptance. A Map serialization issue in the probe was corrected.

Registration completed at approximately **17:53:15 UTC**, after nine seconds. Independent offline verification checked the original challenge, RP ID, user verification, packed attestation and signature. Counter was 1. Credential ID: `Ti4lz8lMmzYu2W83LjrXKB85l5IXKMbqDtNTFj6x0Ic`.

The native origin was derived independently from the verified HAP signer's P-256 public point, not trusted from the response:

```text
ohos:app-id:BFZ8bphwYXAdkE7VzPoVRVkN+MMi4FIny77pNojzGb289USZXOqcYbU4IzbKGTrf3aw96bui+BnLnY6aiN/Izd4
```

Authentication failed in **241 ms** at approximately 17:53:56 UTC, before a prompt or assertion, with `1021300003 System integrity check failed`. The decisive service log was **`Fido2Client: checkRpInAppLink fail`**. This identifies an association failure; it is not evidence that the phone is compromised.

A subsequent manifest added verified-domain handling for the HTTPS domain, limited to `passless-native-probe` paths. Build, signature verification and installation passed. Domain manager then reported `https://tv.thewilners.com:client_error` for appIdentifier `6918746563381217948`. Authentication was not repeated while association remained incomplete.

Final v4 HAP SHA-256: `5700ca028961e173c280f2e7ed891e6a96da4afe058d460b0040d25709d6475c`.

Records: [native validation](../tools/harmony-native-probe/VALIDATION.md), [runtime record](../tools/harmony-native-probe/runtime-20261101.json), [verification report](../tools/agent-uhid-feasibility/controlled-rp/results/2026-11-01-harmony-native-registration.json), [verifier](../tools/agent-uhid-feasibility/controlled-rp/verify-native-registration.mjs). Original verification inputs included temporary local files; the committed report and script do not guarantee all original inputs remain available for rerunning that exact ceremony.

Evidence: [capabilities](https://debug.thewilners.com/#shot=20261101T175249Z-armstrong-harmony-native-passkey-probe-38fc7bebba-04c2f263), [authentication failure](https://debug.thewilners.com/#shot=20261101T175454Z-armstrong-harmony-native-passkey-probe-d43875e00b-34f0e77a).

### 4. Public WebAuthn.io: registration and sign-in passed

At `https://webauthn.io/`, synthetic username **`harmony-probe-20261101-1804`** registered in Huawei Password Vault. The user confirmed the PIN ceremony. The page displayed “Success! Now try to authenticate...”. The subsequent authentication selected that account, the user confirmed, and the page displayed **“You're logged in!”**.

This independent website test required no local RP, native app, AGC change or website association from us. Evidence is the site's visible result and user confirmation; we did not capture its raw assertion or server logs. It does not test Google or Apple accounts, credential export, or Passless signing. The synthetic phone credential was retained.

Records: [structured result](../tools/agent-uhid-feasibility/controlled-rp/results/2026-11-01-harmony-public-webauthn.json), [registration evidence](https://debug.thewilners.com/#shot=20261101T180626Z-armstrong-harmony-public-webauthn-81df10fc86-d2513535), [sign-in evidence](https://debug.thewilners.com/#shot=20261101T180702Z-armstrong-harmony-public-webauthn-769fa35cfb-7820d102). Recorded in commit `8ccc41a`.

## Native website association: outstanding work

Huawei's [App Linking guide](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/app-linking-startupapp), updated 21 October 2026, describes website association and AGC domain publication. The proposed exact endpoint is `https://tv.thewilners.com/.well-known/applinking.json`:

```json
{"applinking":{"apps":[{"appIdentifier":"6918746563381217948"}]}}
```

The website file, native verified-domain declaration and portal configuration must agree. Applying this guide to the observed passkey error is an evidence-based diagnosis that still needs an authentication retest. Domain verification may take up to 24 hours according to the guide.

The China developer portal showed **实名认证已被驳回 — real-name verification rejected**, and directed the account to [overseas registration and verification](https://developer.huawei.com/consumer/en/doc/start/registration-and-verification-0000001053628148). Signing-profile issuance worked despite this project-level portal gate. Confirm the existing overseas account/project and app identity before further portal changes. [Portal evidence](https://debug.thewilners.com/#shot=20261101T180103Z-armstrong-harmony-native-passkey-probe-86cd703d65-8d36d6c0).

Prepared Nix work is in `nixos-amd`, branch `test/harmony-passkey-association`, commit **`6842f7c4`**, worktree `/home/jonathan/src/nixos-amd-passkey-association`. Module `modules/harmony-passkey-association.nix` is disabled by default and covers the exact endpoint on `tv.thewilners.com` and `netv-iptv-cloudflare-origin-local`. Only syntax validation is complete. Review concurrent Nix changes before integration; activation must use `nom-tmux` and `sudo armstrong-deploy-root switch`, followed by endpoint and device verification.

Publishing association means placing a small ownership/delegation file on our website and configuring the matching native app. It does not mean publishing the app in AppGallery. Ordinary browser use of Google, Apple or other sites does not require the user to publish such a file. Our domain cannot authorize our native app to act for Google or Apple domains. Their actual account policies and HarmonyOS compatibility remain untested.

## SDK findings and limits

The inspected API24/API26 public APIs expose RP operations through `@kit.OnlineAuthenticationKit`: capability queries, platform authenticator queries, registration and authentication. No third-party passkey-provider extension was found in the inspected APIs. The API26 DID `credentialProvider` terminology refers to digital identity, not demonstrated WebAuthn provider support. This is a bounded audit, not proof that Huawei has no private, partner or future interface.

Primary references checked for this investigation: [Huawei passkey API](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/api/onlineauthentication-passkey-api), [ArkTS passkey integration](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/onlineauthentication-passkey-arkts), and [W3C WebAuthn](https://www.w3.org/TR/webauthn-3/). See the proposal document for Android, hybrid and credential-exchange sources. Access date: 1 November 2026.

## Operational incidents and remaining housekeeping

- November screenshot directories had root-owned mode 0700, causing HTTP403 on developer-login QR captures. Ownership/mode were repaired for `/var/lib/debug-gallery/{screenshots,thumbnails}/2026/11`; origin HTTP200 and matching bytes were checked. A later QR expired before scanning; a fresh code was approved.
- Durable gallery fix: `nixos-amd` branch `fix/debug-gallery-month-permissions`, commit **`3180eaf1`**, isolated worktree `/home/jonathan/src/nixos-amd-gallery-permissions`; four tests passed and branch pushed. Integration/deployment remains outstanding.
- Temporary lab service is stopped. Test passkeys on the phone and the installed diagnostic app were not removed. Development certificate expiry requires attention before later signed builds.
- Do not copy private signing keys, tokens, GPG keys or authentication codes into documentation. Published screenshot evidence remains in the authenticated debug gallery.

## Acceptance still required

1. Prove the **same** Passless credential ID/public key works from all three platforms after a single registration. All current Harmony successes used Huawei-created credentials.
2. Choose and prove a Harmony signing integration from the five options. Finish native association only if native RP diagnostics remain useful; it does not close the provider gap.
3. Complete companion device enrollment, crypto, sync and lifecycle acceptance on an identified phone. Host tests and a rendered UI are separate evidence.
4. Inventory actual fleet credential profiles before enrollment. Backup eligibility, backup state and counter policy must remain consistent; existing YubiKey-style profile overrides may differ from configured backup defaults. Cosmetic hardware identity supplies no manufacturer attestation.
5. Test recovery, conflicts, deletion, device revocation, offline behavior and negative origin/challenge cases before production accounts. Then validate selected real services separately.
