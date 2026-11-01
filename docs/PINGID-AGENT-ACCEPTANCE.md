# HP PingID agent acceptance

Status: 1 November 2026. Initial live inspection on Goran; successful Passless authentication remains untested.

## Confirmed live observations

- Goran runs Passless 0.20.2. Its executable rejects `agent-admin`; the newer agent source is not this deployed binary.
- Passless and the teams-cli session-warming timer are active. The timer uses `session-warm --min-age-hours 6` with the live-control Chrome profile. Existing browser-session warming does not establish fresh authentication acceptance.
- `teams-cli whoami` resolved the expected HP account. A dedicated Chrome tab reached Teams using existing session state.
- A fresh Microsoft authorization request with `prompt=login`, a random state and PKCE challenge was used only to reach federation. No authorization code was exchanged or token store changed.
- Selecting the HP account led through `login.external.hp.com`. The HP sign-in page offered Windows Hello and an HP passkey enrollment link.
- Selecting Windows Hello reached `https://authenticator.pingone.com/pingid/ppm/pwdless/auth/start`, labelled Microsoft Office 365 and Authenticating with Biometrics.
- Reading the page's `publicKeyCredentialRequestOptions` yielded RP ID **pingone.com**, **userVerification=required**, **timeout=120000**, and an empty `allowCredentials` array. This is a discoverable-credential request, not a match to a known Passless credential.
- The loaded PingID JavaScript calls `isUserVerifyingPlatformAuthenticatorAvailable()` before calling its authentication helper. Its assertion request delegates to `navigator.credentials.get()`. Platform availability and assertion signing are separate integration gates.
- Goran's configured encrypted store had OpenAI credential files and no PingID RP directory. No keys were decrypted, imported, enrolled or removed in this inspection.

These findings come from live DOM/configuration and loaded JavaScript inspection. No screenshot-backed conclusion or server-side assertion acceptance is claimed. An attempted page-load observer did not survive CDP session disconnection; the request requirements above were read directly from PingID's current hidden options field instead.

## Required next steps

1. Complete existing HP authentication, then inspect the HP passkey registration ceremony. Record algorithm, attachment, discoverability, user verification and attestation requirements without persisting challenges or tokens.
2. Confirm whether HP accepts a software/agent credential. The authentication options alone do not establish enrollment policy. Do not weaken the RP request, fabricate biometric verification or hardware attestation, or infer that agent policy automatically satisfies HP policy.
3. Build and deploy an agent-capable Passless candidate with a narrowly scoped HP test profile. Preserve existing credentials and the normal user authenticator.
4. Enroll a clearly labelled Passless test credential only as part of the approved test workflow, retaining existing recovery methods. Registration requires authenticated account access.
5. Prove server-accepted authentication with that credential, then integrate teams-cli PKCE completion and verify the exact returned HP identity. Scope the broker to the observed RP/origin, account and credential; do not grant arbitrary PingOne tenant access.
6. Test renewal, cancellation, expiry and revocation on Goran before fleet rollout. Existing token validity is not evidence of successful passkey automation.

The user was asked to complete the existing passkey ceremony in the dedicated test tab. No existing tabs were closed, no logout occurred, and no production configuration was changed. The request may expire while awaiting user interaction; restart a bounded ceremony if needed.

## Existing credential confirmation

The user confirmed successful sign-in using the existing passkey. The dedicated tab subsequently reached Microsoft's `/common/wrongplace` page. This diagnostic request intentionally had no code-exchange consumer, so that landing page is not itself a failed PingID ceremony. No raw assertion or server logs were collected; user confirmation plus callback navigation is the acceptance evidence for the existing credential, not for Passless.

A second authorization request reused the newly established federation session and returned without a fresh passkey prompt. The earlier HP enrollment-link page could not be restored from browser history because it required form resubmission. The user was asked to open the authenticated HP passkey enrollment/device-management page. Registration policy and agent credential acceptance remain unknown. No new credential was registered.

## Separate HP enrollment route discovered in browser history

