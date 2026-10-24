# System Architecture & Technical Specifications

**Platform:** MERN Fleet & Transport Management Platform  
**Architecture Style:** Modular Monorepo (Node.js/Express + React/Vite + TypeScript + MongoDB)  
**Version:** 1.0.0 (Phase 1 Baseline)  

---

## 1. Monorepo Structure & Organization

The codebase is structured as a clean, type-safe monorepo separating concerns while sharing core contracts:
- `apps/api`: Node.js + Express + TypeScript backend micro-services, REST APIs, and business domain logic.
- `apps/web`: React 19 + Vite + TypeScript frontend operations terminal, design system, and responsive UI.
- `packages/shared`: Shared TypeScript schemas, enums, DTO interfaces, and cross-cutting contracts.

```text
fleet/
├── apps/
│   ├── api/                     # Node.js + Express + TypeScript Backend
│   │   ├── src/
│   │   │   ├── config/          # Environment validation & DB connection
│   │   │   ├── middleware/      # Auth, RBAC, tenant, rate-limit, error handler
│   │   │   ├── modules/         # Domain modules (auth, loads, lr, bilties, trips, fleet, etc.)
│   │   │   │   ├── [module]/
│   │   │   │   │   ├── *.controller.ts
│   │   │   │   │   ├── *.service.ts
│   │   │   │   │   ├── *.model.ts
│   │   │   │   │   ├── *.validation.ts
│   │   │   │   │   └── *.routes.ts
│   │   │   ├── services/        # Cross-cutting services (PDF, Excel, WhatsApp, Storage)
│   │   │   ├── app.ts           # Express application initialization
│   │   │   └── server.ts        # Server bootstrap & graceful shutdown
│   │   ├── tests/               # Integration & unit tests (Supertest + Vitest)
│   │   └── package.json
│   │
│   └── web/                     # React 19 + Vite + TypeScript Frontend
│       ├── src/
│       │   ├── assets/          # Icons, branding images (WebP)
│       │   ├── components/      # Design system primitives (Button, Table, Modal, Card)
│       │   ├── hooks/           # Domain & utility hooks
│       │   ├── layouts/         # AppShell (Sidebar, Header, Breadcrumbs) & AuthLayout
│       │   ├── lib/             # API client (Axios), QueryClient, date/currency formatters
│       │   ├── pages/           # Route views (Dashboard, Loads, Bilties, Trips, Admin, etc.)
│       │   ├── stores/          # Zustand client-only UI state (sidebar collapsed, theme)
│       │   ├── App.tsx          # Root routing & error boundary
│       │   └── main.tsx         # Client mount
│       ├── tests/               # Component & E2E tests (Vitest + Playwright)
│       └── package.json
│
├── packages/
│   └── shared/                  # Shared TypeScript types, enums & Zod schemas
│       ├── src/
│       │   ├── enums/           # Role, Status, DocumentType, ChargeType
│       │   ├── schemas/         # Shared Zod validation schemas
│       │   └── types/           # API request/response DTO interfaces
│       └── package.json
│
├── docs/                        # Specifications, SOW traceability, architecture, reports
├── infra/                       # Dockerfile, docker-compose, backup scripts
├── .env.example                 # Safe environment configuration template
└── package.json                 # Monorepo root scripts & workspace config
```

---

## 2. API Design & Standardized Error Contract

All RESTful endpoints are versioned under `/api/v1/`. The API enforces a strictly uniform response envelope.

