# Five ways to complete cross-platform Passless

Proposal dated 1 November 2026. None of these options is claimed complete. Read the [evidence and implementation record](../HARMONYOS-PASSKEY-SYSTEM.md) first.

## Decision criteria

The preferred outcome is one credential with encrypted local copies, independent signing on Linux, Android and HarmonyOS, offline authentication, explicit user approval, and recoverable encrypted synchronization. A remote signer or physical key can provide the same credential with different availability and custody properties. Separate credentials for one account do not meet the literal same-passkey goal.

| Option | Where the key signs | Harmony coverage | Main unresolved gate | Fit |
|---|---|---|---|---|
| 1. Native providers and encrypted vault | Locally on each device | System-wide where provider APIs permit | Authorized Huawei provider interface | Best long-term fit; platform dependent |
| 2. Controlled browser integration | Locally in our trusted browser | Our browser only | Secure browser integration and origin enforcement | Local/offline, narrower coverage |
| 3. Standard hybrid authentication | Android or another nearby authenticator | Sites/browser flows offering cross-device sign-in | Real QR, tunnel and BLE interoperability | Same key, another device required |
| 4. Physical USB/NFC authenticator | One external authenticator | Compatible Harmony USB/NFC flows | Transport acceptance on this phone | Same key, external hardware required |
| 5. Remote Linux browser | Linux host | Remote browser session viewed on Harmony | Usable, isolated remote session and approval | Practical bridge; network dependent |

## 1. Native providers backed by an encrypted shared vault

Keep Linux UHID and build an Android provider using `CredentialProviderService`. Add a Harmony provider only after Huawei documents or authorizes the required integration. Each device decrypts an enrolled credential locally, obtains user approval and produces the WebAuthn assertion. Cloud storage holds ciphertext and synchronization metadata, not an online signing oracle.

