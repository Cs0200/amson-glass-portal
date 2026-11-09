# Standalone Cloudflare backend setup

The two deployments are independent:

- `glassworks-project-portal-k7m3.frozenabbey4.chatgpt.site`: Sites-managed D1 and native sign-in.
- `ramson-glass.chandansaini469.workers.dev`: the owner's standalone Worker; needs its own Supabase database, authentication, and runtime configuration.

A successful Sites deployment does not configure the standalone Cloudflare account.

## Required secure account access

Connect Supabase to configure the project. Cloudflare deployment needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the execution environment's secret settings. Use an API token scoped to the intended account and Worker deployment. Never paste tokens into chat or commit them to the repository.

## Supabase provisioning

The RAMSON project has now been created and its initial schema, seed, and permission hardening applied. See `supabase/DEPLOYMENT.md` for the exact project and verified state. Do not reapply the initial schema to that project.


1. Use a new or explicitly selected Supabase project; inspect an existing project's tables before applying anything.
2. For a fresh project, apply `supabase/schema.sql`, then `supabase/seed.sql` and `supabase/production-hardening.sql`. The schema includes customer/admin roles, project creation, private file storage, customer records, manual purchases, and communications migrations. Do not rerun this initial schema over existing data.
3. For existing installations, inspect migration state and apply only missing migrations from `supabase/migrations/`.
4. In Supabase Auth, configure the actual Worker origin as the site URL and allow `/auth/callback` and `/auth/callback?next=/reset-password` on that origin. Configure email confirmation and SMTP as required.
5. Create and verify the owner's account normally, then grant admin status using the database administration connection. The application must not use a service-role key to bypass customer authorization.
6. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as Worker runtime secrets. A service-role key is not needed for ordinary sign-in.

## Build and deploy

Run from the checkout, with the required values supplied through secure environment settings:

```sh
node scripts/check-supabase.mjs
npx tsc --noEmit
npm run build
node scripts/prepare-cloudflare.mjs
```

The prepared config is `dist/server/wrangler.standalone.json`. It sets `HOSTING_MODE=standalone` so unsigned request headers cannot impersonate Sites users. It removes the Sites placeholder D1 binding, which does not identify a database in your Cloudflare account.

Configure the Supabase runtime values using Wrangler's secret input or the Cloudflare dashboard; do not put them in command arguments or source files. Then deploy the built Worker using the prepared config:

```sh
npx wrangler deploy --config dist/server/wrangler.standalone.json
```

The standalone portal uses the existing Supabase email/password customer/admin workflow. The D1 enquiry desk at `/operations` and Sites sign-in are available on the Sites deployment, not by copying trusted identity headers to an independent Worker.

## Verify before calling setup complete

- The deployed `/admin/login` no longer displays the database-setup notice.
- The verified owner can sign in and enter `/admin`.
- A normal customer cannot enter `/admin` or read another customer's projects/files.
- Enquiries and estimates survive refresh and appear in the correct admin/customer workspace.
- Confirmation and reset-password links return to the Worker origin.
- A private file can be uploaded and retrieved only by its project owner or admin.

`node scripts/check-supabase.mjs` is a read-only prerequisite check. It does not create a database, promote an admin, verify sign-in, or deploy the Worker.
