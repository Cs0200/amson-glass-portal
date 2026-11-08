# Commercial enquiry workflow verification

- TypeScript compilation and production Worker build pass.
- `node tests/booking-requests.mjs` applies all schema migrations to isolated D1 and tests durable requests, server-calculated estimates, explicit consent, honeypot handling, ten-minute IP limits, idempotent retries, origin checks, owner-only access, customer isolation, stale-edit rejection, quote revisions, superseded-link denial, explicit quotation acceptance, accepted scope preservation, manual payment amounts/references, overpayment protection, void audit, spreadsheet-safe CSV export, and private/no-store/no-referrer/noindex quotation responses.
- `node tests/communications.mjs` checks the retained Supabase messaging SQL migration against a local PostgreSQL fixture, opt-in audiences, atomic claims, delivery deduplication, unsubscribe, contact resets and role guards.
- `node --experimental-strip-types tests/messaging.mjs` checks XLSX safety and mocked messaging-provider behavior; no messages sent.

The D1/Sites enquiry workflow works independently of Supabase. The separate legacy Supabase project-file/customer-record/communications features still require Supabase configuration and live integration checks.

Browser visual QA was unavailable because this environment had no managed Sites browser/preview tool. The API tests exercise the built production Worker and actual SQLite D1 implementation locally. They emulate the trusted Sites sign-in headers; production identity verification is performed by Sites dispatch.

No real payment was collected, no provider notification sent, and no sample customer data was written to the live database.