### 2.1 Success Response Envelope
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Resource retrieved successfully",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 25,
    "totalRecords": 142,
    "totalPages": 6
  }
}
```

### 2.2 Error Response Envelope
```json
{
  "success": false,
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Validation failed for one or more fields",
  "errors": [
    {
      "field": "freightAmount",
      "message": "Freight amount must be a positive number",
      "code": "INVALID_NUMERIC_VALUE"
    }
  ],
  "correlationId": "req_8f1a7b3c-9e2d-4f1a-b3c9-e2d4f1ab3c9e",
  "timestamp": "2026-10-24T12:00:00.000Z"
}
```

### 2.3 HTTP Status Codes Enforced
- `200 OK`: Successful read/update.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Malformed JSON or invalid syntax.
- `401 Unauthorized`: Missing, expired, or invalid authentication credentials.
- `403 Forbidden`: Authenticated user lacks permission or attempted cross-tenant access.
- `404 Not Found`: Resource does not exist within the authorized company scope.
- `409 Conflict`: Duplicate key conflict (e.g., existing vehicle plate or manual LR number).
- `422 Unprocessable Entity`: Zod / schema validation failure.
- `429 Too Many Requests`: Rate limit threshold exceeded.
- `500 Internal Server Error`: Masked server error. Detailed stack trace is logged with `correlationId` to private server logs and **never** returned to client.

---

## 3. Authentication, Session & Authorization (RBAC)

### 3.1 Authentication Workflow
1. **Password Hashing:** Passwords hashed with `bcryptjs` (work factor 12) or `argon2id`.
2. **Token Strategy:**
   - **Access Token:** Short-lived JWT (15 minutes expiry) signed with `JWT_SECRET`. Carries `{ userId, email, companyId, roleId }`.
   - **Refresh Token:** Long-lived cryptographically random token (7 days expiry) stored in database (`UserSession` collection) with device/IP hash and delivered via `httpOnly`, `Secure` (in production), `SameSite=Lax` cookie.
   - **Refresh Rotation:** Each refresh request invalidates the old token and issues a new pair. If a revoked refresh token is presented, all sessions for that user are immediately invalidated (theft detection).
3. **Session Revocation:** Logout explicitly invalidates the refresh session in MongoDB and clears the browser cookie.
4. **Brute Force Protection:** Dedicated rate limiter on `/api/v1/auth/login` (maximum 5 failed attempts per IP/account per 15 minutes).

### 3.2 Authorization (RBAC) Engine
- Middleware `requirePermission(module, action)` evaluates the authenticated user's assigned role against the permissions matrix.
- Verification is strictly enforced at the API route layer before invoking any business service.
- Frontend menu hiding is treated as a visual convenience, not a security boundary.

---

## 4. Multi-Tenancy & Data Isolation Model

1. **Company Scoping:** Every operational document collection (`loads`, `lr_numbers`, `bilties`, `trips`, `vehicles`, `drivers`, `customers`, `locations`, `invoices`, `proofs`) contains a required, indexed field:
   ```typescript
   companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true }
   ```
2. **Tenant Middleware:** `enforceTenantScope` extracts `companyId` from the verified token and attaches it to `req.tenant`.
3. **Query Guard:** All database read/write queries automatically inject `{ companyId: req.tenant.companyId }`. Direct URL access using another tenant's ObjectId returns `404 Not Found` (preventing IDOR).

---

## 5. Concurrency-Safe Number Sequence Allocation

Transport platforms experience concurrent bookings during dispatch peaks. Finding the latest number (`find().sort().limit(1)`) causes race collisions.

### 5.1 Atomic Counter Model (`sequences` Collection)
```typescript
{
  companyId: ObjectId,
  key: "LR_NUMBER" | "BILTY_NUMBER" | "LOAD_NUMBER" | "TRIP_NUMBER",
  year: 2026,
  prefix: "LR-",
  currentSequence: 1042
}
```

### 5.2 Atomic Allocation Logic
```typescript
const seqRecord = await Sequence.findOneAndUpdate(
  { companyId, key, year },
  { $inc: { currentSequence: 1 } },
  { new: true, upsert: true }
);
const formattedNumber = `${seqRecord.prefix}${year}-${String(seqRecord.currentSequence).padStart(5, '0')}`;
// Result: LR-2026-01043
```
In the event of user-entered manual LR numbers, unique compound indexes `{ companyId: 1, lrNumber: 1 }` guarantee database-level conflict rejection with a clean `409 Conflict` feedback message.

---

## 6. Private File Storage & Document Protection

1. **Private By Default:** Documents (RC, Driving Licence, Fitness, Proof of Delivery photos/PDFs) are **never** served from a public web root.
2. **Storage Abstraction (`IStorageService`):**
   - **Local Storage Driver:** Stored under a private directory `./uploads/tenants/:companyId/:module/` outside the web root.
   - **S3 Storage Driver:** Stored in a private AWS S3 bucket with server-side encryption (`AES-256`).
3. **MIME & Magic-Byte Validation:** File uploads are checked for actual binary magic bytes (preventing file extension spoofing). Allowed types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`. Maximum size: 15 MB.
4. **Authorized Delivery:** Files are retrieved via authenticated proxy endpoints (`GET /api/v1/documents/:id/download`) or short-lived pre-signed URLs (5-minute expiration) verified against user permissions.

