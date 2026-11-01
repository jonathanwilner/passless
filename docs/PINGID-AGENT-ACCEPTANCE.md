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
