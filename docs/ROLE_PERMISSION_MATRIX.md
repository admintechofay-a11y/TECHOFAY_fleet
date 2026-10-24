# Role-Based Access Control (RBAC) & Permission Matrix

**Platform:** MERN Fleet & Transport Management Platform  
**Scope:** Server-Side Permission Resolution & Middleware Enforcement  

---

## 1. System Roles Overview

The platform defines 8 distinct operational roles based on SOW Section 18:

1. **Super Administrator (`super_admin`):** Full tenant administration, user provisioning, role customization, system settings, audit trail access, and emergency overrides.
2. **Administrator (`admin`):** Operational oversight, master data control, user management (except super-admin roles), report generation, and configuration review.
3. **Transport Manager (`transport_manager`):** Full dispatch management, load assignment, LR issuance, Bilty management, trip authorization, and carrier operations.
4. **Fleet Manager (`fleet_manager`):** Vehicle registry, maintenance tracking, driver onboarding, vehicle/driver document compliance, and expiry resolution.
5. **Operations Manager (`operations_manager`):** Load creation, multi-stop routing, stop arrival/departure logging, delivery tracking, and POD review.
6. **Data Entry Operator (`data_entry`):** Routine record entry (loads, customer parties, locations, vehicle documents). No financial edit or deletion privileges.
7. **Accounts User (`accounts`):** Financial charge management, freight statements, customer ledger entries, advances/deductions, payment tracking, and financial report exports.
8. **Management User (`management`):** Read-only executive visibility into dashboards, analytics, fleet utilization, financial statements, and high-level reports.

---

## 2. Fine-Grained Permissions Matrix

**Legend:**
- **V:** View / Read
- **A:** Add / Create
- **E:** Edit / Update
- **D:** Delete / Archive
- **X:** Export (Excel/CSV)
- **M:** Admin / Config / Direct Override
- **—:** No Access (403 Forbidden)

| Module / Subsystem | Super Admin | Admin | Transport Manager | Fleet Manager | Operations Manager | Data Entry | Accounts User | Management User |
|---|---|---|---|---|---|---|---|---|
| **Authentication & Profile** | V, A, E, D, M | V, E | V, E | V, E | V, E | V, E | V, E | V, E |
| **User & Role Admin** | V, A, E, D, M | V, A, E | — | — | — | — | — | — |
| **Loads Management** | V, A, E, D, X, M | V, A, E, D, X | V, A, E, X | V | V, A, E | V, A | V, X | V, X |
| **Multi-Stop Routing** | V, A, E, D, M | V, A, E, D | V, A, E | — | V, A, E | V, A | V | V |
| **LR Issuance** | V, A, E, D, X, M | V, A, E, D, X | V, A, E, X | V | V, A, E | V, A | V, X | V, X |
| **Bilty / Consignment** | V, A, E, D, X, M | V, A, E, D, X | V, A, E, X | — | V | V, A | V, A, E, X | V, X |
| **Trip Dispatch** | V, A, E, D, X, M | V, A, E, D, X | V, A, E, X | V, E | V, A, E | — | V | V, X |
| **Fleet & Vehicles** | V, A, E, D, X, M | V, A, E, D, X | V | V, A, E, D, X | V | V, A | V | V, X |
| **Vehicle Documents** | V, A, E, D, X, M | V, A, E, D, X | V | V, A, E, D, X | V | V, A | — | V |
| **Drivers Management** | V, A, E, D, X, M | V, A, E, D, X | V | V, A, E, D, X | V | V, A | — | V, X |
| **Driver Documents** | V, A, E, D, X, M | V, A, E, D, X | V | V, A, E, D, X | V | V, A | — | V |
| **Customers / Parties** | V, A, E, D, X, M | V, A, E, D, X | V, A, E | — | V, A | V, A | V, A, E, X | V, X |
| **Location Master** | V, A, E, D, X, M | V, A, E, D, X | V, A, E | — | V, A, E | V, A | V | V |
| **Freight & Billing** | V, A, E, D, X, M | V, A, E, X | V, A | — | V | — | V, A, E, X, M | V, X |
| **Delivery & POD** | V, A, E, D, X, M | V, A, E, D, X | V, A, E | V | V, A, E, M | V, A | V, E | V, X |
| **PDF Generation** | V, A, X, M | V, A, X | V, A, X | V, X | V, A, X | V | V, A, X | V, X |
| **WhatsApp Messaging** | V, A, X, M | V, A, X | V, A | — | V, A | — | V | V |
| **Executive Dashboard** | V, M | V | V | V | V | — | V | V |
| **Reports & Analytics** | V, X, M | V, X | V, X | V, X | V, X | — | V, X | V, X |
| **Excel Import / Export** | V, A, X, M | V, A, X | V, X | V, X | V, X | — | V, X | V, X |
| **Company Settings** | V, A, E, D, M | V, E | — | — | — | — | — | — |
| **Audit Log Trail** | V, X, M | V, X | — | — | — | — | — | V |

---

## 3. Server-Side Enforcement Rules

1. **Route-Level Permission Guard:**
   ```typescript
   router.post('/api/v1/loads', requirePermission('loads', 'add'), createLoadHandler);
   router.delete('/api/v1/vehicles/:id', requirePermission('vehicles', 'delete'), deleteVehicleHandler);
   ```
2. **Hierarchy Rule:** A user cannot assign or modify a role with higher privileges than their own. Only `super_admin` can manage system settings, WhatsApp credentials, and view raw audit logs.
3. **No Self-Demotion / Lockout:** The last active Super Administrator in an organization cannot be demoted, deactivated, or deleted.
4. **Export Authorization:** The `export` action (`X`) is explicitly checked by streaming endpoints (`/api/v1/:module/export`). Users without export privileges cannot trigger CSV or XLSX generation.
