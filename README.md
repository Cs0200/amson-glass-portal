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

## Service update — 8 November 2026

Glass Film is available in the catalogue and estimator. Drone Cleaning with Steam is announced on the home page, services page, and its dedicated `/services/drone-steam-cleaning` page as **Coming soon**. It cannot be estimated or booked. No launch date, operating certification or performance claim is implied.

For an existing database, run `supabase/migrations/20261108_glass_film.sql` to refresh film service wording without overwriting your prices. New databases use the updated seed file. Hosting remains on the existing private Sites deployment; no paid hosting plan or custom domain was purchased.

## Separate portals and customer records — 8 November 2026

- **Customer sign-in:** `/customer/login`; workspace: `/customer`; project: `/customer/project/[id]`.
- **Admin sign-in:** `/admin/login`; workspace: `/admin`; project: `/admin/project/[id]`.
- **Previews:** `/demo/customer` shows only the customer experience; `/demo/admin` shows the team experience. Both are clearly labeled and do not save changes.
- Legacy `/login`, `/projects`, `/project/[id]` and `/demo` links redirect to the appropriate entry points. The same Supabase identity system serves both portals; separation is enforced by server role checks and RLS, not just different page labels.
- Customer contact fields: full name, account email, phone, residential/commercial type, city, optional site address and postal code. Contact requests and estimates capture location. The profile stores the latest supplied contact details, while each project retains its site-location snapshot.
- Admin Customer Records: search and pagination, editable contact/location, related enquiries and projects, purchase history and contact audit history. Project details include messages, uploads, status history and project-linked purchases.
- Purchase records are **manual team records**, with order reference, date, description, total, amount paid, balance and optional linked project. They support historical purchases. Estimates do not become purchases automatically. Updating paid amounts does not charge a customer. Voiding does not issue a refund. Duplicate references per customer are rejected; all purchase changes are audited. Customers can read only their own purchase records and cannot change them.

### Database upgrade

For an existing installation that has already run the original schema, execute `supabase/migrations/20261108_customer_admin_portals.sql` **once**. For a new project, execute the updated `supabase/schema.sql` and `supabase/seed.sql`; the portal extension is already included in the schema, so do not run that migration again. The image/copy migrations are independent optional upgrades for older catalogues.

No Supabase project credentials were supplied. Database writes, identity roles, migration execution and real account isolation remain unverified until the owner connects Supabase. New screens explain this and offer separate customer/admin previews.

## Excel exports and customer messaging (8 November 2026)

Admin → **Messages & Excel** provides genuine `.xlsx` exports, immutable marketing drafts, audience review, explicit queue approval, sending in batches of five, and paginated delivery history. Customer records also have a single-customer export and consent controls. Customers control their own preferences in their portal. Excel includes five sheets: export metadata, customers, projects, purchases and enquiries. Export all numbered parts (250 customers each); large related datasets fail clearly rather than returning a partial file. Export a single customer when a batch exceeds the memory guard. Parts are live reads, not a database snapshot; avoid account creation/deletion while taking a multi-part export. Enquiries are linked by the customer's current account email; unmatched/old-email enquiries remain in the admin enquiries area.

### Database installation

- **Fresh Supabase project:** run `supabase/schema.sql`, then `supabase/seed.sql`. The schema already includes both migrations. Do not rerun them.
- **Existing initial project:** apply `supabase/migrations/20261108_customer_admin_portals.sql` once, then `supabase/migrations/20261108_communications.sql` once.
- **Already installed customer/admin records:** apply only `20261108_communications.sql`, once. Back up an existing database before migrations.
- Marketing and progress preferences default to false. Admin consent changes require evidence. Changed email/phone resets that channel's consent. Admin role provisioning remains a trusted SQL/database operation.

### Connect email and WhatsApp

