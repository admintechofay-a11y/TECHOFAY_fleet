# Client Dependencies & Onboarding Checklist

**Platform:** MERN Fleet & Transport Management Platform  
**Purpose:** Outlines all assets, master data, third-party credentials, and commercial approvals required from the client/stakeholders to facilitate production deployment.

---

## 1. Company Branding & Document Media

| Item # | Dependency Description | Required Format / Specs | Target Phase | Status |
|---|---|---|---|---|
| **1.1** | **Primary Company Logo** | High-resolution transparent PNG / SVG (minimum 800x200px) for UI header and PDF document headers. | Phase 4 | Pending Client Delivery |
| **1.2** | **Authorized Digital Signature Block** | Transparent PNG scan of authorized signatory signature/stamp for Bilty/LR issuance. | Phase 4 | Pending Client Delivery |
| **1.3** | **Company Legal & GST Particulars** | Exact Legal Entity Name, Trade Name, GSTIN, PAN, Registered Office Address, Contact Numbers, and Official Billing Email. | Phase 2 | Pending Client Delivery |
| **1.4** | **Standard Terms & Conditions** | Legally vetted transportation terms and liability clauses to print on the reverse or footer of LR and Bilty documents. | Phase 4 | Pending Client Delivery |

---

## 2. Master Data for Initial System Import

To eliminate manual data entry during launch, provide existing records using the system's Excel templates:

| Data Category | Required Fields | Template Available | Status |
|---|---|---|---|
| **Customer / Party Master** | Company Name, GSTIN, PAN, Primary Contact (Name, Phone, Email), Billing Address, Delivery Hub Addresses, Payment Terms (Days) | Yes (`templates/customers_import_template.xlsx`) | Ready for Client Data |
| **Fleet / Vehicle Registry** | Vehicle Plate Number, Vehicle Type (Trailer/Truck/Tempo), Category (Owned/Attached/Market), Make, Model, Capacity (MT), Engine #, Chassis #, Owner Name/Phone | Yes (`templates/vehicles_import_template.xlsx`) | Ready for Client Data |
| **Vehicle Compliance Docs** | Vehicle Plate, Document Type (RC, Insurance, Fitness, PUC, National Permit), Document Number, Expiry Date | Yes (`templates/vehicle_docs_template.xlsx`) | Ready for Client Data |
| **Driver Roster** | Driver Full Name, Mobile Phone, Alternate Phone, Driving License Number, License Category (HMV/LMV/Trans), License Expiry Date, Emergency Contact | Yes (`templates/drivers_import_template.xlsx`) | Ready for Client Data |
| **Hub / Location Master** | Location Name (Hub/Factory), Address, City, State, Pincode, Contact Person, Contact Phone | Yes (`templates/locations_import_template.xlsx`) | Ready for Client Data |

---

## 3. Business Logic & Calculation Policies

| Rule Category | Options / Questions Requiring Decision | Default Baseline Configured | Client Confirmation |
|---|---|---|---|
| **GTA GST Tax Policy** | 5.0% without ITC (SAC 9965) vs 12.0% with ITC forward charge | 5.0% without ITC (SAC 9965) | Pending Confirmation |
| **Sequence Numbering** | Calendar Year (Jan 1) reset vs Indian Financial Year (April 1) reset | Calendar Year (2026) | Pending Confirmation |
| **Document Prefixes** | Custom business prefix (e.g., `BTS/LR/` vs `LR-2026-`) | `LR-`, `BL-`, `LD-`, `TR-` | Configurable in Settings |
| **POD Closure Policy** | Immediate closure on driver photo upload vs mandatory supervisor audit | Two-stage supervisor verification | Configurable in Settings |
| **Consolidation Rule** | Strict 1 load per trip vs multi-consignment consolidation | Multi-stop waypoints per load | Configurable in Settings |

---

## 4. Third-Party Integrations & Hosting Infrastructure

| Integration / Account | Provider / Credentials Required | Purpose | Status |
|---|---|---|---|
| **WhatsApp Business API** | Provider selection (Interakt, Twilio, or Meta Cloud API), API Key, Account ID, Webhook Secret | Operational notifications and PDF document dispatch | Mock Adapter Active (Awaiting Production Credentials) |
| **Meta HSM Templates** | Approved WhatsApp message template names and parameter mappings for transactional alerts | Regulatory compliance with Meta WhatsApp policy | Pending Meta Template Submission |
| **Production Server** | Ubuntu 22.04 LTS VPS / Cloud Server (minimum 4GB RAM, 2 vCPU, 50GB SSD) with Node.js and MongoDB | Production application hosting | Pending Client Environment Provisioning |
| **Domain & SSL** | Dedicated domain name (e.g. `fleet.technofay.com` or `barkattempo.com`) and DNS access for SSL setup | Secure HTTPS web access | Pending Client Domain Allocation |
| **Cloud Storage (Optional)** | AWS S3 Bucket / DigitalOcean Space with IAM access credentials (if local volume not used) | Encrypted storage for private compliance documents | Local Private Storage Driver Active |
