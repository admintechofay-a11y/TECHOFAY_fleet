# Technofay Fleet & Transport Management Platform

Production-oriented, enterprise-grade **Fleet and Transport Management Web Application** designed for logistics operators, fleet teams, accounts departments, and transport management. Built on a modular MERN stack (MongoDB, Express.js, React 19, Node.js, TypeScript).

---

## 1. Architecture & Technology Stack

- **Backend:** Node.js (v24.x) + Express.js + TypeScript (Strict Mode)
- **Frontend:** React 19 + TypeScript + Vite + TailwindCSS + TanStack Query + React Hook Form + Zod
- **Database:** MongoDB (Local Service / Replica Set) with Mongoose ORM
- **Document Engine:** Server-side PDF generation (LR, Bilty, Loading Slip, Gate Pass, Delivery Challan)
- **Communications:** WhatsApp Business Provider abstraction (`IWhatsAppProvider` with Mock Adapter for dev/testing)
- **Spreadsheets:** Streaming `.xlsx` & `.csv` export/import engine with formula injection defense

---

## 2. Specification & Documentation Index

Comprehensive, evidence-based specifications are maintained in the [`docs/`](file:///c:/Users/HP/OneDrive/Desktop/technofy%20office%20work/fleet/docs) directory:

1. [SOW & Launch Traceability Matrix](file:///c:/Users/HP/OneDrive/Desktop/technofy%20office%20work/fleet/docs/SOW_TRACEABILITY.md): Maps all 26 SOW sections and 20 image launch checklist items to planned phases, APIs, and tests.
2. [Reference Repository Technical Audit](file:///c:/Users/HP/OneDrive/Desktop/technofy%20office%20work/fleet/docs/REFERENCE_REPO_AUDIT.md): Evidence-based inspection of `Transport_techofay` with reuse rules and defect remediations.
3. [System Architecture & Specifications](file:///c:/Users/HP/OneDrive/Desktop/technofy%20office%20work/fleet/docs/ARCHITECTURE.md): Monorepo structure, error envelope, JWT/cookie auth, multi-tenancy, and sequence numbering.
4. [Data Model & Entity Relationships](file:///c:/Users/HP/OneDrive/Desktop/technofy%20office%20work/fleet/docs/DATA_MODEL.md): Full MongoDB collection schemas, Mermaid ERD, indexes, and monetary Paise strategy.
5. [Role-Based Access Control (RBAC) Matrix](file:///c:/Users/HP/OneDrive/Desktop/technofy%20office%20work/fleet/docs/ROLE_PERMISSION_MATRIX.md): Detailed permission matrix for 8 roles across 22 modules.
6. [Business Rules & Calculation Engine](file:///c:/Users/HP/OneDrive/Desktop/technofy%20office%20work/fleet/docs/BUSINESS_RULES.md): Formulas for GTA GST (SAC 9965), freight charges, state machines, and dispatch conflict checks.
7. [Decisions & Open Questions Log](file:///c:/Users/HP/OneDrive/Desktop/technofy%20office%20work/fleet/docs/DECISIONS_AND_OPEN_QUESTIONS.md): Architectural decisions and client decisions requiring input.
8. [Phased Implementation Roadmap](file:///c:/Users/HP/OneDrive/Desktop/technofy%20office%20work/fleet/docs/PHASE_PLAN.md): 10-phase execution plan with strict verification gates.
9. [Client Dependencies & Onboarding Checklist](file:///c:/Users/HP/OneDrive/Desktop/technofy%20office%20work/fleet/docs/DEPENDENCY_CHECKLIST.md): Required assets, templates, and credentials.
10. [Phase 1 Verification Report](file:///c:/Users/HP/OneDrive/Desktop/technofy%20office%20work/fleet/docs/PHASE_1_REPORT.md): Acceptance gate verification evidence.

---

## 3. Getting Started & Verification Commands

### Prerequisites
- **Node.js:** v18.x or higher (v24.9.0 detected)
- **MongoDB:** v6.0 or higher (Running locally on `127.0.0.1:27017`)
- **Git:** Installed and initialized

### Setup & Baseline Health Check
```powershell
# 1. Inspect environment and specifications
npm run check:env

# 2. Execute automated Phase 1 baseline acceptance tests
npm run test:phase1
```

---

## 4. Current Phase Status

- **Current Phase:** Phase 1 (Discovery, Audit & Baseline Planning) — **COMPLETED**
- **Next Phase:** Phase 2 (Foundation, IAM, RBAC, Audit & App Shell)
- **Execution Gate:** Hard stop active. Awaiting explicit user approval command: `APPROVE PHASE 1 — START PHASE 2`.
