# TECHOFAY Fleet — Phased Production Fix Master Prompt

**Repository:** https://github.com/admintechofay-a11y/TECHOFAY_fleet  
**Live app:** https://techofay-fleet.vercel.app/

## Mission
Audit and improve the existing application so its features work reliably against real persisted data and configured integrations. Use the current repository as the source of truth. The known architecture includes a React/TypeScript/Vite frontend, Node/Express API and MongoDB/Mongoose, but verify the current branch/files before acting. Treat the issues listed below as leads to verify—not automatically confirmed defects.

## Mandatory phase gate
**Work on ONE phase only.** Complete its work, run relevant tests, inspect the diff, write the named phase report, and stop. Ask the user for explicit approval before starting the next phase. Never implement later phases early. If blocked by missing credentials, a service, a GPS device, repository permission or a production environment, report the blocker honestly and stop. Never claim tests passed, bugs were fixed, integrations delivered, or production was verified unless actual evidence exists.

- Preserve user changes; never discard uncommitted work.
- Prefer a dedicated branch. Do not force-push or overwrite user work.
- Do not reset/drop databases, delete user data, run destructive migrations, rotate production secrets, or deploy without explicit approval.
- Preserve existing routes, forms, fields, names, labels, order, options, validations, API contracts and workflows unless a verified defect requires a narrowly scoped change.
- Do not replace real API data with mock/static data or make a mock integration appear successful.
- Never expose secrets or personal data in logs/reports.
- Verify all findings against current code and tests; classify as confirmed, needs runtime verification, already fixed/not reproducible, or false positive.

## Audit leads from prior source review — verify each one
Potential concerns include: unsafe default bootstrap admin credentials and fallback JWT/cookie secrets; import confirmation trusting client-submitted records; public tracking identifiers not safely tenant-scoped; password-reset token generated without actual email delivery; WhatsApp mock adapter silently reporting success; WhatsApp PDF URL mismatching actual document routes; incorrect Twilio signature verification; broad CORS and disabled CSP; storage environment-variable/size-limit mismatch and non-durable local file storage; upload validation trusting MIME type; non-atomic trip vehicle/driver checks; unvalidated cross-tenant references; map positions mistaken for live GPS; dashboard not continuously updated; navigation not synchronized with browser history; demo defaults in production forms; export jobs presented as async but executed synchronously; incomplete import/export entity support; WhatsApp template variables mapped by object ordering; fabricated legal details or simulated barcodes in PDFs; missing registration/email verification; in-memory rate limiting; internal errors exposed to clients; parser errors incorrectly normalized; report fields mismatching schema (reported example `registrationNumber` vs `plateNumber`); unawaited download promises; hardcoded SEO audit score; canonical/sitemap domain mismatch; inconsistent email uniqueness between index and login; tests not isolated or run in CI; shallow health checks; and build success mistaken for end-to-end proof.

# Phase 0 — Baseline audit and safety

1. Inspect git status/branch/commit, repository tree, scripts, package manifests/lockfiles, environment examples, deployment config, frontend routes, API endpoints, middleware, services, models, tests and existing reports.
2. Preserve all existing changes. Run only non-destructive baseline checks that the repository supports; record exact commands and outputs.
3. Map frontend page → API route → service → model for core flows: auth/session; tenant/RBAC; master data; load → LR/Bilty → trip → POD/delivery → closure; finances/reports; import/export; files/PDFs; WhatsApp/webhooks; public tracking.
4. Inventory all forms/mutations and integrations. Check configuration presence without printing secret values.
5. Establish isolated test database/environment; do not run write tests against production.
6. Verify every audit lead above against current code; record evidence/file/line/test and confidence.
7. Create `docs/PHASE_0_BASELINE_AUDIT.md` with baseline, architecture, verified findings, risks, test results and proposed order.
8. **STOP and ask approval for Phase 1. No code changes in Phase 0.**

# Phase 1 — Security, authentication and tenant isolation

- Remove unsafe production defaults for bootstrap credentials and signing/cookie secrets; fail startup if required production secrets are missing/weak. Do not rotate live secrets without approval.
- Derive tenant identity from authenticated context, not client input. Scope every tenant-owned read/write/delete/reference/download/import/export to the authorized company.
- Validate all referenced customer/location/vehicle/driver/load/trip/document/user IDs belong to the same tenant.
- Make import confirmation server-authoritative: do not trust client `validRecords`; use a tenant/user-bound server-side import batch, revalidate rows/references at commit, expire and consume batches once, and prevent replay.
- Make public tracking use an unguessable/revocable token or otherwise guarantee unambiguous tenant-safe lookup. Return only approved public fields; rate-limit and audit access.
- Make password-reset tokens cryptographically secure, short-lived, single-use, stored safely, and delivered through a configured real provider. Never claim delivery when unconfigured.
- Align email uniqueness policy across database indexes, registration, login and reset.
- Tighten CORS to exact configured origins; implement safe error responses with correlation IDs and redacted server logs; normalize parser/validation errors.
- Use a shared rate-limit store for multi-instance production where required; apply limits to auth, reset, tracking, uploads, exports and messaging.
- Test missing secrets, cross-tenant access, forged references, import tampering/replay, tracking collisions, reset expiry/reuse, CORS and rate limits.
- Create `docs/PHASE_1_SECURITY_REPORT.md`; **STOP for approval before Phase 2.**

