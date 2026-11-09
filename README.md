# RAMSON Glass — Commercial Enquiry Portal

A live website and enquiry operations workspace for RAMSON Glass, serving Ludhiana and nearby areas in Punjab. Built with React, Vinext, Cloudflare Workers and D1, deployed through Sites.

## Live workflow

**Estimate → site visit → written quotation → customer approval → deposit record → installation.**

- Visitors submit a consultation request or an indicative estimate and receive a persistent reference and downloadable receipt.
- `/operations` is an owner-only enquiry desk: search, stage filters, pagination, follow-up dates, internal notes, activity history and CSV export.
- The owner issues a quotation with confirmed scope, subtotal, tax amount, deposit, expiry date and project-specific terms. Each version has a private random link.
- `/quotation/[token]` lets the intended recipient review, print/save PDF, and accept the current quotation. Replaced, expired and withdrawn quotes cannot be accepted. Accepted quotation details are preserved.
- After approval, the owner can record payments actually received elsewhere, with a unique transaction reference, and void errors with an audit reason. The website does **not** process charges, verify bank transfers, or issue refunds.
- `/my-requests` shows enquiries associated with the visitor's verified ChatGPT sign-in identity or email, and links to the latest proposal.
- `/privacy` and `/terms` explain actual enquiry data handling and the project workflow.

The existing Supabase customer/project implementation remains available when configured. Without Supabase, customer/admin entry points route to the working Site-native enquiry pages. No Supabase account is required for the enquiry and quotation workflow above. Live D1 records are not stored in GitHub.

## Access and secrets

Sites supplies verified sign-in headers. `app/chatgpt-auth.ts` handles native sign-in; never trust client-provided identity headers when hosting outside Sites. The owner workspace checks a server-only `RAMSON_OWNER_EMAIL` allowlist setting. Set it in Sites environment settings to the verified email of the business owner. It is never shipped in the browser bundle. Customer email is used to find their own guest enquiries after verified sign-in.

Private quotation links are bearer links: anyone who receives one can review and accept the quotation. Share them only with intended decision-makers. They have no search indexing, no-referrer, and private/no-store response headers. Quotation links are not payment links.

Runtime secrets belong in hosting environment settings, never in source. `.env.example` lists optional Supabase and messaging settings. No payment or email provider is enabled by default.

## Local development

```sh
npm install
npm run db:generate  # only after modifying db/schema.ts
npm run build
npx tsc --noEmit
node tests/booking-requests.mjs
node tests/communications.mjs
node --experimental-strip-types tests/messaging.mjs
```

The request integration test runs the production Worker in Miniflare with an isolated D1 database, applies all migrations, and tests requests, duplicate retries, owner authorization, customer isolation, optimistic concurrency, quotation versions/approval, manual payments/voids, exports, rate limiting and private caching. It does not send messages or process money. Test identity headers emulate the trusted Sites edge; they are not an independent authentication mechanism.

## Deployment

`.openai/hosting.json` retains the Site identity and the `DB` binding. The Site platform provisions D1 and applies the ordered schema-only SQL migrations in `drizzle/`. Applied migrations must never be rewritten. Build output is `dist/server/index.js` with client assets in `dist/client`.

The public website is hosted at:
https://glassworks-project-portal-k7m3.frozenabbey4.chatgpt.site

Source changes must be synchronized to the Site's source repository before packaging/saving/deploying a version. This GitHub repository is a source mirror, not an automatic deployment pipeline. Do not expose `.dev.vars`, local database state, credentials, or runtime enquiry records.

## Commercial configuration still needed

- Replace illustrative estimator rates with the business-approved price list. Until then, all online figures are explicitly planning estimates; quotations are entered by the owner after verification.
- Supply the legal business identity, full address, business email, and GST details where applicable. These are not invented. Current contact is the business-supplied phone number.
- Enter approved commercial terms for every quotation, including schedule, scope, payment milestones, cancellation/variation arrangements and any applicable warranty.
- Connect a payment provider if online collection and verified payment webhooks are required. Current ledger entries are manual records only.
- Connect an email/SMS/WhatsApp provider if automated notifications are required. Currently the team checks the enquiry desk and shares quotation links itself.
- Confirm retention and backup requirements and operational monitoring appropriate to the business. Browser visual QA requires the managed Sites preview/browser tooling, which was unavailable in this session.

## Other retained functionality

Service catalogue, inspiration gallery (not claimed as completed client work), estimator, Supabase project messages/files, customer records, manual purchase history and opt-in communications modules. Supabase-specific setup files are in `supabase/`; these features require their own backend setup and live integration verification before use.

## Standalone workers.dev deployment

See [CLOUDFLARE-SETUP.md](CLOUDFLARE-SETUP.md). The owner-hosted Worker is independent of Sites and needs its own Supabase configuration. `npm run backend:check` is read-only; `npm run build:cloudflare` refuses to build a release without responding Supabase Auth and a seeded catalogue. These commands do not provision a database or grant an admin role. Standalone hosting must not trust Sites identity headers.
