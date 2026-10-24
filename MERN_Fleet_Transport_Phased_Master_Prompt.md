# MASTER BUILD PROMPT — MERN FLEET & TRANSPORT MANAGEMENT PLATFORM

## How to use this prompt
Give this complete file to your coding agent (Claude Code, Cursor, or an equivalent repository-aware agent) from the **root folder of your new project**. Work strictly in phases. Finish and verify Phase 1, then STOP and wait for the user to explicitly say `APPROVE PHASE 1 — START PHASE 2`. Never implement later phases in advance. The same approval gate applies after every phase.

---

# 0. ROLE, MISSION, AND NON-NEGOTIABLE RULES

You are the lead MERN-stack architect, senior full-stack engineer, QA engineer, security engineer, and UI/UX implementer. Build a production-oriented **Fleet & Transport Management Web Application** based primarily on the attached `Techofay_Fleet_Transport_Management_SOW` (five pages) and the attached Instagram launch-checklist screenshot.

The deliverable must be an actually working application with real persistent data, real backend/API operations, validated business rules, permission enforcement, working exports, document generation, and integrations when credentials exist. This is not a static UI prototype.

## Mandatory principles
1. **Follow the SOW as the baseline.** Do not silently omit or simplify its requirements. Keep a traceability matrix mapping every SOW section/requirement to screens, APIs, data models, tests, and completion evidence.
2. **MERN stack for this new application:** MongoDB, Express.js, React, Node.js. Prefer TypeScript across frontend and backend. Do not migrate the new app to Laravel/PHP just because the reference repo uses that stack.
3. **Repository-first workflow:** first inspect the entire new repo, existing scripts, dependency versions, architecture, environment, tests, and current git status. Preserve useful code; don't destructively replace a working project without proof. If the repository is empty, scaffold it cleanly. Never assume files or features exist before checking.
4. **Reference repo for study/reuse:** https://github.com/admintechofay-a11y/Transport_techofay. Inspect the relevant code, README, APIs, models, UI, document/PDF logic, WhatsApp adapter, tests, role/permission model, and operational workflows. Reuse patterns and port ideas only where they fit. Do not claim code was inspected unless it was. Do not copy its entire repository, backend framework, dependency tree, credentials, branding, or unrelated components into the MERN project. Respect its license and retain notices for any code that is legally reused. Prefer reimplementing behavior and adapting small, relevant, license-compatible components. Avoid submodules or wholesale copying that brings a different stack into this app.
5. **One phase at a time.** At the start, execute Phase 1 only. After its implementation and verification, publish a clear report, list tests and gaps, and STOP. Do not begin Phase 2 until the user explicitly approves. Never interpret silence, an ambiguous message, or a successful test as approval.
6. **No fake or demo-only functionality.** Buttons, forms, cards, filters, import/export controls, notifications, and actions must work end-to-end. A visible action must either succeed with real data or show a specific error and recovery path. No hard-coded dashboard totals, simulated success toasts, fake persistence in localStorage, lorem ipsum records, decorative-only buttons, placeholder links, or mock API responses in production paths. Seed data is permitted only for local development and must be clearly labeled and reproducibly generated.
7. **No data-loss shortcuts.** Use database-backed persistence. Add migrations/index creation or reproducible setup scripts, validation, error handling, and tested backup/export procedures. Never automatically drop production data, wipe collections, or replace real data with seeds.
8. **Security by design.** Validate every request on the backend. Enforce authorization on every protected API and object, not only by hiding frontend controls. Use safe password hashing, secure sessions/tokens, rate limiting, CSRF protection where applicable, secure headers, strict CORS, input validation, file upload restrictions, audit logs for sensitive operations, and safe secret handling. Never commit credentials.
9. **Test results must be truthful.** Run commands and tests where possible. Report exact passing/failing checks. Never call a feature complete if it is unimplemented, mocked, not tested, or blocked by missing third-party credentials. Clearly distinguish `implemented`, `tested`, `blocked by credentials`, and `not implemented`.
10. **Keep the app usable and fast.** Responsive desktop/tablet/mobile UI; accessible forms and keyboard navigation; sensible pagination; server-side filtering; indexed queries; loading/empty/error states; optimistic updates only when safely reconciled; no repeated API calls or giant unbounded lists.
11. **Do not invent business rules that the SOW says must be finalized.** For freight calculations, document layouts, number formats, payment behavior, and WhatsApp templates, create configurable rules and record assumptions in `docs/DECISIONS_AND_OPEN_QUESTIONS.md`. Use conservative, explicit defaults only when necessary for local development and make them configurable.
12. **Do not claim GPS/live vehicle tracking is included.** The SOW excludes tracking hardware/devices. You may add an optional future integration interface, but show actual tracking only when a real authorized telematics provider/data source is configured.

---

# 1. INPUTS AND SOURCE OF TRUTH

## A. SOW requirements (all are in-scope baseline requirements)
Implement and verify every item below:

