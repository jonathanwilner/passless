# Nix and NixOS

The flake exports `packages.<system>.default`, `overlays.default`,
`nixosModules.default`, and `homeManagerModules.default` for x86_64 and aarch64 Linux.
The package builds the human desktop authenticator, without the privileged agent
feature. Cargo dependencies and nixpkgs are pinned by lock files.

Add the fork as a flake input and use the same nixpkgs as your system:

```nix
inputs.passless.url = "github:jonathanwilner/passless";
inputs.passless.inputs.nixpkgs.follows = "nixpkgs";
```

Import the NixOS module on a Linux desktop and explicitly select trusted users:

```nix
imports = [ inputs.passless.nixosModules.default ];
services.passless = {
  enable = true;
  users = [ "alice" ];
};
```

The host module loads `uhid` and grants members of the `passless` group access to
`/dev/uhid`. This permits creating virtual HID devices. Select trusted users only.
A narrowly matched hidraw rule gives the active desktop session access to the
upstream human authenticator identity, USB `15d9:0a37`.
The module does not run a root daemon. Log out and back in after adding membership.

Import the Home Manager module for each selected user:

```nix
imports = [ inputs.passless.homeManagerModules.default ];
services.passless.enable = true;
```

The user service starts with `graphical-session.target`. A working desktop D-Bus
notification service is required for confirmation. The service explicitly uses
`PASSLESS_INTERACTION_MODE=desktop`; it never enables automatic approval.
Headless hosts can install the package without enabling the Home Manager service.

The default storage is the user's existing GPG-encrypted `~/.password-store`,
under `fido2`, using `gnupg-bin`. The service is skipped when neither the credential subdirectory nor its parent
store directories contain `.gpg-id`, avoiding restart loops.
After provisioning, run `systemctl --user restart passless.service`.
Initialize and unlock that store with the user's
existing key before starting Passless. These modules do not generate keys, enroll
credentials, copy stores between machines, or configure GPG agents. Configure the
user's normal GPG agent and pinentry separately. Keep private keys out of Nix.

Public settings can be overridden through `services.passless.settings`. TOML is
written into the world-readable Nix store: never include secrets. Automatic Git
synchronization is disabled by default to avoid changing existing store remotes;
set `services.passless.settings.pass.git_sync = true` only when the existing
store's sync policy allows it. Upstream storage behavior remains unchanged.

Validate the package using `nix build .#default` (through `nom-tmux` on managed
hosts). This builds the binary and runs core/config unit tests. A successful
build does not establish WebAuthn acceptance. Check `/dev/uhid` access after a
fresh login, start the user service, then perform a user-approved registration
and sign-in in the intended browser. Check the journal for storage or desktop
notification errors. This repository does not automatically register credentials
or run live authentication during a build.

## Readiness checks

Run these as the intended desktop user, inside that user's desktop session:

```sh
test -r "$HOME/.password-store/.gpg-id"
# List secret-key availability for each recipient. This does not export keys.
while IFS= read -r recipient; do
  [ -z "$recipient" ] || gpg --list-secret-keys -- "$recipient"
done < "$HOME/.password-store/.gpg-id"
test -r /dev/uhid && test -w /dev/uhid
busctl --user status org.freedesktop.Notifications
systemctl --user status passless.service
journalctl --user -u passless.service -n 30
```

Adjust the store path if configured differently. An unavailable recipient key
requires the user's approved key provisioning process. Listing a key does not
prove that its private material is available or that pinentry works; perform a
user-approved encrypted-store read before browser acceptance. Never print or
export the resulting credential. A missing store should remain unprovisioned
until its intended recipients and sync destination are selected.

## Dedicated replicated store

Use a dedicated GPG home without changing the user's general GPG environment:

```nix
services.passless = {
  enable = true;
  gnupgHome = "${config.home.homeDirectory}/.local/share/passless/gnupg";
  settings = {
    pass.store_path = "${config.home.homeDirectory}/.local/share/passless/password-store";
    pass.git_sync = true;
    security.constant_signature_counter = true;
    security.enable_credential_backup = true;
  };
};
```

`gnupgHome` applies to both the Home Manager CLI wrappers and the user service.
Provision the dedicated keyring and encrypted Git store separately, with approved
recipient keys and remote access. When running the readiness commands above,
export the configured `GNUPGHOME` and use the dedicated store path.

For replicated stores, select the counter and backup settings before enrolling
credentials. The constant counter returns zero and avoids rewriting a credential
on every assertion. The backup option marks new credentials backup-eligible;
existing credentials retain their original flag. These settings permit software
credential replication and do not provide hardware-backed key isolation.

Upstream pulls before a credential operation and commits/pushes changed encrypted
files afterward. Network failures are warnings and local authentication can
continue. Git is synchronization, not a distributed lock: simultaneous enrollment,
deletion, or PIN changes can diverge. Resolve conflicts explicitly and inspect
service logs before assuming all hosts have the latest credential state. Avoid
concurrent mutations of the same credential across offline hosts.

### YubiKey identity profiles

Two independent settings control how Passless appears to the host and to
relying parties:

- `services.passless.usbIdentity` controls the USB descriptors. The default is
  `passless` (VID `15d9`, PID `0a37`, name `Virtual FIDO2 Authenticator`).
  `yubikey-fido` uses Yubico's documented FIDO-only identity: VID `1050`, PID
  `0402`, name `YubiKey FIDO`.
- `services.passless.fidoProfile` controls the CTAP identity and attestation.
  The default is `passless`, which keeps the `fido.passless.rs` AAGUID, the
  Passless firmware version, and a `none` attestation statement.
  `yubikey-5-nfc` reports the published YubiKey 5 Series with NFC firmware 5.8
  AAGUID (`f4ce5fc0-57d3-46f5-a736-efb7d5bc63b5`), firmware version `0x050800`,
  `BE=0` in authenticator data, and a `packed` attestation statement.

For the closest YubiKey presentation, set both:

```nix
services.passless = {
  usbIdentity = "yubikey-fido";
  fidoProfile = "yubikey-5-nfc";
};
```

Restart Passless after changing either setting so the HID device and CTAP
identity are recreated. The equivalent environment variables are
`PASSLESS_USB_IDENTITY` and `PASSLESS_FIDO_PROFILE`. Debug builds continue to
honor `PASSLESS_TEST_VENDOR_ID` and `PASSLESS_TEST_PRODUCT_ID`.

The YubiKey profile is an emulation, not a YubiKey:

- The attestation key and certificate are synthetic. The certificate has a
  Yubico-like subject and the correct AAGUID extension, but it is self-signed
  and does not chain to a Yubico attestation root. A verifier that validates
  the attestation chain will not accept it as genuine hardware.
- The profile reports `BE=0` even when credential backup is enabled so the
  credential looks device-bound rather than synced.
- `hmac-secret`/PRF, `largeBlob`, `credBlob`, and FIDO 2.1 are not implemented.
  `authenticatorGetInfo` still reports `FIDO_2_0` and `credProtect` only.
- YubiKey OTP, smart-card, management interfaces, and vendor commands are not
  added.

Relying parties that classify authenticators from FIDO metadata may label the
credential as a YubiKey or a security key. Policies that require a genuine
hardware attestation chain can still reject it. Test the target service before
relying on this profile. Restore `fidoProfile = "passless"` and
`usbIdentity = "passless"`, then restart, to return to the original identity.
