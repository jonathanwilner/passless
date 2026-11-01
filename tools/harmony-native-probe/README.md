# HarmonyOS native passkey diagnostic


See the [consolidated evidence and system plan](../../docs/HARMONYOS-PASSKEY-SYSTEM.md). Native RP success and credential-provider support are separate acceptance gates.

This isolated ArkTS app calls Huawei OnlineAuthenticationKit `fido2` directly.
Bundle: `com.thewilners.passless.probe`. It does not change the Passless companion
or install a credential provider.

It queries `getClientCapabilities` and `getPlatformAuthenticators` on launch.
The UI has explicit registration and authentication buttons. Operations preserve
native error codes and elapsed time. Capability Maps are serialized entry by
entry. The app records JSONL in its private `files/native-probe.jsonl` and emits
`PASSLESS_NATIVE` log lines.

The default RP is `tv.thewilners.com`. The default synthetic account is
`native-testuser`. Without injected server options, the app generates a random
32-byte challenge. Such responses are diagnostic and **not server verified**.
The most recently created credential is retained only in app memory, allowing
an explicit allow-list authentication. After restart, authentication uses
an empty allow list for discoverable selection. Credentials created by the
system remain in Huawei Password Vault until removed by the user.

## Build and sign on Monaco

Copy this directory to `C:\Users\jonathan\src\passless-native-probe`, then run
`build-monaco.ps1` through `nom-tmux`. It uses the installed DevEco Studio SDK
(API24), without changing SDK or emulator files. The output is
`entry\build\default\outputs\default\entry-default-unsigned.hap`.

Real-device installation requires a Huawei-issued debug profile for this exact
bundle and the target device UDID. Never reuse another app's profile. Keep keys,
passwords, authorization tokens, certificates, and profiles outside this tree.
The fleet's `scripts/harmony-refresh-huawei-debug-profile.mjs` and
`scripts/harmony-sign-hap-monaco.cjs` support the existing Monaco protected key.
The Huawei developer session must be current before creating a profile.

Install only after coordinating phone UI access:

```powershell
& $hdc -t '192.168.84.138:35891' install '<signed.hap>'
& $hdc -t '192.168.84.138:35891' shell aa start -a EntryAbility -b com.thewilners.passless.probe
```

Do not restart the shared HDC server. Capture and publish screen evidence using
the fleet's `debug-shot` workflow. Collect bounded hilog output and app logs
without clearing unrelated logs.

## Server challenge injection

To connect an external synthetic RP, request an operation-specific challenge
from that server and base64-encode this JSON object:

```json
{"operation":"register","challenge":"<base64url>","rpId":"tv.thewilners.com","userId":"<base64url synthetic user ID>","session_id":"<server session>"}
```

Pass the encoded JSON to `aa start` as `--ps probeRequest BASE64`. The app consumes
the request once when its matching visible button is pressed. It rejects an RP
or operation mismatch. Use `authenticate` for an authentication challenge.
Preserve the reported session ID and send the returned credential JSON to the
server's finish endpoint. Convert native `clientDataJson` to WebAuthn's
`clientDataJSON`, and null extension results to `{}`. Normalize base64 fields
to base64url if the SDK returns standard base64.

Inspect the signed client-data origin first. Configure only that exact native
origin on the RP after reviewing the app identity. Never disable origin
validation or accept arbitrary origins. This probe does not assume an Android
origin format for HarmonyOS. Native RP success alone does not establish a
third-party passkey provider or cross-platform key synchronization.

Official Chinese API reference:
https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/api/onlineauthentication-passkey-api