Goran's Chrome history identified the stable entry point **https://www.hp.com/passkey-enrollment**. Opening it in the dedicated live Chrome tab redirected to HP's PingOne DaVinci enrollment policy. The rendered DOM reported:

> DEVICE NOT SUPPORTED
> HP-Managed PC Required
> HP Passkey enrollment requires a HP-Managed PC with Windows Hello configured. Please switch to your HP-managed device and try again.

This rejection applies to this specific HP DaVinci entry point. The user clarified that the intended route is PingID device management. It does not establish that all PingID enrollment routes require a managed Windows PC. Registration policy and Passless acceptance remain unverified. Do not spoof managed-device status or hardware attestation.

History was inspected from a temporary copy because Chrome locked the live SQLite file; the original profile was not modified. Temporary history copies were removed automatically. This discovery supersedes the request for the user to locate the enrollment page.


## Correct PingID device management route

History also contained `https://authenticator.pingone.com/pingid/ppm/devices`. Opening it reached `https://authenticator.pingone.com/registration/devicespage`. The live page lists the existing Windows Hello, biometrics, email and mobile authentication methods and offers **+ Add**. Existing methods and their priority were preserved.

Selecting **+ Add** displayed **Authentication Required**: “This action requires you to authenticate with PingID.” Selecting Continue reached `/pingid/ppm/auth`, which displayed **Authenticated**. Enrollment choices and credential creation requirements still need inspection after the redirect completes. The earlier managed-Windows conclusion was too broad and is corrected above.


### Registration choices and requirements

After successful step-up, Add a New Device offered PingID Mobile Application, Yubikey, Biometrics and Email. Selecting Biometrics entered Biometrics Pairing. A metadata-only wrapper around `navigator.credentials.create` forwarded the original request unchanged and captured these requirements on Retry:

- RP: `pingone.com`, name `PingID Web Authentication`.
- Authenticator attachment: `platform`.
- User verification: `required`.
- Resident key: `preferred`; `requireResidentKey=false`.
- Attestation: `none`.
- Algorithms as supplied: `-7`, `-37`, `-257`.
- Timeout: 120000 ms. Two excluded credentials; no extensions.

The browser rejected the attempt with `NotAllowedError`: “The operation is not allowed at this time because the page does not have focus.” This is a browser focus failure, not evidence of server rejection or authenticator compatibility. No credential was created in this attempt. The observer recorded no challenge, credential ID, user ID, private key or assertion. Goran still needs an agent-capable Passless candidate and a focused enrollment test; platform attachment and required user verification remain acceptance gates.

## Goran candidate preparation

The flake now exposes an opt-in `passless-agent` package with the Cargo `agent` feature. The default package remains unchanged. Goran's candidate checkout is `/home/jonathan/src/passless-pingid-agent`; the build output link is `/home/jonathan/.local/state/passless-pingid-agent-result`. A separate Chromium package uses the same flake's pinned nixpkgs and is linked at `/home/jonathan/.local/state/passless-test-browser`.

The PingID request supplies COSE algorithm identifiers as decimal strings. The extension previously rejected those strings before contacting the daemon. The candidate normalizes valid integer strings and rejects malformed or out-of-range values. All 63 extension behavioral tests passed, including the added PingID regression and invalid-value cases.

The temporary acceptance profile uses the existing encrypted human backend, exact RP `pingone.com`, single-credential selection, a 1800-second session limit and 12-operation budget. Same-user registration is explicitly acknowledged and still requires a one-use registration grant. This profile is only for the HP acceptance test. PingOne hosts other tenants; before production, scope authentication to the enrolled credential reference and verify the returned HP identity. Registration must be disabled after enrollment.

Candidate configuration is under `~/.local/state/passless-pingid-test/config.toml`. Runtime activation uses a systemd user override under `/run/user/1000/systemd/user/passless.service.d/90-pingid-test.conf`; it does not replace Home Manager's persistent configuration. To restore the original service, remove only that test override, run `systemctl --user daemon-reload`, then `systemctl --user restart passless.service`. Preserve the audit and encrypted credentials. A successful build or extension test is not PingID enrollment or authentication acceptance.

