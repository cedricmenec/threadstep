# email-otp-authentication Specification

## Purpose

Defines the exclusive native Dexie Cloud email OTP sign-in journey, its
authenticated session lifecycle, safe failure and offline behavior, native
permission enforcement and the absence of authentication secrets or a custom
token backend.

## Requirements

### Requirement: Exclusive native email OTP sign-in

The application SHALL authenticate only through the native Dexie Cloud email
OTP flow with `requireAuth: true`. It MUST present only email and OTP entry and
MUST NOT offer password, OAuth, social provider, passkey or custom login, even
when the service exposes other providers.

#### Scenario: Only email and OTP are offered

- **GIVEN** a configured Dexie Cloud base without a valid session
- **WHEN** the sign-in journey is presented
- **THEN** the user can enter an email address and then an OTP
- **AND** no password, OAuth, social provider, passkey or custom login control is presented

#### Scenario: A valid email requests a native OTP

- **WHEN** the user submits an email address
- **THEN** Dexie Cloud is asked to send a one-time code to that address
- **AND** the journey asks the user for the received code
- **AND** no application authentication endpoint is called

#### Scenario: A valid OTP establishes the session

- **WHEN** the user submits a valid OTP
- **THEN** the native Dexie Cloud session becomes authenticated
- **AND** business access is enabled for that identity and its permissions

#### Scenario: Other native providers are not exposed

- **GIVEN** the Dexie Cloud service offers other authentication providers
- **WHEN** the sign-in journey is presented
- **THEN** only email and OTP remain available
- **AND** no alternative provider is selectable

### Requirement: Session reuse and expiry

The application SHALL reuse a valid Dexie Cloud session without requesting a
new OTP. An expired or invalid session SHALL require a new sign-in with an
understandable message and MUST NOT erase local history or business records.

#### Scenario: A valid session is reused

- **GIVEN** a valid authenticated session exists on this device
- **WHEN** the application starts
- **THEN** the session is reused
- **AND** no new OTP entry is required
- **AND** access follows the identity's permissions

#### Scenario: Reload after sign-in keeps the session

- **WHEN** the user reloads the application after a successful sign-in
- **THEN** the authenticated session is restored
- **AND** no unnecessary OTP is requested

#### Scenario: A valid session is reused offline

- **GIVEN** a valid authenticated session exists on this device
- **WHEN** the application is opened without a network connection
- **THEN** the session is reused without requesting a new OTP
- **AND** local access follows the native session and its permissions

#### Scenario: An expired session requires reauthentication

- **GIVEN** a previously authenticated session is no longer valid
- **WHEN** the user tries to access the application
- **THEN** the sign-in journey is presented again with an understandable message
- **AND** the historical document and local business records are unchanged

### Requirement: Invalid or expired OTP retry without data loss

When an OTP is invalid or expired, the application SHALL refuse authentication,
show a comprehensible error, allow a new code request and a retry, and MUST NOT
delete any historical or business data.

#### Scenario: An invalid code is refused

- **WHEN** the user submits an invalid OTP
- **THEN** authentication is refused and no authenticated session is established
- **AND** an understandable error is presented
- **AND** no historical or business data is deleted

#### Scenario: An expired code can be replaced

- **WHEN** the user submits an expired OTP
- **THEN** authentication is refused with an understandable expiry message
- **AND** the user can request a new code and retry

#### Scenario: A successful retry preserves existing data

- **GIVEN** an OTP attempt failed and the local data was preserved
- **WHEN** the user retries with a valid OTP
- **THEN** the session becomes authenticated
- **AND** the historical document and local business records remain available

### Requirement: No initial authentication while offline

Without a valid session, the application MUST NOT authenticate or grant business
access while offline. It SHALL state that the first authentication requires a
connection, MUST NOT simulate a successful session and MUST NOT bypass
`requireAuth: true`.

#### Scenario: First offline use needs a connection

- **GIVEN** no valid session exists on the device
- **WHEN** the application is opened offline
- **THEN** it states that initial authentication requires a connection
- **AND** no authenticated session is fabricated
- **AND** no business operation is enabled

#### Scenario: Offline attempts fail closed

- **WHEN** an authentication attempt cannot reach Dexie Cloud
- **THEN** the attempt does not produce a session or business access
- **AND** the application does not disable or bypass `requireAuth: true`
- **AND** existing local data is not deleted

### Requirement: Native identity, origin and permission enforcement

The application SHALL rely exclusively on Dexie Cloud's native identity, origin,
owner/realm and permission enforcement. It MUST NOT grant access after a refusal,
override or fabricate ownership, or allow one identity to read or modify another
identity's data.

#### Scenario: Another identity's data is not accessible

- **GIVEN** one identity owns or is a member of data in the base
- **WHEN** a different authenticated identity attempts to read or modify that data
- **THEN** Dexie Cloud's permissions prevent the access
- **AND** the application does not grant a fallback access
- **AND** the refused data remains unchanged

#### Scenario: An unauthorized origin is refused

- **GIVEN** the frontend origin is not authorized by the Dexie Cloud service
- **WHEN** the user attempts to authenticate
- **THEN** the refusal is presented with an understandable error
- **AND** no session or business access is fabricated
- **AND** no local data is deleted

#### Scenario: A permission refusal is not bypassed

- **WHEN** Dexie Cloud refuses an operation because of identity, origin or permissions
- **THEN** the application reports the refusal
- **AND** it does not retry with another identity or a privileged credential
- **AND** local history is preserved

### Requirement: No authentication secrets and no application auth backend

The application MUST NOT expose OTP codes, session tokens, CLI keys or privileged
credentials in the diagnostic DOM, logs, public documentation or delivered bundle.
Authentication and replication SHALL communicate directly with Dexie Cloud without
an application backend, custom token endpoint or `fetchTokens` override.

#### Scenario: Authentication surfaces expose no secret

- **WHEN** the sign-in or diagnostic surface is displayed
- **THEN** it shows only status, destination and non-secret identity information
- **AND** it never displays an OTP, session token, CLI key or privileged credential

#### Scenario: Logs, documentation and bundle stay secret-free

- **WHEN** the frontend sources, delivered bundle and public documentation are inspected
- **THEN** no OTP value, session token value, Dexie Cloud CLI key content or privileged credential value is present
- **AND** no machine secret or user instance URL is imposed by the build

#### Scenario: Authentication and replication are direct

- **WHEN** the user signs in or the base replicates
- **THEN** the browser communicates directly with Dexie Cloud
- **AND** no application backend, custom token endpoint or `fetchTokens` override is used
