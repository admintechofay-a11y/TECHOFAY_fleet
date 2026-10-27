import React, { useState, useEffect } from 'react';
import { apiRequest, apiDownload } from '../lib/api';
import { ExcelImportModal } from '../components/ExcelImportModal';

export const LocationsPage: React.FC = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [locationType, setLocationType] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const initialLocationForm = {
    name: '',
    code: '',
    locationType: 'PICKUP',
    address: { street: '', city: '', state: '', pincode: '' },
    coordinates: { lat: '', lng: '' },
    contactPerson: '',
    contactPhone: ''
  };

  const [formData, setFormData] = useState(initialLocationForm);

  const fetchLocations = async (page = 1) => {
    setLoading(true);
    setFetchError(null);
    try {
      let q = `/locations?page=${page}&limit=10`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (locationType) q += `&locationType=${locationType}`;

      const res = await apiRequest(q);
      setLocations(res.data.items || []);
      setPagination(res.data.pagination);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations(1);
  }, [search, locationType]);

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Please enter a location or hub name.');
      setFormLoading(false);
      return;
    }

    try {
      const payload = {
        ...formData,
        coordinates: {
          lat: formData.coordinates.lat ? parseFloat(formData.coordinates.lat) : undefined,
          lng: formData.coordinates.lng ? parseFloat(formData.coordinates.lng) : undefined
        }
      };

      await apiRequest('/locations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setIsModalOpen(false);
      setFormData(initialLocationForm);
      fetchLocations(1);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save location');
    } finally {
      setFormLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      await apiDownload(`/master/export/locations?format=xlsx`, `locations_${Date.now()}.xlsx`);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await apiDownload('/master/template/locations', 'locations_template.xlsx');
    } catch (err: any) {
      alert(`Failed to download template: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Location Master</h1>
          <p className="text-xs text-slate-400 mt-1">
            Loading points, Unloading terminals, Warehouses, and Hub coordinates
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
            + New Location
          </button>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search location name, city, state..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={locationType}
          onChange={(e) => setLocationType(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Location Types</option>
          <option value="PICKUP">Pickup / Loading</option>
          <option value="DELIVERY">Delivery / Unloading</option>
          <option value="HUB">Hub / Yard</option>
          <option value="WAYPOINT">Waypoint</option>
        </select>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Location Name & Code</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Address / City</th>
                <th className="py-3 px-4">Coordinates</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Loading locations...
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-red-400">
                    <div className="mb-2 font-semibold">⚠️ {fetchError}</div>
                    <button onClick={() => fetchLocations(1)} className="btn btn-secondary text-xs">
                      🔄 Retry
                    </button>
                  </td>
                </tr>
              ) : locations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No locations found. Click "+ Add Location" to register your first warehouse or hub.
                  </td>
                </tr>
              ) : (
                locations.map((loc) => (
                  <tr key={loc._id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{loc.name}</div>
                      {loc.code && <div className="text-[11px] text-slate-400 font-mono">{loc.code}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {loc.locationType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div>{loc.address?.street ? `${loc.address.street}, ` : ''}{loc.address?.city}</div>
                      <div className="text-slate-400">{loc.address?.state} {loc.address?.pincode}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {loc.coordinates?.lat && loc.coordinates?.lng
                        ? `${loc.coordinates.lat.toFixed(4)}, ${loc.coordinates.lng.toFixed(4)}`
                        : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div>{loc.contactPerson || '-'}</div>
                      <div className="text-slate-400">{loc.contactPhone || '-'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        Active
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="py-3 px-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
          <span>Total: {pagination.total} locations</span>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchLocations(pagination.page - 1)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
            >
              Previous
            </button>
            <span className="py-1 px-2 font-mono text-slate-300">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchLocations(pagination.page + 1)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* New Location Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Create Location</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {formError && (
              <div className="mt-3 p-2 bg-red-950 border border-red-800 text-red-200 text-xs rounded">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateLocation} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Location Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sanand Factory Gate 2"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Code</label>
                  <input
                    type="text"
                    placeholder="e.g. LOC-SND-02"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Location Type</label>
                  <select
                    value={formData.locationType}
                    onChange={(e) => setFormData({ ...formData, locationType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  >
                    <option value="PICKUP">Pickup / Loading</option>
                    <option value="DELIVERY">Delivery / Unloading</option>
                    <option value="HUB">Hub / Yard</option>
                    <option value="WAYPOINT">Waypoint</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ahmedabad"
                    value={formData.address.city}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, city: e.target.value }
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">State *</label>
                  <input
                    type="text"
                    required
                    placeholder="Gujarat"
                    value={formData.address.state}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, state: e.target.value }
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Street</label>
                  <input
                    type="text"
                    placeholder="GIDC Phase 2"
                    value={formData.address.street}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, street: e.target.value }
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Pincode</label>
                  <input
                    type="text"
                    placeholder="382170"
                    value={formData.address.pincode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, pincode: e.target.value }
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="23.0225"
                    value={formData.coordinates.lat}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        coordinates: { ...formData.coordinates, lat: e.target.value }
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="72.5714"
                    value={formData.coordinates.lng}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        coordinates: { ...formData.coordinates, lng: e.target.value }
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
                  {formLoading ? 'Saving...' : 'Save Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ExcelImportModal
        entityType="locations"
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => fetchLocations(1)}
      />
    </div>
  );
};