[Android's official provider documentation](https://developer.android.com/identity/sign-in/credential-provider) supports third-party credential providers on Android 14 and later. Huawei's tested RP APIs do not establish equivalent provider support. The first Harmony gate is a minimal authorized provider that appears in credential selection and signs with an imported synthetic key. Stop treating this option as a system-wide Harmony solution if that gate fails.

Build work: shared credential format and crypto tests; device enrollment/recovery; Android service and biometric/device-authentication policy; consistent Linux import/export; conflict-safe encrypted synchronization; Harmony provider adapter if supported. Existing companion import/enrollment/GitHub code is a starting point, not accepted production custody.

Acceptance: register once, synchronize encrypted credential, independently authenticate offline from all three devices with identical credential ID/public key. Verify lock, cancellation, user verification, recovery and conflicts. This has the strongest goal fit and the largest vendor dependency.

## 2. A controlled Harmony browser with local Passless signing

Integrate a signer into a browser we control. The browser must supply and enforce the actual secure origin, RP-ID scope, frame policy and user activation at a trusted boundary. The vault unlock and signing approval must be outside page-controlled UI. Linux and Android can retain their native integrations and share the encrypted credential.

First gate: prove that available Harmony browser/ArkWeb APIs permit secure WebAuthn mediation, or establish the feasibility of maintaining the necessary browser engine integration. ArkWeb extension support and unrestricted WebAuthn interception are unproved. Page JavaScript monkey-patching is not a secure general-purpose provider design.

Build work: trusted browser integration, origin/RP checks, credential picker, UV handling, sandboxed signer, navigation/race protection, updates and isolation. This option serves websites inside that browser. Huawei Browser and arbitrary native apps remain outside its scope.

Acceptance: same-key authentication in the controlled browser; reject wrong origins, cross-origin frames without authorization, navigation during approval, replay, page-generated approval UI and locked-vault signing. Offline use is possible if local custody is accepted. Browser maintenance is substantial.

## 3. Standards-based hybrid cross-device authentication

Let Harmony display the website's cross-device QR flow. A nearby Android Passless authenticator holds the shared credential, confirms the request and signs through the standard hybrid transport. Linux remains an independent local client. The Harmony phone need not store the key.

[FIDO cross-device guidance](https://www.passkeycentral.org/launch-and-grow/troubleshooting-guidance/cross-device-sign-in) describes Bluetooth proximity as part of cross-device sign-in. A generic HTTP signing endpoint is not a replacement for the transport and proximity protocol. Android provider support alone does not establish that a custom provider can serve the required hybrid authenticator role.

First gate: a complete synthetic QR/BLE/tunnel ceremony using an existing interoperable authenticator, followed by the same ceremony with the Passless credential. Test the client and authenticator roles separately. The phone's reported `hybridTransport=true` is insufficient evidence.

Build work: supported authenticator integration or standards-conforming transport, QR validation, proximity, secure tunnel, cancellation, explicit approval and lifecycle cleanup. Keep production claims conditional on interoperability and platform permissions.

Acceptance: server verifies the same credential originally used on Linux; reject invalid QR, wrong RP, absent proximity and cancelled/expired requests. This can satisfy “one passkey usable from Harmony,” but Harmony depends on the nearby signer and does not have an independent local copy.

## 4. One physical USB/NFC FIDO2 authenticator

Use a portable security key across all three operating systems. This is an established FIDO model, described in [FIDO's passkey overview](https://fidoalliance.org/passkeys/). First test a supported physical key with this Harmony phone and browser, then Linux and Android, against the same synthetic RP.

Most ordinary security keys generate nonexportable credentials and do not import an existing Passless private key. Therefore this usually means registering a new credential on the physical key and using it everywhere, not migrating a software credential. A purpose-built import-capable authenticator/gateway is a separate engineering and security project. Linux UHID does not automatically expose a USB peripheral to a connected phone.

Build work: initially an acceptance harness and user workflow; only build a custom gateway if transport and custody requirements justify it. Verify USB host/peripheral roles, NFC support, PIN/user verification and browser transport selection.

Acceptance: one registration, same credential/public key on each platform; proper touch/PIN approval, unplug/cancel handling, and a lost-key recovery route. This avoids a Harmony software-provider dependency but adds physical hardware and does not provide cloud-synchronized local copies.

## 5. A remote Linux browser using Passless

Run the authenticated browser and Passless on a Linux host and access that browser from Harmony or Android through an authenticated remote session. Signing and website sessions remain on Linux. This gives access to the same credential without relying on Huawei provider APIs.

Build work: isolated per-user browser sessions, strong remote access authentication, visible signing requests, explicit approvals, session locking, reconnection, clipboard policy and narrow service exposure. Do not approve requests merely because a remote browser is connected.

Acceptance: a synthetic same-key sign-in viewed and controlled from Harmony; clean reconnect and lock behavior; no cross-session credential or cookie leakage; clear handling when Linux or the network is unavailable. This is a bridge for remote web use, not native mobile passkey integration or an offline local keychain. It conflicts with the preferred independence from an always-available central signer, so it is a fallback rather than the target design.

## Shared design requirements

### Credential semantics

Version the stored record. Preserve credential ID, RP ID, user handle, private/public key, algorithm, backup eligibility/state, counter policy, supported extension data and schema version. Do not invent a new credential ID when copying a credential. Validate imported key/public-key consistency.

Choose synchronized-credential counter and backup policy before enrollment. Backup eligibility must remain consistent with the original registration; inspect actual Passless profile behavior, including overrides. A constant counter can avoid competing device increments where supported, but service acceptance still needs testing. Do not fabricate user verification or hardware attestation. Apply [WebAuthn origin and RP requirements](https://www.w3.org/TR/webauthn-3/) at a trusted boundary.

### Encryption, enrollment and recovery

Use reviewed authenticated encryption and established libraries. Enroll a separate device wrapping/encryption key through authenticated approval and verified fingerprints. Keep private wrapping keys out of Git, the Nix store and cloud plaintext. Hardware-backed wrapping can protect exportable synchronized credentials; it does not make their underlying keys nonexportable across devices.

Keep the existing OpenPGP recipient policy while it is the active format. A new envelope format requires explicit migration and compatibility testing. Offer encrypted recovery with a tested restore procedure. Biometric/PIN unlock must accurately reflect the assurance reported in assertions.

### Synchronization and lifecycle

Git is an existing encrypted transport; object storage is an optional future transport, not a prerequisite. Use compare-and-swap revisions, explicit conflict handling, authenticated manifests and locally anchored revision state to detect rollback. Account for metadata leakage. Never silently overwrite credential or recipient conflicts, discard deletions, or force-push to conceal divergence. Define tombstones, crash recovery and key-rotation behavior.

A revoked cloud/device account cannot revoke private keys already downloaded. Removing a compromised credential requires RP-side revocation and new registration. Offline signing should remain available under the chosen local-unlock policy. Separate synchronization health from authentication availability.

### Acceptance sequence

1. Register one synthetic credential once; retain the server-side public key and credential ID.
2. Authenticate through Linux, Android and the selected Harmony path. Verify signatures, exact origins/RP IDs, challenge freshness, credential identity, UV, counters and backup flags.
3. Test wrong RP/origin, replay, locked vault, cancellation, expired requests and denied approval.
4. For copied credentials, test two-device concurrent changes, interrupted writes, deletion, new-device enrollment, recipient rotation, restore and cloud outage.
5. Only then test selected Google, Apple, HP and Microsoft account flows. Their policy or attestation requirements may differ; passing a demo site is not universal service acceptance.

## Recommendation and next decisions

Pursue **option 1 as the target**, with a firm Huawei provider feasibility gate. Continue shared vault and Android work independently of that gate. First complete a small end-to-end synthetic acceptance test for the existing companion's enrollment and encrypted read/write lifecycle.

Run bounded feasibility tests for **option 3 and option 4** to identify a useful Harmony path without assuming a provider API. Use **option 5** only when remote access meets the immediate need. Choose **option 2** only if its browser scope is acceptable and trusted integration is technically available.

Complete native association when useful for native RP diagnostics, while keeping it separate from the provider decision. Each implementation should have one owner for the vault/schema, one for platform integration and one for acceptance evidence; assign owners when implementation is authorized. No schedule estimate is reliable until the Harmony integration gate is resolved.

## Other possibilities and explicit limits

The [FIDO credential exchange specifications](https://fidoalliance.org/specifications-credential-exchange-specifications/) define work toward interoperable credential transfer. No Huawei Vault import/export path was demonstrated here. Treat exchange into Huawei Vault as a research dependency, not an implemented sixth architecture or automatic continuous synchronization. Verify specification version, vendor support, credential identity preservation and backup semantics before adopting it.

Registering separate credentials on one account is a useful recovery/fallback pattern, but it does not achieve the requested single credential. Existing Huawei Vault cloud behavior and exportability remain unknown. The five options above do not assume either capability.

Primary references accessed 1 November 2026. Platform capabilities and specification status must be rechecked before implementation.
