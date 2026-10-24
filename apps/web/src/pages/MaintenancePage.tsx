import React, { useState, useEffect } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { PdfViewerModal } from '../components/PdfViewerModal';

interface MaintenanceRecord {
  _id: string;
  maintenanceNumber: string;
  serviceType: string;
  priority: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  scheduledDate: string;
  startDate?: string;
  completedDate?: string;
  odometerReadingKm?: number;
  serviceCenter?: {
    name?: string;
    city?: string;
    contactPhone?: string;
  };
  costPaise: number;
  invoiceNumber?: string;
  technicianRemarks?: string;
  vehicleId?: {
    _id: string;
    plateNumber: string;
    vehicleType: string;
    make?: string;
    model?: string;
    status: string;
  };
}

interface MaintenanceStats {
  scheduledCount: number;
  inProgressCount: number;
  completedThisMonth: number;
  overdueCount: number;
  totalCostThisMonthRupees: number;
}

interface VehicleOption {
  _id: string;
  plateNumber: string;
  vehicleType: string;
  status: string;
}

export const MaintenancePage: React.FC = () => {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [stats, setStats] = useState<MaintenanceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState<MaintenanceRecord | null>(null);

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

  const handlePreviewJobCard = (rec: MaintenanceRecord) => {
    setPdfModal({
      isOpen: true,
      endpoint: `/maintenance/${rec._id}/job-card`,
      title: `Maintenance Job Card & Work Order - ${rec.maintenanceNumber}`,
      documentNumber: rec.maintenanceNumber,
      whatsappPhone: rec.serviceCenter?.contactPhone || ''
    });
  };

  // Form State
  const [formData, setFormData] = useState({
    vehicleId: '',
    serviceType: 'GENERAL_SERVICE',
    priority: 'MEDIUM',
    scheduledDate: new Date().toISOString().split('T')[0],
    odometerReadingKm: '',
    serviceCenterName: '',
    serviceCenterCity: '',
    costRupees: '',
    technicianRemarks: ''
  });

  // Completion Form State
  const [completionData, setCompletionData] = useState({
    costRupees: '',
    invoiceNumber: '',
    technicianRemarks: ''
  });

  useEffect(() => {
    loadData();
    loadVehicles();
  }, [selectedStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const queryParam = selectedStatus ? `?status=${selectedStatus}` : '';
      const [resList, resStats] = await Promise.all([
        fetch(`/api/v1/maintenance${queryParam}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
        }),
        fetch('/api/v1/maintenance/stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
        })
      ]);

      if (resList.ok) {
        const json = await resList.json();
        setRecords(json.data?.items || []);
      }
      if (resStats.ok) {
        const json = await resStats.json();
        setStats(json.data);
      }
    } catch (err) {
      console.error('Failed to load maintenance data', err);
    } finally {
      setLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      const res = await fetch('/api/v1/vehicles?limit=100', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) {
        const json = await res.json();
        setVehicles(json.data?.vehicles || json.data?.items || []);
      }
    } catch (err) {
      console.error('Failed to load vehicles', err);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId || !formData.scheduledDate) return;

    try {
      const res = await fetch('/api/v1/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          vehicleId: formData.vehicleId,
          serviceType: formData.serviceType,
          priority: formData.priority,
          scheduledDate: formData.scheduledDate,
          odometerReadingKm: Number(formData.odometerReadingKm) || 0,
          costPaise: Math.round((Number(formData.costRupees) || 0) * 100),
          serviceCenter: {
            name: formData.serviceCenterName,
            city: formData.serviceCenterCity
          },
          technicianRemarks: formData.technicianRemarks
        })
      });

      if (res.ok) {
        setShowScheduleModal(false);
        setFormData({
          vehicleId: '',
          serviceType: 'GENERAL_SERVICE',
          priority: 'MEDIUM',
          scheduledDate: new Date().toISOString().split('T')[0],
          odometerReadingKm: '',
          serviceCenterName: '',
          serviceCenterCity: '',
          costRupees: '',
          technicianRemarks: ''
        });
        loadData();
      }
    } catch (err) {
      console.error('Failed to schedule maintenance', err);
    }
  };

  const handleStartService = async (record: MaintenanceRecord) => {
    try {
      const res = await fetch(`/api/v1/maintenance/${record._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ status: 'IN_PROGRESS' })
      });
      if (res.ok) loadData();
    } catch (err) {
      console.error('Failed to start service', err);
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCompleteModal) return;

    try {
      const res = await fetch(`/api/v1/maintenance/${showCompleteModal._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          status: 'COMPLETED',
          costPaise: Math.round((Number(completionData.costRupees) || 0) * 100),
          invoiceNumber: completionData.invoiceNumber,
          technicianRemarks: completionData.technicianRemarks
        })
      });

      if (res.ok) {
        setShowCompleteModal(null);
        setCompletionData({ costRupees: '', invoiceNumber: '', technicianRemarks: '' });
        loadData();
      }
    } catch (err) {
      console.error('Failed to complete service', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Breadcrumbs items={[{ label: 'Fleet & Assets', href: '/app/vehicles' }, { label: 'Maintenance & Service' }]} />
          <h1 className="text-2xl font-bold text-white mt-1">Fleet Preventative Maintenance & Service</h1>
          <p className="text-sm text-slate-400">
            Schedule vehicle overhauls, log garage servicing, and avoid unexpected operational downtime.
          </p>
        </div>

        <button
          onClick={() => setShowScheduleModal(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Schedule Service</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Overdue Services
          </span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-extrabold text-rose-400">{stats?.overdueCount ?? 0}</span>
            <span className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center font-bold">
              ⚠
            </span>
          </div>
          <span className="text-xs text-rose-400 mt-2 block font-medium">Requires immediate inspection</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Currently In Garage
          </span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-extrabold text-amber-400">{stats?.inProgressCount ?? 0}</span>
            <span className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-800 text-amber-400 flex items-center justify-center font-bold">
              🔧
            </span>
          </div>
          <span className="text-xs text-amber-400 mt-2 block font-medium">Vehicles marked Under Maintenance</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Scheduled Upcoming
          </span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-extrabold text-blue-400">{stats?.scheduledCount ?? 0}</span>
            <span className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-800 text-blue-400 flex items-center justify-center font-bold">
              📅
            </span>
          </div>
          <span className="text-xs text-slate-400 mt-2 block font-medium">Queued preventative overhauls</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Completed This Month
          </span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-extrabold text-emerald-400">₹{(stats?.totalCostThisMonthRupees ?? 0).toLocaleString('en-IN')}</span>
            <span className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold">
              ✔
            </span>
          </div>
          <span className="text-xs text-slate-400 mt-2 block font-medium">
            {stats?.completedThisMonth ?? 0} assets certified & released
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-sm font-semibold text-slate-400">
        {[
          { label: 'All Maintenance', value: '' },
          { label: 'Scheduled', value: 'SCHEDULED' },
          { label: 'In Progress', value: 'IN_PROGRESS' },
          { label: 'Completed', value: 'COMPLETED' },
          { label: 'Cancelled', value: 'CANCELLED' }
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setSelectedStatus(tab.value)}
            className={`px-3 py-1.5 rounded-lg transition ${
              selectedStatus === tab.value
                ? 'bg-blue-600 text-white font-bold'
                : 'hover:bg-slate-800 hover:text-white text-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Maintenance Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950/70 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-400 uppercase text-xs">Ref #</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-400 uppercase text-xs">Vehicle</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-400 uppercase text-xs">Service Type</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-400 uppercase text-xs">Priority</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-400 uppercase text-xs">Scheduled Date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-400 uppercase text-xs">Garage / Center</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-400 uppercase text-xs">Cost (₹)</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-400 uppercase text-xs">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-400 uppercase text-xs">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500">Loading fleet maintenance logs...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500">No maintenance records found.</td>
                </tr>
              ) : (
                records.map(rec => (
                  <tr key={rec._id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3.5 font-bold font-mono text-white">{rec.maintenanceNumber}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-slate-200 font-mono">{rec.vehicleId?.plateNumber}</span>
                      <span className="text-xs text-slate-400 block">{rec.vehicleId?.vehicleType}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-slate-300">{rec.serviceType.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        rec.priority === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        rec.priority === 'HIGH' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {rec.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 font-mono text-xs">
                      {new Date(rec.scheduledDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 text-xs">
                      {rec.serviceCenter?.name || 'In-House Depot'}
                    </td>
                    <td className="px-4 py-3.5 font-medium font-mono text-emerald-400">
                      ₹{(rec.costPaise / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        rec.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        rec.status === 'IN_PROGRESS' ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse' :
                        rec.status === 'CANCELLED' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-blue-950 text-blue-300 border border-blue-800'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => handlePreviewJobCard(rec)}
                        className="bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 text-xs px-2.5 py-1 rounded font-semibold transition inline-flex items-center gap-1"
                        title="Preview & Print Maintenance Job Card"
                      >
                        👁️ Job Card
                      </button>
                      {rec.status === 'SCHEDULED' && (
                        <button
                          onClick={() => handleStartService(rec)}
                          className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-2.5 py-1 rounded font-semibold transition"
                        >
                          Start Service
                        </button>
                      )}
                      {rec.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => {
                            setShowCompleteModal(rec);
                            setCompletionData({
                              costRupees: String(rec.costPaise / 100 || ''),
                              invoiceNumber: rec.invoiceNumber || '',
                              technicianRemarks: rec.technicianRemarks || ''
                            });
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2.5 py-1 rounded font-semibold transition"
                        >
                          Certify Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Maintenance Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 max-w-lg w-full p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-white text-lg">Schedule Vehicle Service</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-white text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4 pt-4 text-sm">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Select Fleet Vehicle *</label>
                <select
                  required
                  value={formData.vehicleId}
                  onChange={e => setFormData({ ...formData, vehicleId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Vehicle --</option>
                  {vehicles.map(v => (
                    <option key={v._id} value={v._id}>
                      {v.plateNumber} ({v.vehicleType}) - Status: {v.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Service Type *</label>
                  <select
                    value={formData.serviceType}
                    onChange={e => setFormData({ ...formData, serviceType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="GENERAL_SERVICE">General Service</option>
                    <option value="OIL_CHANGE">Oil & Filter Change</option>
                    <option value="TYRE_ROTATION">Tyre Rotation / Replacement</option>
                    <option value="BRAKE_OVERHAUL">Brake Overhaul</option>
                    <option value="FITNESS_TESTING">Govt Fitness Testing</option>
                    <option value="BATTERY_REPLACEMENT">Battery Replacement</option>
                    <option value="ENGINE_TUNING">Engine Tuning</option>
                    <option value="OTHER">Other Repair</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Scheduled Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.scheduledDate}
                    onChange={e => setFormData({ ...formData, scheduledDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Current Odometer (km)</label>
                  <input
                    type="number"
                    value={formData.odometerReadingKm}
                    onChange={e => setFormData({ ...formData, odometerReadingKm: e.target.value })}
                    placeholder="e.g. 45000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Garage / Service Center</label>
                  <input
                    type="text"
                    value={formData.serviceCenterName}
                    onChange={e => setFormData({ ...formData, serviceCenterName: e.target.value })}
                    placeholder="e.g. Tata Authorized Service"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Estimated Cost (₹)</label>
                  <input
                    type="number"
                    value={formData.costRupees}
                    onChange={e => setFormData({ ...formData, costRupees: e.target.value })}
                    placeholder="e.g. 5000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Technician / Scope Remarks</label>
                <textarea
                  rows={2}
                  value={formData.technicianRemarks}
                  onChange={e => setFormData({ ...formData, technicianRemarks: e.target.value })}
                  placeholder="Routine 50,000 km major service, brake pad replacement..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 text-slate-400 font-semibold hover:bg-slate-800 hover:text-white rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2 rounded-xl shadow-sm transition"
                >
                  Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Maintenance Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 max-w-md w-full p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-white text-lg mb-2">Certify Service Completion</h3>
            <p className="text-xs text-slate-400 mb-4">
              Completing service for vehicle <span className="font-semibold text-white font-mono">{showCompleteModal.vehicleId?.plateNumber}</span> releases the vehicle status back to <strong className="text-emerald-400">AVAILABLE</strong> for trip assignments.
            </p>

            <form onSubmit={handleCompleteSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Final Invoice Amount (₹) *</label>
                <input
                  type="number"
                  required
                  value={completionData.costRupees}
                  onChange={e => setCompletionData({ ...completionData, costRupees: e.target.value })}
                  placeholder="e.g. 5400"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Garage Invoice / Bill #</label>
                <input
                  type="text"
                  value={completionData.invoiceNumber}
                  onChange={e => setCompletionData({ ...completionData, invoiceNumber: e.target.value })}
                  placeholder="e.g. INV-2026-8941"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Work Performed / Certification Notes</label>
                <textarea
                  rows={2}
                  value={completionData.technicianRemarks}
                  onChange={e => setCompletionData({ ...completionData, technicianRemarks: e.target.value })}
                  placeholder="Engine oil replaced, brake pads fitted, road tested OK."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(null)}
                  className="px-4 py-2 text-slate-400 font-semibold hover:bg-slate-800 hover:text-white rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2 rounded-xl shadow-sm transition"
                >
                  Certify & Release Vehicle
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
