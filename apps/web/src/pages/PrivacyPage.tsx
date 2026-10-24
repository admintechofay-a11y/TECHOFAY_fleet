import React from 'react';

interface PrivacyPageProps {
  onNavigateHome?: () => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onNavigateHome }) => {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0f1d', color: '#f8fafc', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: '840px', margin: '0 auto' }}>
        {/* Navigation Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🚚</span>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', color: '#38bdf8' }}>
              TECHNOFAY FLEET OS
            </span>
          </div>
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}
            >
              ← Back to Portal
            </button>
          )}
        </div>

        {/* Header */}
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.03em' }}>
          Privacy Policy
        </h1>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
          Last Updated: October 24, 2026 • Version 1.0 (India DPDP Act &amp; Statutory Transport Compliance)
        </div>

        {/* Content Body */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '14px', lineHeight: 1.7, fontSize: '0.925rem', color: '#cbd5e1' }}>
          <section style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.75rem' }}>
              1. Information We Collect
            </h2>
            <p>
              Technofay Transport Solutions Pvt Ltd operates the Technofay Fleet Management Platform. We collect and process operational haulage records essential for transport execution, statutory consignment compliance, and road safety:
            </p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li><strong>Transport Entity Data:</strong> Consignor and consignee corporate names, registered business addresses, and GSTIN numbers.</li>
              <li><strong>Fleet Regulatory Documentation:</strong> Vehicle RC, fitness certificates, national permits, and PUC expiry dates for road transport verification.</li>
              <li><strong>Driver Operational Records:</strong> Commercial Driving Licence (DL) numbers, licensing authorities, emergency contacts, and contact numbers.</li>
              <li><strong>Consignment &amp; Waypoint Telemetry:</strong> Loading slips, Lorry Receipts (LR), Bilty consignment notes, stop coordinates, and delivery Proof of Delivery (POD) confirmations.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.75rem' }}>
              2. How We Use Transport Information
            </h2>
            <p>
              Your data is utilized strictly for executing road freight contracts, generating statutory Goods Transport Agency (GTA) documentation under SAC 9965, sending operational dispatch updates via WhatsApp Business API, and maintaining regulatory audit trails. We never sell or monetize transport data to third-party advertising networks.
            </p>
          </section>

          <section style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.75rem' }}>
              3. Data Security &amp; Tenant Isolation
            </h2>
            <p>
              All tenant data is strictly isolated by dedicated company IDs (<code style={{ color: '#38bdf8' }}>companyId</code>). Encryption in transit via TLS 1.3 and encryption at rest with AES-256 is enforced across all document and database storage tiers. Passwords are cryptographically hashed using Argon2id/Bcrypt.
            </p>
          </section>

          <section style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.75rem' }}>
              4. Data Retention &amp; Statutory Requirements
            </h2>
            <p>
              Consignment notes (LR/Bilty) and freight ledgers are retained in accordance with the Central Goods and Services Tax (CGST) Act and Motor Vehicles Act for a minimum statutory period of 6 years.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.75rem' }}>
              5. Contact &amp; Grievance Officer
            </h2>
            <p>
              For privacy inquiries, data access requests, or regulatory audits, contact our Grievance Officer at <a href="mailto:privacy@technofay.com" style={{ color: '#38bdf8' }}>privacy@technofay.com</a> or via our official contact channel.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