1. **Project overview:** centralize loads, LR numbers, Bilty/consignment documents, vehicles, drivers, customers, multiple locations, trips, freight, deliveries, PDFs, WhatsApp communications, reports and user access.
2. **Load management:** create/edit/view loads; automatic load number generation; customer/party, consignor and consignee; material, quantity, weight, dates, freight, advance, deductions, remarks; vehicle and driver assignment; statuses; search/filter/history.
3. **LR number management:** automatic and permitted manual LR numbers; unique-number validation; relationship to load, vehicle, driver, customer and Bilty; history/status tracking; LR PDF; WhatsApp sharing; Draft, Generated, Loaded, In Transit, Partially Delivered, Delivered, Cancelled lifecycle where business rules permit.
4. **Multi-location loads:** multiple ordered pickup/loading and unloading/delivery points; per-stop material/quantity, contacts, remarks, state; completed/pending stops; consolidated documentation.
5. **Vehicle management:** registration, type/category, model, manufacturer, capacity; owner/transporter; chassis/engine/registration details; vehicle status Available, Assigned, On Trip, Under Maintenance, Inactive, Out of Service; vehicle trip/load/document history.
6. **Vehicle document management:** upload, expiry, view/download, renewal history for RC, insurance, PUC, fitness, permits/national permit, tax and configured additional documents.
7. **Driver management:** name, mobile/alternate, address, driving licence number/type/expiry, emergency contact and configured identification fields; assignments; history; availability; licence and document expiry tracking.
8. **Trip management:** trip number, load/LR, vehicle, driver, locations, start date/time, expected delivery, freight, advance, additional expense, remarks; statuses Created, Vehicle Assigned, Loading, In Transit, Partially Delivered, Delivered, Closed, Cancelled.
9. **Bilty/consignment note:** automatic Bilty numbering; LR/load/date/parties/locations/vehicle/driver/material/quantity/weight/freight/advance/balance/payment terms/remarks/signature/company branding; configurable approved template.
10. **PDF/document generation:** LR, Bilty, loading slip, delivery challan, trip sheet, gate pass, freight statement, invoice/payment receipt when included, load/vehicle/driver/customer reports, POD, and approved additional formats. Support company logo, GST information, terms, signature blocks, and configurable fields.
11. **WhatsApp integration:** send LR/Bilty/invoice/operational PDF, load/vehicle/trip/delivery information, customized messages, and event-based updates for Load Created, Vehicle Assigned, Dispatched, In Transit, Delivered when provider and template policies allow. Respect provider approvals, costs, template policies, opt-in/consent and delivery/error tracking.
12. **Customer/party management:** company name, contact people, phone/email, addresses, GST, billing and delivery addresses, consignor/consignee details, payment terms, customer history and statements.
13. **Location master:** pickup/loading/unloading/delivery point, address, contact, customer-specific mappings, location history.
14. **Freight/charges:** freight, loading, unloading, detention, toll, handling, miscellaneous charge, advance, deduction and balance. Make calculation rules configurable and documented; never silently assume the client’s final accounting formula.
15. **Delivery and POD:** status/time, stop-wise quantity delivered/pending, remarks/confirmation, POD upload, relationship to LR/load/trip, download and WhatsApp sharing.
16. **Dashboard:** total/today/pending/completed loads, active trips, pending deliveries, vehicle status counts, driver availability/on-trip, pending POD, and freight/advance/outstanding totals when applicable. All values must derive from API/database queries and respond correctly to filters/date ranges.
17. **Reports:** load/LR/Bilty/vehicle/driver/trip/customer/location; delivery/POD; freight/expenses/payments; pending/completed loads; vehicle utilization and driver trip; date/customer/vehicle/driver/status filters; reliable export/download.
18. **Roles/permissions:** Super Administrator, Administrator, Transport Manager, Fleet Manager, Operations Manager, Data Entry Operator, Accounts User, Management User, with module-level view/add/edit/delete/administrative permissions. Make role matrix configurable by authorized admins.
19. **Search/filter:** LR/Bilty/Load/Trip/vehicle registration/driver/customer/consignor/consignee/pickup/delivery/date/status/payment status.
20. **Admin panel:** manage users, customers, vehicles, drivers, locations, loads, LR, Bilty, trips, documents, reports, templates, WhatsApp settings and company configuration.
21. **Security:** secure login/passwords, RBAC, restricted admin access, database access controls, HTTPS when deployed and backup provisions.
22. **Responsive web app:** desktop, laptop, tablet, mobile browsers; design for transport operators, fleet teams, accounts and management.
23. **Document template customization:** LR, Bilty, invoice, trip sheet, delivery challan, POD and letterhead with logo/address/GST/terms/signatures/custom fields; templates need approval before production use.
24. **Deployment/handover:** production deployment configuration, admin provisioning, basic user guide/training material, approved document templates, system docs, and source/data handover only as contractually authorized.
25. **Client dependencies:** logo/branding, existing formats/templates, fleet/driver/customer/location master data, business/freight rules, WhatsApp Business/API account and approvals, domain/hosting/third-party credentials, timely UI/workflow approvals. Provide import templates and a dependency checklist.
26. **Explicit exclusions unless separately approved:** third-party WhatsApp/API, hosting/domain, SMS, gateway/subscriptions; GPS hardware/sensors/RFID; native mobile applications; government APIs; third-party licenses; accounting/ERP integrations. Do not quietly imply these are included. Browser-based responsive app is in scope.

