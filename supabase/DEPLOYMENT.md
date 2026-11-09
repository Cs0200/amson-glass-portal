# RAMSON Supabase project

Project: `ramson-glass` (`zfiozkejiasyqoxuothf`), Mumbai region, created in Cs0200's Org at the quoted $0/month project cost. No paid upgrade was requested.

Dashboard: https://supabase.com/dashboard/project/zfiozkejiasyqoxuothf

## Installed and checked

- Initial portal schema: migration `20261109041357` / `ramson_initial_portal`.
- `production-hardening.sql` applied as `ramson_portal_permissions`.
- Six catalogue services seeded from `seed.sql`; prices remain indicative until the business approves them.
- Sixteen public tables, all with row-level security enabled.
- Private `project-files` bucket, 10 MB file limit.
- Anonymous callers cannot read customer profiles, call the estimate-creation RPC, or call internal profile triggers.
- Auth settings endpoint and public catalogue respond using the project's publishable key.

Publishable keys and service-role keys are not committed to this repository. Deployment runtime values must be set through the hosting provider's environment settings.

## Pending hosting/account work

The separate Worker at `https://ramson-glass.chandansaini469.workers.dev` is not connected just by creating this project. It requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` in its runtime configuration and a deployment using the standalone configuration. Cloudflare deployment access must be supplied through secure environment settings.

Supabase Auth URL Configuration must use that Worker origin as Site URL and allow its `/auth/callback` and `/auth/callback?next=/reset-password` URLs. Configure email delivery before using customer confirmation and password-reset emails commercially.

The business owner supplied an admin email privately. That user must first exist in Supabase Authentication before its profile can be promoted. The owner sets their password through Supabase's standard account flow. No custom privileged setup endpoint has been deployed.

Follow `../CLOUDFLARE-SETUP.md` and verify an actual admin login on the deployed Worker before marking setup complete.
