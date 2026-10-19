# Synthetic attestation assets

These files support the `yubikey-5-nfc` emulation profile in
`cmd/passless/src/attestation.rs`.

- `yubikey-5-nfc-key.der` is a synthetic P-256 attestation key.
- `yubikey-5-nfc-cert.der` is a self-signed certificate for that key. Its
  subject is `C=SE, O=Yubico AB, OU=Authenticator Attestation, CN=YubiKey PIV
  Attestation`, and its `1.3.6.1.4.1.45724.1.1.4` extension contains the
  YubiKey 5 Series with NFC firmware 5.8 AAGUID.

This is not a Yubico key or certificate. It does not chain to a Yubico
attestation root. It exists only so the emulation profile can return a
well-formed `packed` attestation statement. Do not treat it as proof of
Yubico hardware.
