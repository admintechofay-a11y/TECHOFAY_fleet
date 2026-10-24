import React, { useState, useEffect } from 'react';
import { apiRequest, apiDownload } from '../lib/api';
import { PdfViewerModal } from '../components/PdfViewerModal';

export const BiltiesPage: React.FC = () => {
  const [bilties, setBilties] = useState<any[]>([]);
  const [lrs, setLrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [termsFilter, setTermsFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // PDF Viewer Modal State
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    endpoint: string;
    title: string;
    documentNumber: string;
    whatsappPhone?: string;
  }>({
    isOpen: false,
    endpoint: '',
    title: '',
    documentNumber: ''
  });

  // Form State
  const [formData, setFormData] = useState({
    lrId: '',
    paymentTerms: 'TO_PAY',
    totalFreightRupees: '',
    advanceRupees: '0',
    remarks: ''
  });

  // Fetch Bilties
  const fetchBilties = async (page = 1) => {
    setLoading(true);
    try {
      let q = `/bilties?page=${page}&limit=10`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (termsFilter) q += `&paymentTerms=${termsFilter}`;

      const res = await apiRequest(q);
      setBilties(res.data.items);
      setPagination(res.data.pagination);
    } catch (err: any) {
      console.error('Failed to load Bilties:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch LRs for Bilty creation
  const fetchLrs = async () => {
    try {
      const res = await apiRequest('/lr?limit=100');
      setLrs(res.data.items || []);
    } catch (err: any) {
      console.error('Failed to load LRs:', err.message);
    }
  };

  useEffect(() => {
    fetchBilties(1);
    fetchLrs();
  }, [search, termsFilter]);

  // When LR is selected in form, auto-fill freight
  const handleSelectLr = (lrId: string) => {
    const selected = lrs.find((l) => l._id === lrId);
    if (selected && selected.loadId?.financials) {
      const f = selected.loadId.financials;
      setFormData({
        ...formData,
        lrId,
        totalFreightRupees: ((f.totalFreightPaise || 0) / 100).toString(),
        advanceRupees: ((f.advancePaise || 0) / 100).toString()
      });
    } else {
      setFormData({ ...formData, lrId });
    }
  };

  // Live balance calculation
  const calcBalance = () => {
    const total = parseFloat(formData.totalFreightRupees) || 0;
    const advance = parseFloat(formData.advanceRupees) || 0;
    return Math.max(0, total - advance);
  };

  // Handle Create Bilty
  const handleCreateBilty = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const totalFreightPaise = Math.round((parseFloat(formData.totalFreightRupees) || 0) * 100);
      const advancePaise = Math.round((parseFloat(formData.advanceRupees) || 0) * 100);

      const payload = {
        lrId: formData.lrId,
        paymentTerms: formData.paymentTerms,
        totalFreightPaise,
        advancePaise,
        remarks: formData.remarks
      };

      await apiRequest('/bilties', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setIsCreateOpen(false);
      setFormData({
        lrId: '',
        paymentTerms: 'TO_PAY',
        totalFreightRupees: '',
        advanceRupees: '0',
        remarks: ''
      });
      fetchBilties(1);
    } catch (err: any) {
      setFormError(err.message || 'Failed to issue Bilty');
    } finally {
      setFormLoading(false);
    }
  };

  // Preview & Print Bilty PDF Modal
  const handlePreviewPdf = (bilty: any) => {
    setPdfModal({
      isOpen: true,
      endpoint: `/bilties/${bilty._id}/pdf`,
      title: `Consignment Bilty Note - ${bilty.biltyNumber}`,
      documentNumber: bilty.biltyNumber,
      whatsappPhone: bilty.consignorId?.phone || bilty.consigneeId?.phone || ''
    });
  };

  // Download Bilty PDF
  const handleDownloadPdf = async (biltyId: string, biltyNumber: string) => {
    try {
      await apiDownload(`/bilties/${biltyId}/pdf`, `Bilty_${biltyNumber}.pdf`);
    } catch (err: any) {
      alert('Failed to download Bilty PDF: ' + err.message);
    }
  };

  const getTermsBadge = (terms: string) => {
    switch (terms) {
      case 'TO_PAY':
        return <span className="badge" style={{ background: '#0284c7', color: '#e0f2fe' }}>TO PAY</span>;
      case 'PAID':
        return <span className="badge" style={{ background: '#166534', color: '#bbf7d0' }}>PAID</span>;
      case 'TO_BE_BILLED':
        return <span className="badge" style={{ background: '#854d0e', color: '#fef08a' }}>TBB</span>;
      default:
        return <span className="badge">{terms}</span>;
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
              Bilty / Consignment Notes
            </h1>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              GST GTA SAC 9965 (5%)
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Atomic sequential Bilties (BL-YYYY-XXXXX), GTA reverse charge declarations, and freight balance accounting.
          </p>
        </div>

        <div>
          <button
            onClick={() => {
              setIsCreateOpen(true);
              setFormError(null);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
          >
            <span>➕</span> Issue Consignment Bilty
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Bilties Issued</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.25rem' }}>
            {pagination.total}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#38bdf8', marginTop: '0.25rem' }}>Sequential consignment notes</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Freight Value</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
            ₹{((bilties.reduce((acc, b) => acc + (b.totalFreightPaise || 0), 0)) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#7dd3fc', marginTop: '0.25rem' }}>Gross transport revenue</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Outstanding Balance Due</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.25rem' }}>
            ₹{((bilties.reduce((acc, b) => acc + (b.balancePaise || 0), 0)) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#fcd34d', marginTop: '0.25rem' }}>Receivable on delivery</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Tax Declaration</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
            5% RCM
          </div>
          <div style={{ fontSize: '0.7rem', color: '#6ee7b7', marginTop: '0.25rem' }}>SAC Code 9965 Applicable</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <input
            type="text"
            className="input"
            placeholder="Search Bilty #, remarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ width: '180px' }}>
          <select
            className="select"
            value={termsFilter}
            onChange={(e) => setTermsFilter(e.target.value)}
          >
            <option value="">All Payment Terms</option>
            <option value="TO_PAY">TO PAY</option>
            <option value="PAID">PAID</option>
            <option value="TO_BE_BILLED">TO BE BILLED</option>
          </select>
        </div>
        <button onClick={() => fetchBilties(1)} className="btn btn-secondary">
          Refresh
        </button>
      </div>

      {/* Bilties Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>BILTY NUMBER</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>DATE</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>LINKED LR</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CONSIGNOR ➔ CONSIGNEE</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>PAYMENT TERMS</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>GROSS FREIGHT</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>BALANCE PAYABLE</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>GTA TAX</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading Bilties...
                  </td>
                </tr>
              ) : bilties.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No Bilties issued yet. Click "+ Issue Consignment Bilty" to create one from an active LR.
                  </td>
                </tr>
              ) : (
                bilties.map((b) => (
                  <tr key={b._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                        {b.biltyNumber}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {new Date(b.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>
                        {b.lrId?.lrNumber || 'N/A'}
                      </span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Load: {b.loadId?.loadNumber}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.85rem' }}>
                        {b.consignorId?.name || 'Consignor'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        ➔ {b.consigneeId?.name || 'Consignee'}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {getTermsBadge(b.paymentTerms)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#f8fafc' }}>
                      ₹{((b.totalFreightPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: (b.balancePaise || 0) > 0 ? '#fbbf24' : '#10b981' }}>
                      ₹{((b.balancePaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      SAC {b.gstGtaSac} ({b.gstGtaRate}%)
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handlePreviewPdf(b)}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        title="Preview & Print Bilty Note"
                      >
                        👁️ Preview & Print
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.4)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} Bilties)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => fetchBilties(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
            >
              Previous
            </button>
            <button
              onClick={() => fetchBilties(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ISSUE BILTY MODAL */}
      {isCreateOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '600px', background: '#0b1329', border: '1px solid #1e293b', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  Issue Consignment Bilty Note
                </h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  GTA SAC 9965 reverse charge invoice note with collision-safe atomic sequence (BL-YYYY-XXXXX).
                </div>
              </div>
              <button onClick={() => setIsCreateOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleCreateBilty}>
              {/* Linked LR Selector */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Select Linked Lorry Receipt (LR) *</label>
                <select
                  className="select"
                  required
                  value={formData.lrId}
                  onChange={(e) => handleSelectLr(e.target.value)}
                >
                  <option value="">Choose LR Number</option>
                  {lrs.map((lr) => (
                    <option key={lr._id} value={lr._id}>
                      {lr.lrNumber} - Load: {lr.loadId?.loadNumber} ({lr.consignorId?.name} ➔ {lr.consigneeId?.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Terms */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Payment Terms *</label>
                <select
                  className="select"
                  required
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                >
                  <option value="TO_PAY">TO PAY (Payable by consignee upon delivery)</option>
                  <option value="PAID">PAID (Prepaid by consignor)</option>
                  <option value="TO_BE_BILLED">TO BE BILLED (Monthly credit invoice)</option>
                </select>
              </div>

              {/* Financial Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="label">Gross Freight (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    required
                    value={formData.totalFreightRupees}
                    onChange={(e) => setFormData({ ...formData, totalFreightRupees: e.target.value })}
                    placeholder="e.g. 50500"
                  />
                </div>

                <div>
                  <label className="label">Advance Paid (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={formData.advanceRupees}
                    onChange={(e) => setFormData({ ...formData, advanceRupees: e.target.value })}
                    placeholder="e.g. 10000"
                  />
                </div>
              </div>

              {/* Calculated Net Balance Notice */}
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Net Balance Payable upon Delivery:</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>
                    ₹{calcBalance().toFixed(2)}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right' }}>
                  GTA GST Rate: <strong>5.0%</strong><br />
                  SAC Code: <strong>9965 (RCM)</strong>
                </div>
              </div>

              {/* Remarks */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label">Bilty Remarks / Notes</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Payment terms strictly net 15 days from delivery"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <button type="button" onClick={() => setIsCreateOpen(false)} className="btn btn-secondary" disabled={formLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading} style={{ fontWeight: 700 }}>
                  {formLoading ? 'Allocating...' : 'Issue Bilty Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Viewer & Print Modal */}
      <PdfViewerModal
        isOpen={pdfModal.isOpen}
        onClose={() => setPdfModal((prev) => ({ ...prev, isOpen: false }))}
        title={pdfModal.title}
        endpoint={pdfModal.endpoint}
        documentNumber={pdfModal.documentNumber}
        whatsappPhone={pdfModal.whatsappPhone}
      />
    </div>
  );
};
