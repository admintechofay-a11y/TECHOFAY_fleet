import React from 'react';

interface TermsPageProps {
  onNavigateHome?: () => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onNavigateHome }) => {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: '840px', margin: '0 auto' }}>
        {/* Navigation Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🚚</span>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--accent-cyan)' }}>
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
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
          Terms of Service &amp; Operational Agreement
        </h1>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
          Effective Date: October 24, 2026 • Transport Platform Master Agreement
        </div>

        {/* Content Body */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '14px', lineHeight: 1.7, fontSize: '0.925rem', color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
          <section style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              1. Platform Usage &amp; Eligibility
            </h2>
            <p>
              The Technofay Fleet Management Platform is provided for licensed commercial transport operators, fleet owners, freight forwarders, and authorized logistics personnel. Authorized users must maintain active credentials and comply with statutory road safety and transport regulations.
            </p>
          </section>

          <section style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              2. Goods Transport Agency (GTA) Declarations &amp; GST
            </h2>
            <p>
              Invoices and consignment documents generated via the platform apply statutory Goods Transport Agency SAC Code 9965. Unless explicitly configured otherwise, GST at 5% applies under Reverse Charge Mechanism (RCM) or forward charge as per registered customer GSTIN status. Transporters are solely responsible for filing periodic GSTR returns matching generated ledgers.
            </p>
          </section>

          <section style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              3. Proof of Delivery &amp; Consignment Finality
            </h2>
            <p>
              A consignment is deemed delivered upon recording verified delivery timestamps, consignee physical or digital signature, and confirmed Proof of Delivery (POD) upload. Shortages, damages, or discrepancies must be recorded upon delivery challan generation.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              4. Governing Law &amp; Jurisdiction
            </h2>
            <p>
              These terms are governed by the laws of the Republic of India. Any legal disputes arising out of the platform's operation shall be subject to the exclusive jurisdiction of the competent courts in India.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
