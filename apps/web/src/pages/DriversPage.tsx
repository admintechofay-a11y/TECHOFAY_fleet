import React, { useState, useEffect } from 'react';
import { apiRequest, apiDownload } from '../lib/api';
import { ExcelImportModal } from '../components/ExcelImportModal';

export const DriversPage: React.FC = () => {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [licenseType, setLicenseType] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [isUploadDocModalOpen, setIsUploadDocModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New Driver Form
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    alternatePhone: '',
    licenseNumber: '',
    licenseType: 'HMV',
    licenseExpiryDate: '',
    address: '',
    emergencyContact: { name: '', relation: '', phone: '' }
  });

  // Document Upload Form
  const [docFormData, setDocFormData] = useState({
    documentType: 'DRIVING_LICENCE',
    documentNumber: '',
    issueDate: '',
    expiryDate: '',
    notes: '',
    file: null as File | null
  });

  const fetchDrivers = async (page = 1) => {
    setLoading(true);
    try {
      let q = `/drivers?page=${page}&limit=10`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (status) q += `&status=${status}`;
      if (licenseType) q += `&licenseType=${licenseType}`;

      const res = await apiRequest(q);
      setDrivers(res.data.items);
      setPagination(res.data.pagination);
    } catch (err: any) {
      console.error('Failed to load drivers:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const openDriverDetails = async (driverId: string) => {
    try {
      const res = await apiRequest(`/drivers/${driverId}`);
      setSelectedDriver(res.data);
    } catch (err: any) {
      alert(`Failed to load driver details: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchDrivers(1);
  }, [search, status, licenseType]);

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      await apiRequest('/drivers', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setIsModalOpen(false);
      setFormData({
        name: '',
        phone: '',
        alternatePhone: '',
        licenseNumber: '',
        licenseType: 'HMV',
        licenseExpiryDate: '',
        address: '',
        emergencyContact: { name: '', relation: '', phone: '' }
      });
      fetchDrivers(1);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create driver');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFormData.file || !selectedDriver) return;

    setFormLoading(true);
    setFormError(null);

    try {
      const fd = new FormData();
      fd.append('file', docFormData.file);
      fd.append('documentType', docFormData.documentType);
      fd.append('documentNumber', docFormData.documentNumber);
      if (docFormData.issueDate) fd.append('issueDate', docFormData.issueDate);
      if (docFormData.expiryDate) fd.append('expiryDate', docFormData.expiryDate);
      if (docFormData.notes) fd.append('notes', docFormData.notes);

      await apiRequest(`/drivers/${selectedDriver._id}/documents`, {
        method: 'POST',
        body: fd
      });

      setIsUploadDocModalOpen(false);
      setDocFormData({
        documentType: 'DRIVING_LICENCE',
        documentNumber: '',
        issueDate: '',
        expiryDate: '',
        notes: '',
        file: null
      });

      openDriverDetails(selectedDriver._id);
      fetchDrivers(pagination.page);
    } catch (err: any) {
      setFormError(err.message || 'Failed to upload document');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDownloadDoc = async (docId: string, filename: string) => {
    try {
      await apiDownload(`/documents/${docId}/download?type=driver`, filename);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const handleExport = async () => {
    try {
      await apiDownload(`/master/export/drivers?format=xlsx`, `drivers_${Date.now()}.xlsx`);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await apiDownload('/master/template/drivers', 'drivers_template.xlsx');
    } catch (err: any) {
      alert(`Failed to download template: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Driver Roster & Verification</h1>
          <p className="text-xs text-slate-400 mt-1">
            Driver profiles, Driving Licences, Emergency Contacts & Identity Compliance
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
            + Add Driver
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search driver name, phone, licence #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
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
            <option value="ON_LEAVE">On Leave</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select
            value={licenseType}
            onChange={(e) => setLicenseType(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Licence Types</option>
            <option value="HMV">HMV (Heavy Motor)</option>
            <option value="LMV">LMV (Light Motor)</option>
            <option value="TRANS">Transport</option>
            <option value="TRAILER">Trailer</option>
          </select>
        </div>
      </div>

      {/* Drivers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Driver Name</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Licence Number</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Licence Expiry</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Loading drivers...
                  </td>
                </tr>
              ) : drivers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No drivers found.
                  </td>
                </tr>
              ) : (
                drivers.map((d) => {
                  const expiry = new Date(d.licenseExpiryDate);
                  const isExpired = expiry < new Date();
                  const isExpiringSoon = !isExpired && (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 30;

                  return (
                    <tr key={d._id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-semibold text-white">
                        {d.name}
                      </td>
                      <td className="py-3 px-4">
                        <div>{d.phone}</div>
                        {d.alternatePhone && <div className="text-[10px] text-slate-400">Alt: {d.alternatePhone}</div>}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-200">
                        {d.licenseNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {d.licenseType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono">{expiry.toLocaleDateString('en-IN')}</div>
                        {isExpired ? (
                          <span className="text-[10px] font-semibold text-red-400">EXPIRED</span>
                        ) : isExpiringSoon ? (
                          <span className="text-[10px] font-semibold text-amber-400">Expiring Soon</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-400">Valid</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          d.status === 'AVAILABLE'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : d.status === 'ON_TRIP'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openDriverDetails(d._id)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 transition"
                        >
                          Profile & Docs →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="py-3 px-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
          <span>Total: {pagination.total} drivers</span>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchDrivers(pagination.page - 1)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
            >
              Previous
            </button>
            <span className="py-1 px-2 font-mono text-slate-300">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchDrivers(pagination.page + 1)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Driver Profile & Documents Drawer/Modal */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedDriver.name}</h2>
                <p className="text-xs text-slate-400">
                  DL: <span className="font-mono font-bold text-white">{selectedDriver.licenseNumber}</span> ({selectedDriver.licenseType})
                </p>
              </div>
              <button onClick={() => setSelectedDriver(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500">Contact:</span>
                <p className="font-semibold text-slate-200">{selectedDriver.phone}</p>
                {selectedDriver.address && <p className="text-slate-400 mt-1">{selectedDriver.address}</p>}
              </div>
              <div>
                <span className="text-slate-500">Emergency Contact:</span>
                <p className="font-semibold text-slate-200">
                  {selectedDriver.emergencyContact?.name || '-'} ({selectedDriver.emergencyContact?.relation || 'Kin'})
                </p>
                <p className="text-slate-400">{selectedDriver.emergencyContact?.phone || '-'}</p>
              </div>
            </div>

            <div className="mt-5 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Identity & Regulatory Documents (Licence, Aadhaar, PAN)
              </h3>
              <button
                onClick={() => setIsUploadDocModalOpen(true)}
                className="px-3 py-1 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white transition"
              >
                + Attach Document
              </button>
            </div>

            <div className="mt-3 border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Document</th>
                    <th className="p-2.5">Doc #</th>
                    <th className="p-2.5">Expiry Date</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {!selectedDriver.documents || selectedDriver.documents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500">
                        No documents attached. Upload Driving Licence or Aadhaar scan.
                      </td>
                    </tr>
                  ) : (
                    selectedDriver.documents.map((d: any) => (
                      <tr key={d._id} className="hover:bg-slate-800/30">
                        <td className="p-2.5 font-semibold text-white">{d.documentType}</td>
                        <td className="p-2.5 font-mono text-slate-300">{d.documentNumber || '-'}</td>
                        <td className="p-2.5 font-mono text-slate-300">
                          {d.expiryDate ? new Date(d.expiryDate).toLocaleDateString('en-IN') : 'N/A'}
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
                onClick={() => setSelectedDriver(null)}
                className="px-4 py-1.5 text-xs rounded border border-slate-700 hover:bg-slate-800 text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Document Upload Sub-Modal */}
      {isUploadDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-5 text-slate-100">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Upload Driver Document</h3>
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
                  <option value="DRIVING_LICENCE">Driving Licence (DL)</option>
                  <option value="AADHAAR">Aadhaar Card</option>
                  <option value="PAN">PAN Card</option>
                  <option value="POLICE_VERIFICATION">Police Verification Certificate</option>
                  <option value="MEDICAL_FITNESS">Medical Fitness Certificate</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Document Number</label>
                <input
                  type="text"
                  placeholder="e.g. DL / Aadhaar #"
                  value={docFormData.documentNumber}
                  onChange={(e) => setDocFormData({ ...docFormData, documentNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Expiry Date (if applicable)</label>
                <input
                  type="date"
                  value={docFormData.expiryDate}
                  onChange={(e) => setDocFormData({ ...docFormData, expiryDate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                />
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

      {/* New Driver Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Enroll New Driver</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {formError && (
              <div className="mt-3 p-2 bg-red-950 border border-red-800 text-red-200 text-xs rounded">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateDriver} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Alternate Phone</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={formData.alternatePhone}
                    onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Licence Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="GJ0120180012345"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Licence Type</label>
                  <select
                    value={formData.licenseType}
                    onChange={(e) => setFormData({ ...formData, licenseType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  >
                    <option value="HMV">HMV</option>
                    <option value="LMV">LMV</option>
                    <option value="TRANS">Transport</option>
                    <option value="TRAILER">Trailer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Licence Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={formData.licenseExpiryDate}
                  onChange={(e) => setFormData({ ...formData, licenseExpiryDate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Residential Address</label>
                <input
                  type="text"
                  placeholder="Village / Town / City"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="border-t border-slate-800 pt-3">
                <h3 className="text-xs font-semibold text-slate-400 mb-2">Emergency Contact</h3>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Contact Name"
                    value={formData.emergencyContact.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContact: { ...formData.emergencyContact, name: e.target.value }
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Relation"
                    value={formData.emergencyContact.relation}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContact: { ...formData.emergencyContact, relation: e.target.value }
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Emergency Phone"
                    value={formData.emergencyContact.phone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContact: { ...formData.emergencyContact, phone: e.target.value }
                      })
                    }
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
                  {formLoading ? 'Saving...' : 'Enroll Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ExcelImportModal
        entityType="drivers"
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => fetchDrivers(1)}
      />
    </div>
  );
};