## B. Image launch checklist (include in final hardening phase)
The attached image lists 20 website launch checks. Treat all as release-quality checks appropriate to this authenticated web app and its public pages:
1. Server-side rendering (evaluate whether SSR is warranted for public/login/help pages; do not break protected app routes just to tick this box; document selected React rendering strategy).
2. `robots.txt`.
3. `sitemap.xml` for indexable public pages only; never expose private app routes.
4. Unique title tags.
5. Meta descriptions on indexable public pages.
6. One meaningful H1 per page.
7. Canonical tags on public canonical pages.
8. Open Graph metadata/images on public/shareable pages.
9. Custom 404 page.
10. 301 redirects for approved route/domain changes; avoid redirect loops.
11. Useful alt text.
12. WebP/modern optimized images where supported.
13. Lazy loading for below-the-fold media.
14. Organization schema on appropriate public pages only; never fabricate ratings, addresses, or legal information.
15. Breadcrumbs where helpful.
16. Correct internal links.
17. Google Analytics or an agreed analytics provider, configurable and privacy-aware; don't track confidential business records or PII.
18. Google Search Console verification guidance and property setup checklist (credentials are external; never pretend a property was verified without confirmation).
19. Privacy policy.
20. Working contact form with server-side validation, persistence/delivery, spam protection and success/failure status.

---

# 2. REFERENCE REPOSITORY STUDY AND SAFE REUSE

Reference: https://github.com/admintechofay-a11y/Transport_techofay

Repository README currently describes a transport/logistics platform with a React 19 + TypeScript + Vite + Tailwind + Zustand operations terminal, a separate management console, and a Laravel 10/PHP backend with MySQL and Redis. That architecture is reference information only; the new product must use MERN.

Before implementing functionality, map where relevant patterns exist in the repository. Search and inspect at least these areas if present:
- README and architecture/quick-start/deployment docs.
- API routes/controllers/services/models for auth, LR numbers, Bilties, freight charges, customers, trips, multi-stop/load locations, POD, delivery challans, gate passes, vehicle/driver documents, customer statements, dashboard and reports.
- Frontend routes/components for data tables, navigation, dashboard, filters, forms and permission-aware menus.
- PDF rendering and document-template patterns.
- WhatsApp provider interface/adapters (README mentions Interakt/Twilio patterns), message templates, event hooks, delivery/error logging.
- Expiry-check scheduled command/events and alert logic.
- RBAC, audit logging, validation, API error contracts and tests.
- Loading/empty/error states, API integration patterns, pagination, table filtering, and mobile layout.

Create `docs/REFERENCE_REPO_AUDIT.md` with a table: `Feature/pattern | Source path(s) inspected | Behavior observed | What to reuse/adapt | MERN implementation target | License/security concern`. Cite real paths only after checking them. If a path is absent or inaccessible, record that rather than inventing one.

Use the reference to save time on ideas such as workflows, status transitions, document fields, PDF layouts, WhatsApp adapter abstraction, document expiry reminders, list/search UX, audit trail, and permission patterns. Do not blindly carry over their Laravel-specific code, unrelated Fleetbase internals, bundled secrets, brand assets, or unrelated modules. Use an adapter/provider interface for integrations and test it locally with a clearly identified sandbox/mock provider; production features must call a real provider when configured and must never report a fake send as success.

---

# 3. RECOMMENDED MERN ARCHITECTURE

First inspect the target repository. If a suitable structure exists, extend it. Otherwise use a maintainable monorepo similar to:

- `apps/web`: React + TypeScript + Vite (choose SSR only when justified and document it); React Router; feature-oriented modules; reusable design system; TanStack Query or equivalent for API state; React Hook Form + Zod (or equivalent) for forms.
- `apps/api`: Node.js + Express + TypeScript; modular routes/controllers/services/repositories; request validation; consistent errors; centralized auth and authorization.
- `packages/shared`: shared schemas/types/constants where safe; don't share backend secrets or server-only code with the client.
- `docs`: architecture, data flows, SOW traceability, roles/permissions, API contracts, decisions, test reports, deployment, backups, operations and user guide.

Database: MongoDB with explicit schemas, indexes, unique constraints, references and transaction strategy. Use replica-set transactions where required and supported; otherwise design safe idempotent operations and reconciliation. Define UTC storage and consistent display timezone configuration. Monetary amounts use integer paise or Decimal128 according to a documented strategy; never use unsafe floating-point arithmetic for accounting totals.

Minimum engineering infrastructure:
- TypeScript strict mode where feasible.
- ESLint + Prettier.
- Unit tests and API integration tests (Vitest/Jest + Supertest or appropriate alternatives).
- Frontend component/e2e tests (Playwright/Cypress or equivalent).
- API versioning under `/api/v1`.
- OpenAPI/Swagger documentation and example requests/responses.
- Structured request logs with correlation IDs; never log passwords, auth tokens, full sensitive documents or secret configuration.
- Health/readiness endpoints that do not leak sensitive internals.
- `.env.example`, `.gitignore`, secret scan, safe CORS, secure HTTP headers, request body limits, rate limiting.
- Development-only seed script with obvious labels and idempotent behavior.
- Docker Compose for local MongoDB and app services if suitable; do not make production depend on development defaults.
- Backup/restore procedure with a tested restore rehearsal documented.

Do not add numerous libraries without a reason. Check maintenance, licensing, compatibility and bundle impact before selecting dependencies.

---

# 4. CORE DATA MODEL AND RELATIONSHIPS

Design and document an ERD/data relationship diagram before building feature screens. Adapt model naming to existing conventions. Minimum entities/collections:

