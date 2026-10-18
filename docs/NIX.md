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
under `fido2`, using `gnupg-bin`. The service is skipped when the store has no `.gpg-id`, avoiding restart loops.
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
