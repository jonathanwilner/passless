# HarmonyOS passkey compatibility lab

This lab uses stock browser WebAuthn and server-side cryptographic verification.
It never injects an authenticator or claims that decrypting a vault proves passkey support.
Use synthetic accounts only. The server stores credentials and reports in memory;
restart clears the baseline. Bind to loopback and tunnel it; do not publish this lab.

## Run

Use Node 20 or newer. From this directory:

```sh
npm ci
npm test
node server.js
```

On managed fleet machines, run dependency installation and tests through `nom-tmux`.
The origin must stay `http://localhost:8443` on every device. Changing the port
changes the WebAuthn origin and is not supported by this harness.

Forward the same server to an emulator host, leaving SSH running:

```sh
ssh -N -o ExitOnForwardFailure=yes -R 8443:127.0.0.1:8443 dropshot.local
# Or, in a separate terminal:
ssh -p 2222 -N -o ExitOnForwardFailure=yes -R 8443:127.0.0.1:8443 monaco.local
```

On the emulator host, set HDC to the installed binary, list current targets,
then substitute that target (do not assume a saved emulator port):

```sh
hdc list targets
hdc -t TARGET rport tcp:8443 tcp:8443
hdc -t TARGET shell aa start -A ohos.want.action.viewData \
  -U 'http://localhost:8443/compatibility.html?device=dropshot-emulator' \
  -b com.huawei.hmos.browser
```

Dropshot HDC: `~/Library/Huawei/Sdk/HarmonyOS-26.0.0/openharmony/toolchains/hdc`.
Monaco HDC: `C:\Program Files\Huawei\DevEco Studio\sdk\default\openharmony\toolchains\hdc.exe`.
PowerShell invokes the quoted executable with `&`. Use `device=monaco-emulator`
for Monaco and distinct labels for Linux, Android, and real HarmonyOS devices.

## Acceptance

1. Inspect secure context, WebAuthn presence, platform-authenticator availability,
   conditional mediation, and client capabilities. An empty capabilities object
   is not proof of any supported transport.
2. Register a synthetic credential with Passless on Linux. Record the verified ID.
3. Without restarting the server or registering another credential, authenticate
   from each other device. Each successful signature must verify against the
   original registered public key and ID. Record the actual provider selected.
4. Test platform registration separately using a different synthetic user ID.
   Huawei-created credentials prove Huawei authentication, not Passless integration.
5. Test a QR/hybrid flow separately. Success proves use of the original credential
   through a remote authenticator; it does not prove local cloud-vault synchronization.
6. Save `curl http://localhost:8443/api/compatibility`. `observations` are untrusted
   browser messages. Only `verifiedEvents` originate from server verification.
   A label is operator-supplied, not device attestation.

Stop the server and SSH tunnels when finished. Remove only the forwarding rule
created for this lab using `hdc fport ls` and `hdc fport rm` with its exact task ID.
Do not remove unrelated forwards or restart emulator services.

## Measured 1 Nov 2026

Dropshot emulator: software `emulator 7.0.0.107(SP8DEVC00E47R1P3)`,
OpenHarmony build `7.0.0.105`, API26. HuaweiBrowser 5.1.9.315, ArkWeb7.0.0.105.
Secure localhost context and WebAuthn present. Platform authenticator availability
false; conditional mediation true; getClientCapabilities returned `{}`.
A user-clicked registration returned NotAllowedError immediately. No credential
was registered or authenticated. Physical-device results follow below.

Monaco emulator: OpenHarmony7.0.0.105 API26. Host loopback server reachable;
browser launch succeeded but no probe report arrived during the initial run.
This is an unresolved emulator transport/page-load result, not a WebAuthn failure.

## Chinese documentation and SDK audit

Reviewed the current official Chinese [通行密钥 (Passkeys) API reference](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/api/onlineauthentication-passkey-api)
on 1 Nov 2026. Page timestamp: 29 Aug 2026; includes API26 additions.
It documents local registration, local authentication, and 跨设备扫码认证
(cross-device QR authentication). The API is an application relying-party API.

Both installed SDKs expose `fido2.getClientCapabilities`,
`getPlatformAuthenticators`, `register`, and `authenticate` via
`@kit.OnlineAuthenticationKit`. Dropshot SDK26.0.0.23 Beta1/API26;
Monaco default SDK6.1.1.125/API24. Searches of their public ETS APIs found no
passkey credential-provider extension. The `credentialProvider` field in API26
DID APIs is for digital identity credentials, not a passkey-provider interface.
Absence in these audited APIs is not proof that Huawei has no private/future API.

Native follow-up should call the first two methods and serialize Map entries
explicitly. Preserve device-type error801 and service-connection error1021300011.
A native probe has now been built, signed, and installed on the physical phone
under `tools/harmony-native-probe`; launch awaits an unlocked screen. Its
`VALIDATION.md` records the current native status. The browser result does
not substitute for that native test. One shared Passless credential across all
three operating systems remains unproven until the acceptance sequence succeeds.

## Real device test, 1 Nov 2026

LAP-AL10 at the user-provided wireless-debug address, HarmonyOS
7.0.0.111(SP12C14E111R6P4), HuaweiBrowser6.1.9.323/ArkWeb7.0.0.111:

- Secure context, WebAuthn, platform authenticator, conditional mediation, and
  hybrid transport all reported available.