- `User`, `Role`, `Permission` (or role-permission map), `RefreshSession`/session records, `AuditLog`.
- `CompanySettings`/tenant settings if the app is intended for multiple businesses. If multi-tenancy is not approved, still prevent one organization’s records from crossing company boundaries and document the tenancy design.
- `CustomerParty` with billing/delivery addresses, GST fields, contacts, terms, status.
- `Location` master and customer-linked location details.
- `Vehicle`, `VehicleDocument`, `VehicleMaintenanceRecord` if maintenance is implemented beyond SOW statuses.
- `Driver`, `DriverDocument`, driver availability/assignment history.
- `Load`, ordered `LoadStop`/multi-location records and load item/material records where needed.
- `LRNumber`/LR record.
- `Bilty`/consignment note.
- `Trip` and trip/load relationship. Model one or more loads per trip only if business rules explicitly allow it; otherwise constrain relationship and document it.
- `FreightCharge`/charge line, `Expense`, `Advance`, `Deduction`, `Payment`/transaction entries and statement view. Preserve a history of financial changes.
- `Delivery`/stop delivery and `POD` attachments/metadata.
- `GeneratedDocument`/document version/template metadata, download permissions and expiry where appropriate.
- `MessageLog`/WhatsApp message attempts, provider IDs, status, errors, template, recipient, linked entity, consent and retry metadata.
- `Notification`/in-app alerts where needed.
- `ImportJob`, `ImportRowError`/report and `ExportJob` where async processing is appropriate.
- `ContactSubmission` for the working public contact form.

Data model rules:
- Every persistent entity gets stable IDs, created/updated timestamps and, where appropriate, createdBy/updatedBy and soft-delete/archive status. Use deletedAt/audit history consistently; avoid accidental hard deletion of financial or legally relevant documents.
- Unique indexes for generated identifiers scoped to the appropriate company/tenant and any external provider message ID as appropriate.
- Use counters/atomic allocation or collision-safe number generation. Do not calculate next IDs by simply finding the latest number, which races under concurrent requests.
- Validate cross-entity relationships and company/tenant ownership on the server.
- Prevent assigning unavailable vehicles/drivers to overlapping active trips unless a permitted override is explicitly audited.
- Preserve state and financial history where users need to audit changes.
- Do not accept derived balances/totals directly from the client. Compute them server-side from validated line items and configured rules.
- Configure date, currency, GST/number, weight and quantity units; default to Indian business context only where appropriate and make company-specific settings configurable.

---

# 5. REQUIRED FUNCTIONAL AREAS

## 5.1 Authentication and account security
- Login/logout; secure password hashing (Argon2id or bcrypt with a reviewed work factor); password reset flow with expiring, single-use token; account activation/disable; session expiry and refresh rotation or secure server sessions; brute-force/rate limits; invalid login errors that do not leak which identifier exists.
- Secure cookie strategy for browser sessions or a carefully designed token strategy. If cookies are used, use HttpOnly, Secure in production, SameSite and CSRF protection. Never store high-value tokens in localStorage.
- Admin-managed users/roles and user status; least-privilege defaults; server-enforced permissions; no default production admin password. Bootstrap admin through a one-time protected CLI command or equivalent.
- Prevent unauthorised direct URL/API access and object-level access (IDOR). Test permission denial across modules and exports/files.

## 5.2 Operations dashboard
- Live KPI cards sourced through database queries with date range and company scope.
- Meaningful trend/summary charts only if backed by real records; no random chart values.
- Quick actions (New Load, New Trip, Add Vehicle, Add Driver, Record Delivery) route to working forms and APIs.
- Recent activity from audit/operations events, pending documents/expiries, delivery delays, POD backlog and failed messages as permissions allow.
- Every card links to the filtered underlying records.

## 5.3 Loads, LR and Bilty
- Real create/edit/detail/history views; server validation and unique number allocation; reliable links among load/LR/Bilty/trip/customer/vehicle/driver.
- Status transitions enforced by a state transition service, not arbitrary client strings. Define allowed transitions; record actor/time/reason and prevent invalid backward transitions unless authorized.
- List tables with server pagination/sorting/filtering; global search; bulk actions only where safe and audited.
- Support manual number entry only when permission/config allows; handle race conflicts with useful feedback.
- Print/download official-looking documents only from saved records, with preview/version, current company template and reproducible generated file.

## 5.4 Multi-stop logistics and trips
- Add/reorder pickup, loading, unloading and delivery stops with validated sequence and contact details.
- Quantities delivered/pending reconcile with consignment totals; partial delivery works across stops. Disallow negative or over-delivery unless an explicitly configured and audited exception exists.
- Trip assignment validates driver/vehicle status and conflicts. Store start/expected end/actual delivery and trip expenses.
- Timeline/history explains who changed status and when. A trip closing operation validates all required stop/POD/expense conditions according to configurable business rules.

## 5.5 Fleet and driver compliance
- Searchable registries; status/availability and full load/trip/document history.
- Secure file upload/download with MIME/content checks, size limits, randomized storage keys, access checks, malware-scanning integration point where available, and private storage. Never put private vehicle or driver documents in public static folders.
- Expiry dashboard with configurable warning windows and scheduled checks. Avoid duplicate reminders; log alert delivery, retries and failures.
- Vehicle maintenance status/history where appropriate; clearly distinguish this from an externally verified telematics/GPS feature.

## 5.6 Freight, expenses, advances and statements
- Configurable charge lines: freight, loading, unloading, detention, toll, handling, miscellaneous, advances and deductions.
- Keep separate configurable calculation/rounding/tax policies. Write formulas and examples into `docs/BUSINESS_RULES.md`; do not finalize assumptions hidden in code.
- Every total, balance, and dashboard summary computed on server and reconciled to ledger/charge records. Financial edits need permissions, reason, and audit history.
- Customer statements filter by date/status and export. Show the calculation breakdown and source records. If payment receipt/invoice is outside confirmed contractual scope, make it an explicit optional setting and record this, but implement its data model/UI if approved during Phase 1 design.

