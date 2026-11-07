# RAMSON Glass — Customer & Admin Portal

RAMSON Glass, Ludhiana · +91 98764 50935 · alternate supplied number: +7888766533 (country code needs confirmation).

## What is implemented

- Responsive marketing site, service catalogue, service detail pages, inspiration gallery/lightbox, enquiry form, Ludhiana service-area map, and WhatsApp contact.
- Three-step estimator with material multipliers, dimensions, quantity, installation allowance, and server-authoritative saved pricing snapshots.
- Supabase email/password auth, confirmation callback, password recovery and update, cookie sessions, server-protected customer/admin pages.
- Customer-owned projects; admin lead/project management, starting rates and descriptions; revision and aftercare requests; status-change audit records.
- Private Supabase Storage uploads (JPG/PNG/WebP/PDF, 10 MB), short-lived signed download URLs, authenticated project QR links.
- Manual Razorpay/Stripe hosted payment links and printable project summaries (browser Save as PDF).
- Explicitly labeled sample workspace at `/demo`. No sample operation pretends to save to a backend.

## Runtime and deployment

This implementation uses Vinext's Next.js-compatible App Router, React, Tailwind CSS, and Supabase. Vinext is used to fit Sites' Cloudflare Workers hosting; it is a beta compatibility runtime, not a claim of identical Next.js support. The Supabase backend is independent of the frontend host. For a conventional Next.js/Vercel deployment, replace the Vinext scripts with Next scripts and run the complete auth/route test suite in that environment before launch.

```sh
npm install
cp .env.example .env
# Set SUPABASE_URL and SUPABASE_ANON_KEY locally; never use service_role in the app.
npm run dev
npx tsc --noEmit
npm run build
```

Hosted values belong in Sites runtime environment settings, not source control. The Sites preview is private to its owner; changing the audience is a separate launch action.

## Connect Supabase

1. Create a Supabase project. Execute `supabase/schema.sql` once in its SQL editor, then `supabase/seed.sql`. These files create tables, access policies, RPC pricing, storage policies and service records. Back up existing data first; this initial migration assumes a new project.
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to your project's URL and publishable/anon key. No service-role key is required by the application.
3. Configure Auth → URL Configuration with the actual application URL and permit `/auth/callback` and `/auth/callback?next=/reset-password` redirect URLs for local and deployed origins. Enable email confirmation, configure a trusted SMTP provider, and review rate limits.
4. Create and verify the owner account normally. Promote it ONLY from the SQL editor:
   `update public.profiles set is_admin=true where id=(select id from auth.users where email='YOUR_OWNER_EMAIL');`
5. Sign in and visit `/admin`. Replace all sample service rates before accepting customer estimates. Starter prices are illustrative, not RAMSON's commercial price list.
6. Test with two customer accounts and one admin using `tests/ACCEPTANCE.md`. SQL policies must be validated in the actual project before public launch.

## Product refinements

One project is the source of truth from first estimate through aftercare. Estimates remain provisional; saved pricing snapshots do not change when rates are edited. Only admins can set a final quote or move lifecycle state. Customer requests append messages instead of mutating approved terms. QR codes contain only the project URL and never bypass authorization. Private photos use expiring links. Customer IDs, project ownership and admin flags are checked on the server and through database policies.

## Launch dependencies and remaining work

The application is a deployable implementation with backend setup files, not a verified production launch. No Supabase project was supplied, so authentication, persistence, RLS and upload integration cannot yet be end-to-end verified.

- Replace sample prices, confirm GST/tax treatment, glass specifications, hardware rates and installation coverage with the business. Current finish choices are specifications only; no finish surcharge is applied. Add a full hardware/labour rate editor if required.
- Add abuse protection (CAPTCHA/rate limiting) to public lead inserts, signup and auth before public launch. Supabase public lead insertion currently accepts anonymous enquiries; it has field/status checks but no per-IP rate limiter.
- Configure transactional email and a retrying notification outbox for new enquiries/estimates. Contact submissions currently save to the database only and do not send email. CRM sync is not implemented.
- Add payment-provider integration and signed webhook verification for authoritative paid/refunded states. Manual payment links do not imply payment confirmation. No card data is handled.
- Add invoice numbering, line items, tax breakdown, immutable issued documents, quote version history and generated PDF invoices. Current print export is explicitly a project summary, not an invoice.
- Confirm the full street address, second phone number, branding, real portfolio images, credentials and consented testimonials. Imagery is labeled inspiration; no invented customer testimonials or credentials are shown.
- Add appointment slots, calendar integration, consent/retention policy, file malware scanning, backups, monitoring, accessibility audit and security review before production.

## Repository layout

- `app/portal.tsx`: customer and admin UI
- `app/[[...path]]/page.tsx`: server-side catalogue loading and route authorization
- `app/api/[...action]/route.ts`: validated backend operations
- `app/auth/callback/route.ts`: PKCE confirmation and recovery callback
- `lib/supabase.ts`: server-side cookie session client
- `supabase/schema.sql`, `supabase/seed.sql`: initial backend setup
- `tests/ACCEPTANCE.md`: required backend launch checks

The sample workspace is read-only demonstration data held in code. Unconfigured forms are disabled and APIs return 503; there is no localStorage authentication or fake persistence.