- Huawei Password Vault offered to create the synthetic `testuser` credential.
  The user confirmed on the phone. The server verified registration at
  17:21:53 UTC, userVerified=true, counter=1, credentialDeviceType=singleDevice,
  credentialBackedUp=false. This describes the returned WebAuthn flags, not an
  independent audit of Huawei storage or backup behavior.
- Initial authentication returned NotAllowedError. The user saw a PIN prompt
  and a timeout in the log. No localhost authentication signature was verified.
- Extended the browser lab operation timeout to three minutes for manual PIN
  entry. Server challenges already expire after five minutes.
- HDC commands subsequently stalled although the TCP debugging port remained
  reachable. Unlocking the phone restored command responses.

This is a Huawei-created credential. Shared Passless credentials, cloud sync,
QR authentication, and native-provider integration are still unverified.

After unlocking, a fresh page with the three-minute timeout returned
NotAllowedError approximately0.3 seconds after credentials.get(). The user
confirmed no prompt appeared. A discoverable request without a user-specific
allow list also failed in approximately0.3 seconds. The root cause is unresolved;
this is not evidence of an elapsed three-minute timeout. Test a normal HTTPS
relying-party domain and native APIs next before attributing it to the platform.

Use `?discoverable=1#btnAuthenticate` to repeat the discoverable case. Standard
mode uses the original registered credential allow list. The synthetic credential
remains in Huawei Password Vault under localhost/testuser; server state is temporary.

## HTTPS physical-device acceptance, 1 Nov 2026

The same LAP-AL10 completed both registration and sign-in on
`https://tv.thewilners.com:8443`, RP ID `tv.thewilners.com`:

- Registration verified at 17:36:20 UTC, authentication verified at 17:37:01 UTC.
- Both operations used credential `bt4Ex_dKi8wtrLORTKGdAQ75-IsTd90IsrHQsZRMRKM`.
- Server validation confirmed the expected origin, RP ID, challenge, and signature.
  User verification was true. The authenticator counter advanced from 1 to 2.
- Returned flags were singleDevice and credentialBackedUp=false. These flags do
  not establish Huawei cloud backup behavior independently.
- Evidence: `results/2026-11-01-harmony-real-https.json` contains synthetic browser
  observations separately from server-verified events.
- [Phone test screen](https://debug.thewilners.com/#shot=20261101T173726Z-armstrong-harmony-passkey-compatibility-d8062d9ddc-d21c581d).
  The server report is the cryptographic acceptance evidence.

Normal HTTPS resolved this test failure. The earlier localhost failure's exact
internal cause remains unknown. This success demonstrates Huawei Password Vault
registration and authentication. It does not demonstrate shared Passless storage,
credential export, Android/Linux reuse, or third-party provider registration.
The native diagnostic lane is maintained separately under `tools/harmony-native-probe`.

### Isolated HTTPS lab

The server accepts `RP_ID` and `RP_ORIGIN`. For a non-localhost RP, the origin must
be HTTPS with the exact RP hostname. Non-loopback listening requires `LAB_TOKEN`,
`TLS_CERT`, and `TLS_KEY`. Requests need either a secure HttpOnly SameSite cookie
issued by `/enter?token=...`, or `Authorization: Bearer ...`. Foreign Origin headers
are rejected. JSON request bodies are limited to 64 KiB. No permissive CORS header
is emitted. Keep tokens out of source, evidence reports, and public links.

For this run, existing LAN DNS resolved `tv.thewilners.com` to Armstrong
192.168.2.120. Its existing ACME certificate covers this hostname and expires
7 Jan 2027. A separate temporary server used port8443; the television services,
Cloudflare routes, DNS, and fleet configurations were unchanged. The server read
the certificate, dropped supplementary groups and root privileges, then listened
as the normal user. `LAB_UID` and `LAB_GID` support this privilege drop. The TLS
private key remains on Armstrong and is never copied to the phone or repository.

This remains an ephemeral diagnostic lab. Stop it after the native/browser run;
server credentials and challenges disappear. Synthetic phone credentials may
remain in Password Vault under tv.thewilners.com/testuser. The standard local
workflow still defaults to localhost:8443. Run `npm test` for all tests; this
change passes 44 tests, including remote-access and origin guards.

## Native physical-device result, 1 Nov 2026

The signed diagnostic HAP registered a credential successfully. Offline validation
using the original server challenge, RP ID, user verification, and the origin
derived from the verified HAP signer passed. See
`results/2026-11-01-harmony-native-registration.json`. The credential is separate
from the browser test credential. `verify-native-registration.mjs` reproduces
validation with the original options, response, and independently verified HAP
certificate chain. The chain is supplied by the operator, not trusted from the
client response. This does not change the browser server's origin policy.

Native authentication failed before a prompt with error 1021300003 in 241 ms.
The specific service log is `Fido2Client: checkRpInAppLink fail`. This identifies
an app-to-RP association check as the current boundary. No native assertion or
shared Passless credential has yet been verified.

### Remaining association gate

The CN developer portal reports real-name verification rejected and directs the
account owner to Huawei's overseas developer site. The installed debug app has
appIdentifier `6918746563381217948`. Complete the account and app/domain setup
before retrying native authentication. A disabled-by-default Nix association
module is prepared on `nixos-amd` branch `test/harmony-passkey-association`,
commit `6842f7c4`; it has passed syntax validation but is not deployed.
The separate HTTPS diagnostic server was stopped after collecting evidence.
The synthetic phone credentials remain; no production credentials were changed.
