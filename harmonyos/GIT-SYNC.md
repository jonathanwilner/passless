# GitHub encrypted repository sync

The companion implements a GitHub-specific client for the private repository
`jonathanwilner/passless-store`, branch `main`. This is not a generic Git/SSH
client. No SSH deploy key or persistent GitHub sign-in is implemented.

## Data flow

1. Import an OpenPGP secret key and unlock it before connecting. Native document
   picking can background the app and clear the GitHub session.
2. Enter a fine-grained GitHub token scoped to this repository, with Contents
   read permission for browsing or Contents read/write for commits. The native
   bridge retains the token only in memory. Lock/background clears it and
   destroys the active HTTP request. The input is cleared after connecting.
3. Fetch pins a branch commit and its recursive Git tree. Truncated trees,
   traversal paths, non-regular files and oversized blobs fail closed.
4. Open a `.gpg` file. The client resolves the closest ancestor `.gpg-id` at
   that same tree, and loads public keys from `recipients/*.asc` at that tree.
5. Decrypt a password, edit, and choose Commit. Encryption preserves every
   original recipient key ID and includes all policy recipients. The new blob
   contains ciphertext. The client creates a tree based on the fetched tree,
   creates a single-parent commit, and updates `main` with `force:false`.
6. A changed head fails before writes. A concurrent divergent head causes the
   GitHub non-force ref update to fail. Fetch/reopen before retrying. Interrupted
   requests may leave unreferenced Git objects; a timeout after the final update
   is ambiguous, so inspect the remote before retrying.

The UI does not automatically merge conflicts, delete entries, create passkeys,
or update signature counters. Successful writes require another fetch before
editing again. The app keeps repository state in memory and provides no offline
repository cache. Public key fingerprints are authenticated by the trusted GitHub
repository and the original ciphertext recipient check; review initial policy
fingerprints through the fleet's separate provisioning process.

## Native transport boundary

`GitHubBridge.ets` constructs every URL below the fixed endpoint
`https://api.github.com/repos/jonathanwilner/passless-store/git/`. It accepts only
specific Git read/create routes and a non-force update of `refs/heads/main`.
Native tree updates accept exactly one regular `.gpg` path, rejecting policy,
public-key, directory and traversal writes.
The page cannot supply a host, URL, authentication header or branch. Redirects
are disabled with `maxRedirects:0`. The SDK declares this option since API23;
this app requires API24 or newer. HTTP caching is disabled, responses are
bounded to 4 MiB, and requests have connection/read timeouts. Error callbacks
contain only status codes, never server bodies or tokens. No credentials are
logged or persisted. The page CSP continues to forbid direct network access;
only the native bridge uses the INTERNET permission.

JavaScript/native managed strings cannot guarantee deterministic zeroization.
Session clearing is not hardware-backed credential custody. Device/runtime
acceptance remains pending for token clearing, TLS/redirect behavior and bridge
lifecycle. Host tests use a synthetic API model; they do not prove live writes
or Huawei networking behavior.

## API evidence and alternatives

Huawei's Chinese Network Kit documentation:
https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-http

Installed API26 declaration verified on Monaco on 18 Oct 2026:
`ets/api/@ohos.net.http.d.ts`: `maxRedirects` and `customMethod` are available
since API23. This implementation uses both; native SDK compilation validates
option types, while device testing must validate actual HTTP behavior.

GitHub documents raw Git object creation and non-force reference updates:
https://docs.github.com/en/rest/guides/using-the-rest-api-to-interact-with-your-git-database
https://docs.github.com/en/rest/git/refs

A future generic Git client could use isomorphic-git with native filesystem and
HTTP adapters, or a native Git implementation. These require repository storage,
pack/index handling, transport authentication and recovery tests. The upstream
library supports supplied filesystem and HTTP implementations:
https://github.com/isomorphic-git/isomorphic-git/blob/main/README.md

Git sync does not establish system passkey-provider capability. Provider
registration remains a separate unverified platform integration.
