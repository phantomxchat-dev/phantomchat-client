# PhantomChat Client

Public client-side source for PhantomChat. This repository intentionally excludes server code, Cloudflare/Firebase deployment configuration, database rules and migrations, admin/Vault-X tools, secrets, and user/payment data.

## Important: this repository is not a complete hosted service by itself

The browser app still calls PhantomChat API routes for rooms, chat history, uploads, captcha verification, pairing, identity sync, inbox, contacts, ideas, Pro status, and payment checkout. Those APIs are deliberately not included here. To use the full app, deploy a separately reviewed backend implementing the expected routes, or deploy the client and backend together behind a same-origin `/api/*` proxy. A static build without a compatible backend will render, but API-dependent features will not work.

This release does not contain or alter production data, payment records, Pro entitlements, or live secrets. No deployment or payment was performed as part of preparing this client-only source.

## Development

Requirements: Node.js 20 or newer and npm.

```bash
npm install
# Create .env.local using the public client variables documented below.
npm run dev
```

Check the source and create the static build with:

```bash
npm run typecheck
npm run build
npm run preview
```

The build output is written to `dist/`. Configure the static host to serve `index.html` for app routes such as `/terminal`, `/room/:code`, `/globallobby`, `/inbox`, `/ideas`, `/friends`, `/faq`, and `/premium`. If the backend is hosted separately, configure CORS for the client origin and set the API base URL below.

## Client build configuration

Create a local `.env.local` file, or add these variables to the client build provider. `.env.local` is ignored by Git. Values prefixed with `VITE_` are compiled into browser-visible JavaScript and are **not secrets**.

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Optional backend origin, for example `https://api.example.com`; leave empty when `/api/*` is served from the same origin. Do not include credentials in the URL. |
| `VITE_FIREBASE_API_KEY` | Firebase Web SDK configuration value. Public in a browser app; restrict it where supported and use Firebase Security Rules. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase project auth domain. |
| `VITE_FIREBASE_DATABASE_URL` | Firebase Realtime Database URL used for realtime room and pairing flows. |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID. |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket name. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase project sender ID. |
| `VITE_FIREBASE_APP_ID` | Firebase web app ID. |
| `VITE_TURNSTILE_SITE_KEY` | Public Cloudflare Turnstile site key. |
| `VITE_HCAPTCHA_SITE_KEY` | Public hCaptcha site key. |
| `VITE_RECAPTCHA_SITE_KEY` | Public reCAPTCHA site key. |
| `VITE_DECOY_UNLOCK_CODE` | Optional convenience code for the calculator decoy flow. It is shipped to browsers and must not be treated as a security control. |

Example template (replace every placeholder locally; do not commit actual environment files):

```dotenv
VITE_API_BASE_URL=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_TURNSTILE_SITE_KEY=
VITE_HCAPTCHA_SITE_KEY=
VITE_RECAPTCHA_SITE_KEY=
VITE_DECOY_UNLOCK_CODE=
```

## Security boundaries

- This repository contains no admin console or client-to-admin endpoint logic. The public client is not an authorization boundary; access checks, payment fulfillment, Pro grants, captcha verification, moderation, and destructive operations must be enforced by the separately secured backend.
- Do not put private API keys, IPN signing secrets, Turnstile/reCAPTCHA/hCaptcha **secret** keys, admin passwords, session secrets, service-account credentials, or database credentials in any `VITE_*` variable. Keep them in the backend host's secret manager.
- Firebase Web API configuration and captcha **site** keys are designed to be browser-visible. Their exposure does not protect the project: configure strict Firebase Realtime Database/Storage rules, quotas, key restrictions where available, and server-side authorization before deployment.
- The database rules from the original project are deliberately absent. Do not recreate permissive rules to make the demo work.
- Check the final repository and generated `dist/` before making it public. Add no `.env*` files, credentials, real user/device records, payment logs, or production exports.

## License and third-party assets

No license grant is implied by this source snapshot. Review the original owner’s rights and all third-party dependencies/assets before choosing a public license or accepting outside contributions.
