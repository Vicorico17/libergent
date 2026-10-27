# Cloudflare Git build settings

The production Worker serves the Next.js static export from `ui/out`. This generated directory is not committed. Running `npx wrangler deploy` on a fresh checkout without building the UI fails with an assets-directory-does-not-exist error.

In Cloudflare → Workers & Pages → libergent → Settings → Build, use:

- Root directory: repository root (`/`).
- Build command: `npm run build:ui && npm run verify:ui-auth-config`.
- Deploy command: `npx wrangler deploy --keep-vars`.
- Build variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, matching the existing production Supabase project.
- Node version: 22 or newer.

Alternatively, leave Build command empty and set Deploy command to `npm run deploy`. That script builds and verifies the UI before uploading it. Do not run both approaches together.

The UI install explicitly includes development dependencies even when NODE_ENV=production. Those dependencies are needed to compile TypeScript and run build tooling. Backend CI similarly needs development dependencies for PostgreSQL tests.

Cloudflare build variables are separate from Worker runtime secrets. Never use a Supabase service-role or secret key as a NEXT_PUBLIC variable. Do not commit ui/out or replace the assets path with an empty directory.

Cloudflare Workers Builds currently does not honor Wrangler custom-build settings; configure these commands in the dashboard. See https://developers.cloudflare.com/workers/ci-cd/builds/configuration/.

After saving, retry the failed build for the intended release commit. The API release is on feat/blana-storefront-api (PR #38); main does not yet include it. Deploying main would replace that release with older code.
