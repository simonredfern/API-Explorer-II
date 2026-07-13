# Onboarding Google OIDC login (API Explorer II — frontend / BFF side)

How to add **"Sign in with Google"** to API Explorer II. This is the
client/BFF half of the work; the OBP-API backend must be configured to accept
the resulting tokens — see the companion runbook
`GOOGLE_OIDC_ONBOARDING.md` in the OBP-API repo.

API Explorer II acts as an OIDC **relying party (RP)** running a server-side
(BFF) authorization-code + PKCE flow. It never exposes the client secret to the
browser. Google is just one more provider in the existing multi-provider
framework (`server/services/OAuth2ProviderFactory.ts`,
`OAuth2ProviderManager.ts`).

---

## 1. Prerequisites

- An OBP-API instance that advertises `google` at
  `GET /obp/v5.1.0/well-known` and is configured to validate Google id_tokens
  (`oauth2.oidc_provider` includes `google`, `oauth2.jwk_set.url` includes
  Google's JWKS, and `oauth2.google.allowed_audiences` lists this app's client
  ID). See the OBP-API runbook.
- A Google Cloud project with the OAuth consent screen configured.

## 2. Create Google OAuth credentials

In [Google Cloud Console](https://console.cloud.google.com/) →
**APIs & Services → Credentials → Create credentials → OAuth client ID**:

- Application type: **Web application**
- **Authorized redirect URI**: the BFF callback, exactly matching
  `VITE_OAUTH2_REDIRECT_URL`, e.g.
  - local: `http://localhost:5173/api/oauth2/callback`
  - prod: `https://<your-host>/api/oauth2/callback`

Note the generated **Client ID** (`...apps.googleusercontent.com`) and
**Client secret**.

> The Client ID you register here is the value the OBP-API operator must add to
> `oauth2.google.allowed_audiences`. Keep it consistent across environments, or
> register one client per environment and list them all on the backend.

## 3. Configure environment variables

The factory registers a `google` strategy **iff** `VITE_GOOGLE_CLIENT_ID` is
set (`server/services/OAuth2ProviderFactory.ts`). Add to your `.env`:

```bash
# Google OIDC
VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-google-client-secret

# Shared by all providers — must match the Google Authorized redirect URI exactly
VITE_OAUTH2_REDIRECT_URL=http://localhost:5173/api/oauth2/callback

# OBP-API host the BFF fetches /well-known from
VITE_OBP_API_HOST=http://localhost:8080
```

No code change is needed — `google` is already a recognized strategy. Scopes
are `openid profile email`.

## 4. How the flow works (what the code already does)

1. **Discovery** — on startup `OAuth2ProviderManager` calls OBP
   `/obp/v5.1.0/well-known`, gets the list of providers, and for each one it
   has a local strategy for, fetches that provider's
   `.well-known/openid-configuration`
   (`https://accounts.google.com/.well-known/openid-configuration` for Google).
   Providers advertised by OBP but **not** configured locally are skipped (not
   retried — config is read once at startup).
2. **Connect** — `GET /api/oauth2/connect?provider=google` generates PKCE +
   `state`, stores them in the session, and redirects to Google's
   `authorization_endpoint` with `scope=openid profile email`,
   `code_challenge_method=S256`.
3. **Callback** — `GET /api/oauth2/callback` validates `state`, exchanges the
   code (+ PKCE verifier) for tokens, and fetches userinfo using the **access
   token**.
4. **Token selection for OBP** — this is the Google-specific bit
   (`server/routes/oauth2.ts`). Google's access token is **opaque**
   (`ya29...`), not a JWT, but OBP-API requires a JWT Bearer. So the BFF stores
   the **`id_token`** in `session.clientConfig.oauth2.accessToken` when the
   access token is not a 3-part JWT. Providers that issue JWT access tokens
   (obp-oidc, Keycloak) are sent unchanged.

```ts
const isJwt = (token?: string) => !!token && token.split('.').length === 3
const obpAccessToken = isJwt(tokens.accessToken) ? tokens.accessToken : tokens.idToken
```

## 5. Verify

1. Restart the Explorer server; the logs should show
   `OK Google strategy loaded` and `OAuth2ProviderManager: OK google initialized`.
2. `curl http://localhost:5173/api/oauth2/providers` → `google` listed as
   `healthy`.
3. In the UI, click **Sign in with Google**, complete consent, and confirm you
   land back authenticated and OBP calls succeed (no `OBP-20214` / `OBP-20217` /
   `OBP-20218`).

## 6. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `google` not offered in UI | OBP `/well-known` doesn't list it, or `VITE_GOOGLE_CLIENT_ID` unset locally (provider skipped at startup) |
| `redirect_uri_mismatch` from Google | `VITE_OAUTH2_REDIRECT_URL` ≠ the Authorized redirect URI in Google Console |
| OBP `OBP-20214` (token not recognised) | BFF sent the opaque access token instead of the id_token — check the `isJwt` branch; or OBP's `oauth2.jwk_set.url` lacks Google's JWKS |
| OBP `OBP-20217` (audience not allowed) | This app's Client ID isn't in `oauth2.google.allowed_audiences` on OBP |
| OBP `OBP-20218` (provider not enabled) | `google` missing from `oauth2.oidc_provider` on OBP |

## 7. Known limitation / follow-up

The Google `id_token` stored for OBP calls is **short-lived (~1h)** and is
captured once at callback. `OAuth2ClientWithConfig.refreshTokens()` exists but
is **not** wired into the OBP request path, so Google-backed OBP calls will
start failing after the id_token expires even while the session looks valid.
Refreshing the id_token (using the stored refresh token) before it expires is
the main outstanding hardening item. Adding `nonce` to the auth request and
validating it on the id_token is a further hardening step.

---

**Related:** `../README.md` (OAuth2 multi-provider setup),
`server/routes/oauth2.ts`, `server/services/OAuth2ProviderFactory.ts`,
OBP-API `GOOGLE_OIDC_ONBOARDING.md` and `OAUTH2_IDENTITY_PROVIDERS.md`.