## 5.7 Delivery and POD
- Per-stop delivered quantity, time, recipient/name, remarks, status and POD attachment(s).
- Support image/PDF POD uploads, authenticated retrieval, checksum/metadata and relationship to relevant load/LR/trip/stop.
- Reconcile quantities and partial delivery; report missing POD; configurable closure requirements.
- Share POD only via authorized, logged action; do not expose permanent public URLs for sensitive attachments.

## 5.8 PDF and print document engine
- Template-driven, versioned server-side generation for LR, Bilty, loading slip, delivery challan, trip sheet, gate pass, freight statement and other approved reports/POD outputs.
- Configurable logo, company address, GST details, terms, signatures, fonts, margins, line items, page breaks and custom fields. Reproduce client-approved templates once supplied; until then use a polished generic template marked `SAMPLE — REQUIRES CLIENT APPROVAL` rather than pretending approval happened.
- Data values must come from saved business records; correct date/number formatting, page overflow handling, consistent totals, sanitization against HTML injection and output checks.
- Store template version + source entity/version metadata; use predictable naming; enforce authorization on generation/download; test PDFs by extracting text and rendering sample pages for visual inspection.

## 5.9 WhatsApp messaging
- Provider abstraction/interface; one real supported provider configured through server environment and admin settings without exposing API keys. Review the reference adapter patterns first.
- Implement template registry, approved template name/language, recipient validation, consent/business-context rules, enqueue/retry/backoff, provider rate limits, delivery/failure status, webhook verification, signature validation, duplicate webhook idempotency, message audit trail and operational monitoring.
- User explicitly clicks send (or an authorized business event triggers an approved template); show message preview and recipient/document; require confirmation for bulk sends.
- Attach PDFs/media only where the chosen official provider supports the method and configured account privileges permit it. Do not assume a feature based on a demo SDK.
- When secrets/provider access are missing, provide a clearly labeled test adapter for automated tests and a production setup checklist. In real app UI, display `Not configured`/`Blocked — provider credentials required`; never display `Sent` if only mocked.

## 5.10 Excel/CSV import and export — required additional feature
Implement a robust, genuinely working Excel feature set, not just a button:

### Exports
- Export filtered reports for loads, LR, Bilty, trips, vehicles, drivers, customers/parties, locations, deliveries/POD status, freight/expenses/payments and customer statements according to current user permissions.
- Support `.xlsx` and `.csv`; provide proper column labels, dates, numeric values, currency/units, status values, totals when appropriate, generated-at timestamp and applied filter summary. Avoid formula injection in CSV/XLSX when cells begin with `=`, `+`, `-`, `@`, tab or carriage return. Use safe cell types/escaping.
- Respect server-side filters, pagination completeness, authorized company/tenant scope, and selected columns. Large exports use asynchronous export jobs with status/download expiry; small exports may be streamed. Never export only the visible page while implying all matching rows were included.
- Use separate export permission and audit download of sensitive records. Offer a stable file name and an informative error if no records match.

### Imports
- Downloadable, versioned Excel templates for customers, locations, vehicles, drivers, and (after relation mapping rules are established) loads and other agreed entities.
- Upload `.xlsx`/`.csv`; extension/MIME/size/row-count validation; parse safely; map columns; preview and validate before committing; row-level errors with row number, field, reason and correction guidance; duplicate detection; required field/type/date/enum/reference validation; user chooses dry-run/preview then confirm import.
- Import modes: create-only as safe default, and update existing only if authorized and key matching strategy is explicitly chosen. Never silently overwrite records. Transactions/batches/idempotency or compensating strategy; clear summary of created/updated/skipped/failed counts; downloadable error workbook; audit the user, file hash, mode, row counts and outcome.
- A malformed row must not corrupt other data. Define whether imports are atomic or per-row/ordered batch and document behavior. Protect against zip bombs, excessively large workbooks, formula evaluation, malicious hyperlinks and memory exhaustion. Do not execute formulas or macros.
- For relationship fields, resolve by stable business identifiers/approved mapping, not just row order. Validate foreign keys and company scope. Re-importing the same file should not create unplanned duplicates.
- Add tests for duplicate entries, invalid dates, missing required fields, unauthorized import, large files, formula injection, malformed workbook, partial failure and success with persistence.

### Excel operational workflows
- Table controls: search, filter, sort, choose columns, pagination, bulk select where appropriate, export current query.
- Optionally provide an Excel-like in-app grid for bulk editing only if feasible without making the app fragile. Changes must be validated, saved via APIs, show per-row errors and preserve audit logs. Do not claim editing Excel files directly edits database until an uploaded import is validated and confirmed.

## 5.11 Admin panel and settings
- Company profile/brand/GST fields; number prefixes/sequences; timezone, currency, weight and date formats; configurable status and business rules; document templates/versions; WhatsApp provider setup health; user/role settings; import/export history; audit trail; backup status if available.
- Secret credentials should be stored only in environment/managed secret store or a securely encrypted settings system with strict access. Show masked presence, not raw secret after save.
- Prevent self-lockout and last-super-admin deletion/demotion. Require explicit confirmation for destructive sensitive actions.

## 5.12 Global search, notifications and audit
- Global search across allowed entity types, scoped to permissions and company; debounced UI with cancellation and accessible result navigation.
- In-app alerts for upcoming document expiry, overdue deliveries, pending POD and failed message delivery as permitted. Deduplicate and track read/unread state where meaningful.
- Audit record for authentication/admin changes, status transitions, financial changes, imports/exports, document access/generation, message attempts, and role changes. Make logs tamper-resistant to ordinary users; log retention configurable.

