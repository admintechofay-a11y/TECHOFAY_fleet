import React, { useState, useEffect } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { PdfViewerModal } from '../components/PdfViewerModal';
import { apiRequest } from '../lib/api';

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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [showCompleteModal, setShowCompleteModal] = useState<MaintenanceRecord | null>(null);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

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

  const loadData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const queryParam = selectedStatus ? `?status=${selectedStatus}` : '';
      const [resList, resStats] = await Promise.all([
        apiRequest(`/maintenance${queryParam}`),
        apiRequest('/maintenance/stats')
      ]);

      setRecords(resList.data?.items || []);
      setStats(resStats.data || null);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load maintenance records');
    } finally {
      setLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      const res = await apiRequest('/vehicles?limit=100');
      setVehicles(res.data?.vehicles || res.data?.items || []);
    } catch (err) {
      console.error('Failed to load vehicles for maintenance:', err);
    }
  };

  useEffect(() => {
    loadData();
    loadVehicles();
  }, [selectedStatus]);

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId || !formData.scheduledDate) {
      setScheduleError('Please choose a vehicle and scheduled service date.');
      return;
    }

    setScheduleLoading(true);
    setScheduleError(null);

    try {
      await apiRequest('/maintenance', {
        method: 'POST',
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
    } catch (err: any) {
      setScheduleError(err.message || 'Failed to schedule maintenance');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleStartService = async (record: MaintenanceRecord) => {
    try {
      await apiRequest(`/maintenance/${record._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'IN_PROGRESS' })
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to start service');
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCompleteModal) return;

    setCompleteLoading(true);
    setCompleteError(null);

    try {
      await apiRequest(`/maintenance/${showCompleteModal._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'COMPLETED',
          costPaise: Math.round((Number(completionData.costRupees) || 0) * 100),
          invoiceNumber: completionData.invoiceNumber,
          technicianRemarks: completionData.technicianRemarks
        })
      });

      setShowCompleteModal(null);
      setCompletionData({ costRupees: '', invoiceNumber: '', technicianRemarks: '' });
      loadData();
    } catch (err: any) {
      setCompleteError(err.message || 'Failed to complete service');
    } finally {
      setCompleteLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Breadcrumbs items={[{ label: 'Fleet & Vehicles', href: '/app/vehicles' }, { label: 'Maintenance & Service' }]} />
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <span>🔧</span> Fleet Maintenance & Workshop Work Orders
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Preventative maintenance, routine servicing schedules, repair logs, and atomic vehicle availability transitions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setScheduleError(null);
              setShowScheduleModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl shadow-lg shadow-blue-900/30 flex items-center gap-2 transition text-sm"
          >
            <span>+</span> Schedule Service
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Scheduled</div>
          <div className="text-2xl font-black text-blue-400 mt-1">{stats ? stats.scheduledCount : '-'}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Upcoming services</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">In Progress</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{stats ? stats.inProgressCount : '-'}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">In garage currently</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Overdue</div>
          <div className="text-2xl font-black text-rose-400 mt-1">{stats ? stats.overdueCount : '-'}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Past scheduled date</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Completed Month</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{stats ? stats.completedThisMonth : '-'}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Certified this month</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 col-span-2 md:col-span-1">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Monthly Spend</div>
          <div className="text-2xl font-black text-purple-400 mt-1">
            ₹{stats ? stats.totalCostThisMonthRupees.toLocaleString('en-IN') : '-'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Fleet repair expenses</div>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="flex items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Filter Status:</span>
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <button
          onClick={loadData}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition"
        >
          <span>🔄</span> Refresh
        </button>
      </div>

      {/* Maintenance Records Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-400 uppercase text-xs">Work Order #</th>
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
              ) : fetchError ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-red-400">
                    <div className="mb-2 font-semibold">⚠️ {fetchError}</div>
                    <button onClick={loadData} className="btn btn-secondary text-xs">
                      🔄 Retry
                    </button>
                  </td>
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
                      <div>{rec.serviceCenter?.name || 'In-House'}</div>
                      <div className="text-slate-500">{rec.serviceCenter?.city}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-200 font-semibold">
                      ₹{((rec.costPaise || 0) / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                        rec.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        rec.status === 'IN_PROGRESS' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                        rec.status === 'CANCELLED' ? 'bg-slate-800 text-slate-400 border border-slate-700' :
                        'bg-blue-950 text-blue-400 border border-blue-800'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => handlePreviewJobCard(rec)}
                        title="Print / View Job Card PDF"
                        className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 py-1 rounded transition"
                      >
                        📄 Job Card
                      </button>
                      {rec.status === 'SCHEDULED' && (
                        <button
                          onClick={() => handleStartService(rec)}
                          className="text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold px-2.5 py-1 rounded transition shadow-sm"
                        >
                          ▶ Start Service
                        </button>
                      )}
                      {rec.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => {
                            setCompleteError(null);
                            setShowCompleteModal(rec);
                          }}
                          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-2.5 py-1 rounded transition shadow-sm"
                        >
                          ✓ Complete
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

            {scheduleError && (
              <div className="bg-red-950/60 border border-red-800 text-red-300 text-xs p-3 rounded-lg mt-3">
                ⚠️ {scheduleError}
              </div>
            )}

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
                  disabled={scheduleLoading}
                  className="px-4 py-2 text-slate-400 font-semibold hover:bg-slate-800 hover:text-white rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduleLoading}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl shadow-sm transition"
                >
                  {scheduleLoading ? 'Scheduling...' : 'Confirm Schedule'}
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

            {completeError && (
              <div className="bg-red-950/60 border border-red-800 text-red-300 text-xs p-3 rounded-lg mb-3">
                ⚠️ {completeError}
              </div>
            )}

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
                  disabled={completeLoading}
                  className="px-4 py-2 text-slate-400 font-semibold hover:bg-slate-800 hover:text-white rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completeLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl shadow-sm transition"
                >
                  {completeLoading ? 'Certifying...' : 'Certify & Release Vehicle'}
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
