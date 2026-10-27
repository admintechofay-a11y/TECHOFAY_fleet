import React, { useState, useEffect } from 'react';
import { apiRequest, apiDownload } from '../lib/api';
import { PdfViewerModal } from '../components/PdfViewerModal';

export const LrPage: React.FC = () => {
  const [lrs, setLrs] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedLr, setSelectedLr] = useState<any | null>(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
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
    loadId: '',
    isManualNumber: false,
    lrNumber: '',
    eWayBillNumber: '',
    eWayBillExpiry: '',
    remarks: ''
  });

  const [statusData, setStatusData] = useState({
    status: '',
    reason: ''
  });

  // Fetch LRs
  const fetchLrs = async (page = 1) => {
    setLoading(true);
    setFetchError(null);
    try {
      let q = `/lr?page=${page}&limit=10`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) q += `&status=${statusFilter}`;

      const res = await apiRequest(q);
      setLrs(res.data.items || []);
      setPagination(res.data.pagination);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load Lorry Receipts');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Loads for issuing LR
  const fetchLoads = async () => {
    try {
      const res = await apiRequest('/loads?limit=50');
      setLoads(res.data.items || []);
    } catch (err: any) {
      console.error('Failed to load consignments:', err.message);
    }
  };

  useEffect(() => {
    fetchLrs(1);
    fetchLoads();
  }, [search, statusFilter]);

  // Handle Create LR
  const handleCreateLr = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const payload: any = {
        loadId: formData.loadId,
        isManualNumber: formData.isManualNumber,
        eWayBillNumber: formData.eWayBillNumber || undefined,
        eWayBillExpiry: formData.eWayBillExpiry || undefined,
        remarks: formData.remarks
      };

      if (formData.isManualNumber && formData.lrNumber) {
        payload.lrNumber = formData.lrNumber;
      }

      await apiRequest('/lr', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setIsCreateOpen(false);
      setFormData({
        loadId: '',
        isManualNumber: false,
        lrNumber: '',
        eWayBillNumber: '',
        eWayBillExpiry: '',
        remarks: ''
      });
      fetchLrs(1);
    } catch (err: any) {
      setFormError(err.message || 'Failed to issue Lorry Receipt');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Status Update
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLr) return;
    setFormLoading(true);

    try {
      await apiRequest(`/lr/${selectedLr._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(statusData)
      });

      setIsStatusOpen(false);
      fetchLrs(pagination.page);
    } catch (err: any) {
      alert(err.message || 'Status transition failed');
    } finally {
      setFormLoading(false);
    }
  };

  // Preview & Print LR PDF Modal
  const handlePreviewPdf = (lr: any) => {
    setPdfModal({
      isOpen: true,
      endpoint: `/lr/${lr._id}/pdf`,
      title: `Official Lorry Receipt (LR) - ${lr.lrNumber}`,
      documentNumber: lr.lrNumber,
      whatsappPhone: lr.consignorId?.phone || lr.consigneeId?.phone || ''
    });
  };

  // Direct Download LR PDF fallback
  const handleDownloadPdf = async (lrId: string, lrNumber: string) => {
    try {
      await apiDownload(`/lr/${lrId}/pdf`, `LR_${lrNumber}.pdf`);
    } catch (err: any) {
      alert('Failed to download LR PDF: ' + err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'BOOKED':
        return <span className="badge" style={{ background: '#334155', color: '#94a3b8' }}>BOOKED</span>;
      case 'LOADED':
        return <span className="badge" style={{ background: '#854d0e', color: '#fef08a' }}>LOADED</span>;
      case 'IN_TRANSIT':
        return <span className="badge" style={{ background: '#6b21a8', color: '#e9d5ff' }}>IN_TRANSIT</span>;
      case 'PARTIALLY_DELIVERED':
        return <span className="badge" style={{ background: '#0d9488', color: '#99f6e4' }}>PARTIAL</span>;
      case 'DELIVERED':
        return <span className="badge" style={{ background: '#166534', color: '#bbf7d0' }}>DELIVERED</span>;
      case 'POD_CLOSED':
        return <span className="badge" style={{ background: '#0f766e', color: '#ccfbf1' }}>POD CLOSED</span>;
      case 'CANCELLED':
        return <span className="badge" style={{ background: '#991b1b', color: '#fecaca' }}>CANCELLED</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Lorry Receipts (LR) Management
            </h1>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
              OFFICIAL GTA DOCUMENT ENGINE
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Atomic LR sequence generation (LR-YYYY-XXXXX), E-Way bill linkage, duplicate check, and instant server-side PDF generation.
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
            <span>➕</span> Issue New LR
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total LRs Issued</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {pagination.total}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Document registry records</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>In Transit</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.25rem' }}>
            {lrs.filter(l => l.status === 'IN_TRANSIT' || l.status === 'LOADED').length}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#7c3aed', marginTop: '0.25rem' }}>Vehicles on the road</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Delivered / POD</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a36a', marginTop: '0.25rem' }}>
            {lrs.filter(l => l.status === 'DELIVERED' || l.status === 'POD_CLOSED').length}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#16a36a', marginTop: '0.25rem' }}>Consignee acknowledged</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>E-Way Bills Attached</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', marginTop: '0.25rem' }}>
            {lrs.filter(l => l.eWayBillNumber).length}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#2563eb', marginTop: '0.25rem' }}>GST Compliant consignments</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <input
            type="text"
            className="input"
            placeholder="Search LR #, E-Way Bill Number, remarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ width: '180px' }}>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="BOOKED">BOOKED</option>
            <option value="LOADED">LOADED</option>
            <option value="IN_TRANSIT">IN_TRANSIT</option>
            <option value="PARTIALLY_DELIVERED">PARTIALLY_DELIVERED</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="POD_CLOSED">POD_CLOSED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
        <button onClick={() => fetchLrs(1)} className="btn btn-secondary">
          Refresh
        </button>
      </div>

      {/* LRs Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>LR NUMBER</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>DATE</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CONSIGNMENT LOAD</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CONSIGNOR ➔ CONSIGNEE</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>VEHICLE / DRIVER</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>E-WAY BILL</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>STATUS</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading Lorry Receipts...
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>
                    <div style={{ marginBottom: '0.75rem', fontWeight: 600 }}>⚠️ {fetchError}</div>
                    <button onClick={() => fetchLrs(1)} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
                      🔄 Retry
                    </button>
                  </td>
                </tr>
              ) : lrs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No Lorry Receipts found. Click "+ Issue New LR" to generate your first document.
                  </td>
                </tr>
              ) : (
                lrs.map((lr) => (
                  <tr key={lr._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontWeight: 700, color: '#2563eb' }}>
                        {lr.lrNumber}
                      </span>
                      {lr.isManualNumber && (
                        <span style={{ fontSize: '0.65rem', marginLeft: '0.35rem', color: '#d97706', border: '1px solid rgba(217, 119, 6, 0.3)', borderRadius: '3px', padding: '0.1rem 0.3rem', background: '#fef7ea' }}>
                          Manual
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {new Date(lr.issuedDate).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                        {lr.loadId?.loadNumber || 'N/A'}
                      </span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {lr.loadId?.totalWeightMt} MT ({lr.loadId?.packageType})
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                        {lr.consignorId?.name || 'Consignor'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        ➔ {lr.consigneeId?.name || 'Consignee'}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                        {lr.vehicleId?.plateNumber || 'Unassigned'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {lr.driverId?.name || 'Driver unassigned'}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {lr.eWayBillNumber ? (
                        <div>
                          <span style={{ fontWeight: 600, color: '#16a36a', fontSize: '0.8rem' }}>
                            {lr.eWayBillNumber}
                          </span>
                          {lr.eWayBillExpiry && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Exp: {new Date(lr.eWayBillExpiry).toLocaleDateString('en-IN')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {getStatusBadge(lr.status)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handlePreviewPdf(lr)}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          title="Preview & Print Official LR with multi-copy selector"
                        >
                          👁️ Preview & Print
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLr(lr);
                            setStatusData({ status: lr.status, reason: '' });
                            setIsStatusOpen(true);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          title="Transition LR status"
                        >
                          Status
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', background: '#f8fafc' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} LRs)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => fetchLrs(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
            >
              Previous
            </button>
            <button
              onClick={() => fetchLrs(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ISSUE LR MODAL */}
      {isCreateOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '650px', background: '#ffffff', border: '1px solid var(--border-subtle)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Issue Official Lorry Receipt (LR)
                </h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Generates an authorized transport document with live company branding & legal declarations.
                </div>
              </div>
              <button onClick={() => setIsCreateOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ background: '#fdf2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleCreateLr}>
              {/* Linked Load */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Select Consignment Load *</label>
                <select
                  className="select"
                  required
                  value={formData.loadId}
                  onChange={(e) => setFormData({ ...formData, loadId: e.target.value })}
                >
                  <option value="">Choose Load</option>
                  {loads.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.loadNumber} - {l.customerId?.name} ({l.totalWeightMt} MT {l.packageType})
                    </option>
                  ))}
                </select>
              </div>

              {/* Numbering Mode */}
              <div style={{ marginBottom: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={formData.isManualNumber}
                    onChange={(e) => setFormData({ ...formData, isManualNumber: e.target.checked })}
                  />
                  Assign Custom / Pre-printed LR Book Number
                </label>

                {formData.isManualNumber ? (
                  <div style={{ marginTop: '0.75rem' }}>
                    <label className="label">Custom LR Number *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      placeholder="e.g. MH-LR-8921"
                      value={formData.lrNumber}
                      onChange={(e) => setFormData({ ...formData, lrNumber: e.target.value })}
                    />
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      System strictly prevents duplicate manual LR numbers within your tenant organization.
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: '#2563eb', marginTop: '0.4rem' }}>
                    Automatic sequential numbering will be generated: <strong>LR-2026-XXXXX</strong>
                  </div>
                )}
              </div>

              {/* E-Way Bill */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="label">E-Way Bill Number (12 Digits)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. 231498765432"
                    value={formData.eWayBillNumber}
                    onChange={(e) => setFormData({ ...formData, eWayBillNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">E-Way Bill Expiry Date</label>
                  <input
                    type="date"
                    className="input"
                    value={formData.eWayBillExpiry}
                    onChange={(e) => setFormData({ ...formData, eWayBillExpiry: e.target.value })}
                  />
                </div>
              </div>

              {/* Remarks */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label">Consignment Remarks</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Subject to Mumbai Jurisdiction"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <button type="button" onClick={() => setIsCreateOpen(false)} className="btn btn-secondary" disabled={formLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading} style={{ fontWeight: 700 }}>
                  {formLoading ? 'Allocating...' : 'Issue Lorry Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATUS UPDATE MODAL */}
      {isStatusOpen && selectedLr && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '480px', background: '#ffffff', border: '1px solid var(--border-subtle)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Update Status for LR: {selectedLr.lrNumber}
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Current State: <strong>{selectedLr.status}</strong>
            </div>

            <form onSubmit={handleUpdateStatus}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Target Status *</label>
                <select
                  className="select"
                  required
                  value={statusData.status}
                  onChange={(e) => setStatusData({ ...statusData, status: e.target.value })}
                >
                  <option value="">Select Next Status</option>
                  <option value="LOADED">LOADED</option>
                  <option value="IN_TRANSIT">IN_TRANSIT</option>
                  <option value="PARTIALLY_DELIVERED">PARTIALLY_DELIVERED</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="POD_CLOSED">POD_CLOSED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label">Reason / Audit Remarks</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Reason for state transition"
                  value={statusData.reason}
                  onChange={(e) => setStatusData({ ...statusData, reason: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setIsStatusOpen(false)} className="btn btn-secondary" disabled={formLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading} style={{ fontWeight: 700 }}>
                  Confirm Transition
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
