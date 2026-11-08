# Backend acceptance checklist (requires a configured Supabase project)

1. Sign up customer A and customer B. Verify email confirmation, successful login, persistent cookie session, sign-out, recovery email and password update. Invalid/expired callback must show the login screen; use a fresh recovery link.
2. Anonymous `/admin`, `/project/<uuid>` and `/projects` requests redirect to `/login`. Customer A cannot access admin operations or promote their own `profiles.is_admin` via REST.
3. Customer A creates an estimate. Check database total against width × height × quantity × saved service rate × material multiplier + 1500 × quantity. Altering client estimate total must not affect the stored total. Out-of-bounds numbers and unsupported material/finish must fail even through direct RPC calls.
4. Customer B requests A's project, messages, file metadata and storage URLs directly. All must be unavailable under RLS. QR scan by B must not expose A's project. Anonymous scans must require login.
5. Admin edits rates and service description. New estimates use changed rates. Old projects retain their pricing snapshot. Admin approves quote and updates stage; project_events records the actor and transition.
6. Customer posts a revision request and aftercare request. Admin can view them. Another customer cannot read or append messages to that project.
7. Upload permitted image/PDF under 10 MB and download by signed URL. Reject oversize/disallowed types, unauthorized project paths and unauthorized file reads. Signed URLs must expire.
8. Contact enquiry is saved once; UI only reports success after database confirmation. Invalid inputs fail. A notification is NOT claimed until a real email outbox is implemented.
9. Only admin can set a Razorpay/Stripe payment link. Reject other schemes/hosts. Do not mark a project as paid just because a link was opened.
10. Exercise phone and tablet layouts, keyboard navigation, forms, error messages, gallery close, status filtering, QR link copy and print-to-PDF output.
11. With Supabase variables absent, API writes return 503; no fake success is shown. Sample dashboard is clearly labeled and no sample mutation persists.
12. Before public launch enable and verify CAPTCHA/rate limits, monitoring, backups and the integrations listed in README.

## Separate portals and customer ledger

13. Apply the portal migration once (or use the updated full schema for a fresh database). Sign up two customers and promote a separate staff account through SQL only. Customer login must route to `/customer`; staff login must route to `/admin`. A customer signing in through `/admin/login` receives an explicit access-denied response and no admin session. Direct admin pages and all customer-directory/ledger-write APIs must enforce admin status.
14. Create projects and purchases for customer A. As customer B, query `/api/customer/A`, `/api/customers`, direct Supabase purchases, project-linked purchases, customer_events and purchase_events. Directory/admin audit endpoints must deny access; database policies must never expose another customer's rows. As A, attempts to create/update/void purchases or change `profiles.is_admin` must fail.
15. Save contact location in an estimate. Verify project snapshot and customer profile values. Change profile city/phone; old project location must remain intact and customer_events must retain old/new values. Verify email confirmation changes synchronize the directory email.
16. Record a purchase linked to the correct customer's project. Linking another customer's project must fail at the database trigger. Reject duplicate references, negative amounts, paid amount exceeding total and voiding without a reason. Update paid amount, then void: every change must appear in purchase_events; a voided record must remain visible and immutable.
17. Confirm estimates and approved quotations do not appear in purchase history automatically. Confirm manual payment entries never claim provider verification and never trigger a financial transaction.
18. Test customer-directory search, every paginated section, the customer profile form, and separate demo navigation. The customer demo must not expose admin controls. Contact and estimate forms require city and project type; no consultation CTA includes “free”.