# Phase 2 — Core transport workflows and data integrity

- Compare API input/output and populated selections with real Mongoose schemas; fix confirmed field-name mismatches and report mapping issues.
- Validate every referenced record and legal state transition server-side.
- Make load/LR/Bilty/trip/POD/delivery/closure operations consistent, idempotent and safe on retries.
- Make trip dispatch concurrency-safe so two requests cannot assign the same unavailable vehicle/driver. Use transactions where supported or conditional atomic updates and documented recovery.
- Prevent duplicate document creation, POD confirmation, payment recording and closure where inappropriate.
- Verify freight, charges, advances, balance, payment status, totals, rounding and date/quantity constraints against persisted records.
- Fix confirmed report aggregation/population errors; scope queries by tenant and dates.
- Ensure failed mutations never show false success or discard form data unexpectedly.
- Test full lifecycle, concurrent dispatch, invalid/cross-tenant references, duplicate retries and finance/report totals.
- Create `docs/PHASE_2_CORE_WORKFLOWS_REPORT.md`; **STOP for approval before Phase 3.**

# Phase 3 — Durable files, PDFs, imports/exports and external integrations

- Align storage env names/limits across docs, middleware and services. Use durable private object storage if deployment is serverless/multi-instance; keep local adapter for development/tests where appropriate.
- Validate upload size, extension, MIME and file signature; use safe server-generated names, prevent traversal, and enforce tenant ownership on downloads.
- Plan any file migration non-destructively; never delete originals without approval.
- Fix WhatsApp document URLs to match actual routes and create secure provider-accessible expiring document URLs.
- Do not allow mock mode in production to report real delivery. Distinguish simulated, queued, provider-accepted, delivered, read (if supported) and failed statuses.
- Implement provider-specific webhook signature verification using official algorithms (including Twilio's official validation approach); handle duplicate/replayed callbacks idempotently.
- Map WhatsApp approved template variables explicitly by the provider's documented order/name; persist provider IDs, errors and timestamps.
- Remove fabricated legal/company data from official PDFs; fail clearly if required legal details are missing. Verify barcode/QR with a decoder if scanning is required.
- Make UI import/export options match real supported entities and operations. Protect spreadsheet exports against formula injection.
- If exports need to handle large datasets, use a durable queue/worker with progress/retries; if infrastructure is unavailable, use bounded synchronous exports and label them honestly.
- Test storage persistence, unauthorized downloads, PDF contents, real/simulated message status, webhook signatures, import/export entity support and job states.
- Create `docs/PHASE_3_FILES_INTEGRATIONS_REPORT.md`; **STOP for approval before Phase 4.**

# Phase 4 — Real-time dashboard, events and GPS

- Distinguish database persistence, periodic dashboard refresh, pushed status updates and actual GPS tracking.
- Ensure dashboard KPIs/alerts derive from API/database data; remove hardcoded/fake metrics and display last-updated/stale state.
- Select polling, SSE or WebSockets based on existing architecture and hosting constraints. Add bounded retries/backoff, cleanup, reconnection and tenant-safe authentication/subscriptions.
- Emit events only after successful database mutations. Avoid duplicate/out-of-order updates and cross-tenant broadcasts.
- Inspect for an existing real GPS provider. If none exists, do not fake GPS: implement only a documented provider interface/unavailable state if useful, and report hardware/credential dependency.
- For real GPS, validate device identity, signature, timestamps, coordinates, tenant/vehicle mapping and replay/out-of-order events. Show actual last-seen time and distinguish geocoded hub/city positions from GPS.
- Test updates across two sessions, tenant isolation, reconnect/stale states and reconciliation of dashboard values with API results.
- Create `docs/PHASE_4_REALTIME_REPORT.md`; **STOP for approval before Phase 5.**

# Phase 5 — Frontend routing and operational reliability

- Synchronize in-app navigation with browser URL/history; support direct links, refresh, Back/Forward and bookmarks without broad rewrites.
- Review demo autofill/sample company/financial values. Ensure production workflows do not mistake fixtures for real data; retain legitimate business defaults after verification.
- Preserve existing form controls, labels, order, names, validation and payloads.
- Add accurate loading/empty/error/success states; await async downloads and surface failures.
- Check filters, sorting, pagination, bulk actions, modals, uploads, charts, reports and responsive behavior.
- Ensure failed requests never show success; prevent duplicate submissions where appropriate.
- Review keyboard navigation, labels, focus, contrast and dialog accessibility.
- Test deep links/history, form parity, failed requests, downloads and mobile/tablet layouts.
- Create `docs/PHASE_5_FRONTEND_REPORT.md`; **STOP for approval before Phase 6.**

# Phase 6 — Tests, CI, health checks and observability

- Ensure tests use isolated databases and fail safe if configured to use production. Use deterministic fixtures and cleanup; never send real WhatsApp messages in normal CI.
- Add unit, integration and browser E2E tests for auth/RBAC/tenant boundaries, core transport lifecycle, import/export, PDFs, password reset, tracking and configured provider status.
- Add regression tests for every verified defect fixed in earlier phases.
- Add/repair CI using existing package manager/scripts: install, lint, type-check, tests and frontend/backend build. Block release on critical failures.
- Separate liveness and readiness. Check actual DB/storage/configuration dependencies with bounded operations; do not reveal secrets.
- Add structured logs, correlation IDs, redaction and useful latency/error metrics. Never log tokens, passwords, sensitive request bodies or private documents.
- Test CI failure gates, health checks under dependency failure, and reproducible clean setup.
- Create `docs/PHASE_6_TESTING_CI_REPORT.md`; **STOP for approval before Phase 7.**

# Phase 7 — Deployment, backups and release readiness

- Verify real deployment routing, API base URL, CORS, cookies, HTTPS, environment variables, runtime limits and canonical domain.
- Align sitemap/canonical/Open Graph/public URLs only after the intended production domain is confirmed. Replace fixed SEO audit scores with genuine checks and timestamps.
- Check Vercel/serverless limits and ensure background jobs/files are not assumed to persist locally.
- Document MongoDB, storage, email, WhatsApp, queue/worker, GPS and monitoring requirements.
- Prepare non-destructive migration plan, preflight checks, backup, rollback and data validation. Never auto-run destructive production migrations.
- Document backup retention/encryption/restore. Test restore in non-production only if authorized and equipped.
- Run production-like smoke tests with test accounts/non-customer data; check security headers, dependencies, public documents, rate limits and provider failures.
- Create `docs/PHASE_7_RELEASE_READINESS_REPORT.md`; **STOP for approval before Phase 8.**

# Phase 8 — Final regression and handover

- Run all available backend tests, frontend lint/type-check/build and E2E tests.
- Test two isolated tenants, role permissions and cross-tenant denial.
- Exercise failure modes: DB/storage unavailable, provider rejection, duplicate webhook, network interruption, expired session, invalid upload, export timeout and stale GPS.
- Reconcile dashboard/reports against stored records and independently calculated totals.
- Search for remaining TODOs, mock success, demo defaults, hardcoded metrics, placeholder handlers, swallowed errors, insecure defaults and unimplemented endpoints. Classify matches instead of blindly deleting legitimate fixtures.
- Review full diff for accidental form/route/schema/API changes.
- Produce `docs/PHASE_8_FINAL_HANDOVER_REPORT.md` with fixed defects, files changed, migration/config steps, exact commands/results, tested integrations, remaining blockers, residual risks and rollback plan.
- **Do not deploy to production without explicit user authorization. STOP for approval before any production deployment.**

## Rules applying to every phase
- Use current code conventions and dependencies; avoid unnecessary new packages and broad refactors.
- Validate inputs at trust boundaries, use safe timeouts/retries and protect against duplicate requests/webhooks.
- Do not hide errors or substitute static data when APIs fail.
- Never claim real email/WhatsApp/GPS/object-storage behavior without credentials and runtime evidence.
- Preserve IDs, tenant ownership, user data, existing fields and workflows.
- Any schema/index change requires a preflight report and migration/rollback plan.
- Report exact tests run, not merely tests that exist.

## Required report template for each phase
1. Status: complete / partially complete / blocked.
2. Verified findings with file/line/test evidence.
3. Files changed and reason for each.
4. Config, provider and migration impacts.
5. Exact commands run and actual results (including failures/skips).
6. Regression review of routes, forms, API contracts and workflows.
7. Remaining risks/blockers and external dependencies.
8. Git branch/commit/status; state honestly whether changes were committed.
9. Proposed next phase (description only).
10. Explicit approval question.

## Start now
**Start Phase 0 only.** Audit the current repository, run safe baseline checks, verify the audit leads, write `docs/PHASE_0_BASELINE_AUDIT.md`, present the evidence-based report, and stop for the user's explicit approval. Do not implement Phase 1 or any later phase yet.
