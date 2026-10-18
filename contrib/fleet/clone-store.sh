#!/usr/bin/env bash
# Requires prepare-host.sh, enrolled public key, and repository deploy-key access.
# Fetch known_hosts from the authenticated GitHub /meta API before invocation.
set -euo pipefail
umask 077
state="${XDG_DATA_HOME:-$HOME/.local/share}/passless"
remote="${1:?Pass the private Git repository SSH URL}"
test -s "$state/known_hosts"
test -f "$state/store-sync"
export GIT_SSH_COMMAND="ssh -i $state/store-sync -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$state/known_hosts"
if [[ ! -d "$state/password-store/.git" ]]; then
  git clone "$remote" "$state/password-store"
fi
git -C "$state/password-store" config core.sshCommand "$GIT_SSH_COMMAND"
git -C "$state/password-store" config user.name "Passless $(hostname -s)"
git -C "$state/password-store" config user.email "passless-$(hostname -s)@localhost"
export GNUPGHOME="$state/gnupg"
gpg --batch --import "$state/password-store"/recipients/*.asc
awk '{ print $0 ":6:" }' "$state/password-store/.gpg-id" | gpg --batch --import-ownertrust
printf 'Encrypted store initialized on %s\n' "$(hostname -s)"
