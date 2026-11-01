# Validation status: 1 Nov 2026

Monaco's installed DevEco SDK 6.1.1.125 API 24 compiled the native diagnostic
app successfully, including server challenge injection and base64url padding.
The final build completed in 13.9 seconds. The build is tracked as
`build-harmony-native-probe` in the Armstrong feed at https://nix.thewilners.com.
This establishes SDK API/type compatibility; it does not establish runtime
support.

## Signing blocker

Huawei developer login completed after user approval. The authenticated CN
account differs from the international developer account that issued the
existing certificate valid through 17 Oct 2027. The CN account lists one
expired certificate: `xiaobai-debug-zeroport-20260926`, expired 11 Oct 2026.

The phone's UDID was registered under the dedicated name
`PasslessNativeProbeUltimate20261101`. Creating `Passless Native Probe 20261101`
failed with Huawei error `205389872`:
`[AppGalleryConnectProvisionService]certificate number exceeds limit.`

No existing certificate was revoked or replaced. No existing profile was
changed. No dedicated probe profile was issued, and no probe HAP was installed.
Continue with the international developer account that owns the valid
certificate, or explicitly authorize retiring the expired CN certificate.
Keys, authorization data, and the UDID remain outside this repository.

Real-device native capabilities, native registration, native origin, and
server-verified native authentication remain pending. Separately, the browser
lab successfully verified HTTPS registration and authentication on this phone;
see `harmonyos/VALIDATION.md` and the controlled-RP compatibility records.

## Evidence

The active Huawei developer QR was captured after asynchronous refresh
completed. The image differed from the old QR and its gallery origin returned
HTTP 200. The user approved the resulting sign-in.

https://debug.thewilners.com/#shot=20261101T174128Z-armstrong-harmony-native-passkey-probe-cd4ff3fd2e-8aa50662

An earlier capture raced the QR refresh and retained the old QR pixels. Future
runs must wait for the image data to change before capturing a refreshed code.
Do not reuse these expired login QR screenshots for another session.
