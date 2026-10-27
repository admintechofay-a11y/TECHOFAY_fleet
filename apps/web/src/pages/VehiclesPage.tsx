import React, { useState, useEffect } from 'react';
import { apiRequest, apiDownload } from '../lib/api';
import { ExcelImportModal } from '../components/ExcelImportModal';

export const VehiclesPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [isUploadDocModalOpen, setIsUploadDocModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New Vehicle Form Initial State (Clean production defaults without fixtures)
  const initialVehicleForm = {
    plateNumber: '',
    vehicleType: 'Open Truck',
    category: 'OWNED',
    capacityTonnage: '' as any,
    make: '',
    model: '',
    yearOfManufacture: new Date().getFullYear(),
    ownerName: '',
    ownerPhone: ''
  };

  const [formData, setFormData] = useState(initialVehicleForm);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Document Upload Form State
  const [docFormData, setDocFormData] = useState({
    documentType: 'INSURANCE',
    documentNumber: '',
    issueDate: '',
    expiryDate: '',
    notes: '',
    file: null as File | null
  });

  const fetchVehicles = async (page = 1) => {
    setLoading(true);
    setFetchError(null);
    try {
      let q = `/vehicles?page=${page}&limit=10`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (status) q += `&status=${status}`;
      if (category) q += `&category=${category}`;

      const res = await apiRequest(q);
      setVehicles(res.data.items || []);
      setPagination(res.data.pagination);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  };

  const openVehicleDetails = async (vehicleId: string) => {
    try {
      const res = await apiRequest(`/vehicles/${vehicleId}`);
      setSelectedVehicle(res.data);
    } catch (err: any) {
      alert(`Failed to load vehicle details: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchVehicles(1);
  }, [search, status, category]);

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    if (!formData.plateNumber.trim()) {
      setFormError('Please enter a vehicle registration plate number.');
      setFormLoading(false);
      return;
    }
    const tonnage = parseFloat(String(formData.capacityTonnage));
    if (isNaN(tonnage) || tonnage <= 0) {
      setFormError('Please enter a valid vehicle payload capacity in Metric Tonnes (> 0).');
      setFormLoading(false);
      return;
    }

    try {
      await apiRequest('/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          capacityTonnage: tonnage,
          yearOfManufacture: parseInt(String(formData.yearOfManufacture), 10) || new Date().getFullYear()
        })
      });
      setIsModalOpen(false);
      setFormData(initialVehicleForm);
      fetchVehicles(1);
    } catch (err: any) {
      setFormError(err.message || 'Failed to add vehicle');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFormData.file || !selectedVehicle) return;

    setFormLoading(true);
    setFormError(null);

    try {
      const fd = new FormData();
      fd.append('file', docFormData.file);
      fd.append('documentType', docFormData.documentType);
      fd.append('documentNumber', docFormData.documentNumber);
      if (docFormData.issueDate) fd.append('issueDate', docFormData.issueDate);
      fd.append('expiryDate', docFormData.expiryDate);
      if (docFormData.notes) fd.append('notes', docFormData.notes);

      await apiRequest(`/vehicles/${selectedVehicle._id}/documents`, {
        method: 'POST',
        body: fd
      });

      setIsUploadDocModalOpen(false);
      setDocFormData({
        documentType: 'INSURANCE',
        documentNumber: '',
        issueDate: '',
        expiryDate: '',
        notes: '',
        file: null
      });

      // Refresh vehicle details & list
      openVehicleDetails(selectedVehicle._id);
      fetchVehicles(pagination.page);
    } catch (err: any) {
      setFormError(err.message || 'Failed to upload document');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDownloadDoc = async (docId: string, filename: string) => {
    try {
      await apiDownload(`/documents/${docId}/download?type=vehicle`, filename);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const handleExport = async () => {
    try {
      await apiDownload(`/master/export/vehicles?format=xlsx`, `vehicles_${Date.now()}.xlsx`);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await apiDownload('/master/template/vehicles', 'vehicles_template.xlsx');
    } catch (err: any) {
      alert(`Failed to download template: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Fleet Vehicle Master</h1>
          <p className="text-xs text-slate-400 mt-1">
            Commercial Trucks, Trailers, Capacities & Regulatory Document Expiry Tracking
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            📥 Template
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border border-indigo-700 transition"
          >
            📊 Import Excel
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            📤 Export XLSX
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
          >
            + Add Vehicle
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search plate, make, model, owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="ON_TRIP">On Trip</option>
            <option value="UNDER_MAINTENANCE">Under Maintenance</option>
            <option value="OUT_OF_SERVICE">Out of Service</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Categories</option>
            <option value="OWNED">Owned</option>
            <option value="ATTACHED">Attached</option>
            <option value="MARKET">Market</option>
          </select>
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Plate Number</th>
                <th className="py-3 px-4">Type & Make</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Capacity (MT)</th>
                <th className="py-3 px-4">Ownership</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Loading vehicles...
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-red-400">
                    <div className="mb-2 font-semibold">⚠️ {fetchError}</div>
                    <button onClick={() => fetchVehicles(1)} className="btn btn-secondary text-xs">
                      🔄 Retry
                    </button>
                  </td>
                </tr>
              ) : vehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No vehicles found. Click "+ Add Vehicle" to register your first asset.
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v._id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-white tracking-wide">
                      {v.plateNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200">{v.vehicleType}</div>
                      <div className="text-[11px] text-slate-400">{v.make} {v.model}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {v.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-200">
                      {v.capacityTonnage} MT
                    </td>
                    <td className="py-3 px-4">
                      <div>{v.ownerName || '-'}</div>
                      <div className="text-slate-400">{v.ownerPhone || ''}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        v.status === 'AVAILABLE'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : v.status === 'ON_TRIP'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openVehicleDetails(v._id)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 transition"
                      >
                        Docs & Details →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="py-3 px-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
          <span>Total: {pagination.total} vehicles</span>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchVehicles(pagination.page - 1)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
            >
              Previous
            </button>
            <span className="py-1 px-2 font-mono text-slate-300">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchVehicles(pagination.page + 1)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Vehicle Details & Documents Drawer/Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold font-mono text-white">{selectedVehicle.plateNumber}</h2>
                <p className="text-xs text-slate-400">{selectedVehicle.make} {selectedVehicle.model} • {selectedVehicle.capacityTonnage} MT</p>
              </div>
              <button onClick={() => setSelectedVehicle(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Compliance Documents (RC, Insurance, PUC, Fitness)
              </h3>
              <button
                onClick={() => setIsUploadDocModalOpen(true)}
                className="px-3 py-1 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white transition"
              >
                + Upload Document
              </button>
            </div>

            <div className="mt-3 border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Document Type</th>
                    <th className="p-2.5">Doc #</th>
                    <th className="p-2.5">Expiry Date</th>
                    <th className="p-2.5">Compliance</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {!selectedVehicle.documents || selectedVehicle.documents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500">
                        No documents attached. Upload RC, Insurance or PUC.
                      </td>
                    </tr>
                  ) : (
                    selectedVehicle.documents.map((d: any) => (
                      <tr key={d._id} className="hover:bg-slate-800/30">
                        <td className="p-2.5 font-semibold text-white">{d.documentType}</td>
                        <td className="p-2.5 font-mono text-slate-300">{d.documentNumber || '-'}</td>
                        <td className="p-2.5 font-mono text-slate-300">
                          {new Date(d.expiryDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            d.complianceStatus === 'VALID'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : d.complianceStatus === 'EXPIRING_SOON'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-red-950 text-red-300 border border-red-800'
                          }`}>
                            {d.complianceStatus}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => handleDownloadDoc(d._id, d.originalFileName)}
                            className="px-2 py-0.5 text-[10px] rounded bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700"
                          >
                            ⬇ Download
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800 mt-4">
              <button
                onClick={() => setSelectedVehicle(null)}
                className="px-4 py-1.5 text-xs rounded border border-slate-700 hover:bg-slate-800 text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Upload Sub-Modal */}
      {isUploadDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-5 text-slate-100">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Upload Vehicle Document</h3>
              <button onClick={() => setIsUploadDocModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {formError && (
              <div className="mt-3 p-2 bg-red-950 border border-red-800 text-red-200 text-xs rounded">
                {formError}
              </div>
            )}

            <form onSubmit={handleUploadDocument} className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Document Type *</label>
                <select
                  value={docFormData.documentType}
                  onChange={(e) => setDocFormData({ ...docFormData, documentType: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                >
                  <option value="RC">Registration Certificate (RC)</option>
                  <option value="INSURANCE">Commercial Insurance</option>
                  <option value="PUC">Pollution Under Control (PUC)</option>
                  <option value="FITNESS">Fitness Certificate</option>
                  <option value="NATIONAL_PERMIT">National Permit</option>
                  <option value="STATE_PERMIT">State Permit</option>
                  <option value="TAX_RECEIPT">Road Tax Receipt</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Document / Policy Number</label>
                <input
                  type="text"
                  placeholder="e.g. POL-992144"
                  value={docFormData.documentNumber}
                  onChange={(e) => setDocFormData({ ...docFormData, documentNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={docFormData.issueDate}
                    onChange={(e) => setDocFormData({ ...docFormData, issueDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={docFormData.expiryDate}
                    onChange={(e) => setDocFormData({ ...docFormData, expiryDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Attach File (PDF, PNG, JPG) *</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setDocFormData({ ...docFormData, file: e.target.files[0] });
                    }
                  }}
                  className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUploadDocModalOpen(false)}
                  className="px-3 py-1.5 text-xs rounded border border-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  {formLoading ? 'Uploading...' : 'Save & Attach'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Vehicle Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Add Vehicle to Fleet</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {formError && (
              <div className="mt-3 p-2 bg-red-950 border border-red-800 text-red-200 text-xs rounded">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateVehicle} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Plate Number *</label>
                <input
                  type="text"
                  required
                  placeholder="GJ01AB1234"
                  value={formData.plateNumber}
                  onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Vehicle Type *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Trailer 40ft"
                    value={formData.vehicleType}
                    onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  >
                    <option value="OWNED">Owned</option>
                    <option value="ATTACHED">Attached</option>
                    <option value="MARKET">Market</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Capacity (MT) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="35.5"
                    value={formData.capacityTonnage}
                    onChange={(e) => setFormData({ ...formData, capacityTonnage: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Year of Manufacture</label>
                  <input
                    type="number"
                    placeholder="2023"
                    value={formData.yearOfManufacture}
                    onChange={(e) => setFormData({ ...formData, yearOfManufacture: parseInt(e.target.value) || 2023 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Make</label>
                  <input
                    type="text"
                    placeholder="Tata Motors"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Model</label>
                  <input
                    type="text"
                    placeholder="Signa 4825"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs rounded border border-slate-700 hover:bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  {formLoading ? 'Adding...' : 'Add Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ExcelImportModal
        entityType="vehicles"
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => fetchVehicles(1)}
      />
    </div>
  );
};