---

## 7. WhatsApp Communication Engine

1. **Provider Abstraction (`IWhatsAppProvider`):**
   ```typescript
   interface IWhatsAppProvider {
     sendMessage(toPhone: string, templateName: string, variables: Record<string, string>): Promise<WhatsAppSendResult>;
     sendPdf(toPhone: string, pdfUrl: string, caption: string, fileName: string): Promise<WhatsAppSendResult>;
     sendCustomMessage(toPhone: string, message: string): Promise<WhatsAppSendResult>;
     verifyWebhookSignature(signature: string, payload: any): boolean;
   }
   ```
2. **Mock Adapter for Local Development / Testing:**
   - Logs message payloads to MongoDB `message_logs` with status `MOCK_DELIVERED`.
   - Never communicates externally.
   - Distinct UI badge: `MOCK ADAPTER (DEVELOPMENT)`.
3. **Production Provider (Interakt / Twilio):**
   - Credentials configured securely in backend environment/settings with masked display (`••••••••abcd`).
   - Webhooks verified using HMAC SHA256 signatures.
   - Outbound queue with exponential backoff retry for failed delivery.

---

## 8. Excel & CSV Import/Export Architecture

1. **Export Engine:**
   - Uses `exceljs` for `.xlsx` and `csv-stringify` for `.csv`.
   - Sanitizes cells against **CSV/Formula Injection** (escaping leading `=`, `+`, `-`, `@`, `\t`, `\r`).
   - Streams large datasets via database cursor to avoid memory spikes.
   - Exports reflect exact server-side filtered records (not merely the visible paginated page).
2. **Import Engine (Dry-Run / Preview Workflow):**
   - Step 1: Upload workbook (`.xlsx` or `.csv`).
   - Step 2: Validate file structure, headers, and row types in memory.
   - Step 3: Run comprehensive dry-run validation (required fields, phone regex, GSTIN format, foreign key existence, duplicate plate/phone checks).
   - Step 4: Return preview summary to user with created counts and an itemized error table (Row #, Field, Error Message).
   - Step 5: User explicitly clicks "Confirm Import". Records are persisted in atomic batches.

---

## 9. Comprehensive Audit Logging System

Every security event, status change, financial edit, and administrative action is written to an append-only `audit_logs` collection:
- `actorId`: User ID who initiated action (or `system` for cron jobs)
- `companyId`: Tenant scope
- `module`: `AUTH`, `LOADS`, `LR`, `BILTIES`, `TRIPS`, `FLEET`, `BILLING`, `SETTINGS`
- `action`: `CREATE`, `UPDATE`, `DELETE`, `STATUS_TRANSITION`, `EXPORT`, `LOGIN_FAILED`
- `entityId`: Reference to target record
- `changes`: Before/After diff for audited fields
- `ipAddress`: Client IP address
- `userAgent`: Client browser/device agent
- `timestamp`: UTC ISO timestamp
Audit logs are immutable: ordinary users and administrators have no delete/edit permissions on this collection.
