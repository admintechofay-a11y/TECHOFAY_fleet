# Architecture Decisions & Client Open Questions Log

**Platform:** MERN Fleet & Transport Management Platform  
**Status:** Phase 1 Implementation Baseline  
**Governing Rule:** No unconfirmed business rules or client assumptions may be silently hardcoded. All unfinalized rules must use conservative, documented defaults and provide configuration toggles.

---

## 1. Architectural Decisions Made for Baseline Foundation

| Decision ID | Decision Title | Selected Implementation Choice | Architectural Rationale | Configuration Fallback |
|---|---|---|---|---|
| **ADR-01** | **Monorepo Architecture** | Modular Monorepo (`apps/api`, `apps/web`, `packages/shared`, `docs/`) | Enables end-to-end TypeScript type safety, unified DTO contracts, and independent deployments. | Monorepo root manages dependencies cleanly with npm workspaces. |
| **ADR-02** | **Monetary Arithmetic** | Integer Paise (`1 INR = 100 Paise`) | Floating point arithmetic in JavaScript (`0.1 + 0.2 !== 0.3`) causes ledger discrepancies and regulatory audit failures. | Display formatters automatically divide by 100 to present rupees with two decimal places. |
| **ADR-03** | **Concurrency-Safe Sequencing** | Atomic MongoDB `$inc` on `Sequence` collection scoped by company and year | Eliminates race-condition number duplication when multiple dispatchers create loads concurrently. | Compound unique index `{ companyId: 1, sequenceKey: 1, year: 1 }` guarantees database-level isolation. |
| **ADR-04** | **Data Authority & Storage** | MongoDB is the Single Source of Truth; no client-side persistence of operational data | Reference repo audit defect `DATA-01` proved that dual-writing to localStorage Zustand stores causes ghost records and data corruption. | Zustand in React frontend is restricted strictly to transient UI state (e.g. sidebar collapsed, active modal). |
| **ADR-05** | **WhatsApp Integration Strategy** | Clean Provider Interface (`IWhatsAppProvider`) with Mock Adapter default | Allows complete local development and automated testing without requiring live WhatsApp Business API credentials. | Real adapter (`Interakt` / `Twilio`) activates automatically when verified credentials are provided in settings. |
| **ADR-06** | **Document Templates** | Polished standard generic template marked `SAMPLE — REQUIRES CLIENT APPROVAL` | Complies with SOW Section 23; never pretend client approval was obtained before the client supplies physical stationery templates. | Template layout parameters (margins, logo, GST footer, terms) are configurable in database. |

---

## 2. Business Decisions Needing Client Input

The following items require explicit confirmation from the client/stakeholders during the requirement gathering and UI/UX review window:

### 2.1 Multi-Tenancy & Company Model
- **Question:** Is this deployment intended strictly for a **single dedicated enterprise** (Techofay / Barkat Tempo Service) or will it operate as a **multi-tenant SaaS platform** hosting multiple transport organizations?
- **Current Conservative Baseline:** Multi-tenant architecture implemented by default (`companyId` scoped on all queries). For a single enterprise, a single root organization is provisioned, ensuring future SaaS capability without refactoring.

### 2.2 Sequence Numbering & Financial Year Reset Policy
- **Question:** Should sequential numbers (LR, Bilty, Load, Trip) reset on the **Calendar Year (Jan 1)** or the **Indian Financial Year (April 1 – March 31)**?
- **Question:** What are the client's official custom prefixes? (e.g. `BTS/LR/26-27/001` or `LR-2026-00001`?)
- **Current Conservative Baseline:** Default format `${prefix}-${year}-${sequence}` (e.g. `LR-2026-00001`) with configurable prefix and reset window in `CompanySettings`.

### 2.3 Goods Transport Agency (GTA) GST & Billing Rules
- **Question:** Does the client operate under **5% GST without Input Tax Credit (ITC)** (reverse charge / forward charge GTA) or **12% GST with ITC**?
- **Question:** Are loading, unloading, and detention charges subject to the same GST rate as base freight on the consignment note?
- **Current Conservative Baseline:** Default 5.0% GTA rate under SAC code `9965` applied to all taxable components. Fully configurable per customer and company in `billingEngine`.

### 2.4 Load-to-Trip Cardinality
- **Question:** Is the relationship strictly **one load per trip**, or can a vehicle consolidate **multiple loads / consignments into a single consolidated trip**?
- **Current Conservative Baseline:** Data model supports array of `loadIds` on a `Trip`, but default UI workflow assumes one primary load per trip with multi-stop waypoints.

### 2.5 Delivery & POD Closure Signoff Policy
- **Question:** Does a driver's upload of a signed delivery challan immediately transition the LR to `POD_CLOSED`, or is a **formal verification step by an Operations/Accounts supervisor** required before closing?
- **Current Conservative Baseline:** Two-stage workflow: driver/operator marks `DELIVERED` with uploaded image; status moves to `SUBMITTED`; accounts/supervisor clicks "Verify & Close" to reach `POD_CLOSED`.

### 2.6 WhatsApp Provider & Official Template Approvals
- **Question:** Which official WhatsApp Business Solution Provider (BSP) does the client use? (Options: Interakt, Twilio, Gupshup, Wati, AiSensy, Meta Cloud API?)
- **Question:** Have official WhatsApp HSM templates been submitted and approved by Meta for:
  1. Load Created & Dispatched
  2. Bilty / LR PDF Delivery
  3. Delivery Confirmation & POD
- **Current Conservative Baseline:** `MockWhatsAppAdapter` configured for development; adapter interface ready for Interakt/Twilio credentials.

### 2.7 Production Storage & Backup Retention
- **Question:** Will uploaded vehicle compliance documents and POD images be stored on a **local private file volume** or **Amazon S3 / DigitalOcean Spaces / Azure Blob**?
- **Question:** What is the required retention and automated backup rehearsal schedule for audit logs and tax documents? (Default recommendation: 7 years for GST audit compliance).
- **Current Conservative Baseline:** Local private filesystem storage driver implemented with seamless S3 adapter pluggability.
