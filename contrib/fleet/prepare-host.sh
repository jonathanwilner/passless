#!/usr/bin/env bash
# Prepare host-local keys; never copy this host's private keys to another host.
set -euo pipefail
umask 077
state="${XDG_DATA_HOME:-$HOME/.local/share}/passless"
host="$(hostname -s)"
mkdir -p "$state/gnupg" "$state/public"
chmod 700 "$state" "$state/gnupg"
export GNUPGHOME="$state/gnupg"
fingerprint="$(gpg --batch --with-colons --list-secret-keys 2>/dev/null | awk -F: '$1=="fpr" { print $10; exit }')"
if [[ -z "$fingerprint" ]]; then
  # Host filesystem ownership protects this unattended software-authenticator key.
  # Human presence is enforced separately by Passless desktop approval/PIN.
  gpg --batch --pinentry-mode loopback --passphrase '' \
    --quick-generate-key "Passless fleet $host <passless-$host@localhost>" ed25519 cert 0
  fingerprint="$(gpg --batch --with-colons --list-secret-keys | awk -F: '$1=="fpr" { print $10; exit }')"
  gpg --batch --pinentry-mode loopback --passphrase '' --quick-add-key "$fingerprint" cv25519 encr 0
fi
gpg --batch --armor --export "$fingerprint" > "$state/public/$host.asc"
printf '%s\n' "$fingerprint" > "$state/public/$host.fingerprint"
if [[ ! -f "$state/store-sync" ]]; then
  ssh-keygen -q -t ed25519 -N '' -C "passless-store-$host" -f "$state/store-sync"
fi
cp "$state/store-sync.pub" "$state/public/$host.ssh.pub"
printf 'Prepared host-local encryption and repository keys for %s\n' "$host"
