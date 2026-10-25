import React, { useState, useEffect } from 'react';
import { apiRequest, apiDownload } from '../lib/api';

export const DeliveriesPodPage: React.FC = () => {
  const [pods, setPods] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState({
    tripId: '',
    receiverName: '',
    receiverPhone: '',
    quantityDelivered: '1',
    remarks: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Verification Modal State
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [selectedPod, setSelectedPod] = useState<any | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<'VERIFIED' | 'REJECTED'>('VERIFIED');
  const [verifyRemarks, setVerifyRemarks] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Action Message
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchPods = async (page = 1) => {
    setLoading(true);
    try {
      let q = `/pod?page=${page}&limit=10`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) q += `&status=${statusFilter}`;

      const res = await apiRequest(q);
      setPods(res.data.items);
      setPagination(res.data.pagination);
    } catch (err: any) {
      console.error('Failed to load POD records:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrips = async () => {
    try {
      const res = await apiRequest('/trips?limit=100');
      setTrips(res.data.items || []);
    } catch (err: any) {
      console.error('Failed to load trips for POD:', err.message);
    }
  };

  useEffect(() => {
    fetchPods(1);
    fetchTrips();
  }, [search, statusFilter]);

  const handleUploadPod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select a POD document or delivery photo.');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('tripId', uploadForm.tripId);
      formData.append('receiverName', uploadForm.receiverName);
      formData.append('receiverPhone', uploadForm.receiverPhone);
      formData.append('quantityDelivered', uploadForm.quantityDelivered);
      formData.append('remarks', uploadForm.remarks);

      const res = await apiRequest('/pod', {
        method: 'POST',
        body: formData
      });

      setIsUploadOpen(false);
      setSelectedFile(null);
      setUploadForm({
        tripId: '',
        receiverName: '',
        receiverPhone: '',
        quantityDelivered: '1',
        remarks: ''
      });
      setActionMessage({ text: `POD ${res.data.podNumber} successfully uploaded!`, type: 'success' });
      fetchPods(1);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload POD');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleVerifyPod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPod) return;

    setVerifyLoading(true);
    setVerifyError(null);

    try {
      await apiRequest(`/pod/${selectedPod._id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: verifyStatus,
          remarks: verifyRemarks
        })
      });

      setIsVerifyOpen(false);
      setSelectedPod(null);
      setVerifyRemarks('');
      setActionMessage({ text: `POD ${selectedPod.podNumber} marked as ${verifyStatus}!`, type: 'success' });
      fetchPods(pagination.page);
    } catch (err: any) {
      setVerifyError(err.message || 'Verification failed');
    } finally {
      setVerifyLoading(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      PENDING_VERIFICATION: { bg: 'rgba(234, 179, 8, 0.15)', color: '#fbbf24', label: 'Pending Verification' },
      VERIFIED: { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', label: 'Verified & Approved' },
      REJECTED: { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', label: 'Rejected' }
    };
    const s = map[status] || { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', label: status };
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.25rem 0.65rem',
          borderRadius: '9999px',
          fontSize: '0.72rem',
          fontWeight: 600,
          background: s.bg,
          color: s.color,
          border: `1px solid ${s.color}33`
        }}
      >
        ● {s.label}
      </span>
    );
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1440px', margin: '0 auto', color: '#f8fafc' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#ffffff' }}>
              Proof of Delivery (POD) Subsystem
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontWeight: 600
              }}
            >
              Phase 5
            </span>
          </div>
          <p style={{ color: '#94a3b8', marginTop: '0.35rem', fontSize: '0.875rem' }}>
            Upload consignee delivery receipts, verify receiver signatures, and sign off for audit-ready trip settlement.
          </p>
        </div>

        <button
          onClick={() => {
            setIsUploadOpen(true);
            setUploadError(null);
          }}
          className="btn btn-primary"
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
          }}
        >
          <span>📤</span> Upload POD Document
        </button>
      </div>

      {/* Global Action Feedback */}
      {actionMessage && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: actionMessage.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${actionMessage.type === 'success' ? '#22c55e' : '#ef4444'}`,
            color: actionMessage.type === 'success' ? '#4ade80' : '#f87171'
          }}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Uploaded PODs</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '0.35rem' }}>
            {pagination.total}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Across all trips</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Pending Verification</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#d97706', marginTop: '0.35rem' }}>
            {pods.filter(p => p.status === 'PENDING_VERIFICATION').length}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Requires supervisor approval</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Verified & Approved</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a36a', marginTop: '0.35rem' }}>
            {pods.filter(p => p.status === 'VERIFIED').length}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Cleared for trip closure</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Rejected / Disputed</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#dc2626', marginTop: '0.35rem' }}>
            {pods.filter(p => p.status === 'REJECTED').length}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Discrepancies found</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          background: '#ffffff',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ flex: '1 1 250px' }}>
          <input
            type="text"
            placeholder="Search by POD # or Receiver name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.9rem',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem'
            }}
          />
        </div>

        <div style={{ minWidth: '180px' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.9rem',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem'
            }}
          >
            <option value="">All Verification Statuses</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="VERIFIED">Verified & Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* POD Registry Table */}
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-subtle)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '0.85rem 1rem' }}>POD Ref #</th>
                <th style={{ padding: '0.85rem 1rem' }}>Trip Reference</th>
                <th style={{ padding: '0.85rem 1rem' }}>Receiver Contact</th>
                <th style={{ padding: '0.85rem 1rem' }}>Delivered Qty</th>
                <th style={{ padding: '0.85rem 1rem' }}>Verification</th>
                <th style={{ padding: '0.85rem 1rem' }}>Supervisor Sign-Off</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    Loading Proof of Delivery registry...
                  </td>
                </tr>
              ) : pods.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    No Proof of Delivery records found. Upload your first POD above!
                  </td>
                </tr>
              ) : (
                pods.map((pod) => (
                  <tr
                    key={pod._id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '1rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {pod.podNumber}
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(pod.deliveredAt || pod.createdAt).toLocaleDateString('en-IN')}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pod.tripId?.tripNumber || 'Trip Link'}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Load: {pod.loadId?.loadNumber || 'N/A'}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pod.receiverName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{pod.receiverPhone || 'No phone'}</div>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {pod.quantityDelivered} Pkgs
                    </td>
                    <td style={{ padding: '1rem' }}>{renderStatusBadge(pod.status)}</td>
                    <td style={{ padding: '1rem' }}>
                      {pod.verifiedBySupervisor ? (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                            {pod.verifiedBySupervisor.name}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(pod.verifiedAt).toLocaleDateString('en-IN')}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending Review</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => apiDownload(`/pod/${pod._id}/download`, pod.fileName || 'pod_document.pdf')}
                          title="Download Original POD Document"
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '6px',
                            background: '#0284c7',
                            border: '1px solid #0284c7',
                            color: '#ffffff',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          👁️ View File
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPod(pod);
                            setVerifyStatus(pod.status === 'VERIFIED' ? 'VERIFIED' : 'VERIFIED');
                            setVerifyRemarks(pod.verificationRemarks || '');
                            setIsVerifyOpen(true);
                            setVerifyError(null);
                          }}
                          title="Verify / Sign-off POD"
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '6px',
                            background: '#ffffff',
                            border: '1px solid var(--border-medium)',
                            color: 'var(--text-primary)',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          ⚖️ Verify
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload POD Modal */}
      {isUploadOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Upload Proof of Delivery</h2>
              <button
                onClick={() => setIsUploadOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#dc2626',
                  marginBottom: '1rem',
                  fontSize: '0.85rem'
                }}
              >
                ⚠️ {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadPod} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Select Dispatched Trip *
                </label>
                <select
                  required
                  value={uploadForm.tripId}
                  onChange={(e) => setUploadForm({ ...uploadForm, tripId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="">-- Choose Dispatched Trip --</option>
                  {trips.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.tripNumber} ({t.status}) — {t.vehicleId?.plateNumber} / {t.driverId?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Receiver Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={uploadForm.receiverName}
                    onChange={(e) => setUploadForm({ ...uploadForm, receiverName: e.target.value })}
                    placeholder="e.g. Suresh Kumar"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.9rem',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid var(--border-medium)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Receiver Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={uploadForm.receiverPhone}
                    onChange={(e) => setUploadForm({ ...uploadForm, receiverPhone: e.target.value })}
                    placeholder="+91 98765 43210"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.9rem',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid var(--border-medium)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Quantity Delivered (Pkgs) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={uploadForm.quantityDelivered}
                  onChange={(e) => setUploadForm({ ...uploadForm, quantityDelivered: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Attach Signed POD Document (PDF, JPG, PNG up to 10MB) *
                </label>
                <input
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px dashed var(--border-medium)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Delivery Remarks
                </label>
                <textarea
                  rows={2}
                  value={uploadForm.remarks}
                  onChange={(e) => setUploadForm({ ...uploadForm, remarks: e.target.value })}
                  placeholder="Notes from consignee seal, stamp, or unloading staff..."
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading}
                  style={{
                    padding: '0.65rem 1.5rem',
                    borderRadius: '8px',
                    background: '#10b981',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {uploadLoading ? 'Uploading...' : 'Submit POD 📤'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supervisor Verification Modal */}
      {isVerifyOpen && selectedPod && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '1rem'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Supervisor Review: {selectedPod.podNumber}
              </h3>
              <button
                onClick={() => setIsVerifyOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {verifyError && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#dc2626',
                  marginBottom: '1rem',
                  fontSize: '0.85rem'
                }}
              >
                ⚠️ {verifyError}
              </div>
            )}

            <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Receiver:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedPod.receiverName} ({selectedPod.receiverPhone || 'N/A'})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Quantity Delivered:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedPod.quantityDelivered} Pkgs</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>File Name:</span>
                <span style={{ color: 'var(--accent-cyan)' }}>{selectedPod.fileName}</span>
              </div>
            </div>

            <form onSubmit={handleVerifyPod} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Verification Decision *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setVerifyStatus('VERIFIED')}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: verifyStatus === 'VERIFIED' ? '2px solid #16a36a' : '1px solid var(--border-subtle)',
                      background: verifyStatus === 'VERIFIED' ? 'rgba(22, 163, 106, 0.1)' : '#f8fafc',
                      color: verifyStatus === 'VERIFIED' ? '#16a36a' : 'var(--text-secondary)',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ✅ Verified & Valid
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerifyStatus('REJECTED')}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: verifyStatus === 'REJECTED' ? '2px solid #dc2626' : '1px solid var(--border-subtle)',
                      background: verifyStatus === 'REJECTED' ? 'rgba(220, 38, 38, 0.1)' : '#f8fafc',
                      color: verifyStatus === 'REJECTED' ? '#dc2626' : 'var(--text-secondary)',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ❌ Reject / Disputed
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Verification Remarks / Audit Notes
                </label>
                <textarea
                  rows={3}
                  value={verifyRemarks}
                  onChange={(e) => setVerifyRemarks(e.target.value)}
                  placeholder="e.g. Signature matched with consignee authorized signatory stamp."
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsVerifyOpen(false)}
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', background: '#f1f5f9', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyLoading}
                  style={{
                    padding: '0.65rem 1.5rem',
                    borderRadius: '8px',
                    background: verifyStatus === 'VERIFIED' ? '#10b981' : '#dc2626',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {verifyLoading ? 'Submitting...' : 'Confirm Sign-off ⚖️'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
