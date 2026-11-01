# Validation status: 1 Nov 2026

Monaco's installed DevEco SDK 6.1.1.125 API 24 compiled the native diagnostic
app successfully, including server challenge injection and base64url padding.
The final build completed in 13.9 seconds. The build is tracked as
`build-harmony-native-probe` in the Armstrong feed at https://nix.thewilners.com.
This establishes SDK API/type compatibility; it does not establish runtime
support.

## Signing and installation

Huawei CN certificate creation initially failed with error `205389872`,
`certificate number exceeds limit`. After explicit user approval, the exact
expired certificate `xiaobai-debug-zeroport-20260926` was matched by name,
type, and expiry (11 Oct 2026 00:36:49 UTC). Its full metadata was saved locally
before retiring that certificate only. No other certificate or profile changed.

The dedicated `Passless Native Probe 20261101` certificate and single-device
profile were then issued for `com.thewilners.passless.probe` and registered target
`PasslessNativeProbeUltimate20261101`. The certificate expires 15 Nov 2026.
The HAP was signed, signature verification passed, and installation on the
physical device succeeded. Keys, authorization data, certificate metadata,
and the UDID remain outside this repository.

Signed HAP SHA-256:
`fb8fc4f54ed7d3189ba371c73646ce7ebd60c71714f2a1781bac7894d0a8e879`.
Signing was tracked as `sign-harmony-native-probe` with exit status zero.
The first launch returned `10106102` because the phone screen was locked.

## Physical-device runtime

After unlock, native API calls ran on the physical phone. The SDK declares a
Map capability result, while this runtime returns a plain object. The probe now
serializes both representations. Raw capability and ceremony records are in
`runtime-20261101.json`. The corrected build passed in 15.5 seconds and its
signed HAP SHA-256 is
`491ef242bd9f9101261869fe099b7aea95455c3178b23aea020a7e8aeab417fa`.

The device reports conditional create/get, hybrid transport, platform passkeys,
user-verifying platform authentication, largeBlob and authTypeList support.
Related origins and the three credential signal APIs report false.
`getPlatformAuthenticators` returns three entries: PIN (`uvm=4`) is available;
fingerprint (`uvm=2`) and face (`uvm=16`) are unavailable in current device state.
These capability reports do not establish every feature's end-to-end operation.

Native registration with a fresh challenge from the HTTPS lab succeeded at
17:53:15 UTC, about nine seconds after invocation. Native clientData origin is
`ohos:app-id:BFZ8bphwYXAdkE7VzPoVRVkN+MMi4FIny77pNojzGb289USZXOqcYbU4IzbKGTrf3aw96bui+BnLnY6aiN/Izd4`.
This matches the independently extracted uncompressed EC public key from the
signing certificate, base64 encoded without trailing padding, prefixed with
`ohos:app-id:`. Strict offline verification succeeded using the original server challenge,
RP ID, independently confirmed HAP signer leaf origin, and required user
verification. The packed attestation signature verified, userVerified was true,
and counter was 1. The browser verifier retained its exact HTTPS origin.

Native authentication returned `1021300003`, `System integrity check failed.`,
in 241 ms, without a user-verification prompt. The system FIDO service records
`Fido2Client: checkRpInAppLink fail` immediately before this code. This narrows
the failed check to RP/app association. A trusted App Linking association for
the controlled RP and signed probe remains the next native integration step.
No authentication assertion was produced. Browser HTTPS registration and
authentication on this phone have separately passed server verification.

## Evidence

The active Huawei developer QR was captured after asynchronous refresh
completed. The image differed from the old QR and its gallery origin returned
HTTP 200. The user approved the resulting sign-in.

https://debug.thewilners.com/#shot=20261101T174128Z-armstrong-harmony-native-passkey-probe-cd4ff3fd2e-8aa50662

An earlier capture raced the QR refresh and retained the old QR pixels. Future
runs must wait for the image data to change before capturing a refreshed code.
Do not reuse these expired login QR screenshots for another session.

Capability screenshot:
https://debug.thewilners.com/#shot=20261101T175249Z-armstrong-harmony-native-passkey-probe-38fc7bebba-04c2f263

Initial harness serialization discrepancy:
https://debug.thewilners.com/#shot=20261101T175144Z-armstrong-harmony-native-passkey-probe-050e506d89-ac4511b6

Native registration result and authentication failure:
https://debug.thewilners.com/#shot=20261101T175454Z-armstrong-harmony-native-passkey-probe-d43875e00b-34f0e77a

## Native RP association follow-up

The installed bundle reports `appIdentifier=6918746563381217948`. This is the
identifier required in App Linking domain JSON; it differs from the
certificate-derived native WebAuthn origin.

The probe manifest now declares a separate domain-verified HTTPS skill for
`tv.thewilners.com`, restricted to `passless-native-probe` paths so ordinary TV
links retain their existing behavior. The skill uses `entity.system.browsable`,
`ohos.want.action.viewData`, and `domainVerify: true`.

Huawei's [App Linking guide](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/app-linking-startupapp),
updated 21 Oct 2026, also requires the domain association file at
`https://tv.thewilners.com/.well-known/applinking.json` and domain publication in
the app's AppGallery Connect project. The file schema is:

```json
{"applinking":{"apps":[{"appIdentifier":"6918746563381217948"}]}}
```

The currently authenticated CN developer portal redirects to a real-name
verification rejection. Its stated reason directs this account to the overseas
registration and verification site. Debug certificate issuance succeeded, but
project-level App Linking publication is not established. No replacement app
identity or new account was created. The domain file also requires a separately
reviewed server configuration deployment. Manifest installation alone does not
establish a verified association, so no repeated authentication ceremony was run.

After both association gates are complete, inspect
`hdc shell hidumper -s AppDomainVerifyManager`, allow at least 20 seconds after
installation, and require a success record for this bundle/domain before a fresh
native authentication challenge. Huawei documents a possible 24-hour retry delay
following a failed domain check. The passkey-specific
[ArkTS guide](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/onlineauthentication-passkey-arkts)
continues to describe register/authenticate without detailing this runtime
association failure; the service log supplies the specific failed check.

The manifest update built in 13 seconds, passed HAP signature verification,
and installed successfully. Its signed HAP SHA-256 is
`5700ca028961e173c280f2e7ed891e6a96da4afe058d460b0040d25709d6475c`.
After installation, the domain manager reports:

```text
com.thewilners.passless.probe:
  appIdentifier:6918746563381217948
  domain verify status:
    https://tv.thewilners.com:client_error
```

This confirms the manifest now reaches domain validation. Association remains
incomplete. No additional passkey prompt or authentication attempt was triggered.