1. Supply Supabase URL and anon key in server runtime settings. Create the owner account, then grant its profile `is_admin=true` through trusted SQL as described above.
2. Configure a Resend account with a verified sender/domain. Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and the webhook signing secret `RESEND_WEBHOOK_SECRET`.
3. Configure Meta WhatsApp Business Cloud API. Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, a supported `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_APP_SECRET` and a random `WHATSAPP_VERIFY_TOKEN`. Use E.164 customer phone numbers including `+` and country code.
4. Create an approved **body-only utility template** for progress updates with positional parameters: `{{1}}` customer name, `{{2}}` status, `{{3}}` project UUID. Set `WHATSAPP_PROGRESS_TEMPLATE` and matching `WHATSAPP_PROGRESS_LANGUAGE`. Example template: “Hello {{1}}, your RAMSON Glass project {{3}} is now {{2}}. Reply STOP to stop WhatsApp updates.” Marketing drafts require an approved **body-only marketing template**, the exact body text for review, matching language, and one parameter per line. Header/media/buttons and named parameters are not supported by this adapter. Template approval and category are managed in Meta; this app does not verify approval automatically.
5. Configure public callbacks at `/api/webhooks/email` and `/api/webhooks/whatsapp`. Resend events: `email.delivered`, `email.bounced`, `email.complained`, `email.failed`. Meta: messages (delivery statuses and inbound STOP). Webhooks verify signatures before using the server-only `SUPABASE_SERVICE_ROLE_KEY` to record receipts. Never put this key in browser code or send it in chat.
6. Set `PUBLIC_APP_URL` to the actual HTTPS origin. Test `/api/unsubscribe` publicly with a real generated test token. **The current Sites deployment is owner-private: external providers and email recipients cannot use its callbacks/unsubscribe links until public reachability is deliberately configured.** Preserve private access until ready; alternatively host this source on an appropriately configured public backend. Do not mark readiness merely because credentials exist.
7. After testing with explicitly consenting test contacts, set `PUBLIC_CALLBACKS_READY=true` and `MESSAGING_ENABLED=true`. Both providers must be configured for this release's send button. Credentials are server-side only. Hosting and provider quotas/prices are separate; free unlimited bulk messaging is not promised.

Marketing email has a one-click unsubscribe header and a confirmation page for normal link clicks. It disables only email marketing; progress preferences are retained. Bounces/complaints suppress all email to that destination. WhatsApp STOP/UNSUBSCRIBE/CANCEL suppresses WhatsApp marketing and progress. Suppressions are intentionally not automatically removed by checking an opt-in box; a trusted operator must investigate and record renewed consent before removing one in the database.

### Sending and tracking

A status change in an existing project creates an outbox entry for each enabled channel. In-portal project status/history remains available regardless of external preferences. External sends are **manual batches**, not a background scheduled job: click “Send next 5 queued messages” until the queue is processed. Each campaign targets one channel; create separate email and WhatsApp drafts to use both. Recipient eligibility is checked at draft review, queueing, claiming, and immediately before the provider request. Unsent campaign entries can be cancelled; in-flight or accepted messages cannot be recalled.

`accepted` is a provider acknowledgement, not confirmed delivery. Signed callbacks move records to `delivered`, `read` (WhatsApp when available), or `failed`. Callback event IDs are deduplicated. Network interruptions and server errors become `unknown`; interrupted claims become `unknown` on the next send request after 10 minutes. Unknown sends are not automatically retried. Inspect provider records before creating any replacement message. Resend uses the outbox UUID as its idempotency key. The app stores message bodies, recipient snapshots, provider IDs, status, and an admin audit trail; it does not track email opens/clicks or infer delivery without a receipt.

### Verification

Run `npx tsc --noEmit`, `node tests/communications.mjs`, and `node --experimental-strip-types tests/messaging.mjs` (Node 22.13+). PGlite executes the communications migration against a local PostgreSQL fixture and checks consent, admin denial, claims, delivery deduplication, unsubscribe, and status-trigger queueing. Workbook tests reopen the generated XLSX and check sheet structure, safe text and monetary cells. Provider tests use mock responses only; no messages are sent. Local browser QA verified the sample workbook download, email draft review and WhatsApp fields. Live Supabase auth/RLS integration, real provider delivery and public callbacks still require the accounts and runtime configuration above.

Provider references: [Resend send API](https://resend.com/docs/api-reference/emails/send-email), [Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests), [Meta template message example](https://www.postman.com/meta/whatsapp-business-platform/request/o65u5m5/send-message-template-text), [Meta signature-validation example](https://github.com/fbsamples/whatsapp-api-examples/blob/main/signature-validation-with-webhooks-payloads/app.py).