---

# 6. DESIGN/UI REQUIREMENTS

Build a cohesive enterprise transport-management UI, not a landing-page-only design. Do not copy the person/video content from the Instagram screenshot; its role is only the SEO/release checklist.

Design direction:
- Modern operational workspace: clear hierarchy, neutral light surfaces, restrained dark navy/charcoal navigation with one disciplined accent color; high contrast and readable typography; avoid excessive gradients, glassmorphism and giant decorative hero sections.
- Persistent sidebar/navigation on desktop; compact collapsible navigation on mobile; clear page title, breadcrumbs where useful, global search, notifications and profile/account control.
- Practical dashboard cards, charts only where data exists, consistent tables, advanced filters, detail pages with tabs/timelines, two-column desktop forms where useful, clear save/cancel behavior and unsaved-change warning.
- Consistent design tokens for colors, spacing, type scale, radius, shadows and focus states; component library for buttons, inputs, selects, date/time pickers, dialogs, tables, badges, toasts, file upload and empty/error/loading states.
- Fully responsive screens; mobile forms and tables should remain usable via card or horizontal-scroll patterns, not overflow the viewport.
- Accessibility: semantic HTML, one meaningful H1 per page, labels and help text, keyboard support, visible focus, proper modal focus, sufficient contrast, alt text and accessible feedback.
- All buttons/links must have real destinations/actions. No dead menu items. Remove console errors and warnings; don't silence lint/tests to make checks pass.
- Present status with text/icons, not color alone. Confirm sensitive deletes/financial actions. Show actionable API errors and retry only safe/idempotent operations.

Screens/routes to plan and implement over phases:
- Public routes: `/`, `/contact`, `/privacy`, `/terms` (if needed), `/login`, password reset/help pages.
- App shell: `/app/dashboard`, `/app/loads`, `/app/loads/new`, `/app/loads/:id`, `/app/lr`, `/app/lr/:id`, `/app/bilties`, `/app/bilties/:id`, `/app/trips`, `/app/trips/:id`, `/app/deliveries`, `/app/pod`, `/app/vehicles`, `/app/vehicles/:id`, `/app/drivers`, `/app/drivers/:id`, `/app/customers`, `/app/customers/:id`, `/app/locations`, `/app/reports`, `/app/import-export`, `/app/messages`, `/app/notifications`, `/app/admin/users`, `/app/admin/roles`, `/app/admin/settings`, `/app/admin/templates`, `/app/admin/audit` as authorized.
- Protect routes based on server-derived current user permissions; a client route guard is UX, not security.

---

# 7. PHASED EXECUTION PLAN — HARD STOP AFTER EACH PHASE

## Phase 1 — Discovery, repository audit, scope/architecture, project baseline ONLY
Do not build the full app in this phase. Your task is to produce an implementation-ready plan and a minimal verified foundation.

Actions:
1. Inspect the current project repository and report its actual file tree, stack, commands, tests, risks, existing behavior and git status. Preserve working changes. If there are uncommitted user changes, do not overwrite them.
2. Read this SOW and image checklist and create `docs/SOW_TRACEABILITY.md`, mapping all SOW sections 1–26 and each of the image’s 20 checklist items to planned phase, module, test and verification evidence.
3. Audit relevant reference repository paths; create `docs/REFERENCE_REPO_AUDIT.md` with evidence-based findings and reuse recommendations. Do not bulk-copy code.
4. Create `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md` (ERD/relationship diagram), `docs/ROLE_PERMISSION_MATRIX.md`, `docs/BUSINESS_RULES.md`, `docs/DECISIONS_AND_OPEN_QUESTIONS.md`, `docs/PHASE_PLAN.md`, and `docs/DEPENDENCY_CHECKLIST.md`.
5. Define a coherent MERN TypeScript architecture, API error contract, auth/session approach, data scoping/tenancy plan, audit strategy, number-sequence strategy, upload storage strategy, WhatsApp adapter contract and import/export architecture.
6. Explicitly flag business decisions needing the client’s input: company/tenant model, freight formula/rounding/tax, number prefixes and reset rules, exact LR/Bilty templates, load-trip cardinality, status transitions, delivery/POD closure policy, payment/invoice scope, WhatsApp provider/templates/consent, storage/backups/retention, roles/permissions and required data imports.
7. Set up only the minimal project foundation required to run type checks/lint/tests, if the repo needs it. Do not implement feature modules from later phases. Add safe `.env.example` (no secrets), basic developer setup instructions and health checks only if appropriate.
8. Define Phase 1 acceptance tests and run them.

Acceptance gate for Phase 1:
- Every SOW scope area and all 20 launch checks are accounted for in the traceability matrix.
- Reference audit names only paths actually inspected and distinguishes observed behavior from inference.
- Architecture, data relationships, permission matrix, open questions and phase plan are internally consistent.
- No credentials are introduced; no real data is removed.
- Baseline quality checks work and their actual outcomes are reported.
- Produce a concise implementation summary, changed files, tests run/results, open blockers and questions requiring answers.

**STOP HERE. Do not start Phase 2. Wait for explicit user approval.**

