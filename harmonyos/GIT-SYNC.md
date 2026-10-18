# Native Git sync assessment

The current companion has no Git transport, object database, index, ref update,
merge, authentication storage, or repository UI. Manual document export is not
Git sync. No native Git operation has been tested.

Huawei documents HTTP networking through Remote Communication Kit, including
native C/C++ GET support and ArkTS requests. These are transport primitives,
not Git protocol implementations:

- https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/remote-communication-netcom
- https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/remote-communication-getnetworkrequests-c-V13

A concrete implementation path is isomorphic-git with app-private native file
operations and an HTTPS smart-protocol transport adapter. The upstream library
explicitly supports supplied filesystem and HTTP implementations:

- https://github.com/isomorphic-git/isomorphic-git/blob/main/README.md
- https://isomorphic-git.org/docs/en/clone.html

This is an engineering gap, not evidence that HarmonyOS prohibits Git. The
existing document picker bridge is insufficient: it grants access to selected
files and does not implement repository filesystem semantics. Current CSP and
permission configuration intentionally permit no network access. A sync feature
must add a bounded native request bridge and INTERNET permission, use private
storage for repository data, implement authenticated transport without exposing
tokens to page content, and test atomic ref updates and failed pushes. HTTPS is
the first feasible transport; the fleet SSH remote would need an SSH client or
an explicitly configured HTTPS endpoint. A generic HTTP API cannot speak SSH.

Required acceptance: clone a synthetic repository, find inherited `.gpg-id`,
import every policy public key, edit and decrypt with three independent keys,
commit/push/fetch on two clients, reject divergence without overwriting remote
history, and recover from interrupted pack/index writes. Pin and audit the Git
library before shipping. No account token or real vault is needed for these
synthetic tests.

Device acceptance also remains gated on an identified connected target and a
bundle-specific Huawei signing profile. Host builds cannot establish ArkWeb
bridge, sandbox filesystem, TLS/authentication, or background lifecycle behavior.
System passkey-provider registration remains a separate unverified capability;
Git sync would not establish provider parity.
