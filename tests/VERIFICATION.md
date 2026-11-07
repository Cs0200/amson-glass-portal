# Verification performed

- TypeScript: `npx tsc --noEmit` passed.
- Production Worker build: Sites build helper passed for all five build stages.
- HTTP smoke checks passed: home, catalogue, service detail, estimate and sample workspace return 200; anonymous admin/project/customer pages return 307 to login; missing route returns 404; project API returns 401; unconfigured contact API returns 503; cross-origin write returns 403.
- Browser: selected railings, changed width to 10 ft with 7 ft height, selected frosted glass; preview updated to ₹73,950 (70 × ₹900 × 1.15 + ₹1,500). Final save is disabled with a clear setup notice.
- Browser: sample Approved filter reduced three rows to one; project detail opened with specification, status progress, uploads, messages, QR and admin controls.
- Browser: visually reviewed home at 390 px and 1440 px widths; reviewed project detail at phone width.

Not verified: live Supabase auth/confirmation/password reset, SQL migration execution, RLS isolation, durable writes, private uploads/downloads and hosted provider integrations. These require the owner's Supabase project and launch configuration. Follow ACCEPTANCE.md before accepting real customers.