## Phase 2 — Foundation, authentication, authorization, audit, application shell
Only after explicit Phase 1 approval.
- Implement MERN monorepo foundation, environment config, connection/readiness checks, centralized validation/errors, OpenAPI setup and database index setup.
- Implement secure auth, logout/session lifecycle, password reset foundation, role/permission resolution and server-side permission middleware.
- Implement audit logging, user/role administration foundation, responsive app shell, accessible component tokens and protected route patterns.
- Add integration tests for auth, brute-force controls/rate limiting, object/role access, disabled users, session expiration and audit logging.
- Verify direct API calls cannot bypass permissions and unauthorized users cannot read/download records.
- Stop and report after tests; wait for explicit approval before Phase 3.

## Phase 3 — Core master data: customers, locations, vehicles, drivers, documents
Only after Phase 2 approval.
- CRUD + details/history for customer/party, location, vehicles, drivers and associated document uploads/expiry data.
- Form validation, duplicate checks, server pagination/filtering, private file handling, availability and compliance views.
- Scheduled document expiry checks and deduplicated in-app notifications; provider/email alerts only if configured and approved.
- Excel template/download/import should be introduced first for customer/location/vehicle/driver master data using preview, row errors and explicit confirmation.
- Add tests for persistence, file authorization, required fields, duplicate identifiers, expiry reminders and import recovery.
- Stop and wait for approval.

## Phase 4 — Loads, multi-stop route data, LR, Bilty and generated documents
Only after Phase 3 approval.
- Implement loads and line items, multi-location ordered stops, atomic number generation, LR/Bilty relationships, allowed statuses and history.
- Implement document template/version configuration and PDF generation for LR, Bilty and loading slip as first tranche; add remainder of agreed document types where ready.
- Validate quantities, identifier uniqueness, authorization and concurrency; test PDFs for expected persisted values and page rendering.
- Stop and wait for approval.

## Phase 5 — Trip assignment, freight/expenses/advances, delivery, POD
Only after Phase 4 approval.
- Trip planning/assignment and conflict prevention; lifecycle/status transitions and history.
- Configurable freight/charge calculation engine, expenses, advances, deductions, balance and customer statements based on approved documented rules.
- Stop-level partial delivery with quantity reconciliation, POD upload and protected download, missing-POD tracking and trip closure validation.
- Financial and quantity invariant tests; audit financial edits.
- Stop and wait for approval.

## Phase 6 — Excel operations: complete imports, exports and bulk workflows
Only after Phase 5 approval.
- Complete robust `.xlsx`/`.csv` export for all permitted modules/reports, respecting full filter scope and authorization.
- Complete preview/validate/confirm imports, row-level error workbooks, idempotency, duplicate handling and async jobs for large files.
- Add safe column selection, bulk actions or bulk edit where approved, audit records, export history and download expiration.
- Security tests for formula injection, malicious workbook input, oversized files, unauthorized fields and records, partial failure and re-import.
- Demonstrate a real persisted test flow: create records → export → edit a copied sheet → preview/import → confirm → verify changed database rows → export again and compare data.
- Stop and wait for approval.

## Phase 7 — WhatsApp integration, message queue, webhooks, retries
Only after Phase 6 approval.
- Implement provider abstraction and at least one real provider adapter selected by the user/client; verify provider docs and template/media capabilities before coding against them.
- Add admin configuration health checks, masked credential status, previews, single send and approved event-triggered messages, PDF/media sharing if supported, rate limits, consent, webhook signature verification, idempotent delivery updates, retries and dead-letter/error view.
- Test with a clearly labeled test adapter, then run a real provider sandbox/delivered-message test only with credentials and appropriate authorization. Do not pretend a mock send is actual WhatsApp delivery.
- Stop and wait for approval.

## Phase 8 — Dashboard, reports, global search, notifications and admin completeness
Only after Phase 7 approval.
- Database-backed dashboard metrics; complete reports; server-side filters; global search; report exports; audit trail screen; admin control of settings/templates/numbering/permissions/message config.
- Check aggregation correctness against independently calculated test datasets. Every chart/KPI links to relevant results.
- Stop and wait for approval.

## Phase 9 — End-to-end hardening, SEO launch checklist, security, performance and deployment
Only after Phase 8 approval.
- Run full E2E across workflows: login → customer/location → vehicle/driver → load/multi-stop → LR/Bilty PDFs → trip assignment → messages if configured → partial/full delivery/POD → statements/report → Excel export/import → permission denied cases.
- Complete all 20 launch checks listed in Section 1B. For private authenticated routes, use `noindex`/robots restrictions as appropriate and never expose private records in sitemap or metadata. Privacy and contact pages must be accurate to the actual company/product; do not invent legal claims or contact details.
- Test all supported browsers/viewports, accessibility, broken links, 404, redirects, titles/descriptions/canonical/OG, optimized images, lazy loading, structured data, privacy-aware analytics, Search Console setup instructions and functioning contact form.
- Security hardening: dependencies, secrets, injection/XSS/CSRF/IDOR, upload permissions, headers, cookies, rate limits, webhook verification, export authorization, formula injection, log redaction and backup permissions.
- Performance: indexes/explain plans, pagination, aggregate/query efficiency, no N+1 loops, reasonable bundle, code splitting, caching only where safe, load test on representative datasets.
- Deployment config, environment variable checklist, HTTPS/proxy/cookie settings, Mongo backups and tested restore, migrations/index creation, health checks, alerting/logs, admin bootstrap, rollback and handover guide.
- Run all tests, lint, typecheck, build, e2e and security checks available in the repo. Fix critical/high-priority failures. Document anything blocked by external configuration.
- Stop and present release readiness report; do not deploy to a live production host or send real bulk communications without explicit user approval and credentials.

