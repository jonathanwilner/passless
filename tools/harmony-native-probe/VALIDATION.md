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
