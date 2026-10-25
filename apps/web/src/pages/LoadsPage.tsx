import React, { useState, useEffect } from 'react';
import { apiRequest, apiDownload } from '../lib/api';
import { PdfViewerModal } from '../components/PdfViewerModal';

export const LoadsPage: React.FC = () => {
  const [loads, setLoads] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
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

  // New Load Form State
  const [formData, setFormData] = useState({
    customerId: '',
    consignorId: '',
    consigneeId: '',
    packageType: 'Bags',
    totalWeightMt: '',
    totalQuantity: '100',
    expectedDeliveryDate: '',
    remarks: '',
    stops: [
      { sequence: 1, stopType: 'PICKUP', locationId: '', allocatedQuantity: 100, allocatedWeightMt: 10, contactPerson: '', contactPhone: '' },
      { sequence: 2, stopType: 'DELIVERY', locationId: '', allocatedQuantity: 100, allocatedWeightMt: 10, contactPerson: '', contactPhone: '' }
    ],
    financials: {
      baseFreightRupees: '45000',
      loadingRupees: '1500',
      unloadingRupees: '1500',
      detentionRupees: '0',
      tollRupees: '2500',
      handlingRupees: '0',
      miscRupees: '0',
      advanceRupees: '10000',
      deductionRupees: '0'
    }
  });

  // Assign form state
  const [assignData, setAssignData] = useState({
    vehicleId: '',
    driverId: ''
  });

  // Fetch Loads
  const fetchLoads = async (page = 1) => {
    setLoading(true);
    try {
      let q = `/loads?page=${page}&limit=10`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) q += `&status=${statusFilter}`;

      const res = await apiRequest(q);
      setLoads(res.data.items);
      setPagination(res.data.pagination);
    } catch (err: any) {
      console.error('Failed to load consignments:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Master references for dropdowns
  const fetchMasters = async () => {
    try {
      const [custRes, locRes, vehRes, dvrRes] = await Promise.all([
        apiRequest('/customers?limit=100'),
        apiRequest('/locations?limit=100'),
        apiRequest('/vehicles?limit=100'),
        apiRequest('/drivers?limit=100')
      ]);
      setCustomers(custRes.data.items || []);
      setLocations(locRes.data.items || []);
      setVehicles(vehRes.data.items || []);
      setDrivers(dvrRes.data.items || []);
    } catch (err: any) {
      console.error('Failed to load master data:', err.message);
    }
  };

  useEffect(() => {
    fetchLoads(1);
    fetchMasters();
  }, [search, statusFilter]);

  // Live financial calculations in INR
  const calcTotalFreight = () => {
    const f = formData.financials;
    const base = parseFloat(f.baseFreightRupees) || 0;
    const loading = parseFloat(f.loadingRupees) || 0;
    const unloading = parseFloat(f.unloadingRupees) || 0;
    const detention = parseFloat(f.detentionRupees) || 0;
    const toll = parseFloat(f.tollRupees) || 0;
    const handling = parseFloat(f.handlingRupees) || 0;
    const misc = parseFloat(f.miscRupees) || 0;
    return base + loading + unloading + detention + toll + handling + misc;
  };

  const calcNetBalance = () => {
    const total = calcTotalFreight();
    const advance = parseFloat(formData.financials.advanceRupees) || 0;
    const deduction = parseFloat(formData.financials.deductionRupees) || 0;
    return Math.max(0, total - advance - deduction);
  };

  // Add stop
  const handleAddStop = () => {
    const nextSeq = formData.stops.length + 1;
    setFormData({
      ...formData,
      stops: [
        ...formData.stops,
        {
          sequence: nextSeq,
          stopType: 'DELIVERY',
          locationId: '',
          allocatedQuantity: 0,
          allocatedWeightMt: 0,
          contactPerson: '',
          contactPhone: ''
        }
      ]
    });
  };

  // Remove stop
  const handleRemoveStop = (idx: number) => {
    if (formData.stops.length <= 1) return;
    const updated = formData.stops.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sequence: i + 1 }));
    setFormData({ ...formData, stops: updated });
  };

  // Handle Create Consignment Load
  const handleCreateLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const payload = {
        customerId: formData.customerId,
        consignorId: formData.consignorId,
        consigneeId: formData.consigneeId,
        totalWeightMt: parseFloat(formData.totalWeightMt),
        totalQuantity: parseInt(formData.totalQuantity, 10),
        packageType: formData.packageType,
        expectedDeliveryDate: formData.expectedDeliveryDate || undefined,
        remarks: formData.remarks,
        stops: formData.stops,
        financials: {
          baseFreightPaise: Math.round((parseFloat(formData.financials.baseFreightRupees) || 0) * 100),
          loadingPaise: Math.round((parseFloat(formData.financials.loadingRupees) || 0) * 100),
          unloadingPaise: Math.round((parseFloat(formData.financials.unloadingRupees) || 0) * 100),
          detentionPaise: Math.round((parseFloat(formData.financials.detentionRupees) || 0) * 100),
          tollPaise: Math.round((parseFloat(formData.financials.tollRupees) || 0) * 100),
          handlingPaise: Math.round((parseFloat(formData.financials.handlingRupees) || 0) * 100),
          miscChargePaise: Math.round((parseFloat(formData.financials.miscRupees) || 0) * 100),
          advancePaise: Math.round((parseFloat(formData.financials.advanceRupees) || 0) * 100),
          deductionPaise: Math.round((parseFloat(formData.financials.deductionRupees) || 0) * 100)
        }
      };

      await apiRequest('/loads', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setIsCreateOpen(false);
      fetchLoads(1);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create consignment load');
    } finally {
      setFormLoading(false);
    }
  };

  // Status transition handler
  const handleStatusTransition = async (loadId: string, newStatus: string) => {
    try {
      await apiRequest(`/loads/${loadId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, reason: `Updated from dispatch command center to ${newStatus}` })
      });
      // Refresh details and list
      const updated = await apiRequest(`/loads/${loadId}`);
      setSelectedLoad(updated.data);
      fetchLoads(pagination.page);
    } catch (err: any) {
      alert(err.message || 'Status transition failed');
    }
  };

  // Assign assets handler
  const handleAssignAssets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoad) return;
    try {
      await apiRequest(`/loads/${selectedLoad._id}/assign`, {
        method: 'POST',
        body: JSON.stringify(assignData)
      });
      setIsAssignOpen(false);
      const updated = await apiRequest(`/loads/${selectedLoad._id}`);
      setSelectedLoad(updated.data);
      fetchLoads(pagination.page);
    } catch (err: any) {
      alert(err.message || 'Failed to assign assets');
    }
  };

  // Preview & Print Loading Slip PDF Modal
  const handlePreviewLoadingSlip = (load: any) => {
    setPdfModal({
      isOpen: true,
      endpoint: `/loads/${load._id}/loading-slip`,
      title: `Loading Slip & Gate Pass - ${load.loadNumber}`,
      documentNumber: load.loadNumber,
      whatsappPhone: load.consignorId?.phone || load.consigneeId?.phone || ''
    });
  };

  // Loading slip download fallback
  const handleDownloadLoadingSlip = async (loadId: string, loadNum: string) => {
    try {
      await apiDownload(`/loads/${loadId}/loading-slip`, `LoadingSlip_${loadNum}.pdf`);
    } catch (err: any) {
      alert('Failed to download Loading Slip: ' + err.message);
    }
  };

  // Open Details Modal
  const openDetails = async (loadId: string) => {
    try {
      const res = await apiRequest(`/loads/${loadId}`);
      setSelectedLoad(res.data);
      setAssignData({
        vehicleId: res.data.assignedVehicleId?._id || '',
        driverId: res.data.assignedDriverId?._id || ''
      });
      setIsDetailOpen(true);
    } catch (err: any) {
      alert('Failed to fetch load details: ' + err.message);
    }
  };

  // Helper for Status Badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CREATED':
        return <span className="badge" style={{ background: '#334155', color: '#94a3b8' }}>CREATED</span>;
      case 'ASSIGNED':
        return <span className="badge" style={{ background: '#0369a1', color: '#bae6fd' }}>ASSIGNED</span>;
      case 'LOADING':
        return <span className="badge" style={{ background: '#854d0e', color: '#fef08a' }}>LOADING</span>;
      case 'IN_TRANSIT':
        return <span className="badge" style={{ background: '#6b21a8', color: '#e9d5ff' }}>IN_TRANSIT</span>;
      case 'PARTIALLY_DELIVERED':
        return <span className="badge" style={{ background: '#0d9488', color: '#99f6e4' }}>PARTIAL</span>;
      case 'DELIVERED':
        return <span className="badge" style={{ background: '#166534', color: '#bbf7d0' }}>DELIVERED</span>;
      case 'CLOSED':
        return <span className="badge" style={{ background: '#f1f5f9', color: 'var(--text-secondary)' }}>CLOSED</span>;
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
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
              Consignment Loads Management
            </h1>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              PHASE 4 CONSIGNMENT DISPATCH
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Multi-stop ordered waypoints, collision-safe atomic sequence numbering (LD-YYYY-XXXXX), and exact integer Paise financials.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => {
              setIsCreateOpen(true);
              setFormError(null);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
          >
            <span>➕</span> Create New Load
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Consignments</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.25rem' }}>
            {pagination.total}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#38bdf8', marginTop: '0.25rem' }}>Active company orders</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>In Transit / Active</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#a855f7', marginTop: '0.25rem' }}>
            {loads.filter(l => l.status === 'IN_TRANSIT' || l.status === 'LOADING' || l.status === 'ASSIGNED').length}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#c084fc', marginTop: '0.25rem' }}>On-road consignments</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Completed Deliveries</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
            {loads.filter(l => l.status === 'DELIVERED' || l.status === 'CLOSED').length}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#34d399', marginTop: '0.25rem' }}>Delivered successfully</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Page Freight Value</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.25rem' }}>
            ₹{((loads.reduce((acc, l) => acc + (l.financials?.totalFreightPaise || 0), 0)) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#fcd34d', marginTop: '0.25rem' }}>Calculated from Paise totals</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <input
            type="text"
            className="input"
            placeholder="Search Load #, package type, remarks..."
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
            <option value="CREATED">CREATED</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="LOADING">LOADING</option>
            <option value="IN_TRANSIT">IN_TRANSIT</option>
            <option value="PARTIALLY_DELIVERED">PARTIALLY_DELIVERED</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="CLOSED">CLOSED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
        <button onClick={() => fetchLoads(1)} className="btn btn-secondary">
          Refresh
        </button>
      </div>

      {/* Loads Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>LOAD #</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CUSTOMER / ROUTE</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CARGO</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ASSIGNED ASSETS</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>TOTAL FREIGHT</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>BALANCE DUE</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>STATUS</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading consignments...
                  </td>
                </tr>
              ) : loads.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No consignment loads found. Click "+ Create New Load" to begin.
                  </td>
                </tr>
              ) : (
                loads.map((load) => (
                  <tr key={load._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        onClick={() => openDetails(load._id)}
                        style={{
                          fontWeight: 700,
                          color: '#38bdf8',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        {load.loadNumber}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(load.orderDate).toLocaleDateString('en-IN')}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.85rem' }}>
                        {load.customerId?.name || 'Unknown Party'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {load.consignorId?.name || 'Consignor'} ➔ {load.consigneeId?.name || 'Consignee'}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>
                        {load.totalWeightMt} MT
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {load.totalQuantity} {load.packageType}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {load.assignedVehicleId ? (
                        <div>
                          <span style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.85rem' }}>
                            🚛 {load.assignedVehicleId.plateNumber}
                          </span>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            👤 {load.assignedDriverId?.name || 'Driver unassigned'}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          Not assigned
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#f8fafc' }}>
                      ₹{((load.financials?.totalFreightPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: (load.financials?.balancePaise || 0) > 0 ? '#fbbf24' : '#10b981' }}>
                      ₹{((load.financials?.balancePaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {getStatusBadge(load.status)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => openDetails(load._id)}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          title="View order command & ordered waypoints"
                        >
                          View Stops
                        </button>
                        <button
                          onClick={() => handlePreviewLoadingSlip(load)}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          title="Preview & Print Official Loading Slip / Gate Pass"
                        >
                          👁️ Gate Pass
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
        <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.4)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} consignments)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => fetchLoads(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
            >
              Previous
            </button>
            <button
              onClick={() => fetchLoads(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* CREATE LOAD MODAL */}
      {isCreateOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '1000px', maxHeight: '90vh', overflowY: 'auto', background: '#ffffff', border: '1px solid var(--border-subtle)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Create Consignment Order & Multi-Stop Route
                </h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Automatic atomic consignment sequence allocation (LD-YYYY-XXXXX) & integer Paise ledger calculations.
                </div>
              </div>
              <button onClick={() => setIsCreateOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleCreateLoad}>
              {/* Section 1: Customer & Cargo */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  1. Bill-To Party & Cargo Profile
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div>
                    <label className="label">Customer / Billing Party *</label>
                    <select
                      className="select"
                      required
                      value={formData.customerId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({
                          ...formData,
                          customerId: val,
                          consignorId: formData.consignorId || val,
                          consigneeId: formData.consigneeId || val
                        });
                      }}
                    >
                      <option value="">Select Customer</option>
                      {customers.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} ({c.code || c.partyType})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Consignor (From) *</label>
                    <select
                      className="select"
                      required
                      value={formData.consignorId}
                      onChange={(e) => setFormData({ ...formData, consignorId: e.target.value })}
                    >
                      <option value="">Select Consignor</option>
                      {customers.map((c) => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Consignee (To) *</label>
                    <select
                      className="select"
                      required
                      value={formData.consigneeId}
                      onChange={(e) => setFormData({ ...formData, consigneeId: e.target.value })}
                    >
                      <option value="">Select Consignee</option>
                      {customers.map((c) => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Package Type *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      value={formData.packageType}
                      onChange={(e) => setFormData({ ...formData, packageType: e.target.value })}
                      placeholder="e.g. Bags, Steel Coils, Cartons"
                    />
                  </div>

                  <div>
                    <label className="label">Total Weight (Metric Tons) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      required
                      value={formData.totalWeightMt}
                      onChange={(e) => setFormData({ ...formData, totalWeightMt: e.target.value })}
                      placeholder="e.g. 24.5"
                    />
                  </div>

                  <div>
                    <label className="label">Total Package Count *</label>
                    <input
                      type="number"
                      className="input"
                      required
                      value={formData.totalQuantity}
                      onChange={(e) => setFormData({ ...formData, totalQuantity: e.target.value })}
                      placeholder="e.g. 450"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Multi-Stop Ordered Waypoint Builder */}
              <div style={{ marginBottom: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    2. Multi-Stop Ordered Route & Quantities
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddStop}
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
                  >
                    ➕ Add Route Stop
                  </button>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: '6px', border: '1px solid var(--border-subtle)', padding: '0.75rem' }}>
                  {formData.stops.map((stop, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '40px 110px 220px 100px 100px 1fr 35px', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 700, color: '#38bdf8', textAlign: 'center' }}>
                        #{stop.sequence}
                      </div>

                      <select
                        className="select"
                        value={stop.stopType}
                        onChange={(e) => {
                          const updated = [...formData.stops];
                          updated[idx].stopType = e.target.value;
                          setFormData({ ...formData, stops: updated });
                        }}
                        style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                      >
                        <option value="PICKUP">PICKUP</option>
                        <option value="DELIVERY">DELIVERY</option>
                        <option value="WAYPOINT">WAYPOINT</option>
                      </select>

                      <select
                        className="select"
                        required
                        value={stop.locationId}
                        onChange={(e) => {
                          const updated = [...formData.stops];
                          updated[idx].locationId = e.target.value;
                          setFormData({ ...formData, stops: updated });
                        }}
                        style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                      >
                        <option value="">Select Location *</option>
                        {locations.map((loc) => (
                          <option key={loc._id} value={loc._id}>
                            {loc.name} ({loc.city}, {loc.state})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        className="input"
                        placeholder="Pkgs"
                        value={stop.allocatedQuantity}
                        onChange={(e) => {
                          const updated = [...formData.stops];
                          updated[idx].allocatedQuantity = parseInt(e.target.value, 10) || 0;
                          setFormData({ ...formData, stops: updated });
                        }}
                        style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                      />

                      <input
                        type="number"
                        step="0.01"
                        className="input"
                        placeholder="MT"
                        value={stop.allocatedWeightMt}
                        onChange={(e) => {
                          const updated = [...formData.stops];
                          updated[idx].allocatedWeightMt = parseFloat(e.target.value) || 0;
                          setFormData({ ...formData, stops: updated });
                        }}
                        style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                      />

                      <input
                        type="text"
                        className="input"
                        placeholder="Contact Person / Phone"
                        value={stop.contactPerson}
                        onChange={(e) => {
                          const updated = [...formData.stops];
                          updated[idx].contactPerson = e.target.value;
                          setFormData({ ...formData, stops: updated });
                        }}
                        style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                      />

                      <button
                        type="button"
                        onClick={() => handleRemoveStop(idx)}
                        disabled={formData.stops.length <= 1}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem' }}
                        title="Delete stop"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Integer Paise Financial Ledger */}
              <div style={{ marginBottom: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  3. Freight Charges & Financial Breakdown (INR ₹)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                  <div>
                    <label className="label">Base Freight (₹) *</label>
                    <input
                      type="number"
                      className="input"
                      required
                      value={formData.financials.baseFreightRupees}
                      onChange={(e) => setFormData({ ...formData, financials: { ...formData.financials, baseFreightRupees: e.target.value } })}
                    />
                  </div>

                  <div>
                    <label className="label">Loading Charges (₹)</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.financials.loadingRupees}
                      onChange={(e) => setFormData({ ...formData, financials: { ...formData.financials, loadingRupees: e.target.value } })}
                    />
                  </div>

                  <div>
                    <label className="label">Unloading Charges (₹)</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.financials.unloadingRupees}
                      onChange={(e) => setFormData({ ...formData, financials: { ...formData.financials, unloadingRupees: e.target.value } })}
                    />
                  </div>

                  <div>
                    <label className="label">Toll & Highway (₹)</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.financials.tollRupees}
                      onChange={(e) => setFormData({ ...formData, financials: { ...formData.financials, tollRupees: e.target.value } })}
                    />
                  </div>

                  <div>
                    <label className="label">Detention Charges (₹)</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.financials.detentionRupees}
                      onChange={(e) => setFormData({ ...formData, financials: { ...formData.financials, detentionRupees: e.target.value } })}
                    />
                  </div>

                  <div>
                    <label className="label">Advance Paid (₹)</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.financials.advanceRupees}
                      onChange={(e) => setFormData({ ...formData, financials: { ...formData.financials, advanceRupees: e.target.value } })}
                    />
                  </div>

                  <div>
                    <label className="label">Deduction / Penalty (₹)</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.financials.deductionRupees}
                      onChange={(e) => setFormData({ ...formData, financials: { ...formData.financials, deductionRupees: e.target.value } })}
                    />
                  </div>

                  {/* Calculated Balance Box */}
                  <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', padding: '0.6rem 0.8rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Total Freight / Balance</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                      ₹{calcTotalFreight().toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38bdf8' }}>
                      Bal: ₹{calcNetBalance().toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label">Operational Instructions & Remarks</label>
                <input
                  type="text"
                  className="input"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Special handling instructions, gate pass restrictions..."
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="btn btn-secondary"
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formLoading}
                  style={{ fontWeight: 700, minWidth: '160px' }}
                >
                  {formLoading ? 'Creating Load...' : 'Save & Allocate Consignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOAD DETAILS & COMMAND CENTER MODAL */}
      {isDetailOpen && selectedLoad && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '950px', maxHeight: '92vh', overflowY: 'auto', background: '#ffffff', border: '1px solid var(--border-subtle)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                  {selectedLoad.loadNumber}
                </div>
                {getStatusBadge(selectedLoad.status)}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  onClick={() => handlePreviewLoadingSlip(selectedLoad)}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
                >
                  👁️ Gate Pass (PDF)
                </button>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* State Machine Transition Bar */}
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>
                Operational State Progression (State Machine Enforced)
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {selectedLoad.status === 'CREATED' && (
                  <button onClick={() => setIsAssignOpen(true)} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
                    ➔ Assign Vehicle & Driver
                  </button>
                )}
                {selectedLoad.status === 'ASSIGNED' && (
                  <button onClick={() => handleStatusTransition(selectedLoad._id, 'LOADING')} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
                    ➔ Start Loading
                  </button>
                )}
                {selectedLoad.status === 'LOADING' && (
                  <button onClick={() => handleStatusTransition(selectedLoad._id, 'IN_TRANSIT')} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
                    ➔ Dispatch In-Transit
                  </button>
                )}
                {selectedLoad.status === 'IN_TRANSIT' && (
                  <>
                    <button onClick={() => handleStatusTransition(selectedLoad._id, 'PARTIALLY_DELIVERED')} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
                      Mark Partial Delivery
                    </button>
                    <button onClick={() => handleStatusTransition(selectedLoad._id, 'DELIVERED')} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
                      ➔ Confirm Complete Delivery
                    </button>
                  </>
                )}
                {selectedLoad.status === 'DELIVERED' && (
                  <button onClick={() => handleStatusTransition(selectedLoad._id, 'CLOSED')} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
                    ➔ Close Consignment
                  </button>
                )}
                {selectedLoad.status !== 'CLOSED' && selectedLoad.status !== 'CANCELLED' && (
                  <button onClick={() => handleStatusTransition(selectedLoad._id, 'CANCELLED')} className="btn btn-secondary" style={{ fontSize: '0.8rem', color: '#f87171' }}>
                    Cancel Consignment
                  </button>
                )}
              </div>
            </div>

            {/* 2-Column Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#38bdf8' }}>Consignment & Parties</h4>
                <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}><strong>Customer:</strong> {selectedLoad.customerId?.name}</div>
                <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}><strong>Consignor:</strong> {selectedLoad.consignorId?.name}</div>
                <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}><strong>Consignee:</strong> {selectedLoad.consigneeId?.name}</div>
                <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}><strong>Cargo:</strong> {selectedLoad.totalWeightMt} MT ({selectedLoad.totalQuantity} {selectedLoad.packageType})</div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#38bdf8' }}>Assigned Fleet Assets</h4>
                  <button onClick={() => setIsAssignOpen(true)} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
                    Reassign
                  </button>
                </div>
                <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <strong>Vehicle:</strong> {selectedLoad.assignedVehicleId ? `${selectedLoad.assignedVehicleId.plateNumber} (${selectedLoad.assignedVehicleId.make || ''})` : 'Unassigned'}
                </div>
                <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <strong>Driver:</strong> {selectedLoad.assignedDriverId ? `${selectedLoad.assignedDriverId.name} (${selectedLoad.assignedDriverId.phone || 'No phone'})` : 'Unassigned'}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong>Order Date:</strong> {new Date(selectedLoad.orderDate).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Route Stops Table */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
                Ordered Stops & Location Waypoints ({selectedLoad.stops?.length || 0})
              </h4>
              <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
                    <th style={{ padding: '0.5rem' }}>SEQ</th>
                    <th style={{ padding: '0.5rem' }}>TYPE</th>
                    <th style={{ padding: '0.5rem' }}>LOCATION</th>
                    <th style={{ padding: '0.5rem' }}>ALLOCATED</th>
                    <th style={{ padding: '0.5rem' }}>DELIVERED</th>
                    <th style={{ padding: '0.5rem' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedLoad.stops?.map((stop: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 700, color: '#38bdf8' }}>#{stop.sequence}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <span className="badge" style={{ fontSize: '0.7rem' }}>{stop.stopType}</span>
                      </td>
                      <td style={{ padding: '0.5rem' }}>{stop.locationId?.name || 'Hub/Depot'}</td>
                      <td style={{ padding: '0.5rem' }}>{stop.allocatedQuantity} Pkgs ({stop.allocatedWeightMt} MT)</td>
                      <td style={{ padding: '0.5rem' }}>{stop.deliveredQuantity || 0} Pkgs</td>
                      <td style={{ padding: '0.5rem' }}>
                        <span className="badge" style={{ background: stop.status === 'COMPLETED' ? '#166534' : '#334155', color: '#f8fafc', fontSize: '0.7rem' }}>
                          {stop.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financials Breakdown (Integer Paise formatted) */}
            <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#fbbf24' }}>
                Exact Financial Ledger (Stored in Integer Paise)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>Base Freight: <strong>₹{((selectedLoad.financials?.baseFreightPaise || 0) / 100).toFixed(2)}</strong></div>
                <div>Toll: <strong>₹{((selectedLoad.financials?.tollPaise || 0) / 100).toFixed(2)}</strong></div>
                <div>Loading/Unloading: <strong>₹{(((selectedLoad.financials?.loadingPaise || 0) + (selectedLoad.financials?.unloadingPaise || 0)) / 100).toFixed(2)}</strong></div>
                <div>Total Freight: <strong style={{ color: '#38bdf8' }}>₹{((selectedLoad.financials?.totalFreightPaise || 0) / 100).toFixed(2)}</strong></div>
                <div>Advance Paid: <strong>₹{((selectedLoad.financials?.advancePaise || 0) / 100).toFixed(2)}</strong></div>
                <div>Deductions: <strong>₹{((selectedLoad.financials?.deductionPaise || 0) / 100).toFixed(2)}</strong></div>
                <div>Balance Due: <strong style={{ color: '#10b981' }}>₹{((selectedLoad.financials?.balancePaise || 0) / 100).toFixed(2)}</strong></div>
              </div>
            </div>

            {/* Status History Audit */}
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Audit Status Timeline
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {selectedLoad.statusHistory?.map((h: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem' }}>
                    <span style={{ color: '#38bdf8' }}>{new Date(h.timestamp).toLocaleString('en-IN')}</span>
                    <strong style={{ color: '#f8fafc' }}>{h.status}</strong>
                    <span>{h.reason}</span>
                    <span>by {h.changedBy?.name || 'System'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN ASSETS MODAL */}
      {isAssignOpen && selectedLoad && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '500px', background: '#ffffff', border: '1px solid var(--border-subtle)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Assign Vehicle & Driver to {selectedLoad.loadNumber}
            </h3>

            <form onSubmit={handleAssignAssets}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Select Fleet Vehicle</label>
                <select
                  className="select"
                  value={assignData.vehicleId}
                  onChange={(e) => setAssignData({ ...assignData, vehicleId: e.target.value })}
                >
                  <option value="">Choose Vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.plateNumber} ({v.make} {v.model}) - {v.status}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label">Select Fleet Driver</label>
                <select
                  className="select"
                  value={assignData.driverId}
                  onChange={(e) => setAssignData({ ...assignData, driverId: e.target.value })}
                >
                  <option value="">Choose Driver</option>
                  {drivers.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.phone}) - {d.status}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setIsAssignOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }}>
                  Confirm Assignment
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