## Phase 10 — Optional client-approved enhancements, only after core release approval
Propose and implement only after user approval; don't conflate these with the base SOW:
- Optional map/route visualization using an authorized real mapping/telematics API (not fake live GPS).
- Scheduled customer email notifications or SMS (provider/charges must be configured and approved; SMS is not in baseline).
- Approval workflows, recurring maintenance tasks, enhanced analytics, OCR/document extraction, customer portal, ERP/accounting integrations, payment gateway, or native mobile app.
- Each enhancement needs scope, permission, cost/provider dependencies, test plan and separate approval.

---

# 8. PHASE GATE REPORT FORMAT

At the end of each phase, create/update `docs/PHASE_<N>_REPORT.md` and respond to the user using this structure:

1. **Phase and outcome:** Pass / Partial / Blocked (never mislabel).
2. **Completed:** exact features and files implemented.
3. **Data flow:** UI → API → validation/service → MongoDB/provider/storage → response, including a concrete working path.
4. **Tests run:** command, pass/fail counts and important evidence.
5. **Manual verification:** actual workflow steps and results; do not invent results.
6. **Security and permissions:** checks verified and remaining risks.
7. **Known gaps/blockers:** missing credentials/client decisions, unimplemented items, flaky tests and external dependencies.
8. **Traceability:** update SOW entries to `planned`, `implemented`, `tested`, `blocked` or `not applicable` with evidence.
9. **Next phase:** scope only; do not start it.
10. End with: `PHASE <N> COMPLETE — WAITING FOR EXPLICIT APPROVAL TO START PHASE <N+1>.`

If a phase fails its gate, fix it inside the current phase rather than skipping ahead. A user may ask for fixes within the current phase without authorizing the next one.

---

# 9. DEFINITION OF DONE — EACH FEATURE MUST PROVE ITS REAL DATA FLOW

A feature is done only when the relevant criteria below pass:
- Frontend form/table/details are connected to the real API and handle loading, empty, success, validation, unauthorized, server error and retry states.
- API route/controller validates inputs and permissions, calls the proper service/repository and persists/reads from MongoDB or the configured actual provider/storage.
- Database records have correct relationships, indexes, timestamps and audit information.
- Refreshing/reopening the page still shows the same saved data; signing out/in retains permitted business data.
- Updates/deletes are correctly persisted and reflected in all relevant detail/list/report screens. No stale hard-coded values.
- Concurrent number allocation and duplicate requests are safe/idempotent where needed.
- Search/filter/pagination/export agree with the same backend result set.
- Errors do not claim success; messages identify what failed and what action can be taken.
- Permissions are checked in the backend on every operation, including direct API access and documents/exports.
- Unit/integration/e2e tests cover the main behavior and relevant edge cases.
- No console errors, leaked secrets, fake “success” state, dead buttons or unlabelled test data in production.

Required proof scenarios across the completed system:
1. Create a customer and location; reload app and confirm persistence.
2. Create vehicle and driver; attach documents and observe expiry status.
3. Create a multi-stop load with material/weight/charges, assign vehicle/driver, generate a unique load number.
4. Create LR and Bilty; test duplicate-number rejection and PDF fields against stored data.
5. Create/assign trip; verify a conflicting vehicle/driver assignment is rejected or audited via explicit override.
6. Record partial delivery at a stop; quantity delivered + pending reconciles; attach POD and retrieve it only with permission.
7. Change a freight/expense value; server-computed balance and statements update and the action is audited.
8. Filter a report, export full filtered results to Excel, make a safe edit in a template, preview and confirm import, then verify database contents and re-export.
9. Send one WhatsApp message only if a real provider and required credentials are configured; verify actual provider response/webhook status. Otherwise prove that UI correctly reports Not configured and test adapter is not presented as real delivery.
10. Verify each role’s permitted/denied actions with direct API requests, not only menu visibility.

---

# 10. IMAGE-CHECKLIST RELEASE VALIDATION DETAILS

At Phase 9, make an explicit checklist report for these 20 image items: SSR/rendering strategy, robots.txt, sitemap.xml, unique title tags, meta descriptions, one H1 per public page, canonical URLs, Open Graph images, custom 404, 301 redirect rules, useful alt text, WebP/modern images, lazy loading, organization schema, breadcrumbs, internal links, analytics, Search Console setup/verification, privacy policy, functioning contact form.

For an authenticated operational app, SEO checks should focus on approved public pages. Private application content, generated LR/Bilty documents, customer records, downloads and dashboard routes must not be indexable or exposed through metadata/sitemap. Google Analytics/Search Console require real property/IDs/ownership access. Provide instructions if the operator must complete verification. Do not fabricate a successful verification. SSR is a decision to evaluate, not a box to tick at the expense of reliability; document why the chosen rendering mode is appropriate for the actual pages.

---

# 11. INITIAL INSTRUCTION TO THE CODING AGENT

**Start now with Phase 1 only.** Inspect the target repository, read the SOW (all five pages) and image checklist, study the reference repository’s relevant parts, and build the documented, evidence-backed plan. You may create only the minimal verified project foundation needed for baseline checks. Do not implement Phase 2+ features. Do not ask the user to repeat details already in the attached SOW. Where client-specific rules or credentials are unknown, document the exact question and implement no fake behavior.

At the end, deliver the Phase 1 report and STOP. Wait for the user's exact approval before starting Phase 2.