## Live candidate result, 1 Nov 2026

The final ARM64 candidate at commit `87039d1` built successfully on Goran, including its Rust check phase. Output: `/nix/store/vx63qqmjwzs387ncqsv9g4kqam3ns82n-passless-0.20.2`. The dashboard records `build-passless-pingid-candidate` and `test-passless-pingid-extension` as succeeded with exit code 0. This establishes packaging and test success, not PingID acceptance.

The managed Chromium 155 browser loaded the extension. Goran requires its established user-namespace sandbox approach: `--disable-setuid-sandbox` and an AppArmor `userns` allowance for the exact Chromium binary. A temporary profile was loaded only for the test. No global sandbox relaxation was applied. `browser_scope = "profile"` avoided the initial request-thread parent-death problem. Session and grant TTL limits were aligned at 1800 seconds; registration grants retain their independent short limit. Restarting the candidate required stopping the service and moving its stale agent runtime directory before starting it again.

Live PingID evidence from DOM and browser API inspection:

- Native `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` returned false. The extension intercepts create/get but does not implement provider capability discovery.
- PingID rejected the existing platform method in the managed browser with “This browser doesn't support your current authentication method.”
- Existing authentication succeeded in normal Chrome. Transferring only the fresh PingID cookies and current enrollment URL in memory let the managed browser reach the authenticated Add a New Device screen.
- Normal Chrome offered Biometrics; the managed browser hid that option. The Yubikey option opened a separate button/tap pairing form and did not resolve the platform-provider issue.
- No one-use registration grant was issued and no new PingID credential was enrolled. Existing devices and priorities remain unchanged. Automatic HP renewal is unverified.

After this bounded test, the runtime systemd override was removed and the original Home Manager Passless service was restored and confirmed active. The temporary AppArmor profile was unloaded. Candidate outputs, configuration and audit data remain available for further development. The normal Chrome enrollment tab remains available.

Next implementation: add a read-only, authenticated provider-capability query through the extension broker and native daemon. Derive availability from the live lease, origin/RP policy and supported user-verification mode; preserve native availability and return false on unavailable/expired agent sessions. Do not hard-code a global true result or describe agent-derived verification as a human biometric. Test native fallback, expired sessions, denied origins and allowed profiles before rebuilding. Then repeat one-use enrollment and server-verified authentication, bind production access to the resulting HP credential, disable registration, and only then integrate teams-cli renewal.

## Provider discovery fix, 1 Nov 2026

Commit `0e88338` includes the managed Chrome provider discovery fix and its tests. The extension preserves native platform availability and otherwise queries the daemon through the authenticated native-messaging channel. The daemon checks the live grant, trusted browser origin, policy, audit health and remaining operation budget. Discovery neither signs an assertion nor consumes the signing budget. Agent-derived verification remains distinct from human biometric verification.

Validation:

- 68 extension behavioral tests passed, including native fallback, timeout, iframe denial and trusted-origin forwarding.
- 118 agent signing tests passed, including denied policy, human-only verification, expired/revoked grants and repeated discovery without consuming signing authority.
- The opt-in ARM64 Nix package built successfully on Goran. Output: `/nix/store/barxahhlmgvxysna833pnbvjzc8h1fzp-passless-0.20.2`.
- The canonical dashboard manifest records `test-passless-capabilities-js` on Armstrong and `build-passless-discovery-fixed` on Goran with exit code 0. An unauthenticated public manifest request returned HTTP 403; publication was verified in Armstrong's served manifest.
- In the live managed Chromium, the installed availability shim returned **true** at `https://authenticator.pingone.com` and **false** at `https://example.com`, which is outside the profile's RP policy.

The candidate was temporarily activated using the runtime override documented above. The earlier normal-Chrome enrollment tab had been closed. Direct entry to PingID device management returned an invalid-session error. A fresh HP federation request completed using existing authentication state, but did not create a new PingID device-management session. The user was asked to reopen the authenticated Add a New Device screen. Enrollment and server-accepted Passless authentication remain pending; no registration grant or new PingID credential was created by these checks.
