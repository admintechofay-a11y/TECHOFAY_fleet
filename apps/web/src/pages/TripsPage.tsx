import React, { useState, useEffect } from 'react';
import { apiRequest, apiDownload } from '../lib/api';
import { PdfViewerModal } from '../components/PdfViewerModal';

export const TripsPage: React.FC = () => {
  const [trips, setTrips] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Selected Trip Command Drawer
  const [activeTrip, setActiveTrip] = useState<any | null>(null);

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

  // Dispatch Modal state
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchForm, setDispatchForm] = useState({
    loadId: '',
    vehicleId: '',
    driverId: '',
    driverAdvanceRupees: '0',
    remarks: ''
  });

  // Record Delivery Modal state
  const [isDeliveryOpen, setIsDeliveryOpen] = useState(false);
  const [selectedStop, setSelectedStop] = useState<any | null>(null);
  const [deliveryQty, setDeliveryQty] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [deliveryRemarks, setDeliveryRemarks] = useState('');
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  // Add Expense Modal state
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [expenseType, setExpenseType] = useState('DIESEL');
  const [expenseAmountRupees, setExpenseAmountRupees] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expensePaidBy, setExpensePaidBy] = useState('DRIVER');
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // General Action Feedback
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // PDF Preview Handlers
  const handlePreviewTripSheet = (trip: any) => {
    setPdfModal({
      isOpen: true,
      endpoint: `/trips/${trip._id}/tripsheet`,
      title: `Official Trip Sheet - ${trip.tripNumber}`,
      documentNumber: trip.tripNumber,
      whatsappPhone: trip.driverId?.phone || ''
    });
  };

  const handlePreviewSettlement = (trip: any) => {
    setPdfModal({
      isOpen: true,
      endpoint: `/trips/${trip._id}/settlement`,
      title: `Trip Financial Settlement - ${trip.tripNumber}`,
      documentNumber: trip.tripNumber,
      whatsappPhone: trip.driverId?.phone || ''
    });
  };

  const fetchTrips = async (page = 1) => {
    setLoading(true);
    try {
      let q = `/trips?page=${page}&limit=10`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) q += `&status=${statusFilter}`;

      const res = await apiRequest(q);
      setTrips(res.data.items);
      setPagination(res.data.pagination);
    } catch (err: any) {
      console.error('Failed to load trips:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [loadsRes, vehiclesRes, driversRes] = await Promise.all([
        apiRequest('/loads?limit=50&status=CREATED'),
        apiRequest('/vehicles?limit=100&status=AVAILABLE'),
        apiRequest('/drivers?limit=100&status=AVAILABLE')
      ]);
      setLoads(loadsRes.data.items || []);
      setVehicles(vehiclesRes.data.items || []);
      setDrivers(driversRes.data.items || []);
    } catch (err: any) {
      console.error('Failed to load dependencies:', err.message);
    }
  };

  useEffect(() => {
    fetchTrips(1);
    fetchDependencies();
  }, [search, statusFilter]);

  const refreshActiveTrip = async (tripId: string) => {
    try {
      const res = await apiRequest(`/trips/${tripId}`);
      setActiveTrip(res.data);
      fetchTrips(pagination.page);
    } catch (err: any) {
      console.error('Failed to refresh active trip:', err.message);
    }
  };

  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchLoading(true);
    setDispatchError(null);

    try {
      const advancePaise = Math.round((parseFloat(dispatchForm.driverAdvanceRupees) || 0) * 100);
      const payload = {
        loadId: dispatchForm.loadId,
        vehicleId: dispatchForm.vehicleId,
        driverId: dispatchForm.driverId,
        driverAdvancePaise: advancePaise,
        remarks: dispatchForm.remarks
      };

      const res = await apiRequest('/trips', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setIsDispatchOpen(false);
      setDispatchForm({
        loadId: '',
        vehicleId: '',
        driverId: '',
        driverAdvanceRupees: '0',
        remarks: ''
      });
      setActionMessage({ text: `Trip ${res.data.tripNumber} successfully dispatched!`, type: 'success' });
      fetchTrips(1);
      fetchDependencies();
    } catch (err: any) {
      setDispatchError(err.message || 'Failed to dispatch trip');
    } finally {
      setDispatchLoading(false);
    }
  };

  const handleUpdateStatus = async (tripId: string, targetStatus: string, reason = '') => {
    try {
      await apiRequest(`/trips/${tripId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: targetStatus, reason })
      });
      setActionMessage({ text: `Trip transitioned to ${targetStatus}`, type: 'success' });
      await refreshActiveTrip(tripId);
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Status transition failed', type: 'error' });
    }
  };

  const handleRecordDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !selectedStop) return;

    setDeliveryLoading(true);
    setDeliveryError(null);

    try {
      const qty = parseInt(deliveryQty, 10);
      await apiRequest(`/trips/${activeTrip._id}/stops/${selectedStop._id}/deliver`, {
        method: 'POST',
        body: JSON.stringify({
          deliveredQuantity: qty,
          receiverName,
          receiverPhone,
          remarks: deliveryRemarks
        })
      });

      setIsDeliveryOpen(false);
      setSelectedStop(null);
      setDeliveryQty('');
      setReceiverName('');
      setReceiverPhone('');
      setDeliveryRemarks('');
      setActionMessage({ text: 'Delivery recorded successfully!', type: 'success' });
      await refreshActiveTrip(activeTrip._id);
    } catch (err: any) {
      setDeliveryError(err.message || 'Failed to record delivery');
    } finally {
      setDeliveryLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip) return;

    setExpenseLoading(true);
    setExpenseError(null);

    try {
      const amountPaise = Math.round((parseFloat(expenseAmountRupees) || 0) * 100);
      await apiRequest(`/trips/${activeTrip._id}/expenses`, {
        method: 'POST',
        body: JSON.stringify({
          expenseType,
          amountPaise,
          description: expenseDescription,
          paidBy: expensePaidBy
        })
      });

      setIsExpenseOpen(false);
      setExpenseAmountRupees('');
      setExpenseDescription('');
      setActionMessage({ text: 'Route expense added successfully!', type: 'success' });
      await refreshActiveTrip(activeTrip._id);
    } catch (err: any) {
      setExpenseError(err.message || 'Failed to add route expense');
    } finally {
      setExpenseLoading(false);
    }
  };

  const handleCloseTrip = async (tripId: string) => {
    if (!window.confirm('Are you sure you want to close this trip? This requires all stops completed and POD attached.')) {
      return;
    }
    try {
      await apiRequest(`/trips/${tripId}/close`, { method: 'POST' });
      setActionMessage({ text: 'Trip successfully closed. Assets returned to available.', type: 'success' });
      await refreshActiveTrip(tripId);
      fetchDependencies();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Trip closure failed', type: 'error' });
    }
  };

  // Helper status badge
  const renderStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      CREATED: { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', label: 'Created' },
      VEHICLE_ASSIGNED: { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', label: 'Assigned' },
      LOADING: { bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308', label: 'Loading' },
      IN_TRANSIT: { bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', label: 'In Transit' },
      PARTIALLY_DELIVERED: { bg: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', label: 'Partial Delivery' },
      DELIVERED: { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', label: 'Delivered' },
      CLOSED: { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981', label: 'Closed' },
      CANCELLED: { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', label: 'Cancelled' }
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
              Trip Dispatch & Operations
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
            Assign compliant fleet assets, monitor waypoints, reconcile partial deliveries, record expenses, and close trips.
          </p>
        </div>

        <button
          onClick={() => {
            setIsDispatchOpen(true);
            setDispatchError(null);
          }}
          className="btn btn-primary"
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
          }}
        >
          <span>➕</span> Dispatch New Trip
        </button>
      </div>

      {/* Global Feedback Banner */}
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

      {/* Top Operational Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>Active Fleet Trips</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.35rem' }}>
            {trips.filter(t => !['CLOSED', 'CANCELLED'].includes(t.status)).length}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>Dispatched or In Transit</div>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>In Transit</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#c084fc', marginTop: '0.35rem' }}>
            {trips.filter(t => t.status === 'IN_TRANSIT').length}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>On the highway</div>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>Delivered / Ready to Close</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#4ade80', marginTop: '0.35rem' }}>
            {trips.filter(t => t.status === 'DELIVERED').length}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>Awaiting POD verification</div>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>Total Completed / Closed</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.35rem' }}>
            {trips.filter(t => t.status === 'CLOSED').length}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>Settled & archived</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          background: '#0f172a',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid #1e293b',
          marginBottom: '1.5rem'
        }}
      >
        <div style={{ flex: '1 1 250px' }}>
          <input
            type="text"
            placeholder="Search by Trip # or remarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.9rem',
              borderRadius: '8px',
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
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
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              fontSize: '0.875rem'
            }}
          >
            <option value="">All Statuses</option>
            <option value="VEHICLE_ASSIGNED">Vehicle Assigned</option>
            <option value="LOADING">Loading</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="PARTIALLY_DELIVERED">Partially Delivered</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Trips Table */}
      <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Trip Ref #</th>
                <th style={{ padding: '0.85rem 1rem' }}>Linked Load</th>
                <th style={{ padding: '0.85rem 1rem' }}>Vehicle</th>
                <th style={{ padding: '0.85rem 1rem' }}>Driver</th>
                <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                <th style={{ padding: '0.85rem 1rem' }}>Waypoints</th>
                <th style={{ padding: '0.85rem 1rem' }}>Route Expenses</th>
                <th style={{ padding: '0.85rem 1rem' }}>Settlement</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    Loading active trip registry...
                  </td>
                </tr>
              ) : trips.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    No trips found matching filter criteria. Dispatch your first trip above!
                  </td>
                </tr>
              ) : (
                trips.map((trip) => {
                  const grossFreight = ((trip.financials?.grossFreightPaise || 0) / 100).toFixed(2);
                  const totalExp = ((trip.financials?.totalExpensesPaise || 0) / 100).toFixed(2);
                  const net = ((trip.financials?.netSettlementPaise || 0) / 100).toFixed(2);

                  return (
                    <tr
                      key={trip._id}
                      style={{
                        borderBottom: '1px solid #1e293b',
                        transition: 'background 0.15s ease',
                        cursor: 'pointer'
                      }}
                      onClick={() => setActiveTrip(trip)}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#1e293b55')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                    >
                      <td style={{ padding: '1rem', fontWeight: 700, color: '#38bdf8' }}>
                        {trip.tripNumber}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 600 }}>{trip.loadId?.loadNumber || 'N/A'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {trip.loadId?.totalWeightMt || 0} MT ({trip.loadId?.totalQuantity || 0} Pkgs)
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 600 }}>{trip.vehicleId?.plateNumber || 'N/A'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{trip.vehicleId?.vehicleType}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 600 }}>{trip.driverId?.name || 'N/A'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{trip.driverId?.phone}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>{renderStatusBadge(trip.status)}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '0.8rem' }}>
                          {trip.stops?.length || 0} stop(s)
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          {trip.stops?.filter((s: any) => s.status === 'COMPLETED').length} completed
                        </div>
                      </td>
                      <td style={{ padding: '1rem', color: '#fb923c' }}>
                        ₹{totalExp}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 600, color: '#4ade80' }}>
                        ₹{net}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => setActiveTrip(trip)}
                            title="Open Trip Command Drawer"
                            style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              background: '#334155',
                              border: '1px solid #475569',
                              color: '#f8fafc',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            🕹️ Manage
                          </button>
                          <button
                            onClick={() => handlePreviewTripSheet(trip)}
                            title="Preview & Print Official Trip Sheet"
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
                            👁️ Trip Sheet
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatch New Trip Modal */}
      {isDispatchOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem'
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              maxWidth: '620px',
              width: '100%',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Dispatch New Trip</h2>
              <button
                onClick={() => setIsDispatchOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {dispatchError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#f87171',
                  marginBottom: '1rem',
                  fontSize: '0.85rem'
                }}
              >
                ⚠️ {dispatchError}
              </div>
            )}

            <form onSubmit={handleCreateDispatch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Select Load / Order *
                </label>
                <select
                  required
                  value={dispatchForm.loadId}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, loadId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc'
                  }}
                >
                  <option value="">-- Choose Consignment Load --</option>
                  {loads.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.loadNumber} — {l.totalWeightMt} MT ({l.packageType || 'Freight'}) — ₹{((l.financials?.totalFreightPaise || 0) / 100).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Assigned Vehicle *
                  </label>
                  <select
                    required
                    value={dispatchForm.vehicleId}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.9rem',
                      borderRadius: '8px',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      color: '#f8fafc'
                    }}
                  >
                    <option value="">-- Select Available Vehicle --</option>
                    {vehicles.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.plateNumber} ({v.vehicleType} - {v.capacityTonnage} MT)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Assigned Driver *
                  </label>
                  <select
                    required
                    value={dispatchForm.driverId}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, driverId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.9rem',
                      borderRadius: '8px',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      color: '#f8fafc'
                    }}
                  >
                    <option value="">-- Select Available Driver --</option>
                    {drivers.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.phone} - DL {d.licenseType})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Driver Route Advance (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dispatchForm.driverAdvanceRupees}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, driverAdvanceRupees: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Trip Dispatch Remarks
                </label>
                <textarea
                  rows={2}
                  value={dispatchForm.remarks}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, remarks: e.target.value })}
                  placeholder="Special instructions, gate instructions, temperature guidelines..."
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsDispatchOpen(false)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    background: '#334155',
                    border: 'none',
                    color: '#f8fafc',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatchLoading}
                  style={{
                    padding: '0.65rem 1.5rem',
                    borderRadius: '8px',
                    background: '#0284c7',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {dispatchLoading ? 'Dispatching...' : 'Dispatch Trip 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Trip Command Drawer / Detailed Modal */}
      {activeTrip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 100
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '850px',
              background: '#0a0f1d',
              borderLeft: '1px solid #1e293b',
              height: '100vh',
              overflowY: 'auto',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>
                    Trip {activeTrip.tripNumber}
                  </h2>
                  {renderStatusBadge(activeTrip.status)}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Load Ref: <span style={{ color: '#f8fafc', fontWeight: 600 }}>{activeTrip.loadId?.loadNumber}</span> | Dispatched: {new Date(activeTrip.startDateTime || activeTrip.createdAt).toLocaleDateString('en-IN')}
                </div>
              </div>
              <button
                onClick={() => setActiveTrip(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.5rem' }}
              >
                ✕
              </button>
            </div>

            {/* Quick Actions Ribbon */}
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
                background: '#0f172a',
                padding: '0.75rem',
                borderRadius: '10px',
                border: '1px solid #1e293b'
              }}
            >
              {activeTrip.status === 'VEHICLE_ASSIGNED' && (
                <button
                  onClick={() => handleUpdateStatus(activeTrip._id, 'LOADING', 'Commencing load at pickup warehouse')}
                  style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: '#eab308', color: '#000', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  📦 Begin Loading
                </button>
              )}
              {activeTrip.status === 'LOADING' && (
                <button
                  onClick={() => handleUpdateStatus(activeTrip._id, 'IN_TRANSIT', 'Loaded and dispatched on highway')}
                  style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: '#38bdf8', color: '#000', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  🚚 Set In Transit
                </button>
              )}
              {['IN_TRANSIT', 'PARTIALLY_DELIVERED', 'DELIVERED'].includes(activeTrip.status) && (
                <button
                  onClick={() => {
                    setIsExpenseOpen(true);
                    setExpenseError(null);
                  }}
                  style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: '#f97316', color: '#ffffff', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  💸 Add Route Expense
                </button>
              )}
              {activeTrip.status !== 'CLOSED' && activeTrip.status !== 'CANCELLED' && (
                <button
                  onClick={() => handleCloseTrip(activeTrip._id)}
                  style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: '#10b981', color: '#ffffff', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  🔒 Close Trip
                </button>
              )}
              <button
                onClick={() => handlePreviewTripSheet(activeTrip)}
                style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: '#1e293b', border: '1px solid #334155', color: '#38bdf8', fontWeight: 600, cursor: 'pointer' }}
              >
                👁️ Preview Trip Sheet
              </button>
              <button
                onClick={() => handlePreviewSettlement(activeTrip)}
                style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: '#1e293b', border: '1px solid #334155', color: '#4ade80', fontWeight: 600, cursor: 'pointer' }}
              >
                👁️ Preview Settlement
              </button>
            </div>

            {/* Asset Allocation Card */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Assigned Vehicle</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>
                  {activeTrip.vehicleId?.plateNumber || 'N/A'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {activeTrip.vehicleId?.vehicleType} • Capacity: {activeTrip.vehicleId?.capacityTonnage} MT
                </div>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Assigned Driver</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>
                  {activeTrip.driverId?.name || 'N/A'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Phone: {activeTrip.driverId?.phone} • Licence: {activeTrip.driverId?.licenseNumber}
                </div>
              </div>
            </div>

            {/* Stops & Waypoint Delivery Progress */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📍</span> Waypoint Delivery Progress
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {activeTrip.stops?.map((stop: any) => (
                  <div
                    key={stop._id}
                    style={{
                      background: '#1e293b55',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: '#38bdf8' }}>Stop {stop.sequence}:</span>
                        <span style={{ fontWeight: 600 }}>{stop.locationId?.name || 'Warehouse Point'}</span>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: stop.stopType === 'PICKUP' ? '#0284c733' : '#10b98133',
                            color: stop.stopType === 'PICKUP' ? '#38bdf8' : '#34d399',
                            fontWeight: 600
                          }}
                        >
                          {stop.stopType}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                        Allocated: {stop.allocatedQuantity} Pkgs | Delivered: {stop.deliveredQuantity} | Pending: {stop.pendingQuantity}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          background: stop.status === 'COMPLETED' ? '#10b98122' : '#f59e0b22',
                          color: stop.status === 'COMPLETED' ? '#34d399' : '#fbbf24',
                          fontWeight: 600
                        }}
                      >
                        {stop.status}
                      </span>
                      {stop.stopType === 'DELIVERY' && stop.status !== 'COMPLETED' && (
                        <button
                          onClick={() => {
                            setSelectedStop(stop);
                            setDeliveryQty(stop.pendingQuantity.toString());
                            setIsDeliveryOpen(true);
                            setDeliveryError(null);
                          }}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            background: '#0284c7',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Record Delivery 📦
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Reconciliation & Route Expenses */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>💰</span> Route Accounting & Expenses
                </h3>
                <button
                  onClick={() => {
                    setIsExpenseOpen(true);
                    setExpenseError(null);
                  }}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    background: '#334155',
                    border: '1px solid #475569',
                    color: '#f8fafc',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  ➕ Add Expense
                </button>
              </div>

              {/* Financial summary bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem', textAlign: 'center' }}>
                <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Gross Freight</div>
                  <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1rem' }}>
                    ₹{((activeTrip.financials?.grossFreightPaise || 0) / 100).toFixed(2)}
                  </div>
                </div>
                <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Driver Advance</div>
                  <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '1rem' }}>
                    - ₹{((activeTrip.financials?.driverAdvancePaise || 0) / 100).toFixed(2)}
                  </div>
                </div>
                <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Route Expenses</div>
                  <div style={{ fontWeight: 700, color: '#fb923c', fontSize: '1rem' }}>
                    - ₹{((activeTrip.financials?.totalExpensesPaise || 0) / 100).toFixed(2)}
                  </div>
                </div>
                <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Net Settlement</div>
                  <div style={{ fontWeight: 700, color: '#4ade80', fontSize: '1rem' }}>
                    ₹{((activeTrip.financials?.netSettlementPaise || 0) / 100).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Expenses Line Items Table */}
              {activeTrip.expenses && activeTrip.expenses.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                        <th style={{ padding: '0.4rem' }}>Type</th>
                        <th style={{ padding: '0.4rem' }}>Description</th>
                        <th style={{ padding: '0.4rem' }}>Paid By</th>
                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTrip.expenses.map((exp: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '0.5rem', fontWeight: 600, color: '#38bdf8' }}>{exp.expenseType}</td>
                          <td style={{ padding: '0.5rem' }}>{exp.description || '-'}</td>
                          <td style={{ padding: '0.5rem', color: '#94a3b8' }}>{exp.paidBy}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                            ₹{((exp.amountPaise || 0) / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', padding: '0.75rem' }}>
                  No line-item route expenses recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Stop Delivery Modal */}
      {isDeliveryOpen && selectedStop && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '1rem'
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '2rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Record Delivery — Stop {selectedStop.sequence}</h3>
              <button
                onClick={() => setIsDeliveryOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {deliveryError && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#f87171',
                  marginBottom: '1rem',
                  fontSize: '0.85rem'
                }}
              >
                ⚠️ {deliveryError}
              </div>
            )}

            <form onSubmit={handleRecordDelivery} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Delivered Quantity (Pkgs) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedStop.pendingQuantity}
                  value={deliveryQty}
                  onChange={(e) => setDeliveryQty(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc'
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '0.25rem', display: 'block' }}>
                  Pending for delivery: {selectedStop.pendingQuantity} Pkgs
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Receiver Name *
                </label>
                <input
                  type="text"
                  required
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar (Store Manager)"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Receiver Contact Phone
                </label>
                <input
                  type="tel"
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Remarks / Unloading Notes
                </label>
                <textarea
                  rows={2}
                  value={deliveryRemarks}
                  onChange={(e) => setDeliveryRemarks(e.target.value)}
                  placeholder="e.g. Received in sound condition, sealed boxes intact"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsDeliveryOpen(false)}
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', background: '#334155', border: 'none', color: '#f8fafc', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deliveryLoading}
                  style={{ padding: '0.65rem 1.5rem', borderRadius: '8px', background: '#0284c7', border: 'none', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
                >
                  {deliveryLoading ? 'Saving...' : 'Confirm Delivery ✅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Route Expense Modal */}
      {isExpenseOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '1rem'
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              padding: '2rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Add Line-Item Route Expense</h3>
              <button
                onClick={() => setIsExpenseOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {expenseError && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#f87171',
                  marginBottom: '1rem',
                  fontSize: '0.85rem'
                }}
              >
                ⚠️ {expenseError}
              </div>
            )}

            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Expense Category *
                </label>
                <select
                  value={expenseType}
                  onChange={(e) => setExpenseType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc'
                  }}
                >
                  <option value="DIESEL">Diesel / Fuel</option>
                  <option value="TOLL">FASTag / Toll Plaza</option>
                  <option value="DRIVER_BHATTA">Driver Daily Bhatta / Food</option>
                  <option value="POLICE_CHALLAN">Police / RTO Challan</option>
                  <option value="MAINTENANCE">En-Route Puncture / Repair</option>
                  <option value="LOADING_UNLOADING">Loading / Unloading Hamali</option>
                  <option value="OTHER">Other Route Incidental</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={expenseAmountRupees}
                  onChange={(e) => setExpenseAmountRupees(e.target.value)}
                  placeholder="e.g. 3500.00"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Paid By *
                </label>
                <select
                  value={expensePaidBy}
                  onChange={(e) => setExpensePaidBy(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc'
                  }}
                >
                  <option value="DRIVER">Driver (Cash / From Advance)</option>
                  <option value="COMPANY">Company Direct (Card / Bank Transfer)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Description / Receipt Reference
                </label>
                <input
                  type="text"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  placeholder="e.g. Indian Oil Pump, Jaipur Highway Slip #4928"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsExpenseOpen(false)}
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', background: '#334155', border: 'none', color: '#f8fafc', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseLoading}
                  style={{ padding: '0.65rem 1.5rem', borderRadius: '8px', background: '#f97316', border: 'none', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
                >
                  {expenseLoading ? 'Saving...' : 'Add Expense 💸'}
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
