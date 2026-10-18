# Dedicated encrypted fleet store

The private repository `jonathanwilner/passless-store` holds one logical set of
credentials, replicated to each enrolled host. Authentication uses the local
copy. Git synchronizes changes when the remote is reachable. Local approval or
PIN verification remains required; Git synchronization requires no approval.

Initial enrollment on 18 Oct 2026 covers Armstrong, Slazenger and Krickstein.
All three decrypted the same encrypted readiness file successfully. This proves
encryption interoperability, not browser registration or login acceptance.

## Files and access

- Store: `~/.local/share/passless/password-store`, with credentials under `fido2`.
- Host-local GnuPG keyring: `~/.local/share/passless/gnupg`.
- Host-local repository SSH key: `~/.local/share/passless/store-sync`.
- GitHub host keys: `~/.local/share/passless/known_hosts`, obtained from the
  authenticated GitHub `/meta` API.
- Shared public recipient keys: `recipients/*.asc`; recipients: `.gpg-id`.

Each host generates its own encryption key and repository deploy key. Private
keys never enter Git or the Nix store and are never copied between hosts.
Repository deploy keys grant access only to this private repository.
The dedicated state directory and GnuPG home have mode 0700. Local private keys
have no passphrase to support unattended synchronization and decryption. Host
filesystem access protects those keys; Passless separately requires local user
approval for authentication. This is software key storage.

`contrib/fleet/prepare-host.sh` prepares keys without modifying the normal GnuPG
home. Before running `clone-store.sh`, enroll the host's public encryption key
and repository deploy key, install verified GitHub host keys, and add the public
recipient to the store. These helpers do not automatically grant remote access.

## Synchronization policy

The fleet selects `security.constant_signature_counter = true` and
`security.enable_credential_backup = true` before creating any credentials.
This avoids per-login counter divergence and marks new credentials as eligible
for backup. Git network errors retain local operation and pending changes.
The explicit `GIT_SSH_COMMAND` selects the dedicated identity, uses batch mode,
checks the pinned host keys, and disables connection-master reuse.

Serialize registration, deletion, PIN changes and recipient changes across
hosts. Encrypted Git conflicts require explicit reconciliation. Never force
push or silently discard one encrypted version. Synchronize a newly registered
credential before trying it on another device.

Adding a recipient requires re-encrypting existing entries to the expanded
recipient set. Removing a recipient prevents future repository access only
after its deploy key is revoked; it cannot revoke copies already downloaded.
Re-register affected passkeys at their websites to revoke a lost device's copies.
Preserve an independently protected recovery copy before using these passkeys
as the sole login method. No production passkeys were created by provisioning.

## HarmonyOS status

The current companion preview imports and inspects encrypted files. See
`harmonyos/VALIDATION.md` for exact tested functionality and remaining native
Git synchronization, credential-provider, signing and device acceptance work.
